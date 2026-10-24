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
} from 'lucide-react';
import { StudentRecord } from '../../data/seedData';
import { CURATED_DECODABLE_STORIES, DecodableStory } from '../../utils/adaptiveStoryGen';

interface DailySprintStationProps {
  activeStudent: StudentRecord;
  speakText: (text: string) => void;
  triggerCelebration: (msg: string, earnedXp?: number) => void;
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
  const [streakDays, setStreakDays] = useState<number>(4);
  const [isCompletedToday, setIsCompletedToday] = useState<boolean>(false);

  // Step 1: Warmup discrimination state
  const [warmupIdx, setWarmupIdx] = useState<number>(0);
  const [warmupSelected, setWarmupSelected] = useState<string | null>(null);

  const warmupPairs = [
    { targetWord: 'سَيْف', distractor: 'صَيْف', sound: 'سَـ', meaning: 'سلاح قاطع مرقق' },
    { targetWord: 'صَابُون', distractor: 'سَابُون', sound: 'صَـ', meaning: 'مادة تنظيف مفخمة' },
    { targetWord: 'دَلَّ', distractor: 'ضَلَّ', sound: 'دَ', meaning: 'أرشد بترقيق' },
    { targetWord: 'ضَوْء', distractor: 'دَوْء', sound: 'ضَـ', meaning: 'نور باستطالة' },
  ];

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
      triggerCelebration('⏰ انتهى وقت السبرنت اليومي بنجاح! أحسنت الالتزام (+50 نقطة)', 50);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleWarmupSelect = (word: string, isCorrect: boolean) => {
    setWarmupSelected(word);
    speakText(word);
    if (isCorrect) {
      triggerCelebration('صوت سليم ومطابق! (+15 نقطة)', 15);
      setTimeout(() => {
        if (warmupIdx < warmupPairs.length - 1) {
          setWarmupIdx((prev) => prev + 1);
          setWarmupSelected(null);
        } else {
          setSprintStep(2);
          triggerCelebration('رائع! اكتمل إحماء الدقيقة الأولى. الآن وقت قراءة القصة (+20 نقطة)', 20);
        }
      }, 800);
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
    setIsCompletedToday(true);
    setStreakDays((prev) => prev + 1);
    triggerCelebration(`مبارك يا ${activeStudent.name}! أتممت تحدي اليوم وحافظت على سلسلة ${streakDays + 1} أيام متتالية (+50 نقطة)`, 50);
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
              <h2 className="text-xl md:text-2xl font-black text-slate-900">
                سبرنت التدريب الخاطف (5 دقائق يومياً)
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                مبني على نموذج VTO العالمي
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              ممارسة شفوية مركزة يومياً لإرساء التلقائية ومنع الانتكاس القرائي دون إجهاد.
            </p>
          </div>
        </div>

        {/* Timer & Streak Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl font-bold text-amber-900 text-xs shadow-xs">
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>سلسلة الالتزام: <strong className="font-mono text-sm">{streakDays}</strong> أيام متتالية 🔥</span>
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
          { num: 1, title: 'الدقيقة ١: إحماء الفونيمات', active: sprintStep === 1, done: sprintStep > 1 },
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

      {/* STEP 1: WARMUP PHONEMES (1 MINUTE) */}
      {sprintStep === 1 && (
        <div className="max-w-xl mx-auto space-y-6 text-center py-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>تمييز الصوت المستهدف: {warmupPairs[warmupIdx].sound}</span>
          </div>

          <h3 className="text-xl font-black text-slate-900">
            أي الكلمتين تحتوي على الصوت الصحيح؟
          </h3>
          <p className="text-xs text-slate-500">{warmupPairs[warmupIdx].meaning}</p>

          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => handleWarmupSelect(warmupPairs[warmupIdx].targetWord, true)}
              className="p-6 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 hover:bg-emerald-100 hover:border-emerald-500 text-2xl font-black font-serif text-slate-900 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              {warmupPairs[warmupIdx].targetWord}
            </button>

            <button
              type="button"
              onClick={() => handleWarmupSelect(warmupPairs[warmupIdx].distractor, false)}
              className="p-6 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-rose-300 text-2xl font-black font-serif text-slate-900 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              {warmupPairs[warmupIdx].distractor}
            </button>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            تمرين {warmupIdx + 1} من {warmupPairs.length} · استمع للمخرج الصوتي الفصيح فور النقر
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
                    {isSelected && (isCorrect ? <Check className="w-4 h-4 text-emerald-600" /> : <span className="text-rose-600">✕</span>)}
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
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <Trophy className="w-5 h-5 text-amber-300 fill-current" />
              <span>إتمام سبرنت اليوم وحفظ السلسلة (+50 XP)</span>
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
