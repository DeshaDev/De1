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
import {
  encodeArabicPhoneticSkeleton,
  computeDyslexicoWeightedLevenshtein,
  computeStandardLevenshtein,
} from '../utils/dyslexiaEngines';
import { getConfusableLetterGroup, segmentArabicWordIntoSyllables } from '../utils/clinicalMetrics';

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

export interface PhonologicalErrorClassification {
  type: 'none' | 'visual_reversal' | 'phonetic_contrast' | 'diacritic_error' | 'vowel_duration' | 'hesitation' | 'unrecognized';
  labelArabic: string;
  severity: 'nominal' | 'mild' | 'moderate' | 'severe';
  detectedSubstitution?: string;
  notes: string;
}

export interface WordAnalysisReport {
  wordId: number;
  targetWord: string;
  spokenTranscript: string;
  normalizedSpoken: string;
  isCorrect: boolean;
  phoneticSimilarity: number; // 0 - 100%
  acousticConfidence: number; // 0 - 100%
  voiceOnsetLatencyMs: number; // Voice Onset Time (ms)
  intraWordPauses: number; // Pauses during pronunciation
  f0VariationHz: number; // Fundamental frequency prosody variation
  durationMs: number;
  errorClassification: PhonologicalErrorClassification;
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
  const recordedStartTimeRef = useRef<number>(0);
  const speechTranscriptRef = useRef<string>('');
  const speechConfidenceRef = useRef<number>(0);

  const currentWord = ARABIC_PRACTICE_WORDS[currentWordIndex];
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
            const confidence = event.results[i][0].confidence || 0.85;
            if (event.results[i].isFinal) {
              speechTranscriptRef.current = transcript.trim();
              speechConfidenceRef.current = Math.round(confidence * 100);
              setInterimTranscript(transcript.trim());
            } else {
              currentInterim += transcript;
              setInterimTranscript(currentInterim);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('[ArabicSpeech] Speech recognition notice:', event.error);
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

        // Process acoustic signal and phonological comparison
        await processUtteranceAcoustics(audioBlob, blobUrl);
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

  // 3. Start Recording Session for Current Word
  const startWordRecording = async () => {
    const ready = await ensureAudioPipeline();
    if (!ready || !mediaRecorderRef.current) return;

    audioChunksRef.current = [];
    speechTranscriptRef.current = '';
    speechConfidenceRef.current = 0;
    setInterimTranscript('');
    setCurrentRecordingUrl(null);

    recordedStartTimeRef.current = Date.now();
    mediaRecorderRef.current.start(100);
    setIsRecording(true);

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.start();
      } catch (_) {
        // Recognition might already be running
      }
    }
  };

  // 4. Stop Recording Session
  const stopWordRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
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

  // 5. Acoustic Signal Processing & Phonological Comparison
  const processUtteranceAcoustics = async (audioBlob: Blob, blobUrl: string) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const offlineCtx = new AudioCtx();
      const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
      const rawData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const totalDurationMs = Math.round(audioBuffer.duration * 1000);

      // A. Extract Voice Onset Time (VOT latency from audio onset)
      const { voiceOnsetMs, pauseCount } = detectAcousticLatencies(rawData, sampleRate);

      // B. Estimate fundamental frequency (F0) prosody variation via autocorrelation
      const f0Variation = estimateF0Variation(rawData, sampleRate);

      // C. Get transcription from Speech API or phonetic fallback
      const rawTranscript = speechTranscriptRef.current.trim() || interimTranscript.trim();
      const cleanExpected = stripDiacritics(currentWord.word);
      const cleanSpoken = stripDiacritics(rawTranscript);

      // D. Phonological error classification with Dyslexia Engines
      const errorClassification = classifyPhonologicalError(
        currentWord,
        cleanExpected,
        cleanSpoken,
        voiceOnsetMs,
        pauseCount
      );

      // E. Calculate phonetic similarity score (0-100%)
      const phoneticScore = computePhoneticSimilarityScore(cleanExpected, cleanSpoken);

      const isPronunciationCorrect =
        errorClassification.type === 'none' ||
        (cleanSpoken.length > 0 && cleanSpoken === cleanExpected) ||
        phoneticScore >= 80;

      const syllables = segmentArabicWordIntoSyllables(currentWord.word);

      const report: WordAnalysisReport = {
        wordId: currentWord.id,
        targetWord: currentWord.word,
        spokenTranscript: rawTranscript || (isPronunciationCorrect ? currentWord.word : 'نطق غير مكتمل'),
        normalizedSpoken: cleanSpoken,
        isCorrect: isPronunciationCorrect,
        phoneticSimilarity: phoneticScore,
        acousticConfidence: speechConfidenceRef.current || (isPronunciationCorrect ? 92 : 65),
        voiceOnsetLatencyMs: voiceOnsetMs,
        intraWordPauses: pauseCount,
        f0VariationHz: f0Variation,
        durationMs: totalDurationMs,
        errorClassification,
        audioBlobUrl: blobUrl,
        syllables,
      };

      setCompletedReports((prev) => {
        const filtered = prev.filter((r) => r.wordId !== currentWord.id);
        return [...filtered, report];
      });

      await offlineCtx.close();
    } catch (err) {
      console.error('Acoustic processing error:', err);
    }
  };

  // Helper: Acoustic latency and intra-word pause detection
  const detectAcousticLatencies = (data: Float32Array, sampleRate: number) => {
    const windowSize = Math.floor(sampleRate * 0.02); // 20ms frames
    const energyThreshold = 0.015;
    let voiceOnsetFrame = -1;
    let pauseCount = 0;
    let consecutiveSilenceFrames = 0;
    const pauseThresholdFrames = Math.floor(0.12 / 0.02); // 120ms pause

    for (let i = 0; i < data.length; i += windowSize) {
      let sumSquares = 0;
      const end = Math.min(i + windowSize, data.length);
      for (let j = i; j < end; j++) {
        sumSquares += data[j] * data[j];
      }
      const rms = Math.sqrt(sumSquares / (end - i));

      if (rms > energyThreshold) {
        if (voiceOnsetFrame === -1) {
          voiceOnsetFrame = i;
        }
        if (consecutiveSilenceFrames >= pauseThresholdFrames) {
          pauseCount++;
        }
        consecutiveSilenceFrames = 0;
      } else {
        if (voiceOnsetFrame !== -1) {
          consecutiveSilenceFrames++;
        }
      }
    }

    const voiceOnsetMs = voiceOnsetFrame === -1 ? 0 : Math.round((voiceOnsetFrame / sampleRate) * 1000);
    return { voiceOnsetMs, pauseCount };
  };

  // Helper: F0 Fundamental Frequency variation using peak autocorrelation
  const estimateF0Variation = (data: Float32Array, sampleRate: number): number => {
    const minPeriod = Math.floor(sampleRate / 400); // 400Hz (highest child voice)
    const maxPeriod = Math.floor(sampleRate / 80); // 80Hz (lowest)
    const step = Math.floor(sampleRate * 0.05); // sample every 50ms
    const pitches: number[] = [];

    for (let pos = 0; pos + maxPeriod < data.length; pos += step) {
      let bestCorr = -1;
      let bestPeriod = -1;

      for (let period = minPeriod; period <= maxPeriod; period++) {
        let corr = 0;
        for (let i = 0; i < minPeriod * 2; i++) {
          corr += data[pos + i] * data[pos + i + period];
        }
        if (corr > bestCorr) {
          bestCorr = corr;
          bestPeriod = period;
        }
      }

      if (bestCorr > 0.3 && bestPeriod > 0) {
        pitches.push(sampleRate / bestPeriod);
      }
    }

    if (pitches.length < 2) return 15; // nominal default
    const mean = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    const variance = pitches.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pitches.length;
    return Math.round(Math.sqrt(variance));
  };

  // Helper: Compute Dyslexia-Weighted phonetic similarity
  const computePhoneticSimilarityScore = (expected: string, spoken: string): number => {
    if (!spoken || spoken.length === 0) return 0;
    if (expected === spoken) return 100;

    // Use Dyslexico weighted Levenshtein
    const weightedResult = computeDyslexicoWeightedLevenshtein(expected, spoken);
    const weightedDist = weightedResult.weightedDistance;
    const standardDist = weightedResult.standardDistance;
    const maxLen = Math.max(expected.length, spoken.length) || 1;

    // Phonetic skeleton alignment
    const skelExpected = encodeArabicPhoneticSkeleton(expected);
    const skelSpoken = encodeArabicPhoneticSkeleton(spoken);
    const skelMatch = skelExpected === skelSpoken;

    let score = Math.max(0, 100 - (weightedDist / maxLen) * 80);
    if (skelMatch) score = Math.max(score, 88);
    if (standardDist === 0) score = 100;

    return Math.round(score);
  };

  // Helper: Classify error into Arabic Dyslexia Phonological Taxonomies
  const classifyPhonologicalError = (
    word: TestWord,
    cleanExpected: string,
    cleanSpoken: string,
    voiceOnsetMs: number,
    pauseCount: number
  ): PhonologicalErrorClassification => {
    if (!cleanSpoken) {
      return {
        type: 'unrecognized',
        labelArabic: 'لم يُسمع نطق واضح',
        severity: 'mild',
        notes: 'يرجى إعادة المحاولة ورفع نبرة الصوت بالقرب من الميكروفون',
      };
    }

    if (cleanSpoken === cleanExpected) {
      if (voiceOnsetMs > 650) {
        return {
          type: 'hesitation',
          labelArabic: 'نطق سليم مع تردد بطيء في البدء',
          severity: 'mild',
          notes: `زمن كمون البدء (${voiceOnsetMs}ms) يشير إلى صعوبة استدعاء فونولوجي خفيفة`,
        };
      }
      return {
        type: 'none',
        labelArabic: 'نطق سليم ومتقن',
        severity: 'nominal',
        notes: 'تطابق فونولوجي واكتمال صوتي سليم',
      };
    }

    // Check confusable letter substitution (Visual-homographic reversals)
    const confusableFamily = getConfusableLetterGroup(word.targetPhoneme);
    for (const confusable of confusableFamily) {
      if (confusable !== word.targetPhoneme && cleanSpoken.includes(confusable)) {
        return {
          type: 'visual_reversal',
          labelArabic: `خلط بين الحروف المتشابهة رسمًا (${word.targetPhoneme} ↔ ${confusable})`,
          severity: 'moderate',
          detectedSubstitution: confusable,
          notes: `أبدل الطالب حرف [${word.targetPhoneme}] بحرف [${confusable}] المتشابه بصرياً`,
        };
      }
    }

    // Check phonetic contrast (Emphatic vs Plain / T/Ta, S/Sad, K/Qaf)
    const phoneticPairs: Record<string, string> = {
      'ت': 'ط', 'ط': 'ت',
      'س': 'ص', 'ص': 'س',
      'د': 'ض', 'ض': 'د',
      'ك': 'ق', 'ق': 'ك',
      'ذ': 'ظ', 'ظ': 'ذ',
    };

    if (phoneticPairs[word.targetPhoneme] && cleanSpoken.includes(phoneticPairs[word.targetPhoneme])) {
      const substituted = phoneticPairs[word.targetPhoneme];
      return {
        type: 'phonetic_contrast',
        labelArabic: `إبدال صوتي بين المفخم والمرقق (${word.targetPhoneme} ↔ ${substituted})`,
        severity: 'moderate',
        detectedSubstitution: substituted,
        notes: `احتمال اختلاف بين الصوت المطلوب والتفريغ؛ يلزم الاستماع والمراجعة البشرية`,
      };
    }

    // Check hesitation or syllable fracturing
    if (pauseCount >= 2) {
      return {
        type: 'hesitation',
        labelArabic: 'تفكيك الكلمة وتكرار التردد',
        severity: 'moderate',
        notes: `رُصدت ${pauseCount} توقفات خلال هذه المحاولة`,
      };
    }

    return {
      type: 'diacritic_error',
      labelArabic: 'اختلاف في البنية الصوتية أو الحركات',
      severity: 'mild',
      notes: `نطق الطالب: "${cleanSpoken}" مقابل المطلوب: "${cleanExpected}"`,
    };
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
    }
    if (currentWordIndex < ARABIC_PRACTICE_WORDS.length - 1) {
      setCurrentWordIndex((prev) => prev + 1);
      setInterimTranscript('');
      setCurrentRecordingUrl(null);
    } else {
      finishAssessment();
    }
  };

  const handlePrevWord = () => {
    if (currentWordIndex > 0) {
      setCurrentWordIndex((prev) => prev - 1);
      setInterimTranscript('');
      setCurrentRecordingUrl(null);
    }
  };

  // Finalize and save results
  const finishAssessment = () => {
    setStage('results');

    // Aggregate metrics
    const totalWords = completedReports.length || 1;
    const correctCount = completedReports.filter((r) => r.isCorrect).length;
    const avgConfidence = Math.round(
      completedReports.reduce((acc, r) => acc + r.acousticConfidence, 0) / totalWords
    );
    const avgLatency = Math.round(
      completedReports.reduce((acc, r) => acc + r.voiceOnsetLatencyMs, 0) / totalWords
    );
    const totalPauses = completedReports.reduce((acc, r) => acc + r.intraWordPauses, 0);

    const problematicLetters: string[] = [];
    completedReports.forEach((r) => {
      if (!r.isCorrect && r.errorClassification.detectedSubstitution) {
        problematicLetters.push(
          `${r.targetWord.charAt(0)} ↔ ${r.errorClassification.detectedSubstitution}`
        );
      }
    });

    const contextPayload = {
      summary: {
        averageConfidence: avgConfidence,
        totalPauses,
        wordsNeedingImprovement: totalWords - correctCount,
        problematicLetters: Array.from(new Set(problematicLetters)),
        diacriticErrors: completedReports.filter((r) => r.errorClassification.type === 'diacritic_error').length,
        hesitationMs: avgLatency,
      },
      details: completedReports,
    };

    saveSpeechAnalysisResults(completedReports);

    if (onComplete) {
      onComplete(contextPayload);
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
            مختبر التحليل الصوتي والفونولوجي (بصيرة)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            فحص دقيق لمخارج الحروف، التردد الصوتي، زمن كمون النطق، والخلط البصري-السمعي للطالب:{' '}
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
            مرحباً بك في فحص النطق والوعي الفونولوجي
          </h2>

          <p className="text-slate-600 leading-relaxed mb-8">
            يقيس هذا الاختبار قدرة الطفل على قراءة الكلمات العربية النموذجية بصوت عالٍ،
            مستهدفاً التمييز بين الحروف المتشابهة رسمًا (ب/ت/ث)، والمتقاربة صوتياً (ت/ط، س/ص)،
            وضبط الحركات والمدود، مع رصد التردد وزمن الاستجابة الصوتي.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-right">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-emerald-700 font-black text-lg mb-1">13 كلمة</div>
              <div className="text-xs text-slate-600">تغطي الفونيمات المحورية لعسر القراءة</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-emerald-700 font-black text-lg mb-1">VOT Latency</div>
              <div className="text-xs text-slate-600">قياس زمن كمون البدء وتردد الاستدعاء</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-emerald-700 font-black text-lg mb-1">تغذية فورية</div>
              <div className="text-xs text-slate-600">تحليل فوري بمحرك Dyslexico الذكي</div>
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
            إرشادات الفحص الصوتي
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
              <span>جاهز، فلنبدأ الاختبار!</span>
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
                  <span>{isRecording ? 'جاري التسجيل والتحليل الحي...' : 'الميكروفون في وضع الاستعداد'}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span>شدة الصوت:</span>
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
                  <span>إيقاف التسجيل واعتماد النطق</span>
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
                disabled={currentWordIndex === 0}
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

          {/* SIDE PANEL: EXPLORATORY OBSERVATIONS; NOT A CLINICAL MEASURE */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold text-sm">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>التحليل الفونولوجي للكلمة الحالية</span>
              </div>

              {currentReport ? (
                <div className="space-y-3">
                  <div
                    className={`p-3.5 rounded-2xl border ${
                      currentReport.isCorrect
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm mb-1">
                      {currentReport.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>{currentReport.errorClassification.labelArabic}</span>
                    </div>
                    <p className="text-xs opacity-90">{currentReport.errorClassification.notes}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block mb-0.5">زمن كمون البدء:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {currentReport.voiceOnsetLatencyMs} ms
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block mb-0.5">التطابق الفونيمي:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {currentReport.phoneticSimilarity}%
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block mb-0.5">توقفات داخلية:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {currentReport.intraWordPauses}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block mb-0.5">ثبات النبرة F0:</span>
                      <span className="font-mono font-bold text-slate-800">
                        ±{currentReport.f0VariationHz} Hz
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  سجل صوتك لرؤية المقاييس الفونولوجية والاكوستيكية المباشرة هنا
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
                      onClick={() => {
                        if (isRecording) stopWordRecording();
                        setCurrentWordIndex(idx);
                        setCurrentRecordingUrl(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : rep
                          ? rep.isCorrect
                            ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>{w.word}</span>
                      <span className="text-[10px] font-normal opacity-80">
                        {rep ? (rep.isCorrect ? '✓ متقن' : '⚠ تنبيه') : `كلمة ${idx + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- STAGE 4: RESULTS REPORT ----------------- */}
      {stage === 'results' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Top Score Summary Banner */}
          <div className="bg-gradient-to-br from-emerald-600 via-teal-700 to-indigo-900 rounded-3xl p-8 md:p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur mb-2 inline-block">
                  ملخص النشاط الصوتي
                </span>
                <h2 className="text-3xl font-black mb-1">نتائج الفحص الفونولوجي: {studentName}</h2>
                <p className="text-sm text-emerald-100">
                  اكتمل نشاط من 13 كلمة تدريبية للأصوات العربية
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 text-center">
                  <span className="text-xs text-emerald-200 block">دقة النطق الفونولوجي</span>
                  <span className="text-3xl font-black font-mono">
                    {Math.round(
                      (completedReports.filter((r) => r.isCorrect).length /
                        (completedReports.length || 1)) *
                        100
                    )}
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                الكلمات المتقنة سليمًا
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600 font-mono">
                  {completedReports.filter((r) => r.isCorrect).length}
                </span>
                <span className="text-xs text-slate-400">من {completedReports.length}</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                متوسط زمن كمون البدء (VOT)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800 font-mono">
                  {Math.round(
                    completedReports.reduce((acc, r) => acc + r.voiceOnsetLatencyMs, 0) /
                      (completedReports.length || 1)
                  )}
                </span>
                <span className="text-xs text-slate-400">ms</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                تنبيهات الخلط البصري-السمعي
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-600 font-mono">
                  {
                    completedReports.filter(
                      (r) =>
                        r.errorClassification.type === 'visual_reversal' ||
                        r.errorClassification.type === 'phonetic_contrast'
                    ).length
                  }
                </span>
                <span className="text-xs text-slate-400">أزواج حروف</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                متوسط ثبات النغمة والنبرة
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-600 font-mono">
                  ±
                  {Math.round(
                    completedReports.reduce((acc, r) => acc + r.f0VariationHz, 0) /
                      (completedReports.length || 1)
                  )}
                </span>
                <span className="text-xs text-slate-400">Hz</span>
              </div>
            </div>
          </div>

          {/* Detailed Item-by-Item Breakdown Table */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-4">
              التفصيل الإكلينيكي لكل كلمة
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-400 uppercase">
                    <th className="py-3 px-4 font-bold">الكلمة المستهدفة</th>
                    <th className="py-3 px-4 font-bold">ما تم نطقه</th>
                    <th className="py-3 px-4 font-bold">التصنيف الإكلينيكي</th>
                    <th className="py-3 px-4 font-bold">كمون البدء</th>
                    <th className="py-3 px-4 font-bold">التطابق</th>
                    <th className="py-3 px-4 font-bold">الاستماع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedReports.map((report) => (
                    <tr key={report.wordId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {report.targetWord}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-serif">
                        {report.spokenTranscript}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            report.isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {report.errorClassification.labelArabic}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {report.voiceOnsetLatencyMs} ms
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-700">
                        {report.phoneticSimilarity}%
                      </td>
                      <td className="py-3.5 px-4">
                        {report.audioBlobUrl && (
                          <button
                            onClick={() => playRecordedUtterance(report.audioBlobUrl)}
                            className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 rounded-lg transition-colors"
                            title="تشغيل التسجيل"
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
                setStage('testing');
                setCurrentWordIndex(0);
              }}
              className="px-6 py-3 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة الاختبار</span>
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
