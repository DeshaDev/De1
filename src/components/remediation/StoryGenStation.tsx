import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  Volume2,
  RefreshCw,
  Trophy,
  Check,
  Star,
  Info,
  ChevronLeft,
  Lightbulb,
} from 'lucide-react';
import { StudentRecord } from '../../data/seedData';
import {
  CHILD_INTERESTS,
  PHONEME_TARGET_OPTIONS,
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
  const [selectedInterest, setSelectedInterest] = useState<string>('space');
  const [selectedPhoneme, setSelectedPhoneme] = useState<string>('س / ص');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [story, setStory] = useState<DecodableStory>(CURATED_DECODABLE_STORIES[0]);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [revealedWord, setRevealedWord] = useState<string | null>(null);

  const handleGenerateStory = async () => {
    setIsGenerating(true);
    setUserAnswers({});
    setRevealedWord(null);
    try {
      const generated = await generateDecodableStory({
        interest: selectedInterest,
        targetPhoneme: selectedPhoneme,
        gradeLevel: activeStudent.gradeLevel,
        studentName: activeStudent.name,
      });
      setStory(generated);
      triggerCelebration(`تم توليد قصة «${generated.title}» المشكولة بنجاح! (+30 نقطة)`, 30);
    } catch {
      setStory(CURATED_DECODABLE_STORIES[0]);
    } finally {
      setIsGenerating(false);
    }
  };

  const storyWords = story.story.split(/\s+/).filter(Boolean);

  const handleSelectAnswer = (qIdx: number, oIdx: number) => {
    setUserAnswers((prev) => ({ ...prev, [qIdx]: oIdx }));
    const isCorrect = oIdx === story.questions[qIdx]?.answerIndex;
    if (isCorrect) {
      triggerCelebration('إجابة صحيحة وفهم دقيق لمعنى القصة! (+20 نقطة)', 20);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/90 text-right space-y-6">
      {/* Studio Header */}
      <div className="border-b border-slate-100 pb-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-black text-slate-900">
                  مصنع قصص الذكاء الاصطناعي المشكولة (StoryGen)
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                  مبني على تقنية LUCA AI الأمريكية (NSF SBIR)
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                توليد قصص تفاعلية مشكولة 100% تجمع بين شغف الطفل والفونيم المستهدف لعلاجه.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel: Interest & Phoneme Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
        {/* Child Interest Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span>١. اختر مجال اهتمام الطفل:</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CHILD_INTERESTS.map((item) => {
              const isSelected = selectedInterest === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedInterest(item.id)}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all border text-right cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="truncate">{item.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Phoneme Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span>٢. اختر الحرف أو القاعدة المستهدفة للعلاج:</span>
          </label>
          <select
            value={selectedPhoneme}
            onChange={(e) => setSelectedPhoneme(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 cursor-pointer shadow-xs focus:ring-2 focus:ring-teal-500"
          >
            {PHONEME_TARGET_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.target}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerateStory}
            className="w-full mt-3 py-3 px-4 bg-teal-600 hover:bg-teal-500 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'جارٍ توليد وتشكيل القصة بالذكاء الاصطناعي...' : '✨ توليد قصة مخصصة للطفل الآن'}</span>
          </button>
        </div>
      </div>

      {/* Generated Decodable Story Presentation */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gradient-to-r from-teal-50 to-emerald-50 p-4 rounded-2xl border border-teal-200">
          <div>
            <h3 className="text-lg font-black text-teal-950 font-serif">
              «{story.title}»
            </h3>
            <span className="text-[11px] text-teal-700 font-medium">
              الفونيم المستهدف: <strong>{story.targetPhoneme}</strong> · المصدر: {story.source === 'ai_generated' ? 'ذكاء اصطناعي تكيفي لحظي' : 'بنك القصص المعتمد'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => speakText(story.story)}
            className="px-4 py-2 bg-white hover:bg-teal-50 text-teal-800 border border-teal-300 font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Volume2 className="w-4 h-4 text-teal-600" />
            <span>استمع للقصة كاملة بصوت طبيعي</span>
          </button>
        </div>

        {/* Diacritized Story Reading Board */}
        <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800 leading-loose">
          <div className="flex flex-wrap items-center justify-center gap-3 text-2xl sm:text-3xl md:text-4xl font-serif font-black">
            {storyWords.map((w, wIdx) => {
              const isTargetWord = story.targetWords.some((tw) => w.includes(tw) || tw.includes(w));
              const isRevealed = revealedWord === w;
              return (
                <span
                  key={wIdx}
                  onClick={() => {
                    setRevealedWord(w);
                    speakText(w);
                  }}
                  className={`px-2 py-1 rounded-xl transition-all cursor-pointer select-none ${
                    isRevealed
                      ? 'bg-amber-400 text-slate-950 scale-110 shadow-lg ring-4 ring-amber-400/40'
                      : isTargetWord
                      ? 'text-emerald-300 underline decoration-emerald-500/60 decoration-wavy hover:text-white'
                      : 'text-slate-200 hover:text-white'
                  }`}
                  title="انقر للاستماع لنطق الكلمة الفصيح"
                >
                  {w}
                </span>
              );
            })}
          </div>
        </div>

        {/* Articulatory Guidance & Target Words Badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Target Words Bank */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>كلمات القصة التي تحتوي الصوت المستهدف ({story.targetPhoneme}):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {story.targetWords.map((tw, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => speakText(tw)}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-800 hover:text-emerald-900 rounded-lg text-xs font-serif font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1"
                >
                  <Volume2 className="w-3 h-3 text-slate-400" />
                  <span>{tw}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Articulatory Mouth Cue */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1.5">
            <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span>مرآة مخرج الحرف البصرية ({story.articulatoryTip.sound}):</span>
            </div>
            <p className="text-xs text-amber-950 leading-relaxed">
              {story.articulatoryTip.description}
            </p>
          </div>
        </div>

        {/* Comprehension Questions */}
        {story.questions.length > 0 && (
          <div className="space-y-4 pt-2">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-600" />
              <span>أسئلة الفهم والاستيعاب القرائي:</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {story.questions.map((q, qIdx) => {
                const selected = userAnswers[qIdx];
                return (
                  <div key={qIdx} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <p className="text-xs font-bold text-slate-900 leading-relaxed">
                      {qIdx + 1}. {q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = selected === oIdx;
                        const isCorrect = oIdx === q.answerIndex;
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => handleSelectAnswer(qIdx, oIdx)}
                            className={`w-full p-2.5 rounded-xl text-xs font-bold text-right border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? isCorrect
                                  ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                                  : 'bg-rose-100 border-rose-300 text-rose-950'
                                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                            }`}
                          >
                            <span>{opt}</span>
                            {isSelected && (isCorrect ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span className="text-rose-600">✕</span>)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
