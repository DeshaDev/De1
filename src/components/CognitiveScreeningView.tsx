import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Award,
  Volume2,
  ArrowLeft,
  ChevronLeft,
  Brain,
  Timer,
  BookOpen,
  Palette,
  Hash,
  HelpCircle,
  Trophy,
  Star,
  Check,
  X,
  Zap,
} from 'lucide-react';
import { StudentRecord, CognitiveScreeningData } from '../data/seedData';
import { useAssessment } from '../contexts/AssessmentContext';

interface Props {
  student: StudentRecord;
  onNavigateTab?: (tab: string) => void;
  onCompleteScreening?: (data: CognitiveScreeningData) => void;
}

// ---------------------------------------------------------------------------
// 1. RAN (Rapid Automatized Naming) Stimuli Sets
// ---------------------------------------------------------------------------
interface RanItem {
  id: string;
  labelAr: string;
  visualValue: string; // color hex, digit, or emoji
  type: 'color' | 'digit' | 'object';
}

const RAN_COLORS: RanItem[] = [
  { id: 'c-red', labelAr: 'أَحْمَر', visualValue: '#ef4444', type: 'color' },
  { id: 'c-blue', labelAr: 'أَزْرَق', visualValue: '#3b82f6', type: 'color' },
  { id: 'c-green', labelAr: 'أَخْضَر', visualValue: '#10b981', type: 'color' },
  { id: 'c-yellow', labelAr: 'أَصْفَر', visualValue: '#eab308', type: 'color' },
  { id: 'c-black', labelAr: 'أَسْوَد', visualValue: '#1e293b', type: 'color' },
];

const RAN_DIGITS: RanItem[] = [
  { id: 'd-2', labelAr: 'اثْنَان', visualValue: '٢', type: 'digit' },
  { id: 'd-4', labelAr: 'أَرْبَعَة', visualValue: '٤', type: 'digit' },
  { id: 'd-6', labelAr: 'سِتَّة', visualValue: '٦', type: 'digit' },
  { id: 'd-7', labelAr: 'سَبْعَة', visualValue: '٧', type: 'digit' },
  { id: 'd-9', labelAr: 'تِسْعَة', visualValue: '٩', type: 'digit' },
];

const RAN_OBJECTS: RanItem[] = [
  { id: 'o-tree', labelAr: 'شَجَرَة', visualValue: '🌲', type: 'object' },
  { id: 'o-hand', labelAr: 'يَد', visualValue: '✋', type: 'object' },
  { id: 'o-door', labelAr: 'بَاب', visualValue: '🚪', type: 'object' },
  { id: 'o-star', labelAr: 'نَجْمَة', visualValue: '⭐', type: 'object' },
  { id: 'o-book', labelAr: 'كِتَاب', visualValue: '📖', type: 'object' },
];

// Generate standard 20-item pseudo-random matrix (4 rows x 5 cols)
function generateRanMatrix(items: RanItem[], count = 20): RanItem[] {
  const result: RanItem[] = [];
  let lastId = '';
  for (let i = 0; i < count; i++) {
    const candidates = items.filter(it => it.id !== lastId);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    result.push(chosen);
    lastId = chosen.id;
  }
  return result;
}

// ---------------------------------------------------------------------------
// 2. Pseudo-word (Non-word) Arabic Decoding Stimuli
// Morphologically authentic Arabic patterns with non-dictionary roots
// ---------------------------------------------------------------------------
interface PseudoWordItem {
  id: string;
  word: string;
  patternAr: string; // وزن الكلمة (فَعْلَلَ / مِفْعَال)
  syllablesAr: string;
  hintAr: string;
}

const ARABIC_PSEUDO_WORDS: PseudoWordItem[] = [
  { id: 'pw-1', word: 'سَلْطَمَ', patternAr: 'فَعْلَلَ', syllablesAr: 'سَلْ · طَ · مَ', hintAr: 'وزن رباعي مجرد غير موجود بالمعاجم' },
  { id: 'pw-2', word: 'مِفْرَاخ', patternAr: 'مِفْعَال', syllablesAr: 'مِفْ · رَاخ', hintAr: 'وزن اسم آلة من جذر غير مستعمل' },
  { id: 'pw-3', word: 'كَرْنَفَ', patternAr: 'فَعْلَلَ', syllablesAr: 'كَرْ · نَ · فَ', hintAr: 'اختبار تجاور الكاف والراء مع النون' },
  { id: 'pw-4', word: 'بَيْدَقَة', patternAr: 'فَيْعَلَة', syllablesAr: 'بَيْ · دَ · قَة', hintAr: 'اختبار الياء اللينة والدال والقاف' },
  { id: 'pw-5', word: 'شَنْطَبَ', patternAr: 'فَعْلَلَ', syllablesAr: 'شَنْ · طَ · بَ', hintAr: 'اختبار إطباق الطاء بعد نون ساكنة' },
  { id: 'pw-6', word: 'طَرْمَزَ', patternAr: 'فَعْلَلَ', syllablesAr: 'طَرْ · مَ · زَ', hintAr: 'اختبار الطاء المفخمة مع الزاي المرققة' },
  { id: 'pw-7', word: 'قُرْطُم', patternAr: 'فُعْلُل', syllablesAr: 'قُرْ · طُم', hintAr: 'اختبار الحركات القصيرة بالضم والسكون' },
  { id: 'pw-8', word: 'سَفْرَقَ', patternAr: 'فَعْلَلَ', syllablesAr: 'سَفْ · رَ · قَ', hintAr: 'اختبار الهمس بالسين والفاء مع جهر القاف' },
];

// ---------------------------------------------------------------------------
// 3. Phonological & Phonemic Awareness Games
// ---------------------------------------------------------------------------
interface PhonemicTask {
  id: string;
  titleAr: string;
  promptAr: string;
  audioSpeechPrompt: string;
  targetWordAr: string;
  optionsAr: string[];
  correctIndex: number;
  explanationAr: string;
}

const PHONEMIC_TASKS: PhonemicTask[] = [
  {
    id: 'ph-elision-1',
    titleAr: 'حذف الصوت الأول (Phoneme Elision)',
    promptAr: 'اسمع الكلمة: "مَسْرُور"... إذا حَذَفْنَا صَوْتَ /مَـ/ مِنْ بِدَايَتِهَا، مَا هِيَ الكَلِمَةُ الْمُتَبَقِّيَةُ؟',
    audioSpeechPrompt: 'مَسْرُور. احذف صوت مَـ. ما الكلمة المتبقية؟',
    targetWordAr: 'مَسْرُور',
    optionsAr: ['سْرُور', 'نُور', 'سُرُور'],
    correctIndex: 0,
    explanationAr: 'حذف صوت الميم يترك التركيب الصوتي المتبقي: سْرُور',
  },
  {
    id: 'ph-blending-1',
    titleAr: 'دَمْجُ الأَصْوَاتِ (Phoneme Blending)',
    promptAr: 'اسْتَمِعْ إِلَى الأَصْوَاتِ الْمُنْفَصِلَةِ: /شَـ/ + /مْـ/ + /سٌ/... مَا الكَلِمَةُ الَّتِي تَتَكَوَّنُ عِنْدَ دَمْجِهَا؟',
    audioSpeechPrompt: 'شَـ ... مْـ ... سٌ. ما الكلمة؟',
    targetWordAr: 'شَمْس',
    optionsAr: ['شَمْس', 'قَمَر', 'نَفْس'],
    correctIndex: 0,
    explanationAr: 'دمج المقاطع الثلاثة يُنتج الكلمة: شَمْس',
  },
  {
    id: 'ph-rhyme-1',
    titleAr: 'اكْتِشَافُ السَّجْعِ وَالْقَافِيَةِ (Rhyme Detection)',
    promptAr: 'أَيُّ كَلِمَةٍ لَهَا نَفْسُ نَغْمَةِ وَسَجْعِ كَلِمَةِ "قَلَم"؟',
    audioSpeechPrompt: 'أي كلمة تشبه كلمة قَلَم في النغمة؟',
    targetWordAr: 'قَلَم',
    optionsAr: ['عَلَم', 'شَجَرَة', 'كِتَاب'],
    correctIndex: 0,
    explanationAr: 'كَلِمَة "عَلَم" تَتَّفِقُ مَع "قَلَم" فِي المَقْطَعِ الأَخِيرِ وَالوَزْنِ (فَعَل)',
  },
  {
    id: 'ph-isolation-1',
    titleAr: 'عَزْلُ الصَّوْتِ الأَوَّلِ (Initial Sound Isolation)',
    promptAr: 'مَا هُوَ الصَّوْتُ الأَوَّلُ الَّذِي تَبْدَأُ بِهِ كَلِمَةُ "زُهُور"؟',
    audioSpeechPrompt: 'ما الصوت الأول في كلمة زُهُور؟',
    targetWordAr: 'زُهُور',
    optionsAr: ['/زُ/', '/هـُ/', '/ر/'],
    correctIndex: 0,
    explanationAr: 'الصوت الأول المستهل في "زُهُور" هو الزاي المضمومة: /زُ/',
  },
];

// Helper to play synthesized Web Audio tone
function playChime(freq = 520, type: OscillatorType = 'sine', duration = 0.15) {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

export const CognitiveScreeningView: React.FC<Props> = ({
  student,
  onNavigateTab,
  onCompleteScreening,
}) => {
  const { currentAssessment } = useAssessment();

  // -------------------------------------------------------------------------
  // Main Battery Stages: 'intro' | 'ran' | 'pseudo' | 'phonemic' | 'summary'
  // -------------------------------------------------------------------------
  const [activeStage, setActiveStage] = useState<'intro' | 'ran' | 'pseudo' | 'phonemic' | 'summary'>('intro');

  // --- 1. RAN State ---
  const [ranCategory, setRanCategory] = useState<'colors' | 'digits' | 'objects'>('colors');
  const [ranMatrix, setRanMatrix] = useState<RanItem[]>(() => generateRanMatrix(RAN_COLORS, 20));
  const [ranCurrentIndex, setRanCurrentIndex] = useState(0);
  const [ranIsRunning, setRanIsRunning] = useState(false);
  const [ranStartTime, setRanStartTime] = useState<number | null>(null);
  const [ranElapsedMs, setRanElapsedMs] = useState(0);
  const [ranHesitations, setRanHesitations] = useState(0);
  const [ranFinalDurationSec, setRanFinalDurationSec] = useState<number | null>(null);
  const ranTimerRef = useRef<any>(null);

  // --- 2. Pseudo-word State ---
  const [pseudoRatings, setPseudoRatings] = useState<Record<string, 'correct' | 'hesitant' | 'misread'>>({});
  const [pseudoCurrentIndex, setPseudoCurrentIndex] = useState(0);

  // --- 3. Phonemic Tasks State ---
  const [phonemicAnswers, setPhonemicAnswers] = useState<Record<string, number>>({});
  const [phonemicCurrentIdx, setPhonemicCurrentIdx] = useState(0);

  // Initialize RAN matrix on category change
  useEffect(() => {
    const pool =
      ranCategory === 'colors' ? RAN_COLORS :
      ranCategory === 'digits' ? RAN_DIGITS : RAN_OBJECTS;
    setRanMatrix(generateRanMatrix(pool, 20));
    setRanCurrentIndex(0);
    setRanIsRunning(false);
    setRanElapsedMs(0);
    setRanFinalDurationSec(null);
  }, [ranCategory]);

  // RAN Stopwatch Loop
  useEffect(() => {
    if (ranIsRunning) {
      ranTimerRef.current = setInterval(() => {
        if (ranStartTime) {
          setRanElapsedMs(Date.now() - ranStartTime);
        }
      }, 50);
    } else {
      if (ranTimerRef.current) clearInterval(ranTimerRef.current);
    }
    return () => {
      if (ranTimerRef.current) clearInterval(ranTimerRef.current);
    };
  }, [ranIsRunning, ranStartTime]);

  // Start RAN test
  const handleStartRan = () => {
    setRanCurrentIndex(0);
    setRanElapsedMs(0);
    setRanHesitations(0);
    setRanFinalDurationSec(null);
    const now = Date.now();
    setRanStartTime(now);
    setRanIsRunning(true);
    playChime(660, 'sine', 0.2);
  };

  // Next item in RAN
  const handleRanNext = (hesitated = false) => {
    if (!ranIsRunning) return;
    if (hesitated) setRanHesitations(prev => prev + 1);

    if (ranCurrentIndex + 1 < ranMatrix.length) {
      setRanCurrentIndex(prev => prev + 1);
      playChime(540, 'triangle', 0.08);
    } else {
      // Completed RAN matrix
      const totalSec = Math.max(1, Math.round((Date.now() - (ranStartTime || Date.now())) / 1000));
      setRanIsRunning(false);
      setRanFinalDurationSec(totalSec);
      playChime(880, 'sine', 0.3);
    }
  };

  // Compute RAN Speed & Benchmarks
  const ranMetrics = useMemo(() => {
    const durSec = ranFinalDurationSec || Math.max(1, Math.round(ranElapsedMs / 1000));
    const itemsCount = ranMatrix.length;
    const speedItemsPerSec = +(itemsCount / Math.max(1, durSec)).toFixed(2);

    // Benchmarking based on international RAN norm curves (Wolf & Denckla)
    // Grade 3 normal range is ~18 - 25s for 20 items. >35s indicates high phonological retrieval risk.
    let status: 'fast' | 'average' | 'slow_at_risk' = 'average';
    let statusLabelAr = 'سرعة استرجاع متوسطة مطابقة للفئة العمرية';
    if (durSec <= 22) {
      status = 'fast';
      statusLabelAr = 'سرعة استرجاع ممتازة (طلاقة معجمية متقدمة)';
    } else if (durSec >= 35) {
      status = 'slow_at_risk';
      statusLabelAr = 'بطء ملحوظ في سرعة الاسترجاع (مؤشر خطر للديسليكسيا المزدوجة)';
    }

    return {
      durSec,
      speedItemsPerSec,
      status,
      statusLabelAr,
    };
  }, [ranFinalDurationSec, ranElapsedMs, ranMatrix.length]);

  // Rate pseudo word
  const handleRatePseudo = (wordId: string, rating: 'correct' | 'hesitant' | 'misread') => {
    setPseudoRatings(prev => ({ ...prev, [wordId]: rating }));
    if (rating === 'correct') playChime(660, 'sine', 0.1);
    else playChime(320, 'sawtooth', 0.15);

    if (pseudoCurrentIndex + 1 < ARABIC_PSEUDO_WORDS.length) {
      setPseudoCurrentIndex(prev => prev + 1);
    }
  };

  // Compute Pseudo-word Score
  const pseudoMetrics = useMemo(() => {
    const total = ARABIC_PSEUDO_WORDS.length;
    let correct = 0;
    Object.values(pseudoRatings).forEach(r => {
      if (r === 'correct') correct += 1;
      else if (r === 'hesitant') correct += 0.5;
    });
    const percent = Math.round((correct / total) * 100);
    return { correctCount: Math.round(correct), totalCount: total, percent };
  }, [pseudoRatings]);

  // Phonemic choice answer
  const handleAnswerPhonemic = (taskId: string, choiceIdx: number) => {
    setPhonemicAnswers(prev => ({ ...prev, [taskId]: choiceIdx }));
    const task = PHONEMIC_TASKS.find(t => t.id === taskId);
    if (task && choiceIdx === task.correctIndex) {
      playChime(700, 'sine', 0.15);
    } else {
      playChime(280, 'sawtooth', 0.15);
    }

    if (phonemicCurrentIdx + 1 < PHONEMIC_TASKS.length) {
      setPhonemicCurrentIdx(prev => prev + 1);
    }
  };

  // Compute Phonemic Awareness Score
  const phonemicMetrics = useMemo(() => {
    const total = PHONEMIC_TASKS.length;
    let correct = 0;
    PHONEMIC_TASKS.forEach(t => {
      if (phonemicAnswers[t.id] === t.correctIndex) correct += 1;
    });
    const percent = Math.round((correct / total) * 100);
    return { correctCount: correct, totalCount: total, percent };
  }, [phonemicAnswers]);

  // Speak Arabic prompt via Web Speech Synthesis
  const handleSpeakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ar-SA';
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  };

  // Finalize complete screening results
  const handleFinalizeAll = () => {
    const finalData: CognitiveScreeningData = {
      ranSpeedItemsPerSec: ranMetrics.speedItemsPerSec,
      ranDurationSeconds: ranMetrics.durSec,
      ranHesitationCount: ranHesitations,
      ranCategory,
      ranStatus: ranMetrics.status,
      ranStatusLabelAr: ranMetrics.statusLabelAr,
      pseudoWordScorePercent: pseudoMetrics.percent,
      pseudoWordWordsRead: pseudoMetrics.correctCount,
      pseudoWordTotalCount: pseudoMetrics.totalCount,
      phonemicAwarenessScorePercent: phonemicMetrics.percent,
      completedAt: new Date().toLocaleDateString('ar-QA'),
    };

    if (onCompleteScreening) {
      onCompleteScreening(finalData);
    }
    setActiveStage('summary');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-teal-50/20 to-slate-100 py-8 px-4 font-sans text-right" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* ===================================================================
            HEADER & PILL NAVIGATION
            =================================================================== */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900">
                  مختبر الفرز المعرفي المتقدم (Cognitive Screening Battery)
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  فحص التسمية الآلية السريعة (RAN)، فك الترميز النقي، والوعي الفونولوجي
                </p>
              </div>
            </div>

            {/* Stage Stepper Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
              <button
                onClick={() => setActiveStage('ran')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeStage === 'ran' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. التسمية السريعة (RAN)
              </button>
              <button
                onClick={() => setActiveStage('pseudo')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeStage === 'pseudo' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. فك الترميز (Pseudo)
              </button>
              <button
                onClick={() => setActiveStage('phonemic')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeStage === 'phonemic' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3. الوعي الصوتي
              </button>
            </div>
          </div>

          {/* Student Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">الطالب:</span>
              <span className="bg-teal-100/70 text-teal-900 px-2.5 py-0.5 rounded-lg font-bold">
                {student.name}
              </span>
              <span>· الصف {student.gradeLevel} ({student.ageYears} سنوات)</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-800 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>فحص معرفي مباشر بدون كاميرا أو إشعاع</span>
            </div>
          </div>
        </div>

        {/* ===================================================================
            STAGE 1: INTRO TO BATTERY
            =================================================================== */}
        {activeStage === 'intro' && (
          <div className="bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/80 text-center">
            <div className="w-20 h-20 rounded-3xl bg-teal-50 text-teal-600 border border-teal-200 mx-auto flex items-center justify-center mb-5">
              <Zap className="w-10 h-10 animate-bounce" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">
              البطارية المعرفية ثلاثية الأبعاد لفرز عسر القراءة
            </h2>
            <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed mb-8">
              لا يقتصر عسر القراءة على قراءة النصوص؛ بل يرتبط باسترجاع الأصوات والذاكرة اللفظية السريعة. صُممت هذه البطارية وفق المعايير العالمية المعتمدة لفرز الأطفال خلال 3 دقائق.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-right">
              <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold mb-3">
                  <Timer className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">1. التسمية السريعة (RAN)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  تسمية 20 عنصراً مألوفاً بأقصى سرعة ممكنة لقياس سرعة المعالجة العصبية.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-teal-50/70 border border-teal-200">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold mb-3">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">2. قراءة الكلمات غير الحقيقية</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  فك ترميز كلمات عربية موزونة غير مألوفة، لمنع التخمين بالذاكرة البصرية.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold mb-3">
                  <Volume2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">3. الوعي الصوتي والفونولوجي</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  تحديات تفاعلية في حذف الأصوات، دمج المقاطع، والسجع الصوتي.
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveStage('ran')}
              className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-lg py-4 px-10 rounded-2xl shadow-xl transition-all cursor-pointer flex items-center gap-3 mx-auto"
            >
              <span>ابدأ الاختبار الأول: التسمية الآلية السريعة (RAN)</span>
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ===================================================================
            STAGE 2: RAN (RAPID AUTOMATIZED NAMING) LAB
            =================================================================== */}
        {activeStage === 'ran' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80">
            {/* RAN Controls & Category Selector */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
              <div>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                  المحور 1: التسمية الآلية السريعة (RAN)
                </span>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-2">
                  قِسْ سرعة تسمية العناصر بأسرع وقت
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  اطلب من الطالب تسمية العناصر من اليمين إلى اليسار سطراً بسطر بأقصى سرعة ممكنة.
                </p>
              </div>

              {/* Mode Selection */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRanCategory('colors')}
                  disabled={ranIsRunning}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    ranCategory === 'colors' ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Palette className="w-4 h-4" />
                  <span>الألوان</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRanCategory('digits')}
                  disabled={ranIsRunning}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    ranCategory === 'digits' ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Hash className="w-4 h-4" />
                  <span>الأرقام</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRanCategory('objects')}
                  disabled={ranIsRunning}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    ranCategory === 'objects' ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Star className="w-4 h-4" />
                  <span>الأشياء</span>
                </button>
              </div>
            </div>

            {/* Timer & Live Score Strip */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 text-white p-4 rounded-2xl mb-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Clock className={`w-5 h-5 ${ranIsRunning ? 'text-amber-400 animate-spin' : 'text-slate-400'}`} />
                <span className="font-mono text-2xl font-black">
                  {(ranElapsedMs / 1000).toFixed(1)} ث
                </span>
                <span className="text-xs text-slate-300">
                  ({ranCurrentIndex} من {ranMatrix.length} عنصر)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!ranIsRunning && ranFinalDurationSec === null && (
                  <button
                    onClick={handleStartRan}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>ابدأ مؤقت التسمية السريعة</span>
                  </button>
                )}

                {ranIsRunning && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRanNext(false)}
                      className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <span>التالي (مسافة / نقر)</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRanNext(true)}
                      className="bg-amber-500/80 hover:bg-amber-500 text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer"
                      title="تسجيل تردد أو تعثر في التسمية"
                    >
                      <span>+ تردد / سكتة</span>
                    </button>
                  </div>
                )}

                {ranFinalDurationSec !== null && (
                  <button
                    onClick={handleStartRan}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إعادة الاختبار</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4x5 Visual Grid Matrix */}
            <div className="grid grid-cols-5 gap-3 md:gap-4 p-4 md:p-6 bg-slate-50 rounded-3xl border border-slate-200 mb-6">
              {ranMatrix.map((item, idx) => {
                const isCurrent = ranIsRunning && idx === ranCurrentIndex;
                const isPassed = idx < ranCurrentIndex;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (ranIsRunning && idx === ranCurrentIndex) handleRanNext(false);
                    }}
                    className={`aspect-square rounded-2xl p-2 flex flex-col items-center justify-center border-2 transition-all cursor-pointer select-none relative ${
                      isCurrent
                        ? 'border-teal-500 bg-teal-50 shadow-lg scale-105 ring-4 ring-teal-200'
                        : isPassed
                        ? 'border-slate-200 bg-white/70 opacity-40'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {item.type === 'color' && (
                      <div
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full shadow-inner border border-black/10"
                        style={{ backgroundColor: item.visualValue }}
                      />
                    )}

                    {item.type === 'digit' && (
                      <span className="font-mono text-3xl md:text-4xl font-black text-slate-800">
                        {item.visualValue}
                      </span>
                    )}

                    {item.type === 'object' && (
                      <span className="text-3xl md:text-4xl">
                        {item.visualValue}
                      </span>
                    )}

                    <span className="text-[10px] md:text-xs font-bold text-slate-600 mt-1">
                      {item.labelAr}
                    </span>

                    {isCurrent && (
                      <span className="absolute -top-2 -right-2 bg-teal-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-xs">
                        الحالي
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Post-Test Evaluation Box */}
            {ranFinalDurationSec !== null && (
              <div className="p-5 rounded-2xl bg-teal-50 border border-teal-200 flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <span className="text-xs font-bold text-teal-800 block mb-1">
                    نتيجة اختبار التسمية السريعة (RAN Metrics):
                  </span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-bold text-slate-900">
                      الزمن الكلي: <strong className="font-mono text-teal-700 text-base">{ranMetrics.durSec} ث</strong>
                    </span>
                    <span className="font-bold text-slate-900">
                      المعدل: <strong className="font-mono text-teal-700 text-base">{ranMetrics.speedItemsPerSec}</strong> عنصر/ثانية
                    </span>
                    <span className="font-bold text-slate-900">
                      الترددات: <strong className="font-mono text-amber-700 text-base">{ranHesitations}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-teal-950 font-bold mt-2">
                    {ranMetrics.statusLabelAr}
                  </p>
                </div>

                <button
                  onClick={() => setActiveStage('pseudo')}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm py-3 px-6 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>الانتقال للاختبار الثاني: فك الترميز النقي</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            STAGE 3: PSEUDO-WORD DECODING (الكلمات غير الحقيقية)
            =================================================================== */}
        {activeStage === 'pseudo' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80">
            <div className="border-b border-slate-100 pb-5 mb-6 text-right">
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                المحور 2: فك الترميز الصوتي النقي (Pseudo-word Decoding)
              </span>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-2">
                قراءة كلمات عربية غير مألوفة وفق الأوزان الصرفية
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                هذه الكلمات تتبع قواعد الصرف العربي لكنها خالية من المعنى؛ يقيس هذا الاختبار قدرة الطفل على التهجئة وفك شفرة الأصوات دون الاعتماد على الحفظ البصري للكلمة.
              </p>
            </div>

            {/* Current Active Word Flashcard */}
            {pseudoCurrentIndex < ARABIC_PSEUDO_WORDS.length ? (
              <div className="max-w-md mx-auto text-center mb-8">
                <div className="p-8 md:p-12 rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800 mb-5 relative overflow-hidden">
                  <span className="text-xs font-bold text-teal-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 mb-4 inline-block">
                    الكلمة {pseudoCurrentIndex + 1} من {ARABIC_PSEUDO_WORDS.length} (الوزن: {ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].patternAr})
                  </span>

                  <div className="text-5xl md:text-6xl font-black font-serif tracking-wider my-6 text-teal-100">
                    {ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].word}
                  </div>

                  <div className="text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
                    <span>المقاطع:</span>
                    <span className="text-teal-300 font-bold">{ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].syllablesAr}</span>
                  </div>
                </div>

                {/* Evaluator 3-Button Rater */}
                <span className="text-xs font-bold text-slate-700 block mb-3">
                  قيّم قراءة الطالب للكلمة:
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleRatePseudo(ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].id, 'correct')}
                    className="p-3.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                  >
                    <Check className="w-5 h-5 text-emerald-600" />
                    <span>قراءة صحيحة بطلاقة</span>
                  </button>

                  <button
                    onClick={() => handleRatePseudo(ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].id, 'hesitant')}
                    className="p-3.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                  >
                    <Clock className="w-5 h-5 text-amber-600" />
                    <span>تهجئة بطيئة / تردد</span>
                  </button>

                  <button
                    onClick={() => handleRatePseudo(ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].id, 'misread')}
                    className="p-3.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                  >
                    <X className="w-5 h-5 text-rose-600" />
                    <span>إبدال صوتي / تعذر</span>
                  </button>
                </div>
              </div>
            ) : (
              /* All pseudo-words evaluated */
              <div className="p-6 rounded-2xl bg-teal-50 border border-teal-200 text-center max-w-lg mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto mb-3" />
                <h3 className="text-lg font-black text-slate-900 mb-1">
                  اكتمل فحص الكلمات غير الحقيقية
                </h3>
                <div className="text-3xl font-black text-teal-700 font-mono my-2">
                  {pseudoMetrics.percent}%
                </div>
                <p className="text-xs text-slate-600 mb-4">
                  تم فك ترميز {pseudoMetrics.correctCount} من إجمالي {pseudoMetrics.totalCount} كلمات بشكل سليم.
                </p>

                <button
                  onClick={() => setActiveStage('phonemic')}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm py-3 px-8 rounded-xl flex items-center gap-2 mx-auto shadow-sm transition-all cursor-pointer"
                >
                  <span>الانتقال للمحور 3: الوعي الصوتي والفونولوجي</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            STAGE 4: PHONEMIC AWARENESS GAMES (الوعي الفونولوجي)
            =================================================================== */}
        {activeStage === 'phonemic' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80">
            <div className="border-b border-slate-100 pb-5 mb-6 text-right">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                المحور 3: ألعاب الوعي الصوتي (Phonemic & Phonological Games)
              </span>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-2">
                تمييز الأصوات، الحذف، والدمج الفونولوجي
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                استمع للمقطع الصوتي أو اقرأ التحدي للطالب، واجعله يختار الإجابة الصحيحة.
              </p>
            </div>

            {phonemicCurrentIdx < PHONEMIC_TASKS.length ? (
              <div className="max-w-xl mx-auto">
                {/* Active Challenge Card */}
                <div className="p-6 md:p-8 rounded-3xl bg-indigo-50/60 border border-indigo-200 mb-6 text-right">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-indigo-900 bg-indigo-100 px-3 py-1 rounded-full">
                      تحدي {phonemicCurrentIdx + 1} من {PHONEMIC_TASKS.length}: {PHONEMIC_TASKS[phonemicCurrentIdx].titleAr}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSpeakText(PHONEMIC_TASKS[phonemicCurrentIdx].audioSpeechPrompt)}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-xs cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>تشغيل الصوت</span>
                    </button>
                  </div>

                  <p className="text-base md:text-lg font-bold text-slate-900 leading-relaxed mb-6">
                    {PHONEMIC_TASKS[phonemicCurrentIdx].promptAr}
                  </p>

                  {/* Choice Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PHONEMIC_TASKS[phonemicCurrentIdx].optionsAr.map((option, oIdx) => (
                      <button
                        key={oIdx}
                        onClick={() => handleAnswerPhonemic(PHONEMIC_TASKS[phonemicCurrentIdx].id, oIdx)}
                        className="p-4 rounded-2xl bg-white hover:bg-indigo-100/70 border-2 border-indigo-200 hover:border-indigo-400 text-slate-900 font-extrabold text-lg text-center transition-all cursor-pointer shadow-xs"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* All phonemic tasks answered */
              <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-200 text-center max-w-lg mx-auto mb-6">
                <Trophy className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
                <h3 className="text-lg font-black text-slate-900 mb-1">
                  اكتملت ألعاب الوعي الفونولوجي
                </h3>
                <div className="text-3xl font-black text-indigo-700 font-mono my-2">
                  {phonemicMetrics.percent}%
                </div>
                <p className="text-xs text-slate-600 mb-4">
                  أجاب الطالب بشكل صحيح على {phonemicMetrics.correctCount} من إجمالي {phonemicMetrics.totalCount} تحديات صوتية.
                </p>

                <button
                  onClick={handleFinalizeAll}
                  className="bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-extrabold text-sm py-3.5 px-8 rounded-xl flex items-center gap-2 mx-auto shadow-md transition-all cursor-pointer"
                >
                  <Award className="w-5 h-5 text-amber-300" />
                  <span>اعتماد نتائج البطارية وعرض الملف المعرفي الشامل</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            STAGE 5: SUMMARY & COGNITIVE PROFILE RADAR
            =================================================================== */}
        {activeStage === 'summary' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80">
            <div className="border-b border-slate-100 pb-5 mb-6 text-right flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                  ملخص الفرز المعرفي المكتمل
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
                  الملف المعرفي للطالب: {student.name}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  تكامل نتائج التسمية السريعة (RAN)، فك الترميز النقي، والوعي الصوتي.
                </p>
              </div>

              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('dashboard')}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs py-3 px-5 rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <span>عرض التقرير الشامل وخطة الدعم (IEP)</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 3 Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 text-right">
                <span className="text-xs font-bold text-amber-900 block mb-1">
                  1. التسمية الآلية السريعة (RAN)
                </span>
                <div className="text-2xl font-black text-amber-800 font-mono">
                  {ranMetrics.durSec} ث <span className="text-xs font-normal">({ranMetrics.speedItemsPerSec} عنصر/ث)</span>
                </div>
                <p className="text-[11px] text-amber-900 font-semibold mt-1">
                  {ranMetrics.statusLabelAr}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-teal-50/80 border border-teal-200 text-right">
                <span className="text-xs font-bold text-teal-900 block mb-1">
                  2. فك الترميز النقي (Pseudo-words)
                </span>
                <div className="text-2xl font-black text-teal-800 font-mono">
                  {pseudoMetrics.percent}%
                </div>
                <p className="text-[11px] text-teal-900 font-semibold mt-1">
                  فك شفرة {pseudoMetrics.correctCount} من {pseudoMetrics.totalCount} كلمات موزونة
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-right">
                <span className="text-xs font-bold text-indigo-900 block mb-1">
                  3. الوعي الصوتي والفونولوجي
                </span>
                <div className="text-2xl font-black text-indigo-800 font-mono">
                  {phonemicMetrics.percent}%
                </div>
                <p className="text-[11px] text-indigo-900 font-semibold mt-1">
                  إتقان {phonemicMetrics.correctCount} من {phonemicMetrics.totalCount} تحديات صوتية
                </p>
              </div>
            </div>

            {/* Next Steps CTA */}
            <div className="p-6 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-base text-teal-300 mb-1">
                  تم حفظ نتائج البطارية في سجل الطالب بنجاح!
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  يمكنك الآن الانتقال إلى لوحة المعلم لعرض المخطط الراداري المعياري وتوليد خطة التدخل الفردية (IEP).
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setActiveStage('ran');
                    setRanFinalDurationSec(null);
                  }}
                  className="flex-1 sm:flex-none py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                >
                  إعادة الاختبار
                </button>
                {onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('dashboard')}
                    className="flex-1 sm:flex-none py-3 px-6 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>لوحة المعلّم والتقارير</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CognitiveScreeningView;
