import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Building2,
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
  UserPlus,
  Volume2,
  Zap,
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
  { text: 'فِي', hint: 'كلمة قصيرة تساعدنا على بدء الجملة.' },
  { text: 'صَبَاحٍ', hint: 'متى بدأت القصة؟ في الصباح المشرق.' },
  { text: 'جَمِيلٍ', hint: 'كلمة تصف جمال اليوم.' },
  { text: 'خَرَجَتْ', hint: 'فعل يخبرنا بحركة سلمى.' },
  { text: 'سَلْمَى', hint: 'هذه بطلة قصتنا اللطيفة.' },
  { text: 'إِلَى', hint: 'كلمة توجّهنا نحو المكان.' },
  { text: 'الحَدِيقَةِ', hint: 'وجهة سلمى حيث الأزهار والأشجار.' },
] as const;

function speakArabicWord(word: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.84;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech playback is an optional enhancement
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
  const [newLearnerName, setNewLearnerName] = useState('');
  const [newLearnerGrade, setNewLearnerGrade] = useState<number>(3);
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('ولي أمر');
  const [institutionalRef, setInstitutionalRef] = useState('');
  const [guardianConsentChecked, setGuardianConsentChecked] = useState(false);
  const [guardianAudioConsentChecked, setGuardianAudioConsentChecked] = useState(false);

  // School Demo Request Modal state
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
    }, 2800);
    return () => window.clearInterval(timer);
  }, [autoPreview, motionAllowed]);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

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
      if (!res.ok) {
        throw new Error(data.error || 'تعذر إرسال طلب التجربة.');
      }
      setDemoSubmitSuccess(true);
    } catch (err: any) {
      setDemoSubmitError(err.message || 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة لاحقاً.');
    } finally {
      setIsSubmittingDemo(false);
    }
  };

  return (
    <div className="baseera-home space-y-12 sm:space-y-16" dir="rtl">
      {/* =========================================================================
          SECTION 1: HERO VALUE PROPOSITION (Clean, Punchy, Focused, Zero Wall-of-Text)
          ========================================================================= */}
      <section className="baseera-hero relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-sky-50/40 to-blue-50/60 p-6 sm:p-12 shadow-sm" aria-labelledby="baseera-welcome-title">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Right Column: Hero Copy & Primary Direct CTAs */}
          <div className="lg:col-span-7 space-y-5 text-right">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black">
              <Sparkles size={16} className="text-emerald-600" />
              <span>تدريب تكويني يومي لدعم مهارات القراءة واللغة العربية</span>
            </div>

            <h1 id="baseera-welcome-title" className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
              نتعلّم القراءة العربية{' '}
              <span className="text-blue-600 inline-block">بثقة ومرح</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed font-medium">
              تدريب تفاعلي ممتع مدته ٥ دقائق يومياً لأطفال{' '}
              <span className="font-bold text-slate-800 whitespace-nowrap">الصفوف ١–٤</span>{' '}
              لتطوير مخارج الأصوات، فك الكلمات، والطلاقة القرائية خطوة بخطوة دون إجهاد.
            </p>

            {/* ONLY TWO PROMINENT ACTIONS (Zero Clutter) */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="baseera-primary-action px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm sm:text-base shadow-md shadow-blue-500/20 flex items-center justify-center gap-2.5 transition-transform hover:-translate-y-0.5 cursor-pointer"
                onClick={() => setShowOnboardingModal(true)}
              >
                <UserPlus aria-hidden="true" size={20} />
                <span>ابدأ كمتعلّم جديد (سجل نظيف · 0 XP)</span>
                <ArrowLeft size={18} />
              </button>

              {demoStudent && (
                <button
                  type="button"
                  className="baseera-secondary-action px-5 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-200 shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  onClick={() => onSelectExistingDemoJourney(demoStudent.id, 'dashboard')}
                >
                  <Building2 aria-hidden="true" size={18} className="text-emerald-600" />
                  <span>استعراض لوحة المعلم والمدرسة (Demo)</span>
                </button>
              )}
            </div>

            {/* Trust Reassurance Chips */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 pt-3 border-t border-slate-200/60">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck aria-hidden="true" size={16} className="text-emerald-600" />
                مسار مهارات متدرج مبني على الأدلة التربوية
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Heart aria-hidden="true" size={16} className="text-rose-500" />
                توجيه صريح للمختص المعتمد دون ادعاء تشخيص سريري
              </span>
            </div>
          </div>

          {/* Left Column: Visual Child-Friendly Interactive Graphic */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 p-6 sm:p-8 text-white shadow-xl shadow-blue-500/15 overflow-hidden text-center space-y-4">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-amber-400/20 rounded-full blur-lg pointer-events-none" />

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold text-amber-200 mx-auto">
                <Star size={14} className="fill-amber-300 text-amber-300" />
                <span>خطوة جديدة كل يوم!</span>
              </div>

              <div className="w-20 h-20 mx-auto rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center shadow-inner">
                <BookOpen size={42} strokeWidth={2.2} className="text-white drop-shadow-sm" />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">أبطال القراءة العربية</h3>
                <p className="text-xs text-blue-100 font-medium mt-1">
                  ٥ دقائق يومياً تصنع فارقاً حقيقياً في ثقة طفلك
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab('sprint')}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap size={16} className="fill-slate-950" />
                  <span>تدريب اليوم السريع (٥ دقائق)</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 2: FOUR CLEAR LEARNING STATIONS (Vibrant, Tactile, No Clutter)
          ========================================================================= */}
      <section className="space-y-6" aria-labelledby="baseera-activities-title">
        <div className="text-center sm:text-right space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            <Gamepad2 size={15} />
            <span>مساحات التعلّم</span>
          </div>
          <h2 id="baseera-activities-title" className="text-2xl sm:text-3xl font-black text-slate-900">
            ماذا نجرّب اليوم؟
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            أربع مساحات للممارسة والتعلّم، اختر منها ما يناسب هدفك.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Station 1: Diagnostic / Cognitive Lab */}
          <button
            type="button"
            onClick={() => onNavigateTab('cognitive-lab')}
            className="group rounded-3xl p-6 bg-white border border-slate-200 hover:border-blue-400 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between text-right cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Brain size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900">استكشاف مهارات القراءة (مؤشرات التعثر القرائي)</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                أنشطة قصيرة للتسمية وقراءة كلمات تدريبية والوعي بالأصوات؛ نتائجها وصفية وليست تشخيصًا.
              </p>
            </div>
            <div className="pt-5 flex items-center gap-1.5 text-blue-600 font-black text-xs group-hover:translate-x-[-4px] transition-transform">
              <span>استكشف المهارات</span>
              <ChevronLeft size={16} />
            </div>
          </button>

          {/* Station 2: Reading Lab */}
          <button
            type="button"
            onClick={() => onNavigateTab('reading-lab')}
            className="group rounded-3xl p-6 bg-white border border-slate-200 hover:border-sky-400 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between text-right cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <BookOpen size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900">رحلة القراءة والطلاقة</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                اقرأ نصًا قصيرًا مشكولاً بصوتك أو صامتاً، ثم أجب عن أسئلة الفهم القرائي.
              </p>
            </div>
            <div className="pt-5 flex items-center gap-1.5 text-sky-600 font-black text-xs group-hover:translate-x-[-4px] transition-transform">
              <span>ابدأ رحلة القراءة</span>
              <ChevronLeft size={16} />
            </div>
          </button>

          {/* Station 3: Remediation Gym */}
          <button
            type="button"
            onClick={() => onNavigateTab('remediation-gym')}
            className="group rounded-3xl p-6 bg-white border border-slate-200 hover:border-emerald-400 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between text-right cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Gamepad2 size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900">صالة التدريب القرائي (تدريبي)</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                تدرّب على الحروف والمقاطع وقراءة النصوص بالوتيرة التي تناسبك.
              </p>
            </div>
            <div className="pt-5 flex items-center gap-1.5 text-emerald-600 font-black text-xs group-hover:translate-x-[-4px] transition-transform">
              <span>ادخل صالة التدريب</span>
              <ChevronLeft size={16} />
            </div>
          </button>

          {/* Station 4: Accessible Reader */}
          <button
            type="button"
            onClick={() => onNavigateTab('adaptive-reader')}
            className="group rounded-3xl p-6 bg-white border border-slate-200 hover:border-pink-400 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between text-right cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 border border-pink-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Heart size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900">القارئ الميسّر</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                غيّر طريقة عرض الكلمات، مسافات الأسطر، واستمع إلى نطقها لمساعدة القارئ.
              </p>
            </div>
            <div className="pt-5 flex items-center gap-1.5 text-pink-600 font-black text-xs group-hover:translate-x-[-4px] transition-transform">
              <span>افتح القارئ الميسّر</span>
              <ChevronLeft size={16} />
            </div>
          </button>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: TACTILE INTERACTIVE READING SANDBOX (Crisp, Fun & Responsive)
          ========================================================================= */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6" aria-labelledby="baseera-reading-preview-title">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1 text-right">
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <Star size={13} className="fill-amber-500" />
              <span>جرّب بنفسك</span>
            </div>
            <h2 id="baseera-reading-preview-title" className="text-xl sm:text-2xl font-black text-slate-900">
              محاكاة جلسة القراءة التفاعلية
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              انقر على أي كلمة لتسمع نطقها الصحيح فورياً.
            </p>
          </div>

          <button
            type="button"
            className="self-start sm:self-center px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
            onClick={() => setAutoPreview((v) => !v)}
            aria-pressed={autoPreview}
          >
            {autoPreview ? <Pause size={15} /> : <Play size={15} />}
            <span>{autoPreview ? 'إيقاف الحركة التلقائية' : 'تشغيل الحركة التلقائية'}</span>
          </button>
        </div>

        {/* Word Chips Row */}
        <div className="rounded-2xl bg-slate-50/70 border border-slate-200 p-6 sm:p-8 text-center space-y-6">
          <div className="flex flex-wrap justify-center items-center gap-2.5 sm:gap-3.5 text-2xl sm:text-3xl font-black text-slate-800" dir="rtl">
            {SAMPLE_WORDS.map((item, index) => {
              const isActive = index === activeWordIndex;
              return (
                <button
                  key={item.text}
                  type="button"
                  onClick={() => {
                    setAutoPreview(false);
                    setActiveWordIndex(index);
                    speakArabicWord(item.text);
                  }}
                  className={`px-4 py-2 rounded-2xl border-2 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                  }`}
                  aria-pressed={isActive}
                  aria-label={'اختر كلمة ' + item.text}
                >
                  {item.text}
                </button>
              );
            })}
          </div>

          {/* Active Word Support Callout */}
          <div className="max-w-md mx-auto rounded-2xl bg-white border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4 text-right">
            <div>
              <span className="text-[11px] font-black text-blue-600 block">الكلمة المحددة:</span>
              <span className="text-xl font-black text-slate-900 ml-2">{selectedWord.text}</span>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{selectedWord.hint}</p>
            </div>
            <button
              type="button"
              onClick={() => speakArabicWord(selectedWord.text)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <Volume2 size={16} />
              <span>استمع</span>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: 3-STEP CLEAR PEDAGOGICAL JOURNEY (Eliminated Bureaucracy)
          ========================================================================= */}
      <section className="space-y-6" aria-labelledby="baseera-steps-title">
        <div className="text-center sm:text-right space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
            <Lightbulb size={15} />
            <span>رحلة الدعم المتدرج</span>
          </div>
          <h2 id="baseera-steps-title" className="text-2xl sm:text-3xl font-black text-slate-900">
            رحلتك في أربع خطوات واضحة
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-xs text-right space-y-3">
            <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 font-black text-sm flex items-center justify-center">١</span>
            <h3 className="text-base font-black text-slate-900">رصد استطلاعي مبكر</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              رصد مؤشرات التعثر في الوعي الصوتي وفك الكلمات والطلاقة دون إجهاد للطفل، استناداً إلى أدلة علمية.
            </p>
          </div>

          <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-xs text-right space-y-3">
            <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 font-black text-sm flex items-center justify-center">٢</span>
            <h3 className="text-base font-black text-slate-900">مسار استدراك مخصص</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              تحديد المهارات المستهدفة بالتقوية وفق منهجية تراكمية متدرجة من تمييز الحرف والمقطع إلى قراءة النص.
            </p>
          </div>

          <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-xs text-right space-y-3">
            <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 font-black text-sm flex items-center justify-center">٣</span>
            <h3 className="text-base font-black text-slate-900">تدريب يومي ممتع</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              جلسات تفاعلية قصيرة (٥–١٠ دقائق) تركز على مخارج الأصوات، التمييز البصري، وقراءة النصوص المشكولة.
            </p>
          </div>

          <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-xs text-right space-y-3">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900 font-black text-sm flex items-center justify-center">٤</span>
            <h3 className="text-base font-black text-slate-900">متابعة موضوعية وتوجيه للأهل</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              لوحة متابعة تكوينية تُظهر التقدم والتيسيرات الصفية، مع توجيه صريح للمختصين المعتمدين عند الحاجة.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: COMMERCIAL MODEL & PRICING PLANS (Tidy, Modern & Legible)
          ========================================================================= */}
      <section className="space-y-6" aria-labelledby="baseera-pricing-title">
        <div className="text-center sm:text-right space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
            <Sparkles size={14} className="text-amber-600" />
            <span>مرحلة التحقق الاسترشادي (Pilot Phase) · لا توجد مدفوعات حالياً</span>
          </div>
          <h2 id="baseera-pricing-title" className="text-2xl sm:text-3xl font-black text-slate-900">
            خطط الاشتراكات للمدارس والأسر
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            الأسعار المعروضة أدناه هي خطط استرشادية مقترحة قيد الدراسة والتجريب؛ المنصة متاحة للتجربة الحرة دون أي التزام مالي.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Family (B2C) */}
          <div className="rounded-3xl p-6 sm:p-8 bg-white border border-slate-200 shadow-xs flex flex-col justify-between text-right space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
                <Heart size={14} />
                <span>للأسر والمنازل (B2C)</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900">باقة رفيق القراءة</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 font-mono">49</span>
                <span className="text-sm font-bold text-slate-500">ر.ق / شهرياً</span>
                <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  متاحة مجاناً خلال الإطلاق التجريبي
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                ممارسة منزلية يومية مبهجة تبني ثقة طفلك في القراءة خطوة بخطوة مع تقرير دوري لولي الأمر.
              </p>

              <ul className="space-y-2.5 text-xs text-slate-700 font-medium pt-2">
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
                  <span>تقرير دوري لولي الأمر مع رصد الفجوات ومؤشرات التقدم</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              className="w-full py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
              onClick={() => setShowOnboardingModal(true)}
            >
              <span>ابدأ تجربة المتعلّم الفورية (مفتوحة ومجانية)</span>
              <ArrowLeft size={16} />
            </button>
          </div>

          {/* Card 2: Schools (B2B) */}
          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-emerald-50/50 via-white to-white border-2 border-emerald-500 shadow-md flex flex-col justify-between text-right space-y-6 relative">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                <Building2 size={14} />
                <span>للمدارس ومراكز التعلم (B2B)</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900">باقة المؤسسات والمدارس</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-emerald-900">ترخيص تجريبي للمؤسسات</span>
                <span className="text-xs font-bold text-slate-500">/ مقاعد مخصصة لأفواج الطلبة</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                حل متكامل لأقسام الدعم التعليمي الإضافي وغرف مصادر التعلم لمتابعة أفواج الطلبة وتوليد تقارير تربوية تفصيلية.
              </p>

              <ul className="space-y-2.5 text-xs text-slate-700 font-medium pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                  <span>لوحة تحكم المعلم الشاملة لإدارة الفصول ورصد التقدم التكويني</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                  <span>تقارير تربوية مساندة لخطط التعلم الفردية (IEP) ومراجعة الأخصائي</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                  <span>صلاحيات متعددة المستويات (RBAC) وحوكمة بيانات الأطفال</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              className="w-full py-3.5 px-5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
              onClick={() => {
                setShowSchoolDemoModal(true);
                setDemoSubmitSuccess(false);
                setDemoSubmitError('');
              }}
            >
              <span>طلب تجربة مدرسة / شريك تجريبي (Pilot)</span>
              <Building2 size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: GOVERNANCE & PROGRESS REASSURANCE
          ========================================================================= */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6 text-right" aria-labelledby="baseera-family-title">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
            <GraduationCap size={28} />
          </div>
          <div className="space-y-1">
            <h2 id="baseera-family-title" className="text-lg font-black text-slate-900">
              ملخص التعلّم والمتابعة التكوينية
            </h2>
            <p className="text-xs text-slate-500 font-medium max-w-xl leading-relaxed">
              تقيس بصيرة الأداء داخل أنشطة قرائية محددة، ولا تدّعي تشخيص عسر القراءة (الديسلكسيا). يجري تطوير المنصة والتحقق من مؤشرات أدائها كأداة تدريبية استرشادية لمساعدة المعلم والأسرة.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            className="px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
            onClick={() => onSelectStudentReport(activeStudent.id)}
          >
            <span>عرض ملخص التعلّم</span>
            <ArrowLeft size={16} />
          </button>
          {demoStudent && (
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              onClick={() => onSelectExistingDemoJourney(demoStudent.id, 'dashboard')}
            >
              استعراض نموذج توضيحي مكتمل
            </button>
          )}
        </div>
      </section>

      {/* Kind Encouragement Note */}
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3 text-emerald-900 text-xs font-bold text-right">
        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
        <p>لا توجد إجابات تجعلك أقلّ قدرة من غيرك؛ كل محاولة فرصة جديدة لتثبيت مهارة القراءة.</p>
      </div>

      {/* =========================================================================
          MODAL: ONBOARDING FOR NEW LEARNER (Strict Qatar Privacy & Parental Consent)
          ========================================================================= */}
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
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center">
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
                  اسم الطفل المستعار أو اللقب: *
                </label>
                <input
                  type="text"
                  value={newLearnerName}
                  onChange={(e) => setNewLearnerName(e.target.value)}
                  placeholder="مثال: البطل الصغير أو سارة"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  لا تستخدم الاسم الكامل الحقيقي للطفل لحماية خصوصيته وفق مبدأ تقليل البيانات.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    اسم ولي الأمر / المعلم المسؤول:
                  </label>
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="مثال: عبد الله أو نورة (اختياري)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    الصفة والقرابة:
                  </label>
                  <select
                    value={guardianRelationship}
                    onChange={(e) => setGuardianRelationship(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 text-xs bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ولي أمر">ولي أمر (الأب / الأم)</option>
                    <option value="وصي قانوني">وصي قانوني</option>
                    <option value="معلم / أخصائي مدرسي">معلم / أخصائي مدرسي</option>
                  </select>
                </div>
              </div>

              {guardianRelationship === 'معلم / أخصائي مدرسي' && (
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    مرجع التفويض المدرسي الرسمي: *
                  </label>
                  <input
                    type="text"
                    value={institutionalRef}
                    onChange={(e) => setInstitutionalRef(e.target.value)}
                    placeholder="مثال: كتاب تفويض إدارة مدرسة قطر رقم 2026/41"
                    className="w-full px-3.5 py-2 rounded-xl border border-blue-300 bg-blue-50/40 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

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
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      الصف {grade}
                    </button>
                  ))}
                </div>
              </div>

              {/* Consent Checkboxes */}
              <div className="space-y-2.5 pt-1">
                <div className={`p-3.5 rounded-2xl border text-xs transition-colors ${
                  guardianConsentChecked
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50/70 border-amber-200 text-amber-950'
                }`}>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guardianConsentChecked}
                      onChange={(e) => setGuardianConsentChecked(e.target.checked)}
                      className="mt-0.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="font-bold leading-relaxed">
                      <span className="text-emerald-700 underline font-black ml-1">[إلزامي للبدء]</span>
                      {guardianRelationship === 'معلم / أخصائي مدرسي' ? (
                        <>أقر بصفتي معلماً / أخصائياً مخولاً بوجود تفويض رسمي من إدارة المدرسة وموافقة مسبقة من ولي أمر الطالب على استخدام منصة بصيرة للتدريب القرائي التكويني وفق سياسة الخصوصية.</>
                      ) : guardianRelationship === 'وصي قانوني' ? (
                        <>أقر بصفتي الوصي القانوني على الطالب بالموافقة الصريحة على إنشاء ملف تدريبي واستخدام منصة بصيرة للتدريب القرائي التكويني وفق سياسة الخصوصية.</>
                      ) : (
                        <>أقر بصفتي ولي أمر الطالب (الأب / الأم) بالموافقة الصريحة على إنشاء ملف تدريبي للطفل واستخدام منصة بصيرة للتدريب القرائي التكويني وفق سياسة الخصوصية.</>
                      )}
                    </span>
                  </label>
                </div>

                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-800">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guardianAudioConsentChecked}
                      onChange={(e) => setGuardianAudioConsentChecked(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="leading-relaxed">
                      <span className="text-slate-600 font-black ml-1">[اختياري منفصل]</span>
                      أوافق على معالجة قراءة الطفل الصوتية عبر التعرف الصوتي الآلي عند اختيار أنشطة القراءة الجهرية. (يمكن الاستفادة من المنصة كاملة بنمط القراءة الصامتة دون أي تسجيل صوتي).
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleLaunchCleanLearner}
                disabled={!guardianConsentChecked || newLearnerName.trim().length < 2}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>انطلق في تدريب اليوم (0 XP)</span>
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

      {/* =========================================================================
          MODAL: REAL SCHOOL DEMO REQUEST PIPELINE
          ========================================================================= */}
      {showSchoolDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-modal-title"
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-right space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 id="demo-modal-title" className="text-xl font-black text-slate-900">
                    طلب تجربة مدرسية وشراكة تجريبية
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    مرحلة التحقق التجريبي (Pilot) لأقسام الدعم التعليمي والمدارس
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSchoolDemoModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {demoSubmitSuccess ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 size={36} />
                </div>
                <h4 className="text-lg font-black text-slate-900">
                  تم استلام طلبكم بنجاح!
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed max-w-sm mx-auto font-medium">
                  شكراً لاهتمامكم بالانضمام للبرنامج التجريبي لمنصة بصيرة. سيتواصل فريق حلول المدارس معكم عبر البريد الرسمي خلال ٢٤ إلى ٤٨ ساعة عمل لترتيب جلسة تعريفية وتفعيل حساب تجريبي.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSchoolDemoModal(false)}
                  className="px-6 py-2.5 bg-emerald-700 text-white rounded-xl font-bold text-sm hover:bg-emerald-800 cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleSchoolDemoSubmit} className="space-y-3.5 text-sm">
                {demoSubmitError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
                    {demoSubmitError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    اسم المدرسة أو المركز التعليمي: *
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="مثال: مدرسة قطر الابتدائية"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      اسم مسؤول التواصل: *
                    </label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="مثال: أ. مريم السليطي"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      الصفة الوظيفية:
                    </label>
                    <input
                      type="text"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      placeholder="منسق دعم / أخصائي تخاطب"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      البريد الإلكتروني المؤسسي: *
                    </label>
                    <input
                      type="email"
                      required
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      placeholder="name@school.edu.qa"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      رقم الهاتف للتواصل: *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+974 5500 0000"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    العدد التقديري للطلاب المستفيدين:
                  </label>
                  <input
                    type="text"
                    value={expectedStudents}
                    onChange={(e) => setExpectedStudents(e.target.value)}
                    placeholder="مثال: 15-30 طالباً في غرف المصادر"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    ملاحظات أو احتياجات خاصة بالبرنامج:
                  </label>
                  <textarea
                    rows={2}
                    value={demoNotes}
                    onChange={(e) => setDemoNotes(e.target.value)}
                    placeholder="أي متطلبات خاصة بالمتابعة أو التقارير..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingDemo}
                    className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {isSubmittingDemo ? 'جارٍ إرسال الطلب...' : 'إرسال طلب التجربة'}
                    <Building2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSchoolDemoModal(false)}
                    className="px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
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