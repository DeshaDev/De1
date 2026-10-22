/**
 * Professional Eye Tracking Calibration System
 * Manual click-based calibration - Click each point while looking at it
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Target, CheckCircle2, Eye, AlertCircle, MousePointerClick } from 'lucide-react';
import webgazer from 'webgazer';

// Professional 16-point calibration grid
const CALIBRATION_GRID = [
  { id: 1, x: 5, y: 5 },
  { id: 2, x: 25, y: 5 },
  { id: 3, x: 50, y: 5 },
  { id: 4, x: 75, y: 5 },
  { id: 5, x: 95, y: 5 },
  { id: 6, x: 5, y: 30 },
  { id: 7, x: 95, y: 30 },
  { id: 8, x: 5, y: 50 },
  { id: 9, x: 50, y: 50 },
  { id: 10, x: 95, y: 50 },
  { id: 11, x: 5, y: 70 },
  { id: 12, x: 95, y: 70 },
  { id: 13, x: 5, y: 95 },
  { id: 14, x: 25, y: 95 },
  { id: 15, x: 50, y: 95 },
  { id: 16, x: 75, y: 95 },
];

const SAMPLES_PER_POINT = 3;

const ProfessionalEyeTracking: React.FC = () => {
  const [stage, setStage] = useState<'setup' | 'calibrating' | 'reading'>('setup');
  const [cameraActive, setCameraActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [currentPoint, setCurrentPoint] = useState(0);
  const [samplesCollected, setSamplesCollected] = useState<Record<number, number>>({});
  const [calibrationDone, setCalibrationDone] = useState(false);
  const [gazePos, setGazePos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const webgazerReady = useRef(false);
  const faceCheckInterval = useRef<any>(null);

  const readingText = {
    content: [
      'في صباح مشرق، خرجت القطة البيضاء إلى الحديقة الجميلة.',
      'كانت الشمس دافئة والطيور تغرد فوق الأشجار الخضراء.',
      'لعبت القطة مع الفراشات الملونة ثم نامت تحت الشجرة الكبيرة.',
    ],
  };

  const initializeWebGazer = useCallback(async () => {
    try {
      if (webgazerReady.current) return;

      await webgazer
        .setRegression('ridge')
        .setTracker('TFFacemesh')
        .showVideoPreview(true)
        .showPredictionPoints(false)
        .applyKalmanFilter(true)
        .begin();

      webgazerReady.current = true;

      setTimeout(() => {
        const video = document.getElementById('webgazerVideoFeed') as HTMLVideoElement;
        if (video) {
          video.style.position = 'fixed';
          video.style.top = '10px';
          video.style.left = '10px';
          video.style.width = '240px';
          video.style.height = '180px';
          video.style.zIndex = '9999';
          video.style.border = '2px solid #3b82f6';
          video.style.borderRadius = '8px';
        }
      }, 1000);

      setCameraActive(true);
    } catch (error) {
      console.error('WebGazer init error:', error);
      alert('فشل تشغيل الكاميرا');
    }
  }, []);

  useEffect(() => {
    if (!cameraActive) return;

    faceCheckInterval.current = setInterval(() => {
      try {
        const tracker = (webgazer as any).getTracker?.();
        const positions = tracker?.getPositions?.();
        const detected = positions && positions.length > 0;
        setFaceDetected(!!detected);
      } catch (e) {
        setFaceDetected(false);
      }
    }, 200);

    return () => {
      if (faceCheckInterval.current) {
        clearInterval(faceCheckInterval.current);
      }
    };
  }, [cameraActive]);

  const handleStartCalibration = useCallback(() => {
    if (!cameraActive || !faceDetected) {
      alert('يرجى التأكد من تشغيل الكاميرا ورصد الوجه');
      return;
    }

    webgazer.clearData();
    setStage('calibrating');
    setCurrentPoint(0);
    setSamplesCollected({});
    setCalibrationDone(false);
  }, [cameraActive, faceDetected]);

  // Manual click to collect sample
  const handlePointClick = useCallback(() => {
    if (!faceDetected) {
      alert('لا يمكن رصد وجهك - تأكد من النظر للكاميرا');
      return;
    }

    const point = CALIBRATION_GRID[currentPoint];
    const x = (point.x / 100) * window.innerWidth;
    const y = (point.y / 100) * window.innerHeight;

    webgazer.recordScreenPosition(x, y);

    const newSamples = { ...samplesCollected };
    newSamples[point.id] = (newSamples[point.id] || 0) + 1;
    setSamplesCollected(newSamples);

    if (newSamples[point.id] >= SAMPLES_PER_POINT) {
      if (currentPoint < CALIBRATION_GRID.length - 1) {
        setCurrentPoint(currentPoint + 1);
      } else {
        setCalibrationDone(true);
        setTimeout(() => setStage('reading'), 2000);
      }
    }
  }, [currentPoint, samplesCollected, faceDetected]);

  useEffect(() => {
    if (stage !== 'reading') return;

    const interval = setInterval(async () => {
      const prediction = await webgazer.getCurrentPrediction();
      if (prediction && typeof prediction.x === 'number' && typeof prediction.y === 'number') {
        setGazePos({ x: prediction.x, y: prediction.y });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    return () => {
      if (faceCheckInterval.current) clearInterval(faceCheckInterval.current);
    };
  }, []);

  const totalSamples = CALIBRATION_GRID.length * SAMPLES_PER_POINT;
  const collectedSamples = Object.values(samplesCollected).reduce((a, b) => a + b, 0);
  const progress = (collectedSamples / totalSamples) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {stage === 'setup' && (
        <div className="flex items-center justify-center min-h-screen p-8">
          <div className="max-w-2xl w-full bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/20">
            <div className="text-center mb-10">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center mb-6 shadow-2xl">
                <Eye className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-5xl font-black text-white mb-4">
                نظام تتبع العين الاحترافي
              </h1>
              <p className="text-xl text-blue-200">
                معايرة يدوية بدقة عالية - اضغط على كل نقطة أثناء النظر إليها
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-white/5 border-2 border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Camera className="w-7 h-7 text-blue-400" />
                    حالة الكاميرا
                  </h2>
                  <div
                    className={`px-5 py-2 rounded-full text-sm font-black ${
                      cameraActive
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {cameraActive ? '● نشطة' : '○ متوقفة'}
                  </div>
                </div>

                {!cameraActive ? (
                  <button
                    onClick={initializeWebGazer}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-black py-5 px-8 rounded-2xl transition-all shadow-2xl hover:shadow-purple-500/50 flex items-center justify-center gap-3 text-lg"
                  >
                    <Camera className="w-6 h-6" />
                    تشغيل الكاميرا
                  </button>
                ) : (
                  <div
                    className={`p-6 rounded-2xl border-2 ${
                      faceDetected
                        ? 'bg-green-500/20 border-green-400'
                        : 'bg-red-500/20 border-red-400'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {faceDetected ? (
                        <>
                          <CheckCircle2 className="w-8 h-8 text-green-300" />
                          <span className="text-white font-bold text-xl">
                            ✓ تم رصد الوجه بنجاح
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-8 h-8 text-red-300" />
                          <span className="text-white font-bold text-xl">
                            لم يتم رصد الوجه - انظر للكاميرا
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {cameraActive && (
                <button
                  onClick={handleStartCalibration}
                  disabled={!faceDetected}
                  className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black py-6 px-8 rounded-2xl transition-all shadow-2xl hover:shadow-orange-500/50 flex items-center justify-center gap-4 text-xl"
                >
                  <Target className="w-8 h-8" />
                  بدء المعايرة اليدوية (16 نقطة)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {stage === 'calibrating' && (
        <div className="fixed inset-0 bg-black z-50">
          <div className="absolute top-0 left-0 right-0 h-4 bg-slate-900">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl px-10 py-6 rounded-3xl border-2 border-blue-500/50 shadow-2xl">
            <p className="text-white text-3xl font-black text-center">
              {calibrationDone ? (
                <span className="text-green-400 flex items-center gap-3">
                  <CheckCircle2 className="w-10 h-10" />
                  المعايرة مكتملة!
                </span>
              ) : (
                <span className="flex items-center gap-3">
                  <MousePointerClick className="w-10 h-10 text-blue-400" />
                  انظر للنقطة واضغط عليها
                </span>
              )}
            </p>
            <p className="text-slate-300 text-center mt-3 text-lg">
              النقطة {currentPoint + 1} / {CALIBRATION_GRID.length} · التقدم{' '}
              {Math.round(progress)}%
            </p>
          </div>

          {CALIBRATION_GRID.map((point, idx) => {
            const isActive = idx === currentPoint;
            const samples = samplesCollected[point.id] || 0;
            const isComplete = samples >= SAMPLES_PER_POINT;

            return (
              <div
                key={point.id}
                className="absolute transition-all duration-500"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  transform: 'translate(-50%, -50%)',
                  opacity: isActive ? 1 : isComplete ? 0.5 : 0.15,
                  scale: isActive ? 1 : 0.6,
                }}
              >
                {isActive ? (
                  <button
                    onClick={handlePointClick}
                    className="relative cursor-pointer group"
                  >
                    <div className="w-32 h-32 rounded-full border-4 border-blue-400 bg-blue-500/30 group-hover:bg-blue-500/50 transition-all flex items-center justify-center shadow-2xl shadow-blue-500/80 group-hover:scale-110">
                      <div className="w-8 h-8 bg-blue-200 rounded-full" />
                    </div>
                    <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 text-white text-xl font-black bg-slate-900 px-4 py-2 rounded-xl border-2 border-blue-500">
                      {samples}/{SAMPLES_PER_POINT}
                    </div>
                  </button>
                ) : isComplete ? (
                  <CheckCircle2 className="w-12 h-12 text-green-400" />
                ) : (
                  <div className="w-5 h-5 bg-slate-700 rounded-full" />
                )}
              </div>
            );
          })}

          {!faceDetected && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-red-600/95 px-10 py-5 rounded-3xl shadow-2xl animate-pulse">
              <p className="text-white font-black text-2xl flex items-center gap-4">
                <AlertCircle className="w-8 h-8" />
                تحذير: لا يمكن رصد وجهك
              </p>
            </div>
          )}
        </div>
      )}

      {stage === 'reading' && (
        <div className="min-h-screen p-8 flex items-center justify-center">
          <div className="max-w-4xl w-full bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-12">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-4xl font-black text-slate-900">مرحلة القراءة</h2>
              <div className="flex items-center gap-3 bg-green-100 px-6 py-3 rounded-2xl">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
                <span className="text-green-800 font-black text-lg">المعايرة مكتملة</span>
              </div>
            </div>

            <div className="space-y-8 text-right" dir="rtl">
              {readingText.content.map((paragraph, idx) => (
                <p key={idx} className="text-3xl leading-loose text-slate-800 font-semibold">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          <div
            className="fixed w-12 h-12 bg-green-400/50 border-4 border-green-500 rounded-full pointer-events-none z-50 transition-all duration-100 shadow-xl shadow-green-500/50"
            style={{
              left: gazePos.x - 24,
              top: gazePos.y - 24,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ProfessionalEyeTracking;
