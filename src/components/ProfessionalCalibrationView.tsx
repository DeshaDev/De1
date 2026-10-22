import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Target,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Eye,
  Crosshair,
  Award,
} from 'lucide-react';
import {
  PROFESSIONAL_CALIBRATION_GRID,
  VALIDATION_POINTS,
  SAMPLES_PER_POINT,
  fitProfessionalCalibrationModel,
  predictGazeWithProfessionalModel,
  validateCalibrationModel,
  getQualityAssessmentArabic,
  CalibrationSample,
  CalibrationModel,
  ValidationResult,
} from '../utils/professionalCalibration';
import { PupilFrameFeatures } from '../utils/eyeTrackerEngine';

interface ProfessionalCalibrationViewProps {
  pupilFeatures: PupilFrameFeatures;
  cameraActive: boolean;
  onCalibrationComplete: (model: CalibrationModel) => void;
  onCancel: () => void;
}

const ProfessionalCalibrationView: React.FC<ProfessionalCalibrationViewProps> = ({
  pupilFeatures,
  cameraActive,
  onCalibrationComplete,
  onCancel,
}) => {
  const [stage, setStage] = useState<'intro' | 'calibrating' | 'validating' | 'results'>('intro');
  const [activePointId, setActivePointId] = useState<number>(1);
  const [samples, setSamples] = useState<CalibrationSample[]>([]);
  const [validationSamples, setValidationSamples] = useState<CalibrationSample[]>([]);
  const [samplesPerPoint, setSamplesPerPoint] = useState<Record<number, number>>({});
  const [currentModel, setCurrentModel] = useState<CalibrationModel | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [warning, setWarning] = useState<string>('');
  const [isEyeStable, setIsEyeStable] = useState<boolean>(false);
  const [dwellProgress, setDwellProgress] = useState<number>(0);
  const DWELL_TARGET_MS = 1400;
  const stableFramesRef = useRef<number>(0);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const recentPupilBuffer = useRef<{ normX: number; normY: number; confidence: number }[]>([]);
  const pupilFeaturesRef = useRef(pupilFeatures);
  pupilFeaturesRef.current = pupilFeatures;

  // Calculate head pose from pupil features (simplified for now)
  const calculateHeadPose = useCallback((): {
    pitch: number;
    yaw: number;
    roll: number;
    distance: number;
  } => {
    const pf = pupilFeaturesRef.current;
    return {
      pitch: 0,
      yaw: 0,
      roll: pf.headRollDeg || 0,
      distance: pf.interOcularPx ? (140 / Math.max(60, pf.interOcularPx)) : 1.0,
    };
  }, []);

  // Track pupil stability
  useEffect(() => {
    if (!cameraActive || !pupilFeatures.faceDetected) {
      recentPupilBuffer.current = [];
      stableFramesRef.current = 0;
      setIsEyeStable((prev) => (prev ? false : prev));
      return;
    }

    // Add to buffer
    recentPupilBuffer.current.push({
      normX: pupilFeatures.combinedNormX,
      normY: pupilFeatures.combinedNormY,
      confidence: pupilFeatures.confidence,
    });

    // Keep last 15 frames
    if (recentPupilBuffer.current.length > 15) {
      recentPupilBuffer.current.shift();
    }

    // Check stability with realistic threshold for webcams
    if (recentPupilBuffer.current.length >= 8) {
      const xValues = recentPupilBuffer.current.map(p => p.normX);
      const yValues = recentPupilBuffer.current.map(p => p.normY);
      const xSpread = Math.max(...xValues) - Math.min(...xValues);
      const ySpread = Math.max(...yValues) - Math.min(...yValues);

      if (xSpread < 0.22 && ySpread < 0.22) {
        stableFramesRef.current = Math.min(stableFramesRef.current + 1, 20);
        const stable = stableFramesRef.current >= 4;
        setIsEyeStable((prev) => (prev !== stable ? stable : prev));
      } else {
        stableFramesRef.current = 0;
        setIsEyeStable((prev) => (prev ? false : prev));
      }
    }
  }, [cameraActive, pupilFeatures]);

  // Sample calibration point
  const handleSamplePoint = useCallback((pointId: number, screenX: number, screenY: number) => {
    const pf = pupilFeaturesRef.current;
    // Get median from buffer or current features
    const buf = recentPupilBuffer.current.slice(-12);
    const medianX = buf.length > 0
      ? buf.map(p => p.normX).sort((a, b) => a - b)[Math.floor(buf.length / 2)]
      : (pf.combinedNormX || 0.5);
    const medianY = buf.length > 0
      ? buf.map(p => p.normY).sort((a, b) => a - b)[Math.floor(buf.length / 2)]
      : (pf.combinedNormY || 0.5);

    const headPose = calculateHeadPose();

    const sample: CalibrationSample = {
      pointId,
      normX: medianX,
      normY: medianY,
      screenX,
      screenY,
      headPitch: headPose.pitch,
      headYaw: headPose.yaw,
      headRoll: headPose.roll,
      headDistance: headPose.distance,
      confidence: pf.confidence || 0.85,
      timestamp: Date.now(),
    };

    setSamples(prev => [...prev, sample]);
    setSamplesPerPoint(prev => ({
      ...prev,
      [pointId]: (prev[pointId] || 0) + 1,
    }));

    // Move to next point
    const currentCount = (samplesPerPoint[pointId] || 0) + 1;
    if (currentCount >= SAMPLES_PER_POINT) {
      const nextPoint = PROFESSIONAL_CALIBRATION_GRID.find(p =>
        (samplesPerPoint[p.id] || 0) < SAMPLES_PER_POINT
      );
      if (nextPoint) {
        setActivePointId(nextPoint.id);
      } else {
        // All calibration points done - move to validation
        setStage('validating');
        setActivePointId(VALIDATION_POINTS[0].id);
      }
    }

    setWarning('');
    recentPupilBuffer.current = [];
    stableFramesRef.current = 0;
    setIsEyeStable(false);
    setDwellProgress(0);
  }, [samplesPerPoint, calculateHeadPose]);

  // Compute final calibration model
  const computeFinalModel = useCallback((valSamples: CalibrationSample[]) => {
    const model = fitProfessionalCalibrationModel(
      samples,
      valSamples,
      window.innerWidth,
      window.innerHeight
    );

    setCurrentModel(model);

    // Validate
    const results = validateCalibrationModel(model, valSamples);
    setValidationResults(results);

    setStage('results');
  }, [samples]);

  // Sample validation point
  const handleSampleValidation = useCallback((pointId: number, screenX: number, screenY: number) => {
    const pf = pupilFeaturesRef.current;
    const buf = recentPupilBuffer.current.slice(-12);
    const medianX = buf.length > 0
      ? buf.map(p => p.normX).sort((a, b) => a - b)[Math.floor(buf.length / 2)]
      : (pf.combinedNormX || 0.5);
    const medianY = buf.length > 0
      ? buf.map(p => p.normY).sort((a, b) => a - b)[Math.floor(buf.length / 2)]
      : (pf.combinedNormY || 0.5);

    const headPose = calculateHeadPose();

    const sample: CalibrationSample = {
      pointId,
      normX: medianX,
      normY: medianY,
      screenX,
      screenY,
      headPitch: headPose.pitch,
      headYaw: headPose.yaw,
      headRoll: headPose.roll,
      headDistance: headPose.distance,
      confidence: pf.confidence || 0.85,
      timestamp: Date.now(),
    };

    setValidationSamples(prev => [...prev, sample]);

    // Move to next validation point
    const currentIndex = VALIDATION_POINTS.findIndex(p => p.id === pointId);
    if (currentIndex < VALIDATION_POINTS.length - 1) {
      setActivePointId(VALIDATION_POINTS[currentIndex + 1].id);
    } else {
      // Validation complete - compute final model
      computeFinalModel([...validationSamples, sample]);
    }

    setWarning('');
    recentPupilBuffer.current = [];
    stableFramesRef.current = 0;
    setIsEyeStable(false);
    setDwellProgress(0);
  }, [validationSamples, calculateHeadPose, computeFinalModel]);

  const handleSamplePointRef = useRef(handleSamplePoint);
  handleSamplePointRef.current = handleSamplePoint;
  const handleSampleValidationRef = useRef(handleSampleValidation);
  handleSampleValidationRef.current = handleSampleValidation;

  // Auto-dwell countdown timer: Automatically samples and advances when gazing at target
  useEffect(() => {
    if (stage !== 'calibrating' && stage !== 'validating') return;
    if (!cameraActive || !pupilFeatures.faceDetected) return;

    setDwellProgress(0);
    const intervalMs = 50;
    let accumulated = 0;

    const timer = window.setInterval(() => {
      accumulated += intervalMs;
      const pct = Math.min(100, Math.round((accumulated / DWELL_TARGET_MS) * 100));
      setDwellProgress(pct);

      if (accumulated >= DWELL_TARGET_MS && pupilFeatures.faceDetected) {
        window.clearInterval(timer);
        const isCalib = stage === 'calibrating';
        const activePt = isCalib
          ? PROFESSIONAL_CALIBRATION_GRID.find((p) => p.id === activePointId)
          : VALIDATION_POINTS.find((p) => p.id === activePointId);

        if (activePt) {
          const screenX = window.innerWidth * (activePt.xPct / 100);
          const screenY = window.innerHeight * (activePt.yPct / 100);
          if (isCalib) {
            handleSamplePointRef.current(activePt.id, screenX, screenY);
          } else {
            handleSampleValidationRef.current(activePt.id, screenX, screenY);
          }
        }
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [activePointId, stage, cameraActive, pupilFeatures.faceDetected]);

  // Spacebar keyboard shortcut to sample point instantly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        const isCalib = stage === 'calibrating';
        const activePt = isCalib
          ? PROFESSIONAL_CALIBRATION_GRID.find((p) => p.id === activePointId)
          : VALIDATION_POINTS.find((p) => p.id === activePointId);

        if (activePt) {
          const screenX = window.innerWidth * (activePt.xPct / 100);
          const screenY = window.innerHeight * (activePt.yPct / 100);
          if (isCalib) {
            handleSamplePointRef.current(activePt.id, screenX, screenY);
          } else {
            handleSampleValidationRef.current(activePt.id, screenX, screenY);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePointId, stage]);

  // Start calibration
  const handleStart = () => {
    if (!cameraActive || !pupilFeatures.faceDetected) {
      setWarning('يرجى تشغيل الكاميرا والتأكد من رصد الوجه أولاً');
      return;
    }
    setStage('calibrating');
    setActivePointId(1);
    setSamples([]);
    setValidationSamples([]);
    setSamplesPerPoint({});
  };

  // Restart calibration
  const handleRestart = () => {
    setStage('intro');
    setSamples([]);
    setValidationSamples([]);
    setSamplesPerPoint({});
    setCurrentModel(null);
    setValidationResults([]);
    setWarning('');
  };

  // Accept calibration
  const handleAccept = () => {
    if (currentModel) {
      onCalibrationComplete(currentModel);
    }
  };

  const renderIntro = () => (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-2xl bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <Target className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">معايرة احترافية</h2>
            <p className="text-slate-400">دقة من الدرجة السريرية - مستوى Lexplore</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg">
            <Award className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-white mb-1">16 نقطة معايرة</h3>
              <p className="text-sm text-slate-400">تغطية كاملة للشاشة لدقة أفضل على الحواف</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg">
            <TrendingUp className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-white mb-1">نموذج متعدد الحدود</h3>
              <p className="text-sm text-slate-400">تعويض ذكي لحركة الرأس والانحراف البصري</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg">
            <Eye className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-white mb-1">تحقق مستقل</h3>
              <p className="text-sm text-slate-400">5 نقاط اختبار منفصلة للتحقق من جودة المعايرة</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-300 mb-2 flex items-center gap-2">
            <Crosshair className="w-4 h-4" />
            نصائح للحصول على أفضل دقة:
          </h4>
          <ul className="text-sm text-blue-200 space-y-1.5 mr-4">
            <li>• اجلس على مسافة 50-70 سم من الشاشة</li>
            <li>• حافظ على رأسك ثابتاً قدر الإمكان</li>
            <li>• تأكد من الإضاءة الجيدة على وجهك</li>
            <li>• انظر مباشرة إلى كل نقطة لمدة ثانية قبل النقر</li>
          </ul>
        </div>

        {warning && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{warning}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleStart}
            disabled={!cameraActive}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-slate-700 disabled:to-slate-800 text-white font-semibold rounded-xl transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            ابدأ المعايرة
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );

  const renderCalibration = () => {
    const points = stage === 'calibrating' ? PROFESSIONAL_CALIBRATION_GRID : VALIDATION_POINTS;
    const activePoint = points.find(p => p.id === activePointId);
    const isCalibrating = stage === 'calibrating';

    const totalPoints = isCalibrating ? PROFESSIONAL_CALIBRATION_GRID.length : VALIDATION_POINTS.length;
    const completedPoints = isCalibrating
      ? Object.keys(samplesPerPoint).filter(k => samplesPerPoint[Number(k)] >= SAMPLES_PER_POINT).length
      : validationSamples.length;
    const progress = (completedPoints / totalPoints) * 100;

    return (
      <div className="relative w-full h-full bg-slate-900" ref={arenaRef}>
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Instructions */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur border border-slate-700 rounded-xl px-6 py-3 shadow-xl z-20">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-sky-400" />
            <div className="text-center">
              <div className="text-xs font-semibold text-sky-300">
                {isCalibrating ? 'المعايرة' : 'التحقق'} - النقطة {completedPoints + 1} من {totalPoints}
              </div>
              <div className="text-base font-bold text-white">
                {activePoint?.label}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                ثبّت نظرك على النقطة (تسجيل تلقائي خلال ثانية)، أو انقر بالماوس / زر المسافة للتسجيل الفوري
              </div>
            </div>
          </div>
        </div>

        {/* Stability indicator */}
        {cameraActive && pupilFeatures.faceDetected && (
          <div className="absolute top-6 right-6 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-xl px-4 py-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isEyeStable ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
              <span className="text-sm text-slate-300">
                {isEyeStable ? 'ثابت - اضغط الآن' : 'ثبّت نظرك...'}
              </span>
            </div>
            <div className="w-32 h-1 bg-slate-700 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${isEyeStable ? 'bg-green-400 w-full' : 'bg-yellow-400 w-1/3'}`}
              />
            </div>
          </div>
        )}

        {/* Warning */}
        {warning && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur border border-red-600 rounded-xl px-6 py-3 shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
              <p className="text-white font-medium">{warning}</p>
            </div>
          </div>
        )}

        {/* Calibration points */}
        {points.map(point => {
          const isActive = point.id === activePointId;
          const samplesCollected = isCalibrating
            ? (samplesPerPoint[point.id] || 0)
            : (validationSamples.filter(s => s.pointId === point.id).length);
          const isComplete = isCalibrating
            ? samplesCollected >= SAMPLES_PER_POINT
            : samplesCollected > 0;

          return (
            <button
              key={point.id}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const screenX = rect.left + rect.width / 2;
                const screenY = rect.top + rect.height / 2;
                if (isCalibrating) {
                  handleSamplePoint(point.id, screenX, screenY);
                } else {
                  handleSampleValidation(point.id, screenX, screenY);
                }
              }}
              disabled={!isActive}
              className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                isActive
                  ? 'w-20 h-20 scale-100'
                  : isComplete
                    ? 'w-8 h-8 scale-75'
                    : 'w-12 h-12 scale-90 opacity-40'
              }`}
              style={{
                left: `${point.xPct}%`,
                top: `${point.yPct}%`,
              }}
            >
              {/* Outer ring */}
              <div
                className={`absolute inset-0 rounded-full transition-all ${
                  isActive
                    ? 'bg-sky-500/20 border-2 border-sky-400'
                    : isComplete
                      ? 'bg-green-500/20 border-2 border-green-400'
                      : 'bg-slate-500/20 border-2 border-slate-500'
                }`}
              />

              {/* Dwell Progress Countdown Ring */}
              {isActive && (
                <svg className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] -rotate-90 pointer-events-none">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="44"
                    stroke="rgba(56, 189, 248, 0.2)"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="44"
                    stroke="#38bdf8"
                    strokeWidth="5"
                    fill="none"
                    strokeDasharray={276}
                    strokeDashoffset={276 - (276 * dwellProgress) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-75"
                  />
                </svg>
              )}

              {/* Inner dot */}
              <div
                className={`absolute inset-0 m-auto w-3.5 h-3.5 rounded-full transition-all ${
                  isActive
                    ? 'bg-sky-400 shadow-lg shadow-sky-400/80 animate-pulse'
                    : isComplete
                      ? 'bg-green-400'
                      : 'bg-slate-500'
                }`}
              />

              {/* Active Point Guidance Tooltip */}
              {isActive && (
                <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/95 text-[11px] font-bold text-sky-300 px-3 py-1 rounded-lg border border-sky-400/50 shadow-xl pointer-events-none z-30">
                  ثبّت نظرك ({Math.round(dwellProgress)}%) أو انقر بالماوس
                </div>
              )}

              {/* Checkmark for completed */}
              {isComplete && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
              )}

              {/* Sample count */}
              {isCalibrating && samplesCollected > 0 && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-400">
                  {samplesCollected}/{SAMPLES_PER_POINT}
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const renderResults = () => {
    if (!currentModel) return null;

    const assessment = getQualityAssessmentArabic(currentModel);
    const gradeColor = {
      excellent: 'from-green-500 to-emerald-500',
      good: 'from-blue-500 to-cyan-500',
      acceptable: 'from-yellow-500 to-orange-500',
      poor: 'from-red-500 to-rose-500',
    }[currentModel.grade];

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-slate-900 to-slate-800 overflow-auto">
        <div className="max-w-3xl w-full bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl">
          {/* Grade badge */}
          <div className="flex justify-center mb-6">
            <div className={`inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r ${gradeColor} rounded-full shadow-lg`}>
              <Award className="w-6 h-6 text-white" />
              <span className="text-xl font-bold text-white">{assessment.title}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-center text-slate-300 mb-8">
            {assessment.description}
          </p>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">خطأ المعايرة</div>
              <div className="text-2xl font-bold text-white">
                {currentModel.calibrationRMSE.toFixed(1)} px
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">خطأ التحقق</div>
              <div className="text-2xl font-bold text-white">
                {currentModel.validationRMSE.toFixed(1)} px
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">متوسط الخطأ</div>
              <div className="text-2xl font-bold text-white">
                {currentModel.meanErrorDeg.toFixed(2)}°
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">أقصى خطأ</div>
              <div className="text-2xl font-bold text-white">
                {currentModel.maxErrorDeg.toFixed(2)}°
              </div>
            </div>
          </div>

          {/* Validation results */}
          {validationResults.length > 0 && (
            <div className="mb-8">
              <h3 className="font-semibold text-white mb-3">نتائج التحقق المستقل:</h3>
              <div className="space-y-2">
                {validationResults.map((result, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-4 py-2">
                    <span className="text-sm text-slate-300">النقطة {idx + 1}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-400">
                        {result.errorPx.toFixed(0)} px / {result.errorDeg.toFixed(2)}°
                      </span>
                      {result.errorPx < 50 ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {assessment.recommendations.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-8">
              <h4 className="font-semibold text-blue-300 mb-2">توصيات للتحسين:</h4>
              <ul className="text-sm text-blue-200 space-y-1.5 mr-4">
                {assessment.recommendations.map((rec, idx) => (
                  <li key={idx}>• {rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleAccept}
              className={`flex-1 px-6 py-3 bg-gradient-to-r ${gradeColor} text-white font-semibold rounded-xl transition-all hover:shadow-lg`}
            >
              قبول المعايرة
            </button>
            <button
              onClick={handleRestart}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة المعايرة
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50">
      {stage === 'intro' && renderIntro()}
      {(stage === 'calibrating' || stage === 'validating') && renderCalibration()}
      {stage === 'results' && renderResults()}
    </div>
  );
};

export default ProfessionalCalibrationView;
