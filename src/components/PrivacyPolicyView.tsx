import React from 'react';
import { ShieldCheck, Mic, Trash2, Lock, Cpu, Scale, FileText, Info } from 'lucide-react';

interface PrivacyPolicyViewProps {}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = () => (
  <main dir="rtl" lang="ar" className="mx-auto w-full max-w-4xl space-y-6">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 space-y-3 shadow-xs">
      <div className="flex items-center gap-2 text-emerald-800">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-bold">معلومات الخصوصية وحدود النسخة الحالية</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
        كيف تتعامل «بصيرة» مع البيانات
      </h1>
      <p className="text-sm leading-7 text-slate-700">
        تشرح هذه الصفحة السلوك الذي أمكن التحقق منه في النسخة البرمجية الحالية، ولا تمثل شهادة امتثال قانوني أو تدقيقًا أمنيًا مستقلًا. بيانات الأطفال تُعامل بحذر خاص؛ قبل تشغيل الخدمة مع طلاب حقيقيين، يلزم مراجعة الإعدادات الفعلية وممارسات المؤسسة ومزودي الخدمات مع مختص قانوني وأمني.
      </p>
    </header>

    {/* Legal context and implementation boundaries */}
    <section className="rounded-3xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-6 space-y-3 shadow-xs">
      <div className="flex items-center gap-2 font-bold text-teal-950">
        <Scale className="h-5 w-5 text-teal-700" />
        <h2 className="text-base font-extrabold">المتطلبات القانونية ومسؤولية التطبيق</h2>
      </div>
      <p className="text-xs leading-relaxed text-slate-700">
        يتضمن القانون المصري رقم 151 لسنة 2020 ولائحته التنفيذية رقم 816 لسنة 2025 متطلبات تتعلق بالتعامل مع البيانات الشخصية وبيانات الأطفال. هذه النسخة لم تحصل على شهادة امتثال؛ ولا يكفي ظهور خانة موافقة في الواجهة لإثبات استيفاء جميع المتطلبات.
      </p>
      <ul className="list-disc space-y-1.5 pr-5 text-xs text-slate-700 leading-relaxed">
        <li><strong>تسجيل الموافقة:</strong> يتحقق النظام من وجود إقرار موافقة ولي الأمر وطابع زمني ومصدر مُدخل في سجل الجلسة. لا يتحقق هذا وحده من الهوية القانونية للموافق أو من كفاية الموافقة قانونيًا.</li>
        <li><strong>الصوت:</strong> يُطلب إقرار منفصل قبل وضع القراءة الجهرية. يختلف التعامل مع الصوت في Web Speech API حسب المتصفح ومزوّد الخدمة، فلا تفترض أن الصوت يُعالَج محليًا بالكامل.</li>
        <li><strong>ميزات الذكاء الاصطناعي:</strong> توليد أنشطة التدريب يرسل الصف واللهجة وكلمات مستهدفة راجعها المعلّم، دون اسم الطفل أو رقم سجله. وقد ترسل ميزات أخرى مثل تبسيط النص أو تحويله إلى صوت النص الذي يختاره المستخدم إلى مزوّد خارجي عند تفعيل الخدمة؛ تجنب إدراج أسماء أو معرفات في النصوص.</li>
      </ul>
    </section>

    {/* 5-Point Data Mapping Matrix */}
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-xs">
      <div className="flex items-center gap-2 text-slate-900 font-bold">
        <FileText className="h-5 w-5 text-teal-700" />
        <h2 className="text-lg font-black">ملخص أنواع البيانات واستخدامها</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50">
              <th className="py-3 px-3 rounded-r-xl">فئة البيانات</th>
              <th className="py-3 px-3">الغرض من المعالجة</th>
              <th className="py-3 px-3">حالة الموافقة</th>
              <th className="py-3 px-3">الحفظ والحذف</th>
              <th className="py-3 px-3 rounded-l-xl">المعالجة السحابية والطرف الثالث</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-3.5 px-3 font-bold text-slate-900">هوية الطالب المدرسية (الاسم، الصف، العمر)</td>
              <td className="py-3.5 px-3 text-slate-600">إدارة سجل الطالب وربط بيانات الجلسة به داخل مساحة المعلّم</td>
              <td className="py-3.5 px-3 text-slate-600">يُسجّل الإقرار والطابع الزمني والمصدر المدخل؛ على المؤسسة التحقق من صحته</td>
              <td className="py-3.5 px-3 text-slate-600">تظل السجلات حتى حذفها يدويًا؛ لا يثبت الكود وجود حذف تلقائي بعد عام</td>
              <td className="py-3.5 px-3 text-slate-500">يحتاج الحفظ المحمي على الخادم إلى إعداد مفتاح التشفير؛ وإلا تُعطّل مسارات الحفظ المحمية</td>
            </tr>

            <tr>
              <td className="py-3.5 px-3 font-bold text-slate-900">بيانات القراءة (الزمن، WPM، WCPM، الفهم)</td>
              <td className="py-3.5 px-3 text-slate-600">عرض زمن الجلسة وإجابات الفهم ومراجعة المعلّم</td>
              <td className="py-3.5 px-3 text-slate-600">يتطلب إقرار ولي الأمر قبل بدء الجلسة المحفوظة</td>
              <td className="py-3.5 px-3 text-slate-600">يمكن للمستخدم المخوّل حذف سجل الطالب؛ لا توجد مدة انتهاء تلقائية مضمونة هنا</td>
              <td className="py-3.5 px-3 text-slate-500">البيانات التي تدخل مسارات الذكاء الاصطناعي قد تنتقل إلى الخدمة الخارجية المحددة؛ راجع كل ميزة قبل الاستخدام</td>
            </tr>

            <tr>
              <td className="py-3.5 px-3 font-bold text-slate-900">التسجيل الصوتي المؤقت والنص المنطوق</td>
              <td className="py-3.5 px-3 text-slate-600">مراجعة الكلمات في الصوت الجهري عند تفعيل الميزة</td>
              <td className="py-3.5 px-3 text-slate-600">يطلب التطبيق إقرارًا صوتيًا منفصلًا</td>
              <td className="py-3.5 px-3 text-slate-600">ملف التشغيل الصوتي مؤقت داخل واجهة الجلسة؛ تُحفظ بيانات النص/النتائج فقط عند إكمال مسار الحفظ</td>
              <td className="py-3.5 px-3 text-slate-500">قد يتولى المتصفح أو مزود Web Speech التعرف على الكلام؛ مكان المعالجة ومدة الاحتفاظ يخضعان لمزوّد الخدمة</td>
            </tr>

            <tr>
              <td className="py-3.5 px-3 font-bold text-slate-900">بيانات الحس العددي والحساب (PAE، الاستجابة)</td>
              <td className="py-3.5 px-3 text-slate-600">عرض مقاييس وصفية لمهام قصيرة؛ لا تصدر هذه النسخة درجة خطر معيارية</td>
              <td className="py-3.5 px-3 text-slate-600">يُسجّل إقرار ولي الأمر قبل الحفظ</td>
              <td className="py-3.5 px-3 text-slate-600">تظل في سجل الطالب إلى أن يحذفه المستخدم المخوّل</td>
              <td className="py-3.5 px-3 text-slate-500">حفظ الخادم محميّ بتكوين المصادقة والتشفير؛ يجب تدقيق بيئة النشر الفعلية</td>
            </tr>

            <tr>
              <td className="py-3.5 px-3 font-bold text-slate-900">سجل إقرار ولي الأمر (الاسم، الصفة، الوقت)</td>
              <td className="py-3.5 px-3 text-slate-600">حفظ حالة الموافقة المُدخلة وتوقيتها والمصدر</td>
              <td className="py-3.5 px-3 text-slate-600">يجب أن يراجع المسؤول أساس الجمع والموافقة وفق القانون</td>
              <td className="py-3.5 px-3 text-slate-600">يتبع سجل الطالب؛ لم تُحدد مدة قانونية داخل الكود</td>
              <td className="py-3.5 px-3 text-slate-500">توثيق التطبيق ليس بحد ذاته إثباتًا لامتثال قانوني مكتمل</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-3xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <span>لا تتطلب صفحات التعلّم الأساسية كاميرا</span>
        </div>
        <p className="text-sm leading-7 text-slate-700">
          مسارات القراءة والحساب والتدريب والقارئ الميسّر الظاهرة حاليًا لا تطلب تشغيل الكاميرا أو التقاط الصور. هذا لا يعني أن كل إعداد نشر أو خدمة خارجية آمنة تلقائيًا؛ راجع المتصفحات والخدمات المفعّلة قبل إدخال بيانات حقيقية.
        </p>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Mic className="h-5 w-5 text-sky-700" aria-hidden="true" />
          <span>الميكروفون والتعرف الصوتي الموجه</span>
        </div>
        <p className="text-sm leading-7 text-slate-700">
          يطلب التطبيق إقرارًا منفصلًا لوضع القراءة الجهرية. النص الناتج عن Web Speech قد يحتوي أخطاء ويجب مراجعته؛ وتختلف معالجة الصوت باختلاف المتصفح ومزوّد الخدمة. تظل القراءة الصامتة متاحة دون تشغيل الميكروفون.
        </p>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <span>موافقة ولي الأمر وإجراءات المؤسسة</span>
        </div>
        <p className="text-sm leading-7 text-slate-700">
          تتحقق مسارات حفظ سجلات الطلاب من إقرار موافقة مُدخل ومن طابع زمني ومصدر مسجل. لا تُثبت هذه الحقول وحدها هوية ولي الأمر أو كفاية الموافقة القانونية. يجب على المؤسسة ضبط الصلاحيات والتحقق من الوصول الفعلي في بيئة النشر.
        </p>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Trash2 className="h-5 w-5 text-rose-700" aria-hidden="true" />
          <span>حذف السجلات</span>
        </div>
        <p className="text-sm leading-7 text-slate-700">
          تتوفر وظيفة حذف سجل الطالب من واجهة المعلّم للمستخدم المخوّل. لم يُثبت الكود وجود حذف تلقائي بعد مدة محددة أو ضمان حذف جميع النسخ الاحتياطية والسجلات الخارجية؛ يجب تحديد ذلك في سياسة الاحتفاظ الفعلية للمؤسسة.
        </p>
      </article>
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
      <div className="flex items-center gap-2 text-slate-900 font-bold">
        <Lock className="h-5 w-5 text-sky-700" />
        <h2>تخزين السجلات وحماية الخادم</h2>
      </div>
      <p className="text-sm leading-7 text-slate-700">
        يستخدم كود حفظ السجلات تشفير AES-256-GCM عند ضبط CLINICAL_STORE_ENCRYPTION_KEY، ويعطّل مسارات الحفظ المحمية إذا لم يتوفر المفتاح أو لم يكن مخزن البيانات جاهزًا. يتضمن الخادم جلسات مصادقة ونطاقات وصول حسب المدرسة، لكن سلامة النشر الفعلي تعتمد كذلك على إدارة الأسرار، وتأمين النقل والنسخ الاحتياطية، وإعداد الخادم.
      </p>
    </section>

    <section className="rounded-3xl border border-amber-300 bg-amber-50/70 p-6 space-y-3">
      <div className="flex items-center gap-2 font-bold text-amber-950">
        <Info className="h-5 w-5 text-amber-800" />
        <h2>ما قبل الاستخدام مع أطفال حقيقيين</h2>
      </div>
      <p className="text-sm leading-7 text-amber-950">هذه النسخة التعليمية ليست نظامًا حاصلًا على اعتماد قانوني أو أمني أو سريري. قبل استخدامها مع بيانات أطفال حقيقية، يجب مراجعة الأساس القانوني والموافقات، ومزودي الذكاء الاصطناعي والصوت، ومكان المعالجة والنقل الدولي، والصلاحيات والاحتفاظ والحذف مع مستشار قانوني ومسؤول حماية بيانات.</p>
      <div className="flex flex-wrap gap-4 text-sm">
        <a className="underline font-semibold text-amber-950" href="https://mcit.gov.eg/Upcont/Documents/Reports%20and%20Documents_1232021000_Law_No_151_2020_Personal_Data_Protection.pdf" target="_blank" rel="noreferrer">قانون حماية البيانات الشخصية 151/2020</a>
        <a className="underline font-semibold text-amber-950" href="https://pdpc.gov.eg/assets/pdf-data/Executive%20Regulation.pdf" target="_blank" rel="noreferrer">اللائحة التنفيذية 816/2025</a>
      </div>
    </section>
  </main>
);

export default PrivacyPolicyView;
