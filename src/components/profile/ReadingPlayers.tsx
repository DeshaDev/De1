/**
 * Players for direct reading practice, verified cloud-audio passage/RAN tasks, and dictation.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, Delete, Mic, Volume2 } from 'lucide-react';
import { PHRASES } from '../../cognitiveProfile/phrases';
import { MascotMoment } from '../ui/Mascot';
import { MASCOT_LINES } from '../ui/mascotLines';
import { lex } from '../../cognitiveProfile/lexicon';
import type { CognitiveAudioAssessmentEvidence, ItemResponse } from '../../cognitiveProfile/scoring';
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
import { startWavRecording, type WavRecordingController } from './audioRecording';
import {
  assessCognitiveAudio,
  assessCognitiveAudioWord,
  finalizeCognitiveAudioWordList,
  type CognitiveAudioSessionContext,
  type CognitiveAudioTaskId,
  type CognitiveAudioWordReceipt,
} from './cognitiveAudioClient';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const READING_FONT = { fontFamily: "'Noto Naskh Arabic', 'Amiri', serif" } as const;

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
  const startedAt = useRef(performance.now());
  const handle = useRef<PlaybackHandle>({ cancelled: false });
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => {
    handle.current.cancelled = true;
    stopSpeech();
  }, [item.id]);

  const playWord = async () => {
    handle.current.cancelled = true;
    stopSpeech();
    const next: PlaybackHandle = { cancelled: false };
    handle.current = next;
    setPlaying(true);
    await speakSegments([{ text: item.text }], next);
    if (!next.cancelled) setPlaying(false);
  };

  const continuePractice = () => {
    handle.current.cancelled = true;
    stopSpeech();
    // Practice is instructional only. It does not create a scored reading response.
    onDone({ itemId: item.id, correct: false, rtMs: Math.max(0, Math.round(performance.now() - startedAt.current)), replays: 0 });
  };

  void practice;
  void hesitationSec;

  return (
    <div className="w-full max-w-xl text-center space-y-5" dir="rtl">
      <p className="bz-small text-ink-2">تدرّب على قراءة الكلمة. يمكنك الاستماع إليها ثم المحاولة بنفسك.</p>
      <div className="rounded-3xl border-4 border-line bg-card p-8 shadow-sm">
        <p className="text-5xl sm:text-6xl font-bold text-ink" style={READING_FONT} lang="ar">{item.text}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="bz-btn bz-btn-secondary" onClick={() => void playWord()} disabled={playing}>
          <Volume2 className="w-5 h-5" /> {playing ? 'يُقرأ الآن…' : 'استمع إلى الكلمة'}
        </button>
        <button type="button" className="bz-btn bz-btn-primary" onClick={continuePractice}>
          أكملت المحاولة
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verified cloud-audio assessment for the one-minute passage
// ---------------------------------------------------------------------------
type AudioTaskPhase = 'ready' | 'recording' | 'submitting' | 'error';

function audioAvailabilityMessage(session: CognitiveAudioSessionContext): string {
  if (session.guardianConsentGiven !== true) {
    return 'يلزم إقرار ولي الأمر قبل بدء الفحص.';
  }
  if (session.guardianAudioConsentGiven !== true) {
    return 'لم تُمنح موافقة منفصلة على تسجيل صوت الطفل ومعالجته. يمكنك متابعة المهمة دون درجة.';
  }
  return 'التقييم الصوتي غير متاح حاليًا لهذه الجلسة؛ ستبقى المهمة دون درجة.';
}

function audioFailureMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'UNSUPPORTED_SPEECH_DIALECT') return 'التقييم الصوتي غير متاح للهجة المختارة. لم نغيّر اللهجة تلقائيًا.';
  if (code === 'AUDIO_CONSENT_REQUIRED') return 'يلزم تسجيل موافقة ولي الأمر المنفصلة على معالجة الصوت قبل التسجيل.';
  if (code === 'AZURE_SPEECH_NOT_CONFIGURED') return 'خدمة التقييم الصوتي غير مهيّأة على الخادم؛ لم تُحتسب درجة لهذه المهمة.';
  if (code === 'AUDIO_RECORDING_UNAVAILABLE' || code === 'AUDIO_CONTEXT_UNAVAILABLE') return 'المتصفح أو الجهاز لا يدعم تسجيل الصوت المطلوب. لم تُحتسب درجة.';
  if (code === 'AUDIO_DURATION_OUT_OF_RANGE') return 'مدة التسجيل خارج النطاق المسموح. لم تُحتسب درجة.';
  if (code === 'COGNITIVE_AUDIO_ASSESSMENT_INCOMPLETE') return 'لم يتمكن محرك الصوت من حسم جميع الكلمات. لم نحسب الأخطاء أو الدرجة.';
  if (code === 'AUDIO_SERVER_UNAVAILABLE') return 'خادم التقييم الصوتي غير متصل الآن، لذلك ستبقى المهمة دون درجة.';
  if (code === 'COGNITIVE_AUDIO_WORD_UNCONFIRMED') return 'لم يتمكن محرك الصوت من حسم نطق هذه الكلمة. لم نُسجّلها خطأ؛ أعد تسجيل الكلمة وحدها.';
  if (code && /[\u0600-\u06FF]/.test(code)) return code;
  return 'تعذر إكمال التقييم الصوتي عبر الخدمة. يمكنك حفظ المهمة دون درجة وإعادة المحاولة لاحقًا.';
}

// ---------------------------------------------------------------------------
// Continuous audio assessment for real-word and made-up-word reading lists
// ---------------------------------------------------------------------------
type ReadListAudioPhase = 'ready' | 'recording' | 'finalizing' | 'error';

function createAudioAttemptId(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// One recording and one Azure assessment per visible word
// ---------------------------------------------------------------------------
export function ReadListAudioPlayer({
  title,
  items,
  taskId,
  audioSession,
  onDone,
}: {
  title: string;
  items: ReadItem[];
  taskId: Extract<CognitiveAudioTaskId, 'wordReading' | 'nonwordReading'>;
  audioSession: CognitiveAudioSessionContext;
  onDone: (responses: ItemResponse[], durationMs: number, assessment?: CognitiveAudioAssessmentEvidence) => void;
}) {
  const [phase, setPhase] = useState<ReadListAudioPhase>('ready');
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [elapsedNow, setElapsedNow] = useState(() => performance.now());
  const [errorMessage, setErrorMessage] = useState('');
  const recordingRef = useRef<WavRecordingController | null>(null);
  const startAtRef = useRef(0);
  const busyRef = useRef(false);
  const attemptIdRef = useRef('');
  const wordReceiptsRef = useRef<CognitiveAudioWordReceipt[]>([]);
  const maxWordDurationSeconds = 30;
  const supported = audioSession.guardianConsentGiven === true &&
    audioSession.guardianAudioConsentGiven === true;
  const currentItem = items[currentItemIndex];

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = window.setInterval(() => setElapsedNow(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  const elapsedSeconds = phase === 'recording'
    ? Math.max(0, (elapsedNow - startAtRef.current) / 1000)
    : 0;

  const saveWithoutScore = () => {
    if (busyRef.current) return;
    busyRef.current = true;
    recordingRef.current?.cancel();
    recordingRef.current = null;
    onDone([], 0);
  };

  // Each word is assessed in the background while the child reads the next one; the child never
  // waits for, or sees, a verdict. Results appear only in the adult's report.
  const pendingRef = useRef(new Map<string, Promise<CognitiveAudioWordReceipt>>());
  const redoRef = useRef<number[]>([]);
  const redoPassRef = useRef(false);

  const assessInBackground = (item: ReadItem, itemIndex: number, recording: Awaited<ReturnType<WavRecordingController['stop']>>) => {
    const request = () => assessCognitiveAudioWord({
      taskId,
      itemId: item.id,
      itemIndex,
      attemptId: attemptIdRef.current,
      session: audioSession,
      recording,
    });
    // One automatic retry covers a dropped connection without asking the child to read again.
    const promise = request().catch(() => request());
    pendingRef.current.set(item.id, promise);
    void promise.then((receipt) => {
      wordReceiptsRef.current = [
        ...wordReceiptsRef.current.filter((r) => r.itemId !== item.id),
        receipt,
      ].sort((a, b) => a.itemIndex - b.itemIndex);
    }).catch(() => undefined);
  };

  const finalizeList = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase('finalizing');
    setErrorMessage('');
    try {
      await Promise.allSettled([...pendingRef.current.values()]);
      const done = new Set(wordReceiptsRef.current.map((r) => r.itemId));
      const missing = items.map((item, index) => (done.has(item.id) ? -1 : index)).filter((i) => i >= 0);
      if (missing.length > 0) {
        redoRef.current = missing;
        redoPassRef.current = true;
        setErrorMessage(
          `تعذّر تقييم ${ar(missing.length)} من الكلمات بسبب الاتصال. يمكن إعادة تسجيلها فقط، أو المتابعة دون درجة.`
        );
        setPhase('error');
        return;
      }
      const assessment = await finalizeCognitiveAudioWordList({
        taskId,
        attemptId: attemptIdRef.current,
        session: audioSession,
        receipts: wordReceiptsRef.current,
      });
      if (assessment.words.length !== items.length) {
        throw new Error('INVALID_VERIFIED_AUDIO_RESPONSE');
      }
      const responses = assessment.words.map((word, index) => ({
        itemId: items[index].id,
        correct: word.errorType === 'None' || word.errorType === 'DialectVariant',
        rtMs: 0,
        replays: 0,
      }));
      onDone(responses, Math.round(assessment.durationSeconds * 1000), assessment);
    } catch (error) {
      setErrorMessage(audioFailureMessage(error));
      setPhase('error');
    } finally {
      busyRef.current = false;
    }
  };

  const goToNextWord = () => {
    if (redoRef.current.length > 0) {
      const next = redoRef.current.shift()!;
      setCurrentItemIndex(next);
      setPhase('ready');
      return;
    }
    if (!redoPassRef.current && currentItemIndex + 1 < items.length) {
      setCurrentItemIndex((prev) => prev + 1);
      setPhase('ready');
    } else {
      void finalizeList();
    }
  };

  const submitCurrentWord = async () => {
    if (
      busyRef.current ||
      !recordingRef.current ||
      !currentItem ||
      !attemptIdRef.current
    ) return;

    busyRef.current = true;
    setErrorMessage('');
    try {
      const recording = await recordingRef.current.stop();
      recordingRef.current = null;
      assessInBackground(currentItem, currentItemIndex, recording);
    } catch (error) {
      recordingRef.current = null;
      busyRef.current = false;
      setErrorMessage(audioFailureMessage(error));
      setPhase('error');
      return;
    }
    busyRef.current = false;
    goToNextWord();
  };

  useEffect(() => {
    if (phase === 'recording' && elapsedSeconds >= maxWordDurationSeconds) {
      void submitCurrentWord();
    }
  }, [phase, elapsedSeconds, currentItemIndex]);

  useEffect(() => () => {
    recordingRef.current?.cancel();
    recordingRef.current = null;
  }, []);

  const startRecording = async () => {
    if (!supported || busyRef.current || phase !== 'ready') return;
    busyRef.current = true;
    setErrorMessage('');
    try {
      if (!attemptIdRef.current) attemptIdRef.current = createAudioAttemptId();
      // Individual Arabic words are often shorter than one second. Keep the real
      // capture duration and let the server validate the short WAV clip.
      recordingRef.current = await startWavRecording({ minimumDurationSeconds: 0.25 });
      startAtRef.current = performance.now();
      setElapsedNow(startAtRef.current);
      setPhase('recording');
    } catch (error) {
      setErrorMessage(audioFailureMessage(error));
      setPhase('error');
    } finally {
      busyRef.current = false;
    }
  };

  const retry = () => {
    setErrorMessage('');
    if (wordReceiptsRef.current.length === items.length) {
      void finalizeList();
    } else if (redoRef.current.length > 0) {
      goToNextWord();
    } else {
      setPhase('ready');
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-5" dir="rtl">
      <div className="w-full max-w-3xl rounded-[2rem] border-4 border-line bg-card p-5 sm:p-8 shadow-sm space-y-5">
        <div className="text-center space-y-2">
          <span className="text-5xl" aria-hidden="true">📚</span>
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-900 border border-teal-300 shadow-2xs">
              🎧 قراءة الكلمات كلمةً كلمة
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-ink" style={READING_FONT} lang="ar">{title}</h3>
          <p className="bz-small text-ink-2">
            اقرأ الكلمة الظاهرة وحدها، ثم اضغط «أنهيت قراءة الكلمة» لتظهر الكلمة التالية.
          </p>
        </div>

        <div className="w-full max-w-2xl mx-auto space-y-3" lang="ar">
          <div className="flex items-center justify-between gap-3 text-sm font-bold text-muted">
            <span>الكلمة {ar(currentItemIndex + 1)} من {ar(items.length)}</span>
            <span>{ar(Math.round(((currentItemIndex + 1) / items.length) * 100))}٪</span>
          </div>
          <div
            className="bz-progress"
            role="progressbar"
            aria-label="التقدم في كلمات القراءة"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={currentItemIndex + 1}
          >
            <span style={{ width: String(((currentItemIndex + 1) / items.length) * 100) + '%' }} />
          </div>
          <div
            className="min-h-56 sm:min-h-64 grid place-items-center rounded-[2rem] border-4 border-line bg-soft px-5 py-10 shadow-sm"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="text-6xl sm:text-7xl font-bold text-ink text-center leading-relaxed" style={READING_FONT}>
              {currentItem?.text}
            </span>
          </div>
        </div>

        {phase === 'recording' && (
          <div className="space-y-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-sm shadow-2xs">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>نستمع إليك الآن… اقرأ الكلمة، ثم اضغط الزر أدناه.</span>
            </div>
            <div>
              <button type="button" className="bz-btn bz-btn-primary bz-btn-lg shadow-md" onClick={() => void submitCurrentWord()}>
                <Check className="w-5 h-5" /> أنهيت قراءة الكلمة
              </button>
            </div>
          </div>
        )}

        {phase === 'finalizing' && (
          <div className="text-center space-y-2" role="status">
            <span className="text-3xl" aria-hidden="true">🎧</span>
            <p className="font-bold text-ink">أحسنت! انتهت الكلمات. جارٍ حفظ القراءة…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3" role="alert">
            <p className="bz-small text-amber-950">{errorMessage}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="bz-btn bz-btn-primary" onClick={retry}>
                {wordReceiptsRef.current.length === items.length ? 'إعادة تجميع النتيجة' : redoRef.current.length > 0 ? 'إعادة تسجيل هذه الكلمات' : 'إعادة تسجيل هذه الكلمة'}
              </button>
              <button type="button" className="bz-btn bz-btn-secondary" onClick={saveWithoutScore}>
                متابعة دون درجة
              </button>
            </div>
          </div>
        )}

        {phase === 'ready' && (
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={() => void startRecording()} disabled={!supported}>
              <Mic className="w-5 h-5" /> ابدأ تسجيل هذه الكلمة
            </button>
            {!supported && <p className="w-full text-center bz-small text-amber-800">{audioAvailabilityMessage(audioSession)}</p>}
            <button type="button" className="bz-btn bz-btn-ghost" onClick={saveWithoutScore}>
              متابعة دون درجة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function PassagePlayer({
  title,
  words,
  timeLimitSec,
  audioSession,
  onDone,
}: {
  title: string;
  words: string[];
  timeLimitSec: number;
  audioSession: CognitiveAudioSessionContext;
  onDone: (responses: ItemResponse[], durationMs: number, assessment?: CognitiveAudioAssessmentEvidence) => void;
}) {
  const [phase, setPhase] = useState<'ready' | 'recording' | 'submitting' | 'review' | 'error'>('ready');
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [elapsedNow, setElapsedNow] = useState(() => performance.now());
  const [errorMessage, setErrorMessage] = useState('');
  const [assessmentResult, setAssessmentResult] = useState<CognitiveAudioAssessmentEvidence | null>(null);
  const recordingRef = useRef<WavRecordingController | null>(null);
  const startAtRef = useRef(0);
  const startingRef = useRef(false);
  const finalizingRef = useRef(false);
  const cachedResponsesRef = useRef<ItemResponse[]>([]);
  const cachedDurationMsRef = useRef(0);

  const supported = audioSession.guardianConsentGiven === true &&
    audioSession.guardianAudioConsentGiven === true;

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = window.setInterval(() => setElapsedNow(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Browser Web Speech Recognition is intentionally not used here so microphone capture stays
  // isolated for the server WAV recording; the reader advances the visual highlighter by tap or keyboard.

  // Keyboard navigation for highlighter (Space / ArrowLeft advances, ArrowRight rewinds)
  useEffect(() => {
    if (phase !== 'recording') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveWordIndex((prev) => Math.min(words.length - 1, prev + 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveWordIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, words.length]);

  const elapsedSeconds = phase === 'recording'
    ? Math.min(timeLimitSec, Math.max(0, (elapsedNow - startAtRef.current) / 1000))
    : 0;

  const saveWithoutScore = () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    recordingRef.current?.cancel();
    recordingRef.current = null;
    onDone([], 0);
  };

  const submitRecording = async () => {
    if (finalizingRef.current || !recordingRef.current) return;
    finalizingRef.current = true;
    setPhase('submitting');
    try {
      const recording = await recordingRef.current.stop();
      recordingRef.current = null;
      const assessment = await assessCognitiveAudio({
        taskId: 'oralReading',
        session: audioSession,
        recording,
      });
      const responses = assessment.words.map((word, index) => ({
        itemId: passageWordId(index),
        correct: word.errorType === 'None' || word.errorType === 'DialectVariant',
        rtMs: 0,
        replays: 0,
      }));
      cachedResponsesRef.current = responses;
      cachedDurationMsRef.current = Math.round(recording.durationSeconds * 1000);
      setAssessmentResult(assessment);

      // Select first error word to highlight in review by default
      const firstErrIdx = assessment.words.findIndex(
        (w) => w.errorType !== 'None' && w.errorType !== 'DialectVariant'
      );
      setSelectedWordIndex(firstErrIdx >= 0 ? firstErrIdx : 0);
      setPhase('review');
    } catch (error) {
      setErrorMessage(audioFailureMessage(error));
      setPhase('error');
      finalizingRef.current = false;
    }
  };

  useEffect(() => {
    if (phase === 'recording' && elapsedSeconds >= timeLimitSec) void submitRecording();
  }, [phase, elapsedSeconds, timeLimitSec]);

  useEffect(() => () => {
    recordingRef.current?.cancel();
    recordingRef.current = null;
  }, []);

  const startRecording = async () => {
    if (!supported || startingRef.current || phase !== 'ready') return;
    startingRef.current = true;
    setErrorMessage('');
    setActiveWordIndex(0);
    try {
      recordingRef.current = await startWavRecording();
      startAtRef.current = performance.now();
      setElapsedNow(startAtRef.current);
      setPhase('recording');
    } catch (error) {
      setErrorMessage(audioFailureMessage(error));
      setPhase('error');
    } finally {
      startingRef.current = false;
    }
  };

  const finishAndAdvance = () => {
    if (assessmentResult) {
      onDone(cachedResponsesRef.current, cachedDurationMsRef.current, assessmentResult);
    } else {
      saveWithoutScore();
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-5" dir="rtl">
      <div className="w-full max-w-3xl rounded-[2rem] border-4 border-line bg-card p-5 sm:p-8 shadow-sm space-y-5">
        <div className="text-center space-y-2">
          <span className="text-5xl" aria-hidden="true">📖</span>
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-900 border border-teal-300 shadow-2xs">
              📖 قراءة القصة بصوت مسموع
            </span>
          </div>
          <h3 className="text-3xl font-bold text-ink" style={READING_FONT} lang="ar">{title}</h3>
          <p className="bz-small text-ink-2">
            {phase === 'recording'
              ? 'اقرأ القصة كاملةً بصوتك الطبيعي وواضح كما تقرأ في الصف. عند الانتهاء اضغط الزر الأخضر أدناه.'
              : phase === 'review'
              ? 'اكتمل تسجيل القصة بنجاح. شكرًا لك على مجهودك الرائع!'
              : 'اضغط بدء التسجيل، ثم اقرأ القصة كاملةً بصوت عالٍ وواضح كما تقرأ في الصف.'}
          </p>
        </div>

        {/* Story Text Display */}
        {phase !== 'review' ? (
          <div
            className="text-xl sm:text-2xl leading-[2.4] text-ink text-start p-5 sm:p-7 rounded-2xl bg-soft border-2 border-line/60 select-none shadow-2xs tracking-wide"
            style={READING_FONT}
            lang="ar"
          >
            {words.join(' ')}
          </div>
        ) : (
          /* Neutral Completion Mode in Screening */
          <div className="space-y-4 text-center p-6 sm:p-8 rounded-2xl bg-teal-50 border-2 border-teal-200 animate-fadeIn">
            <span className="text-5xl" aria-hidden="true">🌟</span>
            <h4 className="text-2xl sm:text-3xl font-bold text-teal-950">شكرًا لك يا بطل!</h4>
            <p className="text-base sm:text-lg text-teal-800 font-medium max-w-md mx-auto">
              اكتمل تسجيل القصة وتحليلها بنجاح. فخورون بمجهودك الرائع ومحاولتك المتميزة!
            </p>
            <div className="pt-3">
              <button
                type="button"
                className="bz-btn bz-btn-primary bz-btn-lg font-bold text-base px-8 py-3 shadow-md"
                onClick={finishAndAdvance}
              >
                متابعة الفحص ◀
              </button>
            </div>
          </div>
        )}

        {/* Phase: Recording */}
        {phase === 'recording' && (
          <div className="space-y-4 text-center">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-sm font-bold">
              <div className="inline-flex items-center gap-2 text-teal-800">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                <span>التسجيل الصوتي جارٍ… اقرأ على مهلك</span>
              </div>
              <span className="text-slate-600 text-xs">
                المدة المتبقية: {ar(Math.max(0, timeLimitSec - Math.round(elapsedSeconds)))} ثانية
              </span>
            </div>
            <div className="bz-progress">
              <span style={{ width: String(Math.min(100, (elapsedSeconds / timeLimitSec) * 100)) + '%' }} />
            </div>

            <div className="pt-2">
              <button type="button" className="bz-btn bz-btn-primary bz-btn-lg shadow-md w-full sm:w-auto" onClick={() => void submitRecording()}>
                <Check className="w-5 h-5" /> انتهيت من القراءة — حلّل التسجيل
              </button>
            </div>
          </div>
        )}

        {/* Phase: Submitting */}
        {phase === 'submitting' && (
          <div className="text-center space-y-2 py-4" role="status">
            <span className="text-4xl" aria-hidden="true">🎧</span>
            <p className="font-bold text-lg text-ink">جارٍ تحليل تسجيل القصة…</p>
            <p className="bz-small text-muted">تقييم صوتي دقيق لطلاقة القراءة</p>
          </div>
        )}

        {/* Phase: Error */}
        {phase === 'error' && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3" role="alert">
            <p className="bz-small text-amber-950">{errorMessage}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="bz-btn bz-btn-primary"
                onClick={() => {
                  finalizingRef.current = false;
                  setErrorMessage('');
                  setPhase('ready');
                }}
              >
                إعادة التسجيل والمحاولة
              </button>
              <button type="button" className="bz-btn bz-btn-secondary" onClick={saveWithoutScore}>
                حفظ المهمة دون درجة
              </button>
            </div>
          </div>
        )}

        {/* Phase: Ready */}
        {phase === 'ready' && (
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={() => void startRecording()} disabled={!supported}>
              <Mic className="w-5 h-5" /> ابدأ تسجيل القراءة
            </button>
            {!supported && (
              <p className="w-full text-center bz-small text-amber-800">
                {audioAvailabilityMessage(audioSession)}
              </p>
            )}
            <button type="button" className="bz-btn bz-btn-ghost" onClick={saveWithoutScore}>
              متابعة دون درجة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RanCell({ symbol, display, size }: { symbol: RanSymbol; display: 'picture' | 'letter'; size: 'sm' | 'lg' }) {
  if (display === 'picture') {
    return (
      <span className={size === 'lg' ? 'text-6xl' : 'text-2xl sm:text-3xl'} aria-hidden="true">
        <Pic emoji={lex(symbol.value).emoji} />
      </span>
    );
  }
  return (
    <span className={`${size === 'lg' ? 'text-6xl' : 'text-2xl sm:text-3xl'} font-black text-ink leading-none`} style={READING_FONT} aria-hidden="true">
      {symbol.value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Rapid automatized naming: captured audio, fixed server-side grid and no manual scoring
// ---------------------------------------------------------------------------
type RanAudioPhase = 'names' | 'ready' | 'recording' | 'submitting' | 'error';

export function RanPlayer({
  symbols,
  grid,
  display,
  audioSession,
  onDone,
}: {
  symbols: RanSymbol[];
  grid: string[];
  display: 'picture' | 'letter';
  audioSession: CognitiveAudioSessionContext;
  onDone: (responses: ItemResponse[], durationMs: number, assessment?: CognitiveAudioAssessmentEvidence) => void;
}) {
  const [phase, setPhase] = useState<RanAudioPhase>('names');
  const [elapsedNow, setElapsedNow] = useState(() => performance.now());
  const [errorMessage, setErrorMessage] = useState('');
  const recordingRef = useRef<WavRecordingController | null>(null);
  const startAtRef = useRef(0);
  const startingRef = useRef(false);
  const finalizingRef = useRef(false);
  const supported = audioSession.guardianConsentGiven === true &&
    audioSession.guardianAudioConsentGiven === true;
  const taskId: CognitiveAudioTaskId = display === 'picture' ? 'ranObjects' : 'ranLetters';
  const byId = new Map(symbols.map((symbol) => [symbol.id, symbol]));

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = window.setInterval(() => setElapsedNow(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  const elapsedSeconds = phase === 'recording'
    ? Math.max(0, (elapsedNow - startAtRef.current) / 1000)
    : 0;

  const saveWithoutScore = () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    recordingRef.current?.cancel();
    recordingRef.current = null;
    onDone([], 0);
  };

  const submitRecording = async () => {
    if (finalizingRef.current || !recordingRef.current) return;
    finalizingRef.current = true;
    setPhase('submitting');
    try {
      const recording = await recordingRef.current.stop();
      recordingRef.current = null;
      const assessment = await assessCognitiveAudio({ taskId, session: audioSession, recording });
      const responses = assessment.words.map((word, index) => ({
        itemId: 'ran-' + (index + 1),
        correct: word.errorType === 'None' || word.errorType === 'DialectVariant',
        rtMs: 0,
        replays: 0,
      }));
      onDone(responses, Math.round(recording.durationSeconds * 1000), assessment);
    } catch (error) {
      setErrorMessage(audioFailureMessage(error));
      setPhase('error');
      finalizingRef.current = false;
    }
  };

  useEffect(() => {
    if (phase === 'recording' && elapsedSeconds >= 86) void submitRecording();
  }, [phase, elapsedSeconds]);

  useEffect(() => () => {
    recordingRef.current?.cancel();
    recordingRef.current = null;
  }, []);

  const startRecording = async () => {
    if (!supported || startingRef.current || phase !== 'ready') return;
    startingRef.current = true;
    setErrorMessage('');
    try {
      recordingRef.current = await startWavRecording();
      startAtRef.current = performance.now();
      setElapsedNow(startAtRef.current);
      setPhase('recording');
    } catch (error) {
      setErrorMessage(audioFailureMessage(error));
      setPhase('error');
    } finally {
      startingRef.current = false;
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-5" dir="rtl">
      {phase === 'names' && (
        <div className="w-full max-w-2xl flex flex-col items-center gap-5 text-center">
          <p className="font-child text-2xl font-black text-ink">{display === 'picture' ? 'ما أسماء هذه الصور؟' : 'ما أسماء هذه الحروف؟'}</p>
          <p className="bz-small text-ink-2">
            يتعرّف الطفل على أسماء هذه {display === 'picture' ? 'الصور الخمس' : 'الحروف الخمسة'} أولًا، ثم يسمّيها في السباق بصوت عالٍ من اليمين إلى اليسار.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {symbols.map((symbol) => (
              <div key={symbol.id} className="grid place-items-center w-24 h-24 rounded-3xl border-[3px] border-line bg-card">
                <RanCell symbol={symbol} display={display} size="lg" />
              </div>
            ))}
          </div>
          <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={() => setPhase('ready')}>
            الرموز مألوفة — ابدأ السباق
          </button>
        </div>
      )}

      {phase !== 'names' && (
        <div className="w-full max-w-2xl space-y-4">
          {/* Top Controls Bar - ALWAYS VISIBLE ABOVE THE GRID */}
          <div className="sticky top-2 z-20 p-3 sm:p-4 rounded-2xl border-2 border-line bg-card/95 backdrop-blur-md shadow-md space-y-2 text-center">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-ink text-base sm:text-lg">
                {display === 'picture' ? '🏁 سباق تسمية الصور' : '🏁 سباق تسمية الحروف'}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 font-bold border border-teal-200">
                ٤٠ عنصرًا · من اليمين إلى اليسار ◀
              </span>
            </div>

            <p className="bz-small text-ink-2">
              سمِّ جميع الرموز بصوت واضح بأسرع ما تستطيع، من اليمين إلى اليسار سطرًا سطرًا.
            </p>

            {phase === 'ready' && (
              <div className="flex flex-wrap justify-center items-center gap-3 pt-1">
                <button
                  type="button"
                  className="bz-btn bz-btn-primary bz-btn-lg shadow-md font-bold px-6 py-3"
                  onClick={() => void startRecording()}
                  disabled={!supported}
                >
                  <Mic className="w-5 h-5" /> ابدأ التسجيل والسباق
                </button>
                <button type="button" className="bz-btn bz-btn-ghost" onClick={saveWithoutScore}>
                  تخطي / متابعة دون درجة
                </button>
                {!supported && <p className="w-full text-center bz-small text-amber-800">{audioAvailabilityMessage(audioSession)}</p>}
              </div>
            )}

            {phase === 'recording' && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 px-2">
                  <div className="inline-flex items-center gap-2 text-teal-800 font-bold text-sm">
                    <span className="w-3 h-3 rounded-full bg-teal-500" />
                    <span>السباق جارٍ… سمِّ الرموز سطرًا سطرًا من اليمين إلى اليسار ◀</span>
                  </div>
                  <span className="text-xs font-bold text-teal-900 bg-teal-100 px-3 py-1 rounded-full border border-teal-300">
                    ⏱️ {ar(Math.floor(elapsedSeconds))} ثانية
                  </span>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className="bz-btn bz-btn-primary bz-btn-lg shadow-md font-bold text-base px-6 py-3"
                    onClick={() => void submitRecording()}
                  >
                    <Check className="w-5 h-5" /> انتهيت من تسمية جميع الرموز ✓
                  </button>
                  <button type="button" className="bz-btn bz-btn-ghost bz-btn-sm" onClick={saveWithoutScore}>
                    تخطي
                  </button>
                </div>
              </div>
            )}

            {phase === 'submitting' && (
              <div className="py-2 text-center space-y-1" role="status">
                <p className="font-bold text-teal-900">جارٍ حساب سرعة التسمية وتحليل النتيجة…</p>
                <p className="bz-small text-muted">لحظات ويكتمل التحليل.</p>
              </div>
            )}

            {phase === 'error' && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3" role="alert">
                <p className="bz-small text-amber-950">{errorMessage}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className="bz-btn bz-btn-primary"
                    onClick={() => {
                      finalizingRef.current = false;
                      setErrorMessage('');
                      setPhase('ready');
                    }}
                  >
                    إعادة المحاولة
                  </button>
                  <button type="button" className="bz-btn bz-btn-secondary" onClick={saveWithoutScore}>
                    حفظ المهمة دون درجة
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Grouped Rows Grid with Row Numbers to eliminate visual crowding */}
          <div className="p-3 sm:p-4 rounded-2xl border-2 border-line bg-soft shadow-2xs space-y-2 max-w-lg mx-auto">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
              <span>{display === 'picture' ? 'الصور الخمس: ⚽ 🚪 ☀️ 🏠 🔑' : 'الحروف الخمسة فقط: ب · د · م · س · ل'}</span>
              <span>٨ أسطر متتالية</span>
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: 8 }).map((_, rowIdx) => {
                const rowItems = grid.slice(rowIdx * 5, (rowIdx + 1) * 5);
                return (
                  <div key={rowIdx} className="flex items-center justify-center gap-1.5 sm:gap-2 p-1 rounded-xl hover:bg-card/70 transition-colors">
                    <span className="w-5 text-center text-xs font-bold text-slate-500 font-mono select-none">
                      {ar(rowIdx + 1)}
                    </span>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-around">
                      {rowItems.map((id, colIdx) => (
                        <div
                          key={id + '-' + (rowIdx * 5 + colIdx)}
                          className="grid place-items-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-card border border-line/70 shadow-2xs select-none hover:border-teal-400"
                        >
                          {byId.get(id) ? <RanCell symbol={byId.get(id)!} display={display} size="sm" /> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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
      {/* Practice only, after the child pressed «تمّ»: never on scored words. */}
      {practice && result !== null && (
        <MascotMoment
          mood={result ? 'cheer' : 'support'}
          size={72}
          layout="row"
          message={result ? MASCOT_LINES.spellPracticeCorrect : MASCOT_LINES.spellPracticeWrong}
        />
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
