import React from 'react';
import {
  BookOpen,
  Brain,
  Gamepad2,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Lock,
  Sparkles,
  Timer,
  Users,
  ArrowLeft,
} from 'lucide-react';
import { StudentRecord } from '../data/seedData';
import { Mascot } from './ui/Mascot';
import { ContactUsSection } from './ContactUsSection';
import { MascotMomentLive } from './ui/MascotLive';
import { Cloud, HeroScene, LetterBlock, Sparkle } from './ui/Playful';
import { BATTERY, DOMAINS } from '../cognitiveProfile/battery';
import {
  MINUTES_PER_SESSION,
  PROGRAM_SESSIONS,
  SESSIONS_PER_WEEK,
  SKILLS,
} from '../cognitiveProfile/meta';

export type AppTabId =
  | 'home'
  | 'dyslexia-lab'
  | 'remediation-gym'
  | 'dashboard'
  | 'adaptive-reader'
  | 'reading-lab'
  | 'cognitive-lab'
  | 'privacy'
  | 'terms'
  | 'sprint'
  | 'storygen'
  | 'guided-program'
  | 'content-review'
  | 'audio-lab'
  | 'parent-portal'
  | 'literacy-studio';

interface HomeLandingViewProps {
  students: StudentRecord[];
  activeStudent: StudentRecord;
  onSelectExistingDemoJourney: (studentId: string, targetTab: AppTabId) => void;
  onNavigateTab: (tab: AppTabId) => void;
  onSelectStudentReport: (studentId: string) => void;
}

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/** Sun, clouds and two rolling hills behind the hero (decorative). */
function HnSkyDecor() {
  return (
    <div className="joy-decor pointer-events-none absolute inset-0" aria-hidden="true">
      <span className="hn-sun" />
      <Cloud width={150} className="absolute top-[10%] right-[38%] opacity-95 hidden lg:block" />
      <Cloud width={96} className="absolute top-[42%] left-[2%] opacity-90 hidden lg:block" />
      <svg className="absolute bottom-0 left-0 w-full h-[90px] sm:h-[130px]" viewBox="0 0 1440 150" preserveAspectRatio="none">
        <path d="M0 70 C 240 10, 480 10, 720 60 C 960 110, 1200 40, 1440 50 L1440 150 L0 150 Z" fill="var(--hn-hill-back)" />
        <path d="M0 110 C 300 60, 560 80, 820 110 C 1080 140, 1260 90, 1440 100 L1440 150 L0 150 Z" fill="var(--hn-hill-front)" />
        <path d="M0 138 C 360 118, 720 150, 1080 132 C 1260 124, 1360 132, 1440 136 L1440 150 L0 150 Z" fill="var(--hn-board)" />
      </svg>
    </div>
  );
}

function HnCloseDecor() {
  return (
    <div className="joy-decor pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
      <LetterBlock letter="ه" color="coral" size={52} rotate={-12} className="absolute bottom-5 left-6" />
      <LetterBlock letter="ي" color="sky" size={44} rotate={10} className="absolute bottom-6 left-20" />
      <Sparkle size={20} color="grape" className="absolute top-6 left-10" />
    </div>
  );
}

export const HomeLandingView: React.FC<HomeLandingViewProps> = ({ onNavigateTab }) => {
  return (
    <div className="baseera-home" dir="rtl">
      {/* ================= HERO: Clear 2-Track Value Proposition ================= */}
      <section className="hn-sky relative overflow-hidden">
        <HnSkyDecor />
        <div className="bz-container relative grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-8 items-center pt-4 pb-10 sm:pt-6 lg:pt-8 lg:pb-12">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/90 border border-teal-200 text-teal-900 text-xs font-black shadow-2xs mb-3">
              <Sparkles size={14} className="text-amber-500" aria-hidden="true" />
              <span>للأطفال من ٤ إلى ١٢ سنة · بالصوت العربي الفصيح</span>
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-[2.55rem] font-black text-slate-900 leading-tight tracking-tight">
              هَيَّا نَقْرَأْ: تعلّم العربية ودعم صعوبات القراءة
            </h1>
            <h2 className="text-base sm:text-lg font-extrabold text-teal-950 mt-2.5">
              اختر المسار المناسب لطفلك وابدأ فورًا:
            </h2>

            {/* Two Crystal-Clear Path Cards right in the Hero */}
            <div className="grid sm:grid-cols-2 gap-3.5 mt-4">
              {/* Path 1: Open Arabic Learning & Stories */}
              <div className="bg-white/95 backdrop-blur-xs rounded-3xl p-4 border-[3px] border-teal-500 shadow-sm flex flex-col justify-between gap-3">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 text-[11px] font-black">
                    ١. متاح فورًا للجميع
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-1.5">
                    تعلّم العربية والقصص
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-1 leading-relaxed">
                    تأسيس الحروف بالحركات، المقاطع، الإملاء، الطلاقة، والمكتبة المصوّرة الناطقة خطوةً بخطوة.
                  </p>
                </div>
                <button
                  type="button"
                  className="bz-btn bz-btn-primary w-full justify-center hn-toy cursor-pointer"
                  onClick={() => onNavigateTab('literacy-studio')}
                >
                  <BookOpen size={18} aria-hidden="true" />
                  <span>ابدأ التعلّم والقصص الآن</span>
                </button>
              </div>

              {/* Path 2: Dyslexia Screening & Guided Remediation */}
              <div className="bg-white/95 backdrop-blur-xs rounded-3xl p-4 border-[3px] border-amber-400 shadow-sm flex flex-col justify-between gap-3">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 text-[11px] font-black">
                    ٢. لمن يواجه صعوبات قراءة
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-1.5">
                    فحص وعلاج عسر القراءة
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-1 leading-relaxed">
                    فحص مبكر باللعب ({ar(BATTERY.length)} مهارةً قرائية) مع تقرير واضح وبرنامج تدريبي مخصّص لطفلك.
                  </p>
                </div>
                <button
                  type="button"
                  className="bz-btn bz-btn-secondary w-full justify-center border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 text-slate-900 font-black cursor-pointer"
                  onClick={() => onNavigateTab('parent-portal')}
                >
                  <Brain size={18} className="text-amber-700" aria-hidden="true" />
                  <span>سجّل طفلك وابدأ الفحص</span>
                </button>
              </div>
            </div>

            <ul className="mt-4 flex flex-wrap gap-2">
              {[
                { t: 'من ٤ سنوات فأكثر', icon: Users },
                { t: `${ar(BATTERY.length)} لعبة للفحص المبكر`, icon: Gamepad2 },
                { t: `جلسة قصيرة (${ar(MINUTES_PER_SESSION)} دقيقة)`, icon: Timer },
              ].map((c) => (
                <li key={c.t} className="hn-pill">
                  <c.icon size={16} aria-hidden="true" />
                  {c.t}
                </li>
              ))}
            </ul>
          </div>

          <div className="order-first lg:order-none mx-auto w-full max-w-[280px] sm:max-w-[380px] lg:max-w-none">
            <HeroScene />
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS IN 3 SIMPLE STEPS ================= */}
      <section className="bz-container py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="hn-h2">كيف تسير رحلة طفلك في ٣ خطوات؟</h2>
          <p className="hn-body mt-2">
            صُمّمت المنصة لتكون واضحة وهادئة دون قوائم معقّدة أو نصوص طويلة.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mt-8">
          <div className="bg-white rounded-3xl p-6 border-[3px] border-teal-200 shadow-xs space-y-2.5">
            <span className="w-11 h-11 rounded-2xl bg-teal-600 text-white font-black text-xl flex items-center justify-center">
              ١
            </span>
            <h3 className="text-xl font-black text-slate-900">اختر المسار المناسب</h3>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              ادخل مباشرةً إلى <strong>تعلّم العربية والقصص</strong> للتأسيس العام، أو سجّل حساب أسرة لبدء <strong>فحص عسر القراءة</strong> وحفظ النتائج.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border-[3px] border-amber-200 shadow-xs space-y-2.5">
            <span className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 font-black text-xl flex items-center justify-center">
              ٢
            </span>
            <h3 className="text-xl font-black text-slate-900">مهمة واحدة في كل شاشة</h3>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              يسمع الطفل النطق العربي الفصيح، ويتدرّج من الحروف إلى المقاطع ثم الكلمات والقصص المصوّرة في جلسات قصيرة ({ar(MINUTES_PER_SESSION)} دقيقة).
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border-[3px] border-emerald-200 shadow-xs space-y-2.5">
            <span className="w-11 h-11 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center">
              ٣
            </span>
            <h3 className="text-xl font-black text-slate-900">خطة تتكيّف مع طفلك</h3>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              يركّز البرنامج التدريبي ({ar(SESSIONS_PER_WEEK)} جلسات أسبوعيًا، {ar(PROGRAM_SESSIONS)} جلسةً) على المهارات التي يحتاجها طفلك ويعرض تقدّمه لولي الأمر.
            </p>
          </div>
        </div>
      </section>

      {/* ================= THE 11 SCREENING GAMES ================= */}
      <section className="hn-board-section">
        <div className="bz-container pt-6 pb-14 sm:pt-8 sm:pb-16">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-950 text-xs font-black mb-2">
              مسار فحص ودعم عسر القراءة
            </span>
            <h2 className="hn-h2">{ar(BATTERY.length)} لعبة قصيرة لقياس مهارات القراءة</h2>
            <p className="hn-body mt-2">
              كل لعبة تقيس مهارة قرائية محددة، وتبدأ بتجربة تدريبية بالصوت قبل حساب النتيجة، ويمكن إكمالها على أكثر من جلسة.
            </p>
          </div>
          <ol className="hn-board mt-8">
            {BATTERY.map((s, i) => {
              const domain = DOMAINS[s.domain];
              return (
                <li key={s.id} className="hn-stop-wrap" style={{ ['--stop' as string]: domain.color }}>
                  <span className="hn-stop" aria-hidden="true">
                    <span className="hn-stop-icon">{s.icon}</span>
                    <span className="hn-stop-num">{ar(i + 1)}</span>
                  </span>
                  <span className="hn-stop-name">{s.gameNameAr}</span>
                  <span className="hn-stop-skill">{s.skillNameAr}</span>
                  {s.minAgeMonths ? <span className="hn-stop-age">من ٦ سنوات</span> : null}
                  {s.maxAgeMonths ? <span className="hn-stop-age">قبل {ar(Math.floor((s.maxAgeMonths + 1) / 12))} سنوات</span> : null}
                </li>
              );
            })}
            <li className="hn-stop-wrap hn-stop-finish" aria-hidden="true">
              <span className="hn-stop">
                <span className="hn-stop-icon">🏆</span>
              </span>
              <span className="hn-stop-name">التقرير والخطة</span>
            </li>
          </ol>

          <div className="mt-8 grid lg:grid-cols-[1fr_1fr] gap-8 items-center bg-white/80 rounded-3xl p-6 border-2 border-slate-200/80">
            <div>
              <h3 className="text-xl font-black text-slate-900">
                برنامج تدريبي يتدرّج مع إتقان طفلك
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed font-medium">
                بعد الفحص، يبدأ الطفل جلسات قصيرة تركّز على أضعف مهاراته؛ يصعد مستوى عندما يتقن، ويعود إلى خطوة أبسط عندما يحتاج إلى دعم إضافي.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="bz-btn bz-btn-primary hn-toy cursor-pointer"
                  onClick={() => onNavigateTab('parent-portal')}
                >
                  <span>سجّل طفلك وابدأ الفحص</span>
                  <ArrowLeft size={17} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="bz-btn bz-btn-secondary cursor-pointer"
                  onClick={() => onNavigateTab('literacy-studio')}
                >
                  <BookOpen size={17} aria-hidden="true" />
                  <span>جرّب تعلّم العربية والمكتبة</span>
                </button>
              </div>
            </div>

            <div className="hn-stairs" aria-label="مثال: مستويات مهارة القافية">
              {[1, 2, 3].map((lvl) => (
                <div key={lvl} className={`hn-step hn-step-${lvl}`}>
                  {lvl === 2 && (
                    <span className="hn-step-bird" aria-hidden="true">
                      <Mascot mood="cheer" size={68} />
                    </span>
                  )}
                  <span className="hn-step-label">المستوى {ar(lvl)}</span>
                  <span className="hn-step-text">{SKILLS.rhyme.levels[lvl as 1 | 2 | 3]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= PRIVACY AND LIMITS ================= */}
      <section className="bz-container py-12 sm:py-16">
        <h2 className="hn-h2">خصوصية طفلك، وحدود ما نقيسه</h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          {[
            { icon: Lock, t: 'صوت طفلك بموافقتك', b: 'لا يُسجَّل الصوت إلا بعد موافقة ولي الأمر الصريحة، ويُستخدم حصريًا لتحليل قراءة الطفل وتخصيص تدريبه.', tone: 'coral' },
            { icon: Users, t: 'بيانات طفلك', b: 'تُحفظ بيانات الملف والنتائج بأمان في حساب الأسرة المسجّل فقط.', tone: 'grape' },
            { icon: ClipboardCheck, t: 'تعليمات واضحة', b: 'كل طفل يسمع التعليمات بالصوت الفصيح، ويجرّب قبل أن تُحسب إجاباته.', tone: 'sky' },
            { icon: GraduationCap, t: 'مؤشرات تربوية لا تشخيص طبي', b: 'التقرير يصف أداء الطفل في أنشطة القراءة لتوجيه التدريب، ولا يُغني عن التشخيص الإكلينيكي.', tone: 'leaf' },
          ].map((x) => (
            <li key={x.t}>
              <span className={`joy-tile joy-tile-${x.tone} w-12 h-12`} aria-hidden="true"><x.icon size={22} /></span>
              <h3 className="hn-h3 mt-3">{x.t}</h3>
              <p className="hn-small mt-1">{x.b}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ================= CONTACT US ================= */}
      <ContactUsSection />

      {/* ================= CLOSE ================= */}
      <section className="bz-container pb-16 sm:pb-24">
        <div className="hn-close">
          <HnCloseDecor />
          <div className="relative grid md:grid-cols-[auto_1fr] items-center gap-4 md:gap-10 text-center md:text-right">
            <MascotMomentLive mood="wave" size={160} className="mx-auto" />
            <div>
              <h2 className="hn-h2">هُدهُد ينتظر طفلك</h2>
              <p className="hn-body mt-3 max-w-xl md:mx-0 mx-auto">
                ابدأ بتعلّم الحروف والقصص المصوّرة مباشرةً، أو أنشئ ملف طفلك لبدء فحص صعوبات القراءة والخطة المخصّصة.
              </p>
              <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-3">
                <button
                  type="button"
                  className="bz-btn bz-btn-primary bz-btn-lg hn-toy cursor-pointer"
                  onClick={() => onNavigateTab('literacy-studio')}
                >
                  <BookOpen size={19} aria-hidden="true" />
                  <span>ابدأ تعلّم العربية والقصص</span>
                </button>
                <button
                  type="button"
                  className="bz-btn bz-btn-secondary bz-btn-lg cursor-pointer"
                  onClick={() => onNavigateTab('parent-portal')}
                >
                  <span>سجّل طفلك لفحص القراءة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomeLandingView;
