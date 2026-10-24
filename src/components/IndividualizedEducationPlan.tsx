import React from 'react';
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
} from 'lucide-react';
import { CognitiveRadarScores } from './MultiDimensionalRadar';

interface Props {
  studentName: string;
  gradeLevel: number;
  scores: CognitiveRadarScores;
}

export const IndividualizedEducationPlan: React.FC<Props> = ({
  studentName,
  gradeLevel,
  scores,
}) => {
  // Determine primary intervention focus based on lowest scores
  const needsRanFocus = scores.ranSpeed < 60;
  const needsDecodingFocus = scores.pseudoDecoding < 65;
  const needsPhonemicFocus = scores.phonemicAwareness < 70;
  const needsFluencyFocus = scores.orfFluency < 60;

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
            <span>خطة التدخل والدعم الفردية الذكية (Smart IEP)</span>
          </div>
          <h3 className="text-xl md:text-2xl font-black text-slate-900">
            خطة العمل التربوية المقترحة لمدة 4 أسابيع للطالب: {studentName}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            صُممت الخطة وفق نتائج الفحص الفسيولوجي والفونولوجي لمساندة المعلم والأسرة خطوة بخطوة.
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

      {/* 4-Week Progressive Roadmap Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Week 1 */}
        <div className="p-5 rounded-2xl bg-teal-50/60 border border-teal-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-teal-800 bg-teal-100/80 px-2.5 py-1 rounded-lg">
              الأسبوع الأول
            </span>
            <span className="text-[11px] font-mono text-teal-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              15 دقيقة / يومياً
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-sm mb-1.5">
            الوعي الفونولوجي والتمييز السمعي للأصوات المتقاربة
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            التركيز على عزل الصوت الأول وحذف المقاطع للأصوات المتشابهة (ت/ط، س/ص، د/ض). استخدام ألعاب السجع الشفوي دون الاعتماد على النص المكتوب في البداية.
          </p>
          <div className="text-[11px] font-bold text-teal-900 bg-white/80 p-2.5 rounded-xl border border-teal-100">
            ✓ النشاط العملي: لعبة "احذف صوتاً وركّب كلمة جديدة" باستخدام بطاقات صالة التدريب في بصيرة.
          </div>
        </div>

        {/* Week 2 */}
        <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg">
              الأسبوع الثاني
            </span>
            <span className="text-[11px] font-mono text-amber-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              12 دقيقة / يومياً
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-sm mb-1.5">
            تسريع الاسترجاع المعجمي وتدريبات التسمية السريعة (RAN)
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            تقليل زمن الاستجابة الفسيولوجية عبر بطاقات الألوان والأرقام السريعة. تدريب الطفل على مسح العناصر من اليمين لليسار بإيقاع منتظم لتقليل سكتات التردد.
          </p>
          <div className="text-[11px] font-bold text-amber-900 bg-white/80 p-2.5 rounded-xl border border-amber-100">
            ✓ النشاط العملي: جولات يومية بمختبر التسمية السريعة لكسر حاجز زمن {scores.ranSpeed > 70 ? '20 ثانية' : '30 ثانية'}.
          </div>
        </div>

        {/* Week 3 */}
        <div className="p-5 rounded-2xl bg-sky-50/60 border border-sky-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-sky-800 bg-sky-100/80 px-2.5 py-1 rounded-lg">
              الأسبوع الثالث
            </span>
            <span className="text-[11px] font-mono text-sky-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              15 دقيقة / يومياً
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-sm mb-1.5">
            فك الترميز المقطعي والأوزان الصرفية للكلمات غير المألوفة
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            تدريب الطفل على تقطيع الكلمات الطويلة إلى مقاطع صوتية متدرجة (المقطع الساكن، المدود، التنوين). استخدام نصوص القارئ الميسّر مع تلوين المقاطع.
          </p>
          <div className="text-[11px] font-bold text-sky-900 bg-white/80 p-2.5 rounded-xl border border-sky-100">
            ✓ النشاط العملي: تطبيق استراتيجية التقطيع الصرفي (فَعْ · لَ · لَ) لمنع تخمين الكلمات عشوائياً.
          </div>
        </div>

        {/* Week 4 */}
        <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-indigo-800 bg-indigo-100/80 px-2.5 py-1 rounded-lg">
              الأسبوع الرابع
            </span>
            <span className="text-[11px] font-mono text-indigo-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              20 دقيقة / يومياً
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-sm mb-1.5">
            الطلاقة القرائية الشفوية المترادفة ونمذجة الاسترسال
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            القراءة المتزامنة (Paired Reading) حيث يقرأ المعلم أو ولي الأمر بصوت مسموع مع الطالب، ثم ينسحب تدريجياً عندما يشعر الطالب بالثقة، لرفع معدل WCPM.
          </p>
          <div className="text-[11px] font-bold text-indigo-900 bg-white/80 p-2.5 rounded-xl border border-indigo-100">
            ✓ النشاط العملي: جلسة قراءة أسبوعية في مختبر القراءة بمعدل مستهدف لـ WCPM يتناسب مع الصف {gradeLevel}.
          </div>
        </div>
      </div>

      {/* Classroom Accommodations & Home Support Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* For Teacher in Classroom */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="w-5 h-5 text-teal-700" />
            <h4 className="font-bold text-slate-900 text-sm">
              تكييفات غرفة الصف الموصى بها للمعلم (Accommodations):
            </h4>
          </div>
          <ul className="text-xs text-slate-700 space-y-2 list-disc list-inside leading-relaxed">
            <li>
              <strong>وقت إضافي (25%):</strong> منح الطالب وقتاً إضافياً في الاختبارات التحريرية والمهام الكتابية.
            </li>
            <li>
              <strong>تجنب الإحراج:</strong> الامتناع عن الطلب من الطالب القراءة الجهرية المفاجئة دون إعطائه فرصة للتحضير المسبق.
            </li>
            <li>
              <strong>مسطرة القراءة:</strong> السماح باستخدام مسطرة القراءة البصرية أو المؤشر لتتبع الأسطر ومنع التخطي.
            </li>
            <li>
              <strong>حجم الخط والتباعد:</strong> تفضيل أوراق عمل بخط عربي مشكول وحجم لا يقل عن 18pt مع تباعد مناسب.
            </li>
          </ul>
        </div>

        {/* For Parents at Home */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Home className="w-5 h-5 text-indigo-700" />
            <h4 className="font-bold text-slate-900 text-sm">
              إرشادات الدعم المنزلي لولي الأمر (Home Guidance):
            </h4>
          </div>
          <ul className="text-xs text-slate-700 space-y-2 list-disc list-inside leading-relaxed">
            <li>
              <strong>القراءة اليومية الهادئة:</strong> قراءة قصة مصورة ومشكولة مع الطفل لمدة 10 دقائق يومياً قبل النوم.
            </li>
            <li>
              <strong>التعزيز الإيجابي:</strong> التركيز على الكلمات التي نطقها بشكل سليم بدلاً من التوبيخ عند الخطأ.
            </li>
            <li>
              <strong>ألعاب الاسترجاع اللفظي:</strong> ممارسة ألعاب سرعة التسمية (مثل: سمِّ 5 فواكه بأسرع ما يمكن).
            </li>
            <li>
              <strong>تجنب الضغط النفسي:</strong> جعل جلسات القراءة خالية من التوتر والامتحانات التقييمية الجافة.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default IndividualizedEducationPlan;
