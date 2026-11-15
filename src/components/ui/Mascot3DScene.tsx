/**
 * «هُدهُد» in 3D: a plush-toy hoopoe drawn with Three.js (react-three-fiber).
 *
 * It blinks, breathes, follows the pointer with its head, waves or cheers, sways its crest, and jumps
 * happily when tapped. Loaded lazily (its own chunk) and only on welcome and between-task screens;
 * never on a screen where the child reads or answers (docs/MASCOT_DESIGN_AR.md). The page shows the
 * static picture while this loads, when WebGL is missing, and when the device asks for reduced motion.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeElements } from '@react-three/fiber';
import { ContactShadows, Float, RoundedBox, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type Mood3D = 'wave' | 'cheer' | 'support' | 'proud' | 'calm';

const COLORS = {
  body: '#F08236',
  head: '#F59245',
  belly: '#FFE2B8',
  crest: '#FF9A1F',
  crestTip: '#2B2420',
  crestBand: '#FFF6E6',
  beak: '#5A4234',
  cheek: '#FF9DA8',
  pupil: '#1B2330',
  feet: '#F08A24',
  gold: '#FFC83D',
  ribbon: '#1AA39A',
};

/** Black-and-cream bars like a real hoopoe's wings, drawn once on a canvas. */
function useStripeTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#2E2723';
    g.fillRect(0, 0, 64, 256);
    g.fillStyle = '#FFF1DA';
    for (let y = 30; y < 256; y += 52) g.fillRect(0, y, 64, 20);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

/** An Arabic letter painted on a canvas (uses the page's fonts, so no extra download). */
function useLetterTexture(letter: string, color: string) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    g.roundRect(16, 16, 224, 224, 40);
    g.fill();
    g.fillStyle = color;
    g.font = "800 150px 'Baloo Bhaijaan 2', 'Noto Sans Arabic', sans-serif";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.fillText(letter, 128, 140);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [letter, color]);
}

function Plush({ color, geometryArgs = [1, 48, 48], ...rest }: { color: string; geometryArgs?: [number, number, number] } & ThreeElements['mesh']) {
  return (
    <mesh {...rest}>
      <sphereGeometry args={geometryArgs} />
      {/* Plush fabric: a soft sheen at grazing angles, like felt on a stuffed toy. */}
      <meshPhysicalMaterial color={color} roughness={0.7} sheen={0.6} sheenRoughness={0.5} sheenColor="#FFD9B0" />
    </mesh>
  );
}

function Hoopoe({ mood, interactive }: { mood: Mood3D; interactive: boolean }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const leftWing = useRef<THREE.Group>(null);
  const rightWing = useRef<THREE.Group>(null);
  const crest = useRef<THREE.Group>(null);
  const jumpAt = useRef(-10);
  const wantJump = useRef(false);
  const stripes = useStripeTexture();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (wantJump.current) {
      jumpAt.current = t;
      wantJump.current = false;
    }
    if (!root.current || !head.current || !eyes.current || !leftWing.current || !rightWing.current || !crest.current) return;
    // Breathing bob, and a happy jump with a spin after a tap.
    const since = t - jumpAt.current;
    const jump = since < 0.9 ? Math.sin((since / 0.9) * Math.PI) * 0.75 : 0;
    root.current.position.y = Math.sin(t * 2.1) * 0.06 + jump;
    root.current.rotation.y = since < 0.9 ? (since / 0.9) * Math.PI * 2 : THREE.MathUtils.lerp(root.current.rotation.y, 0, 0.1);
    const squash = 1 + Math.sin(t * 4.2) * 0.012;
    root.current.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));

    // Head follows the pointer gently.
    const px = (interactive ? state.pointer.x : Math.sin(t * 0.6) * 0.25) + 0.22;
    const py = interactive ? state.pointer.y : 0;
    head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, px * 0.55, 0.08);
    head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, -py * 0.28, 0.08);
    head.current.rotation.z = mood === 'support' ? 0.18 : Math.sin(t * 1.3) * 0.05;

    // Blink every few seconds.
    const cycle = t % 3.4;
    eyes.current.scale.y = cycle > 3.25 ? 0.12 : 1;

    // Wings: waving, cheering, hugging, or resting.
    const flap = Math.sin(t * 7);
    if (mood === 'cheer' || since < 0.9) {
      leftWing.current.rotation.z = 1.9 + flap * 0.35;
      rightWing.current.rotation.z = -1.9 - flap * 0.35;
    } else if (mood === 'wave') {
      const waving = t % 4 < 2;
      leftWing.current.rotation.z = 0.25;
      rightWing.current.rotation.z = waving ? -2.1 - Math.sin(t * 9) * 0.35 : THREE.MathUtils.lerp(rightWing.current.rotation.z, -0.25, 0.1);
    } else if (mood === 'support') {
      leftWing.current.rotation.z = -0.55;
      rightWing.current.rotation.z = 0.55;
    } else {
      leftWing.current.rotation.z = 0.28 + Math.sin(t * 2.1) * 0.04;
      rightWing.current.rotation.z = -0.28 - Math.sin(t * 2.1) * 0.04;
    }
    crest.current.children.forEach((f, i) => {
      f.rotation.x = Math.sin(t * 3 + i * 0.7) * 0.06;
    });
  });

  return (
    <group
      ref={root}
      onPointerDown={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        wantJump.current = true;
      }}
      onPointerOver={() => {
        if (interactive) document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      {/* Tail */}
      <mesh position={[0, -0.55, -0.85]} rotation={[0.9, 0, 0]} scale={[0.36, 0.22, 0.75]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial map={stripes} roughness={0.7} />
      </mesh>
      {/* Body and belly */}
      <Plush color={COLORS.body} scale={[1.02, 0.98, 0.95]} />
      <Plush color={COLORS.belly} position={[0, -0.14, 0.46]} scale={[0.7, 0.74, 0.5]} />
      {/* Feet */}
      <Plush color={COLORS.feet} position={[-0.32, -1.03, 0.25]} scale={[0.26, 0.1, 0.34]} />
      <Plush color={COLORS.feet} position={[0.32, -1.03, 0.25]} scale={[0.26, 0.1, 0.34]} />

      {/* Wings (pivot at the shoulder) */}
      <group ref={leftWing} position={[-0.92, 0.3, 0.1]}>
        <mesh position={[-0.14, -0.46, 0]} rotation={[0, 0, 0.18]} scale={[0.24, 0.6, 0.48]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial map={stripes} roughness={0.7} />
        </mesh>
      </group>
      <group ref={rightWing} position={[0.92, 0.3, 0.1]}>
        <mesh position={[0.14, -0.46, 0]} rotation={[0, 0, -0.18]} scale={[0.24, 0.6, 0.48]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial map={stripes} roughness={0.7} />
        </mesh>
      </group>

      {mood === 'proud' && (
        <group position={[0, 0.2, 0.92]}>
          <mesh position={[0, 0.22, -0.05]} rotation={[0.2, 0, 0]}>
            <torusGeometry args={[0.32, 0.05, 12, 40, Math.PI]} />
            <meshStandardMaterial color={COLORS.ribbon} roughness={0.5} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.06, 40]} />
            <meshStandardMaterial color={COLORS.gold} roughness={0.25} metalness={0.4} />
          </mesh>
        </group>
      )}
      {mood === 'support' && (
        <mesh position={[0, -0.05, 0.98]} scale={0.16}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial color={COLORS.cheek} roughness={0.4} />
        </mesh>
      )}

      {/* Head */}
      <group ref={head} position={[0, 1.25, 0.08]}>
        <Plush color={COLORS.head} geometryArgs={[0.86, 48, 48]} />
        {/* Crest: a fan of feathers with a cream band and black tips */}
        <group ref={crest} position={[0, 0.5, -0.12]} rotation={[-0.22, 0, 0]}>
          {[-0.95, -0.55, -0.18, 0.18, 0.55, 0.95].map((a, i) => (
            <group key={i} rotation={[0, 0, a]} scale={[1, 1 - Math.abs(a) * 0.18, 0.5]}>
              <mesh position={[0, 0.42, 0]}>
                <capsuleGeometry args={[0.15, 0.7, 8, 16]} />
                <meshStandardMaterial color={COLORS.crest} roughness={0.55} />
              </mesh>
              <mesh position={[0, 0.86, 0]} scale={[1, 0.45, 1]}>
                <sphereGeometry args={[0.155, 20, 20]} />
                <meshStandardMaterial color={COLORS.crestBand} roughness={0.6} />
              </mesh>
              <mesh position={[0, 1.0, 0]}>
                <sphereGeometry args={[0.15, 20, 20]} />
                <meshStandardMaterial color={COLORS.crestTip} roughness={0.5} />
              </mesh>
            </group>
          ))}
        </group>
        {/* Eyes */}
        <group ref={eyes} position={[0, 0.1, 0]}>
          {[-0.31, 0.31].map((x) => (
            <group key={x} position={[x, 0, 0.66]}>
              <mesh scale={[1, 1.12, 0.7]}>
                <sphereGeometry args={[0.22, 32, 32]} />
                <meshStandardMaterial color="#FFFFFF" roughness={0.2} />
              </mesh>
              {mood === 'cheer' ? (
                <mesh position={[0, 0.02, 0.15]} rotation={[0, 0, Math.PI]}>
                  <torusGeometry args={[0.11, 0.035, 10, 24, Math.PI]} />
                  <meshStandardMaterial color={COLORS.pupil} />
                </mesh>
              ) : (
                <>
                  <mesh position={[x > 0 ? -0.02 : 0.02, -0.01, 0.13]}>
                    <sphereGeometry args={[0.14, 24, 24]} />
                    <meshStandardMaterial color={COLORS.pupil} roughness={0.15} />
                  </mesh>
                  <mesh position={[x > 0 ? 0.02 : 0.06, 0.07, 0.25]}>
                    <sphereGeometry args={[0.05, 12, 12]} />
                    <meshBasicMaterial color="#FFFFFF" />
                  </mesh>
                  <mesh position={[x > 0 ? -0.06 : -0.02, -0.06, 0.25]}>
                    <sphereGeometry args={[0.022, 10, 10]} />
                    <meshBasicMaterial color="#FFFFFF" />
                  </mesh>
                </>
              )}
            </group>
          ))}
        </group>
        {/* Cheeks */}
        {[-0.48, 0.48].map((x) => (
          <mesh key={x} position={[x * 1.08, -0.2, 0.6]} scale={[1, 0.62, 0.4]}>
            <sphereGeometry args={[0.14, 20, 20]} />
            <meshStandardMaterial color={COLORS.cheek} roughness={0.6} transparent opacity={0.85} />
          </mesh>
        ))}
        {/* Beak: long and gently curved down, like a hoopoe's */}
        <group position={[0, -0.12, 0.78]} rotation={[0.25, 0, 0]}>
          <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.11, 0.3, 20]} />
            <meshStandardMaterial color={COLORS.beak} roughness={0.45} />
          </mesh>
          <group position={[0, 0, 0.26]} rotation={[0.55, 0, 0]}>
            <mesh position={[0, 0, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.07, 0.36, 20]} />
              <meshStandardMaterial color={COLORS.beak} roughness={0.45} />
            </mesh>
          </group>
        </group>
        {mood === 'cheer' && (
          <mesh position={[0, -0.34, 0.6]} scale={[1.2, 0.7, 0.6]}>
            <sphereGeometry args={[0.1, 20, 20]} />
            <meshStandardMaterial color="#C2414F" roughness={0.5} />
          </mesh>
        )}
      </group>
    </group>
  );
}

export interface SceneLetter {
  letter: string;
  /** What is spoken when the cube is tapped: the letter's sound with a fatha (a recorded clip). */
  sound: string;
  color: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size?: number;
}

export const HOME_LETTERS: SceneLetter[] = [
  { letter: 'ب', sound: 'بَ', color: '#FF7A59', position: [-2.35, 1.35, -0.3], rotation: [0.2, 0.5, -0.15] },
  { letter: 'ق', sound: 'قَ', color: '#2E9BF0', position: [2.3, 1.6, -0.5], rotation: [-0.1, -0.5, 0.2] },
  { letter: 'ر', sound: 'رَ', color: '#3DBA6A', position: [-2.1, -0.7, 0.35], rotation: [0.15, 0.35, 0.1], size: 0.66 },
  { letter: 'أ', sound: 'أَ', color: '#9B6CF0', position: [2.15, -0.5, 0.25], rotation: [0.1, -0.4, -0.1], size: 0.66 },
];

function LetterCube({ item, onSay }: { item: SceneLetter; onSay?: (sound: string) => void }) {
  const { letter, color, position, rotation, size = 0.74 } = item;
  const tex = useLetterTexture(letter, color);
  const spin = useRef<THREE.Group>(null);
  const hopAt = useRef(-10);
  const wantHop = useRef(false);
  const [hover, setHover] = useState(false);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (wantHop.current) {
      hopAt.current = t;
      wantHop.current = false;
    }
    if (!spin.current) return;
    const since = t - hopAt.current;
    const k = since < 0.7 ? since / 0.7 : 1;
    spin.current.position.y = since < 0.7 ? Math.sin(k * Math.PI) * 0.5 : 0;
    spin.current.rotation.y = since < 0.7 ? k * Math.PI * 2 : 0;
    const target = hover ? 1.12 : 1;
    spin.current.scale.setScalar(THREE.MathUtils.lerp(spin.current.scale.x, target, 0.15));
  });
  return (
    <Float speed={1.6} rotationIntensity={0.6} floatIntensity={1.1}>
      <group position={position} rotation={rotation}>
        <group
          ref={spin}
          onPointerDown={(e) => {
            e.stopPropagation();
            wantHop.current = true;
            onSay?.(item.sound);
          }}
          onPointerOver={() => {
            setHover(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = '';
          }}
        >
          <RoundedBox args={[size, size, size]} radius={size * 0.2} smoothness={4}>
            <meshPhysicalMaterial color={color} roughness={0.3} clearcoat={0.6} clearcoatRoughness={0.25} />
          </RoundedBox>
          <mesh position={[0, 0, size / 2 + 0.003]}>
            <planeGeometry args={[size * 0.76, size * 0.76]} />
            <meshBasicMaterial map={tex} transparent toneMapped={false} />
          </mesh>
        </group>
      </group>
    </Float>
  );
}

function StarShape({ position, color, scale = 0.16 }: { position: [number, number, number]; color: string; scale?: number }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 1 : 0.45;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    return s;
  }, []);
  return (
    <Float speed={2.4} rotationIntensity={1.4} floatIntensity={1.6}>
      <mesh position={position} scale={scale}>
        <extrudeGeometry args={[shape, { depth: 0.35, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 3 }]} />
        <meshPhysicalMaterial color={color} roughness={0.3} clearcoat={0.8} />
      </mesh>
    </Float>
  );
}

/** Soft studio reflections from a procedural room (no download), so the plush and the cubes look solid. */
function StudioLight() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.28;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);
  return null;
}

export interface Mascot3DSceneProps {
  mood?: Mood3D;
  /** Floating letter cubes, stars and sparkles around the mascot (home page). */
  scenery?: boolean;
  interactive?: boolean;
  /** Called with a letter's sound when the child taps a letter cube. */
  onSay?: (sound: string) => void;
}

export default function Mascot3DScene({ mood = 'wave', scenery = false, interactive = true, onSay }: Mascot3DSceneProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    // Pause rendering when the scene is off screen.
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="w-full h-full">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.7, scenery ? 9.2 : 8], fov: 34 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.62, 0)}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        style={{ background: 'transparent', touchAction: 'pan-y' }}
      >
        <StudioLight />
        <ambientLight intensity={0.25} />
        <hemisphereLight args={['#FFF6E5', '#9ED39A', 0.55]} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} color="#FFF4E0" />
        <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#BFE3FF" />
        <group position={[0, -0.25, 0]}>
          <Hoopoe mood={mood} interactive={interactive} />
          <ContactShadows position={[0, -1.12, 0]} opacity={0.35} scale={5} blur={2.4} far={2} />
        </group>
        {scenery && (
          <>
            {HOME_LETTERS.map((item) => (
              <LetterCube key={item.letter} item={item} onSay={onSay} />
            ))}
            <StarShape position={[-1.1, 2.4, -0.5]} color="#FFC21A" />
            <StarShape position={[1.25, 2.6, -0.8]} color="#FF7FA0" scale={0.12} />
            <StarShape position={[2.9, 0.45, -1]} color="#FFC21A" scale={0.1} />
            <Sparkles count={30} scale={[6.5, 4.5, 2]} size={3.2} speed={0.35} color="#FFE07A" opacity={0.9} />
          </>
        )}
      </Canvas>
    </div>
  );
}
