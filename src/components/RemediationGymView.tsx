import React, { useState, useEffect, useRef, useMemo } from 'react';
import { authenticatedFetch } from '../utils/apiAuth';
import {
  Sparkles,
  Trophy,
  Play,
  RotateCcw,
  Volume2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Target,
  Zap,
  BookOpen,
  Calculator,
  Eye,
  Star,
  Award,
  Check,
  HelpCircle,
  Lightbulb,
  Info,
  X,
  RefreshCw,
} from 'lucide-react';
import { StudentRecord } from '../data/seedData';
import { AppTabId } from './HomeLandingView';
import {
  RemediationSessionPlan,
  RemediationPhonicsDrill,
  RemediationPhonicsOption,
  RemediationSyllableDrill,
  RemediationPacerPassage,
  RemediationMathDrill,
  generateAdaptiveRemediationPlan,
} from '../utils/remediationEngine';

interface RemediationGymViewProps {
  students: StudentRecord[];
  activeStudent: StudentRecord;
  onSelectStudent: (id: string) => void;
  onNavigateTab: (tab: AppTabId) => void;
  onOpenReport?: () => void;
  /** Only signed-in school administrators can load the curated activity bank. */
  canGeneratePlan?: boolean;
}

export const RemediationGymView: React.FC<RemediationGymViewProps> = ({
  students,
  activeStudent,
  onSelectStudent,
  onNavigateTab,
  onOpenReport,
  canGeneratePlan = false,
}) => {
  // Active Station Tab: phonics | syllables | pacer | math
  const [activeStation, setActiveStation] = useState<'phonics' | 'syllables' | 'pacer' | 'math'>('phonics');

  // Curated grade-specific practice selected from reviewed content
  const [curatedSession, setCuratedSession] = useState<RemediationSessionPlan | null>(null);
  const [isLoadingCurated, setIsLoadingCurated] = useState<boolean>(false);
  const [activityStatusMessage, setActivityStatusMessage] = useState<string>('');
  const [curatedSource, setCuratedSource] = useState<string | null>(null);
  const [showActivityRationale, setShowActivityRationale] = useState<boolean>(false);
  const [activeScaffold, setActiveScaffold] = useState<{ title: string; text: string; audioText: string } | null>(null);

  // Gamification State
  const [xpPoints, setXpPoints] = useState<number>(0);
  const [celebrationMessage, setCelebrationMessage] = useState<string>('');

  // Station 1: Phonics state
  const [phonicsIdx, setPhonicsIdx] = useState<number>(0);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [phonicsEvaluated, setPhonicsEvaluated] = useState<boolean>(false);

  // Station 2: Syllable Blending state
  const [syllableIdx, setSyllableIdx] = useState<number>(0);
  const [assembledSyllables, setAssembledSyllables] = useState<string[]>([]);
  const [syllableComplete, setSyllableComplete] = useState<boolean>(false);

  // Station 3: optional paced word highlighting state
  const [pacerWpm, setPacerWpm] = useState<number>(45);
  const [pacerPlaying, setPacerPlaying] = useState<boolean>(false);
  const [pacerWordIdx, setPacerWordIdx] = useState<number>(0);
  const pacerTimerRef = useRef<number | null>(null);

  // Station 4: Number Line Math Drill state
  const [mathIdx, setMathIdx] = useState<number>(0);
  const [sliderVal, setSliderVal] = useState<number>(50);
  const [mathAnswered, setMathAnswered] = useState<boolean>(false);
  const [mathErrorAbs, setMathErrorAbs] = useState<number | null>(null);

  // Only teacher-reviewed words from a completed, non-demo session can be presented as observed targets.
  const observedTargetWords = useMemo(() => {
    if (
      activeStudent.sessionStatus !== 'completed' ||
      activeStudent.teacherVerified !== true ||
      activeStudent.evidenceProvenance === 'demo-synthetic' ||
      !Array.isArray(activeStudent.verifiedWordsAlignment)
    ) return [];

    // Only explicitly reviewed substitutions/omissions are training targets.
    // Do not reuse gaze-derived or automatic-transcript candidates as teacher-verified errors.
    return activeStudent.verifiedWordsAlignment
      .filter((item) => item.status === 'phonetic_substitution' || item.status === 'omitted')
      .map((item) => item.word)
      .filter((word) => typeof word === 'string' && word.trim().length > 0)
      .slice(0, 8);
  }, [
    activeStudent.id,
    activeStudent.sessionStatus,
    activeStudent.teacherVerified,
    activeStudent.evidenceProvenance,
    activeStudent.verifiedWordsAlignment,
  ]);

  // General grade-level exercises remain available when there are no verified targets.
  const fallbackPlan = useMemo(() => {
    return generateAdaptiveRemediationPlan({
      studentName: activeStudent.name,
      gradeLevel: activeStudent.gradeLevel,
      effectiveWords: observedTargetWords.length > 0 ? observedTargetWords : ['السَّاقِيَةِ', 'بُسْتَانِ', 'الْجَدْوَلِ'],
      targetsTeacherReviewed: observedTargetWords.length > 0,
    });
  }, [activeStudent.id, activeStudent.name, activeStudent.gradeLevel, observedTargetWords]);

  const effectivePlan: RemediationSessionPlan = curatedSession || fallbackPlan;
  const phonicsList: RemediationPhonicsDrill[] = effectivePlan.phonicsDrills;
  const syllableList: RemediationSyllableDrill[] = effectivePlan.syllableDrills;
  const currentPassage: RemediationPacerPassage = effectivePlan.pacerPassage;
  const mathList: RemediationMathDrill[] = effectivePlan.mathDrills;

  const currentPhonics = phonicsList[phonicsIdx] || phonicsList[0];
  const currentSyllable = syllableList[syllableIdx] || syllableList[0];
  const currentMath = mathList[mathIdx] || mathList[0];

  // Arabic TTS helper
  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ar-SA';
        u.rate = 0.88;
        window.speechSynthesis.speak(u);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
      }
    }
  };

  // Positive celebration
  const triggerCelebration = (msg: string, earnedXp: number = 25) => {
    setCelebrationMessage(msg);
    setXpPoints((prev) => prev + earnedXp);
    setTimeout(() => setCelebrationMessage(''), 3500);
  };

  // Authenticated loading of curated educational activities for the selected grade.
  const fetchCuratedSession = async (student: StudentRecord, announce: boolean = true) => {
    if (!canGeneratePlan) {
      setActivityStatusMessage('الأنشطة العامة متاحة دون تسجيل الدخول. لتحميل أنشطة الصف من الخادم، سجّل الدخول بحساب معلّم مخوّل.');
      return;
    }
    setIsLoadingCurated(true);
    setActivityStatusMessage('');
    setActiveScaffold(null);
    try {
      const res = await authenticatedFetch('/api/remediation/curated-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          gradeLevel: student.gradeLevel,
          dialect: student.dialectCode || 'msa',
        }),
      });

      if (!res.ok) {
        setActivityStatusMessage(
          res.status === 401 || res.status === 403
            ? 'الأنشطة العامة متاحة الآن. لتحميل أنشطة الصف من الخادم، سجّل الدخول بحساب معلّم مخوّل.'
            : 'تعذّر تحميل أنشطة الصف؛ يمكنك متابعة الأنشطة التعليمية العامة الحالية.'
        );
        return;
      }

      const data = await res.json();
      if (!data?.session) {
        setActivityStatusMessage('لم يصل مخطط صالح؛ استمر بالأنشطة العامة دون تخصيص.');
        return;
      }

      setCuratedSession(data.session);
      setCuratedSource(data.source || 'curated-grade-banded');
      setPhonicsIdx(0);
      setSyllableIdx(0);
      setPacerWordIdx(0);
      setPacerPlaying(false);
      setMathIdx(0);
      setSelectedLetter(null);
      setPhonicsEvaluated(false);
      setAssembledSyllables([]);
      setSyllableComplete(false);
      setMathAnswered(false);

      if (announce) {
        triggerCelebration(
          `تم اختيار أنشطة تعليمية للصف ${student.gradeLevel}.`,
          40
        );
      }
    } catch {
      setActivityStatusMessage('تعذّر الاتصال بالخادم؛ استمر بالأنشطة التعليمية العامة الحالية.');
    } finally {
      setIsLoadingCurated(false);
    }
  };

  // Only request the curated server plan for an authenticated school administrator.
  // Keep general activities immediately available for children without a teacher session.
  useEffect(() => {
    if (canGeneratePlan) {
      void fetchCuratedSession(activeStudent, false);
    } else {
      setCuratedSession(null);
      setCuratedSource(null);
      setActivityStatusMessage('');
    }
  }, [activeStudent.id, canGeneratePlan]);

  // Station 1: Phonics letter pick
  const handleSelectPhonicsLetter = (option: RemediationPhonicsOption) => {
    setSelectedLetter(option.letter);
    setPhonicsEvaluated(true);

    if (option.isCorrect) {
      speakText(`أحسنت! كلمة ${currentPhonics.spokenWord}`);
      triggerCelebration('رائع! إجابة صحيحة (+25 نقطة)', 25);
    } else {
      speakText(option.explanation);
    }
  };

  const handleNextPhonics = () => {
    setPhonicsIdx((prev) => (prev + 1) % phonicsList.length);
    setSelectedLetter(null);
    setPhonicsEvaluated(false);
    setActiveScaffold(null);
  };

  // Station 2: Syllable logic
  const handleAddSyllable = (syl: string) => {
    if (assembledSyllables.includes(syl)) return;
    const nextList = [...assembledSyllables, syl];
    setAssembledSyllables(nextList);
    speakText(syl);

    if (nextList.length === currentSyllable.syllables.length) {
      const isRightOrder = nextList.every((s, i) => s === currentSyllable.syllables[i]);
      if (isRightOrder) {
        setSyllableComplete(true);
        setTimeout(() => {
          speakText(currentSyllable.targetWord);
          triggerCelebration(`ممتاز! ركّبت كلمة «${currentSyllable.targetWord}» (+30 نقطة)`, 30);
        }, 400);
      }
    }
  };

  const handleResetSyllables = () => {
    setAssembledSyllables([]);
    setSyllableComplete(false);
  };

  const handleNextSyllable = () => {
    setSyllableIdx((prev) => (prev + 1) % syllableList.length);
    handleResetSyllables();
    setActiveScaffold(null);
  };

  // Station 3: optional paced word highlighting loop
  useEffect(() => {
    if (!pacerPlaying) {
      if (pacerTimerRef.current) clearInterval(pacerTimerRef.current);
      return;
    }
    const intervalMs = Math.round((60 / pacerWpm) * 1000);
    pacerTimerRef.current = window.setInterval(() => {
      setPacerWordIdx((prev) => {
        if (prev >= currentPassage.words.length - 1) {
          setPacerPlaying(false);
          triggerCelebration('انتهيت من عرض النص!', 20);
          return 0;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (pacerTimerRef.current) clearInterval(pacerTimerRef.current);
    };
  }, [pacerPlaying, pacerWpm, currentPassage]);

  const handleRestartPassage = () => {
    setPacerPlaying(false);
    setPacerWordIdx(0);
    setActiveScaffold(null);
  };

  // Station 4: Math Check
  const handleCheckMath = () => {
    const diff = Math.abs(sliderVal - currentMath.targetNumber);
    setMathErrorAbs(diff);
    setMathAnswered(true);
    if (diff <= 5) {
      triggerCelebration(`أحسنت! اقتربت من الموقع المطلوب. العدد المرجعي هو ${currentMath.targetNumber} (+35 نقطة)`, 35);
      speakText('أحسنت! تقدير دقيق لموقع العدد');
    } else {
      speakText(`العدد هو ${currentMath.targetNumber}`);
    }
  };

  const handleNextMath = () => {
    setMathIdx((prev) => (prev + 1) % mathList.length);
    setMathAnswered(false);
    setMathErrorAbs(null);
    setSliderVal(50);
    setActiveScaffold(null);
  };

  // Amira Micro-Scaffolding Handlers (Adaptive Real-Time Audio + Visual Cues)
  const triggerPhonicsScaffold = () => {
    const hint =
      currentPhonics.ruleTip ||
      `استمع لصوت حرف ال${currentPhonics.targetLetter} في بداية كلمة «${currentPhonics.spokenWord}»، وانتبه لعدد النقاط وموضعها.`;
    setActiveScaffold({
      title: `مساعدة النشاط (عائلة ${currentPhonics.family})`,
      text: hint,
      audioText: hint,
    });
    speakText(hint);
  };

  const triggerSyllableScaffold = () => {
    const firstSyl = currentSyllable.syllables[0];
    const hint = `المقطع الصوتي الأول في كلمة «${currentSyllable.targetWord}» هو: «${firstSyl}». ابدأ بالنقر عليه أولاً.`;
    setActiveScaffold({
      title: `تلميح مقطعي لكلمة «${currentSyllable.targetWord}»`,
      text: hint,
      audioText: hint,
    });
    speakText(hint);
  };

  const triggerPacerScaffold = () => {
    const hint =
      'تابع الكلمة المظللة بهدوء، واقرأها ثم اربطها بمعنى الجملة. يمكنك إيقاف الإيقاع أو تغييره إذا شعرت بالإجهاد.';
    setActiveScaffold({
      title: 'متابعة الكلمة المظللة',
      text: hint,
      audioText: hint,
    });
    speakText(hint);
  };

  const triggerMathScaffold = () => {
    const tens = Math.floor(currentMath.targetNumber / 10);
    const ones = currentMath.targetNumber % 10;
    const hint = `العدد ${currentMath.targetNumber} يتكون من ${tens} عشرات (${tens * 10}) و ${ones} آحاد. انتبه لموقعه بالنسبة لنصف الخط.`;
    setActiveScaffold({
      title: 'تفكيك القيمة المكانية',
      text: hint,
      audioText: hint,
    });
    speakText(hint);
  };

  const targetedWords = observedTargetWords;

  return (
    <div className="space-y-3.5 max-w-4xl mx-auto pb-8 animate-fade-slide-up" dir="rtl">
      {/* Educational activity ribbon */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-3 sm:p-3.5 shadow-sm border border-emerald-700/40 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-emerald-300" />
          </div>
          <div className="space-y-0.5 text-right flex-1 sm:flex-initial">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-emerald-100">
                التدريب المتدرّج للقراءة والحساب
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {curatedSession && curatedSource === 'curated-grade-banded' ? 'بنك أنشطة متدرج حسب الصف' : 'أنشطة تدريبية عامة'}
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/90 flex items-center gap-1.5 flex-wrap">
              <span>{targetedWords.length > 0 ? <>أهداف تدريب راجعها المعلّم لـ <strong className="text-white underline">{activeStudent.name}</strong>:</> : <>أنشطة عامة للصف {activeStudent.gradeLevel}؛ لا توجد كلمات موثّقة كأخطاء لهذا الطالب.</>}</span>
              {targetedWords.length > 0 ? (
                <span className="inline-flex gap-1 font-serif font-bold text-amber-300">
                  {targetedWords.slice(0, 3).map((w, idx) => (
                    <span key={idx} className="bg-emerald-800/90 px-1.5 py-0.2 rounded border border-emerald-600/40 text-[10.5px]">«{w}»</span>
                  ))}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setShowActivityRationale((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-700/80 text-emerald-100 text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
            title="عرض هدف الأنشطة التعليمية"
          >
            <Info className="w-3.5 h-3.5 text-emerald-300" />
            <span>لماذا هذا النشاط؟</span>
          </button>

          <button
            type="button"
            onClick={() => fetchCuratedSession(activeStudent, true)}
            disabled={isLoadingCurated}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCurated ? 'animate-spin' : ''}`} />
            <span>{isLoadingCurated ? 'جارٍ التحميل...' : 'تحديث أنشطة الصف'}</span>
          </button>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
        يعتمد تحديث الأنشطة على بنك ثابت متدرج حسب الصف. لا تُعرض أنشطة مولّدة آليًا للأطفال قبل مراجعة لغوية وتربوية متخصصة. ولا تؤثر الكلمات التي راجعها المعلّم في النشاط إلا إذا طابقت كلمة موجودة في بنك الأنشطة.
      </p>
      {activityStatusMessage && <p role="status" className="text-xs leading-relaxed rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">{activityStatusMessage}</p>}

      {/* Optional Educational Activity Rationale */}
      {showActivityRationale && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1.5 animate-fade-slide-up shadow-2xs">
          <div className="flex items-center justify-between font-bold text-[#15803D]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>أهداف الأنشطة التعليمية المقترحة:</span>
            </span>
            <button
              type="button"
              onClick={() => setShowActivityRationale(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="leading-relaxed text-slate-700">
            {effectivePlan.learningRationale}
          </p>
        </div>
      )}

      {/* 2. COMPACT TOP CONTROL BAR (Fits inside 50px height, zero clutter) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        {/* Right: Station selector tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'phonics', label: '١. تمييز الحروف', icon: Zap },
            { id: 'syllables', label: '٢. تركيب المقاطع', icon: BookOpen },
            { id: 'pacer', label: '٣. إبراز الكلمات', icon: Eye },
            { id: 'math', label: '٤. خط الأعداد', icon: Calculator },
          ].map((st) => {
            const Icon = st.icon;
            const isActive = activeStation === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setActiveStation(st.id as any);
                  setActiveScaffold(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#15803D] text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{st.label}</span>
              </button>
            );
          })}
        </div>

        {/* Left: Quick student & Gamification Pills */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-mono font-bold text-amber-900">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>{xpPoints} XP في الجلسة</span>
          </div>

          <select
            value={activeStudent.id}
            onChange={(e) => onSelectStudent(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer"
          >
            {students.map((stu) => (
              <option key={stu.id} value={stu.id}>
                {stu.name} (الصف {stu.gradeLevel})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Floating Celebration Toast */}
      {celebrationMessage && (
        <div className="p-3.5 rounded-xl bg-[#15803D] text-white font-bold text-xs sm:text-sm flex items-center justify-between gap-3 shadow-md animate-fade-slide-up">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-300 fill-current" />
            <span>{celebrationMessage}</span>
          </div>
          <span className="text-emerald-100 text-xs font-normal">رائع استمر!</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STATION 1: PHONICS (Clean, Focused, 100% In Viewport) */}
      {/* ------------------------------------------------------------- */}
      {activeStation === 'phonics' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
          {/* Top Progress bar and Title Row */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#15803D] bg-emerald-50 px-2.5 py-1 rounded-lg">
                {currentPhonics.family}
              </span>
              <span className="text-xs font-medium text-slate-500">
                تمييز الحرف وموضع النقاط
              </span>
            </div>

            {/* Step Dots */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-slate-600 ml-1.5">
                {phonicsIdx + 1} / {phonicsList.length}
              </span>
              {phonicsList.map((ex, i) => (
                <span
                  key={ex.id || i}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === phonicsIdx
                      ? 'bg-[#15803D] scale-125'
                      : i < phonicsIdx
                        ? 'bg-emerald-300'
                        : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Interactive Core: Question + Sound + Big Letter Tiles */}
          <div className="rounded-2xl bg-gradient-to-br from-[#FAF6EE] via-white to-[#ECFDF5]/40 border border-[#E5DEC9] p-4 sm:p-5 space-y-4 text-center">
            {/* The Question */}
            <div className="space-y-2.5">
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                استمع إلى نطق الكلمة، ثم اختر الحرف الذي تبدأ به:
              </h2>

              {/* Big Prominent Audio Button */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => speakText(currentPhonics.spokenWord)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#15803D] hover:bg-[#166534] active:scale-95 text-white text-sm sm:text-base font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  <Volume2 className="w-5 h-5 animate-pulse" />
                  <span>🔊 استمع لنطق الكلمة</span>
                </button>

                {/* Optional activity hint */}
                <button
                  type="button"
                  onClick={triggerPhonicsScaffold}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs sm:text-sm font-bold transition-all border border-amber-300 cursor-pointer shadow-2xs"
                  title="عرض تلميح تعليمي"
                >
                  <Lightbulb className="w-4 h-4 text-amber-700" />
                  <span>تلميح ذكي</span>
                </button>
              </div>
            </div>

            {/* Optional learning hint */}
            {activeScaffold && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs sm:text-sm max-w-lg mx-auto flex items-start justify-between gap-2 text-right shadow-xs animate-fade-slide-up">
                <div className="space-y-1">
                  <span className="font-bold block text-amber-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>{activeScaffold.title}</span>
                  </span>
                  <p className="text-amber-950 leading-relaxed font-medium">{activeScaffold.text}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => speakText(activeScaffold.audioText)}
                    className="p-1.5 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-900 cursor-pointer"
                    title="استمع للتلميح مجدداً"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveScaffold(null)}
                    className="p-1.5 rounded-lg hover:bg-amber-200/80 text-amber-800 cursor-pointer"
                    title="إغلاق"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 3 Large, Clean, Touchable Letter Tiles */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-lg mx-auto pt-1">
              {currentPhonics.options.map((opt) => {
                const isSelected = selectedLetter === opt.letter;
                const showSuccess = phonicsEvaluated && isSelected && opt.isCorrect;
                const showError = phonicsEvaluated && isSelected && !opt.isCorrect;

                return (
                  <button
                    key={opt.letter}
                    type="button"
                    onClick={() => handleSelectPhonicsLetter(opt)}
                    className={`py-4 sm:py-5 px-3 rounded-2xl border-2 transition-all duration-150 flex flex-col items-center justify-center gap-1.5 cursor-pointer select-none ${
                      showSuccess
                        ? 'bg-[#ECFDF5] border-[#15803D] text-[#15803D] scale-105 shadow-md ring-4 ring-emerald-500/20'
                        : showError
                          ? 'bg-red-50 border-red-500 text-red-900 shadow-xs'
                          : 'bg-white hover:bg-emerald-50/60 border-slate-200 text-slate-900 hover:border-emerald-400 shadow-xs hover:shadow-sm'
                    }`}
                  >
                    <span className="text-5xl sm:text-6xl font-serif font-extrabold leading-tight">
                      {opt.letter}
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      حرف ال{opt.letterName}
                    </span>
                    {showSuccess && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#15803D] bg-emerald-100 px-2 py-0.5 rounded-full mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>صحيح!</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Word reveal & Pedagogical Rule Note */}
            {phonicsEvaluated ? (
              <div className="p-3 rounded-xl bg-white border border-emerald-200 text-center space-y-1 animate-fade-slide-up max-w-md mx-auto shadow-2xs">
                <span className="text-xs text-slate-500">الكلمة الصحيحة:</span>
                <span className="text-2xl font-serif font-bold text-[#15803D] mx-2">
                  «{currentPhonics.spokenWord}»
                </span>
                <span className="text-xs text-slate-600 block">
                  ({currentPhonics.wordMeaning})
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 max-w-md mx-auto text-right">
                💡 <span className="font-semibold">قاعدة التمييز:</span> {currentPhonics.ruleTip}
              </div>
            )}

            {/* BIG PROMINENT NEXT BUTTON CENTERED DIRECTLY AT BOTTOM */}
            <div className="pt-2 flex flex-col items-center justify-center gap-1">
              <button
                type="button"
                onClick={handleNextPhonics}
                className="w-full sm:w-auto min-w-[280px] px-8 py-3.5 rounded-2xl bg-[#15803D] hover:bg-[#166534] active:scale-95 text-white text-base font-bold transition-all flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg cursor-pointer"
              >
                <span>الانتقال للتمرين التالي</span>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-[11px] text-slate-500 font-medium">
                التمرين {phonicsIdx + 1} من {phonicsList.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STATION 2: SYLLABLES (Clean, Focused, 100% In Viewport) */}
      {/* ------------------------------------------------------------- */}
      {activeStation === 'syllables' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#15803D] bg-emerald-50 px-2.5 py-1 rounded-lg">
                تركيب الكلمات إلى مقاطع
              </span>
              <span className="text-xs font-medium text-slate-500">
                تدريب على تقسيم الكلمة وقراءتها
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-slate-600 ml-1.5">
                {syllableIdx + 1} / {syllableList.length}
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-[#FAF6EE] via-white to-[#ECFDF5]/40 border border-[#E5DEC9] p-4 sm:p-5 space-y-4 text-center">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                انقر على المقاطع بالترتيب لتكوين كلمة تعني:
              </h2>
              <div className="text-base font-extrabold text-[#15803D] mt-0.5">
                «{currentSyllable.wordMeaning}»
              </div>
            </div>

            {/* Target Assembly Box */}
            <div className="p-3.5 rounded-2xl bg-white border-2 border-dashed border-emerald-300 min-h-[75px] flex items-center justify-center gap-2 shadow-inner max-w-md mx-auto">
              {assembledSyllables.length === 0 ? (
                <span className="text-xs text-slate-400 font-medium">
                  انقر على المقاطع بالأسفل لتركيبها هنا بالترتيب...
                </span>
              ) : (
                <div className="flex items-center gap-2 text-2xl sm:text-3xl font-serif font-extrabold text-[#15803D]">
                  {assembledSyllables.map((s, i) => (
                    <span
                      key={i}
                      className="px-3.5 py-1 bg-emerald-100 border border-emerald-300 rounded-xl"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Syllable Options */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {currentSyllable.syllables.map((syl) => {
                const isUsed = assembledSyllables.includes(syl);
                return (
                  <button
                    key={syl}
                    type="button"
                    disabled={isUsed}
                    onClick={() => handleAddSyllable(syl)}
                    className={`px-5 py-2.5 rounded-2xl text-xl sm:text-2xl font-serif font-extrabold transition-all border-2 cursor-pointer ${
                      isUsed
                        ? 'bg-slate-100 text-slate-300 border-slate-200 opacity-40 cursor-not-allowed'
                        : 'bg-white hover:bg-emerald-50 text-slate-900 border-slate-300 hover:border-emerald-500 shadow-xs hover:scale-105 active:scale-95'
                    }`}
                  >
                    {syl}
                  </button>
                );
              })}
            </div>

            {/* Reset, speech and optional hints */}
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleResetSyllables}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ترتيب</span>
              </button>

              <button
                type="button"
                onClick={triggerSyllableScaffold}
                className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-amber-300"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-700" />
                <span>تلميح صوتي</span>
              </button>

              {syllableComplete && (
                <button
                  type="button"
                  onClick={() => speakText(currentSyllable.targetWord)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#15803D] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>استمع «{currentSyllable.targetWord}»</span>
                </button>
              )}
            </div>

            {/* Optional learning hint */}
            {activeScaffold && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs sm:text-sm max-w-lg mx-auto flex items-start justify-between gap-2 text-right shadow-xs animate-fade-slide-up">
                <div className="space-y-1">
                  <span className="font-bold block text-amber-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>{activeScaffold.title}</span>
                  </span>
                  <p className="text-amber-950 leading-relaxed font-medium">{activeScaffold.text}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => speakText(activeScaffold.audioText)}
                    className="p-1.5 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-900 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveScaffold(null)}
                    className="p-1.5 rounded-lg hover:bg-amber-200/80 text-amber-800 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* CENTERED NEXT BUTTON */}
            <div className="pt-2 flex flex-col items-center justify-center gap-1">
              <button
                type="button"
                onClick={handleNextSyllable}
                className="w-full sm:w-auto min-w-[280px] px-8 py-3.5 rounded-2xl bg-[#15803D] hover:bg-[#166534] active:scale-95 text-white text-base font-bold transition-all flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg cursor-pointer"
              >
                <span>الانتقال للكلمة التالية</span>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-[11px] text-slate-500 font-medium">
                الكلمة {syllableIdx + 1} من {syllableList.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STATION 3: OPTIONAL PACED WORD HIGHLIGHTING (Clean, Focused) */}
      {/* ------------------------------------------------------------- */}
      {activeStation === 'pacer' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#15803D] bg-emerald-50 px-2.5 py-1 rounded-lg">
                إبراز الكلمات بإيقاع قابل للتعديل
              </span>
              <span className="text-xs font-medium text-slate-500">
                يعرض الكلمات بالتتابع؛ اختر إيقاعًا مريحًا، ولا يُستخدم للحكم على سرعة الطفل
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPacerPlaying((prev) => !prev)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  pacerPlaying
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-[#15803D] text-white hover:bg-[#166534]'
                }`}
              >
                {pacerPlaying ? (
                  <span>إيقاف ❚❚</span>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>تشغيل ▶</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={triggerPacerScaffold}
                className="px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold flex items-center gap-1 cursor-pointer border border-amber-300"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-700" />
                <span>إرشاد</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-[#FAF6EE] via-white to-[#ECFDF5]/40 border border-[#E5DEC9] p-4 sm:p-5 space-y-4 text-center">
            <div className="flex items-center justify-between text-xs text-slate-600 border-b border-[#E5DEC9] pb-2">
              <span className="font-bold text-slate-900">
                «{currentPassage.title}» · {currentPassage.gradeLevel}
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <span>الإيقاع:</span>
                {[30, 45, 60].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setPacerWpm(w)}
                    className={`px-2 py-0.5 rounded text-xs font-bold cursor-pointer ${
                      pacerWpm === w
                        ? 'bg-[#15803D] text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Reading Pacer Canvas */}
            <div className="py-5 px-3 rounded-2xl bg-white border border-[#E5DEC9] shadow-xs">
              <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-3 text-2xl sm:text-3xl font-serif leading-[2.2]">
                {currentPassage.words.map((word, wIdx) => {
                  const isActive = wIdx === pacerWordIdx && pacerPlaying;
                  const isPast = wIdx < pacerWordIdx && pacerPlaying;
                  return (
                    <span
                      key={wIdx}
                      className={`transition-all duration-150 px-2.5 py-0.5 rounded-xl ${
                        isActive
                          ? 'bg-[#15803D] text-white font-extrabold scale-110 shadow-md ring-4 ring-emerald-500/30'
                          : isPast
                            ? 'text-slate-400'
                            : 'text-slate-900 font-bold'
                      }`}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Optional learning hint */}
            {activeScaffold && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs sm:text-sm max-w-lg mx-auto flex items-start justify-between gap-2 text-right shadow-xs animate-fade-slide-up">
                <div className="space-y-1">
                  <span className="font-bold block text-amber-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>{activeScaffold.title}</span>
                  </span>
                  <p className="text-amber-950 leading-relaxed font-medium">{activeScaffold.text}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => speakText(activeScaffold.audioText)}
                    className="p-1.5 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-900 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveScaffold(null)}
                    className="p-1.5 rounded-lg hover:bg-amber-200/80 text-amber-800 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* CENTERED NEXT/RESTART BUTTON */}
            <div className="pt-2 flex flex-col items-center justify-center gap-1">
              <button
                type="button"
                onClick={handleRestartPassage}
                className="w-full sm:w-auto min-w-[280px] px-8 py-3.5 rounded-2xl bg-[#15803D] hover:bg-[#166534] active:scale-95 text-white text-base font-bold transition-all flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg cursor-pointer"
              >
                <span>إعادة قراءة النص الإيقاعي</span>
                <RotateCcw className="w-4 h-4" />
              </button>
              <span className="text-[11px] text-slate-500 font-medium">
                أعد القراءة بالسرعة التي تريحك، وخذ استراحة متى احتجت.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STATION 4: NUMBER LINE (Clean, Focused) */}
      {/* ------------------------------------------------------------- */}
      {activeStation === 'math' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#15803D] bg-emerald-50 px-2.5 py-1 rounded-lg">
                نشاط تعليمي على خط الأعداد
              </span>
              <span className="text-xs font-medium text-slate-500">
                تدريب اختياري على القيمة المكانية وخط الأعداد
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-600">
              {mathIdx + 1} / {mathList.length}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-[#FAF6EE] via-white to-[#ECFDF5]/40 border border-[#E5DEC9] p-4 sm:p-5 space-y-4 text-center">
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {currentMath.prompt}
              </h2>
            </div>

            {/* Target Number */}
            <div className="inline-block px-7 py-2.5 rounded-2xl bg-sky-50 border-2 border-sky-300">
              <span className="text-xs font-bold text-sky-800 block">العدد المطلوب:</span>
              <span className="text-4xl sm:text-5xl font-mono font-extrabold text-[#0284C7] tabular-nums">
                {currentMath.targetNumber}
              </span>
            </div>

            {/* Slider */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5 max-w-lg mx-auto shadow-xs">
              <div className="flex items-center justify-between text-sm font-mono font-extrabold text-slate-800">
                <span>{currentMath.min}</span>
                <span className="text-xs font-normal text-slate-400">
                  المنتصف ({Math.round((currentMath.max - currentMath.min) / 2)})
                </span>
                <span>{currentMath.max}</span>
              </div>

              <input
                type="range"
                min={currentMath.min}
                max={currentMath.max}
                value={sliderVal}
                onChange={(e) => {
                  setSliderVal(Number(e.target.value));
                  setMathAnswered(false);
                }}
                className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
              />

              <div className="flex items-center justify-between text-xs text-slate-600 font-mono">
                <span>المحدد: <strong className="text-slate-900 text-sm font-extrabold">{sliderVal}</strong></span>
                {mathAnswered && mathErrorAbs !== null && (
                  <span className={`font-bold ${mathErrorAbs <= 5 ? 'text-[#059669]' : 'text-[#D97706]'}`}>
                    فارق الخطأ: {mathErrorAbs} أرقام
                  </span>
                )}
              </div>
            </div>

            {/* Base-10 Place-Value breakdown */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 max-w-md mx-auto text-right space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>تفكيك المنازل المكانية لمنع عكس الخانات:</span>
                </div>
                <button
                  type="button"
                  onClick={triggerMathScaffold}
                  className="text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer"
                >
                  <Lightbulb className="w-3 h-3 text-amber-600" />
                  <span>تلميح</span>
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold">
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-amber-950">
                  <span>العشرات:</span>
                  <span className="font-mono font-bold">{Math.floor(currentMath.targetNumber / 10)}</span>
                  <span className="text-amber-700 font-normal">({Math.floor(currentMath.targetNumber / 10) * 10})</span>
                </div>
                <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-emerald-950">
                  <span>الآحاد:</span>
                  <span className="font-mono font-bold">{currentMath.targetNumber % 10}</span>
                  <span className="text-emerald-700 font-normal">({currentMath.targetNumber % 10})</span>
                </div>
              </div>
            </div>

            {/* Optional learning hint */}
            {activeScaffold && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs sm:text-sm max-w-lg mx-auto flex items-start justify-between gap-2 text-right shadow-xs animate-fade-slide-up">
                <div className="space-y-1">
                  <span className="font-bold block text-amber-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>{activeScaffold.title}</span>
                  </span>
                  <p className="text-amber-950 leading-relaxed font-medium">{activeScaffold.text}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => speakText(activeScaffold.audioText)}
                    className="p-1.5 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-900 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveScaffold(null)}
                    className="p-1.5 rounded-lg hover:bg-amber-200/80 text-amber-800 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons: Confirm & Next Centered */}
            <div className="pt-2 flex flex-col items-center justify-center gap-1">
              {!mathAnswered ? (
                <button
                  type="button"
                  onClick={handleCheckMath}
                  className="w-full sm:w-auto min-w-[280px] px-8 py-3.5 rounded-2xl bg-[#0284C7] hover:bg-[#0369A1] active:scale-95 text-white text-base font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer"
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>اعتماد التقدير وفحص الدقة</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNextMath}
                  className="w-full sm:w-auto min-w-[280px] px-8 py-3.5 rounded-2xl bg-[#15803D] hover:bg-[#166534] active:scale-95 text-white text-base font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer"
                >
                  <span>الانتقال للتدريب التالي</span>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <span className="text-[11px] text-slate-500 font-medium">
                التدريب {mathIdx + 1} من {mathList.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemediationGymView;
