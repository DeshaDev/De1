/**
 * Early-stage screening prototypes:
 * 1. I-DT-style dispersion-threshold gaze-event extraction implemented in this repository.
 * 2. Hand-authored heuristic rules, not a trained Random Forest/RNN or a third-party company's model.
 * 3. Arabic phonological/orthographic comparison and an experimental IRT-style item-selection demo.
 * The item parameters and risk thresholds have not been calibrated on representative student data.
 */

// ============================================================================
// 1. REPOSITORY-IMPLEMENTED I-DT-STYLE OCULOMOTOR EVENT EXTRACTION
// ============================================================================

export interface RawGazeSample {
  x: number;
  y: number;
  timestampMs: number;
  wordIndex?: number | null;
  confidence?: number;
}

export interface DetectedFixationEvent {
  id: number;
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  centroidX: number;
  centroidY: number;
  dispersionPx: number;
  sampleCount: number;
  wordIndex: number | null;
}

export interface DetectedSaccadeEvent {
  id: number;
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  amplitudePx: number;
  peakVelocityPxPerSec: number;
  direction: 'forward' | 'regressive' | 'line_sweep';
  fromWordIndex: number | null;
  toWordIndex: number | null;
}

export interface OculomotorFeatureVector {
  fixationCount: number;
  meanFixationDurationMs: number;
  stdFixationDurationMs: number;
  p90FixationDurationMs: number;
  saccadeCount: number;
  forwardSaccadeCount: number;
  regressiveSaccadeCount: number;
  regressionRatePercent: number;
  regressionsPer100Words: number;
  meanSaccadeAmplitudePx: number;
  totalScanpathLengthPx: number;
  temporalDurationAutocorrelation: number;
}

export interface HeuristicRuleVote {
  ruleId: number;
  ruleNameAr: string;
  primaryFeature: string;
  normalizedRuleScore: number;
  decisionPathAr: string;
}

export interface OculomotorHeuristicResult {
  heuristicRiskScore: number; // 0..100 heuristic risk score
  classification: 'nominal' | 'moderate_risk' | 'high_dyslexia_risk';
  classificationLabelAr: string;
  modelArchitectureType: 'heuristic_rule_ensemble';
  clinicalValidationDisclaimerAr: string;
  ruleVotes: HeuristicRuleVote[];
  temporalHeuristicScore: number; // 0..100 temporal sequence instability
  weightedIndicators: {
    featureNameAr: string;
    weightPercent: number;
    observedValue: string;
    heuristicReferenceRange: string;
  }[];
  features: OculomotorFeatureVector;
  fixations: DetectedFixationEvent[];
  saccades: DetectedSaccadeEvent[];
}

export interface OculomotorDetectionOptions {
  minFixationDurationMs?: number; // Default 120ms (clinical reading threshold)
  maxDispersionPx?: number; // Default 45px (~1.2 deg visual angle)
  readingDirection?: 'rtl' | 'ltr'; // Default 'rtl' for Arabic
}

/**
 * Repository implementation inspired by dispersion-threshold and velocity-threshold
 * event-detection approaches (I-DT/I-VT); this is not the PyGaze or GazeParser package.
 */
export function detectOculomotorEventsIDTStyle(
  samples: RawGazeSample[],
  options?: OculomotorDetectionOptions
): {
  fixations: DetectedFixationEvent[];
  saccades: DetectedSaccadeEvent[];
} {
  const minDur = options?.minFixationDurationMs ?? 120;
  const maxDisp = options?.maxDispersionPx ?? 45;
  const dir = options?.readingDirection ?? 'rtl';

  if (!samples || samples.length < 2) {
    return { fixations: [], saccades: [] };
  }

  // Sort chronologically
  const sorted = [...samples].sort((a, b) => a.timestampMs - b.timestampMs);
  const fixations: DetectedFixationEvent[] = [];

  const calcDispersion = (windowSamples: RawGazeSample[]): number => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const s of windowSamples) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    return maxX - minX + (maxY - minY);
  };

  let i = 0;
  while (i < sorted.length) {
    // Expand window until duration >= minDur
    let j = i;
    while (
      j < sorted.length &&
      sorted[j].timestampMs - sorted[i].timestampMs < minDur
    ) {
      j++;
    }

    if (j >= sorted.length) {
      break;
    }

    let windowSlice = sorted.slice(i, j + 1);
    if (calcDispersion(windowSlice) <= maxDisp) {
      // Expand window as long as dispersion remains within maxDisp
      while (j + 1 < sorted.length) {
        const candidateSlice = sorted.slice(i, j + 2);
        if (calcDispersion(candidateSlice) <= maxDisp) {
          j++;
          windowSlice = candidateSlice;
        } else {
          break;
        }
      }

      const startTimeMs = windowSlice[0].timestampMs;
      const endTimeMs = windowSlice[windowSlice.length - 1].timestampMs;
      const durationMs = Math.max(minDur, Math.round(endTimeMs - startTimeMs));
      const centroidX =
        Math.round(
          (windowSlice.reduce((acc, s) => acc + s.x, 0) / windowSlice.length) *
            10
        ) / 10;
      const centroidY =
        Math.round(
          (windowSlice.reduce((acc, s) => acc + s.y, 0) / windowSlice.length) *
            10
        ) / 10;
      const dispersionPx = Math.round(calcDispersion(windowSlice) * 10) / 10;

      // Majority vote for wordIndex during fixation window
      const wordCounts = new Map<number, number>();
      for (const s of windowSlice) {
        if (typeof s.wordIndex === 'number' && s.wordIndex >= 0) {
          wordCounts.set(s.wordIndex, (wordCounts.get(s.wordIndex) || 0) + 1);
        }
      }
      let dominantWordIdx: number | null = null;
      let bestCount = 0;
      for (const [wIdx, cnt] of wordCounts.entries()) {
        if (cnt > bestCount) {
          bestCount = cnt;
          dominantWordIdx = wIdx;
        }
      }

      fixations.push({
        id: fixations.length + 1,
        startTimeMs,
        endTimeMs,
        durationMs,
        centroidX,
        centroidY,
        dispersionPx,
        sampleCount: windowSlice.length,
        wordIndex: dominantWordIdx,
      });

      i = j + 1;
    } else {
      i++;
    }
  }

  // Construct Saccades between consecutive Fixations
  const saccades: DetectedSaccadeEvent[] = [];
  for (let k = 0; k < fixations.length - 1; k++) {
    const f1 = fixations[k];
    const f2 = fixations[k + 1];
    const dx = f2.centroidX - f1.centroidX;
    const dy = f2.centroidY - f1.centroidY;
    const amplitudePx = Math.round(Math.hypot(dx, dy) * 10) / 10;
    const durationMs = Math.max(16, Math.round(f2.startTimeMs - f1.endTimeMs));
    const peakVelocityPxPerSec = Math.round(
      (amplitudePx / (durationMs / 1000)) * 1.65
    );

    let direction: 'forward' | 'regressive' | 'line_sweep' = 'forward';
    if (Math.abs(dy) > 48 && Math.abs(dx) > 120) {
      // Line return sweep
      direction = 'line_sweep';
    } else if (
      typeof f1.wordIndex === 'number' &&
      typeof f2.wordIndex === 'number' &&
      f1.wordIndex !== f2.wordIndex
    ) {
      direction = f2.wordIndex < f1.wordIndex ? 'regressive' : 'forward';
    } else {
      // Coordinate-based progression: in RTL (Arabic), reading moves right-to-left (dx < 0)
      if (dir === 'rtl') {
        direction = dx > 14 ? 'regressive' : 'forward';
      } else {
        direction = dx < -14 ? 'regressive' : 'forward';
      }
    }

    saccades.push({
      id: k + 1,
      startTimeMs: f1.endTimeMs,
      endTimeMs: f2.startTimeMs,
      durationMs,
      startX: f1.centroidX,
      startY: f1.centroidY,
      endX: f2.centroidX,
      endY: f2.centroidY,
      amplitudePx,
      peakVelocityPxPerSec,
      direction,
      fromWordIndex: f1.wordIndex,
      toWordIndex: f2.wordIndex,
    });
  }

  return { fixations, saccades };
}

/**
 * Extracts oculomotor features and applies five manually weighted heuristic rules.
 * This is not a trained machine-learning model or a reproduction of any vendor architecture.
 */
export function runOculomotorHeuristicInference(
  samples: RawGazeSample[],
  wordCount: number = 25,
  options?: OculomotorDetectionOptions
): OculomotorHeuristicResult {
  const { fixations, saccades } = detectOculomotorEventsIDTStyle(samples, options);

  const durations = fixations.map((f) => f.durationMs);
  const fixationCount = fixations.length;
  const meanFixationDurationMs =
    fixationCount > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / fixationCount)
      : 0;

  const variance =
    fixationCount > 1
      ? durations.reduce(
          (acc, d) => acc + Math.pow(d - meanFixationDurationMs, 2),
          0
        ) / fixationCount
      : 0;
  const stdFixationDurationMs = Math.round(Math.sqrt(variance));

  const sortedDurations = [...durations].sort((a, b) => a - b);
  const p90FixationDurationMs =
    sortedDurations.length > 0
      ? sortedDurations[Math.floor(sortedDurations.length * 0.9)]
      : 0;

  const saccadeCount = saccades.length;
  const regressiveSaccadeCount = saccades.filter(
    (s) => s.direction === 'regressive'
  ).length;
  const forwardSaccadeCount = saccades.filter(
    (s) => s.direction === 'forward'
  ).length;

  const regressionRatePercent =
    saccadeCount > 0
      ? Math.round((regressiveSaccadeCount / saccadeCount) * 1000) / 10
      : 0;

  const regressionsPer100Words =
    wordCount > 0
      ? Math.round((regressiveSaccadeCount / wordCount) * 100 * 10) / 10
      : 0;

  const totalScanpathLengthPx = Math.round(
    saccades.reduce((acc, s) => acc + s.amplitudePx, 0)
  );
  const meanSaccadeAmplitudePx =
    saccadeCount > 0 ? Math.round(totalScanpathLengthPx / saccadeCount) : 0;

  // Compute temporal sequence lag-1 autocorrelation & recurrent state gate
  let temporalDurationAutocorrelation = 0;
  if (durations.length >= 3 && variance > 1) {
    let cov = 0;
    for (let i = 0; i < durations.length - 1; i++) {
      cov +=
        (durations[i] - meanFixationDurationMs) *
        (durations[i + 1] - meanFixationDurationMs);
    }
    temporalDurationAutocorrelation =
      Math.round((cov / ((durations.length - 1) * variance)) * 100) / 100;
  }

  // Exponentially smoothed heuristic state over fixation durations and regressions (not an RNN).
  let hiddenState = 0.25;
  for (let i = 0; i < fixations.length; i++) {
    const durNorm = Math.min(1, Math.max(0, (fixations[i].durationMs - 200) / 350));
    const isReg =
      i > 0 && saccades[i - 1]?.direction === 'regressive' ? 1.0 : 0.0;
    const inputGate = 0.65 * durNorm + 0.35 * isReg;
    hiddenState = 0.6 * hiddenState + 0.4 * inputGate;
  }
  const temporalHeuristicScore = Math.round(
    Math.min(99, Math.max(4, hiddenState * 100))
  );

  const features: OculomotorFeatureVector = {
    fixationCount,
    meanFixationDurationMs,
    stdFixationDurationMs,
    p90FixationDurationMs,
    saccadeCount,
    forwardSaccadeCount,
    regressiveSaccadeCount,
    regressionRatePercent,
    regressionsPer100Words,
    meanSaccadeAmplitudePx,
    totalScanpathLengthPx,
    temporalDurationAutocorrelation,
  };

  // Five hand-authored heuristic rules; thresholds and weights are not clinically calibrated.
  // Rule 1: Fixation-duration thresholds (Lexical & Phonological Processing Latency)
  const rule1Score =
    meanFixationDurationMs >= 380
      ? 0.88
      : meanFixationDurationMs >= 310
        ? 0.62
        : meanFixationDurationMs >= 260
          ? 0.35
          : 0.12;
  const rule1Vote: HeuristicRuleVote = {
    ruleId: 1,
    ruleNameAr: 'شجرة القرار ١: كمون التثبيت البؤري (Fixation Latency)',
    primaryFeature: 'meanFixationDurationMs',
    normalizedRuleScore: rule1Score,
    decisionPathAr:
      meanFixationDurationMs >= 310
        ? `زمن التثبيت (${meanFixationDurationMs}ms > 310ms) يشير لبطء فك الترميز الفونولوجي`
        : `زمن التثبيت (${meanFixationDurationMs}ms <= 310ms) أقل من العتبة الاسترشادية المحددة`,
  };

  // Rule 2: Regressive-saccade density
  const rule2Score =
    regressionRatePercent >= 28
      ? 0.91
      : regressionRatePercent >= 19
        ? 0.64
        : regressionRatePercent >= 12
          ? 0.32
          : 0.10;
  const rule2Vote: HeuristicRuleVote = {
    ruleId: 2,
    ruleNameAr: 'شجرة القرار ٢: كثافة القفزات التراجعية (Regressive Saccades)',
    primaryFeature: 'regressionRatePercent',
    normalizedRuleScore: rule2Score,
    decisionPathAr:
      regressionRatePercent >= 19
        ? `نسبة التراجع (${regressionRatePercent}% >= 19%) تعكس إعادة قراءة الحروف المتشابهة`
        : `نسبة التراجع (${regressionRatePercent}% < 19%) أقل من العتبة الاسترشادية المضمّنة`,
  };

  // Rule 3: Upper-tail fixation duration
  const rule3Score =
    p90FixationDurationMs >= 520
      ? 0.86
      : p90FixationDurationMs >= 390
        ? 0.58
        : 0.15;
  const rule3Vote: HeuristicRuleVote = {
    ruleId: 3,
    ruleNameAr: 'شجرة القرار ٣: ذروة التثبيتات المطوّلة (P90 Lexical Bottleneck)',
    primaryFeature: 'p90FixationDurationMs',
    normalizedRuleScore: rule3Score,
    decisionPathAr:
      p90FixationDurationMs >= 390
        ? `الرتبة المئوية ٩٠ داخل عينة الجلسة (${p90FixationDurationMs}ms) يكشف تعثراً في الكلمات المركبة`
        : `الرتبة المئوية ٩٠ داخل عينة الجلسة (${p90FixationDurationMs}ms) متوازن عبر النص`,
  };

  // Rule 4: Saccade amplitude
  const rule4Score =
    meanSaccadeAmplitudePx > 0 && meanSaccadeAmplitudePx <= 55
      ? 0.78
      : meanSaccadeAmplitudePx <= 80
        ? 0.48
        : 0.16;
  const rule4Vote: HeuristicRuleVote = {
    ruleId: 4,
    ruleNameAr: 'شجرة القرار ٤: مدى القفزة البصرية والتزاحم (Saccadic Span)',
    primaryFeature: 'meanSaccadeAmplitudePx',
    normalizedRuleScore: rule4Score,
    decisionPathAr:
      meanSaccadeAmplitudePx > 0 && meanSaccadeAmplitudePx <= 65
        ? `قصر مدى القفزة (${meanSaccadeAmplitudePx}px) يشير لقراءة حرفية مجزأة`
        : `مدى القفزة (${meanSaccadeAmplitudePx}px) يغطي مقاطع كاملة بكفاءة`,
  };

  // Rule 5: Smoothed temporal heuristic state
  const rule5Score = temporalHeuristicScore / 100;
  const rule5Vote: HeuristicRuleVote = {
    ruleId: 5,
    ruleNameAr: 'شجرة القرار ٥: الشبكة التسلسلية الزمنية (Smoothed temporal heuristic rule)',
    primaryFeature: 'temporalHeuristicScore',
    normalizedRuleScore: Math.round(rule5Score * 100) / 100,
    decisionPathAr:
      temporalHeuristicScore >= 55
        ? `مؤشر التسلسل الزمني (${temporalHeuristicScore}%) يرصد تذبذباً متكرراً بين التثبيت والتراجع`
        : `مؤشر التسلسل الزمني (${temporalHeuristicScore}%) يظهر إيقاعاً قرائياً منتظماً`,
  };

  const ruleVotes = [rule1Vote, rule2Vote, rule3Vote, rule4Vote, rule5Vote];

  // Weighted combination of manually selected heuristic rule scores
  const ensembleProb =
    rule1Score * 0.28 +
    rule2Score * 0.26 +
    rule3Score * 0.16 +
    rule4Score * 0.12 +
    rule5Score * 0.18;

  const heuristicRiskScore = Math.round(
    Math.min(98, Math.max(4, ensembleProb * 100))
  );

  let classification: 'nominal' | 'moderate_risk' | 'high_dyslexia_risk' =
    'nominal';
  let classificationLabelAr = 'مؤشر فرز أولي ضمن النطاق المتوقع (طلاقة بصرية سريعة)';
  if (heuristicRiskScore >= 62) {
    classification = 'high_dyslexia_risk';
    classificationLabelAr =
      'مؤشر فرز أولي مرتفع لعسر القراءة (يستوجب تقييماً سريرياً متخصصاً)';
  } else if (heuristicRiskScore >= 38) {
    classification = 'moderate_risk';
    classificationLabelAr =
      'مؤشر فرز أولي متوسط لصعوبات المعالجة الفونولوجية يتطلب متابعة';
  }

  return {
    heuristicRiskScore,
    classification,
    classificationLabelAr,
    modelArchitectureType: 'heuristic_rule_ensemble',
    clinicalValidationDisclaimerAr:
      'يعتمد هذا المصنف على ٥ قواعد قرار استدلالية موزونة (Heuristic Rule Ensemble) مع تراكم تسلسلي زمني للميزات الحركية البصرية المستخلصة، وهو أداة فرز تربوية أولية غير مُجازة سريرياً ولا تُغني عن التشخيص الإكلينيكي المعتمد.',
    ruleVotes,
    temporalHeuristicScore,
    weightedIndicators: [
      {
        featureNameAr: 'متوسط زمن التثبيت البؤري (Mean Fixation Duration)',
        weightPercent: 28,
        observedValue: `${meanFixationDurationMs} ms`,
        heuristicReferenceRange: 'عتبة داخلية غير معيارية: 200–260 ms',
      },
      {
        featureNameAr: 'نسبة القفزات التراجعية (Regressive Saccade Ratio)',
        weightPercent: 26,
        observedValue: `${regressionRatePercent}% (${regressionsPer100Words}/100 كلمة)`,
        heuristicReferenceRange: 'عتبة داخلية غير معيارية: 8–15%',
      },
      {
        featureNameAr: 'بوابة التسلسل الزمني المتكرر (Smoothed temporal heuristic state)',
        weightPercent: 18,
        observedValue: `${temporalHeuristicScore}%`,
        heuristicReferenceRange: 'عتبة داخلية غير معيارية: أقل من 35%',
      },
      {
        featureNameAr: 'مدة التثبيت عند الرتبة المئوية ٩٠ داخل الجلسة (P90 Fixation Burst)',
        weightPercent: 16,
        observedValue: `${p90FixationDurationMs} ms`,
        heuristicReferenceRange: 'عتبة داخلية غير معيارية: أقل من 350 ms',
      },
      {
        featureNameAr: 'متوسط مدى القفزة البصرية (Mean Saccade Amplitude)',
        weightPercent: 12,
        observedValue: `${meanSaccadeAmplitudePx} px`,
        heuristicReferenceRange: 'عتبة داخلية غير معيارية: 70–130 px',
      },
    ],
    features,
    fixations,
    saccades,
  };
}

// ============================================================================
// 2. DYSLEXICO ENGINE: PHONETIC MATCHING & WEIGHTED LEVENSHTEIN DISTANCE
// ============================================================================

export type DyslexicPatternType =
  | 'visual_mirror_reversal' // b/d, p/q, ب/ت/ث, ج/ح/خ
  | 'phonetic_spelling' // froot -> fruit, fone -> phone, ض/ظ, س/ص
  | 'kinetic_transposition' // teh -> the, form -> from
  | 'vowel_omission_or_shift' // reedig -> reading, كتابه -> كتابة
  | 'general_orthographic';

export interface DyslexicErrorPattern {
  type: DyslexicPatternType;
  labelAr: string;
  detailAr: string;
  costApplied: number;
}

export type LinguisticVariationCategory =
  | 'exact_lexicon_match'
  | 'valid_dialect_lexical'
  | 'dialect_phonological_shift'
  | 'orthographic_convention'
  | 'phonological_or_visual_confusion';

export interface DyslexicoWordAnalysis {
  originalWord: string;
  cleanWord: string;
  isCorrect: boolean;
  variationCategory: LinguisticVariationCategory;
  variationCategoryLabelAr: string;
  isDyslexiaScreeningCandidate: boolean;
  contextualCautionAr: string;
  language: 'ar' | 'en';
  phoneticCodeInput: string;
  soundexCodeInput: string;
  bestCorrection: string;
  phoneticCodeTarget: string;
  standardLevenshteinDistance: number;
  weightedDyslexicDistance: number;
  similarityScorePercent: number;
  detectedPatterns: DyslexicErrorPattern[];
  candidates: {
    word: string;
    phoneticCode: string;
    standardDist: number;
    weightedDist: number;
    reasonAr: string;
  }[];
}

/**
 * Standard American Soundex (4-character phonetic hash) for English words.
 */
export function encodeSoundex(word: string): string {
  const clean = word.toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return '0000';

  const firstLetter = clean[0];
  const map: Record<string, string> = {
    B: '1',
    F: '1',
    P: '1',
    V: '1',
    C: '2',
    G: '2',
    J: '2',
    K: '2',
    Q: '2',
    S: '2',
    X: '2',
    Z: '2',
    D: '3',
    T: '3',
    L: '4',
    M: '5',
    N: '5',
    R: '6',
  };

  let code = firstLetter;
  let prevDigit = map[firstLetter] || '0';

  for (let i = 1; i < clean.length && code.length < 4; i++) {
    const ch = clean[i];
    const digit = map[ch] || '0';
    if (digit !== '0' && digit !== prevDigit) {
      code += digit;
    }
    if (!['A', 'E', 'I', 'O', 'U', 'Y', 'H', 'W'].includes(ch)) {
      prevDigit = digit;
    } else if (['A', 'E', 'I', 'O', 'U', 'Y'].includes(ch)) {
      prevDigit = '0';
    }
  }

  return (code + '0000').slice(0, 4);
}

/**
 * Double Metaphone / Dyslexic Phonetic Skeleton for English words.
 * Maps phonetically identical dyslexic spellings (e.g., "froot" & "fruit" -> "FRT",
 * "fone" & "phone" -> "FN", "kash" & "cash" -> "KX") to the same phonetic key.
 */
export function encodeDoubleMetaphoneLite(word: string): string {
  let s = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return '';

  // Normalize multi-letter dyslexic phonetic clusters first
  s = s
    .replace(/ph/g, 'f')
    .replace(/ght/g, 't')
    .replace(/gh/g, 'f')
    .replace(/^kn/g, 'n')
    .replace(/^wr/g, 'r')
    .replace(/^wh/g, 'w')
    .replace(/sh/g, 'x')
    .replace(/ch/g, 'x')
    .replace(/tch/g, 'x')
    .replace(/ck/g, 'k')
    .replace(/qu/g, 'kw')
    .replace(/oo/g, 'u')
    .replace(/ui/g, 'u')
    .replace(/ee/g, 'i')
    .replace(/ea/g, 'i')
    .replace(/ie/g, 'i')
    .replace(/ei/g, 'i');

  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1] || '';

    // Drop duplicate adjacent letters
    if (i > 0 && ch === s[i - 1]) continue;

    // Silent trailing 'e'
    if (ch === 'e' && i === s.length - 1 && s.length > 2) continue;

    // Keep initial vowel as 'A', strip internal vowels for consonant-skeleton matching
    if ('aeiouy'.includes(ch)) {
      if (i === 0) out += 'A';
      continue;
    }

    if (ch === 'c') {
      out += 'eiy'.includes(next) ? 'S' : 'K';
    } else if (ch === 'q') {
      out += 'K';
    } else if (ch === 'g') {
      out += 'eiy'.includes(next) ? 'J' : 'K';
    } else if (ch === 'z') {
      out += 'S';
    } else if (ch === 'v') {
      out += 'F';
    } else {
      out += ch.toUpperCase();
    }
  }

  return out || 'A';
}

/**
 * Arabic Phonetic & Visual-Grapheme Skeleton Encoder.
 * Normalizes Arabic emphatic/non-emphatic homophones (ض/ظ, ت/ط, س/ص, د/ذ/ز, ه/ة)
 * so phonetically spelled Arabic words match their canonical dictionary target.
 */
export function encodeArabicPhoneticSkeleton(word: string): string {
  const clean = word
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // Strip tashkeel & tatweel
    .replace(/[^\u0621-\u064A]/g, '');
  if (!clean) return '';

  const phoneticMap: Record<string, string> = {
    أ: 'ا',
    إ: 'ا',
    آ: 'ا',
    ٱ: 'ا',
    ى: 'ا',
    ئ: 'ي',
    ؤ: 'و',
    ة: 'ه',
    ط: 'ت',
    ظ: 'ض',
    ص: 'س',
    ذ: 'د',
    ز: 'د',
    ث: 'ت',
    غ: 'ع',
    خ: 'ح',
  };

  let skeleton = '';
  for (const ch of clean) {
    const mapped = phoneticMap[ch] || ch;
    if (skeleton.length === 0 || skeleton[skeleton.length - 1] !== mapped) {
      skeleton += mapped;
    }
  }
  return skeleton;
}

/**
 * Standard Wagner-Fischer Levenshtein Distance (all operations cost = 1.0).
 */
export function computeStandardLevenshtein(a: string, b: string): number {
  const s1 = a.toLowerCase().replace(/[\u064B-\u0652\u0670]/g, '');
  const s2 = b.toLowerCase().replace(/[\u064B-\u0652\u0670]/g, '');
  const m = s1.length;
  const n = s2.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

// Mirror-reversal pairs (Visual Dyslexia: b/d, p/q, m/w, u/n, and Arabic dot-confusable graphemes)
const VISUAL_REVERSAL_PAIRS = new Set<string>([
  'b:d',
  'd:b',
  'p:q',
  'q:p',
  'b:p',
  'p:b',
  'd:q',
  'q:d',
  'm:w',
  'w:m',
  'u:n',
  'n:u',
  // Arabic visual dot reversals
  'ب:ت',
  'ت:ب',
  'ب:ث',
  'ث:ب',
  'ت:ث',
  'ث:ت',
  'ب:ن',
  'ن:ب',
  'ت:ن',
  'ن:ت',
  'ج:ح',
  'ح:ج',
  'ج:خ',
  'خ:ج',
  'ح:خ',
  'خ:ح',
  'ر:ز',
  'ز:ر',
  'د:ذ',
  'ذ:د',
  'ف:ق',
  'ق:ف',
  'ع:غ',
  'غ:ع',
  'س:ش',
  'ش:س',
]);

// Phonetic confusion pairs (Phonological Dyslexia)
const PHONETIC_CONFUSION_PAIRS = new Set<string>([
  'c:k',
  'k:c',
  'c:s',
  's:c',
  'f:v',
  'v:f',
  's:z',
  'z:s',
  'g:j',
  'j:g',
  'o:u',
  'u:o',
  'e:i',
  'i:e',
  'a:e',
  'e:a',
  // Arabic phonetic / orthographic confusions
  'ض:ظ',
  'ظ:ض',
  'ت:ط',
  'ط:ت',
  'س:ص',
  'ص:س',
  'د:ط',
  'ط:د',
  'ذ:ز',
  'ز:ذ',
  'ث:س',
  'س:ث',
  'ه:ة',
  'ة:ه',
  'ا:أ',
  'أ:ا',
  'ا:إ',
  'إ:ا',
  'أ:إ',
  'إ:أ',
  'ي:ى',
  'ى:ي',
  'ق:ك',
  'ك:ق',
]);

/**
 * Dyslexico Weighted Damerau-Levenshtein Distance:
 * Assigns near-zero cost (0.14 - 0.22) to visual mirror reversals (b/d, p/q, ب/ت),
 * phonetic substitutions (froot/fruit, ض/ظ, ه/ة), and kinetic letter transpositions (teh/the).
 */
export function computeDyslexicoWeightedLevenshtein(
  sourceRaw: string,
  targetRaw: string
): {
  weightedDistance: number;
  standardDistance: number;
  detectedPatterns: DyslexicErrorPattern[];
} {
  // Normalize vowel clusters before DP for multi-char phonetic equivalents (like oo <-> ui in froot/fruit, ph <-> f in fone/phone)
  const normMulti = (w: string) =>
    w
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0670]/g, '')
      .replace(/oo/g, 'ū')
      .replace(/ui/g, 'ū')
      .replace(/ee/g, 'ī')
      .replace(/ea/g, 'ī')
      .replace(/ph/g, 'f');

  const s1Raw = sourceRaw.toLowerCase().replace(/[\u064B-\u0652\u0670]/g, '');
  const s2Raw = targetRaw.toLowerCase().replace(/[\u064B-\u0652\u0670]/g, '');
  const standardDistance = computeStandardLevenshtein(s1Raw, s2Raw);

  const detectedPatterns: DyslexicErrorPattern[] = [];

  if (s1Raw === s2Raw) {
    return { weightedDistance: 0, standardDistance: 0, detectedPatterns };
  }

  // Detect multi-char phonetic vowel/digraph shifts (froot -> fruit, fone -> phone, reedig -> reading)
  const s1 = normMulti(s1Raw);
  const s2 = normMulti(s2Raw);

  if (s1 !== s1Raw || s2 !== s2Raw) {
    if (
      (s1Raw.includes('oo') && s2Raw.includes('ui')) ||
      (s1Raw.includes('ee') && s2Raw.includes('ea')) ||
      (s1Raw.includes('f') && s2Raw.includes('ph'))
    ) {
      detectedPatterns.push({
        type: 'phonetic_spelling',
        labelAr: 'كتابة صوتية مطابقة للنطق (Phonetic Grapheme Mapping)',
        detailAr: `كتابة المقطع الصوتي كما يُنطق (${sourceRaw} ← ${targetRaw})`,
        costApplied: 0.16,
      });
    }
  }

  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i * 0.75;
  for (let j = 0; j <= n; j++) dp[0][j] = j * 0.75;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c1 = s1[i - 1];
      const c2 = s2[j - 1];
      const pairKey = `${c1}:${c2}`;

      let subCost = 1.0;
      if (c1 === c2) {
        subCost = 0;
      } else if (VISUAL_REVERSAL_PAIRS.has(pairKey)) {
        subCost = 0.14; // Near-zero cost for b/d, p/q, ب/ت visual reversal
        if (
          !detectedPatterns.some(
            (p) => p.type === 'visual_mirror_reversal'
          )
        ) {
          detectedPatterns.push({
            type: 'visual_mirror_reversal',
            labelAr: 'إبدال بصري للحروف المتناظرة (Visual Mirror Reversal)',
            detailAr: `خلط بصري بين الحرف (${c1}) والحرف (${c2})`,
            costApplied: 0.14,
          });
        }
      } else if (PHONETIC_CONFUSION_PAIRS.has(pairKey)) {
        subCost = 0.18; // Near-zero cost for phonetic confusion (ض/ظ, ه/ة, c/k)
        if (!detectedPatterns.some((p) => p.type === 'phonetic_spelling')) {
          detectedPatterns.push({
            type: 'phonetic_spelling',
            labelAr: 'تشابه فونولوجي صوتي (Phonological Substitution)',
            detailAr: `تقارب مخرج الصوت بين (${c1}) و (${c2})`,
            costApplied: 0.18,
          });
        }
      }

      // Deletion / Insertion cost (lower if vowel/silent letter omission like "boks" -> "books" or "reedig" -> "reading")
      const delCost = 'aeiouūīاويىهةn'.includes(c1) ? 0.32 : 0.75;
      const insCost = 'aeiouūīاويىهةn'.includes(c2) ? 0.32 : 0.75;

      dp[i][j] = Math.min(
        dp[i - 1][j] + delCost,
        dp[i][j - 1] + insCost,
        dp[i - 1][j - 1] + subCost
      );

      // Adjacent Damerau Transposition (e.g. "teh" -> "the", "form" -> "from")
      if (
        i > 1 &&
        j > 1 &&
        s1[i - 1] === s2[j - 2] &&
        s1[i - 2] === s2[j - 1] &&
        s1[i - 1] !== s1[i - 2]
      ) {
        const transCost = 0.22;
        if (dp[i - 2][j - 2] + transCost < dp[i][j]) {
          dp[i][j] = dp[i - 2][j - 2] + transCost;
          if (
            !detectedPatterns.some((p) => p.type === 'kinetic_transposition')
          ) {
            detectedPatterns.push({
              type: 'kinetic_transposition',
              labelAr: 'قلب مكاني لتسلسل الحروف (Kinetic Letter Transposition)',
              detailAr: `تبديل ترتيب الحرفين المتجاورين (${s1[i - 2]}${s1[i - 1]} ← ${s2[j - 2]}${s2[j - 1]})`,
              costApplied: transCost,
            });
          }
        }
      }
    }
  }

  // Add small base cost if multi-char normalization already simplified the string
  const multiCharOffset =
    s1 === s2 && s1Raw !== s2Raw ? 0.16 : 0;
  const weightedDistance =
    Math.round((dp[m][n] + multiCharOffset) * 100) / 100;

  return {
    weightedDistance,
    standardDistance,
    detectedPatterns,
  };
}

// Built-in bilingual lexicon for real-time Dyslexico spellchecking & phonetic matching
const ENGLISH_CLINICAL_LEXICON = [
  'fruit',
  'the',
  'reading',
  'books',
  'phone',
  'because',
  'friend',
  'school',
  'people',
  'water',
  'animal',
  'number',
  'letter',
  'write',
  'right',
  'night',
  'light',
  'laugh',
  'enough',
  'cash',
  'bird',
  'door',
  'board',
  'deep',
  'queen',
  'play',
  'from',
  'girl',
  'first',
  'love',
  'eating',
  'daddy',
  'baby',
  'paper',
  'table',
  'apple',
  'train',
  'brain',
  'cloud',
  'house',
  'and',
  'on',
  'a',
  'an',
  'in',
  'to',
  'of',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'i',
  'he',
  'she',
  'we',
  'they',
].map((w) => w.toLowerCase());

export type ArabicDialectCode =
  | 'msa'
  | 'gulf'
  | 'egyptian'
  | 'levantine'
  | 'maghrebi';

export interface ArabicDialectProfile {
  code: ArabicDialectCode;
  labelAr: string;
  speechRecognitionLang: string;
  phonologicalNotesAr: string;
}

export const ARABIC_DIALECT_PROFILES: ArabicDialectProfile[] = [
  {
    code: 'gulf',
    labelAr: 'اللهجة الخليجية والسعودية',
    speechRecognitionLang: 'ar-SA',
    phonologicalNotesAr:
      'تراعي نطق القاف (گـ/ك)، إبدال الجيم ياءً في بعض المفردات، وتجانس الظاء والضاد (منضار/منظار).',
  },
  {
    code: 'egyptian',
    labelAr: 'اللهجة المصرية',
    speechRecognitionLang: 'ar-EG',
    phonologicalNotesAr:
      'تراعي إبدال الثاء (ت/س)، الذال (د/ز)، الظاء (ض/ز)، ونطق القاف همزة (ألم/قلم، دهب/ذهب، تلاميز/تلاميذ).',
  },
  {
    code: 'levantine',
    labelAr: 'اللهجة الشامية',
    speechRecognitionLang: 'ar-JO',
    phonologicalNotesAr:
      'تراعي إبدال الثاء تاءً والذال دالاً أو زاياً وتخفيف الهمزة وتسهيل التاء المربوطة.',
  },
  {
    code: 'maghrebi',
    labelAr: 'اللهجة المغاربية',
    speechRecognitionLang: 'ar-MA',
    phonologicalNotesAr:
      'تراعي تسكين المقطع الأول وتفخيم التاء إلى طاء في جوار الحروف المفخمة ومفردات الدارجة المدرسية.',
  },
  {
    code: 'msa',
    labelAr: 'العربية الفصحى المعيارية',
    speechRecognitionLang: 'ar-SA',
    phonologicalNotesAr:
      'معيار النطق المدرسي الفصيح مع التمييز الكامل بين مخارج الحروف اللثوية والمفخمة.',
  },
];

// Map common Arab student dialectal words & phonetic pronunciations to their MSA canonical target,
// explicitly distinguishing valid lexical dialect words ('lexical') from dialectal phonological shifts ('phonological')
// and orthographic conventions ('orthographic').
const ARABIC_DIALECT_LEXICAL_MAP: Record<
  string,
  {
    canonicalMsa: string;
    canonicalMsaAlternates?: string[];
    dialectLabelAr: string;
    kind: 'lexical' | 'phonological' | 'orthographic';
    allowedDialects?: ArabicDialectCode[];
  }
> = {
  // Orthographic writing conventions / pause-form normalization (NOT dyslexia errors — valid in all modes including MSA)
  المدرسه: {
    canonicalMsa: 'المدرسة',
    dialectLabelAr: 'اختلاف إملائي شائع في كتابة التاء المربوطة هاءً عند الوقف (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  مدرسه: {
    canonicalMsa: 'المدرسة',
    canonicalMsaAlternates: ['مدرسة', 'المدرسة'],
    dialectLabelAr: 'اختلاف إملائي شائع في كتابة التاء المربوطة هاءً (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  الواضحه: {
    canonicalMsa: 'الواضحة',
    dialectLabelAr: 'اختلاف إملائي في التاء المربوطة عند الوقف (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  الحديقه: {
    canonicalMsa: 'الحديقة',
    canonicalMsaAlternates: ['حديقة', 'الحديقة'],
    dialectLabelAr: 'اختلاف إملائي في التاء المربوطة عند الوقف (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  قطه: {
    canonicalMsa: 'قطة',
    dialectLabelAr: 'اختلاف إملائي في التاء المربوطة عند الوقف (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  ازرق: {
    canonicalMsa: 'أزرق',
    dialectLabelAr: 'تطبيع إملائي لهمزة القطع في الكتابة الرقمية (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  امام: {
    canonicalMsa: 'أمام',
    dialectLabelAr: 'تطبيع إملائي لهمزة القطع في الكتابة الرقمية (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  الى: {
    canonicalMsa: 'إلى',
    dialectLabelAr: 'تطبيع إملائي لهمزة القطع في الكتابة الرقمية (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  الاطفال: {
    canonicalMsa: 'الأطفال',
    dialectLabelAr: 'تطبيع إملائي للهمزة في الكتابة الرقمية (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  قري: {
    canonicalMsa: 'قرأ',
    dialectLabelAr: 'تسهيل الهمزة المتطرفة أو اختلاف رسم الألف/الياء (تطبيع كتابي/نطقي)',
    kind: 'orthographic',
  },
  مسا: {
    canonicalMsa: 'مساء',
    dialectLabelAr: 'تخفيف الهمزة المتطرفة عند الوقف (استعمال صوتي شائع)',
    kind: 'orthographic',
  },
  صافي: {
    canonicalMsa: 'صاف',
    dialectLabelAr: 'إشباع الاسم المنقوص ياءً عند الوقف (استعمال عربي شائع)',
    kind: 'orthographic',
  },

  // Valid Arabic dialectal & pan-Arab lexical words (Correct in colloquial dialects — NEVER classify as spelling errors!)
  شاف: {
    canonicalMsa: 'شاهد',
    canonicalMsaAlternates: ['شاهد', 'رأى', 'نظر', 'أبصر'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («شاف» بمعنى «شاهد/رأى» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  شافت: {
    canonicalMsa: 'شاهدت',
    canonicalMsaAlternates: ['شاهدت', 'رأت', 'نظرت', 'أبصرت'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («شافت» بمعنى «شاهدت/رأت» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  شافوا: {
    canonicalMsa: 'لمشاهدة',
    canonicalMsaAlternates: ['لمشاهدة', 'شاهدوا', 'رأوا'],
    dialectLabelAr: 'استعمال لهجي صحيح («شافوا» بمعنى «شاهدوا» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  يشوف: {
    canonicalMsa: 'يشاهد',
    canonicalMsaAlternates: ['يشاهد', 'يرى', 'ينظر', 'لمشاهدة'],
    dialectLabelAr: 'استعمال لهجي صحيح («يشوف» بمعنى «يرى/يشاهد» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  تشوف: {
    canonicalMsa: 'تشاهد',
    canonicalMsaAlternates: ['تشاهد', 'ترى', 'تنظر'],
    dialectLabelAr: 'استعمال لهجي صحيح («تشوف» بمعنى «ترى/تشاهد» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  صوب: {
    canonicalMsa: 'نحو',
    canonicalMsaAlternates: ['نحو', 'باتجاه', 'تجاه', 'إلى'],
    dialectLabelAr: 'استعمال عربي ولهجي صحيح («صَوْب» بمعنى «نحو/اتجاه» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'levantine', 'egyptian'],
  },
  راح: {
    canonicalMsa: 'ذهب',
    canonicalMsaAlternates: ['ذهب', 'توجه', 'مضى', 'زار'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («راح» بمعنى «ذهب» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  راحت: {
    canonicalMsa: 'خرجت',
    canonicalMsaAlternates: ['خرجت', 'ذهبت', 'توجهت'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («راحت» بمعنى «ذهبت/خرجت» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  راحوا: {
    canonicalMsa: 'زار',
    canonicalMsaAlternates: ['زار', 'زاروا', 'ذهبوا', 'ذهب'],
    dialectLabelAr: 'استعمال لهجي صحيح («راحوا» بمعنى «زاروا/ذهبوا» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  مشى: {
    canonicalMsa: 'ذهب',
    canonicalMsaAlternates: ['ذهب', 'سار', 'توجه'],
    dialectLabelAr: 'استعمال لهجي مغاربي وعربي صحيح («مشى» بمعنى «ذهب/سار» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['maghrebi', 'gulf', 'egyptian', 'levantine'],
  },
  مشوا: {
    canonicalMsa: 'زار',
    canonicalMsaAlternates: ['زار', 'ذهبوا', 'زاروا'],
    dialectLabelAr: 'استعمال لهجي مغاربي صحيح («مشوا» بمعنى «ذهبوا» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['maghrebi', 'gulf'],
  },
  جاب: {
    canonicalMsa: 'أحضر',
    canonicalMsaAlternates: ['أحضر', 'جلب', 'حمل'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («جاب» بمعنى «أحضر/جلب» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  جابت: {
    canonicalMsa: 'أحضرت',
    canonicalMsaAlternates: ['أحضرت', 'جلبت', 'حملت'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («جابت» بمعنى «أحضرت» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  حط: {
    canonicalMsa: 'وضع',
    canonicalMsaAlternates: ['وضع', 'ثبت', 'جعل'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («حطّ» بمعنى «وضع» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  حطت: {
    canonicalMsa: 'وضعت',
    canonicalMsaAlternates: ['وضعت', 'ثبتت'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («حطّت» بمعنى «وضعت» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  العيال: {
    canonicalMsa: 'الأطفال',
    canonicalMsaAlternates: ['الأطفال', 'الأبناء', 'الطلاب', 'طلاب'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («العيال» بمعنى «الأطفال/الأبناء» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian'],
  },
  عيال: {
    canonicalMsa: 'الأطفال',
    canonicalMsaAlternates: ['الأطفال', 'أطفال', 'طلاب', 'الأبناء'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («عيال» بمعنى «أطفال/أبناء» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian'],
  },
  الولاد: {
    canonicalMsa: 'الأطفال',
    canonicalMsaAlternates: ['الأطفال', 'الأولاد', 'الأبناء', 'الطلاب'],
    dialectLabelAr: 'استعمال لهجي صحيح («الولاد/الأولاد» بمعنى «الأطفال» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['egyptian', 'levantine'],
  },
  الدراري: {
    canonicalMsa: 'الأطفال',
    canonicalMsaAlternates: ['الأطفال', 'الأبناء', 'الطلاب'],
    dialectLabelAr: 'استعمال لهجي مغاربي صحيح («الدراري» بمعنى «الأطفال» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['maghrebi'],
  },
  بزاف: {
    canonicalMsa: 'شديد',
    canonicalMsaAlternates: ['شديد', 'كثير', 'كثيرا', 'جدا', 'كبيرا'],
    dialectLabelAr: 'استعمال لهجي مغاربي صحيح («بزاف» بمعنى «كثير/شديد» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['maghrebi'],
  },
  واجد: {
    canonicalMsa: 'شديد',
    canonicalMsaAlternates: ['شديد', 'كثير', 'كثيرا', 'جدا', 'كبيرا'],
    dialectLabelAr: 'استعمال لهجي خليجي صحيح («واجد» بمعنى «كثير/شديد» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  وايد: {
    canonicalMsa: 'كثير',
    canonicalMsaAlternates: ['كثير', 'كثيرا', 'شديد', 'جدا', 'كبيرا'],
    dialectLabelAr: 'استعمال لهجي خليجي صحيح («وايد» بمعنى «كثير/جداً» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  حيل: {
    canonicalMsa: 'شديد',
    canonicalMsaAlternates: ['شديد', 'كثير', 'كثيرا', 'جدا'],
    dialectLabelAr: 'استعمال لهجي خليجي/عراقي صحيح («حيل» بمعنى «جداً/شديد» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  الحين: {
    canonicalMsa: 'اليوم',
    canonicalMsaAlternates: ['اليوم', 'الآن', 'حاليا'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («الحين» بمعنى «الآن/اليوم» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'levantine'],
  },
  ذحين: {
    canonicalMsa: 'اليوم',
    canonicalMsaAlternates: ['اليوم', 'الآن', 'حاليا'],
    dialectLabelAr: 'استعمال لهجي حجازي صحيح («ذحين» بمعنى «الآن» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  دلوقتي: {
    canonicalMsa: 'اليوم',
    canonicalMsaAlternates: ['اليوم', 'الآن', 'حاليا'],
    dialectLabelAr: 'استعمال لهجي مصري صحيح («دلوقتي» بمعنى «الآن» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['egyptian'],
  },
  هلق: {
    canonicalMsa: 'اليوم',
    canonicalMsaAlternates: ['اليوم', 'الآن', 'حاليا'],
    dialectLabelAr: 'استعمال لهجي شامي صحيح («هلق» بمعنى «الآن» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['levantine'],
  },
  دابا: {
    canonicalMsa: 'اليوم',
    canonicalMsaAlternates: ['اليوم', 'الآن', 'حاليا'],
    dialectLabelAr: 'استعمال لهجي مغاربي صحيح («دابا» بمعنى «الآن» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['maghrebi'],
  },
  موية: {
    canonicalMsa: 'الماء',
    canonicalMsaAlternates: ['الماء', 'ماء', 'المياه', 'مياه'],
    dialectLabelAr: 'استعمال لهجي صحيح («موية» بمعنى «ماء» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  ميه: {
    canonicalMsa: 'الماء',
    canonicalMsaAlternates: ['الماء', 'ماء', 'المياه', 'مياه'],
    dialectLabelAr: 'استعمال لهجي مصري/شامي صحيح («ميه» بمعنى «ماء» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['egyptian', 'levantine'],
  },
  ماي: {
    canonicalMsa: 'الماء',
    canonicalMsaAlternates: ['الماء', 'ماء', 'المياه', 'مياه'],
    dialectLabelAr: 'استعمال لهجي خليجي صحيح («ماي» بمعنى «ماء» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  زين: {
    canonicalMsa: 'جميل',
    canonicalMsaAlternates: ['جميل', 'جيد', 'مرتب', 'حسن'],
    dialectLabelAr: 'استعمال لهجي خليجي وعربي صحيح («زين» بمعنى «جميل/جيد» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  كويس: {
    canonicalMsa: 'جميل',
    canonicalMsaAlternates: ['جميل', 'جيد', 'مرتب', 'حسن'],
    dialectLabelAr: 'استعمال لهجي مصري/شامي صحيح («كويس» بمعنى «جيد/جميل» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['egyptian', 'levantine'],
  },
  منيح: {
    canonicalMsa: 'جميل',
    canonicalMsaAlternates: ['جميل', 'جيد', 'مرتب', 'حسن'],
    dialectLabelAr: 'استعمال لهجي شامي صحيح («منيح» بمعنى «جيد/جميل» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['levantine'],
  },
  مزيان: {
    canonicalMsa: 'جميل',
    canonicalMsaAlternates: ['جميل', 'جيد', 'مرتب', 'حسن'],
    dialectLabelAr: 'استعمال لهجي مغاربي صحيح («مزيان» بمعنى «جيد/جميل» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['maghrebi'],
  },
  المضوية: {
    canonicalMsa: 'المضيئة',
    canonicalMsaAlternates: ['المضيئة', 'الساطعة'],
    dialectLabelAr: 'استعمال لهجي شامي/مغاربي صحيح («المضوية» بمعنى «المضيئة» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['levantine', 'maghrebi'],
  },
  المنورة: {
    canonicalMsa: 'المضيئة',
    canonicalMsaAlternates: ['المضيئة', 'الساطعة'],
    dialectLabelAr: 'استعمال لهجي صحيح («المنورة» بمعنى «المضيئة» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  لشوفة: {
    canonicalMsa: 'لمشاهدة',
    canonicalMsaAlternates: ['لمشاهدة', 'مشاهدة'],
    dialectLabelAr: 'استعمال لهجي صحيح («لشوفة» بمعنى «لمشاهدة» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  عشان: {
    canonicalMsa: 'لمشاهدة',
    canonicalMsaAlternates: ['لمشاهدة', 'لحماية', 'لتوزيع', 'لتيسير', 'ليستفيد', 'لأن', 'لكي'],
    dialectLabelAr: 'أداة تعليل لهجية دارجة صحيحة في السياق الشفهي',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine'],
  },
  علشان: {
    canonicalMsa: 'لمشاهدة',
    canonicalMsaAlternates: ['لمشاهدة', 'لحماية', 'لتوزيع', 'لتيسير', 'ليستفيد', 'لأن', 'لكي'],
    dialectLabelAr: 'أداة تعليل لهجية مصرية صحيحة في السياق الشفهي',
    kind: 'lexical',
    allowedDialects: ['egyptian'],
  },
  مشان: {
    canonicalMsa: 'لمشاهدة',
    canonicalMsaAlternates: ['لمشاهدة', 'لحماية', 'لتوزيع', 'لتيسير', 'ليستفيد', 'لأن', 'لكي'],
    dialectLabelAr: 'أداة تعليل لهجية شامية صحيحة في السياق الشفهي',
    kind: 'lexical',
    allowedDialects: ['levantine'],
  },
  باش: {
    canonicalMsa: 'لمشاهدة',
    canonicalMsaAlternates: ['لمشاهدة', 'لحماية', 'لتوزيع', 'لتيسير', 'ليستفيد', 'لأن', 'لكي'],
    dialectLabelAr: 'أداة تعليل لهجية مغاربية صحيحة في السياق الشفهي',
    kind: 'lexical',
    allowedDialects: ['maghrebi'],
  },

  // Dialectal phonological shifts (ث->ت/س, ذ->د/ز, ق->أ/گ, ج->ي)
  تلاميز: {
    canonicalMsa: 'تلاميذ',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ذ ← ز — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  تلميز: {
    canonicalMsa: 'تلميذ',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ذ ← ز — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  دهب: {
    canonicalMsa: 'ذهب',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي/مغاربي: ذ ← د — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine', 'maghrebi'],
  },
  تلاته: {
    canonicalMsa: 'ثلاثة',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ث ← ت — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine', 'maghrebi'],
  },
  تلاتة: {
    canonicalMsa: 'ثلاثة',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ث ← ت — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine', 'maghrebi'],
  },
  كتير: {
    canonicalMsa: 'كثير',
    canonicalMsaAlternates: ['كثير', 'كثيرا', 'شديد'],
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ث ← ت — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  الملاحزات: {
    canonicalMsa: 'الملاحظات',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ظ ← ز — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  ملاحزات: {
    canonicalMsa: 'ملاحظات',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ظ ← ز — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  ملاحزاتهم: {
    canonicalMsa: 'ملاحظاتهم',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ظ ← ز — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  ألم: {
    canonicalMsa: 'قلم',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: إبدال القاف همزة — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  بألم: {
    canonicalMsa: 'بقلم',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: إبدال القاف همزة — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  أمر: {
    canonicalMsa: 'قمر',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: إبدال القاف همزة — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  كال: {
    canonicalMsa: 'قال',
    dialectLabelAr: 'نطق لهجي خليجي (ق ← ك/گ — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['gulf'],
  },
  الدكيك: {
    canonicalMsa: 'الدقيق',
    dialectLabelAr: 'نطق لهجي خليجي (ق ← ك/گ — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['gulf'],
  },
  الدئيئ: {
    canonicalMsa: 'الدقيق',
    dialectLabelAr: 'نطق لهجي مصري/شامي (ق ← ء — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  مسيد: {
    canonicalMsa: 'مسجد',
    dialectLabelAr: 'نطق لهجي خليجي (ج ← ي — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['gulf'],
  },
  ريال: {
    canonicalMsa: 'رجال',
    dialectLabelAr: 'نطق لهجي خليجي (ج ← ي — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['gulf'],
  },
  شيرة: {
    canonicalMsa: 'شجرة',
    dialectLabelAr: 'نطق لهجي خليجي (ج ← ي — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['gulf'],
  },
  يديد: {
    canonicalMsa: 'جديد',
    canonicalMsaAlternates: ['جديد', 'جديدة'],
    dialectLabelAr: 'نطق لهجي خليجي (ج ← ي — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['gulf'],
  },
};

function isEntryAllowedInDialect(
  entry: {
    kind: 'lexical' | 'phonological' | 'orthographic';
    allowedDialects?: ArabicDialectCode[];
  },
  dialect?: ArabicDialectCode
): boolean {
  // Orthographic conventions apply across all Arabic modes
  if (entry.kind === 'orthographic') return true;
  // When no specific dialect filter is passed, accept all documented Arab dialects
  if (!dialect) return true;
  // In strict Standard Arabic (MSA) mode, colloquial/phonological shifts are NOT exempted
  if (dialect === 'msa') return false;
  if (!entry.allowedDialects || entry.allowedDialects.length === 0) return true;
  return entry.allowedDialects.includes(dialect);
}

/**
 * Normalizes an Arab student's spoken or written token across Arabic dialects,
 * identifying whether it is a valid dialectal lexical item, a dialectal phonological shift,
 * an orthographic writing convention, or a candidate for letter-level confusion analysis.
 * Supports Arabic proclitics (وال، فال، بال، لل، و، ف، ب، ل، ك) and active dialect filtering.
 */
export function normalizeArabicDialectWord(
  rawWord: string,
  dialect?: ArabicDialectCode
): {
  cleaned: string;
  canonicalMsa: string;
  canonicalMsaAlternates: string[];
  isDialectVariant: boolean;
  dialectKind?: 'lexical' | 'phonological' | 'orthographic';
  dialectNoteAr?: string;
} {
  const cleaned = rawWord
    .replace(/[.,!?،؟؛:"«»()[\]\u064B-\u0652\u0670\u0640]/g, '')
    .trim();
  const directEntry = ARABIC_DIALECT_LEXICAL_MAP[cleaned];
  if (directEntry && isEntryAllowedInDialect(directEntry, dialect)) {
    const alts = Array.from(
      new Set([directEntry.canonicalMsa, ...(directEntry.canonicalMsaAlternates || [])])
    );
    return {
      cleaned,
      canonicalMsa: directEntry.canonicalMsa,
      canonicalMsaAlternates: alts,
      isDialectVariant: true,
      dialectKind: directEntry.kind,
      dialectNoteAr: directEntry.dialectLabelAr,
    };
  }

  // Check compound proclitics (وال، فال، بال، كال، لل) and single-letter proclitics (و، ف، ب، ل، ك)
  const proclitics = ['وال', 'فال', 'بال', 'كال', 'لل', 'و', 'ف', 'ب', 'ل', 'ك'];
  for (const prefix of proclitics) {
    if (cleaned.length >= prefix.length + 2 && cleaned.startsWith(prefix)) {
      const stem = cleaned.slice(prefix.length);
      const stemEntry = ARABIC_DIALECT_LEXICAL_MAP[stem];
      if (stemEntry && isEntryAllowedInDialect(stemEntry, dialect)) {
        const baseAlts = [
          stemEntry.canonicalMsa,
          ...(stemEntry.canonicalMsaAlternates || []),
        ];
        const prefixedAlts = baseAlts.map((a) => `${prefix}${a}`);
        return {
          cleaned,
          canonicalMsa: stemEntry.canonicalMsa,
          canonicalMsaAlternates: Array.from(new Set([...baseAlts, ...prefixedAlts])),
          isDialectVariant: true,
          dialectKind: stemEntry.kind,
          dialectNoteAr: stemEntry.dialectLabelAr,
        };
      }
      // Also check if prefix includes ال (e.g. والمنورة -> المنورة)
      if (prefix.endsWith('ال')) {
        const stemWithAl = `ال${stem}`;
        const alEntry = ARABIC_DIALECT_LEXICAL_MAP[stemWithAl];
        if (alEntry && isEntryAllowedInDialect(alEntry, dialect)) {
          const singlePrefix = prefix.slice(0, -2);
          const baseAlts = [
            alEntry.canonicalMsa,
            ...(alEntry.canonicalMsaAlternates || []),
          ];
          const prefixedAlts = baseAlts.map((a) => `${singlePrefix}${a}`);
          return {
            cleaned,
            canonicalMsa: alEntry.canonicalMsa,
            canonicalMsaAlternates: Array.from(new Set([...baseAlts, ...prefixedAlts])),
            isDialectVariant: true,
            dialectKind: alEntry.kind,
            dialectNoteAr: alEntry.dialectLabelAr,
          };
        }
      }
    }
  }

  return {
    cleaned,
    canonicalMsa: cleaned,
    canonicalMsaAlternates: [cleaned],
    isDialectVariant: false,
  };
}

const ARABIC_CLINICAL_LEXICON = [
  'قرأ',
  'الطالب',
  'طلاب',
  'كتاب',
  'كتابة',
  'في',
  'المدرسة',
  'وكتب',
  'كتب',
  'بقلم',
  'قلم',
  'أزرق',
  'عن',
  'إلى',
  'على',
  'من',
  'مع',
  'عبر',
  'بين',
  'والضوء',
  'المعلم',
  'الدرس',
  'الظل',
  'الضوء',
  'الصباح',
  'المساء',
  'مساء',
  'صاف',
  'المنظار',
  'الدقيق',
  'نحو',
  'فظهرت',
  'حلقات',
  'الواضحة',
  'أمام',
  'الجميع',
  'سجل',
  'الأطفال',
  'ملاحظات',
  'ملاحظاتهم',
  'دفتر',
  'البحث',
  'العلمي',
  'بحماس',
  'شديد',
  'الكواكب',
  'المضيئة',
  'وضع',
  'المهندس',
  'النجوم',
  'السماء',
  'الأرض',
  'العلوم',
  'المكتبة',
  'القراءة',
  'الحروف',
  'الكلمات',
  'الحديقة',
  'الأزهار',
  'الفراشة',
  'الطبيعة',
  'مستقبل',
  'أصدقائه',
  'بطريقة',
  'صحيحة',
  'جميلة',
  'سعيدة',
  'الرياضيات',
  'الأعداد',
  'ذهب',
  'زار',
  'تلاميذ',
  'تلميذ',
  'ثلاثة',
  'كثير',
  'قال',
  'مسجد',
  'رجال',
  'شاهد',
  'قمر',
  'ظهر',
  'المرصد',
  'الفلكي',
  'الكبير',
  'لمشاهدة',
  'مشاهدة',
  'كوكب',
  'زحل',
  'تتميز',
  'الواحات',
  'العربية',
  'بنظام',
  'هندسي',
  'عريق',
  'يعرف',
  'باسم',
  'الأفلاج',
  'المائية',
  'تنساب',
  'المياه',
  'العذبة',
  'الينابيع',
  'الجبلية',
  'قنوات',
  'متصلة',
  'لتروي',
  'بساتين',
  'النخيل',
  'والحقول',
  'الخضراء',
  'يتعاون',
  'المزارعون',
  'يوميا',
  'لتوزيع',
  'الحصص',
  'بالعدل',
  'والدقة',
  'المتناهية',
  'طارق',
  'توجه',
  'الجبل',
  'سلمى',
  'حديقة',
  'البيت',
  'قطة',
  'بيضاء',
  'شجرة',
  'التفاح',
  'حليب',
  'دافئ',
  'خبز',
  'طري',
  'القرية',
  'قرية',
  'القمح',
  'قمح',
  'الذهبي',
  'جديد',
  'جديدة',
  'ثقيلة',
  'لذيذة',
];

function isPureOrthographicNormalization(wordA: string, wordB: string): boolean {
  if (!wordA || !wordB || wordA === wordB) return false;
  const norm = (s: string) =>
    s
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة$/g, 'ه')
      .replace(/ى$/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي');
  if (norm(wordA) === norm(wordB)) return true;
  // Also recognize oral/written pause form (Waqf) where final tanween alif is omitted (e.g. صباح <-> صباحا، كامل <-> كاملا)
  if (wordB.endsWith('ا') && wordB.length >= 4 && norm(wordA) === norm(wordB.slice(0, -1))) {
    return true;
  }
  if (wordA.endsWith('ا') && wordA.length >= 4 && norm(wordA.slice(0, -1)) === norm(wordB)) {
    return true;
  }
  return false;
}

/**
 * Checks whether a spoken/written Arabic word differs from the target MSA word solely by systematic
 * regional phonological shifts (e.g. ث->ت/س, ذ->د/ز, ظ->ز, ق->أ/ء/ئ/ك, ج->ي) that match the active
 * `dialect` profile AND occur within contextual reading (`hasSentenceContext`), preventing isolated
 * or multi-consonant garbled errors from being excused as dialectal pronunciation.
 */
export function checkSystematicDialectPhonologicalShift(
  spokenClean: string,
  targetClean: string,
  dialect: ArabicDialectCode = 'gulf',
  hasSentenceContext: boolean = true
): { isShift: boolean; noteAr?: string } {
  if (
    !spokenClean ||
    !targetClean ||
    spokenClean === targetClean ||
    dialect === 'msa' ||
    !hasSentenceContext
  ) {
    return { isShift: false };
  }
  const normOrtho = (s: string) =>
    s
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة$/g, 'ه')
      .replace(/ى$/g, 'ي');

  let sNorm = normOrtho(spokenClean);
  let tNorm = normOrtho(targetClean);

  // Allow tanween alif pause dropping on target
  if (tNorm.endsWith('ا') && tNorm.length === sNorm.length + 1) {
    tNorm = tNorm.slice(0, -1);
  }
  if (sNorm.length !== tNorm.length || sNorm === tNorm) {
    return { isShift: false };
  }

  const allowEgyptianLevantine =
    dialect === 'egyptian' || dialect === 'levantine';
  const allowGulf = dialect === 'gulf';
  const allowMaghrebi = dialect === 'maghrebi';

  const shiftDescriptions: string[] = [];
  const shiftedTargetLetters = new Set<string>();

  for (let i = 0; i < tNorm.length; i++) {
    const tc = tNorm[i];
    const sc = sNorm[i];
    if (tc === sc) continue;

    if (
      tc === 'ث' &&
      ((sc === 'ت' && (allowEgyptianLevantine || allowMaghrebi)) ||
        (sc === 'س' && allowEgyptianLevantine))
    ) {
      shiftDescriptions.push(`ث ← ${sc}`);
      shiftedTargetLetters.add(tc);
    } else if (
      tc === 'ذ' &&
      ((sc === 'د' && (allowEgyptianLevantine || allowMaghrebi)) ||
        (sc === 'ز' && allowEgyptianLevantine))
    ) {
      shiftDescriptions.push(`ذ ← ${sc}`);
      shiftedTargetLetters.add(tc);
    } else if (tc === 'ظ' && sc === 'ز' && allowEgyptianLevantine) {
      shiftDescriptions.push('ظ ← ز');
      shiftedTargetLetters.add(tc);
    } else if (
      tc === 'ق' &&
      (((sc === 'ا' || sc === 'ء' || sc === 'ئ') && allowEgyptianLevantine) ||
        ((sc === 'ك' || sc === 'گ') && (allowGulf || allowMaghrebi)))
    ) {
      shiftDescriptions.push(`ق ← ${sc === 'ا' ? 'أ' : sc}`);
      shiftedTargetLetters.add(tc);
    } else if (tc === 'ج' && sc === 'ي' && allowGulf) {
      shiftDescriptions.push('ج ← ي');
      shiftedTargetLetters.add(tc);
    } else {
      return { isShift: false };
    }
  }

  // Only allow a single consonant family shift per word so multi-error words are not excused
  if (shiftDescriptions.length > 0 && shiftedTargetLetters.size === 1) {
    return {
      isShift: true,
      noteAr: `نطق لهجي صوتي منتظم في السياق (${Array.from(new Set(shiftDescriptions)).join('، ')}) — لا يُعامل كخطأ قرائي`,
    };
  }
  return { isShift: false };
}

/**
 * Analyzes an input word or full sentence using Dyslexico's Phonetic + Weighted Levenshtein
 * and Arabic Dialect-Aware pipeline, actively using the selected `dialect` profile (`gulf`, `egyptian`,
 * `levantine`, `maghrebi`, or strict `msa`) and sentence context to separate:
 * 1. Valid dialectal/lexical usage matching the active dialect -> NOT an error
 * 2. Orthographic/typing conventions (e.g., المدرسه/المدرسة، ازرق/أزرق) -> Orthographic normalization, NOT dyslexia
 * 3. Phonological/visual letter confusions (or dialect shifts outside the active dialect/MSA) -> Requires contextual repetition
 */
export function analyzeTextWithDyslexico(
  inputText: string,
  dialect: ArabicDialectCode = 'gulf'
): DyslexicoWordAnalysis[] {
  const rawTokens = inputText
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const hasSentenceContext = rawTokens.length >= 2;

  return rawTokens.map((rawToken) => {
    const cleanWord = rawToken
      .replace(/[.,!?،؟؛:"«»()[\]\u064B-\u0652\u0670]/g, '')
      .trim();
    const isArabic = /[\u0600-\u06FF]/.test(cleanWord);
    const language: 'ar' | 'en' = isArabic ? 'ar' : 'en';

    const lexicon = isArabic
      ? ARABIC_CLINICAL_LEXICON
      : ENGLISH_CLINICAL_LEXICON;

    const phoneticCodeInput = isArabic
      ? encodeArabicPhoneticSkeleton(cleanWord)
      : encodeDoubleMetaphoneLite(cleanWord);
    const soundexCodeInput = isArabic
      ? phoneticCodeInput
      : encodeSoundex(cleanWord);

    // Check direct match or Arabic proclitic prefix match (و، ف، ب، ل، ك)
    const strippedPrefixWord =
      isArabic && cleanWord.length > 3 && /^[وفبلك]/.test(cleanWord)
        ? cleanWord.slice(1)
        : cleanWord;
    const exactMatch = lexicon.find(
      (w) =>
        w.toLowerCase() === cleanWord.toLowerCase() ||
        (isArabic && w === strippedPrefixWord)
    );
    if (exactMatch) {
      return {
        originalWord: rawToken,
        cleanWord,
        isCorrect: true,
        variationCategory: 'exact_lexicon_match',
        variationCategoryLabelAr: 'كلمة فصيحة/معجمية مطابقة',
        isDyslexiaScreeningCandidate: false,
        contextualCautionAr: 'مطابقة تامة للمعجم العربي المدرسي.',
        language,
        phoneticCodeInput,
        soundexCodeInput,
        bestCorrection: cleanWord,
        phoneticCodeTarget: phoneticCodeInput,
        standardLevenshteinDistance: 0,
        weightedDyslexicDistance: 0,
        similarityScorePercent: 100,
        detectedPatterns: [],
        candidates: [],
      };
    }

    // Check if the token is a known Arabic dialectal or orthographic form under the active `dialect`
    const directDialectCheck = isArabic
      ? normalizeArabicDialectWord(cleanWord, dialect)
      : null;
    const strippedDialectCheck =
      isArabic &&
      !directDialectCheck?.isDialectVariant &&
      strippedPrefixWord !== cleanWord
        ? normalizeArabicDialectWord(strippedPrefixWord, dialect)
        : null;
    const dialectCheck =
      directDialectCheck?.isDialectVariant
        ? directDialectCheck
        : strippedDialectCheck?.isDialectVariant
          ? strippedDialectCheck
          : directDialectCheck;

    // Score all lexicon candidates
    const scoredCandidates = lexicon
      .map((candidate) => {
        const candPhonetic = isArabic
          ? encodeArabicPhoneticSkeleton(candidate)
          : encodeDoubleMetaphoneLite(candidate);
        const { weightedDistance, standardDistance, detectedPatterns } =
          computeDyslexicoWeightedLevenshtein(cleanWord, candidate);

        const sysShift = isArabic
          ? checkSystematicDialectPhonologicalShift(
              cleanWord,
              candidate,
              dialect,
              hasSentenceContext
            )
          : { isShift: false };

        const isDialectTarget =
          (Boolean(dialectCheck?.isDialectVariant) &&
            (dialectCheck?.canonicalMsa === candidate ||
              Boolean(
                dialectCheck?.canonicalMsaAlternates?.includes(candidate)
              ))) ||
          sysShift.isShift;

        // Phonetic or Dialect match bonus
        const phoneticExactBonus = isDialectTarget
          ? -0.45
          : candPhonetic === phoneticCodeInput
            ? -0.25
            : 0;
        const effectiveScore = Math.max(
          0.08,
          Math.round((weightedDistance + phoneticExactBonus) * 100) / 100
        );

        let reasonAr = 'تقارب إملائي معياري';
        const enrichedPatterns = [...detectedPatterns];
        const activeNoteAr = dialectCheck?.dialectNoteAr || sysShift.noteAr;
        if (isDialectTarget && activeNoteAr) {
          reasonAr = `${activeNoteAr} · المقابل الفصيح (${candidate})`;
          if (!enrichedPatterns.some((p) => p.detailAr === activeNoteAr)) {
            enrichedPatterns.unshift({
              type:
                dialectCheck?.dialectKind === 'orthographic'
                  ? 'vowel_omission_or_shift'
                  : 'phonetic_spelling',
              labelAr: activeNoteAr,
              detailAr: `المقابل المدرسي الفصيح لكلمة (${cleanWord}) هو (${candidate})`,
              costApplied: 0.12,
            });
          }
        } else if (candPhonetic === phoneticCodeInput) {
          reasonAr = `تطابق الكود الصوتي الفونولوجي (${candPhonetic})`;
        } else if (detectedPatterns.length > 0) {
          reasonAr = detectedPatterns[0].labelAr;
        }

        return {
          word: candidate,
          phoneticCode: candPhonetic,
          standardDist: standardDistance,
          weightedDist: isDialectTarget
            ? Math.min(0.18, weightedDistance)
            : weightedDistance,
          effectiveScore,
          detectedPatterns: enrichedPatterns,
          reasonAr,
          isSystematicShift: sysShift.isShift,
          systematicShiftNoteAr: sysShift.noteAr,
        };
      })
      .sort((a, b) => a.effectiveScore - b.effectiveScore);

    const top = scoredCandidates[0];
    const maxLen = Math.max(cleanWord.length, top.word.length, 1);
    const similarityScorePercent = Math.round(
      Math.max(15, Math.min(99, (1 - top.weightedDist / maxLen) * 100))
    );

    // Determine exact LinguisticVariationCategory using active `dialect` and sentence context
    let variationCategory: LinguisticVariationCategory =
      'phonological_or_visual_confusion';
    let variationCategoryLabelAr =
      'تبديل حرفي بصري أو صوتي محتمل (يتطلب تكرار السياق)';
    let isDyslexiaScreeningCandidate = true;
    let isCorrectToken = false;
    let contextualCautionAr =
      'ملاحظة حرفية منفردة — الخطأ الفردي لا يساوي عسر القراءة؛ يلزم النظر إلى سياق القراءة وتكرار النمط.';

    if (
      dialectCheck?.isDialectVariant &&
      dialectCheck.dialectKind === 'lexical'
    ) {
      variationCategory = 'valid_dialect_lexical';
      variationCategoryLabelAr =
        'استعمال لهجي أو معجمي عربي صحيح (لا يُعدّ خطأً)';
      isDyslexiaScreeningCandidate = false;
      isCorrectToken = true;
      contextualCautionAr =
        dialectCheck.dialectNoteAr ||
        'استعمال لغوي صحيح في لهجة الطالب المحددة — يُعرض المرادف الفصيح للموائمة المدرسية فقط ولا يُصنّف خطأً قرائياً.';
    } else if (
      (dialectCheck?.isDialectVariant &&
        dialectCheck.dialectKind === 'phonological') ||
      top.isSystematicShift
    ) {
      variationCategory = 'dialect_phonological_shift';
      variationCategoryLabelAr =
        'نطق لهجي صوتي طبيعي مطابق للهجة المحددة (لا يُعدّ مؤشر عسر قراءة)';
      isDyslexiaScreeningCandidate = false;
      isCorrectToken = true;
      contextualCautionAr =
        dialectCheck?.dialectNoteAr ||
        top.systematicShiftNoteAr ||
        'نطق صوتي طبيعي في لهجة الطالب لا يُحتسب خطأً في الفرز القرائي.';
    } else if (
      (dialectCheck?.isDialectVariant &&
        dialectCheck.dialectKind === 'orthographic') ||
      (isArabic && isPureOrthographicNormalization(cleanWord, top.word))
    ) {
      variationCategory = 'orthographic_convention';
      variationCategoryLabelAr =
        'اختلاف إملائي أو تطبيع كتابي (ليس مؤشر عسر قراءة)';
      isDyslexiaScreeningCandidate = false;
      isCorrectToken = false;
      contextualCautionAr =
        dialectCheck?.dialectNoteAr ||
        'اختلاف إملائي شائع في كتابة التاء المربوطة/الهاء أو الهمزة، وهو تطبيع كتابي لا يكفي لإثبات عسر القراءة.';
    }

    return {
      originalWord: rawToken,
      cleanWord,
      isCorrect: isCorrectToken,
      variationCategory,
      variationCategoryLabelAr,
      isDyslexiaScreeningCandidate,
      contextualCautionAr,
      language,
      phoneticCodeInput,
      soundexCodeInput,
      bestCorrection: top.word,
      phoneticCodeTarget: top.phoneticCode,
      standardLevenshteinDistance: top.standardDist,
      weightedDyslexicDistance: top.weightedDist,
      similarityScorePercent,
      detectedPatterns: top.detectedPatterns,
      candidates: scoredCandidates.slice(0, 3).map((c) => ({
        word: c.word,
        phoneticCode: c.phoneticCode,
        standardDist: c.standardDist,
        weightedDist: c.weightedDist,
        reasonAr: c.reasonAr,
      })),
    };
  });
}

// ============================================================================
// 3. MARKER LEARNING & PARALLEL LEARNING: 2PL IRT ADAPTIVE ENGINE & SPEECH
// ============================================================================

export interface IRTAssessmentItem {
  id: string;
  domain:
    | 'phonological_awareness'
    | 'orthographic_mirror'
    | 'ran_lexical'
    | 'morphological_decoding';
  domainLabelAr: string;
  promptAr: string;
  stimulusText: string;
  options: string[];
  correctIndex: number;
  discriminationA: number; // a_i in [0.8, 2.4]
  difficultyB: number; // b_i in [-2.5, +2.5]
  clinicalRationaleAr: string;
}

export interface IRTResponseRecord {
  item: IRTAssessmentItem;
  selectedIndex: number;
  correct: boolean;
  reactionTimeMs: number;
  thetaBefore: number;
  thetaAfter: number;
  standardErrorAfter: number;
  itemInformation: number;
}

export const CLINICAL_IRT_ITEM_BANK: IRTAssessmentItem[] = [
  {
    id: 'irt-1',
    domain: 'orthographic_mirror',
    domainLabelAr: 'التمييز البصري للحروف المتناظرة',
    promptAr: 'اختر الكلمة الصحيحة إملائياً التي تعني «الجهاز البصري لرصد الكواكب»:',
    stimulusText: 'المِـ...ـظار الفلكي',
    options: ['المِنْظَار', 'المِنْضَار', 'المِتْظَار', 'المِنْطَار'],
    correctIndex: 0,
    discriminationA: 1.45,
    difficultyB: -1.4,
    clinicalRationaleAr: 'يقيس التمييز الفونولوجي والبصري بين الظاء والضاد والطاء في الجذر (ن-ظ-ر).',
  },
  {
    id: 'irt-2',
    domain: 'phonological_awareness',
    domainLabelAr: 'الوعي الفونولوجي والمقاطع الصوتية',
    promptAr: 'ما التقطيع المقطعي الصوتي الصحيح لكلمة «مُسْتَقْبَلٌ»؟',
    stimulusText: 'مُسْتَقْبَلٌ',
    options: [
      'مُسْ / تَقْ / بَ / لٌ',
      'مُ / سْتَ / قْبَ / لٌ',
      'مُسْتَ / قْ / بَلٌ',
      'مُ / سْ / تَقْبَلٌ',
    ],
    correctIndex: 0,
    discriminationA: 1.75,
    difficultyB: -0.6,
    clinicalRationaleAr: 'يفحص قدرة الذاكرة العاملة الصوتية على عزل المقاطع الساكنة المغلقة (CVC).',
  },
  {
    id: 'irt-3',
    domain: 'orthographic_mirror',
    domainLabelAr: 'مقاومة القلب البصري والمرآوي',
    promptAr: 'إذا حذفنا النقطة الأولى من كلمة «تَثَبَّتَ» واستبدلناها بباء، فما الكلمة الناتجة؟',
    stimulusText: 'تَثَبَّتَ ← ؟',
    options: ['بَثَبَّتَ', 'تَبَبَّتَ', 'ثَتَبَّتَ', 'نَثَبَّتَ'],
    correctIndex: 0,
    discriminationA: 1.6,
    difficultyB: 0.0,
    clinicalRationaleAr: 'يقيس دقة المعالجة المكانية لمواقع النقاط فوق وتحت صحن الحرف (ب/ت/ث/ن).',
  },
  {
    id: 'irt-4',
    domain: 'morphological_decoding',
    domainLabelAr: 'الاشتقاق الصرفي والجذر الثلاثي',
    promptAr: 'أي الكلمات التالية تشترك في الجذر اللغوي نفسه مع كلمة «مُلَاحَظَة»؟',
    stimulusText: 'الجذر: (ل - ح - ظ)',
    options: ['لَحْظَةٌ', 'مَحْفُوظٌ', 'حَظِيرَةٌ', 'لَافِظَةٌ'],
    correctIndex: 0,
    discriminationA: 1.9,
    difficultyB: 0.65,
    clinicalRationaleAr: 'يقيّم قدرة القارئ على استخلاص الجذر الصرفي دون الخلط البصري مع (ح-ف-ظ) أو (ل-ف-ظ).',
  },
  {
    id: 'irt-5',
    domain: 'phonological_awareness',
    domainLabelAr: 'المعالجة الفونولوجية العكسية',
    promptAr: 'عند عكس ترتيب أصوات كلمة «قَلَم» من الأخير إلى الأول، نحصل على:',
    stimulusText: 'ق - ل - م  ⇄  ؟',
    options: ['مَلَق', 'لَقَم', 'مَقَل', 'فَلَق'],
    correctIndex: 0,
    discriminationA: 2.1,
    difficultyB: 1.25,
    clinicalRationaleAr: 'مؤشر عالي الحساسية في مقاييس Marker Learning لكشف ضعف الحلقة الفونولوجية في الديسلكسيا.',
  },
  {
    id: 'irt-6',
    domain: 'ran_lexical',
    domainLabelAr: 'فك الترميز الصوتي واللهجي العربي',
    promptAr: 'ما الصورة الفصيحة الصحيحة للكلمة التي قد ينطقها أو يكتبها الطالب باللهجة الدارجة «تَلَامِيز»؟',
    stimulusText: 'النطق الصوتي: «تَلَامِيز» ← الفصحى: ؟',
    options: ['تَلَامِيذُ', 'تَلَامِيسُ', 'تَلَامِيثُ', 'طَلَامِيذُ'],
    correctIndex: 0,
    discriminationA: 1.5,
    difficultyB: -0.9,
    clinicalRationaleAr: 'يختبر قدرة الطالب العربي على ربط النطق اللهجي الدارج (إبدال الذال زاياً) بالرسم الإملائي الفصيح (ذ).',
  },
  {
    id: 'irt-7',
    domain: 'morphological_decoding',
    domainLabelAr: 'التحليل الفونولوجي المتقدم للكلمات الطويلة',
    promptAr: 'كم مقطعاً صوتياً في كلمة «يَسْتَخْرِجُونَهَا»؟',
    stimulusText: 'يَسْ · تَخْ · رِ · جُو · نَ · هَا',
    options: ['٦ مقاطع صوتية', '٤ مقاطع صوتية', '٥ مقاطع صوتية', '٨ مقاطع صوتية'],
    correctIndex: 0,
    discriminationA: 2.25,
    difficultyB: 1.85,
    clinicalRationaleAr: 'يقيس سعة المعالجة الفونولوجية المتسلسلة في الكلمات العربية ذات السوابق واللواحق المركبة.',
  },
];

/**
 * 2-Parameter Logistic (2PL) Item Response Theory Probability:
 * P(X = 1 | theta, a, b) = 1 / (1 + exp(-a * (theta - b)))
 */
export function computeIRT2PLProbability(
  theta: number,
  discriminationA: number,
  difficultyB: number
): number {
  const exponent = -discriminationA * (theta - difficultyB);
  return 1 / (1 + Math.exp(exponent));
}

/**
 * Fisher Information I_i(theta) = a_i^2 * P_i(theta) * (1 - P_i(theta))
 */
export function computeIRTFisherInformation(
  theta: number,
  discriminationA: number,
  difficultyB: number
): number {
  const p = computeIRT2PLProbability(theta, discriminationA, difficultyB);
  return Math.pow(discriminationA, 2) * p * (1 - p);
}

/**
 * Bayesian Expected A Posteriori (EAP) estimator for latent trait theta in [-3.0, +3.0]
 * using 61 Gauss-Hermite / uniform quadrature nodes with a Standard Normal N(0, 1) prior.
 */
export function estimateIRTAbilityEAP(
  responses: {
    discriminationA: number;
    difficultyB: number;
    correct: boolean;
    reactionTimeMs?: number;
  }[]
): {
  theta: number;
  standardError: number;
  totalFisherInformation: number;
  modelBasedRank: number;
  interpretationLabelAr: string;
  riskLevel: 'nominal' | 'moderate' | 'high';
} {
  if (!responses || responses.length === 0) {
    return {
      theta: 0,
      standardError: 1.0,
      totalFisherInformation: 1.0,
      modelBasedRank: 50,
      interpretationLabelAr: 'مؤشر حسابي تجريبي؛ لا توجد بيانات كافية بعد',
      riskLevel: 'nominal',
    };
  }

  const nodes: number[] = [];
  for (let t = -3.0; t <= 3.001; t += 0.1) {
    nodes.push(Math.round(t * 100) / 100);
  }

  let numerator = 0;
  let denominator = 0;
  const posteriors: number[] = [];

  for (const qNode of nodes) {
    // Prior N(0, 1) density
    const prior = Math.exp(-0.5 * qNode * qNode);
    let likelihood = 1.0;
    for (const r of responses) {
      const p = computeIRT2PLProbability(
        qNode,
        r.discriminationA,
        r.difficultyB
      );
      likelihood *= r.correct ? p : 1 - p;
    }
    const post = prior * likelihood;
    posteriors.push(post);
    numerator += qNode * post;
    denominator += post;
  }

  const rawTheta = denominator > 0 ? numerator / denominator : 0;
  const theta = Math.round(Math.max(-3.0, Math.min(3.0, rawTheta)) * 100) / 100;

  // Total Fisher Information at estimated theta + prior precision (1.0)
  let itemInfoSum = 0;
  for (const r of responses) {
    itemInfoSum += computeIRTFisherInformation(
      theta,
      r.discriminationA,
      r.difficultyB
    );
  }
  const totalFisherInformation = Math.round((1.0 + itemInfoSum) * 100) / 100;
  const standardError =
    Math.round((1 / Math.sqrt(totalFisherInformation)) * 100) / 100;

  // Map theta to a standard-normal reference rank; this is theoretical, not a student-population norm.
  const z = theta;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const cdf = z >= 0 ? 1 - prob : prob;
  const modelBasedRank = Math.max(1, Math.min(99, Math.round(cdf * 100)));

  let riskLevel: 'nominal' | 'moderate' | 'high' = 'nominal';
  let interpretationLabelAr =
    'المؤشر الحسابي التجريبي قريب من مركز التوزيع الافتراضي؛ لا يمثل معيارًا عمريًا';
  if (theta <= -0.75) {
    riskLevel = 'high';
    interpretationLabelAr =
      'المؤشر الحسابي التجريبي منخفض مقارنة بالتوزيع الافتراضي؛ لا يشخّص اضطراب تعلم';
  } else if (theta < 0.0) {
    riskLevel = 'moderate';
    interpretationLabelAr =
      'المؤشر الحسابي التجريبي دون مركز التوزيع الافتراضي؛ يلزم تفسيره في سياق تقييم شامل';
  }

  return {
    theta,
    standardError,
    totalFisherInformation,
    modelBasedRank,
    interpretationLabelAr,
    riskLevel,
  };
}

/**
 * Selects the next unadministered item from the bank that maximizes Fisher Information I_i(theta)
 * at the student's current ability estimate theta.
 */
export function selectNextAdaptiveIRTItem(
  itemBank: IRTAssessmentItem[],
  administeredIds: string[],
  currentTheta: number
): {
  nextItem: IRTAssessmentItem | null;
  maxFisherInformation: number;
} {
  const administeredSet = new Set(administeredIds);
  const available = itemBank.filter((item) => !administeredSet.has(item.id));
  if (available.length === 0) {
    return { nextItem: null, maxFisherInformation: 0 };
  }

  let bestItem = available[0];
  let bestInfo = -1;

  for (const item of available) {
    const info = computeIRTFisherInformation(
      currentTheta,
      item.discriminationA,
      item.difficultyB
    );
    if (info > bestInfo) {
      bestInfo = info;
      bestItem = item;
    }
  }

  return {
    nextItem: bestItem,
    maxFisherInformation: Math.round(bestInfo * 100) / 100,
  };
}

export interface OralWordAlignmentItem {
  targetWord: string;
  spokenWord: string | null;
  status: 'correct' | 'dialect_variant' | 'phonetic_substitution' | 'omitted';
  weightedDistance: number;
  dialectNoteAr?: string;
}

export interface OralReadingFluencyResult {
  wcpm: number; // Words Correct Per Minute
  totalWords: number;
  correctWordsCount: number;
  dialectVariantCount: number;
  phoneticSubstitutionCount: number;
  omittedWordsCount: number;
  insertionCount?: number;
  substitutionsCount?: number;
  deletionsCount?: number;
  accuracyPercent: number;
  werPercent: number | null; // Standard Levenshtein Word Error Rate: (S + D + I) / N (null if no transcript available)
  standardWerPercent?: number | null;
  hesitationPauseCount: number;
  alignment: OralWordAlignmentItem[];
}

/**
 * Standard Levenshtein Dynamic Programming Word Error Rate (WER) algorithm.
 * Operates on normalized sequence tokens using an exact DP matrix and backtrace
 * to objectively count minimum edit operations: Substitutions (S), Deletions (D), and Insertions (I).
 */
export function computeStandardSequenceWer(
  referenceTokens: string[],
  hypothesisTokens: string[]
): {
  werPercent: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceLength: number;
} {
  const normalize = (tok: string) =>
    tok.replace(/[.,!?،؟؛:"«»()[\]\u064B-\u0652\u0670]/g, '').trim();

  const refClean = referenceTokens.map(normalize).filter(Boolean);
  const hypClean = hypothesisTokens.map(normalize).filter(Boolean);
  const n = refClean.length;
  const m = hypClean.length;

  if (n === 0) {
    return {
      werPercent: m === 0 ? 0 : 100,
      substitutions: 0,
      deletions: 0,
      insertions: m,
      referenceLength: 0,
    };
  }

  // DP table: d[i][j] is the minimum distance between refClean[0..i-1] and hypClean[0..j-1]
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (refClean[i - 1] === hypClean[j - 1]) {
        d[i][j] = d[i - 1][j - 1];
      } else {
        d[i][j] = Math.min(
          d[i - 1][j] + 1,     // deletion from reference
          d[i][j - 1] + 1,     // insertion into reference
          d[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  // Backtrace to count exact substitutions, deletions, and insertions
  let i = n;
  let j = m;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && refClean[i - 1] === hypClean[j - 1]) {
      i--;
      j--;
    } else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) {
      substitutions++;
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      deletions++;
      i--;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      insertions++;
      j--;
    } else {
      if (i > 0) { deletions++; i--; }
      else if (j > 0) { insertions++; j--; }
    }
  }

  const totalErrors = substitutions + deletions + insertions;
  const werPercent = Math.round((totalErrors / n) * 100);

  return {
    werPercent,
    substitutions,
    deletions,
    insertions,
    referenceLength: n,
  };
}

/**
 * Aligns oral reading transcript against target passage words using Dyslexico phonetic/weighted matching
 * and Arabic Dialect Normalization to compute clinical WCPM and distinguish dialectal pronunciation from dyslexia.
 */
export function evaluateOralReadingAlignment(
  referenceWordsInput: string[] | string,
  spokenTranscript: string,
  durationSeconds: number,
  hesitationPauseCount: number = 0,
  dialect?: ArabicDialectCode
): OralReadingFluencyResult {
  const referenceWords = Array.isArray(referenceWordsInput)
    ? referenceWordsInput
    : typeof referenceWordsInput === 'string'
      ? referenceWordsInput
          .trim()
          .split(/\s+/)
          .filter(Boolean)
      : [];

  const spokenTokens = (spokenTranscript || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const hasSentenceContext = referenceWords.length >= 2 && spokenTokens.length >= 2;

  const alignment: OralWordAlignmentItem[] = [];
  let spokenIdx = 0;
  let correctWordsCount = 0;
  let dialectVariantCount = 0;
  let phoneticSubstitutionCount = 0;
  let omittedWordsCount = 0;

  for (let i = 0; i < referenceWords.length; i++) {
    const targetRaw = referenceWords[i];
    const targetClean = targetRaw
      .replace(/[.,!?،؟؛:"«»()[\]\u064B-\u0652\u0670]/g, '')
      .trim();

    // Look ahead up to 2 tokens in spoken transcript
    let matchedIdx = -1;
    let bestStatus:
      | 'correct'
      | 'dialect_variant'
      | 'phonetic_substitution'
      | 'omitted' = 'omitted';
    let bestDist = 99;
    let bestDialectNote: string | undefined = undefined;

    for (
      let look = spokenIdx;
      look < Math.min(spokenTokens.length, spokenIdx + 3);
      look++
    ) {
      const candidateClean = spokenTokens[look]
        .replace(/[.,!?،؟؛:"«»()[\]\u064B-\u0652\u0670]/g, '')
        .trim();

      const dialectInfo = normalizeArabicDialectWord(candidateClean, dialect);
      const { weightedDistance } = computeDyslexicoWeightedLevenshtein(
        candidateClean,
        targetClean
      );
      const orthoOrPauseMatch = isPureOrthographicNormalization(
        candidateClean,
        targetClean
      );
      const systematicShift = checkSystematicDialectPhonologicalShift(
        candidateClean,
        targetClean,
        dialect || 'egyptian',
        hasSentenceContext
      );

      if (
        (weightedDistance === 0 && candidateClean === targetClean) ||
        orthoOrPauseMatch
      ) {
        matchedIdx = look;
        bestStatus = 'correct';
        bestDist = 0;
        bestDialectNote = orthoOrPauseMatch
          ? 'تطبيع وقفي/إملائي قياسي (وقف بدون تنوين أو تاء مربوطة/همزة)'
          : undefined;
        break;
      } else if (
        dialectInfo.isDialectVariant &&
        (dialectInfo.canonicalMsa === targetClean ||
          dialectInfo.canonicalMsaAlternates.includes(targetClean))
      ) {
        matchedIdx = look;
        bestStatus = 'dialect_variant';
        bestDist = Math.min(0.15, weightedDistance);
        bestDialectNote = dialectInfo.dialectNoteAr;
        break;
      } else if (systematicShift.isShift) {
        matchedIdx = look;
        bestStatus = 'dialect_variant';
        bestDist = Math.min(0.15, weightedDistance);
        bestDialectNote = systematicShift.noteAr;
        break;
      } else if (weightedDistance <= 0.65 && weightedDistance < bestDist) {
        matchedIdx = look;
        bestStatus = 'phonetic_substitution';
        bestDist = weightedDistance;
        bestDialectNote = undefined;
      }
    }

    if (matchedIdx !== -1) {
      alignment.push({
        targetWord: targetRaw,
        spokenWord: spokenTokens[matchedIdx],
        status: bestStatus,
        weightedDistance: bestDist,
        dialectNoteAr: bestDialectNote,
      });
      if (bestStatus === 'correct') {
        correctWordsCount++;
      } else if (bestStatus === 'dialect_variant') {
        dialectVariantCount++;
        correctWordsCount++; // Natural Arabic dialect pronunciation is semantically & lexically valid!
      } else {
        phoneticSubstitutionCount++;
      }
      spokenIdx = matchedIdx + 1;
    } else {
      alignment.push({
        targetWord: targetRaw,
        spokenWord: null,
        status: 'omitted',
        weightedDistance: 1.0,
      });
      omittedWordsCount++;
    }
  }

  const totalWords = Math.max(1, referenceWords.length);
  const safeDurationMin = Math.max(0.05, durationSeconds / 60);
  const wcpm = Math.round(correctWordsCount / safeDurationMin);
  const accuracyPercent = Math.round((correctWordsCount / totalWords) * 100);

  // Exact Dynamic Programming sequence alignment WER calculation:
  // Evaluates purely objective transcription error between reference words and spoken tokens.
  // When no spoken input was captured (empty transcript), WER is null rather than an artificial 0%.
  const hasSpokenTokens = spokenTokens.length > 0;
  const standardWerResult = hasSpokenTokens
    ? computeStandardSequenceWer(referenceWords, spokenTokens)
    : null;

  return {
    wcpm,
    totalWords,
    correctWordsCount,
    dialectVariantCount,
    phoneticSubstitutionCount,
    omittedWordsCount,
    insertionCount: standardWerResult ? standardWerResult.insertions : 0,
    substitutionsCount: standardWerResult ? standardWerResult.substitutions : 0,
    deletionsCount: standardWerResult ? standardWerResult.deletions : referenceWords.length,
    accuracyPercent,
    werPercent: standardWerResult ? standardWerResult.werPercent : null,
    standardWerPercent: standardWerResult ? standardWerResult.werPercent : null,
    hesitationPauseCount,
    alignment,
  };
}

