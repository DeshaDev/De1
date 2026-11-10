/**
 * Scoring for the Baseera cognitive profile battery.
 *
 * Task scores are descriptive only. Team-set reference values were never normed on an
 * independent Arabic child sample, so age comparisons and derived classifications are disabled
 * until an Arabic standardization study is completed.
 */
import { BATTERY, DomainId, SUBTESTS_BY_ID, SubtestId, appliesAtAge, scoredItemCount } from './battery';
import { SPELL_ERROR_TEXT_AR, letterAccuracy, perMinute, ranRate, spellingErrorKinds, type SpellErrorKind } from './readingTasks';
import { analyseReadingErrors, type ReadWord } from '../utils/readingErrorPatterns';
import type { SkillId } from './training';

export interface ItemResponse {
  itemId: string;
  correct: boolean;
  rtMs: number;
  replays: number;
  /** For span tasks: number of positions recalled in the right place. */
  partialCredit?: number;
  /** For dictation: the letters the child typed (no vowel marks). */
  typed?: string;
  /**
   * Voice-scored words in an accuracy study: what the adult heard, marked before seeing the
   * engine's result. Kept for agreement statistics only; `correct` stays the engine's verdict.
   */
  humanCorrect?: boolean;
}

export interface CognitiveAudioAssessmentEvidence {
  taskId: 'oralReading' | 'ranObjects' | 'ranLetters' | 'wordReading' | 'nonwordReading';
  sourceModel: 'azure_pronunciation_assessment';
  assessmentComplete: true;
  assessmentReceipt: string;
  transcript: string;
  durationSeconds: number;
  wordAccuracyPercent: number;
  wordsCorrectPerMinute: number | null;
  wordsPerMinute: number | null;
  correctWordsCount: number;
  substitutionsCount: number;
  omissionsCount: number;
  insertionsCount: number;
  words: Array<{
    word: string;
    errorType: 'None' | 'Omission' | 'Mispronunciation' | 'Substitution' | 'DialectVariant' | 'Unconfirmed' | 'Insertion';
    accuracyScore: number | null;
    spokenWord: string | null;
  }>;
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
  /** Raw output returned by the authenticated Azure audio endpoint. The server revalidates its receipt on cloud sync. */
  audioAssessment?: CognitiveAudioAssessmentEvidence;
  audioAssessmentReceipt?: string;
}

/** Raw reading and naming measures. They have no reference values yet and are reported as they are. */
export interface ReadingMeasures {
  /** Items (words, grid cells) attempted. */
  attempted: number;
  /** Seconds for the task, or for the items read. */
  seconds: number | null;
  /** Correct words per minute (word lists and passage). */
  correctPerMinute?: number;
  /** Label clarifying which elapsed time is reported for this task. */
  secondsLabel?: string;
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

export interface StructuredLiteracyPillars {
  /** 1. ما الذي يستطيع الطفل فعله بنجاح؟ */
  strengthsAr: string[];
  /** 2. أين انكسر أداء الطفل بالتحديد؟ */
  breakdownPointsAr: string[];
  /** 3. التفسير الصوتي والمعرفي للخلل */
  phonologicalRootAr: string;
  /** 4. الخطة والمهارة التالية الموصى بتدريسها  */
  nextInstructionalTargetAr: string;
  /** الوحدات التدريبية المقترحة مباشرة في الصالة */
  recommendedModules: Array<{ id: string; titleAr: string; descriptionAr: string }>;
}

export interface ExtractedReadingTargets {
  skills: SkillId[];
  soundPairs: Array<[string, string]>;
  letters: string[];
  reasonsAr: string[];
  passageId: string;
  analysedAt: string;
  /** Descriptive 0-100 rate per extracted error skill, scaled by actual error frequency and task accuracy. */
  skillRates?: Partial<Record<SkillId, number>>;
  /** Exact error count observed for each error-pattern skill. */
  errorCounts?: Partial<Record<SkillId, number>>;
}

export interface CognitiveProfile {
  structuredLiteracy?: StructuredLiteracyPillars;
  readingTargets?: ExtractedReadingTargets;
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

function hasVerifiedAudioAssessment(
  subtestId: SubtestId,
  result: SubtestResult | undefined
): result is SubtestResult & { audioAssessment: CognitiveAudioAssessmentEvidence } {
  const evidence = result?.audioAssessment;
  const subtest = SUBTESTS_BY_ID[subtestId];
  const receiptValid =
    typeof evidence?.assessmentReceipt === 'string' && /^[a-f0-9]{64}$/.test(evidence.assessmentReceipt);
  const expectedTotal = scoredItemCount(subtest);
  return Boolean(
    evidence &&
      evidence.taskId === subtestId &&
      evidence.sourceModel === 'azure_pronunciation_assessment' &&
      evidence.assessmentComplete === true &&
      receiptValid &&
      evidence.words.length === expectedTotal &&
      evidence.words.every((word) => word.errorType !== 'Unconfirmed' && word.errorType !== 'Insertion') &&
      evidence.durationSeconds >= 1 &&
      evidence.durationSeconds <= 88
  );
}

function severityPercentFromErrorRate(errorCount: number, taskAccuracyPercent: number, totalWords: number): number {
  const errorSharePct = (errorCount / Math.max(1, totalWords)) * 100;
  const penalty = Math.min(68, Math.round(errorCount * 10 + (100 - taskAccuracyPercent) * 0.4 + errorSharePct * 0.5));
  return Math.max(18, Math.min(86, 94 - penalty));
}

export function extractReadingTargetsFromResults(
  results: Partial<Record<SubtestId, SubtestResult>>
): ExtractedReadingTargets | undefined {
  const skills: SkillId[] = [];
  const soundPairs: Array<[string, string]> = [];
  const letters: string[] = [];
  const reasonsAr: string[] = [];
  const errorCounts: Partial<Record<SkillId, number>> = {};
  const skillRates: Partial<Record<SkillId, number>> = {};
  let passageId = '';
  let analysedAt = '';

  const addErrorSkill = (skill: SkillId, count: number, rate: number) => {
    if (count <= 0) return;
    if (!skills.includes(skill)) skills.push(skill);
    errorCounts[skill] = (errorCounts[skill] ?? 0) + count;
    const prevRate = skillRates[skill];
    skillRates[skill] = prevRate === undefined ? rate : Math.min(prevRate, rate);
  };

  for (const taskId of ['oralReading', 'wordReading', 'nonwordReading'] as const) {
    const result = results[taskId];
    if (!hasVerifiedAudioAssessment(taskId, result)) continue;
    const mapped: ReadWord[] = result.audioAssessment.words.map((w) => ({
      word: w.word,
      spokenWord: w.spokenWord,
      status:
        w.errorType === 'None'
          ? 'correct'
          : w.errorType === 'DialectVariant'
            ? 'dialect_variant'
            : w.errorType === 'Omission'
              ? 'omitted'
              : w.errorType === 'Unconfirmed' || w.errorType === 'Insertion'
                ? 'unconfirmed'
                : 'phonetic_substitution',
    }));
    const analysed = analyseReadingErrors(mapped, taskId);
    if (!passageId) passageId = taskId;
    analysedAt = analysed.analysedAt;

    const totalWords = Math.max(1, result.audioAssessment.words.length);
    const correctCount = result.audioAssessment.words.filter(
      (w) => w.errorType === 'None' || w.errorType === 'DialectVariant'
    ).length;
    const taskAccuracyPercent = Math.round((correctCount / totalWords) * 100);

    const soundCount = analysed.letterConfusions
      .filter((c) => c.kind === 'sound')
      .reduce((sum, c) => sum + c.count, 0);
    const visualCount = analysed.letterConfusions
      .filter((c) => c.kind === 'visual')
      .reduce((sum, c) => sum + c.count, 0);
    const longVowelCount = analysed.longVowelErrors.length;
    const decodingCount = analysed.wholeWordSubstitutions.length + analysed.omittedWords.length;

    if (soundCount > 0) {
      addErrorSkill('discrimination', soundCount, severityPercentFromErrorRate(soundCount, taskAccuracyPercent, totalWords));
    }
    if (visualCount > 0) {
      addErrorSkill(
        'visualDiscrimination',
        visualCount,
        severityPercentFromErrorRate(visualCount, taskAccuracyPercent, totalWords)
      );
    }
    const letterSoundErrors = soundCount + visualCount + longVowelCount;
    if (letterSoundErrors > 0) {
      addErrorSkill(
        'letterSound',
        letterSoundErrors,
        severityPercentFromErrorRate(letterSoundErrors, taskAccuracyPercent, totalWords)
      );
    }
    if (decodingCount >= 2) {
      addErrorSkill(
        'blending',
        decodingCount,
        severityPercentFromErrorRate(decodingCount, taskAccuracyPercent, totalWords)
      );
    }

    for (const pair of analysed.recommendations.soundPairs) {
      if (!soundPairs.some(([a, b]) => (a === pair[0] && b === pair[1]) || (a === pair[1] && b === pair[0]))) {
        soundPairs.push(pair);
      }
    }
    for (const ch of analysed.recommendations.letters) {
      if (!letters.includes(ch)) letters.push(ch);
    }
    for (const reason of analysed.recommendations.reasonsAr) {
      if (!reasonsAr.includes(reason)) reasonsAr.push(reason);
    }
  }

  if (skills.length === 0 && soundPairs.length === 0 && letters.length === 0) return undefined;
  return {
    skills,
    soundPairs: soundPairs.slice(0, 6),
    letters: letters.slice(0, 10),
    reasonsAr,
    passageId: passageId || 'oralReading',
    analysedAt: analysedAt || new Date().toISOString(),
    skillRates,
    errorCounts,
  };
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

  // Speech-based tasks are scored only from a complete Azure result carrying a
  // server-issued receipt. Browser transcripts, manual marks and client counts are ignored.
  if (subtest.kind === 'ran' || subtest.kind === 'passage' || subtest.kind === 'readList') {
    if (!hasVerifiedAudioAssessment(result.subtestId, result)) {
      return {
        subtestId: result.subtestId,
        correct: 0,
        total: 0,
        percent: 0,
        z: null,
        centile: null,
        band: null,
        medianRtMs: null,
        flags,
        scoreAvailable: false,
        measures: { attempted: 0, seconds: null },
      };
    }
    const evidence = result.audioAssessment;

    const correct = evidence.words.filter((word) =>
      word.errorType === 'None' || word.errorType === 'DialectVariant'
    ).length;
    const total = evidence.words.length;
    const seconds = Math.max(1, Math.round(evidence.durationSeconds));
    const errors = evidence.substitutionsCount + evidence.omissionsCount + evidence.insertionsCount;
    const measures: ReadingMeasures = {
      attempted: total,
      seconds,
      errors,
      ...(subtest.kind === 'ran'
        ? { secondsLabel: 'زمن التسمية', itemsPerSecond: Math.round((total / evidence.durationSeconds) * 100) / 100 }
        : {
            secondsLabel: subtest.kind === 'readList' ? 'زمن التسجيلات الصوتية' : 'زمن القراءة',
            ...(evidence.wordsCorrectPerMinute !== null
              ? { correctPerMinute: evidence.wordsCorrectPerMinute }
              : {}),
          }),
    };
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
      scoreAvailable: true,
      measures,
    };
  }
  if (subtest.kind === 'spelling') {
    const responses = result.responses;
    const total = scoredItemCount(subtest);
    const correct = responses.filter((r) => r.correct).length;
    const timeMs = responses.reduce((sum, r) => sum + r.rtMs, 0);
    const measures: ReadingMeasures = { attempted: responses.length, seconds: timeMs ? Math.round(timeMs / 1000) : null };
    const answers = new Map(subtest.items.map((i) => [i.id, i.answer]));
    const scored = responses.filter((r) => answers.has(r.itemId));
    measures.letterPercent = scored.length
      ? Math.round((scored.reduce((sum, r) => sum + letterAccuracy(r.typed ?? '', answers.get(r.itemId)!), 0) / scored.length) * 100)
      : 0;
    const counts = new Map<SpellErrorKind, number>();
    for (const r of scored) for (const k of spellingErrorKinds(r.typed ?? '', answers.get(r.itemId)!)) counts.set(k, (counts.get(k) ?? 0) + 1);
    measures.spellingErrors = [...counts].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
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
      scoreAvailable: true,
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


export function computeStructuredLiteracyPillars(
  subtests: ScoredSubtest[],
  ageMonths: number,
  readingTargets?: ExtractedReadingTargets
): StructuredLiteracyPillars {
  const toAr = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  const scoredMap = new Map(subtests.map((s) => [s.subtestId, s]));
  const strengthsAr: string[] = [];
  const breakdownPointsAr: string[] = [];
  const recommendedModules: Array<{ id: string; titleAr: string; descriptionAr: string }> = [];

  const available = (s: ScoredSubtest | undefined): s is ScoredSubtest =>
    Boolean(s && s.scoreAvailable !== false && s.total > 0);

  const wordReading = available(scoredMap.get('wordReading')) ? scoredMap.get('wordReading') : undefined;
  const nonwordReading = available(scoredMap.get('nonwordReading')) ? scoredMap.get('nonwordReading') : undefined;
  const oralReading = available(scoredMap.get('oralReading')) ? scoredMap.get('oralReading') : undefined;
  const phonological = available(scoredMap.get('phonological')) ? scoredMap.get('phonological') : undefined;
  const letterSound = available(scoredMap.get('letterSound')) ? scoredMap.get('letterSound') : undefined;
  const spelling = available(scoredMap.get('spelling')) ? scoredMap.get('spelling') : undefined;
  const ranLetters = available(scoredMap.get('ranLetters')) ? scoredMap.get('ranLetters') : undefined;
  const ranObjects = available(scoredMap.get('ranObjects')) ? scoredMap.get('ranObjects') : undefined;
  const rhyme = available(scoredMap.get('rhyme')) ? scoredMap.get('rhyme') : undefined;
  const auditoryDisc = available(scoredMap.get('auditoryDiscrimination')) ? scoredMap.get('auditoryDiscrimination') : undefined;

  if (ageMonths < 72) {
    if (rhyme) strengthsAr.push(`دقة مهمة القافية السمعية الملاحظة: ${toAr(rhyme.percent)}٪.`);
    if (phonological) strengthsAr.push(`دقة مهمة الوعي الفونولوجي الملاحظة: ${toAr(phonological.percent)}٪.`);
    if (letterSound) strengthsAr.push(`دقة ربط الحرف بصوته الملاحظة: ${toAr(letterSound.percent)}٪.`);
    if (ranObjects?.measures?.itemsPerSecond) strengthsAr.push(`معدل تسمية الصور الملاحظ: ${toAr(ranObjects.measures.itemsPerSecond)} عنصر/ثانية.`);
    if (strengthsAr.length === 0) strengthsAr.push('التفاعل السمعي مع الأنشطة الأولية السابقة للقراءة.');

    const preLowest = [phonological, rhyme, auditoryDisc, ranObjects]
      .filter((s): s is ScoredSubtest => Boolean(s))
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 3);
    for (const item of preLowest) {
      if (item.percent < 85) {
        breakdownPointsAr.push(
          `أولوية تدريبية نسبية في ${SUBTESTS_BY_ID[item.subtestId].skillNameAr}: دقة ملاحظة ${toAr(item.percent)}٪ داخل المهمة (ترتيب وصفي مؤقت بلا عتبة معيارية).`
        );
      }
    }
    if (breakdownPointsAr.length === 0) {
      breakdownPointsAr.push('الاستمرار في تعزيز الوعي الفونولوجي الصوتي قبل الانتقال لقراءة الكلمات.');
    }

    const phonologicalRootAr =
      'المرحلة العمرية (٤–٥ سنوات) مرحلة تأسيس سمعي وفونولوجي؛ تركّز الخطة على ترتيب الأنشطة من الأقل نسبة إلى الأعلى دون مطالبة الطفل بقراءة أو إملاء مكتوب، ودون حدود معيارية مقننة.';
    const nextInstructionalTargetAr =
      'التعليم الصوتي المنظم: أنشطة القافية، عدّ المقاطع بالتصفيق، والتمييز السمعي ودمج المقاطع المسموعة من الأسهل إلى الأصعب.';

    recommendedModules.push(
      { id: 'rhyme-gym', titleAr: 'مختبر القوافي السحرية', descriptionAr: 'تدريبات سمعية تفاعلية لتمييز نهايات الكلمات المتماثلة.' },
      { id: 'sound-blending', titleAr: 'قطار دمج الأصوات', descriptionAr: 'تركيب الكلمات البسيطة من مقاطعها وأصواتها المسموعة.' }
    );

    return { strengthsAr, breakdownPointsAr, phonologicalRootAr, nextInstructionalTargetAr, recommendedModules };
  }

  // School-age readers (descriptive in-task observations sorted relatively; no normed clinical cutoffs)
  for (const [label, task] of [
    ['قراءة الكلمات الحقيقية', wordReading],
    ['فك ترميز الكلمات المصنوعة', nonwordReading],
    ['ربط الحرف بصوته', letterSound],
    ['الإملاء التفاعلي', spelling],
  ] as const) {
    if (task && task.percent >= 50) {
      strengthsAr.push(`${label}: دقة ملاحظة ${toAr(task.percent)}٪ داخل المهمة.`);
    }
  }
  if (oralReading?.measures?.correctPerMinute !== undefined) {
    strengthsAr.push(`القراءة الجهرية للنص المتصل: ${toAr(oralReading.percent)}٪ دقة · ${toAr(oralReading.measures.correctPerMinute)} كلمة صحيحة/دقيقة (بلا مئينات معيارية).`);
  }
  if (ranLetters?.measures?.itemsPerSecond !== undefined) {
    strengthsAr.push(`سرعة التسمية الملاحظة للحروف: ${toAr(ranLetters.measures.itemsPerSecond)} عنصر/ثانية (${toAr(ranLetters.percent)}٪ دقة).`);
  }
  if (strengthsAr.length === 0) {
    strengthsAr.push('بدء خطوات التعرف على الحروف والكلمات ضمن المهام المكتملة.');
  }

  if (wordReading && nonwordReading && wordReading.percent - nonwordReading.percent >= 25) {
    breakdownPointsAr.push(
      `فارق بين قراءة المألوف والمصنوع: دقة الكلمات الحقيقية (${toAr(wordReading.percent)}٪) أعلى من الكلمات المصنوعة (${toAr(nonwordReading.percent)}٪)، ما يستدعي ممارسة إضافية في فك الترميز الصوتي.`
    );
  }
  const rankedLowest = [nonwordReading, wordReading, oralReading, phonological, letterSound, auditoryDisc, spelling]
    .filter((s): s is ScoredSubtest => Boolean(s))
    .sort((a, b) => a.percent - b.percent);
  for (const s of rankedLowest) {
    if (breakdownPointsAr.length >= 4) break;
    if (s.percent < 85) {
      breakdownPointsAr.push(
        `أولوية ممارسة في ${SUBTESTS_BY_ID[s.subtestId].skillNameAr}: سُجّلت ${toAr(s.percent)}٪ داخل المهمة (ترتيب وصفي لأدنى المهام، وليس حدًا تشخيصيًا).`
      );
    }
  }
  if (readingTargets && readingTargets.reasonsAr.length > 0) {
    breakdownPointsAr.push(readingTargets.reasonsAr[0]);
  }
  if (spelling && spelling.measures?.spellingErrors && spelling.measures.spellingErrors.length > 0) {
    const mainErr = spelling.measures.spellingErrors[0];
    breakdownPointsAr.push(`أكثر أنماط الخطأ الإملائي تكرارًا في المهمة: ${SPELL_ERROR_TEXT_AR[mainErr.kind]}.`);
  }
  if (breakdownPointsAr.length === 0) {
    breakdownPointsAr.push('لا تظهر فروق كبيرة بين المهام المكتملة ذات الدرجة المتاحة؛ يُركّز على الطلاقة وتثبيت المهارات.');
  }

  let phonologicalRootAr = '';
  if (wordReading && nonwordReading && wordReading.percent - nonwordReading.percent >= 25) {
    phonologicalRootAr =
      'ملاحظة وصفية من المهام: التباين بين الكلمات المألوفة والمصنوعة يلفت الانتباه إلى التحويل الصوتي للحروف غير المألوفة؛ ويظل التفسير وصفيًا دون عتبات معيارية مقننة.';
  } else if (readingTargets && readingTargets.reasonsAr.length > 0) {
    phonologicalRootAr =
      'رُبطت أنماط الأخطاء الصوتية والبصرية المرصودة في القراءة الجهرية بمهارات التدريب وفق تكرارها، وتبقى التقديرات وصفية دون معيار مقنن.';
  } else if (ranLetters?.measures?.itemsPerSecond !== undefined) {
    phonologicalRootAr =
      `سرعة التسمية الملاحظة للحروف: ${toAr(ranLetters.measures.itemsPerSecond)} عنصر/ثانية (تُعرض كمؤشر وصفي مستقل في التقرير، ولا تُحوَّل تلقائيًا إلى خطة علاجية قبل توافر معايرة عمرية مستقلة للتسمية السريعة).`;
  } else {
    phonologicalRootAr =
      'تُقرأ النتائج هنا بوصفها أداءً وصفيًا نسبيًا داخل المهام المكتملة لترتيب أولويات التدريب ومستوى البداية فقط، دون إصدار تشخيص لعسر القراءة أو اعتبار أي نسبة حدًا معياريًا قاطعًا.';
  }

  const nextInstructionalTargetAr =
    'التدريس القرائي المنظم: ترتيب المهارات من أدنى نسبة أداء ملاحظة في الفحص، وضبط مستوى البداية وعدد التمارين في كل جلسة وفق دقة كل مهمة وتتبّع الإتقان.';

  recommendedModules.push(
    { id: 'decoding-gym', titleAr: 'صالة فك الترميز والمقاطع', descriptionAr: 'تدريب تصاعدي على دمج الأصوات وقراءة المقاطع.' },
    { id: 'fluency-gym', titleAr: 'القارئ الميسّر والطلاقة', descriptionAr: 'قراءة جملة فجملة بدعم بصري وسمعي.' },
    { id: 'spelling-gym', titleAr: 'تمييز الحروف والأصوات', descriptionAr: 'ربط الحرف بصوته والتمييز بين الحروف المتقاربة.' }
  );

  return { strengthsAr, breakdownPointsAr, phonologicalRootAr, nextInstructionalTargetAr, recommendedModules };
}

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
  const readingTargets = extractReadingTargetsFromResults(results);
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
    ...(readingTargets ? { readingTargets } : {}),
    structuredLiteracy: computeStructuredLiteracyPillars(subtests, ageMonths, readingTargets),
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
