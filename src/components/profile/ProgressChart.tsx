import React from 'react';
import { probePercent, type ProbeRecord } from '../../cognitiveProfile/progressProbe';
import { SKILLS } from '../../cognitiveProfile/training';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/**
 * Probe score per session: trained skills (solid) and the untrained comparison skill (dashed).
 * Each point is one session; the chart is read as a trend, not day by day.
 */
export function ProgressChart({ probes, height = 180 }: { probes: ProbeRecord[]; height?: number }) {
  const sorted = [...probes].sort((a, b) => a.session - b.session);
  if (sorted.length === 0) return null;
  const width = 560;
  const pad = { top: 14, right: 16, bottom: 26, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxSession = Math.max(5, sorted[sorted.length - 1].session);
  const x = (session: number) => pad.left + ((session - 1) / Math.max(1, maxSession - 1)) * innerW;
  const y = (pct: number) => pad.top + (1 - pct / 100) * innerH;
  const trained = sorted.map((p) => [x(p.session), y(probePercent(p))] as const);
  const comparison = sorted.filter((p) => p.comparison).map((p) => [x(p.session), y(probePercent(p.comparison!))] as const);
  const path = (pts: ReadonlyArray<readonly [number, number]>) => pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const comparisonSkill = sorted.find((p) => p.comparison)?.comparison?.skill;
  const ticks = [0, 50, 100];
  const sessionTicks = Array.from(new Set([1, Math.ceil(maxSession / 2), maxSession]));

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`نتيجة مقياس التقدّم في ${ar(sorted.length)} جلسة: من ${ar(probePercent(sorted[0]))}٪ إلى ${ar(probePercent(sorted[sorted.length - 1]))}٪`}
        className="w-full h-auto"
        style={{ direction: 'ltr' }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-2)">{ar(t)}٪</text>
          </g>
        ))}
        {sessionTicks.map((s) => (
          <text key={s} x={x(s)} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--ink-2)">{ar(s)}</text>
        ))}
        {comparison.length > 0 && (
          <path d={path(comparison)} fill="none" stroke="var(--ink-2)" strokeWidth={2} strokeDasharray="5 5" opacity={0.6} />
        )}
        <path d={path(trained)} fill="none" stroke="var(--brand)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {trained.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={4} fill="var(--brand)" />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2 mt-1">
        <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-[3px] rounded bg-brand" aria-hidden="true" /> المهارات المدرَّبة</span>
        {comparisonSkill && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-ink-2 opacity-60" aria-hidden="true" /> للمقارنة: {SKILLS[comparisonSkill].nameAr} (غير مدرَّبة)
          </span>
        )}
        <span>المحور الأفقي: رقم الجلسة</span>
      </figcaption>
    </figure>
  );
}

export default ProgressChart;
