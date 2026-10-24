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
import {
  evaluateOralReadingAlignment,
  toConservativeAutomatedOralReadingStatus,
  OralReadingFluencyResult,
  OralWordAlignmentItem,
  ArabicDialectCode,
  ARABIC_DIALECT_PROFILES,
} from '../utils/dyslexiaEngines';
import { convertRecordedAudioToWavBase64 } from '../utils/browserAudioWav';

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
  canVerifyAsTeacher = false,
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
  const [audioConsentChecked, setAudioConsentChecked] = useState(
    Boolean(activeStudent?.guardianAudioConsentGiven || activeStudent?.audioRecordingConsentGiven)
  );
  const [guardianAudioConsentRecordedAt, setGuardianAudioConsentRecordedAt] = useState<string | undefined>(
    activeStudent?.guardianAudioConsentRecordedAt
  );
  const passage: ReadingPassage = ARABIC_READING_PASSAGES[selectedPassageIndex] || ARABIC_READING_PASSAGES[0];
  const effectiveGuardianConsentTimestamp = guardianConsentRecordedAt || activeStudent?.guardianConsentRecordedAt;
  const effectiveAudioConsentTimestamp = guardianAudioConsentRecordedAt || activeStudent?.guardianAudioConsentRecordedAt;
  const hasValidGuardianConsentRecord = Boolean(effectiveGuardianConsentTimestamp && Number.isFinite(Date.parse(effectiveGuardianConsentTimestamp)));
  const hasValidAudioConsentRecord = Boolean(effectiveAudioConsentTimestamp && Number.isFinite(Date.parse(effectiveAudioConsentTimestamp)));

  // Stages: 'intro' -> 'reading' -> 'verification' -> 'comprehension' -> 'summary'
  const [stage, setStage] = useState<'intro' | 'reading' | 'verification' | 'comprehension' | 'summary'>('intro');

  // Reading mode: oral audio with teacher verification vs timed silent reading
  const [readingMode, setReadingMode] = useState<'oral_audio' | 'timed_silent'>(
    (activeStudent?.guardianAudioConsentGiven || activeStudent?.audioRecordingConsentGiven)
      ? 'oral_audio'
      : 'timed_silent'
  );
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

  // Teacher verification & Human-in-the-Loop review state
  const [verifiedWords, setVerifiedWords] = useState<
    Array<{
      word: string;
      status: 'correct' | 'dialect_variant' | 'phonetic_substitution' | 'omitted' | 'unconfirmed';
      spokenWord?: string | null;
    }>
  >([]);
  const [teacherVerified, setTeacherVerified] = useState(false);
  const [teacherOverridesCount, setTeacherOverridesCount] = useState(0);
  const [measuredWcpm, setMeasuredWcpm] = useState<number | undefined>(undefined);
  const [measuredAccuracyPercent, setMeasuredAccuracyPercent] = useState<number | undefined>(undefined);

  // Timer & Reading state
  const [readingSeconds, setReadingSeconds] = useState(0);
  const [isReadingActive, setIsReadingActive] = useState(false);
  const timerRef = useRef<any>(null);
  const readingStartTimestampRef = useRef<number>(0);
  const readingPassageRef = useRef<HTMLDivElement | null>(null);

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
    // A retry starts a new session. Never carry forward prior answers or review status.
    setTeacherVerified(false);
    setTeacherOverridesCount(0);
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

    // Only finalized ASR segments may enter analysis; interim text is provisional.
    currentInterimRef.current = '';
    const cleanTranscript = finalTranscriptsRef.current.join(' ').trim();
    spokenTranscriptRef.current = cleanTranscript;
    setSpokenTranscript(cleanTranscript);

    // Calculate real WPM strictly from measured evidence:
    // For oral reading: measured from actual spoken words read per minute
    // For timed silent reading: rate of completing the reference passage
    if (readingMode === 'oral_audio') {
      // Browser ASR token count is not a validated oral-reading speed measure.
      setMeasuredWpm(undefined);
    } else {
      const calculatedWpm = Math.round((passage.words.length / elapsedSec) * 60);
      setMeasuredWpm(calculatedWpm);
    }

    // If oral audio mode, transition to Teacher Verification stage
    if (readingMode === 'oral_audio') {
      const hasSpeechTokens = cleanTranscript.length > 0;

      if (!hasSpeechTokens) {
        // DO NOT SUBSTITUTE TARGET TEXT!
        // When speech recognition captures nothing, state that clearly and do not inflate metrics.
        setAudioCaptureFailed(true);
        const initialWords = passage.words.map(targetWord => ({
          word: targetWord,
          // Missing transcript is a recognition failure, not proof the child skipped every word.
          status: 'unconfirmed' as const,
        }));
        setVerifiedWords(initialWords);
        setMeasuredWcpm(undefined);
        setMeasuredAccuracyPercent(undefined);
        setStage('verification');
      } else {
        setAudioCaptureFailed(false);
        const alignmentResult: OralReadingFluencyResult = evaluateOralReadingAlignment(
          passage.words,
          cleanTranscript,
          elapsedSec,
          0,
          studentDialect
        );

        const initialWords = passage.words.map((targetWord, idx) => {
          const aligned = alignmentResult.alignment[idx];
          return {
            word: targetWord,
            status: toConservativeAutomatedOralReadingStatus(aligned),
            spokenWord: aligned?.spokenWord ?? null,
          };
        });
        const hasUnconfirmedWords = initialWords.some(word => word.status === 'unconfirmed');

        setVerifiedWords(initialWords);
        // Do not publish a passage-level score while ASR-derived words remain unresolved.
        setMeasuredWcpm(hasUnconfirmedWords ? undefined : alignmentResult.wcpm);
        setMeasuredAccuracyPercent(hasUnconfirmedWords ? undefined : alignmentResult.accuracyPercent);
        setStage('verification');
      }
    } else {
      // Timed silent reading mode: jump directly to comprehension
      setSelectedAnswers({});
      setCurrentQuestionIndex(0);
      setStage('comprehension');
    }
  };

  // Toggle word status during Teacher Verification (Human-in-the-Loop)
  const handleToggleWordStatus = (index: number) => {
    setTeacherOverridesCount(prev => prev + 1);
    setVerifiedWords(prev => {
      const next = [...prev];
      const current = next[index];
      const cycle: Array<'correct' | 'phonetic_substitution' | 'omitted' | 'dialect_variant' | 'unconfirmed'> = [
        'correct',
        'phonetic_substitution',
        'omitted',
        'dialect_variant',
        'unconfirmed',
      ];
      const currentIdx = cycle.indexOf(current.status);
      const nextStatus = cycle[(currentIdx + 1) % cycle.length];
      next[index] = { ...current, status: nextStatus };
      return next;
    });
  };

  // Live recalculate WCPM from teacher-verified words
  const teacherStats = useMemo(() => {
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

  // Mark all words as correct (quick action for fluent reading)
  const handleMarkAllCorrect = () => {
    setTeacherOverridesCount(prev => prev + 1);
    setVerifiedWords(prev => prev.map(w => ({ ...w, status: 'correct' })));
  };

  // Teacher confirms verification and proceeds to comprehension
  const handleConfirmVerification = () => {
    // Only an authorized reviewer with a fully resolved word-level review may certify.
    const canCertify = canVerifyAsTeacher && teacherStats.unconfirmed === 0;
    setTeacherVerified(canCertify);
    setMeasuredWcpm(canCertify ? (teacherStats.liveWcpm ?? undefined) : undefined);
    setMeasuredAccuracyPercent(canCertify ? (teacherStats.liveAccuracy ?? undefined) : undefined);
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
      wcpm: readingMode === 'oral_audio' ? (measuredWcpm ?? null) : null,
      oralWcpm: readingMode === 'oral_audio' ? (measuredWcpm ?? null) : null,
      oralReadingAssessed: readingMode === 'oral_audio' && teacherVerified,
      oralAccuracyPercent: readingMode === 'oral_audio' ? (measuredAccuracyPercent ?? null) : null,
      // An automated transcript is not a human teacher attestation.
      teacherVerified: readingMode === 'oral_audio' && teacherVerified,
      teacherVerifierRole: readingMode === 'oral_audio' && teacherVerified ? 'مراجع المدرسة (مراجعة بشرية)' : undefined,
      teacherVerificationTimestamp: readingMode === 'oral_audio' && teacherVerified ? nowIso : undefined,
      teacherWordOverridesCount: readingMode === 'oral_audio' ? teacherOverridesCount : undefined,
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
        <div className="max-w-4xl w-full mx-auto p-6 md:p-8 pt-10">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 md:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-18 h-18 mx-auto bg-gradient-to-tr from-teal-600 to-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-teal-500/20">
                <BookOpen className="w-9 h-9 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
                مختبر القراءة والطلاقة والفهم القرائي
              </h1>
              <p className="text-slate-600 text-base md:text-lg max-w-xl mx-auto">
                جلسة قراءة متدرّجة ممتعة والإجابة عن أسئلة الفهم. التفريغ الصوتي آلي أولي وقد يخطئ؛ النتائج ليست تشخيصًا ولا اختبارًا معياريًا.
              </p>
            </div>

            {/* Reading Assessment Modality Selector */}
            <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-right">
              <label className="block text-sm font-bold text-slate-800 mb-3">
                نمط فحص القراءة:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setReadingMode('oral_audio')}
                  className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-start gap-3 ${
                    readingMode === 'oral_audio'
                      ? 'border-teal-600 bg-teal-50/80 shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${readingMode === 'oral_audio' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">قراءة جهرية مسجلة ومراجعة</span>
                      <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold">موصى به</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      يتطلب إذن الميكروفون للتحليل الصوتي المباشر بالذكاء الاصطناعي ومطابقة الكلمات المقروءة واعتماد WCPM.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setReadingMode('timed_silent')}
                  className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-start gap-3 ${
                    readingMode === 'timed_silent'
                      ? 'border-indigo-600 bg-indigo-50/80 shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${readingMode === 'timed_silent' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">قراءة صامتة موقوتة</span>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      يقيس زمن إتمام النص وسرعة القراءة المقاسة مباشرة؛ لا يعادل الطلاقة الشفوية إلا عبر التحليل الصوتي.
                    </p>
                  </div>
                </button>
              </div>

              {/* Student Dialect Selection for Oral Mode */}
              {readingMode === 'oral_audio' && (
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-slate-700">اللهجة المرجعية للطالب لمراعاة الفروق الصوتية:</span>
                  <select
                    value={studentDialect}
                    onChange={(e) => setStudentDialect(e.target.value as ArabicDialectCode)}
                    className="p-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  >
                    <option value="egyptian">اللهجة المصرية (Egyptian)</option>
                    <option value="gulf">اللهجة الخليجية والسعودية (Gulf / Saudi)</option>
                    <option value="levantine">اللهجة الشامية (Levantine)</option>
                    <option value="maghrebi">اللهجة المغاربية (Maghrebi)</option>
                    <option value="msa">العربية الفصحى المعيارية (Modern Standard)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Passage Selector */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-slate-800 mb-3 text-right">
                اختر النص القرائي المناسب للمستوى الدراسي:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {ARABIC_READING_PASSAGES.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPassageIndex(idx)}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                      selectedPassageIndex === idx
                        ? 'border-teal-600 bg-teal-50/80 shadow-md shadow-teal-100'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <span className="text-[11px] font-bold text-teal-700 block mb-1">
                        {p.gradeLabel}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">{p.title}</h4>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                      <span>{p.wordCount} كلمة</span>
                      <span>{p.diacriticLabelAr.split(' ')[0]}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Instructions Card */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 mb-6 text-right space-y-2">
              <h3 className="font-bold text-slate-900 text-sm mb-2">إرشادات الجلسة:</h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>{readingMode === 'oral_audio' ? 'اقرأ النص بصوت واضح وبالسرعة الطبيعية؛ قد يحتاج التفريغ الآلي إلى تصحيح.' : 'اقرأ النص بصمت وبالسرعة الطبيعية، ثم اضغط بعد إكمال النص.'}</li>
                <li>يبدأ المؤقت عند جاهزية وضع القراءة، ولا تُحتسب مدة نافذة إذن الميكروفون.</li>
                <li>اضغط «أنهيت القراءة» فور إكمال النص كاملًا.</li>
                <li>ستجيب بعد ذلك عن أسئلة فهم النص، ثم تظهر لك ملخصات ما تم قياسه.</li>
              </ul>
            </div>

            {/* Require prior guardian permission; this interface does not make a legal-compliance certification. */}
            <div className="space-y-3 mb-8 text-right">
              <div className="bg-emerald-50/80 rounded-2xl p-4 border border-emerald-200 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="guardian-consent-chk"
                  checked={guardianConsentChecked}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setGuardianConsentChecked(checked);
                    if (checked) {
                      setGuardianConsentRecordedAt(new Date().toISOString());
                    } else {
                      setGuardianConsentRecordedAt(undefined);
                    }
                  }}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                />
                <label htmlFor="guardian-consent-chk" className="text-xs font-bold text-emerald-950 cursor-pointer select-none">
                  أؤكد أن موافقة وليّ الأمر المسبقة موثّقة لدى الجهة المسؤولة، وأنه اطّلع على غرض النشاط والبيانات التي ستُجمع.
                </label>
              </div>

              {readingMode === 'oral_audio' && (
                <div className="bg-sky-50/80 rounded-2xl p-4 border border-sky-200 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="audio-consent-chk"
                    checked={audioConsentChecked}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAudioConsentChecked(checked);
                      if (checked) {
                        setGuardianAudioConsentRecordedAt(new Date().toISOString());
                      } else {
                        setGuardianAudioConsentRecordedAt(undefined);
                      }
                    }}
                    className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer shrink-0"
                  />
                  <label htmlFor="audio-consent-chk" className="text-xs font-bold text-sky-950 cursor-pointer select-none">
                    أوافق على استخدام الميكروفون وتسجيل قراءة الطالب لهذه الجلسة فقط. قد يستخدم التعرف على الكلام خدمة المتصفح؛ لذا سيُراجع التفريغ الآلي قبل تفسيره.
                  </label>
                </div>
              )}
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartReading}
              disabled={!guardianConsentChecked || !hasValidGuardianConsentRecord || (readingMode === 'oral_audio' && (!audioConsentChecked || !hasValidAudioConsentRecord))}
              className="w-full bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-5 px-6 rounded-2xl transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 text-xl cursor-pointer"
            >
              <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
              <span>ابدأ اختبار القراءة</span>
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
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
                <span className="text-teal-400 font-bold shrink-0">ما التقطه الذكاء الاصطناعي لحظياً:</span>
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
                    ? 'أنهيت القراءة — التحليل الصوتي الذكي واعتماد الطلاقة (WCPM)'
                    : 'أنهيت القراءة — الانتقال لأسئلة الفهم'}
                </span>
                <ChevronLeft className="w-8 h-8" />
              </button>
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 mb-2">
                <UserCheck className="w-4 h-4 text-amber-700" />
                <span>التحليل الصوتي والتدقيق الذكي للكلمات</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900">
                التحليل الصوتي المباشر واعتماد الطلاقة الذاتي
              </h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                هذه مطابقة آلية أولية للتفريغ الصوتي، وليست دليلاً قاطعاً على صحة النطق. الكلمات التي لم يحسمها التعرّف لن تُصنّف على أنها أخطاء من الطفل، ولن تُستخدم لاعتماد WCPM.
              </p>
            </div>

            {/* Live Metrics Dashboard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-right">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold text-emerald-800 block mb-1">
                  معدل الطلاقة المقاس من الكلمات المصنّفة
                </span>
                <div className="text-2xl font-black text-emerald-700 font-mono">
                  {teacherStats.liveWcpm ?? 'غير متاح'} <span className="text-xs">WCPM</span>
                </div>
                <span className="text-[10px] text-emerald-600">
                  {teacherStats.unconfirmed > 0
                    ? 'لا يمكن حساب معدل موثوق قبل حسم الكلمات غير المؤكدة.'
                    : teacherStats.effectiveWords + ' كلمة مطابقة ÷ ' + finalDurationSec + ' ث'}
                </span>
              </div>

              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold text-teal-800 block mb-1">
                  مطابقة وفق التصنيفات الحالية
                </span>
                <div className="text-2xl font-black text-teal-700 font-mono">
                  {teacherStats.liveAccuracy === null ? 'غير متاح' : teacherStats.liveAccuracy + '%'}
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
                  {teacherStats.errors}
                </div>
                <span className="text-[10px] text-amber-600">
                  تصنيفات تحتاج إلى مراجعة
                </span>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold text-rose-800 block mb-1">
                  كلمات لم يحسمها التعرّف الصوتي
                </span>
                <div className="text-2xl font-black text-rose-700 font-mono">
                  {teacherStats.unconfirmed}
                </div>
                <span className="text-[10px] text-rose-600">
                  لا يعني عدم التعرّف أن الطفل لم ينطق الكلمة
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
                <span className="text-xs font-bold text-slate-800 block mb-1">
                  التفريغ الصوتي التلقائي الملتقط من قراءة الطالب:
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-sans bg-white p-3 rounded-xl border border-slate-100">
                  {spokenTranscript}
                </p>
              </div>
            )}

            {/* Interactive Word Inspection Grid */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-800">
                  انقر على الكلمة لتعديل تقييمها:
                </span>
                <button
                  type="button"
                  onClick={handleMarkAllCorrect}
                  disabled={audioCaptureFailed && !audioPlaybackUrl}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 disabled:opacity-40 disabled:cursor-not-allowed bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl cursor-pointer"
                  title={audioCaptureFailed && !audioPlaybackUrl ? 'تعذر التقاط صوت لتأكيد القراءة الكاملة' : 'تعليم جميع الكلمات كقراءة صحيحة'}
                >
                  ✓ تعليم الكل كقراءة صحيحة
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
                  ● إبدال لفظي (Substitution)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 font-bold">
                  ● غير محسوم آلياً (Unconfirmed)
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
                    badgeClass = 'bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200 font-bold';
                    statusTitle = 'إبدال صوتي / تعثر';
                  } else if (item.status === 'unconfirmed') {
                    badgeClass = 'bg-slate-100 text-slate-800 border-slate-300';
                    statusTitle = 'غير محسومة آلياً؛ قد يكون التعرّف الصوتي لم يلتقطها';
                  } else if (item.status === 'omitted') {
                    badgeClass = 'bg-rose-100 text-rose-950 border-rose-300 line-through hover:bg-rose-200';
                    statusTitle = 'متخطاة / محذوفة';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleToggleWordStatus(idx)}
                      className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-xs flex flex-col items-center gap-0.5 ${badgeClass}`}
                      title={`${item.word}: ${statusTitle} (انقر للتغيير)`}
                    >
                      <span className="font-bold">{item.word}</span>
                      <span className="text-[9px] font-normal opacity-70">
                        {statusTitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Confirm & Next Button */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600 text-right flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>التصنيف المعروض تقدير آلي أولي. إذا بقيت كلمات غير محسومة، فلن يُعتمد WCPM أو معدل الدقة لهذه الجلسة.</span>
              </div>

              <button
                type="button"
                onClick={handleConfirmVerification}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-lg rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-3"
              >
                <UserCheck className="w-5 h-5" />
                <span>متابعة إلى أسئلة الفهم دون اعتماد مؤشرات غير مكتملة</span>
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
        <div className="max-w-3xl w-full mx-auto p-6 md:p-8 pt-10">
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
                    ? 'لا يُعرض معدل موثوق من عدد الكلمات التي أخطأ المتصفح في تفريغها.'
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

            {/* =================================================================
                WORD-BY-WORD READING DIAGNOSTIC CANVAS
                Where the parent & teacher see exactly what words had errors!
                ================================================================= */}
            <div className="mb-8 p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm text-right">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-teal-600" />
                    <span>تحليل قراءة الكلمات في النص: أين أخطأ أو تعثر الطالب؟</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    فحص تفصيلي لكل كلمة في القصة. اضغط على أي كلمة للاستماع لنطقها السليم، أو لمراجعة الكلمة التي تم نطقها.
                  </p>
                </div>

                {/* Status Badges Legend */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 font-bold border border-emerald-300">
                    🟢 صحيحة: {summaryStats.correct}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-950 font-bold border border-amber-300">
                    🟠 إبدال / تعثر: {summaryStats.errors}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-950 font-bold border border-rose-300">
                    🔴 حذف مؤكد بعد المراجعة: {summaryStats.omitted}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 font-bold">
                    ⚪ غير محسومة آلياً: {summaryStats.unconfirmed}
                  </span>
                </div>
              </div>

              {/* Quick Action Bar for Instant Verification & Audio Fairness */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-xs text-slate-700 leading-relaxed">
                  <span className="font-bold text-slate-900">ملاحظة القراءة والميكروفون:</span> إذا قرأ الطالب النص كاملاً بصوته ولكن أسقط ميكروفون المتصفح بعض الكلمات، يمكنك اعتماد قراءتها كاملة بنقرة واحدة:
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherOverridesCount(prev => prev + 1);
                      setVerifiedWords(prev => prev.map(w => ({ ...w, status: 'correct' })));
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                    title="اعتماد قراءة جميع كلمات النص كصحيحة"
                  >
                    <Check className="w-4 h-4" />
                    <span>✓ تأكيد قراءة جميع الكلمات بطلاقة</span>
                  </button>
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
                    statusTitle = 'بديل لهجي فصيح';
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
                      onClick={() => {
                        handleSpeakWord(item.word);
                        handleToggleWordStatus(idx);
                      }}
                      className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-xs flex flex-col items-center gap-0.5 ${badgeClass}`}
                      title={`${item.word}: ${statusTitle} (انقر للاستماع أو تعديل التقييم)`}
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
                onClick={() => setStage('intro')}
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
