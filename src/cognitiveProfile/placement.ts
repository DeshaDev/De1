/**
 * Placement check: the child's own answers verify the starting level the screening rule suggested.
 *
 * Why: the starting level comes from provisional rules (task accuracy, error frequency) that are not
 * yet calibrated on Arabic-speaking children. Instead of trusting the rule, the first time a skill is
 * trained the child answers a few items at the suggested level, without feedback:
 * - all right: one more level is tried, so a child the rule under-placed does not waste sessions;
 * - at most one right: one level lower is tried, so a child the rule over-placed is not overwhelmed;
 * - otherwise the suggestion stands.
 * This follows the logic of placement tests in mastery-based programmes and computer-adaptive testing:
 * a prior estimate is checked with a few targeted items before instruction starts.
 *
 * Each check is saved with the rule's suggestion and the placed level. Across children these records
 * show how often the rule was right and in which direction it errs: the data needed to calibrate it.
 * Answers also feed the knowledge-tracing model as evidence (no learning, as with the progress probe).
 */
import { bktKey, observe, priorFor, type BktLevel, type BktStates } from './knowledgeTracing';
import type { Level, SkillId, TrainingProgress } from './training';

export const PLACEMENT_ITEMS_PER_LEVEL = 3;
/** All items right moves up; at most this many right moves down. */
const STEP_DOWN_MAX_CORRECT = 1;

export interface PlacementAnswer {
  level: Level;
  correct: boolean;
  /** Chance of guessing this item right (1 ÷ options). */
  guess: number;
}

export interface PlacementRecord {
  skill: SkillId;
  date: string;
  /** Level the screening rule suggested. */
  suggested: Level;
  /** Level the child's answers placed them at. */
  placed: Level;
  answers: Array<{ level: Level; correct: boolean }>;
}

export type PlacementStep = { action: 'ask'; level: Level; count: number } | { action: 'done'; placed: Level };

/**
 * What to do next, from the answers so far. At most two levels are tried: the suggestion, then one
 * level up or down. The whole check is 3 or 6 items.
 */
export function nextPlacementStep(suggested: Level, answers: PlacementAnswer[]): PlacementStep {
  const at = (level: Level) => answers.filter((a) => a.level === level);
  const first = at(suggested);
  if (first.length < PLACEMENT_ITEMS_PER_LEVEL) return { action: 'ask', level: suggested, count: PLACEMENT_ITEMS_PER_LEVEL - first.length };
  const firstRight = first.filter((a) => a.correct).length;

  if (firstRight === PLACEMENT_ITEMS_PER_LEVEL && suggested < 3) {
    const up = (suggested + 1) as Level;
    const second = at(up);
    if (second.length < PLACEMENT_ITEMS_PER_LEVEL) return { action: 'ask', level: up, count: PLACEMENT_ITEMS_PER_LEVEL - second.length };
    // Two of three at the higher level: start there.
    return { action: 'done', placed: second.filter((a) => a.correct).length >= 2 ? up : suggested };
  }
  if (firstRight <= STEP_DOWN_MAX_CORRECT && suggested > 1) {
    const down = (suggested - 1) as Level;
    const second = at(down);
    if (second.length < PLACEMENT_ITEMS_PER_LEVEL) return { action: 'ask', level: down, count: PLACEMENT_ITEMS_PER_LEVEL - second.length };
    return { action: 'done', placed: down };
  }
  return { action: 'done', placed: suggested };
}

/** A skill is checked once, the first time it is trained. */
export function needsPlacement(progress: TrainingProgress, skill: SkillId): boolean {
  if (progress.mastered.includes(skill)) return false;
  if ((progress.placements ?? []).some((p) => p.skill === skill)) return false;
  return !progress.history.some((h) => h.skill === skill);
}

/** Apply a finished check: set the level, add the answers as evidence, and keep the record. */
export function applyPlacement(
  progress: TrainingProgress,
  skill: SkillId,
  suggested: Level,
  answers: PlacementAnswer[],
  placed: Level,
  now = new Date()
): TrainingProgress {
  const bkt: BktStates = { ...(progress.bkt ?? {}) };
  for (const a of answers) {
    const key = bktKey(skill, a.level as BktLevel);
    bkt[key] = observe(bkt[key] ?? { p: priorFor(undefined, a.level as BktLevel), n: 0, c: 0, seq: '' }, a.correct, a.guess, false);
  }
  // Levels below the placed one count as known, as when a child is promoted.
  for (let l = 1; l < placed; l++) {
    const key = bktKey(skill, l as BktLevel);
    bkt[key] = { ...(bkt[key] ?? { n: 0, c: 0, seq: '' }), p: Math.max(bkt[key]?.p ?? 0, 0.95) };
  }
  const record: PlacementRecord = {
    skill,
    date: now.toISOString(),
    suggested,
    placed,
    answers: answers.map(({ level, correct }) => ({ level, correct })),
  };
  return {
    ...progress,
    bkt,
    levels: { ...progress.levels, [skill]: placed },
    placements: [...(progress.placements ?? []), record].slice(-24),
  };
}

export interface PlacementAgreement {
  n: number;
  /** Share of checks where the rule's level was kept (0–100). */
  agreementPercent: number;
  /** Checks where the child was placed higher or lower than the rule suggested. */
  placedHigher: number;
  placedLower: number;
}

/** How often the starting-level rule matched the child's answers, over any set of records. */
export function placementAgreement(records: PlacementRecord[]): PlacementAgreement | null {
  if (records.length === 0) return null;
  const same = records.filter((r) => r.placed === r.suggested).length;
  return {
    n: records.length,
    agreementPercent: Math.round((same / records.length) * 100),
    placedHigher: records.filter((r) => r.placed > r.suggested).length,
    placedLower: records.filter((r) => r.placed < r.suggested).length,
  };
}
