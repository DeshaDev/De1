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
import type { BatterySession } from '../../cognitiveProfile/storage';

const toArabicDigits = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

function CentileBar({ scored }: { scored: ScoredSubtest }) {
  const meta = BAND_META[scored.band];
  return (
    <div className="relative h-7 w-full" dir="ltr" aria-label={`المئين التقديري ${scored.centile}`}>
      <div className="absolute inset-y-1 inset-x-0 flex rounded-full overflow-hidden">
        <div style={{ width: '5%' }} className="bg-rose-200" />
        <div style={{ width: '15%' }} className="bg-orange-100" />
        <div style={{ width: '60%' }} className="bg-emerald-50" />
        <div style={{ width: '20%' }} className="bg-sky-100" />
      </div>
      <div className="absolute inset-y-0 border-l-2 border-dashed border-slate-400" style={{ left: '50%' }} title="متوسط العمر" />
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 min-w-6 px-1.5 rounded-full text-[11px] font-black text-white flex items-center justify-center shadow"
        style={{ left: `${scored.centile}%`, backgroundColor: meta.color }}
      >
        {toArabicDigits(scored.centile)}
      </div>
    </div>
  );
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

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
          <ArrowRight className="w-4 h-4" /> العودة إلى الألعاب
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 cursor-pointer">
            <Printer className="w-4 h-4" /> طباعة / PDF
          </button>
          <button type="button" onClick={onStartTraining} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-black shadow cursor-pointer">
            <Dumbbell className="w-4 h-4" /> البرنامج التدريبي المقترح
          </button>
        </div>
      </div>

      <article className="print-report-root bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-8 space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-black text-emerald-700 tracking-wide">بصيرة · تقرير الملف المعرفي القرائي</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{session.childName}</h1>
            <p className="text-sm text-slate-600 mt-1">
              العمر عند الفحص: <strong>{formatAge(profile.ageMonths)}</strong> · فئة المقارنة: {profile.ageBandLabelAr}
            </p>
          </div>
          <dl className="text-xs text-slate-600 grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="font-bold">تاريخ الفحص</dt>
            <dd>{new Date(session.startedAt).toLocaleDateString('ar-EG')}</dd>
            <dt className="font-bold">الفاحص</dt>
            <dd>{session.examinerName || '—'}</dd>
            <dt className="font-bold">الاختبارات المكتملة</dt>
            <dd>{toArabicDigits(profile.subtests.length)} من ٩</dd>
          </dl>
        </header>

        {profile.ageOutOfRange && (
          <p className="flex gap-2 text-sm bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            عمر الطفل خارج المدى المصمَّم له الفحص (٤:٠–٨:١١)؛ قورنت النتائج بأقرب فئة عمرية، وتُفسَّر بحذر.
          </p>
        )}

        {/* Risk summary */}
        <section className="rounded-2xl border-2 p-5" style={{ borderColor: risk.color, backgroundColor: risk.bg }}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 rounded-full text-sm font-black text-white" style={{ backgroundColor: risk.color }}>
              {risk.labelAr}
            </span>
            {profile.pattern !== 'none' && <span className="text-sm font-black text-slate-800">{pattern.titleAr}</span>}
          </div>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-800">{risk.summaryAr}</p>
          {profile.pattern !== 'none' && <p className="mt-2 text-sm leading-relaxed text-slate-700">{pattern.textAr}</p>}
          <h3 className="mt-4 text-sm font-black text-slate-900">الخطوات التالية</h3>
          <ol className="mt-1 list-decimal pr-5 text-sm text-slate-800 space-y-1">
            {nextStepsAr(profile.risk, profile.pattern).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>

        {/* Graphical profile */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-slate-900">الملف المعرفي البياني</h2>
              <p className="text-xs text-slate-500 mt-1">
                موقع الطفل مقارنة بالمتوقع لعمره (مئين تقديري ١–٩٩؛ ٥٠ = متوسط العمر).
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-600">
              {(['severe', 'below', 'average', 'strength'] as const).map((b) => (
                <span key={b} className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: BAND_META[b].color }} />
                  {BAND_META[b].labelAr}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-5">
            {(Object.keys(DOMAINS) as Array<keyof typeof DOMAINS>).map((domainId) => {
              const domain = DOMAINS[domainId];
              const domainScore = profile.domains.find((d) => d.domain === domainId);
              const members = BATTERY.filter((s) => s.domain === domainId);
              return (
                <div key={domainId} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="font-black text-slate-900 flex items-center gap-2">
                      <span className="w-2.5 h-6 rounded-full" style={{ backgroundColor: domain.color }} />
                      {domain.nameAr}
                    </h3>
                    {domainScore && (
                      <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ color: BAND_META[domainScore.band].color, backgroundColor: BAND_META[domainScore.band].bg }}>
                        {BAND_META[domainScore.band].labelAr}
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {members.map((s) => {
                      const scored = scoredById.get(s.id);
                      return (
                        <div key={s.id} className="grid grid-cols-1 sm:grid-cols-[13rem_1fr] items-center gap-x-4 gap-y-1">
                          <div className="text-sm">
                            <span className="font-bold text-slate-800">{s.skillNameAr}</span>
                            <span className="text-slate-400 text-xs"> · {s.gameNameAr}</span>
                          </div>
                          {scored ? <CentileBar scored={scored} /> : <div className="text-xs text-slate-400">لم يُطبَّق بعد</div>}
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
            <h2 className="text-xl font-black text-slate-900">نقاط القوة وكيف نستثمرها</h2>
            <ul className="mt-3 space-y-2">
              {profile.strengths.map((id) => (
                <li key={id} className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-sm">
                  <strong className="text-sky-900">{SUBTESTS_BY_ID[id].skillNameAr}:</strong>{' '}
                  <span className="text-slate-700">{SUBTEST_GUIDANCE[id].strengthUseAr}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Weaknesses + strategies */}
        <section>
          <h2 className="text-xl font-black text-slate-900">جوانب الاحتياج والاستراتيجيات التعليمية</h2>
          {profile.weaknesses.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">لا توجد مهارة دون المتوقع لعمر الطفل في الاختبارات المكتملة.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {profile.weaknesses.map((id) => {
                const g = SUBTEST_GUIDANCE[id];
                const scored = scoredById.get(id) as ScoredSubtest;
                const open = openStrategy === id;
                return (
                  <div key={id} className="rounded-2xl border border-slate-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenStrategy(open ? null : id)}
                      className="w-full flex items-center justify-between gap-3 p-4 text-right bg-slate-50 cursor-pointer"
                      aria-expanded={open}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ color: BAND_META[scored.band].color, backgroundColor: BAND_META[scored.band].bg }}>
                          {BAND_META[scored.band].labelAr}
                        </span>
                        <span className="font-black text-slate-900">{SUBTESTS_BY_ID[id].skillNameAr}</span>
                      </span>
                      <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform no-print ${open ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`${open ? 'block' : 'hidden'} print:block p-4 space-y-3 text-sm leading-relaxed`}>
                      <p><strong>ماذا يقيس:</strong> {g.measuresAr}</p>
                      <p><strong>لماذا يهم للقراءة:</strong> {g.whyItMattersAr}</p>
                      <p><strong>ماذا تعني النتيجة:</strong> {g.weaknessMeaningAr}</p>
                      <div>
                        <strong>استراتيجيات للمعلم والأخصائي:</strong>
                        <ul className="list-disc pr-5 mt-1 space-y-1">
                          {g.strategiesAr.map((s) => <li key={s}>{s}</li>)}
                        </ul>
                      </div>
                      <div>
                        <strong>أنشطة منزلية للأسرة:</strong>
                        <ul className="list-disc pr-5 mt-1 space-y-1">
                          {g.homeActivitiesAr.map((s) => <li key={s}>{s}</li>)}
                        </ul>
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
          <h2 className="text-xl font-black text-slate-900">جدول الدرجات للأخصائي</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[560px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="p-2 text-right">الاختبار</th>
                  <th className="p-2">الخام</th>
                  <th className="p-2">النسبة</th>
                  <th className="p-2">z</th>
                  <th className="p-2">المئين التقديري</th>
                  <th className="p-2">وسيط زمن الاستجابة</th>
                  <th className="p-2">التصنيف</th>
                </tr>
              </thead>
              <tbody>
                {profile.subtests.map((s) => (
                  <tr key={s.subtestId} className="border-b border-slate-100 text-center">
                    <td className="p-2 text-right font-bold">{SUBTESTS_BY_ID[s.subtestId].skillNameAr}</td>
                    <td className="p-2">{toArabicDigits(`${s.correct}/${s.total}`)}</td>
                    <td className="p-2">{toArabicDigits(s.percent)}٪</td>
                    <td className="p-2" dir="ltr">{s.z.toFixed(2)}</td>
                    <td className="p-2">{toArabicDigits(s.centile)}</td>
                    <td className="p-2">{s.medianRtMs ? `${toArabicDigits((s.medianRtMs / 1000).toFixed(1))} ث` : '—'}</td>
                    <td className="p-2 font-bold" style={{ color: BAND_META[s.band].color }}>{BAND_META[s.band].labelAr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {flagged.length > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
              <p className="font-black">ملاحظات صلاحية التطبيق:</p>
              {flagged.map((s) => (
                <p key={s.subtestId}>
                  <strong>{SUBTESTS_BY_ID[s.subtestId].skillNameAr}:</strong> {s.flags.map((f) => FLAG_TEXT_AR[f]).join(' ')}
                </p>
              ))}
            </div>
          )}
        </section>

        {/* Method note */}
        <section className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs leading-relaxed text-slate-600 space-y-2">
          <p className="flex items-center gap-1.5 font-black text-slate-800"><Info className="w-4 h-4" /> عن المقارنة العمرية وحدود التفسير</p>
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
      </article>
    </div>
  );
}

export default ProfileReportView;
