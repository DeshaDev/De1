import React, { useState } from 'react';
import { ArrowRight, Printer, Dumbbell, AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { BATTERY, DOMAINS, SUBTESTS_BY_ID, SubtestId, subtestsForAge } from '../../cognitiveProfile/battery';
import { ageCautionAr, CognitiveProfile, ScoredSubtest, formatAge } from '../../cognitiveProfile/scoring';
import { FLAG_TEXT_AR, READING_MEASURE_NOTE_AR, SUBTEST_GUIDANCE, WORD_NONWORD_NOTE_AR, readingMeasureLineAr } from '../../cognitiveProfile/guidance';
import { SPELL_ERROR_TEXT_AR } from '../../cognitiveProfile/readingTasks';
import { DIALECT_LABELS_AR, DIALECT_SENSITIVE_ITEMS, type BatterySession, type ScreeningSnapshot } from '../../cognitiveProfile/storage';
import { BrandMark } from '../ui/BrandMark';

const toArabicDigits = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

function PerformanceBar({ scored }: { scored: ScoredSubtest }) {
  const label = SUBTESTS_BY_ID[scored.subtestId].skillNameAr;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-ink-2">{toArabicDigits(scored.correct)}/{toArabicDigits(scored.total)} إجابة صحيحة</span>
        <strong className="bz-num text-ink">{toArabicDigits(scored.percent)}٪ داخل هذه المهمة</strong>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden bg-soft" role="img" aria-label={label}>
        <span className="block h-full rounded-full bg-brand" style={{ width: scored.percent + '%' }} />
      </div>
    </div>
  );
}

interface Props {
  profile: CognitiveProfile;
  session: BatterySession;
  onBack: () => void;
  onStartTraining: () => void;
  previous?: ScreeningSnapshot | null;
}

export function ProfileReportView({ profile, session, onBack, onStartTraining, previous = null }: Props) {
  const [openStrategy, setOpenStrategy] = useState<SubtestId | null>(null);
  const scoredById = new Map(profile.subtests.map((s) => [s.subtestId, s]));
  const flagged = profile.subtests.filter((s) => s.flags.length > 0);
  const dialectNotes = session.dialect
    ? (session.results.auditoryDiscrimination?.responses ?? [])
        .filter((r) => !r.correct && DIALECT_SENSITIVE_ITEMS[r.itemId]?.dialects.includes(session.dialect!))
        .map((r) => DIALECT_SENSITIVE_ITEMS[r.itemId].pairAr)
    : [];
  const totalTasks = subtestsForAge(session.ageMonths).length;
  /** Reading and naming tasks are shown with their raw measures, apart from the percent-correct tasks. */
  const isMeasureTask = (id: SubtestId) => SUBTESTS_BY_ID[id].domain === 'reading' || SUBTESTS_BY_ID[id].domain === 'naming';
  const readingScored = BATTERY.filter((t) => isMeasureTask(t.id)).map((t) => scoredById.get(t.id)).filter((x): x is ScoredSubtest => Boolean(x));
  const spelling = scoredById.get('spelling');
  const testedDate = new Date(session.startedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <button type="button" onClick={onBack} className="bz-btn bz-btn-ghost">
          <ArrowRight className="w-4 h-4" /> العودة إلى الألعاب
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="bz-btn bz-btn-secondary">
            <Printer className="w-4 h-4" /> طباعة / PDF
          </button>
          <button type="button" onClick={onStartTraining} className="bz-btn bz-btn-primary">
            <Dumbbell className="w-4 h-4" /> الانتقال إلى البرنامج التدريبي
          </button>
        </div>
      </div>

      <article className="print-report-root bz-card overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        <header className="px-5 sm:px-10 pt-8 pb-6 border-b border-line flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <BrandMark size={44} />
            <div>
              <p className="bz-small text-brand font-semibold">هَيَّا نَقْرَأْ · ملخص أداء أنشطة القراءة</p>
              <h1 className="bz-h2 mt-1" style={{ fontSize: 'clamp(24px, 2.6vw, 32px)' }}>{session.childName}</h1>
              <p className="bz-small text-ink-2 mt-1">العمر عند الفحص: <strong className="text-ink">{formatAge(profile.ageMonths)}</strong></p>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 bz-small">
            <dt className="bz-muted">تاريخ الفحص</dt>
            <dd className="text-ink font-semibold">{testedDate}</dd>
            <dt className="bz-muted">الفاحص</dt>
            <dd className="text-ink font-semibold">{session.examinerName || '—'}</dd>
            <dt className="bz-muted">لهجة البيت</dt>
            <dd className="text-ink font-semibold">{session.dialect ? DIALECT_LABELS_AR[session.dialect] : 'لم تُحدَّد'}</dd>
            <dt className="bz-muted">المهام المكتملة</dt>
            <dd className="text-ink font-semibold bz-num">{toArabicDigits(profile.subtests.length)} من {toArabicDigits(totalTasks)}</dd>
          </dl>
        </header>

        <div className="px-5 sm:px-10 py-8 space-y-10">
          {profile.ageOutOfRange && (
            <p className="flex gap-2 bz-small rounded-xl p-3 bg-warn-soft text-warn font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-1" />
              العمر خارج النطاق المصمم لهذه البطارية؛ لا تعتمد هذا التقرير أو أي تفسير للنتائج.
            </p>
          )}

          <section className="rounded-2xl p-6 bg-soft border border-line space-y-2" aria-labelledby="session-summary-title">
            <p className="bz-small font-semibold text-brand">ملخص الجلسة</p>
            <h2 id="session-summary-title" className="bz-h2" style={{ fontSize: 'clamp(22px, 2.4vw, 28px)' }}>
              أداء الطفل داخل الأنشطة المكتملة
            </h2>
            <p className="text-[16px] leading-[1.8] text-ink max-w-3xl">
              يعرض هذا التقرير عدد الإجابات الصحيحة ونسبتها داخل كل مهمة، وأزمنة الاستجابة وملاحظات التنفيذ. لا تمثل هذه النسب مئينات أو مقارنة بالأقران أو مؤشرًا لوجود عسر القراءة.
            </p>
            <p className="bz-small text-ink-2">
              الفحص الحالي استكشافي وغير مقنن على عينة عربية مستقلة. استخدم النتائج لفهم ما حدث أثناء الأنشطة واختيار ممارسة تعليمية مناسبة، لا لاتخاذ قرار تشخيصي أو عالي الأثر.
            </p>
          </section>

          {previous && (
            <section className="bz-card p-6 space-y-2" aria-labelledby="previous-title">
              <h2 id="previous-title" className="bz-h3">سجل فحص سابق</h2>
              <p className="bz-small text-ink-2">
                يوجد فحص سابق بتاريخ {new Date(previous.completedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}، وأُكمل فيه {toArabicDigits(previous.completedSubtests)} مهام.
              </p>
              <p className="text-xs text-ink-2">
                لا تعرض المنصة حاليًا مقارنة معيارية أو فرقًا في المئينات بين الجلسات؛ فالجدول المرجعي مؤقت ولم يُقنّن. يجب تفسير كل نتيجة بوصفها أداءً داخل المهمة في ذلك اليوم.
              </p>
            </section>
          )}

          {readingScored.length > 0 && (
            <section aria-labelledby="reading-title" className="space-y-4">
              <div className="pb-4 border-b border-line">
                <h2 id="reading-title" className="bz-h3" style={{ fontSize: 22 }}>القراءة والإملاء والتسمية السريعة</h2>
                <p className="bz-small bz-muted mt-1">{READING_MEASURE_NOTE_AR}</p>
              </div>
              <ul className="grid md:grid-cols-2 gap-3">
                {readingScored.map((scored) => (
                  <li key={scored.subtestId} className="rounded-2xl border border-line p-4">
                    <p className="font-semibold text-ink">{SUBTESTS_BY_ID[scored.subtestId].skillNameAr}</p>
                    <p className="bz-small text-ink-2 mt-1 bz-num">{readingMeasureLineAr(scored.subtestId, scored)}</p>
                    {scored.flags.includes('discontinued') && <p className="text-[12px] text-muted mt-1">{FLAG_TEXT_AR.discontinued}</p>}
                  </li>
                ))}
              </ul>
              {scoredById.get('wordReading')?.scoreAvailable && scoredById.get('nonwordReading')?.scoreAvailable && (
                <p className="rounded-xl bg-soft p-4 bz-small text-ink-2">
                  <strong className="text-ink">
                    كلمات حقيقية {toArabicDigits(scoredById.get('wordReading')!.percent)}٪ · كلمات مصنوعة {toArabicDigits(scoredById.get('nonwordReading')!.percent)}٪.
                  </strong>{' '}
                  {WORD_NONWORD_NOTE_AR}
                </p>
              )}
              {spelling?.measures?.spellingErrors && spelling.measures.spellingErrors.length > 0 && (
                <div className="rounded-xl border border-line p-4 bz-small text-ink-2">
                  <p className="font-semibold text-ink">أخطاء الإملاء حسب النوع</p>
                  <ul className="mt-2 space-y-1">
                    {spelling.measures.spellingErrors.map((e) => (
                      <li key={e.kind}>{SPELL_ERROR_TEXT_AR[e.kind]}: <span className="bz-num">{toArabicDigits(e.count)}</span> {e.count === 1 ? 'كلمة' : 'كلمات'}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="tasks-title">
            <div className="pb-4 border-b border-line">
              <h2 id="tasks-title" className="bz-h3" style={{ fontSize: 22 }}>{readingScored.length > 0 ? 'المهارات السابقة للقراءة' : 'نتائج المهام المكتملة'}</h2>
              <p className="bz-small bz-muted mt-1">النسبة = عدد الإجابات الصحيحة ÷ إجمالي بنود المهمة. لا تقارن النسب بين مهام مختلفة باعتبارها مقياسًا واحدًا.</p>
            </div>
            <div className="divide-y divide-line">
              {(Object.keys(DOMAINS) as Array<keyof typeof DOMAINS>).map((domainId) => {
                const domain = DOMAINS[domainId];
                const members = BATTERY.filter((item) => item.domain === domainId && !isMeasureTask(item.id));
                const scoredMembers = members.map((item) => ({ item, scored: scoredById.get(item.id) })).filter((entry) => entry.scored);
                if (scoredMembers.length === 0) return null;
                return (
                  <div key={domainId} className="py-5 grid md:grid-cols-[14rem_minmax(0,1fr)] gap-x-8 gap-y-3">
                    <div>
                      <h3 className="font-semibold text-ink flex items-center gap-2">
                        <span className="w-1.5 h-5 rounded-full" style={{ backgroundColor: domain.color }} aria-hidden="true" />
                        {domain.nameAr}
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {scoredMembers.map(({ item, scored }) => (
                        <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-1">
                          <div className="bz-small leading-snug">
                            <span className="font-semibold text-ink">{item.skillNameAr}</span>
                            <span className="block text-[12px] bz-muted">{item.gameNameAr}</span>
                          </div>
                          <PerformanceBar scored={scored as ScoredSubtest} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="practice-title">
            <h2 id="practice-title" className="bz-h3" style={{ fontSize: 22 }}>أفكار للممارسة التعليمية</h2>
            <p className="mt-2 bz-small text-ink-2">
              هذه الأفكار مرتبطة بموضوع كل نشاط، وليست توصيات تشخيصية أو نتيجة لتصنيف معياري. اختر منها ما يلائم اهتمام الطفل ومستواه الفعلي.
            </p>
            <div className="mt-4 space-y-3">
              {profile.subtests.map((scored) => {
                const id = scored.subtestId;
                const guidance = SUBTEST_GUIDANCE[id];
                const isOpen = openStrategy === id;
                return (
                  <div key={id} className="rounded-2xl border border-line overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenStrategy(isOpen ? null : id)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-right bg-card hover:bg-soft cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span className="flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-ink">{SUBTESTS_BY_ID[id].skillNameAr}</span>
                        <span className="bz-badge bz-badge-neutral">{readingMeasureLineAr(id, scored) ?? `${toArabicDigits(scored.percent)}٪ داخل المهمة`}</span>
                      </span>
                      <ChevronDown className={`w-5 h-5 text-muted transition-transform no-print ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`${isOpen ? 'block' : 'hidden'} print:block px-5 pb-5 pt-1 border-t border-line`}>
                      <dl className="grid md:grid-cols-2 gap-4 py-4 bz-small">
                        <div><dt className="font-semibold text-ink">ماذا تقيس المهارة</dt><dd className="text-ink-2 mt-1">{guidance.measuresAr}</dd></div>
                        <div><dt className="font-semibold text-ink">علاقتها بتعلّم القراءة</dt><dd className="text-ink-2 mt-1">{guidance.whyItMattersAr}</dd></div>
                      </dl>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="rounded-xl p-4 bg-soft">
                          <p className="font-semibold text-ink bz-small">أنشطة مقترحة داخل الصف</p>
                          <ul className="list-disc pr-5 mt-2 space-y-1.5 bz-small text-ink-2">
                            {guidance.strategiesAr.map((strategy) => <li key={strategy}>{strategy}</li>)}
                          </ul>
                        </div>
                        <div className="rounded-xl p-4 bg-sun-soft">
                          <p className="font-semibold text-ink bz-small">أفكار للممارسة في البيت</p>
                          <ul className="list-disc pr-5 mt-2 space-y-1.5 bz-small text-ink-2">
                            {guidance.homeActivitiesAr.map((activity) => <li key={activity}>{activity}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="bz-h3" style={{ fontSize: 22 }}>جدول النتائج الخام</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm border-collapse min-w-[520px]">
                <thead>
                  <tr className="bg-soft text-ink-2">
                    <th className="px-3 py-2.5 text-right font-semibold">المهمة</th>
                    <th className="px-3 py-2.5 font-semibold">الصحيح / الإجمالي</th>
                    <th className="px-3 py-2.5 font-semibold">النسبة داخل المهمة</th>
                    <th className="px-3 py-2.5 font-semibold">الزمن</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.subtests.map((scored) => (
                    <tr key={scored.subtestId} className="border-t border-line text-center bz-num">
                      <td className="px-3 py-2.5 text-right font-semibold text-ink">{SUBTESTS_BY_ID[scored.subtestId].skillNameAr}</td>
                      <td className="px-3 py-2.5">{scored.scoreAvailable === false ? '—' : toArabicDigits(`${scored.correct}/${scored.total}`)}</td>
                      <td className="px-3 py-2.5">{scored.scoreAvailable === false ? '—' : `${toArabicDigits(scored.percent)}٪`}</td>
                      <td className="px-3 py-2.5">
                        {scored.scoreAvailable === false ? '—' : scored.measures
                          ? scored.measures.seconds !== null
                            ? `${toArabicDigits(scored.measures.seconds)} ث${scored.measures.correctPerMinute !== undefined ? ` · ${toArabicDigits(scored.measures.correctPerMinute)}/د` : ''}`
                            : '—'
                          : scored.medianRtMs
                            ? `${toArabicDigits((scored.medianRtMs / 1000).toFixed(1))} ث`
                            : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(flagged.length > 0 || dialectNotes.length > 0) && (
              <div className="mt-3 rounded-xl p-4 bg-warn-soft bz-small text-ink-2 space-y-1">
                <p className="font-semibold text-warn">ملاحظات سياق التطبيق</p>
                {dialectNotes.length > 0 && (
                  <p>
                    <strong className="text-ink">التمييز السمعي واللهجة:</strong> أخطأ الطفل في {dialectNotes.join('، ')}، وهي أصوات قد تختلف في النطق اليومي بلهجة {DIALECT_LABELS_AR[session.dialect!]}؛ قد يعكس الخطأ اختلافًا لهجيًا لا صعوبة في التمييز.
                  </p>
                )}
                {flagged.map((scored) => (
                  <p key={scored.subtestId}>
                    <strong className="text-ink">{SUBTESTS_BY_ID[scored.subtestId].skillNameAr}:</strong> {scored.flags.map((flag) => FLAG_TEXT_AR[flag]).join(' ')}
                  </p>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-soft p-5 bz-small text-ink-2 space-y-2">
            <p className="flex items-center gap-1.5 font-semibold text-ink"><Info className="w-4 h-4" /> حدود التفسير</p>
            {ageCautionAr(session.ageMonths) && <p className="font-semibold text-ink">{ageCautionAr(session.ageMonths)}</p>}
            <p>
              النسب المعروضة هي نسبة الإجابات الصحيحة داخل المهمة فقط. جدول المقارنة العمرية في النظام مؤقت وغير مبني على عينة عربية مقننة؛ لذلك لا نعرض المئينات أو درجات الخطورة في هذا التقرير.
            </p>
            <p>
              الفحص استكشافي وليس تشخيصًا. قد يتأثر الأداء بالانتباه والتعب وفهم التعليمات واللهجة وجودة الصوت. إذا كانت لديك مخاوف مستمرة بشأن قراءة الطفل في البيت أو المدرسة، فاطلب تقييمًا شاملًا لدى جهة متخصصة مؤهلة.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}

export default ProfileReportView;
