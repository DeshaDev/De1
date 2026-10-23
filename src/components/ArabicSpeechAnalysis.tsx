/**
 * Exploratory Arabic pronunciation practice activity.
 * Automated transcript comparisons are fallible and are not a validated screening or diagnostic test.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Sparkles,
  ChevronLeft,
  Award,
  Activity,
  ArrowRight,
  HelpCircle,
  Headphones,
  Check
} from 'lucide-react';
import { useAssessment } from '../contexts/AssessmentContext';
import { segmentArabicWordIntoSyllables } from '../utils/clinicalMetrics';

export interface TestWord {
  id: number;
  word: string;
  category: 'visual-confusable' | 'phonetic-contrasts' | 'diacritics' | 'vowel-lengths' | 'geminates';
  categoryLabel: string;
  targetPhoneme: string;
  description: string;
}

export const ARABIC_PRACTICE_WORDS: TestWord[] = [
  // 1. الحروف المتشابهة بصرياً (Visual-orthographic homographs)
  {
    id: 1,
    word: 'بَيْتٌ',
    category: 'visual-confusable',
    categoryLabel: 'تمييز الحروف المتشابهة رسمًا',
    targetPhoneme: 'ب',
    description: 'التمييز بين عائلة (ب / ت / ث / ن / ي) بحسب موضع وعدد النقاط'
  },
  {
    id: 2,
    word: 'تِينٌ',
    category: 'visual-confusable',
    categoryLabel: 'تمييز الحروف المتشابهة رسمًا',
    targetPhoneme: 'ت',
    description: 'نقطتان فوق الحرف'
  },
  {
    id: 3,
    word: 'ثَوْبٌ',
    category: 'visual-confusable',
    categoryLabel: 'تمييز الحروف المتشابهة رسمًا',
    targetPhoneme: 'ث',
    description: 'ثلاث نقاط لثوية'
  },
  {
    id: 4,
    word: 'خَاتَمٌ',
    category: 'visual-confusable',
    categoryLabel: 'تمييز الحروف المتشابهة رسمًا',
    targetPhoneme: 'خ',
    description: 'التمييز بين عائلة (ج / ح / خ)'
  },
  {
    id: 5,
    word: 'ذَهَبٌ',
    category: 'visual-confusable',
    categoryLabel: 'تمييز الحروف المتشابهة رسمًا',
    targetPhoneme: 'ذ',
    description: 'التمييز بين الدال والذال'
  },

  // 2. الأصوات المتقاربة مخرجاً (Phonetic / Acoustic Contrasts)
  {
    id: 6,
    word: 'طَبِيبٌ',
    category: 'phonetic-contrasts',
    categoryLabel: 'المفخمة والمرققة (ت / ط)',
    targetPhoneme: 'ط',
    description: 'التمييز الإطباقي والتفخيمي لصوت الطاء مقابل التاء'
  },
  {
    id: 7,
    word: 'صَيْفٌ',
    category: 'phonetic-contrasts',
    categoryLabel: 'المفخمة والمرققة (س / ص)',
    targetPhoneme: 'ص',
    description: 'صوت الصاد المفخم مقابل السين المرقق'
  },
  {
    id: 8,
    word: 'قَلْبٌ',
    category: 'phonetic-contrasts',
    categoryLabel: 'الاحتكاكية واللهوية (ك / ق)',
    targetPhoneme: 'ق',
    description: 'صوت القاف اللهوي مقابل الكاف الحنكي'
  },

  // 3. الحركات القصيرة وضبط البنية (Diacritics & Short Vowels)
  {
    id: 9,
    word: 'كَتَبَ',
    category: 'diacritics',
    categoryLabel: 'الحركات الثلاث المتوالية',
    targetPhoneme: 'فتحة',
    description: 'ضبط تسلسل الفتحات الثلاث بدون تمطيط أو تسكين'
  },
  {
    id: 10,
    word: 'كُتُبٌ',
    category: 'diacritics',
    categoryLabel: 'الضم المزدوج والتنوين',
    targetPhoneme: 'ضمة',
    description: 'الانتقال بين ضمتين متتاليتين وتنوين الضم'
  },

  // 4. الحركات القصيرة مقابل المدود الطويلة (Short vs Long Vowels)
  {
    id: 11,
    word: 'بَابٌ',
    category: 'vowel-lengths',
    categoryLabel: 'المد الطويل بالألف',
    targetPhoneme: 'ا',
    description: 'المد الصوتي الطبيعي بمقدار حركتين'
  },
  {
    id: 12,
    word: 'سَرِيرٌ',
    category: 'vowel-lengths',
    categoryLabel: 'المد الطويل بالياء',
    targetPhoneme: 'ي',
    description: 'إشباع الكسرة لتوليد مد الياء'
  },

  // 5. التضعيف والشدّة والمقاطع المركبة (Geminates & Complex Syllables)
  {
    id: 13,
    word: 'مُعَلِّمٌ',
    category: 'geminates',
    categoryLabel: 'التضعيف والشدّة مع الكسر',
    targetPhoneme: 'لّ',
    description: 'نطق الحرف المشدد بالوقف والضغط الصوتي السليم'
  }
];

export interface TranscriptComparison {
  status: 'exact_match' | 'transcript_difference' | 'unavailable';
  labelArabic: string;
  notes: string;
}

export interface WordAnalysisReport {
  wordId: number;
  targetWord: string;
  spokenTranscript: string;
  normalizedSpoken: string;
  /** Exact transcript match after normalization; it is not a pronunciation accuracy measure. */
  exactTranscriptMatch: boolean;
  /** Optional confidence reported by browser speech recognition; null when unavailable. */
  speechRecognitionConfidence: number | null;
  transcriptComparison: TranscriptComparison;
  audioBlobUrl?: string;
  syllables: string[];
}

export interface ArabicSpeechAnalysisProps {
  onComplete?: (results?: any) => void;
  studentName?: string;
  onNavigateTab?: (tab: string) => void;
}

export const ArabicSpeechAnalysis: React.FC<ArabicSpeechAnalysisProps> = ({
  onComplete,
  studentName = 'الطالب',
  onNavigateTab
}) => {
  const { saveSpeechAnalysisResults } = useAssessment();

  const [stage, setStage] = useState<'intro' | 'instructions' | 'testing' | 'results'>('intro');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingTranscript, setIsProcessingTranscript] = useState(false);
  const [hasMicrophonePermission, setHasMicrophonePermission] = useState<boolean | null>(null);
  const [speechApiSupported, setSpeechApiSupported] = useState(true);

  // Live feedback
  const [liveAudioLevel, setLiveAudioLevel] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [currentRecordingUrl, setCurrentRecordingUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Analysis audit log
  const [completedReports, setCompletedReports] = useState<WordAnalysisReport[]>([]);

  // Refs for Web Audio API & MediaStream
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Speech Recognition ref
  const speechRecognitionRef = useRef<any>(null);
  const speechTranscriptRef = useRef<string>('');
  const interimTranscriptRef = useRef<string>('');
  const speechConfidenceRef = useRef<number | null>(null);
  const recognitionEndedRef = useRef(true);
  const recognitionEndWaiterRef = useRef<(() => void) | null>(null);

  const currentWord = ARABIC_PRACTICE_WORDS[currentWordIndex];
  const currentWordRef = useRef(currentWord);
  currentWordRef.current = currentWord;
  const recordingWordRef = useRef<TestWord | null>(null);
  const progressPercent = Math.round((currentWordIndex / ARABIC_PRACTICE_WORDS.length) * 100);

  // Clean diacritics for normalization
  const stripDiacritics = (text: string) => {
    return text.replace(/[\u064B-\u065F\u0670]/g, '');
  };

  // 1. Initialize Speech Recognition on Mount
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ar-SA';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            const rawConfidence = event.results[i][0].confidence;
            if (event.results[i].isFinal) {
              speechTranscriptRef.current = transcript.trim();
              speechConfidenceRef.current =
                typeof rawConfidence === 'number' &&
                Number.isFinite(rawConfidence) &&
                rawConfidence >= 0 &&
                rawConfidence <= 1
                  ? Math.round(rawConfidence * 100)
                  : 0;
              interimTranscriptRef.current = transcript.trim();
              setInterimTranscript(transcript.trim());
            } else {
              currentInterim += transcript;
              interimTranscriptRef.current = currentInterim;
              setInterimTranscript(currentInterim);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('[ArabicSpeech] Speech recognition notice:', event.error);
        };
        recognition.onend = () => {
          recognitionEndedRef.current = true;
          recognitionEndWaiterRef.current?.();
        };

        speechRecognitionRef.current = recognition;
        setSpeechApiSupported(true);
      } catch (err) {
        console.warn('SpeechRecognition initialization error:', err);
        setSpeechApiSupported(false);
      }
    } else {
      setSpeechApiSupported(false);
    }

    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch (_) {}
      }
      stopAudioStreams();
    };
  }, []);

  const stopAudioStreams = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
  };

  // 2. Setup Audio Hardware Pipeline
  const ensureAudioPipeline = async (): Promise<boolean> => {
    try {
      if (mediaStreamRef.current && mediaRecorderRef.current) {
        return true;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      setHasMicrophonePermission(true);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const blobUrl = URL.createObjectURL(audioBlob);
        setCurrentRecordingUrl(blobUrl);

        try {
          // SpeechRecognition may emit its final transcript after MediaRecorder stops.
          await waitForSpeechRecognitionEnd();
          processTranscriptComparison(blobUrl);
        } finally {
          setIsProcessingTranscript(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      return true;
    } catch (err) {
      console.error('Microphone error:', err);
      setHasMicrophonePermission(false);
      alert('تعذر الوصول إلى الميكروفون. يرجى التأكد من توصيل الميكروفون ومنح الإذن في المتصفح.');
      return false;
    }
  };

  // Real-time canvas waveform drawer
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    const render = () => {
      if (!isRecording) return;
      animationFrameRef.current = requestAnimationFrame(render);

      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      // Calculate instantaneous energy
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = (timeData[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / bufferLength);
      setLiveAudioLevel(Math.min(100, Math.round(rms * 250)));

      // Draw Waveform Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw subtle grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Dynamic glowing audio curve
      ctx.lineWidth = 3;
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#10b981');
      gradient.addColorStop(0.5, '#06b6d4');
      gradient.addColorStop(1, '#6366f1');
      ctx.strokeStyle = gradient;

      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    render();
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      drawWaveform();
    }
  }, [isRecording, drawWaveform]);

  const waitForSpeechRecognitionEnd = () => {
    if (!speechRecognitionRef.current || recognitionEndedRef.current) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      let timeoutId: number;
      const finish = () => {
        window.clearTimeout(timeoutId);
        if (recognitionEndWaiterRef.current === finish) {
          recognitionEndWaiterRef.current = null;
        }
        recognitionEndedRef.current = true;
        resolve();
      };
      recognitionEndWaiterRef.current = finish;
      timeoutId = window.setTimeout(finish, 1500);
    });
  };

  // 3. Start Recording Session for Current Word
  const startWordRecording = async () => {
    const recordingTarget = currentWord;
    recordingWordRef.current = recordingTarget;
    const ready = await ensureAudioPipeline();
    if (!ready || !mediaRecorderRef.current) return;

    audioChunksRef.current = [];
    speechTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    speechConfidenceRef.current = null;
    setInterimTranscript('');
    setCurrentRecordingUrl(null);

    mediaRecorderRef.current.start(100);
    setIsRecording(true);

    if (speechRecognitionRef.current) {
      try {
        recognitionEndedRef.current = false;
        speechRecognitionRef.current.start();
      } catch (_) {
        // Recognition might already be running
      }
    }
  };

  // 4. Stop Recording Session
  const stopWordRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setIsProcessingTranscript(true);
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (_) {}
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  // Text-only comparison of the browser-produced transcript. This is not a clinical measure.
  const normalizeArabicTranscript = (value: string) =>
    stripDiacritics(value)
      .replace(/[ـ]/g, '')
      .replace(/[\s.,،؛:!?؟'"“”(){}\[\]\-]/g, '')
      .trim();

  const classifyTranscriptComparison = (
    expected: string,
    recognized: string
  ): TranscriptComparison => {
    if (!recognized) {
      return {
        status: 'unavailable',
        labelArabic: 'لم يتوفر تفريغ نصي واضح',
        notes: 'لم يُرجع المتصفح نصًا نهائيًا واضحًا. أعد المحاولة أو استمع إلى التسجيل وراجعه يدويًا.',
      };
    }
    if (recognized === expected) {
      return {
        status: 'exact_match',
        labelArabic: 'التفريغ يطابق الكلمة المستهدفة نصيًا',
        notes: 'هذه مطابقة نصية بعد تطبيع التشكيل وعلامات الترقيم؛ لا تثبت وحدها صحة النطق ولا تقيس الوعي الفونولوجي.',
      };
    }
    return {
      status: 'transcript_difference',
      labelArabic: 'اختلاف بين التفريغ والكلمة المستهدفة',
      notes: 'قد يرجع الاختلاف إلى التعرف الصوتي أو اللهجة أو التسجيل أو طريقة النطق. استمع إلى التسجيل وراجع التفريغ يدويًا قبل تفسيره.',
    };
  };

  const processTranscriptComparison = (blobUrl: string) => {
    const targetWord = recordingWordRef.current ?? currentWordRef.current;
    const rawTranscript = speechTranscriptRef.current.trim() || interimTranscriptRef.current.trim();
    const cleanExpected = normalizeArabicTranscript(targetWord.word);
    const cleanSpoken = normalizeArabicTranscript(rawTranscript);
    const exactTranscriptMatch = Boolean(cleanSpoken) && cleanSpoken === cleanExpected;
    const transcriptComparison = classifyTranscriptComparison(cleanExpected, cleanSpoken);
    const speechRecognitionConfidence =
      speechConfidenceRef.current > 0 ? speechConfidenceRef.current : null;

    const report: WordAnalysisReport = {
      wordId: targetWord.id,
      targetWord: targetWord.word,
      spokenTranscript: rawTranscript,
      normalizedSpoken: cleanSpoken,
      exactTranscriptMatch,
      speechRecognitionConfidence,
      transcriptComparison,
      audioBlobUrl: blobUrl,
      syllables: segmentArabicWordIntoSyllables(targetWord.word),
    };

    setCompletedReports((prev) => {
      const filtered = prev.filter((item) => item.wordId !== currentWord.id);
      return [...filtered, report];
    });
  };

  // Play model Arabic TTS
  const playModelAudio = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.8;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Play user's recorded audio
  const playRecordedUtterance = (blobUrl?: string) => {
    const url = blobUrl || currentRecordingUrl;
    if (!url) return;
    setIsPlayingAudio(true);
    const audio = new Audio(url);
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => setIsPlayingAudio(false);
    audio.play();
  };

  // Navigation between test items
  const handleNextWord = () => {
    if (isRecording) {
      stopWordRecording();
      return;
    }
    if (isProcessingTranscript) return;

    if (currentWordIndex < ARABIC_PRACTICE_WORDS.length - 1) {
      setCurrentWordIndex((prev) => prev + 1);
      interimTranscriptRef.current = '';
      setInterimTranscript('');
      setCurrentRecordingUrl(null);
    } else {
      finishAssessment();
    }
  };

  const handlePrevWord = () => {
    if (isRecording || isProcessingTranscript) return;
    if (currentWordIndex > 0) {
      setCurrentWordIndex((prev) => prev - 1);
      interimTranscriptRef.current = '';
      setInterimTranscript('');
      setCurrentRecordingUrl(null);
    }
  };

  // Summarize transcript matches only. Browser confidence is optional metadata, not a pronunciation score.
  const finishAssessment = () => {
    setStage('results');
    const totalWords = completedReports.length;
    const exactTranscriptMatches = completedReports.filter((item) => item.exactTranscriptMatch).length;
    const availableConfidences = completedReports
      .map((item) => item.speechRecognitionConfidence)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100);
    const averageRecognitionConfidence = availableConfidences.length
      ? Math.round(availableConfidences.reduce((sum, value) => sum + value, 0) / availableConfidences.length)
      : null;

    saveSpeechAnalysisResults(completedReports);
    if (onComplete) {
      onComplete({
        summary: {
          averageRecognitionConfidence,
          exactTranscriptMatches,
          transcriptsNeedingReview: Math.max(0, totalWords - exactTranscriptMatches),
        },
        details: completedReports,
      });
    }
  };

  const currentReport = completedReports.find((r) => r.wordId === currentWord.id);

  // --------------------------------------------------------------------------
  // RENDER STAGES
  // --------------------------------------------------------------------------

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 select-none font-sans" dir="rtl">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-slate-200 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            نشاط استكشافي للنطق والأصوات العربية
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            نشاط مقارنة التفريغ الصوتي بالعربية
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            يقارن النشاط تفريغ المتصفح بالكلمة المعروضة. قد يخطئ التعرف الصوتي، ولا تمثل المطابقة النصية تقييمًا لدقة النطق أو اختبارًا لصعوبات التعلّم للطالب:{' '}
            <span className="font-bold text-emerald-700">{studentName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {stage === 'testing' && (
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">التقدم:</span>
              <div className="w-28 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-700 font-mono">
                {currentWordIndex + 1} / {ARABIC_PRACTICE_WORDS.length}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ----------------- STAGE 1: INTRO ----------------- */}
      {stage === 'intro' && (
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-xl text-center max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Headphones className="w-10 h-10" />
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-4">
            جرّب نطق الكلمات ومراجعة التفريغ
          </h2>

          <p className="text-slate-600 leading-relaxed mb-8">
            اعرض الكلمة، وانطقها، ثم قارن التفريغ الذي يعيده المتصفح بالنص المستهدف. قد يختلف التفريغ بسبب جودة التسجيل أو اللهجة أو دقة التعرف؛ راجع التسجيل يدويًا. هذا نشاط تدريبي استكشافي وليس فحصًا معياريًا.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-right">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-emerald-700 font-black text-lg mb-1">13 كلمة</div>
              <div className="text-xs text-slate-600">أمثلة تدريبية للمقارنة النصية، وليست اختبارًا معياريًا</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-emerald-700 font-black text-lg mb-1">التفريغ الصوتي</div>
              <div className="text-xs text-slate-600">نص يعيده المتصفح عند دعمه</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-emerald-700 font-black text-lg mb-1">تغذية فورية</div>
              <div className="text-xs text-slate-600">مقارنة نصية أولية تتطلب مراجعة</div>
            </div>
          </div>

          <button
            onClick={() => {
              ensureAudioPipeline();
              setStage('instructions');
            }}
            className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-3 mx-auto text-lg"
          >
            <span>بدء التعليمات وتجهيز الميكروفون</span>
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ----------------- STAGE 2: INSTRUCTIONS ----------------- */}
      {stage === 'instructions' && (
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-xl max-w-2xl mx-auto">
          <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">
            إرشادات نشاط القراءة الجهرية
          </h2>

          <div className="space-y-4 mb-8 text-right">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                1
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">اجلس في بيئة هادئة</h4>
                <p className="text-xs text-slate-600">
                  تأكد من خلو الغرفة من الضوضاء الخلفية واقترب من ميكروفون الحاسوب أو الهاتف.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                2
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">اضغط زر الميكروفون واقرأ بوضوح</h4>
                <p className="text-xs text-slate-600">
                  عند ظهور الكلمة مشكولة، اضغط زر التسجيل واقرأ الكلمة بنطقك الطبيعي ثم أوقف التسجيل.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-purple-50/70 border border-purple-100">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                3
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">استمع للنطق النموذجي عند الحاجة</h4>
                <p className="text-xs text-slate-600">
                  يمكنك الضغط على أيقونة السماعة للاستماع إلى النطق الفصيح للكلمة.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => setStage('testing')}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition-all text-lg flex items-center justify-center gap-2"
            >
              <span>جاهز، فلنبدأ نشاط المقارنة!</span>
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ----------------- STAGE 3: ACTIVE WORD TESTING ----------------- */}
      {stage === 'testing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* MAIN TEST CARD */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-8 shadow-xl flex flex-col items-center">
            {/* Word Category Badge */}
            <div className="flex items-center justify-between w-full mb-6">
              <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {currentWord.categoryLabel}
              </span>
              <button
                onClick={() => playModelAudio(currentWord.word)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
                title="استمع للفظ الكلمة الصحيح"
              >
                <Volume2 className="w-4 h-4" />
                استمع للنموذج
              </button>
            </div>

            {/* Stimulus Word Display */}
            <div className="w-full py-12 px-6 my-2 bg-gradient-to-b from-slate-50 to-white rounded-3xl border border-slate-200 text-center relative overflow-hidden shadow-inner">
              <span className="text-6xl md:text-7xl font-black text-slate-900 tracking-wider font-serif select-all">
                {currentWord.word}
              </span>

              {/* Syllable Breakdown */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="text-xs text-slate-400 font-medium">التقطيع الصوتي:</span>
                {segmentArabicWordIntoSyllables(currentWord.word).map((syl, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-emerald-100/60 text-emerald-900 text-xs font-bold rounded border border-emerald-200"
                  >
                    {syl}
                  </span>
                ))}
              </div>
            </div>

            {/* Audio Waveform Live Canvas */}
            <div className="w-full my-4 bg-slate-900 rounded-2xl p-3 flex flex-col items-center shadow-md">
              <canvas
                ref={canvasRef}
                width={500}
                height={70}
                className="w-full h-16 rounded-xl block"
              />
              <div className="w-full flex items-center justify-between px-2 pt-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRecording ? 'bg-red-500 animate-ping' : 'bg-slate-600'
                    }`}
                  />
                  <span>{isRecording ? 'جارٍ تسجيل الكلمة...' : isProcessingTranscript ? 'جارٍ حفظ التفريغ...' : 'الميكروفون في وضع الاستعداد'}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span>مستوى الإشارة:</span>
                  <span className="text-emerald-400 font-bold">{liveAudioLevel}%</span>
                </div>
              </div>
            </div>

            {/* Live Recognized Transcript Display */}
            {(interimTranscript || currentReport) && (
              <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4 text-center">
                <span className="text-xs text-slate-500 block mb-1">ما تم التقاطه من صوتك:</span>
                <span className="text-xl font-bold text-slate-800">
                  {interimTranscript || currentReport?.spokenTranscript || '...'}
                </span>
              </div>
            )}

            {/* Action Buttons: Record, Replay, Next */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 mt-4">
              {!isRecording ? (
                <button
                  onClick={startWordRecording}
                  className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-3 text-lg"
                >
                  <Mic className="w-6 h-6" />
                  <span>اضغط للقراءة والتسجيل</span>
                </button>
              ) : (
                <button
                  onClick={stopWordRecording}
                  className="w-full sm:w-auto px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-3 text-lg animate-pulse"
                >
                  <MicOff className="w-6 h-6" />
                  <span>إيقاف التسجيل ومراجعة التفريغ</span>
                </button>
              )}

              {currentRecordingUrl && (
                <button
                  onClick={() => playRecordedUtterance()}
                  disabled={isPlayingAudio}
                  className="w-full sm:w-auto px-5 py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-2xl border border-indigo-200 transition-colors flex items-center justify-center gap-2"
                  title="استمع لصوتك المسجل"
                >
                  <Play className={`w-5 h-5 ${isPlayingAudio ? 'animate-bounce' : ''}`} />
                  <span>صوتك المسجل</span>
                </button>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="w-full flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
              <button
                onClick={handlePrevWord}
                disabled={currentWordIndex === 0 || isRecording || isProcessingTranscript}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                  currentWordIndex === 0
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                الكلمة السابقة
              </button>

              <button
                onClick={handleNextWord}
                disabled={isProcessingTranscript}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center gap-2"
              >
                <span>
                  {currentWordIndex === ARABIC_PRACTICE_WORDS.length - 1
                    ? 'إنهاء وعرض التقرير'
                    : 'الكلمة التالية'}
                </span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Transcript comparison observations only; not a diagnostic measure. */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold text-sm">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>مقارنة التفريغ بالكلمة المعروضة</span>
              </div>
              {currentReport ? (
                <div className="space-y-3">
                  <div className={`p-3.5 rounded-2xl border ${
                    currentReport.transcriptComparison.status === 'exact_match'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-center gap-2 font-bold text-sm mb-1">
                      {currentReport.transcriptComparison.status === 'exact_match'
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        : <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
                      <span>{currentReport.transcriptComparison.labelArabic}</span>
                    </div>
                    <p className="text-xs opacity-90">{currentReport.transcriptComparison.notes}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                    <span className="text-slate-500 block mb-1">ثقة التعرف التي وفرها المتصفح:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {currentReport.speechRecognitionConfidence === null
                        ? 'غير متاحة'
                        : `${currentReport.speechRecognitionConfidence}% — ليست دقة النطق`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  ابدأ التسجيل لعرض التفريغ النصي ومراجعته.
                </div>
              )}
            </div>
            {/* Test Words Progress List */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                قائمة الكلمات (13 كلمة)
              </h4>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {ARABIC_PRACTICE_WORDS.map((w, idx) => {
                  const rep = completedReports.find((r) => r.wordId === w.id);
                  const isCurrent = idx === currentWordIndex;
                  return (
                    <button
                      key={w.id}
                      disabled={isRecording || isProcessingTranscript}
                      onClick={() => {
                        if (isRecording) stopWordRecording();
                        setCurrentWordIndex(idx);
                        interimTranscriptRef.current = '';
                        setInterimTranscript('');
                        setCurrentRecordingUrl(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : rep
                          ? rep.exactTranscriptMatch
                            ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>{w.word}</span>
                      <span className="text-[10px] font-normal opacity-80">
                        {rep ? (rep.exactTranscriptMatch ? '✓ مطابق نصيًا' : 'راجع التفريغ') : `كلمة ${idx + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- STAGE 4: TRANSCRIPT COMPARISON SUMMARY ----------------- */}
      {stage === 'results' && (
        <div className="space-y-8 animate-fadeIn">
          <div className="bg-gradient-to-br from-emerald-600 via-teal-700 to-indigo-900 rounded-3xl p-8 md:p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 inline-block">
                ملخص نشاط تدريبي
              </span>
              <h2 className="text-3xl font-black mb-1">مقارنة التفريغ بالنص المستهدف: {studentName}</h2>
              <p className="text-sm text-emerald-100 leading-7">
                يعرض الملخص عدد التفريغات المطابقة نصيًا. المطابقة لا تثبت صحة النطق، والاختلاف لا يثبت وجود صعوبة تعلم؛ قد يخطئ التعرف الصوتي ويحتاج كل اختلاف إلى مراجعة بشرية.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">تفريغات مطابقة نصيًا</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600 font-mono">
                  {completedReports.filter((item) => item.exactTranscriptMatch).length}
                </span>
                <span className="text-xs text-slate-400">من {completedReports.length} كلمة منجزة</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">تفريغات تحتاج إلى مراجعة</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-600 font-mono">
                  {completedReports.filter((item) => !item.exactTranscriptMatch).length}
                </span>
                <span className="text-xs text-slate-400">قد يكون الاختلاف من نظام التعرف</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">ثقة التعرف الصوتي المتاحة</span>
              <div className="text-2xl font-black text-slate-800 font-mono">
                {(() => {
                  const values = completedReports
                    .map((item) => item.speechRecognitionConfidence)
                    .filter((value): value is number => typeof value === 'number');
                  return values.length
                    ? `${Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)}%`
                    : 'غير متاحة';
                })()}
              </div>
              <span className="text-xs text-slate-400">ليست مقياسًا لدقة النطق</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-4">تفاصيل المقارنة النصية</h3>
            <div className="mb-4 text-xs leading-6 text-slate-500">
              قارِن النص المعروض بما أعاده المتصفح. لا تستخدم النتائج لتصنيف الطفل أو لتشخيص عسر القراءة أو قياس الوعي الفونولوجي.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-400">
                    <th className="py-3 px-4 font-bold">الكلمة المستهدفة</th>
                    <th className="py-3 px-4 font-bold">التفريغ الذي أعاده المتصفح</th>
                    <th className="py-3 px-4 font-bold">نتيجة المقارنة</th>
                    <th className="py-3 px-4 font-bold">ثقة التعرف (إن توفرت)</th>
                    <th className="py-3 px-4 font-bold">التسجيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedReports.map((report) => (
                    <tr key={report.wordId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{report.targetWord}</td>
                      <td className="py-3.5 px-4 text-slate-700 font-serif">{report.spokenTranscript || 'لم يتوفر تفريغ'}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          report.transcriptComparison.status === 'exact_match'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {report.transcriptComparison.labelArabic}
                        </span>
                        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{report.transcriptComparison.notes}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {report.speechRecognitionConfidence === null ? 'غير متاحة' : `${report.speechRecognitionConfidence}%`}
                      </td>
                      <td className="py-3.5 px-4">
                        {report.audioBlobUrl && (
                          <button
                            type="button"
                            onClick={() => playRecordedUtterance(report.audioBlobUrl)}
                            className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 rounded-lg transition-colors"
                            title="تشغيل التسجيل"
                            aria-label={`تشغيل تسجيل ${report.targetWord}`}
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <button
              onClick={() => {
                setCompletedReports([]);
                speechTranscriptRef.current = '';
                interimTranscriptRef.current = '';
                speechConfidenceRef.current = null;
                setInterimTranscript('');
                setCurrentRecordingUrl(null);
                setStage('testing');
                setCurrentWordIndex(0);
              }}
              className="px-6 py-3 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة النشاط</span>
            </button>

            <button
              onClick={() => {
                if (onNavigateTab) {
                  onNavigateTab('tactile-analytics');
                } else if (onComplete) {
                  onComplete();
                }
              }}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-3 text-lg"
            >
              <span>المتابعة إلى فحص التفاعل اللمسي والحس العددي</span>
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArabicSpeechAnalysis;
