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
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { StudentRecord } from '../data/seedData';
import { BATTERY, DOMAINS, TOTAL_BATTERY_MINUTES } from '../cognitiveProfile/battery';
import {
  MASTERY_PERCENT,
  MINUTES_PER_SESSION,
  PROGRAM_WEEKS,
  SESSIONS_PER_WEEK,
  SKILLS,
  STEP_BACK_PERCENT,
} from '../cognitiveProfile/training';
import { BAND_META, BandLegend, CentileTrack, bandOf } from './profile/CentileTrack';

export type AppTabId =
  | 'home'
  | 'dyslexia-lab'
  | 'remediation-gym'
  | 'dashboard'
  | 'adaptive-reader'
  | 'reading-lab'
  | 'cognitive-lab'
  | 'adaptive-reports'
  | 'privacy'
  | 'terms'
  | 'sprint'
  | 'storygen'
  | 'trophies'
  | 'guided-program';

interface HomeLandingViewProps {
  students: StudentRecord[];
  activeStudent: StudentRecord;
  onStartMockUserJourney: (
    name: string,
    grade: number,
    roleLabel: string,
    guardianConsent?: {
      guardianName: string;
      guardianRelationship: string;
      guardianConsentGiven: boolean;
      guardianAudioConsentGiven: boolean;
      guardianConsentRecordedAt: string;
      guardianConsentSource: string;
    },
    targetTab?: AppTabId
  ) => void;
  onSelectExistingDemoJourney: (studentId: string, targetTab: AppTabId) => void;
  onNavigateTab: (tab: AppTabId) => void;
  onSelectStudentReport: (studentId: string) => void;
}

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/** Illustrative profile of a hypothetical child, used only on this page. */
const SAMPLE_PROFILE = [
  { domain: 'visualMemory', centile: 64 },
  { domain: 'auditoryMemory', centile: 17 },
  { domain: 'phonological', centile: 4 },
  { domain: 'perceptual', centile: 41 },
  { domain: 'alphabetic', centile: 12 },
] as const;

function SampleProfileCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="bz-card overflow-hidden" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-line">
        <div>
          <p className="bz-small bz-muted">الملف المعرفي · نموذج توضيحي</p>
          <p className="font-display font-bold text-ink text-lg mt-0.5">سارة · ٦ سنوات و٤ أشهر</p>
        </div>
        <span className="bz-badge bz-badge-risk">مؤشر خطر مرتفع</span>
      </div>
      <div className="px-5 py-4 space-y-3.5">
        {SAMPLE_PROFILE.map((row) => {
          const band = bandOf(row.centile);
          return (
            <div key={row.domain} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink leading-tight truncate">{DOMAINS[row.domain].nameAr.replace(' والتعلّم الترابطي', '')}</p>
                {!compact && <p className="text-[12px] text-muted leading-tight mt-0.5">{BAND_META[band].labelAr}</p>}
              </div>
              <CentileTrack centile={row.centile} size={compact ? 'sm' : 'md'} label={DOMAINS[row.domain].nameAr} />
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3.5 bg-soft border-t border-line flex flex-wrap items-center justify-between gap-2">
        <span className="bz-small text-ink-2">
          <strong className="text-ink">النمط:</strong> صوتي-سمعي
        </span>
        <span className="bz-small text-brand font-semibold">خطة ٨ أسابيع جاهزة</span>
      </div>
    </div>
  );
}

export const HomeLandingView: React.FC<HomeLandingViewProps> = ({
  onStartMockUserJourney,
  onNavigateTab,
}) => {
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [newLearnerName, setNewLearnerName] = useState('');
  const [newLearnerGrade, setNewLearnerGrade] = useState<number>(1);
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('ولي أمر');
  const [institutionalRef, setInstitutionalRef] = useState('');
  const [guardianConsentChecked, setGuardianConsentChecked] = useState(false);
  const [guardianAudioConsentChecked, setGuardianAudioConsentChecked] = useState(false);

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

  const handleLaunchCleanLearner = () => {
    const clean = newLearnerName.trim();
    if (!clean || !guardianConsentChecked) return;

    const consentSource =
      guardianRelationship === 'معلم / أخصائي مدرسي'
        ? `إقرار تفويض مدرسي (${guardianName.trim() || 'معلم مصرح'} - مرجع التفويض: ${institutionalRef.trim() || 'تفويض مدرسي رسمي معتمد'})`
        : guardianRelationship === 'وصي قانوني'
        ? `إقرار وصي قانوني (${guardianName.trim() || 'الوصي القانوني'})`
        : `إقرار ولي أمر (${guardianName.trim() || 'ولي الأمر'} - الأب/الأم)`;

    onStartMockUserJourney(
      clean,
      newLearnerGrade,
      'متعلّم جديد',
      {
        guardianName: guardianName.trim() || 'ولي أمر الطالب',
        guardianRelationship: guardianRelationship.trim() || 'ولي أمر',
        guardianConsentGiven: true,
        guardianAudioConsentGiven: guardianAudioConsentChecked,
        guardianConsentRecordedAt: new Date().toISOString(),
        guardianConsentSource: consentSource,
      },
      'sprint'
    );
    setShowOnboardingModal(false);
  };

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
              اكتشف مبكرًا ما يعيق طفلك عن القراءة،{' '}
              <span className="text-brand">ودرّبه على ما يحتاجه بالضبط.</span>
            </h1>
            <p className="bz-lead mt-6 max-w-[38rem]">
              تسع ألعاب قصيرة ترسم ملفًا معرفيًا لطفلك مقارنةً بأقرانه في العمر: الذاكرة السمعية والبصرية، والوعي الصوتي، والتمييز، ومعرفة الحروف. ثم تبني له بصيرة برنامجًا تدريبيًا عربيًا لثمانية أسابيع يتكيّف مع تقدّمه.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={() => onNavigateTab('dyslexia-lab')}>
                ابدأ الفحص الشامل
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
                { k: `${ar(BATTERY.length)} ألعاب`, v: 'في ٥ مجالات' },
                { k: `${ar(PROGRAM_WEEKS)} أسابيع`, v: 'برنامج تدريبي' },
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
                  <span className="block text-[13px] font-semibold text-ink">الجلسة ٣ من ٣٢</span>
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
          <span className="bz-eyebrow">لماذا بصيرة؟</span>
          <h2 className="bz-h2">صعوبة القراءة تُكتشف عادةً متأخرة، بعد أن يفقد الطفل ثقته بنفسه.</h2>
          <p className="bz-lead">
            يعاني بين ٥٪ و١٠٪ من الأطفال صعوبةً محددة في تعلّم القراءة وفق معظم التقديرات، وأثر التدخل يكون أكبر كلما بدأ مبكرًا. لكن الأدوات المتاحة بالعربية قليلة، ومعظمها مترجم.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: Timer,
              title: 'قبل أن يتعثّر في الصف',
              body: 'نقيس المهارات التي تسبق القراءة وتتنبأ بها، فيمكن رصد الخطر من عمر أربع سنوات، قبل أن يظهر الفشل القرائي.',
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
                body: 'يلعب الطفل تسع ألعاب قصيرة بتعليمات مسموعة. كل لعبة تبدأ بتدريب، ثم بنود الفحص دون تصحيح.',
              },
              {
                icon: FileBarChart,
                title: 'افهم',
                meta: 'تقرير فوري',
                body: 'ملف بياني يقارن الطفل بعمره، ومؤشر خطر مبكر، ونمط الصعوبة، وما تعنيه كل نتيجة للمعلم والأسرة.',
              },
              {
                icon: Dumbbell,
                title: 'درّب',
                meta: `${ar(PROGRAM_WEEKS)} أسابيع · ${ar(SESSIONS_PER_WEEK)} جلسات أسبوعيًا`,
                body: 'برنامج يركّز على المهارات الأضعف، ويرفع المستوى عند الإتقان أو يخفضه وينبّه المعلم عند التعثّر.',
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
            <span className="bz-eyebrow">الفحص المعرفي الشامل</span>
            <h2 className="bz-h2">تسع ألعاب، خمسة مجالات، صورة كاملة</h2>
            <p className="bz-lead">كل لعبة تقيس مهارة واحدة بدقة، فيعرف المعلم إن كانت الصعوبة في الذاكرة السمعية، أو التحليل الصوتي، أو الذاكرة البصرية.</p>
          </div>
          <button type="button" className="bz-btn bz-btn-secondary shrink-0" onClick={() => onNavigateTab('dyslexia-lab')}>
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
              <h2 className="bz-h2">تقرير يفهمه المعلم والأسرة، ويثق به الأخصائي</h2>
              <p className="bz-lead">يظهر أداء الطفل في كل مهارة على مقياس مئيني مقارنةً بأقرانه في العمر، مع تفسير واضح لما تعنيه النتيجة.</p>
            </div>
            <ul className="space-y-4">
              {[
                ['مؤشر خطر مبكر', 'مرتفع أو متوسط أو منخفض، مبني على المهارات الأكثر ارتباطًا بتعلّم القراءة.'],
                ['نمط الصعوبة', 'صوتي-سمعي، أو بصري، أو مختلط، أو انخفاض عام يستدعي تقييمًا أشمل.'],
                ['لكل ضعف: ماذا نفعل؟', 'استراتيجيات صفية وأنشطة منزلية محددة، وجدول درجات تفصيلي للأخصائي.'],
                ['مؤشرات صلاحية التطبيق', 'تنبيه تلقائي عند إجابات متسرعة أو قريبة من التخمين.'],
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
            <div className="bz-card p-5">
              <BandLegend />
            </div>
            <article className="bz-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
                <h3 className="bz-h3">الوعي الصوتي</h3>
                <span className={BAND_META.severe.badge}>ضعف واضح</span>
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
            <p className="bz-small bz-muted px-1">بيانات افتراضية لأغراض التوضيح فقط.</p>
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
                يختار البرنامج حتى ثلاث مهارات من أضعف نتائج الفحص، ويرتّبها نمائيًا. كل مهارة لها ثلاثة مستويات، والتمارين تُوَلَّد جديدة في كل جلسة ولا تكرر بنود الفحص.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { k: `${ar(MINUTES_PER_SESSION)} دقيقة`, v: 'للجلسة' },
                { k: `${ar(SESSIONS_PER_WEEK)} جلسات`, v: 'أسبوعيًا' },
                { k: `${ar(PROGRAM_WEEKS)} أسابيع`, v: 'ثم إعادة فحص' },
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
                <p className="bz-small text-ink-2 mt-1">عند {ar(MASTERY_PERCENT)}٪ فأكثر في جلستين متتاليتين.</p>
              </div>
              <div className="rounded-xl p-4 bg-sun-soft border border-line">
                <p className="font-semibold text-sun-strong">يعود مستوى وينبّه المعلم</p>
                <p className="bz-small text-ink-2 mt-1">عند أقل من {ar(STEP_BACK_PERCENT)}٪ في جلستين متتاليتين.</p>
              </div>
            </div>
            <p className="mt-6 bz-small bz-muted">
              المهارات: {Object.values(SKILLS).map((s) => s.nameAr).join('، ')}.
            </p>
          </div>
        </div>
      </section>

      {/* ================= AUDIENCES ================= */}
      <section className="bg-card border-y border-line">
        <div className="bz-container py-16 sm:py-24">
          <div className="bz-section-head is-center">
            <span className="bz-eyebrow">لمن صُممت بصيرة</span>
            <h2 className="bz-h2">أداة واحدة، ثلاثة مستخدمين</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <article className="bz-card bz-card-pad flex flex-col">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-sun-soft text-sun-strong" aria-hidden="true"><Users size={22} /></span>
              <h3 className="bz-h3 mt-5">الأسر</h3>
              <p className="bz-body mt-2 flex-1">افهم سبب تعثّر طفلك بلغة واضحة، واحصل على أنشطة منزلية قصيرة وبرنامج يومي يتابع تقدّمه.</p>
              <div className="mt-6 grid gap-2">
                <button type="button" className="bz-btn bz-btn-primary" onClick={() => onNavigateTab('dyslexia-lab')}>ابدأ الفحص</button>
                <button type="button" className="bz-btn bz-btn-ghost" onClick={() => setShowOnboardingModal(true)}>
                  <UserPlus size={17} aria-hidden="true" /> ابدأ التدريب كمتعلّم جديد
                </button>
              </div>
            </article>
            <article className="bz-card bz-card-pad flex flex-col" style={{ borderColor: 'color-mix(in srgb, var(--brand) 40%, transparent)', boxShadow: 'var(--shadow-md)' }}>
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-soft text-brand" aria-hidden="true"><Building2 size={22} /></span>
              <h3 className="bz-h3 mt-5">المدارس ومراكز التعلّم</h3>
              <p className="bz-body mt-2 flex-1">فرز مبكر لصفوف كاملة، ولوحة متابعة للمعلم، وتقارير فردية تساعد على توجيه الدعم لمن يحتاجه أولًا.</p>
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
              <p className="bz-body mt-2 flex-1">درجات خام ومئينات وأزمنة استجابة لكل اختبار، ومؤشرات صلاحية التطبيق، وأدوات تكميلية للقراءة الجهرية.</p>
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
              نعلن بوضوح ما تقيسه بصيرة وما لا تقيسه. الفحص أداة فرز مبكر توجّه التدريب والإحالة، وليس تشخيصًا طبيًا.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: ClipboardCheck, t: 'تطبيق معياري', b: 'بنود ثابتة بترتيب ثابت، وقواعد إيقاف، وتدريب قبل كل اختبار، وتسجيل أزمنة الاستجابة.' },
              { icon: FlaskConical, t: 'منهج تعليم منظّم', b: 'برنامج صريح ومتدرّج يتبع مبادئ التعليم المنظّم للقراءة (Structured Literacy).' },
              { icon: EyeOff, t: 'بلا كاميرا', b: 'لا تتبع للعين ولا تصوير. يعمل الفحص بالصوت واللمس فقط.' },
              { icon: Lock, t: 'خصوصية الطفل أولًا', b: 'موافقة ولي الأمر قبل البدء، وتقليل البيانات، وحفظ النتائج على الجهاز ما لم تسجّل المدرسة الدخول.' },
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
                <strong className="text-ink">مرحلة التحقق العلمي:</strong> المقارنة العمرية الحالية مبنية على جدول مرجعي مؤقت يُعلَن في كل تقرير، إلى أن تكتمل دراسة التقنين على عينة عربية (٥٠٠ طفل فأكثر) مع قياس الثبات والصدق التنبؤي.
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
            نصف ساعة اليوم قد توفّر على طفلك سنوات من التعثّر.
          </h2>
          <p className="relative mt-4 text-[17px] leading-relaxed max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,.82)' }}>
            ابدأ الفحص الآن، واحصل على الملف المعرفي وخطة التدريب فور انتهاء الألعاب.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" className="bz-btn bz-btn-sun bz-btn-lg" onClick={() => onNavigateTab('dyslexia-lab')}>
              ابدأ الفحص الشامل <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" className="bz-btn bz-btn-outline-light bz-btn-lg" onClick={() => onNavigateTab('remediation-gym')}>
              صالة التدريب
            </button>
          </div>
        </div>
      </section>

      {/* ================= MODAL: NEW LEARNER ================= */}
      {showOnboardingModal && (
        <div className="bz-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowOnboardingModal(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="bz-modal space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-soft text-brand"><UserPlus size={22} /></span>
                <div>
                  <h3 id="onboarding-title" className="bz-h3">بدء رحلة متعلم جديد</h3>
                  <p className="bz-small bz-muted">ملف تدريبي جديد للصفوف من ١ إلى ٤</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowOnboardingModal(false)} aria-label="إغلاق" className="bz-icon-btn"><X size={18} /></button>
            </div>

            <label className="bz-field">
              <span className="bz-label">اسم الطفل المستعار أو اللقب</span>
              <input type="text" value={newLearnerName} onChange={(e) => setNewLearnerName(e.target.value)} placeholder="مثال: سارة أو أحمد" className="bz-input" required />
              <span className="bz-hint">لا تستخدم الاسم الكامل الحقيقي للطفل، حمايةً لخصوصيته.</span>
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="bz-field">
                <span className="bz-label">اسم ولي الأمر أو المعلم</span>
                <input type="text" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="اختياري" className="bz-input" />
              </label>
              <label className="bz-field">
                <span className="bz-label">الصفة</span>
                <select value={guardianRelationship} onChange={(e) => setGuardianRelationship(e.target.value)} className="bz-input">
                  <option value="ولي أمر">ولي أمر (الأب / الأم)</option>
                  <option value="وصي قانوني">وصي قانوني</option>
                  <option value="معلم / أخصائي مدرسي">معلم / أخصائي مدرسي</option>
                </select>
              </label>
            </div>

            {guardianRelationship === 'معلم / أخصائي مدرسي' && (
              <label className="bz-field">
                <span className="bz-label">مرجع التفويض المدرسي</span>
                <input type="text" value={institutionalRef} onChange={(e) => setInstitutionalRef(e.target.value)} placeholder="مثال: كتاب تفويض الإدارة رقم 2026/41" className="bz-input" />
              </label>
            )}

            <div className="bz-field">
              <span className="bz-label">الصف الدراسي</span>
              <div className="bz-segment w-full grid grid-cols-4">
                {[1, 2, 3, 4].map((grade) => (
                  <button key={grade} type="button" onClick={() => setNewLearnerGrade(grade)} aria-pressed={newLearnerGrade === grade} className="justify-center">
                    الصف {ar(grade)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="bz-check">
                <input type="checkbox" checked={guardianConsentChecked} onChange={(e) => setGuardianConsentChecked(e.target.checked)} />
                <span className="bz-small text-ink-2">
                  <strong className="text-ink">مطلوب · </strong>
                  {guardianRelationship === 'معلم / أخصائي مدرسي' ? (
                    <>أقر بصفتي معلماً أو أخصائياً مخولاً بوجود تفويض من إدارة المدرسة وموافقة مسبقة من ولي أمر الطالب على استخدام بصيرة وفق سياسة الخصوصية.</>
                  ) : guardianRelationship === 'وصي قانوني' ? (
                    <>أقر بصفتي الوصي القانوني على الطالب بالموافقة على إنشاء ملف تدريبي واستخدام بصيرة وفق سياسة الخصوصية.</>
                  ) : (
                    <>أقر بصفتي ولي أمر الطالب (الأب / الأم) بالموافقة على إنشاء ملف تدريبي للطفل واستخدام بصيرة وفق سياسة الخصوصية.</>
                  )}
                </span>
              </label>
              <label className="bz-check">
                <input type="checkbox" checked={guardianAudioConsentChecked} onChange={(e) => setGuardianAudioConsentChecked(e.target.checked)} />
                <span className="bz-small text-ink-2">
                  <strong className="text-ink">اختياري · </strong>
                  أوافق على معالجة قراءة الطفل صوتيًا عبر التعرف الآلي على الكلام في أنشطة القراءة الجهرية. يمكن استخدام المنصة كاملة دون أي تسجيل صوتي.
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={handleLaunchCleanLearner} disabled={!guardianConsentChecked || newLearnerName.trim().length < 2} className="bz-btn bz-btn-primary flex-1">
                انطلق في تدريب اليوم <ArrowLeft size={18} />
              </button>
              <button type="button" onClick={() => setShowOnboardingModal(false)} className="bz-btn bz-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

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
                <p className="bz-body max-w-sm mx-auto">شكرًا لاهتمامكم. سيتواصل معكم فريق بصيرة عبر البريد الرسمي لترتيب جلسة تعريفية وتفعيل حساب تجريبي.</p>
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
