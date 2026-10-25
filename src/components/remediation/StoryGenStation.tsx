import React, { useState } from 'react';
import {
  Sparkles,
  Volume2,
  Trophy,
  Check,
  Star,
  ArrowLeft,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { StudentRecord } from '../../data/seedData';
import {
  DecodableStory,
  CURATED_DECODABLE_STORIES,
  generateDecodableStory,
} from '../../utils/adaptiveStoryGen';

interface StoryGenStationProps {
  activeStudent: StudentRecord;
  speakText: (text: string) => void;
  triggerCelebration: (msg: string, earnedXp?: number) => void;
}

export const StoryGenStation: React.FC<StoryGenStationProps> = ({
  activeStudent,
  speakText,
  triggerCelebration,
}) => {
  // Wizard steps: 'interest' -> 'phoneme' -> 'generating' -> 'story' -> 'quiz' -> 'celebrate'
  const [wizardStep, setWizardStep] = useState<'interest' | 'phoneme' | 'generating' | 'story' | 'quiz' | 'celebrate'>('interest');
  const [selectedInterest, setSelectedInterest] = useState<string>('space');
  const [selectedPhoneme, setSelectedPhoneme] = useState<string>('س / ص');
  const [story, setStory] = useState<DecodableStory>(CURATED_DECODABLE_STORIES[0]);
  const [revealedWord, setRevealedWord] = useState<string | null>(null);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);

  const interestCards = [
    { id: 'space', title: 'مغامرة الفضاء 🚀', desc: 'كواكب ونجوم ومراكب فضائية', gradient: 'from-indigo-600 via-purple-600 to-pink-500' },
    { id: 'animals', title: 'عالم الحيوانات 🦁', desc: 'أصدقاء الغابة والصقر السريع', gradient: 'from-emerald-500 via-teal-600 to-cyan-600' },
    { id: 'sports', title: 'أبطال الكرة ⚽', desc: 'مباريات حماسية وأهداف رائعة', gradient: 'from-amber-500 via-orange-500 to-rose-500' },
    { id: 'adventure', title: 'أسرار الغابة 🌿', desc: 'رحلة استكشاف بين الأشجار والأنهار', gradient: 'from-green-600 via-emerald-700 to-teal-800' },
  ];

  const soundChallenges = [
    { id: 'sin_sad', sound: 'س / ص', label: 'تحدي السين والصاد', example: 'سَيْف ⚔️ مقابل صَيْف ☀️', color: 'border-blue-400 bg-blue-50/70 hover:bg-blue-100 text-blue-950' },
    { id: 'dal_dad', sound: 'د / ض', label: 'تحدي الدال والضاد', example: 'دَلَّ 🧭 مقابل ضَلَّ 🌲', color: 'border-emerald-400 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-950' },
    { id: 'ta_ta2', sound: 'ت / ط', label: 'تحدي التاء والطاء', example: 'تِين 🍇 مقابل طِين 🧱', color: 'border-amber-400 bg-amber-50/70 hover:bg-amber-100 text-amber-950' },
    { id: 'sukun', sound: 'السكون', label: 'تحدي المقطع الساكن', example: 'بَدْـ · رٌ 🌙', color: 'border-purple-400 bg-purple-50/70 hover:bg-purple-100 text-purple-950' },
  ];

  const handleChooseInterest = (interestId: string) => {
    setSelectedInterest(interestId);
    speakText('اختيار رائع! الآن اختر صوت التحدي اليومي');
    setWizardStep('phoneme');
  };

  const handleChoosePhoneme = async (phonemeSound: string) => {
    setSelectedPhoneme(phonemeSound);
    setWizardStep('generating');
    speakText('جاري كتابة قصة جميلة مشكولة خصيصاً لك يا بطل');

    try {
      const generated = await generateDecodableStory({
        interest: selectedInterest,
        targetPhoneme: phonemeSound,
        gradeLevel: activeStudent.gradeLevel,
        studentName: activeStudent.name,
      });
      setStory(generated);
      setTimeout(() => {
        setWizardStep('story');
        speakText(`قصتنا اليوم عنوانها: ${generated.title}`);
      }, 900);
    } catch {
      setStory(CURATED_DECODABLE_STORIES[0]);
      setWizardStep('story');
    }
  };

  const handleWordTap = (word: string) => {
    setRevealedWord(word);
    speakText(word);
  };

  const handleAnswerQuiz = (optionIdx: number) => {
    setSelectedQuizAnswer(optionIdx);
    const isCorrect = optionIdx === story.questions[0]?.answerIndex;
    if (isCorrect) {
      triggerCelebration(`أحسنت يا ${activeStudent.name}! إجابة بطل خارق (+50 نقطة)`, 50);
      speakText('ممتاز! إجابة صحيحة وفهم رائع للقصة!');
      setTimeout(() => {
        setWizardStep('celebrate');
      }, 1200);
    } else {
      speakText('حاول مرة أخرى يا بطل، فكر في أحداث القصة');
    }
  };

  const storyWords = story.story.split(/\s+/).filter(Boolean);

  return (
    <div className="max-w-2xl mx-auto py-2 px-2" dir="rtl">
      {/* STEP 1: CHOOSE INTEREST (Pure Visual Cards) */}
      {wizardStep === 'interest' && (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-lg border-2 border-slate-100 text-center space-y-6 animate-fade-slide-up">
          <div className="space-y-2">
            <span className="text-3xl">✨ 📖 ✨</span>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 font-serif">
              عن ماذا تحب أن نقرأ اليوم يا {activeStudent.name}؟
            </h2>
            <p className="text-sm font-bold text-slate-500">
              اختر مغامرتك المفضلة بنقرة واحدة:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {interestCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => handleChooseInterest(card.id)}
                className={`p-6 rounded-3xl bg-gradient-to-br ${card.gradient} text-white shadow-md hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer text-right space-y-2 select-none`}
              >
                <div className="text-2xl font-black">{card.title}</div>
                <div className="text-xs text-white/90 font-medium">{card.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: CHOOSE SOUND CHALLENGE */}
      {wizardStep === 'phoneme' && (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-lg border-2 border-slate-100 text-center space-y-6 animate-fade-slide-up">
          <div className="space-y-2">
            <span className="text-3xl">🎯 🔤 🎯</span>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 font-serif">
              ما هو الصوت الذي سنتحداه في القصة؟
            </h2>
            <p className="text-sm font-bold text-slate-500">
              اختر التحدي لتبدأ المعلمة بكتابة القصة فوراً:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            {soundChallenges.map((challenge) => (
              <button
                key={challenge.id}
                type="button"
                onClick={() => handleChoosePhoneme(challenge.sound)}
                className={`p-5 rounded-2xl border-2 ${challenge.color} shadow-xs hover:shadow-md hover:scale-103 active:scale-95 transition-all cursor-pointer text-right space-y-1`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black font-serif">{challenge.sound}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 border border-slate-200">تحدي اليوم</span>
                </div>
                <div className="text-xs font-bold">{challenge.label}</div>
                <div className="text-[11px] text-slate-600 font-mono">{challenge.example}</div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setWizardStep('interest')}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 mx-auto cursor-pointer"
          >
            <span>← العودة لاختيار المغامرة</span>
          </button>
        </div>
      )}

      {/* STEP: GENERATING WITH PLAYFUL ANIMATION */}
      {wizardStep === 'generating' && (
        <div className="bg-white rounded-3xl p-12 shadow-lg border-2 border-emerald-100 text-center space-y-4 animate-fade-slide-up">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl animate-bounce">
            🪄
          </div>
          <h3 className="text-xl font-black text-slate-900 font-serif">
            المعلمة زارية تكتب قصتك المشكولة الآن...
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            تجهيز الحركات، التنوين، والمغامرة الخاصة بك يا بطل!
          </p>
        </div>
      )}

      {/* STEP 3: READ THE STORYBOOK (Joyful, Big Diacritized Text) */}
      {wizardStep === 'story' && (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border-2 border-amber-200 space-y-6 animate-fade-slide-up text-right">
          {/* Story Title & Audio Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-50/80 p-4 rounded-2xl border border-amber-200">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-amber-950 font-serif">
                «{story.title}»
              </h2>
              <span className="text-xs font-bold text-amber-800">
                الصوت المتحدى في القصة: <strong className="text-emerald-700 font-black text-sm">{story.targetPhoneme}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => speakText(story.story)}
              className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Volume2 className="w-5 h-5 animate-pulse" />
              <span>🔊 استمع للقصة كاملة</span>
            </button>
          </div>

          {/* Story Parchment Box with Ultra-Readable Arabic Font */}
          <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-b from-[#FFFDF7] to-[#FAF6EE] border-2 border-[#EADFC7] shadow-inner text-center leading-loose">
            <div className="flex flex-wrap items-center justify-center gap-2.5 text-2xl sm:text-3xl md:text-4xl font-serif font-black text-slate-900">
              {storyWords.map((word, wIdx) => {
                const isTarget = story.targetWords.some((tw) => word.includes(tw) || tw.includes(word));
                const isTapped = revealedWord === word;
                return (
                  <span
                    key={wIdx}
                    onClick={() => handleWordTap(word)}
                    className={`px-2 py-1 rounded-xl transition-all cursor-pointer select-none ${
                      isTapped
                        ? 'bg-amber-400 text-slate-950 scale-110 shadow-md ring-4 ring-amber-300'
                        : isTarget
                        ? 'text-emerald-800 bg-emerald-100/70 border border-emerald-300 hover:bg-emerald-200'
                        : 'hover:text-emerald-700'
                    }`}
                    title="المس الكلمة لسماع نطقها"
                  >
                    {word}
                  </span>
                );
              })}
            </div>
            <p className="text-xs text-amber-800/80 font-bold mt-4">
              👆 المس أي كلمة باللون الأخضر للاستماع لنطقها السليم!
            </p>
          </div>

          {/* Friendly Tip from Teacher */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 text-xl font-bold">
              👩‍🏫
            </div>
            <p className="text-xs text-emerald-950 font-bold leading-relaxed">
              {story.articulatoryTip.description}
            </p>
          </div>

          {/* Action: Next to Challenge */}
          <button
            type="button"
            onClick={() => {
              setWizardStep('quiz');
              speakText('والآن وقت سؤال التحدي يا بطل!');
            }}
            className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trophy className="w-5 h-5" />
            <span>أنا جاهز لتحدي الأبطال! (+50 XP)</span>
          </button>
        </div>
      )}

      {/* STEP 4: SINGLE FUN QUESTION (No Walls of Text!) */}
      {wizardStep === 'quiz' && (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border-2 border-indigo-200 text-center space-y-6 animate-fade-slide-up">
          <div className="space-y-1">
            <span className="text-3xl">❓ 🧠 ❓</span>
            <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
              سؤال الذكاء السريع
            </span>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 font-serif pt-2">
              {story.questions[0]?.question || 'ماذا حدث في القصة؟'}
            </h3>
          </div>

          <div className="space-y-3 max-w-md mx-auto pt-2">
            {(story.questions[0]?.options || ['نعم', 'لا']).map((opt, oIdx) => {
              const isSelected = selectedQuizAnswer === oIdx;
              const isCorrect = oIdx === story.questions[0]?.answerIndex;
              return (
                <button
                  key={oIdx}
                  type="button"
                  onClick={() => handleAnswerQuiz(oIdx)}
                  className={`w-full p-4 rounded-2xl text-base font-extrabold border-2 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-between ${
                    isSelected
                      ? isCorrect
                        ? 'bg-emerald-500 text-white border-emerald-600 scale-103'
                        : 'bg-rose-100 text-rose-950 border-rose-400'
                      : 'bg-white hover:bg-indigo-50 text-slate-800 border-indigo-200'
                  }`}
                >
                  <span>{opt}</span>
                  {isSelected && (isCorrect ? <Check className="w-6 h-6 stroke-[3]" /> : <span>❌</span>)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setWizardStep('story')}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            ← قراءة القصة مجدداً
          </button>
        </div>
      )}

      {/* STEP 5: CELEBRATION & TROPHY */}
      {wizardStep === 'celebrate' && (
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl border-4 border-amber-300 text-center space-y-6 animate-fade-slide-up">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-5xl shadow-xl shadow-amber-300/50 animate-bounce">
            🏆
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-900 font-serif">
              مبـــارك يا بطل الأبطال {activeStudent.name}!
            </h2>
            <p className="text-base font-bold text-emerald-700">
              أتممت قراءة القصة وفهمت تفاصيلها بنجاح باهر!
            </p>
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-300 px-4 py-2 rounded-2xl font-mono text-lg font-black text-amber-900 mt-2">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
              <span>+50 XP أضيفت لرصيدك!</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setSelectedQuizAnswer(null);
                setWizardStep('interest');
              }}
              className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>مغامرة وقصة جديدة</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
