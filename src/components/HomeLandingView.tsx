import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  UserPlus,
  FileText,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { StudentRecord } from '../data/seedData';
import {
  segmentArabicWordIntoSyllables,
  getConfusableLetterGroup,
} from '../utils/clinicalMetrics';

export type AppTabId =
  | 'home'
  | 'eye-lab'
  | 'dyscalculia-lab'
  | 'adaptive-reader'
  | 'dashboard'
  | 'algorithms-lab'
  | 'privacy';

interface HomeLandingViewProps {
  students: StudentRecord[];
  activeStudent: StudentRecord;
  onStartMockUserJourney: (
    name: string,
    grade: number,
    roleLabel: string
  ) => void;
  onSelectExistingDemoJourney: (
    studentId: string,
    targetTab: AppTabId
  ) => void;
  onNavigateTab: (tab: AppTabId) => void;
  onSelectStudentReport: (studentId: string) => void;
}

type SimulatorProfileId = 'fluent' | 'dyslexia-risk' | 'dialect-nominal';
type EmpathyLensMode = 'crowded' | 'syllabic-colored' | 'bionic-guided';

interface SimWordNode {
  word: string;
  spoken: string;
  fixationMs: number;
  regression: boolean;
  classification: 'exact' | 'dialect' | 'orthographic' | 'substitution';
  classificationLabel: string;
  x: number;
  y: number;
}

const SIMULATOR_PROFILES: Record<
  SimulatorProfileId,
  {
    title: string;
    wpm: number;
    avgFixationMs: number;
    regressionRate: number;
    statusLabel: string;
    statusTone: 'emerald' | 'amber' | 'rose';
    nodes: SimWordNode[];
  }
> = {
  fluent: {
    title: 'مثال تجريبي',
    wpm: 108,
    avgFixationMs: 215,
    regressionRate: 6,
    statusLabel: '● مسار منتظم',
    statusTone: 'emerald',
    nodes: [
      {
        word: 'تَفَقَّدَ',
        spoken: 'تفقد',
        fixationMs: 225,
        regression: false,
        classification: 'exact',
        classificationLabel: 'تطابق تام',
        x: 84,
        y: 48,
      },
      {
        word: 'الفَلّاحُ',
        spoken: 'الفلاح',
        fixationMs: 195,
        regression: false,
        classification: 'exact',
        classificationLabel: 'تطابق تام',
        x: 68,
        y: 48,
      },
      {
        word: 'مَجْرى',
        spoken: 'مجرى',
        fixationMs: 210,
        regression: false,
        classification: 'exact',
        classificationLabel: 'تطابق تام',
        x: 52,
        y: 48,
      },
      {
        word: 'السّاقِيَةِ',
        spoken: 'الساقية',
        fixationMs: 230,
        regression: false,
        classification: 'exact',
        classificationLabel: 'تطابق تام',
        x: 35,
        y: 48,
      },
      {
        word: 'صَباحاً',
        spoken: 'صباحا',
        fixationMs: 205,
        regression: false,
        classification: 'exact',
        classificationLabel: 'تطابق تام',
        x: 18,
        y: 48,
      },
    ],
  },
  'dyslexia-risk': {
    title: 'مؤشر تجريبي مرتفع',
    wpm: 54,
    avgFixationMs: 425,
    regressionRate: 28,
    statusLabel: '▲ تثبيت مطوّل وتراجع',
    statusTone: 'rose',
    nodes: [
      {
        word: 'تَفَقَّدَ',
        spoken: 'تعقد',
        fixationMs: 490,
        regression: true,
        classification: 'substitution',
        classificationLabel: 'إبدال حرفي (ف ← ع)',
        x: 84,
        y: 52,
      },
      {
        word: 'الفَلّاحُ',
        spoken: 'الفلاح',
        fixationMs: 360,
        regression: false,
        classification: 'exact',
        classificationLabel: 'تطابق تام',
        x: 68,
        y: 46,
      },
      {
        word: 'مَجْرى',
        spoken: 'مرمى',
        fixationMs: 465,
        regression: true,
        classification: 'substitution',
        classificationLabel: 'إبدال جذري',
        x: 52,
        y: 54,
      },
      {
        word: 'السّاقِيَةِ',
        spoken: 'الساقيه',
        fixationMs: 430,
        regression: false,
        classification: 'orthographic',
        classificationLabel: 'وقف بالهاء (مقبول)',
        x: 35,
        y: 48,
      },
      {
        word: 'صَباحاً',
        spoken: 'صباحا',
        fixationMs: 380,
        regression: false,
        classification: 'exact',
        classificationLabel: 'تطابق تام',
        x: 18,
        y: 48,
      },
    ],
  },
  'dialect-nominal': {
    title: 'تنوع لهجي سليم',
    wpm: 94,
    avgFixationMs: 245,
    regressionRate: 9,
    statusLabel: '● مرادف لهجي معزول',
    statusTone: 'emerald',
    nodes: [
      {
        word: 'وَرَأى',
        spoken: 'وشاف',
        fixationMs: 240,
        regression: false,
        classification: 'dialect',
        classificationLabel: 'مرادف لهجي (لا يُحتسب خطأ)',
        x: 84,
        y: 48,
      },
      {
        word: 'الطِّفْلُ',
        spoken: 'الطفل',
        fixationMs: 220,
        regression: false,
        classification: 'exact',
        classificationLabel: 'تطابق تام',
        x: 68,
        y: 48,
      },
      {
        word: 'نَحْوَ',
        spoken: 'صوب',
        fixationMs: 255,
        regression: false,
        classification: 'dialect',
        classificationLabel: 'مرادف لهجي خليجي',
        x: 52,
        y: 48,
      },
      {
        word: 'المَدْرَسَةِ',
        spoken: 'المدرسه',
        fixationMs: 235,
        regression: false,
        classification: 'orthographic',
        classificationLabel: 'وقف بالهاء (مقبول)',
        x: 35,
        y: 48,
      },
      {
        word: 'مُبَكِّراً',
        spoken: 'مبكرا',
        fixationMs: 265,
        regression: false,
        classification: 'exact',
        classificationLabel: 'تطابق تام',
        x: 18,
        y: 48,
      },
    ],
  },
};

interface SessionStageItem {
  id: string;
  tabLabel: string;
  kicker: string;
  headline: string;
  description: string;
  privacyNote: string;
  waveBars: number[];
  actionLabel: string;
  targetTab: AppTabId;
}

const SESSION_TIMELINE_STAGES: SessionStageItem[] = [
  {
    id: 'before-reading',
    tabLabel: 'قبل أن يبدأ الطالب القراءة',
    kicker: 'قبل بدء القراءة',
    headline: 'قبل بدء الجلسة: لا تُشغّل الكاميرا أو الميكروفون إلا عند اختيار ذلك.',
    description:
      'توضح هذه المرحلة متى تبدأ الجلسة. راجع أذونات المتصفح وحالة المؤشرات الظاهرة، ولا تستخدم بيانات حقيقية قبل مراجعة مسار البيانات وإجراءات الموافقة.',
    privacyNote: 'مؤشرات الجلسة ليست نظاماً للتعرّف على هوية الطالب.',
    waveBars: [18, 22, 16, 24, 20, 18, 22, 16, 20, 24, 18, 16, 22, 20, 18],
    actionLabel: 'انتقل إلى بوابة بدء الجلسة',
    targetTab: 'eye-lab',
  },
  {
    id: 'student-begins',
    tabLabel: 'عندما يبدأ الطالب القراءة',
    kicker: 'لحظة انطلاق الجلسة',
    headline: 'تجربة معايرة بصرية ونص عربي واضح للقراءة.',
    description:
      'يجرب الطالب خطوات معايرة ثم يقرأ نصاً عربياً متدرجاً. تعتمد فائدة المؤشرات على جودة المعايرة وظروف الكاميرا، وقد لا تكون مناسبة لكل جهاز أو جلسة.',
    privacyNote: 'تُحوَّل حركة العين فوراً إلى إحداثيات رقمية (X, Y) داخل المتصفح.',
    waveBars: [26, 38, 30, 48, 42, 34, 52, 44, 36, 46, 32, 40, 28, 36, 24],
    actionLabel: 'جرّب معايرة العين الآن',
    targetTab: 'eye-lab',
  },
  {
    id: 'while-reading',
    tabLabel: 'أثناء القراءة الجهرية',
    kicker: 'خلال القراءة الجهرية',
    headline: 'تجمع الجلسة مؤشرات النظر والقراءة الجهرية مع مراعاة بعض الاختلافات اللهجية.',
    description:
      'أثناء القراءة، تحاول المنصة جمع مؤشرات بصرية ومحاذاة النص المنطوق مع النص المرجعي. قد تتأثر النتائج بالمعايرة والميكروفون والمتصفح واللهجة، وتحتاج المخرجات إلى تفسير حذر.',
    privacyNote: 'تعتمد معالجة الصوت على دعم المتصفح وإعدادات الجلسة؛ لا تفترض أن كل بيئة تعمل بالطريقة نفسها.',
    waveBars: [45, 72, 88, 64, 95, 78, 56, 92, 84, 68, 90, 74, 60, 82, 50],
    actionLabel: 'افتح مختبر القراءة والعين',
    targetTab: 'eye-lab',
  },
  {
    id: 'passage-ends',
    tabLabel: 'انتهاء النص وفحص الحساب',
    kicker: 'اكتمال القراءة والانتقال للحساب',
    headline: 'بعد القراءة، يمكن الانتقال إلى مهام الإدراك العددي.',
    description:
      'تتيح الواجهة الانتقال إلى مهام حسابية قصيرة مثل تقدير موقع العدد والتمييز الكمي. تحقق من مؤشرات تشغيل الأجهزة في واجهتك قبل الانتقال.',
    privacyNote: 'راجع حالة الكاميرا والميكروفون في الواجهة بعد كل مرحلة.',
    waveBars: [34, 56, 44, 68, 52, 40, 62, 48, 36, 54, 42, 30, 38, 28, 22],
    actionLabel: 'استكشف مختبر فحص الحساب',
    targetTab: 'dyscalculia-lab',
  },
  {
    id: 'insights-surfaced',
    tabLabel: 'ظهور المؤشرات والقرار للمعلم',
    kicker: 'مؤشرات واضحة وخطة مساندة',
    headline: 'تُعرض المؤشرات للمراجعة — ولا تصدر تشخيصاً.',
    description:
      'يلخّص التقرير ما رُصد فعلياً عندما تتوفر بيانات كافية. أما القارئ الميسّر فيتيح تجربة التقطيع والتباعد والتلوين، دون ادعاء أنها علاج مثبت.',
    privacyNote: 'تحقق من نجاح الحفظ أو الحذف من رسالة الحالة قبل الاعتماد عليه.',
    waveBars: [30, 44, 60, 76, 64, 82, 70, 58, 74, 62, 48, 56, 40, 34, 28],
    actionLabel: 'استعرض التقرير النهائي والنتائج',
    targetTab: 'dashboard',
  },
];

interface TrustQuestionItem {
  id: string;
  question: string;
  answerTitle: string;
  answerBody: string;
}

const TRUST_CENTER_QUESTIONS: TrustQuestionItem[] = [
  {
    id: 'biometrics',
    question: 'هل تستخدم بصيرة الكاميرا للتعرّف على هوية الطالب؟',
    answerTitle: 'لا توجد ميزة للتعرّف على الهوية؛ تُستخدم الكاميرا لمؤشرات النظر.',
    answerBody:
      'يُستخدم تدفق الكاميرا داخل المتصفح لاستخراج مؤشرات بصرية أثناء الجلسة. لا تعرض المنصة فيديو خاماً ضمن التقرير؛ راجع إعدادات الاستضافة ومسار البيانات قبل استخدام بيانات حقيقية، ولا تُدخل بيانات أطفال في النسخة التجريبية.',
  },
  {
    id: 'consent',
    question: 'كيف يوافق ولي الأمر أو المدرسة قبل بدء جلسة الفحص؟',
    answerTitle: 'واجهة موافقة أولية — وليست سجل موافقة مؤسسياً مدققاً.',
    answerBody:
      'تتضمن الواجهة خطوة موافقة، لكنها لا تمثل وحدها سجلاً قانونياً مستقلاً أو مسار موافقات مؤسسياً مدققاً. استخدم المحاكاة دون كاميرا للتعرّف على التجربة، ولا تستخدم بيانات أطفال حقيقية قبل استكمال إجراءات الموافقة والمراجعة الأمنية.',
  },
  {
    id: 'dialect',
    question: 'كيف تميّز بصيرة بين اللهجة الخليجية والعربية وبين عسر القراءة؟',
    answerTitle: 'ملفات لهجية أولية لاختبار بعض الاختلافات العربية.',
    answerBody:
      'تتيح الواجهة اختيار ملفات لهجية متعددة، لكنها لا تثبت أنها تصنّف جميع اللهجات أو تمنع احتساب كل اختلاف لهجي كخطأ. يجب مراجعة نتائج الصوت يدوياً، ولا توجد حتى الآن دقة مستقلة منشورة لهذا التصنيف.',
  },
  {
    id: 'deletion',
    question: 'ما مدى تحكّم المدرسة وولي الأمر في حفظ أو حذف سجلات الطلاب؟',
    answerTitle: 'تحقق من حالة الحفظ قبل اعتبار السجل محفوظاً.',
    answerBody:
      'قد تبقى التغييرات محلية إذا لم يسجّل الأخصائي الدخول أو تعذّر الاتصال بالخادم. تحقق من رسالة حالة الحفظ، ولا تفترض أن الحذف من الواجهة يضمن وحده محواً من النسخ الاحتياطية أو سجلات الاستضافة.',
  },
];

const EMPATHY_SAMPLE_WORDS = [
  'تَفَقَّدَ',
  'الفَلّاحُ',
  'مَجْرى',
  'السّاقِيَةِ',
  'فِي',
  'البُسْتانِ',
  'وَجَمَعَ',
  'الثِّمارَ',
];

function speakArabicText(text: string) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.88;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore if speech synthesis is unavailable
    }
  }
}

/** Small Amira-inspired vertical soundwave icon `ılılı` */
const SoundwaveBarsIcon: React.FC<{ className?: string }> = ({
  className = 'text-emerald-700',
}) => (
  <span
    aria-hidden="true"
    className={`inline-flex items-center gap-[2px] h-3.5 ${className}`}
  >
    <span className="w-[2px] h-2 bg-current rounded-full opacity-70" />
    <span className="w-[2px] h-3.5 bg-current rounded-full" />
    <span className="w-[2px] h-1.5 bg-current rounded-full opacity-80" />
    <span className="w-[2px] h-3 bg-current rounded-full" />
    <span className="w-[2px] h-2 bg-current rounded-full opacity-70" />
  </span>
);

export const HomeLandingView: React.FC<HomeLandingViewProps> = ({
  students,
  activeStudent,
  onStartMockUserJourney,
  onSelectExistingDemoJourney,
  onNavigateTab,
  onSelectStudentReport,
}) => {
  // Interactive 5-Stage Session Scrubber State (Amira Section 2)
  const [activeStageIdx, setActiveStageIdx] = useState<number>(2); // Default to "أثناء القراءة الجهرية" or let user click any of the 5 stages

  // Live Gaze Preview State
  const [simProfile, setSimProfile] =
    useState<SimulatorProfileId>('dyslexia-risk');
  const [selectedNodeIdx, setSelectedNodeIdx] = useState<number>(0);
  const [isAutoAnimatingGaze, setIsAutoAnimatingGaze] = useState<boolean>(true);

  // Mock Registration / Quick Onboarding State
  const [mockName, setMockName] = useState<string>('');
  const [mockGrade, setMockGrade] = useState<number>(3);
  const [mockRole, setMockRole] = useState<'student' | 'specialist'>('student');
  const [registrationNotice, setRegistrationNotice] = useState<string>('');

  // Interactive Dyslexia Lens State
  const [empathyMode, setEmpathyMode] =
    useState<EmpathyLensMode>('syllabic-colored');
  const [activeSpokenSampleWord, setActiveSpokenSampleWord] =
    useState<string>('تَفَقَّدَ');

  // Trust Center Q&A State
  const [selectedTrustQuestionId, setSelectedTrustQuestionId] =
    useState<string>('biometrics');
  const [customTrustQuery, setCustomTrustQuery] = useState<string>('');

  const activeSim = SIMULATOR_PROFILES[simProfile];
  const activeNode = activeSim.nodes[selectedNodeIdx] || activeSim.nodes[0];
  const currentStage =
    SESSION_TIMELINE_STAGES[activeStageIdx] || SESSION_TIMELINE_STAGES[0];
  const activeTrustItem =
    TRUST_CENTER_QUESTIONS.find((q) => q.id === selectedTrustQuestionId) ||
    TRUST_CENTER_QUESTIONS[0];

  useEffect(() => {
    if (!isAutoAnimatingGaze) return;
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    const stepInterval = isHeadless ? 1800 : 1350;

    const timer = window.setInterval(() => {
      setSelectedNodeIdx((prev) => (prev + 1) % activeSim.nodes.length);
    }, stepInterval);

    return () => window.clearInterval(timer);
  }, [isAutoAnimatingGaze, activeSim.nodes.length]);

  const handleQuickStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = mockName.trim();
    if (!cleanName) {
      setRegistrationNotice('أدخل اسمًا مستعارًا أو تجريبيًا للمتابعة. لا تستخدم اسم طفل حقيقي.');
      return;
    }
    const roleLabel =
      mockRole === 'student' ? 'تجربة كطالب' : 'تجربة كمختص';
    setRegistrationNotice(`تم تسجيل «${cleanName}» — جاري فتح الخطوة ٢...`);
    onStartMockUserJourney(cleanName, mockGrade, roleLabel);
  };

  const handleCustomTrustAsk = (e: React.FormEvent) => {
    e.preventDefault();
    const q = customTrustQuery.trim();
    if (!q) return;
    if (q.includes('لهج') || q.includes('خليج') || q.includes('نطق')) {
      setSelectedTrustQuestionId('dialect');
    } else if (q.includes('ولي') || q.includes('موافق')) {
      setSelectedTrustQuestionId('consent');
    } else if (q.includes('حذف') || q.includes('سجل')) {
      setSelectedTrustQuestionId('deletion');
    } else {
      setSelectedTrustQuestionId('biometrics');
    }
  };

  const scrollToSection = (elementId: string) => {
    if (typeof document !== 'undefined') {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const activeCx = (activeNode.x / 100) * 600;
  const activeCy = (activeNode.y / 100) * 135;

  return (
    <div className="space-y-16 pb-12 animate-fade-slide-up">
      {/* =====================================================================
          SECTION 1: AMIRA LEARNING INSPIRED HERO CONTAINER
          ("PROVEN READING GROWTH. Validated time and again." + 3 Frosted Audience Cards)
          ===================================================================== */}
      <section className="relative rounded-[2rem] overflow-hidden border border-slate-200/80 bg-gradient-to-br from-[#EAEFE9] via-[#F4F1FA] to-[#E9F7EF] p-6 sm:p-10 lg:p-12 shadow-xs">
        {/* Decorative Flowing Amira-Style Soundwave & Eye-Gaze Ribbons SVG in Background */}
        <svg
          viewBox="0 0 1200 620"
          fill="none"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-65"
          preserveAspectRatio="none"
        >
          <path
            d="M-60 490 C 260 440, 460 220, 780 250 C 990 270, 1110 130, 1260 70"
            stroke="#C4B5FD"
            strokeWidth="2.5"
            strokeOpacity="0.65"
          />
          <path
            d="M-40 540 C 310 500, 520 280, 830 290 C 1030 300, 1140 180, 1260 130"
            stroke="#86EFAC"
            strokeWidth="3"
            strokeOpacity="0.75"
          />
          <path
            d="M120 620 C 420 480, 650 350, 920 330 C 1080 315, 1170 220, 1260 190"
            stroke="#DDD6FE"
            strokeWidth="2"
            strokeOpacity="0.6"
          />
        </svg>

        {/* Top Split of Hero: Right Monumental Typography + Left Warm Classroom & Live Reading Scene */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Right Column (7 cols in RTL): Monumental Two-Tone Headline + Lead Copy */}
          <div className="lg:col-span-7 space-y-6 text-right">
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#15803D] tracking-wide">
              <SoundwaveBarsIcon className="text-[#15803D]" />
              <span>قراءة عربية · مؤشرات بصرية · مهام حسابية</span>
            </div>

            <h1
              className="font-display font-extrabold tracking-tight leading-[1.18]"
              style={{
                fontSize: 'clamp(2.25rem, 4.3vw, 4.1rem)',
                textWrap: 'balance',
              }}
            >
              <span className="block text-[#18181B]">
                مؤشرات أولية لفهم القراءة والحساب
              </span>
              <span className="block text-[#15803D] mt-1">
                تجربة عربية متعددة المؤشرات
              </span>
              <span className="block text-[#18181B] font-bold mt-1 text-[0.82em]">
                لدعم الملاحظة المبكرة<span className="text-[#15803D]">.</span>
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-700 leading-relaxed max-w-2xl font-normal">
              «بصيرة» نموذج أولي عربي يجمع بين القراءة الجهرية، ومؤشرات تتبّع العين، ومحاولات موزعة على ثلاث مهام حسابية. تساعد نتائجه على تنظيم الملاحظات التربوية، لكنها لا تشخّص عسر القراءة أو عسر الحساب ولا تستبدل التقييم المتخصص.
            </p>

            {/* Primary Hero Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigateTab('eye-lab')}
                className="px-6 py-3.5 rounded-full bg-[#18181B] hover:bg-[#15803D] text-white text-sm font-bold transition-colors flex items-center gap-2.5 cursor-pointer shadow-sm whitespace-nowrap"
              >
                <span>جرّب القراءة وتتبع العين</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('quick-student-portal')}
                className="px-5 py-3.5 rounded-full bg-white/90 hover:bg-white text-slate-900 border border-slate-300/90 text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <SoundwaveBarsIcon className="text-[#15803D]" />
                <span>جرّب ملفاً توضيحياً</span>
              </button>
            </div>
          </div>

          {/* Left Column (5 cols in RTL): Rich Interactive Amira-Style Reading & Voice-Gaze Session Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl bg-white/85 backdrop-blur-md border border-white p-5 sm:p-6 shadow-sm space-y-4">
              {/* Top Header of Interactive Reading Card */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-[#ECFDF5] border border-emerald-200 flex items-center justify-center">
                    <SoundwaveBarsIcon className="text-[#15803D]" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      محاكاة جلسة القراءة التفاعلية
                    </div>
                    <div className="text-[11px] text-slate-500">
                      انقر على أي كلمة للاستماع ومشاهدة استجابة بصيرة
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#15803D] bg-[#ECFDF5] border border-emerald-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                  مثال تفاعلي · الصف {activeStudent.gradeLevel}
                </span>
              </div>

              {/* Open Interactive Arabic Storybook Page with Gaze & Voice Tracking */}
              <div className="rounded-2xl bg-gradient-to-br from-[#FAF6EE] via-[#FFFDF9] to-[#ECFDF5]/60 border border-[#E5DEC9] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>نص عرض توضيحي: «الفَلّاحُ وَالسّاقِيَةُ»</span>
                  <span className="font-mono tabular-nums text-emerald-800 font-semibold">
                    {activeSim.wpm} كلمة/د · تثبيت {activeNode.fixationMs}ms
                  </span>
                </div>

                {/* Clickable Storybook Words with Live Focus Ring */}
                <div className="flex flex-wrap items-center gap-2 py-1">
                  {activeSim.nodes.map((node, idx) => {
                    const isFocused = idx === selectedNodeIdx;
                    return (
                      <button
                        key={node.word}
                        type="button"
                        onClick={() => {
                          setIsAutoAnimatingGaze(false);
                          setSelectedNodeIdx(idx);
                          speakArabicText(node.word);
                        }}
                        className={`px-3 py-2 rounded-xl text-lg sm:text-xl font-bold transition-all cursor-pointer relative ${
                          isFocused
                            ? 'bg-[#15803D] text-white shadow-xs scale-105'
                            : 'bg-white/90 text-slate-800 border border-slate-200/80 hover:border-[#15803D]'
                        }`}
                      >
                        {node.word}
                      </button>
                    );
                  })}
                </div>

                {/* Live Voice & Gaze Feedback Strip inside the Storybook */}
                <div className="rounded-xl bg-white/95 border border-emerald-200/90 p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex items-center gap-[3px] h-6 px-2 py-1 rounded-lg bg-[#ECFDF5]"
                      aria-hidden="true"
                    >
                      {[45, 85, 60, 95, 70, 50, 80].map((h, i) => (
                        <span
                          key={i}
                          style={{ height: `${h}%` }}
                          className="w-[2.5px] bg-[#16A34A] rounded-full"
                        />
                      ))}
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-500">مثال نطق: </span>
                      <strong className="text-slate-900">
                        «{activeNode.spoken}»
                      </strong>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="font-bold text-[#15803D]">
                        {activeNode.classificationLabel}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => speakArabicText(activeNode.word)}
                    className="px-2.5 py-1 rounded-lg bg-[#18181B] hover:bg-[#15803D] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>استمع</span>
                  </button>
                </div>
              </div>

              {/* Quick Student Switcher / Direct Start Inside Hero Card */}
              <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500 font-medium">الطالب:</span>
                  {students.filter((stu) => stu.isDemoRecord).slice(0, 3).map((stu) => {
                    const isSelected = stu.id === activeStudent.id;
                    return (
                      <button
                        key={stu.id}
                        type="button"
                        onClick={() =>
                          onSelectExistingDemoJourney(stu.id, 'home')
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {stu.name}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => onSelectStudentReport(activeStudent.id)}
                  className="font-bold text-[#15803D] hover:underline cursor-pointer whitespace-nowrap"
                >
                  تقرير الطالب ←
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom of Hero: The 3 Frosted-Glass Audience Cards (Teachers | Parents and Caregivers | Leaders) */}
        <div className="relative z-10 mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {/* Card 1: Teachers (المعلمون والأخصائيون) */}
          <div
            onClick={() => scrollToSection('amira-session-walkthrough')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                scrollToSection('amira-session-walkthrough');
              }
            }}
            className="group bg-white/80 hover:bg-white/95 backdrop-blur-md border border-white rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6 transition-all shadow-xs hover:shadow-md cursor-pointer text-right"
          >
            <div className="space-y-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-[#18181B] font-display">
                المعلمون والأخصائيون
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                استكشف كيف تجمع «بصيرة» مؤشرات أولية عن القراءة والحساب لمراجعتها ضمن الملاحظة التربوية، دون اعتبارها تشخيصاً.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 group-hover:text-[#15803D] transition-colors">
              <span>كيف تعمل بصيرة</span>
              <SoundwaveBarsIcon className="text-[#15803D]" />
            </div>
          </div>

          {/* Card 2: Parents and Caregivers (أولياء الأمور والأسرة) */}
          <div
            onClick={() => scrollToSection('quick-student-portal')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                scrollToSection('quick-student-portal');
              }
            }}
            className="group bg-white/80 hover:bg-white/95 backdrop-blur-md border border-white rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6 transition-all shadow-xs hover:shadow-md cursor-pointer text-right"
          >
            <div className="space-y-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-[#18181B] font-display">
                أولياء الأمور والأسرة
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                تعرّف على مراحل الجلسة التفاعلية، ثم جرّب القارئ العربي الميسّر.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 group-hover:text-[#15803D] transition-colors">
              <span>جرّب جلسة فحص نموذجية</span>
              <SoundwaveBarsIcon className="text-[#15803D]" />
            </div>
          </div>

          {/* Card 3: Leaders (قادة المدارس والتعليم) */}
          <div
            onClick={() => onNavigateTab('dashboard')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigateTab('dashboard');
              }
            }}
            className="group bg-white/80 hover:bg-white/95 backdrop-blur-md border border-white rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6 transition-all shadow-xs hover:shadow-md cursor-pointer text-right"
          >
            <div className="space-y-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-[#18181B] font-display">
                قادة المدارس والتعليم
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                كيف يمكن مراجعة المؤشرات الاسترشادية ضمن الملاحظة التربوية، مع مراعاة أولية للاختلافات اللهجية.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 group-hover:text-[#15803D] transition-colors">
              <span>افهم التقنية واستعرض التقارير</span>
              <SoundwaveBarsIcon className="text-[#15803D]" />
            </div>
          </div>
        </div>

        {/* Amira-Style Bottom Hero Divider: `ılılı|ılı Explore Baseera` */}
        <div className="relative z-10 mt-8 pt-4 flex items-center justify-center gap-4">
          <div className="h-[1px] flex-1 max-w-[240px] bg-slate-300/80" />
          <button
            type="button"
            onClick={() => scrollToSection('amira-session-walkthrough')}
            className="inline-flex items-center gap-2.5 text-xs font-bold text-slate-900 hover:text-[#15803D] transition-colors cursor-pointer"
          >
            <SoundwaveBarsIcon className="text-[#15803D]" />
            <span>استكشف بصيرة</span>
          </button>
          <div className="h-[1px] flex-1 max-w-[240px] bg-slate-300/80" />
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: AMIRA SESSION WALKTHROUGH ("ماذا يحدث عندما يقرأ الطالب مع بصيرة؟")
          Interactive 5-Stage Audio/Gaze Waveform Scrubber + Live Arabic Scanpath
          ===================================================================== */}
      <section
        id="amira-session-walkthrough"
        className="space-y-8 scroll-mt-24"
      >
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <h2
            className="font-display font-extrabold text-[#18181B] tracking-tight"
            style={{
              fontSize: 'clamp(1.75rem, 3vw, 2.75rem)',
              textWrap: 'balance',
            }}
          >
            ماذا يحدث عندما يقرأ الطالب مع بصيرة؟
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            استعرض مراحل الجلسة لحظةً بلحظة — من قبل أن يبدأ الطالب القراءة وحتى
            إصدار المؤشرات التربوية للمعلم.
          </p>
        </div>

        <div className="rounded-[2rem] bg-white border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Top Waveform Visualization Canvas (Matches Amira Section 2 Screenshot) */}
          <div className="relative bg-gradient-to-b from-slate-50/70 via-[#F8F7FF]/60 to-[#ECFDF5]/40 p-6 sm:p-8 border-b border-slate-200/80">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-4">
              <span>انقر على أي مرحلة أدناه للتنقل عبر جلسة الفحص</span>
              <span className="font-semibold text-emerald-800">
                المرحلة {activeStageIdx + 1} من {SESSION_TIMELINE_STAGES.length}
              </span>
            </div>

            {/* Flowing Background Sine Waves + Central Frosted Green Biometric Privacy Box */}
            <div className="relative py-4 flex items-center justify-center">
              <svg
                viewBox="0 0 1000 130"
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M0 65 Q 160 20, 320 65 T 640 65 T 1000 65"
                  fill="none"
                  stroke="#DDD6FE"
                  strokeWidth="2"
                />
                <path
                  d="M0 80 Q 180 115, 360 70 T 720 75 T 1000 55"
                  fill="none"
                  stroke="#C4B5FD"
                  strokeWidth="1.5"
                  strokeOpacity="0.7"
                />
                <line
                  x1="40"
                  y1="65"
                  x2="960"
                  y2="65"
                  stroke="#CBD5E1"
                  strokeWidth="1.5"
                  strokeDasharray="3 4"
                />
              </svg>

              {/* Central Mint-Green Privacy & Waveform Pill Box */}
              <div className="relative z-10 w-full max-w-xl rounded-2xl bg-[#ECFDF5]/95 border border-emerald-300/90 px-6 py-5 text-center shadow-xs space-y-4">
                <p className="text-xs sm:text-sm font-bold text-[#064E3B]">
                  {currentStage.privacyNote}
                </p>

                {/* Vertical Emerald Waveform Bars */}
                <div
                  className="h-14 flex items-center justify-center gap-1.5"
                  aria-hidden="true"
                >
                  {currentStage.waveBars.map((heightPct, idx) => (
                    <span
                      key={idx}
                      style={{ height: `${heightPct}%` }}
                      className="w-1.5 rounded-full bg-[#16A34A] transition-all duration-300"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 5-Stage Horizontal Interactive Stepper Track (Matches Amira Dots) */}
            <div
              role="tablist"
              aria-label="مراحل جلسة القراءة مع بصيرة"
              className="mt-6 pt-4 border-t border-slate-200/70 grid grid-cols-2 sm:grid-cols-5 gap-3"
            >
              {SESSION_TIMELINE_STAGES.map((stage, idx) => {
                const isSelected = idx === activeStageIdx;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setActiveStageIdx(idx)}
                    className={`p-2.5 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
                      isSelected
                        ? 'bg-emerald-50/90 text-slate-950 font-bold'
                        : 'hover:bg-slate-100/80 text-slate-600'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                        isSelected
                          ? 'bg-[#16A34A] border-[#16A34A] scale-110'
                          : 'bg-white border-slate-300'
                      }`}
                    />
                    <span className="text-xs leading-snug">
                      {stage.tabLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Stage Explanation + Live Interactive Arabic Scanpath Simulator */}
          <div className="p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Right Column (6 cols): Selected Stage Story */}
            <div className="lg:col-span-6 space-y-4 text-right">
              <div className="text-xs font-bold tracking-wide text-[#15803D]">
                {currentStage.kicker}
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#18181B] font-display leading-snug">
                {currentStage.headline}
              </h3>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {currentStage.description}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab(currentStage.targetTab)}
                  className="px-5 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs sm:text-sm font-bold transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>{currentStage.actionLabel}</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Left Column (6 cols): Live Interactive Gaze & Speech Alignment Preview */}
            <div className="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    محاكاة حية لرصد العين والصوت:
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAutoAnimatingGaze((prev) => !prev)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-800 hover:bg-slate-100 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {isAutoAnimatingGaze ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>إيقاف</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        <span>تشغيل</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'dyslexia-risk', label: 'عسر قراءة' },
                      { id: 'dialect-nominal', label: 'تنوع لهجي' },
                      { id: 'fluent', label: 'مثال تجريبي' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setSimProfile(tab.id);
                        setSelectedNodeIdx(0);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg cursor-pointer ${
                        simProfile === tab.id
                          ? 'bg-[#15803D] text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#0F172A] rounded-xl p-3 border border-slate-800">
                <svg
                  viewBox="0 0 600 135"
                  className="w-full h-auto select-none"
                  role="img"
                  aria-label="محاكاة حية لمسار حركة العين"
                >
                  <line
                    x1="40"
                    y1="68"
                    x2="560"
                    y2="68"
                    stroke="#1E293B"
                    strokeWidth="2"
                  />
                  {activeSim.nodes.map((node, idx) => {
                    if (idx === 0) return null;
                    const prev = activeSim.nodes[idx - 1];
                    const x1 = (prev.x / 100) * 600;
                    const y1 = (prev.y / 100) * 135;
                    const x2 = (node.x / 100) * 600;
                    const y2 = (node.y / 100) * 135;
                    return (
                      <line
                        key={`line-${idx}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={node.regression ? '#F59E0B' : '#34D399'}
                        strokeWidth="2"
                        strokeDasharray={node.regression ? '5 3' : undefined}
                      />
                    );
                  })}

                  <circle
                    cx={activeCx}
                    cy={activeCy}
                    r={21}
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="1.5"
                    strokeOpacity="0.65"
                    style={{
                      transition:
                        'cx 380ms cubic-bezier(0.16, 1, 0.3, 1), cy 380ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />

                  {activeSim.nodes.map((node, idx) => {
                    const cx = (node.x / 100) * 600;
                    const cy = (node.y / 100) * 135;
                    const r = Math.max(
                      11,
                      Math.min(19, Math.round(node.fixationMs / 25))
                    );
                    const isSelected = idx === selectedNodeIdx;
                    const fill =
                      node.classification === 'substitution'
                        ? '#EF4444'
                        : node.classification === 'dialect'
                          ? '#10B981'
                          : '#0284C7';

                    return (
                      <g
                        key={node.word}
                        onClick={() => {
                          setIsAutoAnimatingGaze(false);
                          setSelectedNodeIdx(idx);
                          speakArabicText(node.word);
                        }}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={fill}
                          fillOpacity={isSelected ? 0.9 : 0.45}
                          stroke={isSelected ? '#FFFFFF' : fill}
                          strokeWidth={isSelected ? 2 : 1}
                        />
                        <text
                          x={cx}
                          y={cy + 4}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="10"
                          fontWeight="700"
                        >
                          {node.fixationMs}
                        </text>
                        <text
                          x={cx}
                          y={cy - r - 7}
                          textAnchor="middle"
                          fill={isSelected ? '#F8FAFC' : '#CBD5E1'}
                          fontSize="13"
                          fontWeight="700"
                        >
                          {node.word}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                  <span>
                    الكلمة:{' '}
                    <strong className="text-white">{activeNode.word}</strong> ←
                    نطق الطالب:{' '}
                    <strong className="text-emerald-300">
                      «{activeNode.spoken}»
                    </strong>
                  </span>
                  <span className="font-semibold text-emerald-400">
                    {activeNode.classificationLabel} ({activeNode.fixationMs}{' '}
                    مللي ثانية)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: COMPACT FEATURE NAVIGATION
          The animated reading simulation and interactive sections above/below stay intact.
          ===================================================================== */}
      <section className="rounded-[2rem] bg-white border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="max-w-3xl space-y-2">
          <div className="text-xs font-bold text-[#15803D]">استكشف النموذج</div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
            اختر التجربة التي تريد استكشافها
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            صُممت بصيرة كنموذج أولي عربي يجمع بين القراءة الجهرية، ومؤشرات النظر، ومهام الإدراك العددي، وأدوات تيسير القراءة. المؤشرات استرشادية وليست تشخيصاً معتمداً.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { id: 'eye-lab' as AppTabId, title: 'القراءة وتتبع العين', description: 'جرّب المعايرة والقراءة الجهرية، وراجع جودة البيانات قبل تفسير المؤشرات.' },
            { id: 'dyscalculia-lab' as AppTabId, title: 'مهام الحساب', description: 'استكشف التمييز الكمي وتقدير الموقع على خط الأعداد وترميز الأرقام.' },
            { id: 'adaptive-reader' as AppTabId, title: 'القارئ العربي الميسّر', description: 'جرّب التشكيل والتباعد والتقطيع والتلوين لتحسين سهولة عرض النص.' },
            { id: 'algorithms-lab' as AppTabId, title: 'المنهجية والحدود', description: 'اطّلع على المؤشرات المستخدمة وما لا يمكن استنتاجه من النموذج الحالي.' },
          ].map((feature) => (
            <button
              key={feature.id}
              type="button"
              onClick={() => onNavigateTab(feature.id)}
              className="text-right p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-bold text-slate-900">{feature.title}</span>
                <ArrowLeft className="w-4 h-4 text-[#15803D] shrink-0 transition-transform group-hover:-translate-x-1" />
              </div>
              <p className="text-xs leading-relaxed text-slate-600">{feature.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* =====================================================================
          SECTION 4: QUICK STUDENT LIFECYCLE & DEMO PORTAL
          (1-Click Ready Gulf/Arabic Profiles + New Student Registration + 4-Step Map)
          ===================================================================== */}
      <section
        id="quick-student-portal"
        className="rounded-[2rem] bg-white border border-slate-200 p-6 sm:p-10 shadow-xs space-y-8 scroll-mt-24"
      >
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-[#15803D]">
              مسار تجريبي تفاعلي
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              جرّب المسار بملف تجريبي أو أنشئ سجلاً للاختبار
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600">
            تسير الرحلة في ٤ خطوات: اختيار الملف ← القراءة والعين ← الحساب ← التقرير. الملفات المعروضة تجريبية، ولا تمثل نتائج طلاب حقيقيين. لا تُدخل بيانات أطفال حقيقية في هذه النسخة.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Right Column (7 cols): 3 Ready Student Profiles + New Student Form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  أ) اختر ملفاً تجريبياً (بيانات اصطناعية):
                </span>
                <span className="text-[11px] text-slate-500">
                  النتائج المعروضة أمثلة توضيحية وليست تشخيصاً
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {students.filter((stu) => stu.isDemoRecord).slice(0, 3).map((stu) => {
                  const isCurrent = stu.id === activeStudent.id;
                  return (
                    <div
                      key={stu.id}
                      className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between gap-3 ${
                        isCurrent
                          ? 'bg-emerald-50/70 border-[#15803D]'
                          : 'bg-slate-50 border-slate-200 hover:border-[#15803D]'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900 leading-snug">
                          {stu.name}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1">
                          الصف {stu.gradeLevel} ·{' '}
                          <span
                            className={`font-semibold ${
                              stu.readingRiskLevel === 'high'
                                ? 'text-[#DC2626]'
                                : stu.readingRiskLevel === 'moderate'
                                  ? 'text-[#D97706]'
                                  : 'text-[#059669]'
                            }`}
                          >
                            {stu.readingRiskLevel === 'high'
                              ? 'مؤشر تجريبي مرتفع'
                              : stu.readingRiskLevel === 'moderate'
                                ? 'مؤشر تجريبي متوسط'
                                : 'مثال تجريبي'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-1.5 pt-2 border-t border-slate-200/80">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectExistingDemoJourney(stu.id, 'eye-lab')
                          }
                          className="flex-1 py-1.5 px-2 bg-[#15803D] hover:bg-[#166534] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap"
                        >
                          بدء الفحص ←
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectStudentReport(stu.id)}
                          aria-label={`عرض التقرير النهائي للطالب ${stu.name}`}
                          className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <FileText className="w-3 h-3 text-[#15803D] shrink-0" />
                          <span>التقرير</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* New Student Registration Form */}
            <form
              onSubmit={handleQuickStartSubmit}
              className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-[#15803D]" />
                  <span>ب) أو أنشئ سجلاً للاختبار دون بيانات شخصية حقيقية:</span>
                </span>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setMockRole('student')}
                    className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                      mockRole === 'student'
                        ? 'bg-[#15803D] text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    تجربة كطالب
                  </button>
                  <button
                    type="button"
                    onClick={() => setMockRole('specialist')}
                    className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                      mockRole === 'specialist'
                        ? 'bg-[#15803D] text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    تجربة كمختص
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="mock-user-name"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    اسم الطالب الثلاثي
                  </label>
                  <input
                    id="mock-user-name"
                    type="text"
                    value={mockName}
                    onChange={(e) => setMockName(e.target.value)}
                    placeholder="اسم مستعار للتجربة"
                    autoComplete="off"
                    required
                    maxLength={100}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#15803D]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="mock-user-grade"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    الصف الدراسي
                  </label>
                  <select
                    id="mock-user-grade"
                    value={mockGrade}
                    onChange={(e) => setMockGrade(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#15803D]"
                  >
                    <option value={2}>الصف الثاني الابتدائي</option>
                    <option value={3}>الصف الثالث الابتدائي</option>
                    <option value={4}>الصف الرابع الابتدائي</option>
                    <option value={5}>الصف الخامس الابتدائي</option>
                    <option value={6}>الصف السادس الابتدائي</option>
                  </select>
                </div>
              </div>

              {registrationNotice && (
                <div className="text-xs font-semibold text-[#059669]">
                  {registrationNotice}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#18181B] hover:bg-[#15803D] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>تسجيل الطالب والانتقال إلى فحص القراءة والعين</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Left Column (5 cols): The 4 Sequential Stations Map */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                خريطة رحلة المستخدم (٤ محطات واضحة)
              </h3>
              <p className="text-xs text-slate-500">
                انقر على أي محطة للانتقال إليها مباشرة:
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  step: '٠١',
                  title: 'اختيار أو تسجيل الطالب',
                  desc: 'تحديد حساب الطالب والصف الدراسي لبدء الجلسة.',
                  tab: 'home' as AppTabId,
                  active: true,
                },
                {
                  step: '٠٢',
                  title: 'فحص القراءة وتتبع العين',
                  desc: 'معايرة الكاميرا وقراءة الفقرة بصوت مسموع.',
                  tab: 'eye-lab' as AppTabId,
                  active: false,
                },
                {
                  step: '٠٣',
                  title: 'فحص الحساب وخط الأعداد',
                  desc: 'قياس التقدير الكمي والتمييز السريع للكميات.',
                  tab: 'dyscalculia-lab' as AppTabId,
                  active: false,
                },
                {
                  step: '٠٤',
                  title: 'التقرير النهائي والقارئ الميسّر',
                  desc: 'استلام التقرير الموحد وتدريب الطالب قرائياً.',
                  tab: 'dashboard' as AppTabId,
                  active: false,
                },
              ].map((item) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => onNavigateTab(item.tab)}
                  className={`w-full p-3 rounded-xl border text-right transition-all flex items-start gap-3 cursor-pointer ${
                    item.active
                      ? 'bg-emerald-50/90 border-[#15803D]'
                      : 'bg-white border-slate-200 hover:border-[#15803D]'
                  }`}
                >
                  <span className="px-2 py-1 rounded-lg bg-[#15803D] text-white font-mono text-xs font-bold shrink-0">
                    {item.step}
                  </span>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900">
                      {item.title}
                    </div>
                    <p className="text-[11px] text-slate-600">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 5: INTERACTIVE DYSLEXIA LENS + AMIRA "STRAIGHT ANSWERS, ON THE RECORD"
          ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Right Column (7 cols): Interactive Arabic Dyslexia Lens */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between space-y-5 shadow-xs">
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#15803D]">
              تجربة تفاعلية لتيسير القراءة العربية
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-display">
              جرّب بنفسك: كيف نُحوّل النص المزدحم إلى قراءة ميسّرة لذوي عسر
              القراءة؟
            </h2>

            <div
              role="tablist"
              aria-label="أوضاع تيسير القراءة"
              className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl"
            >
              {(
                [
                  { id: 'crowded', label: '١. نص تقليدي مزدحم' },
                  { id: 'syllabic-colored', label: '٢. تقطيع مقطعي وتلوين' },
                  { id: 'bionic-guided', label: '٣. تركيز بصري للجذر' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={empathyMode === m.id}
                  onClick={() => setEmpathyMode(m.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    empathyMode === m.id
                      ? 'bg-[#15803D] text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`rounded-2xl border p-5 transition-all ${
              empathyMode === 'crowded'
                ? 'bg-white border-rose-200'
                : 'bg-[#FAF6EE] border-[#E5DEC9]'
            }`}
          >
            <div
              className={`flex flex-wrap items-center gap-y-3.5 ${
                empathyMode === 'crowded' ? 'gap-x-2' : 'gap-x-3.5'
              }`}
            >
              {EMPATHY_SAMPLE_WORDS.map((word, wIdx) => {
                const isSelectedWord = activeSpokenSampleWord === word;

                if (empathyMode === 'crowded') {
                  return (
                    <button
                      key={wIdx}
                      type="button"
                      onClick={() => {
                        setActiveSpokenSampleWord(word);
                        speakArabicText(word);
                      }}
                      className="text-xl sm:text-2xl font-serif text-slate-900 tracking-tighter leading-tight px-1.5 py-1 rounded hover:bg-rose-50 cursor-pointer animate-crowded-jitter"
                    >
                      {word}
                    </button>
                  );
                }

                if (empathyMode === 'syllabic-colored') {
                  const syllables = segmentArabicWordIntoSyllables(word);
                  return (
                    <button
                      key={wIdx}
                      type="button"
                      onClick={() => {
                        setActiveSpokenSampleWord(word);
                        speakArabicText(word);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xl sm:text-2xl font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        isSelectedWord
                          ? 'bg-white border-[#15803D] ring-2 ring-[#15803D]/20'
                          : 'bg-white/90 border-slate-200 hover:border-[#15803D]'
                      }`}
                    >
                      {syllables.map((syl, sIdx) => (
                        <React.Fragment key={sIdx}>
                          <span>
                            {Array.from(syl).map((ch, cIdx) => {
                              const group = getConfusableLetterGroup(ch);
                              const colorClass =
                                group === 'baa_group'
                                  ? 'text-[#0284C7]'
                                  : group === 'jeem_group'
                                    ? 'text-[#059669]'
                                    : group === 'ain_group' ||
                                        group === 'dal_group'
                                      ? 'text-[#D97706]'
                                      : 'text-slate-900';
                              return (
                                <span key={cIdx} className={colorClass}>
                                  {ch}
                                </span>
                              );
                            })}
                          </span>
                          {sIdx < syllables.length - 1 && (
                            <span className="text-slate-300 text-sm font-mono mx-0.5">
                              ·
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </button>
                  );
                }

                const chars = Array.from(word);
                const splitAt = Math.min(3, Math.ceil(chars.length / 2));
                const rootLead = chars.slice(0, splitAt).join('');
                const restChars = chars.slice(splitAt).join('');

                return (
                  <button
                    key={wIdx}
                    type="button"
                    onClick={() => {
                      setActiveSpokenSampleWord(word);
                      speakArabicText(word);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xl sm:text-2xl transition-all cursor-pointer ${
                      isSelectedWord
                        ? 'bg-amber-50 border-amber-400'
                        : 'bg-white border-slate-200 hover:border-[#15803D]'
                    }`}
                  >
                    <strong className="font-extrabold text-[#15803D]">
                      {rootLead}
                    </strong>
                    <span className="font-medium text-slate-700">
                      {restChars}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => speakArabicText(activeSpokenSampleWord)}
                  className="px-3 py-1.5 rounded-lg bg-[#15803D] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>نطق: «{activeSpokenSampleWord}»</span>
                </button>
                <span className="text-slate-600">
                  المقاطع:{' '}
                  <strong className="font-mono text-slate-900">
                    {segmentArabicWordIntoSyllables(
                      activeSpokenSampleWord
                    ).join(' · ')}
                  </strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('adaptive-reader')}
                className="font-bold text-[#15803D] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>فتح القارئ الميسّر الكامل</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Left Column (5 cols): Amira "Straight answers, on the record." (Trust Center) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between space-y-5 shadow-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#15803D]">
              <ShieldCheck className="w-4 h-4" />
              <span>مركز الثقة والخصوصية</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#18181B] font-display">
              إجابات واضحة عن الاستخدام والخصوصية
            </h2>
            <p className="text-xs text-slate-600">
              اختر سؤالاً أو ابحث عن استفسارك لتطّلع على سياسة حماية بيانات
              الطلاب وموافقة ولي الأمر:
            </p>
          </div>

          {/* Question Pill Buttons */}
          <div className="flex flex-wrap gap-1.5">
            {TRUST_CENTER_QUESTIONS.map((item) => {
              const isSelected = item.id === selectedTrustQuestionId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedTrustQuestionId(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold text-right transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#18181B] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {item.question}
                </button>
              );
            })}
          </div>

          {/* Official On-The-Record Answer Log Box */}
          <div
            role="region"
            aria-live="polite"
            className="p-4 rounded-2xl bg-[#F0FDF4] border border-emerald-200 space-y-1.5"
          >
            <div className="text-xs font-bold text-[#065F46]">
              {activeTrustItem.answerTitle}
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {activeTrustItem.answerBody}
            </p>
          </div>

          {/* Search / Ask Box */}
          <form onSubmit={handleCustomTrustAsk} className="flex gap-2">
            <input
              type="text"
              value={customTrustQuery}
              onChange={(e) => setCustomTrustQuery(e.target.value)}
              placeholder="اطرح سؤالاً (مثال: كيف تعالج اللهجة الخليجية؟)"
              aria-label="اطرح سؤالاً في مركز الثقة"
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#15803D]"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold cursor-pointer shrink-0"
            >
              اعرض الإجابة
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};
