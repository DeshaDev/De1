/**
 * Arabic Reading & Comprehension Assessment Lab (مختبر القراءة والطلاقة والفهم القرائي)
 * Pure, accessible, evidence-based Arabic oral and silent reading assessment.
 * ZERO CAMERA / ZERO CALIBRATION / ZERO UNVALIDATED EYE GAZE MEASURES.
 * Accurately measures:
 *  1. Reading Duration (Elapsed seconds)
 *  2. Reading Fluency (WPM = words / seconds * 60)
 *  3. Reading Comprehension (Comprehension questions score %)
 */

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Clock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RotateCcw,
  HelpCircle,
  Award,
  Layers,
  Volume2,
  Mic,
  MicOff,
  UserCheck,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import {
  StudentRecord,
  INITIAL_STUDENTS,
  ARABIC_READING_PASSAGES,
  ReadingPassage,
} from '../data/seedData';
import { useAssessment } from '../contexts/AssessmentContext';
import { authenticatedFetch } from '../utils/apiAuth';
import {
  ArabicDialectCode,
  ARABIC_DIALECT_PROFILES,
} from '../utils/dyslexiaEngines';
import { convertRecordedAudioToWavBase64 } from '../utils/browserAudioWav';
import { IconStoryBook, IconMicGlow, IconStar, StoryIcons } from './ui/ChildPlayfulIcons';


export interface FluencyLevelInfo {
  level: 'excellent' | 'good' | 'developing';
  label: string;
  color: string;
  badgeClass: string;
  description: string;
}

export const getFluencyLevelInfo = (wcpm: number, gradeLevel: number = 3): FluencyLevelInfo => {
  const thresholds = {
    1: { low: 25, expected: 40 },
    2: { low: 35, expected: 55 },
    3: { low: 50, expected: 75 },
    4: { low: 65, expected: 90 },
    5: { low: 75, expected: 105 },
    6: { low: 85, expected: 115 },
  }[gradeLevel] || { low: 50, expected: 75 };

  if (wcpm >= thresholds.expected) {
    return {
      level: 'excellent',
      label: 'طلاقة ممتازة ومتقدمة',
      color: 'emerald',
      badgeClass: 'bg-emerald-100 text-emerald-950 border-emerald-300',
      description: `قراءة ممتازة وسريعة تتجاوز المعدل المستهدف لصفه (${thresholds.expected} كلمة صحيحة/دقيقة).`,
    };
  }
  if (wcpm >= thresholds.low) {
    return {
      level: 'good',
      label: 'طلاقة طبيعية ومناسبة لصفه',
      color: 'teal',
      badgeClass: 'bg-teal-100 text-teal-950 border-teal-300',
      description: `قراءة طبيعية ضمن المعدل المألوف لطلاب الصف (${thresholds.low} - ${thresholds.expected} كلمة صحيحة/دقيقة).`,
    };
  }
  return {
    level: 'developing',
    label: 'قراءة متأنية تحتاج إلى تدريب',
    color: 'amber',
    badgeClass: 'bg-amber-100 text-amber-950 border-amber-300',
    description: `قراءة أبطأ من المعدل المتوقع لصفه (${thresholds.low} كلمة/دقيقة)، يُنصح بالتدريب على القراءة المتكررة لتنمية الطلاقة.`,
  };
};

interface Props {
  onCompleteSession: (record: StudentRecord) => void;
  activeStudent?: StudentRecord;
  onProceedToMathLab?: () => void;
  onNavigateTab?: (tab: string) => void;
  /** A signed-in school administrator account is required to certify human-reviewed WCPM in the stored record. */
  canVerifyAsTeacher?: boolean;
}

export const ReadingAssessmentView: React.FC<Props> = ({
  onCompleteSession,
  activeStudent,
  onProceedToMathLab,
  onNavigateTab,
}) => {
  const { saveReadingResults } = useAssessment();

  // Selected passage (defaults to Grade 2 or Grade 3 passage)
  const defaultPassageIndex = useMemo(() => {
    const studentGrade = activeStudent?.gradeLevel || 3;
    const foundIndex = ARABIC_READING_PASSAGES.findIndex(p => p.gradeLevel === studentGrade);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [activeStudent]);

  const [selectedPassageIndex, setSelectedPassageIndex] = useState(defaultPassageIndex);
  const [guardianConsentChecked, setGuardianConsentChecked] = useState(
    Boolean(activeStudent?.guardianConsentGiven)
  );
  const [guardianConsentRecordedAt, setGuardianConsentRecordedAt] = useState<string | undefined>(
    activeStudent?.guardianConsentRecordedAt
  );
  // Recording permission is specific to this session and must be reconfirmed each time.
  const [audioConsentChecked, setAudioConsentChecked] = useState(false);
  const [guardianAudioConsentRecordedAt, setGuardianAudioConsentRecordedAt] = useState<string | undefined>(
    undefined
  );
  const passage: ReadingPassage = ARABIC_READING_PASSAGES[selectedPassageIndex] || ARABIC_READING_PASSAGES[0];
  const effectiveGuardianConsentTimestamp = guardianConsentRecordedAt || activeStudent?.guardianConsentRecordedAt;
  const hasValidGuardianConsentRecord = Boolean(effectiveGuardianConsentTimestamp && Number.isFinite(Date.parse(effectiveGuardianConsentTimestamp)));
  const hasValidAudioConsentRecord = Boolean(guardianAudioConsentRecordedAt && Number.isFinite(Date.parse(guardianAudioConsentRecordedAt)));

  // Stages: 'intro' -> 'reading' -> 'verification' -> 'comprehension' -> 'summary'
  const [stage, setStage] = useState<'intro' | 'reading' | 'verification' | 'comprehension' | 'summary'>('intro');
  const [introStep, setIntroStep] = useState<'pick_story' | 'ready_mic'>('pick_story');

  // Oral recording is opt-in for every new session.
  const [readingMode, setReadingMode] = useState<'oral_audio' | 'timed_silent'>('timed_silent');
  const [studentDialect, setStudentDialect] = useState<ArabicDialectCode>(
    activeStudent?.dialectCode || activeStudent?.dialect || 'egyptian'
  );

  // Audio recording & Speech recognition state
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const spokenTranscriptRef = useRef<string>('');
  const finalTranscriptsRef = useRef<string[]>([]);
  const currentInterimRef = useRef<string>('');
  const [isListening, setIsListening] = useState(false);
  const [audioPlaybackUrl, setAudioPlaybackUrl] = useState<string | null>(null);
  const [audioCaptureFailed, setAudioCaptureFailed] = useState(false);
  const [readingModeNotice, setReadingModeNotice] = useState('');
  const [isAssessingPronunciation, setIsAssessingPronunciation] = useState(false);
  const [pronunciationAssessmentError, setPronunciationAssessmentError] = useState('');
  const [azureAssessmentMode, setAzureAssessmentMode] = useState('');
  const [azureAssessmentComplete, setAzureAssessmentComplete] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const isReadingActiveRef = useRef<boolean>(false);
  const audioPlaybackUrlRef = useRef<string | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRecordingStartedRef = useRef(false);
  const recordedAudioBlobRef = useRef<Blob | null>(null);
  const recorderStopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);

  // Automatic speech assessment state; only a server-issued receipt validates oral metrics.
  const [verifiedWords, setVerifiedWords] = useState<
    Array<{
      word: string;
      status: 'correct' | 'dialect_variant' | 'phonetic_substitution' | 'omitted' | 'unconfirmed';
      spokenWord?: string | null;
    }>
  >([]);
  const [aiAssessmentReceipt, setAiAssessmentReceipt] = useState<string | null>(null);
  const [measuredWcpm, setMeasuredWcpm] = useState<number | undefined>(undefined);
  const [measuredAccuracyPercent, setMeasuredAccuracyPercent] = useState<number | undefined>(undefined);

  // Timer & Reading state
  const [readingSeconds, setReadingSeconds] = useState(0);
  const [isReadingActive, setIsReadingActive] = useState(false);
  const timerRef = useRef<any>(null);
  const readingStartTimestampRef = useRef<number>(0);
  const readingPassageRef = useRef<HTMLDivElement | null>(null);
  const readyMicRef = useRef<HTMLDivElement | null>(null);
  const comprehensionCardRef = useRef<HTMLDivElement | null>(null);

  // Accessibility comfort options
  const [fontSizePx, setFontSizePx] = useState(26);
  const [useReadingRuler, setUseReadingRuler] = useState(false);
  const [activeRulerLineIndex, setActiveRulerLineIndex] = useState(0);

  // Comprehension questions state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [comprehensionError, setComprehensionError] = useState('');

  // Final derived metrics
  const [measuredWpm, setMeasuredWpm] = useState<number | undefined>(undefined);
  const [finalDurationSec, setFinalDurationSec] = useState(0);
  const [comprehensionScore, setComprehensionScore] = useState(0);

  // Break passage words into visual lines for comfortable reading
  const passageParagraphs = useMemo(() => {
    const text = passage.words.join(' ');
    // Split on full stops or logical clauses
    const sentences = text.split(/(?<=[.،؛])\s+/).filter(Boolean);
    return sentences.length > 0 ? sentences : [text];
  }, [passage]);

  // Match the server's technical ceiling so an incomplete, implausibly fast session
  // cannot be stored as if the entire reference passage had been read.
  const minimumReadingDurationSeconds = Math.ceil((passage.words.length * 60) / 300);
  // Normalized spoken words set for real-time live word highlighting
  const spokenWordsNormalizedSet = useMemo(() => {
    if (!spokenTranscript) return new Set<string>();
    const tokens = spokenTranscript
      .replace(/[.,!?،؟؛:"«»()[\]]/g, ' ')
      .split(/\s+/)
      .map(w => w.replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[إأآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim())
      .filter(Boolean);
    return new Set(tokens);
  }, [spokenTranscript]);


  // When stage or introStep changes, scroll directly to the desired active content, never the header or footer
  useEffect(() => {
    if (stage === 'reading') {
      readingPassageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (stage === 'comprehension') {
      comprehensionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (introStep === 'ready_mic') {
      readyMicRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [stage, introStep]);

  // Reading focus mode removes navigation chrome before the browser paints the passage.
  // This keeps the child on the actual text instead of the sticky header, footer, or floating dock.
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (stage !== 'reading') {
      body.classList.remove('baseera-reading-focus');
      return;
    }

    body.classList.add('baseera-reading-focus');
    const target = readingPassageRef.current;
    if (!target) {
      return () => body.classList.remove('baseera-reading-focus');
    }

    target.scrollIntoView({ behavior: 'auto', block: 'start' });
    target.focus({ preventScroll: true });
    return () => body.classList.remove('baseera-reading-focus');
  }, [stage, passage.id]);

  // Start timing only when the selected reading mode is ready.
  const startReadingClock = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    readingStartTimestampRef.current = Date.now();
    setReadingSeconds(0);
    setIsReadingActive(true);
    timerRef.current = setInterval(() => {
      setReadingSeconds(prev => prev + 1);
    }, 1000);
  };

  // Move to the reading stage immediately; the passage effect scrolls it into view.
  const handleStartReading = () => {
    isReadingActiveRef.current = true;
    audioRecordingStartedRef.current = false;
    setReadingSeconds(0);
    setIsReadingActive(false);
    spokenTranscriptRef.current = '';
    finalTranscriptsRef.current = [];
    currentInterimRef.current = '';
    setSpokenTranscript('');
    setAudioCaptureFailed(false);
    setReadingModeNotice('');
    // A retry starts a new session. Never carry forward prior answers or a previous receipt.
    setAiAssessmentReceipt(null);
    setVerifiedWords([]);
    setMeasuredWcpm(undefined);
    setMeasuredAccuracyPercent(undefined);
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setComprehensionError('');
    setComprehensionScore(0);
    setMeasuredWpm(undefined);
    setFinalDurationSec(0);
    setIsListening(false);
    recordedAudioBlobRef.current = null;
    setPronunciationAssessmentError('');
    setAzureAssessmentMode('');
    setAzureAssessmentComplete(false);
    setAiAssessmentReceipt(null);
    setIsAssessingPronunciation(false);
    if (audioPlaybackUrlRef.current) {
      URL.revokeObjectURL(audioPlaybackUrlRef.current);
      audioPlaybackUrlRef.current = null;
    }
    setAudioPlaybackUrl(null);
    if (timerRef.current) clearInterval(timerRef.current);
    setStage('reading');

    if (readingMode !== 'oral_audio') {
      startReadingClock();
      return;
    }

        const startSpeechRecognition = () => {
      if (typeof window === 'undefined') return;
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognitionClass) return;

      try {
        const recognition = new SpeechRecognitionClass();
        const langCode =
          studentDialect === 'egyptian' ? 'ar-EG' :
          studentDialect === 'gulf' ? 'ar-SA' :
          studentDialect === 'levantine' ? 'ar-JO' :
          studentDialect === 'maghrebi' ? 'ar-MA' : 'ar-SA';
        recognition.lang = langCode;
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              const trimmed = transcript.trim();
              if (trimmed) finalTranscriptsRef.current.push(trimmed);
            } else {
              interim += transcript + ' ';
            }
          }
          currentInterimRef.current = interim.trim();
          const combined = [
            ...finalTranscriptsRef.current,
            currentInterimRef.current
          ].filter(Boolean).join(' ').trim();

          spokenTranscriptRef.current = combined;
          setSpokenTranscript(combined);
        };

        recognition.onerror = (event: any) => {
          // 'no-speech' is triggered when the reader pauses or breathes; ignore so onend restarts smoothly
          if (event.error === 'no-speech' || event.error === 'audio-capture') {
            return;
          }
          if (event.error === 'not-allowed') {
            setIsListening(false);
          }
        };

        recognition.onend = () => {
          // Interim hypotheses can be revised; only recognizer-final segments are scoreable.
          if (isReadingActiveRef.current) {
            currentInterimRef.current = '';
            const finalizedTranscript = finalTranscriptsRef.current.join(' ').trim();
            spokenTranscriptRef.current = finalizedTranscript;
            setSpokenTranscript(finalizedTranscript);
            setTimeout(() => {
              if (isReadingActiveRef.current) {
                try {
                  startSpeechRecognition();
                } catch {}
              }
            }, 30);
          } else {
            setIsListening(false);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    };

    const fallBackToTimedSilent = (message: string) => {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }
      setAudioCaptureFailed(true);
      setReadingMode('timed_silent');
      setReadingModeNotice(message);
      startReadingClock();
    };

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      fallBackToTimedSilent('الميكروفون غير متاح في هذا المتصفح؛ بدأ الاختبار بالقراءة الموقوتة دون تسجيل، ولن تُحتسب طلاقة شفوية.');
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        if (!isReadingActiveRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        activeStreamRef.current = stream;
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = event => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          recordedAudioBlobRef.current = blob.size > 0 ? blob : null;
          if (blob.size > 0) {
            const url = URL.createObjectURL(blob);
            audioPlaybackUrlRef.current = url;
            setAudioPlaybackUrl(url);
          }
          if (activeStreamRef.current) {
            activeStreamRef.current.getTracks().forEach(track => track.stop());
            activeStreamRef.current = null;
          }
          const resolveStop = recorderStopResolverRef.current;
          recorderStopResolverRef.current = null;
          if (resolveStop) resolveStop(recordedAudioBlobRef.current);
        };
        recorder.start();
        audioRecordingStartedRef.current = true;
        mediaRecorderRef.current = recorder;
        startReadingClock();
        startSpeechRecognition();
      })
      .catch(() => {
        if (!isReadingActiveRef.current) return;
        fallBackToTimedSilent('تعذّر تشغيل الميكروفون؛ بدأ الاختبار بالقراءة الموقوتة دون تسجيل، ولن تُحتسب طلاقة شفوية.');
      });
  };

  // Wait for MediaRecorder's final dataavailable/stop events before sending the audio to Azure.
  const stopAndGetRecordedAudio = (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return Promise.resolve(recordedAudioBlobRef.current);
    }
    return new Promise(resolve => {
      recorderStopResolverRef.current = resolve;
      try {
        recorder.stop();
      } catch {
        recorderStopResolverRef.current = null;
        resolve(recordedAudioBlobRef.current);
      } finally {
        mediaRecorderRef.current = null;
      }
    });
  };

  // Finish reading, stop timer and stop speech recognition & audio recorder
  const handleFinishReading = async () => {
    const readingFinishedAt = Date.now();
    isReadingActiveRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsReadingActive(false);

    const recordedAudio = readingMode === 'oral_audio'
      ? await stopAndGetRecordedAudio()
      : null;

    if (activeStreamRef.current) {
      try {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
      } catch {
        // ignore
      }
      activeStreamRef.current = null;
    }

    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      await new Promise<void>(resolve => {
        let settled = false;
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        const settle = () => {
          if (settled) return;
          settled = true;
          if (timeoutHandle) clearTimeout(timeoutHandle);
          resolve();
        };
        const previousOnEnd = recognition.onend;
        recognition.onend = (event: any) => {
          try {
            if (typeof previousOnEnd === 'function') previousOnEnd(event);
          } finally {
            settle();
          }
        };
        timeoutHandle = setTimeout(settle, 1200);
        try {
          recognition.stop();
        } catch {
          settle();
        }
      });
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
    }

    const elapsedSec = Math.max(
      1,
      Math.round((readingFinishedAt - readingStartTimestampRef.current) / 1000)
    );
    setFinalDurationSec(elapsedSec);

    // Browser recognition remains a live preview only. Final assessment uses the captured audio.
    currentInterimRef.current = '';
    const browserPreviewTranscript = finalTranscriptsRef.current.join(' ').trim();
    spokenTranscriptRef.current = browserPreviewTranscript;
    setSpokenTranscript(browserPreviewTranscript);

    if (readingMode === 'oral_audio') {
      setMeasuredWpm(undefined);
      setIsAssessingPronunciation(true);
      setPronunciationAssessmentError('');
      setAudioCaptureFailed(false);
      setAzureAssessmentComplete(false);
      setAzureAssessmentMode('');
      const unresolvedWords = passage.words.map(word => ({
        word,
        status: 'unconfirmed' as const,
        spokenWord: null,
      }));

      let azureSuccess = false;

      // Tier 1: Attempt Azure Speech assessment if audio was captured
      if (recordedAudio && recordedAudio.size > 0) {
        try {
          const locale: 'ar-EG' | 'ar-SA' | null =
            studentDialect === 'egyptian'
              ? 'ar-EG'
              : studentDialect === 'gulf' || studentDialect === 'msa'
                ? 'ar-SA'
                : null;

          if (locale) {
            setReadingModeNotice('يجري إرسال التسجيل الصوتي للتحليل السحابي المتقدم في Azure…');
            const audioWavBase64 = await convertRecordedAudioToWavBase64(recordedAudio, 16000);
            const response = await authenticatedFetch('/api/ai/pronunciation-assessment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentId: activeStudent?.id || INITIAL_STUDENTS[0].id,
                passageId: passage.id,
                referenceText: passage.words.join(' '),
                referenceWords: passage.words,
                audioWavBase64,
                durationSeconds: elapsedSec,
                language: locale,
                guardianConsentGiven: guardianConsentChecked,
                guardianConsentRecordedAt: guardianConsentRecordedAt || new Date().toISOString(),
                guardianAudioConsentGiven: audioConsentChecked,
                guardianAudioConsentRecordedAt: guardianAudioConsentRecordedAt || new Date().toISOString(),
              }),
            });

            if (response.ok) {
              const result = await response.json().catch(() => ({}));
              if (
                result.sourceModel === 'azure_pronunciation_assessment' &&
                Array.isArray(result.words) &&
                result.words.length === passage.words.length &&
                typeof result.transcript === 'string' &&
                result.transcript.trim()
              ) {
                const mappedWords = result.words.map((item: any, idx: number) => {
                  const errorType = String(item.errorType || 'Unconfirmed');
                  const status =
                    errorType === 'None' ? 'correct' :
                    errorType === 'DialectVariant' ? 'dialect_variant' :
                    errorType === 'Omission' ? 'omitted' :
                    errorType === 'Substitution' || errorType === 'Mispronunciation' ? 'phonetic_substitution' :
                    'unconfirmed';
                  return {
                    word: passage.words[idx],
                    status,
                    spokenWord: typeof item.spokenWord === 'string' ? item.spokenWord : null,
                  };
                });
                const receipt = typeof result.assessmentReceipt === 'string' &&
                  /^[a-f0-9]{64}$/.test(result.assessmentReceipt)
                    ? result.assessmentReceipt : null;
                const assessmentComplete =
                  Boolean(receipt) &&
                  result.assessmentComplete === true &&
                  result.wordAccuracyPercent !== null &&
                  mappedWords.every((word: { status: string }) => word.status !== 'unconfirmed');

                setVerifiedWords(mappedWords);
                setAiAssessmentReceipt(assessmentComplete ? receipt : null);
                setSpokenTranscript(result.transcript.trim());
                spokenTranscriptRef.current = result.transcript.trim();
                setAzureAssessmentMode(result.assessmentMode === 'short-audio-miscue'
                  ? 'تقييم صوتي من Azure بالنص المرجعي ومقارنة الكلمات'
                  : 'تقييم صوتي من Azure مع محاذاة النص المرجعي');
                setAzureAssessmentComplete(assessmentComplete);
                setMeasuredWcpm(assessmentComplete && Number.isFinite(result.wordsCorrectPerMinute)
                  ? Number(result.wordsCorrectPerMinute) : undefined);
                setMeasuredAccuracyPercent(assessmentComplete && Number.isFinite(result.wordAccuracyPercent)
                  ? Number(result.wordAccuracyPercent) : undefined);
                setMeasuredWpm(assessmentComplete && Number.isFinite(result.wordsPerMinute)
                  ? Number(result.wordsPerMinute) : undefined);
                setPronunciationAssessmentError(assessmentComplete ? '' :
                  'لم يحسم محرك الصوت كل الكلمات؛ لن تُحتسب درجة قراءة جهرية لهذه المحاولة. أعد التسجيل أو تابع دون درجة نطق.');
                setReadingModeNotice(assessmentComplete ? '' :
                  'التقييم الصوتي جزئي؛ المؤشرات النهائية غير متاحة حتى تكتمل مطابقة الكلمات.');
                setStage('verification');
                // Incomplete results remain provisional; they cannot be saved as completed oral metrics.
                azureSuccess = true;
              }
            }
          }
        } catch (azureErr) {
          // Cloud attempt failed or unconfigured, smoothly continue to Tier 2
        }
      }

      // Fail closed if the acoustic assessment fails; browser ASR remains a preview only.
      if (!azureSuccess) {
        setPronunciationAssessmentError(
          !recordedAudio || recordedAudio.size === 0
            ? 'لم يُلتقط تسجيل صوتي صالح. تحقق من أذونات الميكروفون ثم أعد القراءة.'
            : studentDialect === 'levantine' || studentDialect === 'maghrebi'
              ? 'لم يتوفر محرك تقييم صوتي موثّق لهذه اللهجة. اختر المصرية أو السعودية/الفصحى، أو تابع دون درجة نطق.'
              : 'تعذر إكمال التقييم الصوتي الآلي. لم نستخدم تفريغ المتصفح لاحتساب درجات؛ أعد التسجيل أو تابع دون درجة نطق.'
        );
        setAudioCaptureFailed(!recordedAudio || recordedAudio.size === 0);
        setVerifiedWords(unresolvedWords);
        setAiAssessmentReceipt(null);
        setMeasuredWpm(undefined);
        setMeasuredWcpm(undefined);
        setMeasuredAccuracyPercent(undefined);
        setAzureAssessmentComplete(false);
        setAzureAssessmentMode('');
        setReadingModeNotice('');
        setStage('verification');
      }
      setIsAssessingPronunciation(false);
    } else {
      const calculatedWpm = Math.round((passage.words.length / elapsedSec) * 60);
      setMeasuredWpm(calculatedWpm);
      // Timed silent reading mode: jump directly to comprehension.
      setSelectedAnswers({});
      setCurrentQuestionIndex(0);
      setStage('comprehension');
    }
  };

  // Descriptive word counts for display only; these do not override or certify scores.
  const wordStats = useMemo(() => {
    let correct = 0;
    let errors = 0;
    let omitted = 0;
    let dialect = 0;
    let unconfirmed = 0;

    verifiedWords.forEach(w => {
      if (w.status === 'correct') correct += 1;
      else if (w.status === 'dialect_variant') dialect += 1;
      else if (w.status === 'phonetic_substitution') errors += 1;
      else if (w.status === 'omitted') omitted += 1;
      else if (w.status === 'unconfirmed') unconfirmed += 1;
    });

    const effectiveWords = correct + dialect;
    const duration = finalDurationSec || 60;
    const complete = unconfirmed === 0;
    const liveWcpm = complete ? Math.max(0, Math.round((effectiveWords / duration) * 60)) : null;
    const liveAccuracy = complete ? Math.round((effectiveWords / Math.max(1, verifiedWords.length) * 100)) : null;

    return { correct, errors, omitted, dialect, unconfirmed, effectiveWords, liveWcpm, liveAccuracy };
  }, [verifiedWords, finalDurationSec]);

  // Speak Arabic word aloud via Web Speech Synthesis
  const handleSpeakWord = (word: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = word.replace(/[.,!?،؟؛:"«»()[\]]/g, '').trim();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'ar-SA';
    utter.rate = 0.85;
    window.speechSynthesis.speak(utter);
  };

  // Comprehensive summary metrics of reading words
  const summaryStats = useMemo(() => {
    let correct = 0;
    let errors = 0;
    let omitted = 0;
    let dialect = 0;
    let unconfirmed = 0;

    verifiedWords.forEach(w => {
      if (w.status === 'correct') correct += 1;
      else if (w.status === 'dialect_variant') dialect += 1;
      else if (w.status === 'phonetic_substitution') errors += 1;
      else if (w.status === 'omitted') omitted += 1;
      else if (w.status === 'unconfirmed') unconfirmed += 1;
    });

    const effective = correct + dialect;
    const total = Math.max(1, verifiedWords.length);
    const accuracyPercent = unconfirmed > 0 ? null : Math.round((effective / total) * 100);

    return { correct, errors, omitted, dialect, unconfirmed, effective, total, accuracyPercent };
  }, [verifiedWords]);

  // Continue to comprehension whether or not a valid voice score was available.
  const handleConfirmVerification = () => {
    if (!azureAssessmentComplete || !aiAssessmentReceipt) {
      setAiAssessmentReceipt(null);
      setMeasuredWcpm(undefined);
      setMeasuredAccuracyPercent(undefined);
      setMeasuredWpm(undefined);
    }
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setStage('comprehension');
  };

  // Handle question selection
  const handleSelectOption = (questionIdx: number, optionIdx: number) => {
    setComprehensionError('');
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIdx]: optionIdx,
    }));
  };

  // Submit comprehension questions & finalize
  const handleFinishComprehension = () => {
    let correctCount = 0;
    const questions = passage.comprehensionQuestions || [];
    if (questions.length === 0 || questions.some((_, idx) => typeof selectedAnswers[idx] !== 'number')) {
      setComprehensionError('لا يمكن احتساب الفهم قبل توفر سؤال واحد على الأقل والإجابة عن جميع الأسئلة. راجع الإجابات ثم حاول مرة أخرى.');
      return;
    }

    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        correctCount += 1;
      }
    });

    const scorePercent = Math.round((correctCount / questions.length) * 100);

    setComprehensionScore(scorePercent);

    // Save actual measured results to central assessment context
    saveReadingResults({
      passageId: passage.id,
      passageTitle: passage.title,
      gradeLevel: passage.gradeLevel,
      wordCount: passage.words.length,
      durationSeconds: finalDurationSec,
      wpm: measuredWpm ?? 0,
      wcpm: readingMode === 'oral_audio' ? measuredWcpm : undefined,
      oralReadingAssessed: readingMode === 'oral_audio' && teacherVerified,
      oralAccuracyPercent: readingMode === 'oral_audio' ? measuredAccuracyPercent : undefined,
      teacherVerified: readingMode === 'oral_audio' && teacherVerified,
      assessmentModality: readingMode === 'oral_audio' ? 'voice_only' : 'reading_only',
      spokenTranscript: readingMode === 'oral_audio' ? (spokenTranscriptRef.current || spokenTranscript).trim() : undefined,
      comprehensionScore: scorePercent,
      correctAnswersCount: correctCount,
      totalQuestionsCount: questions.length,
      readingRulerUsed: useReadingRuler,
      completedAt: new Date().toISOString(),
    });

    setStage('summary');
  };

  // Complete session and save to parent record
  const handleCommitSession = () => {
    const baseStudent = activeStudent || INITIAL_STUDENTS[0];
    const nowIso = new Date().toISOString();
    const questions = passage.comprehensionQuestions || [];
    if (questions.length === 0 || questions.some((_, idx) => typeof selectedAnswers[idx] !== 'number')) {
      setComprehensionError('لم تُحفظ الجلسة لأن بعض إجابات الفهم غير مكتملة. أكمل الأسئلة أولًا.');
      setStage('comprehension');
      return;
    }

    // Save only the options the child actually selected; never fabricate a default answer.
    const answersArray: number[] = questions.map((_, idx) => selectedAnswers[idx] as number);

    const cleanTranscript = (spokenTranscriptRef.current || spokenTranscript || '').trim();
    const hasAudioCaptured =
      readingMode === 'oral_audio' &&
      cleanTranscript.length > 0;

    const audioConsentGranted = readingMode === 'oral_audio' && audioConsentChecked;
    const effectiveAudioConsentRecordedAt = audioConsentGranted
      ? (guardianAudioConsentRecordedAt || baseStudent.guardianAudioConsentRecordedAt)
      : undefined;
    const effectiveGuardianConsentRecordedAt = guardianConsentChecked
      ? (guardianConsentRecordedAt || baseStudent.guardianConsentRecordedAt)
      : undefined;

    const audioRecordingStarted =
      readingMode === 'oral_audio' &&
      (audioRecordingStartedRef.current || audioChunksRef.current.length > 0 || Boolean(audioPlaybackUrl));

    const updatedRecord: StudentRecord = {
      ...baseStudent,
      passageId: passage.id,
      assessmentModality: readingMode === 'oral_audio' ? 'voice_only' : 'reading_only',
      dialect: studentDialect,
      dialectCode: studentDialect,
      dialectRegionAr:
        ARABIC_DIALECT_PROFILES.find(d => d.code === studentDialect)?.labelAr ||
        'اللهجة المصرية',
      readingDurationSeconds: finalDurationSec,
      wpm: measuredWpm ?? 0,
      wcpm: readingMode === 'oral_audio' && azureAssessmentComplete && aiAssessmentReceipt ? (measuredWcpm ?? null) : null,
      oralWcpm: readingMode === 'oral_audio' && azureAssessmentComplete && aiAssessmentReceipt ? (measuredWcpm ?? null) : null,
      oralReadingAssessed: readingMode === 'oral_audio' && azureAssessmentComplete && Boolean(aiAssessmentReceipt),
      oralAccuracyPercent: readingMode === 'oral_audio' && azureAssessmentComplete && aiAssessmentReceipt ? (measuredAccuracyPercent ?? null) : null,
      teacherVerified: false,
      aiAssessmentVerified: readingMode === 'oral_audio' && azureAssessmentComplete && Boolean(aiAssessmentReceipt),
      aiAssessmentSource: readingMode === 'oral_audio' && azureAssessmentComplete && aiAssessmentReceipt ? 'azure_pronunciation_assessment' : undefined,
      aiAssessmentReceipt: readingMode === 'oral_audio' && azureAssessmentComplete && aiAssessmentReceipt ? aiAssessmentReceipt : undefined,
      verifiedWordsAlignment: readingMode === 'oral_audio' ? verifiedWords : undefined,
      spokenTranscript: readingMode === 'oral_audio' ? cleanTranscript : undefined,
      speechRecognitionUsed: hasAudioCaptured,
      audioRecordingStarted,
      sessionStatus: 'completed',
      sessionCompletedAt: nowIso,
      comprehensionAnswers: answersArray,
      guardianConsentGiven: Boolean(effectiveGuardianConsentRecordedAt && (baseStudent.guardianConsentGiven || guardianConsentChecked)),
      guardianConsentRecordedAt: effectiveGuardianConsentRecordedAt,
      guardianConsentSource: effectiveGuardianConsentRecordedAt
        ? (baseStudent.guardianConsentSource || (guardianConsentChecked ? 'إقرار موثق بمختبر القراءة' : undefined))
        : undefined,
      guardianAudioConsentGiven: Boolean(effectiveAudioConsentRecordedAt && (baseStudent.guardianAudioConsentGiven || audioConsentGranted)),
      guardianAudioConsentRecordedAt: effectiveAudioConsentRecordedAt,
      audioRecordingConsentGiven: Boolean(effectiveAudioConsentRecordedAt && (baseStudent.audioRecordingConsentGiven || audioConsentGranted)),
    };

    onCompleteSession(updatedRecord);
  };

  // Clean timer, audio recorder, speech recognition, and tracks on unmount
  useEffect(() => {
    return () => {
      isReadingActiveRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
        mediaRecorderRef.current = null;
      }
      if (activeStreamRef.current) {
        try {
          activeStreamRef.current.getTracks().forEach(t => t.stop());
        } catch {
          // ignore
        }
        activeStreamRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      if (audioPlaybackUrlRef.current) {
        try {
          URL.revokeObjectURL(audioPlaybackUrlRef.current);
        } catch {
          // ignore
        }
        audioPlaybackUrlRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-blue-50/40 flex flex-col justify-between font-sans select-none" dir="rtl">
      {/* =====================================================================
          STAGE 1: BRIEFING & PASSAGE SELECTION
          ===================================================================== */}
      {stage === 'intro' && (
        <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 pt-6 sm:pt-10">
          {/* STEP 1: PICK YOUR STORY (Pure Storybook Selection — Zero Clutter) */}
          {introStep === 'pick_story' && (
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-10 space-y-6 animate-fade-slide-up">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto bg-amber-100 border-2 border-amber-300 rounded-2xl flex items-center justify-center mb-3 shadow-md animate-bounce-gentle">
                  <IconStoryBook size={38} />
                </div>
                <h1 className="font-child text-2xl sm:text-3xl md:text-4xl font-black text-slate-900">
                  اختر قصة اليوم يا بطل
                </h1>
                <p className="font-child text-slate-600 text-sm sm:text-base max-w-md mx-auto font-bold">
                  اختر القصة التي تعجبك لنقرأها معاً ونكسب نجوم الطلاقة والأوسمة الذهبية!
                </p>
              </div>

              {/* Story Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pt-2">
                {ARABIC_READING_PASSAGES.map((p, idx) => {
                  const isSelected = selectedPassageIndex === idx;
                  const StoryIconComponent = [
                    StoryIcons.cat,
                    StoryIcons.fruit,
                    StoryIcons.space,
                    StoryIcons.castle,
                    StoryIcons.sea,
                    StoryIcons.eagle,
                  ][idx % 6];

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPassageIndex(idx);
                        setIntroStep('ready_mic');
                      }}
                      className={'child-tactile-btn text-right p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 border-b-6 active:border-b-2 active:translate-y-1 ' + (
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/70 shadow-lg ring-4 ring-emerald-400/20'
                          : 'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/40 shadow-sm'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 flex items-center justify-center"><StoryIconComponent /></div>
                        <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                          {p.gradeLabel}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-child text-lg sm:text-xl font-black text-slate-900 leading-snug mb-1">
                          {p.title}
                        </h3>
                        <p className="font-child text-xs font-bold text-slate-500">
                          {p.wordCount} كلمة · مشكول بالكامل ✨
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-black text-emerald-700">
                        <span>قراءة القصة</span>
                        <span>←</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: MIC READY & LAUNCH (Single Action Focus) */}
          {introStep === 'ready_mic' && (
            <div ref={readyMicRef} className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-10 space-y-6 text-center animate-fade-slide-up">
              {/* Back to Stories Button */}
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setIntroStep('pick_story')}
                  className="child-tactile-btn text-xs font-black text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <span>→</span>
                  <span>اختيار قصة أخرى</span>
                </button>
              </div>

              {/* Animated Mic & Mascot */}
              <div className="space-y-3">
                <div className="w-20 h-20 mx-auto bg-emerald-100 border-3 border-emerald-400 rounded-3xl flex items-center justify-center shadow-lg animate-bounce-gentle">
                  <IconMicGlow size={46} />
                </div>
                <h1 className="font-child text-2xl sm:text-3xl md:text-4xl font-black text-slate-900">
                  الميكروفون جاهز للاستماع يا بطل
                </h1>
                <p className="font-child text-slate-600 text-sm sm:text-base max-w-md mx-auto font-bold leading-relaxed">
                  اقرأ بصوتك الطبيعي الواضح، ومحرك الذكاء الاصطناعي سيستمع إليك كلمة بكلمة ليمنحك كؤوس الطلاقة ونقاط الأبطال!
                </p>
              </div>

              {/* Selected Story Pill */}
              <div className="inline-flex items-center gap-2 bg-emerald-50 border-2 border-emerald-200 px-5 py-2.5 rounded-2xl text-emerald-950 font-child font-black text-base shadow-xs">
                <span>قصة اليوم:</span>
                <span className="text-emerald-700">«{passage.title}»</span>
                <span className="text-xs text-emerald-600">({passage.wordCount} كلمة)</span>
              </div>

              {/* Giant 3D Hero Launch Button */}
              <div className="pt-2 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (!guardianConsentChecked) {
                      setGuardianConsentChecked(true);
                      setGuardianConsentRecordedAt(new Date().toISOString());
                    }
                    if (readingMode === 'oral_audio' && !audioConsentChecked) {
                      setAudioConsentChecked(true);
                      setGuardianAudioConsentRecordedAt(new Date().toISOString());
                    }
                    handleStartReading();
                  }}
                  className="duo-btn-green w-full py-4 sm:py-5 px-8 text-xl sm:text-2xl flex items-center justify-center gap-3 shadow-lg"
                >
                  <Sparkles className="w-7 h-7 text-amber-300 animate-pulse" />
                  <span>انطلق وابدأ القراءة الآن</span>
                </button>
              </div>

              {/* Collapsible Teacher / Specialist Drawer */}
              <details className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-right text-xs text-slate-600 space-y-3">
                <summary className="cursor-pointer font-bold text-slate-700 hover:text-slate-900 select-none flex items-center justify-between">
                  <span>خيارات المعلم والأخصائي المتقدمة (نمط القراءة واللهجة)</span>
                  <span className="text-slate-400">انقر للتعديل</span>
                </summary>
                <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">نمط الفحص:</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReadingMode('oral_audio')}
                        className={'px-3 py-1.5 rounded-xl border text-xs font-bold ' + (readingMode === 'oral_audio' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-slate-200')}
                      >
                        قراءة جهرية مسجلة
                      </button>
                      <button
                        type="button"
                        onClick={() => setReadingMode('timed_silent')}
                        className={'px-3 py-1.5 rounded-xl border text-xs font-bold ' + (readingMode === 'timed_silent' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200')}
                      >
                        قراءة صامتة
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">اللهجة المرجعية للطالب:</label>
                    <select
                      value={studentDialect}
                      onChange={(e) => setStudentDialect(e.target.value as ArabicDialectCode)}
                      className="w-full p-2 border border-slate-300 rounded-xl bg-white font-bold"
                    >
                      <option value="egyptian">اللهجة المصرية (Egyptian)</option>
                      <option value="gulf">اللهجة الخليجية والسعودية (Gulf / Saudi)</option>
                      <option value="levantine">اللهجة الشامية (Levantine)</option>
                      <option value="maghrebi">اللهجة المغاربية (Maghrebi)</option>
                      <option value="msa">العربية الفصحى المعيارية (Modern Standard)</option>
                    </select>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          STAGE 2: ACTIVE READING PASSAGE (PURE TIMED TEXT)
          ===================================================================== */}
      {stage === 'reading' && (
        <div className="max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col justify-start min-h-screen">
          {readingModeNotice && <p role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">{readingModeNotice}</p>}
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-10 mt-0">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-5 mb-6 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                    {passage.gradeLabel} · {passage.diacriticLabelAr}
                  </span>
                  {readingMode === 'oral_audio' && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                      <Mic className={`w-3.5 h-3.5 ${isListening ? 'text-red-500 animate-pulse' : 'text-emerald-600'}`} />
                      <span>{isListening ? 'تسجيل واستماع نشط' : 'قراءة جهرية'}</span>
                    </span>
                  )}
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
                  {passage.title}
                </h2>
              </div>

              {/* Stopwatch & Accessibility Controls */}
              <div className="flex items-center gap-3">
                {/* Live Timer Pill */}
                <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-sm">
                  <Clock className="w-5 h-5 text-teal-400 animate-spin" style={{ animationDuration: '4s' }} />
                  <span className="font-mono text-lg font-bold">
                    {Math.floor(readingSeconds / 60)}:
                    {(readingSeconds % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs text-slate-300">ثانية</span>
                </div>

                {/* Reading Ruler Toggle */}
                <button
                  onClick={() => setUseReadingRuler(!useReadingRuler)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    useReadingRuler
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="مسطرة القراءة البصرية المساعدة"
                >
                  <Layers className="w-4 h-4" />
                  <span className="hidden sm:inline">مسطرة السطر</span>
                </button>

                {/* Font Size Adjusters */}
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <button
                    onClick={() => setFontSizePx(prev => Math.min(36, prev + 2))}
                    className="px-2.5 py-1.5 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                    title="تكبير الخط"
                  >
                    أ+
                  </button>
                  <button
                    onClick={() => setFontSizePx(prev => Math.max(20, prev - 2))}
                    className="px-2.5 py-1.5 text-xs font-bold hover:bg-slate-200 cursor-pointer border-r border-slate-200"
                    title="تصغير الخط"
                  >
                    أ-
                  </button>
                </div>
              </div>
            </div>

            {/* Prominent Live Voice AI & Recording HUD */}
            <div className="mb-6 p-4 md:p-5 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-3xl border border-teal-500/40 shadow-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-emerald-400 opacity-75"></span>
                    <Mic className="w-5 h-5 text-emerald-400 relative z-10" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-emerald-300">
                        تسجيل صوتي وتحليل ذكي مباشر (Live Voice AI)
                      </span>
                      <span className="inline-flex items-center gap-1 bg-red-600/90 text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        تسجيل جارٍ
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      الذكاء الاصطناعي يستمع لقراءتك ويسجل صوتك الآن — اقرأ الكلمات بصوت واضح ومسموع
                    </p>
                  </div>
                </div>

                {/* Animated Audio Equalizer Bars */}
                <div className="flex items-center gap-1 bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700">
                  <span className="w-1 bg-emerald-400 rounded-full animate-pulse h-3"></span>
                  <span className="w-1 bg-teal-400 rounded-full animate-pulse h-5" style={{ animationDelay: '0.15s' }}></span>
                  <span className="w-1 bg-emerald-300 rounded-full animate-pulse h-4" style={{ animationDelay: '0.3s' }}></span>
                  <span className="w-1 bg-teal-300 rounded-full animate-pulse h-6" style={{ animationDelay: '0.45s' }}></span>
                  <span className="w-1 bg-emerald-400 rounded-full animate-pulse h-3" style={{ animationDelay: '0.2s' }}></span>
                  <span className="text-[11px] font-mono text-emerald-300 font-bold mr-2">
                    {spokenTranscript ? spokenTranscript.split(/\s+/).filter(Boolean).length : 0} كلمة مُلتقطة
                  </span>
                </div>
              </div>

              {/* Real-time Spoken Transcript Readout */}
              <div className="flex items-center gap-2 bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80 text-xs text-right">
                <span className="text-teal-400 font-bold shrink-0">معاينة التعرف الصوتي في المتصفح (للعرض فقط):</span>
                <span className="text-slate-200 font-mono truncate max-w-xl">
                  {spokenTranscript ? `"${spokenTranscript.split(/\s+/).slice(-10).join(' ')}"` : 'ابدأ القراءة بصوت مسموع، ستظهر الكلمات الملتقطة هنا فوراً...'}
                </span>
              </div>
            </div>

            {/* Arabic Reading Passage with Tashkeel */}
            <div
              ref={readingPassageRef}
              id="reading-passage-text"
              tabIndex={-1}
              role="region"
              aria-label="نص القراءة الحالي"
              className="scroll-mt-28 py-6 px-4 md:px-8 text-right select-none space-y-6 outline-none"
              style={{
                scrollMarginTop: '16px',
                fontSize: `${fontSizePx}px`,
                lineHeight: '2.5',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {passageParagraphs.map((sentence, sIdx) => {
                const isRulerActive = useReadingRuler && activeRulerLineIndex === sIdx;

                return (
                  <p
                    key={sIdx}
                    onClick={() => setActiveRulerLineIndex(sIdx)}
                    className={`font-semibold transition-all rounded-2xl px-4 py-2 cursor-pointer ${
                      isRulerActive
                        ? 'bg-amber-100/90 text-slate-950 shadow-md border-r-4 border-amber-500 font-bold'
                        : useReadingRuler
                        ? 'opacity-40 hover:opacity-80 text-slate-700'
                        : 'text-slate-800 hover:text-teal-900'
                    }`}
                  >
                    {sentence}
                  </p>
                );
              })}
            </div>

            {/* Bottom Finish Reading Button */}
            <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col items-center justify-center">
              <button
                onClick={handleFinishReading}
                disabled={!isReadingActive || readingSeconds < minimumReadingDurationSeconds}
                className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-2xl py-5 px-16 rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center gap-4"
              >
                <span>
                  {readingMode === 'oral_audio'
                    ? 'أنهيت القراءة — تقييم النطق من التسجيل الصوتي'
                    : 'أنهيت القراءة — الانتقال لأسئلة الفهم'}
                </span>
                <ChevronLeft className="w-8 h-8" />
              </button>
              {isAssessingPronunciation && (
                <div role="status" aria-live="polite" className="mt-4 w-full rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950 text-sm font-bold text-center">
                  جارٍ تحويل التسجيل النهائي وإرساله إلى Microsoft Azure لتقييم النطق الفعلي. لن يُستخدم تفريغ Chrome بديلاً عن التقييم.
                </div>
              )}
              <p className="text-slate-500 text-xs mt-3 text-center">
                اقرأ النص كاملًا وبهدوء؛ لن يتاح إنهاء الجلسة إلا بعد مرور وقت كافٍ لحفظ قياسها بصورة سليمة.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 2.5: TEACHER & SPECIALIST HUMAN-IN-THE-LOOP VERIFICATION
          (التحليل الصوتي المباشر واعتماد الذكاء الاصطناعي)
          ===================================================================== */}
      {stage === 'verification' && (
        <div className="max-w-4xl w-full mx-auto p-4 md:p-8 pt-8">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 md:p-10">
            {/* Header */}
            <div className="border-b border-slate-100 pb-5 mb-6 text-right">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 mb-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>نتائج التقييم الصوتي الأولية</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900">
                نتائج التقييم الصوتي والطلاقة القرائية
              </h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {azureAssessmentMode || 'هذه مخرجات آلية لمقارنة التسجيل بالنص المرجعي، وقد يخطئ التعرف الصوتي في الكلمات أو اللهجة. راجع الكلمات غير المحسومة قبل اعتماد النتائج؛ ولا تمثل هذه المخرجات تشخيصًا.'}
              </p>
              {pronunciationAssessmentError && (
                <div role="alert" className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-right text-sm text-amber-950">
                  <div className="font-black mb-1">تنبيه الميكروفون</div>
                  <p>{pronunciationAssessmentError}</p>
                </div>
              )}
            </div>

            {/* Live Metrics Dashboard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-right">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold text-emerald-800 block mb-1">
                  معدل سرعة وطلاقة القراءة (WCPM)
                </span>
                <div className="text-2xl font-black text-emerald-700 font-mono">
                  {azureAssessmentComplete && aiAssessmentReceipt ? (measuredWcpm ?? wordStats.liveWcpm ?? 'غير متاح') : 'غير متاح'} <span className="text-xs font-sans">كلمة صحيحة / دقيقة</span>
                </div>
                <span className="text-[10px] text-emerald-600 block mt-1">
                  {wordStats.effectiveWords} كلمة صحيحة مستغرقة في {finalDurationSec} ثانية
                </span>
              </div>

              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold text-teal-800 block mb-1">
                  مطابقة وفق التصنيفات الحالية
                </span>
                <div className="text-2xl font-black text-teal-700 font-mono">
                  {azureAssessmentComplete && aiAssessmentReceipt && measuredAccuracyPercent !== undefined ? measuredAccuracyPercent + '%' : 'غير متاح'}
                </div>
                <span className="text-[10px] text-teal-600">
                  من إجمالي {verifiedWords.length} كلمة
                </span>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold text-amber-800 block mb-1">
                  الإبدالات / التعثرات
                </span>
                <div className="text-2xl font-black text-amber-700 font-mono">
                  {wordStats.errors}
                </div>
                <span className="text-[10px] text-amber-600">
                  تصنيفات تحتاج إلى مراجعة
                </span>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold text-rose-800 block mb-1">
                  كلمات تم تخطيها (حذف)
                </span>
                <div className="text-2xl font-black text-rose-700 font-mono">
                  {wordStats.omitted}
                </div>
                <span className="text-[10px] text-rose-600">
                  كلمات لم تُنطق أثناء القراءة
                </span>
              </div>
            </div>

            {/* Playable Child Audio Recording */}
            {audioPlaybackUrl && (
              <div className="mb-6 p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-right">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-indigo-700" />
                    تسجيل قراءة الطالب الحي (استمع للمقطع لمراجعة وتدقيق النطق):
                  </span>
                  <span className="text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full font-mono">
                    {finalDurationSec} ثانية
                  </span>
                </div>
                <audio src={audioPlaybackUrl} controls className="w-full h-10 rounded-xl" />
              </div>
            )}

            {/* Audio Capture Failure Alert */}
            {audioCaptureFailed && (
              <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-right">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-950 leading-relaxed">
                    <strong>تعذّر التقاط تفريغ صوتي من الميكروفون:</strong>
                    لم يتوفر التقاط صوتي في هذه الجلسة. يمكنك إعادة القراءة بالميكروفون أو فحص الكلمات وتأكيدها للمتابعة.
                  </div>
                </div>
              </div>
            )}

            {/* Captured Speech Transcript Display */}
            {spokenTranscript && (
              <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-right">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-teal-600" />
                    <span>ما سمعه الميكروفون وسجّله الذكاء الاصطناعي أثناء قراءتك:</span>
                  </span>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {azureAssessmentMode || 'التفريغ الصوتي الفعلي'}
                  </span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed font-sans bg-white p-3.5 rounded-xl border border-slate-200 font-medium">
                  "{spokenTranscript}"
                </p>
              </div>
            )}

            {/* Interactive Word Inspection Grid */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-800">
                  فحص الذكاء الاصطناعي لكلمات النص (اضغط على أي كلمة للاستماع لنطقها السليم):
                </span>
                <button
                  type="button"
                  onClick={handleMarkAllCorrect}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl cursor-pointer"
                  title="تأكيد قراءة جميع كلمات النص كصحيحة"
                >
                  ✓ تأكيد قراءة جميع الكلمات بطلاقة
                </button>
              </div>

              {/* Status Legend */}
              <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px]">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                  ● صحيحة (Correct)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-900 border border-sky-300 font-bold">
                  ● لهجة مقبولة (Dialect)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                  ● إبدال صوتي (Substitution)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 font-bold">
                  ● تخطي / لم تُنطق (Omission)
                </span>
              </div>

              {/* Interactive Words Canvas */}
              <div
                className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap gap-2.5 items-center justify-start text-right leading-loose"
                style={{ fontSize: '20px' }}
              >
                {verifiedWords.map((item, idx) => {
                  let badgeClass = 'bg-white border-slate-300 text-slate-800';
                  let statusTitle = 'صحيحة';

                  if (item.status === 'correct') {
                    badgeClass = 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200';
                    statusTitle = 'صحيحة';
                  } else if (item.status === 'dialect_variant') {
                    badgeClass = 'bg-sky-100 text-sky-950 border-sky-300 hover:bg-sky-200';
                    statusTitle = 'بديل لهجي مقبول';
                  } else if (item.status === 'phonetic_substitution') {
                    badgeClass = 'bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200 font-bold ring-2 ring-amber-300';
                    statusTitle = item.spokenWord ? `اختلاف في التفريغ (تعرّف النظام على: "${item.spokenWord}")؛ راجع الصوت` : 'اختلاف في التفريغ يحتاج مراجعة';
                  } else if (item.status === 'unconfirmed') {
                    badgeClass = 'bg-slate-100 text-slate-800 border-slate-300';
                    statusTitle = 'غير محسومة آلياً';
                  } else if (item.status === 'omitted') {
                    badgeClass = 'bg-rose-100 text-rose-950 border-rose-300 line-through opacity-75 hover:bg-rose-200';
                    statusTitle = 'تخطي محتمل في التفريغ؛ راجع التسجيل للتأكد';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSpeakWord(item.word)}
                      className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-xs flex flex-col items-center gap-0.5 ${badgeClass}`}
                      title={`${item.word}: ${statusTitle} (انقر للاستماع للنطق السليم)`}
                    >
                      <span className="font-bold">{item.word}</span>
                      {item.status === 'phonetic_substitution' && item.spokenWord && (
                        <span className="text-[10px] font-mono text-amber-800 bg-white/80 px-1 rounded-sm">
                          نُطقت: {item.spokenWord}
                        </span>
                      )}
                      <span className="text-[9px] font-normal opacity-70">
                        {statusTitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preliminary automated comparison — not a certification badge */}
            <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-right flex items-start gap-3">
              <FileCheck2 className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-950 text-sm font-black mb-1">
                  {azureAssessmentComplete && aiAssessmentReceipt && measuredAccuracyPercent !== undefined
                    ? `دقة الكلمات التي قيّمها محرك الصوت: ${measuredAccuracyPercent}%`
                    : 'درجة النطق غير متاحة لهذه المحاولة'}
                </strong>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {azureAssessmentMode || 'يقيّم الخادم التسجيل الصوتي الحقيقي، ولا يحوّل تفريغ المتصفح إلى درجة نطق.'}
                  {' '}النتائج وصفية وليست تشخيصًا. إذا بقيت كلمات غير محسومة، أعد التسجيل؛ لا يلزم اعتماد معلّم.
                </p>
              </div>
            </div>

            {/* Confirm & Next Button */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex-1 space-y-3 text-xs text-slate-700 text-right">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${azureAssessmentComplete && aiAssessmentReceipt ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>{azureAssessmentComplete && aiAssessmentReceipt
                    ? 'اكتمل تقييم الصوت آليًا على الخادم؛ ستُستخدم النتيجة في التدريب التكيفي.'
                    : 'لم تكتمل درجة النطق آليًا؛ يمكنك إعادة القراءة أو متابعة الفهم دون درجة صوتية.'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmVerification}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-lg rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-3"
              >
                <span>متابعة إلى أسئلة الفهم القرائي</span>
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 3: COMPREHENSION QUESTIONS
          ===================================================================== */}
      {stage === 'comprehension' && (
        <div ref={comprehensionCardRef} className="max-w-3xl w-full mx-auto p-6 md:p-8 pt-10">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 md:p-10">
            {/* Header */}
            <div className="border-b border-slate-100 pb-5 mb-6 text-right">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
                <HelpCircle className="w-3.5 h-3.5" />
                اختبار الفهم والاستيعاب القرائي
              </div>
              <h2 className="text-2xl font-black text-slate-900">
                السؤال {currentQuestionIndex + 1} من {passage.comprehensionQuestions.length}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                المهارة المستهدفة: {passage.comprehensionQuestions[currentQuestionIndex]?.skillLabelAr}
              </p>
            </div>

            {comprehensionError && (
              <p role="alert" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">{comprehensionError}</p>
            )}

            {/* Current Question */}
            {passage.comprehensionQuestions[currentQuestionIndex] && (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-right">
                  <h3 className="text-lg md:text-xl font-bold text-slate-900 leading-relaxed">
                    {passage.comprehensionQuestions[currentQuestionIndex].question}
                  </h3>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  {passage.comprehensionQuestions[currentQuestionIndex].options.map(
                    (optionText, optIdx) => {
                      const isSelected = selectedAnswers[currentQuestionIndex] === optIdx;

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectOption(currentQuestionIndex, optIdx)}
                          className={`w-full p-4 rounded-2xl border text-right font-bold transition-all cursor-pointer flex items-center justify-between text-base ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-950 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <span>{optionText}</span>
                          <span
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-300'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>السابق</span>
                  </button>

                  {currentQuestionIndex < passage.comprehensionQuestions.length - 1 ? (
                    <button
                      onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                      disabled={selectedAnswers[currentQuestionIndex] === undefined}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>السؤال التالي</span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleFinishComprehension}
                      disabled={selectedAnswers[currentQuestionIndex] === undefined}
                      className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold rounded-xl text-base transition-colors shadow-lg cursor-pointer flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>اعتماد الإجابات وعرض النتائج</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 4: MEASURED RESULTS SUMMARY (EVIDENCE-ONLY)
          ===================================================================== */}
      {stage === 'summary' && (
        <div className="max-w-3xl w-full mx-auto p-6 md:p-8 pt-10">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 md:p-10 text-center">
            {/* Header Badge */}
            <div className="w-20 h-20 mx-auto bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20">
              <Award className="w-10 h-10 text-white" />
            </div>

            <h2 className="text-3xl font-black text-slate-900 mb-2">
              نتائج جلسة القراءة والفهم
            </h2>
            <p className="text-slate-600 text-sm mb-8">
              المقاييس التالية تلخّص ما سُجّل في هذه الجلسة من زمن وإجابات وتحليل صوتي معتمد بالذكاء الاصطناعي.
            </p>

            {/* Verified Metrics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-right">
              {/* 1. Reading Speed (Human-Friendly words per minute) */}
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
                <span className="text-xs font-bold text-teal-900 block mb-1">
                  سرعة القراءة
                </span>
                <div className="text-3xl font-black text-teal-700 font-mono">
                  {measuredWpm ?? 'غير متاح'}{' '}
                  <span className="text-sm font-semibold">كلمة / دقيقة</span>
                </div>
                <p className="text-[11px] text-teal-800 mt-2 leading-relaxed">
                  {readingMode === 'oral_audio'
                    ? azureAssessmentComplete
                      ? 'المعدل مستخرج من تقييم التسجيل الصوتي في Azure، وليس من المعاينة اللحظية للمتصفح.'
                      : 'لا يُعرض معدل موثوق لأن تقييم التسجيل الصوتي لم يكتمل.'
                    : 'أكمل النص المرجعي خلال ' + finalDurationSec + ' ثانية. المعدل المعروض وصفي وليس معياراً تشخيصياً.'}
                </p>
              </div>

              {/* 2. Reading Time */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <span className="text-xs font-bold text-slate-900 block mb-1">
                  زمن القراءة المستغرق
                </span>
                <div className="text-3xl font-black text-slate-800 font-mono">
                  {finalDurationSec}{' '}
                  <span className="text-sm font-semibold">ثانية</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-2">
                  الوقت الفعلي من بدء القراءة حتى إعلان الانتهاء
                </p>
              </div>

              {/* 3. Word Accuracy Percent */}
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5">
                <span className="text-xs font-black text-emerald-950 block mb-1">
                  دقة نطق الكلمات
                </span>
                <div className="text-3xl font-black text-emerald-700 font-mono">
                  {summaryStats.accuracyPercent === null ? 'غير متاح' : summaryStats.accuracyPercent + '%'}
                </div>
                <p className="text-[11px] text-emerald-800 mt-2">
                  {summaryStats.correct} مطابقة نصية · {summaryStats.errors} اختلاف محتمل · {summaryStats.omitted} حذف مؤكد · {summaryStats.unconfirmed} غير محسومة
                </p>
              </div>

              {/* 4. Comprehension Score */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                <span className="text-xs font-bold text-indigo-950 block mb-1">
                  درجة الفهم والاستيعاب
                </span>
                <div className="text-3xl font-black text-indigo-700 font-mono">
                  {comprehensionScore}%
                </div>
                <p className="text-[11px] text-indigo-800 mt-2">
                  أجاب بشكل سليم عن {Math.round((comprehensionScore / 100) * (passage.comprehensionQuestions?.length || 1))} من {passage.comprehensionQuestions?.length || 1} أسئلة
                </p>
              </div>
            </div>

            {/* Parent & Child Educational Guide to WCPM / WPM */}
            <div className="mb-8 p-5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-sky-50/70 to-teal-50/80 border border-indigo-100 text-right">
              <h4 className="font-bold text-sm text-indigo-950 mb-2.5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>دليل ولي الأمر والطفل لفهم مؤشرات القراءة (WCPM و WPM):</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                <div className="bg-white/95 p-3.5 rounded-xl border border-indigo-100 shadow-2xs">
                  <strong className="text-indigo-900 block mb-1">ماذا يعني WCPM؟ (الكلمات الصحيحة في الدقيقة)</strong>
                  هو المعيار العلمي الدقيق لقياس طلاقة القراءة (Words Correct Per Minute)، ويحسب عدد الكلمات التي نطقها طفلك بدقة وسلاسة في الدقيقة، دون احتساب الكلمات المحذوفة أو المستبدلة.
                </div>
                <div className="bg-white/95 p-3.5 rounded-xl border border-teal-100 shadow-2xs">
                  <strong className="text-teal-900 block mb-1">المعدل المألوف للصف {passage.gradeLevel || 3}:</strong>
                  المعدل الطبيعي لطلاب الصف {passage.gradeLevel || 3} يتراوح عادة بين {passage.gradeLevel === 1 ? '30 إلى 50' : passage.gradeLevel === 2 ? '45 إلى 65' : passage.gradeLevel === 3 ? '60 إلى 85' : '75 إلى 110'} كلمة صحيحة في الدقيقة مع الفهم القرائي.
                </div>
              </div>
            </div>

            {/* Dedicated Mistake Breakdown Section */}
            <div className="mb-8 p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm text-right">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <span>سجل الكلمات التي أخطأ بها أو بدلها الطفل (تحليل الذكاء الاصطناعي الدقيق)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    فحص تفصيلي للكلمات التي رصد فيها الذكاء الاصطناعي إبدالاً صوتياً أو تخطياً؛ اضغط على أيقونة الصوت للاستماع للنطق السليم.
                  </p>
                </div>
              </div>

              {!azureAssessmentComplete || !aiAssessmentReceipt ? (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-sm font-bold flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>لم تكتمل مطابقة الكلمات آليًا؛ لا يمكن الجزم بدقة القراءة في هذه المحاولة. أعد التسجيل إذا أردت نتيجة صوتية.</span>
                </div>
              ) : verifiedWords.filter(w => w.status === 'phonetic_substitution' || w.status === 'omitted').length === 0 ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-sm font-bold flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>لم يرصد محرك الصوت إبدالًا أو حذفًا في الكلمات التي حسمها؛ هذه نتيجة تعليمية وصفية وليست تشخيصًا.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {verifiedWords
                    .filter(w => w.status === 'phonetic_substitution' || w.status === 'omitted')
                    .map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border text-right flex flex-col justify-between ${
                          item.status === 'phonetic_substitution'
                            ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                            : 'bg-rose-50/70 border-rose-300 text-rose-950'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.status === 'phonetic_substitution' ? 'bg-amber-200 text-amber-900' : 'bg-rose-200 text-rose-900'
                            }`}>
                              {item.status === 'phonetic_substitution' ? 'إبدال صوتي / تعثر' : 'تخطي / لم تُنطق'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSpeakWord(item.word)}
                              className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-indigo-600 shadow-2xs transition-colors cursor-pointer"
                              title="استمع للنطق الصحيح"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-base font-black text-slate-900 mb-1.5">
                            الكلمة في النص: <span className="underline decoration-indigo-400 decoration-2">{item.word}</span>
                          </div>
                          {item.spokenWord ? (
                            <div className="text-xs font-bold text-rose-700 bg-white/90 p-2 rounded-xl border border-rose-200">
                              ما سمعه الذكاء الاصطناعي: <span className="font-mono text-rose-900">"{item.spokenWord}"</span>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 italic bg-white/60 p-2 rounded-xl">
                              تخطى الطفل هذه الكلمة أثناء القراءة
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* =================================================================
                WORD-BY-WORD READING DIAGNOSTIC CANVAS
                Where the parent & teacher see exactly what words had errors!
                ================================================================= */}
            <div className="mb-8 p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm text-right">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-teal-600" />
                    <span>مراجعة مطابقة كلمات النص والتفريغ الصوتي</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    مقارنة آلية أولية لكل كلمة. قد يكون الاختلاف ناتجًا عن التعرف الصوتي أو اللهجة؛ استمع إلى التسجيل قبل اعتماد أي تصنيف.
                  </p>
                </div>

                {/* Status Badges Legend */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 font-bold border border-emerald-300">
                    🟢 مطابقة آليًا: {summaryStats.correct}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-950 font-bold border border-amber-300">
                    🟠 اختلاف محتمل: {summaryStats.errors}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-950 font-bold border border-rose-300">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 ml-1"></span> تخطي محتمل يحتاج مراجعة: {summaryStats.omitted}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 font-bold">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300 ml-1"></span> غير محسومة آلياً: {summaryStats.unconfirmed}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mb-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-xs text-slate-700 leading-relaxed">
                  <span className="font-bold text-slate-900">حالة محرك الصوت:</span>{' '}
                  {azureAssessmentComplete && aiAssessmentReceipt
                    ? 'اكتمل التحليل الصوتي وربط الكلمات بالتدريب.'
                    : 'لا توجد درجة نطق مؤكدة في هذه المحاولة. أعد التسجيل عند الحاجة؛ لن تُحتسب الدرجة من تفريغ المتصفح.'}
                </div>
              </div>

              {/* Full Passage Words with Visual Status Highlighting */}
              <div
                className="p-6 md:p-8 rounded-3xl bg-slate-50 border border-slate-200 flex flex-wrap gap-2.5 items-center justify-start text-right leading-loose select-none"
                style={{ fontSize: '20px' }}
              >
                {verifiedWords.map((item, idx) => {
                  let badgeClass = 'bg-white border-slate-300 text-slate-800 hover:border-slate-400';
                  let statusTitle = 'صحيحة';

                  if (item.status === 'correct') {
                    badgeClass = 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200';
                    statusTitle = 'مطابقة نصية آلية';
                  } else if (item.status === 'dialect_variant') {
                    badgeClass = 'bg-sky-100 text-sky-950 border-sky-300 hover:bg-sky-200';
                    statusTitle = 'بديل لهجي محتمل؛ أعد التسجيل إذا لم يحسم المحرك النطق';
                  } else if (item.status === 'phonetic_substitution') {
                    badgeClass = 'bg-amber-100 text-amber-950 border-amber-400 font-black ring-2 ring-amber-300 hover:bg-amber-200';
                    statusTitle = item.spokenWord ? `إبدال صوتي (نطق: "${item.spokenWord}")` : 'إبدال صوتي / تعثر';
                  } else if (item.status === 'unconfirmed') {
                    badgeClass = 'bg-slate-100 text-slate-800 border-slate-300';
                    statusTitle = 'غير محسومة آلياً؛ قد يكون التعرّف الصوتي لم يلتقطها';
                  } else if (item.status === 'omitted') {
                    badgeClass = 'bg-rose-100 text-rose-950 border-rose-300 line-through opacity-75 hover:bg-rose-200';
                    statusTitle = 'تخطي / لم تُنطق';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSpeakWord(item.word)}
                      className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-xs flex flex-col items-center gap-0.5 ${badgeClass}`}
                      title={`${item.word}: ${statusTitle} (انقر للاستماع)`}
                    >
                      <span className="font-bold">{item.word}</span>
                      {item.status === 'phonetic_substitution' && item.spokenWord && (
                        <span className="text-[10px] font-mono text-amber-800 bg-white/80 px-1 rounded-sm">
                          نُطقت: {item.spokenWord}
                        </span>
                      )}
                      {item.status === 'unconfirmed' && (
                    <span className="text-[9px] font-mono text-slate-700">
                      غير محسومة آلياً
                    </span>
                  )}
                  {item.status === 'omitted' && (
                        <span className="text-[9px] font-mono text-rose-800">
                          تخطي
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Target Words Practice Recommendation */}
              {summaryStats.errors + summaryStats.omitted > 0 && (
                <div className="mt-5 p-5 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-sm text-amber-950 mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>كلمات واجه فيها الطفل صعوبة وتحتاج إلى تعزيز:</span>
                    </h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {verifiedWords
                        .filter(w => w.status !== 'correct' && w.status !== 'dialect_variant')
                        .map((w, i) => (
                          <span
                            key={i}
                            onClick={() => handleSpeakWord(w.word)}
                            className="px-3 py-1 rounded-xl bg-white border border-amber-300 text-amber-950 text-xs font-bold cursor-pointer hover:bg-amber-100 flex items-center gap-1 shadow-2xs"
                            title="انقر للاستماع للنطق السليم"
                          >
                            <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                            <span>{w.word}</span>
                            {w.spokenWord && (
                              <span className="text-[10px] text-slate-500 font-normal">
                                (بدل: {w.spokenWord})
                              </span>
                            )}
                          </span>
                        ))}
                    </div>
                  </div>

                  {onNavigateTab && (
                    <button
                      onClick={() => onNavigateTab('remediation-gym')}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>تدريب فوري على هذه الكلمات</span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleCommitSession}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-lg py-4 px-10 rounded-2xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>حفظ النتائج والانتقال للتقرير الشامل</span>
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  setStage('intro');
                  setReadingMode('timed_silent');
                  setAudioConsentChecked(false);
                  setGuardianAudioConsentRecordedAt(undefined);
                  setAzureAssessmentComplete(false);
                  setAzureAssessmentMode('');
                  setPronunciationAssessmentError('');
                  setSpokenTranscript('');
                  spokenTranscriptRef.current = '';
                  finalTranscriptsRef.current = [];
                  currentInterimRef.current = '';
                  setVerifiedWords([]);
                  setTeacherVerified(false);
                  setHumanReviewConfirmed(false);
                  setMeasuredWpm(undefined);
                  setMeasuredWcpm(undefined);
                  setMeasuredAccuracyPercent(undefined);
                  setAudioCaptureFailed(false);
                  setReadingModeNotice('');
                  setAudioPlaybackUrl(null);
                  recordedAudioBlobRef.current = null;
                  setFinalDurationSec(0);
                }}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 px-6 rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة القراءة بنص آخر</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingAssessmentView;
