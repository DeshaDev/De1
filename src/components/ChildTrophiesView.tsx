import React from 'react';
import { Trophy, Star, Flame, Award, BookOpen, Sparkles, Zap, CheckCircle2, ArrowLeft } from 'lucide-react';
import { StudentRecord } from '../data/seedData';
import { IconStar, IconFlame, IconTrophy, IconStoryBook, IconLettersBlock, IconPuzzlePieces, IconNumberRuler, IconLightningBolt, IconBaseeraFalcon } from './ui/ChildPlayfulIcons';
import { AppTabId } from './HomeLandingView';

interface ChildTrophiesViewProps {
  activeStudent: StudentRecord;
  onNavigateTab: (tab: AppTabId) => void;
}

export const ChildTrophiesView: React.FC<ChildTrophiesViewProps> = ({
  activeStudent,
  onNavigateTab,
}) => {
  const isDemo = Boolean(activeStudent.isDemoRecord);
  const hasReading = Boolean(activeStudent.wpm && activeStudent.wpm > 0);
  const hasCognitive = Boolean(activeStudent.cognitiveResults?.phonemicAwarenessScorePercent && activeStudent.cognitiveResults.phonemicAwarenessScorePercent > 0);

  const streakDays = isDemo ? 3 : (hasReading ? 1 : 0);
  const xpPoints = isDemo
    ? 160
    : ((hasReading ? 40 : 0) + (hasCognitive ? 30 : 0) + (activeStudent.comprehensionScore || 0));

  const BADGES = [
    {
      id: 'sprint',
      title: 'وسام البرق السريع',
      description: isDemo || hasReading
        ? 'أكملت تدريب الدقائق الخمس بنجاح!'
        : 'أكمل تحدي الدقائق الخمس لتفتح هذا الوسام!',
      icon: 'lightning',
      color: 'from-amber-400 to-orange-500',
      earned: isDemo || hasReading,
      category: 'طلاقة وسرعة',
    },
    {
      id: 'story',
      title: 'وسام حكواتي بصيرة',
      description: isDemo || hasReading
        ? 'قرأت قصة مشكولة كاملة وسجلت صوتك الرائع!'
        : 'اقرأ قصة كاملة بصوتك في فحص القراءة لتفتح هذا الوسام!',
      icon: 'book',
      color: 'from-emerald-400 to-teal-500',
      earned: isDemo || hasReading,
      category: 'قراءة وفهم',
    },
    {
      id: 'letters',
      title: 'صائد الحروف الذهبي',
      description: isDemo || (activeStudent.cognitiveResults?.phonemicAwarenessScorePercent && activeStudent.cognitiveResults.phonemicAwarenessScorePercent >= 70)
        ? 'أتقنت التمييز بين الحروف المتشابهة ومخارج الأصوات بدقة.'
        : 'أكمل تحدي الوعي الصوتي بدقة ٧٠٪ فأكثر لتفتح هذا الوسام!',
      icon: 'letters',
      color: 'from-blue-400 to-indigo-500',
      earned: Boolean(isDemo || (activeStudent.cognitiveResults?.phonemicAwarenessScorePercent && activeStudent.cognitiveResults.phonemicAwarenessScorePercent >= 70)),
      category: 'وعي صوتي',
    },
    {
      id: 'syllables',
      title: 'مهندس المقاطع والكلمات',
      description: isDemo || (activeStudent.cognitiveResults?.pseudoWordScorePercent && activeStudent.cognitiveResults.pseudoWordScorePercent >= 60)
        ? 'ركّبت المقاطع الصوتية لتكوين الكلمات العربية بنجاح.'
        : 'ركّب الكلمات في تدريب المقاطع بنجاح لتفتح هذا الوسام!',
      icon: 'puzzle',
      color: 'from-purple-400 to-pink-500',
      earned: Boolean(isDemo || (activeStudent.cognitiveResults?.pseudoWordScorePercent && activeStudent.cognitiveResults.pseudoWordScorePercent >= 60)),
      category: 'تركيب لغوي',
    },
    {
      id: 'comprehension',
      title: 'بطل الفهم والاستنتاج',
      description: isDemo || Boolean(activeStudent.comprehensionScore && activeStudent.comprehensionScore > 0)
        ? 'أجبت عن أسئلة فهم المقروء بذكاء واستخرجت الفكرة الرئيسية!'
        : 'أكمل نصوص الفهم القرائي بنجاح لتفتح هذا الوسام!',
      icon: 'story',
      color: 'from-sky-400 to-cyan-500',
      earned: Boolean(isDemo || (activeStudent.comprehensionScore && activeStudent.comprehensionScore > 0)),
      category: 'فهم واستنتاج',
    },
    {
      id: 'master',
      title: 'وسام القارئ الخارق',
      description: 'أكمل ٣ قصص إضافية هذا الأسبوع لتفتح هذا الوسام!',
      icon: 'trophy',
      color: 'from-slate-200 to-slate-300',
      earned: false,
      category: 'تحدٍ قادم',
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10" dir="rtl">
      {/* Demo Student Notice */}
      {isDemo && (
        <div className="bg-amber-100/90 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-950 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              <strong>نموذج توضيحي استعراضي:</strong> هذا الملف يعرض أوسمة ونقاطاً تجريبية للمتعلّم «{activeStudent.name}» (١٦٠ نقطة · ٥ من ٦ أوسمة) لأغراض التقييم المؤسسي.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('sprint')}
            className="px-4 py-2 rounded-xl bg-amber-600 text-white font-black hover:bg-amber-700 transition-colors shrink-0 cursor-pointer shadow-xs"
          >
            ابدأ كمتعلم جديد
          </button>
        </div>
      )}

      {/* Hero Podium Banner */}
      <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border-2 border-amber-300">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-right">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-white/30 backdrop-blur border-2 border-white/50 flex items-center justify-center shadow-inner animate-bounce-gentle shrink-0">
              <IconBaseeraFalcon size={52} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full text-xs font-black tracking-wide mb-2 text-amber-100">
                <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
                <span>{xpPoints > 0 ? 'المستوى ٣ · بطل صاعد' : 'بداية الرحلة · بطل جديد'}</span>
              </div>
              <h1 className="font-child text-2xl sm:text-3xl md:text-4xl font-black">
                خزانة كؤوس وأوسمة: {activeStudent.name}{activeStudent.isDemoRecord ? ' (نموذج توضيحي)' : ''}
              </h1>
              <p className="font-child text-sm sm:text-base text-amber-100 font-bold mt-1">
                {xpPoints > 0
                  ? 'ما شاء الله عليك يا بطل! واصل القراءة والتدريب لتجمع كل أوسمة بصيرة للأبطال.'
                  : 'أهلاً بك في بصيرة! ابدأ تدريبك وقراءتك اليوم لتكسب أول نقاطك وأوسمتك الذهبية.'}
              </p>
            </div>
          </div>

          {/* Quick Stats Cards */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white text-slate-900 rounded-2xl p-3 px-4 shadow-md text-center min-w-[90px] border-b-4 border-amber-600">
              <span className="text-xl font-black text-amber-600 font-mono flex items-center justify-center gap-1">
                <span className="flex items-center gap-1"><IconStar size={18} /> {xpPoints}</span>
              </span>
              <span className="font-child text-xs font-bold text-slate-500 block mt-0.5">نقاط الإنجاز</span>
            </div>

            <div className="bg-white text-slate-900 rounded-2xl p-3 px-4 shadow-md text-center min-w-[90px] border-b-4 border-orange-600">
              <span className="text-xl font-black text-orange-600 font-mono flex items-center justify-center gap-1">
                <span className="flex items-center gap-1"><IconFlame size={18} /> {streakDays}</span>
              </span>
              <span className="font-child text-xs font-bold text-slate-500 block mt-0.5">أيام حماس</span>
            </div>
          </div>
        </div>

        {/* Decorative sparkles in background */}
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Badges Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-child text-xl font-black text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>أوسمتي المكتسبة ({BADGES.filter(b => b.earned).length} من {BADGES.length}):</span>
          </h2>
          <span className="font-child text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            مستمر في التفوق
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {BADGES.map((b) => (
            <div
              key={b.id}
              className={`p-6 rounded-3xl transition-all flex flex-col justify-between gap-3.5 relative overflow-hidden ${
                b.earned
                  ? 'clay-card hover:-translate-y-1.5'
                  : 'bg-slate-50/70 border-3 border-dashed border-slate-300 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-14 h-14 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center shadow-xs shrink-0 animate-bounce-gentle">
                  {b.id === 'sprint' && <IconLightningBolt size={34} />}
                  {b.id === 'story' && <IconStoryBook size={34} />}
                  {b.id === 'letters' && <IconLettersBlock size={34} />}
                  {b.id === 'syllables' && <IconPuzzlePieces size={34} />}
                  {b.id === 'comprehension' && <IconStoryBook size={34} />}
                  {b.id === 'master' && <IconTrophy size={34} />}
                </div>
                <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                  b.earned ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-200 text-slate-600'
                }`}>
                  {b.category}
                </span>
              </div>

              <div>
                <h3 className="font-child text-lg font-black text-slate-900 mb-1 flex items-center gap-1.5">
                  <span>{b.title}</span>
                  {b.earned && <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />}
                </h3>
                <p className="font-child text-xs text-slate-600 leading-relaxed font-bold">
                  {b.description}
                </p>
              </div>

              {b.earned ? (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-emerald-700">
                  <span>تم التتويج بنجاح</span>
                  <span className="font-mono text-amber-600 font-black">+٢٥ نقطة</span>
                </div>
              ) : (
                <div className="pt-2 border-t border-dashed border-slate-200 text-[11px] font-bold text-slate-400">
                  مقفل حتى إكمال التحدي
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Call to Adventure Action */}
      <div className="bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 rounded-3xl p-6 text-white text-center sm:text-right flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border-b-6 border-emerald-800">
        <div>
          <h3 className="font-child text-xl font-black mb-1">
            جاهز لكسب وسام جديد اليوم؟
          </h3>
          <p className="font-child text-sm text-emerald-100 font-bold">
            ابدأ تحدي الدقائق الخمس، أو اقرأ قصة جديدة لترفع مستواك!
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('sprint')}
          className="child-tactile-btn px-6 py-3 rounded-2xl bg-white text-emerald-800 hover:bg-emerald-50 font-child font-black text-base shadow-md cursor-pointer whitespace-nowrap border-b-4 border-emerald-200 active:border-b-1 active:translate-y-1"
        >
          <span>ابدأ تحدي اليوم</span>
        </button>
      </div>
    </div>
  );
};

export default ChildTrophiesView;
