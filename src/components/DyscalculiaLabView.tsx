import React, { useState, useRef, useEffect } from 'react';
import {
  RotateCcw,
  Sparkles,
  Volume2,
  Check,
  X,
  Play,
  ArrowLeft,
  ArrowRight,
  Sliders,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';
import { StudentRecord } from '../data/seedData';
import {
  SubitizingTrialResult,
  NumberLineTrialResult,
  TranscodingTrialResult,
  calculateDyscalculiaMetrics,
} from '../utils/learningMetrics';
import {
  IconStar,
  IconTrophy,
  IconBaseeraFalcon,
  IconNumberRuler,
  IconLightningBolt,
} from './ui/ChildPlayfulIcons';
import {
  InteractiveNumberLine,
  toEasternArabicDigits,
} from './ui/InteractiveNumberLine';

interface DyscalculiaLabViewProps {
  students: StudentRecord[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  onUpdateStudentMath: (
    studentId: string,
    updated: Partial<StudentRecord>
  ) => void;
  onOpenFinalReport?: () => void;
}

const SUBITIZING_PATTERNS: {
  id: number;
  targetCount: number;
  dots: { cx: number; cy: number }[];
  options: number[];
}[] = [
  {
    id: 1,
    targetCount: 1,
    dots: [{ cx: 120, cy: 90 }],
    options: [1, 2, 3, 4],
  },
  {
    id: 2,
    targetCount: 2,
    dots: [{ cx: 82, cy: 65 }, { cx: 158, cy: 115 }],
    options: [1, 2, 3, 4],
  },
  {
    id: 3,
    targetCount: 3,
    dots: [{ cx: 120, cy: 48 }, { cx: 72, cy: 130 }, { cx: 168, cy: 130 }],
    options: [1, 2, 3, 4],
  },
  {
    id: 4,
    targetCount: 4,
    dots: [
      { cx: 75, cy: 55 },
      { cx: 165, cy: 55 },
      { cx: 75, cy: 130 },
      { cx: 165, cy: 130 },
    ],
    options: [1, 2, 3, 4],
  },
];

const TRANSCODING_ITEMS: {
  id: number;
  spokenText: string;
  targetNumber: number;
  reversalDistractor: number;
  options: { value: number; arabicDigits: string }[];
}[] = [
  {
    id: 1,
    spokenText: 'سَبْعَةٌ وَأَرْبَعُونَ',
    targetNumber: 47,
    reversalDistractor: 74,
    options: [
      { value: 47, arabicDigits: '٤٧' },
      { value: 74, arabicDigits: '٧٤' },
      { value: 49, arabicDigits: '٤٩' },
    ],
  },
  {
    id: 2,
    spokenText: 'ثَلَاثَةٌ وَثَمَانُونَ',
    targetNumber: 83,
    reversalDistractor: 38,
    options: [
      { value: 38, arabicDigits: '٣٨' },
      { value: 83, arabicDigits: '٨٣' },
      { value: 63, arabicDigits: '٦٣' },
    ],
  },
  {
    id: 3,
    spokenText: 'تِسْعَةٌ وَسِتُّونَ',
    targetNumber: 69,
    reversalDistractor: 96,
    options: [
      { value: 69, arabicDigits: '٦٩' },
      { value: 96, arabicDigits: '٩٦' },
      { value: 66, arabicDigits: '٦٦' },
    ],
  },
];

export const DyscalculiaLabView: React.FC<DyscalculiaLabViewProps> = ({
  students,
  selectedStudentId,
  onSelectStudent,
  onUpdateStudentMath,
  onOpenFinalReport,
}) => {
  const activeStudent =
    students.find((s) => s.id === selectedStudentId) || students[0];

  // Progressive Station Stepper (1 = Subitizing, 2 = Number Line, 3 = Transcoding)
  const [activeStation, setActiveStation] = useState<1 | 2 | 3>(1);

  // Specialist panel toggle (hidden by default for clean child playground)
  const [showSpecialistPanel, setShowSpecialistPanel] = useState<boolean>(false);

  // Subitizing active pattern index (0 to 3)
  const [activeSubitizingIdx, setActiveSubitizingIdx] = useState<number>(0);
  const [subitizingSelections, setSubitizingSelections] = useState<
    Record<number, { chosen: number; rtMs: number }>
  >({});
  const trialStartTimestampRef = useRef<Record<number, number>>({});
  const [visibleSubitizingIds, setVisibleSubitizingIds] = useState<Record<number, boolean>>({});
  const [readySubitizingIds, setReadySubitizingIds] = useState<Record<number, boolean>>({});
  const subitizingTimersRef = useRef<Record<number, number>>({});

  // 2. Spatial Number Line state
  const [activeNumberLineTrial, setActiveNumberLineTrial] = useState<1 | 2>(1);
  const [estimate37Draft, setEstimate37Draft] = useState<number>(50);
  const [estimate156Draft, setEstimate156Draft] = useState<number>(100);
  const [numberLineSelections, setNumberLineSelections] = useState<
    Record<number, { estimate: number; rtMs: number }>
  >({});
  const [numberLineTouched, setNumberLineTouched] = useState<Record<number, boolean>>({});
  const numberLineStartRef = useRef<Record<number, number>>({
    1: performance.now(),
    2: performance.now(),
  });

  // 3. Transcoding state
  const [transcodingIndex, setTranscodingIndex] = useState<number>(0);
  const [transcodingSelections, setTranscodingSelections] = useState<
    Record<number, { value: number; rtMs: number }>
  >({});
  const transcodingStartRef = useRef<number>(performance.now());

  // Simulation indicator
  const [isSimulationData, setIsSimulationData] = useState<boolean>(false);

  const mathArenaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll directly to active math arena, never to the global header or footer
  useEffect(() => {
    mathArenaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeStation]);

  useEffect(() => {
    return () => {
      Object.values(subitizingTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  // Audio speech helper
  const handleSpeakPrompt = (_id: number, text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA';
      u.rate = 0.88;
      window.speechSynthesis.speak(u);
    }
  };

  // 1. Trigger dot flash
  const handleTriggerFlash = (patternId: number) => {
    if (subitizingSelections[patternId]) return;
    setVisibleSubitizingIds((prev) => ({ ...prev, [patternId]: true }));
    setReadySubitizingIds((prev) => ({ ...prev, [patternId]: true }));

    if (subitizingTimersRef.current[patternId]) {
      window.clearTimeout(subitizingTimersRef.current[patternId]);
    }

    subitizingTimersRef.current[patternId] = window.setTimeout(() => {
      setVisibleSubitizingIds((prev) => ({ ...prev, [patternId]: false }));
      trialStartTimestampRef.current[patternId] = performance.now();
    }, 800);
  };

  const handleSelectSubitizingCount = (patternId: number, count: number) => {
    if (subitizingSelections[patternId]) return;
    const start = trialStartTimestampRef.current[patternId] || performance.now();
    const rt = Math.round(performance.now() - start);
    setSubitizingSelections((prev) => ({
      ...prev,
      [patternId]: { chosen: count, rtMs: Math.max(120, rt) },
    }));

    // Auto-advance to next pattern after 700ms if available
    if (activeSubitizingIdx < SUBITIZING_PATTERNS.length - 1) {
      setTimeout(() => {
        setActiveSubitizingIdx((prev) => prev + 1);
      }, 700);
    }
  };

  const handleRecordNumberLineEstimate = (trialKey: 1 | 2, estimate: number) => {
    if (numberLineSelections[trialKey]) return;
    const start = numberLineStartRef.current[trialKey] || performance.now();
    const rt = Math.round(performance.now() - start);
    setNumberLineSelections((prev) => ({
      ...prev,
      [trialKey]: { estimate, rtMs: Math.max(200, rt) },
    }));

    if (trialKey === 1) {
      setTimeout(() => {
        setActiveNumberLineTrial(2);
        numberLineStartRef.current[2] = performance.now();
      }, 600);
    }
  };

  const handleSelectTranscoding = (itemId: number, chosenValue: number) => {
    if (transcodingSelections[itemId]) return;
    const rt = Math.round(performance.now() - transcodingStartRef.current);
    setTranscodingSelections((prev) => ({
      ...prev,
      [itemId]: { value: chosenValue, rtMs: Math.max(200, rt) },
    }));

    if (transcodingIndex < TRANSCODING_ITEMS.length - 1) {
      setTimeout(() => {
        setTranscodingIndex((prev) => prev + 1);
        transcodingStartRef.current = performance.now();
      }, 700);
    }
  };

  const handleResetTest = () => {
    setSubitizingSelections({});
    setVisibleSubitizingIds({});
    setReadySubitizingIds({});
    setActiveSubitizingIdx(0);
    setNumberLineSelections({});
    setNumberLineTouched({});
    setEstimate37Draft(50);
    setEstimate156Draft(100);
    setActiveNumberLineTrial(1);
    setTranscodingSelections({});
    setTranscodingIndex(0);
    setIsSimulationData(false);
    setActiveStation(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadDyscalculiaSimulation = () => {
    setIsSimulationData(true);
    setSubitizingSelections({
      1: { chosen: 1, rtMs: 950 },
      2: { chosen: 2, rtMs: 1400 },
      3: { chosen: 3, rtMs: 1850 },
      4: { chosen: 3, rtMs: 2300 }, // Error on 4
    });
    setReadySubitizingIds({ 1: true, 2: true, 3: true, 4: true });
    setNumberLineSelections({
      1: { estimate: 24, rtMs: 3800 },
      2: { estimate: 122, rtMs: 4400 },
    });
    setNumberLineTouched({ 1: true, 2: true });
    setTranscodingSelections({
      1: { value: 74, rtMs: 2800 }, // Reversal error (47 -> 74)
      2: { value: 83, rtMs: 2100 },
      3: { value: 69, rtMs: 2600 },
    });
  };

  // Compile trial results
  const subitizingTrials: SubitizingTrialResult[] = Object.entries(
    subitizingSelections
  ).map(([patId, res]) => {
    const pattern = SUBITIZING_PATTERNS.find((p) => p.id === Number(patId))!;
    return {
      dotCount: pattern.targetCount,
      correct: res.chosen === pattern.targetCount,
      reactionTimeMs: res.rtMs,
    };
  });

  const numberLineTrials: NumberLineTrialResult[] = [
    ...(numberLineSelections[1]
      ? [{ target: 37, userEstimate: numberLineSelections[1].estimate, reactionTimeMs: numberLineSelections[1].rtMs, scaleMin: 0, scaleMax: 100 }]
      : []),
    ...(numberLineSelections[2]
      ? [{ target: 156, userEstimate: numberLineSelections[2].estimate, reactionTimeMs: numberLineSelections[2].rtMs, scaleMin: 0, scaleMax: 200 }]
      : []),
  ];

  const transcodingTrials: TranscodingTrialResult[] = Object.entries(
    transcodingSelections
  ).map(([itemId, res]) => {
    const item = TRANSCODING_ITEMS.find((it) => it.id === Number(itemId))!;
    return {
      targetNumber: item.targetNumber,
      selectedNumber: res.value,
      isReversalError: res.value === item.reversalDistractor,
      reactionTimeMs: res.rtMs,
    };
  });

  const computedMetrics = calculateDyscalculiaMetrics(
    subitizingTrials,
    numberLineTrials,
    transcodingTrials
  );

  const answeredSubitizingCount = Object.keys(subitizingSelections).length;
  const answeredNumberLineCount = Object.keys(numberLineSelections).length;
  const answeredTranscodingCount = Object.keys(transcodingSelections).length;
  const totalCompleted = answeredSubitizingCount + answeredNumberLineCount + answeredTranscodingCount;
  const allTasksFinished = totalCompleted === 9;

  const handleSaveToStudentProfile = () => {
    if (isSimulationData) return;
    onUpdateStudentMath(activeStudent.id, {
      subitizingAccuracy: computedMetrics.subitizingAccuracy,
      avgSubitizingMs: computedMetrics.avgSubitizingMs,
      numberLinePAE: computedMetrics.numberLinePAE,
      transcodingAccuracy: computedMetrics.transcodingAccuracy,
      reversalErrorCount: computedMetrics.reversalErrorCount,
      dyscalculiaRiskScore: null,
      mathHeuristicIndicator: null,
      mathRiskLevel: 'unassessed',
      mathRiskLabelAr: computedMetrics.riskLabelAr,
    });
  };

  const currentPattern = SUBITIZING_PATTERNS[activeSubitizingIdx];
  const isCurrentPatternFlashed = readySubitizingIds[currentPattern.id];
  const isCurrentPatternAnswered = Boolean(subitizingSelections[currentPattern.id]);

  const currentTranscodingItem = TRANSCODING_ITEMS[transcodingIndex];
  const isCurrentTranscodingAnswered = Boolean(transcodingSelections[currentTranscodingItem?.id]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-fade-slide-up" dir="rtl">
      {/* 1. PLAYFUL HERO QUEST HEADER */}
      <div className="bg-gradient-to-r from-sky-400 via-indigo-500 to-sky-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border-2 border-sky-300">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-right">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur border-2 border-white/40 flex items-center justify-center shadow-inner animate-bounce-gentle shrink-0">
              <IconBaseeraFalcon size={52} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full text-xs font-black tracking-wide mb-2 text-sky-100">
                <IconNumberRuler size={14} />
                <span>مغامرة الأرقام والحساب · الصف {activeStudent.gradeLevel}</span>
              </div>
              <h1 className="font-child text-2xl sm:text-3xl md:text-4xl font-black">
                مغامرة أبطال الأرقام: {activeStudent.name}
              </h1>
              <p className="font-child text-sm sm:text-base text-sky-100 font-bold mt-1">
                التقط النجوم السريعة واقفز مع الصقر على خط الأعداد لتجمع كؤوس الرياضيات!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white text-slate-900 rounded-2xl p-3 px-4 shadow-md text-center min-w-[95px] border-b-4 border-amber-500">
              <span className="text-xl font-black text-amber-600 font-mono flex items-center justify-center gap-1">
                <IconStar size={18} />
                <span>{totalCompleted * 15 + 60} XP</span>
              </span>
              <span className="font-child text-xs font-bold text-slate-500 block mt-0.5">نقاط البطل</span>
            </div>

            <div className="bg-white text-slate-900 rounded-2xl p-3 px-4 shadow-md text-center min-w-[95px] border-b-4 border-sky-600">
              <span className="text-xl font-black text-sky-600 font-mono flex items-center justify-center gap-1">
                <IconLightningBolt size={18} />
                <span>{totalCompleted} / ٩</span>
              </span>
              <span className="font-child text-xs font-bold text-slate-500 block mt-0.5">مهام مكتملة</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PLAYFUL DUOLINGO STATION STEPPER BAR */}
      <div className="bg-white rounded-3xl p-3 shadow-md border-2 border-slate-200/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5 w-full sm:w-auto">
          {[
            { id: 1, label: '١. صيد النجوم السريعة', done: answeredSubitizingCount === 4, count: `${answeredSubitizingCount}/4` },
            { id: 2, label: '٢. قفزة خط الأعداد', done: answeredNumberLineCount === 2, count: `${answeredNumberLineCount}/2` },
            { id: 3, label: '٣. لغز الأرقام السحري', done: answeredTranscodingCount === 3, count: `${answeredTranscodingCount}/3` },
          ].map((st) => {
            const isActive = activeStation === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setActiveStation(st.id as any)}
                className={`child-tactile-btn px-4 py-3 rounded-2xl font-child font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer border-b-4 active:border-b-1 active:translate-y-1 ${
                  isActive
                    ? 'duo-btn-green shadow-md scale-102'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <span>{st.label}</span>
                <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {st.count}
                </span>
                {st.done && <Check className="w-4 h-4 text-amber-300 stroke-[3]" />}
              </button>
            );
          })}
        </div>

        {/* Specialist Toggle Button */}
        <button
          type="button"
          onClick={() => setShowSpecialistPanel((prev) => !prev)}
          className="child-tactile-btn text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer mr-auto border border-slate-200"
          title="عرض لوحة المعلم والأخصائي ومقاييس زمن الاستجابة"
        >
          <Sliders className="w-3.5 h-3.5 text-sky-600" />
          <span>لوحة الأخصائي</span>
          {showSpecialistPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* 3. DISCREET SPECIALIST ACCORDION DRAWER (Only when expanded) */}
      {showSpecialistPanel && (
        <div className="bg-slate-50 border-2 border-sky-200 rounded-3xl p-5 shadow-inner space-y-4 animate-fade-slide-up text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Sliders className="w-4 h-4 text-sky-600" />
              <span>مقاييس الأخصائي والتحليل الوصفي للإدراك العددي:</span>
              <span className="text-[11px] font-normal text-slate-500">(مقاييس وصفية؛ لا تصنف الطفل ولا تُعد تشخيصًا لعسر الحساب)</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={activeStudent.id}
                onChange={(e) => onSelectStudent(e.target.value)}
                className="p-1.5 rounded-lg border border-slate-300 bg-white font-bold"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (الصف {s.gradeLevel})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleLoadDyscalculiaSimulation}
                className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold hover:bg-amber-200 cursor-pointer"
              >
                تحميل بيانات تجريبية
              </button>

              <button
                type="button"
                onClick={handleResetTest}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>إعادة الضبط</span>
              </button>

              {onOpenFinalReport && (
                <button
                  type="button"
                  onClick={onOpenFinalReport}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-bold hover:bg-sky-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>التقرير النهائي</span>
                  <ArrowLeft className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 block text-[11px]">دقة تمييز الكميات</span>
              <span className="text-base font-black text-slate-900 font-mono">
                {computedMetrics.subitizingAccuracy !== null ? `${computedMetrics.subitizingAccuracy}%` : 'لم يُقَس'}
              </span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 block text-[11px]">متوسط زمن الاستجابة</span>
              <span className="text-base font-black text-slate-900 font-mono">
                {computedMetrics.avgSubitizingMs !== null ? `${computedMetrics.avgSubitizingMs} ms` : 'لم يُقَس'}
              </span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 block text-[11px]">نسبة خطأ خط الأعداد</span>
              <span className="text-base font-black text-slate-900 font-mono">
                {computedMetrics.numberLinePAE !== null ? `${computedMetrics.numberLinePAE}%` : 'لم يُقَس'}
              </span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 block text-[11px]">أخطاء عكس الآحاد والعشرات</span>
              <span className="text-base font-black text-slate-900 font-mono">
                {computedMetrics.reversalErrorCount !== null ? `${computedMetrics.reversalErrorCount} من 3` : 'لم يُقَس'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. MAIN INTERACTIVE ARENA */}
      <div ref={mathArenaRef} className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border-2 border-slate-200/90 animate-fade-slide-up">
        {/* ========================================================
            STATION 1: SUBITIZING (صيد النجوم السريعة)
        ======================================================== */}
        {activeStation === 1 && (
          <div className="space-y-6 text-center max-w-xl mx-auto">
            <div className="space-y-2">
              <span className="text-xs font-black text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200 inline-block">
                المرحلة ١ · صيد النجوم السريعة
              </span>
              <h2 className="font-child text-2xl sm:text-3xl font-black text-slate-900">
                النمط {activeSubitizingIdx + 1} من {SUBITIZING_PATTERNS.length}
              </h2>
              <p className="font-child text-sm font-bold text-slate-600">
                انقر على الزر لتشاهد وميض النجوم لبرهة خاطفة، ثم اختر كم نجمة شاهدت!
              </p>
            </div>

            {/* Step indicator dots */}
            <div className="flex items-center justify-center gap-2">
              {SUBITIZING_PATTERNS.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveSubitizingIdx(idx)}
                  className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${
                    activeSubitizingIdx === idx
                      ? 'bg-sky-500 scale-125 ring-4 ring-sky-200'
                      : subitizingSelections[p.id]
                      ? 'bg-emerald-500'
                      : 'bg-slate-200'
                  }`}
                  title={`النمط ${idx + 1}`}
                />
              ))}
            </div>

            {/* Flash Visual Arena Box */}
            <div className="h-52 rounded-3xl bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 border-4 border-indigo-400/40 shadow-inner flex items-center justify-center relative overflow-hidden select-none">
              {visibleSubitizingIds[currentPattern.id] ? (
                <svg width="240" height="180" viewBox="0 0 240 180" className="animate-pulse">
                  {currentPattern.dots.map((dot, dIdx) => (
                    <g key={dIdx} className="animate-bounce-gentle">
                      <circle cx={dot.cx} cy={dot.cy} r="22" fill="#FFC800" stroke="#FFE066" strokeWidth="4" />
                      <circle cx={dot.cx} cy={dot.cy} r="10" fill="#FFFFFF" opacity="0.8" />
                    </g>
                  ))}
                </svg>
              ) : isCurrentPatternAnswered ? (
                <div className="space-y-2 animate-fade-slide-up">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center">
                    <Check className="w-10 h-10 text-emerald-400 stroke-[3]" />
                  </div>
                  <p className="font-child text-base font-black text-emerald-300">
                    أحسنت يا بطل! تم التقاط العدد {currentPattern.targetCount} بنجاح
                  </p>
                </div>
              ) : isCurrentPatternFlashed ? (
                <div className="space-y-2 animate-fade-slide-up text-white">
                  <p className="font-child text-xl font-black text-amber-300">
                    كم نجمة رأيت يا بطل؟
                  </p>
                  <p className="font-child text-xs font-bold text-slate-300">
                    اختر الرقم الصحيح من الأزرار بالأسفل بأسرع ما يمكنك!
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleTriggerFlash(currentPattern.id)}
                  className="clay-btn-emerald py-4 px-8 text-xl font-black flex items-center gap-2.5 cursor-pointer shadow-xl animate-bounce-gentle"
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span>ابدأ وميض النجوم الآن</span>
                  <IconStar size={22} />
                </button>
              )}
            </div>

            {/* Choice Buttons (1, 2, 3, 4) with Eastern Arabic and Western Digits */}
            <div className="grid grid-cols-4 gap-3 pt-2">
              {[1, 2, 3, 4].map((num) => {
                const isSelected = subitizingSelections[currentPattern.id]?.chosen === num;
                const isTarget = currentPattern.targetCount === num;
                return (
                  <button
                    key={num}
                    type="button"
                    disabled={!isCurrentPatternFlashed || isCurrentPatternAnswered}
                    onClick={() => handleSelectSubitizingCount(currentPattern.id, num)}
                    className={`py-4 sm:py-5 rounded-2xl font-child border-b-6 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center leading-tight ${
                      isSelected
                        ? isTarget
                          ? 'duo-btn-green scale-105 ring-4 ring-emerald-300'
                          : 'bg-rose-500 text-white border-rose-700'
                        : 'duo-btn-white hover:border-amber-400'
                    }`}
                  >
                    <span className="text-3xl font-black">{toEasternArabicDigits(num)}</span>
                    <span className="text-[11px] font-mono opacity-60 font-bold mt-0.5">{num}</span>
                  </button>
                );
              })}
            </div>

            {/* Next / Prev Stepper Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                disabled={activeSubitizingIdx === 0}
                onClick={() => setActiveSubitizingIdx((prev) => Math.max(0, prev - 1))}
                className="child-tactile-btn text-xs font-black text-slate-600 disabled:opacity-30 bg-slate-100 px-4 py-2.5 rounded-xl cursor-pointer"
              >
                <span>النمط السابق</span>
              </button>

              {activeSubitizingIdx < SUBITIZING_PATTERNS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveSubitizingIdx((prev) => prev + 1)}
                  className="duo-btn-blue text-xs font-black px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  <span>النمط التالي</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveStation(2)}
                  className="duo-btn-green text-xs font-black px-6 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <span>انطلق للمحطة التالية (خط الأعداد)</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            STATION 2: NUMBER LINE (قفزة الكنز على خط الأعداد)
        ======================================================== */}
        {activeStation === 2 && (
          <div className="space-y-6 text-center max-w-xl mx-auto">
            <div className="space-y-2">
              <span className="text-xs font-black text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 inline-block">
                المرحلة ٢ · قفزة الكنز على خط الأعداد
              </span>
              <h2 className="font-child text-2xl sm:text-3xl font-black text-slate-900">
                {activeNumberLineTrial === 1 ? 'المهمة الأولى: اقفز إلى العدد ٣٧' : 'المهمة الثانية: اقفز إلى العدد ١٥٦'}
              </h2>
              <p className="font-child text-sm font-bold text-slate-600">
                حرّك المؤشر ليقفز صقر بصيرة إلى الموقع التقريبي الصحيح، ثم ثبّت القفزة!
              </p>
            </div>

            {/* Trial 1: Target 37 on 0-100 scale */}
            {activeNumberLineTrial === 1 && (
              <div className="clay-card-amber p-6 sm:p-8 space-y-6 text-center">
                <InteractiveNumberLine
                  min={0}
                  max={100}
                  value={estimate37Draft}
                  onChange={(val) => {
                    setEstimate37Draft(val);
                    setNumberLineTouched((prev) => ({ ...prev, 1: true }));
                  }}
                  targetNumber={37}
                  disabled={Boolean(numberLineSelections[1])}
                />

                {!numberLineSelections[1] ? (
                  <button
                    type="button"
                    disabled={!numberLineTouched[1]}
                    onClick={() => handleRecordNumberLineEstimate(1, estimate37Draft)}
                    className="clay-btn-emerald w-full py-4 sm:py-5 text-xl flex items-center justify-center gap-3 cursor-pointer shadow-lg disabled:opacity-40"
                  >
                    <IconBaseeraFalcon size={30} />
                    <span>ثبّت قفزة الصقر الآن</span>
                  </button>
                ) : (
                  <div className="p-5 rounded-2xl bg-white border-2 border-emerald-300 space-y-3 animate-fade-slide-up shadow-sm">
                    <p className="font-child text-base font-black text-emerald-800">
                      قفزة رائعة يا بطل! تم تثبيت موقعك عند: {toEasternArabicDigits(numberLineSelections[1].estimate)} ({numberLineSelections[1].estimate})
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveNumberLineTrial(2)}
                      className="clay-btn-sky py-3.5 px-6 text-sm font-black inline-flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      <span>المهمة التالية (العدد ١٥٦)</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Trial 2: Target 156 on 0-200 scale */}
            {activeNumberLineTrial === 2 && (
              <div className="clay-card-amber p-6 sm:p-8 space-y-6 text-center">
                <InteractiveNumberLine
                  min={0}
                  max={200}
                  value={estimate156Draft}
                  onChange={(val) => {
                    setEstimate156Draft(val);
                    setNumberLineTouched((prev) => ({ ...prev, 2: true }));
                  }}
                  targetNumber={156}
                  disabled={Boolean(numberLineSelections[2])}
                />

                {!numberLineSelections[2] ? (
                  <button
                    type="button"
                    disabled={!numberLineTouched[2]}
                    onClick={() => handleRecordNumberLineEstimate(2, estimate156Draft)}
                    className="clay-btn-emerald w-full py-4 sm:py-5 text-xl flex items-center justify-center gap-3 cursor-pointer shadow-lg disabled:opacity-40"
                  >
                    <IconBaseeraFalcon size={30} />
                    <span>ثبّت قفزة الصقر الآن</span>
                  </button>
                ) : (
                  <div className="p-5 rounded-2xl bg-white border-2 border-emerald-300 space-y-3 animate-fade-slide-up shadow-sm">
                    <p className="font-child text-base font-black text-emerald-800">
                      ما شاء الله! اكتملت مهام خط الأعداد بنجاح
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveStation(3)}
                      className="clay-btn-emerald py-3.5 px-7 text-sm font-black inline-flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      <span>انطلق للمحطة التالية (لغز الأرقام السحري)</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            STATION 3: TRANSCODING (لغز الأرقام السحري)
        ======================================================== */}
        {activeStation === 3 && (
          <div className="space-y-6 text-center max-w-xl mx-auto">
            <div className="space-y-2">
              <span className="text-xs font-black text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200 inline-block">
                المرحلة ٣ · لغز استماع الأرقام السحري
              </span>
              <h2 className="font-child text-2xl sm:text-3xl font-black text-slate-900">
                السؤال {transcodingIndex + 1} من {TRANSCODING_ITEMS.length}
              </h2>
              <p className="font-child text-sm font-bold text-slate-600">
                استمع إلى نطق العدد المنطوق بالصوت، ثم اختر البطاقة المطابقة له!
              </p>
            </div>

            {/* Audio Playback Hero Box */}
            <div className="p-6 sm:p-8 rounded-3xl bg-purple-50 border-2 border-purple-200 space-y-4">
              <button
                type="button"
                onClick={() => handleSpeakPrompt(currentTranscodingItem.id, currentTranscodingItem.spokenText)}
                className="duo-btn-orange py-4 px-8 text-lg font-black flex items-center justify-center gap-2.5 mx-auto cursor-pointer shadow-md"
              >
                <Volume2 className="w-6 h-6 animate-pulse" />
                <span>استمع للعدد: «{currentTranscodingItem.spokenText}»</span>
              </button>

              <p className="font-child text-xs font-bold text-purple-900">
                المس الزر البرتقالي لسماع نطق العدد مجدداً
              </p>
            </div>

            {/* 3 Large Tactile Choice Cards */}
            <div className="grid grid-cols-3 gap-3.5 pt-2">
              {currentTranscodingItem.options.map((opt) => {
                const isSelected = transcodingSelections[currentTranscodingItem.id]?.value === opt.value;
                const isCorrect = opt.value === currentTranscodingItem.targetNumber;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isCurrentTranscodingAnswered}
                    onClick={() => handleSelectTranscoding(currentTranscodingItem.id, opt.value)}
                    className={`p-5 rounded-3xl font-child border-b-6 transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? isCorrect
                          ? 'duo-btn-green'
                          : 'bg-rose-500 text-white border-rose-700'
                        : 'duo-btn-white'
                    }`}
                  >
                    <span className="text-3xl font-black font-serif">{opt.arabicDigits}</span>
                    <span className="text-xs font-mono opacity-80">{opt.value}</span>
                  </button>
                );
              })}
            </div>

            {/* Stepper Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                disabled={transcodingIndex === 0}
                onClick={() => setTranscodingIndex((prev) => Math.max(0, prev - 1))}
                className="child-tactile-btn text-xs font-black text-slate-600 disabled:opacity-30 bg-slate-100 px-4 py-2.5 rounded-xl cursor-pointer"
              >
                <span>السؤال السابق</span>
              </button>

              {transcodingIndex < TRANSCODING_ITEMS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setTranscodingIndex((prev) => prev + 1)}
                  className="duo-btn-blue text-xs font-black px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  <span>السؤال التالي</span>
                </button>
              ) : allTasksFinished ? (
                <button
                  type="button"
                  onClick={handleSaveToStudentProfile}
                  className="duo-btn-green text-xs font-black px-6 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>اعتماد وحفظ إنجاز البطل</span>
                </button>
              ) : null}
            </div>
          </div>
        )}

        {/* ========================================================
            GRAND CELEBRATION CARD (When All Tasks are Finished)
        ======================================================== */}
        {allTasksFinished && (
          <div className="mt-8 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-white shadow-xl text-center space-y-4 border-3 border-amber-300 animate-fade-slide-up">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-white/30 backdrop-blur border-2 border-white/50 flex items-center justify-center shadow-inner animate-bounce-gentle">
              <IconTrophy size={48} />
            </div>
            <div className="space-y-1">
              <h3 className="font-child text-2xl sm:text-3xl font-black flex items-center justify-center gap-2">
                <span>كفو يا بطل الرياضيات {activeStudent.name}!</span>
                <IconStar size={28} />
              </h3>
              <p className="font-child text-sm sm:text-base font-bold text-amber-100">
                أكملت مهام مغامرة الأرقام الثلاث وحصلت على وسام عبقري الحساب!
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetTest}
                className="child-tactile-btn px-6 py-3 rounded-2xl bg-white text-amber-900 font-child font-black text-sm shadow-md hover:bg-amber-50 cursor-pointer"
              >
                <span>العب المغامرة مرة أخرى</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DyscalculiaLabView;
