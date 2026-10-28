import { PHRASES, palThis, palWhere, palYes } from '../../cognitiveProfile/phrases';
import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Undo2, Play } from 'lucide-react';
import type { AssociationBlock, ChoiceItem, PalCreature, SpanTrial, Visual } from '../../cognitiveProfile/battery';
import { lex } from '../../cognitiveProfile/lexicon';
import type { ItemResponse } from '../../cognitiveProfile/scoring';
import { scoreSpanTrial } from '../../cognitiveProfile/scoring';
import { PlaybackHandle, speak, speakSegments, stopSpeech, wait } from './audio';

const PRAISE = PHRASES.praise;

// ---------------------------------------------------------------------------
// Shared visuals
// ---------------------------------------------------------------------------
export function VisualView({ visual, size = 'md' }: { visual: Visual; size?: 'sm' | 'md' | 'lg' }) {
  const emojiSize = size === 'lg' ? 'text-7xl sm:text-8xl' : size === 'md' ? 'text-5xl sm:text-6xl' : 'text-3xl';
  switch (visual.type) {
    case 'emoji':
      return (
        <span className={`${emojiSize} leading-none select-none`} role="img" aria-label={visual.label}>
          {visual.value}
        </span>
      );
    case 'glyph':
      return (
        <span
          className={`${size === 'lg' ? 'text-7xl sm:text-8xl' : visual.value.length > 2 ? 'text-4xl sm:text-5xl' : 'text-5xl sm:text-6xl'} font-black text-slate-900 leading-none select-none`}
          style={{ fontFamily: "'Noto Naskh Arabic', 'Noto Sans Arabic', serif" }}
          aria-label={visual.label}
        >
          {visual.value}
        </span>
      );
    case 'count':
      return (
        <span className="flex flex-col items-center gap-1" aria-label={`${visual.value}`}>
          <span className="text-2xl leading-none">{'🥁'.repeat(visual.value)}</span>
          <span className="text-2xl font-black text-slate-800">{['١', '٢', '٣', '٤', '٥'][visual.value - 1]}</span>
        </span>
      );
    case 'sameDifferent':
      return (
        <span className="flex flex-col items-center gap-2">
          <span className="text-5xl leading-none">{visual.value === 'same' ? '🟰' : '↔️'}</span>
          <span className="font-child text-base font-black text-slate-800">{visual.label}</span>
        </span>
      );
  }
}

type Feedback = { chosen: string; correct: boolean } | null;

function optionClass(id: string, highlight: string | null, feedback: Feedback, correctId: string, disabled: boolean) {
  const base =
    'relative flex items-center justify-center min-h-[120px] sm:min-h-[150px] rounded-3xl border-[3px] bg-white p-3 transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand-soft)]';
  if (feedback) {
    if (id === correctId && (feedback.correct || feedback.chosen !== id)) return `${base} border-emerald-500 bg-emerald-50 scale-105`;
    if (id === feedback.chosen && !feedback.correct) return `${base} border-rose-400 bg-rose-50 opacity-80`;
    return `${base} border-slate-200 opacity-50`;
  }
  if (highlight === id) return `${base} border-sun bg-sun-soft scale-105 shadow-lg`;
  return `${base} border-line shadow-sm ${disabled ? 'opacity-70' : 'hover:border-brand hover:-translate-y-0.5 cursor-pointer'}`;
}

// ---------------------------------------------------------------------------
// Choice item player
// ---------------------------------------------------------------------------
interface ChoicePlayerProps {
  item: ChoiceItem;
  /** Practice and training show right/wrong; scored items do not. */
  showFeedback: boolean;
  allowReplay?: boolean;
  onDone: (response: ItemResponse) => void;
}

export function ChoicePlayer({ item, showFeedback, allowReplay = true, onDone }: ChoicePlayerProps) {
  const [highlight, setHighlight] = useState<string | null>(null);
  const [listening, setListening] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [replays, setReplays] = useState(0);
  const readyAt = useRef(0);
  const handle = useRef<PlaybackHandle>({ cancelled: false });

  const play = async () => {
    handle.current.cancelled = true;
    stopSpeech();
    const h: PlaybackHandle = { cancelled: false };
    handle.current = h;
    setListening(true);
    await speakSegments(item.audio, h, setHighlight);
    if (!h.cancelled) {
      setListening(false);
      readyAt.current = performance.now();
    }
  };

  useEffect(() => {
    setFeedback(null);
    setReplays(0);
    play();
    return () => {
      handle.current.cancelled = true;
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const choose = async (id: string) => {
    if (feedback || listening) return;
    const rtMs = Math.round(performance.now() - readyAt.current);
    handle.current.cancelled = true;
    stopSpeech();
    setHighlight(null);
    const correct = id === item.correctId;
    const response: ItemResponse = { itemId: item.id, correct, rtMs, replays };
    setFeedback({ chosen: id, correct });
    if (showFeedback) {
      await speak(correct ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : PHRASES.lookAnswer);
      await wait(400);
    } else {
      await wait(350);
    }
    onDone(response);
  };

  const neutral = feedback && !showFeedback;

  return (
    <div className="w-full flex flex-col items-center gap-5" dir="rtl">
      {item.stimulus && (
        <div
          className={`flex items-center justify-center min-w-[140px] min-h-[130px] px-6 rounded-[2rem] border-4 bg-card transition-all ${
            highlight === 'stimulus' ? 'border-sun scale-105 shadow-lg' : 'border-line'
          }`}
        >
          <VisualView visual={item.stimulus} size="lg" />
        </div>
      )}
      <div className="flex items-center gap-3">
        <p className="font-child text-lg sm:text-xl font-black text-slate-800 text-center">{item.promptAr}</p>
        {allowReplay && (
          <button
            type="button"
            onClick={() => {
              setReplays((r) => r + 1);
              play();
            }}
            disabled={listening || Boolean(feedback)}
            className="shrink-0 w-11 h-11 rounded-full bg-brand-soft text-brand flex items-center justify-center disabled:opacity-40 cursor-pointer"
            aria-label="استمع مرة أخرى"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        )}
      </div>
      <div
        className={`grid gap-3 sm:gap-4 w-full max-w-2xl ${
          item.options.length === 2 ? 'grid-cols-2 max-w-md' : item.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'
        }`}
      >
        {item.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => choose(option.id)}
            disabled={Boolean(feedback) || listening}
            aria-label={option.visual.label}
            className={
              neutral
                ? optionClass(option.id, null, null, item.correctId, true) + (feedback?.chosen === option.id ? ' !border-brand !bg-brand-tint' : '')
                : optionClass(option.id, highlight, showFeedback ? feedback : null, item.correctId, listening)
            }
          >
            <VisualView visual={option.visual} />
          </button>
        ))}
      </div>
      <p className="text-xs font-bold text-slate-400 h-4">{listening ? 'استمع…' : ''}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Span (sequence memory) player
// ---------------------------------------------------------------------------
interface SpanPlayerProps {
  trial: SpanTrial;
  modality: 'visual' | 'auditory';
  showFeedback: boolean;
  onDone: (response: ItemResponse) => void;
}

export function SpanPlayer({ trial, modality, showFeedback, onDone }: SpanPlayerProps) {
  const [phase, setPhase] = useState<'ready' | 'present' | 'respond' | 'feedback'>('ready');
  const [shown, setShown] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const startedAt = useRef(0);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    setPhase('ready');
    setAnswer([]);
    setResult(null);
    return () => {
      cancelled.current = true;
      stopSpeech();
    };
  }, [trial.id]);

  const present = async () => {
    setPhase('present');
    await wait(500);
    for (const id of trial.sequence) {
      if (cancelled.current) return;
      if (modality === 'visual') {
        setShown(id);
        await wait(1100);
        setShown(null);
        await wait(400);
      } else {
        setShown('listening');
        await speak(lex(id).word);
        await wait(550);
      }
    }
    setShown(null);
    if (cancelled.current) return;
    startedAt.current = performance.now();
    setPhase('respond');
  };

  const tap = async (id: string) => {
    if (phase !== 'respond' || answer.length >= trial.sequence.length) return;
    const next = [...answer, id];
    setAnswer(next);
    if (next.length === trial.sequence.length) {
      const { correct, positions } = scoreSpanTrial(trial.sequence, next);
      const rtMs = Math.round(performance.now() - startedAt.current);
      setResult(correct);
      setPhase('feedback');
      if (showFeedback) {
        await speak(correct ? PHRASES.wellDone : PHRASES.lookOrder);
        await wait(correct ? 300 : 1500);
      } else {
        await wait(500);
      }
      if (!cancelled.current) onDone({ itemId: trial.id, correct, rtMs, replays: 0, partialCredit: positions });
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-5" dir="rtl">
      <div className="relative w-56 h-48 sm:w-64 sm:h-56 rounded-t-[7rem] rounded-b-3xl border-[10px] border-amber-700/80 bg-gradient-to-b from-brand-soft to-brand-tint flex items-center justify-center shadow-inner overflow-hidden">
        {phase === 'ready' && (
          <button
            type="button"
            onClick={present}
            className="font-child bz-btn bz-btn-sun bz-btn-lg text-lg"
          >
            <Play className="w-5 h-5" /> {modality === 'visual' ? 'انظر!' : 'استمع!'}
          </button>
        )}
        {phase === 'present' && modality === 'visual' && shown && (
          <span className="text-8xl animate-fade-slide-up" role="img" aria-label="صورة">
            {lex(shown).emoji}
          </span>
        )}
        {phase === 'present' && modality === 'auditory' && (
          <span className={`text-8xl ${shown ? 'animate-bounce-gentle' : ''}`} role="img" aria-label="ببغاء">🦜</span>
        )}
        {(phase === 'respond' || phase === 'feedback') && (
          <span className="text-6xl" role="img" aria-hidden="true">{modality === 'visual' ? '🏰' : '🦜'}</span>
        )}
      </div>

      {(phase === 'respond' || phase === 'feedback') && (
        <>
          <div className="flex items-center gap-2" dir="rtl">
            {trial.sequence.map((expected, i) => {
              const given = answer[i];
              const showTruth = phase === 'feedback' && showFeedback;
              return (
                <div
                  key={i}
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-4 flex items-center justify-center text-4xl bg-white ${
                    showTruth ? (given === expected ? 'border-emerald-500' : 'border-rose-400') : given ? 'border-brand' : 'border-dashed border-slate-300'
                  }`}
                >
                  {showTruth && given !== expected ? lex(expected).emoji : given ? lex(given).emoji : <span className="text-base font-black text-slate-300">{i + 1}</span>}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setAnswer((a) => a.slice(0, -1))}
              disabled={phase !== 'respond' || answer.length === 0}
              className="w-11 h-11 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center disabled:opacity-30 cursor-pointer"
              aria-label="تراجع"
            >
              <Undo2 className="w-5 h-5" />
            </button>
          </div>
          <p className="font-child text-lg font-black text-slate-800">
            {phase === 'feedback' && showFeedback ? (result ? 'أحسنت! 🌟' : 'هذا هو الترتيب الصحيح') : 'المس الصور بالترتيب'}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full max-w-xl">
            {trial.choices.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => tap(id)}
                disabled={phase !== 'respond'}
                aria-label={lex(id).word}
                className="min-h-[88px] rounded-3xl border-[3px] border-slate-200 bg-white text-5xl shadow-sm hover:border-brand cursor-pointer disabled:cursor-default"
              >
                {lex(id).emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Association (object ↔ location) player
// ---------------------------------------------------------------------------
const DOOR_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];

interface AssociationPlayerProps {
  block: AssociationBlock;
  showFeedback: boolean;
  onDone: (responses: ItemResponse[]) => void;
}

export function AssociationPlayer({ block, showFeedback, onDone }: AssociationPlayerProps) {
  const [phase, setPhase] = useState<'ready' | 'present' | 'query'>('ready');
  const [openDoor, setOpenDoor] = useState<number | null>(null);
  const [queryIndex, setQueryIndex] = useState(0);
  const [flash, setFlash] = useState<{ door: number; correct: boolean } | null>(null);
  const responses = useRef<ItemResponse[]>([]);
  const askedAt = useRef(0);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    responses.current = [];
    setPhase('ready');
    setQueryIndex(0);
    return () => {
      cancelled.current = true;
    };
  }, [block.id]);

  const present = async () => {
    setPhase('present');
    await wait(400);
    for (let i = 0; i < block.residents.length; i += 1) {
      if (cancelled.current) return;
      setOpenDoor(i);
      await wait(1600);
      setOpenDoor(null);
      await wait(350);
    }
    if (cancelled.current) return;
    askedAt.current = performance.now();
    setPhase('query');
  };

  const answer = async (door: number) => {
    if (phase !== 'query' || flash) return;
    const resident = block.queryOrder[queryIndex];
    const correctDoor = block.residents.indexOf(resident);
    const correct = door === correctDoor;
    responses.current.push({
      itemId: `${block.id}-${resident}`,
      correct,
      rtMs: Math.round(performance.now() - askedAt.current),
      replays: 0,
    });
    setFlash({ door: showFeedback ? correctDoor : door, correct });
    await wait(showFeedback ? 1100 : 400);
    setFlash(null);
    if (cancelled.current) return;
    if (queryIndex + 1 >= block.queryOrder.length) {
      onDone(responses.current);
    } else {
      setQueryIndex(queryIndex + 1);
      askedAt.current = performance.now();
    }
  };

  const currentResident = block.queryOrder[queryIndex];

  return (
    <div className="w-full flex flex-col items-center gap-6" dir="rtl">
      {phase === 'query' && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-28 h-28 rounded-full bg-amber-50 border-4 border-amber-300 flex items-center justify-center text-6xl">
            {lex(currentResident).emoji}
          </div>
          <p className="font-child text-lg font-black text-slate-800">أين بيت هذا الحيوان؟</p>
        </div>
      )}
      {phase === 'ready' && (
        <button
          type="button"
          onClick={present}
          className="font-child bz-btn bz-btn-sun bz-btn-lg text-lg"
        >
          <Play className="w-5 h-5" /> انظر إلى البيوت!
        </button>
      )}
      <div className="flex flex-wrap justify-center gap-3 sm:gap-5">
        {block.residents.map((resident, i) => {
          const isOpen = openDoor === i || (flash && showFeedback && flash.door === i);
          const flashRing = flash && flash.door === i ? (showFeedback ? 'ring-4 ring-emerald-400' : 'ring-4 ring-sky-300') : '';
          return (
            <button
              key={resident}
              type="button"
              onClick={() => answer(i)}
              disabled={phase !== 'query'}
              aria-label={`البيت ${i + 1}`}
              className={`flex flex-col items-center cursor-pointer disabled:cursor-default rounded-2xl ${flashRing}`}
            >
              <span className="text-5xl leading-none -mb-1" aria-hidden="true">🔺</span>
              <span
                className="w-20 h-24 sm:w-24 sm:h-28 rounded-b-xl flex items-end justify-center pb-2 border-4 border-white shadow-md"
                style={{ backgroundColor: DOOR_COLORS[i] }}
              >
                <span className="w-14 h-16 sm:w-16 sm:h-20 rounded-t-full bg-white/90 flex items-center justify-center text-4xl">
                  {isOpen ? lex(resident).emoji : '🚪'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paired-associate learning player
// ---------------------------------------------------------------------------
export function Creature({ creature, size = 96 }: { creature: PalCreature; size?: number }) {
  const eyes = creature.eyes === 1 ? [50] : creature.eyes === 2 ? [38, 62] : [30, 50, 70];
  const body =
    creature.shape === 'circle' ? (
      <circle cx="50" cy="55" r="34" fill={creature.color} />
    ) : creature.shape === 'square' ? (
      <rect x="18" y="22" width="64" height="64" rx="14" fill={creature.color} />
    ) : creature.shape === 'triangle' ? (
      <path d="M50 14 L88 86 L12 86 Z" fill={creature.color} strokeLinejoin="round" />
    ) : (
      <path d="M20 60 C10 30 40 12 55 22 C80 10 95 40 82 62 C90 85 55 95 45 85 C25 95 12 80 20 60 Z" fill={creature.color} />
    );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <line x1="50" y1="20" x2="50" y2="4" stroke={creature.color} strokeWidth="4" />
      <circle cx="50" cy="4" r="4" fill={creature.color} />
      {body}
      {eyes.map((x) => (
        <g key={x}>
          <circle cx={x} cy="52" r="8" fill="white" />
          <circle cx={x} cy="54" r="4" fill="#0f172a" />
        </g>
      ))}
      <path d="M38 70 Q50 78 62 70" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

interface PalPlayerProps {
  creatures: PalCreature[];
  blocks: { id: string; order: string[] }[];
  onDone: (responses: ItemResponse[], blockScores: number[]) => void;
}

export function PalPlayer({ creatures, blocks, onDone }: PalPlayerProps) {
  const [phase, setPhase] = useState<'ready' | 'learn' | 'test'>('ready');
  const [blockIndex, setBlockIndex] = useState(0);
  const [trialIndex, setTrialIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ chosen: string; correctId: string } | null>(null);
  const [listening, setListening] = useState(false);
  const responses = useRef<ItemResponse[]>([]);
  const blockScores = useRef<number[]>([]);
  const askedAt = useRef(0);
  const cancelled = useRef(false);

  useEffect(
    () => () => {
      cancelled.current = true;
      stopSpeech();
    },
    []
  );

  const byId = (id: string) => creatures.find((c) => c.id === id) as PalCreature;

  const ask = async (b: number, t: number) => {
    setListening(true);
    await speak(palWhere(byId(blocks[b].order[t]).name));
    if (cancelled.current) return;
    setListening(false);
    askedAt.current = performance.now();
  };

  const learn = async (nextBlock: number) => {
    setPhase('learn');
    for (const c of creatures) {
      if (cancelled.current) return;
      setSpotlight(c.id);
      await speak(palThis(c.name));
      await wait(500);
    }
    setSpotlight(null);
    if (cancelled.current) return;
    setBlockIndex(nextBlock);
    setTrialIndex(0);
    setPhase('test');
    await ask(nextBlock, 0);
  };

  const choose = async (id: string) => {
    if (phase !== 'test' || flash || listening) return;
    const target = blocks[blockIndex].order[trialIndex];
    const correct = id === target;
    responses.current.push({
      itemId: `${blocks[blockIndex].id}-${target}`,
      correct,
      rtMs: Math.round(performance.now() - askedAt.current),
      replays: 0,
    });
    blockScores.current[blockIndex] = (blockScores.current[blockIndex] ?? 0) + (correct ? 1 : 0);
    setFlash({ chosen: id, correctId: target });
    await speak(correct ? palYes(byId(target).name) : palThis(byId(target).name));
    await wait(300);
    setFlash(null);
    if (cancelled.current) return;
    const lastTrial = trialIndex + 1 >= blocks[blockIndex].order.length;
    if (!lastTrial) {
      setTrialIndex(trialIndex + 1);
      await ask(blockIndex, trialIndex + 1);
    } else if (blockIndex + 1 < blocks.length) {
      await learn(blockIndex + 1);
    } else {
      onDone(responses.current, blocks.map((_, i) => blockScores.current[i] ?? 0));
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-6" dir="rtl">
      {phase === 'ready' && (
        <button
          type="button"
          onClick={() => learn(0)}
          className="font-child bz-btn bz-btn-sun bz-btn-lg text-lg"
        >
          <Play className="w-5 h-5" /> تعرّف على الأصدقاء
        </button>
      )}
      {phase !== 'ready' && (
        <p className="font-child text-lg font-black text-slate-800 h-7">
          {phase === 'learn' ? 'احفظ الأسماء' : listening ? 'استمع…' : 'المس صاحب الاسم'}
          <span className="text-sm text-slate-400 font-bold mr-3">الجولة {blockIndex + 1} من {blocks.length}</span>
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {creatures.map((c) => {
          const isSpot = spotlight === c.id;
          const isCorrect = flash && flash.correctId === c.id;
          const isWrong = flash && flash.chosen === c.id && flash.chosen !== flash.correctId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => choose(c.id)}
              disabled={phase !== 'test'}
              aria-label="شخصية فضائية"
              className={`flex flex-col items-center justify-center w-32 h-36 rounded-3xl border-[3px] bg-white transition-all cursor-pointer disabled:cursor-default ${
                isSpot || isCorrect ? 'border-emerald-400 scale-105 shadow-lg' : isWrong ? 'border-rose-300' : 'border-slate-200'
              } ${phase === 'learn' && !isSpot ? 'opacity-40' : ''}`}
            >
              <Creature creature={c} />
              <span className="font-child text-base font-black text-slate-700 h-6">{isSpot || isCorrect ? c.name : ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
