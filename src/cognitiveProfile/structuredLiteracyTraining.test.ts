import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CognitiveProfile } from './scoring';
import {
  ageAppropriateLiteracySkills,
  buildTrainingPlan,
  chanceOf,
  createPersonalizedProgress,
  generateSession,
  recordAnswer,
  sessionSkillsFor,
  type TrainingProgress,
} from './training';

function profile(ageMonths: number): CognitiveProfile {
  return {
    ageMonths,
    ageBandLabelAr: '',
    ageOutOfRange: false,
    referenceStatus: 'insufficient',
    subtests: [],
    domains: [],
    risk: 'insufficient',
    pattern: 'none',
    strengths: [],
    weaknesses: [],
    missing: [],
    coreWeakCount: 0,
    coreSevereCount: 0,
  };
}

describe('age-appropriate structured literacy training', () => {
  it('gates print skills and morphology at the intended developmental ages', () => {
    assert.deepEqual(ageAppropriateLiteracySkills(60), ['comprehension']);
    assert.deepEqual(ageAppropriateLiteracySkills(71), ['comprehension']);
    assert.deepEqual(ageAppropriateLiteracySkills(72), ['decoding', 'spelling', 'comprehension']);
    assert.deepEqual(ageAppropriateLiteracySkills(84), ['decoding', 'spelling', 'comprehension', 'morphology']);
  });

  it('includes the required literacy pillars in a child plan without inventing screening deficits', () => {
    const plan = buildTrainingPlan(profile(84));
    assert.equal(plan.preventive, true);
    for (const skill of ['decoding', 'spelling', 'comprehension', 'morphology'] as const) {
      assert.ok(plan.focus.includes(skill), `missing ${skill}`);
    }
    assert.equal(plan.ageMonths, 84);
    assert.ok(plan.focus.length <= 7);
    const progress = createPersonalizedProgress(plan, profile(84));
    for (const skill of plan.focus) {
      assert.ok(progress.bkt?.[`${skill}:1`], `missing BKT state for ${skill}`);
    }
  });

  it('rotates a plan through daily groups of at most three skills and eventually covers every active skill', () => {
    const plan = {
      createdAt: new Date('2026-11-15T00:00:00.000Z').toISOString(),
      ageMonths: 84,
      preventive: true,
      focus: ['blending', 'letterSound', 'decoding', 'spelling', 'comprehension', 'morphology', 'rhyme'] as const,
      rationaleAr: [],
    };
    const progress = { plan, mastered: [] } as unknown as TrainingProgress;
    const days = [1, 2, 3].map((day) => sessionSkillsFor(progress, day));
    assert.ok(days.every((day) => day.length > 0 && day.length <= 3));
    assert.equal(new Set(days.flat()).size, plan.focus.length);
  });

  it('generates age-gated decoding, dictation, comprehension and morphology tasks', () => {
    assert.equal(generateSession('decoding', 1, 11, undefined, 60).length, 0);
    assert.ok(generateSession('comprehension', 1, 11, undefined, 60).length >= 2);
    assert.ok(generateSession('decoding', 1, 11, undefined, 72).length >= 2);
    assert.equal(generateSession('morphology', 1, 11, undefined, 72).length, 0);
    assert.ok(generateSession('morphology', 1, 11, undefined, 84).length >= 2);
  });

  it('sends typed dictation through BKT as a child response, not an adult judgement', () => {
    const tasks = generateSession('spelling', 2, 42, undefined, 72);
    const task = tasks.find((entry) => entry.kind === 'choice' && entry.item.responseMode === 'text');
    assert.ok(task && task.kind === 'choice');
    if (!task || task.kind !== 'choice') return;
    assert.equal(task.item.expected, 'كتاب');
    assert.deepEqual(task.item.options, []);
    assert.ok(task.item.explanationAr);
    assert.equal(chanceOf(task), 0.01);

    const plan = buildTrainingPlan(profile(72));
    const progress = createPersonalizedProgress(plan, profile(72));
    const updated = recordAnswer(progress, 'spelling', true, chanceOf(task));
    assert.equal(updated.progress.bkt?.['spelling:1']?.n, 1);
  });
});
