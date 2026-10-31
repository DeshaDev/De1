import React from 'react';

/**
 * هَيَّا نَقْرَأْ Logo:
 * An iconic, professional brandmark featuring an open soaring book whose pages
 * take flight like wings of knowledge, crowned with a radiant golden discovery star,
 * symbolizing curiosity, joyful literacy, and cognitive growth.
 */
export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ flex: '0 0 auto' }}
    >
      <defs>
        {/* Modern Educational Gradient */}
        <linearGradient id="hn-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0D9488" />
          <stop offset="50%" stopColor="#0F766E" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>

        {/* Golden Sun & Star Glow */}
        <linearGradient id="hn-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        {/* Soft Wing Shadow */}
        <filter id="hn-soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Rounded Squircle Container */}
      <rect width="64" height="64" rx="18" fill="url(#hn-bg-grad)" />

      {/* Subtle Inner Rim Highlight */}
      <rect x="1" y="1" width="62" height="62" rx="17" fill="none" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="1.5" />

      {/* Uplifting Foundation Smile / Energy Arc */}
      <path
        d="M18 48C24 51.5 40 51.5 46 48"
        stroke="#FCD34D"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />

      {/* Soaring Open Book Pages (Wings of Reading) */}
      <g filter="url(#hn-soft-shadow)">
        {/* Left Page */}
        <path
          d="M32 44C25 39 18 39.5 13 43C13.5 35 19 28 32 30V44Z"
          fill="#FFFFFF"
          fillOpacity="0.95"
        />
        {/* Right Page */}
        <path
          d="M32 44C39 39 46 39.5 51 43C50.5 35 45 28 32 30V44Z"
          fill="#FFFFFF"
        />
        {/* Page Center Fold */}
        <path
          d="M32 30V44"
          stroke="#0D9488"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>

      {/* Central Knowledge Beacon / Radiant 4-Point Star */}
      <path
        d="M32 11C32.8 15 35 17.2 39 18C35 18.8 32.8 21 32 25C31.2 21 29 18.8 25 18C29 17.2 31.2 15 32 11Z"
        fill="url(#hn-gold-grad)"
      />
      {/* Central Star Core */}
      <circle cx="32" cy="18" r="2" fill="#FFFBEB" />
    </svg>
  );
}

export function BrandLockup({ tagline = true }: { tagline?: boolean }) {
  return (
    <>
      <BrandMark size={38} />
      <span className="baseera-brand-copy">
        <strong className="tracking-tight text-slate-900 font-extrabold text-[1.15rem]">هَيَّا نَقْرَأْ</strong>
        {tagline && <small className="text-slate-500 font-medium text-[0.72rem]">فحص مبكر وتدريب ممتع للقراءة</small>}
      </span>
    </>
  );
}

export default BrandMark;
