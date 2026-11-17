import React, { useEffect, useRef, useState } from 'react';
import { MascotMoment } from '../ui/Mascot';
import { MASCOT_LINES } from '../ui/mascotLines';
import { ArrowLeft, ArrowRight, Play, RotateCcw, Square, Volume2 } from 'lucide-react';
import type { ChoiceItem } from '../../cognitiveProfile/battery';
import { LEXICON } from '../../cognitiveProfile/lexicon';
import { explainMistake, type Lesson, type LessonVisual, HINTS } from '../../cognitiveProfile/curriculum';
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
            className={`grid place-items-center rounded-3xl border-2 p-4 text-7xl shadow-sm ${visual.highlight === id ? 'border-warn bg-warn-soft opacity-80' : 'border-brand bg-brand-tint'}`}
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
          <div key={l + i} className="grid place-items-center rounded-3xl border-2 border-brand bg-brand-tint px-6 py-4 min-w-[96px] shadow-sm">
            <span className="font-child text-7xl font-bold text-ink leading-none">{l}</span>
            {visual.notesAr?.[i] && <span className="mt-2 text-sm text-ink-2">{visual.notesAr[i]}</span>}
          </div>
        ))}
      </div>
    );
  }
  if (visual.kind === 'story') {
    return (
      <div className="w-full rounded-3xl border border-line bg-soft p-3 sm:p-4" data-testid="lesson-visual-story">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {visual.frames.map((frame, index) => (
            <div key={`${frame.titleAr}-${index}`} className="relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-card px-3 py-4 text-center shadow-xs">
              <span className="grid place-items-center min-h-16 text-5xl font-child font-black text-brand" aria-hidden="true">{frame.symbol}</span>
              <p className="font-child text-base font-black text-slate-900">{frame.titleAr}</p>
              <p className="font-child text-lg leading-relaxed text-ink">{frame.detailAr}</p>
            </div>
          ))}
        </div>
        {visual.relationAr && (
          <p className="mt-3 rounded-2xl bg-brand-tint px-4 py-3 text-center font-child text-sm font-bold leading-relaxed text-ink">
            💡 {visual.relationAr}
          </p>
        )}
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

/** "I do": a child-facing lesson with one clear idea, a visible example, and a calm hand-off. */
export function LessonPlayer({ lesson, onDone, isReview = false }: { lesson: Lesson; onDone: () => void; isReview?: boolean }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const handle = useRef<PlaybackHandle | null>(null);
  const current = lesson.steps[step];
  const last = step === lesson.steps.length - 1;
  // Some syllable lessons display the same equation in both the visual and the text.
  // Show it only once, while retaining explanations that add different information.
  const visualTextIsRedundant =
    current.visual?.kind === 'syllables' &&
    current.textAr.trim() === `${current.visual.parts.join(' + ')} = «${current.visual.word}»`;

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

  const stop = () => {
    if (handle.current) handle.current.cancelled = true;
    stopSpeech();
    setPlaying(false);
  };

  const moveTo = (nextStep: number) => {
    stop();
    setStep(nextStep);
  };

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-5 text-center" dir="rtl" data-testid="lesson-player">
      <section className="w-full rounded-3xl border border-line bg-card p-4 sm:p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="rounded-full bg-brand-tint px-3 py-1.5 font-child text-sm font-black text-brand">{isReview ? 'مراجعة المهارة' : 'شرح المهارة'}</span>
          <span className="text-xs font-bold text-slate-500">الخطوة {ar(step + 1)} من {ar(lesson.steps.length)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-soft" role="progressbar" aria-label="تقدّم الدرس" aria-valuemin={1} aria-valuemax={lesson.steps.length} aria-valuenow={step + 1}>
          <span className="block h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${((step + 1) / lesson.steps.length) * 100}%` }} />
        </div>
        <h2 className="mt-4 text-center font-child text-xl font-black leading-relaxed text-slate-900 sm:text-2xl" aria-live="polite">
          {lesson.titleAr}
        </h2>
      </section>

      {current.visual && (
        <section className="w-full" aria-label="المثال المرئي">
          <Visual visual={current.visual} />
        </section>
      )}

      {!visualTextIsRedundant && (
        <p className="max-w-2xl rounded-2xl bg-soft px-4 py-3 text-center font-child text-base leading-relaxed text-ink sm:text-lg">
          {current.textAr}
        </p>
      )}

      <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3">
        {step > 0 && (
          <button type="button" className="bz-btn bz-btn-secondary" onClick={() => moveTo(step - 1)}>
            <ArrowRight className="h-4 w-4" /> السابق
          </button>
        )}
        {playing ? (
          <button type="button" className="bz-btn bz-btn-ghost" onClick={stop} aria-label="إيقاف الصوت">
            <Square className="h-4 w-4" /> إيقاف الصوت
          </button>
        ) : (
          <button type="button" className="bz-btn bz-btn-ghost" onClick={play}>
            <Volume2 className="h-5 w-5" /> استمع
          </button>
        )}
        <button
          type="button"
          className="font-child bz-btn bz-btn-sun bz-btn-lg px-8 text-lg"
          onClick={() => {
            if (handle.current) handle.current.cancelled = true;
            stopSpeech();
            if (last) onDone();
            else moveTo(step + 1);
          }}
        >
          {last ? (
            <>
              <Play className="h-5 w-5" /> هيا نتدرّب
            </>
          ) : (
            <>
              التالي <ArrowLeft className="h-5 w-5" />
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
      {guided && phase === 'try' && (
        <div className="flex flex-col items-center gap-2 max-w-lg text-center">
          <span className="bz-badge bz-badge-sun">تمرين بمساعدة 🤝</span>
          {HINTS[item.tag || ''] && (
            <span className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-amber-900 shadow-xs">
              💡 {HINTS[item.tag || '']}
            </span>
          )}
        </div>
      )}
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
          {/* Support after a mistake: static, beside the heading, before the explanation starts. */}
          <MascotMoment mood="support" size={72} layout="row" message={MASCOT_LINES.explainMistake} />
          {explanation.syllables ? (
            <div className="flex flex-col items-center gap-3">
              {explanation.syllables.pictureId && (
                <span className="text-7xl">
                  <Pic emoji={LEXICON[explanation.syllables.pictureId].emoji} label={explanation.syllables.word} />
                </span>
              )}
              <div className="flex items-center gap-2" dir="rtl">
                {explanation.syllables.parts.map((p, i) => (
                  <span key={i} className="rounded-2xl bg-sun-soft border-2 border-sun px-4 py-2 font-child text-2xl sm:text-3xl font-bold text-ink shadow-xs">
                    👏 {p}
                  </span>
                ))}
              </div>
              <span className="font-child text-2xl sm:text-3xl font-black text-brand">= {explanation.syllables.word}</span>
            </div>
          ) : (
            <>
              {explanation.pictureIds.length > 0 && <Visual visual={{ kind: 'pictures', ids: explanation.pictureIds }} />}
              {explanation.glyphs.length > 0 && <Visual visual={{ kind: 'glyphs', letters: explanation.glyphs }} />}
            </>
          )}
          {explanation.methodTipAr && (
            <div className="w-full rounded-2xl bg-brand-tint border border-brand/20 p-3 sm:p-4 text-center">
              <p className="font-child text-base sm:text-lg font-bold text-brand leading-relaxed">{explanation.methodTipAr}</p>
            </div>
          )}
          <p className="font-child text-lg sm:text-xl text-ink leading-relaxed max-w-lg bg-soft p-4 rounded-2xl border border-line">
            {explanation.textAr}
          </p>
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
