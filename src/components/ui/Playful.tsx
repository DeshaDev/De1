/**
 * The playful layer of «هَيَّا نَقْرَأْ»: toy letter blocks, clouds, sparkles, a hero scene with the
 * mascot, wave dividers and a colourful page header.
 *
 * Rule: joyful edges, calm centre (docs/JOYFUL_DESIGN_AR.md).
 * - Decoration lives in page frames, headers and between-task screens, never behind or beside text
 *   a child is reading or an item they are answering. Heavily decorated surroundings pull young
 *   children's attention away from the task and lower learning (Fisher, Godwin & Seltman, 2014),
 *   and in real classrooms children did not get used to it over a term (Godwin et al., 2022).
 * - Everything here is decorative: aria-hidden, no pointer events, hidden in print and while a
 *   child is in a game or session (body.baseera-reading-focus), and static (no looping motion).
 */
import React from 'react';
import { Mascot, type MascotMood } from './Mascot';

export type JoyColor = 'sun' | 'coral' | 'sky' | 'leaf' | 'grape' | 'brand';

const FILL: Record<JoyColor, { face: string; side: string }> = {
  sun: { face: 'var(--joy-sun)', side: 'var(--joy-sun-deep)' },
  coral: { face: 'var(--joy-coral)', side: 'var(--joy-coral-deep)' },
  sky: { face: 'var(--joy-sky)', side: 'var(--joy-sky-deep)' },
  leaf: { face: 'var(--joy-leaf)', side: 'var(--joy-leaf-deep)' },
  grape: { face: 'var(--joy-grape)', side: 'var(--joy-grape-deep)' },
  brand: { face: 'var(--brand)', side: 'var(--brand-strong)' },
};

/** A toy alphabet block with an Arabic letter. */
export function LetterBlock({ letter, color = 'sun', size = 56, rotate = 0, className = '', style }: { letter: string; color?: JoyColor; size?: number; rotate?: number; className?: string; style?: React.CSSProperties }) {
  const f = FILL[color];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={{ transform: `rotate(${rotate}deg)`, ...style }} aria-hidden="true" focusable="false">
      <rect x="4" y="10" width="54" height="50" rx="12" fill={f.side} />
      <rect x="4" y="4" width="54" height="50" rx="12" fill={f.face} />
      <rect x="10" y="10" width="42" height="38" rx="8" fill="#FFFFFF" opacity="0.92" />
      <text x="31" y="38" textAnchor="middle" fontSize="28" fontWeight="800" fill={f.side} fontFamily="'Baloo Bhaijaan 2', 'Noto Sans Arabic', sans-serif">
        {letter}
      </text>
    </svg>
  );
}

export function Cloud({ width = 120, className = '', style }: { width?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={width} height={width * 0.55} viewBox="0 0 120 66" className={className} style={style} aria-hidden="true" focusable="false">
      <path d="M28 62 C10 62 4 48 14 38 C10 22 30 14 40 24 C46 6 76 4 82 24 C98 18 112 30 104 44 C116 50 110 62 96 62 Z" fill="var(--joy-cloud)" />
    </svg>
  );
}

export function Sparkle({ size = 22, color = 'sun', className = '', style }: { size?: number; color?: JoyColor; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden="true" focusable="false">
      <path d="M12 1 L14.6 9.4 L23 12 L14.6 14.6 L12 23 L9.4 14.6 L1 12 L9.4 9.4 Z" fill={FILL[color].face} />
    </svg>
  );
}

export function Dot({ size = 12, color = 'coral', className = '', style }: { size?: number; color?: JoyColor; className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden="true" className={`inline-block rounded-full ${className}`} style={{ width: size, height: size, background: FILL[color].face, ...style }} />;
}

/** A soft wave between two page sections. `fill` is the colour of the section below. */
export function WaveDivider({ fill = 'var(--paper)', flip = false, className = '' }: { fill?: string; flip?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className={`joy-decor block w-full h-8 sm:h-12 ${className}`} style={flip ? { transform: 'scaleY(-1)' } : undefined} aria-hidden="true" focusable="false">
      <path d="M0 30 C 180 60, 360 0, 540 24 C 720 48, 900 6, 1080 26 C 1260 46, 1350 22, 1440 30 L1440 60 L0 60 Z" fill={fill} />
    </svg>
  );
}

/** The home page scene: the mascot on an open book, with letter blocks, a rainbow and clouds. */
export function HeroScene({ message }: { message?: string }) {
  return (
    <div className="joy-decor relative mx-auto w-full max-w-[520px] aspect-[1.05]" aria-hidden={message ? undefined : true}>
      {/* Soft sun disc and rainbow */}
      <div className="absolute inset-[6%] rounded-full" style={{ background: 'radial-gradient(circle at 50% 45%, var(--joy-sun-soft) 0%, var(--joy-peach) 55%, transparent 72%)' }} />
      <svg viewBox="0 0 400 220" className="absolute left-[6%] right-[6%] top-[14%] w-[88%]" aria-hidden="true" focusable="false">
        {[
          ['var(--joy-coral)', 180],
          ['var(--joy-sun)', 160],
          ['var(--joy-leaf)', 140],
          ['var(--joy-sky)', 120],
          ['var(--joy-grape)', 100],
        ].map(([c, r]) => (
          <path key={String(r)} d={`M ${200 - Number(r)} 210 A ${r} ${r} 0 0 1 ${200 + Number(r)} 210`} fill="none" stroke={String(c)} strokeWidth="14" strokeLinecap="round" opacity="0.85" />
        ))}
      </svg>
      <Cloud width={110} className="absolute top-[8%] right-[2%]" />
      <Cloud width={84} className="absolute top-[24%] left-[0%]" />
      <Sparkle size={26} color="sun" className="absolute top-[4%] left-[22%]" />
      <Sparkle size={18} color="coral" className="absolute top-[40%] right-[4%]" />
      <Sparkle size={16} color="sky" className="absolute top-[52%] left-[6%]" />

      {/* Open book */}
      <svg viewBox="0 0 360 120" className="absolute bottom-[4%] left-[8%] w-[84%]" aria-hidden="true" focusable="false">
        <ellipse cx="180" cy="112" rx="160" ry="8" fill="#000" opacity="0.07" />
        <path d="M180 30 C 130 8, 60 8, 14 22 L14 104 C 60 92, 130 92, 180 110 Z" fill="var(--card)" stroke="var(--joy-sky-deep)" strokeWidth="5" strokeLinejoin="round" />
        <path d="M180 30 C 230 8, 300 8, 346 22 L346 104 C 300 92, 230 92, 180 110 Z" fill="var(--card)" stroke="var(--joy-sky-deep)" strokeWidth="5" strokeLinejoin="round" />
        {[40, 56, 72].map((y) => (
          <g key={y} stroke="var(--line-strong)" strokeWidth="5" strokeLinecap="round">
            <path d={`M44 ${y} C 90 ${y - 8}, 130 ${y - 6}, 160 ${y + 4}`} fill="none" />
            <path d={`M316 ${y} C 270 ${y - 8}, 230 ${y - 6}, 200 ${y + 4}`} fill="none" />
          </g>
        ))}
      </svg>

      {/* Letter blocks */}
      <LetterBlock letter="ب" color="coral" size={64} rotate={-10} className="absolute bottom-[26%] right-[6%]" />
      <LetterBlock letter="ق" color="sky" size={54} rotate={8} className="absolute bottom-[38%] right-[20%]" />
      <LetterBlock letter="ر" color="leaf" size={58} rotate={-6} className="absolute bottom-[26%] left-[5%]" />
      <LetterBlock letter="أ" color="grape" size={50} rotate={12} className="absolute bottom-[42%] left-[17%]" />

      {/* The mascot reading on the book */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[15%] w-[42%]">
        <Mascot mood="wave" size={200} className="w-full h-auto" label={message ? undefined : 'هُدهُد'} />
      </div>
      {message && (
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[82%] max-w-[22rem]">
          <p className="mascot-bubble mascot-bubble-down font-child" role="note">
            {message}
          </p>
        </div>
      )}
    </div>
  );
}

/** Decoration for the edges of a page section (corners only, never behind text). */
export function JoyCorners({ variant = 'a' }: { variant?: 'a' | 'b' | 'c' }) {
  const sets = {
    a: (
      <>
        <LetterBlock letter="ح" color="sun" size={46} rotate={-12} className="absolute top-4 left-4 opacity-90" />
        <Sparkle size={18} color="coral" className="absolute top-16 left-16" />
        <Cloud width={90} className="absolute bottom-3 right-3 opacity-90" />
      </>
    ),
    b: (
      <>
        <Cloud width={96} className="absolute top-3 left-3" />
        <LetterBlock letter="م" color="sky" size={44} rotate={10} className="absolute bottom-4 left-6" />
        <Sparkle size={16} color="grape" className="absolute top-6 right-10" />
      </>
    ),
    c: (
      <>
        <Sparkle size={20} color="sun" className="absolute top-5 left-8" />
        <LetterBlock letter="س" color="leaf" size={42} rotate={-8} className="absolute bottom-4 left-4" />
        <Dot size={10} color="sky" className="absolute top-10 right-8" />
      </>
    ),
  };
  return <div className="joy-decor pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">{sets[variant]}</div>;
}

/**
 * A colourful header for an inner page: the mascot, a title in the rounded child font, and a few
 * blocks in the corners. The text sits on a plain warm panel, never on a pattern.
 */
export function KidPageHeader({
  title,
  subtitle,
  eyebrow,
  mood = 'wave',
  color = 'sun',
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  mood?: MascotMood;
  color?: JoyColor;
  children?: React.ReactNode;
}) {
  return (
    <header className={`joy-header joy-header-${color} relative overflow-hidden rounded-[28px] px-5 py-6 sm:px-8 sm:py-7`} dir="rtl">
      <JoyCorners variant={color === 'sky' ? 'b' : color === 'leaf' ? 'c' : 'a'} />
      <div className="relative flex items-center gap-4 sm:gap-6">
        <div className="joy-decor shrink-0" aria-hidden="true">
          <Mascot mood={mood} size={104} className="w-16 sm:w-[104px] h-auto" />
        </div>
        <div className="min-w-0 max-w-3xl">
          {eyebrow && <span className="bz-eyebrow">{eyebrow}</span>}
          <h1 className="joy-title mt-1">{title}</h1>
          {subtitle && <p className="bz-body mt-2 text-ink-2">{subtitle}</p>}
          {children}
        </div>
      </div>
    </header>
  );
}
