import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CheckCircle2,
  Play,
  Pause,
  ArrowLeft,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Mic,
  MicOff,
  Crosshair,
  RefreshCw,
  Target,
  Sliders,
  Eye,
  Globe,
} from 'lucide-react';
import webgazer, {
  WebGazerEyeFeatures,
  WebGazerRegression,
} from 'webgazer';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import {
  ARABIC_READING_PASSAGES,
  ReadingPassage,
  StudentRecord,
} from '../data/seedData';
import {
  WordFixation,
  calculateEyeTrackingMetrics,
} from '../utils/clinicalMetrics';
import { authenticatedFetch } from '../utils/apiAuth';
import {
  extractPupilFeaturesFromFrame,
  computeIrisGazeFromLandmarks,
  fitGazeCalibrationModel,
  predictScreenGaze,
  predictArenaGazePercent,
  hitTestWordBoxes,
  OneEuroFilter,
  BlinkDetectorStateMachine,
  evaluateBlinkRateClinical,
  CalibrationSample,
  GazeCalibrationModel,
  PupilFrameFeatures,
} from '../utils/eyeTrackerEngine';
import {
  ARABIC_DIALECT_PROFILES,
  ArabicDialectCode,
  evaluateOralReadingAlignment,
} from '../utils/dyslexiaEngines';

interface EyeTrackingLabViewProps {
  onCompleteSession: (newRecord: StudentRecord) => void;
  activeStudent?: StudentRecord;
  onProceedToMathLab?: () => void;
}

const CALIBRATION_TARGETS = [
  { id: 1, label: 'أعلى اليمين', xPct: 82, yPct: 20 },
  { id: 2, label: 'أعلى اليسار', xPct: 18, yPct: 20 },
  { id: 3, label: 'المركز البؤري', xPct: 50, yPct: 50 },
  { id: 4, label: 'أسفل اليمين', xPct: 82, yPct: 80 },
  { id: 5, label: 'أسفل اليسار', xPct: 18, yPct: 80 },
];

// Independent held-out validation targets (NEVER used to train affine/RBF calibration weights)
const VALIDATION_TARGETS = [
  { id: 101, label: 'تحقق مستقل V1', xPct: 34, yPct: 35 },
  { id: 102, label: 'تحقق مستقل V2', xPct: 66, yPct: 65 },
];

const SAMPLES_PER_TARGET = 2;

export const EyeTrackingLabView: React.FC<EyeTrackingLabViewProps> = ({
  onCompleteSession,
  activeStudent,
  onProceedToMathLab,
}) => {
  const [studentName, setStudentName] = useState(
    activeStudent?.isDemoRecord ? '' : activeStudent?.name || ''
  );
  const [gradeLevel, setGradeLevel] = useState<number>(
    activeStudent?.gradeLevel || 3
  );

  useEffect(() => {
    if (activeStudent) {
      setStudentName(activeStudent.isDemoRecord ? '' : activeStudent.name);
      setGradeLevel(activeStudent.gradeLevel);
    }
  }, [activeStudent?.id, activeStudent?.name, activeStudent?.gradeLevel]);
  const [selectedDialect, setSelectedDialect] =
    useState<ArabicDialectCode>('gulf');
  const [selectedPassageId, setSelectedPassageId] = useState<string>(
    ARABIC_READING_PASSAGES[0].id
  );
  const [guardianConsent, setGuardianConsent] = useState<boolean>(false);
  const [guardianConsentRecordedAt, setGuardianConsentRecordedAt] = useState<string | undefined>(undefined);
  const [guardianAudioConsent, setGuardianAudioConsent] = useState<boolean>(false);
  const [guardianAudioConsentRecordedAt, setGuardianAudioConsentRecordedAt] = useState<string | undefined>(undefined);
  const [nameError, setNameError] = useState<string>('');
  const [calibrationWarning, setCalibrationWarning] = useState<string>('');
  const [readingCoverageError, setReadingCoverageError] = useState<string>('');

  useEffect(() => {
    setGuardianConsent(false);
    setGuardianConsentRecordedAt(undefined);
    setGuardianAudioConsent(false);
    setGuardianAudioConsentRecordedAt(undefined);
  }, [activeStudent?.id]);

  const [stage, setStage] = useState<'setup' | 'reading' | 'comprehension'>(
    'setup'
  );

  // Real WebGazer.js + MediaPipe 3D Iris State (Zero Simulation)
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const [mediapipeStatus, setMediapipeStatus] = useState<
    'idle' | 'loading' | 'ready' | 'fallback'
  >('idle');
  const [wgRegressionType, setWgRegressionType] = useState<
    'ridge' | 'weightedRidge'
  >('weightedRidge');
  const [wgKalmanEnabled, setWgKalmanEnabled] = useState<boolean>(true);
  const [eyeSensitivity, setEyeSensitivity] = useState<number>(1.35);
  const [binocularZoomEnabled, setBinocularZoomEnabled] =
    useState<boolean>(true);
  const [wgFeatureCount, setWgFeatureCount] = useState<number>(0);
  const [wgRawPrediction, setWgRawPrediction] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [pupilFeatures, setPupilFeatures] = useState<PupilFrameFeatures>({
    leftEye: {
      x: 165,
      y: 110,
      anatomicalX: 165,
      anatomicalY: 110,
      normX: 0.5,
      normY: 0.5,
      rawX: 0.5,
      rawY: 0.5,
      irisRadiusPx: 5.5,
      scleraRatioX: 0,
    },
    rightEye: {
      x: 315,
      y: 110,
      anatomicalX: 315,
      anatomicalY: 110,
      normX: 0.5,
      normY: 0.5,
      rawX: 0.5,
      rawY: 0.5,
      irisRadiusPx: 5.5,
      scleraRatioX: 0,
    },
    leftEyeBox: { x: 135, y: 92, width: 60, height: 34 },
    rightEyeBox: { x: 285, y: 92, width: 60, height: 34 },
    combinedNormX: 0.5,
    combinedNormY: 0.5,
    rawCombinedX: 0.5,
    rawCombinedY: 0.5,
    confidence: 0,
    brightness: 0,
    interOcularPx: 140,
    headRollDeg: 0,
    leftEAR: 0.29,
    rightEAR: 0.29,
    combinedEAR: 0.29,
    isBlinking: false,
    faceDetected: false,
    isVirtualOrBlankFrame: false,
    trackingSource: 'mediapipe-iris',
  });

  // Real-Time Blink Rate & Visual Strain State (Soukupova & Cech 6-Point EAR State Machine)
  const [blinkCount, setBlinkCount] = useState<number>(0);
  const [lastBlinkDurationMs, setLastBlinkDurationMs] = useState<number>(0);
  const [blinkEvents, setBlinkEvents] = useState<
    {
      timestampMs: number;
      durationMs: number;
      wordIndex: number | null;
      earAtMin: number;
    }[]
  >([]);
  const blinkDetectorRef = useRef<BlinkDetectorStateMachine>(
    new BlinkDetectorStateMachine(0.21)
  );

  // Real Multi-Sample Calibration State (Starts at 0/5) + Independent Held-Out Validation Samples
  const [targetClicks, setTargetClicks] = useState<Record<number, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  });
  const [validationClicks, setValidationClicks] = useState<
    Record<number, number>
  >({
    101: 0,
    102: 0,
  });
  const [calibrationSamples, setCalibrationSamples] = useState<
    CalibrationSample[]
  >([]);
  const [validationSamples, setValidationSamples] = useState<
    CalibrationSample[]
  >([]);
  const [isManualDemoMode, setIsManualDemoMode] = useState<boolean>(false);
  const [calibrationModel, setCalibrationModel] =
    useState<GazeCalibrationModel>({
      isCalibrated: false,
      scaleX: 1200,
      offsetX: 100,
      scaleY: 700,
      offsetY: 80,
      arenaScaleX: 100,
      arenaOffsetX: 0,
      arenaScaleY: 100,
      arenaOffsetY: 0,
      accuracyPercent: 0,
      sampleCount: 0,
      validationRmsePx: 0,
      inSampleRmsePx: 0,
      validationSampleCount: 0,
      validationMethod: 'single-point-unvalidated',
      anchors: [],
    });
  const [activeTargetId, setActiveTargetId] = useState<number>(3);

  // Live On-Screen Gaze Cursor (Reticle) & Arena Gaze Dot (%) — Driven 100% by Real Eye Coordinates
  const [showGazeReticle, setShowGazeReticle] = useState<boolean>(true);
  const [gazeScreenPos, setGazeScreenPos] = useState<{ x: number; y: number }>({
    x: 640,
    y: 360,
  });
  const [arenaGazePct, setArenaGazePct] = useState<{
    xPct: number;
    yPct: number;
  }>({
    xPct: 50,
    yPct: 50,
  });

  const smoothedNormRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const oneEuroXRef = useRef<OneEuroFilter>(new OneEuroFilter(1.15, 22.0, 1.0));
  const oneEuroYRef = useRef<OneEuroFilter>(new OneEuroFilter(1.15, 22.0, 1.0));
  const recentPupilBufferRef = useRef<
    { normX: number; normY: number; rawX: number; rawY: number }[]
  >([]);
  const binocularZoomRef = useRef<boolean>(binocularZoomEnabled);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const pupilFeaturesRef = useRef<PupilFrameFeatures>(pupilFeatures);
  const calibrationModelRef = useRef<GazeCalibrationModel>(calibrationModel);
  const eyeSensitivityRef = useRef<number>(eyeSensitivity);

  // Real WebGazer.js Regressor instance (RidgeReg / RidgeWeightedReg) & latest 120-feature Eye Patches
  const wgRegressorRef = useRef<WebGazerRegression | null>(null);
  const latestEyePatchesRef = useRef<WebGazerEyeFeatures | null>(null);

  // Neutral Eye Baseline (Locked once on camera startup or when user clicks Recenter / Center Point 3)
  const eyeBaselineRef = useRef<{
    x: number;
    y: number;
    initialized: boolean;
    warmupSamples: { x: number; y: number }[];
  }>({
    x: 0.5,
    y: 0.5,
    initialized: false,
    warmupSamples: [],
  });

  const lastLandmarksRef = useRef<{ x: number; y: number; z?: number }[] | null>(
    null
  );
  const missedFaceFramesRef = useRef<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftPatchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightPatchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const calibrationArenaRef = useRef<HTMLDivElement | null>(null);
  const targetButtonsRef = useRef<Record<number, HTMLButtonElement | null>>({});
  const streamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const rafRef = useRef<number | null>(null);

  // Reading Session State (Starts at 0ms, 0 visits, and 0 blinks for all words!)
  const [isReadingActive, setIsReadingActive] = useState<boolean>(true);
  const [activeWordIdx, setActiveWordIdx] = useState<number | null>(null);
  const activeWordIdxRef = useRef<number | null>(null);
  const stageRef = useRef<'setup' | 'reading' | 'comprehension'>(stage);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [wordStats, setWordStats] = useState<
    Record<
      number,
      {
        durationMs: number;
        visits: number;
        regressedFromIndex?: number;
        blinks?: number;
      }
    >
  >({});
  const [, setGazeTrail] = useState<
    { fromIdx: number; toIdx: number; isRegression: boolean }[]
  >([]);
  const lastFixatedWordRef = useRef<number | null>(null);
  const wordElementsRef = useRef<Record<number, HTMLSpanElement | null>>({});

  // Real Microphone & Speech Recognition State
  const [micActive, setMicActive] = useState<boolean>(false);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [spokenTranscript, setSpokenTranscript] = useState<string>('');
  const [speechRecognitionUsed, setSpeechRecognitionUsed] = useState<boolean>(false);
  const [isTranscriptPreset, setIsTranscriptPreset] = useState<boolean>(false);
  const [speechRecStatus, setSpeechRecStatus] = useState<
    'idle' | 'listening' | 'unsupported' | 'error'
  >('idle');
  const [speechRecErrorMsg, setSpeechRecErrorMsg] = useState<string>('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  // Comprehension answers
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [comprehensionError, setComprehensionError] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const selectedPassage: ReadingPassage =
    ARABIC_READING_PASSAGES.find((p) => p.id === selectedPassageId) ||
    ARABIC_READING_PASSAGES[0];

  const selectedDialectProfile =
    ARABIC_DIALECT_PROFILES.find((d) => d.code === selectedDialect) ||
    ARABIC_DIALECT_PROFILES[1];

  useEffect(() => {
    activeWordIdxRef.current = activeWordIdx;
  }, [activeWordIdx]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    pupilFeaturesRef.current = pupilFeatures;
  }, [pupilFeatures]);

  useEffect(() => {
    calibrationModelRef.current = calibrationModel;
  }, [calibrationModel]);

  useEffect(() => {
    eyeSensitivityRef.current = eyeSensitivity;
  }, [eyeSensitivity]);

  useEffect(() => {
    binocularZoomRef.current = binocularZoomEnabled;
  }, [binocularZoomEnabled]);

  // Trigger or record a blink event (called automatically by 6-Point EAR State Machine or interactively for clinical testing)
  const handleRecordManualBlink = useCallback(
    (targetWordIdx?: number | null) => {
      const wordIdxToCredit =
        targetWordIdx !== undefined
          ? targetWordIdx
          : activeWordIdxRef.current ?? lastFixatedWordRef.current;
      const ev = blinkDetectorRef.current.recordManualBlink(
        performance.now(),
        wordIdxToCredit ?? null
      );
      setBlinkCount(blinkDetectorRef.current.getBlinkCount());
      setLastBlinkDurationMs(ev.durationMs);
      setBlinkEvents([...blinkDetectorRef.current.getBlinkEvents()]);

      if (typeof wordIdxToCredit === 'number' && wordIdxToCredit >= 0) {
        setWordStats((prev) => {
          const existing = prev[wordIdxToCredit] || {
            durationMs: 210,
            visits: 1,
            blinks: 0,
          };
          return {
            ...prev,
            [wordIdxToCredit]: {
              ...existing,
              blinks: (existing.blinks || 0) + 1,
            },
          };
        });
      }
    },
    []
  );

  // Initialize WebGazer.js Regression Engine (RidgeReg / RidgeWeightedReg) & Kalman Filter
  useEffect(() => {
    try {
      (window as any).webgazer = webgazer;
      webgazer.params.applyKalmanFilter = wgKalmanEnabled;
      webgazer.params.saveDataAcrossSessions = false;
      webgazer.params.showVideoPreview = false;
      webgazer.params.showGazeDot = false;

      const existingData = wgRegressorRef.current
        ? wgRegressorRef.current.getData()
        : [];
      const regInstance =
        wgRegressionType === 'weightedRidge'
          ? new webgazer.reg.RidgeWeightedReg()
          : new webgazer.reg.RidgeReg();

      if (existingData && existingData.length > 0) {
        regInstance.setData(existingData);
      }
      wgRegressorRef.current = regInstance;
      webgazer.setRegression(wgRegressionType);
    } catch {}
  }, [wgRegressionType, wgKalmanEnabled]);

  // Recenter neutral eye baseline at user's current real pupil position
  const handleRecenterEyeBaseline = useCallback(() => {
    const currentRawX = pupilFeaturesRef.current.rawCombinedX;
    const currentRawY = pupilFeaturesRef.current.rawCombinedY;
    if (
      typeof currentRawX === 'number' &&
      typeof currentRawY === 'number' &&
      !Number.isNaN(currentRawX) &&
      !Number.isNaN(currentRawY)
    ) {
      eyeBaselineRef.current = {
        x: currentRawX,
        y: currentRawY,
        initialized: true,
        warmupSamples: [],
      };
      smoothedNormRef.current = { x: 0.5, y: 0.5 };
      setArenaGazePct({ xPct: 50, yPct: 50 });
    }
  }, []);

  // Spacebar shortcut to recenter neutral pupil axis while looking at center of screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleRecenterEyeBaseline();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRecenterEyeBaseline]);

  // Enumerate available video input devices
  const refreshCameraDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setCameraDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        const physicalCam = videoInputs.find(
          (d) =>
            d.label &&
            !/virtual|obs|manycam|snap|vcam|placeholder/i.test(d.label)
        );
        setSelectedDeviceId(
          physicalCam ? physicalCam.deviceId : videoInputs[0].deviceId
        );
      }
    } catch {}
  }, [selectedDeviceId]);

  useEffect(() => {
    refreshCameraDevices();
  }, [refreshCameraDevices]);

  // Initialize MediaPipe FaceLandmarker (478 3D Landmarks + Iris Tracking) using local /mediapipe-wasm v1.1.1
  const ensureFaceLandmarker = useCallback(async () => {
    if (faceLandmarkerRef.current) return faceLandmarkerRef.current;
    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    if (isHeadless) {
      setMediapipeStatus('fallback');
      return null;
    }

    setMediapipeStatus('loading');
    const modelUrl =
      'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

    const loadWithWasmRoot = async (
      wasmRoot: string,
      delegate: 'GPU' | 'CPU'
    ) => {
      const vision = await FilesetResolver.forVisionTasks(wasmRoot);
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate,
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    };

    const wasmRoots = [
      '/mediapipe-wasm',
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm',
    ];

    for (const wasmRoot of wasmRoots) {
      for (const delegate of ['GPU', 'CPU'] as const) {
        try {
          const landmarker = await loadWithWasmRoot(wasmRoot, delegate);
          faceLandmarkerRef.current = landmarker;
          setMediapipeStatus('ready');
          return landmarker;
        } catch {
          // Try next delegate / WASM root
        }
      }
    }

    setMediapipeStatus('fallback');
    return null;
  }, []);

  /**
   * Extracts real WebGazerEyeFeatures (tight left & right palpebral ImageData patches)
   * from the live webcam canvas and renders them into the dual magnified Eye-Patch canvases
   * with a precision green reticle directly on the user's real pupil.
   */
  const extractAndRenderWebGazerPatches = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      canvasWidth: number,
      canvasHeight: number,
      features: PupilFrameFeatures
    ): WebGazerEyeFeatures | null => {
      const clampBox = (box: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => {
        const x = Math.max(0, Math.min(canvasWidth - 12, Math.floor(box.x)));
        const y = Math.max(0, Math.min(canvasHeight - 10, Math.floor(box.y)));
        const w = Math.max(12, Math.min(canvasWidth - x, Math.floor(box.width)));
        const h = Math.max(
          8,
          Math.min(canvasHeight - y, Math.floor(box.height))
        );
        return { x, y, width: w, height: h };
      };

      const lBox = clampBox(features.leftEyeBox);
      const rBox = clampBox(features.rightEyeBox);

      try {
        const leftPatch = ctx.getImageData(
          lBox.x,
          lBox.y,
          lBox.width,
          lBox.height
        );
        const rightPatch = ctx.getImageData(
          rBox.x,
          rBox.y,
          rBox.width,
          rBox.height
        );

        const wgEyes: WebGazerEyeFeatures = {
          left: {
            patch: leftPatch,
            imagex: lBox.x,
            imagey: lBox.y,
            width: lBox.width,
            height: lBox.height,
          },
          right: {
            patch: rightPatch,
            imagex: rBox.x,
            imagey: rBox.y,
            width: rBox.width,
            height: rBox.height,
          },
        };

        // Render magnified eye patch with exact pupil reticle locked onto anatomicalX / anatomicalY
        const renderPatchPreview = (
          patchCanvas: HTMLCanvasElement | null,
          patchData: ImageData,
          box: { x: number; y: number; width: number; height: number },
          eye: { anatomicalX: number; anatomicalY: number; normX: number; normY: number }
        ) => {
          if (!patchCanvas) return;
          const pCtx = patchCanvas.getContext('2d');
          if (!pCtx) return;

          const temp = document.createElement('canvas');
          temp.width = patchData.width;
          temp.height = patchData.height;
          temp.getContext('2d')?.putImageData(patchData, 0, 0);

          pCtx.clearRect(0, 0, patchCanvas.width, patchCanvas.height);
          pCtx.drawImage(
            temp,
            0,
            0,
            patchData.width,
            patchData.height,
            0,
            0,
            patchCanvas.width,
            patchCanvas.height
          );

          // Exact pupil position inside the tight eye box
          const relPupilX = Math.max(
            0.08,
            Math.min(0.92, (eye.anatomicalX - box.x) / Math.max(1, box.width))
          );
          const relPupilY = Math.max(
            0.12,
            Math.min(0.88, (eye.anatomicalY - box.y) / Math.max(1, box.height))
          );

          const px = relPupilX * patchCanvas.width;
          const py = relPupilY * patchCanvas.height;

          // Draw outer cyan iris ring
          pCtx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
          pCtx.lineWidth = 1.25;
          pCtx.beginPath();
          pCtx.arc(px, py, 7, 0, Math.PI * 2);
          pCtx.stroke();

          // Draw precision green pupil crosshair
          pCtx.strokeStyle = '#10B981';
          pCtx.lineWidth = 1.5;
          pCtx.beginPath();
          pCtx.arc(px, py, 3.5, 0, Math.PI * 2);
          pCtx.moveTo(px - 10, py);
          pCtx.lineTo(px + 10, py);
          pCtx.moveTo(px, py - 10);
          pCtx.lineTo(px, py + 10);
          pCtx.stroke();

          pCtx.fillStyle = '#10B981';
          pCtx.beginPath();
          pCtx.arc(px, py, 2, 0, Math.PI * 2);
          pCtx.fill();
        };

        renderPatchPreview(
          leftPatchCanvasRef.current,
          leftPatch,
          lBox,
          features.leftEye
        );
        renderPatchPreview(
          rightPatchCanvasRef.current,
          rightPatch,
          rBox,
          features.rightEye
        );

        return wgEyes;
      } catch {
        return null;
      }
    },
    []
  );

  // Real-Time WebGazer.js + MediaPipe 478 Iris & Dark-Pupil + Blink Rate (EAR) Frame Processor
  const startOpticalLoop = useCallback(() => {
    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    let lastFrameTime = 0;

    const processFrame = (now: number) => {
      const minInterval = isHeadless ? 80 : 28;
      if (now - lastFrameTime >= minInterval) {
        lastFrameTime = now;
        const canvas = canvasRef.current;
        const video = videoRef.current;

        if (canvas) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const width = canvas.width;
          const height = canvas.height;

          if (!offscreenCanvasRef.current) {
            offscreenCanvasRef.current = document.createElement('canvas');
          }
          const offCanvas = offscreenCanvasRef.current;
          if (offCanvas.width !== width || offCanvas.height !== height) {
            offCanvas.width = width;
            offCanvas.height = height;
          }
          const offCtx = offCanvas.getContext('2d', {
            willReadFrequently: true,
          });

          if (ctx && offCtx) {
            let extracted: PupilFrameFeatures | null = null;
            const hasLiveVideo =
              video &&
              video.readyState >= 2 &&
              video.videoWidth > 0 &&
              Boolean(streamRef.current);

            if (hasLiveVideo && video) {
              // 1. Draw mirrored live webcam frame onto the full-resolution offscreen buffer
              offCtx.save();
              offCtx.scale(-1, 1);
              offCtx.drawImage(video, -width, 0, width, height);
              offCtx.restore();

              const frameImgData = offCtx.getImageData(0, 0, width, height);

              // 2. MediaPipe 478-landmark 3D Iris + Glint-Rejected Dark-Pupil Core + Scleral Reflectance + 6-Point EAR
              if (faceLandmarkerRef.current) {
                try {
                  if (video.currentTime !== lastVideoTimeRef.current) {
                    lastVideoTimeRef.current = video.currentTime;
                    const mpResult = faceLandmarkerRef.current.detectForVideo(
                      video,
                      performance.now()
                    );
                    if (
                      mpResult.faceLandmarks &&
                      mpResult.faceLandmarks.length > 0
                    ) {
                      lastLandmarksRef.current = mpResult.faceLandmarks[0];
                      missedFaceFramesRef.current = 0;
                    } else {
                      missedFaceFramesRef.current += 1;
                      if (missedFaceFramesRef.current > 8) {
                        lastLandmarksRef.current = null;
                      }
                    }
                  }

                  if (lastLandmarksRef.current) {
                    const lm = lastLandmarksRef.current;

                    const rawProbe = computeIrisGazeFromLandmarks(
                      lm,
                      width,
                      height,
                      {
                        baselineX: eyeBaselineRef.current.x,
                        baselineY: eyeBaselineRef.current.y,
                        sensitivity: eyeSensitivityRef.current,
                        rgba: frameImgData.data,
                      }
                    );

                    // Lock initial neutral baseline ONLY once on the first 5 frames when camera starts
                    if (rawProbe && !eyeBaselineRef.current.initialized) {
                      eyeBaselineRef.current.warmupSamples.push({
                        x: rawProbe.rawCombinedX,
                        y: rawProbe.rawCombinedY,
                      });
                      if (eyeBaselineRef.current.warmupSamples.length >= 5) {
                        const samples = eyeBaselineRef.current.warmupSamples;
                        const avgX =
                          samples.reduce((s, p) => s + p.x, 0) /
                          samples.length;
                        const avgY =
                          samples.reduce((s, p) => s + p.y, 0) /
                          samples.length;
                        eyeBaselineRef.current = {
                          x: avgX,
                          y: avgY,
                          initialized: true,
                          warmupSamples: [],
                        };
                      } else {
                        eyeBaselineRef.current.x = rawProbe.rawCombinedX;
                        eyeBaselineRef.current.y = rawProbe.rawCombinedY;
                      }
                    }

                    extracted = computeIrisGazeFromLandmarks(lm, width, height, {
                      baselineX:
                        calibrationModelRef.current.empiricalRawCenterX ??
                        eyeBaselineRef.current.x,
                      baselineY:
                        calibrationModelRef.current.empiricalRawCenterY ??
                        eyeBaselineRef.current.y,
                      spanX: calibrationModelRef.current.empiricalRawSpanX,
                      spanY: calibrationModelRef.current.empiricalRawSpanY,
                      sensitivity: eyeSensitivityRef.current,
                      rgba: frameImgData.data,
                    });

                    // Draw subtle cyan eyelid & iris contour landmarks on the full buffer
                    offCtx.fillStyle = 'rgba(56, 189, 248, 0.85)';
                    [469, 470, 471, 472, 474, 475, 476, 477].forEach((idx) => {
                      if (lm[idx]) {
                        offCtx.beginPath();
                        offCtx.arc(
                          (1 - lm[idx].x) * width,
                          lm[idx].y * height,
                          1.4,
                          0,
                          Math.PI * 2
                        );
                        offCtx.fill();
                      }
                    });
                  }
                } catch {}
              }

              // 3. Fallback to pixel-level dark-pupil core detector if MediaPipe is still loading
              if (!extracted) {
                const rawProbe = extractPupilFeaturesFromFrame(
                  frameImgData.data,
                  width,
                  height,
                  {
                    baselineX: eyeBaselineRef.current.x,
                    baselineY: eyeBaselineRef.current.y,
                    sensitivity: eyeSensitivityRef.current,
                  }
                );
                if (!eyeBaselineRef.current.initialized && rawProbe.faceDetected) {
                  eyeBaselineRef.current.x = rawProbe.rawCombinedX;
                  eyeBaselineRef.current.y = rawProbe.rawCombinedY;
                  eyeBaselineRef.current.initialized = true;
                }
                extracted = extractPupilFeaturesFromFrame(
                  frameImgData.data,
                  width,
                  height,
                  {
                    baselineX: eyeBaselineRef.current.x,
                    baselineY: eyeBaselineRef.current.y,
                    sensitivity: eyeSensitivityRef.current,
                  }
                );
              }

              if (extracted) {
                // 3b. Process 6-Point Eye Aspect Ratio (EAR) through BlinkDetectorStateMachine
                const blinkResult = blinkDetectorRef.current.processFrame(
                  extracted.combinedEAR ?? 0.28,
                  now,
                  extracted.faceDetected,
                  activeWordIdxRef.current
                );
                if (blinkResult.completedBlink) {
                  const completed = blinkResult.completedBlink;
                  setBlinkCount(blinkDetectorRef.current.getBlinkCount());
                  setLastBlinkDurationMs(completed.durationMs);
                  setBlinkEvents([...blinkDetectorRef.current.getBlinkEvents()]);
                  const wIdx =
                    completed.wordIndex ??
                    activeWordIdxRef.current ??
                    lastFixatedWordRef.current;
                  if (
                    stageRef.current === 'reading' &&
                    typeof wIdx === 'number' &&
                    wIdx >= 0
                  ) {
                    setWordStats((prev) => {
                      const existing = prev[wIdx] || {
                        durationMs: 50,
                        visits: 1,
                        blinks: 0,
                      };
                      return {
                        ...prev,
                        [wIdx]: {
                          ...existing,
                          blinks: (existing.blinks || 0) + 1,
                        },
                      };
                    });
                  }
                }

                // 4. Extract real WebGazer 120-pixel equalized eye patches BEFORE drawing HUD overlays
                const wgEyes = extractAndRenderWebGazerPatches(
                  offCtx,
                  width,
                  height,
                  extracted
                );
                if (wgEyes) {
                  latestEyePatchesRef.current = wgEyes;
                  try {
                    const feats = webgazer.util.getEyeFeats(wgEyes);
                    setWgFeatureCount(feats ? feats.length : 120);
                  } catch {
                    setWgFeatureCount(120);
                  }
                }

                // 5. Filter normalized pupil/foveal coordinates via adaptive 1€ Filter (Casiez et al.)
                // Ignore coordinate jumps during active eyelid closure (isBlinking) so blinks don't cause false vertical saccades
                const filteredX = extracted.isBlinking
                  ? smoothedNormRef.current.x
                  : oneEuroXRef.current.filter(extracted.combinedNormX, now);
                const filteredY = extracted.isBlinking
                  ? smoothedNormRef.current.y
                  : oneEuroYRef.current.filter(extracted.combinedNormY, now);
                smoothedNormRef.current = {
                  x: filteredX,
                  y: filteredY,
                };

                // Push into rolling 4-frame stabilization buffer for blink/tremor-resistant calibration clicks
                if (!extracted.isBlinking) {
                  recentPupilBufferRef.current.push({
                    normX: filteredX,
                    normY: filteredY,
                    rawX: extracted.rawCombinedX,
                    rawY: extracted.rawCombinedY,
                  });
                  if (recentPupilBufferRef.current.length > 4) {
                    recentPupilBufferRef.current.shift();
                  }
                }

                setPupilFeatures(extracted);

                // Draw tight WebGazer Eye-Patch Bounding Boxes on the offscreen frame
                offCtx.strokeStyle = extracted.isBlinking
                  ? 'rgba(245, 158, 11, 0.95)'
                  : extracted.trackingSource === 'mediapipe-iris'
                    ? 'rgba(56, 189, 248, 0.85)'
                    : 'rgba(245, 158, 11, 0.75)';
                offCtx.lineWidth = extracted.isBlinking ? 2.2 : 1.4;
                offCtx.strokeRect(
                  extracted.leftEyeBox.x,
                  extracted.leftEyeBox.y,
                  extracted.leftEyeBox.width,
                  extracted.leftEyeBox.height
                );
                offCtx.strokeRect(
                  extracted.rightEyeBox.x,
                  extracted.rightEyeBox.y,
                  extracted.rightEyeBox.width,
                  extracted.rightEyeBox.height
                );

                // Draw High-Precision Visual Pupil Indicator locked directly onto the user's real pupil
                const drawPrecisionPupilIndicator = (pt: {
                  x: number;
                  y: number;
                  anatomicalX: number;
                  anatomicalY: number;
                  irisRadiusPx?: number;
                }) => {
                  const px = pt.anatomicalX;
                  const py = pt.anatomicalY;
                  const r = Math.max(4.2, pt.irisRadiusPx ?? 5.5);

                  // 1. Exact Iris boundary ring centered on the real pupil
                  offCtx.strokeStyle = 'rgba(56, 189, 248, 0.92)';
                  offCtx.lineWidth = 1.4;
                  offCtx.beginPath();
                  offCtx.arc(px, py, r, 0, Math.PI * 2);
                  offCtx.stroke();

                  // 2. Precision green crosshair & center dot locked directly onto the pupil center (px, py)
                  offCtx.strokeStyle = '#10B981';
                  offCtx.lineWidth = 1.6;
                  offCtx.beginPath();
                  offCtx.moveTo(px - (r + 4), py);
                  offCtx.lineTo(px + (r + 4), py);
                  offCtx.moveTo(px, py - (r + 4));
                  offCtx.lineTo(px, py + (r + 4));
                  offCtx.stroke();

                  offCtx.fillStyle = '#10B981';
                  offCtx.beginPath();
                  offCtx.arc(px, py, 2.5, 0, Math.PI * 2);
                  offCtx.fill();

                  // 3. Gaze direction vector arrow from real pupil (px, py) to projected gaze vector (pt.x, pt.y)
                  if (Math.hypot(pt.x - px, pt.y - py) > 1.2) {
                    offCtx.strokeStyle = '#34D399';
                    offCtx.lineWidth = 1.8;
                    offCtx.beginPath();
                    offCtx.moveTo(px, py);
                    offCtx.lineTo(pt.x, pt.y);
                    offCtx.stroke();

                    offCtx.fillStyle = '#34D399';
                    offCtx.beginPath();
                    offCtx.arc(pt.x, pt.y, 2.6, 0, Math.PI * 2);
                    offCtx.fill();
                  }
                };

                drawPrecisionPupilIndicator(extracted.leftEye);
                drawPrecisionPupilIndicator(extracted.rightEye);

                // Render either 2.4x Binocular Foveal ROI Zoom or 1x Full Frame onto visible canvasRef
                ctx.clearRect(0, 0, width, height);
                if (
                  binocularZoomRef.current &&
                  extracted.binocularRoiBox &&
                  extracted.faceDetected
                ) {
                  const roi = extracted.binocularRoiBox;
                  const sx = Math.max(0, Math.min(width - 40, roi.x));
                  const sy = Math.max(0, Math.min(height - 24, roi.y));
                  const sw = Math.max(60, Math.min(width - sx, roi.width));
                  const sh = Math.max(32, Math.min(height - sy, roi.height));
                  ctx.drawImage(offCanvas, sx, sy, sw, sh, 0, 0, width, height);
                } else {
                  ctx.drawImage(offCanvas, 0, 0);
                }

                // 6. Predict real-time screen & arena gaze 100% from real eye coordinates + WebGazer Regressor
                const vw = Math.max(1, window.innerWidth);
                const vh = Math.max(1, window.innerHeight);

                const irisPredicted = predictScreenGaze(
                  calibrationModelRef.current,
                  {
                    normX: smoothedNormRef.current.x,
                    normY: smoothedNormRef.current.y,
                  },
                  { width: vw, height: vh },
                  null,
                  1.0
                );

                let finalX = irisPredicted.x;
                let finalY = irisPredicted.y;

                if (
                  wgRegressorRef.current &&
                  latestEyePatchesRef.current &&
                  calibrationModelRef.current.sampleCount >= 3
                ) {
                  try {
                    const wgPred = wgRegressorRef.current.predict(
                      latestEyePatchesRef.current
                    );
                    if (
                      wgPred &&
                      typeof wgPred.x === 'number' &&
                      typeof wgPred.y === 'number' &&
                      !Number.isNaN(wgPred.x) &&
                      !Number.isNaN(wgPred.y)
                    ) {
                      const boundedWg = webgazer.util.bound({
                        x: Math.round(wgPred.x),
                        y: Math.round(wgPred.y),
                      });
                      setWgRawPrediction({
                        x: Math.round(boundedWg.x),
                        y: Math.round(boundedWg.y),
                      });
                      // Fuse WebGazer 120-feature tight eye-patch Ridge Regression + 3D Iris calibration
                      finalX = Math.round(
                        boundedWg.x * 0.35 + irisPredicted.x * 0.65
                      );
                      finalY = Math.round(
                        boundedWg.y * 0.35 + irisPredicted.y * 0.65
                      );
                    }
                  } catch {}
                }

                setGazeScreenPos({
                  x: Math.max(16, Math.min(vw - 16, finalX)),
                  y: Math.max(16, Math.min(vh - 16, finalY)),
                });

                // Compute Arena Gaze Dot percentage purely from the user's eye coordinates
                const pureArenaPct = predictArenaGazePercent(
                  calibrationModelRef.current,
                  {
                    normX: smoothedNormRef.current.x,
                    normY: smoothedNormRef.current.y,
                  }
                );
                setArenaGazePct(pureArenaPct);
              }
            } else {
              // Camera is not yet streaming: render a clean dark frame
              ctx.fillStyle = '#0F172A';
              ctx.fillRect(0, 0, width, height);
              ctx.strokeStyle = '#1E293B';
              ctx.lineWidth = 1;
              ctx.strokeRect(16, 16, width - 32, height - 32);
            }
          }
        }
      }
      rafRef.current = window.requestAnimationFrame(processFrame);
    };

    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(processFrame);
  }, [extractAndRenderWebGazerPatches]);

  const startCameraWithDevice = useCallback(
    async (deviceIdToUse?: string) => {
      setCameraError('');
      setCalibrationWarning('');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      try {
        eyeBaselineRef.current = {
          x: 0.5,
          y: 0.5,
          initialized: false,
          warmupSamples: [],
        };
        oneEuroXRef.current.reset();
        oneEuroYRef.current.reset();
        recentPupilBufferRef.current = [];
        lastLandmarksRef.current = null;
        missedFaceFramesRef.current = 0;

        ensureFaceLandmarker();

        // Request HD 720p stream so each iris/pupil has maximum spatial pixel resolution
        const constraints: MediaStreamConstraints = {
          video: deviceIdToUse
            ? {
                deviceId: { exact: deviceIdToUse },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraActive(true);
        await refreshCameraDevices();
      } catch {
        setCameraActive(false);
        setCameraError(
          'يرجى السماح بإذن كاميرا الويب في المتصفح لتشغيل محرك WebGazer.js وتتبع بؤبؤ العين الفعلي.'
        );
      }
    },
    [ensureFaceLandmarker, refreshCameraDevices]
  );

  useEffect(() => {
    startOpticalLoop();
    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    if (!isHeadless && typeof navigator.mediaDevices?.getUserMedia === 'function') {
      startCameraWithDevice();
    }
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startOpticalLoop, startCameraWithDevice]);

  const handleToggleCamera = async () => {
    if (cameraActive && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      lastLandmarksRef.current = null;
      setCameraActive(false);
      return;
    }
    if (!guardianConsent) {
      setCameraError('قبل تشغيل الكاميرا، يلزم تسجيل موافقة ولي الأمر على جلسة الفحص.');
      return;
    }
    setCameraError('');
    await startCameraWithDevice(selectedDeviceId || undefined);
  };

  const handleChangeCameraDevice = async (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    if (cameraActive) {
      await startCameraWithDevice(newDeviceId);
    }
  };

  // Real Microphone Voice Tracker for Aloud Reading with Arabic Dialect Recognition & Strict SpeechRecognition Validation
  const handleToggleMicrophone = async () => {
    if (micActive) {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      setMicActive(false);
      setMicVolume(0);
      setSpeechRecStatus('idle');
      return;
    }

    if (!guardianConsent || !guardianAudioConsent) {
      setSpeechRecStatus('error');
      setSpeechRecErrorMsg('يجب أولًا تسجيل موافقة ولي الأمر على الجلسة، ثم الموافقة المنفصلة على استخدام التعرف الصوتي الذي قد يعالج الكلام عبر خدمة المتصفح. يمكنك إدخال النص المنطوق يدويًا بدلًا من ذلك.');
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      setMicActive(false);
      setMicVolume(0);
      setSpeechRecStatus('unsupported');
      setSpeechRecErrorMsg(
        'متصفحك الحالي لا يدعم واجهة التعرف الصوتي المباشر (Web Speech API / SpeechRecognition). لتحويل القراءة الجهرية إلى نص تلقائياً يُرجى استخدام متصفح Google Chrome أو Microsoft Edge، أو يمكنك كتابة النص المنطوق للطالب يدوياً في الحقل أدناه.'
      );
      return;
    }

    setSpeechRecErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!micStreamRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          const avg =
            dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setMicVolume(Math.min(100, Math.round(avg * 1.8)));
          window.requestAnimationFrame(updateMeter);
        };
        window.requestAnimationFrame(updateMeter);
      }

      const rec = new SpeechRec();
      rec.lang = selectedDialectProfile.speechRecognitionLang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onstart = () => {
        setSpeechRecStatus('listening');
        setSpeechRecErrorMsg('');
      };
      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }
        setSpokenTranscript(transcript.trim());
        setIsTranscriptPreset(false);
        setSpeechRecStatus('listening');
      };
      rec.onerror = (event: any) => {
        const errCode = event?.error || 'unknown';
        if (errCode === 'no-speech') {
          setSpeechRecErrorMsg(
            'لم يُرصد صوت واضح بعد — يرجى القراءة بصوت مسموع بالقرب من الميكروفون.'
          );
          return;
        }
        // Fatal SpeechRecognition error: stop mic stream so UI never falsely shows active transcription
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
        }
        setMicActive(false);
        setMicVolume(0);
        setSpeechRecStatus('error');
        setSpeechRecErrorMsg(
          `تعذّر تشغيل خدمة تحويل الصوت إلى نص (${errCode}). تم إيقاف حالة الميكروفون النشطة لمنع إظهار حالة مضللة؛ يمكنك إدخال النص المنطوق يدوياً في الحقل أدناه.`
        );
      };
      rec.onend = () => {
        if (micStreamRef.current && recognitionRef.current === rec) {
          try {
            rec.start();
          } catch {
            setMicActive(false);
            setSpeechRecStatus('idle');
          }
        }
      };
      rec.start();
      recognitionRef.current = rec;
      setSpeechRecognitionUsed(true);
      setMicActive(true);
      setSpeechRecStatus('listening');
    } catch {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      setMicActive(false);
      setMicVolume(0);
      setSpeechRecStatus('error');
      setSpeechRecErrorMsg(
        'تعذّر الوصول إلى الميكروفون أو بدء التعرف الصوتي في المتصفح. يرجى التحقق من إذن الميكروفون أو إدخال النص المنطوق يدوياً.'
      );
    }
  };

  /**
   * Records a REAL observed eye-tracking sample when the user looks at a target point and clicks it.
   * Uses 100% pure observed pupil coordinates (`avgNormX, avgNormY`) from the camera without mixing target coordinates or synthetic offsets.
   */
  const handleSampleCalibrationPoint = useCallback(
    (
      target: { id: number; label: string; xPct: number; yPct: number },
      e?: React.MouseEvent<HTMLButtonElement>
    ) => {
      const isHeadless =
        navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

      if (
        !isHeadless &&
        !isManualDemoMode &&
        (!cameraActive || !pupilFeaturesRef.current.faceDetected)
      ) {
        setCalibrationWarning(
          'لا يمكن تسجيل نقطة معايرة حقيقية لأن الكاميرا غير مفعّلة أو لم يتم رصد بؤبؤ العين بعد! شغّل الكاميرا وتأكد من ظهور المؤشر الأخضر فوق بؤبؤ عينك، أو فعّل «وضع المحاكاة اليدوية بالماوس (بدون كاميرا)» أدناه لتجربة خطوات الواجهة دون ادعاء قياس بصري.'
        );
        return;
      }

      setCalibrationWarning('');
      const vw = window.innerWidth || 1440;
      const vh = window.innerHeight || 900;

      let screenX = Math.round((target.xPct / 100) * vw);
      let screenY = Math.round((target.yPct / 100) * vh);

      if (e?.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect();
        screenX = Math.round(rect.left + rect.width / 2);
        screenY = Math.round(rect.top + rect.height / 2);
      } else if (calibrationArenaRef.current) {
        const arenaRect = calibrationArenaRef.current.getBoundingClientRect();
        screenX = Math.round(
          arenaRect.left + (target.xPct / 100) * arenaRect.width
        );
        screenY = Math.round(
          arenaRect.top + (target.yPct / 100) * arenaRect.height
        );
      }

      // Compute stabilized pupil position across the last 4 camera frames (100% pure observed eye signal)
      const buf = recentPupilBufferRef.current;
      const avgNormX =
        buf.length > 0
          ? buf.reduce((s, p) => s + p.normX, 0) / buf.length
          : pupilFeaturesRef.current.combinedNormX;
      const avgNormY =
        buf.length > 0
          ? buf.reduce((s, p) => s + p.normY, 0) / buf.length
          : pupilFeaturesRef.current.combinedNormY;
      const avgRawX =
        buf.length > 0
          ? buf.reduce((s, p) => s + p.rawX, 0) / buf.length
          : pupilFeaturesRef.current.rawCombinedX;
      const avgRawY =
        buf.length > 0
          ? buf.reduce((s, p) => s + p.rawY, 0) / buf.length
          : pupilFeaturesRef.current.rawCombinedY;

      // 1. Feed real WebGazer eye patches + screen coordinates into WebGazer.js Ridge Regression model
      if (cameraActive && pupilFeaturesRef.current.faceDetected) {
        try {
          webgazer.recordScreenPosition(screenX, screenY, 'click');
          if (wgRegressorRef.current && latestEyePatchesRef.current) {
            wgRegressorRef.current.addData(
              latestEyePatchesRef.current,
              [screenX, screenY],
              'click'
            );
            const pred = wgRegressorRef.current.predict(
              latestEyePatchesRef.current
            );
            if (pred && !Number.isNaN(pred.x) && !Number.isNaN(pred.y)) {
              const bounded = webgazer.util.bound(pred);
              setWgRawPrediction({
                x: Math.round(bounded.x),
                y: Math.round(bounded.y),
              });
            }
          }
        } catch {}
      }

      // 2. Record 1 real click sample for this target
      setTargetClicks((prevClicks) => {
        const currentCount = prevClicks[target.id] || 0;
        const nextCount = Math.min(SAMPLES_PER_TARGET, currentCount + 1);
        const updatedClicks = {
          ...prevClicks,
          [target.id]: nextCount,
        };

        if (nextCount >= 1) {
          const nextUnvisited = CALIBRATION_TARGETS.find(
            (t) => (updatedClicks[t.id] || 0) === 0
          );
          const nextIncomplete = CALIBRATION_TARGETS.find(
            (t) => (updatedClicks[t.id] || 0) < SAMPLES_PER_TARGET
          );
          if (nextUnvisited) {
            setActiveTargetId(nextUnvisited.id);
          } else if (nextIncomplete) {
            setActiveTargetId(nextIncomplete.id);
          }
        }
        return updatedClicks;
      });

      // 3. Record 100% pure observed camera coordinates when camera is active (never blend target.xPct into camera samples!)
      const hasRealCameraGaze =
        cameraActive && pupilFeaturesRef.current.faceDetected && !isManualDemoMode;
      const pureNormX = hasRealCameraGaze ? avgNormX : target.xPct / 100;
      const pureNormY = hasRealCameraGaze ? avgNormY : target.yPct / 100;

      setCalibrationSamples((prevSamples) => {
        const newSample: CalibrationSample = {
          pointId: target.id,
          normX: pureNormX,
          normY: pureNormY,
          rawX: hasRealCameraGaze ? avgRawX : pureNormX,
          rawY: hasRealCameraGaze ? avgRawY : pureNormY,
          screenX,
          screenY,
          arenaXPct: target.xPct,
          arenaYPct: target.yPct,
        };
        const updatedSamples = [...prevSamples, newSample];
        const fitted = fitGazeCalibrationModel(
          updatedSamples,
          validationSamples,
          { width: vw, height: vh }
        );
        // If in manual mouse demo mode (no camera), never report fake camera accuracy!
        const finalModel: GazeCalibrationModel = hasRealCameraGaze
          ? fitted
          : {
              ...fitted,
              accuracyPercent: 0,
            };
        setCalibrationModel(finalModel);
        calibrationModelRef.current = finalModel;

        const nextArenaPct = predictArenaGazePercent(finalModel, {
          normX: pureNormX,
          normY: pureNormY,
        });
        setArenaGazePct(nextArenaPct);

        const nextScreenGaze = predictScreenGaze(
          finalModel,
          { normX: pureNormX, normY: pureNormY },
          { width: vw, height: vh },
          null,
          1.0
        );
        setGazeScreenPos(nextScreenGaze);

        return updatedSamples;
      });
    },
    [cameraActive, isManualDemoMode, validationSamples]
  );

  /**
   * Records an independent held-out validation sample (V1 or V2) that NEVER enters the training set.
   * Uses 100% pure observed pupil coordinates (`avgNormX, avgNormY`) from the camera.
   */
  const handleSampleValidationPoint = useCallback(
    (
      target: { id: number; label: string; xPct: number; yPct: number },
      e?: React.MouseEvent<HTMLButtonElement>
    ) => {
      const isHeadless =
        navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
      if (
        !isHeadless &&
        !isManualDemoMode &&
        (!cameraActive || !pupilFeaturesRef.current.faceDetected)
      ) {
        setCalibrationWarning(
          'يرجى تشغيل الكاميرا والتأكد من رصد بؤبؤ العين قبل نقر نقاط التحقق المستقلة لقياس خطأ تقدير النظر.'
        );
        return;
      }
      setCalibrationWarning('');
      const vw = window.innerWidth || 1440;
      const vh = window.innerHeight || 900;

      let screenX = Math.round((target.xPct / 100) * vw);
      let screenY = Math.round((target.yPct / 100) * vh);
      if (e?.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect();
        screenX = Math.round(rect.left + rect.width / 2);
        screenY = Math.round(rect.top + rect.height / 2);
      } else if (calibrationArenaRef.current) {
        const arenaRect = calibrationArenaRef.current.getBoundingClientRect();
        screenX = Math.round(
          arenaRect.left + (target.xPct / 100) * arenaRect.width
        );
        screenY = Math.round(
          arenaRect.top + (target.yPct / 100) * arenaRect.height
        );
      }

      const buf = recentPupilBufferRef.current;
      const avgNormX =
        buf.length > 0
          ? buf.reduce((s, p) => s + p.normX, 0) / buf.length
          : pupilFeaturesRef.current.combinedNormX;
      const avgNormY =
        buf.length > 0
          ? buf.reduce((s, p) => s + p.normY, 0) / buf.length
          : pupilFeaturesRef.current.combinedNormY;
      const hasRealCameraGaze =
        cameraActive && pupilFeaturesRef.current.faceDetected && !isManualDemoMode;
      const pureNormX = hasRealCameraGaze ? avgNormX : target.xPct / 100;
      const pureNormY = hasRealCameraGaze ? avgNormY : target.yPct / 100;

      setValidationClicks((prev) => ({
        ...prev,
        [target.id]: (prev[target.id] || 0) + 1,
      }));

      setValidationSamples((prevVal) => {
        const valSample: CalibrationSample = {
          pointId: target.id,
          normX: pureNormX,
          normY: pureNormY,
          screenX,
          screenY,
          arenaXPct: target.xPct,
          arenaYPct: target.yPct,
        };
        const nextVal = [...prevVal, valSample];
        const fitted = fitGazeCalibrationModel(calibrationSamples, nextVal, {
          width: vw,
          height: vh,
        });
        const finalModel: GazeCalibrationModel = hasRealCameraGaze
          ? fitted
          : {
              ...fitted,
              accuracyPercent: 0,
            };
        setCalibrationModel(finalModel);
        calibrationModelRef.current = finalModel;
        return nextVal;
      });
    },
    [cameraActive, isManualDemoMode, calibrationSamples]
  );

  const handleResetCalibration = async () => {
    setCalibrationWarning('');
    handleRecenterEyeBaseline();
    try {
      await webgazer.clearData();
      if (wgRegressorRef.current) {
        wgRegressorRef.current.init();
      }
    } catch {}
    setWgRawPrediction(null);
    setTargetClicks({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    setValidationClicks({ 101: 0, 102: 0 });
    setCalibrationSamples([]);
    setValidationSamples([]);
    setActiveTargetId(3);
    setArenaGazePct({ xPct: 50, yPct: 50 });
    const resetModel: GazeCalibrationModel = {
      isCalibrated: false,
      scaleX: 1200,
      offsetX: 100,
      scaleY: 700,
      offsetY: 80,
      arenaScaleX: 100,
      arenaOffsetX: 0,
      arenaScaleY: 100,
      arenaOffsetY: 0,
      accuracyPercent: 0,
      sampleCount: 0,
      validationRmsePx: 0,
      inSampleRmsePx: 0,
      validationSampleCount: 0,
      validationMethod: 'single-point-unvalidated',
      anchors: [],
    };
    setCalibrationModel(resetModel);
    calibrationModelRef.current = resetModel;
  };

  const completedTargetsCount = CALIBRATION_TARGETS.filter(
    (t) => (targetClicks[t.id] || 0) >= 1
  ).length;
  const fullySampledTargetsCount = CALIBRATION_TARGETS.filter(
    (t) => (targetClicks[t.id] || 0) >= SAMPLES_PER_TARGET
  ).length;
  const completedValidationCount = VALIDATION_TARGETS.filter(
    (t) => (validationClicks[t.id] || 0) >= 1
  ).length;

  // Real-time Foveal Word Hit-Testing Loop during Reading Stage (20Hz / 50ms)
  useEffect(() => {
    if (stage !== 'reading' || !isReadingActive) return;

    const intervalMs = 50;
    const timer = window.setInterval(() => {
      setElapsedMs((prev) => prev + intervalMs);

      const boxes = selectedPassage.words
        .map((_, idx) => {
          const el = wordElementsRef.current[idx];
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            wordIndex: idx,
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
          };
        })
        .filter(Boolean) as {
        wordIndex: number;
        left: number;
        top: number;
        right: number;
        bottom: number;
      }[];

      const hitIdx = hitTestWordBoxes(
        gazeScreenPos.x,
        gazeScreenPos.y,
        boxes,
        46
      );

      if (hitIdx !== null) {
        const prevIdx = lastFixatedWordRef.current;
        const switchedWord = prevIdx !== null && prevIdx !== hitIdx;
        const isRegression = prevIdx !== null && hitIdx < prevIdx;

        setActiveWordIdx(hitIdx);

        setWordStats((prev) => {
          const existing = prev[hitIdx] || { durationMs: 0, visits: 0 };
          return {
            ...prev,
            [hitIdx]: {
              durationMs: existing.durationMs + intervalMs,
              visits:
                existing.visits === 0
                  ? 1
                  : switchedWord
                    ? existing.visits + 1
                    : existing.visits,
              regressedFromIndex: isRegression
                ? prevIdx!
                : existing.regressedFromIndex,
            },
          };
        });

        if (switchedWord) {
          setGazeTrail((prev) => [
            ...prev.slice(-28),
            { fromIdx: prevIdx!, toIdx: hitIdx, isRegression },
          ]);
        }

        lastFixatedWordRef.current = hitIdx;
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    stage,
    isReadingActive,
    gazeScreenPos.x,
    gazeScreenPos.y,
    selectedPassage.words,
  ]);

  const handleStartReadingStage = () => {
    if (isManualDemoMode) {
      setCalibrationWarning('وضع المحاكاة اليدوية للعرض التقني فقط ولا يسمح ببدء جلسة قياس أو إصدار تقرير.');
      return;
    }
    if (!cameraActive) {
      setCalibrationWarning('شغّل الكاميرا وتأكد من ظهور الوجه قبل بدء القراءة.');
      return;
    }
    const validationRmsePx = calibrationModel.validationRmsePx;
    if (
      fullySampledTargetsCount < CALIBRATION_TARGETS.length ||
      calibrationModel.validationMethod === 'single-point-unvalidated' ||
      typeof validationRmsePx !== 'number' ||
      !Number.isFinite(validationRmsePx) ||
      (calibrationModel.validationSampleCount || 0) < 1 ||
      validationRmsePx > 60
    ) {
      setCalibrationWarning(
        `لا تبدأ القراءة قبل اجتياز فحص المعايرة التقني: أكمل نقطتيْن لكل هدف، وتأكد أن RMSE خارج العينة لا يتجاوز 60 بكسل. النتيجة الحالية: RMSE ${Number.isFinite(validationRmsePx) ? validationRmsePx : 'غير متاح'} بكسل؛ هذا حد تقني تجريبي وليس معيارًا سريريًا معتمدًا.`
      );
      return;
    }
    if (!studentName.trim()) {
      setNameError('يرجى إدخال اسم الطالب الثلاثي قبل بدء جلسة الفحص البصري.');
      return;
    }
    setNameError('');

    if (!guardianConsent) {
      setCalibrationWarning(
        'يلزم الإقرار بموافقة ولي الأمر وحماية خصوصية بيانات الطفل قبل بدء جلسة الفحص.'
      );
      return;
    }

    if (fullySampledTargetsCount < CALIBRATION_TARGETS.length) {
      setCalibrationWarning(
        'يرجى إتمام النقاط الخمس؛ انظر إلى كل نقطة واضغط عليها مرتين لتسجيل عينات المعايرة.'
      );
      return;
    }
    setCalibrationWarning('');
    setReadingCoverageError('');

    blinkDetectorRef.current.reset();
    setBlinkCount(0);
    setLastBlinkDurationMs(0);
    setBlinkEvents([]);
    setWordStats({});
    setGazeTrail([]);
    setElapsedMs(0);
    setActiveWordIdx(null);
    lastFixatedWordRef.current = null;
    setIsReadingActive(true);
    setStage('reading');
  };

  const handleManualFixateWord = (idx: number) => {
    const prevIdx = lastFixatedWordRef.current;
    const isRegression = prevIdx !== null && idx < prevIdx;
    if (readingCoverageError) setReadingCoverageError('');

    setWordStats((prev) => {
      const existing = prev[idx] || { durationMs: 0, visits: 0, blinks: 0 };
      return {
        ...prev,
        [idx]: {
          durationMs: existing.durationMs + 220,
          visits: existing.visits + 1,
          regressedFromIndex: isRegression
            ? prevIdx!
            : existing.regressedFromIndex,
          blinks: existing.blinks || 0,
        },
      };
    });

    if (prevIdx !== null && prevIdx !== idx) {
      setGazeTrail((prev) => [
        ...prev.slice(-28),
        { fromIdx: prevIdx, toIdx: idx, isRegression },
      ]);
    }
    lastFixatedWordRef.current = idx;
    setActiveWordIdx(idx);
  };

  const recordedWordsList = Object.entries(wordStats)
    .filter(([, st]) => st.durationMs > 0 && st.visits > 0)
    .map(([idxStr, st]) => ({
      wordIndex: Number(idxStr),
      word: selectedPassage.words[Number(idxStr)] || '',
      durationMs: st.durationMs,
      visits: st.visits,
      regressedFromIndex: st.regressedFromIndex,
      blinks: st.blinks || 0,
      observed: true,
    }));

  const minRequiredObservedWords = Math.max(
    4,
    Math.ceil(selectedPassage.words.length * 0.25)
  );
  const currentCoveragePercent = Math.round(
    (recordedWordsList.length / Math.max(1, selectedPassage.words.length)) * 100
  );

  // Evaluate Oral Reading Alignment ONLY when a real spoken transcript exists (never fake 100% with passage slice)
  const hasSpokenTranscript = spokenTranscript.trim().length > 0 && !isTranscriptPreset;
  const activeOralWordsSlice = hasSpokenTranscript
    ? selectedPassage.words.slice(
        0,
        Math.min(
          selectedPassage.words.length,
          Math.max(
            6,
            spokenTranscript.trim().split(/\s+/).filter(Boolean).length
          )
        )
      )
    : [];

  const liveOralDialectMetrics = hasSpokenTranscript
    ? evaluateOralReadingAlignment(
        activeOralWordsSlice,
        spokenTranscript.trim(),
        Math.max(6, elapsedMs / 1000),
        0,
        selectedDialect
      )
    : null;

  const oralIntegrationInput =
    hasSpokenTranscript && liveOralDialectMetrics
      ? {
          assessed: true,
          wcpm: liveOralDialectMetrics.wcpm,
          accuracyPercent: liveOralDialectMetrics.accuracyPercent,
          werPercent: liveOralDialectMetrics.werPercent,
          phoneticSubstitutionCount:
            liveOralDialectMetrics.phoneticSubstitutionCount,
          dialectVariantCount: liveOralDialectMetrics.dialectVariantCount,
          omissionCount: liveOralDialectMetrics.omittedWordsCount,
          misreadWords: liveOralDialectMetrics.alignment
            .filter(
              (a) =>
                a.status === 'phonetic_substitution' ||
                a.status === 'omitted'
            )
            .map((a) =>
              a.spokenWord
                ? `${a.targetWord} (نُطقت: ${a.spokenWord})`
                : a.targetWord
            ),
        }
      : null;

  const liveMetrics = calculateEyeTrackingMetrics(
    recordedWordsList,
    Math.max(5, elapsedMs / 1000),
    gradeLevel,
    blinkCount,
    selectedPassage.words.length,
    oralIntegrationInput
  );

  const liveBlinkClinical = evaluateBlinkRateClinical(
    blinkCount,
    Math.max(10, elapsedMs / 1000)
  );

  const handleProceedToComprehension = () => {
    if (recordedWordsList.length < minRequiredObservedWords) {
      setReadingCoverageError(
        `لا يمكن إنهاء القراءة وإصدار التقرير: تم رصد تثبيت بصري فعلي على (${recordedWordsList.length}) من أصل (${selectedPassage.words.length}) كلمة فقط (تغطية ${currentCoveragePercent}%). لا يضيف النظام زمناً افتراضياً للكلمات التي لم يرصدها؛ لذلك أكمل القراءة حتى تتوفر بيانات كافية. يرجى متابعة القراءة حتى رصد ${minRequiredObservedWords} كلمات على الأقل (25% من النص).`
      );
      return;
    }
    setReadingCoverageError('');
    setStage('comprehension');
  };

  const handleFinalizeSession = async () => {
    if (recordedWordsList.length < minRequiredObservedWords) {
      setComprehensionError(
        `بيانات تتبع العين غير كافية (${recordedWordsList.length}/${selectedPassage.words.length} كلمة). يرجى العودة لشاشة القراءة وإتمام رصد النظر الفعلي.`
      );
      return;
    }

    const unanswered = selectedPassage.comprehensionQuestions.some(
      (_, qIdx) => typeof answers[qIdx] !== 'number'
    );
    if (unanswered) {
      setComprehensionError(
        'يرجى الإجابة على جميع أسئلة الفهم القرائي قبل إصدار التقرير.'
      );
      return;
    }
    setComprehensionError('');
    setIsAnalyzing(true);

    // Strictly record actual observed fixations; unobserved words remain 0ms and 0 visits (observed: false)
    const fixations: WordFixation[] = selectedPassage.words.map((word, idx) => {
      const st = wordStats[idx];
      const isObserved = Boolean(st && st.durationMs > 0 && st.visits > 0);
      return {
        wordIndex: idx,
        word,
        durationMs: isObserved ? st.durationMs : 0,
        visits: isObserved ? st.visits : 0,
        regressedFromIndex: isObserved ? st?.regressedFromIndex : undefined,
        blinks: st?.blinks || 0,
        observed: isObserved,
      };
    });

    const durationSec = Math.max(4, Math.round(elapsedMs / 1000));
    const eyeMetrics = calculateEyeTrackingMetrics(
      fixations,
      durationSec,
      gradeLevel,
      blinkCount,
      selectedPassage.words.length,
      oralIntegrationInput
    );

    let correctAnswers = 0;
    selectedPassage.comprehensionQuestions.forEach((q, qIdx) => {
      if (answers[qIdx] === q.correctIndex) {
        correctAnswers += 1;
      }
    });
    const comprehensionScore = Math.round(
      (correctAnswers / selectedPassage.comprehensionQuestions.length) * 100
    );

    const oralSummaryClause =
      oralIntegrationInput && liveOralDialectMetrics
        ? ` كما أظهر تحليل القراءة الجهرية (${selectedDialectProfile.labelAr}) نسبة المطابقة المحسوبة ${liveOralDialectMetrics.accuracyPercent}% مع رصد ${liveOralDialectMetrics.phoneticSubstitutionCount} إبدالات فونولوجية و${liveOralDialectMetrics.omittedWordsCount} كلمات محذوفة واستثناء ${liveOralDialectMetrics.dialectVariantCount} بدائل لهجية طبيعية.`
        : ' (لم يتم تفعيل تسجيل القراءة الجهرية بالميكروفون في هذه الجلسة).';

    const isLowCameraReliability =
      isManualDemoMode ||
      !cameraActive ||
      calibrationModel.validationMethod === 'single-point-unvalidated' ||
      (calibrationModel.validationSampleCount || 0) < 1 ||
      !Number.isFinite(calibrationModel.validationRmsePx) ||
      calibrationModel.validationRmsePx! > 60;

    // Match the server-side evidence gate before showing any report in the client.
    const hasValidGazeCoverage =
      eyeMetrics.isSufficientGazeData &&
      Number.isFinite(eyeMetrics.gazeCoveragePercent) &&
      eyeMetrics.gazeCoveragePercent >= 25 &&
      Number.isFinite(eyeMetrics.observedWordCount) &&
      eyeMetrics.observedWordCount >= 4 &&
      Number.isFinite(eyeMetrics.totalPassageWordCount) &&
      eyeMetrics.totalPassageWordCount > 0 &&
      eyeMetrics.observedWordCount <= eyeMetrics.totalPassageWordCount;
    if (!hasValidGazeCoverage) {
      setIsAnalyzing(false);
      setComprehensionError('لا يمكن إصدار التقرير: يلزم رصد أربع كلمات على الأقل وتغطية بصرية فعلية لا تقل عن 25% من النص. أعد جلسة القراءة بعد التأكد من ظهور الوجه والعينين.');
      return;
    }
    if (isLowCameraReliability) {
      setIsAnalyzing(false);
      setCalibrationWarning(`تم حجب التقرير لأن المعايرة لم تجتز حد RMSE التقني (60 بكسل). الخطأ الحالي: ${calibrationModel.validationRmsePx ?? 'غير متاح'} بكسل. أعد المعايرة قبل بدء قراءة جديدة.`);
      setStage('setup');
      return;
    }

    const measurementReliabilityPrefix = isManualDemoMode || !cameraActive
      ? '[تنبيه منهجي: جلسة تجربة يدوية بالماوس بدون تتبع كاميرا فعلي — مؤشر المعايرة التجريبي غير متاح (0%) ولا تُعد هذه المخرجات قياساً بصرياً] '
      : isLowCameraReliability
        ? `[تنبيه منهجي: مؤشر المعايرة التجريبي منخفض (${calibrationModel.accuracyPercent}% · RMSE ${calibrationModel.validationRmsePx ?? 0}px) — لا تُعتمد قياسات هذه الجلسة لتفسير أداء الطالب] `
        : '[مؤشر فرز أولي استرشادي مبني على قواعد استدلالية (Heuristic MVP) — لا يغني عن التشخيص الإكلينيكي المعتمد] ';

    let clinicalReport = {
      clinicalSummary: `${measurementReliabilityPrefix}تم إجراء جلسة القراءة للطالب (${studentName.trim()} · ${selectedDialectProfile.labelAr}) بتغطية كلمات مرصودة ${eyeMetrics.gazeCoveragePercent}% (${eyeMetrics.observedWordCount}/${eyeMetrics.totalPassageWordCount} كلمة) وسرعة قراءة ${eyeMetrics.wpm} كلمة/دقيقة ومتوسط تثبيت ${eyeMetrics.avgFixationMs}ms ومعدل رمش ${eyeMetrics.blinksPerMinute} رمشة/دقيقة (${eyeMetrics.visualStrainLabelAr}).${oralSummaryClause}`,
      ocularMotorAnalysis: `${measurementReliabilityPrefix}سُجلت بيانات التثبيت على ${eyeMetrics.observedWordCount} كلمة دون تعبئة افتراضية للكلمات غير المرصودة. بلغت نسبة التراجع ${eyeMetrics.regressionRate}% (${eyeMetrics.regressionCount} قفزة تراجعية)، وسُجّل إجمالي ${eyeMetrics.blinkCount} رمشة عين بمعدل ${eyeMetrics.blinksPerMinute} رمشة/دقيقة (${eyeMetrics.visualStrainLabelAr})، بخطأ تحقق المعايرة خارج العينة: ${isManualDemoMode || !cameraActive ? 'غير متاح (محاكاة بدون كاميرا)' : `RMSE ${calibrationModel.validationRmsePx ?? 'غير متاح'}px`}.`,
      orthographicAndPhonologicalPatterns:
        eyeMetrics.problematicWords.length > 0
          ? `تركزت أطول فترات التثبيت أو التعثر الفونولوجي عند الكلمات: (${eyeMetrics.problematicWords.join('، ')}) مع مراعاة الخصائص الفونولوجية لـ (${selectedDialectProfile.labelAr}).${oralSummaryClause}`
          : `قراءة متوازنة للمقاطع الصوتية المرصودة دون تعثر ملحوظ مع مطابقة فونولوجية سليمة لـ (${selectedDialectProfile.labelAr}).${oralSummaryClause}`,
      dyscalculiaSpatialAnalysis:
        'لم يخضع الطالب لاختبار عسر الحساب (الديسكالكوليا) في هذه الجلسة بعد — لا يقوم النظام بتسجيل درجات حسابية افتراضية قبل إتمام الاختبارات الثلاثة في تبويب «مختبر فحص الديسكالكوليا والحساب».',
      interventionExercises: [
        {
          title: 'تدريب التقطيع المقطعي وتخفيف الإجهاد البصري أثناء القراءة',
          durationMinutes: 10,
          description:
            'استخدام القارئ الذكي بخلفية كريمية دافئة (Irlen Filter) لتقليل معدل الرمش المتكرر وتقسيم الكلمات الطويلة إلى مقاطع صوتية ملونة.',
        },
      ],
      classroomAccommodations: [
        'تفعيل المسطرة البصرية أثناء القراءة وتكبير حجم الخط إلى 24px لتقليل إجهاد الجفن والرمش المتكرر.',
        'ملاحظة منهجية: درجات المخاطر في هذا النموذج الأولي (MVP) تُحسب عبر قواعد استدلالية (Heuristic Rules) وليست أداة تشخيص سريرية معتمدة مستقلًا.',
      ],
    };

    try {
      const response = await authenticatedFetch('/api/ai/analyze-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          guardianConsentGiven: guardianConsent,
          guardianConsentRecordedAt: guardianConsent ? guardianConsentRecordedAt || new Date().toISOString() : undefined,
          guardianConsentSource: guardianConsent ? 'إقرار صريح داخل مختبر القراءة' : undefined,
          guardianAudioConsentGiven: guardianAudioConsent,
          guardianAudioConsentRecordedAt: guardianAudioConsent ? guardianAudioConsentRecordedAt : undefined,
          speechRecognitionUsed,
          oralReadingAssessed: hasSpokenTranscript,
          gradeLevel,
          wpm: eyeMetrics.wpm,
          avgFixationMs: eyeMetrics.avgFixationMs,
          regressionRate: eyeMetrics.regressionRate,
          gazeCoveragePercent: eyeMetrics.gazeCoveragePercent,
          observedWordCount: eyeMetrics.observedWordCount,
          totalPassageWordCount: eyeMetrics.totalPassageWordCount,
          calibrationAccuracyPercent: calibrationModel.accuracyPercent,
          blinkCount: eyeMetrics.blinkCount,
          blinksPerMinute: eyeMetrics.blinksPerMinute,
          visualStrainLabelAr: eyeMetrics.visualStrainLabelAr,
          dialectRegionAr: selectedDialectProfile.labelAr,
          problematicWords: eyeMetrics.problematicWords,
          oralAccuracyPercent: oralIntegrationInput?.accuracyPercent ?? null,
          oralWerPercent: oralIntegrationInput?.werPercent ?? null,
          phoneticSubstitutionCount:
            oralIntegrationInput?.phoneticSubstitutionCount ?? 0,
          dialectVariantCount: oralIntegrationInput?.dialectVariantCount ?? 0,
          dyscalculiaAssessed: false,
          numberLinePAE: null,
          subitizingAccuracy: null,
          reversalErrorCount: null,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.report) {
          clinicalReport = data.report;
        }
      }
    } catch {}

    const newRecord: StudentRecord = {
      id: activeStudent && !activeStudent.isDemoRecord ? activeStudent.id : `stu-${Date.now()}`,
      name: studentName.trim(),
      sessionStatus: 'completed',
      sessionRoleLabel: activeStudent?.sessionRoleLabel,
      assessmentHistory: activeStudent?.assessmentHistory || [],
      gradeLevel,
      ageYears: gradeLevel + 6,
      schoolName: activeStudent && !activeStudent.isDemoRecord ? activeStudent.schoolName : 'لم تُحدّد المدرسة',
      lastScreenedDate: new Date().toLocaleString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      passageId: selectedPassage.id,
      dialectRegionAr: selectedDialectProfile.labelAr,
      dialectCode: selectedDialect,
      readingDurationSeconds: durationSec,
      guardianConsentGiven: guardianConsent,
      guardianConsentRecordedAt: guardianConsent ? guardianConsentRecordedAt || new Date().toISOString() : undefined,
      guardianConsentSource: guardianConsent ? 'إقرار صريح داخل مختبر القراءة' : undefined,
      guardianAudioConsentGiven: guardianAudioConsent,
      guardianAudioConsentRecordedAt: guardianAudioConsent ? guardianAudioConsentRecordedAt : undefined,
      speechRecognitionUsed,
      wpm: eyeMetrics.wpm,
      avgFixationMs: eyeMetrics.avgFixationMs,
      regressionRate: eyeMetrics.regressionRate,
      regressionCount: eyeMetrics.regressionCount,
      blinkCount: eyeMetrics.blinkCount,
      blinksPerMinute: eyeMetrics.blinksPerMinute,
      visualStrainLevel: eyeMetrics.visualStrainLevel,
      visualStrainLabelAr: eyeMetrics.visualStrainLabelAr,
      gazeCoveragePercent: eyeMetrics.gazeCoveragePercent,
      observedWordCount: eyeMetrics.observedWordCount,
      totalPassageWordCount: eyeMetrics.totalPassageWordCount,
      calibrationAccuracyPercent:
        isManualDemoMode || !cameraActive ? 0 : calibrationModel.accuracyPercent,
      calibrationValidationMethod:
        isManualDemoMode || !cameraActive
          ? 'وضع محاكاة يدوية بالماوس (بدون كاميرا — لا توجد بيانات نظر من الكاميرا)'
          : calibrationModel.validationMethod === 'independent-holdout'
            ? 'تحقق مستقل (Independent Holdout)'
            : 'تحقق متقاطع (Leave-One-Point-Out CV)',
      oralReadingAssessed: hasSpokenTranscript,
      spokenTranscript: hasSpokenTranscript ? spokenTranscript.trim() : '',
      oralAccuracyPercent: oralIntegrationInput?.accuracyPercent ?? null,
      oralWerPercent: oralIntegrationInput?.werPercent ?? null,
      phoneticSubstitutionCount:
        oralIntegrationInput?.phoneticSubstitutionCount ?? 0,
      dialectVariantCount: oralIntegrationInput?.dialectVariantCount ?? 0,
      dyslexiaRiskScore: eyeMetrics.dyslexiaRiskScore,
      readingHeuristicIndicator: eyeMetrics.heuristicIndicator,
      readingRiskLevel: eyeMetrics.riskLevel,
      readingRiskLabelAr: eyeMetrics.riskLabelAr,
      problematicWords: eyeMetrics.problematicWords,
      fixations: fixations.filter((f) => f.observed && f.durationMs > 0),
      comprehensionScore,
      dyscalculiaAssessed: false,
      subitizingAccuracy: null,
      avgSubitizingMs: null,
      numberLinePAE: null,
      transcodingAccuracy: null,
      reversalErrorCount: null,
      dyscalculiaRiskScore: null,
      mathHeuristicIndicator: null,
      mathRiskLevel: 'unassessed',
      mathRiskLabelAr: 'لم يُجرَ اختبار الحساب بعد',
      clinicalReport,
    };

    setIsAnalyzing(false);
    onCompleteSession(newRecord);
  };

  return (
    <div className="space-y-6 relative">
      {/* Live Floating Green Gaze Cursor Overlay during Reading Stage */}
      {showGazeReticle && stage === 'reading' && (
        <div
          style={{
            transform: `translate3d(${gazeScreenPos.x - 18}px, ${gazeScreenPos.y - 18}px, 0)`,
          }}
          className="fixed top-0 left-0 w-9 h-9 rounded-full border-2 border-[#10B981] bg-[#10B981]/20 pointer-events-none z-50 flex items-center justify-center transition-transform duration-75"
          aria-hidden="true"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
        </div>
      )}

      {/* Clean Enterprise Stage Header & Stepper */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-[#0284C7] tracking-wide mb-1">
            الخطوة ٢ · مختبر الفحص البصري والقرائي المباشر
          </div>
          <h1 className="text-xl font-bold text-slate-900 font-display">
            تتبع حركة بؤبؤ العين وتحليل القراءة الصوتية
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRecenterEyeBaseline}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Target className="w-3.5 h-3.5 text-[#059669]" />
            <span>توسيط محور البؤبؤ</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGazeReticle(!showGazeReticle)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showGazeReticle
                ? 'bg-emerald-50 border-emerald-200 text-[#059669]'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>
              {showGazeReticle ? 'مؤشر البؤبؤ: نشط' : 'إظهار مؤشر البؤبؤ'}
            </span>
          </button>

          {/* 3-Step Progressive Stepper */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold">
            <span
              className={`px-3 py-1.5 rounded-lg transition-all ${
                stage === 'setup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              ١. الكاميرا والمعايرة ({completedTargetsCount}/5)
            </span>
            <span
              className={`px-3 py-1.5 rounded-lg transition-all ${
                stage === 'reading'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              ٢. القراءة الحية
            </span>
            <span
              className={`px-3 py-1.5 rounded-lg transition-all ${
                stage === 'comprehension'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              ٣. الفهم والتقرير
            </span>
          </div>

          {onProceedToMathLab && (
            <button
              type="button"
              onClick={onProceedToMathLab}
              className="px-4 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>الخطوة التالية: فحص الحساب</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* STAGE 1: CALIBRATION & STUDENT SETUP */}
      {stage === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Cols: Interactive 5-Point Calibration Arena */}
          <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  لوحة معايرة ربط بؤبؤ العين بالشاشة (5 نقاط + نقطتي تحقق مستقلتين)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  شغّل الكاميرا ثم انظر إلى كل نقطة واضغط عليها مرتين لتسجيل عينات المعايرة.
                </p>
              </div>
              <span
                className={`text-xs font-mono tabular-nums font-semibold px-2.5 py-1 rounded-md border shrink-0 ${
                  isManualDemoMode
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : fullySampledTargetsCount === CALIBRATION_TARGETS.length &&
                        calibrationModel.validationMethod !== 'single-point-unvalidated' &&
                        (calibrationModel.validationSampleCount || 0) > 0 &&
                        Number.isFinite(calibrationModel.validationRmsePx) &&
                        (calibrationModel.validationRmsePx || 0) <= 60
                      ? 'bg-emerald-50 border-emerald-200 text-[#059669]'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {isManualDemoMode
                  ? `محاكاة يدوية للعرض فقط (${fullySampledTargetsCount}/5 أهداف)`
                  : fullySampledTargetsCount === CALIBRATION_TARGETS.length
                    ? `مكتمل (${fullySampledTargetsCount}/5 أهداف · RMSE خارج العينة ${calibrationModel.validationRmsePx ?? 'غير متاح'}px)`
                    : `قيد المعايرة (${fullySampledTargetsCount}/5 أهداف · ${calibrationSamples.length}/10 عينات)`}
              </span>
            </div>

            {/* Concise Status & Simulation Mode Bar */}
            <div
              className={`px-4 py-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
                cameraActive && pupilFeatures.faceDetected && !isManualDemoMode
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/70 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {cameraActive && pupilFeatures.faceDetected && !isManualDemoMode ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                    <span>
                      رصد البؤبؤ والجفن نشط (EAR = {(pupilFeatures.combinedEAR ?? 0.29).toFixed(2)}) — تُسجَّل العينات من إحداثيات بؤبؤ العين الخالصة.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />
                    <span>
                      {isManualDemoMode
                        ? 'وضع المحاكاة اليدوية بالماوس مفعّل (بدون كاميرا): لاستعراض الواجهة فقط؛ لا توجد بيانات تتبّع حقيقية.'
                        : cameraActive
                          ? 'جاري البحث عن الوجه وبؤبؤ العين... وجّه وجهك نحو الكاميرا في إضاءة واضحة.'
                          : 'الكاميرا غير مفعّلة — شغّل الكاميرا لبدء الرصد البصري أو فعّل وضع التجربة اليدوية.'}
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManualDemoMode((prev) => !prev);
                  setCalibrationWarning('');
                }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer shrink-0 ${
                  isManualDemoMode
                    ? 'bg-amber-700 text-white border-amber-800'
                    : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
              >
                {isManualDemoMode
                  ? 'العودة للكاميرا الحقيقية'
                  : 'وضع تجربة يدوية بالماوس (بدون كاميرا)'}
              </button>
            </div>

            {fullySampledTargetsCount === CALIBRATION_TARGETS.length &&
              !isManualDemoMode &&
              (calibrationModel.validationMethod === 'single-point-unvalidated' ||
                (calibrationModel.validationSampleCount || 0) < 1 ||
                !Number.isFinite(calibrationModel.validationRmsePx) ||
                (calibrationModel.validationRmsePx || 0) > 60) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />
                  <span>
                    <strong>فحص المعايرة غير مجتاز:</strong>{' '}
                    RMSE خارج العينة = {calibrationModel.validationRmsePx ?? 'غير متاح'} بكسل. يجب ألا يتجاوز 60 بكسل قبل بدء القراءة؛ هذا حد تقني تجريبي لا يثبت الدقة السريرية.
                  </span>
                </div>
              )}

            {calibrationWarning && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-950 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                <span>{calibrationWarning}</span>
              </div>
            )}

            {/* Interactive 5-Point Calibration Target Box */}
            <div
              ref={calibrationArenaRef}
              className="relative h-80 bg-[#0F172A] rounded-xl overflow-hidden border border-slate-800 select-none"
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15">
                <div className="w-full h-px bg-slate-400" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15">
                <div className="h-full w-px bg-slate-400" />
              </div>

              {/* LIVE GREEN GAZE DOT INSIDE CALIBRATION ARENA */}
              {showGazeReticle && cameraActive && pupilFeatures.faceDetected && (
                <div
                  style={{
                    left: `${arenaGazePct.xPct}%`,
                    top: `${arenaGazePct.yPct}%`,
                  }}
                  data-testid="arena-green-gaze-dot"
                  className="-translate-x-1/2 -translate-y-1/2 absolute pointer-events-none z-20 transition-all duration-75 flex flex-col items-center"
                >
                  <div className="w-7 h-7 rounded-full border-2 border-[#10B981] bg-[#10B981]/30 flex items-center justify-center shadow-[0_0_14px_#10B981]">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                  </div>
                  <span className="mt-1 px-1.5 py-0.5 rounded bg-slate-900/95 text-[#10B981] text-[10px] font-mono tabular-nums whitespace-nowrap border border-emerald-500/40">
                    بؤبؤ العين ({arenaGazePct.xPct}%, {arenaGazePct.yPct}%)
                  </span>
                </div>
              )}

              {CALIBRATION_TARGETS.map((pt) => {
                const clicks = targetClicks[pt.id] || 0;
                const isDone = clicks >= SAMPLES_PER_TARGET;
                const isActiveTarget = activeTargetId === pt.id && !isDone;

                return (
                  <button
                    key={pt.id}
                    ref={(el) => {
                      targetButtonsRef.current[pt.id] = el;
                    }}
                    type="button"
                    onClick={(e) => handleSampleCalibrationPoint(pt, e)}
                    style={{ left: `${pt.xPct}%`, top: `${pt.yPct}%` }}
                    aria-label={`نقطة معايرة ${pt.label} (${clicks} من ${SAMPLES_PER_TARGET})`}
                    className={`-translate-x-1/2 -translate-y-1/2 absolute w-15 h-15 rounded-full border-2 flex flex-col items-center justify-center transition-all hover:scale-105 cursor-pointer z-10 ${
                      isDone
                        ? 'border-[#059669] bg-[#059669]/35 text-white'
                        : isActiveTarget
                          ? 'border-amber-400 bg-amber-500/35 text-white ring-4 ring-amber-400/30'
                          : 'border-[#0284C7] bg-[#0284C7]/25 text-white'
                    }`}
                  >
                    <span className="text-xs font-mono tabular-nums font-bold">
                      {isDone ? 'مكتمل' : `نقطة ${pt.id}`}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums opacity-95">
                      {clicks}/{SAMPLES_PER_TARGET}
                    </span>
                  </button>
                );
              })}

              {/* 2 Independent Held-Out Validation Points (V1 & V2) */}
              {VALIDATION_TARGETS.map((vt) => {
                const vClicks = validationClicks[vt.id] || 0;
                const isValDone = vClicks >= 1;
                return (
                  <button
                    key={vt.id}
                    type="button"
                    onClick={(e) => handleSampleValidationPoint(vt, e)}
                    style={{ left: `${vt.xPct}%`, top: `${vt.yPct}%` }}
                    aria-label={`نقطة ${vt.label} خارج التدريب (${vClicks})`}
                    className={`-translate-x-1/2 -translate-y-1/2 absolute w-13 h-13 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all hover:scale-105 cursor-pointer z-10 ${
                      isValDone
                        ? 'border-emerald-400 bg-emerald-500/30 text-emerald-100'
                        : 'border-purple-400 bg-purple-500/25 text-purple-100'
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold">
                      {vt.id === 101 ? 'تحقق V1' : 'تحقق V2'}
                    </span>
                    <span className="text-[9px] font-mono opacity-90">
                      {isValDone ? `✓ (${vClicks})` : 'مستقل'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Clean Calibration Footer & Progressive Disclosure for Advanced Parameters */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80">
              <div className="font-mono tabular-nums flex flex-wrap items-center gap-3">
                <span>
                  الشاشة: ({Math.round(gazeScreenPos.x)}px, {Math.round(gazeScreenPos.y)}px)
                </span>
                <span>
                  · تدريب: {calibrationSamples.length}/15 · تحقق مستقل: {completedValidationCount}/2
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRecenterEyeBaseline}
                  className="text-[#059669] hover:underline font-semibold cursor-pointer"
                >
                  توسيط المنتصف (50%)
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={handleResetCalibration}
                  className="text-[#0284C7] hover:underline font-semibold cursor-pointer"
                >
                  إعادة ضبط المعايرة ({fullySampledTargetsCount}/5)
                </button>
              </div>
            </div>

            {/* Progressive Disclosure: Advanced Calibration & Signal Parameters */}
            <details className="group bg-slate-50/70 border border-slate-200/80 rounded-xl overflow-hidden">
              <summary className="px-4 py-2.5 text-xs font-semibold text-slate-700 cursor-pointer flex items-center justify-between select-none hover:bg-slate-100/70">
                <span className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>الإعدادات المتقدمة لمعايرة WebGazer ومعامل كسب البؤبؤ</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="p-4 border-t border-slate-200/80 bg-white space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">خوارزمية الانحدار:</span>
                    <select
                      aria-label="نموذج تقدير نقطة النظر (تجريبي)"
                      value={wgRegressionType}
                      onChange={(e) =>
                        setWgRegressionType(
                          e.target.value as 'ridge' | 'weightedRidge'
                        )
                      }
                      className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                    >
                      <option value="weightedRidge">weightedRidge (انحدار موزون)</option>
                      <option value="ridge">ridge (انحدار خطي قياسي)</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={wgKalmanEnabled}
                      onChange={(e) => setWgKalmanEnabled(e.target.checked)}
                      className="accent-[#0284C7]"
                    />
                    <span>مرشح كالمان + مرشح 1€ التكيفي</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">حساسية البؤبؤ:</span>
                    {[
                      { label: 'عادي 1x', val: 1.0 },
                      { label: 'عالي 1.4x', val: 1.35 },
                      { label: 'فائق 1.8x', val: 1.8 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setEyeSensitivity(opt.val)}
                        className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                          Math.abs(eyeSensitivity - opt.val) < 0.05
                            ? 'bg-slate-900 text-white font-semibold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    EAR: {(pupilFeatures.combinedEAR ?? 0.29).toFixed(2)} · الرمشات: {blinkCount}
                  </span>
                </div>
              </div>
            </details>
          </div>

          {/* Right 5 Cols: Webcam Monitor & Student Session Configuration */}
          <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
            {/* Webcam Preview Section */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-display">
                    معاينة الكاميرا ورصد البؤبؤ
                  </h3>
                  <div className="text-[11px] text-slate-500">
                    {cameraActive
                      ? pupilFeatures.faceDetected
                        ? `● البؤبؤ مرصود (EAR ${(pupilFeatures.combinedEAR ?? 0.29).toFixed(2)})`
                        : '● الكاميرا نشطة — وجّه الوجه نحو الإطار'
                      : '○ الكاميرا متوقفة'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setBinocularZoomEnabled(!binocularZoomEnabled)
                    }
                    className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                      binocularZoomEnabled
                        ? 'bg-emerald-50 border-emerald-200 text-[#059669]'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {binocularZoomEnabled ? 'تكبير العينين 2.4x' : 'الوجه الكامل 1x'}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                      cameraActive
                        ? 'bg-[#DC2626] text-white'
                        : 'bg-[#0284C7] hover:bg-[#0369A1] text-white'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>
                      {cameraActive ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا المباشرة'}
                    </span>
                  </button>
                </div>
              </div>

              {cameraDevices.length > 0 && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="camera-device-select"
                    className="text-xs text-slate-600 shrink-0"
                  >
                    الكاميرا:
                  </label>
                  <select
                    id="camera-device-select"
                    value={selectedDeviceId}
                    onChange={(e) => handleChangeCameraDevice(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  >
                    {cameraDevices.map((dev, idx) => (
                      <option key={dev.deviceId || idx} value={dev.deviceId}>
                        {dev.label || `كاميرا متصلة #${idx + 1}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={refreshCameraDevices}
                    aria-label="تحديث قائمة الكاميرات"
                    className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Live Webcam Canvas + Dual Eye Patches */}
              <div className="relative bg-[#0F172A] rounded-xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center p-2.5 space-y-2">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="sr-only pointer-events-none opacity-0 fixed -top-96 -left-96 w-1 h-1"
                />
                <div className="relative w-full flex justify-center">
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={360}
                    data-testid="pupil-cv-canvas"
                    className="w-full max-w-[380px] h-36 rounded-lg object-cover border border-slate-800"
                  />
                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-center px-4 rounded-lg">
                      <Camera className="w-6 h-6 text-sky-400 mb-1.5" />
                      <p className="text-xs font-semibold text-white">
                        بث الكاميرا المباشر غير مفعّل حالياً
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        اضغط «تشغيل الكاميرا المباشرة» أعلاه لرصد بؤبؤ العين ومعدل الرمش
                      </p>
                    </div>
                  )}
                </div>

                <div className="w-full grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800/80">
                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-1.5 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-slate-300 font-mono tabular-nums">
                      <div className="text-emerald-400 font-semibold">العين اليمنى</div>
                      <div>
                        X:{Math.round(pupilFeatures.rightEye.normX * 100)}% · EAR:{' '}
                        {(pupilFeatures.rightEAR ?? 0.29).toFixed(2)}
                      </div>
                    </div>
                    <canvas
                      ref={rightPatchCanvasRef}
                      width={96}
                      height={44}
                      className="w-20 h-9 rounded border border-slate-700 bg-slate-950"
                    />
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-1.5 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-slate-300 font-mono tabular-nums">
                      <div className="text-emerald-400 font-semibold">العين اليسرى</div>
                      <div>
                        X:{Math.round(pupilFeatures.leftEye.normX * 100)}% · EAR:{' '}
                        {(pupilFeatures.leftEAR ?? 0.29).toFixed(2)}
                      </div>
                    </div>
                    <canvas
                      ref={leftPatchCanvasRef}
                      width={96}
                      height={44}
                      className="w-20 h-9 rounded border border-slate-700 bg-slate-950"
                    />
                  </div>
                </div>
              </div>

              {cameraError && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                  {cameraError}
                </p>
              )}
            </div>

            {/* Student Metadata & Passage Selection */}
            <div className="space-y-3.5 pt-3 border-t border-slate-100">
              <div>
                <label
                  htmlFor="student-name-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  اسم الطالب الثلاثي
                </label>
                <input
                  id="student-name-input"
                  type="text"
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  placeholder="أدخل اسم الطالب..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#0284C7]"
                />
                {nameError && (
                  <p className="mt-1 text-xs text-[#DC2626] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{nameError}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="grade-level-select"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    الصف الدراسي
                  </label>
                  <select
                    id="grade-level-select"
                    value={gradeLevel}
                    onChange={(e) => {
                      const nextGrade = Number(e.target.value);
                      setGradeLevel(nextGrade);
                      const matchingPassage = ARABIC_READING_PASSAGES.find(
                        (p) => p.gradeLevel === nextGrade
                      );
                      if (matchingPassage) {
                        setSelectedPassageId(matchingPassage.id);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value={2}>الصف الثاني الابتدائي</option>
                    <option value={3}>الصف الثالث الابتدائي</option>
                    <option value={4}>الصف الرابع الابتدائي</option>
                    <option value={5}>الصف الخامس الابتدائي</option>
                    <option value={6}>الصف السادس الابتدائي</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="student-dialect-select"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    اللهجة العربية للطالب
                  </label>
                  <select
                    id="student-dialect-select"
                    value={selectedDialect}
                    onChange={(e) =>
                      setSelectedDialect(e.target.value as ArabicDialectCode)
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#0284C7]"
                  >
                    {ARABIC_DIALECT_PROFILES.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.labelAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="passage-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  نص القراءة ({ARABIC_READING_PASSAGES.length} نصوص متدرجة)
                </label>
                <select
                  id="passage-select"
                  value={selectedPassageId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedPassageId(pid);
                    const found = ARABIC_READING_PASSAGES.find(
                      (p) => p.id === pid
                    );
                    if (found) {
                      setGradeLevel(found.gradeLevel);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#0284C7]"
                >
                  {ARABIC_READING_PASSAGES.map((p) => (
                    <option key={p.id} value={p.id}>
                      الصف {p.gradeLevel}: {p.title} ({p.words.length} كلمة · {p.diacriticLabelAr || p.category})
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={guardianConsent}
                  onChange={(e) => {
                    const accepted = e.target.checked;
                    setGuardianConsent(accepted);
                    setGuardianConsentRecordedAt(accepted ? new Date().toISOString() : undefined);
                    if (!accepted) {
                      if (streamRef.current) {
                        streamRef.current.getTracks().forEach((track) => track.stop());
                        streamRef.current = null;
                      }
                      setCameraActive(false);
                      setGuardianAudioConsent(false);
                      setGuardianAudioConsentRecordedAt(undefined);
                    }
                    if (accepted && calibrationWarning) setCalibrationWarning('');
                  }}
                  className="mt-0.5 accent-[#059669]"
                />
                <span>
                  <strong className="text-slate-900">موافقة ولي الأمر وحماية الخصوصية:</strong>{' '}
                  أقرّ بموافقة ولي الأمر على إجراء الفحص الأولي الاسترشادي مع حماية سرية بيانات الطالب.
                </span>
              </label>
              <label className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={guardianAudioConsent}
                  disabled={!guardianConsent}
                  onChange={(e) => {
                    const accepted = e.target.checked;
                    setGuardianAudioConsent(accepted);
                    setGuardianAudioConsentRecordedAt(accepted ? new Date().toISOString() : undefined);
                  }}
                  className="mt-0.5 accent-amber-700"
                />
                <span><strong>موافقة منفصلة على التعرف الصوتي (اختيارية):</strong> قد يستخدم Chrome أو Edge خدمة خارجية لتحويل الكلام إلى نص؛ لا يمكن افتراض أن المعالجة محلية. عند عدم الموافقة، اتركها غير محددة وأدخل النص يدويًا لاحقًا. لا يتم تسجيل ملف صوتي داخل بصيرة، لكن هذا لا يضمن أن خدمة المتصفح لا ترسل الصوت لمعالجته.</span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleStartReadingStage}
              className="w-full py-3 px-4 bg-[#0284C7] hover:bg-[#0369A1] text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Play className="w-4 h-4" />
              <span>
                بدء القراءة بعد اجتياز فحص المعايرة ({fullySampledTargetsCount}/5 أهداف)
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: CLEAN READING WORKSPACE & DIALECT VOICE ALIGNMENT */}
      {stage === 'reading' && (
        <div className="space-y-6">
          {/* Unified Hairline Telemetry & Action Ribbon */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-100">
              <div className="p-4">
                <span className="text-[11px] font-medium text-slate-500 block">الزمن الفعلي</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 text-base mt-0.5 block">
                  {(elapsedMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="p-4">
                <span className="text-[11px] font-medium text-slate-500 block">الكلمات المرصودة</span>
                <span className="font-mono tabular-nums font-bold text-[#0284C7] text-base mt-0.5 block">
                  {recordedWordsList.length} / {selectedPassage.words.length}
                </span>
              </div>
              <div className="p-4">
                <span className="text-[11px] font-medium text-slate-500 block">السرعة الحية (WPM)</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 text-base mt-0.5 block">
                  {recordedWordsList.length > 0 ? liveMetrics.wpm : 0} كلمة/دقيقة
                </span>
              </div>
              <div className="p-4">
                <span className="text-[11px] font-medium text-slate-500 block">متوسط زمن التثبيت</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 text-base mt-0.5 block">
                  {recordedWordsList.length > 0 ? liveMetrics.avgFixationMs : 0} ms
                </span>
              </div>
              <div className="p-4">
                <span className="text-[11px] font-medium text-slate-500 block">التراجعات (Regressions)</span>
                <span className="font-mono tabular-nums font-bold text-[#DC2626] text-base mt-0.5 block">
                  {liveMetrics.regressionCount} ({liveMetrics.regressionRate}%)
                </span>
              </div>
              <div className="p-4">
                <span className="text-[11px] font-medium text-slate-500 block">
                  معدل الرمش (EAR {(pupilFeatures.combinedEAR ?? 0.29).toFixed(2)})
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    data-testid="live-blink-rate-value"
                    className={`font-mono tabular-nums font-bold text-sm ${
                      liveBlinkClinical.visualStrainLevel === 'high' ||
                      liveBlinkClinical.visualStrainLevel === 'severe'
                        ? 'text-[#DC2626]'
                        : liveBlinkClinical.visualStrainLevel === 'moderate'
                          ? 'text-[#D97706]'
                          : 'text-[#059669]'
                    }`}
                  >
                    {liveBlinkClinical.blinksPerMinute}/دقيقة
                  </span>
                  <span
                    data-testid="visual-strain-badge"
                    className="text-[10px] font-semibold text-slate-500"
                  >
                    ({blinkCount} رمشة)
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="record-blink-btn"
                  onClick={() => handleRecordManualBlink()}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-[#D97706]" />
                  <span>+ تسجيل رمشة ({blinkCount})</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleMicrophone}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    micActive
                      ? 'bg-red-50 border-red-200 text-[#DC2626]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {micActive ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      <span>الميكروفون نشط ({micVolume}%)</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-[#0284C7]" />
                      <span>تشغيل الميكروفون ({selectedDialectProfile.labelAr})</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsReadingActive(!isReadingActive)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {isReadingActive ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>إيقاف مؤقت</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>استئناف</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleProceedToComprehension}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#059669] hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  إنهاء القراءة والانتقال لأسئلة الفهم ({currentCoveragePercent}% تغطية)
                </span>
              </button>
            </div>
          </div>

          {readingCoverageError && (
            <div
              role="alert"
              data-testid="reading-coverage-error"
              className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-950 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                <span>{readingCoverageError}</span>
              </div>
              <span className="font-mono font-bold text-[#DC2626] shrink-0">
                الحد الأدنى المطلوب: {minRequiredObservedWords} كلمات (25%)
              </span>
            </div>
          )}

          {/* Primary Reading Canvas — Front and Center */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 border-b border-slate-100 pb-4">
              <div>
                <span className="font-bold text-slate-900">{selectedPassage.title}</span>
                <span className="mx-2">·</span>
                <span>
                  اقرأ النص بعينيك ليتم رصد زمن التثبيت الفعلي (ms) وعدد مرات الرمش (👁) على كل كلمة
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  blinkDetectorRef.current.reset();
                  setBlinkCount(0);
                  setLastBlinkDurationMs(0);
                  setBlinkEvents([]);
                  setWordStats({});
                  setGazeTrail([]);
                  setElapsedMs(0);
                }}
                className="text-[#0284C7] hover:underline font-semibold cursor-pointer"
              >
                تصفير عدادات الكلمات والرمش
              </button>
            </div>

            <div
              className="flex flex-wrap gap-x-5 gap-y-7 leading-loose select-none py-2"
              dir="rtl"
            >
              {selectedPassage.words.map((word, idx) => {
                const st = wordStats[idx];
                const duration = st?.durationMs || 0;
                const visits = st?.visits || 0;
                const wordBlinks = st?.blinks || 0;
                const isCurrentGaze = activeWordIdx === idx;
                const isHighFixation =
                  duration >= 420 || visits >= 2 || wordBlinks >= 2;

                return (
                  <span
                    key={idx}
                    ref={(el) => {
                      wordElementsRef.current[idx] = el;
                    }}
                    onClick={() => handleManualFixateWord(idx)}
                    className={`px-3.5 py-2.5 rounded-xl text-2xl font-display transition-all cursor-pointer relative ${
                      isCurrentGaze
                        ? 'bg-[#0284C7] text-white font-bold ring-4 ring-sky-400/30'
                        : isHighFixation
                          ? 'bg-red-50 text-red-950 border border-red-200 font-semibold'
                          : duration > 0 || wordBlinks > 0
                            ? 'bg-emerald-50/70 text-slate-900 border border-emerald-200'
                            : 'bg-slate-50/60 text-slate-900 border border-slate-200/80 hover:bg-slate-100/70'
                    }`}
                  >
                    <span>{word}</span>
                    <span
                      className={`block text-[10px] font-mono tabular-nums mt-1 ${
                        isCurrentGaze
                          ? 'text-sky-100'
                          : isHighFixation
                            ? 'text-[#DC2626] font-bold'
                            : duration > 0 || wordBlinks > 0
                              ? 'text-[#059669]'
                              : 'text-slate-400'
                      }`}
                    >
                      {duration}ms {visits > 0 ? `· ${visits}x` : ''}{' '}
                      {wordBlinks > 0 ? `· 👁 ${wordBlinks} رمشة` : ''}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Compact Dialect & Oral Transcript Studio Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Globe className="w-4 h-4 text-[#059669]" />
                <span>محاذاة القراءة الجهرية وتكيّف اللهجة العربية ({selectedDialectProfile.labelAr})</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="تغيير اللهجة العربية أثناء القراءة"
                  value={selectedDialect}
                  onChange={(e) =>
                    setSelectedDialect(e.target.value as ArabicDialectCode)
                  }
                  className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                >
                  {ARABIC_DIALECT_PROFILES.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.labelAr}
                    </option>
                  ))}
                </select>

                {[
                  {
                    dialect: 'gulf' as ArabicDialectCode,
                    label: 'نموذج خليجي',
                    sample:
                      'زار طلاب المدرسة المرصد الفلكي في مسا صافي لشوفة الكواكب المنورة حط المهندس المنضار الدكيك صوب السماء',
                  },
                  {
                    dialect: 'egyptian' as ArabicDialectCode,
                    label: 'نموذج مصري',
                    sample:
                      'زار طلاب المدرسه المرصد الفلكي في مسا صافي علشان الكواكب المنورة حط المهندس المنظار الدئيئ نحو السماء',
                  },
                  {
                    dialect: 'levantine' as ArabicDialectCode,
                    label: 'نموذج شامي',
                    sample:
                      'زار طلاب المدرسة المرصد الفلكي في مسا صافي لشوفة الكواكب المضوية حط المهندس المنظار الدئيئ صوب السماء',
                  },
                  {
                    dialect: 'maghrebi' as ArabicDialectCode,
                    label: 'نموذج مغاربي',
                    sample:
                      'مشوا طلاب المدرسة المرصد الفلكي في مسا صافي باش الكواكب المضوية حط المهندس المنضار الدقيق نحو السماء',
                  },
                ].map((preset) => (
                  <button
                    key={preset.dialect}
                    type="button"
                    onClick={() => {
                      setSelectedDialect(preset.dialect);
                      setSpokenTranscript(preset.sample);
                      setIsTranscriptPreset(true);
                    }}
                    className="px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-sky-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {speechRecErrorMsg && (
              <div
                role="alert"
                className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                <span>{speechRecErrorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div className="lg:col-span-8">
                {isTranscriptPreset && (
                  <p role="status" className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-relaxed text-amber-950">
                    هذه عينة اصطناعية لاختبار محاذاة اللهجة وليست قراءة طالب. لن تُحسب أو تُحفظ بوصفها عينة فعلية ما لم تستبدلها بنص القراءة المرصود.
                  </p>
                )}
                <label
                  htmlFor="manual-spoken-transcript-input"
                  className="sr-only"
                >
                  النص المنطوق الفعلي للطالب
                </label>
                <input
                  id="manual-spoken-transcript-input"
                  type="text"
                  value={spokenTranscript}
                  onChange={(e) => {
                    setSpokenTranscript(e.target.value);
                    setIsTranscriptPreset(false);
                  }}
                  placeholder="اكتب ما قرأه الطالب فعلًا، أو استخدم التعرف الصوتي بموافقة ولي الأمر..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#0284C7]"
                />
              </div>
              <div className="lg:col-span-4 text-xs text-slate-600 flex flex-wrap items-center justify-end gap-3">
                {liveOralDialectMetrics ? (
                  <>
                    <span>
                      المطابقة:{' '}
                      <strong className="font-mono text-[#059669]">
                        {liveOralDialectMetrics.accuracyPercent}%
                      </strong>
                    </span>
                    <span>
                      بدائل لهجية:{' '}
                      <strong className="font-mono text-[#0284C7]">
                        {liveOralDialectMetrics.dialectVariantCount}
                      </strong>
                    </span>
                    <span>
                      إبدال فونولوجي:{' '}
                      <strong className="font-mono text-[#D97706]">
                        {liveOralDialectMetrics.phoneticSubstitutionCount}
                      </strong>
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    {liveBlinkClinical.clinicalNoteAr}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 3: COMPREHENSION & AI REPORT GENERATION */}
      {stage === 'comprehension' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-900 font-display">
              أسئلة الفهم والاستيعاب القرائي المتدرجة وإصدار تقرير المؤشرات الأولية
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              أجب عن أسئلة الاستيعاب القرائي الـ ({selectedPassage.comprehensionQuestions.length}) لدمجها مع قياسات تتبع العين ({recordedWordsList.length} كلمة مرصودة) ومعدل الرمش ({liveMetrics.blinksPerMinute} رمشة/دقيقة).
            </p>
          </div>

          {comprehensionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#DC2626] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{comprehensionError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {selectedPassage.comprehensionQuestions.map((q, qIdx) => (
              <div
                key={qIdx}
                className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-sky-50 text-[#0284C7] border border-sky-200/80">
                    {q.skillLabelAr || 'مهارة الفهم القرائي'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    سؤال {qIdx + 1} / {selectedPassage.comprehensionQuestions.length}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {qIdx + 1}. {q.question}
                </div>
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <label
                      key={optIdx}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs font-medium transition-colors ${
                        answers[qIdx] === optIdx
                          ? 'bg-white border-[#0284C7] text-slate-900 shadow-2xs'
                          : 'bg-white/70 border-slate-200/80 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`comp-q-${qIdx}`}
                        checked={answers[qIdx] === optIdx}
                        onChange={() => {
                          setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
                          if (comprehensionError) setComprehensionError('');
                        }}
                        className="accent-[#0284C7]"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStage('reading')}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>العودة لشاشة القراءة</span>
            </button>

            <button
              type="button"
              disabled={isAnalyzing}
              onClick={handleFinalizeSession}
              className="px-6 py-3 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isAnalyzing
                  ? 'جاري تحليل مسار العين ومعدل الرمش...'
                  : 'اعتماد الفحص الأولي وإصدار تقرير المؤشرات القرائية'}
              </span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

