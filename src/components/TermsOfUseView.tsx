import React from 'react';
import { FileText, GraduationCap, AlertTriangle, Mic, ShieldCheck, Scale } from 'lucide-react';

function TermsSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-teal-50 p-2 text-teal-800">
          <Icon className="h-5 w-5" aria-hidden={true} />
        </span>
        <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-8 text-slate-700">{children}</div>
    </section>
  );
}

export const TermsOfUseView: React.FC = () => (
  <main dir="rtl" lang="ar" className="mx-auto w-full max-w-4xl space-y-6">
    <header className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-teal-800">
        <FileText className="h-5 w-5" aria-hidden={true} />
        <span>شروط الاستخدام</span>
        <span className="text-slate-400">·</span>
        <span className="font-medium text-slate-500">آخر تحديث: ٤ نوفمبر ٢٠٢٦</span>
      </div>
      <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">شروط استخدام هَيَّا نَقْرَأْ</h1>
      <p className="text-sm leading-8 text-slate-700">
        تنظم هذه الشروط استخدام منصة هَيَّا نَقْرَأْ للأنشطة التعليمية العربية في القراءة والوعي الصوتي والطلاقة وفهم المقروء ومتابعة التقدم. باستخدام المنصة، يوافق المستخدم على الالتزام بهذه الشروط وبسياسة الخصوصية. إذا لم توافق عليها، فتوقف عن استخدام الخدمة.
      </p>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
        <strong>تنبيه مهم:</strong> هَيَّا نَقْرَأْ منصة تعليمية قيد التطوير لاستكشاف مهارات القراءة العربية وتقديم أنشطة للممارسة. النتائج استكشافية وليست تشخيصًا أو مقارنة معيارية مقننة.
      </div>
    </header>

    <TermsSection icon={GraduationCap} title="١. الغرض وحدود الخدمة">
      <p>تتيح المنصة أنشطة لاستكشاف مهارات القراءة والوعي الصوتي، وقراءة صامتة أو جهرية اختيارية، وأسئلة فهم، وقارئًا ميسّرًا، وأنشطة للممارسة. لا تمثل المخرجات الآلية قياسًا معياريًا أو دليلًا على وجود صعوبة تعلم.</p>
      <ul className="list-disc space-y-2 pr-5">
        <li>سرعة قراءة النص المعروض محسوبة مباشرة من زمن الجلسة وعدد الكلمات.</li>
        <li>لا يُعدّ معدل إتمام النص مقياسًا للطلاقة الشفوية. يُحسب مؤشر الكلمات الصحيحة في الدقيقة كتقدير استرشادي مبني على التحليل الصوتي الآلي للقراءة الجهرية، وقد يتأثر بعوامل التباين اللهجي وجودة الميكروفون وبيئة التسجيل.</li>
        <li>إجابات الفهم القرائي نتائج خاصة بالأنشطة المعروضة، وليست معايير سكانية أو تشخيصًا لعسر القراءة (الديسلكسيا).</li>
        <li>أي تفريغ صوتي أو اقتراح آلي قد يخطئ، ويجب مراجعته قبل استخدامه في قرار تعليمي. ولا ينبغي اتخاذ قرار مهم بشأن الطفل استنادًا إلى نتيجة آلية منفردة.</li>
      </ul>
    </TermsSection>

    <TermsSection icon={Mic} title="٢. القراءة الجهرية والميكروفون">
      <p><strong>حماية الخصوصية:</strong> لا تستخدم المنصة الكاميرا أو تجمع صورًا أو فيديو. يُطلب إذن الميكروفون فقط عند اختيار القراءة الجهرية وبعد موافقة مستقلة من ولي الأمر.</p>
      <p>قد يُرسل الصوت إلى خدمات معالجة الصوت والذكاء الاصطناعي المعتمدة عند تفعيل خدمة التقييم الصوتي أو إنشاء مسودة الخطة الفردية. تختلف المعالجة والاحتفاظ بحسب إعدادات الخدمة والاتفاقية المنطبقة؛ راجع سياسة الخصوصية وتحقق من إعدادات المزود قبل استخدام بيانات طفل حقيقية.</p>
    </TermsSection>

    <TermsSection icon={ShieldCheck} title="٣. مسؤولية الحساب والمؤسسة">
      <ul className="list-disc space-y-2 pr-5">
        <li>يجب على المؤسسة أو المستخدم المخوّل تقديم بيانات دقيقة بالقدر اللازم، وعدم إدخال معلومات شخصية لا تحتاجها الوظيفة.</li>
        <li>يجب استخدام أسماء مستعارة وبيانات اصطناعية في العروض التجريبية والاختبارات العامة، ما لم تكن بيئة معالجة بيانات الطلاب قد رُوجعت واعتُمدت قانونيًا وتقنيًا.</li>
        <li>على المؤسسة ضبط الحسابات والصلاحيات، والتحقق من موافقات أولياء الأمور، وتحديد أغراض المعالجة والاحتفاظ، وعدم مشاركة السجلات إلا على أساس مشروع ومصرح به.</li>
        <li>يتحمل مستخدمو الحساب مسؤولية حفظ بيانات الدخول، وعدم كشف رموز الوصول أو محاولة الوصول إلى سجلات مؤسسة أخرى.</li>
      </ul>
    </TermsSection>

    <TermsSection icon={Scale} title="٤. القانون والبيانات الشخصية">
      <p>تشغّل المنصة شركة فورالا (Vorala LLC)، وهي شركة أمريكية تقدّم خدماتها في دولة قطر ودول الخليج. لذلك تخضع المنصة للقوانين الأمريكية المنظِّمة لخصوصية الأطفال، وتلتزم كذلك بقوانين حماية البيانات في كل دولة تقدّم فيها الخدمة، ومنها قانون دولة قطر رقم (١٣) لسنة ٢٠١٦ بشأن حماية خصوصية البيانات الشخصية. ويَعُدّ القانون بيانات الأطفال من البيانات الشخصية ذات الطبيعة الخاصة، وقد يتطلب تصريحًا مسبقًا لمعالجتها، كما يفرض على المواقع الموجهة للأطفال التزامات خاصة بالإخطار وموافقة ولي الأمر وطلبات الوصول والحذف.</p>
      <p>المتحكم في البيانات هو شركة فورالا (Vorala LLC)، وبيانات التواصل لطلبات الخصوصية والحذف وسحب الموافقة مذكورة في سياسة الخصوصية. ويمكن لولي الأمر حذف ملف طفله وكل نتائجه في أي وقت من بوابة الأسرة.</p>
      <p><a className="font-bold text-teal-800 underline" href="https://www.almeezan.qa/LawView.aspx?LawID=7121" target="_blank" rel="noreferrer">الاطلاع على نص قانون حماية خصوصية البيانات الشخصية في الميزان</a>.</p>
    </TermsSection>

    <TermsSection icon={AlertTriangle} title="٥. التوافر والتعديلات">
      <p>قد تتغير الأنشطة والميزات خلال التطوير أو قد تتوقف مؤقتًا للصيانة أو إصلاح الأخطاء. نبذل جهدًا معقولًا لتقديم نتائج مفهومة، لكن لا نضمن خلو الخدمة من الأخطاء أو أن كل جهاز ومتصفح سيعمل بالطريقة نفسها.</p>
      <p>لا تُستخدم المنصة للطوارئ ولا لتقديم تشخيص أو علاج، ولا تُرفع إليها بيانات أو مواد لا تملك حق استخدامها. لا يجوز محاولة تعطيل الخدمة أو تجاوز صلاحيات الدخول أو اختبارها ببيانات أطفال حقيقية دون موافقة وترتيبات اختبار مناسبة.</p>
    </TermsSection>

    <TermsSection icon={FileText} title="٦. تحديث الشروط والتواصل">
      <p>قد تُحدّث الشروط عند تغيير الخدمة أو المتطلبات القانونية، ويُعرض تاريخ آخر تحديث أعلى هذه الصفحة.</p>
      <p><strong>الصور:</strong> صور الألعاب والتمارين من مجموعة <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noreferrer" className="font-bold underline text-teal-800">Twemoji</a>، وهي مرخّصة بموجب <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="font-bold underline text-teal-800">CC BY ٤٫٠</a>.</p>
      <p><strong>الجهة المطوّرة:</strong> منصة هَيَّا نَقْرَأْ التابعة لشركة فورالا (Vorala LLC) المسجلة في الولايات المتحدة الأمريكية. بيانات التواصل الرسمية لطلبات الخصوصية مذكورة في سياسة الخصوصية.</p>
    </TermsSection>
  </main>
);

export default TermsOfUseView;
