import React from 'react';
import { ShieldCheck, Mic, Trash2, Lock, Cpu, Scale, FileText, CheckCircle2 } from 'lucide-react';

interface PrivacyPolicyViewProps {}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = () => (
  <main dir="rtl" lang="ar" className="mx-auto w-full max-w-4xl space-y-6">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 space-y-3 shadow-xs">
      <div className="flex items-center gap-2 text-emerald-800">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-bold">ميثاق الخصوصية وحوكمة بيانات الطلاب وحمايتها</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
        سياسة الأمان والامتثال والخصوصية في منصة «بصيرة»
      </h1>
      <p className="text-sm leading-7 text-slate-700">
        تلتزم منصة بصيرة بتطبيق أعلى معايير الأمان والخصوصية بالتصميم (Privacy-by-Design)، والامتثال الصارم لقانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020 ولائحته التنفيذية الصادرة بالقرار رقم 816 لسنة 2025 (خاصة المادة 15 المتعلقة بحماية البيانات الحساسة للأطفال).
      </p>
    </header>

    {/* Law 151/2020 & Exec Reg 816/2025 Banner */}
    <section className="rounded-3xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-6 space-y-3 shadow-xs">
      <div className="flex items-center gap-2 font-bold text-teal-950">
        <Scale className="h-5 w-5 text-teal-700" />
        <h2 className="text-base font-extrabold">الامتثال التشريعي لقانون حماية البيانات الشخصية المصري (151/2020) واللائحة 816/2025</h2>
      </div>
      <p className="text-xs leading-relaxed text-slate-700">
        تُصنّف البيانات التعليمية والنمائية وصعوبات التعلم للأطفال بوصفها <strong>«بيانات حساسة»</strong>. بناءً على المادة (15) من اللائحة التنفيذية:
      </p>
      <ul className="list-disc space-y-1.5 pr-5 text-xs text-slate-700 leading-relaxed">
        <li><strong>الموافقة الصريحة المسبقة:</strong> لا يتم فتح أي جلسة قياس أو حفظ أي مؤشر إلا بعد توثيق موافقة ولي الأمر الرسمية، وتسجيل اسم ولي الأمر وصفته القانونية والطابع الزمني.</li>
        <li><strong>موافقة منفصلة للتسجيل الصوتي:</strong> يُشترط إقرار اختياري مستقل لتسجيل الصوت أثناء القراءة الجهرية، مع إمكانية إتمام القياس بنمط القراءة الصامتة دون تشغيل الميكروفون.</li>
        <li><strong>المعالجة التفسيرية للذكاء الاصطناعي:</strong> عند الاستعانة بنماذج الذكاء الاصطناعي التوليدي (Google Gemini) لبناء التوصيات الصفية، يتم تجريد البيانات بالكامل من أي معرفات شخصية (Pseudonymized Context).</li>
      </ul>
    </section>

    {/* 5-Point Data Mapping Matrix */}
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-xs">
      <div className="flex items-center gap-2 text-slate-900 font-bold">
        <FileText className="h-5 w-5 text-teal-700" />
        <h2 className="text-lg font-black">مصفوفة حوكمة ومعالجة البيانات (Data Mapping Matrix)</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50">
              <th className="py-3 px-3 rounded-r-xl">فئة البيانات</th>
              <th className="py-3 px-3">الغرض من المعالجة</th>
              <th className="py-3 px-3">السند القانوني</th>
              <th className="py-3 px-3">فترة الاحتفاظ</th>
              <th className="py-3 px-3 rounded-l-xl">المعالجة السحابية والطرف الثالث</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-3.5 px-3 font-bold text-slate-900">هوية الطالب المدرسية (الاسم، الصف، العمر)</td>
              <td className="py-3.5 px-3 text-slate-600">تخصيص التقارير ومقارنة الطلاقة بالمعايير الصفية</td>
              <td className="py-3.5 px-3 text-emerald-800 font-bold">موافقة ولي الأمر المسبقة</td>
              <td className="py-3.5 px-3 text-slate-600">عام دراسي واحد أو الحذف الفوري</td>
              <td className="py-3.5 px-3 text-slate-500">مخزنة محلياً ومشفرة بخادم المؤسسة فقط</td>
            </tr>

            <tr>
              <td className="py-3.5 px-3 font-bold text-slate-900">بيانات القراءة (الزمن، WPM، WCPM، الفهم)</td>
              <td className="py-3.5 px-3 text-slate-600">قياس الطلاقة ومراجعة المعلم الإشرافية</td>
              <td className="py-3.5 px-3 text-emerald-800 font-bold">الموافقة الصريحة لولي الأمر</td>
              <td className="py-3.5 px-3 text-slate-600">عام دراسي واحد لمتابعة التقدم</td>
              <td className="py-3.5 px-3 text-slate-500">لا تشارك مع أي طرف خارجي لأغراض تجارية</td>
            </tr>

            <tr>
              <td className="py-3.5 px-3 font-bold text-slate-900">التسجيل الصوتي المؤقت والنص المنطوق</td>
              <td className="py-3.5 px-3 text-slate-600">محاذاة الكلمات واكتشاف الإبدالات اللفظية</td>
              <td className="py-3.5 px-3 text-emerald-800 font-bold">إقرار صوتي صريح ومستقل</td>
              <td className="py-3.5 px-3 text-slate-600">تنتهي بانتهاء الجلسة ومراجعة المعلم</td>
              <td className="py-3.5 px-3 text-slate-500">استخدام Web Speech API في المتصفح؛ يختلف مكان معالجة الصوت بحسب المتصفح ومزوّد الخدمة، ولا تفترض المنصة أن المعالجة محلية بالكامل</td>
            </tr>

            <tr>
              <td className="py-3.5 px-3 font-bold text-slate-900">بيانات الحس العددي والحساب (PAE، الاستجابة)</td>
              <td className="py-3.5 px-3 text-slate-600">فرز مؤشرات عسر الحساب وتوجيه التدريب</td>
              <td className="py-3.5 px-3 text-emerald-800 font-bold">موافقة ولي الأمر المسبقة</td>
              <td className="py-3.5 px-3 text-slate-600">عام دراسي واحد</td>
              <td className="py-3.5 px-3 text-slate-500">خوادم المؤسسة المعزولة (Multi-Tenant)</td>
            </tr>

            <tr>
              <td className="py-3.5 px-3 font-bold text-slate-900">سجل إقرار ولي الأمر (الاسم، الصفة، الوقت)</td>
              <td className="py-3.5 px-3 text-slate-600">التوثيق القانوني والمساءلة الرقابية</td>
              <td className="py-3.5 px-3 text-emerald-800 font-bold">المادة 15 من لائحة 816/2025</td>
              <td className="py-3.5 px-3 text-slate-600">طوال فترة بقاء ملف الطالب</td>
              <td className="py-3.5 px-3 text-slate-500">سجل تدقيق مشفر غير قابل للتلاعب (Audit Log)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-3xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <span>خصوصية كاملة بدون كاميرا (Zero Camera / No Video)</span>
        </div>
        <p className="text-sm leading-7 text-slate-700">
          تم استبعاد الكاميرا والمعايرة البصرية بالكامل من منظومة الفرز لحماية خصوصية الأطفال وضمان موثوقية النتائج. لا تتطلب المنصة تشغيل أي كاميرا أو التقاط أي صور، وتعتمد حصرياً على نصوص القراءة التفاعلية وأسئلة الفهم والتحليل الفونولوجي.
        </p>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Mic className="h-5 w-5 text-sky-700" aria-hidden="true" />
          <span>الميكروفون والتعرف الصوتي الموجه</span>
        </div>
        <p className="text-sm leading-7 text-slate-700">
          تتطلب ميزة التعرف الصوتي موافقة صريحة ومستقلة، وتقتصر على تحويل القراءة الجهرية إلى نص لمقارنتها بالنص المرجعي ومراعاة اللهجة. يُتاح دائماً خيار الإدخال والمراجعة اليدوية دون تشغيل الميكروفون.
        </p>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <span>حوكمة موافقة ولي الأمر والرقابة المدرسية</span>
        </div>
        <p className="text-sm leading-7 text-slate-700">
          يُشترط تسجيل تأكيد موافقة ولي الأمر قبل بدء أي جلسة فحص، وتُسجل الجلسة بطابع زمني رسمي. يقتصر الاطلاع على التقارير على المعلمين والأخصائيين المعتمدين والمصرح لهم داخل المنظومة التعليمية.
        </p>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Trash2 className="h-5 w-5 text-rose-700" aria-hidden="true" />
          <span>سيادة البيانات وحق الحذف الفوري (Right to Erasure)</span>
        </div>
        <p className="text-sm leading-7 text-slate-700">
          تحتفظ المؤسسة التعليمية وولي الأمر بالسيطرة الكاملة على السجلات؛ يُمكن حفظ وطباعة التقارير بصيغة PDF عبر ميزة الطباعة الآمنة في المتصفح أو حذف ملف الطالب ونتائج جلساته نهائياً بضغطة زر واحدة وفق معايير اللائحة العامة لحماية البيانات وقانون 151/2020.
        </p>
      </article>
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
      <div className="flex items-center gap-2 text-slate-900 font-bold">
        <Lock className="h-5 w-5 text-sky-700" />
        <h2>أمان البنية السحابية والتشفير المتقدم (Enterprise Security)</h2>
      </div>
      <p className="text-sm leading-7 text-slate-700">
        تُخزن البيانات والسجلات المشفرة وفق معيار AES-256، مع تطبيق عزل كامل لبيانات كل مدرسة ومؤسسة تعليمية (Multi-Tenant Isolation). كما تُدار جلسات الأخصائيين بروابط أمان رقمية وتوقيعات HMAC لضمان عدم وصول أي طرف غير مصرح له إلى التقارير.
      </p>
    </section>

    <section className="rounded-3xl border border-emerald-300 bg-emerald-50/70 p-6 space-y-2">
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
