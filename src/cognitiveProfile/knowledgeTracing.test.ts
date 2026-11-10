import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BKT_SLIP,
  MASTERY_THRESHOLD,
  MIN_ATTEMPTS_FOR_MASTERY,
  allocateItems,
  fitBkt,
  isMastered,
  learnStep,
  logLikelihood,
  observe,
  posteriorGivenAnswer,
  priorFor,
  priorFromObservation,
  type BktSequence,
} from './knowledgeTracing';
import { applyProbeEvidence, createProgress, masteryEstimate, recordAnswer, skillBandsFromProfile, type TrainingPlan } from './training';
import { TrainingProgressUploadSchema } from './records';

/** Deterministic random numbers so simulations give the same result on every run. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const plan: TrainingPlan = { createdAt: new Date().toISOString(), preventive: false, focus: ['rhyme'], rationaleAr: [] };

describe('Bayesian Knowledge Tracing (Corbett & Anderson, 1995)', () => {
  it('updates with Bayes rule exactly as published', () => {
    const p = 0.4, g = 1 / 3, s = BKT_SLIP;
    const expectedCorrect = (p * (1 - s)) / (p * (1 - s) + (1 - p) * g);
    const expectedWrong = (p * s) / (p * s + (1 - p) * (1 - g));
    assert.ok(Math.abs(posteriorGivenAnswer(p, true, g) - expectedCorrect) < 1e-9);
    assert.ok(Math.abs(posteriorGivenAnswer(p, false, g) - expectedWrong) < 1e-9);
    assert.ok(Math.abs(learnStep(0.5, 0.2) - 0.6) < 1e-9);
  });

  it('a correct answer on an easier-to-guess item is weaker evidence', () => {
    assert.ok(posteriorGivenAnswer(0.3, true, 1 / 2) < posteriorGivenAnswer(0.3, true, 1 / 4));
  });

  it('never declares mastery before the minimum number of answers', () => {
    let s = { p: 0.9, n: 0, c: 0, seq: '' };
    for (let i = 0; i < MIN_ATTEMPTS_FOR_MASTERY - 1; i++) s = observe(s, true, 1 / 3, true);
    assert.ok(s.p >= MASTERY_THRESHOLD);
    assert.equal(isMastered(s), false);
    s = observe(s, true, 1 / 3, true);
    assert.equal(isMastered(s), true);
  });

  it('a child who only guesses (3 options) almost never reaches mastery in 20 items', () => {
    const r = rng(1);
    let mastered = 0;
    const runs = 2000;
    for (let k = 0; k < runs; k++) {
      let s = { p: priorFor('below', 1), n: 0, c: 0, seq: '' };
      for (let i = 0; i < 20 && !isMastered(s); i++) s = observe(s, r() < 1 / 3, 1 / 3, true);
      if (isMastered(s)) mastered += 1;
    }
    assert.ok(mastered / runs < 0.06, `false mastery rate ${mastered / runs}`);
  });

  it('a child who knows the skill (10% slips) reaches mastery within 10 items in most runs', () => {
    const r = rng(2);
    let mastered = 0;
    const runs = 2000;
    for (let k = 0; k < runs; k++) {
      let s = { p: priorFor('below', 1), n: 0, c: 0, seq: '' };
      for (let i = 0; i < 10 && !isMastered(s); i++) s = observe(s, r() > 0.1, 1 / 3, true);
      if (isMastered(s)) mastered += 1;
    }
    assert.ok(mastered / runs > 0.9, `mastery rate ${mastered / runs}`);
  });

  it('starts from the screening band: a severe weakness starts lower than a strength', () => {
    assert.ok(priorFor('severe', 1) < priorFor('average', 1));
    assert.ok(priorFor('average', 1) < priorFor('strength', 1));
    assert.ok(priorFor('average', 3) < priorFor('average', 1));
    const bands = skillBandsFromProfile({ subtests: [{ subtestId: 'rhyme', band: 'severe' } as never] });
    assert.equal(bands.rhyme, 'severe');
  });

  it('probe answers are evidence without learning, and clear mastery of level 2 on the probe moves the child up', () => {
    const progress = createProgress(plan);
    const before = masteryEstimate(progress, 'rhyme');
    const wrong = applyProbeEvidence(progress, [{ skill: 'rhyme', correct: false, guess: 1 / 3 }]).progress;
    assert.ok((wrong.bkt!['rhyme:2'].p) < (progress.bkt!['rhyme:2'].p), 'a wrong probe answer lowers the estimate (no learning step)');
    assert.equal(before.level, 1);
    const answers = Array.from({ length: 8 }, () => ({ skill: 'rhyme' as const, correct: true, guess: 1 / 3 }));
    const { progress: up, promoted } = applyProbeEvidence(progress, answers);
    assert.deepEqual(promoted, ['rhyme']);
    assert.equal(up.levels.rhyme, 2);
  });

  it('a level change happens on the answer that crosses the threshold, and the state passes the server schema', () => {
    let progress = createProgress(plan);
    let changedAt = -1;
    for (let i = 0; i < 12 && changedAt < 0; i++) {
      const r = recordAnswer(progress, 'rhyme', true, 1 / 3);
      progress = r.progress;
      if (r.change === 'up') changedAt = i + 1;
    }
    assert.ok(changedAt >= MIN_ATTEMPTS_FOR_MASTERY && changedAt <= 10, `moved up after ${changedAt} answers`);
    assert.equal(TrainingProgressUploadSchema.safeParse(progress).success, true);
  });

  it('gives more practice to the skill furthest from mastery, within 4 to 12 items', () => {
    const a = allocateItems([{ skill: 'weak', p: 0.1 }, { skill: 'strong', p: 0.9 }]);
    assert.ok(a.weak > a.strong);
    for (const n of Object.values(a)) assert.ok(n >= 4 && n <= 12);
  });

  it('derives monotonic initial mastery priors and unequal doses from observed screening percentages', () => {
    const pLow = priorFromObservation(20, null, 1, 1);
    const pMid = priorFromObservation(50, null, 1, 1);
    const pMod = priorFromObservation(68, null, 2, 2);
    assert.ok(pLow < pMid && pMid < pMod, `${pLow} < ${pMid} < ${pMod}`);
    const pMulti = priorFromObservation(15, null, 1, 1);
    const pMild = priorFromObservation(72, null, 2, 2);
    const dose = allocateItems([{ skill: 'rhyme', p: pMulti }, { skill: 'blending', p: pMild }]);
    assert.ok(dose.rhyme > dose.blending, `expected weaker skill dose (${dose.rhyme}) > milder (${dose.blending})`);
  });

  it('fitting recovers the parameters of simulated children (for calibration on pilot data)', () => {
    const r = rng(3);
    const truth = { pInit: 0.3, pTransit: 0.15, pSlip: 0.08 };
    const guess = 1 / 3;
    const data: BktSequence[] = [];
    for (let k = 0; k < 400; k++) {
      let known = r() < truth.pInit;
      let seq = '';
      for (let i = 0; i < 12; i++) {
        const correct = known ? r() > truth.pSlip : r() < guess;
        seq += correct ? '1' : '0';
        if (!known && r() < truth.pTransit) known = true;
      }
      data.push({ seq, guess });
    }
    const fit = fitBkt(data);
    assert.ok(Math.abs(fit.pInit - truth.pInit) <= 0.1, `pInit ${fit.pInit}`);
    assert.ok(Math.abs(fit.pTransit - truth.pTransit) <= 0.06, `pTransit ${fit.pTransit}`);
    assert.ok(Math.abs(fit.pSlip - truth.pSlip) <= 0.06, `pSlip ${fit.pSlip}`);
    assert.ok(fit.logLikelihood >= logLikelihood({ pInit: 0.5, pTransit: 0.3, pSlip: 0.2 }, data));
  });
});
