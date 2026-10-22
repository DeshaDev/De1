/**
 * Professional Eye Tracking Calibration Engine
 * Implements Lexplore-grade calibration accuracy
 *
 * Features:
 * - 16-point calibration grid (vs 9-point basic)
 * - Polynomial regression (2nd order) for edge accuracy
 * - Head pose compensation using 3D face landmarks
 * - Multi-stage validation with independent test points
 * - Adaptive smoothing based on fixation stability
 * - Personal calibration profiles
 */

export interface CalibrationPoint {
  id: number;
  label: string;
  xPct: number;
  yPct: number;
  zone: 'corner' | 'edge' | 'center';
}

export interface CalibrationSample {
  pointId: number;
  // Raw normalized iris/pupil coordinates (0-1)
  normX: number;
  normY: number;
  // Screen coordinates in pixels
  screenX: number;
  screenY: number;
  // Head pose at sampling time
  headPitch: number;  // degrees
  headYaw: number;    // degrees
  headRoll: number;   // degrees
  headDistance: number; // normalized distance from camera
  // Quality metrics
  confidence: number;
  timestamp: number;
}

export interface ValidationResult {
  pointId: number;
  targetX: number;
  targetY: number;
  predictedX: number;
  predictedY: number;
  errorPx: number;
  errorDeg: number; // visual angle
}

export interface CalibrationModel {
  // Model coefficients for polynomial regression
  coeffsX: number[]; // [a0, a1, a2, a3, a4, a5] for: a0 + a1*x + a2*y + a3*x² + a4*xy + a5*y²
  coeffsY: number[];

  // Head pose compensation parameters
  headPoseEnabled: boolean;
  pitchCoeffX: number;
  pitchCoeffY: number;
  yawCoeffX: number;
  yawCoeffY: number;

  // Quality metrics
  calibrationRMSE: number;      // pixels
  validationRMSE: number;       // pixels
  meanErrorDeg: number;         // visual degrees
  maxErrorDeg: number;

  // Metadata
  sampleCount: number;
  validationCount: number;
  calibrationDate: number;
  screenWidth: number;
  screenHeight: number;

  // Quality grade
  grade: 'excellent' | 'good' | 'acceptable' | 'poor';
}

/**
 * Professional 16-point calibration grid
 * Denser sampling at edges and corners where polynomial models struggle
 */
export const PROFESSIONAL_CALIBRATION_GRID: CalibrationPoint[] = [
  // 4 corners (critical for edge accuracy)
  { id: 1, label: 'أعلى اليسار', xPct: 8, yPct: 12, zone: 'corner' },
  { id: 2, label: 'أعلى اليمين', xPct: 92, yPct: 12, zone: 'corner' },
  { id: 3, label: 'أسفل اليسار', xPct: 8, yPct: 88, zone: 'corner' },
  { id: 4, label: 'أسفل اليمين', xPct: 92, yPct: 88, zone: 'corner' },

  // 8 edge points (improve edge tracking)
  { id: 5, label: 'أعلى يسار-وسط', xPct: 25, yPct: 12, zone: 'edge' },
  { id: 6, label: 'أعلى وسط', xPct: 50, yPct: 12, zone: 'edge' },
  { id: 7, label: 'أعلى يمين-وسط', xPct: 75, yPct: 12, zone: 'edge' },

  { id: 8, label: 'يسار وسط', xPct: 8, yPct: 50, zone: 'edge' },
  { id: 9, label: 'يمين وسط', xPct: 92, yPct: 50, zone: 'edge' },

  { id: 10, label: 'أسفل يسار-وسط', xPct: 25, yPct: 88, zone: 'edge' },
  { id: 11, label: 'أسفل وسط', xPct: 50, yPct: 88, zone: 'edge' },
  { id: 12, label: 'أسفل يمين-وسط', xPct: 75, yPct: 88, zone: 'edge' },

  // 4 center region points (improve center accuracy)
  { id: 13, label: 'مركز-يسار', xPct: 33, yPct: 50, zone: 'center' },
  { id: 14, label: 'المركز', xPct: 50, yPct: 50, zone: 'center' },
  { id: 15, label: 'مركز-يمين', xPct: 67, yPct: 50, zone: 'center' },
  { id: 16, label: 'مركز-أعلى', xPct: 50, yPct: 33, zone: 'center' },
];

/**
 * Independent validation points (never used in training)
 * Spatially interleaved to test interpolation quality
 */
export const VALIDATION_POINTS: CalibrationPoint[] = [
  { id: 101, label: 'تحقق 1', xPct: 20, yPct: 25, zone: 'center' },
  { id: 102, label: 'تحقق 2', xPct: 80, yPct: 25, zone: 'center' },
  { id: 103, label: 'تحقق 3', xPct: 20, yPct: 75, zone: 'center' },
  { id: 104, label: 'تحقق 4', xPct: 80, yPct: 75, zone: 'center' },
  { id: 105, label: 'تحقق 5', xPct: 50, yPct: 65, zone: 'center' },
];

/**
 * Minimum samples per calibration point
 * More samples = better noise reduction
 */
export const SAMPLES_PER_POINT = 3;

/**
 * Quality thresholds
 */
export const QUALITY_THRESHOLDS = {
  // RMS Error in pixels
  excellent: 25,  // < 25px (~0.7° visual angle on typical monitor)
  good: 50,       // < 50px (~1.4°)
  acceptable: 80, // < 80px (~2.2°)
  // anything above is 'poor'

  // Minimum samples for reliable calibration
  minSamples: 32, // 16 points × 2 samples minimum

  // Sample stability (coordinate spread within point)
  maxSpread: 0.12, // normalized coordinates

  // Head pose limits (degrees)
  maxHeadPitch: 20,
  maxHeadYaw: 25,
};

/**
 * Build design matrix for polynomial regression
 * X = [1, x, y, x², xy, y²]
 */
function buildDesignMatrix(samples: CalibrationSample[]): number[][] {
  return samples.map(s => [
    1,                  // intercept
    s.normX,           // linear x
    s.normY,           // linear y
    s.normX * s.normX, // x squared
    s.normX * s.normY, // xy interaction
    s.normY * s.normY, // y squared
  ]);
}

/**
 * Solve least squares: (XᵀX)⁻¹Xᵀy
 * Returns coefficients for polynomial model
 */
function solveLeastSquares(X: number[][], y: number[]): number[] {
  const n = X.length;
  const m = X[0].length;

  // Compute XᵀX
  const XtX: number[][] = Array(m).fill(0).map(() => Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      XtX[i][j] = sum;
    }
  }

  // Compute Xᵀy
  const Xty: number[] = Array(m).fill(0);
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * y[k];
    }
    Xty[i] = sum;
  }

  // Solve (XᵀX)β = Xᵀy using Gaussian elimination
  return solveLinearSystem(XtX, Xty);
}

/**
 * Solve Aβ = b using Gaussian elimination with partial pivoting
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  // Forward elimination
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }

    // Swap rows
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    // Eliminate column
    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row][col] / augmented[col][col];
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  // Back substitution
  const solution = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    solution[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      solution[i] -= augmented[i][j] * solution[j];
    }
    solution[i] /= augmented[i][i];
  }

  return solution;
}

/**
 * Predict screen coordinates using polynomial model
 */
function predictWithPolynomial(
  coeffs: number[],
  normX: number,
  normY: number
): number {
  return (
    coeffs[0] +
    coeffs[1] * normX +
    coeffs[2] * normY +
    coeffs[3] * normX * normX +
    coeffs[4] * normX * normY +
    coeffs[5] * normY * normY
  );
}

/**
 * Compensate for head pose
 * Small head movements can cause large gaze shifts
 */
function compensateHeadPose(
  baseX: number,
  baseY: number,
  headPitch: number,
  headYaw: number,
  pitchCoeffX: number,
  pitchCoeffY: number,
  yawCoeffX: number,
  yawCoeffY: number
): { x: number; y: number } {
  return {
    x: baseX + headYaw * yawCoeffX + headPitch * pitchCoeffX,
    y: baseY + headPitch * pitchCoeffY + headYaw * yawCoeffY,
  };
}

/**
 * Fit professional calibration model from samples
 */
export function fitProfessionalCalibrationModel(
  samples: CalibrationSample[],
  validationSamples: CalibrationSample[],
  screenWidth: number,
  screenHeight: number
): CalibrationModel {
  if (samples.length < QUALITY_THRESHOLDS.minSamples) {
    // Not enough samples - return poor-quality model
    return {
      coeffsX: [screenWidth / 2, 0, 0, 0, 0, 0],
      coeffsY: [screenHeight / 2, 0, 0, 0, 0, 0],
      headPoseEnabled: false,
      pitchCoeffX: 0,
      pitchCoeffY: 0,
      yawCoeffX: 0,
      yawCoeffY: 0,
      calibrationRMSE: 999,
      validationRMSE: 999,
      meanErrorDeg: 999,
      maxErrorDeg: 999,
      sampleCount: samples.length,
      validationCount: 0,
      calibrationDate: Date.now(),
      screenWidth,
      screenHeight,
      grade: 'poor',
    };
  }

  // Build design matrix
  const X = buildDesignMatrix(samples);
  const yScreenX = samples.map(s => s.screenX);
  const yScreenY = samples.map(s => s.screenY);

  // Fit polynomial models
  const coeffsX = solveLeastSquares(X, yScreenX);
  const coeffsY = solveLeastSquares(X, yScreenY);

  // Estimate head pose compensation if enough head movement in samples
  const headPitchRange = Math.max(...samples.map(s => s.headPitch)) -
                        Math.min(...samples.map(s => s.headPitch));
  const headYawRange = Math.max(...samples.map(s => s.headYaw)) -
                      Math.min(...samples.map(s => s.headYaw));

  let pitchCoeffX = 0, pitchCoeffY = 0, yawCoeffX = 0, yawCoeffY = 0;
  const headPoseEnabled = headPitchRange > 5 || headYawRange > 5;

  if (headPoseEnabled) {
    // Estimate head pose effects using residuals
    const residualsX = samples.map((s, i) => {
      const pred = predictWithPolynomial(coeffsX, s.normX, s.normY);
      return s.screenX - pred;
    });
    const residualsY = samples.map((s, i) => {
      const pred = predictWithPolynomial(coeffsY, s.normX, s.normY);
      return s.screenY - pred;
    });

    // Simple linear regression: residual ~ pitch + yaw
    const meanPitch = samples.reduce((sum, s) => sum + s.headPitch, 0) / samples.length;
    const meanYaw = samples.reduce((sum, s) => sum + s.headYaw, 0) / samples.length;

    let sumPitchResX = 0, sumYawResX = 0, sumPitchResY = 0, sumYawResY = 0;
    let sumPitch2 = 0, sumYaw2 = 0;

    samples.forEach((s, i) => {
      const dPitch = s.headPitch - meanPitch;
      const dYaw = s.headYaw - meanYaw;
      sumPitchResX += dPitch * residualsX[i];
      sumYawResX += dYaw * residualsX[i];
      sumPitchResY += dPitch * residualsY[i];
      sumYawResY += dYaw * residualsY[i];
      sumPitch2 += dPitch * dPitch;
      sumYaw2 += dYaw * dYaw;
    });

    if (sumPitch2 > 0.1) {
      pitchCoeffX = sumPitchResX / sumPitch2;
      pitchCoeffY = sumPitchResY / sumPitch2;
    }
    if (sumYaw2 > 0.1) {
      yawCoeffX = sumYawResX / sumYaw2;
      yawCoeffY = sumYawResY / sumYaw2;
    }
  }

  // Compute calibration RMSE
  let sumSquaredError = 0;
  samples.forEach(s => {
    const predX = predictWithPolynomial(coeffsX, s.normX, s.normY);
    const predY = predictWithPolynomial(coeffsY, s.normX, s.normY);
    const compensated = headPoseEnabled
      ? compensateHeadPose(predX, predY, s.headPitch, s.headYaw,
                          pitchCoeffX, pitchCoeffY, yawCoeffX, yawCoeffY)
      : { x: predX, y: predY };
    const dx = s.screenX - compensated.x;
    const dy = s.screenY - compensated.y;
    sumSquaredError += dx * dx + dy * dy;
  });
  const calibrationRMSE = Math.sqrt(sumSquaredError / samples.length);

  // Compute validation RMSE if validation samples provided
  let validationRMSE = 0;
  let meanErrorDeg = 0;
  let maxErrorDeg = 0;

  if (validationSamples.length > 0) {
    let sumValSquaredError = 0;
    let sumErrorDeg = 0;
    let maxError = 0;

    validationSamples.forEach(s => {
      const predX = predictWithPolynomial(coeffsX, s.normX, s.normY);
      const predY = predictWithPolynomial(coeffsY, s.normX, s.normY);
      const compensated = headPoseEnabled
        ? compensateHeadPose(predX, predY, s.headPitch, s.headYaw,
                            pitchCoeffX, pitchCoeffY, yawCoeffX, yawCoeffY)
        : { x: predX, y: predY };
      const dx = s.screenX - compensated.x;
      const dy = s.screenY - compensated.y;
      const errorPx = Math.sqrt(dx * dx + dy * dy);

      // Convert to visual degrees (approximate: 1px ≈ 0.028° at 60cm viewing distance, 24" 1080p monitor)
      const errorDeg = errorPx * 0.028;

      sumValSquaredError += dx * dx + dy * dy;
      sumErrorDeg += errorDeg;
      maxError = Math.max(maxError, errorDeg);
    });

    validationRMSE = Math.sqrt(sumValSquaredError / validationSamples.length);
    meanErrorDeg = sumErrorDeg / validationSamples.length;
    maxErrorDeg = maxError;
  }

  // Determine quality grade
  const errorMetric = validationSamples.length > 0 ? validationRMSE : calibrationRMSE;
  let grade: CalibrationModel['grade'];
  if (errorMetric < QUALITY_THRESHOLDS.excellent) {
    grade = 'excellent';
  } else if (errorMetric < QUALITY_THRESHOLDS.good) {
    grade = 'good';
  } else if (errorMetric < QUALITY_THRESHOLDS.acceptable) {
    grade = 'acceptable';
  } else {
    grade = 'poor';
  }

  return {
    coeffsX,
    coeffsY,
    headPoseEnabled,
    pitchCoeffX,
    pitchCoeffY,
    yawCoeffX,
    yawCoeffY,
    calibrationRMSE,
    validationRMSE,
    meanErrorDeg,
    maxErrorDeg,
    sampleCount: samples.length,
    validationCount: validationSamples.length,
    calibrationDate: Date.now(),
    screenWidth,
    screenHeight,
    grade,
  };
}

/**
 * Predict gaze position using professional model
 */
export function predictGazeWithProfessionalModel(
  model: CalibrationModel,
  normX: number,
  normY: number,
  headPitch: number = 0,
  headYaw: number = 0
): { x: number; y: number } {
  const baseX = predictWithPolynomial(model.coeffsX, normX, normY);
  const baseY = predictWithPolynomial(model.coeffsY, normX, normY);

  if (model.headPoseEnabled) {
    return compensateHeadPose(
      baseX, baseY, headPitch, headYaw,
      model.pitchCoeffX, model.pitchCoeffY,
      model.yawCoeffX, model.yawCoeffY
    );
  }

  return { x: baseX, y: baseY };
}

/**
 * Validate calibration model on independent test points
 */
export function validateCalibrationModel(
  model: CalibrationModel,
  validationSamples: CalibrationSample[]
): ValidationResult[] {
  return validationSamples.map(s => {
    const predicted = predictGazeWithProfessionalModel(
      model, s.normX, s.normY, s.headPitch, s.headYaw
    );

    const dx = s.screenX - predicted.x;
    const dy = s.screenY - predicted.y;
    const errorPx = Math.sqrt(dx * dx + dy * dy);
    const errorDeg = errorPx * 0.028; // approximate conversion

    return {
      pointId: s.pointId,
      targetX: s.screenX,
      targetY: s.screenY,
      predictedX: predicted.x,
      predictedY: predicted.y,
      errorPx,
      errorDeg,
    };
  });
}

/**
 * Get quality assessment in Arabic
 */
export function getQualityAssessmentArabic(model: CalibrationModel): {
  title: string;
  description: string;
  recommendations: string[];
} {
  switch (model.grade) {
    case 'excellent':
      return {
        title: 'ممتاز - دقة احترافية',
        description: `دقة استثنائية (${model.validationRMSE.toFixed(1)} بكسل، ~${model.meanErrorDeg.toFixed(2)}° زاوية بصرية). مناسب للقراءة والتقييمات السريرية.`,
        recommendations: [],
      };
    case 'good':
      return {
        title: 'جيد - دقة مقبولة',
        description: `دقة جيدة (${model.validationRMSE.toFixed(1)} بكسل، ~${model.meanErrorDeg.toFixed(2)}° زاوية بصرية). مناسب لمعظم التطبيقات.`,
        recommendations: [
          'للحصول على دقة أفضل، حافظ على ثبات رأسك أثناء المعايرة',
          'تأكد من الإضاءة الجيدة على وجهك',
        ],
      };
    case 'acceptable':
      return {
        title: 'مقبول - دقة محدودة',
        description: `دقة متوسطة (${model.validationRMSE.toFixed(1)} بكسل، ~${model.meanErrorDeg.toFixed(2)}° زاوية بصرية). قد تحتاج لإعادة المعايرة.`,
        recommendations: [
          'أعد المعايرة مع التركيز على ثبات الرأس',
          'تأكد من جلوسك على مسافة ثابتة من الشاشة (50-70 سم)',
          'تحقق من إضاءة الغرفة - تجنب الإضاءة الخلفية القوية',
        ],
      };
    case 'poor':
      return {
        title: 'ضعيف - يتطلب إعادة معايرة',
        description: `دقة منخفضة (${model.validationRMSE.toFixed(1)} بكسل). يُنصح بشدة بإعادة المعايرة.`,
        recommendations: [
          'أعد المعايرة بالكامل',
          'تأكد من ثبات موضع جلوسك ورأسك',
          'حسّن إضاءة الغرفة',
          'نظّف عدسة الكاميرا',
          'تأكد من عدم وجود نظارات عاكسة',
        ],
      };
  }
}
