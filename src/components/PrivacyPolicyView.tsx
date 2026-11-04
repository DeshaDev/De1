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
  Zap,
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
        <span>الخصوصية وحماية البيانات</span>
        <span className="text-slate-400">·</span>
        <span className="font-medium text-slate-500">آخر تحديث: ٤ نوفمبر ٢٠٢٦</span>
      </div>
      <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
        سياسة الخصوصية وحوكمة بيانات الأطفال في هَيَّا نَقْرَأْ
      </h1>
      <p className="leading-relaxed text-slate-600">
        تشرح هذه السياسة آليات معالجة البيانات في منصة هَيَّا نَقْرَأْ لحماية خصوصية الأطفال والمتعلمين، وأنواع البيانات المعالجة، وأغراض استخدامها، وآلية الموافقة ومعالجة التسجيلات الصوتية. صُممت المنصة للأنشطة التعليمية التكوينية في مهارات القراءة والوعي الصوتي والطلاقة وفهم المقروء بالعربية، ولا تقدم تشخيصًا طبيًا أو نفسيًا.
      </p>
      <div className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm leading-7 text-teal-950">
        <EyeOff className="mt-1 h-5 w-5 shrink-0" aria-hidden={true} />
        <p>
          <strong>حماية خصوصية الأطفال والطلاب:</strong> تعتمد المنصة مبدأ تقليل البيانات ولا تستخدم الكاميرا أو تجمع صورًا أو فيديو. لا يُفعّل الميكروفون إلا في نشاط القراءة الجهرية وبعد موافقة مستقلة. قد تُعالج البيانات المطلوبة لبعض الميزات بواسطة مزودي خدمات مذكورين أدناه؛ لذلك لا تفترض أن كل المعالجة تتم محليًا على الجهاز.
        </p>
      </div>
    </header>

    <PolicySection icon={Scale} title="الإطار القانوني والجهة المسؤولة">
      <p>
        صيغت هذه السياسة مع الاسترشاد بقانون دولة قطر رقم (١٣) لسنة ٢٠١٦ بشأن حماية خصوصية البيانات الشخصية. تعد المادة (١٦) بيانات الأطفال من البيانات ذات الطبيعة الخاصة، وتنص على عدم معالجتها إلا بعد الحصول على تصريح من الإدارة المختصة وفق الضوابط المقررة؛ كما تفرض المادة (١٧) متطلبات خاصة للمواقع الموجهة للأطفال، منها إخطار البيانات والموافقة الصريحة من ولي الأمر وحقوق الوصول والحذف. وجود خانة موافقة في التطبيق لا يثبت استيفاء التصريح أو بقية الالتزامات. كما أن القانون القطري لا يغطي تلقائيًا بقية الدول العربية؛ يجب تحديد القوانين والأدوار ومواقع المعالجة ومتطلبات نقل البيانات في كل سوق قبل التشغيل ببيانات أطفال حقيقية.
      </p>
      <p>
        <strong>الجهة المطوّرة:</strong> هَيَّا نَقْرَأْ، منتج تعليمي قيد التطوير ضمن مشروع بصيرة للتقنيات التعليمية. الكيان القانوني المسؤول عن تشغيل الخدمة لم يُحدّد في هذه السياسة بوصفه شركة مسجلة؛ يجب استكمال بيانات المتحكم والمعالج والعناوين القانونية في النسخة النهائية قبل استقبال بيانات أطفال حقيقية.
      </p>
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs leading-relaxed text-amber-950">
        <strong>بيانات التواصل والجهة المسؤولة لم تُعتمد بعد:</strong>
        يجب إضافة اسم الكيان القانوني وعنوانه وقناة تواصل فعّالة لطلبات الوصول والتصحيح والحذف قبل إتاحة الخدمة للعائلات. لا تستخدم هذه النسخة لاستقبال بيانات أطفال حقيقية.
      </div>
      <div className="flex flex-wrap gap-4 text-sm pt-2">
        <a className="inline-flex items-center gap-1 font-bold text-teal-800 underline" href={QATAR_LAW_URL} target="_blank" rel="noreferrer">
          قانون حماية خصوصية البيانات الشخصية القطري (١٣/٢٠١٦) <ExternalLink className="h-3.5 w-3.5" aria-hidden={true} />
        </a>
        <a className="inline-flex items-center gap-1 font-bold text-teal-800 underline" href={NCSA_GUIDANCE_URL} target="_blank" rel="noreferrer">
          إرشادات الوكالة الوطنية للأمن السيبراني <ExternalLink className="h-3.5 w-3.5" aria-hidden={true} />
        </a>
        <a className="inline-flex items-center gap-1 font-bold text-teal-800 underline" href={QATAR_CHILD_DATA_URL} target="_blank" rel="noreferrer">
          المادة (١٧): حماية حقوق الأطفال على الإنترنت <ExternalLink className="h-3.5 w-3.5" aria-hidden={true} />
        </a>
      </div>
    </PolicySection>

    <PolicySection icon={Database} title="ما البيانات التي قد تعالجها المنصة؟">
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
              <td className="px-3 py-3">اسم المؤسسة التعليمية، دور الحساب، بيانات الجلسة التقنية وصلاحيات الوصول</td>
              <td className="px-3 py-3">تسجيل الدخول، إدارة الصلاحيات المستندة للأدوار، وتأمين النظام</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">نتائج الفحص المعرفي والبرنامج التدريبي</td>
              <td className="px-3 py-3">عمر الطفل بالأشهر، اسم الفاحص، صحة كل إجابة وزمنها في الألعاب التسع، ونتائج جلسات التدريب ومستوياتها</td>
              <td className="px-3 py-3">عرض نتائج الأنشطة الوصفية ومتابعة التعلّم. قد تبقى البيانات على الجهاز أو تُزامن مع حساب الأسرة أو سجل المؤسسة بحسب طريقة الدخول وإعدادات الحفظ</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">إحصاءات استخدام مجهولة الهوية</td>
              <td className="px-3 py-3">عدّ الأحداث فقط (زيارة، بدء فحص، إكمال لعبة، جلسة تدريب) مع معرّف عشوائي للجهاز يُشفَّر قبل حفظه؛ لا أسماء ولا معرّفات طلاب ولا إجابات</td>
              <td className="px-3 py-3">قياس جودة المنتج ونسب الإكمال وتحسين الألعاب، وتُحذف بعد ٤٠٠ يوم</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">بيانات التعلّم القرائي</td>
              <td className="px-3 py-3">الاسم المستعار، الصف الدراسي، زمن القراءة، إجابات الفهم القرائي، والكلمات المستهدفة بالتدريب</td>
              <td className="px-3 py-3">عرض ملخص الجلسة ومتابعة التقدم التكويني في مهارات القراءة وفك الكلمات</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">الصوت والتقييم الصوتي</td>
              <td className="px-3 py-3">التسجيل الصوتي اللحظي أثناء جلسة القراءة الجهرية، والتحليل الناتج عن مطابقة النطق</td>
              <td className="px-3 py-3">التحليل الصوتي الآلي لمطابقة الكلمات المنطوقة وحساب مؤشرات الطلاقة ودقة فك المقاطع</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">مدخلات اقتراح الخطة التعليمية</td>
              <td className="px-3 py-3">العمر، وملخص نتائج الأنشطة، والمهارات المستهدفة، ومستوى التقدم، وأهداف الممارسة. لا يتضمن طلب إنشاء الخطة اسم الطفل في بنية البيانات الحالية، لكن هذه المعلومات تظل بيانات تعليمية قابلة للربط بطفل.</td>
              <td className="px-3 py-3">صياغة مسودة خطة تعليمية عند تفعيل خدمة Gemini؛ لا تُعامل هذه المدخلات على أنها بيانات مجهولة الهوية.</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">طلبات التجربة المؤسسية</td>
              <td className="px-3 py-3">اسم المدرسة، اسم جهة التواصل، البريد المؤسسي، رقم الهاتف، الملاحظات، وعنوان IP المرسل مع الطلب</td>
              <td className="px-3 py-3">متابعة طلب التجربة والحد من إساءة استخدام نموذج التواصل</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">الموافقة والسجلات التقنية</td>
              <td className="px-3 py-3">إقرار ولي الأمر الذاتي، وتوقيته ومصدره المعلن، وسجلات الأمان التقنية</td>
              <td className="px-3 py-3">توثيق الإقرار الذاتي ووقت تسجيله ومصدره، ومساندة سجل التدقيق والتحقق من الصلاحيات</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        لا تتطلب أنشطة القراءة الصامتة أو صالة التدريب أو القارئ الميسّر تشغيل الميكروفون. اختر القراءة الجهرية فقط عندما يكون ذلك مناسبًا، وبعد قراءة معلوماتها والحصول على الموافقة المطلوبة.
      </p>
    </PolicySection>

    <PolicySection icon={Mic} title="دورة حياة البيانات الصوتية والذكاء الاصطناعي">
      <ul className="list-disc space-y-2 pr-5">
        <li>
          <strong>معالجة عابرة لحظية:</strong> عند تهيئة خدمة التقييم الصوتي وتشغيلها، يُرسل التسجيل الذي اختار ولي الأمر معالجته إلى Microsoft Azure Speech لتحليل النطق. لا تضمن واجهة التطبيق وحدها حذف جميع النسخ أو سجلات المعالجة لدى المزود بعد انتهاء الجلسة؛ يجب التحقق من منطقة الخدمة وإعدادات الاحتفاظ واتفاقية المعالجة الفعلية قبل استخدام بيانات أطفال حقيقية.
        </li>
        <li>
          <strong>استخدام البيانات لدى مزودي الخدمات:</strong> قد يشارك مزود الخدمة في معالجة البيانات اللازمة لتنفيذ الميزة التي طلبها المستخدم. لا تستخدم المنصة البيانات للإعلانات. ومع ذلك يجب مراجعة شروط مزودي الخدمات وإعدادات الحساب واتفاقيات معالجة البيانات لمعرفة استخدام البيانات والاحتفاظ بها؛ ولا تتعهد هذه السياسة بما لم يُثبت تعاقديًا.
        </li>
        <li>
          <strong>الميكروفون اختياري تماماً:</strong> يمكن للمتعلم الاستفادة الكاملة من كافة أنشطة القراءة الصامتة، وتحدي الدقائق الخمس، وتمارين الوعي الصوتي والقارئ الميسّر دون تشغيل الميكروفون.
        </li>
        <li>
          <strong>إنشاء مسودة الخطة الفردية:</strong> قد تُرسل ملخصات تعليمية محدودة إلى Google Gemini عند طلب إنشاء مسودة الخطة الفردية. لا يرسل مكوّن الخطة الحالي اسم الطفل ضمن حمولة الطلب، لكن العمر وملخص الأداء والمهارات تظل بيانات تعليمية؛ يجب التحقق من شروط الخدمة والاحتفاظ وموقع المعالجة قبل تفعيلها مع أطفال حقيقيين.
        </li>
      </ul>
    </PolicySection>

    <PolicySection icon={UserRoundCheck} title="حقوق الأطفال وموافقة ولي الأمر (المادتان ١٦ و١٧)">
      <p>
        يصنّف القانون القطري رقم (١٣) لسنة ٢٠١٦ بيانات الأطفال ضمن البيانات الشخصية ذات الطبيعة الخاصة، وقد يتطلب التعامل معها تصريحاً من الجهة المختصة بموجب المادة (١٦)، كما تفرض المادة (١٧) متطلبات خاصة بالمواقع الموجهة للأطفال. يجب على مشغّل المنصة التحقق من التصاريح والمتطلبات المنطبقة قبل الإطلاق؛ ولا تثبت هذه السياسة أو خانة الموافقة وحدهما الحصول على تصريح أو اكتمال الامتثال:
      </p>
      <ul className="list-disc space-y-2 pr-5">
        <li><strong>الإخطار الواضح:</strong> تقديم شرح مبسط وواضح لولي الأمر والطفل حول طبيعة النشاط والبيانات المستخدمة.</li>
        <li><strong>تسجيل إقرار الموافقة:</strong> تسجل الواجهة الإقرار المقدم ويضع الخادم وقت استلامه. هذا الختم لا يتحقق وحده من هوية ولي الأمر أو صحة التفويض الرسمي؛ ويجب على المؤسسة التأكد من الحصول على الموافقة الفعلية قبل إدخال بيانات طفل حقيقية.</li>
        <li><strong>حق المعاينة والنسخ:</strong> تمكين ولي الأمر من طلب وصف شامل للبيانات المخزنة عن طفله والحصول على نسخة منها.</li>
        <li><strong>سحب الموافقة وطلب الحذف:</strong> يجب نشر قناة خصوصية فعلية قبل استقبال بيانات الأطفال. عند تشغيلها، يجب توضيح طريقة وقف المعالجة والتعامل مع السجل النشط والنسخ الاحتياطية وسجلات مزودي الخدمات؛ حذف السجل النشط لا يمحو تلقائيًا النسخ الأخرى.</li>
      </ul>
    </PolicySection>

    <PolicySection icon={LockKeyhole} title="التخزين والأمن والاحتفاظ">
      <ul className="list-disc space-y-2 pr-5">
        <li>تعتمد المنصة معايير تشفير متقدمة AES-256-GCM للبيانات المخزنة على الخادم، وتأمين الاتصالات عبر HTTPS/TLS.</li>
        <li>تتضمن المنصة صلاحيات وصول حسب الدور وسجلًا لبعض العمليات الإدارية. هذه الضوابط التقنية لا تعادل تدقيقًا أمنيًا مستقلًا أو ضمانًا مطلقًا لمنع جميع صور الوصول غير المصرح به.</li>
        <li>تختلف آلية حذف السجلات باختلاف مكان تخزينها ومسار الحساب. يجب نشر إجراء حذف وقناة تواصل فعّالة واعتمادها قبل الإطلاق وجمع بيانات أطفال حقيقية.</li>
      </ul>
    </PolicySection>

    <PolicySection icon={Trash2} title="حدود حذف البيانات والاحتفاظ بها">
      <p>
        تشرح النقاط التالية حدود الحذف الحالي في التطبيق، ويجب مراجعة أي التزام قانوني نهائي مع مختص قبل الإطلاق:
      </p>
      <div className="space-y-2.5 mt-2 mb-3">
        <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl text-xs leading-relaxed text-teal-950">
          <strong>١. بيانات التبويب المحلي:</strong> يؤدي إنهاء الجلسة إلى مسح البيانات المحلية التي يدير التطبيق حذفها داخل التبويب. لا يؤدي ذلك إلى حذف السجلات التي سبق حفظها على الخادم، كما لا يُعد دليلاً على إزالة جميع آثار المتصفح أو الجهاز.
        </div>
        <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-xs leading-relaxed text-sky-950">
          <strong>٢. حذف سجل الطالب من مخزن التطبيق النشط:</strong> يتيح النظام لمسؤول المدرسة المخوّل طلب حذف سجل الطالب من مخزن التطبيق النشط، مع تسجيل العملية في سجل التدقيق. لا نَعد هنا بمحو مادي فوري من نسخ احتياطية أو لقطات تخزين لدى مزود الاستضافة.
        </div>
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs leading-relaxed text-amber-950">
          <strong>٣. الاحتفاظ بطلبات التواصل المؤسسية:</strong> تُزال الطلبات التي يتجاوز عمرها ٩٠ يوماً من مخزن التطبيق النشط عند فحص الاحتفاظ عند بدء الخادم ودورياً أثناء تشغيله. ويمكن لمسؤول المنصة حذف الطلب من المخزن النشط قبل ذلك. لا يعني هذا الإجراء حذف أي نسخة احتياطية مستقلة لدى مزود الاستضافة.
        </div>
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-800">
          <strong>٤. طلبات الحذف والنسخ الاحتياطية:</strong> بعد اعتماد قناة طلبات الخصوصية، يجب مراجعة نطاق الطلب والتعامل مع البيانات الموجودة في مخزن التطبيق النشط. إذا استُخدمت الاستضافة المهيأة في هذا المستودع على <a href="https://render.com/docs/disks" target="_blank" rel="noreferrer" className="underline text-teal-800">Render</a>، فتوثق إنشاء لقطات يومية للقرص الدائم والاحتفاظ بها لمدة سبعة أيام؛ ولا يتيح التطبيق حذف سجل منفرد من تلك اللقطات. لذلك لا نَعِد بمحو النسخ الاحتياطية خلال ١٤ يوم عمل، ويجب اعتماد إجراءات التعامل مع اللقطات والبيانات لدى مزودي الخدمات قبل استخدام بيانات أطفال حقيقية.
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-950">
        <strong>قنوات التواصل الرسمية لم تُعتمد بعد:</strong>
        يجب إضافة اسم الكيان القانوني وعنوانه وقناة فعّالة لطلبات الوصول والتصحيح والحذف قبل إتاحة الخدمة للعائلات. لا تستخدم هذه النسخة لاستقبال بيانات أطفال حقيقية.
      </div>
    </PolicySection>

    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm leading-8 text-slate-700">
      <div className="mb-2 flex items-center gap-2 font-extrabold text-slate-900">
        <FileText className="h-5 w-5 text-teal-800" aria-hidden={true} />
        <h2>تحديث السياسة</h2>
      </div>
      <p>
        تخضع هذه السياسة للمراجعة الدورية. وهي وصف حالي لبعض مسارات التطبيق وليست رأيًا قانونيًا أو إثباتًا لاكتمال التصاريح أو الاتفاقيات مع مزودي الخدمات. النسخة الحالية سارية اعتبارًا من ٤ نوفمبر ٢٠٢٦؛ يجب تحديثها بعد اعتماد الاستضافة والمزودين والكيان القانوني والأسواق المستهدفة.
      </p>
    </section>
  </main>
);

export default PrivacyPolicyView;
