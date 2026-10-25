import React, { useState, useEffect, useRef, useMemo } from 'react';
import { authenticatedFetch } from '../utils/apiAuth';
import { playNaturalArabicAudio } from '../utils/naturalSpeech';
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
  Flame,
  FileText,
  Pause,
} from 'lucide-react';
import { DailySprintStation } from './remediation/DailySprintStation';
import { StoryGenStation } from './remediation/StoryGenStation';
import { IconStar, IconFlame, IconStoryBook, IconLettersBlock, IconPuzzlePieces, IconNumberRuler, IconLightningBolt, IconBaseeraFalcon } from './ui/ChildPlayfulIcons';
import { InteractiveNumberLine, toEasternArabicDigits } from './ui/InteractiveNumberLine';
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
  /** Specific station to open directly (e.g., from top navigation bar) */
  initialStation?: 'phonics' | 'syllables' | 'pacer' | 'math' | 'sprint' | 'storygen';
}

export const RemediationGymView: React.FC<RemediationGymViewProps> = ({
  students,
  activeStudent,
  onSelectStudent,
  onNavigateTab,
  onOpenReport,
  canGeneratePlan = false,
  initialStation,
}) => {
  // Active Station Tab: phonics | syllables | pacer | math | sprint | storygen
  const [activeStation, setActiveStation] = useState<'phonics' | 'syllables' | 'pacer' | 'math' | 'sprint' | 'storygen'>(
    initialStation || 'phonics'
  );

  useEffect(() => {
    if (initialStation) {
      setActiveStation(initialStation);
    }
  }, [initialStation]);

  const exerciseCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    exerciseCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeStation]);
  const [selectedVoice, setSelectedVoice] = useState<'ar-SA-ZariyahNeural' | 'ar-EG-SalmaNeural' | 'ar-SA-HamedNeural'>('ar-SA-ZariyahNeural');

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
  const [showTeacherSettings, setShowTeacherSettings] = useState<boolean>(false);

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
      effectiveWords: observedTargetWords.length > 0 ? observedTargetWords : ['سَمَكَةٌ', 'مَدْرَسَةٌ', 'كِتَابٌ'],
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

  // 100% Natural Arabic Neural Speech Player (Authentic human pronunciation with studio-grade phoneme makharij)
  const speakText = (text: string) => {
    playNaturalArabicAudio(text, { voice: selectedVoice, rate: '-5%' });
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
      setActivityStatusMessage('الأنشطة العامة متاحة ومخصصة بالذكاء الاصطناعي.');
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
            ? 'الأنشطة متاحة ومحدثة بالذكاء الاصطناعي.'
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
      speakText('أحسنت! تحديد دقيق لموقع العدد');
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
    <div className="space-y-5 max-w-4xl mx-auto pb-12 animate-fade-slide-up" dir="rtl">
      {/* 1. PLAYFUL HERO QUEST BANNER */}
      <div className="bg-gradient-to-r from-emerald-400 via-teal-500 to-sky-500 rounded-3xl p-5 sm:p-6 text-white shadow-xl border-3 border-emerald-300 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center sm:text-right">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white/20 backdrop-blur border-2 border-white/40 flex items-center justify-center shrink-0 animate-bounce-gentle shadow-inner">
            <IconBaseeraFalcon size={48} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full text-xs font-black text-emerald-100 mb-1.5">
              <IconLettersBlock size={15} />
              <span>صالة ألعاب وبطولات القراءة · البطل {activeStudent.name}</span>
            </div>
            <h1 className="font-child text-2xl sm:text-3xl font-black">
              صالة تدريب وبطولات الأبطال
            </h1>
            <p className="font-child text-xs sm:text-sm text-emerald-100 font-bold mt-0.5">
              اصطد الحروف وركّب المقاطع الصوتية لتجمع كؤوس ونقاط التميز!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white text-slate-900 rounded-2xl p-2.5 px-4 shadow-md text-center min-w-[95px] border-b-4 border-amber-500">
            <div className="text-xl font-black text-amber-600 font-mono flex items-center justify-center gap-1">
              <IconStar size={18} />
              <span>{xpPoints} XP</span>
            </div>
            <span className="font-child text-[11px] font-bold text-slate-500 block mt-0.5">نقاط البطل</span>
          </div>
        </div>
      </div>

      {/* 2. CHUNKY 3D CLAYMORPHIC STATION NAVIGATION BAR */}
      <div className="bg-white rounded-3xl p-3 shadow-md border-2 border-slate-200/90 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 overflow-x-auto py-1 w-full sm:w-auto">
          {[
            { id: 'phonics', label: 'صائد الحروف', icon: IconLettersBlock, activeClass: 'clay-btn-emerald' },
            { id: 'syllables', label: 'تركيب المقاطع', icon: IconPuzzlePieces, activeClass: 'clay-btn-purple' },
            { id: 'storygen', label: 'قصص الأبطال', icon: IconStoryBook, activeClass: 'clay-btn-amber' },
            { id: 'sprint', label: 'سبرنت ٥ دقائق', icon: IconLightningBolt, activeClass: 'duo-btn-orange' },
            { id: 'math', label: 'خط الأعداد', icon: IconNumberRuler, activeClass: 'clay-btn-sky' },
            { id: 'pacer', label: 'طلاقة القراءة', icon: IconStoryBook, activeClass: 'clay-btn-emerald' },
          ].map((st) => {
            const isActive = activeStation === st.id;
            const IconComp = st.icon;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setActiveStation(st.id as any);
                  setActiveScaffold(null);
                  exerciseCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                className={'px-4 py-2.5 rounded-2xl font-child font-black text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ' + (
                  isActive
                    ? st.activeClass + ' scale-103 shadow-md'
                    : 'duo-btn-white hover:border-sky-300'
                )}
              >
                <IconComp size={20} className="shrink-0" />
                <span>{st.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Celebration Toast */}

      {celebrationMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white font-child font-black text-sm flex items-center justify-between gap-3 shadow-lg animate-fade-slide-up">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-300 fill-current" />
            <span>{celebrationMessage}</span>
          </div>
          <span className="text-emerald-100 text-xs font-bold">كفو يا بطل!</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STATION 1: PHONICS (Illustrated Claymorphic Toy Game) */}
      {/* ------------------------------------------------------------- */}
      {activeStation === 'phonics' && (
        <div ref={exerciseCardRef} className="clay-card p-6 sm:p-9 space-y-6 max-w-2xl mx-auto text-center animate-fade-slide-up">
          {/* Header Step & Target Sound Badge */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="font-child text-xs font-black text-emerald-800 bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-300">
              تحدي: {currentPhonics.family}
            </span>
            <span className="font-mono text-xs font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              السؤال {toEasternArabicDigits(phonicsIdx + 1)} من {toEasternArabicDigits(phonicsList.length)}
            </span>
          </div>

          {/* Friendly Mascot Speech Card */}
          <div className="flex items-center gap-3.5 bg-emerald-50/90 border-2 border-emerald-300 p-3.5 sm:p-4 rounded-3xl text-right shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-white border-2 border-emerald-400 flex items-center justify-center shrink-0 shadow-sm animate-bounce-gentle">
              <IconBaseeraFalcon size={38} />
            </div>
            <div>
              <span className="text-xs font-black text-emerald-950 block">صقر بصيرة الذكي:</span>
              <p className="font-child text-xs sm:text-sm font-bold text-slate-700 mt-0.5">
                المس الزر الأخضر لسماع الكلمة، ثم ضع الحرف الناقص في صندوق الكلمة!
              </p>
            </div>
          </div>

          {/* Big 3D Audio Button */}
          <div>
            <button
              type="button"
              onClick={() => speakText(currentPhonics.spokenWord)}
              className="clay-btn-emerald py-4 px-8 text-lg sm:text-xl font-black inline-flex items-center justify-center gap-3 shadow-lg hover:scale-103 active:scale-95 cursor-pointer mx-auto w-full sm:w-auto"
            >
              <Volume2 className="w-6 h-6 animate-pulse" />
              <span>استمع لنطق الكلمة: « {currentPhonics.spokenWord} »</span>
            </button>
          </div>

          {/* Word Puzzle Board with Glowing Dashed Missing Slot */}
          <div className="clay-card-amber p-6 sm:p-8 space-y-3">
            <span className="text-xs font-black text-amber-800 block">ضع الحرف الناقص لإكمال الكلمة:</span>
            <div className="flex items-center justify-center gap-3 sm:gap-4 text-4xl sm:text-5xl md:text-6xl font-serif font-black" dir="rtl">
              <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-3xl border-4 border-dashed border-amber-500 bg-white flex items-center justify-center font-child font-black text-amber-700 shadow-inner animate-pulse">
                {selectedLetter || '؟'}
              </div>
              <span className="text-slate-900 tracking-wider">
                {currentPhonics.spokenWord.slice(1)}
              </span>
            </div>
          </div>

          {/* Chunky 3D Alphabet Blocks */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold text-slate-500 block">اختر الحرف المناسب:</span>
            <div className={'grid gap-4 ' + (currentPhonics.options.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
              {currentPhonics.options.map((opt) => {
                const isSelected = selectedLetter === opt.letter;
                const showSuccess = phonicsEvaluated && isSelected && opt.isCorrect;
                const showError = phonicsEvaluated && isSelected && !opt.isCorrect;

                return (
                  <button
                    key={opt.letter}
                    type="button"
                    onClick={() => handleSelectPhonicsLetter(opt)}
                    className={'py-6 sm:py-8 px-4 rounded-3xl transition-all flex flex-col items-center justify-center gap-2 cursor-pointer select-none border-b-8 active:border-b-2 active:translate-y-2 ' + (
                      showSuccess
                        ? 'clay-btn-emerald scale-105 ring-4 ring-emerald-300'
                        : showError
                        ? 'bg-rose-500 text-white border-rose-700'
                        : 'clay-card hover:border-sky-400 hover:scale-102'
                    )}
                  >
                    <span className="font-child text-6xl sm:text-7xl font-black">
                      {opt.letter}
                    </span>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                      حرف {opt.letterName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Next Button */}
          {phonicsEvaluated && (
            <div className="pt-3 animate-fade-slide-up">
              <button
                type="button"
                onClick={() => {
                  handleNextPhonics();
                  exerciseCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                className="clay-btn-sky w-full py-4 text-xl font-black flex items-center justify-center gap-2.5 cursor-pointer shadow-lg"
              >
                <span>انطلق للسؤال التالي</span>
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STATION 2: SYLLABLES (Ultra-Compact, 100% On Screen, Zero Scroll) */}
      {/* ------------------------------------------------------------- */}
      {activeStation === 'syllables' && (
        <div ref={exerciseCardRef} className="bg-white border-2 border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-xl space-y-4 max-w-xl mx-auto text-center animate-fade-slide-up">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 border-b border-slate-100 pb-2">
            <span className="font-child text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
              تركيب المقاطع
            </span>
            <span className="font-mono text-slate-700">
              الكلمة {syllableIdx + 1} من {syllableList.length}
            </span>
          </div>

          <div className="space-y-1">
            <p className="font-child text-sm font-bold text-slate-500">
              ركّب المقاطع لتكوين كلمة تعني:
            </p>
            <h2 className="font-child text-xl sm:text-2xl font-black text-slate-900">
              « {currentSyllable.wordMeaning} »
            </h2>
          </div>

          {/* Target Assembly Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-emerald-400 min-h-[70px] flex items-center justify-center gap-2 shadow-inner">
            {assembledSyllables.length === 0 ? (
              <span className="text-xs text-slate-400 font-bold">
                انقر على المقاطع بالأسفل لتركيب الكلمة...
              </span>
            ) : (
              <div className="flex items-center gap-2 text-2xl sm:text-3xl font-serif font-black text-emerald-800">
                {assembledSyllables.map((s, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-emerald-100 border-2 border-emerald-300 rounded-xl shadow-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Syllable Options */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            {currentSyllable.syllables.map((syl) => {
              const isUsed = assembledSyllables.includes(syl);
              return (
                <button
                  key={syl}
                  type="button"
                  disabled={isUsed}
                  onClick={() => handleAddSyllable(syl)}
                  className={'px-6 py-3 rounded-2xl text-2xl font-serif font-black border-b-6 transition-all cursor-pointer ' + (
                    isUsed
                      ? 'bg-slate-100 text-slate-300 border-slate-200 opacity-30 cursor-not-allowed'
                      : 'duo-btn-white hover:scale-105 active:scale-95'
                  )}
                >
                  {syl}
                </button>
              );
            })}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleResetSyllables}
              className="child-tactile-btn px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center gap-1.5 cursor-pointer border border-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة</span>
            </button>

            {syllableComplete && (
              <button
                type="button"
                onClick={() => speakText(currentSyllable.targetWord)}
                className="duo-btn-green py-2 px-4 text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>استمع «{currentSyllable.targetWord}»</span>
              </button>
            )}
          </div>

          {/* Next Button */}
          {syllableComplete && (
            <div className="pt-2 animate-fade-slide-up">
              <button
                type="button"
                onClick={() => {
                  handleNextSyllable();
                  exerciseCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                className="duo-btn-green w-full py-3.5 text-base font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>الكلمة التالية</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STATION 3: OPTIONAL PACED WORD HIGHLIGHTING

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
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>إيقاف مؤقت</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>تشغيل القراءة</span>
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

            {/* Interactive Illustrated Number Line */}
            <div className="clay-card-sky p-5 sm:p-7 space-y-4 max-w-xl mx-auto">
              <InteractiveNumberLine
                min={currentMath.min}
                max={currentMath.max}
                value={sliderVal}
                onChange={(val) => {
                  setSliderVal(val);
                  setMathAnswered(false);
                }}
                targetNumber={currentMath.targetNumber}
              />

              {mathAnswered && mathErrorAbs !== null && (
                <div className={'p-3 rounded-2xl border-2 font-child font-black text-sm animate-fade-slide-up ' + (
                  mathErrorAbs <= 5 ? 'bg-emerald-50 border-emerald-400 text-emerald-900' : 'bg-amber-50 border-amber-400 text-amber-900'
                )}>
                  <span>فارق القفزة عن الهدف: {toEasternArabicDigits(mathErrorAbs)} أرقام ({mathErrorAbs <= 5 ? 'دقة ممتازة وبطل خارق!' : 'قريب جداً، واصل المحاولة!'})</span>
                </div>
              )}
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
                  <span>اعتماد الموضع وفحص الدقة</span>
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

      {/* ------------------------------------------------------------- */}
      {/* STATION 5: 5-MINUTE DAILY SPRINT (VTO READING MODEL)          */}
      {/* ------------------------------------------------------------- */}
      {activeStation === 'sprint' && (
        <DailySprintStation
          activeStudent={activeStudent}
          speakText={speakText}
          triggerCelebration={triggerCelebration}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* STATION 6: ADAPTIVE DECODABLE STORYGEN (LUCA AI MODEL)       */}
      {/* ------------------------------------------------------------- */}
      {activeStation === 'storygen' && (
        <StoryGenStation
          activeStudent={activeStudent}
          speakText={speakText}
          triggerCelebration={triggerCelebration}
        />
      )}


    </div>
  );
};

export default RemediationGymView;
