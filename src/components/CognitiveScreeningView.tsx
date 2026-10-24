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
  Mic,
  MicOff,
  Radio,
  SkipForward,
} from 'lucide-react';
import { StudentRecord, CognitiveScreeningData } from '../data/seedData';
import { useAssessment } from '../contexts/AssessmentContext';

interface Props {
  student: StudentRecord;
  onNavigateTab?: (tab: string) => void;
  onCompleteScreening?: (data: CognitiveScreeningData) => void;
}

// ---------------------------------------------------------------------------
// 1. RAN (Rapid Automatized Naming) Stimuli Sets & Vocabulary Maps
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

// Arabic Normalization for robust speech matching
function normalizeArabicForRan(str: string): string {
  return str
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/\u0640/g, '') // remove tatweel
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0621-\u064A0-9\s]/g, ' ')
    .trim();
}

// Synonyms and spoken variants for instant speech classification
const RAN_VOCABULARY_MAP: Record<string, string[]> = {
  // Colors
  'c-red': ['احمر', 'حمراء', 'حمرا', 'حمر'],
  'c-blue': ['ازرق', 'زرقاء', 'زرقا', 'كحلي'],
  'c-green': ['اخضر', 'خضراء', 'خضرا'],
  'c-yellow': ['اصفر', 'صفراء', 'صفرا'],
  'c-black': ['اسود', 'سوداء', 'سودا'],

  // Digits
  'd-2': ['اثنان', 'اثنين', 'اتنين', 'تنين', 'اثنتان', 'ثنتين', '2', '٢'],
  'd-4': ['اربعة', 'اربع', 'اربعه', '4', '٤'],
  'd-6': ['ستة', 'سته', 'ست', '6', '٦'],
  'd-7': ['سبعة', 'سبعه', 'سبع', '7', '٧'],
  'd-9': ['تسعة', 'تسعه', 'تسع', '9', '٩'],

  // Objects
  'o-tree': ['شجرة', 'شجره', 'شجر'],
  'o-hand': ['يد', 'كف', 'ايد'],
  'o-door': ['باب'],
  'o-star': ['نجمة', 'نجمه', 'نجم'],
  'o-book': ['كتاب', 'دفتر'],
};

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
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
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

  // --- 1. RAN State & Autonomous Voice AI State ---
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

  // Audio recording & Speech recognition for RAN
  const [ranIsListening, setRanIsListening] = useState(false);
  const [ranAudioUrl, setRanAudioUrl] = useState<string | null>(null);
  const [ranLastHeardWord, setRanLastHeardWord] = useState('');
  const [ranHeardStatus, setRanHeardStatus] = useState<{ word: string; isMatch: boolean; message: string } | null>(null);
  const ranMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const ranAudioChunksRef = useRef<Blob[]>([]);
  const ranRecognitionRef = useRef<any>(null);
  const ranStreamRef = useRef<MediaStream | null>(null);
  const ranTimerRef = useRef<any>(null);

  // Synchronized refs for real-time speech matching callback
  const ranCurrentIndexRef = useRef(0);
  const ranIsRunningRef = useRef(false);
  const ranMatrixRef = useRef<RanItem[]>(ranMatrix);
  const ranLastItemTimeRef = useRef<number>(0);
  const ranCategoryRef = useRef(ranCategory);

  useEffect(() => {
    ranCurrentIndexRef.current = ranCurrentIndex;
  }, [ranCurrentIndex]);

  useEffect(() => {
    ranIsRunningRef.current = ranIsRunning;
  }, [ranIsRunning]);

  useEffect(() => {
    ranMatrixRef.current = ranMatrix;
  }, [ranMatrix]);

  useEffect(() => {
    ranCategoryRef.current = ranCategory;
  }, [ranCategory]);

  // --- 2. Pseudo-word State & Voice Recognition ---
  const [pseudoRatings, setPseudoRatings] = useState<Record<string, 'correct' | 'hesitant' | 'misread'>>({});
  const [pseudoCurrentIndex, setPseudoCurrentIndex] = useState(0);
  const [pseudoIsRunning, setPseudoIsRunning] = useState(false);
  const [pseudoIsListening, setPseudoIsListening] = useState(false);
  const [pseudoAudioUrl, setPseudoAudioUrl] = useState<string | null>(null);
  const [pseudoLastHeardWord, setPseudoLastHeardWord] = useState('');
  const [pseudoWordStartTime, setPseudoWordStartTime] = useState<number>(0);
  const pseudoMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const pseudoAudioChunksRef = useRef<Blob[]>([]);
  const pseudoRecognitionRef = useRef<any>(null);
  const pseudoStreamRef = useRef<MediaStream | null>(null);
  const pseudoCurrentIndexRef = useRef(0);
  const pseudoIsRunningRef = useRef(false);

  useEffect(() => {
    pseudoCurrentIndexRef.current = pseudoCurrentIndex;
  }, [pseudoCurrentIndex]);

  useEffect(() => {
    pseudoIsRunningRef.current = pseudoIsRunning;
  }, [pseudoIsRunning]);

  // --- 3. Phonemic Tasks State ---
  const [phonemicAnswers, setPhonemicAnswers] = useState<Record<string, number>>({});
  const [phonemicCurrentIdx, setPhonemicCurrentIdx] = useState(0);

  // Initialize RAN matrix on category change
  useEffect(() => {
    const pool =
      ranCategory === 'colors' ? RAN_COLORS :
      ranCategory === 'digits' ? RAN_DIGITS : RAN_OBJECTS;
    const generated = generateRanMatrix(pool, 20);
    setRanMatrix(generated);
    ranMatrixRef.current = generated;
    setRanCurrentIndex(0);
    ranCurrentIndexRef.current = 0;
    setRanIsRunning(false);
    ranIsRunningRef.current = false;
    setRanElapsedMs(0);
    setRanFinalDurationSec(null);
    setRanItemLatenciesMs([]);
    setRanHesitations(0);
    setRanErrors(0);
    setRanAudioUrl(null);
    setRanLastHeardWord('');
    setRanHeardStatus(null);
  }, [ranCategory]);

  // RAN Stopwatch Loop
  useEffect(() => {
    if (ranIsRunning) {
      ranTimerRef.current = setInterval(() => {
        if (ranStartTime) {
          const elapsed = Date.now() - ranStartTime;
          setRanElapsedMs(elapsed);

          // Check if the student stayed silent on the current item > 1800ms
          const now = Date.now();
          if (ranLastItemTimeRef.current && now - ranLastItemTimeRef.current > 1900) {
            // mark subtle hesitation indicator if not already triggered
          }
        }
      }, 50);
    } else {
      if (ranTimerRef.current) clearInterval(ranTimerRef.current);
    }
    return () => {
      if (ranTimerRef.current) clearInterval(ranTimerRef.current);
    };
  }, [ranIsRunning, ranStartTime]);

  // Clean up all audio streams and recognizers on unmount
  useEffect(() => {
    return () => {
      stopRan();
      stopPseudo();
    };
  }, []);

  // Stop RAN and cleanup recording
  const stopRan = useCallback(() => {
    ranIsRunningRef.current = false;
    setRanIsRunning(false);
    if (ranTimerRef.current) clearInterval(ranTimerRef.current);

    if (ranRecognitionRef.current) {
      try {
        ranRecognitionRef.current.onend = null;
        ranRecognitionRef.current.stop();
      } catch {}
      ranRecognitionRef.current = null;
    }
    if (ranMediaRecorderRef.current && ranMediaRecorderRef.current.state !== 'inactive') {
      try {
        ranMediaRecorderRef.current.stop();
      } catch {}
    }
    if (ranStreamRef.current) {
      ranStreamRef.current.getTracks().forEach(t => t.stop());
      ranStreamRef.current = null;
    }
    setRanIsListening(false);
  }, []);

  // Record item transition with precise per-item latency logging
  const handleRanNext = useCallback((type: 'normal' | 'hesitation' | 'error' = 'normal') => {
    if (!ranIsRunningRef.current) return;
    const now = Date.now();
    const prevTime = ranLastItemTimeRef.current || now;
    const itemLatency = Math.max(80, now - prevTime);

    setRanItemLatenciesMs(prev => [...prev, itemLatency]);
    setRanLastItemTime(now);
    ranLastItemTimeRef.current = now;

    // Detect hesitation if explicit or duration > 1600ms on a single item
    if (type === 'hesitation' || itemLatency > 1600) {
      setRanHesitations(prev => prev + 1);
    }
    if (type === 'error') {
      setRanErrors(prev => prev + 1);
    }

    const curIdx = ranCurrentIndexRef.current;
    const matrix = ranMatrixRef.current;

    if (curIdx + 1 < matrix.length) {
      const nextIdx = curIdx + 1;
      setRanCurrentIndex(nextIdx);
      ranCurrentIndexRef.current = nextIdx;
      playChime(type === 'error' ? 320 : 540, 'triangle', 0.08);
    } else {
      // Completed RAN matrix
      const totalSec = Math.max(1, Math.round((now - (ranStartTime || now)) / 1000));
      stopRan();
      setRanFinalDurationSec(totalSec);
      playChime(880, 'sine', 0.3);
    }
  }, [ranStartTime, stopRan]);

  // Real-time speech recognition for RAN
  const startRanSpeechRecognition = useCallback(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }

    try {
      if (ranRecognitionRef.current) {
        try {
          ranRecognitionRef.current.onend = null;
          ranRecognitionRef.current.stop();
        } catch {}
      }

      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        if (!ranIsRunningRef.current) return;
        const curIdx = ranCurrentIndexRef.current;
        const matrix = ranMatrixRef.current;
        if (curIdx >= matrix.length) return;

        const target = matrix[curIdx];
        const validVariants = RAN_VOCABULARY_MAP[target.id] || [target.labelAr];

        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += (event.results[i][0]?.transcript || '') + ' ';
        }

        const normalized = normalizeArabicForRan(transcript);
        if (!normalized) return;

        const tokens = normalized.split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return;
        const latestToken = tokens[tokens.length - 1];
        setRanLastHeardWord(latestToken);

        // Check if ANY token in the spoken phrase matches the expected item
        const isMatch = tokens.some(token =>
          validVariants.some(variant => token.includes(variant) || variant.includes(token))
        );

        if (isMatch) {
          setRanHeardStatus({
            word: latestToken,
            isMatch: true,
            message: `✓ التقط الذكاء الاصطناعي: "${target.labelAr}" بدقة`,
          });
          handleRanNext('normal');
          return;
        }

        // Check if the student spoke another element in the current pool (misnaming error)
        const pool = ranCategoryRef.current === 'colors' ? RAN_COLORS :
                     ranCategoryRef.current === 'digits' ? RAN_DIGITS : RAN_OBJECTS;

        const wrongItem = pool.find(item =>
          item.id !== target.id &&
          (RAN_VOCABULARY_MAP[item.id] || []).some(v => latestToken.includes(v) || v.includes(latestToken))
        );

        if (wrongItem) {
          setRanHeardStatus({
            word: latestToken,
            isMatch: false,
            message: `❌ رصد إبدال: نطق "${latestToken}" والمطلوب "${target.labelAr}"`,
          });
          handleRanNext('error');
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'no-speech' || e.error === 'audio-capture') return;
      };

      recognition.onend = () => {
        if (ranIsRunningRef.current) {
          setTimeout(() => {
            if (ranIsRunningRef.current) {
              try {
                startRanSpeechRecognition();
              } catch {}
            }
          }, 40);
        } else {
          setRanIsListening(false);
        }
      };

      recognition.start();
      ranRecognitionRef.current = recognition;
      setRanIsListening(true);
    } catch (e) {
      console.warn('RAN SpeechRecognition start error:', e);
    }
  }, [handleRanNext]);

  // Start RAN with real microphone recording and real-time speech matching
  const handleStartRan = async () => {
    setRanCurrentIndex(0);
    ranCurrentIndexRef.current = 0;
    setRanElapsedMs(0);
    setRanHesitations(0);
    setRanErrors(0);
    setRanItemLatenciesMs([]);
    setRanFinalDurationSec(null);
    setRanAudioUrl(null);
    setRanLastHeardWord('');
    setRanHeardStatus(null);

    const now = Date.now();
    setRanStartTime(now);
    setRanLastItemTime(now);
    ranLastItemTimeRef.current = now;
    setRanIsRunning(true);
    ranIsRunningRef.current = true;
    playChime(660, 'sine', 0.2);

    // 1. Microphone Audio Recording via MediaRecorder
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ranStreamRef.current = stream;
        ranAudioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            ranAudioChunksRef.current.push(e.data);
          }
        };
        recorder.onstop = () => {
          const blob = new Blob(ranAudioChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setRanAudioUrl(url);
        };
        recorder.start(250);
        ranMediaRecorderRef.current = recorder;
      }
    } catch (err) {
      console.warn('Microphone recording error:', err);
    }

    // 2. Start Real-time Speech Recognition
    startRanSpeechRecognition();
  };

  // Compute RAN Speed & Benchmarks transparently
  const ranMetrics = useMemo(() => {
    const durSec = ranFinalDurationSec || Math.max(1, Math.round(ranElapsedMs / 1000));
    const itemsCount = ranMatrix.length;
    const speedItemsPerSec = +(itemsCount / Math.max(1, durSec)).toFixed(2);
    const meanLatencyMs = ranItemLatenciesMs.length > 0
      ? Math.round(ranItemLatenciesMs.reduce((a, b) => a + b, 0) / ranItemLatenciesMs.length)
      : Math.round((durSec * 1000) / itemsCount);

    let statusLabelAr = 'معدل تسمية طبيعي ضمن المتوسط المعتاد';
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

  // -------------------------------------------------------------------------
  // Pseudo-word Autonomous Voice AI Handler
  // -------------------------------------------------------------------------
  const stopPseudo = useCallback(() => {
    pseudoIsRunningRef.current = false;
    setPseudoIsRunning(false);
    if (pseudoRecognitionRef.current) {
      try {
        pseudoRecognitionRef.current.onend = null;
        pseudoRecognitionRef.current.stop();
      } catch {}
      pseudoRecognitionRef.current = null;
    }
    if (pseudoMediaRecorderRef.current && pseudoMediaRecorderRef.current.state !== 'inactive') {
      try {
        pseudoMediaRecorderRef.current.stop();
      } catch {}
    }
    if (pseudoStreamRef.current) {
      pseudoStreamRef.current.getTracks().forEach(t => t.stop());
      pseudoStreamRef.current = null;
    }
    setPseudoIsListening(false);
  }, []);

  const handleRatePseudo = useCallback((wordId: string, rating: 'correct' | 'hesitant' | 'misread') => {
    setPseudoRatings(prev => ({ ...prev, [wordId]: rating }));
    if (rating === 'correct') playChime(660, 'sine', 0.1);
    else playChime(320, 'sawtooth', 0.15);

    const curIdx = pseudoCurrentIndexRef.current;
    if (curIdx + 1 < VERIFIED_ARABIC_PSEUDO_WORDS.length) {
      const nextIdx = curIdx + 1;
      setPseudoCurrentIndex(nextIdx);
      pseudoCurrentIndexRef.current = nextIdx;
      setPseudoWordStartTime(Date.now());
      setPseudoLastHeardWord('');
    } else {
      stopPseudo();
    }
  }, [stopPseudo]);

  const startPseudoSpeechRecognition = useCallback(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    try {
      if (pseudoRecognitionRef.current) {
        try {
          pseudoRecognitionRef.current.onend = null;
          pseudoRecognitionRef.current.stop();
        } catch {}
      }

      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        if (!pseudoIsRunningRef.current) return;
        const curIdx = pseudoCurrentIndexRef.current;
        if (curIdx >= VERIFIED_ARABIC_PSEUDO_WORDS.length) return;

        const targetWord = VERIFIED_ARABIC_PSEUDO_WORDS[curIdx];
        const normalizedTarget = normalizeArabicForRan(targetWord.word);

        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += (event.results[i][0]?.transcript || '') + ' ';
        }

        const normalized = normalizeArabicForRan(transcript);
        if (!normalized) return;

        const tokens = normalized.split(/\s+/).filter(Boolean);
        const lastToken = tokens[tokens.length - 1];
        setPseudoLastHeardWord(lastToken);

        const now = Date.now();
        const latency = pseudoWordStartTime ? now - pseudoWordStartTime : 1000;

        // Check matching
        if (lastToken.includes(normalizedTarget) || normalizedTarget.includes(lastToken)) {
          const rating = latency > 2400 ? 'hesitant' : 'correct';
          setTimeout(() => {
            handleRatePseudo(targetWord.id, rating);
          }, 400);
        }
      };

      recognition.onerror = () => {};

      recognition.onend = () => {
        if (pseudoIsRunningRef.current) {
          setTimeout(() => {
            if (pseudoIsRunningRef.current) {
              try {
                startPseudoSpeechRecognition();
              } catch {}
            }
          }, 40);
        } else {
          setPseudoIsListening(false);
        }
      };

      recognition.start();
      pseudoRecognitionRef.current = recognition;
      setPseudoIsListening(true);
    } catch (e) {
      console.warn('Pseudo SpeechRecognition error:', e);
    }
  }, [handleRatePseudo, pseudoWordStartTime]);

  const handleStartPseudoSession = async () => {
    setPseudoCurrentIndex(0);
    pseudoCurrentIndexRef.current = 0;
    setPseudoRatings({});
    setPseudoAudioUrl(null);
    setPseudoLastHeardWord('');
    setPseudoIsRunning(true);
    pseudoIsRunningRef.current = true;
    setPseudoWordStartTime(Date.now());
    playChime(660, 'sine', 0.2);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        pseudoStreamRef.current = stream;
        pseudoAudioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            pseudoAudioChunksRef.current.push(e.data);
          }
        };
        recorder.onstop = () => {
          const blob = new Blob(pseudoAudioChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setPseudoAudioUrl(url);
        };
        recorder.start(250);
        pseudoMediaRecorderRef.current = recorder;
      }
    } catch (err) {
      console.warn('Microphone recording error:', err);
    }

    startPseudoSpeechRecognition();
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
      ranStatus: ranMetrics.durSec <= 22 ? 'fast' : ranMetrics.durSec >= 35 ? 'slow_at_risk' : 'average',
      ranStatusLabelAr: ranMetrics.statusLabelAr,
      pseudoWordScorePercent: pseudoMetrics.percent,
      pseudoWordWordsRead: pseudoMetrics.correctCount,
      pseudoWordTotalCount: pseudoMetrics.totalCount,
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
                  أنشطة الفرز المعرفي لمهارات القراءة
                </h1>
                <p className="text-xs text-slate-500">
                  مهام رصدية لقياس سرعة الاسترجاع، التفكيك الصوتي للكلمات غير الحقيقية، والوعي الفونولوجي
                </p>
              </div>
            </div>

            {/* Stages Step Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
              <button
                onClick={() => setActiveStage('intro')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeStage === 'intro' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                المقدمة
              </button>
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
                2. الكلمات غير المعجمية
              </button>
              <button
                onClick={() => setActiveStage('phonemic')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeStage === 'phonemic' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3. الوعي الصوتي
              </button>
              <button
                onClick={() => setActiveStage('summary')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeStage === 'summary' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الملف الشامل
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span>الطالب: <strong className="text-slate-800">{student.name}</strong></span>
              <span>·</span>
              <span>الصف: <strong className="text-slate-800">{student.gradeLevel}</strong></span>
              <span>·</span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                تسجيل وتحليل صوتي مباشر بالذكاء الاصطناعي
              </span>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('dashboard')}
                className="text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>العودة للوحة الرئيسية</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ===================================================================
            STAGE 1: BATTERY INTRO & RATIONALE
            =================================================================== */}
        {activeStage === 'intro' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80 space-y-6">
            <div className="border-b border-slate-100 pb-5">
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                بروتوكول الفرز المعرفي متعدد الأبعاد
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
                بطارية التقييم المعرفي لمساندة الكشف المبكر
              </h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                توسع هذه الأنشطة التحليل الذكي للذكاء الاصطناعي ليشمل جوانب أساسية تسند مهارات القراءة (سرعة التسمية، التهجئة الصرفية للكلمات غير المعجمية، والوعي الصوتي)، لدعم التخطيط والتوصيات الذاتية.
              </p>
            </div>

            {/* 3 Pillars Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-right space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center font-black">
                  ١
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  التسمية الآلية السريعة (RAN)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  قياس سرعة استرجاع التسميات اللفظية للألوان والأرقام تلقائياً عبر ميكروفون الذكاء الاصطناعي مع رصد الترددات بدقة.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-teal-50/70 border border-teal-200 text-right space-y-2">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-800 flex items-center justify-center font-black">
                  ٢
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  قراءة الكلمات غير المعجمية (Pseudo-Words)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  12 كلمة موزونة صرفياً ومنعدمة المعنى المعجمي لقياس التفكيك الفونولوجي بدلاً من الاعتماد على الحفظ البصري.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-right space-y-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-800 flex items-center justify-center font-black">
                  ٣
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  ألعاب الوعي الصوتي (Phonemic Awareness)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  6 بنود صوتية فصحى متدرجة لقياس عزل الصوت الأول، الحذف، الدمج، والسجع بشكل تفاعلي.
                </p>
              </div>
            </div>

            {/* Scientific Integrity Note */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>تنويه منهجي:</strong> تهدف هذه الأنشطة إلى تزويد نظام التحليل الذكي بملاحظات وصفية دقيقة لتصميم خطط الدعم والتدخل التعليمي المناسبة.
              </div>
            </div>

            {/* Start Button */}
            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setActiveStage('ran')}
                className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-base py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center gap-3 cursor-pointer"
              >
                <span>الانتقال للمحور 1: التسمية الآلية السريعة (RAN)</span>
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            STAGE 2: RAN (RAPID AUTOMATIZED NAMING) LAB - 100% VOICE AI DRIVEN
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
                  رصد زمن تسمية مصفوفة العناصر (20 عنصراً) بالذكاء الاصطناعي
                </h2>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  يسمي الطالب العناصر بصوته سطراً بسطر من اليمين لليسار. يستمع الذكاء الاصطناعي مباشرة ويسجل الصوت وينقل المؤشر تلقائياً عند نطق العنصر دون الحاجة للمس الشاشة.
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

            {/* Timer & Autonomous Voice Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 text-white p-4 md:p-5 rounded-2xl mb-6 shadow-sm">
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
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Mic className="w-5 h-5 fill-current" />
                    <span>بدء التسمية بالذكاء الاصطناعي (تسجيل صوتي)</span>
                  </button>
                )}

                {ranIsRunning && (
                  <div className="flex items-center gap-3">
                    {/* Live Voice Indicator HUD */}
                    <div className="flex items-center gap-2 bg-emerald-900/80 border border-emerald-500/60 text-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse">
                      <Radio className="w-4 h-4 text-emerald-400 animate-ping" />
                      <span>الذكاء الاصطناعي يسجل ويستمع لصوتك الآن</span>
                    </div>

                    {/* Hands-Free Skip Fallback if child is completely silent */}
                    <button
                      onClick={() => handleRanNext('hesitation')}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-700 flex items-center gap-1"
                      title="تخطي العنصر الحالي في حالة الصمت التام"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>تخطي</span>
                    </button>
                  </div>
                )}

                {ranFinalDurationSec !== null && (
                  <button
                    onClick={handleStartRan}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إعادة النشاط</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live AI Speech Recognition Readout Chip */}
            {ranIsRunning && ranHeardStatus && (
              <div className={`p-3 rounded-2xl mb-4 text-xs font-bold flex items-center justify-between border transition-all ${
                ranHeardStatus.isMatch
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  <span>{ranHeardStatus.message}</span>
                </div>
                <span className="text-[11px] opacity-75">الانتقال التلقائي مفعل عبر الصوت</span>
              </div>
            )}

            {/* 4x5 Visual Grid Matrix - Hands-Free Voice Driven */}
            <div className="grid grid-cols-5 gap-3 md:gap-4 p-4 md:p-6 bg-slate-50 rounded-3xl border border-slate-200 mb-6">
              {ranMatrix.map((item, idx) => {
                const isCurrent = ranIsRunning && idx === ranCurrentIndex;
                const isPassed = idx < ranCurrentIndex;

                return (
                  <div
                    key={idx}
                    className={`aspect-square rounded-2xl p-2 flex flex-col items-center justify-center border-2 transition-all select-none relative ${
                      isCurrent
                        ? 'border-emerald-500 bg-emerald-50 shadow-xl scale-105 ring-4 ring-emerald-300 animate-pulse'
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
                      <span className="absolute -top-2 -right-2 bg-emerald-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-xs">
                        انطق الآن 🎙️
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Post-Activity Detailed Instrumentation Box & Audio Player */}
            {ranFinalDurationSec !== null && (
              <div className="p-6 rounded-2xl bg-teal-50 border border-teal-200 mb-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-teal-900 block mb-1">
                      المؤشرات المرصودة لنشاط التسمية السريعة (RAN) المعتمدة بالذكاء الاصطناعي:
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
                    className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm py-3.5 px-6 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <span>الانتقال للمحور 2: الكلمات غير المعجمية</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* Session Audio Player for Verification */}
                {ranAudioUrl && (
                  <div className="p-4 rounded-xl bg-white border border-teal-200 shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-900 mb-2">
                      <Volume2 className="w-4 h-4 text-teal-600" />
                      <span>تسجيل الجلسة الصوتي الكامل (استمع للتحقق من أداء الطالب):</span>
                    </div>
                    <audio controls src={ranAudioUrl} className="w-full h-10" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            STAGE 3: PSEUDO-WORDS DECODING LAB (12 Non-Words) - VOICE AI DRIVEN
            =================================================================== */}
        {activeStage === 'pseudo' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80">
            <div className="border-b border-slate-100 pb-5 mb-6 text-right">
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                المحور 2: الكلمات غير المعجمية (Non-Word Decoding)
              </span>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-2">
                قراءة الكلمات غير الحقيقية وفك الترميز الفونولوجي بالذكاء الاصطناعي
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                كلمات تخضع لأوزان الصرف العربي الأصيلة ولكنها مهملة معجمياً؛ يستمع الذكاء الاصطناعي لقراءة الطالب ويحلل التفكيك بدقة.
              </p>
            </div>

            {pseudoCurrentIndex < VERIFIED_ARABIC_PSEUDO_WORDS.length ? (
              <div className="max-w-xl mx-auto text-center">
                {/* Visual Flashcard */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-8 md:p-12 shadow-xl border border-slate-700 mb-6 relative overflow-hidden">
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

                {/* Voice AI Status & Start Session */}
                {!pseudoIsRunning && Object.keys(pseudoRatings).length === 0 ? (
                  <button
                    onClick={handleStartPseudoSession}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-8 py-4 rounded-2xl text-base flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all cursor-pointer mx-auto"
                  >
                    <Mic className="w-5 h-5 fill-current" />
                    <span>بدء قراءة الكلمات بالذكاء الاصطناعي (تسجيل صوتي)</span>
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3 bg-slate-900 text-white p-4 rounded-2xl">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 animate-pulse">
                        <Radio className="w-4 h-4 animate-ping" />
                        <span>الذكاء الاصطناعي يستمع لقراءتك الآن: اقرأ الكلمة بوضوح</span>
                      </div>
                      {pseudoLastHeardWord && (
                        <span className="text-xs font-mono bg-slate-800 px-3 py-1 rounded-xl text-teal-300 border border-slate-700">
                          التقط: "{pseudoLastHeardWord}"
                        </span>
                      )}
                    </div>

                    {/* Quick confirmation or skip */}
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => handleRatePseudo(VERIFIED_ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].id, 'correct')}
                        className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>تأكيد القراءة الصحيحة والانتقال</span>
                      </button>
                      <button
                        onClick={() => handleRatePseudo(VERIFIED_ARABIC_PSEUDO_WORDS[pseudoCurrentIndex].id, 'misread')}
                        className="p-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <SkipForward className="w-4 h-4" />
                        <span>تخطي للكلمة التالية</span>
                      </button>
                    </div>
                  </div>
                )}
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
                  تم فك ترميز {pseudoMetrics.correctCount} من إجمالي {pseudoMetrics.totalCount} كلمات موزونة بنجاح.
                </p>

                {pseudoAudioUrl && (
                  <div className="p-3 rounded-xl bg-white border border-teal-200 shadow-xs mb-4 text-right">
                    <span className="text-xs font-bold text-teal-900 block mb-1">تسجيل قراءة الكلمات:</span>
                    <audio controls src={pseudoAudioUrl} className="w-full h-10" />
                  </div>
                )}

                <button
                  onClick={() => setActiveStage('phonemic')}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm py-3.5 px-6 rounded-xl flex items-center gap-2 mx-auto shadow-sm transition-all cursor-pointer"
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
                بنود صوتية فصحى تراعي الحياد اللهجي؛ يستمع الطفل للتحدي ويختار الإجابة الصحيحة.
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
                  <span>اعتماد الملاحظات وعرض الملف المعرفي الشامل</span>
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
                  ملف مهارات القراءة والتعلم: {student.name}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  ملخص دقيق للسرعة والتفكيك والوعي الفونولوجي بالذكاء الاصطناعي
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
                {ranAudioUrl && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <span className="text-[10px] text-amber-800 font-bold block mb-1">تسجيل صوت الجلسة:</span>
                    <audio controls src={ranAudioUrl} className="w-full h-8" />
                  </div>
                )}
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
                {pseudoAudioUrl && (
                  <div className="mt-3 pt-3 border-t border-teal-200">
                    <span className="text-[10px] text-teal-800 font-bold block mb-1">تسجيل القراءة:</span>
                    <audio controls src={pseudoAudioUrl} className="w-full h-8" />
                  </div>
                )}
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
                  يمكنك الآن الانتقال إلى لوحة التحليل الذكي لمراجعة ملف المهارات الشامل وخطة التدخل المقترحة.
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
                    <span>لوحة التحليل والتقارير الذكية</span>
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
