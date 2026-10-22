/**
 * Head Pose Estimation from MediaPipe Face Landmarks
 * Calculates pitch, yaw, roll from 3D facial landmarks
 */

export interface HeadPose {
  pitch: number;  // degrees, positive = looking up
  yaw: number;    // degrees, positive = looking right
  roll: number;   // degrees, positive = head tilted right
  distance: number; // normalized distance from camera
}

/**
 * Calculate head pose from MediaPipe 478 landmarks
 * Uses 6 key facial points for robust estimation
 */
export function calculateHeadPoseFromLandmarks(
  landmarks: { x: number; y: number; z?: number }[],
  imageWidth: number,
  imageHeight: number
): HeadPose {
  if (!landmarks || landmarks.length < 478) {
    return { pitch: 0, yaw: 0, roll: 0, distance: 1.0 };
  }

  // Key landmarks for head pose:
  // 1 = nose tip
  // 33 = right eye outer corner
  // 263 = left eye outer corner
  // 61 = right mouth corner
  // 291 = left mouth corner
  // 199 = nose bridge (between eyes)

  const noseTip = landmarks[1];
  const rightEye = landmarks[33];
  const leftEye = landmarks[263];
  const rightMouth = landmarks[61];
  const leftMouth = landmarks[291];
  const noseBridge = landmarks[199];

  // Calculate roll from eye line angle
  const eyeDx = leftEye.x - rightEye.x;
  const eyeDy = leftEye.y - rightEye.y;
  const roll = Math.atan2(eyeDy, eyeDx) * (180 / Math.PI);

  // Calculate yaw from horizontal face asymmetry
  const faceCenter = {
    x: (rightEye.x + leftEye.x) / 2,
    y: (rightEye.y + leftEye.y) / 2,
  };
  const noseOffsetX = noseTip.x - faceCenter.x;
  const faceWidth = Math.abs(leftEye.x - rightEye.x);
  const yaw = (noseOffsetX / faceWidth) * 60; // empirical scaling

  // Calculate pitch from vertical facial geometry
  const eyeLevel = (rightEye.y + leftEye.y) / 2;
  const mouthLevel = (rightMouth.y + leftMouth.y) / 2;
  const faceHeight = mouthLevel - eyeLevel;
  const noseToEyeRatio = (noseTip.y - eyeLevel) / faceHeight;
  const pitch = (noseToEyeRatio - 0.5) * 80; // empirical scaling

  // Estimate distance from interocular distance
  const interocularPx = Math.sqrt(
    Math.pow((leftEye.x - rightEye.x) * imageWidth, 2) +
    Math.pow((leftEye.y - rightEye.y) * imageHeight, 2)
  );
  // Average interocular distance is ~63mm, typical webcam gives ~140px at 60cm
  const normalizedDistance = 140 / Math.max(60, interocularPx);

  return {
    pitch: Math.max(-30, Math.min(30, pitch)),
    yaw: Math.max(-40, Math.min(40, yaw)),
    roll: Math.max(-20, Math.min(20, roll)),
    distance: normalizedDistance,
  };
}

/**
 * Smooth head pose using exponential moving average
 */
export class HeadPoseSmoother {
  private history: HeadPose[] = [];
  private readonly maxHistory = 5;
  private readonly alpha = 0.3; // smoothing factor

  smooth(pose: HeadPose): HeadPose {
    this.history.push(pose);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (this.history.length === 1) {
      return pose;
    }

    // Exponential moving average
    let smoothPitch = this.history[0].pitch;
    let smoothYaw = this.history[0].yaw;
    let smoothRoll = this.history[0].roll;
    let smoothDistance = this.history[0].distance;

    for (let i = 1; i < this.history.length; i++) {
      smoothPitch = this.alpha * this.history[i].pitch + (1 - this.alpha) * smoothPitch;
      smoothYaw = this.alpha * this.history[i].yaw + (1 - this.alpha) * smoothYaw;
      smoothRoll = this.alpha * this.history[i].roll + (1 - this.alpha) * smoothRoll;
      smoothDistance = this.alpha * this.history[i].distance + (1 - this.alpha) * smoothDistance;
    }

    return {
      pitch: smoothPitch,
      yaw: smoothYaw,
      roll: smoothRoll,
      distance: smoothDistance,
    };
  }

  reset(): void {
    this.history = [];
  }
}

/**
 * Check if head pose is within acceptable calibration range
 */
export function isHeadPoseAcceptableForCalibration(pose: HeadPose): {
  acceptable: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (Math.abs(pose.pitch) > 20) {
    issues.push(pose.pitch > 0 ? 'الرأس مائل للأعلى كثيراً' : 'الرأس مائل للأسفل كثيراً');
  }

  if (Math.abs(pose.yaw) > 25) {
    issues.push(pose.yaw > 0 ? 'الرأس متجه لليمين كثيراً' : 'الرأس متجه لليسار كثيراً');
  }

  if (Math.abs(pose.roll) > 15) {
    issues.push('الرأس مائل جانبياً كثيراً');
  }

  if (pose.distance < 0.6) {
    issues.push('قريب جداً من الشاشة - ابتعد قليلاً');
  } else if (pose.distance > 1.5) {
    issues.push('بعيد جداً عن الشاشة - اقترب قليلاً');
  }

  return {
    acceptable: issues.length === 0,
    issues,
  };
}
