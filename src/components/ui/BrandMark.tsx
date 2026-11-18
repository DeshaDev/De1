import React from 'react';

/**
 * هَيَّا نَقْرَأْ — Official Brand Emblem:
 * Two children reading beneath a flourishing tree growing out of an open book.
 */
export function BrandMark({ size = 44, className = '' }: { size?: number; className?: string }) {
  const width = Math.round(size * 1.28);
  return (
    <img
      src="/logo-mark.png"
      alt=""
      aria-hidden="true"
      width={width}
      height={size}
      className={`object-contain shrink-0 ${className}`.trim()}
      style={{ height: size, width: 'auto' }}
    />
  );
}

/**
 * هَيَّا نَقْرَأْ — Brand Lockup:
 * Official emblem + crisp Arabic wordmark with the single tagline «تنمية مهارات القراءة».
 */
export function BrandLockup({ tagline = true }: { tagline?: boolean }) {
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <BrandMark size={46} />
      <div className="flex flex-col text-right leading-tight">
        <span className="font-extrabold text-[1.45rem] tracking-tight text-[#0B304F] font-['Noto_Sans_Arabic','Readex_Pro',sans-serif] leading-none">
          هَيَّا نَقْرَأْ
        </span>
        {tagline && (
          <span className="text-[0.72rem] font-bold text-emerald-700 mt-1 whitespace-nowrap">
            تنمية مهارات القراءة
          </span>
        )}
      </div>
    </div>
  );
}

export default BrandMark;
