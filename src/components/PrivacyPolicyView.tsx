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
  Building2,
  CheckCircle2,
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
        <span>الخصوصية وحوكمة بيانات الأطفال</span>
        <span className="text-slate-400">·</span>
        <span className="font-medium text-slate-500">سارية ومعتمدة: نوفمبر ٢٠٢٦</span>
      </div>
      <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
        سياسة الخصوصية وحوكمة بيانات الأطفال في هَيَّا نَقْرَأْ
      </h1>
      <p className="leading-relaxed text-slate-600">
        توضح هذه السياسة التزام منصة <strong>هَيَّا نَقْرَأْ</strong> التابعة لمشروع <strong>بصيرة للتقنيات التعليمية</strong> بأعلى المعايير التنظيمية والقانونية لحماية خصوصية الأطفال، تماشيًا مع <strong>قانون حماية خصوصية البيانات الشخصية القطري رقم (١٣) لسنة ٢٠١٦</strong> والضوابط الصادرة عن <strong>الوكالة الوطنية للأمن السيبراني (NCSA)</strong> وأفضل الممارسات العالمية لبيانات القُصّر.
      </p>
      <div className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm leading-7 text-teal-950">
        <EyeOff className="mt-1 h-5 w-5 shrink-0" aria-hidden={true} />
        <p>
          <strong>مبدأ الخصوصية بالتصميم (Privacy by Design):</strong> تلتزم المنصة بمبدأ تقليل البيانات إلى أدنى حد (Data Minimization)، ولا تستخدم الكاميرا مطلقاً، ولا تطلب ولا تخزن أسماء كاملة أو وثائق هوية، وتعتمد التشفير الشامل للبيانات محلياً على الأجهزة المشتركة وسحابياً.
        </p>
      </div>
    </header>

    <PolicySection icon={Scale} title="الكيان القانوني المسؤول وبيانات الاتصال الرسمية">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Building2 className="w-4 h-4 text-teal-700" />
            <span>المتحكم في البيانات (Data Controller):</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            <strong>مشروع بصيرة لتكنولوجيا التعليم والذكاء الاصطناعي</strong>
            <br />
            الدوحة، دولة قطر.
            <br />
            المقر التقني: واحة قطر للعلوم والتكنولوجيا (QSTP)
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Mail className="w-4 h-4 text-teal-700" />
            <span>مسؤول حماية البيانات وقناة الخصوصية (DPO):</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            البريد الرسمي المخصص لطلبات الخصوصية والحذف:
            <br />
            <a href="mailto:privacy@baseera.education" className="font-mono font-bold text-teal-800 underline">
              privacy@baseera.education
            </a>
            <br />
            مهلة الاستجابة القانونية: لا تتجاوز ٧ أيام عمل لكافة طلبات أولياء الأمور.
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        تُصنف المادة (١٦) من القانون رقم (١٣) لسنة ٢٠١٦ بيانات الأطفال بوصفها ذات طبيعة خاصة؛ وتُطبق المنصة التزاماً صريحاً بموجب المادة (١٧) يضمن الإخطار الواضح لولي الأمر، والموافقة الصريحة المسبقة، وحظر المعالجة التلقائية غير المصرح بها، وتوفير حق الحذف الفوري.
      </p>

      <div className="flex flex-wrap gap-4 text-xs pt-2">
        <a className="inline-flex items-center gap-1 font-bold text-teal-800 underline" href={QATAR_LAW_URL} target="_blank" rel="noreferrer">
          قانون حماية خصوصية البيانات الشخصية القطري (١٣/٢٠١٦) <ExternalLink className="h-3.5 w-3.5" aria-hidden={true} />
        </a>
        <a className="inline-flex items-center gap-1 font-bold text-teal-800 underline" href={NCSA_GUIDANCE_URL} target="_blank" rel="noreferrer">
          إرشادات الوكالة الوطنية للأمن السيبراني (NCSA) <ExternalLink className="h-3.5 w-3.5" aria-hidden={true} />
        </a>
        <a className="inline-flex items-center gap-1 font-bold text-teal-800 underline" href={QATAR_CHILD_DATA_URL} target="_blank" rel="noreferrer">
          المادة (١٧): حماية بيانات الأطفال على الإنترنت <ExternalLink className="h-3.5 w-3.5" aria-hidden={true} />
        </a>
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
              <td className="px-3 py-3 font-bold text-slate-900">بيانات الطفل التعليمية</td>
              <td className="px-3 py-3">اسم مستعار أو لقب اختياري، العمر بالسنوات، والصف الدراسي</td>
              <td className="px-3 py-3">تخصيص مستويات التدريب والأنشطة بحسب المرحلة النمائية دون جمع أسماء حقيقية كاملة</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">بيانات الفحص والتدريب</td>
              <td className="px-3 py-3">زمن الاستجابة، دقة الإجابة في ألعاب الوعي الصوتي، والذاكرة السمعية والبصرية</td>
              <td className="px-3 py-3">بناء الملف المعرفي التكويني واقتراح خطة الممارسة الفردية، وتُشفر محلياً وسحابياً</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">التسجيلات الصوتية (اختيارية)</td>
              <td className="px-3 py-3">تسجيل نطق الكلمات أو قراءة النص الجهرية فقط أثناء النشاط الصوتي</td>
              <td className="px-3 py-3">تحليل مخارج الحركات والتنوين والطلاقة؛ معالجة عابرة في الذاكرة دون تخزين دائم</td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-bold text-slate-900">سجل موافقة ولي الأمر</td>
              <td className="px-3 py-3">تاريخ ووقت الموافقة الصريحة بالثواني، وحالة موافقة الصوت المنفصلة</td>
              <td className="px-3 py-3">توثيق الامتثال القانوني والتحقق البرمجي الإلزامي قبل تشغيل أي ميزة</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PolicySection>

    <PolicySection icon={Mic} title="دورة حياة البيانات الصوتية واتفاقيات المعالجة (DPA)">
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-teal-50/70 border border-teal-200 text-xs text-teal-950">
          <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <strong>معالجة عابرة دون احتفاظ دائم (Zero Data Retention):</strong>
            <p className="mt-1 leading-relaxed">
              تتم معالجة التسجيل الصوتي للطفل عبر بث عابر مشفر (Ephemeral In-Memory Stream). فور استخراج مؤشرات الطلاقة ودقة التشكيل، يتم إتلاف التسجيل فوراً من الذاكرة المؤقتة ولا يُخزن في أي قاعدة بيانات سحابية للمزودين.
            </p>
          </div>
        </div>

        <ul className="list-disc space-y-2 pr-5 text-xs leading-relaxed text-slate-700">
          <li>
            <strong>حظر تدريب نماذج الذكاء الاصطناعي:</strong> تخضع خدمات الذكاء الاصطناعي (Azure Speech و Google Cloud) لاتفاقية معالجة بيانات مؤسسية (Enterprise DPA) تمنع استخدام تسجيلات الأطفال الصوتية أو بياناتهم لتدريب النماذج العامة.
          </li>
          <li>
            <strong>موافقة منفصلة إلزامية للصوت:</strong> لا يتم فتح الميكروفون إلا بطلب صريح وإقرار مستقل من ولي الأمر يختلف عن موافقة فتح الحساب. يمكن للطفل إكمال كل أنشطة القراءة الصامتة والألعاب دون تفعيل الميكروفون نهائياً.
          </li>
          <li>
            <strong>قفل مسار الزائر التجريبي:</strong> لا يُسمح لمسار الزائر التجريبي (Guest Mode) بمعالجة أصوات حقيقية؛ يقتصر مسار الزائر على العينات التجريبية المصنوعة فقط لحماية خصوصية أي طفل غير موثق الحساب.
          </li>
        </ul>
      </div>
    </PolicySection>

    <PolicySection icon={LockKeyhole} title="التشفير على مستوى التطبيق وحماية الأجهزة المشتركة">
      <ul className="list-disc space-y-2 pr-5 text-xs leading-relaxed text-slate-700">
        <li>
          <strong>التشفير المحلي المشدد (Application-Level Encryption at Rest):</strong>
          تُخزن جلسات الفحص والتدريب على متصفح الجهاز بصيغة مشفرة ذاتياً عبر خوارزمية (AES-256-CTR مع HMAC-SHA256 Authenticated Encryption)، بحيث لا يستطيع أي مستخدم آخر لنفس الجهاز المشترك (في المنزل أو المدرسة) الاطلاع على سجلات أو درجات الطفل عبر أدوات المتصفح العادية.
        </li>
        <li>
          <strong>التشفير السحابي والاتصال الآمن:</strong>
          تُشفر كافة الاتصالات السحابية ببروتوكول TLS 1.3 المتقدم، وتُحفظ سجلات قاعدة بيانات Supabase المشفرة داخل مراكز بيانات متوافقة مع معايير الأمان الدولية (SOC 2 Type II و ISO 27001).
        </li>
        <li>
          <strong>أمان الرفض الافتراضي (Default-Deny RLS):</strong>
          تُطبق قاعدة البيانات سياسات أمان صارمة على مستوى السطر (Row Level Security)، وتكون موافقة ولي الأمر مرفوضة افتراضياً (`DEFAULT FALSE`) حتى يُسجل ولي الأمر إقراره الإيجابي الصريح.
        </li>
      </ul>
    </PolicySection>

    <PolicySection icon={Trash2} title="حقوق ولي الأمر وآلية الحذف الفوري">
      <p className="text-xs leading-relaxed text-slate-700">
        بموجب المادة (١٧) من قانون حماية البيانات الشخصية، يتمتع ولي الأمر بالحقوق الكاملة غير المشروطة على بيانات طفله:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2 text-xs">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <strong className="block text-slate-900 mb-1">١. حق المعاينة الفورية</strong>
          يمكن لولي الأمر في أي لحظة معاينة كامل نتائج وأنشطة طفله عبر لوحة تحكم الأسرة وتصدير تقرير وصفي شامل.
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <strong className="block text-slate-900 mb-1">٢. حق الحذف الفوري بضغطة زر</strong>
          يتيح التطبيق زراً صريحاً داخل حساب الأسرة لحذف ملف وسجلات الطفل بالكامل من الخادم ومن الذاكرة المحلية فوراً.
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <strong className="block text-slate-900 mb-1">٣. سحب الموافقة الرسمية</strong>
          يمكن مراسلة فريق الخصوصية على <code className="text-teal-800 font-bold">privacy@baseera.education</code> لسحب الموافقة ومحو أي بيانات متبقية في غضون ٧ أيام عمل.
        </div>
      </div>
    </PolicySection>

    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-xs leading-7 text-slate-600">
      <div className="mb-2 flex items-center gap-2 font-extrabold text-slate-900 text-sm">
        <FileText className="h-4 w-4 text-teal-800" aria-hidden={true} />
        <h2>الإقرار والالتزام الأخلاقي</h2>
      </div>
      <p>
        صُممت منصة <strong>هَيَّا نَقْرَأْ</strong> لأغراض الدعم التعليمي التكويني وتعزيز مهارات القراءة باللغة العربية الفصحى، ولا تُعد أداة تشخيص طبي أو عيادي. نلتزم بحماية الأجيال الناشئة وتوفير بيئة رقمية آمنة خالية من الإعلانات ومن التتبع التجاري بنسبة ١٠٠٪.
      </p>
    </section>
  </main>
);

export default PrivacyPolicyView;
