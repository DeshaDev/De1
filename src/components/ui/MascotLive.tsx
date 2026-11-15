/**
 * The moving «هُدهُد» for the home page and between-task screens: the drawn hoopoe with gentle idle
 * motion (breathing, blinking, a swaying crest, a waving wing). Plain SVG and CSS, so it looks the
 * same on every device and needs no 3D support. Nothing moves under reduced motion.
 * Never used on a screen where the child reads or answers (a test checks this).
 */
import React from 'react';
import { Mascot, MascotMoment, type MascotMood } from './Mascot';

export interface MascotLiveProps {
  mood?: MascotMood;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function MascotLive({ mood = 'wave', size = 200, className = '', style }: MascotLiveProps) {
  return (
    <div className={className} style={style} data-mascot-live="true">
      <Mascot mood={mood} size={size} className="h-auto w-full max-w-full" animated />
    </div>
  );
}

/** MascotMoment with idle motion, for between-task screens only. */
export function MascotMomentLive(props: { mood: MascotMood; message?: React.ReactNode; size?: number; className?: string }) {
  return <MascotMoment {...props} animated />;
}
