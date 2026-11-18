import React, { useState } from 'react';
import {
  BookOpen,
  Gamepad2,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileBarChart,
  GraduationCap,
  Lock,
  Stethoscope,
  Timer,
  Users,
  X,
} from 'lucide-react';
import { StudentRecord } from '../data/seedData';
import { Mascot } from './ui/Mascot';
import { MascotMomentLive } from './ui/MascotLive';
import { Cloud, HeroScene, LetterBlock, Sparkle } from './ui/Playful';
import { BATTERY, DOMAINS } from '../cognitiveProfile/battery';
import {
  MINUTES_PER_SESSION,
  PROGRAM_SESSIONS,
  SESSIONS_PER_WEEK,
  SKILLS,
  FOCUS_SKILLS,
} from '../cognitiveProfile/training';
import { PROBE_MINUTES } from '../cognitiveProfile/progressProbe';

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
  | 'parent-portal';

interface HomeLandingViewProps {
  students: StudentRecord[];
  activeStudent: StudentRecord;
  onSelectExistingDemoJourney: (studentId: string, targetTab: AppTabId) => void;
  onNavigateTab: (tab: AppTabId) => void;
  onSelectStudentReport: (studentId: string) => void;
}

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/** Illustrative task-level results, not age norms or risk classifications. */
const SAMPLE_PROFILE = [
  { domain: 'phonological', correct: 7, total: 10 },
  { domain: 'auditoryMemory', correct: 5, total: 10 },
  { domain: 'visualMemory', correct: 8, total: 10 },
] as const;

function SampleProfileCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="bz-card overflow-hidden" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div className="px-5 pt-5 pb-4 border-b border-line">
        <p className="bz-small bz-muted">مثال افتراضي · أداء داخل الأنشطة فقط</p>
        <p className="font-display font-bold text-ink text-lg mt-0.5">ملف مهارات القراءة</p>
        <p className="bz-small text-ink-2 mt-1">لا يمثل مقارنة معيارية أو مؤشر خطورة.</p>
      </div>
      <div className="px-5 py-4 space-y-4">
        {SAMPLE_PROFILE.map((row) => {
          const percent = Math.round((row.correct / row.total) * 100);
          return (
            <div key={row.domain} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-ink truncate">{DOMAINS[row.domain].nameAr}</p>
                <span className="bz-small text-ink-2 whitespace-nowrap">{ar(row.correct)}/{ar(row.total)} صحيحة</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden bg-soft" role="img" aria-label={DOMAINS[row.domain].nameAr}>
                <span className="block h-full rounded-full bg-brand" style={{ width: percent + '%' }} />
              </div>
            </div>
          );
        })}
      </div>
      {!compact && (
        <div className="px-5 py-3.5 bg-soft border-t border-line">
          <p className="bz-small text-ink-2">النسبة تصف الإجابات داخل المهمة المعروضة فقط، ولا تحدد مستوى الطفل مقارنةً بأقرانه.</p>
        </div>
      )}
    </div>
  );
}
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

  const [showSchoolDemoModal, setShowSchoolDemoModal] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [contactName, setContactName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [expectedStudents, setExpectedStudents] = useState('');
  const [demoNotes, setDemoNotes] = useState('');
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
  const [demoSubmitError, setDemoSubmitError] = useState('');
  const [demoSubmitSuccess, setDemoSubmitSuccess] = useState(false);

  const handleSchoolDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDemo(true);
    setDemoSubmitError('');
    try {
      const res = await fetch('/api/school-demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          contactName: contactName.trim(),
          roleTitle: roleTitle.trim(),
          workEmail: workEmail.trim(),
          phone: phone.trim(),
          expectedStudents: expectedStudents.trim(),
          notes: demoNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر إرسال طلب التجربة.');
      setDemoSubmitSuccess(true);
    } catch (err: any) {
      setDemoSubmitError(err.message || 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة لاحقًا.');
    } finally {
      setIsSubmittingDemo(false);
    }
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const domainOrder = Object.keys(DOMAINS) as Array<keyof typeof DOMAINS>;

  return (
    <div className="baseera-home" dir="rtl">
      {/* ================= HERO: a sky, hills, and letters to tap ================= */}
      <section className="hn-sky relative overflow-hidden">
        <HnSkyDecor />
        <div className="bz-container relative grid lg:grid-cols-[1fr_1fr] gap-2 lg:gap-10 items-center pt-5 pb-10 sm:pt-10 lg:pt-12 lg:pb-14">
          <div className="relative z-10">
            <h1 className="hn-display">ننمّي مهارات القراءة العربية لدى طفلك، خطوةً خطوة</h1>
            <p className="hn-lead mt-5 max-w-[34rem]">
              أنشطة قراءة عربية للأطفال من ٤ إلى ٨ سنوات، مع تدريب يتدرّج بحسب أداء الطفل.
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              <button type="button" className="bz-btn bz-btn-primary bz-btn-lg hn-toy" onClick={() => onNavigateTab('parent-portal')}>
                ابدأ اللعب مع طفلك
              </button>
              <button type="button" className="bz-btn bz-btn-secondary bz-btn-lg hn-toy-soft" onClick={() => scrollTo('sample-report')}>
                <FileBarChart size={18} aria-hidden="true" />
                شاهد نموذج التقرير
              </button>
            </div>
            <ul className="mt-7 flex flex-wrap gap-2">
              {[
                { t: 'من ٤ إلى ٨ سنوات', icon: Users },
                { t: `${ar(BATTERY.length)} لعبة للفحص`, icon: Gamepad2 },
                { t: `جلسة التدريب نحو ${ar(MINUTES_PER_SESSION + PROBE_MINUTES)} دقيقة`, icon: Timer },
              ].map((c) => (
                <li key={c.t} className="hn-pill">
                  <c.icon size={16} aria-hidden="true" />
                  {c.t}
                </li>
              ))}
            </ul>
          </div>
          <div className="order-first lg:order-none mx-auto w-full max-w-[300px] sm:max-w-[420px] lg:max-w-none">
            <HeroScene />
          </div>
        </div>
      </section>

      {/* ================= THE GAMES, as stops on a board ================= */}
      <section className="hn-board-section">
        <div className="bz-container pt-4 pb-16 sm:pt-6 sm:pb-20">
          <div className="max-w-2xl">
            <h2 className="hn-h2">{ar(BATTERY.length)} لعبة في رحلة واحدة</h2>
            <p className="hn-body mt-3">
              من «{BATTERY[0].gameNameAr}» إلى «{BATTERY[BATTERY.length - 1].gameNameAr}». كل لعبة تقيس مهارة واحدة، وتبدأ بتجربة قصيرة قبل أن تُحسب الإجابات.
            </p>
          </div>
          <ol className="hn-board mt-10">
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
                </li>
              );
            })}
            <li className="hn-stop-wrap hn-stop-finish" aria-hidden="true">
              <span className="hn-stop">
                <span className="hn-stop-icon">🏆</span>
              </span>
              <span className="hn-stop-name">التقرير</span>
            </li>
          </ol>
          <p className="hn-small mt-8">يجلس بالغ بجانب الطفل، ويمكن استكمال الرحلة على جلسات قصيرة.</p>
        </div>
      </section>

      {/* ================= THE REPORT ================= */}
      <section id="sample-report" className="hn-report scroll-mt-20">
        <div className="bz-container py-16 sm:py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
          <div className="lg:sticky lg:top-28">
            <h2 className="hn-h2">تقرير تفهمه من أول قراءة</h2>
            <p className="hn-body mt-3">يصل التقرير بعد آخر لعبة مباشرة، بلغة الأسرة لا بلغة المختبر.</p>
            <ul className="mt-7 space-y-4">
              {[
                { icon: CheckCircle2, t: 'كم إجابة صحيحة في كل لعبة', tone: 'leaf' },
                { icon: Timer, t: 'أين تمهّل طفلك أو أعاد الاستماع', tone: 'sky' },
                { icon: Users, t: 'أفكار للعب معه في البيت والصف', tone: 'sun' },
              ].map((x) => (
                <li key={x.t} className="flex items-center gap-3">
                  <span className={`joy-tile joy-tile-${x.tone} w-11 h-11 shrink-0`} aria-hidden="true"><x.icon size={20} /></span>
                  <span className="font-child font-bold text-ink text-lg">{x.t}</span>
                </li>
              ))}
            </ul>
            <p className="hn-small mt-7 max-w-md">
              التقرير يصف ما فعله طفلك داخل الألعاب. لا يشخّص عسر القراءة، ولا يقارن طفلك بغيره قبل اكتمال دراسة التقنين على أطفال عرب.
            </p>
          </div>

          <div className="space-y-4">
            <SampleProfileCard />
            <article className="bz-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
                <h3 className="bz-h3">الوعي الصوتي</h3>
                <span className="bz-badge bz-badge-neutral">مثال للممارسة</span>
              </div>
              <div className="px-5 py-4 grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-[13px] font-semibold text-muted">في الصف</p>
                  <ul className="mt-2 space-y-1.5 bz-small text-ink-2 list-disc pr-4">
                    <li>تقطيع الكلمة بالتصفيق قبل قراءتها.</li>
                    <li>لعبة «ما الصوت الأول؟» دقيقتين كل يوم.</li>
                    <li>حركة يد ثابتة لكل صوت.</li>
                  </ul>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-muted">في البيت</p>
                  <ul className="mt-2 space-y-1.5 bz-small text-ink-2 list-disc pr-4">
                    <li>أناشيد بقافية واضحة.</li>
                    <li>لعبة «أشياء تبدأ بصوت…» في الطريق.</li>
                  </ul>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ================= DAILY TRAINING: a staircase ================= */}
      <section className="bz-container py-16 sm:py-20">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-center">
          <div>
            <h2 className="hn-h2">نحو {ar(MINUTES_PER_SESSION + PROBE_MINUTES)} دقيقة للجلسة، والمستوى يتبع طفلك</h2>
            <p className="hn-body mt-3">
              {ar(SESSIONS_PER_WEEK)} جلسات في الأسبوع، {ar(PROGRAM_SESSIONS)} جلسة في المجموع. يصعد طفلك درجة حين يتقن ما أمامه، وينزل درجة إذا احتاج إلى ذلك، ثم يُعاد الفحص لنرى ما تغيّر.
            </p>
            <p className="hn-small mt-5">
              المهارات في البرنامج: {FOCUS_SKILLS.map((id) => SKILLS[id].nameAr).join('، ')}. وقد تطول بعض الجلسات عند قياس القراءة على كلمات ونصوص جديدة.
            </p>
          </div>
          <div className="hn-stairs" aria-label="مثال: مستويات مهارة القافية">
            {[1, 2, 3].map((lvl) => (
              <div key={lvl} className={`hn-step hn-step-${lvl}`}>
                {lvl === 2 && (
                  <span className="hn-step-bird" aria-hidden="true">
                    <Mascot mood="cheer" size={74} />
                  </span>
                )}
                <span className="hn-step-label">المستوى {ar(lvl)}</span>
                <span className="hn-step-text">{SKILLS.rhyme.levels[lvl as 1 | 2 | 3]}</span>
              </div>
            ))}
            <p className="hn-small sm:col-span-3 mt-2">
              يتقدّم الطفل عندما تظهر إجاباته إتقان المهارة، ويعود إلى مستوى أبسط عندما يحتاج إلى مزيد من التدريب.
            </p>
          </div>
        </div>
      </section>

      {/* ================= WHO IT IS FOR ================= */}
      <section className="hn-who">
        <div className="bz-container py-16 sm:py-20">
          <h2 className="hn-h2 text-center">للأسرة والمدرسة والأخصائي</h2>
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            <article className="hn-who-card" style={{ ['--who' as string]: 'var(--joy-sun)' }}>
              <span className="hn-who-icon" aria-hidden="true"><Users size={28} /></span>
              <h3 className="hn-h3">الأسرة</h3>
              <p className="hn-body flex-1">اعرف أين يحتاج طفلك إلى المساعدة، وتدرّب معه في جلسات قصيرة خلال الأسبوع.</p>
            </article>
            <article className="hn-who-card" style={{ ['--who' as string]: 'var(--joy-leaf)' }}>
              <span className="hn-who-icon" aria-hidden="true"><Building2 size={28} /></span>
              <h3 className="hn-h3">المدرسة</h3>
              <p className="hn-body flex-1">افحص طلاب الصفوف الأولى، وتابع تقدّمهم من لوحة واحدة للمعلم.</p>
              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  className="bz-btn bz-btn-primary hn-toy"
                  onClick={() => {
                    setDemoSubmitSuccess(false);
                    setDemoSubmitError('');
                    setShowSchoolDemoModal(true);
                  }}
                >
                  اطلب تجربة لمدرستك
                </button>
                <button type="button" className="bz-btn bz-btn-ghost" onClick={() => onNavigateTab('dashboard')}>افتح لوحة المعلم</button>
              </div>
            </article>
            <article className="hn-who-card" style={{ ['--who' as string]: 'var(--joy-sky)' }}>
              <span className="hn-who-icon" aria-hidden="true"><Stethoscope size={28} /></span>
              <h3 className="hn-h3">الأخصائي</h3>
              <p className="hn-body flex-1">درجات خام وأزمنة استجابة لكل لعبة، وأدوات لقياس القراءة الجهرية.</p>
              <div className="mt-5 grid gap-2">
                <button type="button" className="bz-btn bz-btn-secondary" onClick={() => onNavigateTab('reading-lab')}>
                  <BookOpen size={17} aria-hidden="true" /> رحلة القراءة والطلاقة
                </button>
                <button type="button" className="bz-btn bz-btn-ghost" onClick={() => onNavigateTab('adaptive-reader')}>القارئ الميسّر</button>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ================= PRIVACY AND LIMITS ================= */}
      <section className="bz-container py-16 sm:py-20">
        <h2 className="hn-h2">خصوصية طفلك، وحدود ما نقيسه</h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          {[
            { icon: Lock, t: 'صوت طفلك بموافقتك', b: 'لا يُسجَّل الصوت لمهام التقييم إلا بعد موافقة منفصلة؛ ويمكن متابعة الأنشطة دون درجة صوتية.', tone: 'coral' },
            { icon: Users, t: 'بيانات طفلك', b: 'تُحفظ بيانات الملف والنتائج بأمان في حساب الأسرة المسجّل فقط.', tone: 'grape' },
            { icon: ClipboardCheck, t: 'تعليمات ثابتة', b: 'كل طفل يسمع التعليمات نفسها، ويجرّب قبل أن تُحسب إجاباته.', tone: 'sky' },
            { icon: GraduationCap, t: 'لا تشخيص', b: 'التقرير يصف أداء الطفل في أنشطة المنصة، ولا يثبت وجود عسر القراءة.', tone: 'leaf' },
          ].map((x) => (
            <li key={x.t}>
              <span className={`joy-tile joy-tile-${x.tone} w-12 h-12`} aria-hidden="true"><x.icon size={22} /></span>
              <h3 className="hn-h3 mt-3">{x.t}</h3>
              <p className="hn-small mt-1">{x.b}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ================= CLOSE ================= */}
      <section className="bz-container pb-16 sm:pb-24">
        <div className="hn-close">
          <HnCloseDecor />
          <div className="relative grid md:grid-cols-[auto_1fr] items-center gap-4 md:gap-10 text-center md:text-right">
            <MascotMomentLive mood="wave" size={160} className="mx-auto" />
            <div>
              <h2 className="hn-h2">هُدهُد ينتظر طفلك</h2>
              <p className="hn-body mt-3 max-w-xl md:mx-0 mx-auto">ابدأ بإنشاء ملف طفلك، ثم أكملوا الأنشطة معًا في جلسات قصيرة.</p>
              <div className="mt-7 flex flex-wrap justify-center md:justify-start gap-3">
                <button type="button" className="bz-btn bz-btn-primary bz-btn-lg hn-toy" onClick={() => onNavigateTab('parent-portal')}>
                  سجّل طفلك وابدأ
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MODAL: SCHOOL PILOT REQUEST ================= */}
      {showSchoolDemoModal && (
        <div className="bz-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowSchoolDemoModal(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="demo-modal-title" className="bz-modal space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-soft text-brand"><Building2 size={22} /></span>
                <div>
                  <h3 id="demo-modal-title" className="bz-h3">طلب تجربة مدرسية وشراكة تجريبية</h3>
                  <p className="bz-small bz-muted">برنامج تجريبي لأقسام الدعم التعليمي والمدارس</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowSchoolDemoModal(false)} aria-label="إغلاق" className="bz-icon-btn"><X size={18} /></button>
            </div>

            {demoSubmitSuccess ? (
              <div className="py-6 text-center space-y-4">
                <span className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-brand-soft text-brand"><CheckCircle2 size={34} /></span>
                <h4 className="bz-h3">تم استلام طلبكم بنجاح!</h4>
                <p className="bz-body max-w-sm mx-auto">شكرًا لاهتمامكم. تم تسجيل طلب التجربة. لا يتضمن هذا الطلب إنشاء حساب لطفل أو إرسال بياناته التعليمية. سنتواصل معكم لجدولة الجلسات قبل بدء التجربة.</p>
                <button type="button" onClick={() => setShowSchoolDemoModal(false)} className="bz-btn bz-btn-primary">إغلاق</button>
              </div>
            ) : (
              <form onSubmit={handleSchoolDemoSubmit} className="space-y-4">
                {demoSubmitError && <div role="alert" className="p-3 rounded-xl bg-risk-soft text-risk bz-small font-semibold">{demoSubmitError}</div>}
                <label className="bz-field">
                  <span className="bz-label">اسم المدرسة أو المركز</span>
                  <input type="text" required value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="مثال: مدرسة قطر الابتدائية" className="bz-input" />
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="bz-field">
                    <span className="bz-label">اسم مسؤول التواصل</span>
                    <input type="text" required value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="مثال: أ. مريم السليطي" className="bz-input" />
                  </label>
                  <label className="bz-field">
                    <span className="bz-label">الصفة الوظيفية</span>
                    <input type="text" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="منسّق دعم / أخصائي تخاطب" className="bz-input" />
                  </label>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="bz-field">
                    <span className="bz-label">البريد الإلكتروني المؤسسي</span>
                    <input type="email" required value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="name@school.edu.qa" className="bz-input" dir="ltr" style={{ textAlign: 'right' }} />
                  </label>
                  <label className="bz-field">
                    <span className="bz-label">رقم الهاتف</span>
                    <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+974 5500 0000" className="bz-input" dir="ltr" style={{ textAlign: 'right' }} />
                  </label>
                </div>
                <label className="bz-field">
                  <span className="bz-label">العدد التقديري للطلاب</span>
                  <input type="text" value={expectedStudents} onChange={(e) => setExpectedStudents(e.target.value)} placeholder="مثال: ٣٠ طالبًا في الصف الأول" className="bz-input" />
                </label>
                <label className="bz-field">
                  <span className="bz-label">ملاحظات</span>
                  <textarea rows={2} value={demoNotes} onChange={(e) => setDemoNotes(e.target.value)} placeholder="أي احتياجات خاصة بالمتابعة أو التقارير" className="bz-input" />
                </label>
                <div className="flex items-center gap-2 pt-1">
                  <button type="submit" disabled={isSubmittingDemo} className="bz-btn bz-btn-primary flex-1">
                    {isSubmittingDemo ? 'جارٍ إرسال الطلب…' : 'إرسال طلب التجربة'}
                  </button>
                  <button type="button" onClick={() => setShowSchoolDemoModal(false)} className="bz-btn bz-btn-ghost">إلغاء</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeLandingView;
