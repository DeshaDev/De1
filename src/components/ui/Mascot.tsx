/**
 * «هُدهُد», the reading friend: an original cartoon hoopoe.
 *
 * Where the mascot may appear (docs/MASCOT_DESIGN_AR.md):
 * - Only between tasks: welcome and instructions, after an answer in practice, after a mistake
 *   in training (support), and on the end-of-game, end-of-session and completion screens.
 * - Never while the child is reading, listening to an item or answering a scored item. Moving or
 *   decorative pictures beside the text pull attention from decoding (the "seductive details"
 *   effect, Harp & Mayer, 1998), and children with dyslexia are more affected by visual clutter
 *   near the word (crowding, Martelli et al., 2009).
 * - On scored items it never reacts to the answer, so it cannot give away whether it was right.
 *
 * The drawing is static. It enters once with a short pop (no loops); with reduced motion it simply
 * appears.
 */
import React, { useId } from 'react';

export type MascotMood = 'wave' | 'cheer' | 'support' | 'proud' | 'calm';

export const MASCOT_NAME_AR = 'هُدهُد';

const C = {
  crest: '#F2A93B',
  crestTip: '#2B2622',
  crestBand: '#FFF7E8',
  head: '#F0A46E',
  body: '#E6915B',
  belly: '#FCDDBA',
  wingDark: '#2E2925',
  wingLight: '#FFF1DA',
  beak: '#5A4636',
  cheek: '#F59AA0',
  pupil: '#1C2430',
  feet: '#E58A2E',
  gold: '#F5B82E',
  goldDark: '#B7700B',
  ribbon: '#0B6E69',
  heart: '#EF6F84',
  mouth: '#B83A4B',
};

/** A hoopoe wing pointing down from its shoulder, with the black-and-cream bars of the real bird. */
function Wing({ clipId, transform }: { clipId: string; transform: string }) {
  const shape = 'M0 0 C 15 3, 18 30, 6 52 C 0 58, -10 55, -13 46 C -18 27, -13 6, 0 0 Z';
  return (
    <g transform={transform}>
      <clipPath id={clipId}>
        <path d={shape} />
      </clipPath>
      <path d={shape} fill={C.wingDark} />
      <g clipPath={`url(#${clipId})`} fill={C.wingLight}>
        <rect x="-20" y="14" width="40" height="6" />
        <rect x="-20" y="27" width="40" height="6" />
        <rect x="-20" y="40" width="40" height="6" />
      </g>
    </g>
  );
}

function CrestFeather({ angle }: { angle: number }) {
  return (
    <g transform={`translate(100 70) rotate(${angle})`}>
      <path d="M0 0 C -13 -18, -12 -48, 0 -66 C 12 -48, 13 -18, 0 0 Z" fill={C.crest} />
      <ellipse cx="0" cy="-49" rx="8" ry="3" fill={C.crestBand} />
      <path d="M0 -53 C -7 -56, -6 -62, 0 -66 C 6 -62, 7 -56, 0 -53 Z" fill={C.crestTip} />
    </g>
  );
}

function Eye({ x, mood }: { x: number; mood: MascotMood }) {
  if (mood === 'cheer') {
    return <path d={`M${x - 10} 84 Q${x} 71 ${x + 10} 84`} fill="none" stroke={C.pupil} strokeWidth="4.5" strokeLinecap="round" />;
  }
  const lookUp = mood === 'support' ? -2 : 1;
  return (
    <g>
      <ellipse cx={x} cy="81" rx="11" ry="13" fill="#FFFFFF" />
      <circle cx={x + (x < 100 ? 1.5 : -1.5)} cy={83 + lookUp} r="6.5" fill={C.pupil} />
      <circle cx={x + (x < 100 ? -1 : -4)} cy={79 + lookUp} r="2.4" fill="#FFFFFF" />
    </g>
  );
}

export interface MascotProps {
  mood?: MascotMood;
  /** Width in pixels; the height follows. */
  size?: number;
  className?: string;
  /** Accessible name. Leave empty when a speech bubble next to it says the same thing. */
  label?: string;
}

export function Mascot({ mood = 'wave', size = 140, className = '', label }: MascotProps) {
  const uid = useId().replace(/:/g, '');
  const wings: Record<MascotMood, [string, string]> = {
    calm: ['translate(58 128) rotate(12)', 'translate(142 128) scale(-1 1) rotate(12)'],
    wave: ['translate(58 128) rotate(12)', 'translate(146 112) scale(-1 1) rotate(140)'],
    cheer: ['translate(54 112) rotate(140)', 'translate(146 112) scale(-1 1) rotate(140)'],
    support: ['translate(66 134) rotate(-48)', 'translate(134 134) scale(-1 1) rotate(-48)'],
    proud: ['translate(56 126) rotate(34)', 'translate(144 126) scale(-1 1) rotate(34)'],
  };
  const [leftWing, rightWing] = wings[mood];

  return (
    <svg
      width={size}
      height={(size * 214) / 200}
      viewBox="0 0 200 214"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-mascot={mood}
      focusable="false"
    >
      <ellipse cx="100" cy="206" rx="46" ry="6" fill="#000000" opacity="0.08" />

      {/* Tail */}
      <g transform="translate(70 172) rotate(55)">
        <path d="M-10 0 L10 0 L14 30 Q0 40 -14 30 Z" fill={C.wingDark} />
        <rect x="-12" y="10" width="24" height="5" fill={C.wingLight} />
        <rect x="-13" y="21" width="26" height="5" fill={C.wingLight} />
      </g>

      {/* Crest (behind the head) */}
      {[-62, -31, 0, 31, 62].map((a) => (
        <CrestFeather key={a} angle={a} />
      ))}

      {/* Body and feet */}
      <ellipse cx="86" cy="198" rx="10" ry="5" fill={C.feet} />
      <ellipse cx="114" cy="198" rx="10" ry="5" fill={C.feet} />
      <ellipse cx="100" cy="148" rx="50" ry="52" fill={C.body} />
      <ellipse cx="100" cy="158" rx="32" ry="36" fill={C.belly} />

      {/* Head */}
      <circle cx="100" cy="86" r="43" fill={C.head} />

      {mood === 'support' && (
        <g fill="none" stroke={C.pupil} strokeWidth="3.2" strokeLinecap="round">
          <path d="M73 64 Q81 60 91 65" />
          <path d="M127 64 Q119 60 109 65" />
        </g>
      )}
      <Eye x={84} mood={mood} />
      <Eye x={116} mood={mood} />
      <circle cx="69" cy="99" r="7" fill={C.cheek} opacity="0.75" />
      <circle cx="131" cy="99" r="7" fill={C.cheek} opacity="0.75" />

      {/* Beak (open in a cheer) */}
      {mood === 'cheer' && <path d="M90 100 Q100 120 110 100 Q100 104 90 100 Z" fill={C.mouth} />}
      <path
        d={mood === 'cheer' ? 'M89 94 Q100 87 111 94 Q106 101 100 106 Q94 101 89 94 Z' : 'M89 95 Q100 88 111 95 Q105 106 99 117 Q97 119 96 116 Q97 105 89 95 Z'}
        fill={C.beak}
      />

      {/* Wings */}
      <Wing clipId={`${uid}-wl`} transform={leftWing} />
      <Wing clipId={`${uid}-wr`} transform={rightWing} />

      {mood === 'support' && (
        <path d="M100 168 C 92 160, 82 166, 88 175 L100 186 L112 175 C 118 166, 108 160, 100 168 Z" fill={C.heart} />
      )}

      {mood === 'proud' && (
        <g>
          <path d="M86 120 L100 146 L114 120" fill="none" stroke={C.ribbon} strokeWidth="7" strokeLinejoin="round" />
          <circle cx="100" cy="152" r="15" fill={C.gold} stroke={C.goldDark} strokeWidth="2.5" />
          <path
            d="M100 143 L102.9 148.9 L109.4 149.8 L104.7 154.3 L105.8 160.7 L100 157.7 L94.2 160.7 L95.3 154.3 L90.6 149.8 L97.1 148.9 Z"
            fill="#FFFFFF"
          />
        </g>
      )}

      {(mood === 'cheer' || mood === 'proud') && (
        <g fill={C.gold}>
          <path d="M30 60 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" />
          <path d="M170 52 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" />
          <circle cx="160" cy="92" r="3.5" />
          <circle cx="40" cy="100" r="3" />
        </g>
      )}
    </svg>
  );
}

export interface MascotMomentProps {
  mood: MascotMood;
  /** What the mascot says. Kept short: one or two lines. */
  message?: React.ReactNode;
  size?: number;
  /** stack: mascot above the bubble (full screens); row: side by side (compact feedback). */
  layout?: 'stack' | 'row';
  className?: string;
}

/** The mascot with a speech bubble, for between-task screens only. */
export function MascotMoment({ mood, message, size = 140, layout = 'stack', className = '' }: MascotMomentProps) {
  return (
    <div
      className={`mascot-pop flex items-center ${layout === 'stack' ? 'flex-col gap-2' : 'flex-row gap-3'} ${className}`}
      data-mascot-moment={mood}
      dir="rtl"
    >
      <Mascot mood={mood} size={size} label={message ? undefined : MASCOT_NAME_AR} />
      {message && (
        <p className={`mascot-bubble ${layout === 'stack' ? 'mascot-bubble-up' : 'mascot-bubble-side'} font-child`} role="status">
          {message}
        </p>
      )}
    </div>
  );
}

export default Mascot;
