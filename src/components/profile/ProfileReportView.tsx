import React, { useState } from 'react';
import { ArrowRight, Printer, Dumbbell, AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { BATTERY, DOMAINS, SUBTESTS_BY_ID, SubtestId } from '../../cognitiveProfile/battery';
import {
  BAND_META,
  CognitiveProfile,
  REFERENCE_TABLE,
  ScoredSubtest,
  formatAge,
} from '../../cognitiveProfile/scoring';
import { FLAG_TEXT_AR, PATTERN_META, RISK_META, SUBTEST_GUIDANCE, nextStepsAr } from '../../cognitiveProfile/guidance';
import { DIALECT_LABELS_AR, DIALECT_SENSITIVE_ITEMS, type BatterySession } from '../../cognitiveProfile/storage';
import { BandLegend, CentileTrack } from './CentileTrack';
import { BrandMark } from '../ui/BrandMark';

const toArabicDigits = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

function CentileBar({ scored }: { scored: ScoredSubtest }) {
  return <CentileTrack centile={scored.centile} label={SUBTESTS_BY_ID[scored.subtestId].skillNameAr} />;
}

function bandBadge(band: keyof typeof BAND_META) {
  return { color: BAND_META[band].color, backgroundColor: BAND_META[band].bg };
}

interface Props {
  profile: CognitiveProfile;
  session: BatterySession;
  onBack: () => void;
  onStartTraining: () => void;
}

export function ProfileReportView({ profile, session, onBack, onStartTraining }: Props) {
  const [openStrategy, setOpenStrategy] = useState<SubtestId | null>(profile.weaknesses[0] ?? null);
  const risk = RISK_META[profile.risk];
  const pattern = PATTERN_META[profile.pattern];
  const scoredById = new Map(profile.subtests.map((s) => [s.subtestId, s]));
  const flagged = profile.subtests.filter((s) => s.flags.length > 0);

  const dialectNotes = session.dialect
    ? (session.results.auditoryDiscrimination?.responses ?? [])
        .filter((r) => !r.correct && DIALECT_SENSITIVE_ITEMS[r.itemId]?.dialects.includes(session.dialect!))
        .map((r) => DIALECT_SENSITIVE_ITEMS[r.itemId].pairAr)
    : [];
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
            <Dumbbell className="w-4 h-4" /> البرنامج التدريبي المقترح
          </button>
        </div>
      </div>

      <article className="print-report-root bz-card overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        {/* Header */}
        <header className="px-5 sm:px-10 pt-8 pb-6 border-b border-line flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <BrandMark size={44} />
            <div>
              <p className="bz-small text-brand font-semibold">بصيرة · تقرير الملف المعرفي القرائي</p>
              <h1 className="bz-h2 mt-1" style={{ fontSize: 'clamp(24px, 2.6vw, 32px)' }}>{session.childName}</h1>
              <p className="bz-small text-ink-2 mt-1">
                العمر عند الفحص: <strong className="text-ink">{formatAge(profile.ageMonths)}</strong> · فئة المقارنة: {profile.ageBandLabelAr}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 bz-small">
            <dt className="bz-muted">تاريخ الفحص</dt>
            <dd className="text-ink font-semibold">{testedDate}</dd>
            <dt className="bz-muted">الفاحص</dt>
            <dd className="text-ink font-semibold">{session.examinerName || '—'}</dd>
            <dt className="bz-muted">لهجة البيت</dt>
            <dd className="text-ink font-semibold">{session.dialect ? DIALECT_LABELS_AR[session.dialect] : 'لم تُحدَّد'}</dd>
            <dt className="bz-muted">الاختبارات المكتملة</dt>
            <dd className="text-ink font-semibold bz-num">{toArabicDigits(profile.subtests.length)} من ٩</dd>
          </dl>
        </header>

        <div className="px-5 sm:px-10 py-8 space-y-10">
          {profile.ageOutOfRange && (
            <p className="flex gap-2 bz-small rounded-xl p-3 bg-warn-soft text-warn font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-1" />
              عمر الطفل خارج المدى المصمَّم له الفحص (٤:٠–٨:١١)؛ قورنت النتائج بأقرب فئة عمرية، وتُفسَّر بحذر.
            </p>
          )}

          {/* Executive summary */}
          <section className="grid lg:grid-cols-[1.4fr_1fr] gap-4" aria-labelledby="summary-title">
            <div className="rounded-2xl p-6" style={{ backgroundColor: risk.bg, border: `1px solid color-mix(in srgb, ${risk.color} 30%, transparent)` }}>
              <h2 id="summary-title" className="sr-only">الخلاصة</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="bz-badge" style={{ backgroundColor: risk.color, color: '#FFFFFF' }}>{risk.labelAr}</span>
                {profile.pattern !== 'none' && <span className="bz-badge bz-badge-neutral" style={{ background: 'rgba(255,255,255,.7)' }}>{pattern.titleAr}</span>}
              </div>
              <p className="mt-4 text-[16px] leading-[1.9] text-ink">{risk.summaryAr}</p>
              {profile.pattern !== 'none' && <p className="mt-2 bz-small text-ink-2">{pattern.textAr}</p>}
            </div>
            <div className="bz-card-quiet p-6">
              <h3 className="font-semibold text-ink">الخطوات التالية</h3>
              <ol className="mt-3 space-y-3">
                {nextStepsAr(profile.risk, profile.pattern).map((step, i) => (
                  <li key={step} className="flex gap-3 bz-small text-ink-2">
                    <span className="grid place-items-center w-6 h-6 shrink-0 rounded-full bg-brand text-on-brand text-[12px] font-bold bz-num">{toArabicDigits(i + 1)}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Graphical profile */}
          <section aria-labelledby="profile-title">
            <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-line">
              <div>
                <h2 id="profile-title" className="bz-h3" style={{ fontSize: 22 }}>الملف المعرفي البياني</h2>
                <p className="bz-small bz-muted mt-1">موقع الطفل مقارنةً بأقرانه في العمر (مئين تقديري ١–٩٩، والخط الأوسط = متوسط العمر).</p>
              </div>
              <BandLegend />
            </div>

            <div className="divide-y divide-line">
              {(Object.keys(DOMAINS) as Array<keyof typeof DOMAINS>).map((domainId) => {
                const domain = DOMAINS[domainId];
                const domainScore = profile.domains.find((d) => d.domain === domainId);
                const members = BATTERY.filter((s) => s.domain === domainId);
                return (
                  <div key={domainId} className="py-5 grid md:grid-cols-[14rem_minmax(0,1fr)] gap-x-8 gap-y-3">
                    <div>
                      <h3 className="font-semibold text-ink flex items-center gap-2">
                        <span className="w-1.5 h-5 rounded-full" style={{ backgroundColor: domain.color }} aria-hidden="true" />
                        {domain.nameAr}
                      </h3>
                      {domainScore && (
                        <span className="bz-badge mt-2" style={bandBadge(domainScore.band)}>{BAND_META[domainScore.band].labelAr}</span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {members.map((s) => {
                        const scored = scoredById.get(s.id);
                        return (
                          <div key={s.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-1">
                            <div className="bz-small leading-snug">
                              <span className="font-semibold text-ink">{s.skillNameAr}</span>
                              <span className="block text-[12px] bz-muted">{s.gameNameAr}</span>
                            </div>
                            {scored ? <CentileBar scored={scored} /> : <div className="bz-small bz-muted">لم يُطبَّق بعد</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Strengths */}
          {profile.strengths.length > 0 && (
            <section>
              <h2 className="bz-h3" style={{ fontSize: 22 }}>نقاط القوة وكيف نستثمرها</h2>
              <ul className="mt-4 grid md:grid-cols-2 gap-3">
                {profile.strengths.map((id) => (
                  <li key={id} className="rounded-xl p-4 bg-brand-tint border border-line bz-small">
                    <strong className="block text-brand-strong">{SUBTESTS_BY_ID[id].skillNameAr}</strong>
                    <span className="text-ink-2">{SUBTEST_GUIDANCE[id].strengthUseAr}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Weaknesses + strategies */}
          <section>
            <h2 className="bz-h3" style={{ fontSize: 22 }}>جوانب الاحتياج والاستراتيجيات التعليمية</h2>
            {profile.weaknesses.length === 0 ? (
              <p className="mt-2 bz-body">لا توجد مهارة دون المتوقع لعمر الطفل في الاختبارات المكتملة.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {profile.weaknesses.map((id) => {
                  const g = SUBTEST_GUIDANCE[id];
                  const scored = scoredById.get(id) as ScoredSubtest;
                  const open = openStrategy === id;
                  return (
                    <div key={id} className="rounded-2xl border border-line overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenStrategy(open ? null : id)}
                        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-right bg-card hover:bg-soft cursor-pointer"
                        aria-expanded={open}
                      >
                        <span className="flex flex-wrap items-center gap-3">
                          <span className="font-semibold text-ink">{SUBTESTS_BY_ID[id].skillNameAr}</span>
                          <span className="bz-badge" style={bandBadge(scored.band)}>{BAND_META[scored.band].labelAr}</span>
                        </span>
                        <ChevronDown className={`w-5 h-5 text-muted transition-transform no-print ${open ? 'rotate-180' : ''}`} />
                      </button>
                      <div className={`${open ? 'block' : 'hidden'} print:block px-5 pb-5 pt-1 border-t border-line`}>
                        <dl className="grid md:grid-cols-3 gap-4 py-4 bz-small">
                          <div><dt className="font-semibold text-ink">ماذا يقيس</dt><dd className="text-ink-2 mt-1">{g.measuresAr}</dd></div>
                          <div><dt className="font-semibold text-ink">لماذا يهم للقراءة</dt><dd className="text-ink-2 mt-1">{g.whyItMattersAr}</dd></div>
                          <div><dt className="font-semibold text-ink">ماذا تعني النتيجة</dt><dd className="text-ink-2 mt-1">{g.weaknessMeaningAr}</dd></div>
                        </dl>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="rounded-xl p-4 bg-soft">
                            <p className="font-semibold text-ink bz-small">في الصف · للمعلم والأخصائي</p>
                            <ul className="list-disc pr-5 mt-2 space-y-1.5 bz-small text-ink-2">
                              {g.strategiesAr.map((x) => <li key={x}>{x}</li>)}
                            </ul>
                          </div>
                          <div className="rounded-xl p-4 bg-sun-soft">
                            <p className="font-semibold text-ink bz-small">في البيت · للأسرة</p>
                            <ul className="list-disc pr-5 mt-2 space-y-1.5 bz-small text-ink-2">
                              {g.homeActivitiesAr.map((x) => <li key={x}>{x}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Specialist table */}
          <section>
            <h2 className="bz-h3" style={{ fontSize: 22 }}>جدول الدرجات للأخصائي</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm border-collapse min-w-[620px]">
                <thead>
                  <tr className="bg-soft text-ink-2">
                    <th className="px-3 py-2.5 text-right font-semibold">الاختبار</th>
                    <th className="px-3 py-2.5 font-semibold">الخام</th>
                    <th className="px-3 py-2.5 font-semibold">النسبة</th>
                    <th className="px-3 py-2.5 font-semibold">z</th>
                    <th className="px-3 py-2.5 font-semibold">المئين</th>
                    <th className="px-3 py-2.5 font-semibold">وسيط الاستجابة</th>
                    <th className="px-3 py-2.5 font-semibold">التصنيف</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.subtests.map((s) => (
                    <tr key={s.subtestId} className="border-t border-line text-center bz-num">
                      <td className="px-3 py-2.5 text-right font-semibold text-ink">{SUBTESTS_BY_ID[s.subtestId].skillNameAr}</td>
                      <td className="px-3 py-2.5">{toArabicDigits(`${s.correct}/${s.total}`)}</td>
                      <td className="px-3 py-2.5">{toArabicDigits(s.percent)}٪</td>
                      <td className="px-3 py-2.5" dir="ltr">{s.z.toFixed(2)}</td>
                      <td className="px-3 py-2.5">{toArabicDigits(s.centile)}</td>
                      <td className="px-3 py-2.5">{s.medianRtMs ? `${toArabicDigits((s.medianRtMs / 1000).toFixed(1))} ث` : '—'}</td>
                      <td className="px-3 py-2.5"><span className="bz-badge" style={bandBadge(s.band)}>{BAND_META[s.band].labelAr}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(flagged.length > 0 || dialectNotes.length > 0) && (
              <div className="mt-3 rounded-xl p-4 bg-warn-soft bz-small text-ink-2 space-y-1">
                <p className="font-semibold text-warn">ملاحظات صلاحية التطبيق</p>
                {dialectNotes.length > 0 && (
                  <p>
                    <strong className="text-ink">التمييز السمعي واللهجة:</strong> أخطأ الطفل في {dialectNotes.join('، ')}، وهي أصوات تدمجها اللهجة {DIALECT_LABELS_AR[session.dialect!]} في الكلام اليومي. قد يعكس الخطأ لهجته لا ضعفًا في التمييز السمعي؛ فسّر هذا الاختبار بحذر.
                  </p>
                )}
                {flagged.map((s) => (
                  <p key={s.subtestId}>
                    <strong className="text-ink">{SUBTESTS_BY_ID[s.subtestId].skillNameAr}:</strong> {s.flags.map((f) => FLAG_TEXT_AR[f]).join(' ')}
                  </p>
                ))}
              </div>
            )}
          </section>

          {/* Method note */}
          <section className="rounded-2xl bg-soft p-5 bz-small text-ink-2 space-y-2">
            <p className="flex items-center gap-1.5 font-semibold text-ink"><Info className="w-4 h-4" /> عن المقارنة العمرية وحدود التفسير</p>
            {profile.referenceStatus === 'provisional' ? (
              <p>
                المئينات في هذا التقرير <strong>تقديرية</strong> ومحسوبة مقابل جدول مرجعي مؤقت ({REFERENCE_TABLE.version}). {REFERENCE_TABLE.sourceAr} لذلك تُستخدم النتائج للفرز المبكر وتوجيه التدريب، ولا تُغني عن تقييم شامل لدى أخصائي مؤهل.
              </p>
            ) : (
              <p>المئينات محسوبة مقابل معايير مقننة ({REFERENCE_TABLE.version}). {REFERENCE_TABLE.sourceAr}</p>
            )}
            <p>
              الفحص أداة فرز ومؤشر مبكر لاحتمال صعوبة تعلّم القراءة، وليس تشخيصًا. يتأثر الأداء بالانتباه والتعب واللهجة وجودة الصوت. إذا بدت النتيجة غير متسقة مع ما يعرفه المعلم عن الطفل فأعد الاختبار المعنيّ في يوم آخر.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}

export default ProfileReportView;
