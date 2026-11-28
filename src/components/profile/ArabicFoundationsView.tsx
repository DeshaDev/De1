import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ARABIC_FOUNDATION_LETTERS,
  LONG_VOWELS,
  MOVABLE_ALPHABET_WORDS,
  PHONEMIC_BASKET_ROUNDS,
  getFoundationLetter,
  getPositionalLetterForms,
  getWordConnectedForms,
  type FoundationLetter,
  type LetterConnectionPosition,
} from '../../cognitiveProfile/arabicFoundations';
import { toArabicNum } from '../../utils/arabicDigits';
import { playNaturalArabicAudio, stopNaturalArabicAudio } from '../../utils/naturalSpeech';
import { playDrumClapSound, playMagneticSnapSound } from '../../utils/soundEffects';
import { MirrorVoiceRecorder } from '../ui/MirrorVoiceRecorder';
import type { StudentRecord } from '../../data/seedData';
import {
  computeAdaptiveBalloonParams,
  getPrioritizedWeakLetters,
  pickAdaptiveBasketIndex,
  pickAdaptiveMovableWords,
  type StudioAdaptiveState,
} from '../../cognitiveProfile/studioAdaptive';

export type FoundationSubMode = 'trace' | 'balloon' | 'basket' | 'movable';

interface ArabicFoundationsViewProps {
  student?: StudentRecord | null;
  studentId?: string;
  childName?: string;
  initialMode?: FoundationSubMode;
  recommendedLetterFocus?: string;
  adaptiveState?: StudioAdaptiveState;
  singleMode?: boolean;
  onActivityCompleted?: (activityId: string) => void;
  onAdaptiveAttempt?: (letter: string, correct: boolean, traced?: boolean) => void;
  onNextSkill?: () => void;
}

const BALLOON_PALETTES = [
  { body: '#FF6B6B', dark: '#C02626', shine: '#FFA8A8' },
  { body: '#14B8A6', dark: '#0F766E', shine: '#99F6E4' },
  { body: '#F59E0B', dark: '#B45309', shine: '#FDE68A' },
  { body: '#8B5CF6', dark: '#5B21B6', shine: '#DDD6FE' },
  { body: '#3B82F6', dark: '#1D4ED8', shine: '#BFDBFE' },
  { body: '#EC4899', dark: '#9D174D', shine: '#FBCFE8' },
];

const SAND_SIZE = 280;
const TRACE_STORAGE_KEY = 'baseera.arabicFoundations.tracedLetters';

function loadTracedSet(storageKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string');
    }
  } catch {
    /* ignore storage errors */
  }
  return [];
}

function saveTracedSet(letters: string[], storageKey: string) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...new Set(letters)]));
  } catch {
    /* ignore storage errors */
  }
}

export const ArabicFoundationsView: React.FC<ArabicFoundationsViewProps> = ({
  student,
  studentId,
  childName = 'البطل',
  initialMode = 'trace',
  recommendedLetterFocus = 'س',
  adaptiveState,
  singleMode = false,
  onActivityCompleted,
  onAdaptiveAttempt,
  onNextSkill,
}) => {
  const traceStorageKey = studentId ? `${TRACE_STORAGE_KEY}.${studentId}` : TRACE_STORAGE_KEY;
  const [mode, setMode] = useState<FoundationSubMode>(initialMode);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const speak = useCallback(async (text: string) => {
    try {
      stopNaturalArabicAudio();
      setIsSpeaking(true);
      await playNaturalArabicAudio(text, {
        voice: 'ar-AE-FatimaNeural',
        rate: '0%',
        pitch: '0%',
      });
    } catch {
      /* ignore silent fallback */
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const stopAudio = useCallback(() => {
    stopNaturalArabicAudio();
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      stopNaturalArabicAudio();
    };
  }, [mode]);

  // ---------------------------------------------------------------------------
  // MODE 1: SANDPAPER LETTERS & SYLLABLE TRACING
  // ---------------------------------------------------------------------------
  const initialLetterObj =
    getFoundationLetter(recommendedLetterFocus) || ARABIC_FOUNDATION_LETTERS[1];
  const [selectedLetter, setSelectedLetter] = useState<FoundationLetter>(initialLetterObj);
  const [tracedLetters, setTracedLetters] = useState<string[]>(() => loadTracedSet(traceStorageKey));
  const [traceProgress, setTraceProgress] = useState(0);
  const [traceCompleted, setTraceCompleted] = useState(false);
  const [traceStep, setTraceStep] = useState<'listen' | 'forms' | 'draw'>('listen');
  const [activeFormPos, setActiveFormPos] = useState<LetterConnectionPosition>('initial');
  const [showLetterPickerModal, setShowLetterPickerModal] = useState(false);

  const selectedLetterForms = useMemo(
    () => getPositionalLetterForms(selectedLetter.letter),
    [selectedLetter.letter],
  );

  const selectedLetterIdx = ARABIC_FOUNDATION_LETTERS.findIndex(
    (item) => item.letter === selectedLetter.letter,
  );
  const selectLetter = useCallback(
    (item: FoundationLetter, autoSpeak = false) => {
      setSelectedLetter(item);
      setTraceStep('listen');
      setActiveFormPos('initial');
      setShowLetterPickerModal(false);
      if (autoSpeak) {
        void speak(item.nameAr);
      }
    },
    [speak],
  );

  useEffect(() => {
    setTracedLetters(loadTracedSet(traceStorageKey));
  }, [traceStorageKey]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitMaskRef = useRef<{ total: number; mask: Uint8Array; hit: Uint8Array } | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const traceCompletedRef = useRef(false);

  useEffect(() => {
    if (recommendedLetterFocus) {
      const found = getFoundationLetter(recommendedLetterFocus);
      if (found) setSelectedLetter(found);
    }
  }, [recommendedLetterFocus]);

  const resetSandCanvas = useCallback((letterObj: FoundationLetter) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw warm cream sandpaper background + faint letter template
    ctx.clearRect(0, 0, SAND_SIZE, SAND_SIZE);
    const grad = ctx.createRadialGradient(
      SAND_SIZE / 2,
      SAND_SIZE / 2,
      20,
      SAND_SIZE / 2,
      SAND_SIZE / 2,
      SAND_SIZE * 0.75,
    );
    grad.addColorStop(0, '#FFFDF7');
    grad.addColorStop(1, '#F3E5C8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SAND_SIZE, SAND_SIZE);

    ctx.strokeStyle = '#C9B38C';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(10, 10, SAND_SIZE - 20, SAND_SIZE - 20);
    ctx.setLineDash([]);

    // Faint sand letter guide
    ctx.fillStyle = letterObj.isLongVowel ? 'rgba(2, 132, 199, 0.22)' : 'rgba(225, 29, 72, 0.20)';
    ctx.font = 'bold 170px "Noto Naskh Arabic", "Amiri", "Segoe UI", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letterObj.letter, SAND_SIZE / 2, SAND_SIZE / 2 + 8);

    // 2. Build offscreen mask grid (40x40 cells) to detect genuine letter strokes
    const off = document.createElement('canvas');
    off.width = SAND_SIZE;
    off.height = SAND_SIZE;
    const offCtx = off.getContext('2d');
    if (offCtx) {
      offCtx.fillStyle = '#000000';
      offCtx.font = 'bold 170px "Noto Naskh Arabic", "Amiri", "Segoe UI", serif';
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';
      offCtx.fillText(letterObj.letter, SAND_SIZE / 2, SAND_SIZE / 2 + 8);

      const grid = 28;
      const step = SAND_SIZE / grid;
      const mask = new Uint8Array(grid * grid);
      const hit = new Uint8Array(grid * grid);
      const img = offCtx.getImageData(0, 0, SAND_SIZE, SAND_SIZE).data;
      let total = 0;

      for (let gy = 0; gy < grid; gy++) {
        for (let gx = 0; gx < grid; gx++) {
          let inkCount = 0;
          const startX = Math.floor(gx * step);
          const startY = Math.floor(gy * step);
          const endX = Math.min(SAND_SIZE, Math.ceil((gx + 1) * step));
          const endY = Math.min(SAND_SIZE, Math.ceil((gy + 1) * step));
          for (let py = startY; py < endY; py += 2) {
            for (let px = startX; px < endX; px += 2) {
              if (img[(py * SAND_SIZE + px) * 4 + 3] > 35) inkCount++;
            }
          }
          if (inkCount > 1) {
            mask[gy * grid + gx] = 1;
            total++;
          }
        }
      }
      hitMaskRef.current = { total: Math.max(1, total), mask, hit };
    }

    traceCompletedRef.current = false;
    setTraceProgress(0);
    setTraceCompleted(false);
  }, []);

  useEffect(() => {
    if (mode === 'trace') {
      resetSandCanvas(selectedLetter);
    }
  }, [mode, selectedLetter, traceStep, resetSandCanvas]);

  const paintAtPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * SAND_SIZE;
    const y = ((clientY - rect.top) / rect.height) * SAND_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#D97706';
    ctx.fillStyle = '#D97706';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const last = lastPointRef.current;
    ctx.beginPath();
    if (last) {
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    lastPointRef.current = { x, y };

    // Update mask hit coverage (with 1-cell neighborhood tolerance for little fingers)
    const tracker = hitMaskRef.current;
    if (tracker) {
      const grid = 28;
      const cellX = Math.floor((x / SAND_SIZE) * grid);
      const cellY = Math.floor((y / SAND_SIZE) * grid);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cellX + dx;
          const ny = cellY + dy;
          if (nx >= 0 && nx < grid && ny >= 0 && ny < grid) {
            const idx = ny * grid + nx;
            if (tracker.mask[idx] === 1) tracker.hit[idx] = 1;
          }
        }
      }
      let covered = 0;
      for (let i = 0; i < tracker.mask.length; i++) {
        if (tracker.hit[i] === 1) covered++;
      }
      const pct = Math.min(100, Math.round((covered / tracker.total) * 100));
      setTraceProgress(pct);

      if (pct >= 72 && !traceCompletedRef.current) {
        traceCompletedRef.current = true;
        setTraceCompleted(true);
        setTracedLetters((prev) => {
          const nextTraced = [...new Set([...prev, selectedLetter.letter])];
          saveTracedSet(nextTraced, traceStorageKey);
          return nextTraced;
        });
        onAdaptiveAttempt?.(selectedLetter.letter, true, true);
        void speak(`أحسنت يا ${childName}! كتبتَ حرف ${selectedLetter.nameAr} بإتقان.`);
        onActivityCompleted?.(`trace-${selectedLetter.letter}`);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // MODE 2: PHONEMIC BALLOON POP GAME (adapted from D:\ألعاب-حرف-الألف\BalloonGame)
  // ---------------------------------------------------------------------------
  interface FloatingBalloon {
    id: number;
    letterObj: FoundationLetter;
    xPercent: number;
    yPx: number;
    speed: number;
    paletteIdx: number;
    isTarget: boolean;
  }

  const prioritizedWeakLetters = useMemo(
    () => getPrioritizedWeakLetters(student, adaptiveState, recommendedLetterFocus),
    [student, adaptiveState, recommendedLetterFocus],
  );

  const [balloonTargetLetter, setBalloonTargetLetter] = useState<FoundationLetter>(initialLetterObj);
  const [balloons, setBalloons] = useState<FloatingBalloon[]>([]);
  const [balloonScore, setBalloonScore] = useState(0);
  const [balloonStreak, setBalloonStreak] = useState(0);
  const [balloonRecentErrors, setBalloonRecentErrors] = useState(0);
  const [balloonHint, setBalloonHint] = useState<string>('');
  const [balloonDone, setBalloonDone] = useState(false);

  const balloonParams = useMemo(
    () => computeAdaptiveBalloonParams(balloonStreak, balloonRecentErrors),
    [balloonStreak, balloonRecentErrors],
  );
  const balloonParamsRef = useRef(balloonParams);
  balloonParamsRef.current = balloonParams;

  const BALLOON_TARGET_SCORE = 5;
  const balloonIdRef = useRef(1);
  const balloonDoneRef = useRef(false);
  balloonDoneRef.current = balloonDone;

  const startBalloonGame = useCallback((letterObj: FoundationLetter) => {
    balloonDoneRef.current = false;
    setBalloonTargetLetter(letterObj);
    setBalloons([]);
    setBalloonScore(0);
    setBalloonStreak(0);
    setBalloonRecentErrors(0);
    setBalloonHint('');
    setBalloonDone(false);
  }, []);

  useEffect(() => {
    const firstAdaptive = prioritizedWeakLetters[0] || recommendedLetterFocus;
    if (firstAdaptive) {
      const found = getFoundationLetter(firstAdaptive);
      if (found) startBalloonGame(found);
    }
  }, [recommendedLetterFocus, prioritizedWeakLetters, startBalloonGame]);

  useEffect(() => {
    if (mode !== 'balloon' || balloonDone) return;

    const distractorPool = [
      ...(balloonTargetLetter.confusableWith
        .map((c) => getFoundationLetter(c))
        .filter(Boolean) as FoundationLetter[]),
      ...ARABIC_FOUNDATION_LETTERS.filter((l) => l.letter !== balloonTargetLetter.letter).slice(0, 5),
    ];

    let rafId = 0;
    let lastTime = performance.now();
    let lastSpawn = 0;
    let active = true;

    const spawnOne = (initialY?: number, fixedX?: number) => {
      const liveParams = balloonParamsRef.current;
      setBalloons((prev) => {
        const needsTarget = prev.filter((b) => b.isTarget).length < 2;
        const isTarget = needsTarget || Math.random() < liveParams.targetProb;
        const chosen = isTarget
          ? balloonTargetLetter
          : distractorPool[Math.floor(Math.random() * distractorPool.length)] || balloonTargetLetter;

        return [
          ...prev.slice(-10),
          {
            id: balloonIdRef.current++,
            letterObj: chosen,
            xPercent: fixedX ?? 8 + Math.random() * 76,
            yPx: initialY ?? 340,
            speed: (0.044 + Math.random() * 0.032) * liveParams.speedScale,
            paletteIdx: Math.floor(Math.random() * BALLOON_PALETTES.length),
            isTarget: chosen.letter === balloonTargetLetter.letter,
          },
        ];
      });
    };

    // Seed 3 vertically & horizontally staggered initial balloons smoothly
    spawnOne(220, 18);
    spawnOne(295, 48);
    spawnOne(360, 74);

    const tick = (now: number) => {
      if (!active || balloonDoneRef.current) return;
      const dt = Math.min(48, now - lastTime);
      lastTime = now;

      setBalloons((prev) =>
        prev
          .map((b) => ({ ...b, yPx: b.yPx - b.speed * dt }))
          .filter((b) => b.yPx > -95),
      );

      if (now - lastSpawn > balloonParamsRef.current.spawnIntervalMs) {
        lastSpawn = now;
        spawnOne();
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
    };
  }, [mode, balloonTargetLetter, balloonDone]);

  const handlePopBalloon = (balloon: FloatingBalloon) => {
    if (balloonDoneRef.current) return;
    setBalloons((prev) => prev.filter((b) => b.id !== balloon.id));
    if (balloon.isTarget) {
      const next = balloonScore + 1;
      setBalloonScore(next);
      setBalloonStreak((s) => s + 1);
      setBalloonRecentErrors(0);
      onAdaptiveAttempt?.(balloonTargetLetter.letter, true);
      setBalloonHint(`أحسنت! هذا حرف ${balloon.letterObj.nameAr} (${balloon.letterObj.soundFatha})`);
      if (next >= BALLOON_TARGET_SCORE) {
        balloonDoneRef.current = true;
        setBalloonDone(true);
        void speak(`رائع يا ${childName}! التقطتَ خمسة بالونات لحرف ${balloonTargetLetter.nameAr}.`);
        onActivityCompleted?.(`balloon-${balloonTargetLetter.letter}`);
      } else {
        void speak(balloon.letterObj.soundFatha);
      }
    } else {
      setBalloonStreak(0);
      setBalloonRecentErrors((e) => e + 1);
      onAdaptiveAttempt?.(balloonTargetLetter.letter, false);
      const msg = `هذا حرف ${balloon.letterObj.nameAr} (${balloon.letterObj.soundFatha}) — ابحث عن حرف ${balloonTargetLetter.nameAr} (${balloonTargetLetter.soundFatha}).`;
      setBalloonHint(msg);
      void speak(`${balloon.letterObj.soundFatha}! اِبْحَثْ عَنْ ${balloonTargetLetter.soundFatha}.`);
    }
  };

  // ---------------------------------------------------------------------------
  // MODE 3: PHONOLOGICAL SOUND BASKET (KG1/KG2 — Adaptive First Round)
  // ---------------------------------------------------------------------------
  const [basketIndex, setBasketIndex] = useState(() =>
    pickAdaptiveBasketIndex(PHONEMIC_BASKET_ROUNDS, student, adaptiveState),
  );
  const [basketCollected, setBasketCollected] = useState<string[]>([]);
  const [basketFeedback, setBasketFeedback] = useState<string>('');

  const activeBasket = PHONEMIC_BASKET_ROUNDS[basketIndex] || PHONEMIC_BASKET_ROUNDS[0];
  const basketChoices = useMemo(() => {
    const combined = [
      ...activeBasket.hits.map((h) => ({ ...h, isHit: true })),
      ...activeBasket.misses.map((m) => ({ ...m, isHit: false })),
    ];
    // Deterministic interleaving order so SSR/CSR & child exploration stay balanced
    return combined.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [activeBasket]);

  const basketDone = basketCollected.length >= activeBasket.hits.length;

  const handleSelectBasketRound = (idx: number) => {
    stopAudio();
    setBasketIndex(idx);
    setBasketCollected([]);
    setBasketFeedback('');
  };

  const handlePickBasketItem = (item: { art: string; name: string; isHit: boolean }) => {
    if (basketCollected.includes(item.name)) return;
    if (item.isHit) {
      const next = [...basketCollected, item.name];
      setBasketCollected(next);
      onAdaptiveAttempt?.(activeBasket.targetLetter, true);
      setBasketFeedback(`✅ ممتاز! كلمة «${item.name}» تبدأ بحرف (${activeBasket.targetLetter}).`);
      if (next.length >= activeBasket.hits.length) {
        void speak(`أحسنت يا ${childName}! جمعتَ كل صور حرف ${activeBasket.targetLetter} في السلة.`);
        onActivityCompleted?.(activeBasket.id);
      } else {
        void speak(item.name);
      }
    } else {
      onAdaptiveAttempt?.(activeBasket.targetLetter, false);
      setBasketFeedback(`💡 استمع جيدًا: «${item.name}» لا تبدأ بحرف (${activeBasket.targetLetter}).`);
      void speak(`${item.name}. لَا تَبْدَأُ بِحَرْفِ ${activeBasket.targetLetter}.`);
    }
  };

  // ---------------------------------------------------------------------------
  // MODE 4: MONTESSORI MOVABLE ALPHABET (Adaptive Weak-Word Queue + Hint Scaffolding)
  // ---------------------------------------------------------------------------
  const orderedMovableWords = useMemo(
    () => pickAdaptiveMovableWords(MOVABLE_ALPHABET_WORDS, student, adaptiveState),
    [student, adaptiveState],
  );
  const [movableIndex, setMovableIndex] = useState(0);
  const [placedCount, setPlacedCount] = useState(0);
  const [movableMisses, setMovableMisses] = useState(0);
  const [movableFeedback, setMovableFeedback] = useState<string>('');
  const [drumActiveSlotIdx, setDrumActiveSlotIdx] = useState<number | null>(null);
  const movableDrumTimerRef = useRef<number | null>(null);

  const activeMovable = orderedMovableWords[movableIndex] || orderedMovableWords[0];
  const movableDone = placedCount >= activeMovable.letters.length;
  const movableHintLetter = !movableDone && movableMisses >= 2 ? activeMovable.letters[placedCount] : null;

  const connectedWordSlots = useMemo(
    () => getWordConnectedForms(activeMovable.letters),
    [activeMovable.letters],
  );

  const stopMovableDrum = useCallback(() => {
    if (movableDrumTimerRef.current !== null) {
      window.clearTimeout(movableDrumTimerRef.current);
      movableDrumTimerRef.current = null;
    }
    setDrumActiveSlotIdx(null);
  }, []);

  useEffect(() => {
    return () => {
      stopMovableDrum();
    };
  }, [stopMovableDrum]);

  const handlePlayMovableDrum = useCallback(() => {
    stopAudio();
    stopMovableDrum();
    const total = activeMovable.letters.length;
    if (total === 0) return;

    const runBeat = (idx: number) => {
      if (idx >= total) {
        setDrumActiveSlotIdx(null);
        movableDrumTimerRef.current = null;
        void speak(activeMovable.word);
        return;
      }
      setDrumActiveSlotIdx(idx);
      playDrumClapSound(idx);
      movableDrumTimerRef.current = window.setTimeout(() => runBeat(idx + 1), 460);
    };

    runBeat(0);
  }, [activeMovable.letters.length, activeMovable.word, speak, stopAudio, stopMovableDrum]);

  const movablePalette = useMemo(() => {
    const needed = activeMovable.letters;
    const extras = ['س', 'ل', 'ن', 'ر', 'ت', 'ق', 'م', 'د'].filter((l) => !needed.includes(l)).slice(0, 4);
    const pool = [...new Set([...needed, ...extras])];
    return pool.sort((a, b) => a.localeCompare(b, 'ar'));
  }, [activeMovable]);

  const handleSelectMovableWord = (idx: number) => {
    stopAudio();
    stopMovableDrum();
    setMovableIndex(idx);
    setPlacedCount(0);
    setMovableMisses(0);
    setMovableFeedback('');
  };

  const handlePickMovableTile = (tileLetter: string) => {
    if (movableDone) return;
    const expected = activeMovable.letters[placedCount];
    const found = getFoundationLetter(tileLetter);
    const spokenTile = LONG_VOWELS.has(tileLetter)
      ? found?.nameAr || tileLetter
      : found?.soundFatha || tileLetter;
    if (tileLetter === expected) {
      onAdaptiveAttempt?.(expected, true);
      playMagneticSnapSound();
      const nextCount = placedCount + 1;
      setPlacedCount(nextCount);
      setMovableMisses(0);
      if (nextCount >= activeMovable.letters.length) {
        setMovableFeedback(`⭐ رائع! التحمت عربات الحروف وتكوّنت كلمة «${activeMovable.word}» كاملة.`);
        void speak(`رائع! ${activeMovable.word}!`);
        onActivityCompleted?.(`movable-${activeMovable.word}`);
      } else {
        setMovableFeedback(`🧲 التحم الحرف بنجاح! اختر الحرف التالي في قطار الكلمة.`);
        void speak(spokenTile);
      }
    } else {
      onAdaptiveAttempt?.(expected, false);
      setMovableMisses((m) => m + 1);
      setMovableFeedback(`هذا حرف (${spokenTile}) — استمع إلى الكلمة واختر الحرف التالي.`);
      void speak(activeMovable.word);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Sub-mode switcher inside Foundations (hidden when launched from single-skill focus player) */}
      {!singleMode && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { id: 'trace', emoji: '✋', title: 'الحروف الرملية والحركات', desc: 'تتبع و٢٨ حرفًا بالمدود' },
          { id: 'balloon', emoji: '🎈', title: 'صيد البالونات الصوتية', desc: 'تمييز الحروف المتشابهة' },
          { id: 'basket', emoji: '🧺', title: 'سلة الأصوات (٣–٦ سنوات)', desc: 'وعي صوتي بالصور' },
          { id: 'movable', emoji: '🧱', title: 'الأبجدية المتحركة', desc: 'ركّب الكلمات بالمدود' },
        ].map((item) => {
          const isActive = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                stopAudio();
                setMode(item.id as FoundationSubMode);
              }}
              className={`p-3.5 rounded-2xl border-2 text-right transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xl">{item.emoji}</span>
                <span className={`text-2xs font-bold ${isActive ? 'text-emerald-100' : 'text-slate-500'}`}>
                  {item.desc}
                </span>
              </div>
              <strong className="block text-sm font-black mt-1.5">{item.title}</strong>
            </button>
          );
        })}
      </div>
      )}

      {/* =====================================================================
          SUBMODE 1: SANDPAPER LETTER TRACING & VOWEL STRIP (1 Task Per Screen)
         ===================================================================== */}
      {mode === 'trace' && (
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Top Letter Navigation Bar — Single Letter Focus */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-emerald-600 text-white text-2xl font-black flex items-center justify-center shadow-2xs">
                {selectedLetter.letter}
              </span>
              <div>
                <span className="text-xs font-extrabold text-emerald-700 block">
                  الحرف {toArabicNum((selectedLetterIdx >= 0 ? selectedLetterIdx : 0) + 1)} من ٢٨ · أتقنت {toArabicNum(tracedLetters.length)} حرفًا
                </span>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  حرف {selectedLetter.nameAr} —{' '}
                  {traceStep === 'listen'
                    ? 'الخطوة ١: الأصوات والحركات'
                    : traceStep === 'forms'
                    ? 'الخطوة ٢: قطار أشكال الحرف 🚂'
                    : 'الخطوة ٣: الرسم بالرمل'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const prevIdx =
                    (selectedLetterIdx - 1 + ARABIC_FOUNDATION_LETTERS.length) %
                    ARABIC_FOUNDATION_LETTERS.length;
                  selectLetter(ARABIC_FOUNDATION_LETTERS[prevIdx], true);
                }}
                className="min-h-[44px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1 cursor-pointer"
                title="الحرف السابق"
              >
                <ArrowRight className="w-4 h-4" />
                <span className="hidden sm:inline">السابق</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLetterPickerModal((prev) => !prev)}
                className="min-h-[44px] px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-black cursor-pointer"
              >
                {showLetterPickerModal ? 'إغلاق قائمة الحروف ✕' : 'تغيير الحرف (٢٨) ▾'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextIdx = (selectedLetterIdx + 1) % ARABIC_FOUNDATION_LETTERS.length;
                  selectLetter(ARABIC_FOUNDATION_LETTERS[nextIdx], true);
                }}
                className="min-h-[44px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1 cursor-pointer"
                title="الحرف التالي"
              >
                <span className="hidden sm:inline">التالي</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calm 3-Step Pill Bar (One Task Per Screen) */}
          <div className="grid grid-cols-3 gap-2" dir="rtl">
            {[
              { id: 'listen' as const, label: '١. الصوت والحركات' },
              { id: 'forms' as const, label: '٢. قطار الأشكال 🚂' },
              { id: 'draw' as const, label: '٣. الرسم بالرمل ✋' },
            ].map((step) => {
              const active = traceStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setTraceStep(step.id)}
                  className={`min-h-[44px] px-2.5 py-2 rounded-2xl text-xs sm:text-sm font-black border transition-all cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  {step.label}
                </button>
              );
            })}
          </div>

          {/* On-Demand 28-Letter Picker Drawer (Hidden by default so screen has 1 task only) */}
          {showLetterPickerModal && (
            <div className="bg-white rounded-3xl p-5 border-2 border-emerald-300 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">
                  اختر الحرف الذي تريد التدرب عليه ({toArabicNum(tracedLetters.length)} / ٢٨ مكتمل):
                </h3>
                <button
                  type="button"
                  onClick={() => setShowLetterPickerModal(false)}
                  className="text-xs font-black text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg bg-slate-100 cursor-pointer"
                >
                  إغلاق ✕
                </button>
              </div>
              <div className="grid grid-cols-7 gap-2" dir="rtl">
                {ARABIC_FOUNDATION_LETTERS.map((item) => {
                  const isSelected = item.letter === selectedLetter.letter;
                  const isDone = tracedLetters.includes(item.letter);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectLetter(item, true)}
                      className={`relative aspect-square rounded-2xl border-b-4 text-2xl sm:text-3xl font-black transition-all flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'ring-4 ring-emerald-500/30 border-emerald-600 bg-emerald-100 text-emerald-950 scale-105'
                          : item.isLongVowel
                          ? 'border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100'
                          : 'border-rose-200 bg-rose-50 text-rose-950 hover:bg-rose-100'
                      }`}
                    >
                      {item.letter}
                      {isDone && (
                        <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center shadow-xs">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 1 SCREEN: LISTEN TO THE LETTER & ITS 6 VOWELS */}
          {traceStep === 'listen' && (
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
              {/* Big Hero Spotlight for the Single Active Letter */}
              <div className="rounded-3xl bg-emerald-50/75 border-2 border-emerald-200 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-24 rounded-3xl bg-white border-2 border-emerald-400 text-5xl font-black text-emerald-950 flex items-center justify-center shadow-xs shrink-0">
                    {selectedLetter.letter}
                  </div>
                  <div className="space-y-1">
                    <span className="inline-block px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black">
                      الخطوة ١ من ٣ · استمع وردد
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                      حرف {selectedLetter.nameAr}
                    </h3>
                    <p className="text-base sm:text-lg font-extrabold text-emerald-900">
                      كلمة المثال: {selectedLetter.wordAr} {selectedLetter.art}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => (isSpeaking ? stopAudio() : speak(selectedLetter.nameAr))}
                  className="min-h-[52px] px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base flex items-center gap-2 cursor-pointer shadow-xs shrink-0"
                >
                  {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  <span>انطق اسم الحرف</span>
                </button>
              </div>

              {/* 6 Vowel & Long-Vowel Cards */}
              <div className="space-y-3">
                <p className="text-base font-black text-slate-800 text-center sm:text-right">
                  اضغط على كل بطاقة لسماع صوت حرف {selectedLetter.nameAr} بالحركات القصيرة والمدود:
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3" dir="rtl">
                  {selectedLetter.vowelStrip.map((tile, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void speak(tile.say)}
                      className={`min-h-[72px] py-3 px-2 rounded-2xl border-2 font-black text-2xl sm:text-3xl transition-all hover:scale-105 cursor-pointer shadow-2xs ${
                        idx >= 3
                          ? 'bg-sky-50 border-sky-300 text-sky-900 hover:bg-sky-100'
                          : 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100'
                      }`}
                    >
                      {tile.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mirror Voice Studio: Child records their voice & hears Teacher -> Child */}
              <MirrorVoiceRecorder
                targetText={selectedLetter.wordAr}
                labelAr={`🎙️ سجّل نطقك لكلمة «${selectedLetter.wordAr}» واسمعه بجانب المعلّمة`}
                onSpeakTeacher={(txt) => speak(txt)}
              />

              {/* Single Primary CTA to advance to Step 2 (Connected Forms Train) */}
              <div className="pt-2 flex justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    playMagneticSnapSound();
                    setTraceStep('forms');
                  }}
                  className="w-full sm:w-auto min-h-[54px] px-7 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>الخطوة ٢: قطار أشكال الحرف المتصلة 🚂</span>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </section>
          )}

          {/* STEP 2 SCREEN: CONNECTED LETTER FORMS TRAIN ("الحرف يمدّ يده") */}
          {traceStep === 'forms' && (
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setTraceStep('listen')}
                  className="min-h-[44px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة للأصوات</span>
                </button>

                <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-950 text-xs font-black">
                  الخطوة ٢ من ٣ · أشكال حرف {selectedLetter.nameAr} في الكلمة
                </span>

                <button
                  type="button"
                  onClick={() => void speak(selectedLetter.wordAr)}
                  className="min-h-[44px] px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>اسمع «{selectedLetter.wordAr}»</span>
                </button>
              </div>

              <div className="rounded-3xl bg-gradient-to-b from-indigo-50/70 to-amber-50/50 border-2 border-indigo-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                      🚂 قطار أشكال حرف {selectedLetter.nameAr}
                    </h3>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">
                      {selectedLetterForms.positionHintAr}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      selectedLetterForms.connectsLeft
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {selectedLetterForms.connectsLeft ? 'يمدّ يده للاتصال ✓' : 'حرف رافص أنيق ✨'}
                  </span>
                </div>

                {/* 4 Positional Train Cars */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2" dir="rtl">
                  {[
                    {
                      pos: 'initial' as const,
                      title: 'أول الكلمة',
                      form: selectedLetterForms.initial,
                      handHint: selectedLetterForms.connectsLeft ? 'يمدّ يده ←' : 'لا يمدّ يده ←',
                    },
                    {
                      pos: 'medial' as const,
                      title: 'وسط الكلمة',
                      form: selectedLetterForms.medial,
                      handHint: selectedLetterForms.connectsLeft ? '→ يمسك الطرفين ←' : 'يمسك قبله →',
                    },
                    {
                      pos: 'final' as const,
                      title: 'آخر الكلمة',
                      form: selectedLetterForms.final,
                      handHint: '→ يمسك قبله',
                    },
                    {
                      pos: 'isolated' as const,
                      title: 'منفصلاً',
                      form: selectedLetterForms.isolated,
                      handHint: 'يقف وحده',
                    },
                  ].map((car) => {
                    const isActive = activeFormPos === car.pos;
                    return (
                      <button
                        key={car.pos}
                        type="button"
                        onClick={() => {
                          setActiveFormPos(car.pos);
                          playMagneticSnapSound();
                          void speak(car.pos === 'isolated' ? selectedLetter.nameAr : selectedLetter.soundFatha);
                        }}
                        className={`relative rounded-3xl border-2 p-4 text-center transition-all duration-300 cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-md -translate-y-1 scale-[1.03]'
                            : 'bg-white text-slate-900 border-indigo-200 hover:border-indigo-400 hover:-translate-y-0.5'
                        }`}
                      >
                        <span
                          className={`text-xs font-black block ${
                            isActive ? 'text-indigo-100' : 'text-indigo-700'
                          }`}
                        >
                          {car.title}
                        </span>
                        <span className="text-4xl sm:text-5xl font-black block my-2.5 leading-none">
                          {car.form}
                        </span>
                        {/* Animated "Reaching Hand" Bar */}
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <span
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              isActive ? 'w-12 bg-amber-300' : 'w-6 bg-indigo-200'
                            }`}
                          />
                        </div>
                        <span
                          className={`text-[11px] font-bold block mt-1.5 ${
                            isActive ? 'text-amber-100' : 'text-slate-500'
                          }`}
                        >
                          {car.handHint}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Live Word Preview Highlight */}
                <div className="bg-white rounded-2xl border border-indigo-200 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{selectedLetter.art}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-500">شاهد الحرف داخل الكلمة:</p>
                      <p className="text-2xl sm:text-3xl font-black text-slate-900">
                        {selectedLetter.wordAr}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 inline-block">
                      الشكل المختار: <strong className="text-lg mr-1">{selectedLetterForms[activeFormPos]}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-1 flex justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setTraceStep('draw')}
                  className="w-full sm:w-auto min-h-[54px] px-7 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-base flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>الخطوة ٣: ارسم حرف {selectedLetter.nameAr} بالرمل ✋</span>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </section>
          )}

          {/* STEP 3 SCREEN: TRACE THE LETTER IN GOLDEN SAND */}
          {traceStep === 'draw' && (
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5 text-center">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setTraceStep('forms')}
                  className="min-h-[44px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة لقطار الأشكال</span>
                </button>

                <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-black">
                  الخطوة ٣ من ٣ · الرسم الحسي بالرمل
                </span>

                <button
                  type="button"
                  onClick={() => resetSandCanvas(selectedLetter)}
                  className="min-h-[44px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>مسح الرمل</span>
                </button>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  ارسم حرف {selectedLetter.nameAr} ({selectedLetter.letter}) · {selectedLetter.wordAr} {selectedLetter.art}
                </h3>
                <p className="text-sm font-bold text-slate-600">
                  مرّر إصبعك أو الفأرة فوق الحرف لتلوينه بالرمل الذهبي
                </p>
              </div>

              <div className="flex justify-center">
                <canvas
                  ref={canvasRef}
                  width={SAND_SIZE}
                  height={SAND_SIZE}
                  onPointerDown={(e) => {
                    isDrawingRef.current = true;
                    lastPointRef.current = null;
                    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
                    paintAtPoint(e.clientX, e.clientY);
                  }}
                  onPointerMove={(e) => {
                    if (!isDrawingRef.current) return;
                    paintAtPoint(e.clientX, e.clientY);
                  }}
                  onPointerUp={() => {
                    isDrawingRef.current = false;
                    lastPointRef.current = null;
                  }}
                  onPointerCancel={() => {
                    isDrawingRef.current = false;
                    lastPointRef.current = null;
                  }}
                  className="rounded-3xl border-2 border-amber-300 shadow-inner touch-none cursor-crosshair max-w-full"
                  style={{ width: SAND_SIZE, height: SAND_SIZE }}
                />
              </div>

              {/* Trace progress bar */}
              <div className="max-w-sm mx-auto space-y-1.5">
                <div className="flex items-center justify-between text-sm font-black text-slate-700">
                  <span>اكتمال تتبع الحرف</span>
                  <span>{toArabicNum(traceProgress)}٪</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      traceCompleted ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${traceProgress}%` }}
                  />
                </div>
              </div>

              {traceCompleted && (
                <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-sm font-black text-emerald-950 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>أحسنت! أتقنت رسم حرف {selectedLetter.nameAr}.</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nextIdx = (selectedLetterIdx + 1) % ARABIC_FOUNDATION_LETTERS.length;
                        selectLetter(ARABIC_FOUNDATION_LETTERS[nextIdx], true);
                      }}
                      className="min-h-[44px] px-4 rounded-xl bg-white border border-emerald-400 text-emerald-900 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>الحرف التالي</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    {onNextSkill && (
                      <button
                        type="button"
                        onClick={onNextSkill}
                        className="bz-btn bz-btn-primary bg-emerald-600 hover:bg-emerald-700 text-white text-xs inline-flex items-center gap-1.5 cursor-pointer min-h-[44px] px-4"
                      >
                        <span>انتقل للمهارة التالية</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* =====================================================================
          SUBMODE 2: PHONEMIC BALLOON POP GAME (Calm & Adaptive)
         ===================================================================== */}
      {mode === 'balloon' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-14 h-14 rounded-2xl bg-sky-600 text-white text-3xl font-black flex items-center justify-center shadow-2xs shrink-0">
                {balloonTargetLetter.letter}
              </span>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  اصطد بالونات حرف «{balloonTargetLetter.nameAr}» ({balloonTargetLetter.soundFatha})
                </h2>
                <p className="text-sm font-bold text-slate-600 mt-0.5">
                  اضغط فقط على البالونات التي تحمل حرف «{balloonTargetLetter.letter}»
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-2 rounded-xl bg-amber-100 text-amber-950 font-black text-sm">
                {toArabicNum(balloonScore)} / {toArabicNum(BALLOON_TARGET_SCORE)} 🎈
              </span>
              <button
                type="button"
                onClick={() => {
                  const cycle = prioritizedWeakLetters.length > 0
                    ? prioritizedWeakLetters
                    : ['س', 'ص', 'ت', 'ط', 'د', 'ض', 'ق', 'ك', 'ب', 'ذ'];
                  const currIdx = cycle.indexOf(balloonTargetLetter.letter);
                  const nextChar = cycle[(currIdx + 1) % cycle.length];
                  const nextObj = getFoundationLetter(nextChar) || ARABIC_FOUNDATION_LETTERS[0];
                  startBalloonGame(nextObj);
                  void speak(`اِبْحَثْ عَنْ حَرْفِ ${nextObj.nameAr}: ${nextObj.soundFatha}`);
                }}
                className="min-h-[44px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تبديل الحرف</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>السرعة والتحدي يتكيّفان تلقائيًا مع دقّتك: <strong className="text-sky-800">{balloonParams.levelLabelAr}</strong></span>
          </div>

          {balloonHint && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs font-bold text-sky-950 text-center">
              {balloonHint}
            </div>
          )}

          {/* Sky Stage */}
          <div className="relative h-[340px] rounded-3xl overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50 border-2 border-sky-200 select-none">
            {!balloonDone ? (
              balloons.map((b) => {
                const pal = BALLOON_PALETTES[b.paletteIdx % BALLOON_PALETTES.length];
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handlePopBalloon(b)}
                    style={{
                      left: `${b.xPercent}%`,
                      top: `${b.yPx}px`,
                      background: `radial-gradient(circle at 32% 30%, ${pal.shine}, ${pal.body} 55%, ${pal.dark})`,
                    }}
                    className="absolute w-20 h-24 rounded-full text-white font-black text-4xl shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer border-2 border-white/40"
                    aria-label={`بالون حرف ${b.letterObj.nameAr}`}
                  >
                    <span>{b.letterObj.letter}</span>
                    <span
                      className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-slate-500/60"
                      aria-hidden="true"
                    />
                  </button>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-white/80 backdrop-blur-xs">
                <span className="text-5xl">🎉</span>
                <h3 className="text-xl font-black text-slate-900">
                  أحسنت يا {childName}! أتقنت صيد حرف {balloonTargetLetter.nameAr}
                </h3>
                <p className="text-xs text-slate-600 max-w-md">
                  تدرّبت على تمييز الحرف من الحروف القريبة منه ({balloonTargetLetter.confusableWith.join(' · ')}) بهدوء وثقة.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  {onNextSkill && (
                    <button
                      type="button"
                      onClick={onNextSkill}
                      className="bz-btn bz-btn-primary bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black inline-flex items-center gap-1.5 cursor-pointer min-h-[44px] px-5"
                    >
                      <span>انتقل للمهارة التالية</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startBalloonGame(balloonTargetLetter)}
                    className="bz-btn bz-btn-secondary text-xs cursor-pointer min-h-[44px]"
                  >
                    العب جولة جديدة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBMODE 3: PHONOLOGICAL SOUND BASKET (KG1/KG2)
         ===================================================================== */}
      {mode === 'basket' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-extrabold text-teal-700 block">
                الجولة {toArabicNum(basketIndex + 1)} من {toArabicNum(PHONEMIC_BASKET_ROUNDS.length)}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">{activeBasket.titleAr}</h2>
              <p className="text-sm font-bold text-slate-600 mt-1">{activeBasket.promptAr}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void speak(activeBasket.promptAr)}
                className="min-h-[44px] px-4 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-900 text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-teal-600" />
                <span>اسمع المطلوب</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectBasketRound((basketIndex + 1) % PHONEMIC_BASKET_ROUNDS.length)}
                className="min-h-[44px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <span>الجولة التالية</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {basketFeedback && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-950 text-center">
              {basketFeedback}
            </div>
          )}

          {/* Basket Counter Box */}
          <div className="bg-amber-50/70 rounded-2xl p-4 border-2 border-dashed border-amber-300 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-3xl">🧺</span>
              <span className="text-sm font-black text-amber-950">
                في السلة ({toArabicNum(basketCollected.length)} / {toArabicNum(activeBasket.hits.length)}):
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {basketCollected.map((name) => {
                const found = activeBasket.hits.find((h) => h.name === name);
                return (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-amber-300 rounded-xl text-xs font-black text-slate-800 shadow-2xs"
                  >
                    <span>{found?.art}</span>
                    <span>{name}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Interactive Picture-Word Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {basketChoices.map((item) => {
              const collected = basketCollected.includes(item.name);
              return (
                <button
                  key={item.name}
                  type="button"
                  disabled={collected}
                  onClick={() => handlePickBasketItem(item)}
                  className={`p-4 rounded-2xl border-2 text-center transition-all space-y-1.5 ${
                    collected
                      ? 'bg-emerald-50 border-emerald-400 opacity-55'
                      : 'bg-white border-slate-200 hover:border-teal-400 hover:-translate-y-0.5 shadow-xs'
                  }`}
                >
                  <span className="text-4xl block">{item.art}</span>
                  <span className="text-lg font-black text-slate-900 block">{item.name}</span>
                </button>
              );
            })}
          </div>

          {basketDone && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
              <p className="text-sm font-black text-emerald-950">
                🌟 ممتاز يا {childName}! ميّزتَ جميع كلمات حرف ({activeBasket.targetLetter}).
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {onNextSkill && (
                  <button
                    type="button"
                    onClick={onNextSkill}
                    className="bz-btn bz-btn-primary bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black inline-flex items-center gap-1.5 cursor-pointer min-h-[44px] px-5"
                  >
                    <span>انتقل للمهارة التالية</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSelectBasketRound((basketIndex + 1) % PHONEMIC_BASKET_ROUNDS.length)}
                  className="bz-btn bz-btn-secondary text-xs inline-flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                >
                  <span>الجولة الصوتية التالية</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUBMODE 4: MONTESSORI MOVABLE ALPHABET (WORD CONSTRUCTION)
         ===================================================================== */}
      {mode === 'movable' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-100 text-sky-900">
                  {activeMovable.focusAr}
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  كلمة {toArabicNum(movableIndex + 1)} من {toArabicNum(orderedMovableWords.length)}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                ركّب الكلمة حرفًا بحرف
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePlayMovableDrum}
                className="min-h-[44px] px-4 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <span>🥁</span>
                <span>دقّ حروف الكلمة بالإيقاع</span>
              </button>
              <button
                type="button"
                onClick={() => void speak(activeMovable.word)}
                className="min-h-[44px] px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-900 text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-indigo-600" />
                <span>اسمع الكلمة</span>
              </button>
            </div>
          </div>

          {/* Stimulus Card & Magnetic Connected Train Cars */}
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 text-center space-y-4">
            <span className="text-6xl block">{activeMovable.art}</span>
            <p className="text-xs font-extrabold text-indigo-800">
              🚂 قطار الكلمة المغناطيسي — شاهد كيف يمدّ الحرف يده ويتصل بالحرف التالي فور تركيبه!
            </p>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap" dir="rtl">
              {activeMovable.letters.map((expectedChar, slotIdx) => {
                const filled = slotIdx < placedCount;
                const isVowel = LONG_VOWELS.has(expectedChar);
                const connectedSlot = connectedWordSlots[slotIdx];
                const isDrumLit = drumActiveSlotIdx === slotIdx;
                const displayGlyph = filled ? connectedSlot?.form || expectedChar : '؟';
                const showMagnetBridge =
                  filled &&
                  Boolean(connectedSlot?.connectsToNext) &&
                  slotIdx + 1 < placedCount;
                return (
                  <React.Fragment key={slotIdx}>
                    <div
                      className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-black transition-all duration-300 ${
                        isDrumLit
                          ? 'scale-115 ring-4 ring-amber-400 bg-amber-400 text-slate-950 border-amber-500 shadow-md -translate-y-1'
                          : filled
                          ? isVowel
                            ? 'bg-sky-600 text-white border-sky-700 shadow-sm scale-105'
                            : 'bg-rose-600 text-white border-rose-700 shadow-sm scale-105'
                          : 'bg-white border-dashed border-slate-300 text-slate-300'
                      }`}
                    >
                      {displayGlyph}
                    </div>
                    {slotIdx < activeMovable.letters.length - 1 && (
                      <span
                        className={`text-sm font-black transition-all duration-300 ${
                          showMagnetBridge
                            ? 'text-indigo-600 scale-110'
                            : 'text-slate-300 scale-90'
                        }`}
                        title={showMagnetBridge ? 'التحام متصل' : 'فصل'}
                      >
                        {connectedSlot?.connectsToNext ? '🧲' : '·'}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            {movableDone && (
              <div className="space-y-3 pt-2">
                <p className="text-3xl font-black text-emerald-800">{activeMovable.word}</p>
                <MirrorVoiceRecorder
                  targetText={activeMovable.word}
                  labelAr={`🎙️ سجّل صوتك بكلمة «${activeMovable.word}» واسمعه بجانب المعلّمة`}
                  compact
                  onSpeakTeacher={(txt) => speak(txt)}
                />
              </div>
            )}
          </div>

          {movableFeedback && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 text-center">
              {movableFeedback}
            </div>
          )}

          {/* Wooden-feel Montessori Tile Palette */}
          <div className="flex flex-wrap items-center justify-center gap-2.5" dir="rtl">
            {movablePalette.map((char) => {
              const isVowel = LONG_VOWELS.has(char);
              return (
                <button
                  key={char}
                  type="button"
                  disabled={movableDone}
                  onClick={() => handlePickMovableTile(char)}
                  className={`w-14 h-14 rounded-2xl border-b-4 text-2xl font-black transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 ${
                    movableHintLetter === char
                      ? 'ring-4 ring-amber-400 bg-amber-100 border-amber-500 text-amber-950 animate-pulse'
                      : isVowel
                      ? 'bg-sky-100 border-sky-400 text-sky-900'
                      : 'bg-rose-100 border-rose-300 text-rose-950'
                  }`}
                >
                  {char}
                </button>
              );
            })}
          </div>

          {/* Navigation between words */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() =>
                handleSelectMovableWord(
                  (movableIndex - 1 + orderedMovableWords.length) % orderedMovableWords.length,
                )
              }
              className="bz-btn bz-btn-ghost text-xs flex items-center gap-1"
            >
              <ArrowRight className="w-4 h-4" />
              <span>الكلمة السابقة</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {movableDone && onNextSkill && (
                <button
                  type="button"
                  onClick={onNextSkill}
                  className="bz-btn bz-btn-primary bg-teal-600 hover:bg-teal-700 text-white text-xs flex items-center gap-1.5 cursor-pointer min-h-[44px] px-4"
                >
                  <span>انتقل للمهارة التالية</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSelectMovableWord((movableIndex + 1) % orderedMovableWords.length)}
                className="bz-btn bz-btn-primary bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <span>{movableDone ? 'انتقل للكلمة التالية' : 'تبديل الكلمة'}</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
