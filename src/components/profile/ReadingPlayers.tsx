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
  if (!session.speechLocale) {
    return 'اختر لهجة الطفل بوضوح. يتوفر التقييم الصوتي حاليًا للمصرية والخليجية فقط؛ لن نفترض لهجة أو نستبدلها تلقائيًا.';
  }
  return 'التقييم الصوتي غير متاح حاليًا لهذه الجلسة؛ ستبقى المهمة دون درجة.';
}

function audioFailureMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'UNSUPPORTED_SPEECH_DIALECT') return 'التقييم الصوتي غير متاح للهجة المختارة. لم نغيّر اللهجة تلقائيًا.';
  if (code === 'AUDIO_CONSENT_REQUIRED') return 'يلزم تسجيل موافقة ولي الأمر المنفصلة على معالجة الصوت قبل التسجيل.';
  if (code === 'AZURE_SPEECH_NOT_CONFIGURED') return 'خدمة Azure Speech غير مهيأة على الخادم؛ لم تُحتسب درجة لهذه المهمة.';
  if (code === 'AUDIO_RECORDING_UNAVAILABLE' || code === 'AUDIO_CONTEXT_UNAVAILABLE') return 'المتصفح أو الجهاز لا يدعم تسجيل الصوت المطلوب. لم تُحتسب درجة.';
  if (code === 'AUDIO_DURATION_OUT_OF_RANGE') return 'مدة التسجيل خارج النطاق المسموح. لم تُحتسب درجة.';
  if (code === 'COGNITIVE_AUDIO_ASSESSMENT_INCOMPLETE') return 'لم يتمكن محرك الصوت من حسم جميع الكلمات. لم نحسب الأخطاء أو الدرجة.';
  if (code === 'COGNITIVE_AUDIO_WORD_UNCONFIRMED') return 'لم يتمكن محرك الصوت من حسم نطق هذه الكلمة. لم نُسجّلها خطأ؛ أعد تسجيل الكلمة وحدها.';
  return 'تعذر إكمال التقييم الصوتي عبر الخدمة. يمكنك حفظ المهمة دون درجة وإعادة المحاولة لاحقًا.';
}

// ---------------------------------------------------------------------------
// Continuous audio assessment for real-word and made-up-word reading lists
// ---------------------------------------------------------------------------
type ReadListAudioPhase = 'ready' | 'recording' | 'assessing' | 'finalizing' | 'error';

function createAudioAttemptId(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// One recording and one Azure assessment per visible word
// ---------------------------------------------------------------------------
function stripHarakat(text: string): string {
  return (text || '').normalize('NFC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[.,!?،؟؛:"«»()[\]{}]/g, '').trim();
}

function getWordDiagnosis(expectedVowelled: string, spokenRaw: string | null, accuracyScore: number, errorType: string): { diagnosis: string; isCorrect: boolean } {
  const refClean = stripHarakat(expectedVowelled);
  const spkClean = stripHarakat(spokenRaw || '');

  if (errorType === 'None' && accuracyScore >= 75) {
    return {
      isCorrect: true,
      diagnosis: 'نطق سليم ومتقن بالحركات والمدود ومخارج سليمة.',
    };
  }

  // Only consider truly silent if spkClean is completely empty or explicit silence
  if (!spkClean || spokenRaw === 'SILENCE' || spokenRaw === '.' || spokenRaw === 'صمت' || (errorType === 'Omission' && !spokenRaw)) {
    return {
      isCorrect: false,
      diagnosis: 'لم نلتقط صوتاً واضحاً أو كافياً للكلمة؛ يرجى التحدث بوضوح قرب الميكروفون.',
    };
  }

  if (errorType === 'Substitution' || (spkClean && refClean && spkClean !== refClean && (Math.abs(spkClean.length - refClean.length) >= 2 || !spkClean.startsWith(refClean[0])))) {
    return {
      isCorrect: false,
      diagnosis: `استبدال كلي للكلمة؛ نُطق «${spokenRaw || spkClean}» بدلاً من الكلمة المطلوبة «${expectedVowelled}».`,
    };
  }

  // Specific mispronunciation analysis
  if (refClean[0] !== spkClean[0]) {
    return {
      isCorrect: false,
      diagnosis: `خطأ في نطق الحرف الأول (سُمع «${spkClean[0]}» بدلاً من «${refClean[0]}»). `,
    };
  }
  if (refClean[refClean.length - 1] !== spkClean[spkClean.length - 1]) {
    return {
      isCorrect: false,
      diagnosis: `خطأ في نطق الحرف الأخير (سُمع «${spkClean[spkClean.length - 1]}» بدلاً من «${refClean[refClean.length - 1]}»). `,
    };
  }
  if (refClean.includes('ا') && !spkClean.includes('ا')) {
    return {
      isCorrect: false,
      diagnosis: 'خطأ في مد الألف (نُطقت بفتحة قصيرة دون إشباع المد).',
    };
  }
  if (refClean.includes('ي') && !spkClean.includes('ي')) {
    return {
      isCorrect: false,
      diagnosis: 'خطأ في مد الياء (نُطقت بكسرة قصيرة دون إشباع المد).',
    };
  }
  if (refClean.includes('و') && !spkClean.includes('و')) {
    return {
      isCorrect: false,
      diagnosis: 'خطأ في مد الواو (نُطقت بضمة قصيرة دون إشباع المد).',
    };
  }

  return {
    isCorrect: false,
    diagnosis: `عدم ضبط في حركات الكلمة أو مخارج حروفها (دقة الصوت: ${accuracyScore}٪).`,
  };
}

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
  const [lastWordFeedback, setLastWordFeedback] = useState<{
    word: string;
    accuracyScore: number;
    errorType: 'None' | 'Omission' | 'Mispronunciation' | 'Substitution' | 'DialectVariant';
    spokenWord: string | null;
    diagnosis: string;
    isCorrect: boolean;
  } | null>(null);
  const recordingRef = useRef<WavRecordingController | null>(null);
  const startAtRef = useRef(0);
  const busyRef = useRef(false);
  const attemptIdRef = useRef('');
  const wordReceiptsRef = useRef<CognitiveAudioWordReceipt[]>([]);
  const maxWordDurationSeconds = 12;
  const supported = audioSession.guardianConsentGiven === true &&
    audioSession.guardianAudioConsentGiven === true &&
    Boolean(audioSession.speechLocale);
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

  const finalizeList = async (receipts: CognitiveAudioWordReceipt[]) => {
    if (busyRef.current || receipts.length !== items.length) return;
    busyRef.current = true;
    setPhase('finalizing');
    setErrorMessage('');
    try {
      const assessment = await finalizeCognitiveAudioWordList({
        taskId,
        attemptId: attemptIdRef.current,
        session: audioSession,
        receipts,
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

  const submitCurrentWord = async () => {
    if (
      busyRef.current ||
      !recordingRef.current ||
      !currentItem ||
      !attemptIdRef.current
    ) return;

    busyRef.current = true;
    setPhase('assessing');
    setErrorMessage('');
    try {
      const recording = await recordingRef.current.stop();
      recordingRef.current = null;
      const wordReceipt = await assessCognitiveAudioWord({
        taskId,
        itemId: currentItem.id,
        itemIndex: currentItemIndex,
        attemptId: attemptIdRef.current,
        session: audioSession,
        recording,
      });

      // Replace only this item's earlier attempt, if any. The visible flow advances
      // only after the server returns a verified word receipt.
      const nextReceipts = [
        ...wordReceiptsRef.current.filter((receipt) => receipt.itemId !== currentItem.id),
        wordReceipt,
      ].sort((a, b) => a.itemIndex - b.itemIndex);
      wordReceiptsRef.current = nextReceipts;
      const diag = wordReceipt.word.diagnosis
        ? {
            diagnosis: wordReceipt.word.diagnosis,
            isCorrect: wordReceipt.word.errorType === 'None' && wordReceipt.word.accuracyScore >= 75,
          }
        : getWordDiagnosis(
            currentItem.text,
            wordReceipt.word.spokenWord || wordReceipt.transcript,
            wordReceipt.word.accuracyScore,
            wordReceipt.word.errorType
          );
      setLastWordFeedback({
        word: currentItem.text,
        accuracyScore: wordReceipt.word.accuracyScore,
        errorType: wordReceipt.word.errorType,
        spokenWord: wordReceipt.word.spokenWord || wordReceipt.transcript,
        diagnosis: diag.diagnosis,
        isCorrect: diag.isCorrect,
      });

      if (currentItemIndex + 1 < items.length) {
        setCurrentItemIndex(currentItemIndex + 1);
        setPhase('ready');
      } else {
        // The final report is created only after every reference item has one
        // distinct, correctly ordered receipt.
        busyRef.current = false;
        await finalizeList(nextReceipts);
      }
    } catch (error) {
      recordingRef.current = null;
      setErrorMessage(audioFailureMessage(error));
      setPhase('error');
    } finally {
      busyRef.current = false;
    }
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
      void finalizeList(wordReceiptsRef.current);
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
              ✨ النسخة الحديثة v2 — تقييم صوتي ذكي مباشر
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-ink" style={READING_FONT} lang="ar">{title}</h3>
          <p className="bz-small text-ink-2">
            اقرأ الكلمة الظاهرة وحدها. بعد تسجيلها وتقييمها ستنتقل إلى الكلمة التالية.
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
          {lastWordFeedback && phase === 'ready' && (
            <div className="w-full max-w-xl mx-auto my-3 text-right" role="status" aria-live="polite">
              {lastWordFeedback.isCorrect ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-emerald-800 font-bold text-sm sm:text-base">
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>✓ أحسنت! نطق صحيح ومتقن</span>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 border border-emerald-300 font-bold">
                      درجة الدقة: {ar(lastWordFeedback.accuracyScore)}٪
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-emerald-700 font-medium pr-7">
                    الكلمة المطلوبة: <strong>«{lastWordFeedback.word}»</strong> — المسموع: <strong>«{lastWordFeedback.spokenWord && stripHarakat(lastWordFeedback.spokenWord) ? stripHarakat(lastWordFeedback.spokenWord) : lastWordFeedback.word}»</strong> — {lastWordFeedback.diagnosis}
                  </p>
                </div>
              ) : (
                <div className={`p-4 rounded-2xl border-2 shadow-xs space-y-2 ${
                  lastWordFeedback.errorType === 'Substitution'
                    ? 'bg-rose-50 border-rose-300'
                    : lastWordFeedback.errorType === 'Omission'
                    ? 'bg-slate-50 border-slate-300'
                    : 'bg-amber-50 border-amber-300'
                }`}>
                  <div className="flex items-center justify-between gap-2 font-bold text-sm sm:text-base">
                    <div className="flex items-center gap-2">
                      {lastWordFeedback.errorType === 'Substitution' ? (
                        <span className="text-rose-700 text-lg leading-none">✗</span>
                      ) : lastWordFeedback.errorType === 'Omission' ? (
                        <span className="text-slate-700 text-lg leading-none">⚠️</span>
                      ) : (
                        <span className="text-amber-700 text-lg leading-none">⚠️</span>
                      )}
                      <span className={
                        lastWordFeedback.errorType === 'Substitution'
                          ? 'text-rose-900'
                          : lastWordFeedback.errorType === 'Omission'
                          ? 'text-slate-900'
                          : 'text-amber-900'
                      }>
                        {lastWordFeedback.errorType === 'Substitution'
                          ? 'استبدال كلمة'
                          : (!lastWordFeedback.spokenWord || !stripHarakat(lastWordFeedback.spokenWord)) ? 'لم يُسمع صوت واضح'
                          : 'خطأ في نطق الكلمة'}
                      </span>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/90 border border-slate-200 text-slate-800 font-bold">
                      درجة الدقة: {ar(lastWordFeedback.accuracyScore)}٪
                    </span>
                  </div>

                  <div className="text-xs sm:text-sm text-slate-800 space-y-1.5 pr-6 font-medium">
                    <p>
                      الكلمة المطلوبة: <strong className="text-slate-950 font-bold">«{lastWordFeedback.word}»</strong>
                    </p>
                    <p>
                      أنت نطقت (المسموع من الطفل):{' '}
                      <strong className={lastWordFeedback.errorType === 'Substitution' ? 'text-rose-800 font-bold' : 'text-amber-800 font-bold'}>
                        {lastWordFeedback.spokenWord ? `«${lastWordFeedback.spokenWord}»` : 'صمت / غير مسموع'}
                      </strong>
                    </p>
                    <p className="text-xs text-slate-600 pt-0.5 border-t border-slate-200/60">
                      <strong>التشخيص الصوتي:</strong> {lastWordFeedback.diagnosis}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {phase === 'recording' && (
          <div className="space-y-3 text-center">
            <p className="font-bold text-rose-700">● تسجيل هذه الكلمة · {ar(Math.ceil(maxWordDurationSeconds - elapsedSeconds))} ثانية متبقية</p>
            <div className="bz-progress"><span style={{ width: String(Math.min(100, elapsedSeconds / maxWordDurationSeconds * 100)) + '%' }} /></div>
            <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={() => void submitCurrentWord()}>
              <Check className="w-5 h-5" /> أنهيت قراءة الكلمة
            </button>
          </div>
        )}

        {phase === 'assessing' && (
          <div className="text-center space-y-2" role="status">
            <span className="text-3xl" aria-hidden="true">🎧</span>
            <p className="font-bold text-ink">يجري تقييم نطق هذه الكلمة...</p>
            <p className="bz-small text-muted">لن ننتقل إلى التالية حتى يصل تقييمها.</p>
          </div>
        )}

        {phase === 'finalizing' && (
          <div className="text-center space-y-2" role="status">
            <span className="text-3xl" aria-hidden="true">🎧</span>
            <p className="font-bold text-ink">اكتملت الكلمات. يجري تجميع نتائجها والتحقق من ترتيبها...</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3" role="alert">
            <p className="bz-small text-amber-950">{errorMessage}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="bz-btn bz-btn-primary" onClick={retry}>
                {wordReceiptsRef.current.length === items.length ? 'إعادة تجميع النتيجة' : 'إعادة تسجيل هذه الكلمة'}
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
  const [phase, setPhase] = useState<AudioTaskPhase>('ready');
  const [elapsedNow, setElapsedNow] = useState(() => performance.now());
  const [errorMessage, setErrorMessage] = useState('');
  const recordingRef = useRef<WavRecordingController | null>(null);
  const startAtRef = useRef(0);
  const startingRef = useRef(false);
  const finalizingRef = useRef(false);

  const supported = audioSession.guardianConsentGiven === true &&
    audioSession.guardianAudioConsentGiven === true &&
    Boolean(audioSession.speechLocale);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = window.setInterval(() => setElapsedNow(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, [phase]);

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
      onDone(responses, Math.round(recording.durationSeconds * 1000), assessment);
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
      <div className="w-full max-w-3xl rounded-[2rem] border-4 border-line bg-card p-5 sm:p-8 shadow-sm space-y-5">
        <div className="text-center space-y-2">
          <span className="text-5xl" aria-hidden="true">📖</span>
          <h3 className="text-3xl font-bold text-ink" style={READING_FONT} lang="ar">{title}</h3>
          <p className="bz-small text-ink-2">
            {phase === 'recording'
              ? 'اقرأ القصة بصوتك الطبيعي وبالسرعة التي تناسبك. سيُرسل التسجيل لتحليله بعد الانتهاء.'
              : 'سجّل قراءة القصة مرة واحدة. سيحلل Azure التسجيل الكامل مقابل النص، ولن نعتمد تخمينات المتصفح.'}
          </p>
        </div>
        <div className="text-[26px] sm:text-[34px] leading-[2.15] text-ink text-start" style={READING_FONT} lang="ar">
          {words.map((word, index) => <span key={index}>{word}{index < words.length - 1 ? ' ' : ''}</span>)}
        </div>

        {phase === 'recording' && (
          <div className="space-y-3 text-center">
            <p className="font-bold text-rose-700">● التسجيل جارٍ · {ar(Math.ceil(timeLimitSec - elapsedSeconds))} ثانية متبقية</p>
            <div className="bz-progress"><span style={{ width: String(Math.min(100, (elapsedSeconds / timeLimitSec) * 100)) + '%' }} /></div>
            <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={() => void submitRecording()}>
              <Check className="w-5 h-5" /> انتهيت من القراءة — حلّل التسجيل
            </button>
          </div>
        )}

        {phase === 'submitting' && (
          <div className="text-center space-y-2" role="status">
            <span className="text-3xl" aria-hidden="true">🎧</span>
            <p className="font-bold text-ink">يجري تحليل التسجيل الصوتي والتحقق من الكلمات…</p>
            <p className="bz-small text-muted">لا تغلق الصفحة حتى يظهر تأكيد إتمام المهمة.</p>
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
                إعادة التسجيل والمحاولة
              </button>
              <button type="button" className="bz-btn bz-btn-secondary" onClick={saveWithoutScore}>
                حفظ المهمة دون درجة
              </button>
            </div>
          </div>
        )}

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
    audioSession.guardianAudioConsentGiven === true &&
    Boolean(audioSession.speechLocale);
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
          <p className="bz-small text-ink-2">تعرّف إلى الرموز أولًا، ثم سمّها في السباق من اليمين إلى اليسار. لا توجد علامات يدوية أثناء التقييم.</p>
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
          <div className="grid gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-[2rem] border-4 border-line bg-card shadow-sm"
            style={{ gridTemplateColumns: 'repeat(' + RAN_COLUMNS + ', minmax(0, 1fr))' }}>
            {grid.map((id, index) => (
              <div key={id + '-' + index} className="grid place-items-center w-12 h-12 sm:w-16 sm:h-16 rounded-xl">
                {byId.get(id) ? <RanCell symbol={byId.get(id)!} display={display} size="sm" /> : null}
              </div>
            ))}
          </div>

          {phase === 'ready' && (
            <div className="text-center space-y-3">
              <p className="bz-small text-ink-2">سمِّ جميع الرموز بأسرع ما تستطيع، دون الإشارة إليها بإصبعك. يستغرق التسجيل حتى ٨٦ ثانية.</p>
              <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={() => void startRecording()} disabled={!supported}>
                <Mic className="w-5 h-5" /> ابدأ التسجيل والسباق
              </button>
              {!supported && <p className="bz-small text-amber-800">{audioAvailabilityMessage(audioSession)}</p>}
              <button type="button" className="bz-btn bz-btn-ghost" onClick={saveWithoutScore}>متابعة دون درجة</button>
            </div>
          )}

          {phase === 'recording' && (
            <div className="text-center space-y-3">
              <p className="font-bold text-rose-700">● التسجيل جارٍ · {ar(Math.floor(elapsedSeconds))} ثانية</p>
              <div className="bz-progress"><span style={{ width: String(Math.min(100, elapsedSeconds / 86 * 100)) + '%' }} /></div>
              <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={() => void submitRecording()}>
                <Check className="w-5 h-5" /> انتهى السباق — حلّل التسجيل
              </button>
            </div>
          )}

          {phase === 'submitting' && (
            <div className="text-center space-y-2" role="status">
              <p className="font-bold text-ink">يجري تحليل أسماء الصور والحروف بالترتيب…</p>
              <p className="bz-small text-muted">لا تغلق الصفحة حتى يظهر تأكيد إتمام المهمة.</p>
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
                  إعادة التسجيل والمحاولة
                </button>
                <button type="button" className="bz-btn bz-btn-secondary" onClick={saveWithoutScore}>
                  حفظ المهمة دون درجة
                </button>
              </div>
            </div>
          )}
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
