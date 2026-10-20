import React from 'react';
import { ArrowRight, ShieldCheck, Mic, Camera, Trash2 } from 'lucide-react';

interface PrivacyPolicyViewProps {}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = () => (
  <main dir="rtl" lang="ar" className="mx-auto w-full max-w-4xl space-y-6">
    <header className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-3">
      <div className="flex items-center gap-2 text-emerald-800">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-bold">الخصوصية وموافقة ولي الأمر</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">كيف تتعامل بصيرة مع بيانات الجلسة؟</h1>
      <p className="text-sm leading-7 text-slate-700">تصف هذه الصفحة سلوك النسخة الحالية من النموذج الأولي، وليست ضمانًا قانونيًا أو تدقيقًا مستقلًا للخصوصية. استخدم أسماء مستعارة وبيانات اصطناعية في التجربة العامة، ولا تُدخل بيانات طفل حقيقية قبل مراجعة إعداد الخادم وسياسات المؤسسة.</p>
    </header>

    <section className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900"><Camera className="h-5 w-5 text-sky-700" aria-hidden="true" /> الكاميرا وتتبع العين</div>
        <p className="text-sm leading-7 text-slate-700">لا تبدأ معايرة النظر حتى تختار تشغيل الكاميرا بنفسك. تُعالج إطارات الفيديو داخل واجهة الجلسة، لكن ذلك لا يُغني عن مراجعة تبعيات المتصفح والخادم قبل الاستخدام مع أطفال حقيقيين. أوقف الكاميرا عند الانتهاء.</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900"><Mic className="h-5 w-5 text-sky-700" aria-hidden="true" /> الميكروفون والتعرف على الكلام</div>
        <p className="text-sm leading-7 text-slate-700">قد تستخدم ميزة التعرف الصوتي في Chrome أو Edge خدمة خارجية لمعالجة الكلام؛ لا تفترض أن الصوت يُعالج محليًا. لا تشغّل الميكروفون قبل موافقة منفصلة من ولي الأمر على معالجة الصوت، ويمكن إدخال النص المنطوق يدويًا بدلًا منه.</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" /> الموافقة</div>
        <p className="text-sm leading-7 text-slate-700">إقرار الواجهة ليس توقيعًا إلكترونيًا أو سير موافقات مؤسسيًا مُدقّقًا. يُفترض تسجيل وقت الموافقة ومصدرها عند حفظ جلسة مكتملة. إذا لم تُسجّل الموافقة، يجب ألا يبدأ الفحص أو حفظ التقرير.</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900"><Trash2 className="h-5 w-5 text-rose-700" aria-hidden="true" /> السجلات والحذف</div>
        <p className="text-sm leading-7 text-slate-700">السجلات على الخادم محمية بالمصادقة والتشفير عند ضبط الأسرار المطلوبة. قد تبقى بيانات الجلسة مؤقتًا في حالة الواجهة أثناء الاستخدام. سجّل الدخول واستخدم وظيفة الحذف، ثم تحقّق من رسالة نجاح الخادم؛ لا تُعدّ وجود السجل في الواجهة دليلًا على حفظه.</p>
      </article>
    </section>

    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 space-y-2">
      <h2 className="font-bold text-amber-950">حدود مهمة قبل الاستخدام الفعلي</h2>
      <ul className="list-disc space-y-2 pr-5 text-sm leading-7 text-amber-950">
        <li>نتائج بصيرة مؤشرات فرز تربوية استرشادية وليست تشخيصًا سريريًا.</li>
        <li>الأرقام ومعايير المؤشرات الحالية غير مُعايرة على عينة معيارية ممثلة، ولا تُعرض بوصفها مئينات معيارية.</li>
        <li>لا تُحمّل بيانات الأطفال الحقيقية قبل مراجعة إعدادات الأسرار، ومدة الاحتفاظ، والصلاحيات، وسياسة المؤسسة، والحصول على الموافقة المناسبة.</li>
      </ul>
    </section>
  </main>
);

export default PrivacyPolicyView;
