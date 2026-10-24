import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  Printer,
  BookOpen,
  Brain,
  Home,
  GraduationCap,
  Layers,
  Heart,
  Award,
  Target,
  Edit3,
  Info,
} from 'lucide-react';
import { CognitiveRadarScores } from './MultiDimensionalRadar';

interface Props {
  studentName: string;
  gradeLevel: number;
  scores: CognitiveRadarScores;
}

interface WeeklyPlanStep {
  weekNum: number;
  titleAr: string;
  domainAr: string;
  baselineAr: string;
  smartGoalAr: string;
  durationDailyAr: string;
  activitiesAr: string;
  checkpointAr: string;
  themeColor: 'teal' | 'amber' | 'sky' | 'indigo' | 'purple';
}

export const IndividualizedEducationPlan: React.FC<Props> = ({
  studentName,
  gradeLevel,
  scores,
}) => {
  const [teacherCustomNotes, setTeacherCustomNotes] = useState<string>('');

  // Dynamically analyze scores and sort domains from most needing support to strongest
  const sortedDomains = useMemo(() => {
    const list = [
      { key: 'pseudoDecoding', name: 'فك الترميز الصوتي (الكلمات غير المعجمية)', score: scores.pseudoDecoding },
      { key: 'ranSpeed', name: 'سرعة التسمية الآلية (RAN)', score: scores.ranSpeed },
      { key: 'phonemicAwareness', name: 'الوعي الصوتي والفونولوجي', score: scores.phonemicAwareness },
      { key: 'orfFluency', name: 'الطلاقة القرائية الشفوية (ORF)', score: scores.orfFluency },
      { key: 'numeracy', name: 'الحس العددي والرياضيات', score: scores.numeracy },
    ];
    return list.sort((a, b) => a.score - b.score);
  }, [scores]);

  const primaryDeficit = sortedDomains[0];
  const secondaryDeficit = sortedDomains[1];

  // Dynamically generate 4-week tailored roadmap matching the student's lowest scored areas
  const dynamicWeeks: WeeklyPlanStep[] = useMemo(() => {
    const weeks: WeeklyPlanStep[] = [];

    // Week 1: Foundational Support tailored to primary deficit
    if (primaryDeficit.key === 'pseudoDecoding') {
      weeks.push({
        weekNum: 1,
        titleAr: 'تفكيك الكلمات المقطعي والتدرج الصرفي (فَعَلَ)',
        domainAr: 'فك الترميز الصوتي',
        baselineAr: `الدقة المسجلة حالياً: ${primaryDeficit.score}% في الكلمات غير المعجمية`,
        smartGoalAr: 'أن يفكك الطالب كلمات ثلاثية مشكولة بدقة لا تقل عن 70% في 10 محاولات',
        durationDailyAr: '15 دقيقة يومياً',
        activitiesAr: 'تدريب الطفل على تقسيم الكلمات إلى مقاطع (مقطع ساكن + مد) وتلوين المقاطع في القارئ الميسّر.',
        checkpointAr: 'اختبار قراءة 5 كلمات موزونة في نهاية الأسبوع وتسجيل الدقة.',
        themeColor: 'teal',
      });
    } else if (primaryDeficit.key === 'ranSpeed') {
      weeks.push({
        weekNum: 1,
        titleAr: 'بناء روتين المسح البصري والتسمية الإيقاعية',
        domainAr: 'سرعة التسمية (RAN)',
        baselineAr: `مؤشر السرعة المرصود: ${primaryDeficit.score}% (تردد ملحوظ في التسمية)`,
        smartGoalAr: 'تقليل سكتات التوقف والتردد في مصفوفة الألوان والأشكال إلى أقل من وقفتين',
        durationDailyAr: '10 دقائق يومياً',
        activitiesAr: 'جلسات مسح بصري من اليمين إلى اليسار باستخدام بطاقات الألوان والمجسمات مع إيقاع تصفيق منتظم.',
        checkpointAr: 'إعادة تجربة مصفوفة الألوان وتسجيل زمن التسمية الجديد.',
        themeColor: 'amber',
      });
    } else if (primaryDeficit.key === 'phonemicAwareness') {
      weeks.push({
        weekNum: 1,
        titleAr: 'عزل الصوت الأول والتمييز السمعي للأصوات المتقاربة',
        domainAr: 'الوعي الصوتي',
        baselineAr: `الدقة الصوتية المسجلة: ${primaryDeficit.score}%`,
        smartGoalAr: 'أن يعزل الطالب الصوت الأول لـ 8 من 10 كلمات مسموعة بشكل صحيح',
        durationDailyAr: '12 دقيقة يومياً',
        activitiesAr: 'ألعاب شفوية مجردة: "ما الصوت الذي تبدأ به الكلمة؟" والتفريق بين المرقق والمفخم (ت/ط، س/ص).',
        checkpointAr: 'تسجيل دقة الطالب في 6 مهام عزل صوتي شفوية.',
        themeColor: 'indigo',
      });
    } else {
      weeks.push({
        weekNum: 1,
        titleAr: 'النمذجة القرائية والقراءة المتزامنة مع المعلم',
        domainAr: 'الطلاقة القرائية (ORF)',
        baselineAr: `معدل الطلاقة الحالي: ${primaryDeficit.score}% مقارنة بالهدف الصفي`,
        smartGoalAr: 'تحسين استرسال القراءة في جمل قصيرة دون انقطاع بين الكلمات',
        durationDailyAr: '15 دقيقة يومياً',
        activitiesAr: 'القراءة المزدوجة (Paired Reading) حيث يقرأ المعلم بصوت مسموع مع الطالب ويخفض صوته تدريجياً.',
        checkpointAr: 'رصد عدد الكلمات الصحيحة في الدقيقة (WCPM) لنص قصير مألوف.',
        themeColor: 'sky',
      });
    }

    // Week 2: Reinforcing Primary & Introducing Secondary Domain
    weeks.push({
      weekNum: 2,
      titleAr: `دمج التمارين: تعزيز ${primaryDeficit.name} مع ${secondaryDeficit.name}`,
      domainAr: `${primaryDeficit.name} + ${secondaryDeficit.name}`,
      baselineAr: `خط أساس مساند: ${secondaryDeficit.score}% في ${secondaryDeficit.name}`,
      smartGoalAr: 'رفع نسبة الإنجاز المشتركة بمقدار 15% مقارنة بنتيجة الجلسة الأولى',
      durationDailyAr: '15 دقيقة يومياً',
      activitiesAr: 'الجمع بين نطق المقاطع بسرعة مع استخدام وسائط بصرية مشكولة، والربط بين الصوت وشكل الحرف.',
      checkpointAr: 'مراجعة المعلم لسجل محاولات الطالب في صالة التدريب.',
      themeColor: 'sky',
    });

    // Week 3: Transfer to Connected Text
    weeks.push({
      weekNum: 3,
      titleAr: 'نقل المهارات المكتسبة إلى نصوص قصيرة وقراءة سياقية',
      domainAr: 'القراءة السياقية والفهم',
      baselineAr: 'الانتقال من مستوى الكلمات المفردة إلى مستوى الفقرة القصيرة (20-30 كلمة)',
      smartGoalAr: 'أن يقرأ الطالب فقرة من 30 كلمة بنسبة دقة لا تقل عن 85% مع فهم الفكرة الرئيسية',
      durationDailyAr: '20 دقيقة يومياً',
      activitiesAr: 'استخدام نصوص القارئ الميسّر في بصيرة مع تفعيل مسطرة السطر والخط الواضح وأسئلة الفهم المباشرة.',
      checkpointAr: 'تقييم الفهم المباشر من خلال الإجابة عن سؤالين حول مضمون النص.',
      themeColor: 'teal',
    });

    // Week 4: Consolidation & Evaluation
    weeks.push({
      weekNum: 4,
      titleAr: 'تثبيت الطلاقة والتقييم البعدي التتبعي للمهارات',
      domainAr: 'التقييم التتبعي والمراجعة',
      baselineAr: 'مقارنة نتائج الأسبوع الرابع بخط الأساس المسجل في الجلسة الأولى',
      smartGoalAr: 'تحقيق نمو إيجابي ملموس في الطلاقة ودقة فك الكلمات وتقليل الترددات',
      durationDailyAr: '15 دقيقة يومياً',
      activitiesAr: 'جلسة محاكاة شاملة في بصيرة لإعادة قياس الطلاقة والتسمية، وتحديث خطة الدعم بحسب الاستجابة.',
      checkpointAr: 'إصدار تقرير تقدم ومناقشة النتائج مع ولي الأمر لتعديل التوصيات.',
      themeColor: 'indigo',
    });

    return weeks;
  }, [primaryDeficit, secondaryDeficit]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm text-right">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200 mb-2">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span>خطة تدخل تعليمي مقترحة قابلة للتخصيص والمراجعة</span>
          </div>
          <h3 className="text-xl md:text-2xl font-black text-slate-900">
            خطة العمل التربوية المقترحة (4 أسابيع) للطالب: {studentName}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            خطة استرشادية ديناميكية مبنية على أدنى المهارات أداءً في هذه الجلسة: <strong className="text-slate-800 font-bold">{primaryDeficit.name}</strong> ({primaryDeficit.score}%)
          </p>
        </div>

        <button
          onClick={handlePrint}
          type="button"
          className="px-4 py-2.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
        >
          <Printer className="w-4 h-4 text-slate-600" />
          <span>طباعة خطة الدعم (PDF)</span>
        </button>
      </div>

      {/* Dynamic 4-Week Progressive Roadmap Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {dynamicWeeks.map((week) => (
          <div
            key={week.weekNum}
            className={`p-5 rounded-2xl border ${
              week.themeColor === 'teal' ? 'bg-teal-50/60 border-teal-200' :
              week.themeColor === 'amber' ? 'bg-amber-50/60 border-amber-200' :
              week.themeColor === 'indigo' ? 'bg-indigo-50/60 border-indigo-200' :
              'bg-sky-50/60 border-sky-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                week.themeColor === 'teal' ? 'bg-teal-100 text-teal-900' :
                week.themeColor === 'amber' ? 'bg-amber-100 text-amber-900' :
                week.themeColor === 'indigo' ? 'bg-indigo-100 text-indigo-900' :
                'bg-sky-100 text-sky-900'
              }`}>
                الأسبوع {week.weekNum}: {week.domainAr}
              </span>
              <span className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {week.durationDailyAr}
              </span>
            </div>

            <h4 className="font-bold text-slate-900 text-sm mb-2">
              {week.titleAr}
            </h4>

            <div className="space-y-1.5 text-xs text-slate-700 mb-3">
              <p>
                <strong className="text-slate-900">نقطة البداية (Baseline):</strong> {week.baselineAr}
              </p>
              <p>
                <strong className="text-slate-900">الهدف الإجرائي (SMART Goal):</strong> {week.smartGoalAr}
              </p>
              <p className="leading-relaxed">
                <strong className="text-slate-900">النشاط المقترح:</strong> {week.activitiesAr}
              </p>
            </div>

            <div className="text-[11px] font-bold text-slate-800 bg-white/90 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
              <Target className="w-4 h-4 text-teal-600 shrink-0" />
              <span>مؤشر التحقق الأسبوعي: {week.checkpointAr}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Customizable Teacher / Specialist Notes Box */}
      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 mb-8 text-right">
        <div className="flex items-center gap-2 mb-2 text-slate-900 font-bold text-sm">
          <Edit3 className="w-4 h-4 text-teal-600" />
          <span>ملاحظات المعلم وتعديلات الخطة المقترحة (قابلة للتخصيص):</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          يمكن للمعلم أو الأخصائي إضافة تكييفات إضافية، تعديل الأوقات، أو تخصيص الأهداف وفق استجابة الطالب للتدخل (RTI).
        </p>
        <textarea
          value={teacherCustomNotes}
          onChange={(e) => setTeacherCustomNotes(e.target.value)}
          placeholder="اكتب هنا أي تعديلات خاصة بالطالب، مثل: التركيز على حروف معينة، تفضيلات التعزيز الإيجابي، أو استجابات التدخل الصفية..."
          rows={3}
          className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-slate-800 resize-y"
        />
      </div>

      {/* Classroom Accommodations & Home Support Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* For Teacher in Classroom */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="w-5 h-5 text-teal-700" />
            <h4 className="font-bold text-slate-900 text-sm">
              تسهيلات وتكييفات مقترحة لغرفة الصف (Accommodations):
            </h4>
          </div>
          <ul className="text-xs text-slate-700 space-y-2 list-disc list-inside leading-relaxed">
            <li>
              <strong>وقت إضافي مرن:</strong> منح الطالب وقتاً إضافياً في الاختبارات التحريرية والمهام النصية.
            </li>
            <li>
              <strong>تجنب القراءة الجهرية المفاجئة:</strong> إعطاء فرصة للتحضير المسبق وتجنب الطلب المفاجئ أمام الأقران.
            </li>
            <li>
              <strong>أدوات تتبع القراءة:</strong> السماح باستخدام مسطرة القراءة البصرية أو المؤشر لتتبع الأسطر.
            </li>
            <li>
              <strong>وضوح الخط:</strong> استخدام خط عربي مشكول بحجم مناسب (18pt+) وتباعد كافٍ بين الأسطر.
            </li>
          </ul>
        </div>

        {/* For Parents at Home */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Home className="w-5 h-5 text-indigo-700" />
            <h4 className="font-bold text-slate-900 text-sm">
              إرشادات الدعم المنزلي المقترحة للأسرة (Home Guidance):
            </h4>
          </div>
          <ul className="text-xs text-slate-700 space-y-2 list-disc list-inside leading-relaxed">
            <li>
              <strong>القراءة اليومية الهادئة:</strong> قراءة مشتركة لقصص قصيرة ومشكولة لمدة 10 دقائق دون توتر.
            </li>
            <li>
              <strong>التعزيز الإيجابي:</strong> التركيز على الكلمات الصحيحة والمحاولات الجيدة بدلاً من لوم الخطأ.
            </li>
            <li>
              <strong>ألعاب التسمية الشفوية:</strong> ممارسة ألعاب استرجاع المفردات شفوياً وبشكل مرح في المنزل.
            </li>
            <li>
              <strong>التواصل الدوري مع المدرسة:</strong> متابعة مدى استجابة الطفل وملاحظات المعلم الأسبوعية.
            </li>
          </ul>
        </div>
      </div>

      {/* Methodological Disclaimer */}
      <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 leading-relaxed flex items-start gap-2.5">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <span>
          <strong>إخلاء مسؤولية تربوي:</strong> هذه الخطة مقترح استرشادي مبني على رصد أداء جلسة رقمية أولية، وتخضع للمراجعة والتعديل المستمر من المعلم أو الأخصائي المختص وفق استجابة الطفل الفعلية (Response to Intervention). لا تعتبر خطة تربوية فردية (IEP) رسمية ملزمة ما لم تعتمدها لجنة التربية الخاصة بالمدرسة.
        </span>
      </div>
    </div>
  );
};

export default IndividualizedEducationPlan;
