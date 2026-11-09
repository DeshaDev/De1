import React from 'react';

/**
 * هَيَّا نَقْرَأْ — Professional Brand Icon:
 * An iconic, flowing brand symbol featuring soaring book pages taking flight
 * as wings of knowledge, crowned with a radiant golden discovery star,
 * on a clean, modern transparent background (no heavy solid boxes).
 */
export function BrandMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ flex: '0 0 auto', overflow: 'visible' }}
    >
      <defs>
        {/* Left Wing Page Gradient: Cyan to Emerald */}
        <linearGradient id="hn-page-left" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="60%" stopColor="#0D9488" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        {/* Right Wing Page Gradient: Teal to Deep Emerald */}
        <linearGradient id="hn-page-right" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>

        {/* Back Page Glow / Dimension Layer */}
        <linearGradient id="hn-page-back" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#34D399" stopOpacity="0.5" />
        </linearGradient>

        {/* Golden Sun & Knowledge Star Gradient */}
        <linearGradient id="hn-star-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Drop Shadow for Layer Depth */}
        <filter id="hn-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0F172A" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* Dynamic Uplifting Foundation Smile (قوس البهجة «هَيَّا») */}
      <path
        d="M14 49 C22 55, 42 55, 50 49"
        stroke="#F59E0B"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Back Layer Pages (Flight Depth) */}
      <path
        d="M32 43 C20 35, 10 38, 6 45 C8 33, 17 23, 32 26 Z"
        fill="url(#hn-page-back)"
      />
      <path
        d="M32 43 C44 35, 54 38, 58 45 C56 33, 47 23, 32 26 Z"
        fill="url(#hn-page-back)"
      />

      {/* Main Front Wings / Open Book Pages (Wings of Reading) */}
      <g filter="url(#hn-shadow)">
        {/* Left Wing (Soaring upward) */}
        <path
          d="M32 44 C22 36, 13 38, 8 45 C11 31, 21 21, 32 24 Z"
          fill="url(#hn-page-left)"
        />

        {/* Right Wing */}
        <path
          d="M32 44 C42 36, 51 38, 56 45 C53 31, 43 21, 32 24 Z"
          fill="url(#hn-page-right)"
        />

        {/* Central Spine Light / Book Fold */}
        <path
          d="M32 24 V44"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>

      {/* Little Knowledge Sparks */}
      <circle cx="20" cy="18" r="1.8" fill="#FBBF24" />
      <circle cx="44" cy="18" r="1.8" fill="#FBBF24" />

      {/* Radiant Golden Star of Discovery (North Star of Reading) */}
      <path
        d="M32 5 C32.8 11, 35.5 13.8, 41 14.5 C35.5 15.2, 32.8 18, 32 24 C31.2 18, 28.5 15.2, 23 14.5 C28.5 13.8, 31.2 11, 32 5 Z"
        fill="url(#hn-star-glow)"
      />
      <circle cx="32" cy="14.5" r="2.2" fill="#FFFBEB" />
    </svg>
  );
}

/**
 * هَيَّا نَقْرَأْ — Brand Lockup (Logo + Arabic Typography):
 * Clean, modern, high-contrast typography with accurate diacritics
 * and transparent background integration.
 */
export function BrandLockup({ tagline = true }: { tagline?: boolean }) {
  return (
    <div className="inline-flex items-center gap-3 select-none">
      <BrandMark size={42} />
      <div className="flex flex-col text-right leading-none">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-extrabold text-[1.4rem] tracking-tight text-teal-700 font-['Noto_Sans_Arabic','Readex_Pro',sans-serif]">
            هَيَّا
          </span>
          <span className="font-extrabold text-[1.4rem] tracking-tight text-slate-900 font-['Noto_Sans_Arabic','Readex_Pro',sans-serif]">
            نَقْرَأْ
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.68rem] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs mr-1">
            النسخة الحديثة v2
          </span>
        </div>
        {tagline && (
          <span className="hidden sm:block text-[0.68rem] font-bold text-slate-500 tracking-normal mt-0.5 whitespace-nowrap">
            فحص مبكر وتدريب ممتع للقراءة
          </span>
        )}
      </div>
    </div>
  );
}

export default BrandMark;
