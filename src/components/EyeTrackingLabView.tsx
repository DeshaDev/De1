/**
 * Eye Tracking Lab - Exploratory Pupil Gaze & Word-by-Word Reading Tracker
 * Camera pupil estimation with Real-Time Word Foveal Detection
 * NOTE: Calibration stages removed per clinical/investor guidance.
 * Eye gaze overlays are exploratory and uncalibrated; not a clinical diagnostic.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Camera,
  Eye,
  AlertCircle,
  ChevronLeft,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Info,
} from 'lucide-react';
import webgazer from 'webgazer';
import { StudentRecord, INITIAL_STUDENTS } from '../data/seedData';
import { hitTestWordBoxes, WordBoundingBox } from '../utils/eyeTrackerEngine';
import { useAssessment } from '../contexts/AssessmentContext';

interface Props {
  onCompleteSession: (record: StudentRecord) => void;
  activeStudent?: StudentRecord;
  onProceedToMathLab?: () => void;
}

interface PupilFeatures {
  faceDetected: boolean;
  leftEyeOpenRatio: number;
  rightEyeOpenRatio: number;
  combinedNormX: number;
  combinedNormY: number;
}

// Gentle Web Audio Feedback Synthesizer
const playChime = (freq = 520, duration = 0.08) => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // audio fallback
  }
};

// Reading Passage Paragraphs
const READING_PARAGRAPHS = [
  'فِي صَباحٍ مُشْرِقٍ خَرَجَتِ القِطَّةُ البَيْضاءُ الصَّغيرَةُ إلى حَديقَةِ المَنْزِلِ.',
  'كانَتِ الشَّمْسُ دافِئَةً وَالأَزْهارُ المُتَفَتِّحَةُ تَمْلأُ المَكانَ بِعِطْرِها الزَّكِيِّ.',
  'شاهَدَتِ القِطَّةُ فَراشَةً مُلَوَّنَةً تُحَلِّقُ قُرْبَ الشَّجَرَةِ فَرَكَضَتْ خَلْفَها فَرِحَةً.',
  'وَبَعْدَ أَنْ تَعِبَتْ مِنَ اللَّعِبِ جَلَسَتْ تَحْتَ الظِّلِّ الظَّليلِ وَنامَتْ بِهُدوءٍ.',
];

export const EyeTrackingLabView: React.FC<Props> = ({
  onCompleteSession,
  activeStudent,
  onProceedToMathLab,
}) => {
  const { saveEyeTrackingResults } = useAssessment();

  // Stage: direct setup -> reading (calibration stages completely removed)
  const [stage, setStage] = useState<'setup' | 'reading'>('setup');
  const stageRef = useRef<'setup' | 'reading'>('setup');
  stageRef.current = stage;

  // Camera & Stream
  const [cameraActive, setCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [pupilFeatures, setPupilFeatures] = useState<PupilFeatures>({
    faceDetected: false,
    leftEyeOpenRatio: 0.3,
    rightEyeOpenRatio: 0.3,
    combinedNormX: 0.5,
    combinedNormY: 0.5,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webgazerInitialized = useRef(false);

  // Reading & Word Tracking State
  const [gazePosition, setGazePosition] = useState({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
  });
  const [hasLiveGaze, setHasLiveGaze] = useState(false);
  const [currentGazeWordIndex, setCurrentGazeWordIndex] = useState<number | null>(null);
  const [currentGazeWordText, setCurrentGazeWordText] = useState<string>('');
  const [regressionCount, setRegressionCount] = useState(0);

  const wordRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const wordBoxesRef = useRef<WordBoundingBox[]>([]);
  const currentWordIndexRef = useRef<number | null>(null);
  const regressionsCountRef = useRef<number>(0);
  const wordFixationsRef = useRef<Record<number, number>>({});
  const readingStartRef = useRef<number>(Date.now());
  const gazePointsRef = useRef<Array<{ x: number; y: number; t: number }>>([]);

  // Flatten words with global indices
  const allWords = useMemo(() => {
    let count = 0;
    return READING_PARAGRAPHS.map((paragraph, pIdx) => {
      const words = paragraph.split(' ').filter(Boolean);
      return words.map(word => {
        const item = { word, globalIndex: count, paragraphIndex: pIdx };
        count++;
        return item;
      });
    });
  }, []);

  const totalWordsCount = useMemo(() => {
    return allWords.reduce((sum, p) => sum + p.length, 0);
  }, [allWords]);

  // Sync video element with webcam stream
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(e => console.warn('Video play catch:', e));
      }
    }
  }, [cameraActive]);

  // Periodic Face Detection check
  useEffect(() => {
    if (!cameraActive) return;

    const checkFace = () => {
      try {
        const tracker = (webgazer as any).getTracker?.();
        const positions = tracker?.getPositions?.();
        const detected = Boolean(positions && Array.isArray(positions) && positions.length > 0);

        setPupilFeatures(prev => {
          if (prev.faceDetected === detected) return prev;
          return { ...prev, faceDetected: detected };
        });
      } catch {
        // ignore
      }
    };

    const interval = setInterval(checkFace, 250);
    return () => clearInterval(interval);
  }, [cameraActive]);

  // Measure word bounding boxes for word foveal hit-testing
  const measureWordBoxes = useCallback(() => {
    const boxes: WordBoundingBox[] = [];
    Object.entries(wordRefs.current).forEach(([idxStr, el]) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        boxes.push({
          wordIndex: Number(idxStr),
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        });
      }
    });
    wordBoxesRef.current = boxes;
  }, []);

  useEffect(() => {
    if (stage === 'reading') {
      const timer = setTimeout(measureWordBoxes, 200);
      window.addEventListener('resize', measureWordBoxes);
      window.addEventListener('scroll', measureWordBoxes);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', measureWordBoxes);
        window.removeEventListener('scroll', measureWordBoxes);
      };
    }
  }, [stage, measureWordBoxes]);

  // Start Camera
  const handleStartCamera = useCallback(async () => {
    setIsStartingCamera(true);
    try {
      // 1. Acquire Webcam Stream directly first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = stream;

      // 2. Attach immediately to preview element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn('Preview video play warning:', e);
        }
      }
      setCameraActive(true);

      // 3. Configure WebGazer paths
      const wgParams = webgazer.params as any;
      if (wgParams) {
        wgParams.faceMeshSolutionPath = '/mediapipe/face_mesh';
        wgParams.showVideo = true;
        wgParams.showFaceOverlay = false;
        wgParams.showFaceFeedbackBox = false;
      }

      // 4. Defensive patch on TFFaceMesh to prevent unhandled rejections
      const trackerProto = (webgazer as any).tracker?.TFFaceMesh?.prototype;
      if (trackerProto && !trackerProto.__safePatched) {
        const originalGetEyePatches = trackerProto.getEyePatches;
        trackerProto.getEyePatches = async function (
          video: any,
          canvas: any,
          width: number,
          height: number
        ) {
          try {
            if (!video || (video.readyState !== undefined && video.readyState < 2)) {
              this.positionsArray = null;
              return null;
            }
            const patches = await originalGetEyePatches.call(this, video, canvas, width, height);
            if (!patches) {
              this.positionsArray = null;
            }
            return patches || null;
          } catch {
            this.positionsArray = null;
            return null;
          }
        };
        trackerProto.__safePatched = true;
      }

      // 5. Provide shared stream to WebGazer
      (webgazer as any).setStaticVideo(stream);

      if (!webgazerInitialized.current) {
        await webgazer
          .setRegression('ridge')
          .setTracker('TFFacemesh')
          .showVideoPreview(true)
          .showPredictionPoints(false)
          .applyKalmanFilter(true)
          .begin();

        webgazerInitialized.current = true;
      } else {
        await webgazer.resume();
      }

      // 6. Ensure background video element is muted and positioned offscreen
      const wgVideo = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;
      if (wgVideo) {
        wgVideo.muted = true;
        wgVideo.play().catch(() => {});
      }

      const wgContainer = document.getElementById('webgazerVideoContainer');
      if (wgContainer) {
        wgContainer.style.position = 'fixed';
        wgContainer.style.top = '-9999px';
        wgContainer.style.left = '-9999px';
        wgContainer.style.opacity = '0';
        wgContainer.style.pointerEvents = 'none';
        wgContainer.style.zIndex = '-9999';
      }

      // 7. Real-time gaze listener with Word Foveal Detection
      webgazer.setGazeListener((data: any) => {
        if (data && typeof data.x === 'number' && typeof data.y === 'number') {
          const clampedX = Math.max(10, Math.min(window.innerWidth - 10, data.x));
          const clampedY = Math.max(10, Math.min(window.innerHeight - 10, data.y));

          setPupilFeatures(prev => ({
            ...prev,
            faceDetected: true,
            combinedNormX: clampedX / (window.innerWidth || 1),
            combinedNormY: clampedY / (window.innerHeight || 1),
          }));

          setGazePosition({ x: clampedX, y: clampedY });
          setHasLiveGaze(true);

          // In Reading Stage: Detect word being looked at
          if (stageRef.current === 'reading' && wordBoxesRef.current.length > 0) {
            gazePointsRef.current.push({ x: clampedX, y: clampedY, t: Date.now() });

            const hitIndex = hitTestWordBoxes(clampedX, clampedY, wordBoxesRef.current, 75);
            if (hitIndex !== null) {
              if (hitIndex !== currentWordIndexRef.current) {
                // In Arabic (RTL), if index is smaller than before, eye jumped back to the right (Regression)
                if (currentWordIndexRef.current !== null && hitIndex < currentWordIndexRef.current) {
                  regressionsCountRef.current += 1;
                  setRegressionCount(regressionsCountRef.current);
                }

                currentWordIndexRef.current = hitIndex;
                setCurrentGazeWordIndex(hitIndex);

                // Find word text
                let foundWord = '';
                allWords.forEach(p =>
                  p.forEach(w => {
                    if (w.globalIndex === hitIndex) foundWord = w.word;
                  })
                );
                setCurrentGazeWordText(foundWord);
              }

              wordFixationsRef.current[hitIndex] = (wordFixationsRef.current[hitIndex] || 0) + 1;
            }
          }
        }
      });
    } catch (error) {
      console.error('Camera initialization error:', error);
      alert('فشل في تشغيل الكاميرا. يرجى التأكد من توصيل الكاميرا ومنح الإذن للمتصفح.');
    } finally {
      setIsStartingCamera(false);
    }
  }, [allWords]);

  // Stop camera
  const handleStopCamera = useCallback(() => {
    try {
      webgazer.pause();
    } catch (e) {
      console.warn('Error pausing webgazer:', e);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setPupilFeatures(prev => ({
      ...prev,
      faceDetected: false,
    }));
    setHasLiveGaze(false);
  }, []);

  // Proceed directly to Reading stage (No calibration steps)
  const handleProceedToReading = useCallback(() => {
    readingStartRef.current = Date.now();
    gazePointsRef.current = [];
    currentWordIndexRef.current = null;
    regressionsCountRef.current = 0;
    setRegressionCount(0);
    setCurrentGazeWordIndex(null);
    setCurrentGazeWordText('');
    setStage('reading');
    playChime(660, 0.12);
  }, []);

  // Finish Reading & Submit Session
  const handleFinishReading = useCallback(() => {
    const durationSec = Math.max(5, Math.round((Date.now() - readingStartRef.current) / 1000));
    const points = gazePointsRef.current;
    const regressions = regressionsCountRef.current;
    // Regression rate is 0 if no gaze points recorded (not arbitrary 12%)
    const regRate =
      points.length > 0 ? Number(((regressions / Math.max(1, points.length)) * 100).toFixed(1)) : 0;

    const calculatedWpm = Math.max(25, Math.min(180, Math.round((totalWordsCount / durationSec) * 60)));

    const baseStudent = activeStudent || INITIAL_STUDENTS[0];
    const updatedRecord: StudentRecord = {
      ...baseStudent,
      readingDurationSeconds: durationSec,
      wpm: calculatedWpm,
      regressionCount: regressions,
      regressionRate: regRate,
      sessionStatus: 'completed',
      sessionCompletedAt: new Date().toISOString(),
    };

    // Save results into shared assessment context
    saveEyeTrackingResults({
      readingDurationSeconds: durationSec,
      wpm: calculatedWpm,
      regressionCount: regressions,
      regressionRate: regRate,
      wordsObserved: currentWordIndexRef.current !== null ? currentWordIndexRef.current + 1 : 0,
      totalWords: totalWordsCount,
      completedAt: new Date().toISOString(),
    });

    handleStopCamera();
    onCompleteSession(updatedRecord);
  }, [activeStudent, handleStopCamera, onCompleteSession, totalWordsCount, saveEyeTrackingResults]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        webgazer.pause();
        webgazer.clearGazeListener();
      } catch {
        // cleanup ignore
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/50 flex flex-col justify-between font-sans select-none">
      {/* =========================================================================
          STAGE 1: SETUP & CAMERA PREVIEW (DIRECT ENTRY - NO CALIBRATION)
          ========================================================================= */}
      {stage === 'setup' && (
        <div className="max-w-3xl w-full mx-auto p-6 md:p-8 pt-10">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-10">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-18 h-18 mx-auto bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/25">
                <Eye className="w-9 h-9 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
                مختبر القراءة وتتبع بؤبؤ العين
              </h1>
              <p className="text-slate-600 text-base md:text-lg">
                جلسة قراءة عربية تفاعلية مع رصد تقديري لحركة البؤبؤ والكلمات المقروءة
              </p>
            </div>

            {/* Scientific Transparency Notice */}
            <div className="mb-6 p-4 rounded-2xl bg-sky-50 border border-sky-200 text-right">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div className="text-xs text-sky-900 leading-relaxed">
                  <span className="font-bold block mb-1">تنبيه المنهجية والشفافية التقنية:</span>
                  تم إلغاء مراحل المعايرة المصطنعة لحماية موثوقية النتائج. تتبع حركة العين في هذا النموذج هو مؤشر بصري استكشافي مبني على تقريب بؤبؤ العين عبر الكاميرا دون معايرة سريرية مسبقة. يُعتمد في الفرز التعليمي أساساً على دقة النطق الصوتي والفهم القرائي.
                </div>
              </div>
            </div>

            {/* Camera Card */}
            <div className="border-2 border-slate-200 rounded-2xl p-6 bg-slate-50/70 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-slate-900">معاينة الكاميرا المباشرة</h2>
                </div>
                <div
                  className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 ${
                    cameraActive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      cameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {cameraActive ? 'الكاميرا نشطة' : 'متوقفة'}
                </div>
              </div>

              {/* Live Video Preview Box */}
              <div className="relative w-full h-64 bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center mb-5">
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
                    cameraActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-900 text-white">
                    <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mb-3">
                      <Camera className="w-8 h-8 text-blue-400" />
                    </div>
                    <p className="font-bold text-lg mb-1">الكاميرا غير نشطة</p>
                    <p className="text-slate-400 text-sm max-w-sm">
                      قم بتشغيل الكاميرا للتحقق من وضوح الوجه، أو انتقل مباشرة إلى جلسة القراءة
                    </p>
                  </div>
                )}

                {cameraActive && (
                  <div
                    className={`absolute inset-6 md:inset-8 rounded-2xl border-2 pointer-events-none transition-all duration-300 flex items-center justify-center ${
                      pupilFeatures.faceDetected
                        ? 'border-emerald-400/90 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                        : 'border-amber-400/90 border-dashed'
                    }`}
                  >
                    <span className="text-xs font-semibold text-white/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur">
                      {pupilFeatures.faceDetected
                        ? '✓ تم رصد الوجه وحركة العينين'
                        : 'اجلس أمام الكاميرا وثبّت رأسك'}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons & Status */}
              {!cameraActive ? (
                <div className="space-y-3">
                  <button
                    onClick={handleStartCamera}
                    disabled={isStartingCamera}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 text-lg cursor-pointer"
                  >
                    <Camera className="w-6 h-6" />
                    <span>{isStartingCamera ? 'جاري تشغيل الكاميرا...' : 'تشغيل الكاميرا للمعاينة'}</span>
                  </button>
                  <button
                    onClick={handleProceedToReading}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 px-4 rounded-xl transition-colors cursor-pointer text-sm"
                  >
                    متابعة القراءة بدون كاميرا (نمط القراءة والطلاقة الشفهية)
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div
                    className={`p-4 rounded-xl border flex items-center gap-3 transition-colors ${
                      pupilFeatures.faceDetected
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    {pupilFeatures.faceDetected ? (
                      <>
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold text-base">تم رصد الوجه وحركة العينين بنجاح</div>
                          <div className="text-xs text-emerald-700">
                            جاهز للانتقال إلى جلسة قراءة النص مباشرة دون أي خطوات معايرة إضافية
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                        <div>
                          <div className="font-bold text-base">جاري البحث عن معالم الوجه...</div>
                          <div className="text-xs text-amber-700">
                            تأكد من وضوح إضاءة الوجه والجلوس أمام الشاشة
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={handleStopCamera}
                    className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer text-sm"
                  >
                    إيقاف الكاميرا
                  </button>
                </div>
              )}
            </div>

            {/* Direct Proceed to Reading Button */}
            <button
              onClick={handleProceedToReading}
              className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:via-teal-700 hover:to-indigo-700 text-white font-extrabold py-5 px-6 rounded-2xl transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 text-xl cursor-pointer"
            >
              <Sparkles className="w-7 h-7 text-amber-300 animate-pulse" />
              <span>بدء جلسة قراءة النص العربي مباشرة</span>
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STAGE 2: READING STAGE WITH WORD-BY-WORD FOVEAL HIGHLIGHTING
          ========================================================================= */}
      {stage === 'reading' && (
        <div className="max-w-4xl w-full mx-auto p-6 md:p-8 flex flex-col justify-between min-h-screen">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 md:p-12 mt-4">
            {/* Disclaimer pill */}
            <div className="mb-4 inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>مؤشر تتبع استكشافي تجريبي — يُقاس زمن القراءة والارتدادات الاسترشادية</span>
            </div>

            {/* Header & Live Eye-Tracking Word Monitor */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-6 mb-8 gap-4">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-full">
                  جلسة القراءة وتتبع الكلمات
                </span>
                <h2 className="text-3xl font-extrabold text-slate-900 mt-2">
                  القِطَّةُ البَيْضاءُ فِي الحَديقَةِ
                </h2>
              </div>

              {/* Real-time Current Word & Regressions Pill */}
              <div className="flex flex-wrap items-center gap-3">
                {cameraActive && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 px-4 py-2 rounded-2xl shadow-sm">
                    <Eye className="w-5 h-5 text-amber-600 animate-pulse" />
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-amber-800 block">
                        الكلمة المقدرة بالنظر:
                      </span>
                      <span className="text-lg font-black text-amber-950">
                        {currentGazeWordText ? `"${currentGazeWordText}"` : 'اقرأ أول كلمة...'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 px-3 py-2 rounded-2xl text-xs font-bold text-blue-800 text-center">
                  <div>الارتدادات (Regressions)</div>
                  <div className="text-base font-black text-blue-600">{regressionCount}</div>
                </div>
              </div>
            </div>

            {/* Interactive Arabic Reading Passage with Real-Time Word Highlighting */}
            <div
              className="space-y-8 text-right select-none"
              dir="rtl"
              style={{ lineHeight: '3' }}
            >
              {allWords.map((paragraphWords, pIdx) => (
                <p key={pIdx} className="text-2xl md:text-3xl font-semibold text-slate-800">
                  {paragraphWords.map(item => {
                    const isLookedAt = currentGazeWordIndex === item.globalIndex;

                    return (
                      <span
                        key={item.globalIndex}
                        ref={el => {
                          wordRefs.current[item.globalIndex] = el;
                        }}
                        className={`relative inline-block mx-1.5 px-2.5 py-1 rounded-xl transition-all duration-100 ${
                          isLookedAt
                            ? 'bg-amber-300 text-slate-950 font-black scale-110 shadow-[0_0_20px_rgba(251,191,36,0.7)] border-2 border-amber-500 z-30'
                            : 'text-slate-800 hover:text-blue-900'
                        }`}
                      >
                        {item.word}

                        {/* Floating Word Badge indicating active eye gaze */}
                        {isLookedAt && (
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 whitespace-nowrap animate-bounce pointer-events-none">
                            <Eye className="w-3 h-3 text-amber-300" />
                            <span>موضع القراءة</span>
                          </span>
                        )}
                      </span>
                    );
                  })}
                </p>
              ))}
            </div>

            {/* Bottom Centered "Next" Button */}
            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center justify-center">
              <button
                onClick={handleFinishReading}
                className="bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-600 hover:via-teal-700 hover:to-emerald-700 text-white font-extrabold text-2xl py-5 px-14 rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-4"
              >
                <span>إنهاء جلسة القراءة وحفظ النتائج</span>
                <ChevronLeft className="w-8 h-8" />
              </button>
              <p className="text-slate-500 text-sm mt-3 text-center">
                اضغط هنا عند الانتهاء من قراءة النص بالكامل لحفظ زمن القراءة ومؤشرات الأداء
              </p>
            </div>
          </div>

          {/* Real-time Gaze Indicator hovering over text when active */}
          {hasLiveGaze && cameraActive && (
            <div
              className="fixed w-7 h-7 bg-emerald-400/50 border-2 border-emerald-500 rounded-full pointer-events-none z-50 transition-all duration-75 shadow-lg shadow-emerald-500/30"
              style={{
                left: gazePosition.x - 14,
                top: gazePosition.y - 14,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default EyeTrackingLabView;
