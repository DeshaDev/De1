import React, { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Mail, MessageSquareHeart, Send } from 'lucide-react';

interface ContactSubmitResponse {
  ok?: boolean;
  emailed?: boolean;
  stored?: boolean;
  recipientEmail?: string;
  mailtoUrl?: string;
  message?: string;
  error?: string;
}

export const ContactUsSection: React.FC = () => {
  const [name, setName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<ContactSubmitResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setCopied(false);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          childAge: childAge.trim(),
          question: question.trim(),
        }),
      });
      const data = (await res.json()) as ContactSubmitResponse;
      if (!res.ok) {
        setResult(data.mailtoUrl ? data : null);
        throw new Error(data.error || 'تعذر إرسال السؤال حاليًا.');
      }
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء إرسال السؤال.';
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setChildAge('');
    setQuestion('');
    setResult(null);
    setErrorMsg('');
    setCopied(false);
  };

  const handleCopyQuestion = async () => {
    const text = `الاسم: ${name.trim()}\nعمر الطفل: ${childAge.trim()}\nنص السؤال:\n${question.trim()}\n\nالبريد: contact@hayanaqra.com`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="contact-us" className="scroll-mt-24 bz-container py-12 sm:py-16" aria-labelledby="contact-us-title">
      <div className="hn-card p-6 sm:p-8 lg:p-10">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
          <div className="space-y-4">
            <span className="bz-badge">
              <MessageSquareHeart size={15} aria-hidden="true" />
              دعم أولياء الأمور والأسرة
            </span>
            <h2 id="contact-us-title" className="hn-h2">تواصل معنا</h2>
            <p className="hn-body">
              هل لديك استفسار عن قراءة طفلك أو نتائج الفحص أو كيفية استخدام التدريبات؟ اكتب سؤالك هنا وسنستلمه على بريدنا الرسمي.
            </p>
            <div className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/70 px-3.5 py-2 text-sm text-teal-900 font-semibold">
              <Mail size={16} aria-hidden="true" />
              <span dir="ltr">contact@hayanaqra.com</span>
            </div>
            <p className="hn-small">
              نطلب فقط الاسم، وعمر الطفل، ونص السؤال حتى نتمكّن من مساعدتك بما يناسب مرحلة طفلك العمرية.
            </p>
          </div>

          <div>
            {result?.ok ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 space-y-4 text-center sm:text-right">
                <div className="flex items-center justify-center sm:justify-start gap-2.5 text-emerald-800">
                  <CheckCircle2 size={24} className="shrink-0" aria-hidden="true" />
                  <h3 className="bz-h3">
                    {result.emailed ? 'تم إرسال سؤالك بنجاح!' : 'تم استلام وحفظ سؤالك!'}
                  </h3>
                </div>
                <p className="bz-body text-slate-700">{result.message}</p>

                {!result.emailed && result.mailtoUrl && (
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <a
                      href={result.mailtoUrl}
                      className="bz-btn bz-btn-primary inline-flex items-center gap-2"
                    >
                      <ExternalLink size={16} aria-hidden="true" />
                      فتح وإرسال إلى contact@hayanaqra.com
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyQuestion}
                      className="bz-btn bz-btn-ghost inline-flex items-center gap-2"
                    >
                      <Copy size={15} aria-hidden="true" />
                      {copied ? 'تم النسخ!' : 'نسخ نص الرسالة'}
                    </button>
                  </div>
                )}

                <div>
                  <button type="button" onClick={resetForm} className="bz-btn bz-btn-ghost">
                    إرسال سؤال آخر
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div role="alert" className="p-3.5 rounded-xl bg-risk-soft text-risk bz-small font-semibold space-y-2">
                    <p>{errorMsg}</p>
                    {result?.mailtoUrl && (
                      <a
                        href={result.mailtoUrl}
                        className="inline-flex items-center gap-1.5 underline font-bold"
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                        مراسلة contact@hayanaqra.com مباشرة عبر البريد
                      </a>
                    )}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="bz-field">
                    <span className="bz-label">الاسم *</span>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثال: فهد حمد"
                      className="bz-input"
                    />
                  </label>
                  <label className="bz-field">
                    <span className="bz-label">عمر الطفل *</span>
                    <select
                      required
                      value={childAge}
                      onChange={(e) => setChildAge(e.target.value)}
                      className="bz-input bg-white cursor-pointer"
                    >
                      <option value="" disabled>اختر عمر الطفل</option>
                      <option value="٤ سنوات">٤ سنوات</option>
                      <option value="٥ سنوات">٥ سنوات</option>
                      <option value="٦ سنوات">٦ سنوات</option>
                      <option value="٧ سنوات">٧ سنوات</option>
                      <option value="٨ سنوات">٨ سنوات</option>
                      <option value="أكثر من ٨ سنوات">أكثر من ٨ سنوات</option>
                      <option value="استفسار عام">استفسار عام</option>
                    </select>
                  </label>
                </div>

                <label className="bz-field">
                  <span className="bz-label">نص السؤال *</span>
                  <textarea
                    required
                    minLength={5}
                    maxLength={2000}
                    rows={4}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="اكتب سؤالك هنا بالتفصيل..."
                    className="bz-input"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bz-btn bz-btn-primary hn-toy inline-flex items-center gap-2"
                  >
                    <Send size={16} aria-hidden="true" />
                    {submitting ? 'جارٍ الإرسال…' : 'إرسال إلى contact@hayanaqra.com'}
                  </button>
                  <span className="bz-small bz-muted">يرسل مباشرة إلى contact@hayanaqra.com</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactUsSection;
