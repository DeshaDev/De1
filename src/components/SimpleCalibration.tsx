import React, { useState, useEffect, useRef } from 'react';
import { Target, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import { ImprovedGazeTracker } from '../utils/improvedGazeTracking';
import { PupilFrameFeatures } from '../utils/eyeTrackerEngine';

interface SimpleCalibrationProps {
  pupilFeatures: PupilFrameFeatures;
  onComplete: (tracker: ImprovedGazeTracker) => void;
  onCancel: () => void;
}

// 25-point grid for professional calibration
const CALIBRATION_GRID = [
  // 5x5 grid covering the entire screen
  { id: 1, x: 10, y: 10 }, { id: 2, x: 27.5, y: 10 }, { id: 3, x: 50, y: 10 }, { id: 4, x: 72.5, y: 10 }, { id: 5, x: 90, y: 10 },
  { id: 6, x: 10, y: 27.5 }, { id: 7, x: 27.5, y: 27.5 }, { id: 8, x: 50, y: 27.5 }, { id: 9, x: 72.5, y: 27.5 }, { id: 10, x: 90, y: 27.5 },
  { id: 11, x: 10, y: 50 }, { id: 12, x: 27.5, y: 50 }, { id: 13, x: 50, y: 50 }, { id: 14, x: 72.5, y: 50 }, { id: 15, x: 90, y: 50 },
  { id: 16, x: 10, y: 72.5 }, { id: 17, x: 27.5, y: 72.5 }, { id: 18, x: 50, y: 72.5 }, { id: 19, x: 72.5, y: 72.5 }, { id: 20, x: 90, y: 72.5 },
  { id: 21, x: 10, y: 90 }, { id: 22, x: 27.5, y: 90 }, { id: 23, x: 50, y: 90 }, { id: 24, x: 72.5, y: 90 }, { id: 25, x: 90, y: 90 },
];

const SimpleCalibration: React.FC<SimpleCalibrationProps> = ({
  pupilFeatures,
  onComplete,
  onCancel,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState(2000);
  const [isRecording, setIsRecording] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [message, setMessage] = useState('انظر إلى النقطة الزرقاء');

  const trackerRef = useRef<ImprovedGazeTracker>(new ImprovedGazeTracker());

  const currentPoint = CALIBRATION_GRID[currentIndex];

  // Auto-record after 2 seconds of looking at point
  useEffect(() => {
    if (!pupilFeatures.faceDetected || isRecording) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 50) {
          // Record sample
          const screenX = (currentPoint.x / 100) * window.innerWidth;
          const screenY = (currentPoint.y / 100) * window.innerHeight;

          trackerRef.current.addCalibrationPoint(
            screenX,
            screenY,
            pupilFeatures.combinedNormX,
            pupilFeatures.combinedNormY,
            {
              pitch: 0,
              yaw: 0,
              roll: pupilFeatures.headRollDeg || 0,
            }
          );

          setCompleted(prev => [...prev, currentPoint.id]);
          setIsRecording(false);

          // Move to next point
          if (currentIndex < CALIBRATION_GRID.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setCountdown(2000);
            setMessage('انظر إلى النقطة الزرقاء');
          } else {
            // Calibration complete - build model
            setMessage('جاري بناء نموذج المعايرة...');
            setTimeout(() => {
              const success = trackerRef.current.buildCalibrationModel();
              if (success) {
                const accuracy = trackerRef.current.getAccuracy();
                if (accuracy < 100) {
                  setMessage(`✓ المعايرة مكتملة - الدقة: ${accuracy.toFixed(1)} بكسل`);
                  setTimeout(() => onComplete(trackerRef.current), 1500);
                } else {
                  setMessage('❌ دقة المعايرة منخفضة - أعد المحاولة');
                }
              } else {
                setMessage('❌ فشلت المعايرة - أعد المحاولة');
              }
            }, 500);
          }

          return 2000;
        }
        return prev - 50;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [currentIndex, pupilFeatures, isRecording, currentPoint, onComplete]);

  const progress = ((completed.length) / CALIBRATION_GRID.length) * 100;
  const countdownPercent = ((2000 - countdown) / 2000) * 100;

  return (
    <div className="fixed inset-0 bg-slate-900 z-50">
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-slate-800">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Instructions */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur px-6 py-3 rounded-xl border border-slate-700">
        <p className="text-white text-lg font-semibold">{message}</p>
        <p className="text-slate-400 text-sm mt-1">
          النقطة {currentIndex + 1} من {CALIBRATION_GRID.length}
        </p>
      </div>

      {/* Calibration points */}
      {CALIBRATION_GRID.map((point, idx) => {
        const isActive = idx === currentIndex;
        const isDone = completed.includes(point.id);

        return (
          <div
            key={point.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
            }}
          >
            {isActive ? (
              // Active point with countdown
              <div className="relative">
                <svg width="80" height="80" className="animate-pulse">
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="3"
                    opacity="0.3"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="3"
                    strokeDasharray={`${2 * Math.PI * 35}`}
                    strokeDashoffset={`${2 * Math.PI * 35 * (1 - countdownPercent / 100)}`}
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 bg-blue-500 rounded-full" />
                </div>
              </div>
            ) : isDone ? (
              // Completed point
              <div className="w-8 h-8 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
            ) : (
              // Inactive point
              <div className="w-8 h-8 flex items-center justify-center opacity-30">
                <div className="w-2 h-2 bg-slate-500 rounded-full" />
              </div>
            )}
          </div>
        );
      })}

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-colors"
      >
        إلغاء
      </button>

      {/* Warning if face not detected */}
      {!pupilFeatures.faceDetected && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur px-6 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-white" />
          <span className="text-white font-semibold">لا يمكن رصد وجهك - تأكد من توجيه وجهك للكاميرا</span>
        </div>
      )}
    </div>
  );
};

export default SimpleCalibration;
