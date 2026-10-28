import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Check,
  X,
  ArrowLeft,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { StudentRecord } from '../../data/seedData';
import {
  DecodableStory,
  CURATED_DECODABLE_STORIES,
  generateDecodableStory,
} from '../../utils/adaptiveStoryGen';
import {
  IconStar,
  IconTrophy,
  IconStoryBook,
  IconLettersBlock,
  IconPuzzlePieces,
  IconSpaceRocket,
  IconForestAnimals,
  IconSportsBall,
  IconAdventureCompass,
  IconMagicWand,
  IconBaseeraFalcon,
} from '../ui/ChildPlayfulIcons';

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
  const [, setSelectedPhoneme] = useState<string>('س / ص');
  const [story, setStory] = useState<DecodableStory>(CURATED_DECODABLE_STORIES[0]);
  const [revealedWord, setRevealedWord] = useState<string | null>(null);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);

  const stepContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll directly to active step container, never to the global header or footer
  useEffect(() => {
    stepContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [wizardStep]);

  const interestCards = [
    {
      id: 'space',
      title: 'مغامرة الفضاء',
      desc: 'كواكب ونجوم ومراكب فضائية شيقة',
      icon: IconSpaceRocket,
      bg: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400 text-indigo-950',
    },
    {
      id: 'animals',
      title: 'عالم الحيوانات',
      desc: 'أصدقاء الغابة وصقر بصيرة السريع',
      icon: IconForestAnimals,
      bg: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-950',
    },
    {
      id: 'sports',
      title: 'أبطال الرياضة',
      desc: 'مباريات حماسية وأهداف رائعة',
      icon: IconSportsBall,
      bg: 'bg-amber-50 border-amber-200 hover:border-amber-400 text-amber-950',
    },
    {
      id: 'adventure',
      title: 'أسرار الغابة',
      desc: 'رحلة استكشاف بين الأشجار والأنهار',
      icon: IconAdventureCompass,
      bg: 'bg-teal-50 border-teal-200 hover:border-teal-400 text-teal-950',
    },
  ];

  const soundChallenges = [
    {
      id: 'ta_ta2',
      sound: 'ت / ط',
      label: 'تحدي التاء والطاء',
      exampleWord1: 'تِين',
      exampleWord2: 'طِين',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    },
    {
      id: 'sin_sad',
      sound: 'س / ص',
      label: 'تحدي السين والصاد',
      exampleWord1: 'سَيْف',
      exampleWord2: 'صَيْف',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    },
    {
      id: 'dal_dad',
      sound: 'د / ض',
      label: 'تحدي الدال والضاد',
      exampleWord1: 'دَلَّ',
      exampleWord2: 'ضَلَّ',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    {
      id: 'sukun',
      sound: 'السكون',
      label: 'تحدي المقطع الساكن',
      exampleWord1: 'بَدْـ',
      exampleWord2: 'رٌ',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    },
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
      });
      setStory(generated);
      setTimeout(() => {
        setWizardStep('story');
        speakText(`قصتنا اليوم عنوانها: ${generated.title}`);
      }, 700);
    } catch {
      // Fallback: match EXACT phoneme
      const fallback = CURATED_DECODABLE_STORIES.find((s) => s.targetPhoneme === phonemeSound) || CURATED_DECODABLE_STORIES[0];
      setStory(fallback);
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
      }, 1000);
    } else {
      speakText('حاول مرة أخرى يا بطل، فكر في أحداث القصة');
    }
  };

  const storyWords = story.story.split(/\s+/).filter(Boolean);

  return (
    <div ref={stepContainerRef} className="max-w-2xl mx-auto py-2 px-2" dir="rtl">
      {/* STEP 1: CHOOSE INTEREST (Pure Visual Duolingo Cards) */}
      {wizardStep === 'interest' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-slate-200/80 text-center space-y-6 animate-fade-slide-up">
          <div className="space-y-2">
            <div className="w-16 h-16 mx-auto bg-amber-100 border-2 border-amber-300 rounded-2xl flex items-center justify-center mb-2 shadow-sm animate-bounce-gentle">
              <IconStoryBook size={38} />
            </div>
            <h2 className="font-child text-2xl sm:text-3xl font-black text-slate-900">
              عن ماذا تحب أن نقرأ اليوم يا {activeStudent.name}؟
            </h2>
            <p className="font-child text-sm font-bold text-slate-600">
              اختر عالم مغامرتك المفضل بنقرة واحدة
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {interestCards.map((card) => {
              const IconComp = card.icon;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleChooseInterest(card.id)}
                  className={`p-5 rounded-3xl border-2 ${card.bg} shadow-sm hover:shadow-md transition-all cursor-pointer text-right flex items-center gap-4 select-none child-tactile-btn active:translate-y-1`}
                >
                  <div className="shrink-0">
                    <IconComp size={48} />
                  </div>
                  <div>
                    <div className="font-child text-lg font-black">{card.title}</div>
                    <div className="font-child text-xs opacity-80 font-bold mt-0.5">{card.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: CHOOSE SOUND CHALLENGE */}
      {wizardStep === 'phoneme' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-slate-200/80 text-center space-y-6 animate-fade-slide-up">
          <div className="space-y-2">
            <div className="w-16 h-16 mx-auto bg-blue-100 border-2 border-blue-300 rounded-2xl flex items-center justify-center mb-2 shadow-sm animate-bounce-gentle">
              <IconLettersBlock size={38} />
            </div>
            <h2 className="font-child text-2xl sm:text-3xl font-black text-slate-900">
              ما هو الصوت الذي سنتحداه في القصة؟
            </h2>
            <p className="font-child text-sm font-bold text-slate-600">
              اختر تحدي الحروف لتبدأ كتابة القصة فوراً
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            {soundChallenges.map((challenge) => (
              <button
                key={challenge.id}
                type="button"
                onClick={() => handleChoosePhoneme(challenge.sound)}
                className="p-5 rounded-3xl border-2 border-slate-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/50 shadow-sm hover:shadow-md transition-all cursor-pointer text-right space-y-2 child-tactile-btn active:translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-child text-xl font-black text-slate-900">{challenge.sound}</span>
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${challenge.badgeColor}`}>
                    تحدي اليوم
                  </span>
                </div>
                <div className="font-child text-sm font-bold text-slate-700">{challenge.label}</div>
                <div className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1.5">
                  <span className="text-emerald-700 font-bold">{challenge.exampleWord1}</span>
                  <span>مقابل</span>
                  <span className="text-amber-700 font-bold">{challenge.exampleWord2}</span>
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setWizardStep('interest')}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 mx-auto cursor-pointer pt-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>العودة لاختيار المغامرة</span>
          </button>
        </div>
      )}

      {/* STEP: GENERATING WITH PLAYFUL ANIMATION */}
      {wizardStep === 'generating' && (
        <div className="bg-white rounded-3xl p-10 sm:p-14 shadow-xl border-2 border-emerald-200 text-center space-y-4 animate-fade-slide-up">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center shadow-md animate-bounce-gentle">
            <IconMagicWand size={44} />
          </div>
          <h3 className="font-child text-2xl font-black text-slate-900">
            جاري تأليف قصتك المشكولة الآن...
          </h3>
          <p className="font-child text-sm text-slate-600 font-bold">
            تجهيز الحركات، التنوين، والمغامرة الخاصة بك يا بطل!
          </p>
        </div>
      )}

      {/* STEP 3: READ THE STORYBOOK (Joyful, Big Diacritized Text) */}
      {wizardStep === 'story' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-amber-300/80 space-y-6 animate-fade-slide-up text-right">
          {/* Story Title & Audio Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-amber-50/90 p-4 sm:p-5 rounded-2xl border border-amber-200">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-amber-200/80 px-2.5 py-0.5 rounded-full text-xs font-black text-amber-900 mb-1.5">
                <span>الصوت المستهدف:</span>
                <span className="text-emerald-800">{story.targetPhoneme}</span>
              </div>
              <h2 className="font-child text-2xl sm:text-3xl font-black text-slate-900">
                «{story.title}»
              </h2>
            </div>

            <button
              type="button"
              onClick={() => speakText(story.story)}
              className="duo-btn-green py-3 px-5 text-sm flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Volume2 className="w-4 h-4 animate-pulse" />
              <span>استمع للقصة كاملة</span>
            </button>
          </div>

          {/* Story Parchment Box with Ultra-Readable Arabic Font */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#FFFDF7] to-[#FAF6EE] border-2 border-[#EADFC7] shadow-inner text-center leading-loose">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-2xl sm:text-3xl md:text-4xl font-serif font-black text-slate-900">
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
            <p className="font-child text-xs text-amber-900 font-bold mt-5">
              المس أي كلمة خضراء لسماع نطقها السليم
            </p>
          </div>

          {/* Friendly Tip from Falcon Mascot */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shrink-0 shadow-xs">
              <IconBaseeraFalcon size={28} />
            </div>
            <p className="font-child text-xs text-emerald-950 font-bold leading-relaxed">
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
            className="duo-btn-orange w-full py-4 text-lg flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <IconTrophy size={24} />
            <span>أنا جاهز لتحدي الأبطال! (+٥٠ نقطة)</span>
          </button>
        </div>
      )}

      {/* STEP 4: SINGLE FUN QUESTION (No Walls of Text!) */}
      {wizardStep === 'quiz' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-indigo-200 text-center space-y-6 animate-fade-slide-up">
          <div className="space-y-2">
            <div className="w-14 h-14 mx-auto bg-indigo-100 border-2 border-indigo-300 rounded-2xl flex items-center justify-center mb-1 shadow-sm animate-bounce-gentle">
              <IconPuzzlePieces size={34} />
            </div>
            <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 inline-block">
              سؤال الذكاء السريع
            </span>
            <h3 className="font-child text-xl sm:text-2xl font-black text-slate-900 pt-1">
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
                  className={`w-full p-4 rounded-2xl text-base font-black border-2 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-between font-child ${
                    isSelected
                      ? isCorrect
                        ? 'bg-emerald-500 text-white border-emerald-600 scale-102'
                        : 'bg-rose-100 text-rose-950 border-rose-400'
                      : 'bg-white hover:bg-indigo-50 text-slate-800 border-indigo-200'
                  }`}
                >
                  <span>{opt}</span>
                  {isSelected && (
                    isCorrect ? <Check className="w-6 h-6 stroke-[3]" /> : <X className="w-6 h-6 stroke-[3] text-rose-600" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setWizardStep('story')}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>قراءة القصة مجدداً</span>
          </button>
        </div>
      )}

      {/* STEP 5: CELEBRATION & TROPHY */}
      {wizardStep === 'celebrate' && (
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-2xl border-4 border-amber-300 text-center space-y-6 animate-fade-slide-up">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-amber-100 border-3 border-amber-300 flex items-center justify-center shadow-lg animate-bounce-gentle">
            <IconTrophy size={54} />
          </div>

          <div className="space-y-2">
            <h2 className="font-child text-2xl sm:text-3xl font-black text-slate-900">
              مبـــارك يا بطل الأبطال {activeStudent.name}!
            </h2>
            <p className="font-child text-sm sm:text-base font-bold text-emerald-700">
              أتممت قراءة القصة وفهمت تفاصيلها بنجاح باهر!
            </p>
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-300 px-4 py-2 rounded-2xl font-mono text-base font-black text-amber-900 mt-2">
              <IconStar size={20} />
              <span>+٥٠ نقطة أضيفت لرصيدك!</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setSelectedQuizAnswer(null);
                setWizardStep('interest');
              }}
              className="duo-btn-green py-3.5 px-6 text-base flex items-center gap-2 cursor-pointer shadow-md"
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
