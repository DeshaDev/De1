import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Dumbbell,
  EyeOff,
  FileBarChart,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  Languages,
  LineChart,
  Lock,
  Stethoscope,
  Timer,
  Users,
  X,
} from 'lucide-react';
import { StudentRecord } from '../data/seedData';
import { BATTERY, DOMAINS, TOTAL_BATTERY_MINUTES } from '../cognitiveProfile/battery';
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
      setDemoSubmitError(err.message || 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة لاحقاً.');
    } finally {
      setIsSubmittingDemo(false);
    }
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const domainOrder = Object.keys(DOMAINS) as Array<keyof typeof DOMAINS>;

  return (
    <div className="baseera-home" dir="rtl">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden border-b border-line" style={{ background: 'linear-gradient(180deg, var(--card) 0%, var(--paper) 100%)' }}>
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, var(--line) 1px, transparent 0)',
            backgroundSize: '28px 28px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,.6), transparent 85%)',
            WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,.6), transparent 85%)',
          }}
        />
        <div className="bz-container relative grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-14 items-start pt-10 pb-16 sm:pt-12 lg:pt-14 lg:pb-20">
          <div>
            <span className="bz-eyebrow">فحص مبكر وتدريب موجّه · من ٤ إلى ٨ سنوات</span>
            <h1 className="bz-display mt-5" style={{ fontSize: 'clamp(32px, 3.6vw, 50px)' }}>
              خطوة مبكرة لفهم مهارات القراءة لدى طفلك،{' '}
              <span className="text-brand">ومساعدته على التعلّم بثقة.</span>
            </h1>
            <p className="bz-lead mt-6 max-w-[38rem]">
              ألعاب قصيرة تستكشف أداء الطفل في مهارات ترتبط بتعلّم القراءة: الذاكرة السمعية والبصرية، والوعي الصوتي، والتمييز، ومعرفة الحروف، والتسمية السريعة. ومن السادسة يقرأ الطفل أيضًا كلمات حقيقية وكلمات مصنوعة وقصة قصيرة، ويكتب كلمات مسموعة. يعرض التقرير ما سجّله الطفل داخل كل نشاط وأفكارًا للممارسة. النتائج استكشافية وليست مقارنة معيارية أو تشخيصًا.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={() => onNavigateTab('parent-portal')}>
                سجّل طفلك وابدأ الفحص
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
              <button type="button" className="bz-btn bz-btn-secondary bz-btn-lg" onClick={() => scrollTo('sample-report')}>
                <FileBarChart size={18} aria-hidden="true" />
                شاهد نموذج التقرير
              </button>
            </div>
            <dl className="mt-10 grid grid-cols-3 max-w-[30rem] gap-6">
              {[
                { k: `${ar(TOTAL_BATTERY_MINUTES)} دقيقة`, v: 'مدة الفحص' },
                { k: `${ar(BATTERY.length)} مهمة`, v: 'في ٧ مجالات' },
                { k: `${ar(PROGRAM_SESSIONS)} جلسة`, v: 'برنامج تدريبي' },
              ].map((s) => (
                <div key={s.v} className="border-r-2 border-brand-soft pr-4">
                  <dt className="sr-only">{s.v}</dt>
                  <dd className="font-display font-bold text-ink text-lg sm:text-xl whitespace-nowrap">{s.k}</dd>
                  <dd className="bz-small bz-muted">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <div aria-hidden="true" className="absolute -inset-6 rounded-[36px]" style={{ background: 'radial-gradient(60% 60% at 70% 30%, var(--brand-soft), transparent 70%), radial-gradient(50% 50% at 20% 90%, var(--sun-soft), transparent 70%)' }} />
            <div className="relative">
              <SampleProfileCard compact />
              <div className="hidden sm:flex absolute -bottom-9 -left-5 bz-card px-4 py-3 items-center gap-3" style={{ boxShadow: 'var(--shadow-md)' }}>
                <span className="grid place-items-center w-9 h-9 rounded-xl bg-sun-soft text-sun-strong" aria-hidden="true">
                  <Dumbbell size={18} />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-ink">الجلسة ٣ من ٢٠</span>
                  <span className="block text-[12px] text-muted">الوعي الصوتي · المستوى ٢</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PROBLEM ================= */}
      <section className="bz-container py-16 sm:py-24">
        <div className="bz-section-head">
          <span className="bz-eyebrow">لماذا هَيَّا نَقْرَأْ؟</span>
          <h2 className="bz-h2">صعوبة القراءة تُكتشف عادةً متأخرة، بعد أن يفقد الطفل ثقته بنفسه.</h2>
          <p className="bz-lead">
            قد تمر صعوبات تعلّم القراءة دون ملاحظة في سنوات الدراسة الأولى. وتحتاج الأسرة إلى فهم ما يستطيع الطفل أداءه الآن، وما المهارات التي تستحق مزيدًا من الممارسة، دون إطلاق أحكام مبكرة.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: Timer,
              title: 'قبل أن يتعثّر في الصف',
              body: 'نستكشف بعض المهارات الأساسية المرتبطة بتعلّم القراءة، مع مراعاة أن نتائج الأطفال في عمر ما قبل المدرسة تحتاج إلى تفسير حذر.',
            },
            {
              icon: Languages,
              title: 'مصمم للعربية من الأساس',
              body: 'بنود تراعي ما يميز العربية: الحروف المتشابهة بالنقاط، والأصوات المتقاربة مثل س/ص وت/ط، والحركات القصيرة.',
            },
            {
              icon: LineChart,
              title: 'من النتيجة إلى خطة عمل',
              body: 'لا يتوقف التقرير عند الدرجة: يشرح ماذا تعني، ويقترح استراتيجيات صفية وأنشطة منزلية، ويبني برنامجًا تدريبيًا.',
            },
          ].map((c) => (
            <article key={c.title} className="bz-card bz-card-pad">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-soft text-brand" aria-hidden="true">
                <c.icon size={22} />
              </span>
              <h3 className="bz-h3 mt-5">{c.title}</h3>
              <p className="bz-body mt-2">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="bg-card border-y border-line">
        <div className="bz-container py-16 sm:py-24">
          <div className="bz-section-head is-center">
            <span className="bz-eyebrow">كيف تعمل</span>
            <h2 className="bz-h2">ثلاث خطوات من الفحص إلى التحسّن</h2>
          </div>
          <ol className="grid md:grid-cols-3 gap-10 md:gap-6 relative">
            <span aria-hidden="true" className="hidden md:block absolute top-6 inset-x-[16%] h-px bg-line-strong" />
            {[
              {
                icon: Gamepad2,
                title: 'افحص',
                meta: `${ar(TOTAL_BATTERY_MINUTES)} دقيقة · بحضور بالغ`,
                body: 'يلعب الطفل ألعابًا قصيرة بتعليمات مسموعة، ومن السادسة يقرأ ويكتب أيضًا. كل لعبة تبدأ بتدريب، ثم بنود الفحص دون تصحيح.',
              },
              {
                icon: FileBarChart,
                title: 'افهم',
                meta: 'تقرير فوري',
                body: 'ملف أداء وصفي يوضح الإجابات الصحيحة في كل نشاط، وملاحظات التنفيذ، وأفكارًا للممارسة.',
              },
              {
                icon: Dumbbell,
                title: 'درّب',
                meta: `${ar(PROGRAM_SESSIONS)} جلسة · ${ar(SESSIONS_PER_WEEK)} جلسات أسبوعيًا`,
                body: 'يقترح مستوى مبدئيًا للممارسة من أنشطة الطفل، ويعرض للأسرة ملاحظات تساعدها على اختيار أنشطة مناسبة. هذه الاقتراحات تعليمية وليست حكمًا على قدرات الطفل.',
              },
            ].map((step, i) => (
              <li key={step.title} className="relative text-center px-2">
                <span className="relative mx-auto grid place-items-center w-12 h-12 rounded-full bg-brand text-on-brand font-display font-bold text-lg" style={{ boxShadow: '0 0 0 8px var(--card)' }}>
                  {ar(i + 1)}
                </span>
                <h3 className="bz-h3 mt-5 inline-flex items-center gap-2">
                  <step.icon size={19} className="text-brand" aria-hidden="true" /> {step.title}
                </h3>
                <p className="bz-small text-brand font-semibold mt-1">{step.meta}</p>
                <p className="bz-body mt-3 max-w-[22rem] mx-auto">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= THE BATTERY ================= */}
      <section className="bz-container py-16 sm:py-24">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="bz-section-head mb-0">
            <span className="bz-eyebrow">فحص مؤشرات عسر القراءة</span>
            <h2 className="bz-h2">المهارات السابقة للقراءة، والقراءة نفسها</h2>
            <p className="bz-lead">كل لعبة تركّز على مهارة واحدة، فيعرف المعلم إن كانت الصعوبة في الذاكرة السمعية، أو التحليل الصوتي، أو الذاكرة البصرية. ومن السادسة تُقاس القراءة مباشرة: الدقة والسرعة وفك الترميز والإملاء.</p>
          </div>
          <button type="button" className="bz-btn bz-btn-secondary shrink-0" onClick={() => onNavigateTab('parent-portal')}>
            جرّب الألعاب <ArrowLeft size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BATTERY.map((s) => {
            const domain = DOMAINS[s.domain];
            return (
              <article key={s.id} className="bz-card p-5 flex gap-4">
                <span className="grid place-items-center w-14 h-14 shrink-0 rounded-2xl text-3xl" style={{ background: `color-mix(in srgb, ${domain.color} 12%, var(--card))` }} aria-hidden="true">
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-ink text-[17px] leading-snug">{s.gameNameAr}</h3>
                  <p className="bz-small text-ink-2 mt-0.5">{s.skillNameAr}</p>
                  <p className="text-[12px] font-semibold mt-2" style={{ color: domain.color }}>{domain.nameAr}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ================= SAMPLE REPORT ================= */}
      <section id="sample-report" className="bg-card border-y border-line scroll-mt-20">
        <div className="bz-container py-16 sm:py-24 grid lg:grid-cols-[0.95fr_1.05fr] gap-12 items-start">
          <div className="lg:sticky lg:top-28">
            <div className="bz-section-head">
              <span className="bz-eyebrow">التقرير</span>
              <h2 className="bz-h2">ملخص واضح لأداء الطفل، مع تفاصيل تساعد الأسرة على اختيار أنشطة للممارسة</h2>
              <p className="bz-lead">يعرض التقرير عدد الإجابات الصحيحة ونسبتها داخل كل نشاط، وأزمنة الاستجابة وملاحظات التنفيذ. لا تعرض النسخة الحالية مئينات أو تصنيفات خطورة؛ فالمعايير العمرية لم تُقنّن بعد على عينة عربية مستقلة.</p>
            </div>
            <ul className="space-y-4">
              {[
                ['نتيجة كل نشاط', 'عدد الإجابات الصحيحة من إجمالي البنود والنسبة داخل المهمة.'],
                ['ملاحظات التنفيذ', 'أزمنة الاستجابة وإعادة الاستماع والتوقف المبكر عند وجودها.'],
                ['أفكار للممارسة', 'أنشطة تعليمية مرتبطة بالمهارة دون وصف الطفل بتصنيف أو تشخيص.'],
                ['حدود واضحة', 'لا مئينات ولا مقارنة معيارية قبل اكتمال التقنين.'],
              ].map(([t, b]) => (
                <li key={t} className="flex gap-3">
                  <CheckCircle2 size={20} className="text-brand shrink-0 mt-1" aria-hidden="true" />
                  <span>
                    <strong className="block text-ink font-semibold">{t}</strong>
                    <span className="bz-body">{b}</span>
                  </span>
                </li>
              ))}
            </ul>
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
                    <li>ألعاب «ما الصوت الأول؟» لدقيقتين يوميًا.</li>
                    <li>ربط كل صوت بحركة يد ثابتة.</li>
                  </ul>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-muted">في البيت</p>
                  <ul className="mt-2 space-y-1.5 bz-small text-ink-2 list-disc pr-4">
                    <li>أناشيد وقصائد ذات قافية واضحة.</li>
                    <li>لعبة «أشياء تبدأ بصوت…» في الطريق.</li>
                  </ul>
                </div>
              </div>
            </article>
            <p className="bz-small bz-muted px-1">المثال افتراضي؛ النسب ليست معيارًا عمريًا ولا تصنيفًا لمستوى الطفل.</p>
          </div>
        </div>
      </section>

      {/* ================= TRAINING PROGRAM ================= */}
      <section className="bz-container py-16 sm:py-24">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-center">
          <div>
            <div className="bz-section-head">
              <span className="bz-eyebrow">البرنامج التدريبي الموجّه</span>
              <h2 className="bz-h2">تدريب قصير كل يوم، يتقدّم بقدر ما يتقن الطفل</h2>
              <p className="bz-lead">
                يختار مسار الممارسة حتى ثلاث مهارات للتركيز استنادًا إلى نتائج الأنشطة المتاحة. تُعرض هذه الاختيارات بوصفها اقتراحات أولية للممارسة، لا ترتيبًا معياريًا لمستوى الطفل.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { k: `${ar(MINUTES_PER_SESSION + PROBE_MINUTES)} دقيقة`, v: 'للجلسة (ممارسة + قياس)' },
                { k: `${ar(SESSIONS_PER_WEEK)} جلسات`, v: 'أسبوعيًا' },
                { k: `${ar(PROGRAM_SESSIONS)} جلسة`, v: 'ثم إعادة فحص' },
              ].map((s) => (
                <div key={s.v} className="bz-card-quiet p-4">
                  <p className="font-display font-bold text-ink text-xl">{s.k}</p>
                  <p className="bz-small bz-muted">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bz-card bz-card-pad">
            <h3 className="bz-h3">قاعدة التقدّم · مثال مهارة القافية</h3>
            <div className="mt-5 space-y-3">
              {[1, 2, 3].reverse().map((lvl) => (
                <div key={lvl} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 bz-small font-semibold text-ink-2">المستوى {ar(lvl)}</span>
                  <span className="flex-1 h-11 rounded-xl border border-line flex items-center px-4 bz-small text-ink-2" style={{ background: lvl === 2 ? 'var(--brand-soft)' : 'var(--card)', borderColor: lvl === 2 ? 'color-mix(in srgb, var(--brand) 35%, transparent)' : undefined }}>
                    {SKILLS.rhyme.levels[lvl as 1 | 2 | 3]}
                    {lvl === 2 && <span className="mr-auto bz-badge bz-badge-brand">الطفل هنا</span>}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl p-4 bg-brand-tint border border-line">
                <p className="font-semibold text-brand-strong">يتقدّم مستوى</p>
                <p className="bz-small text-ink-2 mt-1">حين يقدّر نموذج تتبّع المعرفة أن احتمال إتقانه المستوى بلغ ٩٥٪، بعد ٥ إجابات على الأقل.</p>
              </div>
              <div className="rounded-xl p-4 bg-sun-soft border border-line">
                <p className="font-semibold text-sun-strong">يعود مستوى وينبّه المعلم</p>
                <p className="bz-small text-ink-2 mt-1">حين يبقى احتمال الإتقان أقل من ٢٠٪ بعد ٨ إجابات.</p>
              </div>
            </div>
            <p className="mt-6 bz-small bz-muted">
              المهارات المدرَّبة: {FOCUS_SKILLS.map((id) => SKILLS[id].nameAr).join('، ')}.
            </p>
          </div>
        </div>
      </section>

      {/* ================= AUDIENCES ================= */}
      <section className="bg-card border-y border-line">
        <div className="bz-container py-16 sm:py-24">
          <div className="bz-section-head is-center">
            <span className="bz-eyebrow">لمن صُممت هَيَّا نَقْرَأْ</span>
            <h2 className="bz-h2">أداة واحدة، ثلاثة مستخدمين</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <article className="bz-card bz-card-pad flex flex-col">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-sun-soft text-sun-strong" aria-hidden="true"><Users size={22} /></span>
              <h3 className="bz-h3 mt-5">الأسر</h3>
              <p className="bz-body mt-2 flex-1">افهم سبب تعثّر طفلك بلغة واضحة، واحصل على أنشطة منزلية قصيرة وبرنامج يومي يتابع تقدّمه.</p>
              <div className="mt-6 grid gap-2">
                <button type="button" className="bz-btn bz-btn-primary" onClick={() => onNavigateTab('parent-portal')}>ابدأ الفحص</button>
                <button type="button" className="bz-btn bz-btn-ghost" onClick={() => onNavigateTab('parent-portal')}>
                  سجّل طفلك وابدأ الفحص
                </button>
              </div>
            </article>
            <article className="bz-card bz-card-pad flex flex-col" style={{ borderColor: 'color-mix(in srgb, var(--brand) 40%, transparent)', boxShadow: 'var(--shadow-md)' }}>
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-soft text-brand" aria-hidden="true"><Building2 size={22} /></span>
              <h3 className="bz-h3 mt-5">المدارس ومراكز التعلّم</h3>
              <p className="bz-body mt-2 flex-1">فرز مبكر لطلاب الصفوف الأولى، ولوحة متابعة للمعلم، وتقارير فردية تساعد على توجيه الدعم لمن يحتاجه أولًا.</p>
              <div className="mt-6 grid gap-2">
                <button
                  type="button"
                  className="bz-btn bz-btn-primary"
                  onClick={() => {
                    setDemoSubmitSuccess(false);
                    setDemoSubmitError('');
                    setShowSchoolDemoModal(true);
                  }}
                >
                  طلب تجربة مدرسة
                </button>
                <button type="button" className="bz-btn bz-btn-ghost" onClick={() => onNavigateTab('dashboard')}>
                  استعرض لوحة المعلم
                </button>
              </div>
            </article>
            <article className="bz-card bz-card-pad flex flex-col">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-info-soft text-info" aria-hidden="true"><Stethoscope size={22} /></span>
              <h3 className="bz-h3 mt-5">الأخصائيون</h3>
              <p className="bz-body mt-2 flex-1">درجات خام ونسب أداء داخل المهام، وأزمنة استجابة وملاحظات سياقية، وأدوات تكميلية للقراءة الجهرية.</p>
              <div className="mt-6 grid gap-2">
                <button type="button" className="bz-btn bz-btn-secondary" onClick={() => onNavigateTab('reading-lab')}>
                  <BookOpen size={17} aria-hidden="true" /> رحلة القراءة والطلاقة
                </button>
                <button type="button" className="bz-btn bz-btn-ghost" onClick={() => onNavigateTab('adaptive-reader')}>
                  القارئ الميسّر
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ================= METHOD & TRUST ================= */}
      <section className="bz-container py-16 sm:py-24">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12">
          <div className="bz-section-head mb-0">
            <span className="bz-eyebrow">المنهجية والثقة</span>
            <h2 className="bz-h2">مبنية على أسس علمية، وشفافة في حدودها</h2>
            <p className="bz-lead">
              نوضح ما تقيسه هَيَّا نَقْرَأْ وما لا تقيسه. الأنشطة استكشافية وتساعد الأسرة على ملاحظة أداء الطفل داخلها، ولا تشخّص عسر القراءة أو تحدد الحاجة إلى الإحالة بمفردها.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: ClipboardCheck, t: 'إجراءات تنفيذ موحّدة', b: 'تعليمات ثابتة، وتدريب قبل كل مهمة، وقواعد إيقاف، وتسجيل أزمنة الاستجابة.' },
              { icon: FlaskConical, t: 'منهج تعليم منظّم', b: 'برنامج صريح ومتدرّج يتبع مبادئ التعليم المنظّم للقراءة.' },
              { icon: EyeOff, t: 'بلا كاميرا', b: 'لا تتبع للعين ولا تصوير. يعمل الفحص بالصوت واللمس فقط.' },
              { icon: Lock, t: 'خصوصية الطفل أولًا', b: 'تقليل البيانات، وموافقة مستقلة للصوت، وشرح مزودي الخدمات وطرق معالجة البيانات في سياسة الخصوصية.' },
            ].map((x) => (
              <div key={x.t} className="bz-card p-5">
                <x.icon size={22} className="text-brand" aria-hidden="true" />
                <h3 className="font-semibold text-ink mt-3">{x.t}</h3>
                <p className="bz-small text-ink-2 mt-1">{x.b}</p>
              </div>
            ))}
            <div className="sm:col-span-2 rounded-2xl p-5 bg-sun-soft border border-line flex gap-3">
              <GraduationCap size={22} className="text-sun-strong shrink-0 mt-0.5" aria-hidden="true" />
              <p className="bz-small text-ink-2">
                <strong className="text-ink">مرحلة التحقق العلمي:</strong> لا تعرض النسخة الحالية مئينات أو تصنيفات خطورة؛ وأي مقارنة عمرية مستقبلية تتطلب دراسة تقنين مستقلة، مع قياس الثبات والصدق التنبؤي.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="bz-container pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-[28px] px-6 py-12 sm:px-12 sm:py-16 text-center" style={{ background: 'linear-gradient(135deg, #0B6E69 0%, #084B48 100%)', color: '#FFFFFF' }}>
          <div aria-hidden="true" className="absolute -top-24 -left-24 w-72 h-72 rounded-full" style={{ background: 'rgba(242,169,59,.18)' }} />
          <div aria-hidden="true" className="absolute -bottom-28 -right-20 w-80 h-80 rounded-full" style={{ background: 'rgba(255,255,255,.06)' }} />
          <h2 className="relative font-display font-bold text-[clamp(26px,3.2vw,40px)] leading-snug" style={{ color: '#FFFFFF' }}>
            ابدأ بخطوة هادئة لفهم مهارات القراءة لدى طفلك.
          </h2>
          <p className="relative mt-4 text-[17px] leading-relaxed max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,.82)' }}>
            أكمل الأنشطة على فترات قصيرة، ثم راجع النتائج الوصفية والأفكار المقترحة للممارسة.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" className="bz-btn bz-btn-sun bz-btn-lg" onClick={() => onNavigateTab('parent-portal')}>
              سجّل طفلك وابدأ الفحص <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" className="bz-btn bz-btn-outline-light bz-btn-lg" onClick={() => onNavigateTab('remediation-gym')}>
              صالة التدريب
            </button>
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
                <p className="bz-body max-w-sm mx-auto">شكرًا لاهتمامكم. تم تسجيل طلب التجربة. لا يتضمن هذا الطلب إنشاء حساب لطفل أو إرسال بياناته التعليمية. ستُستكمل آلية التواصل وجدولة الجلسات قبل بدء التجربة.</p>
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
                    <input type="text" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="منسق دعم / أخصائي تخاطب" className="bz-input" />
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
