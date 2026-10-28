import React from 'react';
import { ArrowLeft, Brain } from 'lucide-react';
import type { StudentRecord } from '../../data/seedData';
import { DOMAINS, SUBTESTS_BY_ID, type DomainId } from '../../cognitiveProfile/battery';
import { BAND_META } from '../../cognitiveProfile/scoring';
import { PATTERN_META, RISK_META } from '../../cognitiveProfile/guidance';
import { CentileTrack } from './CentileTrack';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/** Compact risk badge for tables. */
export function BatteryRiskBadge({ student }: { student: StudentRecord }) {
  const summary = student.cognitiveBattery?.summary;
  if (!summary) return <span className="bz-small bz-muted">لم يُفحص بعد</span>;
  const risk = RISK_META[summary.risk];
  return (
    <span className="bz-badge" style={{ color: risk.color, backgroundColor: risk.bg }}>
      {risk.labelAr} · {ar(summary.completedSubtests)}/٩
    </span>
  );
}

/** Summary of the cognitive battery stored in the school record. */
export function BatterySummaryPanel({ student, onOpen }: { student: StudentRecord; onOpen: () => void }) {
  const stored = student.cognitiveBattery;
  const summary = stored?.summary;

  if (!summary) {
    return (
      <section className="bz-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-soft text-brand shrink-0"><Brain size={22} aria-hidden="true" /></span>
          <div>
            <h2 className="bz-h3">الفحص المعرفي الشامل</h2>
            <p className="bz-small text-ink-2 mt-1">لم تُحفظ نتائج فحص لهذا الطالب في سجل المدرسة بعد.</p>
          </div>
        </div>
        <button type="button" className="bz-btn bz-btn-primary" onClick={onOpen}>
          ابدأ الفحص <ArrowLeft size={16} aria-hidden="true" />
        </button>
      </section>
    );
  }

  const risk = RISK_META[summary.risk];
  const updated = Number.isFinite(Date.parse(stored!.updatedAt))
    ? new Date(stored!.updatedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <section className="bz-card overflow-hidden" aria-labelledby={`battery-summary-${student.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-line">
        <div>
          <p className="bz-small text-brand font-semibold">الفحص المعرفي الشامل · آخر تحديث {updated}</p>
          <h2 id={`battery-summary-${student.id}`} className="bz-h3 mt-1">
            {ar(summary.completedSubtests)} من ٩ اختبارات · {summary.ageBandLabelAr}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="bz-badge" style={{ color: '#FFFFFF', backgroundColor: risk.color }}>{risk.labelAr}</span>
          {summary.pattern !== 'none' && <span className="bz-badge bz-badge-neutral">{PATTERN_META[summary.pattern].titleAr}</span>}
        </div>
      </div>
      <div className="px-6 py-5 grid lg:grid-cols-[1.3fr_1fr] gap-6">
        <div className="space-y-3">
          {summary.domains.map((d) => (
            <div key={d.domain} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-3">
              <span className="bz-small font-semibold text-ink truncate">{DOMAINS[d.domain as DomainId]?.nameAr ?? d.domain}</span>
              <CentileTrack centile={d.centile} size="sm" label={DOMAINS[d.domain as DomainId]?.nameAr} />
            </div>
          ))}
        </div>
        <div>
          <p className="bz-small font-semibold text-ink">جوانب الاحتياج</p>
          {summary.weaknesses.length === 0 ? (
            <p className="bz-small text-ink-2 mt-1">لا توجد مهارة دون المتوقع لعمره.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {summary.weaknesses.map((id) => {
                const sub = summary.subtests.find((x) => x.subtestId === id);
                return (
                  <li key={id} className="flex items-center justify-between gap-2 bz-small">
                    <span className="text-ink-2">{SUBTESTS_BY_ID[id].skillNameAr}</span>
                    {sub && <span className="bz-badge" style={{ color: BAND_META[sub.band].color, backgroundColor: BAND_META[sub.band].bg }}>المئين {ar(sub.centile)}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" className="bz-btn bz-btn-secondary bz-btn-sm mt-4" onClick={onOpen}>
            فتح التقرير الكامل <ArrowLeft size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      {summary.referenceStatus === 'provisional' && (
        <p className="px-6 py-3 bg-soft border-t border-line text-[13px] text-muted">
          المئينات تقديرية مقابل جدول مرجعي مؤقت ({summary.referenceVersion})؛ تُستخدم للفرز وتوجيه التدريب، لا للتشخيص.
        </p>
      )}
    </section>
  );
}

export default BatterySummaryPanel;
