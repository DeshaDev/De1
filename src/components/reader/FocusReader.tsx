/**
 * Guided reading: one short sentence on screen at a time, worked through in small steps
 * (listen → read with me word by word → read alone → quick word check), then a few
 * comprehension questions and a summary of the words that need more practice.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Headphones, RotateCcw, Settings2, Volume2, X } from 'lucide-react';
import { ARABIC_READING_PASSAGES, type ReadingPassage } from '../../data/seedData';
import { segmentArabicWordIntoSyllables } from '../../utils/learningMetrics';
import { speak, stopSpeech } from '../profile/audio';
import { chunkPassage } from './chunks';

const toArabicDigits = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const plain = (w: string) => w.replace(/[ً-ٰٟـ]/g, '').replace(/[.,،؛:!?؟«»"]/g, '').trim();
type Support = 'full' | 'light';
type Step = 'listen' | 'with-me' | 'alone' | 'check';
const STEPS: Record<Support, Step[]> = { full: ['listen', 'with-me', 'alone', 'check'], light: ['alone', 'check'] };
const STEP_LABEL: Record<Step, string> = { listen: 'استمع', 'with-me': 'اقرأ معي', alone: 'اقرأ وحدك', check: 'سؤال سريع' };

type Size = 'm' | 'l' | 'xl';
type Surface = 'cream' | 'white' | 'night';
const SIZE_PX: Record<Size, number> = { m: 28, l: 36, xl: 46 };
const SURFACE: Record<Surface, { bg: string; ink: string; label: string }> = {
  cream: { bg: '#FBF6E9', ink: '#1F2A37', label: 'كريمي' },
  white: { bg: '#FFFFFF', ink: '#111827', label: 'أبيض' },
  night: { bg: '#18222E', ink: '#F1EDE4', label: 'داكن' },
};
interface DisplayPrefs {
  size: Size;
  surface: Surface;
  syllables: boolean;
}
const PREFS_KEY = 'baseera.focusReader.prefs';
function loadPrefs(): DisplayPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) return { size: 'l', surface: 'cream', syllables: false, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return { size: 'l', surface: 'cream', syllables: false };
}

/** Seeded shuffle so a given sentence always shows its options in the same order. */
function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed * 9301 + 49297;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface WordCheck {
  target: string;
  options: string[];
}
function buildCheck(chunk: string[], passageWords: string[], problem: Set<string>, seed: number): WordCheck | null {
  const candidates = chunk.filter((w) => plain(w).length >= 3);
  if (!candidates.length) return null;
  const target =
    candidates.find((w) => problem.has(plain(w))) ??
    [...candidates].sort((a, b) => plain(b).length - plain(a).length)[seed % Math.min(2, candidates.length)];
  const seen = new Set([plain(target)]);
  const pool = passageWords
    .filter((w) => plain(w).length >= 3)
    .filter((w) => {
      const key = plain(w);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    // Prefer distractors of similar length that share the first letter, so the check needs real reading.
    .sort((a, b) => score(b) - score(a));
  function score(w: string) {
    const k = plain(w);
    const t = plain(target);
    return (k[0] === t[0] ? 2 : 0) - Math.abs(k.length - t.length) * 0.5;
  }
  const distractors = pool.slice(0, 2).map((w) => w.replace(/[.,،؛:!?؟]$/, ''));
  if (distractors.length < 2) return null;
  const clean = target.replace(/[.,،؛:!?؟]$/, '');
  return { target: clean, options: shuffle([clean, ...distractors], seed + 3) };
}

interface FocusReaderProps {
  studentName?: string;
  problematicWords?: string[];
  passageId?: string;
  /** Called with true while a reading session is open, so the page can hide its own header. */
  onReadingChange?: (reading: boolean) => void;
}

export const FocusReader: React.FC<FocusReaderProps> = ({ studentName, problematicWords = [], passageId, onReadingChange }) => {
  const [passage, setPassage] = useState<ReadingPassage | null>(null);
  const [support, setSupport] = useState<Support>('full');
  const [prefs, setPrefs] = useState<DisplayPrefs>(loadPrefs);
  const [showPrefs, setShowPrefs] = useState(false);
  const problemSet = useMemo(() => new Set(problematicWords.map(plain).filter(Boolean)), [problematicWords]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable */
    }
  }, [prefs]);
  useEffect(() => () => stopSpeech(), []);
  useEffect(() => onReadingChange?.(passage !== null), [passage, onReadingChange]);

  const prefsButton = (
    <button type="button" className="bz-btn bz-btn-ghost bz-btn-sm shrink-0" aria-label="شكل النص" aria-expanded={showPrefs} onClick={() => setShowPrefs((v) => !v)}>
      <Settings2 className="w-4 h-4" /> <span className="bz-hide-sm">شكل النص</span>
    </button>
  );
  const prefsPanel = showPrefs && (
    <div className="bz-card bz-card-pad space-y-4" role="group" aria-label="شكل النص">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink">شكل النص</p>
        <button type="button" className="bz-icon-btn" aria-label="إغلاق" onClick={() => setShowPrefs(false)}><X className="w-4 h-4" /></button>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bz-field">
          <span className="bz-label">حجم الخط</span>
          <div className="bz-option-grid cols-3">
            {(['m', 'l', 'xl'] as Size[]).map((s) => (
              <button key={s} type="button" className="bz-option" aria-pressed={prefs.size === s} onClick={() => setPrefs({ ...prefs, size: s })}>
                <span style={{ fontSize: s === 'm' ? 14 : s === 'l' ? 18 : 22 }}>أ</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bz-field">
          <span className="bz-label">الخلفية</span>
          <div className="bz-option-grid cols-3">
            {(Object.keys(SURFACE) as Surface[]).map((s) => (
              <button key={s} type="button" className="bz-option" aria-pressed={prefs.surface === s} onClick={() => setPrefs({ ...prefs, surface: s })}>
                <span className="bz-swatch" style={{ background: SURFACE[s].bg }} /> {SURFACE[s].label}
              </button>
            ))}
          </div>
        </div>
        <label className="bz-check self-end">
          <input type="checkbox" checked={prefs.syllables} onChange={(e) => setPrefs({ ...prefs, syllables: e.target.checked })} />
          <span className="text-ink-2">تقسيم الكلمات إلى مقاطع</span>
        </label>
      </div>
    </div>
  );

  if (!passage) {
    return (
      <PassagePicker
        studentName={studentName}
        initialId={passageId}
        support={support}
        onSupport={setSupport}
        problemCount={problemSet.size}
        onStart={setPassage}
      />
    );
  }
  return (
    <ReadingSession
      key={passage.id + support}
      passage={passage}
      support={support}
      prefs={prefs}
      problemSet={problemSet}
      prefsButton={prefsButton}
      prefsPanel={prefsPanel}
      onExit={() => {
        stopSpeech();
        setPassage(null);
      }}
    />
  );
};

const PassagePicker: React.FC<{
  studentName?: string;
  initialId?: string;
  support: Support;
  onSupport: (s: Support) => void;
  problemCount: number;
  onStart: (p: ReadingPassage) => void;
}> = ({ studentName, initialId, support, onSupport, problemCount, onStart }) => {
  const passages = useMemo(() => [...ARABIC_READING_PASSAGES].sort((a, b) => a.gradeLevel - b.gradeLevel), []);
  const grades = useMemo(() => [...new Set(passages.map((p) => p.gradeLevel))], [passages]);
  const initial = passages.find((p) => p.id === initialId) ?? passages[0];
  const [grade, setGrade] = useState<number>(initial.gradeLevel);
  const [selected, setSelected] = useState<string>(initial.id);
  const inGrade = passages.filter((p) => p.gradeLevel === grade);
  const chosen = passages.find((p) => p.id === selected) ?? inGrade[0];

  return (
    <div className="space-y-5 pb-28" dir="rtl">
      <section className="bz-card bz-card-pad space-y-3">
        <h2 className="bz-h3">كم مساعدة يحتاج {studentName ?? 'الطفل'}؟</h2>
        <div className="bz-segment" role="radiogroup" aria-label="مستوى المساعدة">
          <button type="button" role="radio" aria-checked={support === 'full'} aria-pressed={support === 'full'} onClick={() => onSupport('full')}>مساعدة كاملة</button>
          <button type="button" role="radio" aria-checked={support === 'light'} aria-pressed={support === 'light'} onClick={() => onSupport('light')}>قراءة مستقلة</button>
        </div>
        <p className="bz-small bz-muted">
          {support === 'full'
            ? 'لكل جملة: يستمع إليها، ثم يقرؤها معنا كلمةً كلمة، ثم وحده، ثم يجيب عن سؤال سريع.'
            : 'يقرأ كل جملة وحده، ويضغط أي كلمة ليسمعها عند الحاجة، ثم يجيب عن سؤال سريع.'}
        </p>
      </section>

      <section className="bz-card bz-card-pad space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="bz-h3">اختر نصًّا</h2>
          <div className="bz-segment" role="tablist" aria-label="الصف">
            {grades.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={grade === g}
                onClick={() => {
                  if (g === grade) return;
                  setGrade(g);
                  setSelected(passages.find((p) => p.gradeLevel === g)!.id);
                }}
              >
                الصف {toArabicDigits(g)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {inGrade.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={chosen.id === p.id}
              onClick={() => setSelected(p.id)}
              className={`text-right rounded-2xl border-2 p-4 transition ${chosen.id === p.id ? 'border-brand bg-brand-soft' : 'border-line bg-card hover:border-line-strong'}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-semibold text-ink text-lg leading-relaxed">{p.title}</span>
                {chosen.id === p.id && <Check className="w-5 h-5 text-brand shrink-0 mt-1" />}
              </span>
              <span className="block bz-small bz-muted mt-1">
                {toArabicDigits(chunkPassage(p.words).length)} جمل قصيرة · {p.diacriticLevel === 'full' ? 'مشكول بالكامل' : p.diacriticLevel === 'partial' ? 'مشكول جزئيًا' : 'بلا تشكيل تقريبًا'}
              </span>
            </button>
          ))}
        </div>
        {problemCount > 0 && (
          <p className="bz-small text-ink-2 rounded-xl bg-sun-soft p-3">
            الكلمات التي تعثّر فيها الطفل في تقييمه الأخير تأتي أولًا في الأسئلة السريعة.
          </p>
        )}
      </section>

      {/* Always on screen: what will be read, and the start button (portalled so page animations cannot unpin it). */}
      {createPortal(
      <div className="bz-action-bar" dir="rtl">
        <div className="bz-container flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="min-w-0 text-ink">
            <span className="bz-small bz-muted block">النص المختار</span>
            <span className="font-semibold truncate block">{chosen.title}</span>
          </p>
          <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={() => onStart(chosen)}>
            ابدأ القراءة <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      </div>,
      document.body
      )}
    </div>
  );
};

type Phase = { kind: 'chunk'; index: number; step: Step } | { kind: 'questions'; index: number } | { kind: 'done' };

const ReadingSession: React.FC<{
  passage: ReadingPassage;
  support: Support;
  prefs: DisplayPrefs;
  problemSet: Set<string>;
  prefsButton: React.ReactNode;
  prefsPanel: React.ReactNode;
  onExit: () => void;
}> = ({ passage, support, prefs, problemSet, prefsButton, prefsPanel, onExit }) => {
  const chunks = useMemo(() => chunkPassage(passage.words), [passage]);
  const steps = STEPS[support];
  const [phase, setPhase] = useState<Phase>({ kind: 'chunk', index: 0, step: steps[0] });
  const [cursor, setCursor] = useState(0); // word pointer in "read with me"
  const [lit, setLit] = useState<number | null>(null); // word lit while listening
  const [playing, setPlaying] = useState(false);
  const [helpWord, setHelpWord] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [practice, setPractice] = useState<string[]>([]); // words to practise again
  const [hardChunks, setHardChunks] = useState(0);
  const [checkScore, setCheckScore] = useState({ correct: 0, total: 0 });
  const [qAnswers, setQAnswers] = useState<number[]>([]);
  const playToken = useRef(0);

  const addPractice = (w: string) => {
    const clean = w.replace(/[.,،؛:!?؟]$/, '');
    setPractice((list) => (list.some((x) => plain(x) === plain(clean)) ? list : [...list, clean]));
  };

  const stopAll = () => {
    playToken.current++;
    stopSpeech();
    setPlaying(false);
    setLit(null);
  };
  useEffect(() => stopAll, []);

  // While reading, hide the site header and footer and keep the sentence at the top of the screen.
  useEffect(() => {
    document.body.classList.add('baseera-reading-focus');
    return () => document.body.classList.remove('baseera-reading-focus');
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [phase]);

  const say = async (text: string) => {
    stopAll();
    const token = ++playToken.current;
    setPlaying(true);
    await speak(text);
    if (token === playToken.current) setPlaying(false);
  };

  /** Read the sentence aloud and light each word in turn (timing estimated from word length). */
  const listenToChunk = async (chunk: string[]) => {
    stopAll();
    const token = ++playToken.current;
    setPlaying(true);
    const lengths = chunk.map((w) => Math.max(2, plain(w).length));
    const totalMs = Math.max(1200, Array.from(chunk.join(' ')).length * 95);
    const per = lengths.map((l) => (l / lengths.reduce((a, b) => a + b, 0)) * totalMs);
    let elapsed = 0;
    const timers = per.map((ms, i) => {
      const at = elapsed;
      elapsed += ms;
      return window.setTimeout(() => token === playToken.current && setLit(i), at);
    });
    await speak(chunk.join(' '));
    timers.forEach((t) => window.clearTimeout(t));
    if (token === playToken.current) {
      setPlaying(false);
      setLit(null);
    }
  };

  const goNext = () => {
    stopAll();
    setHelpWord(null);
    setAnswer(null);
    setCursor(0);
    if (phase.kind === 'chunk') {
      const at = steps.indexOf(phase.step);
      if (at < steps.length - 1) return setPhase({ ...phase, step: steps[at + 1] });
      if (phase.index < chunks.length - 1) return setPhase({ kind: 'chunk', index: phase.index + 1, step: steps[0] });
      return setPhase(passage.comprehensionQuestions.length ? { kind: 'questions', index: 0 } : { kind: 'done' });
    }
    if (phase.kind === 'questions') {
      if (phase.index < passage.comprehensionQuestions.length - 1) return setPhase({ kind: 'questions', index: phase.index + 1 });
      return setPhase({ kind: 'done' });
    }
  };

  // Overall progress across sentences and steps.
  const totalUnits = chunks.length * steps.length + passage.comprehensionQuestions.length;
  const doneUnits =
    phase.kind === 'chunk'
      ? phase.index * steps.length + steps.indexOf(phase.step)
      : phase.kind === 'questions'
        ? chunks.length * steps.length + phase.index
        : totalUnits;
  const surface = SURFACE[prefs.surface];

  const header = (
    <div className="flex items-center justify-between gap-2">
      <button type="button" className="bz-btn bz-btn-ghost bz-btn-sm shrink-0" aria-label="إنهاء القراءة" onClick={onExit}>
        <X className="w-4 h-4" /> <span className="bz-hide-sm">إنهاء القراءة</span>
      </button>
      <p className="font-semibold text-ink truncate min-w-0">{passage.title}</p>
      {prefsButton}
    </div>
  );
  const progress = (
    <div className="bz-progress" role="progressbar" aria-valuemin={0} aria-valuemax={totalUnits} aria-valuenow={doneUnits} aria-label="التقدم في القراءة">
      <span style={{ width: `${(doneUnits / totalUnits) * 100}%` }} />
    </div>
  );

  if (phase.kind === 'done') {
    const qCorrect = qAnswers.filter((a, i) => a === passage.comprehensionQuestions[i]?.correctIndex).length;
    return (
      <div className="space-y-5" dir="rtl">
        {header}
        {progress}
        <section className="bz-card bz-card-pad space-y-5 text-center">
          <div className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-brand-soft text-brand"><Check className="w-7 h-7" /></div>
          <h2 className="bz-h2">أحسنت! أنهيت قراءة النص</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-soft p-4"><dt className="bz-small bz-muted">الجمل المقروءة</dt><dd className="bz-h3 bz-num">{toArabicDigits(chunks.length)}</dd></div>
            {checkScore.total > 0 && (
              <div className="rounded-2xl bg-soft p-4"><dt className="bz-small bz-muted">الأسئلة السريعة</dt><dd className="bz-h3 bz-num">{toArabicDigits(`${checkScore.correct}/${checkScore.total}`)}</dd></div>
            )}
            {passage.comprehensionQuestions.length > 0 && (
              <div className="rounded-2xl bg-soft p-4"><dt className="bz-small bz-muted">أسئلة الفهم</dt><dd className="bz-h3 bz-num">{toArabicDigits(`${qCorrect}/${passage.comprehensionQuestions.length}`)}</dd></div>
            )}
          </dl>
          {hardChunks > 0 && <p className="bz-small text-ink-2">قال الطفل إن {toArabicDigits(hardChunks)} من الجمل كانت صعبة. أعد قراءتها معه غدًا بمساعدة كاملة.</p>}
          {practice.length > 0 ? (
            <div className="space-y-2">
              <p className="font-semibold text-ink">كلمات نتدرّب عليها مرة أخرى</p>
              <div className="flex flex-wrap justify-center gap-2">
                {practice.map((w) => (
                  <button key={w} type="button" className="bz-option" onClick={() => say(w)}>
                    <Volume2 className="w-4 h-4" /> <span className="text-lg">{w}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-ink-2">لم يحتج الطفل إلى مساعدة في أي كلمة.</p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="bz-btn bz-btn-primary" onClick={onExit}>اختر نصًّا آخر</button>
            <button type="button" className="bz-btn bz-btn-secondary" onClick={() => { setPhase({ kind: 'chunk', index: 0, step: steps[0] }); setPractice([]); setHardChunks(0); setCheckScore({ correct: 0, total: 0 }); setQAnswers([]); }}>
              <RotateCcw className="w-4 h-4" /> أعد القراءة
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (phase.kind === 'questions') {
    const q = passage.comprehensionQuestions[phase.index];
    const picked = qAnswers[phase.index];
    const answered = picked !== undefined;
    return (
      <div className="space-y-5" dir="rtl">
        {header}
        {progress}
        <section className="bz-card bz-card-pad space-y-5">
          <p className="bz-eyebrow">سؤال فهم {toArabicDigits(phase.index + 1)} من {toArabicDigits(passage.comprehensionQuestions.length)}</p>
          <div className="flex items-start gap-3">
            <button type="button" className="bz-icon-btn shrink-0" aria-label="استمع إلى السؤال" onClick={() => say(q.question)}><Volume2 className="w-5 h-5" /></button>
            <h2 className="text-2xl leading-loose font-semibold text-ink">{q.question}</h2>
          </div>
          <div className="grid gap-3">
            {q.options.map((opt, i) => {
              const isRight = i === q.correctIndex;
              const state = !answered ? '' : isRight ? 'border-brand bg-brand-soft' : picked === i ? 'border-risk bg-risk-soft' : 'opacity-60';
              return (
                <button
                  key={opt}
                  type="button"
                  aria-disabled={answered}
                  onClick={() => !answered && setQAnswers((a) => { const next = [...a]; next[phase.index] = i; return next; })}
                  className={`text-right rounded-2xl border border-line bg-card p-4 text-xl leading-loose ${state}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {answered && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold" style={{ color: picked === q.correctIndex ? 'var(--brand)' : 'var(--warn)' }}>
                {picked === q.correctIndex ? 'إجابة صحيحة!' : 'الإجابة الصحيحة مظلّلة باللون الأخضر.'}
              </p>
              <button type="button" className="bz-btn bz-btn-primary" onClick={goNext}>التالي <ArrowLeft className="w-4 h-4" /></button>
            </div>
          )}
        </section>
      </div>
    );
  }

  const chunk = chunks[phase.index];
  const check = phase.step === 'check' ? buildCheck(chunk, passage.words, problemSet, phase.index) : null;
  const stepIdx = steps.indexOf(phase.step);

  const renderWord = (w: string, i: number) => {
    const withMe = phase.step === 'with-me';
    const isCurrent = withMe ? i === cursor : lit === i;
    const dim = withMe && i !== cursor;
    const parts = prefs.syllables ? segmentArabicWordIntoSyllables(w.replace(/[.,،؛:!?؟]$/, '')) : [];
    const display =
      prefs.syllables && parts.length > 1 ? (
        <>
          {parts.map((p, k) => (
            <span key={k} style={{ color: k % 2 ? 'var(--brand)' : undefined }}>{p}</span>
          ))}
          {/[.,،؛:!?؟]$/.test(w) ? w.slice(-1) : ''}
        </>
      ) : (
        w
      );
    return (
      <button
        key={i}
        type="button"
        onClick={() => {
          setHelpWord(w);
          addPractice(w);
          void say(w.replace(/[.,،؛:!?؟]$/, ''));
        }}
        className="rounded-xl px-1.5 transition"
        style={{
          background: isCurrent ? 'rgba(242,169,59,0.35)' : 'transparent',
          opacity: dim ? 0.28 : 1,
          color: surface.ink,
        }}
        aria-label={`استمع إلى كلمة ${w}`}
      >
        {display}
      </button>
    );
  };

  const instructions: Record<Step, string> = {
    listen: 'استمع إلى الجملة وتابع الكلمات بعينك.',
    'with-me': 'اقرأ الكلمة المضيئة بصوت مسموع، ثم انتقل إلى التي بعدها.',
    alone: 'اقرأ الجملة كلها وحدك بصوت مسموع. إذا توقفت عند كلمة فاضغطها لتسمعها.',
    check: 'استمع، ثم اختر الكلمة التي سمعتها.',
  };

  return (
    <div className="flex flex-col gap-4" style={{ minHeight: 'calc(100dvh - 32px)' }} dir="rtl">
      {header}
      {progress}
      {prefsPanel}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="bz-small bz-muted">الجملة {toArabicDigits(phase.index + 1)} من {toArabicDigits(chunks.length)}</p>
        <ol className="flex gap-1.5" aria-label="خطوات الجملة">
          {steps.map((s, i) => (
            <li
              key={s}
              aria-current={i === stepIdx ? 'step' : undefined}
              className={`bz-small rounded-full px-3 py-1 ${i === stepIdx ? 'bg-brand text-on-brand font-semibold' : i < stepIdx ? 'bg-brand-soft text-brand' : 'bg-soft bz-muted'}`}
            >
              {STEP_LABEL[s]}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-5 pb-6">
      <section className="rounded-3xl border border-line p-6 sm:p-10 space-y-6" style={{ background: surface.bg }}>
        <p className="text-center font-semibold" style={{ color: surface.ink, opacity: 0.75 }}>{instructions[phase.step]}</p>

        {phase.step !== 'check' && (
          <p
            className="text-center font-semibold flex flex-wrap justify-center"
            style={{ fontSize: SIZE_PX[prefs.size], lineHeight: 2.1, wordSpacing: '0.25em', gap: '0.15em 0.35em', color: surface.ink }}
            lang="ar"
          >
            {chunk.map(renderWord)}
          </p>
        )}

        {phase.step === 'check' && check && (
          <div className="space-y-5 text-center">
            <button type="button" className="bz-btn bz-btn-secondary bz-btn-lg" onClick={() => say(check.target)}>
              <Headphones className="w-5 h-5" /> استمع إلى الكلمة
            </button>
            <div className="grid sm:grid-cols-3 gap-3">
              {check.options.map((opt) => {
                const answered = answer !== null;
                const right = opt === check.target;
                const style = !answered ? 'border-line bg-card hover:border-brand' : right ? 'border-brand bg-brand-soft' : answer === opt ? 'border-risk bg-risk-soft' : 'border-line bg-card opacity-50';
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-disabled={answered}
                    onClick={() => {
                      if (answered) return;
                      setAnswer(opt);
                      setCheckScore((s) => ({ correct: s.correct + (right ? 1 : 0), total: s.total + 1 }));
                      if (!right) addPractice(check.target);
                    }}
                    className={`rounded-2xl border-2 p-4 font-semibold text-ink disabled:cursor-default ${style}`}
                    style={{ fontSize: Math.round(SIZE_PX[prefs.size] * 0.85) }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {answer !== null && (
              <p className="font-semibold" style={{ color: answer === check.target ? 'var(--brand)' : 'var(--warn)' }}>
                {answer === check.target ? 'صحيح!' : `الكلمة هي «${check.target}». سنتدرّب عليها لاحقًا.`}
              </p>
            )}
          </div>
        )}
        {phase.step === 'check' && !check && <p className="text-center text-ink-2">لا يوجد سؤال لهذه الجملة.</p>}

        {helpWord && phase.step !== 'check' && (
          <p className="text-center bz-small" style={{ color: surface.ink, opacity: 0.8 }}>
            مقاطع الكلمة: <span className="text-xl font-semibold" style={{ letterSpacing: '0.05em' }}>{segmentArabicWordIntoSyllables(helpWord.replace(/[.,،؛:!?؟]$/, '')).join(' · ') || helpWord}</span>
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {phase.step === 'listen' && (
          <>
            <button type="button" className="bz-btn bz-btn-secondary bz-btn-lg" onClick={() => (playing ? stopAll() : listenToChunk(chunk))}>
              <Volume2 className="w-5 h-5" /> {playing ? 'إيقاف' : 'استمع إلى الجملة'}
            </button>
            <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={goNext}>أنا جاهز للقراءة <ArrowLeft className="w-5 h-5" /></button>
          </>
        )}
        {phase.step === 'with-me' && (
          <>
            <button type="button" className="bz-btn bz-btn-secondary" onClick={() => say(chunk[cursor].replace(/[.,،؛:!?؟]$/, ''))}>
              <Volume2 className="w-4 h-4" /> استمع إلى هذه الكلمة
            </button>
            {cursor < chunk.length - 1 ? (
              <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={() => { stopAll(); setHelpWord(null); setCursor((c) => c + 1); }}>
                الكلمة التالية <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={goNext}>أنهيت الجملة <ArrowLeft className="w-5 h-5" /></button>
            )}
          </>
        )}
        {phase.step === 'alone' && (
          <>
            <button type="button" className="bz-btn bz-btn-secondary bz-btn-lg" onClick={() => { setHardChunks((n) => n + 1); goNext(); }}>كانت صعبة</button>
            <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={goNext}>قرأتها <Check className="w-5 h-5" /></button>
          </>
        )}
        {phase.step === 'check' && (answer !== null || !check) && (
          <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={goNext}>
            {phase.index < chunks.length - 1 ? 'الجملة التالية' : 'إلى أسئلة الفهم'} <ArrowLeft className="w-5 h-5" />
          </button>
        )}
      </div>
      </div>
    </div>
  );
};
