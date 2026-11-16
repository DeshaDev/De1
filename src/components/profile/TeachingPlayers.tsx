import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MascotMoment } from '../ui/Mascot';
import { MASCOT_LINES } from '../ui/mascotLines';
import { ArrowLeft, Play, RotateCcw, Volume2 } from 'lucide-react';
import type { AudioSegment, ChoiceItem } from '../../cognitiveProfile/battery';
import { LEXICON } from '../../cognitiveProfile/lexicon';
import { explainMistake, guidedChoiceForLesson, type GuidedLessonChoice, type Lesson, type LessonVisual } from '../../cognitiveProfile/curriculum';
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
    <div className="w-full max-w-xl rounded-3xl border-2 border-amber-200 bg-amber-50/70 p-4 sm:p-5">
      <p className="font-child text-sm font-black text-amber-900 text-center mb-3">عَرَبَاتُ الْكَلِمَةِ · نَقْرَأُ مِنَ الْيَمِينِ</p>
      <div className="flex flex-wrap items-center justify-center gap-2" dir="rtl">
        {visual.parts.map((part, index) => (
          <React.Fragment key={`${part}-${index}`}>
            <div className="min-w-[82px] rounded-2xl border-2 border-brand bg-white px-3 py-3 shadow-sm flex flex-col items-center gap-1">
              <span className="text-[11px] font-bold text-slate-500">الْجُزْءُ {ar(index + 1)}</span>
              <span className="font-child text-3xl sm:text-4xl font-black text-slate-900">{part}</span>
            </div>
            {index < visual.parts.length - 1 && <span className="text-xl font-black text-amber-700" aria-hidden="true">+</span>}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-white p-3">
        {visual.pictureId && <Pic emoji={LEXICON[visual.pictureId].emoji} label={visual.word} />}
        <p className="font-child text-lg sm:text-xl font-black text-brand">عِنْدَمَا نَصِلُهَا: {visual.word}</p>
      </div>
    </div>
  );
}

function GuidedSyllableAssembly({
  activity,
  onDone,
}: {
  activity: NonNullable<Lesson['guidedAssembly']>;
  onDone: () => void;
}) {
  const [placed, setPlaced] = useState<number[]>([]);
  const [hint, setHint] = useState('اختر الجزء الذي نسمعه أولًا.');
  const [busy, setBusy] = useState(true);
  const [complete, setComplete] = useState(false);
  const handle = useRef<PlaybackHandle | null>(null);
  const choices = activity.parts.map((part, index) => ({ part, index }));
  const displayChoices = choices.length > 1 ? [...choices.slice(1), choices[0]] : choices;

  useEffect(() => {
    const h: PlaybackHandle = { cancelled: false };
    handle.current = h;
    void speakSegments([
      { text: 'هَيَّا نُرَكِّبُ الْكَلِمَةَ مَعًا.' },
      { text: activity.instructionAr },
    ], h).finally(() => {
      if (!h.cancelled) setBusy(false);
    });
    return () => {
      h.cancelled = true;
      stopSpeech();
    };
  }, [activity]);

  const choosePart = async (index: number) => {
    if (busy || complete || placed.includes(index)) return;
    const expectedIndex = placed.length;
    const h: PlaybackHandle = { cancelled: false };
    if (handle.current) handle.current.cancelled = true;
    stopSpeech();
    handle.current = h;
    setBusy(true);

    if (index !== expectedIndex) {
      setHint('قريب! اسمع المقطع الذي نبحث عنه، ثم اختر بطاقته.');
      await speakSegments([
        { text: 'اِسْمَعِ الْمَقْطَعَ الْأَوَّلَ، ثُمَّ ابْحَثْ عَنْهُ.' },
        { text: activity.parts[expectedIndex] },
      ], h);
      if (!h.cancelled) setBusy(false);
      return;
    }

    const next = [...placed, index];
    setPlaced(next);
    setHint(next.length === activity.parts.length ? 'رائع! لنصل الأجزاء ونقرأ الكلمة كاملة.' : 'أحسنت! اختر الجزء التالي.');
    const narration: AudioSegment[] = [{ text: activity.parts[index], pauseAfterMs: 450 }];
    if (next.length === activity.parts.length) {
      narration.push(
        { text: 'جَمَعْنَا الْمَقَاطِعَ، فَظَهَرَتِ الْكَلِمَةُ كَامِلَةً.' },
        { text: activity.word },
      );
    }
    await speakSegments(narration, h);
    if (!h.cancelled) {
      setBusy(false);
      if (next.length === activity.parts.length) setComplete(true);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-2xl text-center" dir="rtl">
      <span className="bz-badge bz-badge-sun">هَيَّا نَتَعَلَّمُ مَعًا</span>
      <MascotMoment mood="wave" size={76} layout="row" message="ساعدني يا صديقي! لنرتّب أجزاء الكلمة." />
      <h2 className="font-child text-2xl sm:text-3xl font-black text-slate-900">مَنْ يَعْرِفُ أَوَّلَ عَرَبَةٍ؟</h2>
      <p className="font-child text-lg leading-relaxed text-ink">{activity.instructionAr}</p>

      <div className="w-full rounded-3xl border-2 border-dashed border-brand/40 bg-brand-tint p-4">
        <p className="font-child text-sm font-black text-brand mb-3">قِطَارُ الْكَلِمَةِ</p>
        <div className="flex flex-wrap justify-center gap-2" dir="rtl">
          {activity.parts.map((part, index) => (
            <div key={index} className="min-w-[76px] min-h-[76px] rounded-2xl border-2 border-brand bg-white grid place-items-center px-3 py-2">
              {placed.includes(index) ? (
                <span className="font-child text-3xl font-black text-slate-900">{part}</span>
              ) : (
                <span className="text-2xl font-black text-slate-300" aria-label="مكان فارغ">؟</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="font-child text-base font-bold text-slate-700" aria-live="polite">{hint}</p>
      <div className="flex flex-wrap justify-center gap-3" dir="rtl">
        {displayChoices.map(({ part, index }) => (
          <button
            key={index}
            type="button"
            disabled={busy || complete || placed.includes(index)}
            onClick={() => void choosePart(index)}
            className={`min-w-[92px] min-h-[82px] rounded-2xl border-[3px] px-5 py-3 font-child text-3xl font-black shadow-sm transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 ${
              placed.includes(index) ? 'border-emerald-500 bg-emerald-50 text-emerald-800 opacity-60' : 'border-amber-300 bg-amber-50 text-slate-900 hover:-translate-y-1'
            }`}
          >
            {part}
          </button>
        ))}
      </div>

      {complete && (
        <div className="w-full rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl"><Pic emoji={LEXICON[activity.pictureId].emoji} label={activity.word} /></span>
            <span className="font-child text-3xl font-black text-emerald-900">{activity.word}</span>
          </div>
          <p className="font-child text-lg font-bold text-emerald-900">أَحْسَنْتَ! جَمَعْتَ الْمَقَاطِعَ وَصَنَعْتَ الْكَلِمَةَ.</p>
          <button type="button" className="font-child bz-btn bz-btn-sun bz-btn-lg text-xl px-10" onClick={onDone}>
            هَيَّا نَتَدَرَّبُ
          </button>
        </div>
      )}
    </div>
  );
}

/** One gentle, unscored "we do" question with a retry hint before the formal placement check. */
function GuidedChoiceLesson({
  activity,
  onDone,
}: {
  activity: GuidedLessonChoice;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(true);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState(activity.promptAr);
  const handle = useRef<PlaybackHandle | null>(null);

  useEffect(() => {
    const h: PlaybackHandle = { cancelled: false };
    handle.current = h;
    setBusy(true);
    void speakSegments(activity.promptAudio, h).finally(() => {
      if (!h.cancelled) setBusy(false);
    });
    return () => {
      h.cancelled = true;
      stopSpeech();
    };
  }, [activity]);

  const choose = async (id: string) => {
    if (busy || complete) return;
    if (handle.current) handle.current.cancelled = true;
    stopSpeech();
    const h: PlaybackHandle = { cancelled: false };
    handle.current = h;
    setBusy(true);

    const correct = id === activity.correctId;
    setMessage(correct ? activity.successAr : activity.hintAr);
    await speakSegments(correct ? activity.successAudio : activity.hintAudio, h);
    if (!h.cancelled) {
      if (correct) setComplete(true);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-2xl text-center" dir="rtl">
      <span className="bz-badge bz-badge-sun">نَتَعَلَّمُ مَعًا · مِنْ دُونِ دَرَجَةٍ</span>
      <MascotMoment mood={complete ? 'cheer' : 'wave'} size={78} layout="row" message={complete ? 'أحسنت! عرفت الفكرة. هيا نكمل.' : 'جرّب معي. لا بأس أن نعيد المحاولة.'} />
      <section className="w-full rounded-3xl border-2 border-amber-100 bg-amber-50/70 p-5 space-y-3">
        <p className="font-child text-2xl sm:text-3xl font-black text-slate-900">{activity.promptAr}</p>
        <p className="font-child text-base font-bold text-slate-600" aria-live="polite">{message}</p>
      </section>

      {!complete ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          {activity.options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={busy}
              onClick={() => void choose(option.id)}
              className="min-h-[92px] rounded-3xl border-[3px] border-line bg-white p-4 shadow-sm transition-all hover:border-brand hover:-translate-y-0.5 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
            >
              {option.emoji && <span className="block text-5xl mb-2"><Pic emoji={option.emoji} label={option.labelAr} /></span>}
              <span className={`font-child font-black text-slate-900 ${option.labelAr.length <= 3 ? 'text-4xl' : 'text-lg leading-relaxed'}`}>{option.labelAr}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <p className="font-child text-xl font-black text-emerald-900">{activity.successAr}</p>
          <button type="button" className="font-child bz-btn bz-btn-sun bz-btn-lg text-xl px-10" onClick={onDone}>
            هَيَّا نَتَدَرَّبُ
          </button>
        </div>
      )}
      {!complete && (
        <button type="button" className="bz-btn bz-btn-ghost" disabled={busy} onClick={() => {
          if (handle.current) handle.current.cancelled = true;
          const h: PlaybackHandle = { cancelled: false };
          handle.current = h;
          setBusy(true);
          void speakSegments(activity.promptAudio, h).finally(() => {
            if (!h.cancelled) setBusy(false);
          });
        }}>
          <Volume2 className="w-5 h-5" /> أَعِدِ السُّؤَالَ
        </button>
      )}
    </div>
  );
}

/** "I do": explain the idea, show a worked example, then let the child try it with Hudhud. */
export function LessonPlayer({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const handle = useRef<PlaybackHandle | null>(null);
  const current = lesson.steps[step];
  const guidedChoice = useMemo(() => guidedChoiceForLesson(lesson), [lesson]);

  useEffect(() => {
    setStep(0);
    setAssembling(false);
  }, [lesson.key]);

  const play = async () => {
    if (!current || playing) return;
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
  }, [step, lesson.key]);

  if (lesson.guidedAssembly && assembling) {
    return <GuidedSyllableAssembly activity={lesson.guidedAssembly} onDone={onDone} />;
  }
  if (guidedChoice && assembling) {
    return <GuidedChoiceLesson activity={guidedChoice} onDone={onDone} />;
  }

  const last = step === lesson.steps.length - 1;
  const stage = step === 0
    ? 'نَكْتَشِفُ الْفِكْرَةَ'
    : current.visual
      ? 'شَاهِدِ الْمِثَالَ'
      : 'نَتَعَلَّمُ مَعًا';

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-3xl text-center" dir="rtl">
      <div className="w-full flex items-center justify-between gap-3">
        <span className="bz-badge bz-badge-brand">رِحْلَةُ التَّعَلُّمِ</span>
        <span className="text-xs font-bold text-slate-500">الْخُطْوَةُ {ar(step + 1)} مِنْ {ar(lesson.steps.length)}</span>
      </div>
      <div className="flex items-center justify-center gap-2" aria-label={`الخطوة ${step + 1} من ${lesson.steps.length}`}>
        {lesson.steps.map((_, index) => (
          <span key={index} className={`h-2.5 rounded-full transition-all ${index === step ? 'w-10 bg-brand' : index < step ? 'w-5 bg-emerald-400' : 'w-5 bg-slate-200'}`} />
        ))}
      </div>
      <section className="w-full rounded-3xl border border-amber-100 bg-gradient-to-b from-amber-50 to-white p-5 sm:p-7 flex flex-col items-center gap-5">
        {step === 0 && <MascotMoment mood="wave" size={76} layout="row" message="أنا هدهد! سأريك الفكرة خطوة خطوة. استمع إليّ." />}
        <span className="text-sm font-black text-brand">{stage}</span>
        <h2 className="font-child text-2xl sm:text-3xl font-black text-slate-900">{lesson.titleAr}</h2>
        {current.visual && <Visual visual={current.visual} />}
        <p className="font-child text-xl leading-[1.9] text-ink max-w-2xl">{current.textAr}</p>
      </section>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="bz-btn bz-btn-ghost" onClick={play} disabled={playing}>
          <Volume2 className="w-5 h-5" /> اسمع الشرح مرة أخرى
        </button>
        <button
          type="button"
          disabled={playing}
          className="font-child bz-btn bz-btn-sun bz-btn-lg text-xl px-10 disabled:opacity-50"
          onClick={() => {
            if (handle.current) handle.current.cancelled = true;
            stopSpeech();
            if (last) {
              if (lesson.guidedAssembly || guidedChoice) setAssembling(true);
              else onDone();
            } else setStep(step + 1);
          }}
        >
          {last ? (lesson.guidedAssembly ? 'هَيَّا نُرَكِّبُهَا مَعًا' : guidedChoice ? 'هَيَّا نُجَرِّبُ مَعًا' : 'هَيَّا نَتَدَرَّبُ') : 'التَّالِي'}
          <ArrowLeft className="w-5 h-5" />
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
          {/* Support after a mistake: static, beside the heading, before the explanation starts. */}
          <MascotMoment mood="support" size={72} layout="row" message={MASCOT_LINES.explainMistake} />
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
