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
  Mail,
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
        <span className="font-medium text-slate-500">آخر تحديث: ٢٧ أكتوبر ٢٠٢٦</span>
      </div>
      <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
        سياسة الخصوصية وحوكمة بيانات الأطفال في بصيرة
      </h1>
      <p className="leading-relaxed text-slate-600">
        تشرح هذه السياسة التزام منصة بصيرة بحماية خصوصية الأطفال والمتعلمين، وأنواع البيانات المعالجة، وأغراض استخدامها، والضوابط الصارمة لحوكمة التسجيلات الصوتية. صُممت المنصة للأنشطة التعليمية التكوينية في مهارات القراءة والوعي الصوتي والطلاقة وفهم المقروء بالعربية، ولا تقدم تشخيصًا طبيًا أو نفسيًا.
      </p>
      <div className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm leading-7 text-teal-950">
        <EyeOff className="mt-1 h-5 w-5 shrink-0" aria-hidden={true} />
        <p>
          <strong>حماية خصوصية الأطفال والطلاب:</strong> تعتمد بصيرة مبدأ تقليل البيانات ولا تجمع أو تخزن أي صور شخصية أو مقاطع فيديو. يُطلب إذن الميكروفون اختيارياً وبشكل منفصل فقط في حال رغبة ولي الأمر أو المعلم في تفعيل نشاط القراءة الجهرية ومطابقة النطق، مع ضمان المعالجة العابرة دون تدريب نماذج عامة.
        </p>
      </div>
    </header>

    <PolicySection icon={Scale} title="الإطار القانوني والجهة المسؤولة">
      <p>
        صُممت هذه السياسة بالاسترشاد بأحكام قانون دولة قطر رقم (١٣) لسنة ٢٠١٦ بشأن حماية خصوصية البيانات الشخصية، والإرشادات التنظيمية الصادرة عن الوكالة الوطنية للأمن السيبراني (NCSA). وتخضع المنصة لمراجعة قانونية وتنظيمية مستمرة للتحقق من المواءمة التشغيلية قبل الإطلاق التجاري الكامل.
      </p>
      <p>
        <strong>الجهة المسؤولة:</strong> مشروع بصيرة للتقنيات التعليمية (Baseera EdTech) - قيد التأسيس والتحقق التجريبي. وتتحدد صفة «المراقب» و«المعالج» بحسب الاتفاق الفعلي بين المدرسة أو المؤسسة التعليمية ومشغّل المنصة وفق التعليمات الرسمية لمسؤولي الخصوصية.
      </p>
      <div className="rounded-2xl bg-teal-50/70 border border-teal-200 p-4 text-xs leading-relaxed text-teal-950 space-y-1">
        <strong>مسؤول الخصوصية والاتصال الرسمي:</strong>
        <p>
          لتوجيه أي استفسارات أو طلبات لحذف البيانات أو ممارسة حقوق أولياء الأمور بموجب القانون القطري، يُرجى التواصل مباشرة عبر القنوات الرسمية:{' '}
          <a href="mailto:privacy@baseera-edu.com" className="font-bold underline text-teal-800">
            privacy@baseera-edu.com
          </a>
          {' '}أو الفريق القانوني على:{' '}
          <a href="mailto:legal@baseera-edu.com" className="font-bold underline text-teal-800">
            legal@baseera-edu.com
          </a>
        </p>
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
              <td className="px-3 py-3">اسم المؤسسة التعليمية، دور الحساب، بيانات الجلسة التقنية وصلاحيات الوصول</td>
              <td className="px-3 py-3">تسجيل الدخول، إدارة الصلاحيات المستندة للأدوار، وتأمين النظام</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">نتائج الفحص المعرفي والبرنامج التدريبي</td>
              <td className="px-3 py-3">عمر الطفل بالأشهر، اسم الفاحص، صحة كل إجابة وزمنها في الألعاب التسع، ونتائج جلسات التدريب ومستوياتها</td>
              <td className="px-3 py-3">حساب الملف المعرفي مقارنةً بالعمر وبناء البرنامج التدريبي. تبقى على الجهاز ما لم تسجّل المدرسة الدخول، فتُحفظ في سجل الطالب المشفّر</td>
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
              <td className="px-3 py-3 font-bold text-slate-900">طلبات التجربة المؤسسية</td>
              <td className="px-3 py-3">اسم المدرسة، اسم جهة التواصل، البريد المؤسسي، رقم الهاتف، الملاحظات، وعنوان IP المرسل مع الطلب</td>
              <td className="px-3 py-3">متابعة طلب التجربة والحد من إساءة استخدام نموذج التواصل</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">الموافقة والسجلات التقنية</td>
              <td className="px-3 py-3">إقرار ولي الأمر أو المعلم، توقيته ومصدره، وسجلات الأمان المشفرة</td>
              <td className="px-3 py-3">توثيق الامتثال القانوني، إدارة النزاهة العلمية، والتحقق من الصلاحيات</td>
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
          <strong>معالجة عابرة لحظية:</strong> يُرسل التسجيل الصوتي للقراءة الجهرية حصرياً وبشكل مشفر إلى خدمة Microsoft Azure Speech لتقييم الكلمات المنطوقة، ولا يتم تخزين الملفات الصوتية للأطفال في قواعد بيانات دائمة بعد انتهاء الجلسة.
        </li>
        <li>
          <strong>حظر تام لتدريب نماذج الذكاء الاصطناعي العامة على أصوات الأطفال:</strong> تلتزم بصيرة التزاماً قاطعاً بعدم استخدام أصوات الأطفال أو عينات قراءتهم في تدريب أي نماذج ذكاء اصطناعي تجارية أو عامة، ولا تُشارك البيانات مع أي طرف ثالث لأغراض إعلانية أو تسويقية.
        </li>
        <li>
          <strong>الميكروفون اختياري تماماً:</strong> يمكن للمتعلم الاستفادة الكاملة من كافة أنشطة القراءة الصامتة، وتحدي الدقائق الخمس، وتمارين الوعي الصوتي والقارئ الميسّر دون تشغيل الميكروفون.
        </li>
        <li>
          <strong>حسابات المؤسسات وتوليد القصص:</strong> تقتصر ميزات توليد القصص المكيفة عبر Google Gemini على المعلمين والمؤسسات المصرح لها مع حظر تضمين أي بيانات تعريفية للطفل في المطالبات.
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
        <li><strong>سحب الموافقة وطلب الحذف:</strong> يمكن لولي الأمر طلب وقف المعالجة وحذف السجلات من مخزن التطبيق النشط عبر قناة الخصوصية الرسمية. لا يعني حذف السجل من المخزن النشط محو نسخ احتياطية أو سجلات يحتفظ بها مزود الاستضافة أو مزود خدمة خارجي تلقائياً.</li>
      </ul>
    </PolicySection>

    <PolicySection icon={LockKeyhole} title="التخزين والأمن والاحتفاظ">
      <ul className="list-disc space-y-2 pr-5">
        <li>تعتمد المنصة معايير تشفير متقدمة AES-256-GCM للبيانات المخزنة على الخادم، وتأمين الاتصالات عبر HTTPS/TLS.</li>
        <li>تخضع المنصة لنظام تدقيق أمني وإدارة صلاحيات صارمة تمنع وصول أي جهة غير مصرح لها إلى سجلات الطلاب.</li>
        <li>تُحذف سجلات التدريب المؤقتة عند طلب المؤسسة التعليمية أو ولي الأمر عبر البريد الرسمي.</li>
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
          <strong>٤. طلبات الحذف والنسخ الاحتياطية:</strong> عند إرسال طلب حذف عبر البريد الرسمي، يراجع الفريق نطاق الطلب ويتعامل مع البيانات الموجودة في مخزن التطبيق النشط. إذا استُخدمت الاستضافة المهيأة في هذا المستودع على <a href="https://render.com/docs/disks" target="_blank" rel="noreferrer" className="underline text-teal-800">Render</a>، فتوثق إنشاء لقطات يومية للقرص الدائم والاحتفاظ بها لمدة سبعة أيام؛ ولا يتيح التطبيق حذف سجل منفرد من تلك اللقطات. لذلك لا نَعِد بمحو النسخ الاحتياطية خلال ١٤ يوم عمل، ويجب اعتماد إجراءات التعامل مع اللقطات والبيانات لدى مزودي الخدمات قبل استخدام بيانات أطفال حقيقية.
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-teal-700 shrink-0" />
          <span>مسؤول الخصوصية:</span>
          <a href="mailto:privacy@baseera-edu.com" className="text-teal-800 underline font-mono">
            privacy@baseera-edu.com
          </a>
        </div>
        <span className="hidden sm:inline text-slate-300">|</span>
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-teal-700 shrink-0" />
          <span>المراجعة القانونية:</span>
          <a href="mailto:legal@baseera-edu.com" className="text-teal-800 underline font-mono">
            legal@baseera-edu.com
          </a>
        </div>
      </div>
    </PolicySection>

    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm leading-8 text-slate-700">
      <div className="mb-2 flex items-center gap-2 font-extrabold text-slate-900">
        <FileText className="h-5 w-5 text-teal-800" aria-hidden={true} />
        <h2>تحديث السياسة</h2>
      </div>
      <p>
        تخضع هذه السياسة للمراجعة الدورية لضمان استمرار توافقها مع القوانين الوطنية لدولة قطر ومعايير الأمان الدولية للأطفال. النسخة الحالية سارية اعتباراً من ٢٧ أكتوبر ٢٠٢٦.
      </p>
    </section>
  </main>
);

export default PrivacyPolicyView;
