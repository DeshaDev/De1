import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Calculator,
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
  Volume2,
} from 'lucide-react';
import { StudentRecord } from '../data/seedData';

export type AppTabId =
  | 'home'
  | 'reading-lab'
  | 'cognitive-lab'
  | 'adaptive-reports'
  | 'dyscalculia-lab'
  | 'remediation-gym'
  | 'adaptive-reader'
  | 'dashboard'
  | 'privacy'
  | 'terms'
  | 'sprint'
  | 'storygen'
  | 'iep';

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
    title: 'الفرز المعرفي (RAN)',
    description: 'اختبارات التسمية الآلية السريعة، وفك الترميز، والوعي الفونولوجي المعتمدة.',
    action: 'ابدأ الفرز المعرفي',
    tone: 'blue',
    icon: Brain,
  },
  {
    id: 'reading-lab',
    title: 'رحلة القراءة',
    description: 'اقرأ نصًا قصيرًا، ثم أجب عن أسئلة الفهم.',
    action: 'ابدأ القراءة',
    tone: 'blue',
    icon: BookOpen,
  },
  {
    id: 'dyscalculia-lab',
    title: 'مغامرة الأعداد',
    description: 'اكتشف الأرقام والكميات من خلال مهام تفاعلية.',
    action: 'اكتشف الحساب',
    tone: 'yellow',
    icon: Calculator,
  },
  {
    id: 'adaptive-reader',
    title: 'القارئ الميسّر',
    description: 'غيّر طريقة عرض الكلمات واستمع إلى نطقها.',
    action: 'افتح القارئ',
    tone: 'pink',
    icon: Heart,
  },
  {
    id: 'remediation-gym',
    title: 'صالة التدريب',
    description: 'تدرّب على الحروف والمقاطع والأعداد بالوتيرة التي تناسبك.',
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
  onSelectExistingDemoJourney,
  onNavigateTab,
  onSelectStudentReport,
}) => {
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [autoPreview, setAutoPreview] = useState(true);
  const [motionAllowed, setMotionAllowed] = useState(true);
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

  return (
    <div className="baseera-home">
      <section className="baseera-hero" aria-labelledby="baseera-welcome-title">
        <div className="baseera-hero-copy">
          <div className="baseera-eyebrow">
            <Sparkles aria-hidden="true" size={18} />
            <span>مساحة عربية للقراءة والتعلّم</span>
          </div>
          <h1 id="baseera-welcome-title">
            منصة عربية لمهارات القراءة والحساب،
            <span> ومتابعة التعلّم خطوة بخطوة.</span>
          </h1>
          <p className="baseera-hero-intro">
            تجمع بصيرة أنشطة القراءة والفهم والحساب المدعومة بالذكاء الاصطناعي وملخصات أداء دقيقة لتحديد الخطوة التالية تلقائياً ودعم التعلم الذاتي.
          </p>
          <div className="baseera-hero-actions">
            <button
              type="button"
              className="baseera-primary-action"
              onClick={() => onNavigateTab('reading-lab')}
            >
              جرّب رحلة القراءة
              <ArrowLeft aria-hidden="true" size={19} />
            </button>
            <button
              type="button"
              className="baseera-secondary-action"
              onClick={() => onNavigateTab('adaptive-reader')}
            >
              اكتشف القارئ الميسّر
              <BookOpen aria-hidden="true" size={18} />
            </button>
          </div>
          <div className="baseera-promise-row" aria-label="مميزات بصيرة">
            <span><ShieldCheck aria-hidden="true" size={18} /> بيئة تعليمية آمنة للطفل</span>
            <span><Heart aria-hidden="true" size={18} /> تقييم معرفي وخطط دعم فردية</span>
          </div>
        </div>

        <div className="baseera-hero-art" aria-hidden="true">
          <span className="baseera-art-star baseera-art-star-one"><Star size={25} fill="currentColor" /></span>
          <span className="baseera-art-star baseera-art-star-two"><Sparkles size={28} /></span>
          <span className="baseera-art-dot baseera-art-dot-one" />
          <span className="baseera-art-dot baseera-art-dot-two" />
          <div className="baseera-art-note baseera-art-note-top">أحسنت المحاولة!</div>
          <div className="baseera-art-book">
            <BookOpen size={88} strokeWidth={1.7} />
            <span className="baseera-art-book-line" />
            <span className="baseera-art-book-line short" />
            <span className="baseera-art-book-line" />
          </div>
          <div className="baseera-art-note baseera-art-note-bottom">
            <Trophy aria-hidden="true" size={22} />
            <span>خطوة جديدة كل يوم</span>
          </div>
        </div>
      </section>

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

      <section className="baseera-activities-section" aria-labelledby="baseera-activities-title">
        <div className="baseera-section-heading">
          <div>
            <span className="baseera-section-kicker">اختر ما تحب</span>
            <h2 id="baseera-activities-title">ماذا نجرّب اليوم؟</h2>
            <p>أربع مساحات، وكل واحدة تساعدك على تعلّم شيء جديد.</p>
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

      <section className="baseera-steps-section" aria-labelledby="baseera-steps-title">
        <div className="baseera-section-heading">
          <div>
            <span className="baseera-section-kicker">بكل بساطة</span>
            <h2 id="baseera-steps-title">رحلتك في ثلاث خطوات</h2>
          </div>
        </div>
        <div className="baseera-steps-grid">
          <article className="baseera-step-card">
            <span className="baseera-step-number">١</span>
            <div className="baseera-step-icon"><Lightbulb aria-hidden="true" size={25} /></div>
            <h3>اختر نشاطًا</h3>
            <p>ابدأ بالقراءة أو الحساب أو جرّب أداة تساعدك على القراءة براحة.</p>
          </article>
          <article className="baseera-step-card">
            <span className="baseera-step-number">٢</span>
            <div className="baseera-step-icon"><Star aria-hidden="true" size={25} /></div>
            <h3>جرّب وتعلّم</h3>
            <p>خذ وقتك. يمكنك إعادة المحاولة والاستماع إلى الكلمات عند الحاجة.</p>
          </article>
          <article className="baseera-step-card">
            <span className="baseera-step-number">٣</span>
            <div className="baseera-step-icon"><Trophy aria-hidden="true" size={25} /></div>
            <h3>احتفل بتقدّمك</h3>
            <p>تابع ما أنجزته من أنشطة واختر التدريب التالي في مسار التعلم الذكي.</p>
          </article>
        </div>
      </section>

      <section className="baseera-family-panel" aria-labelledby="baseera-family-title">
        <div className="baseera-family-icon"><GraduationCap aria-hidden="true" size={30} /></div>
        <div className="baseera-family-copy">
          <h2 id="baseera-family-title">لوحة التحليل والمتابعة الذكية</h2>
          <p>
            تقيس بصيرة الأداء داخل أنشطة محددة، ولا تدّعي تشخيص عسر القراءة أو عسر الحساب. يجري تطوير المنصة والتحقق من مؤشرات أدائها؛ ولا ينبغي اعتبار النتائج الحالية معايير سكانية أو دليلًا سريريًا.
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
              className="baseera-text-action"
              onClick={() => onSelectExistingDemoJourney(demoStudent.id, 'reading-lab')}
            >
              تجربة نموذج توضيحي
            </button>
          )}
        </div>
      </section>

      <div className="baseera-kind-note">
        <CheckCircle2 aria-hidden="true" size={19} />
        <p>لا توجد إجابات تجعلك أقلّ قدرة من غيرك؛ كل محاولة فرصة جديدة للتعلّم.</p>
      </div>
    </div>
  );
};

export default HomeLandingView;
