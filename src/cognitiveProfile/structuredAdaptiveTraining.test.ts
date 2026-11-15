import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrainingPlan,
  generateItems,
  generateSession,
  SKILLS,
  SUBTEST_TO_SKILLS,
  type SkillId,
} from './training';
import type { CognitiveProfile } from './scoring';

describe('age-aware adaptive literacy skills', () => {
  it('exposes decoding, spelling, morphology and comprehension in the BKT skill registry', () => {
    const skills: SkillId[] = ['decoding', 'spelling', 'morphology', 'comprehension'];
    for (const skill of skills) {
      assert.ok(SKILLS[skill].nameAr.length > 0);
      assert.ok(SKILLS[skill].goalAr.length > 0);
    }
    assert.deepEqual(SUBTEST_TO_SKILLS.wordReading, ['decoding']);
    assert.ok(SUBTEST_TO_SKILLS.spelling.includes('spelling'));
  });

  it('maps screening weaknesses only to age-eligible adaptive skills', () => {
    const young = { ageMonths: 60, weaknesses: ['wordReading', 'spelling'], subtests: [] } as unknown as CognitiveProfile;
    const older = { ageMonths: 72, weaknesses: ['wordReading', 'spelling'], subtests: [] } as unknown as CognitiveProfile;
    const youngPlan = buildTrainingPlan(young, new Date('2026-11-15T00:00:00Z'));
    const olderPlan = buildTrainingPlan(older, new Date('2026-11-15T00:00:00Z'));
    assert.ok(!youngPlan.focus.includes('decoding'));
    assert.ok(!youngPlan.focus.includes('spelling'));
    assert.ok(olderPlan.focus.includes('decoding'));
    assert.ok(olderPlan.focus.includes('spelling'));
    assert.equal(olderPlan.ageYears, 6);
  });

  it('keeps the preschool default to listening and pre-reading skills', () => {
    const ageFour = { ageMonths: 48, weaknesses: [], subtests: [] } as unknown as CognitiveProfile;
    const plan = buildTrainingPlan(ageFour);
    assert.ok(plan.focus.includes('comprehension'));
    assert.ok(!plan.focus.includes('letterSound'));
    assert.ok(!plan.focus.includes('decoding'));
  });

  it('offers morphology only from age seven in preventive progression', () => {
    const ageSix = { ageMonths: 72, weaknesses: [], subtests: [] } as unknown as CognitiveProfile;
    const ageSeven = { ageMonths: 84, weaknesses: [], subtests: [] } as unknown as CognitiveProfile;
    assert.ok(!buildTrainingPlan(ageSix).focus.includes('morphology'));
    assert.ok(buildTrainingPlan(ageSeven).focus.includes('morphology'));
  });

  it('generates BKT-ready choice tasks for age-appropriate literacy domains', () => {
    const domains: Array<{ skill: SkillId; age: number }> = [
      { skill: 'decoding', age: 6 },
      { skill: 'spelling', age: 6 },
      { skill: 'morphology', age: 7 },
      { skill: 'comprehension', age: 4 },
    ];
    for (const { skill, age } of domains) {
      const tasks = generateSession(skill, 1, 12345, undefined, age);
      assert.ok(tasks.length >= 4 && tasks.length <= 6, `${skill} should return only available unique items`);
      assert.ok(tasks.every((task) => task.kind === 'choice'));
      const signatures = tasks.map((task) => task.kind === 'choice' ? `${task.item.promptAr}|${task.item.audio.map((part) => part.text).join('|')}` : '');
      assert.equal(new Set(signatures).size, signatures.length, `${skill} must not duplicate BKT evidence within one block`);
    }
  });

  it('feeds the BKT session builder unique items without filling gaps by duplication', () => {
    const domains: Array<{ skill: SkillId; age: number }> = [
      { skill: 'decoding', age: 6 },
      { skill: 'spelling', age: 6 },
      { skill: 'morphology', age: 7 },
      { skill: 'comprehension', age: 4 },
    ];
    for (const { skill, age } of domains) {
      const items = generateItems(skill, 1, 777, 8, undefined, age);
      assert.ok(items.length >= 5 && items.length <= 6, `${skill} should provide its distinct available item bank`);
      const signatures = items.map((task) => task.kind === 'choice' ? `${task.item.promptAr}|${task.item.audio.map((part) => part.text).join('|')}` : task.trial.sequence.join(','));
      assert.equal(new Set(signatures).size, signatures.length);
    }
  });

  it('does not generate decoding or spelling tasks for pre-reading ages', () => {
    assert.equal(generateSession('decoding', 1, 1, undefined, 5).length, 0);
    assert.equal(generateSession('spelling', 1, 1, undefined, 5).length, 0);
    assert.equal(generateSession('morphology', 1, 1, undefined, 6).length, 0);
  });

  it('uses a spoken prompt without exposing printed comprehension text under age six', () => {
    const tasks = generateSession('comprehension', 1, 123, undefined, 4);
    assert.ok(tasks.every((task) => task.kind === 'choice' && task.item.promptAr === 'اسْتَمِعْ إِلَى الْجُمْلَةِ، ثُمَّ اخْتَرِ الصُّورَةَ.'));
  });
});
