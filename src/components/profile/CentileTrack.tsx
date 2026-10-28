import React from 'react';

export type BandId = 'severe' | 'below' | 'average' | 'strength';

export const BAND_META: Record<BandId, { labelAr: string; badge: string; dot: string }> = {
  severe: { labelAr: 'ضعف واضح', badge: 'bz-badge bz-badge-risk', dot: 'var(--risk)' },
  below: { labelAr: 'دون المتوقع', badge: 'bz-badge bz-badge-warn', dot: 'var(--warn)' },
  average: { labelAr: 'ضمن المتوقع', badge: 'bz-badge bz-badge-neutral', dot: 'var(--ink-2)' },
  strength: { labelAr: 'نقطة قوة', badge: 'bz-badge bz-badge-brand', dot: 'var(--brand)' },
};

export function bandOf(centile: number): BandId {
  if (centile <= 5) return 'severe';
  if (centile <= 20) return 'below';
  if (centile >= 80) return 'strength';
  return 'average';
}

const toArabicDigits = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/**
 * A horizontal 1–99 centile scale with the four interpretation bands shaded.
 * Low centiles sit at the start of the reading direction (right in Arabic).
 */
export function CentileTrack({
  centile,
  label,
  size = 'md',
}: {
  centile: number | null;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const h = size === 'sm' ? 10 : 14;
  const dot = size === 'sm' ? 16 : 22;
  const band = centile === null ? null : bandOf(centile);
  return (
    <div
      className="relative w-full"
      style={{ height: dot + 4 }}
      role={centile === null ? undefined : 'img'}
      aria-label={centile === null ? undefined : `${label ?? ''} المئين ${centile}`}
    >
      <div
        className="absolute inset-x-0 overflow-hidden rounded-full"
        style={{ top: (dot + 4 - h) / 2, height: h, background: 'var(--soft)' }}
        aria-hidden="true"
      >
        <span className="absolute inset-y-0" style={{ insetInlineStart: 0, width: '5%', background: 'color-mix(in srgb, var(--risk) 24%, var(--card))' }} />
        <span className="absolute inset-y-0" style={{ insetInlineStart: '5%', width: '15%', background: 'color-mix(in srgb, var(--warn) 16%, var(--card))' }} />
        <span className="absolute inset-y-0" style={{ insetInlineStart: '80%', width: '20%', background: 'color-mix(in srgb, var(--brand) 18%, var(--card))' }} />
        <span className="absolute inset-y-0" style={{ insetInlineStart: '50%', width: 2, background: 'var(--line-strong)' }} />
      </div>
      {centile !== null && band && (
        <span
          className="absolute grid place-items-center rounded-full text-[11px] font-bold bz-num"
          style={{
            top: 2,
            width: dot,
            height: dot,
            insetInlineStart: `clamp(0px, calc(${Math.min(99, Math.max(1, centile))}% - ${dot / 2}px), calc(100% - ${dot}px))`,
            background: BAND_META[band].dot,
            color: 'var(--card)',
            boxShadow: '0 0 0 3px var(--card)',
            fontSize: size === 'sm' ? 0 : 10,
          }}
          aria-hidden="true"
        >
          {size === 'md' ? toArabicDigits(centile) : null}
        </span>
      )}
    </div>
  );
}

export function BandLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bz-small bz-muted">
      {(['severe', 'below', 'average', 'strength'] as BandId[]).map((b) => (
        <span key={b} className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: BAND_META[b].dot }} aria-hidden="true" />
          {BAND_META[b].labelAr}
        </span>
      ))}
    </div>
  );
}

export default CentileTrack;
