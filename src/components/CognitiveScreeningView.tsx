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
  ShieldCheck,
  Info,
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
// Strictly non-lexical Arabic roots adhering to authentic morphological templates
// ---------------------------------------------------------------------------
export interface PseudoWordItem {
  id: string;
  word: string;
  patternAr: string; // وزن الكلمة (فَعَلَ / فَعِيل / مَفْعُول / مُفْتَعِل)
  syllablesAr: string;
  linguisticLevel: 'بسيط (حركات قصيرة)' | 'متوسط (مدود)' | 'مركب (سكون ومشتقات)';
  nonLexicalRootAr: string;
}

export const VERIFIED_ARABIC_PSEUDO_WORDS: PseudoWordItem[] = [
  // المستوى الأول: ثلاثي مجرد بحركات قصيرة (فَعَلَ) - جذور مهملة في المعاجم العربية
  { id: 'pw-1', word: 'ظَفَكَ', patternAr: 'فَعَلَ', syllablesAr: 'ظَ · فَ · كَ', linguisticLevel: 'بسيط (حركات قصيرة)', nonLexicalRootAr: 'جذر (ظ-ف-ك) مهمل معجمياً' },
  { id: 'pw-2', word: 'فَثَلَ', patternAr: 'فَعَلَ', syllablesAr: 'فَ · ثَ · لَ', linguisticLevel: 'بسيط (حركات قصيرة)', nonLexicalRootAr: 'جذر (ف-ث-ل) مهمل معجمياً' },
  { id: 'pw-3', word: 'دَخَزَ', patternAr: 'فَعَلَ', syllablesAr: 'دَ · خَ · زَ', linguisticLevel: 'بسيط (حركات قصيرة)', nonLexicalRootAr: 'جذر (د-خ-ز) مهمل معجمياً' },
  { id: 'pw-4', word: 'رَثَقَ', patternAr: 'فَعَلَ', syllablesAr: 'رَ · ثَ · قَ', linguisticLevel: 'بسيط (حركات قصيرة)', nonLexicalRootAr: 'جذر (ر-ث-ق) غير مستعمل كفعل' },

  // المستوى الثاني: أوزان بمدود طويلة (فَعِيل / فَعُول)
  { id: 'pw-5', word: 'ظَفِيك', patternAr: 'فَعِيل', syllablesAr: 'ظَ · فِيك', linguisticLevel: 'متوسط (مدود)', nonLexicalRootAr: 'صيغة صفة من جذر مهمل (ظ-ف-ك)' },
  { id: 'pw-6', word: 'فَثِيل', patternAr: 'فَعِيل', syllablesAr: 'فَ · ثِيل', linguisticLevel: 'متوسط (مدود)', nonLexicalRootAr: 'مد بالياء من جذر مهمل (ف-ث-ل)' },
  { id: 'pw-7', word: 'زَخِيب', patternAr: 'فَعِيل', syllablesAr: 'زَ · خِيب', linguisticLevel: 'متوسط (مدود)', nonLexicalRootAr: 'صيغة فعيل من جذر مهمل (ز-خ-ب)' },
  { id: 'pw-8', word: 'دَخُوز', patternAr: 'فَعُول', syllablesAr: 'دَ · خُوز', linguisticLevel: 'متوسط (مدود)', nonLexicalRootAr: 'مد بالواو من جذر مهمل (د-خ-ز)' },

  // المستوى الثالث: مقاطع ساكنة وأوزان مشتقة (مَفْعُول / مُفْتَعِل)
  { id: 'pw-9', word: 'مَظْفُوك', patternAr: 'مَفْعُول', syllablesAr: 'مَظْ · فُوك', linguisticLevel: 'مركب (سكون ومشتقات)', nonLexicalRootAr: 'اسم مفعول من جذر مهمل (ظ-ف-ك)' },
  { id: 'pw-10', word: 'مَفْثُول', patternAr: 'مَفْعُول', syllablesAr: 'مَفْ · ثُول', linguisticLevel: 'مركب (سكون ومشتقات)', nonLexicalRootAr: 'اسم مفعول من جذر مهمل (ف-ث-ل)' },
  { id: 'pw-11', word: 'مَدْخُوز', patternAr: 'مَفْعُول', syllablesAr: 'مَدْ · خُوز', linguisticLevel: 'مركب (سكون ومشتقات)', nonLexicalRootAr: 'اسم مفعول من جذر مهمل (د-خ-ز)' },
  { id: 'pw-12', word: 'مُزْتَخِب', patternAr: 'مُفْتَعِل', syllablesAr: 'مُزْ · تَ · خِب', linguisticLevel: 'مركب (سكون ومشتقات)', nonLexicalRootAr: 'صيغة افتعال خماسية من جذر مهمل (ز-خ-ب)' },
];

// ---------------------------------------------------------------------------
// 3. Phonological & Phonemic Awareness Games
// Standard Arabic, dialect-neutral phonological subtests
// ---------------------------------------------------------------------------
export interface PhonemicTask {
  id: string;
  categoryAr: string;
  titleAr: string;
  promptAr: string;
  audioSpeechPrompt: string;
  targetWordAr: string;
  optionsAr: string[];
  correctIndex: number;
  difficultyAr: 'أولي' | 'متوسط' | 'متقدم';
  explanationAr: string;
}

export const VERIFIED_PHONEMIC_TASKS: PhonemicTask[] = [
  {
    id: 'ph-isolation-1',
    categoryAr: 'عزل الصوت الأول',
    titleAr: 'عَزْلُ الصَّوْتِ الأَوَّلِ (Initial Sound Isolation)',
    promptAr: 'مَا هُوَ الصَّوْتُ الأَوَّلُ الَّذِي تَبْدَأُ بِهِ كَلِمَةُ "زُهُور"؟',
    audioSpeechPrompt: 'ما الصوت الأول في كلمة زُهُور؟',
    targetWordAr: 'زُهُور',
    optionsAr: ['/زُ/', '/هـُ/', '/ر/'],
    correctIndex: 0,
    difficultyAr: 'أولي',
    explanationAr: 'الصوت الأول المستهل في "زُهُور" هو الزاي المضمومة: /زُ/',
  },
  {
    id: 'ph-elision-1',
    categoryAr: 'حذف المقطع الأول',
    titleAr: 'حذف الصوت الأول (Initial Phoneme Deletion)',
    promptAr: 'اسمع الكلمة: "مَسْرُور"... إذا حَذَفْنَا صَوْتَ /مَـ/ مِنْ بِدَايَتِهَا، مَا هِيَ الكَلِمَةُ الْمُتَبَقِّيَةُ؟',
    audioSpeechPrompt: 'مَسْرُور. احذف صوت مَـ. ما الكلمة المتبقية؟',
    targetWordAr: 'مَسْرُور',
    optionsAr: ['سْرُور', 'نُور', 'سُرُور'],
    correctIndex: 0,
    difficultyAr: 'متوسط',
    explanationAr: 'حذف صوت الميم يترك التركيب الصوتي المتبقي: سْرُور',
  },
  {
    id: 'ph-blending-1',
    categoryAr: 'دمج المقاطع',
    titleAr: 'دَمْجُ الأَصْوَاتِ (Phoneme Blending)',
    promptAr: 'اسْتَمِعْ إِلَى الأَصْوَاتِ الْمُنْفَصِلَةِ: /شَـ/ + /مْـ/ + /سٌ/... مَا الكَلِمَةُ الَّتِي تَتَكَوَّنُ عِنْدَ دَمْجِهَا؟',
    audioSpeechPrompt: 'شَـ ... مْـ ... سٌ. ما الكلمة؟',
    targetWordAr: 'شَمْس',
    optionsAr: ['شَمْس', 'قَمَر', 'نَفْس'],
    correctIndex: 0,
    difficultyAr: 'متوسط',
    explanationAr: 'دمج الأصوات الثلاثة يُنتج الكلمة: شَمْس',
  },
  {
    id: 'ph-rhyme-1',
    categoryAr: 'اكتشاف السجع',
    titleAr: 'اكْتِشَافُ السَّجْعِ وَالْقَافِيَةِ (Rhyme Detection)',
    promptAr: 'أَيُّ كَلِمَةٍ لَهَا نَفْسُ نَغْمَةِ وَسَجْعِ كَلِمَةِ "قَلَم"؟',
    audioSpeechPrompt: 'أي كلمة تشبه كلمة قَلَم في النغمة؟',
    targetWordAr: 'قَلَم',
    optionsAr: ['عَلَم', 'شَجَرَة', 'كِتَاب'],
    correctIndex: 0,
    difficultyAr: 'أولي',
    explanationAr: 'كَلِمَة "عَلَم" تَتَّفِقُ مَع "قَلَم" فِي المَقْطَعِ الأَخِيرِ وَالوَزْنِ (فَعَل)',
  },
  {
    id: 'ph-elision-final-1',
    categoryAr: 'حذف الصوت الأخير',
    titleAr: 'حذف الصوت الأخير (Final Phoneme Deletion)',
    promptAr: 'اسمع الكلمة: "سَمَك"... إذا حَذَفْنَا صَوْتَ /كْ/ مِنْ نِهَايَتِهَا، مَاذَا يَتَبَقَّى؟',
    audioSpeechPrompt: 'سَمَك. احذف صوت كْ من النهاية. ما الصوت المتبقي؟',
    targetWordAr: 'سَمَك',
    optionsAr: ['سَمَا', 'مَكّ', 'سَمَكَة'],
    correctIndex: 0,
    difficultyAr: 'متقدم',
    explanationAr: 'حذف الكاف الساكنة الأخيرة من "سَمَك" يُبقي المقطعين: سَمَا',
  },
  {
    id: 'ph-discrimination-1',
    categoryAr: 'التمييز السمعي للأصوات المتقاربة',
    titleAr: 'التمييز السمعي (Phonological Discrimination)',
    promptAr: 'أَيُّ زَوْجٍ مِنَ الكَلِمَاتِ يَخْتَلِفُ فَقَطْ فِي صَوْتٍ وَاحِدٍ بَيْنَ (المرقق والمفخم)؟',
    audioSpeechPrompt: 'أي زوج من الكلمات يختلف في صوت واحد فقط؟',
    targetWordAr: 'تِين / طِين',
    optionsAr: ['تِين / طِين', 'بَاب / نَار', 'شَمْس / قَمَر'],
    correctIndex: 0,
    difficultyAr: 'متقدم',
    explanationAr: 'الزوج (تِين / طِين) زوج أدنى (Minimal Pair) يختلف فقط في صوت التاء المرققة والطاء المفخمة',
  },
];

// Helper to play synthesized Web Audio tone for auditory feedback
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

  // --- 1. RAN State & Per-Item Latency Instrumentation ---
  const [ranCategory, setRanCategory] = useState<'colors' | 'digits' | 'objects'>('colors');
  const [ranMatrix, setRanMatrix] = useState<RanItem[]>(() => generateRanMatrix(RAN_COLORS, 20));
  const [ranCurrentIndex, setRanCurrentIndex] = useState(0);
  const [ranIsRunning, setRanIsRunning] = useState(false);
  const [ranStartTime, setRanStartTime] = useState<number | null>(null);
  const [ranLastItemTime, setRanLastItemTime] = useState<number | null>(null);
  const [ranItemLatenciesMs, setRanItemLatenciesMs] = useState<number[]>([]);
  const [ranElapsedMs, setRanElapsedMs] = useState(0);
  const [ranHesitations, setRanHesitations] = useState(0);
  const [ranErrors, setRanErrors] = useState(0);
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
    setRanItemLatenciesMs([]);
    setRanHesitations(0);
    setRanErrors(0);
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
    setRanErrors(0);
    setRanItemLatenciesMs([]);
    setRanFinalDurationSec(null);
    const now = Date.now();
    setRanStartTime(now);
    setRanLastItemTime(now);
    setRanIsRunning(true);
    playChime(660, 'sine', 0.2);
  };

  // Record item transition with precise per-item latency logging
  const handleRanNext = (type: 'normal' | 'hesitation' | 'error' = 'normal') => {
    if (!ranIsRunning) return;
    const now = Date.now();
    const itemLatency = ranLastItemTime ? Math.max(50, now - ranLastItemTime) : 500;
    setRanItemLatenciesMs(prev => [...prev, itemLatency]);
    setRanLastItemTime(now);

    // Detect hesitation: explicit button or duration > 1400ms on a single item
    if (type === 'hesitation' || itemLatency > 1400) {
      setRanHesitations(prev => prev + 1);
    }
    if (type === 'error') {
      setRanErrors(prev => prev + 1);
    }

    if (ranCurrentIndex + 1 < ranMatrix.length) {
      setRanCurrentIndex(prev => prev + 1);
      playChime(type === 'error' ? 320 : 540, 'triangle', 0.08);
    } else {
      // Completed RAN matrix
      const totalSec = Math.max(1, Math.round((now - (ranStartTime || now)) / 1000));
      setRanIsRunning(false);
      setRanFinalDurationSec(totalSec);
      playChime(880, 'sine', 0.3);
    }
  };

  // Compute RAN Speed & Benchmarks transparently
  const ranMetrics = useMemo(() => {
    const durSec = ranFinalDurationSec || Math.max(1, Math.round(ranElapsedMs / 1000));
    const itemsCount = ranMatrix.length;
    const speedItemsPerSec = +(itemsCount / Math.max(1, durSec)).toFixed(2);
    const meanLatencyMs = ranItemLatenciesMs.length > 0
      ? Math.round(ranItemLatenciesMs.reduce((a, b) => a + b, 0) / ranItemLatenciesMs.length)
      : Math.round((durSec * 1000) / itemsCount);

    let statusLabelAr = 'معدل تسمية استرشادي ضمن المتوسط المعتاد';
    if (durSec <= 22) {
      statusLabelAr = 'سرعة استرجاع لفظي نشطة في هذه الجلسة';
    } else if (durSec >= 35) {
      statusLabelAr = 'ملاحظة بطء في الاسترجاع أو ترددات متكررة تحتاج متابعة صفية';
    }

    return {
      durSec,
      speedItemsPerSec,
      meanLatencyMs,
      hesitationCount: ranHesitations,
      errorCount: ranErrors,
      statusLabelAr,
    };
  }, [ranFinalDurationSec, ranElapsedMs, ranMatrix.length, ranItemLatenciesMs, ranHesitations, ranErrors]);

  // Rate pseudo word
  const handleRatePseudo = (wordId: string, rating: 'correct' | 'hesitant' | 'misread') => {
    setPseudoRatings(prev => ({ ...prev, [wordId]: rating }));
    if (rating === 'correct') playChime(660, 'sine', 0.1);
    else playChime(320, 'sawtooth', 0.15);

    if (pseudoCurrentIndex + 1 < VERIFIED_ARABIC_PSEUDO_WORDS.length) {
      setPseudoCurrentIndex(prev => prev + 1);
    }
  };

  // Compute Pseudo-word Score
  const pseudoMetrics = useMemo(() => {
    const total = VERIFIED_ARABIC_PSEUDO_WORDS.length;
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
    const task = VERIFIED_PHONEMIC_TASKS.find(t => t.id === taskId);
    if (task && choiceIdx === task.correctIndex) {
      playChime(700, 'sine', 0.15);
    } else {
      playChime(280, 'sawtooth', 0.15);
    }

    if (phonemicCurrentIdx + 1 < VERIFIED_PHONEMIC_TASKS.length) {
      setPhonemicCurrentIdx(prev => prev + 1);
    }
  };

  // Compute Phonemic Awareness Score
  const phonemicMetrics = useMemo(() => {
    const total = VERIFIED_PHONEMIC_TASKS.length;
    let correct = 0;
    VERIFIED_PHONEMIC_TASKS.forEach(t => {
      if (phonemicAnswers[t.id] === t.correctIndex) correct += 1;
    });
    const percent = Math.round((correct / total) * 100);
    return { correctCount: correct, totalCount: total, percent };
  }, [phonemicAnswers]);

  // Speak Arabic prompt via Web Speech Synthesis for prompt audibility
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
      ranHesitationCount: ranMetrics.hesitationCount,
      ranCategory,
      pseudoWordScorePercent: pseudoMetrics.percent,
      phonemicAwarenessScorePercent: phonemicMetrics.percent,
      completedAt: new Date().toISOString(),
    };

    if (onCompleteScreening) {
      onCompleteScreening(finalData);
    }
    setActiveStage('summary');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Top Navigation & Student Header */}
        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-700 flex items-center justify-center">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900">
                  أنشطة الفرز المعرفي الاسترشادية لمهارات القراءة
                </h1>
                <p className="text-xs text-slate-500">
                  مهام رصدية لقياس سرعة الاسترجاع، التفكيك الصوتي للكلمات غير الحقيقية، والوعي الفونولوجي
                </p>
              </div>
            </div>

            {/* Stages Step Tabs */}
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
                2. فك الترميز (12 كلمة)
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
              <span>ملاحظة تعليمية مباشرة بدون استخدام كاميرا أو تتبع للعين</span>
            </div>
          </div>
        </div>

        {/* ===================================================================
            STAGE 1: INTRO TO BATTERY
            =================================================================== */}
        {activeStage === 'intro' && (
          <div className="bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/80 text-center">
            <div className="w-20 h-20 rounded-3xl bg-teal-50 text-teal-600 border border-teal-200 mx-auto flex items-center justify-center mb-5">
              <Brain className="w-10 h-10" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">
              أنشطة الفرز المعرفي المساندة للقراءة العربية
            </h2>
            <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed mb-6">
              توسع هذه الأنشطة ملاحظة المعلم لتشمل جوانب أساسية تسند مهارات القراءة (سرعة التسمية، التهجئة الصرفية للكلمات غير المعجمية، والوعي الصوتي)، لدعم التخطيط الصفي والتوصيات الاسترشادية.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-right">
              <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold mb-3">
                  <Timer className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">1. التسمية السريعة (RAN)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  تسمية 20 عنصراً مألوفاً لتسجيل زمن الاستجابة وترددات التوقف الاسترشادية.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-teal-50/70 border border-teal-200">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold mb-3">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">2. فك ترميز الكلمات غير المعجمية</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  قراءة 12 كلمة مصطنعة موزونة صرفياً لقياس فك الترميز الصرفي دون حفظ مسبق.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold mb-3">
                  <Volume2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">3. ألعاب الوعي الصوتي</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  مهام تفاعلية في عزل وحذف ودمج المقاطع باللغة العربية الفصحى.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs text-slate-600 text-right leading-relaxed mb-8 flex items-start gap-3">
              <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <span>
                <strong>تنويه منهجي:</strong> هذه الأنشطة أداة استرشادية لجمع ملاحظات وصفية مساندة للمعلم، وليست بطارية تشخيصية مقننة سريرياً أو بديلاً عن الفحص النفسي والتربوي المعتمد.
              </span>
            </div>

            <button
              onClick={() => setActiveStage('ran')}
              className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-lg py-4 px-10 rounded-2xl shadow-xl transition-all cursor-pointer flex items-center gap-3 mx-auto"
            >
              <span>الانتقال إلى نشاط التسمية السريعة (RAN)</span>
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ===================================================================
            STAGE 2: RAN (RAPID AUTOMATIZED NAMING) LAB
            =================================================================== */}
        {activeStage === 'ran' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80">
            {/* Header & Category Selector */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
              <div>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                  المحور 1: التسمية الآلية السريعة (RAN)
                </span>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-2">
                  رصد زمن تسمية مصفوفة العناصر (20 عنصراً)
                </h2>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  يسمي الطالب العناصر سطراً بسطر من اليمين لليسار. ينقر المعلم أو الفاحص لتسجيل الانتقال أو رصد التردد والأخطاء.
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
                  <span>المجسمات</span>
                </button>
              </div>
            </div>

            {/* Timer & Instrumentation Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 text-white p-4 rounded-2xl mb-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className={`w-5 h-5 ${ranIsRunning ? 'text-amber-400 animate-spin' : 'text-slate-400'}`} />
                  <span className="font-mono text-2xl font-black">
                    {(ranElapsedMs / 1000).toFixed(1)} ث
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  عنصر: {ranCurrentIndex} / {ranMatrix.length}
                </div>
                {ranIsRunning && (
                  <div className="text-xs text-amber-300 font-mono flex items-center gap-2">
                    <span>تردد: {ranHesitations}</span>
                    <span>خطأ: {ranErrors}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!ranIsRunning && ranFinalDurationSec === null && (
                  <button
                    onClick={handleStartRan}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>بدء التوقيت</span>
                  </button>
                )}

                {ranIsRunning && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRanNext('normal')}
                      className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="تسمية صحيحة وانتقال للعنصر التالي"
                    >
                      <span>التالي (صحيح)</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRanNext('hesitation')}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer shadow-xs"
                      title="تسجيل سكتة أو توقف ملحوظ"
                    >
                      <span>+ تردد / توقف</span>
                    </button>
                    <button
                      onClick={() => handleRanNext('error')}
                      className="bg-rose-500 hover:bg-rose-600 text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer shadow-xs"
                      title="تسجيل خطأ في تسمية العنصر"
                    >
                      <span>+ خطأ نطق</span>
                    </button>
                  </div>
                )}

                {ranFinalDurationSec !== null && (
                  <button
                    onClick={handleStartRan}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إعادة النشاط</span>
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
                      if (ranIsRunning && idx === ranCurrentIndex) handleRanNext('normal');
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

            {/* Post-Activity Detailed Instrumentation Box */}
            {ranFinalDurationSec !== null && (
              <div className="p-5 rounded-2xl bg-teal-50 border border-teal-200 flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <span className="text-xs font-bold text-teal-900 block mb-1">
                    المؤشرات المرصودة لنشاط التسمية السريعة (RAN):
                  </span>
                  <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-slate-900">
                    <span>
                      الزمن الكلي: <strong className="font-mono text-teal-800 font-bold">{ranMetrics.durSec} ث</strong>
                    </span>
                    <span>
                      المعدل: <strong className="font-mono text-teal-800 font-bold">{ranMetrics.speedItemsPerSec}</strong> عنصر/ثانية
                    </span>
                    <span>
                      متوسط زمن العنصر: <strong className="font-mono text-teal-800 font-bold">{ranMetrics.meanLatencyMs} ms</strong>
                    </span>
                    <span>
                      الترددات: <strong className="font-mono text-amber-800 font-bold">{ranMetrics.hesitationCount}</strong>
                    </span>
                    <span>
                      الأخطاء: <strong className="font-mono text-rose-800 font-bold">{ranMetrics.errorCount}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-teal-950 font-medium mt-2">
                    {ranMetrics.statusLabelAr}
                  </p>
                </div>

                <button
                  onClick={() => setActiveStage('pseudo')}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm py-3 px-6 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>الانتقال لنشاط فك الكلمات غير المعجمية</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            STAGE 3: PSEUDO-WORD DECODING (12 Verified Non-Words)
            =================================================================== */}
        {activeStage === 'pseudo' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80">
            <div className="border-b border-slate-100 pb-5 mb-6 text-right">
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                المحور 2: فك الترميز الصوتي (قراءة 12 كلمة غير حقيقية)
              </span>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-2">
                قراءة كلمات مبنية على أوزان صرفية من جذور غير معجمية
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                هذه الكلمات خالية من المعنى في المعاجم العربية (جذور مهملة: ظفك، فثل، دخز، زخب، رثق) وتتبع بدقة أوزان الصرف العربي. يقيس هذا النشاط قدرة الطفل على التهجئة الصافية دون الاتكاء على الحفظ البصري للكلمات الشائعة.
              </p>
            </div>

            {/* Current Active Word Flashcard */}
            {pseudoCurrentIndex < VERIFIED_ARABIC_PSEUDO_WORDS.length ? (
              <div className="max-w-md mx-auto text-center mb-8">
                <div className="p-8 md:p-10 rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800 mb-5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4 text-xs">
                    <span className="font-bold text-teal-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                      {pseudoCurrentIndex + 1} من {VERIFIED_ARABIC_PSEUDO_WORDS.length} (الوزن: {VERIFIED_ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].patternAr})
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {VERIFIED_ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].linguisticLevel}
                    </span>
                  </div>

                  <div className="text-5xl md:text-6xl font-black font-serif tracking-wider my-6 text-teal-100">
                    {VERIFIED_ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].word}
                  </div>

                  <div className="text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
                    <span>المقاطع الصوتية:</span>
                    <span className="text-teal-300 font-bold">{VERIFIED_ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].syllablesAr}</span>
                  </div>

                  <div className="text-[10px] text-slate-400 mt-3">
                    {VERIFIED_ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].nonLexicalRootAr}
                  </div>
                </div>

                {/* Evaluator 3-Button Rater */}
                <span className="text-xs font-bold text-slate-700 block mb-3">
                  تسجيل ملاحظة القراءة لهذا البند:
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleRatePseudo(VERIFIED_ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].id, 'correct')}
                    className="p-3.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                  >
                    <Check className="w-5 h-5 text-emerald-600" />
                    <span>قراءة صحيحة دقيقة</span>
                  </button>

                  <button
                    onClick={() => handleRatePseudo(VERIFIED_ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].id, 'hesitant')}
                    className="p-3.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                  >
                    <Clock className="w-5 h-5 text-amber-600" />
                    <span>تهجئة متباطئة / تردد</span>
                  </button>

                  <button
                    onClick={() => handleRatePseudo(VERIFIED_ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].id, 'misread')}
                    className="p-3.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                  >
                    <X className="w-5 h-5 text-rose-600" />
                    <span>خطأ / إبدال صوتي</span>
                  </button>
                </div>
              </div>
            ) : (
              /* All pseudo-words evaluated */
              <div className="p-6 rounded-2xl bg-teal-50 border border-teal-200 text-center max-w-lg mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto mb-3" />
                <h3 className="text-lg font-black text-slate-900 mb-1">
                  اكتمل رصد الكلمات غير المعجمية
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
            STAGE 4: PHONEMIC AWARENESS GAMES (6 Standard Arabic Items)
            =================================================================== */}
        {activeStage === 'phonemic' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80">
            <div className="border-b border-slate-100 pb-5 mb-6 text-right">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                المحور 3: مهام الوعي الصوتي (Phonemic & Phonological Awareness)
              </span>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-2">
                تمييز الأصوات، الحذف، والدمج باللغة الفصحى (6 بنود متدرجة)
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                بنود صوتية فصحى تراعي الحياد اللهجي؛ يستمع الطفل للتحدي (أو يقرؤه الفاحص) ويختار الإجابة الصحيحة.
              </p>
            </div>

            {phonemicCurrentIdx < VERIFIED_PHONEMIC_TASKS.length ? (
              <div className="max-w-xl mx-auto">
                <div className="p-6 md:p-8 rounded-3xl bg-indigo-50/60 border border-indigo-200 mb-6 text-right">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-indigo-900 bg-indigo-100 px-3 py-1 rounded-full">
                      بند {phonemicCurrentIdx + 1} من {VERIFIED_PHONEMIC_TASKS.length}: {VERIFIED_PHONEMIC_TASKS[phonemicCurrentIdx].titleAr}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSpeakText(VERIFIED_PHONEMIC_TASKS[phonemicCurrentIdx].audioSpeechPrompt)}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-xs cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>قراءة صوتية للبند</span>
                    </button>
                  </div>

                  <p className="text-base md:text-lg font-bold text-slate-900 leading-relaxed mb-6">
                    {VERIFIED_PHONEMIC_TASKS[phonemicCurrentIdx].promptAr}
                  </p>

                  {/* Choice Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {VERIFIED_PHONEMIC_TASKS[phonemicCurrentIdx].optionsAr.map((option, oIdx) => (
                      <button
                        key={oIdx}
                        onClick={() => handleAnswerPhonemic(VERIFIED_PHONEMIC_TASKS[phonemicCurrentIdx].id, oIdx)}
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
                  اكتملت مهام الوعي الصوتي
                </h3>
                <div className="text-3xl font-black text-indigo-700 font-mono my-2">
                  {phonemicMetrics.percent}%
                </div>
                <p className="text-xs text-slate-600 mb-4">
                  أجاب الطالب بشكل صحيح على {phonemicMetrics.correctCount} من إجمالي {phonemicMetrics.totalCount} مهام صوتية.
                </p>

                <button
                  onClick={handleFinalizeAll}
                  className="bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-extrabold text-sm py-3.5 px-8 rounded-xl flex items-center gap-2 mx-auto shadow-md transition-all cursor-pointer"
                >
                  <Award className="w-5 h-5 text-amber-300" />
                  <span>اعتماد الملاحظات وعرض الملف الاسترشادي</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            STAGE 5: SUMMARY & COGNITIVE PROFILE
            =================================================================== */}
        {activeStage === 'summary' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80">
            <div className="border-b border-slate-100 pb-5 mb-6 text-right flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                  ملخص رصد الأنشطة المكتملة
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
                  ملف مهارات القراءة الاسترشادي: {student.name}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  رصد أولي للسرعة والتفكيك والوعي الفونولوجي لإفادة المعلم
                </p>
              </div>

              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('dashboard')}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs py-3 px-5 rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <span>عرض التقرير وخطة التدخل المقترحة</span>
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
                  2. فك الكلمات غير المعجمية (12 كلمة)
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
                  إتقان {phonemicMetrics.correctCount} من {phonemicMetrics.totalCount} مهام صوتية
                </p>
              </div>
            </div>

            {/* Next Steps CTA */}
            <div className="p-6 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-base text-teal-300 mb-1">
                  تم حفظ الملاحظات في سجل جلسة الطالب
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  يمكنك الآن الانتقال إلى لوحة المعلم لمراجعة ملف المهارات الاسترشادي وتخصيص خطة التدخل التعليمية المقترحة.
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
                  إعادة المحاولة
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
