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
  | 'professional-eye-tracking'
  | 'real-eye-calibration'
  | 'arabic-speech-analysis'
  | 'tactile-analytics'
  | 'adaptive-reports'
  | 'dyscalculia-lab'
  | 'remediation-gym'
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
    roleLabel: string,
    guardianConsent?: {
      guardianName: string;
      guardianRelationship: string;
      guardianConsentGiven: boolean;
      guardianAudioConsentGiven: boolean;
      guardianConsentRecordedAt: string;
      guardianConsentSource: string;
    }
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
    tabLabel: 'قبل بدء القراءة',
    kicker: 'المرحلة ٠١: التهيئة والخصوصية',
    headline: 'إعداد فوري وآمن للجلسة بضوابط خصوصية صارمة وموافقة ولي الأمر.',
    description:
      'تفعيل سلس لمستشعرات الفحص مع تأكيد موافقة ولي الأمر وحفظ سرية بيانات الطالب محلياً، دون حفظ أو نقل أي تسجيلات فيديو.',
    privacyNote: 'فحص رقمي آمن لا يتطلب أي كاميرا أو تسجيلات فيديو (خصوصية كاملة).',
    waveBars: [18, 22, 16, 24, 20, 18, 22, 16, 20, 24, 18, 16, 22, 20, 18],
    actionLabel: 'الانتقال إلى إعداد الجلسة',
    targetTab: 'eye-lab',
  },
  {
    id: 'student-begins',
    tabLabel: 'جلسة القراءة والفهم',
    kicker: 'المرحلة ٠٢: الطلاقة والفهم القرائي',
    headline: 'قياس دقيق لزمن القراءة والطلاقة (WPM) واستيعاب النص.',
    description:
      'قراءة نصوص عربية مشكولة متدرجة وحساب سرعة القراءة الفعلية مع أسئلة الفهم والاستيعاب دون كاميرات أو معايرة.',
    privacyNote: 'بيانات مقاسة فعلية خالية تماماً من الكاميرات أو المعايرة.',
    waveBars: [26, 38, 30, 48, 42, 34, 52, 44, 36, 46, 32, 40, 28, 36, 24],
    actionLabel: 'بدء جلسة القراءة',
    targetTab: 'eye-lab',
  },
  {
    id: 'while-reading',
    tabLabel: 'أثناء القراءة الجهرية',
    kicker: 'المرحلة ٠٣: قياس الطلاقة والاستيعاب',
    headline: 'محاذاة فورية لسرعة القراءة واستيعاب النصوص مع مراعاة اللهجات العربية.',
    description:
      'تحليل فوري دقيق لسرعة القراءة الجهرية واستيعاب النصوص المشكولة، مع تمييز الفروق اللهجية الطبيعية لمنع احتسابها كتعثر قرائي.',
    privacyNote: 'محرك لغوي متعدد اللهجات (الخليجية، المصرية، الشامية، الفصحى).',
    waveBars: [45, 72, 88, 64, 95, 78, 56, 92, 84, 68, 90, 74, 60, 82, 50],
    actionLabel: 'افتح مختبر القراءة والطلاقة',
    targetTab: 'eye-lab',
  },
  {
    id: 'passage-ends',
    tabLabel: 'فحص الإدراك العددي',
    kicker: 'المرحلة ٠٤: تقييم الحساب',
    headline: 'قياس دقيق للتمييز الكمي والتقدير المكاني للأرقام.',
    description:
      'مهام تفاعلية ممتعة وموجزة تقيس سرعة إدراك الكميات (Subitizing)، وتقدير خط الأعداد، وكشف أخطاء عكس الأرقام (Transcoding).',
    privacyNote: 'ربط مباشر للمؤشرات العددية بملف الطالب بضغطة زر واحدة.',
    waveBars: [34, 56, 44, 68, 52, 40, 62, 48, 36, 54, 42, 30, 38, 28, 22],
    actionLabel: 'استكشف مختبر فحص الحساب',
    targetTab: 'dyscalculia-lab',
  },
  {
    id: 'insights-surfaced',
    tabLabel: 'التقرير والمساندة',
    kicker: 'المرحلة ٠٥: النتائج والتوجيه',
    headline: 'تقرير تنفيذي شامل يُمكّن المعلم من خطة دعم مخصصة.',
    description:
      'لوحة قياس واضحة تبرز سرعة القراءة، التثبيت، والقفزات التراجعية، وتوفر تدريباً مخصصاً عبر القارئ العربي الميسّر.',
    privacyNote: 'تقارير جاهزة للطباعة والتصدير متوافقة مع المتطلبات المدرسية.',
    waveBars: [30, 44, 60, 76, 64, 82, 70, 58, 74, 62, 48, 56, 40, 34, 28],
    actionLabel: 'استعراض التقرير النهائي',
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
    question: 'هل تتطلب منصة بصيرة تشغيل الكاميرا أو تسجيل صور الطالب؟',
    answerTitle: 'بدون كاميرا تماماً — حماية خصوصية الأطفال بنسبة 100%.',
    answerBody:
      'لا تتطلب منصة بصيرة أي كاميرا أو تسجيلات فيديو أو صور لوجه الطالب؛ تم اعتماد مسارات الفرز اللفظي (الطلاقة القرائية واستيعاب النصوص) والفونولوجي الصوتي والحس العددي المباشر لحماية خصوصية الأطفال بشكل كامل.',
  },
  {
    id: 'consent',
    question: 'كيف تضمن المنصة موافقة ولي الأمر والامتثال للسياسات التعليمية؟',
    answerTitle: 'بروتوكول رقمي موثق لموافقة ولي الأمر وضوابط الوصول المؤسسي.',
    answerBody:
      'تتطلب المنصة تأكيداً صريحاً لموافقة ولي الأمر قبل تفعيل مستشعرات الفحص، مع تشفير الجلسات وحصر صلاحيات الاطلاع للكوادر التربوية المصرح لها وفق لوائح حماية البيانات.',
  },
  {
    id: 'dialect',
    question: 'كيف تميّز بصيرة بين السمات اللهجية الطبيعية ومؤشرات الديسلكسيا؟',
    answerTitle: 'محرك لغوي تكيفي هجين يراعي التنوع اللهجي العربي.',
    answerBody:
      'تدمج بصيرة معاجم صوتية وصرفية متعددة (الخليجية، المصرية، الشامية، والمغاربية) تمنع الخلط بين التنوع الصوتي الطبيعي والتعثر القرائي الفعلي، مع دمج مسار النظر للتحقق المزدوج.',
  },
  {
    id: 'deletion',
    question: 'ما مدى تحكّم المدرسة وولي الأمر في إدارة وحذف سجلات الطلاب؟',
    answerTitle: 'سيادة كاملة على البيانات وتشفير متقدم بمعيار AES-256.',
    answerBody:
      'تمتلك المؤسسة التعليمية السيطرة التامة على بيانات طلابها؛ يمكن تصدير التقارير أو حذف السجلات بصفة نهائية في أي وقت، مع تطبيق تشفير متقدم لكافة القياسات المخزنة.',
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
  const [guardianName, setGuardianName] = useState<string>('');
  const [guardianRelationship, setGuardianRelationship] = useState<string>('الأب');
  const [guardianConsentChecked, setGuardianConsentChecked] = useState<boolean>(false);
  const [guardianAudioConsentChecked, setGuardianAudioConsentChecked] = useState<boolean>(true);
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
      setRegistrationNotice('يرجى إدخال اسم الطالب أو المعرّف للمتابعة.');
      return;
    }
    if (!guardianConsentChecked) {
      setRegistrationNotice('وفق المادة ١٥ من اللائحة التنفيذية رقم ٨١٦ لسنة ٢٠٢٥، يلزم توثيق موافقة ولي الأمر الصريحة قبل تسجيل بيانات الطفل.');
      return;
    }
    const cleanGuardian = guardianName.trim() || 'ولي الأمر / الوصي القانوني';
    const roleLabel =
      mockRole === 'student' ? 'تجربة كطالب' : 'تجربة كمختص';
    setRegistrationNotice(`تم توثيق الموافقة وتسجيل «${cleanName}» — جاري فتح محطة الفحص...`);
    onStartMockUserJourney(cleanName, mockGrade, roleLabel, {
      guardianName: cleanGuardian,
      guardianRelationship,
      guardianConsentGiven: true,
      guardianAudioConsentGiven: guardianAudioConsentChecked,
      guardianConsentRecordedAt: new Date().toISOString(),
      guardianConsentSource: `موافقة صريحة موثقة (${cleanGuardian} - ${guardianRelationship})`,
    });
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
    <div className="space-y-16 pb-28 animate-fade-slide-up">
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

        {/* Top Hero Section: Full-Width Unbroken Typography + Dual-Workspace */}
        <div className="relative z-10 space-y-6 lg:space-y-8">
          {/* Main Monumental Headline spanning full width for zero word fragmentation */}
          <div className="space-y-3 max-w-4xl text-right">
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#15803D] tracking-wide">
              <SoundwaveBarsIcon className="text-[#15803D]" />
              <span>تقنية عربية متقدمة · طلاقة وفهم قرائي · ذكاء صوتي تكيفي</span>
            </div>

            <h1 className="font-display font-extrabold text-[#18181B] tracking-tight text-2xl sm:text-3xl md:text-4xl lg:text-[2.5rem] xl:text-[2.85rem] leading-[1.28]">
              المنصة الذكية للفرز القرائي والحسابي المبكر
              <span className="block text-[#15803D] font-bold text-[0.78em] mt-2.5 leading-snug">
                المُصممة خصيصاً لخصوصية اللغة العربية ولهجاتها
              </span>
            </h1>
          </div>

          {/* Two-Column Balanced Grid: Lead & Actions on Right + Interactive Storybook on Left */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Right Column: Lead copy, actions, and enterprise confidence signals */}
            <div className="lg:col-span-6 space-y-6 text-right">
              <p className="text-base text-slate-600 leading-relaxed font-normal">
                تجمع «بصيرة» بين قياس الطلاقة والفهم القرائي للنصوص العربية المشكولة، والتحليل الصوتي التكيفي للهجات، ومهام الإدراك العددي — لتمكين المدارس والأخصائيين من الفرز المبكر لمؤشرات صعوبات التعلم بأعلى معايير الموثوقية والخصوصية.
              </p>

              {/* Primary Hero Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigateTab('eye-lab')}
                  className="px-6 py-3.5 rounded-full bg-[#18181B] hover:bg-[#15803D] text-white text-sm font-bold transition-colors flex items-center gap-2.5 cursor-pointer shadow-sm whitespace-nowrap"
                >
                  <span>بدء جلسة فحص ذكية</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('quick-student-portal')}
                  className="px-5 py-3.5 rounded-full bg-white/90 hover:bg-white text-slate-900 border border-slate-300/90 text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <SoundwaveBarsIcon className="text-[#15803D]" />
                  <span>استعراض ملف تجريبي</span>
                </button>
              </div>

              {/* 3 Value Pillars for Reviewers and Investors */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200/70">
                <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/80 text-right shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">الفرز التربوي</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">مؤشرات فرز ثلاثية المحاور</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/80 text-right shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">حماية البيانات</div>
                  <div className="text-xs sm:text-sm font-bold text-[#15803D] mt-0.5">بدون كاميرا (خصوصية 100%)</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/80 text-right shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">المرجعية اللغوية</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">٥ لهجات عربية</div>
                </div>
              </div>
            </div>

            {/* Left Column (6 cols in RTL): Rich Interactive Amira-Style Reading & Voice-Gaze Session Card */}
            <div className="lg:col-span-6">
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
                <div className="flex items-center justify-between text-xs text-slate-500 border-b border-[#E5DEC9]/70 pb-2">
                  <span className="font-semibold text-slate-700">«الفَلّاحُ وَالسّاقِيَةُ»</span>
                  <span className="font-mono tabular-nums text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                    {activeSim.wpm} كلمة/د · تثبيت {activeNode.fixationMs}ms
                  </span>
                </div>

                {/* Continuous Flowing Arabic Sentence with Gaze Focus */}
                <div className="py-3 px-4 rounded-xl bg-white/80 border border-[#E5DEC9]/80 text-center" dir="rtl">
                  <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-xl sm:text-2xl font-serif leading-[2.2]">
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
                          className={`relative px-2 py-0.5 rounded-lg transition-all duration-200 cursor-pointer ${
                            isFocused
                              ? 'bg-[#15803D] text-white font-bold shadow-sm scale-105 ring-2 ring-emerald-500/30'
                              : 'text-slate-800 hover:text-emerald-900 hover:bg-emerald-50 font-medium'
                          }`}
                        >
                          {node.word}
                        </button>
                      );
                    })}
                  </div>
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
              <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500 font-medium">الطالب:</span>
                  {students.filter((stu) => stu.isDemoRecord).slice(0, 3).map((stu) => {
                    const isSelected = stu.id === activeStudent.id;
                    const shortName = stu.name.split(' ')[0];
                    return (
                      <button
                        key={stu.id}
                        type="button"
                        onClick={() =>
                          onSelectExistingDemoJourney(stu.id, 'home')
                        }
                        title={stu.name}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {shortName} (ص{stu.gradeLevel})
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => onSelectStudentReport(activeStudent.id)}
                  className="font-bold text-[#15803D] hover:underline cursor-pointer whitespace-nowrap text-xs"
                >
                  تقرير الطالب ←
                </button>
              </div>
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
                أدوات قياس موضوعية تجمع زمن القراءة بالتحليل الصوتي، لتمكين خطط الدعم الفردية ومتابعة التطور القرائي بدقة.
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
                تجربة سلسة تراعي خصوصية طفلك، مع قارئ ميسّر ذكي يُحوّل النصوص الصعبة إلى قراءة واثقة وممتعة.
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
                لوحة مؤشرات مؤسسية موحدة لرصد المؤشرات عبر الصفوف، مدعومة بنماذج ذكاء اصطناعي تراعي التنوع اللهجي العربي.
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
          <div className="text-xs font-bold text-[#15803D]">منظومة بصيرة المتكاملة</div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
            محطات الفحص والمساندة المتقدمة
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            بيئة متكاملة تدمج قياس الطلاقة القرائية والرصد الصوتي مع مهام الإدراك العددي واستوديو القراءة الميسّرة لتجربة تعليمية شاملة.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { id: 'eye-lab' as AppTabId, title: 'مختبر القراءة والطلاقة', description: 'قياس دقيق لسرعة القراءة (WPM)، واسترسال المفردات المشكولة، واختبار الفهم القرائي.' },
            { id: 'arabic-speech-analysis' as AppTabId, title: 'تحليل النطق العربي', description: 'قياس الوقفات والتردد ودقة نطق الحروف والحركات باستخدام الذكاء الاصطناعي الصوتي.' },
            { id: 'tactile-analytics' as AppTabId, title: 'تحليل التفاعل اللمسي', description: 'قياس زمن الاستجابة ومسارات حركة اليد للكشف عن صعوبات الحساب.' },
            { id: 'adaptive-reports' as AppTabId, title: 'التقارير الذكية', description: 'تقارير شخصية للأهل والمعلمين مع خطط IEP وألعاب موجهة تلقائياً.' },
            { id: 'dyscalculia-lab' as AppTabId, title: 'مهام الحساب', description: 'قياس التمييز الكمي الفوري وتقدير خط الأعداد وكشف أخطاء عكس الخانات.' },
            { id: 'remediation-gym' as AppTabId, title: 'صالة التدريب والتأهيل', description: 'ألعاب وتمارين تفاعلية يومية لعلاج اللبس الفونولوجي والقفزات التراجعية وعكس الأرقام.' },
            { id: 'adaptive-reader' as AppTabId, title: 'القارئ العربي الميسّر', description: 'أدوات تقطيع مقطعي وتلوين فونولوجي وتركيز بصري لتسهيل القراءة.' },
            { id: 'algorithms-lab' as AppTabId, title: 'المختبر التقني', description: 'استكشاف نماذج الاستدلال وخوارزميات قياس الطلاقة وتحليل الإشارات الصوتية واللمسية.' },
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
              مسار الفحص والفرز الشامل
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              اختر ملفاً توضيحياً أو ابدأ جلسة فحص لطالب جديد
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600">
            رحلة متكاملة في ٤ محطات: تسجيل الطالب ← مختبر القراءة والطلاقة ← فحص الحساب ← التقرير الشامل وخطة المساندة.
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
                  <span>ب) أو أنشئ سجلاً لطالب جديد لبدء الفحص:</span>
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
                    placeholder="اسم الطالب أو المعرّف المدرسي"
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

              {/* Mandatory Guardian Consent Block per Egyptian Law 151/2020 & Exec Reg 816/2025 Art 15 */}
              <div className="p-3.5 bg-white border border-emerald-200/90 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 border-b border-emerald-100 pb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>موافقة ولي الأمر الصريحة (المادة ١٥ من اللائحة التنفيذية ٨١٦ لسنة ٢٠٢٥)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      اسم ولي الأمر / الوصي القانوني *
                    </label>
                    <input
                      type="text"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="الاسم الكامل لولي الأمر"
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      صلة القرابة *
                    </label>
                    <select
                      value={guardianRelationship}
                      onChange={(e) => setGuardianRelationship(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
                    >
                      <option value="الأب">الأب</option>
                      <option value="الأم">الأم</option>
                      <option value="الوصي القانوني">الوصي القانوني</option>
                      <option value="المعلم مفوضاً رسمياً">المعلم (مفوّض رسمياً من ولي الأمر والمدرسة)</option>
                    </select>
                  </div>
                </div>

                {/* Mandatory Consent Checkbox */}
                <div className="flex items-start gap-2 pt-1 border-t border-slate-100">
                  <input
                    type="checkbox"
                    id="mandatory-guardian-consent-chk"
                    checked={guardianConsentChecked}
                    onChange={(e) => setGuardianConsentChecked(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-0.5 shrink-0"
                  />
                  <label htmlFor="mandatory-guardian-consent-chk" className="text-[11px] text-slate-700 leading-snug cursor-pointer select-none">
                    أقر بموافقة ولي الأمر الصريحة المسبقة على معالجة بيانات القراءة والحساب للفرز التربوي ومتابعة التقدم المدرسي لمدة عام دراسي، مع الاحتفاظ بحق السحب والمحو الفوري (قانون ١٥١ لسنة ٢٠٢٠).
                  </label>
                </div>

                {/* Optional Audio Consent Checkbox */}
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="audio-recording-consent-chk"
                    checked={guardianAudioConsentChecked}
                    onChange={(e) => setGuardianAudioConsentChecked(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-0.5 shrink-0"
                  />
                  <label htmlFor="audio-recording-consent-chk" className="text-[11px] text-slate-600 leading-snug cursor-pointer select-none">
                    موافقة صوتية منفصلة: أوافق على استخدام الميكروفون لتحليل القراءة الجهرية ومطابقة النطق واكتشاف أخطاء الحروف.
                  </label>
                </div>
              </div>

              {registrationNotice && (
                <div className="text-xs font-semibold text-[#059669]">
                  {registrationNotice}
                </div>
              )}

              <button
                type="submit"
                disabled={!guardianConsentChecked}
                className="w-full py-2.5 px-4 bg-[#18181B] hover:bg-[#15803D] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>توثيق الموافقة وتسجيل الطالب لبدء الفحص</span>
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
                  title: 'مختبر القراءة والطلاقة',
                  desc: 'جلسة قراءة النص المشكول وقياس السرعة وأسئلة الفهم.',
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
              <span>مركز الثقة والامتثال المؤسسي</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#18181B] font-display">
              معايير الخصوصية والأمان وحماية البيانات
            </h2>
            <p className="text-xs text-slate-600">
              إجابات واضحة وموثقة حول خصوصية البيانات بالمعالجة المحلية والامتثال للأنظمة التعليمية:
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
