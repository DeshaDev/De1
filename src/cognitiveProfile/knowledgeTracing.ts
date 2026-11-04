/**
 * Bayesian Knowledge Tracing (BKT): the machine-learning model behind the adaptive programme.
 *
 * Model (Corbett & Anderson, 1995, User Modeling and User-Adapted Interaction 4, 253-278):
 * each skill level is either mastered or not. After every answer the probability of mastery is
 * updated with Bayes' rule, allowing for a lucky guess (right without mastery) and a slip
 * (wrong despite mastery); after a practice item with feedback the child may also learn
 * (transition from not mastered to mastered).
 *
 *   P(L | correct) = P(L)(1 - S) / [P(L)(1 - S) + (1 - P(L)) G]
 *   P(L | wrong)   = P(L) S      / [P(L) S      + (1 - P(L)) (1 - G)]
 *   P(L next)      = P(L | answer) + (1 - P(L | answer)) T
 *
 * Choices made here, and why:
 * - G (guess) is the item's real chance level (1 / number of options), not one fitted constant,
 *   because our items have 2 to 4 options ("contextual guess", Baker, Corbett & Aleven, 2008).
 * - S = 0.10 and T = 0.05 are within the ranges reported for fitted BKT models and keep the model
 *   non-degenerate (S < 0.5, G < 0.5 for 3+ options). T was chosen by simulation (see the tests):
 *   with T = 0.12 a child who only guesses reached "mastery" within 20 items in about 16% of runs;
 *   with T = 0.05 it is about 5%, while a child who knows the skill still reaches mastery within
 *   10 items in about 95% of runs. Both are priors until fitted on our own data with `fitBkt`
 *   (brute-force maximum likelihood, as in Baker et al., 2010).
 * - Mastery at P(L) >= 0.95, the threshold of the original cognitive tutors, and never before
 *   MIN_ATTEMPTS_FOR_MASTERY answers at that level, so a short lucky streak is not enough.
 * - The prior P(L0) comes from the child's screening band for the skill.
 * - Progress-probe answers (no feedback) are evidence only: Bayes update without learning.
 */
import type { Band } from './scoring';

export type BktLevel = 1 | 2 | 3;

export interface SkillLevelState {
  /** Probability that this level is mastered. */
  p: number;
  /** Answers observed at this level. */
  n: number;
  /** Correct answers observed at this level. */
  c: number;
  /** Answer sequence, '1' correct and '0' wrong, kept to fit the model on real data later. */
  seq: string;
}

export type BktStates = Record<string, SkillLevelState>;

export const BKT_SLIP = 0.1;
export const BKT_TRANSIT = 0.05;
export const MASTERY_THRESHOLD = 0.95;
export const MIN_ATTEMPTS_FOR_MASTERY = 5;
/** Below this, after enough practice at a level above 1, the child steps back a level. */
export const STEP_BACK_BELOW = 0.2;
export const STEP_BACK_MIN_ATTEMPTS = 8;
/** At level 1 there is nowhere to step back to: flag the skill for adult support instead. */
export const SUPPORT_MIN_ATTEMPTS = 12;
const MAX_SEQ = 300;

export const bktKey = (skill: string, level: BktLevel) => `${skill}:${level}`;

const clamp = (p: number) => Math.min(0.999, Math.max(0.001, p));

export function posteriorGivenAnswer(p: number, correct: boolean, guess: number, slip = BKT_SLIP): number {
  const g = Math.min(0.5, Math.max(0.01, guess));
  const known = correct ? p * (1 - slip) : p * slip;
  const unknown = correct ? (1 - p) * g : (1 - p) * (1 - g);
  return clamp(known / (known + unknown));
}

export const learnStep = (p: number, transit = BKT_TRANSIT) => clamp(p + (1 - p) * transit);

/**
 * One answer. `learning` is true for practice items with feedback, false for probe items
 * (the child gets no feedback, so nothing is learned from the item itself).
 */
export function observe(state: SkillLevelState, correct: boolean, guess: number, learning: boolean): SkillLevelState {
  const post = posteriorGivenAnswer(state.p, correct, guess);
  return {
    p: learning ? learnStep(post) : post,
    n: state.n + 1,
    c: state.c + (correct ? 1 : 0),
    seq: (state.seq + (correct ? '1' : '0')).slice(-MAX_SEQ),
  };
}

/** Prior probability of mastery at level 1 from the screening band; higher levels start lower. */
const LEVEL1_PRIOR: Record<Band | 'unknown', number> = { severe: 0.1, below: 0.2, average: 0.45, strength: 0.7, unknown: 0.3 };
const LEVEL_FACTOR: Record<BktLevel, number> = { 1: 1, 2: 0.6, 3: 0.35 };

export function priorFor(band: Band | null | undefined, level: BktLevel): number {
  return clamp(LEVEL1_PRIOR[band ?? 'unknown'] * LEVEL_FACTOR[level]);
}

export function initialStates(skills: string[], bands: Partial<Record<string, Band>>, startLevel: Record<string, BktLevel>): BktStates {
  const states: BktStates = {};
  for (const skill of skills) {
    for (const level of [1, 2, 3] as BktLevel[]) {
      // Levels below the starting level are assumed mastered (the preventive plan starts at 2).
      const p = level < (startLevel[skill] ?? 1) ? MASTERY_THRESHOLD : priorFor(bands[skill], level);
      states[bktKey(skill, level)] = { p, n: 0, c: 0, seq: '' };
    }
  }
  return states;
}

export const isMastered = (s: SkillLevelState | undefined) => Boolean(s && s.p >= MASTERY_THRESHOLD && s.n >= MIN_ATTEMPTS_FOR_MASTERY);

/**
 * How many practice items each skill gets in a session: weaker estimated mastery gets more
 * practice, near-mastered skills fewer (between `min` and `max`, total about `perSkill` each).
 */
export function allocateItems(pBySkill: Array<{ skill: string; p: number }>, perSkill = 8, min = 4, max = 12): Record<string, number> {
  if (pBySkill.length === 0) return {};
  const budget = perSkill * pBySkill.length;
  const weights = pBySkill.map(({ p }) => 1 - p + 0.25);
  const sum = weights.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  pBySkill.forEach(({ skill }, i) => {
    out[skill] = Math.max(min, Math.min(max, Math.round((weights[i] / sum) * budget)));
  });
  return out;
}

// ---------------------------------------------------------------------------
// Fitting on real data (used after the pilot; also tested on simulated children)
// ---------------------------------------------------------------------------
export interface BktSequence {
  /** '1' correct, '0' wrong, in the order answered. */
  seq: string;
  /** Chance level of the items in this sequence. */
  guess: number;
}

export interface BktFit {
  pInit: number;
  pTransit: number;
  pSlip: number;
  logLikelihood: number;
}

export function logLikelihood(params: Omit<BktFit, 'logLikelihood'>, data: BktSequence[]): number {
  let ll = 0;
  for (const { seq, guess } of data) {
    let p = params.pInit;
    for (const ch of seq) {
      const correct = ch === '1';
      const pCorrect = p * (1 - params.pSlip) + (1 - p) * guess;
      ll += Math.log(correct ? pCorrect : 1 - pCorrect);
      p = learnStep(posteriorGivenAnswer(p, correct, guess, params.pSlip), params.pTransit);
    }
  }
  return ll;
}

/** Brute-force maximum-likelihood fit over a parameter grid (Baker et al., 2010). */
export function fitBkt(data: BktSequence[]): BktFit {
  let best: BktFit = { pInit: 0.3, pTransit: BKT_TRANSIT, pSlip: BKT_SLIP, logLikelihood: -Infinity };
  for (let i = 1; i <= 18; i++) {
    const pInit = i * 0.05;
    for (let t = 1; t <= 20; t++) {
      const pTransit = t * 0.02;
      for (let s = 1; s <= 10; s++) {
        const pSlip = s * 0.02;
        const ll = logLikelihood({ pInit, pTransit, pSlip }, data);
        if (ll > best.logLikelihood) best = { pInit, pTransit, pSlip, logLikelihood: ll };
      }
    }
  }
  return best;
}
