/**
 * The playful layer of «هَيَّا نَقْرَأْ»: toy letter blocks, clouds, sparkles, a 3D hero scene with the
 * mascot, wave dividers and a colourful page header.
 *
 * Rule: joyful edges, calm centre (docs/JOYFUL_DESIGN_AR.md).
 * - Decoration lives in page frames, headers and between-task screens, never behind or beside text
 *   a child is reading or an item they are answering. Heavily decorated surroundings pull young
 *   children's attention away from the task and lower learning (Fisher, Godwin & Seltman, 2014),
 *   and in real classrooms children did not get used to it over a term (Godwin et al., 2022).
 * - Everything here is decorative: aria-hidden, no pointer events, hidden in print and while a
 *   child is in a game or session (body.baseera-reading-focus). Only the mascot moves, and only
 *   on the home page and between-task screens; it stays still under prefers-reduced-motion.
 */
import React, { useCallback, useState } from 'react';
import { Mascot, type MascotMood } from './Mascot';
import { MascotLive } from './MascotLive';

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

/** The letters around «هُدهُد» on the home page: what the bubble calls them and where they sit. */
const HERO_LETTERS: { letter: string; sound: string; name: string; color: JoyColor; pos: string; rotate: number }[] = [
  { letter: 'ب', sound: 'بَ', name: 'الباء', color: 'coral', pos: 'top-[10%] right-[4%]', rotate: -10 },
  { letter: 'ق', sound: 'قَ', name: 'القاف', color: 'sky', pos: 'top-[6%] left-[6%]', rotate: 8 },
  { letter: 'ر', sound: 'رَ', name: 'الراء', color: 'leaf', pos: 'bottom-[20%] right-[2%]', rotate: 6 },
  { letter: 'أ', sound: 'أَ', name: 'الهمزة', color: 'grape', pos: 'bottom-[24%] left-[3%]', rotate: -8 },
];
const NAME_OF_SOUND: Record<string, string> = Object.fromEntries(HERO_LETTERS.map((l) => [l.sound, l.name]));

/**
 * The home page scene: «هُدهُد» teaches letter sounds. The child taps a letter, hears its sound (a
 * recorded clip), «هُدهُد» hops, and the bubble names the letter. Drawn SVG with CSS motion, so it
 * works the same on every device. The bubble sits above the scene, never over the bird.
 */
export function HeroScene({ message = 'مرحبًا، أنا هُدهُد! أهلًا بكم في هَيَّا نَقْرَأْ.' }: { message?: string }) {
  const scene = (
    <div className="relative h-full w-full">
      {HERO_LETTERS.map((l) => (
        <div
          key={l.letter}
          className={`hn-letter pointer-events-none select-none absolute ${l.pos}`}
          aria-hidden="true"
        >
          <LetterBlock letter={l.letter} color={l.color} size={64} rotate={l.rotate} />
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-[0%] flex justify-center">
        <div className="hn-bird w-[52%]">
          <Mascot mood="wave" size={230} className="h-auto w-full" animated />
        </div>
      </div>
    </div>
  );
  return (
    <div className="relative mx-auto flex w-full max-w-[430px] flex-col items-center">
      <div className="relative z-10 w-[88%] max-w-[23rem]">
        <p className="mascot-bubble mascot-bubble-down font-child text-center" role="status" aria-live="polite">
          {message}
        </p>
      </div>
      <div className="joy-decor relative -mt-3 w-full aspect-[1.3]">
        <span className="absolute inset-[8%] rounded-full hn-halo" aria-hidden="true" />
        <div className="absolute inset-0" data-hero-game="true">
          {scene}
        </div>
      </div>
    </div>
  );
}

/** Decoration for the edges of a page section (corners only, never behind text). */
export function JoyCorners({ variant = 'a' }: { variant?: 'a' | 'b' | 'c' }) {
  const sets = {
    a: (
      <>
        <LetterBlock letter="ح" color="sun" size={46} rotate={-12} className="absolute top-4 left-4 opacity-90" />
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
          <MascotLive mood={mood} size={128} className="w-20 sm:w-32" />
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
