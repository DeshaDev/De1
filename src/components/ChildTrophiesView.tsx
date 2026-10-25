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
  const BADGES = [
    {
      id: 'sprint',
      title: 'وسام البرق السريع',
      description: 'أكملت تدريب سبرنت الـ ٥ دقائق المكثف بنجاح!',
      icon: 'lightning',
      color: 'from-amber-400 to-orange-500',
      earned: true,
      category: 'طلاقة وسرعة',
    },
    {
      id: 'story',
      title: 'وسام حكواتي بصيرة',
      description: 'قرأت قصة مشكولة كاملة وسجلت صوتك الرائع بالذكاء الاصطناعي!',
      icon: 'book',
      color: 'from-emerald-400 to-teal-500',
      earned: true,
      category: 'قراءة وفهم',
    },
    {
      id: 'letters',
      title: 'صائد الحروف الذهبي',
      description: 'أتقنت التمييز بين الحروف المتشابهة ومخارج الأصوات بدقة.',
      icon: 'letters',
      color: 'from-blue-400 to-indigo-500',
      earned: true,
      category: 'وعي صوتي',
    },
    {
      id: 'syllables',
      title: 'مهندس المقاطع والكلمات',
      description: 'ركّبت المقاطع الصوتية لتكوين الكلمات العربية بنجاح.',
      icon: 'puzzle',
      color: 'from-purple-400 to-pink-500',
      earned: true,
      category: 'تركيب لغوي',
    },
    {
      id: 'math',
      title: 'بطل قفزات الأرقام',
      description: 'حدّدت مواقع الأعداد بدقة على خط الأعداد التفاعلي!',
      icon: 'numbers',
      color: 'from-sky-400 to-cyan-500',
      earned: true,
      category: 'إدراك عددي',
    },
    {
      id: 'master',
      title: 'وسام القارئ الخارق',
      description: 'أكمل ٣ قصص إضافية هذا الأسبوع لفتح هذا الوسام الأسطوري!',
      icon: 'trophy',
      color: 'from-slate-200 to-slate-300',
      earned: false,
      category: 'تحدٍ قادم',
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10" dir="rtl">
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
                <span>المستوى ٣ · بطل القراءة الصاعد</span>
              </div>
              <h1 className="font-child text-2xl sm:text-3xl md:text-4xl font-black">
                خزانة كؤوس وأوسمة: {activeStudent.name}
              </h1>
              <p className="font-child text-sm sm:text-base text-amber-100 font-bold mt-1">
                ما شاء الله عليك يا بطل! واصل القراءة والتدريب لتجمع كل أوسمة المملكة.
              </p>
            </div>
          </div>

          {/* Quick Stats Cards */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white text-slate-900 rounded-2xl p-3 px-4 shadow-md text-center min-w-[90px] border-b-4 border-amber-600">
              <span className="text-xl font-black text-amber-600 font-mono flex items-center justify-center gap-1">
                <span className="flex items-center gap-1"><IconStar size={18} /> {activeStudent.comprehensionScore > 0 ? activeStudent.comprehensionScore + 80 : 120}</span>
              </span>
              <span className="font-child text-xs font-bold text-slate-500 block mt-0.5">نقاط الخبرة XP</span>
            </div>

            <div className="bg-white text-slate-900 rounded-2xl p-3 px-4 shadow-md text-center min-w-[90px] border-b-4 border-orange-600">
              <span className="text-xl font-black text-orange-600 font-mono flex items-center justify-center gap-1">
                <span className="flex items-center gap-1"><IconFlame size={18} /> ٣</span>
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
              className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between gap-3 relative overflow-hidden ${
                b.earned
                  ? 'bg-white border-slate-200/80 shadow-md hover:shadow-lg hover:-translate-y-1'
                  : 'bg-slate-50/70 border-dashed border-slate-300 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-center shadow-xs shrink-0">
                  {b.id === 'sprint' && <IconLightningBolt size={32} />}
                  {b.id === 'story' && <IconStoryBook size={32} />}
                  {b.id === 'letters' && <IconLettersBlock size={32} />}
                  {b.id === 'syllables' && <IconPuzzlePieces size={32} />}
                  {b.id === 'math' && <IconNumberRuler size={32} />}
                  {b.id === 'master' && <IconTrophy size={32} />}
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                  b.earned ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-600'
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
                  <span className="font-mono text-amber-600 font-black">+25 XP</span>
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
            انطلق في تحدي سبرنت الـ ٥ دقائق أو اقرأ قصة جديدة لرفع مستواك!
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('sprint')}
          className="child-tactile-btn px-6 py-3 rounded-2xl bg-white text-emerald-800 hover:bg-emerald-50 font-child font-black text-base shadow-md cursor-pointer whitespace-nowrap border-b-4 border-emerald-200 active:border-b-1 active:translate-y-1"
        >
          <span>ابدأ سبرنت اليوم</span>
        </button>
      </div>
    </div>
  );
};

export default ChildTrophiesView;
