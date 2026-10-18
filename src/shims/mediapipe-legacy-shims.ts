/**
 * Lightweight module shim for legacy @mediapipe/face_mesh and @mediapipe/face_detection
 * peer imports inside @tensorflow-models/face-landmarks-detection (used by webgazer).
 * Baseera uses @mediapipe/tasks-vision (FaceLandmarker) directly for 478-point 3D iris tracking,
 * and WebGazer's TFJS runtime (`runtime: 'tfjs'`), so the legacy MediaPipe solution classes
 * only need constructible stubs for Rollup/Vite static bundling in CI.
 */

export const VERSION = '0.4.1633559619';

export class FaceMesh {
  constructor(_config?: Record<string, unknown>) {}
  setOptions(_options: Record<string, unknown>): void {}
  onResults(_listener: (results: unknown) => void): void {}
  async initialize(): Promise<void> {}
  async send(_input: unknown): Promise<void> {}
  async reset(): Promise<void> {}
  async close(): Promise<void> {}
}

export class FaceDetection {
  constructor(_config?: Record<string, unknown>) {}
  setOptions(_options: Record<string, unknown>): void {}
  onResults(_listener: (results: unknown) => void): void {}
  async initialize(): Promise<void> {}
  async send(_input: unknown): Promise<void> {}
  async reset(): Promise<void> {}
  async close(): Promise<void> {}
}

export default {
  VERSION,
  FaceMesh,
  FaceDetection,
};
