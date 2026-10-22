/**
 * Integration helper for Professional Calibration System
 * Quick setup guide for existing EyeTrackingLabView
 */

import { CalibrationModel as ProfessionalCalibrationModel } from './professionalCalibration';
import { GazeCalibrationModel } from './eyeTrackerEngine';

/**
 * Convert professional model to legacy format for compatibility
 */
export function convertProfessionalToLegacyModel(
  professionalModel: ProfessionalCalibrationModel
): GazeCalibrationModel {
  // Extract linear approximation from polynomial for legacy compatibility
  const centerX = professionalModel.screenWidth / 2;
  const centerY = professionalModel.screenHeight / 2;

  return {
    isCalibrated: true,
    scaleX: professionalModel.screenWidth,
    offsetX: centerX - professionalModel.screenWidth / 2,
    scaleY: professionalModel.screenHeight,
    offsetY: centerY - professionalModel.screenHeight / 2,
    arenaScaleX: 100,
    arenaOffsetX: 0,
    arenaScaleY: 100,
    arenaOffsetY: 0,
    accuracyPercent: Math.max(0, 100 - (professionalModel.validationRMSE / 10)),
    sampleCount: professionalModel.sampleCount,
    validationRmsePx: professionalModel.validationRMSE,
    inSampleRmsePx: professionalModel.calibrationRMSE,
    validationSampleCount: professionalModel.validationCount,
    validationMethod: 'independent-holdout',
    anchors: [],
  };
}

/**
 * Check if professional calibration should be used
 */
export function shouldUseProfessionalCalibration(): boolean {
  // Check if MediaPipe is available (required for head pose)
  const hasMediaPipe = typeof window !== 'undefined' &&
                       'Worker' in window &&
                       navigator.userAgent.indexOf('HeadlessChrome') === -1;

  // Check if screen size is suitable (minimum 1024x768)
  const hasSuitableScreen = typeof window !== 'undefined' &&
                           window.innerWidth >= 1024 &&
                           window.innerHeight >= 768;

  return hasMediaPipe && hasSuitableScreen;
}

/**
 * Get recommended calibration settings based on use case
 */
export function getRecommendedCalibrationSettings(useCase: 'clinical' | 'standard' | 'quick'): {
  pointCount: number;
  samplesPerPoint: number;
  enableHeadPose: boolean;
  enableValidation: boolean;
  description: string;
} {
  switch (useCase) {
    case 'clinical':
      return {
        pointCount: 16,
        samplesPerPoint: 5,
        enableHeadPose: true,
        enableValidation: true,
        description: 'دقة سريرية قصوى - للبحث والتشخيص',
      };
    case 'standard':
      return {
        pointCount: 16,
        samplesPerPoint: 3,
        enableHeadPose: true,
        enableValidation: true,
        description: 'دقة عالية - للاستخدام اليومي',
      };
    case 'quick':
      return {
        pointCount: 9,
        samplesPerPoint: 2,
        enableHeadPose: false,
        enableValidation: false,
        description: 'معايرة سريعة - للاختبار',
      };
  }
}

/**
 * Estimate calibration duration
 */
export function estimateCalibrationDuration(
  pointCount: number,
  samplesPerPoint: number,
  includeValidation: boolean
): number {
  // Average time per sample: 1-2 seconds (looking + clicking)
  const timePerSample = 1.5;

  // Calibration time
  const calibrationSeconds = pointCount * samplesPerPoint * timePerSample;

  // Validation time (5 points)
  const validationSeconds = includeValidation ? 5 * timePerSample : 0;

  // Add buffer for transitions and user reading
  const bufferSeconds = 30;

  return Math.ceil(calibrationSeconds + validationSeconds + bufferSeconds);
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} ثانية`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
  }
  return `${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'} و ${remainingSeconds} ثانية`;
}

/**
 * Example integration code for EyeTrackingLabView.tsx
 */
export const INTEGRATION_EXAMPLE = `
// في EyeTrackingLabView.tsx

import ProfessionalCalibrationView from './ProfessionalCalibrationView';
import {
  CalibrationModel as ProfessionalModel,
  predictGazeWithProfessionalModel
} from '../utils/professionalCalibration';
import {
  calculateHeadPoseFromLandmarks,
  HeadPoseSmoother
} from '../utils/headPoseEstimation';
import {
  convertProfessionalToLegacyModel,
  shouldUseProfessionalCalibration
} from '../utils/calibrationIntegration';

// إضافة state جديد
const [showProfessionalCalibration, setShowProfessionalCalibration] = useState(false);
const [professionalModel, setProfessionalModel] = useState<ProfessionalModel | null>(null);
const headPoseSmoother = useRef(new HeadPoseSmoother());

// معالج اكتمال المعايرة
const handleProfessionalCalibrationComplete = useCallback((model: ProfessionalModel) => {
  setProfessionalModel(model);

  // تحويل للتوافق مع الكود القديم
  const legacyModel = convertProfessionalToLegacyModel(model);
  setCalibrationModel(legacyModel);
  calibrationModelRef.current = legacyModel;

  setShowProfessionalCalibration(false);
}, []);

// في دالة processFrame - بعد استخراج landmarks
if (professionalModel && lastLandmarksRef.current) {
  // حساب وضعية الرأس
  const headPose = calculateHeadPoseFromLandmarks(
    lastLandmarksRef.current,
    width,
    height
  );
  const smoothedHeadPose = headPoseSmoother.current.smooth(headPose);

  // التنبؤ بموقع النظر
  const gaze = predictGazeWithProfessionalModel(
    professionalModel,
    smoothedNormRef.current.x,
    smoothedNormRef.current.y,
    smoothedHeadPose.pitch,
    smoothedHeadPose.yaw
  );

  setGazeScreenPos({
    x: Math.max(16, Math.min(vw - 16, gaze.x)),
    y: Math.max(16, Math.min(vh - 16, gaze.y)),
  });
}

// في JSX - زر لفتح المعايرة الاحترافية
<button
  onClick={() => setShowProfessionalCalibration(true)}
  disabled={!cameraActive}
  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
>
  معايرة احترافية (16 نقطة)
</button>

// عرض واجهة المعايرة
{showProfessionalCalibration && (
  <ProfessionalCalibrationView
    pupilFeatures={pupilFeatures}
    cameraActive={cameraActive}
    onCalibrationComplete={handleProfessionalCalibrationComplete}
    onCancel={() => setShowProfessionalCalibration(false)}
  />
)}
`;
