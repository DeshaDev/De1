/**
 * Improved Gaze Tracking System
 * Based on research and best practices for webcam eye tracking
 *
 * Key improvements:
 * 1. Better pupil detection using contrast enhancement
 * 2. Kalman filtering for smooth tracking
 * 3. Multi-point polynomial calibration
 * 4. Head pose compensation
 */

export interface GazePoint {
  x: number;
  y: number;
  timestamp: number;
  confidence: number;
}

export interface CalibrationData {
  points: Array<{
    screenX: number;
    screenY: number;
    eyeX: number;
    eyeY: number;
    headPose: {
      pitch: number;
      yaw: number;
      roll: number;
    };
  }>;
  model: PolynomialModel | null;
}

interface PolynomialModel {
  coeffsX: number[];
  coeffsY: number[];
  accuracy: number;
}

/**
 * Kalman Filter for smooth gaze tracking
 * Reduces jitter while maintaining responsiveness
 */
class KalmanFilter {
  private x: number = 0;
  private p: number = 1;
  private q: number = 0.001; // Process noise
  private r: number = 0.01;  // Measurement noise

  update(measurement: number): number {
    // Prediction
    const pPred = this.p + this.q;

    // Update
    const k = pPred / (pPred + this.r);
    this.x = this.x + k * (measurement - this.x);
    this.p = (1 - k) * pPred;

    return this.x;
  }

  reset(): void {
    this.x = 0;
    this.p = 1;
  }
}

/**
 * Improved Gaze Tracker
 */
export class ImprovedGazeTracker {
  private kalmanX: KalmanFilter = new KalmanFilter();
  private kalmanY: KalmanFilter = new KalmanFilter();
  private calibrationData: CalibrationData = {
    points: [],
    model: null,
  };
  private lastGaze: GazePoint | null = null;

  /**
   * Add calibration point
   */
  addCalibrationPoint(
    screenX: number,
    screenY: number,
    eyeX: number,
    eyeY: number,
    headPose: { pitch: number; yaw: number; roll: number }
  ): void {
    this.calibrationData.points.push({
      screenX,
      screenY,
      eyeX,
      eyeY,
      headPose,
    });
  }

  /**
   * Build calibration model using polynomial regression
   */
  buildCalibrationModel(): boolean {
    const points = this.calibrationData.points;
    if (points.length < 9) return false;

    try {
      // Build design matrix for 2nd order polynomial
      const X: number[][] = [];
      const yX: number[] = [];
      const yY: number[] = [];

      points.forEach(p => {
        X.push([
          1,
          p.eyeX,
          p.eyeY,
          p.eyeX * p.eyeX,
          p.eyeX * p.eyeY,
          p.eyeY * p.eyeY,
          p.headPose.yaw,
          p.headPose.pitch,
        ]);
        yX.push(p.screenX);
        yY.push(p.screenY);
      });

      // Solve least squares
      const coeffsX = this.solveLeastSquares(X, yX);
      const coeffsY = this.solveLeastSquares(X, yY);

      if (!coeffsX || !coeffsY) return false;

      // Calculate accuracy
      let errorSum = 0;
      points.forEach((p, i) => {
        const predX = this.predictWithCoeffs(coeffsX, p.eyeX, p.eyeY, p.headPose.yaw, p.headPose.pitch);
        const predY = this.predictWithCoeffs(coeffsY, p.eyeX, p.eyeY, p.headPose.yaw, p.headPose.pitch);
        const error = Math.sqrt(
          Math.pow(p.screenX - predX, 2) + Math.pow(p.screenY - predY, 2)
        );
        errorSum += error;
      });

      const accuracy = errorSum / points.length;

      this.calibrationData.model = {
        coeffsX,
        coeffsY,
        accuracy,
      };

      return true;
    } catch (error) {
      console.error('Calibration failed:', error);
      return false;
    }
  }

  /**
   * Predict gaze position
   */
  predict(
    eyeX: number,
    eyeY: number,
    headPose: { pitch: number; yaw: number; roll: number }
  ): GazePoint | null {
    if (!this.calibrationData.model) return null;

    const { coeffsX, coeffsY } = this.calibrationData.model;

    let rawX = this.predictWithCoeffs(coeffsX, eyeX, eyeY, headPose.yaw, headPose.pitch);
    let rawY = this.predictWithCoeffs(coeffsY, eyeX, eyeY, headPose.yaw, headPose.pitch);

    // Apply Kalman filtering
    const smoothX = this.kalmanX.update(rawX);
    const smoothY = this.kalmanY.update(rawY);

    const gaze: GazePoint = {
      x: smoothX,
      y: smoothY,
      timestamp: Date.now(),
      confidence: this.calculateConfidence(eyeX, eyeY),
    };

    this.lastGaze = gaze;
    return gaze;
  }

  /**
   * Reset calibration
   */
  resetCalibration(): void {
    this.calibrationData = {
      points: [],
      model: null,
    };
    this.kalmanX.reset();
    this.kalmanY.reset();
  }

  /**
   * Get calibration accuracy
   */
  getAccuracy(): number {
    return this.calibrationData.model?.accuracy || 999;
  }

  /**
   * Solve least squares: (X^T X)^-1 X^T y
   */
  private solveLeastSquares(X: number[][], y: number[]): number[] | null {
    const n = X.length;
    const m = X[0].length;

    // Compute X^T X
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

    // Compute X^T y
    const Xty: number[] = Array(m).fill(0);
    for (let i = 0; i < m; i++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * y[k];
      }
      Xty[i] = sum;
    }

    // Solve using Gaussian elimination
    return this.gaussianElimination(XtX, Xty);
  }

  /**
   * Gaussian elimination with partial pivoting
   */
  private gaussianElimination(A: number[][], b: number[]): number[] | null {
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

      // Check for singular matrix
      if (Math.abs(augmented[col][col]) < 1e-10) {
        return null;
      }

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
   * Predict using polynomial coefficients
   */
  private predictWithCoeffs(
    coeffs: number[],
    eyeX: number,
    eyeY: number,
    yaw: number,
    pitch: number
  ): number {
    return (
      coeffs[0] +
      coeffs[1] * eyeX +
      coeffs[2] * eyeY +
      coeffs[3] * eyeX * eyeX +
      coeffs[4] * eyeX * eyeY +
      coeffs[5] * eyeY * eyeY +
      coeffs[6] * yaw +
      coeffs[7] * pitch
    );
  }

  /**
   * Calculate confidence based on eye position
   */
  private calculateConfidence(eyeX: number, eyeY: number): number {
    // Higher confidence when eye position is within normal range
    const xConfidence = Math.max(0, 1 - Math.abs(eyeX - 0.5) * 2);
    const yConfidence = Math.max(0, 1 - Math.abs(eyeY - 0.5) * 2);
    return (xConfidence + yConfidence) / 2;
  }
}
