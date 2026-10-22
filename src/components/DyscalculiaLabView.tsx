import React, { useState, useRef, useEffect } from 'react';
import {
  Calculator,
  CheckCircle2,
  RotateCcw,
  Sliders,
  ArrowLeftRight,
  Sparkles,
  Volume2,
  Timer,
  ArrowLeft,
  ArrowRight,
  Play,
} from 'lucide-react';
import { StudentRecord } from '../data/seedData';
import {
  SubitizingTrialResult,
  NumberLineTrialResult,
  TranscodingTrialResult,
  calculateDyscalculiaMetrics,
} from '../utils/clinicalMetrics';

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

  // 1. Subitizing state
  const [subitizingSelections, setSubitizingSelections] = useState<
    Record<number, { chosen: number; rtMs: number }>
  >({});
  const trialStartTimestampRef = useRef<Record<number, number>>({});
  const [visibleSubitizingIds, setVisibleSubitizingIds] = useState<Record<number, boolean>>({});
  const [readySubitizingIds, setReadySubitizingIds] = useState<Record<number, boolean>>({});
  const subitizingTimersRef = useRef<Record<number, number>>({});

  useEffect(() => {
    return () => {
      Object.values(subitizingTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  // 2. Spatial Number Line state
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
  const [showTargetOverlay, setShowTargetOverlay] = useState<boolean>(false);

  // 3. Arabic Place-Value Transcoding state
  const [transcodingSelections, setTranscodingSelections] = useState<
    Record<number, { value: number; rtMs: number }>
  >({});
  const transcodingStartRef = useRef<Record<number, number>>({
    1: performance.now(),
    2: performance.now(),
    3: performance.now(),
  });

  const [saveMessage, setSaveMessage] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [isSimulationData, setIsSimulationData] = useState<boolean>(false);

  const handleSelectSubitizing = (patternId: number, chosenCount: number) => {
    if (!readySubitizingIds[patternId] || visibleSubitizingIds[patternId]) return;
    const startTs = trialStartTimestampRef.current[patternId] || performance.now();
    const elapsed = Math.max(
      220,
      Math.min(4500, Math.round(performance.now() - startTs))
    );
    setSubitizingSelections((prev) => ({
      ...prev,
      [patternId]: { chosen: chosenCount, rtMs: elapsed },
    }));
    setValidationError('');
    setSaveMessage('');
  };

  const handleRestartSubitizingTimer = (patternId: number) => {
    const existingTimer = subitizingTimersRef.current[patternId];
    if (existingTimer) window.clearTimeout(existingTimer);
    setSubitizingSelections((prev) => {
      const copy = { ...prev };
      delete copy[patternId];
      return copy;
    });
    setReadySubitizingIds((prev) => ({ ...prev, [patternId]: false }));
    setVisibleSubitizingIds((prev) => ({ ...prev, [patternId]: true }));
    // Reaction time starts only after the 800 ms exposure ends.
    subitizingTimersRef.current[patternId] = window.setTimeout(() => {
      setVisibleSubitizingIds((prev) => ({ ...prev, [patternId]: false }));
      setReadySubitizingIds((prev) => ({ ...prev, [patternId]: true }));
      trialStartTimestampRef.current[patternId] = performance.now();
      delete subitizingTimersRef.current[patternId];
    }, 800);
  };

  const handleRecordNumberLineEstimate = (
    trialId: 1 | 2,
    newEstimate: number
  ) => {
    if (trialId === 1) {
      setEstimate37Draft(newEstimate);
    } else {
      setEstimate156Draft(newEstimate);
    }
    const startTs = numberLineStartRef.current[trialId] || performance.now();
    const elapsed = Math.max(150, Math.min(30_000, Math.round(performance.now() - startTs)));
    setNumberLineSelections((prev) => ({
      ...prev,
      [trialId]: {
        estimate: newEstimate,
        rtMs: prev[trialId]?.rtMs ? prev[trialId].rtMs : elapsed,
      },
    }));
    setNumberLineTouched((prev) => ({ ...prev, [trialId]: false }));
    setValidationError('');
    setSaveMessage('');
  };

  const handleSpeakPrompt = (id: number, text: string) => {
    transcodingStartRef.current[id] = performance.now();
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ar-SA';
        u.rate = 0.85;
        window.speechSynthesis.speak(u);
      } catch {}
    }
  };

  const handleSelectTranscoding = (itemId: number, val: number) => {
    const startTs =
      transcodingStartRef.current[itemId] || performance.now() - 1200;
    const elapsed = Math.max(
      300,
      Math.min(5000, Math.round(performance.now() - startTs))
    );
    setTranscodingSelections((prev) => ({
      ...prev,
      [itemId]: { value: val, rtMs: elapsed },
    }));
    setValidationError('');
    setSaveMessage('');
  };

  // Compute live dyscalculia metrics ONLY from completed trials
  const subitizingTrials: SubitizingTrialResult[] = SUBITIZING_PATTERNS.filter(
    (p) => Boolean(subitizingSelections[p.id])
  ).map((p) => {
    const sel = subitizingSelections[p.id];
    return {
      dotCount: p.targetCount,
      correct: sel.chosen === p.targetCount,
      reactionTimeMs: sel.rtMs,
    };
  });

  const numberLineTrials: NumberLineTrialResult[] = [];
  if (numberLineSelections[1]) {
    numberLineTrials.push({
      target: 37,
      userEstimate: numberLineSelections[1].estimate,
      reactionTimeMs: numberLineSelections[1].rtMs,
      scaleMin: 0,
      scaleMax: 100,
    });
  }
  if (numberLineSelections[2]) {
    numberLineTrials.push({
      target: 156,
      userEstimate: numberLineSelections[2].estimate,
      reactionTimeMs: numberLineSelections[2].rtMs,
      scaleMin: 0,
      scaleMax: 200,
    });
  }

  const transcodingTrials: TranscodingTrialResult[] = TRANSCODING_ITEMS.filter(
    (item) => Boolean(transcodingSelections[item.id])
  ).map((item) => {
    const sel = transcodingSelections[item.id];
    return {
      targetNumber: item.targetNumber,
      selectedNumber: sel.value,
      isReversalError: sel.value === item.reversalDistractor,
      reactionTimeMs: sel.rtMs,
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

  const handleLoadDyscalculiaSimulation = () => {
    Object.values(subitizingTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    subitizingTimersRef.current = {};
    setVisibleSubitizingIds({});
    setReadySubitizingIds({});
    setSubitizingSelections({
      1: { chosen: 1, rtMs: 520 },
      2: { chosen: 3, rtMs: 690 },
      3: { chosen: 3, rtMs: 610 },
      4: { chosen: 2, rtMs: 740 },
    });
    setEstimate37Draft(61);
    setEstimate156Draft(104);
    setNumberLineSelections({
      1: { estimate: 61, rtMs: 1940 },
      2: { estimate: 104, rtMs: 2280 },
    });
    setShowTargetOverlay(true);
    setTranscodingSelections({
      1: { value: 74, rtMs: 2340 },
      2: { value: 38, rtMs: 2610 },
      3: { value: 69, rtMs: 1890 },
    });
    setIsSimulationData(true);
    setValidationError('هذه بيانات اصطناعية للعرض فقط. امسح النموذج وابدأ المحاولات بنفسك قبل حفظ نتيجة طالب.');
    setSaveMessage('');
  };

  const handleResetTest = () => {
    Object.values(subitizingTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    subitizingTimersRef.current = {};
    const now = performance.now();
    trialStartTimestampRef.current = {};
    setVisibleSubitizingIds({});
    setReadySubitizingIds({});
    setIsSimulationData(false);
    numberLineStartRef.current = { 1: now, 2: now };
    transcodingStartRef.current = { 1: now, 2: now, 3: now };
    setSubitizingSelections({});
    setEstimate37Draft(50);
    setEstimate156Draft(100);
    setNumberLineSelections({});
    setShowTargetOverlay(false);
    setTranscodingSelections({});
    setValidationError('');
    setSaveMessage('');
    setActiveStation(1);
  };

  const handleSaveToStudentProfile = () => {
    if (isSimulationData) {
      setValidationError('لا يمكن حفظ البيانات الاصطناعية في ملف الطالب. اضغط «إعادة ضبط المهام» ثم أجرِ المحاولات الفعلية.');
      setSaveMessage('');
      return;
    }
    if (
      answeredSubitizingCount < SUBITIZING_PATTERNS.length ||
      answeredNumberLineCount < 2 ||
      answeredTranscodingCount < 3
    ) {
      setValidationError(
        `يرجى إكمال المحاولات الفعلية قبل حفظ النتيجة: تمييز الكميات (${answeredSubitizingCount}/${SUBITIZING_PATTERNS.length})، خط الأعداد (${answeredNumberLineCount}/2)، وترميز الأرقام (${answeredTranscodingCount}/3).`
      );
      setSaveMessage('');
      return;
    }
    setValidationError('');
    onUpdateStudentMath(activeStudent.id, {
      dyscalculiaAssessed: true,
      subitizingAccuracy: computedMetrics.subitizingAccuracy,
      avgSubitizingMs: computedMetrics.avgSubitizingMs,
      numberLinePAE: computedMetrics.numberLinePAE,
      transcodingAccuracy: computedMetrics.transcodingAccuracy,
      reversalErrorCount: computedMetrics.reversalErrorCount,
      dyscalculiaRiskScore: null,
      mathHeuristicIndicator: null,
      mathRiskLevel: 'unassessed',
      mathRiskLabelAr: 'هذه النتائج مقاييس وصفية؛ لا توجد درجة خطر معيارية معتمدة.',
      mathTrials: {
        subitizingTrials,
        numberLineTrials,
        transcodingTrials,
      },
    });
    setSaveMessage(
      `تم حفظ مقاييس أداء وصفية لمهام الحساب لدى ${activeStudent.name}؛ لا يُستنتج منها تشخيص أو مستوى خطر معياري.`
    );
  };

  return (
    <div className="space-y-8">
      {/* Executive Header & Station Stepper Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500 mb-1">
              فحص الحس العددي والترميز المكاني للأعداد
            </div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">
              مهام استكشافية للإدراك العددي
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="dyscalculia-student-select"
                className="text-xs font-medium text-slate-500 whitespace-nowrap"
              >
                الطالب:
              </label>
              <select
                id="dyscalculia-student-select"
                value={activeStudent.id}
                onChange={(e) => {
                  onSelectStudent(e.target.value);
                  setSaveMessage('');
                }}
                className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (الصف {s.gradeLevel})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleLoadDyscalculiaSimulation}
              className="px-3.5 py-2 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              تحميل بيانات توضيحية (لا تُحفظ)
            </button>

            <button
              type="button"
              onClick={handleResetTest}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة الضبط</span>
            </button>

            {onOpenFinalReport && (
              <button
                type="button"
                onClick={onOpenFinalReport}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
              >
                <span>الخطوة التالية: التقرير النهائي</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 3-Step Station Navigation Strip */}
        <div
          role="tablist"
          aria-label="مهام استكشافية للإدراك العددي"
          className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 bg-slate-50/50"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeStation === 1}
            onClick={() => setActiveStation(1)}
            className={`p-4 text-right transition-colors flex items-center justify-between cursor-pointer ${
              activeStation === 1
                ? 'bg-white text-slate-900 font-bold border-b-2 border-b-[#0284C7]'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <div>
              <div className="text-xs text-[#0284C7] font-semibold">
                المحطة ٠١
              </div>
              <div className="text-sm mt-0.5">تمييز الكميات بسرعة</div>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {answeredSubitizingCount}/{SUBITIZING_PATTERNS.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeStation === 2}
            onClick={() => setActiveStation(2)}
            className={`p-4 text-right transition-colors flex items-center justify-between cursor-pointer ${
              activeStation === 2
                ? 'bg-white text-slate-900 font-bold border-b-2 border-b-[#0284C7]'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <div>
              <div className="text-xs text-[#0284C7] font-semibold">
                المحطة ٠٢
              </div>
              <div className="text-sm mt-0.5">تقدير الموقع على خط الأعداد</div>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {answeredNumberLineCount}/2
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeStation === 3}
            onClick={() => setActiveStation(3)}
            className={`p-4 text-right transition-colors flex items-center justify-between cursor-pointer ${
              activeStation === 3
                ? 'bg-white text-slate-900 font-bold border-b-2 border-b-[#0284C7]'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <div>
              <div className="text-xs text-[#0284C7] font-semibold">
                المحطة ٠٣
              </div>
              <div className="text-sm mt-0.5">قراءة الأرقام وترميزها</div>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {answeredTranscodingCount}/3
            </span>
          </button>
        </div>
      </div>

      {/* Two-Zone Sandbox Layout: Left 8 Cols Active Station + Right 4 Cols Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Main 8 Cols: Active Station Canvas */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          {/* STATION 1: SUBITIZING */}
          {activeStation === 1 && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    ٠١. اختبار تمييز الكميات بسرعة وسرعة التقاط العدد
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    انقر على العدد المطابق لعدد النقاط في كل مصفوفة بأسرع ما يمكن لحساب زمن الاستجابة بالملي ثانية
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-[#0284C7]">
                  المكتمل: {answeredSubitizingCount}/{SUBITIZING_PATTERNS.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {SUBITIZING_PATTERNS.map((pattern) => {
                  const sel = subitizingSelections[pattern.id];
                  const isAnswered = Boolean(sel);
                  const isCorrect =
                    isAnswered && sel.chosen === pattern.targetCount;

                  return (
                    <div
                      key={pattern.id}
                      className="p-5 bg-[#F8FAFC] border border-slate-200 rounded-xl flex flex-col justify-between space-y-4"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">
                          المصفوفة #{pattern.id}
                        </span>
                        {isAnswered ? (
                          <span
                            className={`font-mono tabular-nums font-semibold ${
                              isCorrect ? 'text-[#059669]' : 'text-[#DC2626]'
                            }`}
                          >
                            {isCorrect
                              ? `● صحيح (${sel.rtMs}ms)`
                              : `▲ خطأ (${sel.rtMs}ms)`}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestartSubitizingTimer(pattern.id)}
                            disabled={visibleSubitizingIds[pattern.id]}
                            className="min-h-11 text-[#0284C7] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Timer className="w-3 h-3" />
                            <span>عرض النقاط (0.8 ثانية)</span>
                          </button>
                        )}
                      </div>

                      {/* Interactive Subitizing Presentation Card */}
                      {!isAnswered && !visibleSubitizingIds[pattern.id] && !readySubitizingIds[pattern.id] ? (
                        <button
                          type="button"
                          onClick={() => handleRestartSubitizingTimer(pattern.id)}
                          className="w-full h-36 bg-gradient-to-b from-sky-50/70 to-white hover:bg-sky-50 border-2 border-dashed border-sky-300 hover:border-sky-400 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group p-4 text-center"
                        >
                          <span className="w-10 h-10 rounded-full bg-sky-100 text-[#0284C7] flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">
                              انقر هنا لبدء وميض النقاط
                            </span>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              (تظهر النقاط لـ 0.8 ثانية ثم تختفي لاختبار التقدير السريع)
                            </span>
                          </div>
                        </button>
                      ) : (
                        <svg
                          viewBox="0 0 240 180"
                          className="w-full h-36 bg-white border border-slate-200 rounded-xl"
                          role="img"
                          aria-label={`مصفوفة نقاط للاختبار رقم ${pattern.id}`}
                        >
                          {visibleSubitizingIds[pattern.id] && pattern.dots.map((d, dIdx) => (
                            <circle
                              key={dIdx}
                              cx={d.cx}
                              cy={d.cy}
                              r={12}
                              fill="#0F172A"
                            />
                          ))}
                          {!visibleSubitizingIds[pattern.id] && readySubitizingIds[pattern.id] && !isAnswered && (
                            <text
                              x="120"
                              y="95"
                              textAnchor="middle"
                              fill="#0284C7"
                              fontSize="14"
                              fontWeight="bold"
                              fontFamily="sans-serif"
                            >
                              اختر إجابتك من الأرقام بالأسفل ↓
                            </text>
                          )}
                          {isAnswered && (
                            <text
                              x="120"
                              y="95"
                              textAnchor="middle"
                              fill={isCorrect ? "#059669" : "#DC2626"}
                              fontSize="14"
                              fontWeight="bold"
                              fontFamily="sans-serif"
                            >
                              {isCorrect ? `✓ صحيح (العدد ${pattern.targetCount})` : `✗ خطأ (العدد الفعلي ${pattern.targetCount})`}
                            </text>
                          )}
                        </svg>
                      )}

                      <div className="min-h-6 text-center text-xs text-slate-500" aria-live="polite">
                        {visibleSubitizingIds[pattern.id]
                          ? 'احفظ عدد النقاط — ستختفي الآن'
                          : readySubitizingIds[pattern.id] && !isAnswered
                            ? 'كم نقطة رأيت؟ اختر إجابتك.'
                            : isAnswered
                              ? 'أُسجلت الإجابة لهذا العرض.'
                              : 'اضغط «عرض النقاط» لبدء المحاولة.'}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {pattern.options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            disabled={!readySubitizingIds[pattern.id] || visibleSubitizingIds[pattern.id] || isAnswered}
                            onClick={() => handleSelectSubitizing(pattern.id, opt)}
                            aria-label={`اختيار العدد ${opt} للمصفوفة ${pattern.id}`}
                            className={`min-h-[48px] py-3 text-base font-mono tabular-nums font-semibold rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                              isAnswered && sel.chosen === opt
                                ? isCorrect
                                  ? 'bg-[#059669] text-white border-[#059669]'
                                  : 'bg-[#DC2626] text-white border-[#DC2626]'
                                : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setActiveStation(2)}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <span>الانتقال إلى المحطة ٠٢: خط الأعداد المكاني</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STATION 2: NUMBER LINE PAE */}
          {activeStation === 2 && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    ٠٢. تقدير الموقع على خط الأعداد غير المدرّج
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    حرّك المؤشر أو اضغط «تثبيت التقدير» لكل مهمة لتسجيل موقع العدد المتوقع (المكتمل: {answeredNumberLineCount}/2)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTargetOverlay(!showTargetOverlay)}
                  className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>
                    {showTargetOverlay
                      ? 'إخفاء الإجابات المرجعية'
                      : 'مؤشر استكشافي لتقدير الموقع'}
                  </span>
                </button>
              </div>

              <div className="space-y-6">
                {/* Trial A: Target 37 on 0-100 scale */}
                <div className="p-6 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-900 text-sm">
                      المهمة الأولى (مدى 0–100): حرّك المؤشر إلى تقديرك للعدد 37 ثم ثبّت الإجابة مرة واحدة.
                    </span>
                    <div className="flex items-center gap-3">
                      {numberLineSelections[1] ? (
                        <span className="font-mono tabular-nums text-slate-700">
                          تقدير الطالب:{' '}
                          <strong>{numberLineSelections[1].estimate}</strong> ·
                          PAE:{' '}
                          <strong
                            className="text-slate-700"
                          >
                            {(
                              (Math.abs(numberLineSelections[1].estimate - 37) /
                                100) *
                              100
                            ).toFixed(1)}
                            %
                          </strong>
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium">
                          ○ بانتظار تحريك المؤشر...
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={!numberLineTouched[1] || Boolean(numberLineSelections[1])}
                        onClick={() => handleRecordNumberLineEstimate(1, estimate37Draft)}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer"
                      >
                        تثبيت التقدير (1)
                      </button>
                    </div>
                  </div>

                  <div dir="ltr" className="space-y-2">
                    <label htmlFor="nl-slider-37" className="sr-only">
                      تقدير موقع العدد 37 على خط الأعداد من 0 إلى 100
                    </label>
                    <input
                      id="nl-slider-37"
                      type="range"
                      disabled={Boolean(numberLineSelections[1])}
                      min={0}
                      max={100}
                      value={estimate37Draft}
                      onPointerDown={() => { if (!numberLineSelections[1]) numberLineStartRef.current[1] = performance.now(); }}
                      onKeyDown={() => { if (!numberLineSelections[1]) numberLineStartRef.current[1] = performance.now(); }}
                      onChange={(e) => {
                        setEstimate37Draft(Number(e.target.value));
                        setNumberLineTouched((prev) => ({ ...prev, 1: true }));
                      }}
                      className="w-full accent-[#0284C7] cursor-pointer"
                    />
                    <div className="relative h-6 flex items-center justify-between text-xs font-mono tabular-nums text-slate-500">
                      <span>0</span>
                      {showTargetOverlay && (
                        <span
                          style={{ left: '37%' }}
                          className="absolute -translate-x-1/2 px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded text-[10px]"
                        >
                          الموقع الحقيقي: 37 (37%)
                        </span>
                      )}
                      <span>100</span>
                    </div>
                  </div>
                </div>

                {/* Trial B: Target 156 on 0-200 scale */}
                <div className="p-6 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-900 text-sm">
                      المهمة الثانية (مدى 0–200): حرّك المؤشر إلى تقديرك للعدد 156 ثم ثبّت الإجابة مرة واحدة.
                    </span>
                    <div className="flex items-center gap-3">
                      {numberLineSelections[2] ? (
                        <span className="font-mono tabular-nums text-slate-700">
                          تقدير الطالب:{' '}
                          <strong>{numberLineSelections[2].estimate}</strong> ·
                          PAE:{' '}
                          <strong
                            className="text-slate-700"
                          >
                            {(
                              (Math.abs(
                                numberLineSelections[2].estimate - 156
                              ) /
                                200) *
                              100
                            ).toFixed(1)}
                            %
                          </strong>
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium">
                          ○ بانتظار تحريك المؤشر...
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={!numberLineTouched[2] || Boolean(numberLineSelections[2])}
                        onClick={() => handleRecordNumberLineEstimate(2, estimate156Draft)}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer"
                      >
                        تثبيت التقدير (2)
                      </button>
                    </div>
                  </div>

                  <div dir="ltr" className="space-y-2">
                    <label htmlFor="nl-slider-156" className="sr-only">
                      تقدير موقع العدد 156 على خط الأعداد من 0 إلى 200
                    </label>
                    <input
                      id="nl-slider-156"
                      type="range"
                      disabled={Boolean(numberLineSelections[2])}
                      min={0}
                      max={200}
                      value={estimate156Draft}
                      onPointerDown={() => { if (!numberLineSelections[2]) numberLineStartRef.current[2] = performance.now(); }}
                      onKeyDown={() => { if (!numberLineSelections[2]) numberLineStartRef.current[2] = performance.now(); }}
                      onChange={(e) => {
                        setEstimate156Draft(Number(e.target.value));
                        setNumberLineTouched((prev) => ({ ...prev, 2: true }));
                      }}
                      className="w-full accent-[#0284C7] cursor-pointer"
                    />
                    <div className="relative h-6 flex items-center justify-between text-xs font-mono tabular-nums text-slate-500">
                      <span>0</span>
                      {showTargetOverlay && (
                        <span
                          style={{ left: '78%' }}
                          className="absolute -translate-x-1/2 px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded text-[10px]"
                        >
                          الموقع الحقيقي: 156 (78%)
                        </span>
                      )}
                      <span>200</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStation(1)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>المحطة السابقة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStation(3)}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <span>الانتقال إلى المحطة ٠٣: ترميز الأرقام</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STATION 3: TRANSCODING */}
          {activeStation === 3 && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    ٠٣. فحص الترميز العددي والخلط المكاني للآحاد والعشرات بالعربية
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    اضغط على زر الصوت لسماع العدد منطوقاً بالعربية، ثم اختر الرمز الرقمي الصحيح له
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-[#0284C7]">
                  المكتمل: {answeredTranscodingCount}/3 · الانعكاسات:{' '}
                  {computedMetrics.reversalErrorCount}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {TRANSCODING_ITEMS.map((item) => {
                  const sel = transcodingSelections[item.id];
                  const isAnswered = Boolean(sel);
                  const isReversal =
                    isAnswered && sel.value === item.reversalDistractor;
                  const isCorrect =
                    isAnswered && sel.value === item.targetNumber;

                  return (
                    <div
                      key={item.id}
                      className="p-5 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            الصيغة اللفظية:
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleSpeakPrompt(item.id, item.spokenText)
                            }
                            className="px-2.5 py-1 text-[11px] font-medium bg-white text-[#0284C7] border border-slate-200 rounded-lg hover:bg-sky-50 flex items-center gap-1 cursor-pointer"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>نطق صوتي</span>
                          </button>
                        </div>

                        <div className="text-lg font-bold text-slate-900 font-display py-2 text-center bg-white border border-slate-200 rounded-xl">
                          «{item.spokenText}»
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {item.options.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              handleSelectTranscoding(item.id, opt.value)
                            }
                            className={`py-2.5 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                              isAnswered && sel.value === opt.value
                                ? opt.value === item.targetNumber
                                  ? 'bg-[#059669] text-white border-[#059669]'
                                  : 'bg-[#DC2626] text-white border-[#DC2626]'
                                : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="text-base font-bold">
                              {opt.arabicDigits}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums opacity-80">
                              {opt.value}
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="text-xs">
                        {!isAnswered ? (
                          <span className="text-slate-400">
                            اختر الرقم المطابق أعلاه...
                          </span>
                        ) : isCorrect ? (
                          <span className="text-[#059669] font-medium">
                            ● ترميز مكاني سليم ({sel.rtMs}ms)
                          </span>
                        ) : isReversal ? (
                          <span className="text-[#DC2626] font-medium flex items-center gap-1">
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <span>▲ انعكاس آحاد/عشرات ({sel.value})</span>
                          </span>
                        ) : (
                          <span className="text-[#D97706] font-medium">
                            ▲ خطأ في المطابقة العددية
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStation(2)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>المحطة السابقة</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToStudentProfile}
                  disabled={isSimulationData}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>اعتماد وحفظ النتيجة في ملف الطالب</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Clean Sticky Diagnostic Summary Deck (Hairline-Divided, No Box-in-Box) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)] sticky top-24">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Calculator className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>مقاييس الأداء الوصفية</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              نتائج المهام الحسابية
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              تعرض هذه الصفحة أداء الطفل في مهام قصيرة فقط. لم تُعايَر حدود تصنيف لعسر الحساب على عينة عربية ممثلة؛ لذلك لا تعرض الصفحة درجة خطر أو تشخيصًا.
            </p>
          </div>

          <div className="p-6 border-b border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>حالة استكمال المهام</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {answeredSubitizingCount === SUBITIZING_PATTERNS.length &&
                answeredNumberLineCount === 2 &&
                answeredTranscodingCount === 3
                  ? 'اكتملت 9 من 9 مهام'
                  : (answeredSubitizingCount + answeredNumberLineCount + answeredTranscodingCount) + ' / 9 مهام'}
              </span>
            </div>

            {answeredSubitizingCount === SUBITIZING_PATTERNS.length &&
            answeredNumberLineCount === 2 &&
            answeredTranscodingCount === 3 ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-bold text-slate-800">{computedMetrics.riskLabelAr}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    لا تعرض هذه النسخة درجة خطر أو تصنيفًا معياريًا. راجع دقة المهام وخطأ خط الأعداد وترميز الأعداد كلًّا على حدة.
                  </p>
                </div>
              </>
            ) : (
              <div className="py-1 space-y-1">
                <div className="text-sm font-bold text-slate-800">
                  بانتظار استكمال المحطات الثلاث
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  أكمل تمييز الكميات ({answeredSubitizingCount}/{SUBITIZING_PATTERNS.length})، خط الأعداد (
                  {answeredNumberLineCount}/2)، وترميز الأرقام (
                  {answeredTranscodingCount}/3) لإصدار النتيجة.
                </p>
              </div>
            )}
          </div>

          <div className="p-6 space-y-4">
            <div className="divide-y divide-slate-100 text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-600">
                  نسبة الخطأ في خط الأعداد
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {answeredNumberLineCount > 0 && computedMetrics.numberLinePAE !== null
                    ? String(computedMetrics.numberLinePAE) + '%'
                    : 'لم يُقَس'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-600">
                  صحة الإجابات في مهمة تمييز الكميات
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {answeredSubitizingCount > 0 && computedMetrics.subitizingAccuracy !== null
                    ? String(computedMetrics.subitizingAccuracy) + '%'
                    : 'لم يُقَس'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-600">متوسط زمن الاستجابة في المهام</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {answeredSubitizingCount > 0 && computedMetrics.avgSubitizingMs !== null
                    ? String(computedMetrics.avgSubitizingMs) + ' مللي ثانية'
                    : 'لم يُقَس'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-600">
                  أخطاء عكس الآحاد والعشرات
                </span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    (computedMetrics.reversalErrorCount ?? 0) > 0
                      ? 'text-[#DC2626]'
                      : 'text-[#059669]'
                  }`}
                >
                  {computedMetrics.reversalErrorCount ?? 'لم يُقَس'} من{' ' }
                  {TRANSCODING_ITEMS.length}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveToStudentProfile}
              disabled={isSimulationData}
              className="w-full py-3 px-4 bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>حفظ النتيجة في سجل الطالب ({activeStudent.name})</span>
            </button>

            {validationError && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#DC2626]"
              >
                {validationError}
              </div>
            )}

            {saveMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                <span>{saveMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
