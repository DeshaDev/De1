/**
 * The animated 3D «هُدهُد», with the static picture as a safe fallback.
 *
 * - The 3D scene is its own chunk, loaded only when this component mounts (home page and
 *   between-task screens), so the reading and game screens never download it.
 * - It shows the static SVG first, and keeps it when WebGL is missing, when only a software
 *   renderer is available (slow devices), or when the device asks for reduced motion, so the page
 *   never waits on or depends on 3D. `?mascot3d=1` forces the 3D scene (for checking it).
 */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Mascot, type MascotMood } from './Mascot';

const Mascot3DScene = lazy(() => import('./Mascot3DScene'));

function canRender3D(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    if (new URLSearchParams(window.location.search).get('mascot3d') === '1') return true;
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    // A software renderer (no graphics chip) would make the whole page slow: keep the still picture.
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|software|basic render/i.test(renderer);
  } catch {
    return false;
  }
}

class SceneBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface Mascot3DProps {
  mood?: MascotMood;
  /** Floating letter cubes, stars and sparkles around the mascot. */
  scenery?: boolean;
  /** Size of the static fallback picture. */
  fallbackSize?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Called with a letter's sound when the child taps a letter cube (scenery only). */
  onSay?: (sound: string) => void;
  /** What to show instead of the 3D scene (while loading, without WebGL, or under reduced motion). */
  still?: React.ReactNode;
}

export function Mascot3D({ mood = 'wave', scenery = false, fallbackSize = 200, className = '', style, onSay, still: customStill }: Mascot3DProps) {
  const [use3D, setUse3D] = useState(false);
  useEffect(() => {
    setUse3D(canRender3D());
  }, []);

  const still = customStill ?? (
    <div className="flex h-full w-full items-end justify-center">
      <Mascot mood={mood} size={fallbackSize} className="h-auto w-[62%] max-w-full" />
    </div>
  );

  return (
    <div className={className} style={style} data-mascot-3d={use3D ? 'live' : 'still'}>
      {use3D ? (
        <SceneBoundary fallback={still}>
          <Suspense fallback={still}>
            <Mascot3DScene mood={mood} scenery={scenery} onSay={onSay} />
          </Suspense>
        </SceneBoundary>
      ) : (
        still
      )}
    </div>
  );
}

/**
 * The 3D version of MascotMoment, for between-task screens only (a game's welcome, a finished
 * session, a finished story). Never inside a task: practice reactions there stay still pictures.
 */
export function MascotMoment3D({ mood, message, size = 150, className = '' }: { mood: MascotMood; message?: React.ReactNode; size?: number; className?: string }) {
  const box = Math.round(size * 1.3);
  return (
    <div className={`mascot-pop flex flex-col items-center gap-2 ${className}`} data-mascot-moment={mood} dir="rtl">
      <Mascot3D mood={mood} fallbackSize={size} className="max-w-full" style={{ width: box, height: box }} />
      {message && (
        <p className="mascot-bubble mascot-bubble-up font-child" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
