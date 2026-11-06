import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, RotateCcw, Volume2 } from 'lucide-react';
import type { ChoiceItem } from '../../cognitiveProfile/battery';
import { LEXICON } from '../../cognitiveProfile/lexicon';
import { explainMistake, type Lesson, type LessonVisual } from '../../cognitiveProfile/curriculum';
import { ChoicePlayer, Pic } from './TaskPlayers';
import { speakSegments, stopSpeech, type PlaybackHandle } from './audio';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

function Visual({ visual }: { visual: LessonVisual }) {
  if (visual.kind === 'pictures') {
    return (
      <div className="flex flex-wrap justify-center gap-4">
        {visual.ids.map((id) => (
          <div
            key={id}
            className={`grid place-items-center rounded-3xl border-2 p-4 text-7xl ${visual.highlight === id ? 'border-warn bg-warn-soft opacity-80' : 'border-brand bg-brand-tint'}`}
          >
            <Pic emoji={LEXICON[id].emoji} label={LEXICON[id].word} />
            <span className="mt-2 font-child text-xl font-bold text-ink">{LEXICON[id].word}</span>
          </div>
        ))}
      </div>
    );
  }
  if (visual.kind === 'glyphs') {
    return (
      <div className="flex flex-wrap justify-center gap-4" dir="rtl">
        {visual.letters.map((l, i) => (
          <div key={l + i} className="grid place-items-center rounded-3xl border-2 border-brand bg-brand-tint px-6 py-4 min-w-[96px]">
            <span className="font-child text-7xl font-bold text-ink leading-none">{l}</span>
            {visual.notesAr?.[i] && <span className="mt-2 text-sm text-ink-2">{visual.notesAr[i]}</span>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3">
      {visual.pictureId && (
        <span className="text-7xl">
          <Pic emoji={LEXICON[visual.pictureId].emoji} label={visual.word} />
        </span>
      )}
      <div className="flex items-center gap-2" dir="rtl">
        {visual.parts.map((p, i) => (
          <span key={i} className="rounded-2xl bg-sun-soft px-4 py-2 font-child text-3xl font-bold text-ink">
            👏 {p}
          </span>
        ))}
      </div>
      <span className="font-child text-3xl font-black text-brand">= {visual.word}</span>
    </div>
  );
}

/** "I do": the app teaches the skill step by step before the child practises it. */
export function LessonPlayer({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const handle = useRef<PlaybackHandle | null>(null);
  const current = lesson.steps[step];

  const play = async () => {
    if (handle.current) handle.current.cancelled = true;
    stopSpeech();
    const h: PlaybackHandle = { cancelled: false };
    handle.current = h;
    setPlaying(true);
    await speakSegments(current.audio, h);
    if (!h.cancelled) setPlaying(false);
  };

  useEffect(() => {
    void play();
    return () => {
      if (handle.current) handle.current.cancelled = true;
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const last = step === lesson.steps.length - 1;
  return (
    <div className="flex flex-col items-center text-center gap-6 w-full max-w-2xl" dir="rtl">
      <p className="bz-badge bz-badge-brand">درس قصير · {ar(step + 1)} من {ar(lesson.steps.length)}</p>
      <h2 className="font-child text-2xl font-black text-slate-900">{lesson.titleAr}</h2>
      {current.visual && <Visual visual={current.visual} />}
      <p className="font-child text-xl leading-relaxed text-ink">{current.textAr}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="bz-btn bz-btn-ghost" onClick={play} disabled={playing}>
          <Volume2 className="w-5 h-5" /> أعد الاستماع
        </button>
        <button
          type="button"
          className="font-child bz-btn bz-btn-sun bz-btn-lg text-xl px-10"
          onClick={() => {
            if (handle.current) handle.current.cancelled = true;
            stopSpeech();
            if (last) onDone();
            else setStep(step + 1);
          }}
        >
          {last ? (
            <>
              <Play className="w-6 h-6" /> هيا نتدرّب
            </>
          ) : (
            <>
              التالي <ArrowLeft className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * "We do / You do": one practice item. A wrong first answer brings an explanation of why the
 * right answer is right, then a second try. Only the first answer is scored.
 */
export function TeachingChoicePlayer({
  item,
  guided,
  onDone,
}: {
  item: ChoiceItem;
  guided: boolean;
  onDone: (firstTryCorrect: boolean, rtMs?: number) => void;
}) {
  const [phase, setPhase] = useState<'try' | 'explain' | 'retry'>('try');
  const [replay, setReplay] = useState(0);
  const handle = useRef<PlaybackHandle | null>(null);
  const firstRtRef = useRef<number | undefined>(undefined);
  const explanation = explainMistake(item);

  useEffect(() => {
    if (phase !== 'explain' || !explanation) return;
    const h: PlaybackHandle = { cancelled: false };
    handle.current = h;
    void speakSegments(explanation.audio, h);
    return () => {
      h.cancelled = true;
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, replay]);

  return (
    <div className="flex flex-col items-center gap-4 w-full" dir="rtl">
      {guided && phase === 'try' && <span className="bz-badge bz-badge-sun">تمرين بمساعدة 🤝</span>}
      {phase === 'retry' && <span className="bz-badge bz-badge-brand">حاول مرة أخرى</span>}
      {phase === 'try' && (
        <ChoicePlayer
          key={item.id}
          item={item}
          showFeedback
          onDone={(r) => {
            firstRtRef.current = r.rtMs;
            if (r.correct || !explanation) onDone(r.correct, r.rtMs);
            else setPhase('explain');
          }}
        />
      )}
      {phase === 'explain' && explanation && (
        <div className="flex flex-col items-center text-center gap-5 max-w-xl">
          <p className="font-child text-lg font-bold text-warn">لنفهم الإجابة معًا</p>
          {explanation.pictureIds.length > 0 && <Visual visual={{ kind: 'pictures', ids: explanation.pictureIds }} />}
          {explanation.glyphs.length > 0 && <Visual visual={{ kind: 'glyphs', letters: explanation.glyphs }} />}
          <p className="font-child text-xl text-ink">{explanation.textAr}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="bz-btn bz-btn-ghost" onClick={() => setReplay((n) => n + 1)}>
              <Volume2 className="w-5 h-5" /> اسمع الشرح
            </button>
            <button
              type="button"
              className="font-child bz-btn bz-btn-sun bz-btn-lg"
              onClick={() => {
                if (handle.current) handle.current.cancelled = true;
                stopSpeech();
                setPhase('retry');
              }}
            >
              <RotateCcw className="w-5 h-5" /> حاول مرة أخرى
            </button>
          </div>
        </div>
      )}
      {phase === 'retry' && <ChoicePlayer key={`${item.id}-retry`} item={item} showFeedback onDone={() => onDone(false, firstRtRef.current)} />}
    </div>
  );
}
