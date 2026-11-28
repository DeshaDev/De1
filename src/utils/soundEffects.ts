/**
 * Pure Web Audio API pedagogical sound effects for HayaNaqra.
 * Zero external MP3 dependencies and safe no-op in non-browser/test environments.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Plays a warm wooden hand-drum tap + soft hand-clap burst for the
 * Syllable Clapping Drum ("طبلة المقاطع الإيقاعية").
 */
export function playDrumClapSound(beatIndex = 0): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. Warm drum body thump (slight pitch lift per beat)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const pitchBoost = Math.min(beatIndex * 18, 90);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160 + pitchBoost, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.11);

    oscGain.gain.setValueAtTime(0.32, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // 2. Crisp short wooden clap overtone (70ms bandpass-filtered noise)
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * 0.07));
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (frameCount * 0.35));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400 + pitchBoost * 3, now);
    filter.Q.setValueAtTime(1.8, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.075);
  } catch {
    // Ignore audio context autoplay errors
  }
}

/**
 * Plays a playful magnetic snap / two-tone chime when Arabic letters lock
 * into connected positional train cars ("قطار أشكال الحرف").
 */
export function playMagneticSnapSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, peakGain: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(peakGain, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.01);
    };

    playTone(520, now, 0.065, 0.16);
    playTone(780, now + 0.045, 0.085, 0.18);
  } catch {
    // Ignore audio context autoplay errors
  }
}

/**
 * Plays a gentle pentatonic sparkle chime when the child's reading
 * paints color onto the story illustration ("التلوين السحري بالصوت").
 */
export function playMagicBrushSound(progressRatio = 0.5): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, progressRatio));
    const pentatonicHz = [440, 493.88, 554.37, 659.25, 739.99, 880];
    const idx = Math.min(pentatonicHz.length - 1, Math.floor(clamped * pentatonicHz.length));
    const baseFreq = pentatonicHz[idx] ?? 554.37;

    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc2.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.12, now + 0.14);
    osc2.frequency.setValueAtTime(baseFreq * 1.5, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.16);
    osc2.stop(now + 0.16);
  } catch {
    // Ignore audio context autoplay errors
  }
}
