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

  // Conservative display-only segmentation: do not invent vowel boundaries for
  // unvocalized or partially vocalized Arabic. Also leave shadda/gemination intact
  // unless a linguistically validated gemination-aware segmenter is available.
  const trailingPunctuation = clean.match(/[،؛,.!?؟:…]+$/)?.[0] ?? '';
  const core = trailingPunctuation
    ? clean.slice(0, -trailingPunctuation.length)
    : clean;
  if (!core || !/[\u064B-\u0652\u0670]/.test(core) || core.includes(SHADDA)) {
    return [clean];
  }
  if (!/^[\u0621-\u064A\u0670\u064B-\u0652ـ]+$/.test(core)) {
    return [clean];
  }

  // Each unit is one Arabic base letter plus any diacritics immediately after it.
  const units: string[] = [];
  for (const ch of core.normalize('NFC')) {
    if (ARABIC_DIACRITICS_REGEX.test(ch) && units.length > 0) {
      units[units.length - 1] += ch;
    } else {
      units.push(ch);
    }
  }

  // Require explicit vowel/sukun marks on consonants before splitting. Bare long
  // vowels are allowed; the first alif in the definite article is an exception.
  const hasDefiniteArticle = units.length >= 2 &&
    units[0].startsWith('ا') && units[1].startsWith('ل');
  for (let i = 0; i < units.length; i++) {
    const base = units[i][0];
    const marks = units[i].slice(1);
    const isBareLongVowel = LONG_VOWELS.has(base) && marks.length === 0;
    const isArticleAlif = hasDefiniteArticle && i === 0 && marks.length === 0;
    if (!isBareLongVowel && !isArticleAlif &&
        !/[\u064B-\u0652\u0670]/.test(marks)) {
      return [clean];
    }
  }

  const syllables: string[] = [];
  let current = '';
  for (const unit of units) {
    const base = unit[0];
    const marks = unit.slice(1);
    if (!current) {
      current = unit;
      continue;
    }

    const isBareLongVowel = LONG_VOWELS.has(base) && marks.length === 0;
    const closesSyllable = marks.includes(SUKUN);

    if (isBareLongVowel || closesSyllable) {
      current += unit;
      syllables.push(current);
      current = '';
    } else {
      syllables.push(current);
      current = unit;
    }
  }
  if (current) syllables.push(current);

  if (syllables.length <= 1) return [clean];
  if (trailingPunctuation) {
    syllables[syllables.length - 1] += trailingPunctuation;
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
