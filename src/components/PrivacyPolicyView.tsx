import React from 'react';
import {
  ShieldCheck,
  Mic,
  LockKeyhole,
  Trash2,
  Database,
  Scale,
  FileText,
  EyeOff,
  Mail,
  Building2,
  CheckCircle2,
} from 'lucide-react';

function PolicySection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
      <div className="flex items-center gap-3 text-slate-900">
        <span className="rounded-xl bg-teal-50 p-2 text-teal-800">
          <Icon className="h-5 w-5" aria-hidden={true} />
        </span>
        <h2 className="text-lg font-extrabold">{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-8 text-slate-700">{children}</div>
    </section>
  );
}

export const PrivacyPolicyView: React.FC = () => (
  <main dir="rtl" lang="ar" className="mx-auto w-full max-w-4xl space-y-6">
    <header className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-teal-800">
        <ShieldCheck className="h-5 w-5" aria-hidden={true} />
        <span>الخصوصية وحوكمة بيانات الأطفال</span>
        <span className="text-slate-400">·</span>
        <span className="font-medium text-slate-500">سارية ومعتمدة: نوفمبر ٢٠٢٦</span>
      </div>
      <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
        سياسة الخصوصية وحوكمة بيانات الأطفال في هَيَّا نَقْرَأْ
      </h1>
      <p className="leading-relaxed text-slate-600">
        توضح هذه السياسة التزام منصة <strong>هَيَّا نَقْرَأْ</strong> التابعة لشركة <strong>فورالا (Vorala LLC)</strong>، وهي شركة مسجلة في <strong>الولايات المتحدة الأمريكية</strong> وتقدّم خدماتها في دولة قطر ودول الخليج، بأعلى المعايير التنظيمية لحماية خصوصية الأطفال، والامتثال لمبادئ حماية خصوصية الأطفال الرقمية، ومعايير حماية السجلات التعليمية للطلاب، وأفضل الممارسات الدولية في تقليل البيانات وحمايتها.
      </p>
      <div className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm leading-7 text-teal-950">
        <EyeOff className="mt-1 h-5 w-5 shrink-0" aria-hidden={true} />
        <p>
          <strong>مبدأ الخصوصية في صميم التصميم:</strong> تلتزم المنصة بمبدأ تقليل البيانات إلى أدنى حد؛ لا نستخدم الكاميرا مطلقًا، ولا نطلب أو نخزن وثائق هوية شخصية، وتعتمد المنصة التشفير على مستوى التطبيق محليًا وسحابيًا مع الرفض الافتراضي لأي معالجة غير مصرح بها.
        </p>
      </div>
    </header>

    <PolicySection icon={Scale} title="الكيان القانوني المسؤول وبيانات الاتصال الرسمية">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Building2 className="w-4 h-4 text-teal-700" />
            <span>المتحكم في البيانات والكيان المشغّل:</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            <strong>شركة فورالا (Vorala LLC)</strong>
            <br />
            كيان مسجل وقائم في الولايات المتحدة الأمريكية.
            <br />
            القوانين المطبّقة: تخضع الشركة للقوانين الأمريكية المنظِّمة لخصوصية الأطفال والسجلات التعليمية، وتلتزم كذلك بقوانين حماية البيانات الشخصية في الدول التي تقدّم فيها الخدمة، ومنها قانون دولة قطر رقم (١٣) لسنة ٢٠١٦ بشأن حماية خصوصية البيانات الشخصية، والأنظمة المماثلة في دول الخليج.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Mail className="w-4 h-4 text-teal-700" />
            <span>مسؤول الخصوصية وقناة التواصل الرسمية:</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            البريد الرسمي المخصص لطلبات أولياء الأمور والمدارس واستفسارات الحذف وسحب الموافقة:
            <br />
            <a href="mailto:hayanaqra@vorala.xyz" className="font-mono font-bold text-teal-800 underline">
              hayanaqra@vorala.xyz
            </a>
          </p>
        </div>
      </div>
    </PolicySection>

    <PolicySection icon={Database} title="ما البيانات التي تعالجها المنصة؟">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="px-3 py-3 font-bold">فئة البيانات</th>
              <th className="px-3 py-3 font-bold">أمثلة</th>
              <th className="px-3 py-3 font-bold">الغرض وآلية الحماية</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">بيانات الطفل التعريفية والنمائية</td>
              <td className="px-3 py-3">اسم مستعار أو لقب اختياري، العمر بالسنوات، الصف الدراسي، ودولة الإقامة</td>
              <td className="px-3 py-3">تخصيص مستويات التدريب والأنشطة المناسبة لنمو الطفل دون طلب الاسم العائلي الكامل أو بيانات الهوية الرسمية</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">بيانات الفحص والتدريب التكويني</td>
              <td className="px-3 py-3">دقة الإجابات، أزمنة الاستجابة في مهام الوعي الصوتي والذاكرة العاملة وسرعة التسمية</td>
              <td className="px-3 py-3">بناء الملف المعرفي التكويني واقتراح خطة الممارسة، وتُشفَّر على مستوى التطبيق لحماية الخصوصية على الأجهزة المشتركة</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">التسجيلات الصوتية (اختيارية ومقيدة)</td>
              <td className="px-3 py-3">تسجيل نطق الكلمات أو قراءة النص الجهرية أثناء المهمة الصوتية المصرح بها فقط</td>
              <td className="px-3 py-3">إرسال الصوت والنص المرجعي عبر اتصال مشفّر إلى Microsoft Azure AI Speech لتحليل النطق والقراءة آليًا. لا تُضاف التسجيلات إلى بيانات تدريب نماذج المنصة.</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">سجل موافقة ولي الأمر</td>
              <td className="px-3 py-3">تاريخ ووقت الموافقة الصريحة، والموافقة الصوتية المنفصلة المؤرخة</td>
              <td className="px-3 py-3">التحقق البرمجي الصارم من تفويض ولي الأمر أو المدرسة، والرفض التلقائي لأي معالجة صوتية ما لم تكن الموافقة مسجلة ومؤرخة</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PolicySection>

    <PolicySection icon={Mic} title="دورة حياة البيانات الصوتية وضوابط المعالجة">
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-teal-50/70 border border-teal-200 text-xs text-teal-950">
          <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <strong>معالجة عابرة موجهة للتقييم القرائي فقط:</strong>
            <p className="mt-1 leading-relaxed">
              ترسل المنصة التسجيل مع الكلمات المرجعية عبر اتصال مشفّر إلى Microsoft Azure AI Speech لإجراء تقييم النطق الفوري. يحتفظ خادم المنصة بنسخة المعالجة في الذاكرة أثناء الطلب فقط، ولا يحفظ الملف الصوتي الخام في سجل الطفل. وتوضح Microsoft أن بيانات تقييم النطق الفوري لا تحتفظ بها الخدمة ولا تخزنها. <a href="https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/speech-to-text/data-privacy-security" target="_blank" rel="noreferrer">تفاصيل معالجة البيانات لدى Microsoft</a>. ويعتمد موقع المعالجة على منطقة مورد Azure المضبوطة في إعدادات الخادم؛ وإذا لم يحدد مشغّل المنصة منطقة أخرى، يستخدم الكود افتراضيًا East US (شرق الولايات المتحدة). لذلك لا نفترض أن المعالجة تتم داخل دولة إقامة الطفل.
            </p>
          </div>
        </div>

        <ul className="list-disc space-y-2 pr-5 text-xs leading-relaxed text-slate-700">
          <li>
            <strong>عدم تدريب نماذج المنصة على تسجيلات الأطفال:</strong> لا تُضاف تسجيلات الأطفال إلى بيانات تدريب نماذج المنصة. يقتصر مسار القراءة الصوتي المعتاد على التقييم الآلي لدى Microsoft Azure AI Speech، ولا تتطلب نتائجه تصحيحًا يدويًا من معلّم.
          </li>
          <li>
            <strong>موافقة منفصلة واختيارية للصوت:</strong> لا يتم تشغيل الميكروفون إلا بعد الحصول على إقرار مستقل وموافقة صريحة مؤرخة من ولي الأمر أو المعلم المفوض. يمكن للطفل إكمال الأنشطة والتدريب القرائي صامتًا دون تفعيل الميكروفون نهائيًا.
          </li>
          <li>
            <strong>حظر المعالجة الصوتية على مسار الزائر التجريبي:</strong> لا يُسمح لمسار الزائر غير المسجل بإرسال أصوات حية للتحليل السحابي، لضمان عدم خروج أي تسجيل دون حساب عائلي أو مدرسي موثق ومسجل في قاعدة البيانات.
          </li>
        </ul>
      </div>
    </PolicySection>

    <PolicySection icon={LockKeyhole} title="الأمان والتشفير على مستوى التطبيق">
      <ul className="list-disc space-y-2 pr-5 text-xs leading-relaxed text-slate-700">
        <li>
          <strong>حماية البيانات على الأجهزة المشتركة:</strong>
          تُخزَّن جلسات الفحص وملفات الأطفال في المتصفح بصيغة مشفّرة (تشفير متناظر مع التحقق من سلامة البيانات)، حتى لا تُقرأ سجلات الطفل نصًّا مكشوفًا على الأجهزة المشتركة في المنزل أو المدرسة.
        </li>
        <li>
          <strong>التشفير أثناء النقل السحابي:</strong>
          تُشفَّر جميع الاتصالات عبر بروتوكول النقل الآمن (TLS)، وتُحفظ سجلات قاعدة البيانات السحابية في مراكز بيانات حاصلة على شهادات أمان عالمية.
        </li>
        <li>
          <strong>الأمان بمبدأ الرفض الافتراضي:</strong>
          تطبّق قاعدة البيانات سياسات أمان مشدّدة على مستوى كل سجل، وتُعدّ موافقة ولي الأمر غير ممنوحة افتراضيًا ولا تُقبل أي معالجة صوتية إلا بعد تسجيل الموافقة الصريحة وتوثيق تاريخها الفعلي.
        </li>
      </ul>
    </PolicySection>

    <PolicySection icon={Trash2} title="حقوق ولي الأمر وآلية الحذف الفوري">
      <p className="text-xs leading-relaxed text-slate-700">
        يتمتع ولي الأمر والمعلم بالحقوق الكاملة غير المشروطة على بيانات الطفل المسجل:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2 text-xs">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <strong className="block text-slate-900 mb-1">١. حق المعاينة والتصدير</strong>
          يمكن لولي الأمر في أي وقت استعراض ملف الطفل كاملًا وتصدير التقرير الوصفي لأدائه القرائي.
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <strong className="block text-slate-900 mb-1">٢. حق الحذف الفوري</strong>
          في بوابة الأسرة زر «حذف ملف الطفل وبياناته» يحذف ملف الطفل وكل نتائجه نهائيًا من الحساب ومن الجهاز.
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <strong className="block text-slate-900 mb-1">٣. سحب الموافقة</strong>
          يمكن لولي الأمر سحب موافقته الصوتية أو العامة في أي وقت عبر إعدادات الملف أو بمراسلة فريق الخصوصية على <code className="text-teal-800 font-bold">hayanaqra@vorala.xyz</code>.
        </div>
      </div>
    </PolicySection>

    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-xs leading-7 text-slate-600">
      <div className="mb-2 flex items-center gap-2 font-extrabold text-slate-900 text-sm">
        <FileText className="h-4 w-4 text-teal-800" aria-hidden={true} />
        <h2>الإقرار والالتزام التعليمي</h2>
      </div>
      <p>
        صُممت منصة <strong>هَيَّا نَقْرَأْ</strong> لأغراض الدعم التعليمي التكويني وتعزيز مهارات القراءة باللغة العربية الفصحى لدى الأطفال من ٤ إلى ٨ سنوات. المنصة ليست أداة تشخيص طبي أو عيادي. نلتزم بتوفير بيئة رقمية آمنة وخالية من الإعلانات ومن التتبع التجاري بنسبة ١٠٠٪.
      </p>
    </section>
  </main>
);

export default PrivacyPolicyView;
