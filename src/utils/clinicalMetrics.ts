export interface WordFixation {
  wordIndex: number;
  word: string;
  durationMs: number;
  visits: number;
  regressedFromIndex?: number;
  blinks?: number;
  observed?: boolean;
}

export interface OralReadingIntegrationInput {
  assessed: boolean;
  wcpm?: number;
  accuracyPercent?: number | null;
  werPercent?: number | null;
  phoneticSubstitutionCount: number;
  dialectVariantCount: number;
  omissionCount: number;
  insertionCount?: number;
  misreadWords?: string[];
}

export interface EyeTrackingMetricsResult {
  wpm: number;
  avgFixationMs: number;
  regressionCount: number;
  regressionRate: number;
  saccadeCount: number;
  blinkCount: number;
  blinksPerMinute: number;
  /** Observed values only; no validated ocular-strain or dyslexia classification. */
  visualStrainLevel: 'unassessed';
  visualStrainLabelAr: string;
  dyslexiaRiskScore: null;
  heuristicIndicator: null;
  riskLevel: 'unassessed';
  riskLabelAr: string;
  problematicWords: string[];
  observedWordCount: number;
  totalPassageWordCount: number;
  gazeCoveragePercent: number;
  isSufficientGazeData: boolean;
  oralAccuracyPercent?: number | null;
  phoneticSubstitutionCount?: number;
  dialectVariantCount?: number;
  omissionCount?: number;
}

export interface SubitizingTrialResult {
  dotCount: number;
  correct: boolean;
  reactionTimeMs: number;
}

export interface NumberLineTrialResult {
  target: number;
  userEstimate: number;
  reactionTimeMs: number;
  scaleMin?: number; // Default 0
  scaleMax?: number; // Default 100
}

export interface TranscodingTrialResult {
  targetNumber: number;
  selectedNumber: number;
  isReversalError: boolean;
  reactionTimeMs: number;
}

export interface DyscalculiaMetricsResult {
  subitizingAccuracy: number | null;
  avgSubitizingMs: number | null;
  numberLinePAE: number | null;
  avgNumberLineMs: number | null;
  transcodingAccuracy: number | null;
  reversalErrorCount: number | null;
  /** Intentionally null: this prototype has no validated dyscalculia-risk cutoffs. */
  dyscalculiaRiskScore: null;
  /** Intentionally null: this prototype has no normed performance percentile. */
  heuristicIndicator: null;
  riskLevel: 'unassessed';
  riskLabelAr: string;
}

/**
 * Computes descriptive observations from genuinely observed word fixations.
 * Unobserved words are never filled with synthetic durations. The returned observations
 * do not produce dyslexia-risk or visual-strain classifications; this prototype has
 * no representative Arabic validation sample or calibrated cut-offs.
 */
export function calculateEyeTrackingMetrics(
  fixations: WordFixation[],
  totalDurationSeconds: number,
  _gradeLevel: number = 3,
  sessionBlinkCount?: number,
  totalPassageWordsOverride?: number,
  oralInput?: OralReadingIntegrationInput | null
): EyeTrackingMetricsResult {
  const observedFixations = (fixations || []).filter(
    (f) => f && f.durationMs > 0 && f.visits > 0
  );
  const totalPassageWordCount =
    totalPassageWordsOverride && totalPassageWordsOverride > 0
      ? totalPassageWordsOverride
      : Math.max(fixations?.length || 0, observedFixations.length);
  const observedWordCount = observedFixations.length;
  const gazeCoveragePercent =
    totalPassageWordCount > 0
      ? Math.min(
          100,
          Math.round((observedWordCount / totalPassageWordCount) * 100)
        )
      : 0;

  if (observedWordCount === 0 || totalDurationSeconds <= 0) {
    const fallbackBlinks = sessionBlinkCount ?? 0;
    const fallbackBpm =
      totalDurationSeconds > 0 && fallbackBlinks > 0
        ? Math.round((fallbackBlinks / Math.max(4, totalDurationSeconds)) * 60)
        : 0;
    return {
      wpm: 0,
      avgFixationMs: 0,
      regressionCount: 0,
      regressionRate: 0,
      saccadeCount: 0,
      blinkCount: fallbackBlinks,
      blinksPerMinute: fallbackBpm,
      visualStrainLevel: 'unassessed',
      visualStrainLabelAr: 'بيانات التثبيت غير متاحة؛ عدد الرمش المسجل ليس مقياسًا مستقلًا للإجهاد البصري.',
      dyslexiaRiskScore: null,
      heuristicIndicator: null,
      riskLevel: 'unassessed',
      riskLabelAr: 'لا توجد درجة خطر معيارية معتمدة لهذه الجلسة.',
      problematicWords: [],
      observedWordCount: 0,
      totalPassageWordCount,
      gazeCoveragePercent: 0,
      isSufficientGazeData: false,
      oralAccuracyPercent: oralInput?.assessed
        ? oralInput.accuracyPercent
        : null,
      phoneticSubstitutionCount: oralInput?.phoneticSubstitutionCount ?? 0,
      dialectVariantCount: oralInput?.dialectVariantCount ?? 0,
      omissionCount: oralInput?.omissionCount ?? 0,
    };
  }

  // WPM is computed strictly from genuinely observed words over elapsed reading time
  const wpm = Math.max(
    1,
    Math.round((observedWordCount / totalDurationSeconds) * 60)
  );

  let totalFixationMs = 0;
  let totalVisits = 0;
  let regressionCount = 0;
  let wordBlinksSum = 0;
  const problematicWords: string[] = [];

  for (const item of observedFixations) {
    const visits = Math.max(1, item.visits);
    totalFixationMs += item.durationMs;
    totalVisits += visits;
    wordBlinksSum += item.blinks ?? 0;

    if (
      typeof item.regressedFromIndex === 'number' &&
      item.regressedFromIndex > item.wordIndex
    ) {
      regressionCount += 1;
    }
    if (visits > 1) {
      regressionCount += visits - 1;
    }

    if (item.durationMs >= 420 || visits >= 2 || (item.blinks ?? 0) >= 2) {
      const cleaned = item.word.replace(/[،.؟!:"«»]/g, '').trim();
      if (cleaned && !problematicWords.includes(cleaned)) {
        problematicWords.push(cleaned);
      }
    }
  }

  // Merge misread words from oral reading alignment into problematicWords
  if (oralInput?.assessed && Array.isArray(oralInput.misreadWords)) {
    for (const mw of oralInput.misreadWords) {
      const cleaned = mw.replace(/[،.؟!:"«»]/g, '').trim();
      if (cleaned && !problematicWords.includes(cleaned)) {
        problematicWords.push(cleaned);
      }
    }
  }

  const blinkCount =
    typeof sessionBlinkCount === 'number'
      ? Math.max(sessionBlinkCount, wordBlinksSum)
      : wordBlinksSum;
  const blinksPerMinute =
    blinkCount > 0
      ? Math.round((blinkCount / Math.max(4, totalDurationSeconds)) * 60)
      : 0;

  const visualStrainLevel: 'unassessed' = 'unassessed';
  const visualStrainLabelAr =
    'تم تسجيل ' + blinksPerMinute + ' رمشة/دقيقة في هذه الجلسة. لا يُستنتج الإجهاد البصري أو صعوبة القراءة من معدل الرمش وحده.';

  const avgFixationMs = Math.round(
    totalFixationMs / Math.max(1, observedFixations.length)
  );
  const saccadeCount = Math.max(1, totalVisits - 1);
  const regressionRate = Math.min(
    100,
    Math.round((regressionCount / Math.max(1, totalVisits)) * 100)
  );

  // Fixations and regression counts are retained as descriptive observations only.
  // They are not mapped to dyslexia likelihood without representative Arabic validation data.
  const dyslexiaRiskScore: null = null;
  const heuristicIndicator: null = null;
  const riskLevel: 'unassessed' = 'unassessed';
  const riskLabelAr = 'لا توجد درجة خطر معيارية معتمدة؛ راجع القياسات بوصفها مؤشرات تقنية فقط.';

  const isSufficientGazeData =
    observedWordCount >= 3 &&
    (gazeCoveragePercent >= 25 || totalPassageWordCount <= 10);

  return {
    wpm,
    avgFixationMs,
    regressionCount,
    regressionRate,
    saccadeCount,
    blinkCount,
    blinksPerMinute,
    visualStrainLevel,
    visualStrainLabelAr,
    dyslexiaRiskScore,
    heuristicIndicator,
    riskLevel,
    riskLabelAr,
    problematicWords,
    observedWordCount,
    totalPassageWordCount,
    gazeCoveragePercent,
    isSufficientGazeData,
    oralAccuracyPercent: oralInput?.assessed ? oralInput.accuracyPercent : null,
    phoneticSubstitutionCount: oralInput?.phoneticSubstitutionCount ?? 0,
    dialectVariantCount: oralInput?.dialectVariantCount ?? 0,
    omissionCount: oralInput?.omissionCount ?? 0,
  };
}

export function calculateDyscalculiaMetrics(
  subitizing: SubitizingTrialResult[],
  numberLine: NumberLineTrialResult[],
  transcoding: TranscodingTrialResult[]
): DyscalculiaMetricsResult {
  const subitizingAccuracy =
    subitizing.length > 0
      ? Math.round((subitizing.filter((trial) => trial.correct).length / subitizing.length) * 100)
      : null;

  const avgSubitizingMs =
    subitizing.length > 0
      ? Math.round(subitizing.reduce((sum, trial) => sum + trial.reactionTimeMs, 0) / subitizing.length)
      : null;

  // Percent absolute error is a descriptive task measure, not a diagnostic cut-off.
  const numberLinePAE =
    numberLine.length > 0
      ? Number((
          numberLine.reduce((sum, trial) => {
            const scaleMin = typeof trial.scaleMin === 'number' ? trial.scaleMin : 0;
            const scaleMax = typeof trial.scaleMax === 'number' ? trial.scaleMax : 100;
            const scaleRange = Math.max(1, Math.abs(scaleMax - scaleMin));
            return sum + (Math.abs(trial.userEstimate - trial.target) / scaleRange) * 100;
          }, 0) / numberLine.length
        ).toFixed(1))
      : null;

  const avgNumberLineMs =
    numberLine.length > 0
      ? Math.round(numberLine.reduce((sum, trial) => sum + Math.max(100, trial.reactionTimeMs), 0) / numberLine.length)
      : null;

  const transcodingAccuracy =
    transcoding.length > 0
      ? Math.round((transcoding.filter((trial) => trial.targetNumber === trial.selectedNumber).length / transcoding.length) * 100)
      : null;

  const reversalErrorCount =
    transcoding.length > 0
      ? transcoding.filter((trial) => trial.isReversalError).length
      : null;

  const allTaskTypesObserved =
    subitizing.length > 0 && numberLine.length > 0 && transcoding.length > 0;

  return {
    subitizingAccuracy,
    avgSubitizingMs,
    numberLinePAE,
    avgNumberLineMs,
    transcodingAccuracy,
    reversalErrorCount,
    // This repository has no representative Arabic validation sample or calibrated
    // cut-offs. Deliberately avoid turning a few task responses into a risk label.
    dyscalculiaRiskScore: null,
    heuristicIndicator: null,
    riskLevel: 'unassessed',
    riskLabelAr: allTaskTypesObserved
      ? 'اكتملت المهام الوصفية؛ لا توجد درجة خطر معيارية معتمدة.'
      : 'لم تكتمل أنواع المهام اللازمة لعرض جميع المقاييس.',
  };
}

const ARABIC_DIACRITICS_REGEX = /[\u064B-\u0652\u0670]/;
const SUKUN = '\u0652';
const SHADDA = '\u0651';
const LONG_VOWELS = new Set(['ا', 'و', 'ي', 'ى']);

/**
 * Segments an Arabic word into visual phonological syllables (CV, CVV, CVC)
 * to assist dyslexic readers in decoding multi-syllabic words.
 */
export function segmentArabicWordIntoSyllables(word: string): string[] {
  const clean = word.trim();
  if (!clean) return [];

  // Group each base character with its immediately following diacritics
  const units: string[] = [];
  for (const ch of clean) {
    if (ARABIC_DIACRITICS_REGEX.test(ch) && units.length > 0) {
      units[units.length - 1] += ch;
    } else {
      units.push(ch);
    }
  }

  if (units.length <= 2) return [clean];

  const syllables: string[] = [];
  let i = 0;

  // Handle definite article "ال" as an initial morphological unit
  if (
    units.length >= 3 &&
    units[0].startsWith('ا') &&
    units[1].startsWith('ل')
  ) {
    syllables.push(units[0] + units[1]);
    i = 2;
  }

  while (i < units.length) {
    let current = units[i];
    const next = units[i + 1];

    if (next) {
      const nextBase = next[0];
      const nextHasSukun = next.includes(SUKUN);
      const nextHasShadda = next.includes(SHADDA);
      const nextIsLongVowel =
        LONG_VOWELS.has(nextBase) && next.length === 1;

      if (nextHasSukun || nextIsLongVowel || nextHasShadda) {
        current += next;
        i += 2;
        // If a shadda consonant is immediately followed by a long vowel (e.g. طُلَّابُ), keep the long vowel attached
        if (
          nextHasShadda &&
          i < units.length &&
          LONG_VOWELS.has(units[i][0]) &&
          units[i].length === 1
        ) {
          current += units[i];
          i += 1;
        }
        syllables.push(current);
        continue;
      }
    }

    // If it's the final single consonant, attach to previous syllable or pair with next
    if (i === units.length - 1 && syllables.length > 0) {
      syllables[syllables.length - 1] += current;
    } else {
      syllables.push(current);
    }
    i += 1;
  }

  return syllables;
}

export type ConfusableGroup =
  | 'baa_group' // ب ت ث ن
  | 'jeem_group' // ج ح خ
  | 'dal_group' // د ذ ر ز
  | 'seen_group' // س ش ص ض
  | 'ain_group' // ع غ ف ق
  | 'none';

const CONFUSABLE_MAP: Record<string, ConfusableGroup> = {
  ب: 'baa_group',
  ت: 'baa_group',
  ث: 'baa_group',
  ن: 'baa_group',
  ج: 'jeem_group',
  ح: 'jeem_group',
  خ: 'jeem_group',
  د: 'dal_group',
  ذ: 'dal_group',
  ر: 'dal_group',
  ز: 'dal_group',
  س: 'seen_group',
  ش: 'seen_group',
  ص: 'seen_group',
  ض: 'seen_group',
  ع: 'ain_group',
  غ: 'ain_group',
  ف: 'ain_group',
  ق: 'ain_group',
};

export function getConfusableLetterGroup(char: string): ConfusableGroup {
  const base = char.replace(ARABIC_DIACRITICS_REGEX, '')[0] || '';
  return CONFUSABLE_MAP[base] || 'none';
}
