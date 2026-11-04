import React from 'react';
import { ArrowLeft, Brain } from 'lucide-react';
import type { StudentRecord } from '../../data/seedData';
import { SUBTESTS_BY_ID } from '../../cognitiveProfile/battery';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/** Completion indicator only; the current screening reference values are not normed. */
export function BatteryRiskBadge({ student }: { student: StudentRecord }) {
  const summary = student.cognitiveBattery?.summary;
  if (!summary) return <span className="bz-small bz-muted">لم يُفحص بعد</span>;
  return <span className="bz-badge bz-badge-neutral">نتائج وصفية · {ar(summary.completedSubtests)}/٩</span>;
}

/** Task-level performance summary. It intentionally omits provisional centiles and risk bands. */
export function BatterySummaryPanel({ student, onOpen }: { student: StudentRecord; onOpen: () => void }) {
  const stored = student.cognitiveBattery;
  const summary = stored?.summary;

  if (!summary) {
    return (
      <section className="bz-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-soft text-brand shrink-0"><Brain size={22} aria-hidden="true" /></span>
          <div>
            <h2 className="bz-h3">فحص مؤشرات عسر القراءة</h2>
            <p className="bz-small text-ink-2 mt-1">لم تُحفظ نتائج فحص لهذا الطالب في سجل المدرسة بعد.</p>
          </div>
        </div>
        <button type="button" className="bz-btn bz-btn-primary" onClick={onOpen}>
          ابدأ الفحص <ArrowLeft size={16} aria-hidden="true" />
        </button>
      </section>
    );
  }

  const updated = Number.isFinite(Date.parse(stored!.updatedAt))
    ? new Date(stored!.updatedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <section className="bz-card overflow-hidden" aria-labelledby={`battery-summary-${student.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-line">
        <div>
          <p className="bz-small text-brand font-semibold">نتائج وصفية · آخر تحديث {updated}</p>
          <h2 id={`battery-summary-${student.id}`} className="bz-h3 mt-1">
            أُكملت {ar(summary.completedSubtests)} من ٩ مهام
          </h2>
        </div>
        <span className="bz-badge bz-badge-neutral">لا توجد مقارنة معيارية</span>
      </div>
      <div className="px-6 py-5">
        <ul className="grid sm:grid-cols-2 gap-3">
          {summary.subtests.map((scored) => (
            <li key={scored.subtestId} className="rounded-xl border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="bz-small font-semibold text-ink">{SUBTESTS_BY_ID[scored.subtestId].skillNameAr}</span>
                <strong className="bz-small bz-num text-ink">{ar(scored.percent)}٪</strong>
              </div>
              <p className="bz-small text-ink-2 mt-1">إجابات صحيحة داخل المهمة فقط</p>
            </li>
          ))}
        </ul>
        <p className="bz-small text-ink-2 mt-4">
          النسبة تصف الأداء في المهمة المعروضة فقط. لا تمثل مئينًا أو مقارنة بالأقران أو مؤشرًا لوجود عسر القراءة.
        </p>
        <button type="button" className="bz-btn bz-btn-secondary bz-btn-sm mt-4" onClick={onOpen}>
          فتح التقرير الكامل <ArrowLeft size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export default BatterySummaryPanel;
