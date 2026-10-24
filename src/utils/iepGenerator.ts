/**
 * Individualized Education Plan (IEP) Generator for Arabic Reading & Phonics
 * Based on clinical screening metrics, WCPM fluency, and phonemic error profiles.
 * Adheres to pedagogical standards while strictly distinguishing screening from neurological diagnosis.
 */

export interface WeeklyScheduleItem {
  day: string;
  activity: string;
  durationMinutes: number;
}

export interface IEPDocument {
  studentName: string;
  gradeLevel: number;
  date: string;
  baselineSummary: string;
  annualGoals: string[];
  shortTermObjectives: string[];
  accommodations: string[];
  weeklySchedule: WeeklyScheduleItem[];
  clinicalDisclaimer: string;
  source: 'ai_synthesized' | 'clinical_rule_engine';
}

export async function generateStudentIEP(params: {
  studentName: string;
  gradeLevel: number;
  wcpm: number;
  accuracy: number;
  ranDurationSec: number;
  ranCategory?: string;
  pseudoAccuracy?: number;
  phonemicScore?: number;
  observedTargets?: string[];
}): Promise<IEPDocument> {
  const {
    studentName,
    gradeLevel,
    wcpm,
    accuracy,
    ranDurationSec,
    ranCategory = 'colors',
    pseudoAccuracy = 75,
    phonemicScore = 4,
    observedTargets = [],
  } = params;

  try {
    const res = await fetch('/api/ai/generate-iep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.annualGoals && data.baselineSummary) {
        return {
          ...data,
          source: 'ai_synthesized',
        };
      }
    }
  } catch (err) {
    console.warn('AI IEP generation error, using clinical rule engine fallback:', err);
  }

  // Clinical Rule-Based Fallback
  const targetFocus = observedTargets.length > 0 ? observedTargets.slice(0, 3).join('، ') : 'الأزواج الصوتية المتجانسة والمقاطع الساكنة';
  const targetWcpmGoal = Math.min(100, Math.round(wcpm * 1.5) + 15);

  return {
    studentName,
    gradeLevel,
    date: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
    baselineSummary: `أظهر التقييم الشفوي للطالب(ة) ${studentName} في الصف ${gradeLevel} معدل طلاقة قرائية يبلغ ${wcpm} كلمة/دقيقة بدقة ${accuracy}%. كما بلغت مدة التسمية السريعة (RAN) لـ ${ranCategory === 'colors' ? 'الألوان' : 'العناصر'} ${ranDurationSec} ثانية، مع دقة ${pseudoAccuracy}% في فك الكلمات غير المعجمية، ودرجة ${phonemicScore}/6 في الوعي الصوتي. تم رصد صعوبات متكررة في: ${targetFocus}. تشير هذه النتائج إلى مؤشرات خطورة فونولوجية تستدعي خطة تدخل مكثفة.`,
    annualGoals: [
      `رفع معدل الطلاقة القرائية الشفوية (WCPM) من ${wcpm} إلى ${targetWcpmGoal} كلمة صحيحة في الدقيقة في نصوص الصف ${gradeLevel} المشكولة.`,
      `تحقيق دقة لا تقل عن 92% في التمييز السمعي والنطقي للأزواج الصوتية المتشابهة في الكلمات والجمل المستهدفة.`,
      `إتقان فك ترميز الكلمات غير المعجمية (Pseudo-words) بدقة 90% للتأكد من رسوخ مهارات فك الشفرة وتراجع التخمين.`,
    ],
    shortTermObjectives: [
      `الهدف المرحلي 1 (4 أسابيع): إتقان التمييز بين 20 زوجاً من الكلمات المستهدفة (${targetFocus}) بدقة 85% عبر السبرنت اليومي.`,
      `الهدف المرحلي 2 (8 أسابيع): قراءة نصوص ديكودر مشكولة تشتمل على 40-60 كلمة دون تردد ملحوظ بمعدل يفوق ${Math.round(wcpm * 1.25)} ك/د.`,
      `الهدف المرحلي 3 (12 أسبوعاً): إتمام 5 دقائق تدريب يومي شيدت فيه التلقائية وسرعة الاسترجاع الذهني بنسبة تحسن 30%.`,
    ],
    accommodations: [
      'منح وقت إضافي (25% إلى 50%) في كافة مهام القراءة والتقييمات التحريرية.',
      'توفير تظليل بصري أو مسطرة قراءة للحد من القفز بين الأسطر وتشتت المسار البصري.',
      'الاعتماد التام على نصوص مشكولة بخطوط واضحة ومسافات كافية بين الكلمات (1.5x).',
      'تجنب مطالبة الطالب بالقراءة الجهرية المفاجئة أمام زملائه دون تحضير وتدريب مسبق.',
      'إتاحة الاستماع للنصوص الطويلة عبر قارئ الصوت البشري الطبيعي، مع تقطيع الأسئلة المركبة إلى خطوات بسيطة.',
    ],
    weeklySchedule: [
      { day: 'الأحد', activity: 'سبرنت التدريب الخاطف (5 دقائق): إحماء التمييز الصوتي + قراءة قصة موجهة', durationMinutes: 10 },
      { day: 'الإثنين', activity: 'تفكيك مقطعي ملون وتدريب السكون وحروف المد', durationMinutes: 10 },
      { day: 'الثلاثاء', activity: 'قراءة قصة الذكاء الاصطناعي التكيفية (StoryGen) ومناقشة أسئلة الفهم', durationMinutes: 15 },
      { day: 'الأربعاء', activity: 'سبرنت التسمية السريعة والتظليل الصوتي (Audio Shadowing)', durationMinutes: 10 },
      { day: 'الخميس', activity: 'مراجعة أسبوعية واحتفال بنقاط الإنجاز والشارات المكتسبة', durationMinutes: 10 },
    ],
    clinicalDisclaimer: 'تنويه مهني وقانوني هام: هذه الوثيقة خطة تدخل تربوي فردي مبنية على مؤشرات الفرز الصوتي والقرائي. رصد مواطن الصعوبة لا يُعد بمفرده تشخيصاً سريرياً نهائياً لعسر القراءة (Dyslexia)، ويوصى بإحالة الطالب إلى تقييم نفسي-تربي وعصبي شامل لدى أخصائي معتمد في حال استمرار الصعوبة بعد 12 أسبوعاً من التدخل المنظم.',
    source: 'clinical_rule_engine',
  };
}
