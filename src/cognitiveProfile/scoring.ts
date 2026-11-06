/**
 * Scoring for the Baseera cognitive profile battery.
 *
 * Task scores are descriptive only. Team-set reference values were never normed on an
 * independent Arabic child sample, so age comparisons and derived classifications are disabled
 * until an Arabic standardization study is completed.
 */
import { BATTERY, DomainId, SUBTESTS_BY_ID, SubtestId, appliesAtAge, scoredItemCount } from './battery';
import { letterAccuracy, perMinute, ranRate, spellingErrorKinds, type SpellErrorKind } from './readingTasks';

export interface ItemResponse {
  itemId: string;
  correct: boolean;
  rtMs: number;
  replays: number;
  /** For span tasks: number of positions recalled in the right place. */
  partialCredit?: number;
  /** For dictation: the letters the child typed (no vowel marks). */
  typed?: string;
}

export interface SubtestResult {
  subtestId: SubtestId;
  responses: ItemResponse[];
  /** True when the discontinue rule ended the subtest early. */
  discontinued: boolean;
  completedAt: string;
  /** For span tasks: longest sequence length recalled correctly at least once. */
  maxSpan?: number;
  /** For paired-associate learning: correct answers per learning block. */
  blockScores?: number[];
  /** For rapid naming and the passage: time from start to the last item named or read. */
  durationMs?: number;
  /** For rapid naming: errors confirmed by the word-level speech model. */
  errorCount?: number;
  attemptedCount?: number;
  assessmentSource?: 'azure';
  aiAssessmentReceipt?: string;
}

/** Raw reading and naming measures. They have no reference values yet and are reported as they are. */
export interface ReadingMeasures {
  /** Items (words, grid cells) attempted. */
  attempted: number;
  /** Seconds for the task, or for the items read. */
  seconds: number | null;
  /** Correct words per minute (word lists and passage). */
  correctPerMinute?: number;
  /** Items named per second (rapid naming). */
  itemsPerSecond?: number;
  errors?: number;
  /** Mean letter-level accuracy over the words attempted, 0–100 (dictation). */
  letterPercent?: number;
  /** Kinds of spelling error, with how many words showed each. */
  spellingErrors?: Array<{ kind: SpellErrorKind; count: number }>;
}

export type Band = 'severe' | 'below' | 'average' | 'strength';

export interface ScoredSubtest {
  subtestId: SubtestId;
  correct: number;
  total: number;
  percent: number;
  /** Null for tasks with no reference values (the reading and naming measures). */
  z: number | null;
  centile: number | null;
  band: Band | null;
  medianRtMs: number | null;
  flags: string[];
  scoreAvailable?: boolean;
  measures?: ReadingMeasures;
}

export interface DomainScore {
  domain: DomainId;
  centile: number;
  band: Band;
  subtests: SubtestId[];
}

export type RiskLevel = 'high' | 'moderate' | 'low' | 'insufficient';
export type ProfilePattern = 'phonological' | 'visual' | 'mixed' | 'general' | 'none';

export interface CognitiveProfile {
  ageMonths: number;
  ageBandLabelAr: string;
  ageOutOfRange: boolean;
  referenceStatus: ReferenceStatus;
  subtests: ScoredSubtest[];
  domains: DomainScore[];
  risk: RiskLevel;
  pattern: ProfilePattern;
  strengths: SubtestId[];
  weaknesses: SubtestId[];
  missing: SubtestId[];
  coreWeakCount: number;
  coreSevereCount: number;
}

// ---------------------------------------------------------------------------
// Reference table
// ---------------------------------------------------------------------------
export type ReferenceStatus = 'disabled' | 'normed';

interface AgeBand {
  minMonths: number;
  maxMonths: number;
  labelAr: string;
}

export const AGE_BANDS: AgeBand[] = [
  { minMonths: 48, maxMonths: 59, labelAr: '٤ سنوات – ٤ سنوات و١١ شهرًا' },
  { minMonths: 60, maxMonths: 71, labelAr: '٥ سنوات – ٥ سنوات و١١ شهرًا' },
  { minMonths: 72, maxMonths: 83, labelAr: '٦ سنوات – ٦ سنوات و١١ شهرًا' },
  { minMonths: 84, maxMonths: 95, labelAr: '٧ سنوات – ٧ سنوات و١١ شهرًا' },
  { minMonths: 96, maxMonths: 107, labelAr: '٨ سنوات – ٨ سنوات و١١ شهرًا' },
];

/** [mean, sd] of percent correct for each age band (index matches AGE_BANDS). */
type ReferenceRow = Array<[number, number]>;

export interface ReferenceTable {
  version: string;
  status: ReferenceStatus;
  sourceAr: string;
  /** Tasks without a row are reported as raw measures only. */
  rows: Partial<Record<SubtestId, ReferenceRow>>;
}

export const REFERENCE_TABLE: ReferenceTable = {
  version: 'disabled-pending-arabic-norming',
  status: 'disabled',
  sourceAr: 'القيم المرجعية المرحلية معطلة؛ لم تُستمد من عينة عربية مستقلة.',
  rows: {},
};

/** Median response time (ms) above which processing is flagged as slow, by age band. */
const SLOW_RT_THRESHOLD_MS = [7000, 6000, 5000, 4300, 3800];
const FAST_GUESS_RT_MS = 500;

export function ageBandIndex(ageMonths: number): { index: number; outOfRange: boolean } {
  if (ageMonths < AGE_BANDS[0].minMonths) return { index: 0, outOfRange: true };
  const last = AGE_BANDS.length - 1;
  if (ageMonths > AGE_BANDS[last].maxMonths) return { index: last, outOfRange: true };
  const index = AGE_BANDS.findIndex((b) => ageMonths >= b.minMonths && ageMonths <= b.maxMonths);
  return { index, outOfRange: false };
}

/**
 * How much weight a screening result can carry at this age.
 * Precursor screening is least stable before school entry (Thompson et al., 2015), and from
 * about eight the child's reading itself should be measured directly.
 */
export function ageCautionAr(ageMonths: number): string | null {
  if (ageMonths < 60)
    return 'في عمر أربع سنوات لا يُتوقَّع من الطفل أن يقرأ، والفحص لا يطلب منه القراءة؛ يقيس المهارات التي تسبقها (الأصوات والذاكرة والتمييز). لكن نتائج هذا العمر أقل ثباتًا، فاعتبرها مؤشرًا أوليًا وأعد الفحص بعد ستة أشهر قبل أي استنتاج.';
  if (ageMonths >= 96)
    return 'في عمر ثماني سنوات يكون الطفل قد تلقّى غالبًا سنتين من تعليم القراءة، فتقلّ دلالة المهارات السابقة للقراءة وحدها. لذلك تعطي مهام القراءة المباشرة (الكلمات، والكلمات المصنوعة، والقصة، والإملاء، والتسمية السريعة) في هذا العمر الصورة الأوضح. راجع أخصائيًا عند الاشتباه.';
  return null;
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26), accurate to ~1e-7. */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

export function centileFromZ(z: number): number {
  return Math.min(99, Math.max(1, Math.round(normalCdf(z) * 100)));
}

/** Bands follow the conventions of computerised screening reports: ≤5 and ≤20 mark concern. */
export function bandFromCentile(centile: number): Band {
  if (centile <= 5) return 'severe';
  if (centile <= 20) return 'below';
  if (centile >= 80) return 'strength';
  return 'average';
}

export const BAND_META: Record<Band, { labelAr: string; color: string; bg: string }> = {
  severe: { labelAr: 'ضعف واضح', color: '#B42318', bg: '#FDECEA' },
  below: { labelAr: 'دون المتوقع لعمره', color: '#B54708', bg: '#FEF0E1' },
  average: { labelAr: 'ضمن المتوقع لعمره', color: '#4A5868', bg: '#EFEDE7' },
  strength: { labelAr: 'نقطة قوة', color: '#0B6E69', bg: '#E3F1EF' },
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function scoreSubtest(
  result: SubtestResult,
  ageMonths: number,
  table: ReferenceTable = REFERENCE_TABLE
): ScoredSubtest {
  const subtest = SUBTESTS_BY_ID[result.subtestId];
  const { index } = ageBandIndex(ageMonths);
  const flags: string[] = [];
  if (result.discontinued) flags.push('discontinued');

  // Reading and naming measures: raw counts, rates and times.
  if (subtest.kind === 'ran') {
    const total = result.assessmentSource === 'azure'
      ? Math.max(0, Math.min(scoredItemCount(subtest), result.attemptedCount ?? 0))
      : 0;
    const errors = Math.min(total, result.errorCount ?? 0);
    const correct = total - errors;
    const durationMs = result.durationMs ?? 0;
    return {
      subtestId: result.subtestId, correct, total,
      percent: total ? Math.round((correct / total) * 100) : 0,
      z: null, centile: null, band: null, medianRtMs: null, flags,
      scoreAvailable: total > 0,
      measures: { attempted: total, seconds: durationMs ? Math.round(durationMs / 100) / 10 : null, itemsPerSecond: ranRate(total, durationMs), errors },
    };
  }
  if (subtest.kind === 'passage') {
    const responses = result.assessmentSource === 'azure' ? result.responses : [];
    const attempted = responses.length;
    const correct = responses.filter((r) => r.correct).length;
    const durationMs = result.durationMs ?? 0;
    return {
      subtestId: result.subtestId,
      correct,
      total: attempted,
      percent: attempted ? Math.round((correct / attempted) * 100) : 0,
      z: null,
      centile: null,
      band: null,
      medianRtMs: null,
      flags,
      scoreAvailable: attempted > 0,
      measures: {
        attempted,
        seconds: durationMs ? Math.round(durationMs / 1000) : null,
        correctPerMinute: perMinute(correct, durationMs),
        errors: attempted - correct,
      },
    };
  }
  if (subtest.kind === 'readList' || subtest.kind === 'spelling') {
    const responses = subtest.kind === 'readList' && result.assessmentSource !== 'azure' ? [] : result.responses;
    const total = subtest.kind === 'readList' ? responses.length : scoredItemCount(subtest);
    const correct = responses.filter((r) => r.correct).length;
    const timeMs = subtest.kind === 'readList' ? (result.durationMs ?? 0) : responses.reduce((sum, r) => sum + r.rtMs, 0);
    const measures: ReadingMeasures = { attempted: responses.length, seconds: timeMs ? Math.round(timeMs / 1000) : null };
    if (subtest.kind === 'readList') measures.correctPerMinute = perMinute(correct, timeMs);
    if (subtest.kind === 'spelling') {
      const answers = new Map(subtest.items.map((i) => [i.id, i.answer]));
      const scored = responses.filter((r) => answers.has(r.itemId));
      measures.letterPercent = scored.length
        ? Math.round((scored.reduce((sum, r) => sum + letterAccuracy(r.typed ?? '', answers.get(r.itemId)!), 0) / scored.length) * 100)
        : 0;
      const counts = new Map<SpellErrorKind, number>();
      for (const r of scored) for (const k of spellingErrorKinds(r.typed ?? '', answers.get(r.itemId)!)) counts.set(k, (counts.get(k) ?? 0) + 1);
      measures.spellingErrors = [...counts].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
    }
    return {
      subtestId: result.subtestId,
      correct,
      total,
      percent: total ? Math.round((correct / total) * 100) : 0,
      z: null,
      centile: null,
      band: null,
      medianRtMs: null,
      flags,
      scoreAvailable: subtest.kind !== 'readList' || responses.length > 0,
      measures,
    };
  }

  const total = scoredItemCount(subtest);
  const correct = result.responses.filter((r) => r.correct).length;
  const percent = Math.round((correct / total) * 100);
  void table;
  const z = null;
  const centile = null;

  const answered = result.responses.length;
  const chancePercent = subtest.chance * 100;
  if (subtest.chance > 0 && answered >= total / 2 && percent <= chancePercent + 10) {
    flags.push('nearChance');
  }
  const rts = result.responses.map((r) => r.rtMs).filter((rt) => rt > 0);
  const fastCount = rts.filter((rt) => rt < FAST_GUESS_RT_MS).length;
  if (rts.length >= 4 && fastCount / rts.length > 0.4) flags.push('fastGuessing');
  const replays = result.responses.reduce((sum, r) => sum + r.replays, 0);
  if (answered > 0 && replays / answered > 0.5) flags.push('manyReplays');

  const medianRtMs = subtest.kind === 'choice' ? median(rts) : null;
  if (medianRtMs !== null && medianRtMs > SLOW_RT_THRESHOLD_MS[index]) flags.push('slowResponses');

  return {
    subtestId: result.subtestId,
    correct,
    total,
    percent,
    z,
    centile,
    band: centile === null ? null : bandFromCentile(centile),
    medianRtMs,
    flags,
  };
}

/** Skills whose weakness is most predictive of later word-reading difficulty. */
export const CORE_PHONOLOGICAL_SUBTESTS: SubtestId[] = [
  'rhyme',
  'phonological',
  'auditorySequential',
  'pairedAssociate',
  'auditoryDiscrimination',
  'letterSound',
];
const VISUAL_SUBTESTS: SubtestId[] = ['visualSequential', 'visualAssociative', 'visualDiscrimination'];

/** Letter knowledge is only expected from about age 5; before that it is reported but not used for risk. */
const LETTER_SOUND_RISK_MIN_AGE_MONTHS = 60;

export function buildProfile(
  results: Partial<Record<SubtestId, SubtestResult>>,
  ageMonths: number,
  table: ReferenceTable = REFERENCE_TABLE
): CognitiveProfile {
  const { index, outOfRange } = ageBandIndex(ageMonths);
  void table;
  const subtests = BATTERY.filter((s) => results[s.id]).map((s) =>
    scoreSubtest(results[s.id] as SubtestResult, ageMonths)
  );
  const missing = BATTERY.filter((s) => appliesAtAge(s, ageMonths) && !results[s.id]).map((s) => s.id);
  return {
    ageMonths,
    ageBandLabelAr: AGE_BANDS[index].labelAr,
    ageOutOfRange: outOfRange,
    referenceStatus: 'disabled',
    subtests,
    domains: [],
    risk: 'insufficient',
    pattern: 'none',
    strengths: [],
    weaknesses: [],
    missing,
    coreWeakCount: 0,
    coreSevereCount: 0,
  };
}

/** Span scoring: a trial is correct only when every item is recalled in order. */
export function scoreSpanTrial(sequence: string[], response: string[]): { correct: boolean; positions: number } {
  const positions = sequence.reduce((sum, id, i) => sum + (response[i] === id ? 1 : 0), 0);
  return { correct: positions === sequence.length && response.length === sequence.length, positions };
}

/**
 * Span discontinue rule: trials come in pairs of equal length; stop when both trials of a
 * length are failed. Returns true when the subtest should stop after `responses`.
 */
export function shouldStopSpan(trialLengths: number[], responses: ItemResponse[]): boolean {
  const n = responses.length;
  if (n < 2) return false;
  const lastLength = trialLengths[n - 1];
  const sameLength = responses.filter((_, i) => trialLengths[i] === lastLength);
  const trialsAtLength = trialLengths.filter((l) => l === lastLength).length;
  return sameLength.length === trialsAtLength && sameLength.every((r) => !r.correct);
}

export function maxSpanFrom(trialLengths: number[], responses: ItemResponse[]): number {
  return responses.reduce((max, r, i) => (r.correct ? Math.max(max, trialLengths[i]) : max), 0);
}

/** Consecutive-error discontinue rule for choice subtests. */
export function shouldDiscontinue(responses: ItemResponse[], limit: number): boolean {
  if (responses.length < limit) return false;
  return responses.slice(-limit).every((r) => !r.correct);
}

export function formatAge(ageMonths: number): string {
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  const yearsText = years >= 3 && years <= 10 ? `${years} سنوات` : `${years} سنة`;
  if (months === 0) return yearsText;
  const monthsText =
    months === 1 ? 'شهر' : months === 2 ? 'شهران' : months <= 10 ? `${months} أشهر` : `${months} شهرًا`;
  return `${yearsText} و${monthsText}`;
}
