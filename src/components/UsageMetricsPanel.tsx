import React, { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { authenticatedFetch } from '../utils/apiAuth';
import type { UsageSummary } from '../utils/usageMetrics';
import { SUBTESTS_BY_ID } from '../cognitiveProfile/battery';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const RANGES = [7, 30, 90] as const;

function downloadCsv(summary: UsageSummary) {
  const rows = [
    ['date', 'visits', 'devices', 'batteries_completed', 'training_sessions'],
    ...summary.daily.map((d) => [d.date, d.visits, d.devices, d.batteriesCompleted, d.trainingSessions]),
  ];
  const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `baseera-usage-${summary.rangeDays}d.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function UsageMetricsPanel() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authenticatedFetch(`/api/admin/metrics?days=${days}`);
      if (!res.ok) throw new Error();
      setSummary(((await res.json()) as { summary: UsageSummary }).summary);
    } catch {
      setError('تعذّر تحميل مؤشرات الاستخدام.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [days]);

  const t = summary?.totals;
  const funnel = t
    ? [
        { label: 'زيارات', value: t.visit },
        { label: 'بدء الفحص', value: t.battery_started },
        { label: 'إكمال الألعاب التسع', value: t.battery_completed },
        { label: 'عرض التقرير', value: t.report_viewed },
        { label: 'بدء البرنامج التدريبي', value: t.training_started },
      ]
    : [];
  const max = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <section className="space-y-5" aria-labelledby="usage-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="usage-title" className="bz-h3" style={{ fontSize: 22 }}>مؤشرات الاستخدام</h2>
          <p className="bz-small bz-muted mt-1">أعداد مجهولة الهوية: لا أسماء ولا معرّفات طلاب ولا إجابات.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="bz-segment" role="group" aria-label="الفترة">
            {RANGES.map((r) => (
              <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}>
                آخر {ar(r)} يومًا
              </button>
            ))}
          </div>
          <button type="button" className="bz-icon-btn" onClick={() => void load()} aria-label="تحديث">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {summary && (
            <button type="button" className="bz-btn bz-btn-secondary bz-btn-sm" onClick={() => downloadCsv(summary)}>
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl p-3 bg-risk-soft text-risk bz-small font-semibold">{error}</p>}

      {summary && t && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { k: summary.uniqueDevices, v: 'أجهزة مستخدمة' },
              { k: t.battery_started, v: 'فحوص بدأت' },
              { k: summary.completionRate === null ? '—' : `${ar(summary.completionRate)}٪`, v: 'نسبة إكمال الفحص' },
              { k: t.training_session_completed, v: 'جلسات تدريب مكتملة' },
            ].map((tile) => (
              <div key={tile.v} className="bz-card p-5">
                <p className="font-display font-bold text-ink text-3xl bz-num">{typeof tile.k === 'number' ? ar(tile.k) : tile.k}</p>
                <p className="bz-small bz-muted mt-1">{tile.v}</p>
              </div>
            ))}
          </div>

          <div className="bz-card p-6">
            <h3 className="font-semibold text-ink">رحلة الاستخدام</h3>
            <ol className="mt-4 space-y-3">
              {funnel.map((step, i) => {
                const prev = i > 0 ? funnel[i - 1].value : null;
                const rate = prev ? Math.round((step.value / prev) * 100) : null;
                const tip = `${step.label}: ${step.value}${rate !== null ? ` (${rate}% من الخطوة السابقة)` : ''}`;
                return (
                  <li key={step.label} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3" title={tip}>
                    <span className="bz-small text-ink-2">{step.label}</span>
                    <span className="h-7 rounded-md bg-soft overflow-hidden">
                      <span
                        className="block h-full rounded-md"
                        style={{ width: `${Math.max(step.value > 0 ? 2 : 0, (step.value / max) * 100)}%`, background: 'var(--brand)' }}
                      />
                    </span>
                    <span className="bz-small text-ink font-semibold bz-num min-w-[6.5rem] text-left">
                      {ar(step.value)}
                      {rate !== null && <span className="bz-muted font-normal"> · {ar(rate)}٪</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="bz-card overflow-hidden">
            <h3 className="font-semibold text-ink px-6 pt-5">إكمال كل لعبة</h3>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="bg-soft text-ink-2">
                    <th className="px-6 py-2.5 text-right font-semibold">اللعبة</th>
                    <th className="px-3 py-2.5 font-semibold">مرات الإكمال</th>
                    <th className="px-3 py-2.5 font-semibold">توقّف بقاعدة الإيقاف</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.subtests.map((s) => (
                    <tr key={s.subtestId} className="border-t border-line text-center bz-num">
                      <td className="px-6 py-2.5 text-right text-ink">{SUBTESTS_BY_ID[s.subtestId].gameNameAr}</td>
                      <td className="px-3 py-2.5">{ar(s.completed)}</td>
                      <td className="px-3 py-2.5">{s.discontinuedRate === null ? '—' : `${ar(s.discontinuedRate)}٪`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default UsageMetricsPanel;
