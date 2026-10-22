import React from 'react';
import { ShieldCheck, Mic, Trash2, Lock, Cpu } from 'lucide-react';

interface PrivacyPolicyViewProps {}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = () => (
  <main dir="rtl" lang="ar" className="mx-auto w-full max-w-4xl space-y-6">
    <header className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-3 shadow-xs">
      <div className="flex items-center gap-2 text-emerald-800">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-bold">ميثاق الخصوصية وحماية بيانات الطلاب</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
        سياسة الأمان والخصوصية في منصة «بصيرة»
      </h1>
      <p className="text-sm leading-7 text-slate-700">
        تلتزم منصة بصيرة بتطبيق أعلى معايير الأمان والخصوصية بالتصميم (Privacy-by-Design)، لحماية خصوصية بيانات الطلاب وسريتها وضمان امتثالها للأنظمة المدرسية ولوائح حماية البيانات الوطنية والدولية.
      </p>
    </header>

    <section className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <span>خصوصية كاملة بدون كاميرا (Zero Camera / No Video)</span>
        </div>
        <p className="text-sm leading-7 text-slate-700">
          تم استبعاد الكاميرا والمعايرة البصرية بالكامل من منظومة الفرز لحماية خصوصية الأطفال وضمان موثوقية النتائج. لا تتطلب المنصة تشغيل أي كاميرا أو التقاط أي صور، وتعتمد حصرياً على نصوص القراءة التفاعلية وأسئلة الفهم والتحليل الفونولوجي.
        </p>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Mic className="h-5 w-5 text-sky-700" aria-hidden="true" />
          <span>الميكروفون والتعرف الصوتي الموجه</span>
        </div>
        <p className="text-sm leading-7 text-slate-700">
          تتطلب ميزة التعرف الصوتي موافقة صريحة ومستقلة، وتقتصر على تحويل القراءة الجهرية إلى نص لمقارنتها بالنص المرجعي ومراعاة اللهجة. يُتاح دائماً خيار الإدخال والمراجعة اليدوية دون تشغيل الميكروفون.
        </p>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <span>حوكمة موافقة ولي الأمر والرقابة المدرسية</span>
        </div>
        <p className="text-sm leading-7 text-slate-700">
          يُشترط تسجيل تأكيد موافقة ولي الأمر قبل بدء أي جلسة فحص، وتُسجل الجلسة بطابع زمني رسمي. يقتصر الاطلاع على التقارير على المعلمين والأخصائيين المعتمدين والمصرح لهم داخل المنظومة التعليمية.
        </p>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Trash2 className="h-5 w-5 text-rose-700" aria-hidden="true" />
          <span>سيادة البيانات وحق الحذف الفوري (Right to Erasure)</span>
        </div>
        <p className="text-sm leading-7 text-slate-700">
          تحتفظ المؤسسة التعليمية وولي الأمر بالسيطرة الكاملة على السجلات؛ يُمكن حفظ وطباعة التقارير بصيغة PDF عبر ميزة الطباعة الآمنة في المتصفح أو حذف ملف الطالب ونتائج جلساته نهائياً بضغطة زر واحدة وفق معايير اللائحة العامة لحماية البيانات.
        </p>
      </article>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
      <div className="flex items-center gap-2 text-slate-900 font-bold">
        <Lock className="h-5 w-5 text-sky-700" />
        <h2>أمان البنية السحابية والتشفير المتقدم (Enterprise Security)</h2>
      </div>
      <p className="text-sm leading-7 text-slate-700">
        تُخزن البيانات والسجلات المشفرة وفق معيار AES-256، مع تطبيق عزل كامل لبيانات كل مدرسة ومؤسسة تعليمية (Multi-Tenant Isolation). كما تُدار جلسات الأخصائيين بروابط أمان رقمية وتوقيعات HMAC لضمان عدم وصول أي طرف غير مصرح له إلى التقارير.
      </p>
    </section>

    <section className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-6 space-y-2">
      <div className="flex items-center gap-2 font-bold text-emerald-950">
        <Cpu className="h-5 w-5 text-emerald-700" />
        <h2>الإطار المنهجي للاستخدام التربوي</h2>
      </div>
      <ul className="list-disc space-y-1.5 pr-5 text-sm leading-7 text-emerald-950">
        <li>تُعد مخرجات بصيرة مؤشرات فرز أولية ذكية ومساندة، صُممت لتوجيه المعلم والأخصائي نحو التدخل المبكر وبناء خطط دعم قرائية وحسابية فردية.</li>
        <li>تلتزم المنصة بعدم بيع أو مشاركة أي بيانات تخص الطلاب أو المؤسسات مع أي أطراف تجارية أو إعلانية.</li>
        <li>تُراجع خوارزميات الذكاء الاصطناعي دورياً لضمان العدالة اللغوية وملاءمة التنوع اللهجي للطلاب في جميع الدول العربية.</li>
      </ul>
    </section>
  </main>
);

export default PrivacyPolicyView;
