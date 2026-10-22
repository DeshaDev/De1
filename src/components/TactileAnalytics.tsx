/**
 * Tactile & Numerical Cognition Analytics System (بصيرة - التحليل اللمسي والحس العددي)
 * Clinical motor latency, subitizing, mental number line estimation, and kinematic jerk analysis
 * Aligned with Siegler & Booth (2004) PAE, Dehaene's Triple-Code Model, and DSM-5 dyscalculia markers
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Hand,
  Target,
  CheckCircle2,
  AlertCircle,
  Timer,
  TrendingUp,
  Activity,
  ArrowRight,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Award,
  Zap,
  HelpCircle,
} from 'lucide-react';
import { useAssessment } from '../contexts/AssessmentContext';

export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
  pressure?: number;
}

export interface DragPathAnalysis {
  points: TouchPoint[];
  startTime: number;
  endTime: number;
  totalDurationMs: number;
  euclideanDistancePx: number;
  actualPathLengthPx: number;
  curvatureRatio: number; // actual / euclidean (>= 1.0)
  hesitationCount: number; // velocity drops or direction reversals
  averageVelocityPxPerMs: number;
  peakVelocityPxPerMs: number;
  normalizedJerkIndex: number;
}

export type TactileTaskType = 'subitizing' | 'number-line' | 'compare-reversals' | 'sort-sequence';

export interface ClinicalTactileTask {
  id: number;
  type: TactileTaskType;
  titleArabic: string;
  instructionArabic: string;
  categoryLabel: string;

  // Subitizing data
  dotCount?: number;
  dotChoices?: number[];

  // Number line data (0 to 100)
  targetNumber?: number;
  lineMin?: number;
  lineMax?: number;

  // Compare reversals (e.g. 34 vs 43 - classic dyscalculia spatial mirror)
  compareNumbers?: [number, number];
  correctGreater?: number;

  // Sequence sorting
  sortNumbers?: number[];
  correctSorted?: number[];
}

export const CLINICAL_TACTILE_TASKS: ClinicalTactileTask[] = [
  // 1. العد الخاطف السريع (Subitizing - Canonical)
  {
    id: 1,
    type: 'subitizing',
    titleArabic: 'العد الخاطف السريع (الحس الكمي الفوري)',
    instructionArabic: 'انظر للنقاط وحدد عددها بأسرع ما يمكن بدون عد تسلسلي',
    categoryLabel: 'العد الخاطف (Subitizing)',
    dotCount: 4,
    dotChoices: [2, 3, 4, 5],
  },

  // 2. خط الأعداد الذهني (Siegler & Booth Mental Number Line - Number 25)
  {
    id: 2,
    type: 'number-line',
    titleArabic: 'تقدير الموضع على خط الأعداد (0 - 100)',
    instructionArabic: 'اسحب المؤشر وحدد موضع العدد (25) على الخط بدقة',
    categoryLabel: 'خط الأعداد الذهني (PAE)',
    targetNumber: 25,
    lineMin: 0,
    lineMax: 100,
  },

  // 3. مقارنة الأعداد المتشابهة معكوسة المكان (Digit Reversals: 34 vs 43)
  {
    id: 3,
    type: 'compare-reversals',
    titleArabic: 'المقارنة السريعة والقيمة المكانية',
    instructionArabic: 'المس العدد الأكبر فوراً (انتبه لترتيب الآحاد والعشرات)',
    categoryLabel: 'التمييز المكاني والستروب',
    compareNumbers: [34, 43],
    correctGreater: 43,
  },

  // 4. خط الأعداد الذهني (Number 67)
  {
    id: 4,
    type: 'number-line',
    titleArabic: 'تقدير الموضع على خط الأعداد (0 - 100)',
    instructionArabic: 'اسحب المؤشر وحدد موضع العدد (67) على الخط بدقة',
    categoryLabel: 'خط الأعداد الذهني (PAE)',
    targetNumber: 67,
    lineMin: 0,
    lineMax: 100,
  },

  // 5. مقارنة أعداد متشابهة رسمًا (69 vs 96)
  {
    id: 5,
    type: 'compare-reversals',
    titleArabic: 'المقارنة السريعة والانعكاس البصري',
    instructionArabic: 'المس العدد الأكبر بأسرع وقت (تمحيص الاتجاه المكاني)',
    categoryLabel: 'الانعكاس البصري',
    compareNumbers: [96, 69],
    correctGreater: 96,
  },

  // 6. الترتيب الحركي التصاعدي اللمسي (Sequence Sorting with Kinematic Jerk)
  {
    id: 6,
    type: 'sort-sequence',
    titleArabic: 'الترتيب التصاعدي الحركي اللمسي',
    instructionArabic: 'اسحب الأعداد بالترتيب من الأصغر إلى الأكبر داخل الصناديق',
    categoryLabel: 'الترتيب والتسلسل الحركي',
    sortNumbers: [14, 5, 29, 8],
    correctSorted: [5, 8, 14, 29],
  },
];

export interface TaskDetailedOutcome {
  taskId: number;
  type: TactileTaskType;
  title: string;
  reactionTimeMs: number;
  completionTimeMs: number;
  isCorrect: boolean;
  userEstimate?: number;
  percentAbsoluteError?: number; // PAE for number-line
  hesitationCount: number;
  pathCurvature: number;
  jerkIndex: number;
  dragPaths: DragPathAnalysis[];
  clinicalNotes: string;
}

export interface TactileAnalyticsProps {
  onComplete?: (results?: any) => void;
  studentName?: string;
  onNavigateTab?: (tab: string) => void;
}

export const TactileAnalytics: React.FC<TactileAnalyticsProps> = ({
  onComplete,
  studentName = 'الطالب',
  onNavigateTab,
}) => {
  const { saveTactileAnalyticsResults } = useAssessment();

  const [stage, setStage] = useState<'intro' | 'instructions' | 'testing' | 'results'>('intro');
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [completedOutcomes, setCompletedOutcomes] = useState<TaskDetailedOutcome[]>([]);

  // Task-specific states
  const [taskStartTime, setTaskStartTime] = useState(0);
  const [firstInteractionTime, setFirstInteractionTime] = useState<number | null>(null);

  // Number line slider state
  const [sliderValue, setSliderValue] = useState<number>(50);
  const [isSliderMoving, setIsSliderMoving] = useState(false);

  // Sequence sorting state
  const [availableNumbers, setAvailableNumbers] = useState<number[]>([]);
  const [sortedSlots, setSortedSlots] = useState<number[]>([]);

  // Drag & drop kinematic tracking
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [currentPathPoints, setCurrentPathPoints] = useState<TouchPoint[]>([]);
  const [sessionPaths, setSessionPaths] = useState<DragPathAnalysis[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentTask = CLINICAL_TACTILE_TASKS[currentTaskIndex];
  const progressPercent = Math.round((currentTaskIndex / CLINICAL_TACTILE_TASKS.length) * 100);

  // Synthesize soft audio chimes for touch events
  const playTouchChime = (freq = 440, type: OscillatorType = 'sine') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch (_) {}
  };

  // Setup task when index changes
  useEffect(() => {
    if (stage === 'testing') {
      const now = Date.now();
      setTaskStartTime(now);
      setFirstInteractionTime(null);
      setSessionPaths([]);
      setCurrentPathPoints([]);

      if (currentTask.type === 'number-line') {
        setSliderValue(50);
      } else if (currentTask.type === 'sort-sequence') {
        setAvailableNumbers([...(currentTask.sortNumbers || [])]);
        setSortedSlots([]);
      }
    }
  }, [currentTaskIndex, stage, currentTask]);

  // Record first interaction time
  const markInteractionOnset = () => {
    if (firstInteractionTime === null) {
      setFirstInteractionTime(Date.now());
    }
  };

  // Kinematic Path Calculation
  const analyzeKinematicPath = (points: TouchPoint[]): DragPathAnalysis => {
    if (points.length < 2) {
      return {
        points,
        startTime: Date.now(),
        endTime: Date.now(),
        totalDurationMs: 0,
        euclideanDistancePx: 0,
        actualPathLengthPx: 0,
        curvatureRatio: 1.0,
        hesitationCount: 0,
        averageVelocityPxPerMs: 0,
        peakVelocityPxPerMs: 0,
        normalizedJerkIndex: 0,
      };
    }

    const start = points[0];
    const end = points[points.length - 1];
    const totalDurationMs = Math.max(1, end.timestamp - start.timestamp);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const euclideanDistancePx = Math.sqrt(dx * dx + dy * dy);

    let actualPathLengthPx = 0;
    let peakVel = 0;
    let hesitationCount = 0;
    const velocities: number[] = [];

    for (let i = 1; i < points.length; i++) {
      const segDx = points[i].x - points[i - 1].x;
      const segDy = points[i].y - points[i - 1].y;
      const segDist = Math.sqrt(segDx * segDx + segDy * segDy);
      const segDt = Math.max(1, points[i].timestamp - points[i - 1].timestamp);

      actualPathLengthPx += segDist;
      const vel = segDist / segDt;
      velocities.push(vel);
      if (vel > peakVel) peakVel = vel;

      // Detect sudden stop/reversal
      if (i > 2) {
        const prevVel = velocities[i - 2];
        if (prevVel > 0.3 && vel < 0.05) {
          hesitationCount++;
        }
      }
    }

    const curvatureRatio = euclideanDistancePx > 5 ? actualPathLengthPx / euclideanDistancePx : 1.0;
    const averageVelocityPxPerMs = actualPathLengthPx / totalDurationMs;

    // Estimate normalized jerk index
    let jerkSum = 0;
    for (let i = 2; i < velocities.length; i++) {
      const accel1 = velocities[i - 1] - velocities[i - 2];
      const accel2 = velocities[i] - velocities[i - 1];
      const jerk = accel2 - accel1;
      jerkSum += jerk * jerk;
    }
    const normalizedJerkIndex = Math.min(100, Math.round((jerkSum / Math.max(1, velocities.length)) * 1000));

    return {
      points,
      startTime: start.timestamp,
      endTime: end.timestamp,
      totalDurationMs,
      euclideanDistancePx: Math.round(euclideanDistancePx),
      actualPathLengthPx: Math.round(actualPathLengthPx),
      curvatureRatio: parseFloat(curvatureRatio.toFixed(2)),
      hesitationCount,
      averageVelocityPxPerMs: parseFloat(averageVelocityPxPerMs.toFixed(3)),
      peakVelocityPxPerMs: parseFloat(peakVel.toFixed(3)),
      normalizedJerkIndex,
    };
  };

  // Canvas drawing for touch trails
  const drawTouchPath = (points: TouchPoint[]) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const dt = Math.max(1, p2.timestamp - p1.timestamp);
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const vel = dist / dt;

      // Color code by velocity: green (smooth), amber (slowing), red (hesitant)
      ctx.strokeStyle = vel > 0.4 ? '#10b981' : vel > 0.15 ? '#f59e0b' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  };

  // Touch and pointer event handlers for drag items
  const handlePointerDown = (e: React.PointerEvent, val?: number) => {
    markInteractionOnset();
    playTouchChime(520);
    setIsDragging(true);
    if (val !== undefined) setDraggedItem(val);

    const rect = e.currentTarget.getBoundingClientRect();
    const point: TouchPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      timestamp: Date.now(),
      pressure: e.pressure,
    };
    setCurrentPathPoints([point]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const point: TouchPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      timestamp: Date.now(),
      pressure: e.pressure,
    };
    setCurrentPathPoints((prev) => {
      const updated = [...prev, point];
      drawTouchPath(updated);
      return updated;
    });
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (currentPathPoints.length >= 2) {
      const analysis = analyzeKinematicPath(currentPathPoints);
      setSessionPaths((prev) => [...prev, analysis]);
    }
  };

  // Subitizing choice selection
  const handleSubitizingChoice = (choice: number) => {
    markInteractionOnset();
    const isCorrect = choice === currentTask.dotCount;
    playTouchChime(isCorrect ? 660 : 330);

    const now = Date.now();
    const reactionTime = (firstInteractionTime || now) - taskStartTime;
    const completionTime = now - taskStartTime;

    const outcome: TaskDetailedOutcome = {
      taskId: currentTask.id,
      type: currentTask.type,
      title: currentTask.titleArabic,
      reactionTimeMs: reactionTime,
      completionTimeMs: completionTime,
      isCorrect,
      hesitationCount: reactionTime > 1500 ? 1 : 0,
      pathCurvature: 1.0,
      jerkIndex: 0,
      dragPaths: [],
      clinicalNotes: isCorrect
        ? reactionTime < 900
          ? 'إدراك فوري خاطف ممتاز (Subitizing طبيعي)'
          : 'إجابة صحيحة مع استغراق وقت للعد البطيء'
        : 'صعوبة في التمييز الكمي الفوري للأعداد الصغيرة',
    };

    finalizeTaskStep(outcome);
  };

  // Number line submission
  const handleNumberLineSubmit = () => {
    markInteractionOnset();
    const target = currentTask.targetNumber || 50;
    const userEst = sliderValue;
    const range = (currentTask.lineMax || 100) - (currentTask.lineMin || 0);

    // Siegler & Booth (2004) Percent Absolute Error (PAE)
    const pae = Math.round((Math.abs(userEst - target) / range) * 100);
    const isCorrect = pae <= 10; // Nominal tolerance <= 10% PAE
    playTouchChime(isCorrect ? 660 : 350);

    const now = Date.now();
    const reactionTime = (firstInteractionTime || now) - taskStartTime;
    const completionTime = now - taskStartTime;

    const avgCurvature = sessionPaths.length
      ? sessionPaths.reduce((acc, p) => acc + p.curvatureRatio, 0) / sessionPaths.length
      : 1.0;
    const totalHesitations = sessionPaths.reduce((acc, p) => acc + p.hesitationCount, 0);
    const avgJerk = sessionPaths.length
      ? Math.round(sessionPaths.reduce((acc, p) => acc + p.normalizedJerkIndex, 0) / sessionPaths.length)
      : 0;

    const outcome: TaskDetailedOutcome = {
      taskId: currentTask.id,
      type: currentTask.type,
      title: currentTask.titleArabic,
      reactionTimeMs: reactionTime,
      completionTimeMs: completionTime,
      isCorrect,
      userEstimate: userEst,
      percentAbsoluteError: pae,
      hesitationCount: totalHesitations,
      pathCurvature: parseFloat(avgCurvature.toFixed(2)),
      jerkIndex: avgJerk,
      dragPaths: sessionPaths,
      clinicalNotes:
        pae <= 7
          ? 'تمثيل ذهني خطي دقيق (PAE منخفض جدًا)'
          : pae <= 15
          ? 'انحراف مكاني معتدل على خط الأعداد'
          : 'تشوه لوغاريتمي أو ضغط مكاني حاد (مؤشر ديسكالكوليا)',
    };

    finalizeTaskStep(outcome);
  };

  // Compare reversals selection
  const handleCompareReversal = (chosenNumber: number) => {
    markInteractionOnset();
    const correct = chosenNumber === currentTask.correctGreater;
    playTouchChime(correct ? 660 : 330);

    const now = Date.now();
    const reactionTime = (firstInteractionTime || now) - taskStartTime;
    const completionTime = now - taskStartTime;

    const outcome: TaskDetailedOutcome = {
      taskId: currentTask.id,
      type: currentTask.type,
      title: currentTask.titleArabic,
      reactionTimeMs: reactionTime,
      completionTimeMs: completionTime,
      isCorrect: correct,
      hesitationCount: reactionTime > 1800 ? 1 : 0,
      pathCurvature: 1.0,
      jerkIndex: 0,
      dragPaths: [],
      clinicalNotes: correct
        ? 'تمييز سليم للقيمة المكانية للآحاد والعشرات'
        : 'خلط وانعكاس مكاني للعدد (Spatial Digit Reversal)',
    };

    finalizeTaskStep(outcome);
  };

  // Sorting sequence: click or drop number into slot
  const handleSlotNumber = (num: number) => {
    markInteractionOnset();
    playTouchChime(580);
    setAvailableNumbers((prev) => prev.filter((n) => n !== num));
    setSortedSlots((prev) => [...prev, num]);
  };

  const handleResetSorting = () => {
    setAvailableNumbers([...(currentTask.sortNumbers || [])]);
    setSortedSlots([]);
  };

  const handleSortingSubmit = () => {
    const correctTarget = currentTask.correctSorted || [];
    const isCorrect = JSON.stringify(sortedSlots) === JSON.stringify(correctTarget);
    playTouchChime(isCorrect ? 660 : 350);

    const now = Date.now();
    const reactionTime = (firstInteractionTime || now) - taskStartTime;
    const completionTime = now - taskStartTime;

    const avgCurvature = sessionPaths.length
      ? sessionPaths.reduce((acc, p) => acc + p.curvatureRatio, 0) / sessionPaths.length
      : 1.1;
    const totalHesitations = sessionPaths.reduce((acc, p) => acc + p.hesitationCount, 0);
    const avgJerk = sessionPaths.length
      ? Math.round(sessionPaths.reduce((acc, p) => acc + p.normalizedJerkIndex, 0) / sessionPaths.length)
      : 15;

    const outcome: TaskDetailedOutcome = {
      taskId: currentTask.id,
      type: currentTask.type,
      title: currentTask.titleArabic,
      reactionTimeMs: reactionTime,
      completionTimeMs: completionTime,
      isCorrect,
      hesitationCount: totalHesitations,
      pathCurvature: parseFloat(avgCurvature.toFixed(2)),
      jerkIndex: avgJerk,
      dragPaths: sessionPaths,
      clinicalNotes: isCorrect
        ? 'تسلسل منطقي حركي سليم للأعداد'
        : 'اضطراب في الترتيب التسلسلي أو استدعاء القيمة العددية',
    };

    finalizeTaskStep(outcome);
  };

  // Step advancement
  const finalizeTaskStep = (outcome: TaskDetailedOutcome) => {
    const updated = [...completedOutcomes.filter((o) => o.taskId !== outcome.taskId), outcome];
    setCompletedOutcomes(updated);

    if (currentTaskIndex < CLINICAL_TACTILE_TASKS.length - 1) {
      setCurrentTaskIndex((prev) => prev + 1);
    } else {
      finishAnalytics(updated);
    }
  };

  // Save results to AssessmentContext
  const finishAnalytics = (allOutcomes: TaskDetailedOutcome[]) => {
    setStage('results');

    const totalTasks = allOutcomes.length || 1;
    const correctCount = allOutcomes.filter((o) => o.isCorrect).length;
    const avgReactionTimeSec =
      allOutcomes.reduce((acc, o) => acc + o.reactionTimeMs, 0) / (totalTasks * 1000);
    const totalHesitations = allOutcomes.reduce((acc, o) => acc + o.hesitationCount, 0);

    const weakAreas: string[] = [];
    allOutcomes.forEach((o) => {
      if (!o.isCorrect) {
        if (o.type === 'subitizing') weakAreas.push('العد الخاطف السريع (Subitizing)');
        if (o.type === 'number-line') weakAreas.push('خط الأعداد والتمثيل الذهني للكميات');
        if (o.type === 'compare-reversals') weakAreas.push('الانعكاس البصري والقيمة المكانية');
        if (o.type === 'sort-sequence') weakAreas.push('التسلسل العددي والذاكرة العاملة');
      }
    });

    const contextPayload = {
      summary: {
        averageReactionTime: parseFloat(avgReactionTimeSec.toFixed(2)),
        correctAnswers: correctCount,
        totalTasks,
        hesitationCount: totalHesitations,
        weakAreas: Array.from(new Set(weakAreas)),
      },
      tasks: allOutcomes,
    };

    saveTactileAnalyticsResults(allOutcomes);

    if (onComplete) {
      onComplete(contextPayload);
    }
  };

  // --------------------------------------------------------------------------
  // RENDER SECTIONS
  // --------------------------------------------------------------------------

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 select-none font-sans" dir="rtl">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-slate-200 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 mb-2">
            <Zap className="w-3.5 h-3.5" />
            فحص الحس العددي والتفاعل اللمسي السريري
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            مختبر التحليل اللمسي والحس العددي (بصيرة)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            رصد زمن الاستجابة، العد الخاطف، خط الأعداد (PAE)، ورعشة التردد الحركي (Kinematic Jerk) للطالب:{' '}
            <span className="font-bold text-indigo-700">{studentName}</span>
          </p>
        </div>

        {stage === 'testing' && (
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm self-start md:self-auto">
            <span className="text-xs text-slate-500 font-medium">التقدم:</span>
            <div className="w-28 bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-700 font-mono">
              {currentTaskIndex + 1} / {CLINICAL_TACTILE_TASKS.length}
            </span>
          </div>
        )}
      </div>

      {/* ----------------- STAGE 1: INTRO ----------------- */}
      {stage === 'intro' && (
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-xl text-center max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Hand className="w-10 h-10" />
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-4">
            مرحباً بك في فحص الحس العددي والتفاعل اللمسي
          </h2>

          <p className="text-slate-600 leading-relaxed mb-8">
            يقيس هذا الاختبار الكفاءة العددية الأساسية ومؤشرات عسر الحساب (Dyscalculia) من خلال
            أربع مهام تفاعلية: العد الخاطف الفوري، خط الأعداد الذهني وفق مقياس Siegler، المقارنة السريعة
            للأعداد المعكوسة (34 vs 43)، وتحليل انسيابية حركة الإصبع (Jerk & Curvature).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-right">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-indigo-700 font-black text-lg mb-1">Subitizing</div>
              <div className="text-xs text-slate-600">العد الخاطف السريع دون الحاجة للعد التسلسلي</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-indigo-700 font-black text-lg mb-1">Siegler PAE</div>
              <div className="text-xs text-slate-600">نسبة الخطأ المطلق على خط الأعداد الذهني</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-indigo-700 font-black text-lg mb-1">Kinematic Jerk</div>
              <div className="text-xs text-slate-600">قياس تردد وتردد حركة الإصبع اللمسية</div>
            </div>
          </div>

          <button
            onClick={() => setStage('instructions')}
            className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 mx-auto text-lg"
          >
            <span>بدء التعليمات والاستعداد</span>
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ----------------- STAGE 2: INSTRUCTIONS ----------------- */}
      {stage === 'instructions' && (
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-xl max-w-2xl mx-auto">
          <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">
            إرشادات التفاعل اللمسي
          </h2>

          <div className="space-y-4 mb-8 text-right">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                1
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">استجب بأسرع ما يمكنك</h4>
                <p className="text-xs text-slate-600">
                  يقيس النظام زمن رد الفعل بالميلي ثانية، لذا المس الإجابة بمجرد إدراكك لها.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-teal-50/70 border border-teal-100">
              <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                2
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">اسحب بسلاسة وثبات</h4>
                <p className="text-xs text-slate-600">
                  عند سحب المؤشر أو ترتيب الأرقام، حافظ على حركة مستمرة لتقليل مؤشر الرعشة الحركية.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStage('testing')}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition-all text-lg flex items-center justify-center gap-2"
          >
            <span>جاهز، ابدأ الاختبار الآن!</span>
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ----------------- STAGE 3: ACTIVE TASKS ----------------- */}
      {stage === 'testing' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12 shadow-xl max-w-3xl mx-auto flex flex-col items-center">
          {/* Task Category & Instruction Badge */}
          <div className="w-full flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {currentTask.categoryLabel}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              المهمة {currentTaskIndex + 1} من {CLINICAL_TACTILE_TASKS.length}
            </span>
          </div>

          <h3 className="text-2xl font-black text-slate-900 mb-2 text-center">
            {currentTask.titleArabic}
          </h3>
          <p className="text-sm text-slate-600 mb-8 text-center max-w-lg">
            {currentTask.instructionArabic}
          </p>

          {/* TASK TYPE 1: SUBITIZING (RAPID DOT ARRAY) */}
          {currentTask.type === 'subitizing' && (
            <div className="w-full flex flex-col items-center">
              {/* Canonical Dot Matrix */}
              <div className="w-64 h-48 bg-slate-50 border-2 border-dashed border-indigo-200 rounded-3xl flex items-center justify-center p-6 mb-8 relative shadow-inner">
                <div className="grid grid-cols-2 gap-6 items-center justify-center">
                  {Array.from({ length: currentTask.dotCount || 4 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="w-10 h-10 rounded-full bg-indigo-600 shadow-md shadow-indigo-600/40 transform transition-transform hover:scale-105"
                    />
                  ))}
                </div>
              </div>

              {/* Number Choice Buttons */}
              <div className="grid grid-cols-4 gap-4 w-full max-w-md">
                {(currentTask.dotChoices || [1, 2, 3, 4]).map((choice) => (
                  <button
                    key={choice}
                    onClick={() => handleSubitizingChoice(choice)}
                    className="py-5 bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-2xl font-black text-3xl text-slate-800 hover:text-indigo-700 shadow-sm transition-all transform active:scale-95"
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TASK TYPE 2: NUMBER LINE (SIEGLER 0 - 100) */}
          {currentTask.type === 'number-line' && (
            <div
              className="w-full flex flex-col items-center relative py-4"
              onPointerDown={() => markInteractionOnset()}
            >
              {/* Target Number Display */}
              <div className="mb-6 px-6 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-center">
                <span className="text-xs text-indigo-700 font-bold block mb-0.5">
                  العدد المطلوب تحديده:
                </span>
                <span className="text-5xl font-black text-indigo-900 font-mono">
                  {currentTask.targetNumber}
                </span>
              </div>

              {/* Interactive Number Line Canvas Container */}
              <div className="w-full max-w-xl px-4 py-8 bg-slate-50 rounded-3xl border border-slate-200 relative mb-8">
                {/* Visual Number Line Bar */}
                <div className="relative w-full h-3 bg-slate-200 rounded-full my-6">
                  {/* Ticks at 0, 50, 100 */}
                  <div className="absolute top-0 right-0 w-1 h-6 bg-slate-400 -translate-y-1.5" />
                  <div className="absolute top-0 right-1/2 w-1 h-4 bg-slate-300 -translate-y-0.5" />
                  <div className="absolute top-0 left-0 w-1 h-6 bg-slate-400 -translate-y-1.5" />

                  {/* Dynamic Target Point Indicator on Slider */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-600 rounded-full border-4 border-white shadow-lg pointer-events-none transition-all"
                    style={{ right: `${100 - sliderValue}%` }}
                  />
                </div>

                {/* Range Input Slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderValue}
                  onChange={(e) => {
                    markInteractionOnset();
                    setSliderValue(Number(e.target.value));
                  }}
                  onPointerDown={(e) => handlePointerDown(e)}
                  onPointerMove={(e) => handlePointerMove(e)}
                  onPointerUp={handlePointerUp}
                  className="w-full h-8 opacity-0 absolute top-1/2 -translate-y-1/2 right-0 cursor-pointer z-10"
                />

                {/* Labels at Extremes (RTL: 0 on right or 0 on left) */}
                <div className="flex justify-between items-center text-sm font-bold text-slate-500 font-mono px-1">
                  <span>0</span>
                  <span className="text-xs text-slate-400">50</span>
                  <span>100</span>
                </div>
              </div>

              <button
                onClick={handleNumberLineSubmit}
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 text-base"
              >
                <span>تأكيد الموضع</span>
                <CheckCircle2 className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* TASK TYPE 3: COMPARE REVERSALS (34 VS 43) */}
          {currentTask.type === 'compare-reversals' && (
            <div className="w-full flex flex-col items-center">
              <div className="grid grid-cols-2 gap-8 w-full max-w-md my-4">
                {(currentTask.compareNumbers || [34, 43]).map((num) => (
                  <button
                    key={num}
                    onClick={() => handleCompareReversal(num)}
                    className="py-12 px-6 bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl font-black text-6xl font-mono text-slate-900 hover:text-indigo-700 shadow-md transition-all transform active:scale-95"
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TASK TYPE 4: SORT SEQUENCE WITH KINEMATIC CANVAS */}
          {currentTask.type === 'sort-sequence' && (
            <div className="w-full flex flex-col items-center">
              {/* Dropped / Sorted Target Slots */}
              <div className="w-full max-w-lg mb-8">
                <span className="text-xs text-slate-500 font-bold block mb-2 text-center">
                  الصناديق المرتبة تصاعديًا (من الأصغر للأكبر):
                </span>
                <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-3xl border border-slate-200 min-h-[90px] items-center">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const slottedVal = sortedSlots[slotIdx];
                    return (
                      <div
                        key={slotIdx}
                        className={`h-16 rounded-2xl border-2 flex items-center justify-center font-black text-2xl font-mono transition-all ${
                          slottedVal !== undefined
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                            : 'bg-white border-dashed border-slate-300 text-slate-300'
                        }`}
                      >
                        {slottedVal !== undefined ? slottedVal : slotIdx + 1}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Available Clickable / Draggable Number Tiles */}
              <div className="w-full max-w-lg mb-6">
                <span className="text-xs text-slate-500 font-bold block mb-2 text-center">
                  المس الرقم التالي بالترتيب:
                </span>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {availableNumbers.map((num) => (
                    <button
                      key={num}
                      onClick={() => handleSlotNumber(num)}
                      className="w-16 h-16 bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-2xl font-black text-2xl font-mono text-slate-800 hover:text-indigo-700 shadow-sm transition-all transform active:scale-95 flex items-center justify-center"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset or Submit Buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleResetSorting}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  إعادة الترتيب
                </button>

                <button
                  onClick={handleSortingSubmit}
                  disabled={sortedSlots.length !== (currentTask.sortNumbers?.length || 4)}
                  className={`px-8 py-3.5 rounded-2xl font-bold transition-all flex items-center gap-2 ${
                    sortedSlots.length === (currentTask.sortNumbers?.length || 4)
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>تأكيد الترتيب</span>
                  <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Hidden Canvas for Drawing Kinematic Traces */}
          <canvas ref={canvasRef} width={400} height={200} className="hidden" />
        </div>
      )}

      {/* ----------------- STAGE 4: RESULTS REPORT ----------------- */}
      {stage === 'results' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Top Banner */}
          <div className="bg-gradient-to-br from-indigo-700 via-purple-700 to-slate-900 rounded-3xl p-8 md:p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur mb-2 inline-block">
                  تقرير التقييم اللمسي والحس العددي المكتمل
                </span>
                <h2 className="text-3xl font-black mb-1">نتائج الفحص العددي: {studentName}</h2>
                <p className="text-sm text-indigo-100">
                  تم اختبار 6 مهام إكلينيكية للحس العددي، خط الأعداد (PAE)، وتماسك الحركة اللمسية
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 text-center">
                <span className="text-xs text-indigo-200 block">دقة الحس العددي</span>
                <span className="text-3xl font-black font-mono">
                  {Math.round(
                    (completedOutcomes.filter((o) => o.isCorrect).length /
                      (completedOutcomes.length || 1)) *
                      100
                  )}
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                المهام المنجزة بنجاح
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-600 font-mono">
                  {completedOutcomes.filter((o) => o.isCorrect).length}
                </span>
                <span className="text-xs text-slate-400">من {completedOutcomes.length}</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                متوسط زمن رد الفعل الحركي
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800 font-mono">
                  {(
                    completedOutcomes.reduce((acc, o) => acc + o.reactionTimeMs, 0) /
                    (completedOutcomes.length * 1000 || 1)
                  ).toFixed(2)}
                </span>
                <span className="text-xs text-slate-400">ثانية</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                متوسط خطأ خط الأعداد (PAE)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600 font-mono">
                  {Math.round(
                    completedOutcomes
                      .filter((o) => o.percentAbsoluteError !== undefined)
                      .reduce((acc, o) => acc + (o.percentAbsoluteError || 0), 0) /
                      (completedOutcomes.filter((o) => o.percentAbsoluteError !== undefined).length ||
                        1)
                  )}
                  %
                </span>
                <span className="text-xs text-slate-400">(معيار &lt; 10%)</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                إجمالي ترددات المسار اللمسي
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-purple-600 font-mono">
                  {completedOutcomes.reduce((acc, o) => acc + o.hesitationCount, 0)}
                </span>
                <span className="text-xs text-slate-400">توقف/ارتداد</span>
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-4">
              التفصيل الإكلينيكي لمهام الحس العددي
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-400 uppercase">
                    <th className="py-3 px-4 font-bold">المهمة</th>
                    <th className="py-3 px-4 font-bold">النوع</th>
                    <th className="py-3 px-4 font-bold">زمن رد الفعل</th>
                    <th className="py-3 px-4 font-bold">خطأ PAE / النتيجة</th>
                    <th className="py-3 px-4 font-bold">الملاحظة السريرية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedOutcomes.map((outcome) => (
                    <tr key={outcome.taskId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{outcome.title}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-mono">
                        {outcome.type}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                        {outcome.reactionTimeMs} ms
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            outcome.isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {outcome.percentAbsoluteError !== undefined
                            ? `PAE: ${outcome.percentAbsoluteError}%`
                            : outcome.isCorrect
                            ? 'صحيح ✓'
                            : 'يحتاج تدريب ⚠'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">{outcome.clinicalNotes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <button
              onClick={() => {
                setStage('testing');
                setCurrentTaskIndex(0);
              }}
              className="px-6 py-3 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة الاختبار</span>
            </button>

            <button
              onClick={() => {
                if (onNavigateTab) {
                  onNavigateTab('adaptive-reports');
                } else if (onComplete) {
                  onComplete();
                }
              }}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-3 text-lg"
            >
              <span>المتابعة إلى التقارير الذكية التكيفية وخطة التدخل</span>
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TactileAnalytics;
