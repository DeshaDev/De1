/**
 * Scoring for the Baseera cognitive profile battery.
 *
 * Raw score → percent correct → z-score against the reference for the child's age band →
 * centile → band. The reference table is versioned and carries its own status. While the
 * status is 'provisional', every centile is an estimate against expert-set expectations and
 * the report must say so; once an Arabic norming study supplies means and SDs, replacing
 * REFERENCE_TABLE upgrades every report without code changes elsewhere.
 */
import { BATTERY, DomainId, SUBTESTS_BY_ID, SubtestId, scoredItemCount } from './battery';

export interface ItemResponse {
  itemId: string;
  correct: boolean;
  rtMs: number;
  replays: number;
  /** For span tasks: number of positions recalled in the right place. */
  partialCredit?: number;
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
}

export type Band = 'severe' | 'below' | 'average' | 'strength';

export interface ScoredSubtest {
  subtestId: SubtestId;
  correct: number;
  total: number;
  percent: number;
  z: number;
  centile: number;
  band: Band;
  medianRtMs: number | null;
  flags: string[];
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
export type ReferenceStatus = 'provisional' | 'normed';

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
  rows: Record<SubtestId, ReferenceRow>;
}

export const REFERENCE_TABLE: ReferenceTable = {
  version: 'provisional-2026.10',
  status: 'provisional',
  sourceAr:
    'توقعات مرحلية مؤقتة وضعها فريق بصيرة استرشادًا بمسارات النمو المنشورة في الوعي الصوتي والذاكرة العاملة ومعرفة الحروف لدى الأطفال، إلى حين اكتمال دراسة التقنين على عينة عربية (انظر docs/SCIENTIFIC_VALIDATION_PLAN_AR.md).',
  rows: {
    visualSequential: [[30, 15], [40, 15], [50, 15], [58, 15], [65, 14]],
    visualAssociative: [[45, 18], [55, 17], [65, 16], [72, 15], [78, 13]],
    auditorySequential: [[25, 14], [35, 15], [45, 15], [53, 15], [60, 14]],
    pairedAssociate: [[45, 20], [55, 20], [66, 18], [75, 16], [82, 14]],
    rhyme: [[50, 20], [62, 19], [75, 17], [84, 13], [89, 10]],
    phonological: [[40, 18], [52, 18], [66, 17], [78, 15], [85, 12]],
    auditoryDiscrimination: [[65, 15], [72, 14], [80, 12], [86, 10], [90, 8]],
    visualDiscrimination: [[60, 18], [72, 16], [82, 13], [89, 10], [93, 7]],
    letterSound: [[20, 18], [45, 25], [75, 20], [90, 10], [95, 6]],
  },
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
  severe: { labelAr: 'ضعف واضح', color: '#b91c1c', bg: '#fee2e2' },
  below: { labelAr: 'دون المتوقع لعمره', color: '#c2410c', bg: '#ffedd5' },
  average: { labelAr: 'ضمن المتوقع لعمره', color: '#047857', bg: '#d1fae5' },
  strength: { labelAr: 'نقطة قوة', color: '#1d4ed8', bg: '#dbeafe' },
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
  // Items not reached because of the discontinue rule count as incorrect.
  const total = scoredItemCount(subtest);
  const correct = result.responses.filter((r) => r.correct).length;
  const percent = Math.round((correct / total) * 100);
  const { index } = ageBandIndex(ageMonths);
  const [mean, sd] = table.rows[result.subtestId][index];
  const z = Number(((percent - mean) / sd).toFixed(2));
  const centile = centileFromZ(z);

  const flags: string[] = [];
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
  if (result.discontinued) flags.push('discontinued');

  const medianRtMs = subtest.kind === 'choice' ? median(rts) : null;
  if (medianRtMs !== null && medianRtMs > SLOW_RT_THRESHOLD_MS[index]) flags.push('slowResponses');

  return {
    subtestId: result.subtestId,
    correct,
    total,
    percent,
    z,
    centile,
    band: bandFromCentile(centile),
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
  const subtests = BATTERY.filter((s) => results[s.id]).map((s) =>
    scoreSubtest(results[s.id] as SubtestResult, ageMonths, table)
  );
  const byId = new Map(subtests.map((s) => [s.subtestId, s]));
  const missing = BATTERY.filter((s) => !results[s.id]).map((s) => s.id);

  const domainIds = Array.from(new Set(BATTERY.map((s) => s.domain)));
  const domains: DomainScore[] = domainIds
    .map((domain) => {
      const members = BATTERY.filter((s) => s.domain === domain && byId.has(s.id)).map((s) => s.id);
      if (members.length === 0) return null;
      const meanZ = members.reduce((sum, id) => sum + (byId.get(id) as ScoredSubtest).z, 0) / members.length;
      const centile = centileFromZ(meanZ);
      return { domain, centile, band: bandFromCentile(centile), subtests: members };
    })
    .filter((d): d is DomainScore => d !== null);

  const coreIds = CORE_PHONOLOGICAL_SUBTESTS.filter(
    (id) => id !== 'letterSound' || ageMonths >= LETTER_SOUND_RISK_MIN_AGE_MONTHS
  );
  const coreScored = coreIds.map((id) => byId.get(id)).filter((s): s is ScoredSubtest => Boolean(s));
  const isWeak = (s: ScoredSubtest) => s.band === 'severe' || s.band === 'below';
  const coreWeakCount = coreScored.filter(isWeak).length;
  const coreSevereCount = coreScored.filter((s) => s.band === 'severe').length;
  const visualScored = VISUAL_SUBTESTS.map((id) => byId.get(id)).filter((s): s is ScoredSubtest => Boolean(s));
  const visualWeakCount = visualScored.filter(isWeak).length;
  const allWeakCount = subtests.filter(isWeak).length;

  let risk: RiskLevel;
  if (coreScored.length < 4) risk = 'insufficient';
  else if ((coreSevereCount >= 1 && coreWeakCount >= 2) || coreWeakCount >= 3) risk = 'high';
  else if (coreWeakCount >= 1) risk = 'moderate';
  else risk = 'low';

  let pattern: ProfilePattern = 'none';
  if (subtests.length >= 7 && allWeakCount >= subtests.length - 2) pattern = 'general';
  else if (coreWeakCount >= 1 && visualWeakCount >= 2) pattern = 'mixed';
  else if (coreWeakCount >= 1) pattern = 'phonological';
  else if (visualWeakCount >= 1) pattern = 'visual';

  const weaknesses = [...subtests].filter(isWeak).sort((a, b) => a.z - b.z).map((s) => s.subtestId);
  const strengths = subtests.filter((s) => s.band === 'strength').map((s) => s.subtestId);

  return {
    ageMonths,
    ageBandLabelAr: AGE_BANDS[index].labelAr,
    ageOutOfRange: outOfRange,
    referenceStatus: table.status,
    subtests,
    domains,
    risk,
    pattern,
    strengths,
    weaknesses,
    missing,
    coreWeakCount,
    coreSevereCount,
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
