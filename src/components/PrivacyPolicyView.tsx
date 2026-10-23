import React from 'react';
import {
  ShieldCheck,
  Mic,
  LockKeyhole,
  UserRoundCheck,
  Trash2,
  Database,
  Scale,
  FileText,
  ExternalLink,
  EyeOff,
} from 'lucide-react';

const QATAR_LAW_URL =
  'https://www.almeezan.qa/LawView.aspx?LawID=7121&language=ar';
const QATAR_CHILD_DATA_URL =
  'https://www.almeezan.qa/LawArticles.aspx?LawArticleID=72903&LawID=7121&language=ar';
const NCSA_GUIDANCE_URL =
  'https://ncsa.gov.qa/en/pages/guidance-hub-for-regulated-entities';

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
          <Icon className="h-5 w-5" aria-hidden="true" />
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
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        <span>الخصوصية وحماية البيانات</span>
        <span className="text-slate-400">·</span>
        <span className="font-medium text-slate-500">آخر تحديث: 23 أكتوبر 2026</span>
      </div>
      <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
        سياسة الخصوصية في بصيرة
      </h1>
      <p>
        تشرح هذه السياسة أنواع البيانات التي قد تعالجها بصيرة، وأغراض استخدامها، والخيارات المتاحة للأفراد وأولياء الأمور والمؤسسات التعليمية. صُممت المنصة للأنشطة التعليمية العربية في القراءة والفهم والحساب، ولا تقدم تشخيصًا طبيًا أو نفسيًا.
      </p>
      <div className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm leading-7 text-teal-950">
        <EyeOff className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          <strong>لا تستخدم بصيرة الكاميرا أو تتبع العين.</strong> لا تطلب المنصة إذن الكاميرا، ولا تجمع صورًا أو مقاطع فيديو أو قياسات نظر. قد يُطلب إذن الميكروفون فقط إذا اختار المستخدم جلسة القراءة الجهرية بنفسه.
        </p>
      </div>
    </header>

    <PolicySection icon={Scale} title="الإطار القانوني والجهة المسؤولة">
      <p>
        أُعدت السياسة مع مراعاة قانون دولة قطر رقم (13) لسنة 2016 بشأن حماية خصوصية البيانات الشخصية والإرشادات المنشورة من الوكالة الوطنية للأمن السيبراني. ويشمل القانون أحكامًا خاصة بالبيانات ذات الطبيعة الخاصة وببيانات الأطفال، بما في ذلك المادتان (16) و(17).
      </p>
      <p>
        تتحدد صفة «المراقب» و«المعالج» بحسب من يقرر أغراض معالجة البيانات ووسائلها والاتفاق الفعلي بين المدرسة أو المؤسسة ومشغّل المنصة. لذلك يجب أن تحدد اتفاقية كل تشغيل الجهة القانونية المسؤولة، وأدوار الأطراف، ووسائل التواصل المعتمدة لطلبات الخصوصية.
      </p>
      <p className="rounded-xl bg-amber-50 p-4 text-amber-950">
        قبل تفعيل الاستخدام الإنتاجي مع بيانات أطفال حقيقية، يجب نشر الاسم القانوني لمشغّل الخدمة ووسيلة التواصل الرسمية لمسؤول الخصوصية، والتحقق من التصاريح والمتطلبات الواجبة لدى الجهة القطرية المختصة. لا تدخل بيانات حقيقية في نسخة تجريبية لا تتضمن هذه المعلومات أو لم تُعتمد بيئة تشغيلها.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <a className="inline-flex items-center gap-1 font-bold text-teal-800 underline" href={QATAR_LAW_URL} target="_blank" rel="noreferrer">
          قانون حماية خصوصية البيانات الشخصية القطري <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
        <a className="inline-flex items-center gap-1 font-bold text-teal-800 underline" href={NCSA_GUIDANCE_URL} target="_blank" rel="noreferrer">
          إرشادات الوكالة الوطنية للأمن السيبراني <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
        <a className="inline-flex items-center gap-1 font-bold text-teal-800 underline" href={QATAR_CHILD_DATA_URL} target="_blank" rel="noreferrer">
          المادة (17): المواقع الموجهة للأطفال <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </PolicySection>

    <PolicySection icon={Database} title="ما البيانات التي قد تعالجها بصيرة؟">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="px-3 py-3 font-bold">فئة البيانات</th>
              <th className="px-3 py-3 font-bold">أمثلة</th>
              <th className="px-3 py-3 font-bold">الغرض</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">بيانات المؤسسة والحساب</td>
              <td className="px-3 py-3">اسم المؤسسة، دور الحساب، بيانات الجلسة التقنية</td>
              <td className="px-3 py-3">الدخول، إدارة الصلاحيات، وحماية الحسابات</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">بيانات التعلّم</td>
              <td className="px-3 py-3">الاسم أو المعرّف الذي تدخله المؤسسة، الصف، العمر، زمن القراءة، إجابات الفهم، إجابات مهام الحساب وملاحظات المعلّم</td>
              <td className="px-3 py-3">عرض ملخص الجلسة ومتابعة التقدم والأنشطة</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">الصوت والنص المنطوق</td>
              <td className="px-3 py-3">الصوت خلال جلسة القراءة الجهرية، والنص الناتج عن التعرف الصوتي عند تفعيل الميزة</td>
              <td className="px-3 py-3">مساعدة المعلّم على مراجعة الكلمات. قد يعالج المتصفح أو مزوّد خدمة التعرف الصوتي الصوت وفق إعداداته وسياساته.</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">الموافقة والسجلات التقنية</td>
              <td className="px-3 py-3">إقرار ولي الأمر ووقته ومصدره، وسجلات تقنية أساسية قد ينشئها الخادم المستضيف</td>
              <td className="px-3 py-3">توثيق الإجراء، الأمن، معالجة الأعطال، والتحقق من الصلاحيات</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        لا تتطلب القراءة الصامتة أو أنشطة الحساب تشغيل الميكروفون. اختر القراءة الجهرية فقط عندما يكون ذلك مناسبًا، وبعد قراءة معلوماتها والحصول على الموافقة المطلوبة.
      </p>
    </PolicySection>

    <PolicySection icon={Mic} title="الميكروفون، والتعرف الصوتي، والذكاء الاصطناعي">
      <ul className="list-disc space-y-2 pr-5">
        <li>الميكروفون اختياري ولا يُطلب إلا عند بدء جلسة قراءة جهرية. يمكنك استخدام أنشطة القراءة الصامتة والحساب والقارئ الميسّر دون تشغيله.</li>
        <li>قد يتعامل المتصفح أو مزوّد خدمة التعرف الصوتي مع الصوت لإنتاج نص. يختلف مكان المعالجة والاحتفاظ بالصوت باختلاف المتصفح والمزوّد؛ راجع شروطه قبل استخدام الميزة مع طفل.</li>
        <li>عند استدعاء بعض ميزات الذكاء الاصطناعي، قد تُرسل إلى مزوّد الخدمة الخارجي المدخلات اللازمة لتنفيذ الطلب، مثل نص أو كلمات مستهدفة أو الصف واللهجة. لا تضف أسماء الأطفال أو أرقامهم أو تفاصيل تعريفية إلى مدخلات الذكاء الاصطناعي.</li>
        <li>قد تخضع معالجة البيانات في المتصفح أو لدى المزوّد أو مستضيف الخادم لشروط ومواقع معالجة مختلفة. يجب على مشغّل كل نشر تحديد المزوّدين الفعليين ومواقعهم وفترات الاحتفاظ والنقل الدولي قبل تفعيل بيانات حقيقية.</li>
      </ul>
    </PolicySection>

    <PolicySection icon={UserRoundCheck} title="الأطفال وموافقة ولي الأمر">
      <p>
        يعامل القانون القطري بيانات الأطفال باعتبارها من البيانات الشخصية ذات الطبيعة الخاصة. وتنص المادة (16) على متطلبات تخص التصريح بمعالجة البيانات ذات الطبيعة الخاصة، كما تتناول المادة (17) متطلبات المواقع الموجهة للأطفال، ومنها الإخطار الواضح والحصول على موافقة صريحة من ولي الأمر وتمكينه من طلب وصف البيانات ونسخة منها وطلب حذفها أو وقف معالجتها.
      </p>
      <p>
        تسجيل خانة موافقة داخل التطبيق لا يثبت وحده هوية ولي الأمر، ولا يضمن أن الموافقة أو الأساس القانوني أو أي تصريح لازم قد استُكمل. تتحمل الجهة التي تقرر أغراض المعالجة مسؤولية التحقق من المتطلبات المناسبة، بالتنسيق مع مشغّل المنصة والمستشار المختص، قبل إدخال بيانات طلاب حقيقيين.
      </p>
    </PolicySection>

    <PolicySection icon={LockKeyhole} title="التخزين والأمن والاحتفاظ">
      <ul className="list-disc space-y-2 pr-5">
        <li>قد تبقى نتائج الجلسة في حالة المتصفح خلال الاستخدام. لا تُعد الجلسة محفوظة في سجل المدرسة على الخادم لمجرد ظهورها محليًا؛ يلزم نجاح مسار الحفظ وتأكيده.</li>
        <li>يوفر الخادم آليات مصادقة وصلاحيات حسب المؤسسة، ويدعم تشفير السجلات باستخدام AES-256-GCM عند إعداد مفاتيح التشفير الصحيحة. تعتمد الحماية الفعلية على تهيئة الاستضافة وإدارة الأسرار والنقل والنسخ الاحتياطية؛ ولا تعني هذه المزايا أن تدقيقًا أمنيًا مستقلًا قد أُنجز.</li>
        <li>تظل سجلات الطلاب المحفوظة إلى أن يحذفها مستخدم مخوّل أو تنتهي مدة الاحتفاظ المحددة في اتفاقية المؤسسة وإعدادات النشر. لا تفترض وجود حذف تلقائي في مدة ثابتة ما لم تنص عليها الاتفاقية وتُنفذ فعليًا.</li>
        <li>لا يجوز استخدام بيانات الأطفال لأغراض الإعلان أو إنشاء ملفات تسويقية. وأي استخدام إضافي يجب أن يكون له أساس قانوني واضح وإفصاح مناسب.</li>
      </ul>
    </PolicySection>

    <PolicySection icon={Trash2} title="حقوق الأفراد وأولياء الأمور">
      <p>
        بحسب الأحكام المنطبقة، يمكن لصاحب العلاقة أو ولي الأمر طلب معلومات عن البيانات المعالجة، أو طلب نسخة منها، أو تصحيحها، أو طلب حذفها أو وقف معالجتها. تُرفع الطلبات أولًا إلى المؤسسة التي أنشأت سجل الطالب أو إلى المراقب المحدد في اتفاقية الخدمة، بعد التحقق المناسب من هوية مقدم الطلب وصلاحيته.
      </p>
      <p>
        يجب ألا يبدأ تشغيل إنتاجي مع بيانات أطفال قبل نشر وسيلة اتصال رسمية مباشرة للجهة المسؤولة عن الخصوصية. إذا تعذر تحديد الجهة المسؤولة أو التواصل معها، فلا تُدخل بيانات شخصية حقيقية في النسخة التجريبية.
      </p>
    </PolicySection>

    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm leading-8 text-slate-700">
      <div className="mb-2 flex items-center gap-2 font-extrabold text-slate-900">
        <FileText className="h-5 w-5 text-teal-800" aria-hidden="true" />
        <h2>تحديث السياسة</h2>
      </div>
      <p>
        قد تُحدّث هذه السياسة عند تغيير وظائف المنصة أو مزوّدي الخدمات أو المتطلبات القانونية. تُنشر النسخة السارية هنا مع تاريخ تحديثها. لا تُعد هذه الصفحة رأيًا قانونيًا أو تأكيدًا بأن متطلبات التصريح أو التسجيل أو غيرها قد اكتملت؛ يجب التحقق منها مع الجهة المختصة في دولة قطر قبل الإطلاق الإنتاجي.
      </p>
    </section>
  </main>
);

export default PrivacyPolicyView;
