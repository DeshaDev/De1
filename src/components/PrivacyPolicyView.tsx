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
        <span className="font-medium text-slate-500">آخر تحديث: 27 أكتوبر 2026</span>
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
        صُممت هذه السياسة بالاسترشاد بأحكام قانون دولة قطر رقم (13) لسنة 2016 بشأن حماية خصوصية البيانات الشخصية، والإرشادات التنظيمية الصادرة عن الوكالة الوطنية للأمن السيبراني (NCSA). وتخضع المنصة لمراجعة قانونية وتنظيمية مستمرة للتحقق من المواءمة التشغيلية قبل الإطلاق التجاري الكامل.
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
          قانون حماية خصوصية البيانات الشخصية القطري (13/2016) <ExternalLink className="h-3.5 w-3.5" aria-hidden={true} />
        </a>
        <a className="inline-flex items-center gap-1 font-bold text-teal-800 underline" href={NCSA_GUIDANCE_URL} target="_blank" rel="noreferrer">
          إرشادات الوكالة الوطنية للأمن السيبراني <ExternalLink className="h-3.5 w-3.5" aria-hidden={true} />
        </a>
        <a className="inline-flex items-center gap-1 font-bold text-teal-800 underline" href={QATAR_CHILD_DATA_URL} target="_blank" rel="noreferrer">
          المادة (17): حماية حقوق الأطفال على الإنترنت <ExternalLink className="h-3.5 w-3.5" aria-hidden={true} />
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
              <td className="px-3 py-3">تسجيل الدخول، إدارة الصلاحيات المستندة للأدوار (RBAC)، وتأمين النظام</td>
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

    <PolicySection icon={Mic} title="دورة حياة البيانات الصوتية والذكاء الاصطناعي (Audio Lifecycle)">
      <ul className="list-disc space-y-2 pr-5">
        <li>
          <strong>معالجة عابرة لحظية (Transient Audio Processing):</strong> يُرسل التسجيل الصوتي للقراءة الجهرية حصرياً وبشكل مشفر إلى خدمة Microsoft Azure Speech لتقييم الكلمات المنطوقة، ولا يتم تخزين الملفات الصوتية للأطفال في قواعد بيانات دائمة بعد انتهاء الجلسة.
        </li>
        <li>
          <strong>حظر تام لتدريب نماذج الذكاء الاصطناعي العامة على أصوات الأطفال:</strong> تلتزم بصيرة التزاماً قاطعاً بعدم استخدام أصوات الأطفال أو عينات قراءتهم في تدريب أي نماذج ذكاء اصطناعي تجارية أو عامة، ولا تُشارك البيانات مع أي طرف ثالث لأغراض إعلانية أو تسويقية.
        </li>
        <li>
          <strong>الميكروفون اختياري تماماً:</strong> يمكن للمتعلم الاستفادة الكاملة من كافة أنشطة القراءة الصامتة، سبرنت اليوم، وتمارين الوعي الصوتي والقارئ الميسّر دون تشغيل الميكروفون.
        </li>
        <li>
          <strong>حسابات المؤسسات وتوليد القصص:</strong> تقتصر ميزات توليد القصص المكيفة عبر Google Gemini على المعلمين والمؤسسات المصرح لها مع حظر تضمين أي بيانات تعريفية للطفل في المطالبات (Zero PII in Prompts).
        </li>
      </ul>
    </PolicySection>

    <PolicySection icon={UserRoundCheck} title="حقوق الأطفال وموافقة ولي الأمر (المادتان 16 و17)">
      <p>
        يعامل القانون القطري رقم (13) لسنة 2016 بيانات الأطفال باعتبارها من البيانات الشخصية ذات الطبيعة الخاصة. وتلتزم بصيرة بمتطلبات المادتين (16) و(17) للمواقع والأنظمة التعليمية الموجهة للأطفال:
      </p>
      <ul className="list-disc space-y-2 pr-5">
        <li><strong>الإخطار الواضح:</strong> تقديم شرح مبسط وواضح لولي الأمر والطفل حول طبيعة النشاط والبيانات المستخدمة.</li>
        <li><strong>الموافقة الصريحة:</strong> توثيق موافقة ولي الأمر أو المدرسة كتابياً ورقمياً قبل بدء أي جلسة تتضمن تقييماً صوتياً.</li>
        <li><strong>حق المعاينة والنسخ:</strong> تمكين ولي الأمر من طلب وصف شامل للبيانات المخزنة عن طفله والحصول على نسخة منها.</li>
        <li><strong>حق السحب والحذف الفوري:</strong> تمكين ولي الأمر في أي وقت من سحب موافقته وطلب حذف كافة بيانات وسجلات طفله دون أي تعقيد.</li>
      </ul>
    </PolicySection>

    <PolicySection icon={LockKeyhole} title="التخزين والأمن والاحتفاظ">
      <ul className="list-disc space-y-2 pr-5">
        <li>تعتمد المنصة معايير تشفير متقدمة AES-256-GCM للبيانات المخزنة على الخادم، وتأمين الاتصالات عبر HTTPS/TLS.</li>
        <li>تخضع المنصة لنظام تدقيق أمني وإدارة صلاحيات صارمة تمنع وصول أي جهة غير مصرح لها إلى سجلات الطلاب.</li>
        <li>تُحذف سجلات التدريب المؤقتة عند طلب المؤسسة التعليمية أو ولي الأمر عبر البريد الرسمي.</li>
      </ul>
    </PolicySection>

    <PolicySection icon={Trash2} title="ممارسة حقوق الخصوصية وحذف البيانات">
      <p>
        لممارسة أي من حقوقك أو حقوق طفلك المنصوص عليها في قانون حماية البيانات الشخصية القطري (طلب معلومات، تعديل، سحب موافقة، أو حذف كامل للبيانات)، يُرجى إرسال طلب رسمي إلى فريق حوكمة البيانات. تتم معالجة والتحقق من هوية مقدّم الطلب وإتمام إجراءات الحذف خلال مدة لا تتجاوز ١٤ يوم عمل.
      </p>
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
        تخضع هذه السياسة للمراجعة الدورية لضمان استمرار توافقها مع القوانين الوطنية لدولة قطر ومعايير الأمان الدولية للأطفال. النسخة الحالية سارية اعتباراً من 27 أكتوبر 2026.
      </p>
    </section>
  </main>
);

export default PrivacyPolicyView;
