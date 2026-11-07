/**
 * Players for the direct reading measures: word lists read aloud and marked by the adult,
 * the one-minute passage, rapid automatized naming, and dictation on letter tiles.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Delete, Mic, MicOff, RotateCcw, Sparkles, Timer, Volume2, X } from 'lucide-react';
import { PHRASES } from '../../cognitiveProfile/phrases';
import { lex } from '../../cognitiveProfile/lexicon';
import type { ItemResponse } from '../../cognitiveProfile/scoring';
import {
  RAN_COLUMNS,
  SPELL_KEYBOARD,
  SPELL_MAX_LETTERS,
  passageWordId,
  stripMarks,
  type RanSymbol,
  type ReadItem,
  type SpellItem,
} from '../../cognitiveProfile/readingTasks';
import { Pic } from './TaskPlayers';
import { PlaybackHandle, speak, speakSegments, stopSpeech, wait } from './audio';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const READING_FONT = { fontFamily: "'Noto Naskh Arabic', 'Amiri', serif" } as const;

/** The strip the adult uses; visually separate so the child knows it is not for them. */
function AdultPanel({ children, label = 'للبالغ' }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="w-full max-w-xl rounded-2xl border-2 border-dashed border-line bg-soft p-3 sm:p-4" role="group" aria-label={label}>
      <p className="text-[12px] font-bold text-muted mb-2">{label}</p>
      {children}
    </div>
  );
}

function useElapsed(running: boolean) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(t);
  }, [running]);
  return now;
}

// ---------------------------------------------------------------------------
// Word list read aloud with AI Voice Evaluation & Microphone
// ---------------------------------------------------------------------------
function normalizeArabicWord(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآءئؤ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[.,/#!$%^&*;:{}=\-_~()؟،«»"']/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

export function checkArabicWordMatch(spoken: string, target: string): boolean {
  if (!spoken || !target) return false;
  const nt = normalizeArabicWord(target);
  const words = normalizeArabicWord(spoken).split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (w === nt) return true;
    if (w === 'ال' + nt) return true;
    if (nt.startsWith('ال') && w === nt.slice(2)) return true;
    if (nt.length >= 3 && levenshtein(w, nt) <= 1) return true;
    if (nt.length === 2 && (w === nt || (Math.abs(w.length - nt.length) <= 1 && (w.includes(nt) || nt.includes(w))))) return true;
  }
  return false;
}

export function ReadAloudPlayer({
  item,
  practice,
  hesitationSec,
  onDone,
}: {
  item: ReadItem;
  practice: boolean;
  hesitationSec: number;
  onDone: (response: ItemResponse) => void;
}) {
  const shownAt = useRef(performance.now());
  const [marked, setMarked] = useState<boolean | null>(null);
  const now = useElapsed(marked === null);
  const waited = (now - shownAt.current) / 1000;

  // Speech Recognition & AI Evaluation States
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiState, setAiState] = useState<'idle' | 'listening' | 'correct' | 'try_again' | 'mic_denied'>('idle');
  const [hasMicSupport, setHasMicSupport] = useState(true);
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const recognitionRef = useRef<any>(null);
  const matchedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSpeech = Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
      setHasMicSupport(hasSpeech);
    }
  }, []);

  const stopRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  useEffect(() => {
    shownAt.current = performance.now();
    setMarked(null);
    setTranscript('');
    setAiState('idle');
    matchedRef.current = false;
    stopRecognition();

    return () => {
      stopRecognition();
    };
  }, [item.id]);

  const mark = async (correct: boolean) => {
    if (marked !== null) return;
    stopRecognition();
    const rtMs = Math.round(performance.now() - shownAt.current);
    setMarked(correct);
    if (practice) {
      // Practice: the child hears how the item is read, so every child starts the list knowing the task.
      await speakSegments([{ text: correct ? PHRASES.wellDone : PHRASES.readItLikeThis, pauseAfterMs: 200 }, { text: item.text }], { cancelled: false });
      await wait(300);
    } else {
      await wait(200);
    }
    onDone({ itemId: item.id, correct, rtMs, replays: 0 });
  };

  const startListening = () => {
    if (marked !== null || matchedRef.current) return;
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setHasMicSupport(false);
      setShowManual(true);
      return;
    }

    try {
      stopRecognition();
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setAiState('listening');
      };

      recognition.onresult = (event: any) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const part = event.results[i][0]?.transcript || '';
          currentText += ' ' + part;
        }
        const clean = currentText.trim();
        if (!clean) return;
        setTranscript(clean);

        if (checkArabicWordMatch(clean, item.text)) {
          if (!matchedRef.current) {
            matchedRef.current = true;
            setAiState('correct');
            stopRecognition();
            setTimeout(() => {
              void mark(true);
            }, 600);
          }
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setIsListening(false);
          setAiState('mic_denied');
          setShowManual(true);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (!matchedRef.current) {
          setAiState((prev) => (prev === 'listening' ? 'try_again' : prev));
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('SpeechRecognition failed to start:', err);
      setIsListening(false);
      setShowManual(true);
    }
  };

  const playModelAudio = async () => {
    if (isPlayingDemo) return;
    setIsPlayingDemo(true);
    stopRecognition();
    try {
      await speak(item.text);
    } finally {
      setIsPlayingDemo(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-6" dir="rtl">
      {/* Target Word Card */}
      <div className="flex flex-col items-center justify-center min-h-[170px] min-w-[280px] px-10 py-6 rounded-[2rem] border-4 border-line bg-card shadow-sm gap-3">
        <span className="text-6xl sm:text-7xl font-bold text-ink leading-[1.6] select-none" style={READING_FONT} lang="ar">
          {item.text}
        </span>
        <button
          type="button"
          onClick={playModelAudio}
          disabled={isPlayingDemo || marked !== null}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-sm font-semibold transition cursor-pointer"
          title="استمع للنطق النموذجي من المعلمة الافتراضية"
        >
          <Volume2 className={`w-4 h-4 ${isPlayingDemo ? 'animate-bounce text-amber-600' : 'text-amber-700'}`} />
          <span>{isPlayingDemo ? 'جارٍ الاستماع...' : 'استمع للكلمة'}</span>
        </button>
      </div>

      {/* Child AI Voice Recognition Section */}
      <div className="w-full max-w-md flex flex-col items-center gap-3">
        {hasMicSupport ? (
          <button
            type="button"
            onClick={isListening ? stopRecognition : startListening}
            disabled={marked !== null || aiState === 'correct'}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-md transition-all cursor-pointer transform active:scale-95 ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                : aiState === 'correct'
                ? 'bg-emerald-600 text-white ring-4 ring-emerald-200'
                : 'bg-teal-600 hover:bg-teal-700 text-white hover:shadow-lg'
            }`}
          >
            {isListening ? (
              <>
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
                </span>
                <span>🔴 الذكاء الاصطناعي يستمع... اقرأ الكلمة!</span>
              </>
            ) : aiState === 'correct' ? (
              <>
                <Check className="w-6 h-6 animate-bounce" />
                <span>🌟 أحسنت! قراءة صحيحة ومتقنة</span>
              </>
            ) : (
              <>
                <Mic className="w-6 h-6" />
                <span>🎙️ اضغط هنا واقرأ الكلمة بالصوت</span>
              </>
            )}
          </button>
        ) : (
          <div className="w-full bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-center text-sm">
            الميكروفون غير مدعوم في هذا المتصفح. استخدم التصحيح اليدوي بالأسفل.
          </div>
        )}

        {/* Live Heard Transcript */}
        {transcript && (
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-500 font-semibold mb-1">🗣️ سمعتُ من الطفل:</div>
            <div className="text-xl font-bold text-slate-800" style={READING_FONT}>
              «{transcript}»
            </div>
          </div>
        )}

        {/* AI Feedback badges */}
        {aiState === 'correct' && (
          <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 border border-emerald-300 px-4 py-2 rounded-xl text-sm font-bold animate-pulse">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <span>ممتاز! تم التحقق بالذكاء الاصطناعي بنجاح ✨</span>
          </div>
        )}

        {aiState === 'try_again' && (
          <div className="flex items-center gap-2 text-amber-800 bg-amber-50 border border-amber-300 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium">
            <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
            <span>حاول مرة ثانية بنطق أوضح، أو اضغط الميكروفون مجدداً 🔁</span>
          </div>
        )}

        {aiState === 'mic_denied' && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-center">
            تم رفض إذن الميكروفون في المتصفح. يرجى تفعيله من شريط العنوان أو استخدام التقييم اليدوي بالأسفل.
          </div>
        )}
      </div>

      {/* Manual / Adult Fallback Controls */}
      <div className="w-full max-w-xl flex flex-col items-center">
        <button
          type="button"
          onClick={() => setShowManual((prev) => !prev)}
          className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1.5 py-1.5 transition cursor-pointer"
        >
          {showManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{showManual ? 'إخفاء التقييم اليدوي' : 'أو تصحيح يدوي من ولي الأمر / المعلم'}</span>
        </button>

        {showManual && (
          <div className="w-full mt-3">
            <AdultPanel>
              <p className="bz-small text-ink-2 mb-3">هل قرأ الطفل الكلمة كلها صحيحة؟</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => mark(true)} disabled={marked !== null} className="bz-btn bz-btn-primary bz-btn-lg">
                  <Check className="w-5 h-5" /> صحيح
                </button>
                <button type="button" onClick={() => mark(false)} disabled={marked !== null} className="bz-btn bz-btn-secondary bz-btn-lg">
                  <X className="w-5 h-5" /> خطأ أو لم يقرأ
                </button>
              </div>
              <p className="text-[12px] text-muted mt-2 h-4" aria-live="polite">
                {marked === null && waited >= hesitationSec ? `مرّت ${ar(hesitationSec)} ثوانٍ دون محاولة: اضغط «خطأ» لننتقل.` : ''}
              </p>
            </AdultPanel>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One-minute passage
// ---------------------------------------------------------------------------
type PassagePhase = 'ready' | 'reading' | 'last';

export function PassagePlayer({
  title,
  words,
  timeLimitSec,
  onDone,
}: {
  title: string;
  words: string[];
  timeLimitSec: number;
  onDone: (responses: ItemResponse[], durationMs: number) => void;
}) {
  const [phase, setPhase] = useState<PassagePhase>('ready');
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const [last, setLast] = useState<number | null>(null);
  const startedAt = useRef(0);
  const duration = useRef(0);
  const now = useElapsed(phase === 'reading');
  const elapsedSec = phase === 'reading' ? Math.min(timeLimitSec, (now - startedAt.current) / 1000) : duration.current / 1000;

  useEffect(() => {
    if (phase === 'reading' && elapsedSec >= timeLimitSec) {
      duration.current = timeLimitSec * 1000;
      setPhase('last');
    }
  }, [phase, elapsedSec, timeLimitSec]);

  const toggle = (i: number) => {
    if (phase === 'reading') {
      setErrors((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        return next;
      });
    } else if (phase === 'last') setLast(i);
  };

  const finish = (lastIndex: number) => {
    const responses = words.slice(0, lastIndex + 1).map((_, i) => ({ itemId: passageWordId(i), correct: !errors.has(i), rtMs: 0, replays: 0 }));
    onDone(responses, Math.round(duration.current));
  };

  return (
    <div className="w-full flex flex-col items-center gap-5" dir="rtl">
      {phase === 'ready' ? (
        <div className="text-center space-y-3 max-w-md">
          <span className="text-6xl" aria-hidden="true">📖</span>
          <p className="bz-body">ستظهر القصة عند الضغط على «ابدأ». اضغط حين ينطق الطفل أول كلمة.</p>
        </div>
      ) : (
        <article className="w-full max-w-3xl rounded-[1.5rem] border-4 border-line bg-card p-5 sm:p-8">
          <h3 className="text-center text-3xl font-bold text-ink mb-4" style={READING_FONT} lang="ar">{title}</h3>
          <p className="text-[26px] sm:text-4xl leading-[2.1] text-ink text-start" style={READING_FONT} lang="ar">
            {words.map((w, i) => {
              const isError = errors.has(i);
              const afterLast = phase === 'last' && last !== null && i > last;
              return (
                <React.Fragment key={i}>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className={`rounded-lg px-0.5 cursor-pointer ${isError ? 'bg-rose-100 text-rose-800 line-through decoration-2' : ''} ${
                      last === i ? 'ring-4 ring-[color:var(--brand)]' : ''
                    } ${afterLast ? 'opacity-30' : ''}`}
                    aria-pressed={phase === 'reading' ? isError : last === i}
                    aria-label={phase === 'last' ? `آخر كلمة: ${w}` : isError ? `${w}: خطأ` : w}
                  >
                    {w}
                  </button>{' '}
                </React.Fragment>
              );
            })}
          </p>
        </article>
      )}

      <AdultPanel>
        {phase === 'ready' && (
          <button
            type="button"
            className="bz-btn bz-btn-primary bz-btn-lg bz-btn-block"
            onClick={() => {
              stopSpeech();
              startedAt.current = performance.now();
              setPhase('reading');
            }}
          >
            <Timer className="w-5 h-5" /> ابدأ (دقيقة واحدة)
          </button>
        )}
        {phase === 'reading' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bz-small">
              <span className="text-ink-2">المس الكلمة التي يخطئ فيها أو يتخطاها. المسها مرة ثانية لإلغاء العلامة.</span>
              <strong className="bz-num text-ink shrink-0 ms-3">{ar(Math.max(0, Math.ceil(timeLimitSec - elapsedSec)))} ث</strong>
            </div>
            <div className="bz-progress"><span style={{ width: `${(elapsedSec / timeLimitSec) * 100}%` }} /></div>
            <div className="grid sm:grid-cols-2 gap-2">
              <button
                type="button"
                className="bz-btn bz-btn-primary"
                onClick={() => {
                  duration.current = performance.now() - startedAt.current;
                  finish(words.length - 1);
                }}
              >
                <Check className="w-4 h-4" /> قرأ القصة كلها
              </button>
              <button
                type="button"
                className="bz-btn bz-btn-secondary"
                onClick={() => {
                  duration.current = performance.now() - startedAt.current;
                  setPhase('last');
                }}
              >
                توقف الطفل قبل النهاية
              </button>
            </div>
          </div>
        )}
        {phase === 'last' && (
          <div className="space-y-3">
            <p className="bz-small text-ink-2">انتهى الوقت. المس آخر كلمة قرأها الطفل، ثم احفظ.</p>
            <button type="button" className="bz-btn bz-btn-primary bz-btn-block" disabled={last === null} onClick={() => last !== null && finish(last)}>
              <Check className="w-4 h-4" /> حفظ
            </button>
          </div>
        )}
      </AdultPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rapid automatized naming
// ---------------------------------------------------------------------------
function RanCell({ symbol, display, size }: { symbol: RanSymbol; display: 'picture' | 'letter'; size: 'sm' | 'lg' }) {
  if (display === 'picture') {
    return (
      <span className={size === 'lg' ? 'text-6xl' : 'text-[34px] sm:text-[44px]'} aria-hidden="true">
        <Pic emoji={lex(symbol.value).emoji} />
      </span>
    );
  }
  return (
    <span className={`${size === 'lg' ? 'text-6xl' : 'text-[34px] sm:text-[44px]'} font-black text-ink leading-none`} style={READING_FONT} aria-hidden="true">
      {symbol.value}
    </span>
  );
}

type RanPhase = 'names' | 'ready' | 'running';

export function RanPlayer({
  symbols,
  grid,
  display,
  onDone,
}: {
  symbols: RanSymbol[];
  grid: string[];
  display: 'picture' | 'letter';
  onDone: (durationMs: number, errorCount: number) => void;
}) {
  const [phase, setPhase] = useState<RanPhase>('names');
  const [errors, setErrors] = useState(0);
  const startedAt = useRef(0);
  const now = useElapsed(phase === 'running');
  const byId = new Map(symbols.map((s) => [s.id, s]));
  const handle = useRef<PlaybackHandle>({ cancelled: false });

  useEffect(() => () => {
    handle.current.cancelled = true;
    stopSpeech();
  }, []);

  const rows: string[][] = [];
  for (let i = 0; i < grid.length; i += RAN_COLUMNS) rows.push(grid.slice(i, i + RAN_COLUMNS));

  return (
    <div className="w-full flex flex-col items-center gap-5" dir="rtl">
      {phase === 'names' && (
        <>
          <p className="font-child text-xl font-black text-ink text-center">{display === 'picture' ? 'ما اسم كل صورة؟' : 'ما اسم كل حرف؟'}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {symbols.map((s) => (
              <div key={s.id} className="grid place-items-center w-24 h-24 rounded-3xl border-[3px] border-line bg-card">
                <RanCell symbol={s} display={display} size="lg" />
              </div>
            ))}
          </div>
          <AdultPanel>
            <p className="bz-small text-ink-2 mb-3">
              اطلب من الطفل تسمية الخمسة. إذا لم يعرف اسمًا فقله له: يمكنك سماع الأسماء بالزر. يُقبل أي اسم مألوف له.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              <button
                type="button"
                className="bz-btn bz-btn-secondary"
                onClick={() => {
                  handle.current.cancelled = true;
                  stopSpeech();
                  const h: PlaybackHandle = { cancelled: false };
                  handle.current = h;
                  speakSegments(symbols.map((s) => ({ text: s.nameAr, pauseAfterMs: 300 })), h);
                }}
              >
                <Volume2 className="w-4 h-4" /> استمع للأسماء
              </button>
              <button type="button" className="bz-btn bz-btn-primary" onClick={() => setPhase('ready')}>
                يعرف الأسماء، التالي
              </button>
            </div>
          </AdultPanel>
        </>
      )}

      {phase !== 'names' && (
        <div
          className="grid gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-[1.5rem] border-4 border-line bg-card"
          style={{ gridTemplateColumns: `repeat(${RAN_COLUMNS}, minmax(0, 1fr))`, filter: phase === 'ready' ? 'blur(10px)' : undefined }}
          aria-hidden={phase === 'ready'}
        >
          {rows.flatMap((row, r) =>
            row.map((id, c) => (
              <div key={`${r}-${c}`} className="grid place-items-center w-12 h-12 sm:w-16 sm:h-16">
                <RanCell symbol={byId.get(id)!} display={display} size="sm" />
              </div>
            ))
          )}
        </div>
      )}

      {phase === 'ready' && (
        <AdultPanel>
          <p className="bz-small text-ink-2 mb-3">
            قل للطفل: «سمِّ كل {display === 'picture' ? 'الصور' : 'الحروف'} بأسرع ما تستطيع، من اليمين إلى اليسار، سطرًا سطرًا». ثم اضغط «ابدأ» وقل «ابدأ».
          </p>
          <button
            type="button"
            className="bz-btn bz-btn-primary bz-btn-lg bz-btn-block"
            onClick={() => {
              startedAt.current = performance.now();
              setErrors(0);
              setPhase('running');
            }}
          >
            <Timer className="w-5 h-5" /> ابدأ
          </button>
        </AdultPanel>
      )}

      {phase === 'running' && (
        <AdultPanel>
          <div className="flex items-center justify-between bz-small mb-3">
            <span className="text-ink-2">اضغط «خطأ» لكل اسم خاطئ أو متخطّى، و«انتهى» فور آخر اسم.</span>
            <strong className="bz-num text-ink shrink-0 ms-3">{ar(Math.floor((now - startedAt.current) / 1000))} ث</strong>
          </div>
          <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
            <button type="button" className="bz-btn bz-btn-secondary bz-btn-lg" onClick={() => setErrors((e) => e + 1)}>
              <X className="w-5 h-5" /> خطأ ({ar(errors)})
            </button>
            <button
              type="button"
              className="bz-btn bz-btn-primary bz-btn-lg"
              onClick={() => onDone(Math.round(performance.now() - startedAt.current), errors)}
            >
              <Check className="w-5 h-5" /> انتهى
            </button>
            <button type="button" className="bz-btn bz-btn-ghost" onClick={() => setPhase('ready')} aria-label="ابدأ من جديد" title="ابدأ من جديد">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </AdultPanel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dictation on letter tiles
// ---------------------------------------------------------------------------
export function SpellingPlayer({
  item,
  practice,
  onDone,
}: {
  item: SpellItem;
  practice: boolean;
  onDone: (response: ItemResponse) => void;
}) {
  const [typed, setTyped] = useState<string[]>([]);
  const [listening, setListening] = useState(true);
  const [replays, setReplays] = useState(0);
  const [result, setResult] = useState<boolean | null>(null);
  const readyAt = useRef(0);
  const handle = useRef<PlaybackHandle>({ cancelled: false });

  const play = async () => {
    handle.current.cancelled = true;
    stopSpeech();
    const h: PlaybackHandle = { cancelled: false };
    handle.current = h;
    setListening(true);
    await speakSegments([{ text: PHRASES.writeWord, pauseAfterMs: 250 }, { text: item.spoken }], h);
    if (!h.cancelled) {
      setListening(false);
      if (!readyAt.current) readyAt.current = performance.now();
    }
  };

  useEffect(() => {
    setTyped([]);
    setResult(null);
    setReplays(0);
    readyAt.current = 0;
    play();
    return () => {
      handle.current.cancelled = true;
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const submit = async () => {
    if (result !== null || typed.length === 0) return;
    handle.current.cancelled = true;
    stopSpeech();
    const word = typed.join('');
    const correct = stripMarks(word) === item.answer;
    const rtMs = Math.round(performance.now() - (readyAt.current || performance.now()));
    setResult(correct);
    if (practice) {
      await speak(correct ? PHRASES.wellDone : PHRASES.writtenLikeThis);
      await wait(900);
    } else {
      await wait(300);
    }
    onDone({ itemId: item.id, correct, rtMs, replays, typed: word });
  };

  const disabled = result !== null;

  return (
    <div className="w-full flex flex-col items-center gap-4" dir="rtl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setReplays((r) => r + 1);
            play();
          }}
          disabled={listening || disabled}
          className="w-12 h-12 rounded-full bg-brand-soft text-brand grid place-items-center disabled:opacity-40 cursor-pointer"
          aria-label="استمع للكلمة مرة أخرى"
        >
          <Volume2 className="w-6 h-6" />
        </button>
        <div
          className={`min-w-[220px] min-h-[84px] px-6 rounded-2xl border-4 grid place-items-center ${
            result === null ? 'border-line bg-card' : practice ? (result ? 'border-emerald-500 bg-emerald-50' : 'border-rose-300 bg-rose-50') : 'border-brand bg-brand-tint'
          }`}
          aria-live="polite"
          aria-label={typed.length ? `ما كُتب: ${typed.join('')}` : 'لم يُكتب شيء بعد'}
        >
          <span className="text-5xl font-bold text-ink leading-[1.6]" style={READING_FONT} lang="ar">
            {typed.join('') || <span className="text-muted text-2xl">…</span>}
          </span>
        </div>
      </div>
      {practice && result === false && (
        <p className="text-3xl font-bold text-emerald-700" style={READING_FONT} lang="ar">{item.answer}</p>
      )}
      <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 sm:gap-2 w-full max-w-2xl" aria-label="لوحة الحروف">
        {SPELL_KEYBOARD.map((letter) => (
          <button
            key={letter}
            type="button"
            disabled={disabled || typed.length >= SPELL_MAX_LETTERS}
            onClick={() => setTyped((t) => [...t, letter])}
            className="h-12 sm:h-14 rounded-xl border-2 border-line bg-card text-3xl font-bold text-ink hover:border-brand disabled:opacity-40 cursor-pointer"
            style={READING_FONT}
            aria-label={`حرف ${letter}`}
          >
            {letter}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        <button type="button" className="bz-btn bz-btn-secondary bz-btn-lg" disabled={disabled || typed.length === 0} onClick={() => setTyped((t) => t.slice(0, -1))}>
          <Delete className="w-5 h-5" /> امسح حرفًا
        </button>
        <button type="button" className="font-child bz-btn bz-btn-sun bz-btn-lg" disabled={disabled || typed.length === 0} onClick={submit}>
          <Check className="w-5 h-5" /> تَمّ
        </button>
      </div>
      <p className="text-xs font-bold text-slate-400 h-4">{listening ? 'استمع…' : ''}</p>
    </div>
  );
}
