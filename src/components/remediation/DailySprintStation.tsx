import React, { useState, useEffect } from 'react';
import {
  Flame,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  Volume2,
  Sparkles,
  ArrowLeft,
  ChevronLeft,
  Check,
  Star,
  Award,
  Trophy,
  X,
  Smile,
  Eye,
  HelpCircle,
} from 'lucide-react';
import { StudentRecord } from '../../data/seedData';
import { CURATED_DECODABLE_STORIES, DecodableStory } from '../../utils/adaptiveStoryGen';

interface DailySprintStationProps {
  activeStudent: StudentRecord;
  speakText: (text: string) => void;
  triggerCelebration: (msg: string, earnedXp?: number) => void;
}

interface DailySprintProgressRecord {
  streakDays: number;
  lastCompletedDate: string;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousLocalDateKey(date = new Date()): string {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return localDateKey(previous);
}

function readStoredDailySprint(studentId: string): DailySprintProgressRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`baseera_daily_sprint_v1:${studentId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailySprintProgressRecord>;
    if (
      Number.isInteger(parsed.streakDays) &&
      (parsed.streakDays as number) >= 1 &&
      typeof parsed.lastCompletedDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.lastCompletedDate)
    ) {
      return { streakDays: parsed.streakDays as number, lastCompletedDate: parsed.lastCompletedDate };
    }
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
  return null;
}

function getDailySprintProgress(studentId: string): { streakDays: number; isCompletedToday: boolean } {
  const stored = readStoredDailySprint(studentId);
  if (!stored) return { streakDays: 0, isCompletedToday: false };
  const today = localDateKey();
  const yesterday = previousLocalDateKey();
  if (stored.lastCompletedDate === today) {
    return { streakDays: stored.streakDays, isCompletedToday: true };
  }
  if (stored.lastCompletedDate === yesterday) {
    return { streakDays: stored.streakDays, isCompletedToday: false };
  }
  return { streakDays: 0, isCompletedToday: false };
}

interface WarmupPhonemeExercise {
  id: number;
  targetSoundLabel: string;
  targetSoundSymbol: string;
  targetSoundAudio: string;
  contrastSoundLabel: string;
  contrastSoundSymbol: string;
  questionText: string;
  targetWord: string;
  targetAudio: string;
  targetPhoneticTag: string;
  distractorWord: string;
  distractorAudio: string;
  distractorPhoneticTag: string;
  mirrorTip: {
    target: string;
    distractor: string;
  };
  feedbackSuccess: string;
  feedbackRetry: string;
}

export const DailySprintStation: React.FC<DailySprintStationProps> = ({
  activeStudent,
  speakText,
  triggerCelebration,
}) => {
  // Sprint Steps: 1 = Warm-up Phonics (1 min), 2 = Decodable Story Shadowing (3 min), 3 = Mouth Cue & Check (1 min)
  const [sprintStep, setSprintStep] = useState<1 | 2 | 3>(1);
  const [timerSeconds, setTimerSeconds] = useState<number>(300); // 5 minutes
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [streakDays, setStreakDays] = useState<number>(() => getDailySprintProgress(activeStudent.id).streakDays);
  const [isCompletedToday, setIsCompletedToday] = useState<boolean>(() => getDailySprintProgress(activeStudent.id).isCompletedToday);

  useEffect(() => {
    const progress = getDailySprintProgress(activeStudent.id);
    setStreakDays(progress.streakDays);
    setIsCompletedToday(progress.isCompletedToday);
  }, [activeStudent.id]);

  // Step 1: Warmup discrimination state
  const [warmupIdx, setWarmupIdx] = useState<number>(0);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Clinically curated minimal-pairs discrimination bank
  const warmupPairs: WarmupPhonemeExercise[] = [
    {
      id: 1,
      targetSoundLabel: 'حَرْفُ السِّينِ المُرَقَّق',
      targetSoundSymbol: '« س »',
      targetSoundAudio: 'صَوْتُ حَرْفِ السِّين: سَ',
      contrastSoundLabel: 'حَرْفُ الصَّادِ المُفَخَّم',
      contrastSoundSymbol: '« ص »',
      questionText: 'أيُّ الكَلِمَتَيْنِ تَبْدَأُ بِصَوْتِ السِّينِ المُرَقَّق (سَـ)؟',
      targetWord: 'سَيْفٌ',
      targetAudio: 'سَيْفٌ',
      targetPhoneticTag: 'سينٌ مُرَقَّقَة',
      distractorWord: 'صَيْفٌ',
      distractorAudio: 'صَيْفٌ',
      distractorPhoneticTag: 'صادٌ مُفَخَّمَة',
      mirrorTip: {
        target: 'السين: ينبسط الفم في ابتسامة خفيفة ويهمس الهواء برقة من بين الأسنان.',
        distractor: 'الصاد: يرتفع أقصى اللسان ويستعلي، فيمتلئ الفم بالصدى والتفخيم.',
      },
      feedbackSuccess: 'أَحْسَنْتَ! كَلِمَةُ «سَيْفٌ» تَبْدَأُ بِالسِّينِ المُرَقَّقَة المُنْبَسِطَة.',
      feedbackRetry: 'اسْتَمِعْ جَيِّداً: «صَيْفٌ» تَبْدَأُ بِالصَّادِ المُفَخَّمَة، وَالمَطْلُوبُ السِّينُ المُرَقَّقَة!',
    },
    {
      id: 2,
      targetSoundLabel: 'حَرْفُ الصَّادِ المُفَخَّم',
      targetSoundSymbol: '« ص »',
      targetSoundAudio: 'صَوْتُ حَرْفِ الصَّاد: صَ',
      contrastSoundLabel: 'حَرْفُ السِّينِ المُرَقَّق',
      contrastSoundSymbol: '« س »',
      questionText: 'أيُّ الكَلِمَتَيْنِ تَبْدَأُ بِصَوْتِ الصَّادِ المُفَخَّم (صَـ)؟',
      targetWord: 'صَابُونٌ',
      targetAudio: 'صَابُونٌ',
      targetPhoneticTag: 'صادٌ مُفَخَّمَة',
      distractorWord: 'سَابِقٌ',
      distractorAudio: 'سَابِقٌ',
      distractorPhoneticTag: 'سينٌ مُرَقَّقَة',
      mirrorTip: {
        target: 'الصاد: يستعلي أقصى اللسان ليملأ تجويف الفم صدى وضخامة.',
        distractor: 'السين: يستفل اللسان وينبسط الفم برقة.',
      },
      feedbackSuccess: 'رَائِع ومُبْدِع! «صَابُونٌ» تَبْدَأُ بِالصَّادِ المُفَخَّمَة القَوِيَّة.',
      feedbackRetry: '«سَابِقٌ» تَبْدَأُ بِالسِّينِ المُرَقَّقَة، وَالمَطْلُوبُ الصَّادُ المُفَخَّمَة!',
    },
    {
      id: 3,
      targetSoundLabel: 'حَرْفُ التَّاءِ المُرَقَّق',
      targetSoundSymbol: '« ت »',
      targetSoundAudio: 'صَوْتُ حَرْفِ التَّاء: تِ',
      contrastSoundLabel: 'حَرْفُ الطَّاءِ المُفَخَّم',
      contrastSoundSymbol: '« ط »',
      questionText: 'أيُّ الكَلِمَتَيْنِ تَبْدَأُ بِصَوْتِ التَّاءِ المُرَقَّق (تِـ)؟',
      targetWord: 'تِينٌ',
      targetAudio: 'تِينٌ',
      targetPhoneticTag: 'تاءٌ مُرَقَّقَة',
      distractorWord: 'طِينٌ',
      distractorAudio: 'طِينٌ',
      distractorPhoneticTag: 'طاءٌ مُفَخَّمَة',
      mirrorTip: {
        target: 'التاء: تخرج برقة من طرف اللسان مع أصول الثنايا العلوية بنعومة وخفة.',
        distractor: 'الطاء: حرف إطباق قوي ينطبق معه طائفة من اللسان على الحنك الأعلى.',
      },
      feedbackSuccess: 'مُمْتَاز! «تِينٌ» تَبْدَأُ بِالتَّاءِ المُرَقَّقَة النَّاعِمَة.',
      feedbackRetry: '«طِينٌ» تَبْدَأُ بِالطَّاءِ المُفَخَّمَة، وَالمَطْلُوبُ التَّاءُ المُرَقَّقَة!',
    },
    {
      id: 4,
      targetSoundLabel: 'حَرْفُ الطَّاءِ المُفَخَّم',
      targetSoundSymbol: '« ط »',
      targetSoundAudio: 'صَوْتُ حَرْفِ الطَّاء: طَ',
      contrastSoundLabel: 'حَرْفُ التَّاءِ المُرَقَّق',
      contrastSoundSymbol: '« ت »',
      questionText: 'أيُّ الكَلِمَتَيْنِ تَبْدَأُ بِصَوْتِ الطَّاءِ المُفَخَّم (طَـ)؟',
      targetWord: 'طَبِيبٌ',
      targetAudio: 'طَبِيبٌ',
      targetPhoneticTag: 'طاءٌ مُفَخَّمَة',
      distractorWord: 'تَمْرٌ',
      distractorAudio: 'تَمْرٌ',
      distractorPhoneticTag: 'تاءٌ مُرَقَّقَة',
      mirrorTip: {
        target: 'الطاء: صوت مفخم مطبق يملأ الفم قوة واستعلاء.',
        distractor: 'التاء: صوت رقيق مهموس ينبسط معه طرف اللسان.',
      },
      feedbackSuccess: 'بَطَل! «طَبِيبٌ» تَبْدَأُ بِالطَّاءِ المُفَخَّمَة القَوِيَّة.',
      feedbackRetry: '«تَمْرٌ» تَبْدَأُ بِتَاءٍ مُرَقَّقَة، وَالمَطْلُوبُ الطَّاءُ المُفَخَّمَة!',
    },
    {
      id: 5,
      targetSoundLabel: 'حَرْفُ الدَّالِ المُرَقَّق',
      targetSoundSymbol: '« د »',
      targetSoundAudio: 'صَوْتُ حَرْفِ الدَّال: دَ',
      contrastSoundLabel: 'حَرْفُ الضَّادِ المُفَخَّم',
      contrastSoundSymbol: '« ض »',
      questionText: 'أيُّ الكَلِمَتَيْنِ تَبْدَأُ بِصَوْتِ الدَّالِ المُرَقَّق (دَ)؟',
      targetWord: 'دَلَّ',
      targetAudio: 'دَلَّ',
      targetPhoneticTag: 'دالٌ مُرَقَّقَة',
      distractorWord: 'ضَلَّ',
      distractorAudio: 'ضَلَّ',
      distractorPhoneticTag: 'ضادٌ مُفَخَّمَة',
      mirrorTip: {
        target: 'الدال: صوت مرقق خفيف يقرع فيه طرف اللسان مقدمة الحنك برقة.',
        distractor: 'الضاد: صوت مفخم مستطيل يخرج من إحدى حافتي اللسان.',
      },
      feedbackSuccess: 'أَحْسَنْتَ! «دَلَّ» تَبْدَأُ بِالدَّالِ المُرَقَّقَة الخَفِيفَة.',
      feedbackRetry: '«ضَلَّ» تَبْدَأُ بِالضَّادِ المُفَخَّمَة، وَالمَطْلُوبُ الدَّالُ المُرَقَّقَة!',
    },
    {
      id: 6,
      targetSoundLabel: 'حَرْفُ الكَافِ المَهْمُوس',
      targetSoundSymbol: '« ك »',
      targetSoundAudio: 'صَوْتُ حَرْفِ الكَاف: كَ',
      contrastSoundLabel: 'حَرْفُ القَافِ اللَّهَوِيّ',
      contrastSoundSymbol: '« ق »',
      questionText: 'أيُّ الكَلِمَتَيْنِ تَبْدَأُ بِصَوْتِ الكَافِ المَهْمُوس (كَـ)؟',
      targetWord: 'كَلْبٌ',
      targetAudio: 'كَلْبٌ',
      targetPhoneticTag: 'كافٌ مَهْمُوسَة',
      distractorWord: 'قَلْبٌ',
      distractorAudio: 'قَلْبٌ',
      distractorPhoneticTag: 'قافٌ لَهَوِيَّة',
      mirrorTip: {
        target: 'الكاف: تخرج من أدنى اللسان باتجاه الأمام بهواء خفيف مهموس.',
        distractor: 'القاف: تخرج من أقصى اللسان مع الحنك الرخو عند اللهاة.',
      },
      feedbackSuccess: 'ذَكِيٌّ جِدّاً! «كَلْبٌ» تَبْدَأُ بِالكَافِ المَهْمُوسَة الخَفِيفَة.',
      feedbackRetry: '«قَلْبٌ» تَبْدَأُ بِالقَافِ اللَّهَوِيَّة، وَالمَطْلُوبُ الكَافُ المَهْمُوسَة!',
    },
    {
      id: 7,
      targetSoundLabel: 'حَرْفُ الحَاءِ الحَلْقِيّ',
      targetSoundSymbol: '« ح »',
      targetSoundAudio: 'صَوْتُ حَرْفِ الحَاء: حَ',
      contrastSoundLabel: 'حَرْفُ الهَاءِ الهَوَائِيّ',
      contrastSoundSymbol: '« هـ »',
      questionText: 'أيُّ الكَلِمَتَيْنِ تَبْدَأُ بِصَوْتِ الحَاءِ الحَلْقِيّ (حَـ)؟',
      targetWord: 'حَمَلَ',
      targetAudio: 'حَمَلَ',
      targetPhoneticTag: 'حاءٌ حَلْقِيَّة',
      distractorWord: 'هَمَلَ',
      distractorAudio: 'هَمَلَ',
      distractorPhoneticTag: 'هاءٌ هَوَائِيَّة',
      mirrorTip: {
        target: 'الحاء: تخرج من وسط الحلق بنقاء وصفاء واضح.',
        distractor: 'الهاء: تخرج من أقصى الحلق مع اندفاع هوائي ناعم.',
      },
      feedbackSuccess: 'إِجَابَةٌ رَائِعَة! «حَمَلَ» تَبْدَأُ بِالحَاءِ الحَلْقِيَّة الصَّافِيَة.',
      feedbackRetry: '«هَمَلَ» تَبْدَأُ بِالهَاءِ، وَالمَطْلُوبُ الحَاءُ الحَلْقِيَّة الصَّافِيَة!',
    },
    {
      id: 8,
      targetSoundLabel: 'حَرْفُ الذَّالِ المُرَقَّق',
      targetSoundSymbol: '« ذ »',
      targetSoundAudio: 'صَوْتُ حَرْفِ الذَّال: ذَ',
      contrastSoundLabel: 'حَرْفُ الظَّاءِ المُفَخَّم',
      contrastSoundSymbol: '« ظ »',
      questionText: 'أيُّ الكَلِمَتَيْنِ تَبْدَأُ بِصَوْتِ الذَّالِ المُرَقَّق (ذَ)؟',
      targetWord: 'ذَلَّ',
      targetAudio: 'ذَلَّ',
      targetPhoneticTag: 'ذالٌ مُرَقَّقَة',
      distractorWord: 'ظَلَّ',
      distractorAudio: 'ظَلَّ',
      distractorPhoneticTag: 'ظاءٌ مُفَخَّمَة',
      mirrorTip: {
        target: 'الذال: يخرج طرف اللسان قليلاً بين الأسنان برقة واستفال.',
        distractor: 'الظاء: يخرج طرف اللسان مع استعلاء أقصى اللسان وتفخيمه.',
      },
      feedbackSuccess: 'عَبْقَرِيّ! «ذَلَّ» تَبْدَأُ بِالذَّالِ المُرَقَّقَة الرَّقِيقَة.',
      feedbackRetry: '«ظَلَّ» تَبْدَأُ بِالظَّاءِ المُفَخَّمَة، وَالمَطْلُوبُ الذَّالُ المُرَقَّقَة!',
    },
  ];

  const currentExercise = warmupPairs[warmupIdx];

  // Alternating display positions so the target word isn't always on the same side
  const isTargetFirst = warmupIdx % 2 === 0;
  const optionA = isTargetFirst
    ? { word: currentExercise.targetWord, audio: currentExercise.targetAudio, tag: currentExercise.targetPhoneticTag, isTarget: true }
    : { word: currentExercise.distractorWord, audio: currentExercise.distractorAudio, tag: currentExercise.distractorPhoneticTag, isTarget: false };

  const optionB = isTargetFirst
    ? { word: currentExercise.distractorWord, audio: currentExercise.distractorAudio, tag: currentExercise.distractorPhoneticTag, isTarget: false }
    : { word: currentExercise.targetWord, audio: currentExercise.targetAudio, tag: currentExercise.targetPhoneticTag, isTarget: true };

  // Step 2: Decodable reading
  const currentStory: DecodableStory = CURATED_DECODABLE_STORIES[0];
  const [highlightWordIdx, setHighlightWordIdx] = useState<number>(0);
  const storyWords = currentStory.story.split(/\s+/).filter(Boolean);

  // Step 3: Comprehension question
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // 5-minute countdown timer
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      triggerCelebration('انتهى وقت السبرنت اليومي بنجاح! أحسنت الالتزام (+50 نقطة)', 50);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleWarmupSelect = (word: string, isCorrect: boolean) => {
    setSelectedWord(word);
    speakText(word);

    if (isCorrect) {
      setFeedbackMsg({ text: currentExercise.feedbackSuccess, isError: false });
      speakText(currentExercise.feedbackSuccess);
      triggerCelebration('صوت سليم ومطابق! (+15 نقطة)', 15);

      setTimeout(() => {
        if (warmupIdx < warmupPairs.length - 1) {
          setWarmupIdx((prev) => prev + 1);
          setSelectedWord(null);
          setFeedbackMsg(null);
        } else {
          setSprintStep(2);
          triggerCelebration('رائع! اكتمل إحماء الدقيقة الأولى بنجاح. الآن وقت قراءة القصة (+20 نقطة)', 20);
        }
      }, 1400);
    } else {
      setFeedbackMsg({ text: currentExercise.feedbackRetry, isError: true });
      speakText(currentExercise.feedbackRetry);
    }
  };

  const handleAdvanceStoryWord = () => {
    if (highlightWordIdx < storyWords.length - 1) {
      const nextIdx = highlightWordIdx + 1;
      setHighlightWordIdx(nextIdx);
      speakText(storyWords[nextIdx]);
    } else {
      setSprintStep(3);
      triggerCelebration('أتممت قراءة القصة بطلاقة ممتازة! بقي تلميح المخرج والسؤال النهائي (+25 نقطة)', 25);
    }
  };

  const handleFinishSprint = () => {
    if (
      isCompletedToday ||
      sprintStep !== 3 ||
      selectedAnswer !== currentStory.questions[0]?.answerIndex
    ) return;

    const today = localDateKey();
    const yesterday = previousLocalDateKey();
    const previous = readStoredDailySprint(activeStudent.id);
    const nextStreak = previous?.lastCompletedDate === yesterday ? previous.streakDays + 1 : 1;

    try {
      if (typeof window === 'undefined') throw new Error('Browser storage unavailable');
      window.localStorage.setItem(
        `baseera_daily_sprint_v1:${activeStudent.id}`,
        JSON.stringify({ streakDays: nextStreak, lastCompletedDate: today } satisfies DailySprintProgressRecord)
      );
      setStreakDays(nextStreak);
      setIsCompletedToday(true);
      triggerCelebration(`أحسنت يا بطل! اكتملت جلسة اليوم وسُجّلت على هذا الجهاز. سلسلة الالتزام: ${nextStreak} يومًا (+50 نقطة)`, 50);
    } catch {
      setStreakDays(0);
      setIsCompletedToday(true);
      triggerCelebration('اكتملت الجلسة، لكن تعذّر حفظ سلسلة الأيام في هذا المتصفح.', 0);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/90 text-right space-y-6">
      {/* Sprint Header & Streak Ribbon */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 font-serif">
                تحدي الدقائق الخمس اليومي
              </h2>
            </div>
            <p className="text-xs text-amber-800 font-bold mt-0.5">
              ٥ دقائق من التحدي والطلاقة لجمع النجوم وكسب شارة البطل!
            </p>
          </div>
        </div>

        {/* Timer & Streak Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl font-bold text-amber-900 text-xs shadow-xs">
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>سلسلة الالتزام: <strong className="font-mono text-sm">{streakDays}</strong> أيام متتالية</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-1.5 rounded-xl font-mono text-sm font-bold shadow-xs">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>{formatTimer(timerSeconds)}</span>
            <button
              type="button"
              onClick={() => setIsTimerRunning((prev) => !prev)}
              className="text-[11px] font-sans px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white ml-1 cursor-pointer"
            >
              {isTimerRunning ? 'إيقاف' : 'بدء'}
            </button>
          </div>
        </div>
      </div>

      {/* Progress Step Bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { num: 1, title: 'الدقيقة ١: إحماء التمييز السمعي للأصوات', active: sprintStep === 1, done: sprintStep > 1 },
          { num: 2, title: 'الدقائق ٢-٤: قراءة القصة الموجهة', active: sprintStep === 2, done: sprintStep > 2 },
          { num: 3, title: 'الدقيقة ٥: مخرج الحرف والفهم', active: sprintStep === 3, done: isCompletedToday },
        ].map((st) => (
          <div
            key={st.num}
            className={`p-3 rounded-2xl border transition-all text-center ${
              st.active
                ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs'
                : st.done
                ? 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                : 'bg-white border-slate-100 text-slate-400'
            }`}
          >
            <div className="text-[11px] font-bold">{st.title}</div>
          </div>
        ))}
      </div>

      {/* STEP 1: WARMUP AUDITORY PHONEMIC DISCRIMINATION (1 MINUTE) */}
      {sprintStep === 1 && (
        <div className="max-w-2xl mx-auto space-y-6 text-center py-4">
          {/* Target Phoneme Master Card */}
          <div className="p-5 rounded-3xl bg-gradient-to-b from-emerald-50 to-teal-50/50 border-2 border-emerald-300 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black text-emerald-800 bg-white px-3.5 py-1.5 rounded-xl border border-emerald-200 shadow-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>الهدف: تمييز {currentExercise.targetSoundLabel}</span>
              </span>

              <span className="text-xs font-bold text-slate-600 bg-white/80 px-3 py-1 rounded-xl border border-slate-200">
                تمرين {warmupIdx + 1} من {warmupPairs.length}
              </span>
            </div>

            {/* Target Phoneme Listen Button */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => speakText(currentExercise.targetSoundAudio)}
                className="clay-btn-emerald px-6 py-2.5 rounded-2xl text-white font-extrabold text-sm flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
              >
                <Volume2 className="w-4 h-4" />
                <span>اسْتَمِعْ لِصَوْتِ الحَرْف: {currentExercise.targetSoundSymbol}</span>
              </button>

              <div className="text-xs font-bold text-teal-900 bg-teal-100/70 px-3 py-1.5 rounded-xl border border-teal-200">
                مُقَابِل: {currentExercise.contrastSoundLabel} {currentExercise.contrastSoundSymbol}
              </div>
            </div>
          </div>

          {/* Direct, Unambiguous Pedagogical Instruction */}
          <div className="space-y-1">
            <h3 className="text-xl md:text-2xl font-black text-slate-900 font-serif">
              {currentExercise.questionText}
            </h3>
            <p className="text-xs text-slate-500 font-bold">
              استمع لنطق الكلمتين باهتمام، ثم انقر على الكلمة التي تبدأ بالصوت المستهدف
            </p>
          </div>

          {/* 3D Interactive Word Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            {/* Card A */}
            <div
              className={`p-5 rounded-3xl border-2 transition-all flex flex-col items-center justify-between gap-4 shadow-sm ${
                selectedWord === optionA.word
                  ? optionA.isTarget
                    ? 'border-emerald-500 bg-emerald-50/80 ring-4 ring-emerald-500/20'
                    : 'border-rose-400 bg-rose-50/70'
                  : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md'
              }`}
            >
              <div className="text-3xl md:text-4xl font-black font-serif text-slate-900 tracking-wide pt-2">
                {optionA.word}
              </div>

              {/* Dedicated Word Audio Listen Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  speakText(optionA.audio);
                }}
                className="text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 px-3.5 py-1.5 rounded-xl border border-teal-200 flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
              >
                <Volume2 className="w-3.5 h-3.5 text-teal-600" />
                <span>اسْتَمِعْ لِلْكَلِمَة</span>
              </button>

              {/* Selection Button */}
              <button
                type="button"
                onClick={() => handleWarmupSelect(optionA.word, optionA.isTarget)}
                className={`w-full py-3 rounded-2xl font-black text-sm transition-all cursor-pointer shadow-xs active:scale-95 ${
                  selectedWord === optionA.word && optionA.isTarget
                    ? 'bg-emerald-600 text-white'
                    : 'clay-btn-sky text-white'
                }`}
              >
                {selectedWord === optionA.word && optionA.isTarget ? 'إجابة صحيحة ✓' : 'اخْتَرْ هَذِهِ الكَلِمَة'}
              </button>
            </div>

            {/* Card B */}
            <div
              className={`p-5 rounded-3xl border-2 transition-all flex flex-col items-center justify-between gap-4 shadow-sm ${
                selectedWord === optionB.word
                  ? optionB.isTarget
                    ? 'border-emerald-500 bg-emerald-50/80 ring-4 ring-emerald-500/20'
                    : 'border-rose-400 bg-rose-50/70'
                  : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md'
              }`}
            >
              <div className="text-3xl md:text-4xl font-black font-serif text-slate-900 tracking-wide pt-2">
                {optionB.word}
              </div>

              {/* Dedicated Word Audio Listen Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  speakText(optionB.audio);
                }}
                className="text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 px-3.5 py-1.5 rounded-xl border border-teal-200 flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
              >
                <Volume2 className="w-3.5 h-3.5 text-teal-600" />
                <span>اسْتَمِعْ لِلْكَلِمَة</span>
              </button>

              {/* Selection Button */}
              <button
                type="button"
                onClick={() => handleWarmupSelect(optionB.word, optionB.isTarget)}
                className={`w-full py-3 rounded-2xl font-black text-sm transition-all cursor-pointer shadow-xs active:scale-95 ${
                  selectedWord === optionB.word && optionB.isTarget
                    ? 'bg-emerald-600 text-white'
                    : 'clay-btn-sky text-white'
                }`}
              >
                {selectedWord === optionB.word && optionB.isTarget ? 'إجابة صحيحة ✓' : 'اخْتَرْ هَذِهِ الكَلِمَة'}
              </button>
            </div>
          </div>

          {/* Feedback Message Banner */}
          {feedbackMsg && (
            <div
              className={`p-4 rounded-2xl border text-sm font-bold max-w-lg mx-auto transition-all animate-fadeIn ${
                feedbackMsg.isError
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {feedbackMsg.isError ? (
                  <HelpCircle className="w-5 h-5 text-rose-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                <span>{feedbackMsg.text}</span>
              </div>
            </div>
          )}

          {/* Visual Articulation Mirror Guide (مرآة النطق البصرية) */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-right max-w-lg mx-auto space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900">
              <Eye className="w-4 h-4 text-amber-700" />
              <span>مرآة النطق ومخرج الحرفين:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] leading-relaxed text-amber-950 font-medium">
              <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/80">
                <span className="font-bold text-amber-800 block mb-0.5">الصوت المستهدف:</span>
                {currentExercise.mirrorTip.target}
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/80">
                <span className="font-bold text-slate-700 block mb-0.5">الصوت المقابل:</span>
                {currentExercise.mirrorTip.distractor}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: GUIDED DECODABLE READING (3 MINUTES) */}
      {sprintStep === 2 && (
        <div className="max-w-2xl mx-auto space-y-6 text-center py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              قراءة موجهة مشكولة 100%: «{currentStory.title}»
            </span>
            <button
              type="button"
              onClick={() => speakText(currentStory.story)}
              className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-teal-200 shadow-xs cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span>استمع للقصة كاملة بصوت طبيعي</span>
            </button>
          </div>

          {/* Interactive Decodable Story Box */}
          <div className="p-8 rounded-3xl bg-slate-900 text-white shadow-lg border border-slate-800 leading-loose">
            <div className="flex flex-wrap items-center justify-center gap-2.5 text-2xl md:text-3xl font-serif font-black">
              {storyWords.map((word, wIdx) => {
                const isCurrent = wIdx === highlightWordIdx;
                const isPassed = wIdx < highlightWordIdx;
                return (
                  <span
                    key={wIdx}
                    onClick={() => {
                      setHighlightWordIdx(wIdx);
                      speakText(word);
                    }}
                    className={`px-2 py-1 rounded-xl transition-all cursor-pointer select-none ${
                      isCurrent
                        ? 'bg-amber-400 text-slate-950 scale-110 shadow-md ring-4 ring-amber-400/30'
                        : isPassed
                        ? 'text-emerald-400'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleAdvanceStoryWord}
              className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-sm rounded-2xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <span>نطقت الكلمة بنجاح، التالية!</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            انقر على أي كلمة للاستماع لنطقها الفصيح الطبيعي، أو تقدم كلمة بكلمة
          </p>
        </div>
      )}

      {/* STEP 3: ARTICULATORY CUE & COMPREHENSION (1 MINUTE) */}
      {sprintStep === 3 && (
        <div className="max-w-xl mx-auto space-y-6 py-2">
          {/* Mouth Articulatory Tip Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm mb-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>تلميح مخرج الحرف البصري: {currentStory.articulatoryTip.sound}</span>
            </div>
            <p className="text-xs text-amber-950 leading-relaxed">
              {currentStory.articulatoryTip.description}
            </p>
          </div>

          {/* Quick Comprehension Check */}
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">
              سؤال الفهم السريع: {currentStory.questions[0].question}
            </h4>
            <div className="space-y-2">
              {currentStory.questions[0].options.map((opt, oIdx) => {
                const isSelected = selectedAnswer === oIdx;
                const isCorrect = oIdx === currentStory.questions[0].answerIndex;
                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => {
                      setSelectedAnswer(oIdx);
                      if (isCorrect) {
                        triggerCelebration('إجابة صحيحة وفهم دقيق! (+25 نقطة)', 25);
                      }
                    }}
                    className={`w-full p-3.5 rounded-xl text-xs font-bold text-right border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? isCorrect
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                          : 'bg-rose-100 border-rose-300 text-rose-950'
                        : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <span>{opt}</span>
                    {isSelected && (isCorrect ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-rose-600" />)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Finish Button */}
          {!isCompletedToday ? (
            <button
              type="button"
              onClick={handleFinishSprint}
              disabled={selectedAnswer !== currentStory.questions[0]?.answerIndex}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trophy className="w-5 h-5 text-amber-300 fill-current" />
              <span>إتمام سبرنت اليوم وتسجيله على هذا الجهاز (+50 XP)</span>
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-emerald-900 font-black text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>رائع! اكتمل سبرنت اليوم بنجاح مبهر</span>
              </div>
              <p className="text-xs text-emerald-700">
                حافظت على وتيرة التدريب اليومية. موعدنا غداً في 5 دقائق جديدة!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
