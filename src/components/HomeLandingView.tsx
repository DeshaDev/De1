import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  Gamepad2,
  GraduationCap,
  Heart,
  Lightbulb,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  User,
  UserPlus,
  Users,
  Volume2,
  Zap,
  Building2,
  Lock,
} from 'lucide-react';
import { StudentRecord } from '../data/seedData';

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
  | 'trophies';

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

const SAMPLE_WORDS = [
  { text: 'في', hint: 'كلمة قصيرة تساعدنا على بدء الجملة.' },
  { text: 'صَباحٍ', hint: 'متى بدأت القصة؟ في الصباح.' },
  { text: 'جَميلٍ', hint: 'كلمة تصف الصباح.' },
  { text: 'خَرَجَتْ', hint: 'فعل يخبرنا بما حدث.' },
  { text: 'سَلْمَى', hint: 'هذه بطلة قصتنا.' },
  { text: 'إلى', hint: 'كلمة تساعدنا على معرفة الاتجاه.' },
  { text: 'الحَديقَةِ', hint: 'إلى أين ذهبت سلمى؟ إلى الحديقة.' },
] as const;

const ACTIVITIES = [
  {
    id: 'cognitive-lab',
    title: 'استكشاف مهارات القراءة',
    description: 'أنشطة قصيرة للتسمية وقراءة كلمات تدريبية والوعي بالأصوات؛ نتائجها وصفية وليست تشخيصًا.',
    action: 'استكشف المهارات',
    tone: 'blue',
    icon: Brain,
  },
  {
    id: 'reading-lab',
    title: 'رحلة القراءة والطلاقة',
    description: 'اقرأ نصًا قصيرًا مشكولاً بصوتك أو صامتاً، ثم أجب عن أسئلة الفهم القرائي.',
    action: 'ابدأ القراءة',
    tone: 'blue',
    icon: BookOpen,
  },
  {
    id: 'adaptive-reader',
    title: 'القارئ الميسّر',
    description: 'غيّر طريقة عرض الكلمات، مسافات الأسطر، واستمع إلى نطقها لمساعدة القارئ.',
    action: 'افتح القارئ',
    tone: 'pink',
    icon: Heart,
  },
  {
    id: 'remediation-gym',
    title: 'صالة التدريب القرائي',
    description: 'تدرّب على الحروف والمقاطع وقراءة النصوص بالوتيرة التي تناسبك.',
    action: 'هيا نتدرّب',
    tone: 'mint',
    icon: Gamepad2,
  },
] as const;

function speakArabicWord(word: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech playback is optional; reading and navigation remain available.
  }
}

export const HomeLandingView: React.FC<HomeLandingViewProps> = ({
  students,
  activeStudent,
  onStartMockUserJourney,
  onSelectExistingDemoJourney,
  onNavigateTab,
  onSelectStudentReport,
}) => {
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [autoPreview, setAutoPreview] = useState(true);
  const [motionAllowed, setMotionAllowed] = useState(true);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [newLearnerName, setNewLearnerName] = useState('البطل الصغير');
  const [newLearnerGrade, setNewLearnerGrade] = useState<number>(3);
  const [guardianConsentChecked, setGuardianConsentChecked] = useState(true);

  const selectedWord = SAMPLE_WORDS[activeWordIndex] || SAMPLE_WORDS[0];
  const demoStudent = students.find((student) => student.isDemoRecord) || students[0];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setMotionAllowed(!reduced);
    if (reduced) setAutoPreview(false);
  }, []);

  useEffect(() => {
    if (!autoPreview || !motionAllowed) return;
    const timer = window.setInterval(() => {
      setActiveWordIndex((current) => (current + 1) % SAMPLE_WORDS.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [autoPreview, motionAllowed]);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const handleLaunchCleanLearner = () => {
    const clean = newLearnerName.trim() || 'البطل الصغير';
    onStartMockUserJourney(
      clean,
      newLearnerGrade,
      'متعلّم جديد',
      {
        guardianName: 'ولي الأمر',
        guardianRelationship: 'ولي أمر / معلم',
        guardianConsentGiven: guardianConsentChecked,
        guardianAudioConsentGiven: false,
        guardianConsentRecordedAt: new Date().toISOString(),
        guardianConsentSource: 'بدء رحلة جديدة من الواجهة الرئيسية',
      },
      'sprint'
    );
    setShowOnboardingModal(false);
  };

  return (
    <div className="baseera-home" dir="rtl">
      {/* SECTION 1: HERO VALUE PROPOSITION */}
      <section className="baseera-hero" aria-labelledby="baseera-welcome-title">
        <div className="baseera-hero-copy">
          <div className="baseera-eyebrow">
            <Sparkles aria-hidden="true" size={18} />
            <span>تدريب تكويني يومي لدعم مهارات القراءة واللغة العربية</span>
          </div>
          <h1 id="baseera-welcome-title">
            تدريب يومي قصير بالعربية
            <span> لأطفال الصفوف 1–4 لتمكين القراءة وفك الكلمات بثقة.</span>
          </h1>
          <p className="baseera-hero-intro">
            بصيرة: بيئة تدريب استدراكية تفاعلية بالعربية لأطفال الصفوف 1–4 لتقوية الوعي الصوتي والطلاقة وفهم المقروء. نرصد مؤشرات التعثر بالأدلة العلمية، وندرّب الطفل بالتدريج، ونمنح الأهل والمعلم رؤية واضحة دون أي ادعاء بالتشخيص السريري.
          </p>

          {/* TWO CLEAR PATHS: NEW LEARNER vs DEMO PORTFOLIO */}
          <div className="baseera-hero-paths-container mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="baseera-primary-action flex items-center gap-2 cursor-pointer"
                onClick={() => setShowOnboardingModal(true)}
              >
                <UserPlus aria-hidden="true" size={19} />
                <span>ابدأ كمتعلّم جديد (سجل نظيف · 0 XP)</span>
              </button>

              {demoStudent && (
                <button
                  type="button"
                  className="baseera-secondary-action flex items-center gap-2 cursor-pointer"
                  onClick={() => onSelectExistingDemoJourney(demoStudent.id, 'dashboard')}
                >
                  <Building2 aria-hidden="true" size={18} />
                  <span>استعراض لوحة المعلم والمدرسة (Demo)</span>
                </button>
              )}
            </div>

            {/* Quick Action Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-200/60">
              <span className="text-xs font-bold text-slate-500">أو جرّب مباشرة:</span>
              <button
                type="button"
                className="text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-full border border-teal-200 transition-colors cursor-pointer flex items-center gap-1.5"
                onClick={() => onNavigateTab('sprint')}
              >
                <Zap size={14} className="text-amber-500" />
                <span>تدريب اليوم السريع (٥ دقائق)</span>
              </button>
              <button
                type="button"
                className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
                onClick={() => onNavigateTab('dyslexia-lab')}
              >
                <BookOpen size={14} className="text-blue-500" />
                <span>مقياس مؤشرات التعثر القرائي</span>
              </button>
              <button
                type="button"
                className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
                onClick={() => onNavigateTab('adaptive-reader')}
              >
                <Heart size={14} className="text-pink-500" />
                <span>القارئ الميسّر</span>
              </button>
            </div>
          </div>

          <div className="baseera-promise-row" aria-label="مميزات بصيرة">
            <span><ShieldCheck aria-hidden="true" size={18} /> مسار مهارات متدرج مبني على الأدلة التربوية</span>
            <span><Heart aria-hidden="true" size={18} /> توجيه صريح للمختص المعتمد دون ادعاء تشخيص سريري</span>
          </div>
        </div>

        <div className="baseera-hero-art" aria-hidden="true">
          <span className="baseera-art-star baseera-art-star-one"><Star size={25} fill="currentColor" /></span>
          <span className="baseera-art-star baseera-art-star-two"><Sparkles size={28} /></span>
          <span className="baseera-art-dot baseera-art-dot-one" />
          <span className="baseera-art-dot baseera-art-dot-two" />
          <div className="baseera-art-note baseera-art-note-top">خطوة جديدة كل يوم!</div>
          <div className="baseera-art-book">
            <BookOpen size={88} strokeWidth={1.7} />
            <span className="baseera-art-book-line" />
            <span className="baseera-art-book-line short" />
            <span className="baseera-art-book-line" />
          </div>
          <div className="baseera-art-note baseera-art-note-bottom">
            <Trophy aria-hidden="true" size={22} />
            <span>أبطال القراءة العربية</span>
          </div>
        </div>
      </section>

      {/* MODAL: ONBOARDING FOR NEW LEARNER */}
      {showOnboardingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-right space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center">
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 id="onboarding-title" className="text-xl font-black text-slate-900">
                    بدء رحلة متعلم جديد
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    سجل نظيف بـ 0 XP وتدريب مخصص من الصفوف 1 إلى 4
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOnboardingModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  اسم الطفل المستعار أو اللقب:
                </label>
                <input
                  type="text"
                  value={newLearnerName}
                  onChange={(e) => setNewLearnerName(e.target.value)}
                  placeholder="مثال: البطل الصغير أو سارة"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  لا تستخدم الاسم الكامل الحقيقي للطفل للحفاظ على خصوصيته.
                </span>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  الصف الدراسي:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => setNewLearnerGrade(grade)}
                      className={`py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        newLearnerGrade === grade
                          ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      الصف {grade}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={guardianConsentChecked}
                    onChange={(e) => setGuardianConsentChecked(e.target.checked)}
                    className="mt-0.5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="font-bold leading-relaxed">
                    أوافق كولي أمر / معلم على بدء التدريب التكويني القرائي واستخدام التطبيق وفقاً لسياسة الخصوصية وقانون حماية البيانات القطري.
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleLaunchCleanLearner}
                className="flex-1 baseera-primary-action justify-center py-3 text-sm cursor-pointer"
              >
                انطلق في تدريب اليوم (0 XP)
                <ArrowLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setShowOnboardingModal(false)}
                className="px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: INTERACTIVE READING PREVIEW */}
      <section className="baseera-preview-section" aria-labelledby="baseera-reading-preview-title">
        <div className="baseera-section-heading">
          <div>
            <span className="baseera-section-kicker">جرّب بنفسك</span>
            <h2 id="baseera-reading-preview-title">محاكاة جلسة القراءة التفاعلية</h2>
            <p>انقر على كلمة لتحديدها أو الاستماع إلى نطقها.</p>
          </div>
          <button
            type="button"
            className="baseera-preview-toggle"
            onClick={() => setAutoPreview((value) => !value)}
            aria-pressed={autoPreview}
          >
            {autoPreview
              ? <Pause aria-hidden="true" size={17} />
              : <Play aria-hidden="true" size={17} />}
            {autoPreview ? 'إيقاف الحركة' : 'تشغيل الحركة'}
          </button>
        </div>

        <div className="baseera-reading-preview">
          <div className="baseera-story-topline">
            <span className="baseera-story-label"><BookOpen aria-hidden="true" size={17} /> قصة قصيرة</span>
            <span className="baseera-story-grade">مثال تفاعلي · الصف {activeStudent.gradeLevel}</span>
          </div>
          <p className="baseera-story-sentence" dir="rtl" lang="ar">
            {SAMPLE_WORDS.map((item, index) => (
              <button
                key={item.text}
                type="button"
                className={'baseera-story-word' + (index === activeWordIndex ? ' is-active' : '')}
                onClick={() => {
                  setAutoPreview(false);
                  setActiveWordIndex(index);
                  speakArabicWord(item.text);
                }}
                aria-pressed={index === activeWordIndex}
                aria-label={'اختر كلمة ' + item.text}
              >
                {item.text}
              </button>
            ))}
          </p>
          <div className="baseera-word-support">
            <div className="baseera-word-explanation">
              <span className="baseera-word-label">الكلمة التي اخترتها</span>
              <strong>{selectedWord.text}</strong>
              <p>{selectedWord.hint}</p>
            </div>
            <button
              type="button"
              className="baseera-listen-action"
              onClick={() => speakArabicWord(selectedWord.text)}
            >
              <Volume2 aria-hidden="true" size={19} />
              استمع إلى الكلمة
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 3: CORE LEARNING DOMAINS */}
      <section className="baseera-activities-section" aria-labelledby="baseera-activities-title">
        <div className="baseera-section-heading">
          <div>
            <span className="baseera-section-kicker">مساحات التعلّم</span>
            <h2 id="baseera-activities-title">ماذا نجرّب اليوم؟</h2>
            <p>أربع مساحات للممارسة والتعلّم، اختر منها ما يناسب هدفك.</p>
          </div>
        </div>
        <div className="baseera-activity-grid">
          {ACTIVITIES.map((activity) => {
            const Icon = activity.icon;
            return (
              <button
                key={activity.id}
                type="button"
                className={'baseera-activity-card baseera-tone-' + activity.tone}
                onClick={() => onNavigateTab(activity.id)}
              >
                <span className="baseera-activity-icon"><Icon aria-hidden="true" size={29} /></span>
                <span className="baseera-activity-title">{activity.title}</span>
                <span className="baseera-activity-description">{activity.description}</span>
                <span className="baseera-activity-link">
                  {activity.action}
                  <ChevronLeft aria-hidden="true" size={18} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* SECTION 4: THE 4-STEP PEDAGOGICAL JOURNEY */}
      <section className="baseera-steps-section" aria-labelledby="baseera-steps-title">
        <div className="baseera-section-heading">
          <div>
            <span className="baseera-section-kicker">رحلة الدعم المتدرج</span>
            <h2 id="baseera-steps-title">رحلتك في أربع خطوات واضحة</h2>
          </div>
        </div>
        <div className="baseera-steps-grid">
          <article className="baseera-step-card">
            <span className="baseera-step-number">١</span>
            <div className="baseera-step-icon"><Lightbulb aria-hidden="true" size={25} /></div>
            <h3>رصد استطلاعي مبكر (١٠ دقائق)</h3>
            <p>رصد مؤشرات التعثر في الوعي الصوتي وفك الكلمات والطلاقة دون إجهاد للطفل، استناداً إلى أدلة علمية.</p>
          </article>
          <article className="baseera-step-card">
            <span className="baseera-step-number">٢</span>
            <div className="baseera-step-icon"><Brain aria-hidden="true" size={25} /></div>
            <h3>مسار استدراك مخصص (٣ مهارات)</h3>
            <p>تحديد المهارات المستهدفة بالتقوية وفق منهجية تراكمية متدرجة من تمييز الحرف والمقطع إلى قراءة النص.</p>
          </article>
          <article className="baseera-step-card">
            <span className="baseera-step-number">٣</span>
            <div className="baseera-step-icon"><Star aria-hidden="true" size={25} /></div>
            <h3>تدريب يومي ممتع (٥–١٠ دقائق)</h3>
            <p>جلسات تفاعلية قصيرة تركز على مخارج الأصوات، التمييز البصري، وقراءة النصوص المشكولة وتثبيتها.</p>
          </article>
          <article className="baseera-step-card">
            <span className="baseera-step-number">٤</span>
            <div className="baseera-step-icon"><Trophy aria-hidden="true" size={25} /></div>
            <h3>متابعة موضوعية وتوجيه للأهل</h3>
            <p>لوحة متابعة تكوينية تُظهر التقدم والتيسيرات الصفية، مع توجيه صريح للمختصين المعتمدين عند الحاجة.</p>
          </article>
        </div>
      </section>

      {/* SECTION 5: COMMERCIAL MODEL & PRICING PLANS */}
      <section className="baseera-pricing-section" aria-labelledby="baseera-pricing-title">
        <div className="baseera-section-heading">
          <div>
            <span className="baseera-section-kicker">الاستدامة والجاهزية التجارية</span>
            <h2 id="baseera-pricing-title">خطط الاشتراكات للمدارس والأسر</h2>
            <p>حلول مصممة لدعم أقسام الدعم الإضافي في المدارس، وتوفير تدريب منزلي ميسّر للأسر.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
          {/* Tier 1: Family B2C */}
          <div className="p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between text-right relative hover:shadow-md transition-shadow">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-800 border border-blue-200 mb-3">
                <Heart size={14} />
                <span>للأسر والمنازل (B2C)</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">باقة رفيق القراءة</h3>
              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-black text-slate-900 font-mono">49</span>
                <span className="text-sm font-bold text-slate-500">ر.ق / شهرياً</span>
                <span className="text-xs text-slate-400 mr-2">(أو 399 ر.ق / سنوياً - توفير شهرين)</span>
              </div>
              <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                ممارسة منزلية يومية مبهجة تبني ثقة طفلك في القراءة خطوة بخطوة مع تقرير أسبوعي لولي الأمر.
              </p>

              <ul className="space-y-3 text-xs text-slate-700 font-medium mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
                  <span>تدريب سبرنت اليومي (٥–١٠ دقائق) ومكتبة الألعاب القرائية</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
                  <span>القارئ الميسّر بألوان وأسطر مكيفة لدعم تعثر القراءة</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
                  <span>تقرير دوري لولي الأمر مع رصد الفجوات وتوجيه المختص</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
                  <span>خصوصية تامة وحماية صوت الطفل وفق قانون حماية البيانات القطري</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              className="baseera-primary-action w-full justify-center py-3.5 text-sm cursor-pointer"
              onClick={() => setShowOnboardingModal(true)}
            >
              ابدأ التجربة المجانية (٧ أيام)
              <ArrowLeft size={17} />
            </button>
          </div>

          {/* Tier 2: School Enterprise B2B */}
          <div className="p-6 sm:p-8 rounded-3xl border-2 border-emerald-500 bg-gradient-to-b from-emerald-50/40 via-white to-white shadow-md flex flex-col justify-between text-right relative hover:shadow-lg transition-shadow">
            <div className="absolute -top-3.5 left-6 bg-emerald-600 text-white text-[11px] font-black px-3 py-1 rounded-full shadow-xs">
              الخيار المعتمد للمؤسسات
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 mb-3">
                <Building2 size={14} />
                <span>للمدارس ومراكز التعلم (B2B)</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">باقة المؤسسات والمدارس</h3>
              <div className="flex items-baseline gap-1 my-3">
                <span className="text-2xl font-black text-emerald-900 font-sans">ترخيص سنوي</span>
                <span className="text-xs font-bold text-slate-600">/ مقعد طالب حسب الحجم</span>
              </div>
              <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                حل متكامل لأقسام الدعم التعليمي الإضافي وغرف مصادر التعلم لمتابعة أفواج الطلبة وتوليد تقارير معتمدة.
              </p>

              <ul className="space-y-3 text-xs text-slate-700 font-medium mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                  <span>لوحة تحكم المعلم الشاملة لإدارة الفصول ورصد التقدم التكويني</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                  <span>تقارير تربوية جاهزة لخطط التعلم الفردية (IEP) ومراجعة الأخصائي</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                  <span>صلاحيات متعددة المستويات (RBAC) وتشفير محلي صارم AES-256</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                  <span>دعم تأهيلي لمعلمي اللغة العربية وأخصائيي مصادر التعلم</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              className="w-full py-3.5 px-5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
              onClick={() => {
                alert('شكراً لاهتمامكم! تم تسجيل طلب الشراكة لمدرستكم وسيتواصل معكم فريق حلول المؤسسات في بصيرة خلال ٢٤ ساعة عمل.');
              }}
            >
              طلب تجربة مدرسة / شريك تجريبي (Pilot)
              <Building2 size={17} />
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 6: GOVERNANCE & REPORT ACCESS */}
      <section className="baseera-family-panel" aria-labelledby="baseera-family-title">
        <div className="baseera-family-icon"><GraduationCap aria-hidden="true" size={30} /></div>
        <div className="baseera-family-copy">
          <h2 id="baseera-family-title">ملخص التعلّم والمتابعة التكوينية</h2>
          <p>
            تقيس بصيرة الأداء داخل أنشطة قرائية محددة، ولا تدّعي تشخيص عسر القراءة (الديسلكسيا). يجري تطوير المنصة والتحقق من مؤشرات أدائها؛ ولا ينبغي اعتبار النتائج الحالية معايير سكانية أو دليلاً سريرياً، بل مؤشرات استرشادية لمساعدة المعلم والأسرة.
          </p>
        </div>
        <div className="baseera-family-actions">
          <button
            type="button"
            className="baseera-secondary-action"
            onClick={() => onSelectStudentReport(activeStudent.id)}
          >
            عرض ملخص التعلّم
            <ArrowLeft aria-hidden="true" size={18} />
          </button>
          {demoStudent && (
            <button
              type="button"
              className="baseera-text-action font-bold"
              onClick={() => onSelectExistingDemoJourney(demoStudent.id, 'dashboard')}
            >
              استعراض نموذج توضيحي مكتمل
            </button>
          )}
        </div>
      </section>

      <div className="baseera-kind-note">
        <CheckCircle2 aria-hidden="true" size={19} />
        <p>لا توجد إجابات تجعلك أقلّ قدرة من غيرك؛ كل محاولة فرصة جديدة لتثبيت مهارة القراءة.</p>
      </div>
    </div>
  );
};

export default HomeLandingView;
