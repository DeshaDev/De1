import React from 'react';

/**
 * Baseera mark: an open book whose spine rises into a point of light —
 * "insight" (بصيرة) growing out of reading.
 */
export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
      style={{ flex: '0 0 auto' }}
    >
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <path d="M12 38c6.5-9 13.3-13.5 20-13.5S45.5 29 52 38" fill="none" stroke="var(--on-brand)" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 24.5V49" stroke="var(--on-brand)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="15" r="5.5" fill="var(--sun)" />
    </svg>
  );
}

export function BrandLockup({ tagline = true }: { tagline?: boolean }) {
  return (
    <>
      <BrandMark />
      <span className="baseera-brand-copy">
        <strong>بصيرة</strong>
        {tagline && <small>فحص مبكر وتدريب موجّه للقراءة</small>}
      </span>
    </>
  );
}

export default BrandMark;
