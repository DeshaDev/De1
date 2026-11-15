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
 * The drawing is still by default and enters once with a short pop. With `animated` (home page and
 * between-task screens only) it breathes, blinks, sways its crest and waves. Every moving part is
 * its own group that turns around its joint (shoulder, crest base, neck) in view-box coordinates,
 * and the CSS motion sits on an outer group while the pose sits on an inner one, so the two never
 * overwrite each other and no part can jump away. Nothing moves under reduced motion.
 */
import React, { useId } from 'react';

export type MascotMood = 'wave' | 'cheer' | 'support' | 'proud' | 'calm';

export const MASCOT_NAME_AR = 'هُدهُد';

const C = {
  crestA: '#FFB23E',
  crestB: '#F08A1C',
  crestBand: '#FFF4DF',
  crestTip: '#2A221E',
  headA: '#FFC08A',
  headB: '#F69A55',
  bodyA: '#F8A660',
  bodyB: '#E57B36',
  bellyA: '#FFF3DF',
  bellyB: '#FFDDB5',
  wingDark: '#2B2420',
  wingLight: '#FFF1DA',
  beakA: '#7A6150',
  beakB: '#3F312A',
  cheek: '#FF8FA3',
  iris: '#1D2B4F',
  pupil: '#0B1226',
  feet: '#F2892B',
  gold: '#FFC83D',
  goldDark: '#C27C0E',
  ribbon: '#14A39A',
  heart: '#FF6B86',
  outline: '#7A3E1A',
};

/** Shoulders and joints in view-box units (used for both the pose and the CSS pivots). */
export const MASCOT_JOINTS = {
  shoulderL: [58, 132],
  shoulderR: [142, 132],
  crestBase: [100, 62],
  neck: [100, 128],
  eyes: [100, 86],
} as const;

const WING_PATH = 'M0 0 C 15 2, 21 27, 11 52 C 5 60, -7 59, -12 50 C -18 31, -12 5, 0 0 Z';

function Wing({ clipId, pose }: { clipId: string; pose: string }) {
  return (
    <g transform={pose}>
      <clipPath id={clipId}>
        <path d={WING_PATH} />
      </clipPath>
      <path d={WING_PATH} fill={C.wingDark} />
      <g clipPath={`url(#${clipId})`} fill={C.wingLight}>
        <rect x="-24" y="15" width="50" height="6" rx="3" />
        <rect x="-24" y="27" width="50" height="6" rx="3" />
        <rect x="-24" y="39" width="50" height="6" rx="3" />
      </g>
      <path d={WING_PATH} fill="none" stroke="#000" strokeOpacity="0.15" strokeWidth="1.5" />
    </g>
  );
}

function Feather({ angle, index, gradId }: { angle: number; index: number; gradId: string }) {
  const len = 82 - Math.abs(angle) * 0.22;
  return (
    <g className="m-feather" style={{ ['--i' as string]: index }}>
      <g transform={`translate(${MASCOT_JOINTS.crestBase[0]} ${MASCOT_JOINTS.crestBase[1]}) rotate(${angle})`}>
        <path d={`M0 6 C -12 -14, -12 ${-len + 18}, 0 ${-len} C 12 ${-len + 18}, 12 -14, 0 6 Z`} fill={`url(#${gradId})`} />
        <path d={`M-8 ${-len + 22} Q0 ${-len + 18} 8 ${-len + 22} L7 ${-len + 16} Q0 ${-len + 12} -7 ${-len + 16} Z`} fill={C.crestBand} />
        <path d={`M-7 ${-len + 14} Q0 ${-len + 10} 7 ${-len + 14} C 6 ${-len + 6}, 3 ${-len + 1}, 0 ${-len} C -3 ${-len + 1}, -6 ${-len + 6}, -7 ${-len + 14} Z`} fill={C.crestTip} />
      </g>
    </g>
  );
}

function Eye({ x, mood }: { x: number; mood: MascotMood }) {
  const y = MASCOT_JOINTS.eyes[1];
  if (mood === 'cheer') {
    return <path d={`M${x - 11} ${y + 2} Q${x} ${y - 12} ${x + 11} ${y + 2}`} fill="none" stroke={C.iris} strokeWidth="5" strokeLinecap="round" />;
  }
  const dx = x < 100 ? 2 : -2;
  const dy = mood === 'support' ? -2 : 1;
  return (
    <g>
      <ellipse cx={x} cy={y} rx="13" ry="15.5" fill="#FFFFFF" />
      <circle cx={x + dx} cy={y + 2 + dy} r="9" fill={C.iris} />
      <circle cx={x + dx} cy={y + 2 + dy} r="5" fill={C.pupil} />
      <circle cx={x + dx - 3} cy={y - 2 + dy} r="3.4" fill="#FFFFFF" />
      <circle cx={x + dx + 3.5} cy={y + 6 + dy} r="1.6" fill="#FFFFFF" />
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
  /** Gentle idle motion (breathing, blinking, crest, wave). Home page and between-task screens only. */
  animated?: boolean;
}

export function Mascot({ mood = 'wave', size = 140, className = '', label, animated = false }: MascotProps) {
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `${uid}-${name}`;
  const [lx, ly] = MASCOT_JOINTS.shoulderL;
  const [rx, ry] = MASCOT_JOINTS.shoulderR;
  // Wing poses: angle from hanging down (0) outward; the right wing is mirrored.
  const wingAngles: Record<MascotMood, [number, number]> = {
    calm: [8, 8],
    wave: [8, 150],
    cheer: [145, 145],
    support: [-52, -52],
    proud: [32, 32],
  };
  const [la, ra] = wingAngles[mood];
  const crestAngles = [-54, -36, -18, 0, 18, 36, 54];

  return (
    <svg
      width={size}
      height={(size * 240) / 200}
      viewBox="0 -26 200 240"
      className={`${animated ? 'mascot-animated' : ''} ${className}`.trim()}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-mascot={mood}
      data-mascot-animated={animated ? 'true' : undefined}
      focusable="false"
      overflow="visible"
    >
      <defs>
        <linearGradient id={id('crest')} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={C.crestB} />
          <stop offset="1" stopColor={C.crestA} />
        </linearGradient>
        <radialGradient id={id('head')} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor={C.headA} />
          <stop offset="1" stopColor={C.headB} />
        </radialGradient>
        <radialGradient id={id('body')} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor={C.bodyA} />
          <stop offset="1" stopColor={C.bodyB} />
        </radialGradient>
        <linearGradient id={id('belly')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.bellyA} />
          <stop offset="1" stopColor={C.bellyB} />
        </linearGradient>
        <linearGradient id={id('beak')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.beakA} />
          <stop offset="1" stopColor={C.beakB} />
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="208" rx="50" ry="6.5" fill="#000000" opacity="0.1" />

      <g className="m-body">
        {/* Tail feathers peeking out behind the body */}
        <g transform="translate(128 178)">
          {[38, 58, 78].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <path d="M-7 0 L7 0 L9 30 Q0 38 -9 30 Z" fill={C.wingDark} />
              <rect x="-9" y="11" width="18" height="5" fill={C.wingLight} />
              <rect x="-9.5" y="22" width="19" height="5" fill={C.wingLight} />
            </g>
          ))}
        </g>

        {/* Feet */}
        {[84, 116].map((x) => (
          <g key={x} fill={C.feet}>
            <ellipse cx={x} cy="201" rx="11" ry="5.5" />
            <ellipse cx={x - 7} cy="203" rx="4" ry="3.2" />
            <ellipse cx={x + 7} cy="203" rx="4" ry="3.2" />
          </g>
        ))}

        {/* Body and belly */}
        <path d="M100 98 C 136 98, 152 128, 150 160 C 148 190, 128 204, 100 204 C 72 204, 52 190, 50 160 C 48 128, 64 98, 100 98 Z" fill={`url(#${id('body')})`} />
        <path d="M100 124 C 122 124, 134 144, 133 166 C 132 186, 118 196, 100 196 C 82 196, 68 186, 67 166 C 66 144, 78 124, 100 124 Z" fill={`url(#${id('belly')})`} />
        <g fill="none" stroke={C.bellyB} strokeWidth="2.4" strokeLinecap="round" opacity="0.9">
          <path d="M90 150 Q95 155 100 150 Q105 155 110 150" />
          <path d="M86 165 Q93 171 100 165 Q107 171 114 165" />
          <path d="M90 180 Q95 185 100 180 Q105 185 110 180" />
        </g>

        {mood === 'proud' && (
          <g>
            <path d="M86 122 L100 148 L114 122" fill="none" stroke={C.ribbon} strokeWidth="7" strokeLinejoin="round" />
            <circle cx="100" cy="156" r="16" fill={C.gold} stroke={C.goldDark} strokeWidth="2.5" />
            <path d="M100 146 L103 152.2 L109.8 153.1 L104.9 157.8 L106 164.5 L100 161.3 L94 164.5 L95.1 157.8 L90.2 153.1 L97 152.2 Z" fill="#FFFFFF" />
          </g>
        )}
        {mood === 'support' && (
          <path d="M100 168 C 91 158, 79 166, 86 177 L100 190 L114 177 C 121 166, 109 158, 100 168 Z" fill={C.heart} />
        )}

        {/* Wings: the CSS motion on the outer group, the pose on the inner one */}
        <g className="m-wing m-wing-l">
          <Wing clipId={id('wl')} pose={`translate(${lx} ${ly}) rotate(${la})`} />
        </g>
        <g className={`m-wing m-wing-r ${mood === 'wave' ? 'm-waving' : ''}`}>
          <Wing clipId={id('wr')} pose={`translate(${rx} ${ry}) scale(-1 1) rotate(${ra})`} />
        </g>
      </g>

      <g className="m-head">
        {/* Crest behind the head: a fan of feathers with a cream band and black tips */}
        <g className="m-crest">
          {crestAngles.map((a, i) => (
            <Feather key={a} angle={a} index={i} gradId={id('crest')} />
          ))}
        </g>

        <circle cx="100" cy="86" r="47" fill={`url(#${id('head')})`} />
        <ellipse cx="84" cy="62" rx="16" ry="9" fill="#FFFFFF" opacity="0.22" />

        {mood === 'support' && (
          <g fill="none" stroke={C.iris} strokeWidth="3.4" strokeLinecap="round">
            <path d="M70 66 Q79 61 90 66" />
            <path d="M130 66 Q121 61 110 66" />
          </g>
        )}
        <g className="m-eyes">
          <Eye x={81} mood={mood} />
          <Eye x={119} mood={mood} />
        </g>
        <ellipse cx="66" cy="106" rx="9" ry="6" fill={C.cheek} opacity="0.7" />
        <ellipse cx="134" cy="106" rx="9" ry="6" fill={C.cheek} opacity="0.7" />

        {/* The hoopoe's long, gently curved beak */}
        <path d="M92 98 Q100 92 108 98 Q111 108 115 118 Q120 130 128 138 Q117 137 108 124 Q100 112 92 98 Z" fill={`url(#${id('beak')})`} />
        <path d="M96 99 Q101 96 105 99" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      </g>

      {(mood === 'cheer' || mood === 'proud') && (
        <g fill={C.gold} className="m-sparkles">
          <path d="M26 58 l3.2 7.5 7.5 3.2 -7.5 3.2 -3.2 7.5 -3.2 -7.5 -7.5 -3.2 7.5 -3.2 Z" />
          <path d="M174 46 l2.6 6.2 6.2 2.6 -6.2 2.6 -2.6 6.2 -2.6 -6.2 -6.2 -2.6 6.2 -2.6 Z" />
          <circle cx="164" cy="96" r="3.6" />
          <circle cx="36" cy="104" r="3" />
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
  /** Idle motion; only on between-task screens, never beside an item. */
  animated?: boolean;
}

/** The mascot with a speech bubble, for between-task screens only. */
export function MascotMoment({ mood, message, size = 140, layout = 'stack', className = '', animated = false }: MascotMomentProps) {
  return (
    <div
      className={`mascot-pop flex items-center ${layout === 'stack' ? 'flex-col gap-2' : 'flex-row gap-3'} ${className}`}
      data-mascot-moment={mood}
      dir="rtl"
    >
      <Mascot mood={mood} size={size} label={message ? undefined : MASCOT_NAME_AR} animated={animated} />
      {message && (
        <p className={`mascot-bubble ${layout === 'stack' ? 'mascot-bubble-up' : 'mascot-bubble-side'} font-child`} role="status">
          {message}
        </p>
      )}
    </div>
  );
}

export default Mascot;
