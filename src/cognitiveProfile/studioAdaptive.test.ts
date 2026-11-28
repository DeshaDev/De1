import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdaptiveArabicPrescription,
} from './arabicErrorAdapter';
import {
  MOVABLE_ALPHABET_WORDS,
  PHONEMIC_BASKET_ROUNDS,
} from './arabicFoundations';
import {
  computeAdaptiveBalloonParams,
  createEmptyStudioAdaptiveState,
  getPrioritizedWeakLetters,
  pickAdaptiveBasketIndex,
  pickAdaptiveMovableWords,
  pickAdaptiveRecommendedStation,
  recordLetterAttempt,
  recordStationAnswer,
  recordStoryActivity,
  recommendedStorySupportMode,
} from './studioAdaptive';
import type { StudentRecord } from '../data/seedData';

function makeStudent(overrides: Partial<StudentRecord> = {}): StudentRecord {
  return {
    id: 'test-1',
    name: 'ليلى محمد',
    ageYears: 7,
    gradeLevel: 1,
    problematicWords: [],
    readingRiskLevel: 'unassessed',
    ...overrides,
  } as StudentRecord;
}

describe('Unified Adaptive Studio Engine (studioAdaptive)', () => {
  it('starts older fluent learners at grade-appropriate Spelling/Fluency instead of tracing letter Alif', () => {
    const fluentGrade3 = makeStudent({ ageYears: 9, gradeLevel: 3, readingRiskLevel: 'nominal' });
    const prescription = buildAdaptiveArabicPrescription(fluentGrade3);
    const rec = pickAdaptiveRecommendedStation(fluentGrade3, prescription, []);
    assert.ok(
      rec.station.track === 'spelling' || rec.station.track === 'fluency',
      `Expected spelling/fluency for Grade 3 nominal learner, got ${rec.station.id}`,
    );
  });

  it('routes learners with confusable sound errors directly to balloon discrimination on that sound', () => {
    const confused = makeStudent({
      ageYears: 7,
      gradeLevel: 1,
      problematicWords: ['صقر', 'صندوق'],
    });
    const prescription = buildAdaptiveArabicPrescription(confused);
    const rec = pickAdaptiveRecommendedStation(confused, prescription, []);
    assert.equal(rec.station.id, 'foundation-balloon');
  });

  it('updates live BKT mastery on spelling/language answers and prioritizes low-mastery stations', () => {
    let state = createEmptyStudioAdaptiveState();
    state = recordStationAnswer(state, 'spelling-ta_marbuta_open', false, 3);
    state = recordStationAnswer(state, 'spelling-ta_marbuta_open', false, 3);
    assert.ok(state.stationMastery['spelling-ta_marbuta_open'].p < 0.2);

    const g2 = makeStudent({ ageYears: 8, gradeLevel: 2, readingRiskLevel: 'nominal' });
    const prescription = buildAdaptiveArabicPrescription(g2);
    const rec = pickAdaptiveRecommendedStation(g2, prescription, [], state);
    assert.equal(rec.station.id, 'spelling-ta_marbuta_open');
  });

  it('prioritizes weak letters & struggled story words in Movable Alphabet and Sound Basket', () => {
    let state = createEmptyStudioAdaptiveState();
    state = recordLetterAttempt(state, 'ش', false);
    state = recordLetterAttempt(state, 'ش', false);
    state = recordStoryActivity(state, 'bithrat-noor', ['شَمْسٍ']);

    const student = makeStudent({ problematicWords: ['شمس'] });
    const weak = getPrioritizedWeakLetters(student, state, 'ب');
    assert.equal(weak[0], 'ش');

    const orderedWords = pickAdaptiveMovableWords(MOVABLE_ALPHABET_WORDS, student, state);
    assert.ok(
      orderedWords[0].letters.includes('ش'),
      `Expected a word containing ش first, got ${orderedWords[0].word}`,
    );

    const basketIdx = pickAdaptiveBasketIndex(PHONEMIC_BASKET_ROUNDS, student, state, []);
    assert.equal(PHONEMIC_BASKET_ROUNDS[basketIdx].targetLetter, 'ش');
  });

  it('scales Balloon speed & target density dynamically on streak vs errors', () => {
    const gentle = computeAdaptiveBalloonParams(0, 2);
    const balanced = computeAdaptiveBalloonParams(1, 0);
    const fast = computeAdaptiveBalloonParams(3, 0);

    assert.ok(gentle.speedScale < balanced.speedScale);
    assert.ok(gentle.targetProb > balanced.targetProb);
    assert.ok(fast.speedScale > balanced.speedScale);
  });

  it('selects independent story support only for fluent Grade 3+ nominal readers', () => {
    const fluent3 = makeStudent({ gradeLevel: 3, readingRiskLevel: 'nominal', oralAccuracyPercent: 92 });
    const g1 = makeStudent({ gradeLevel: 1, readingRiskLevel: 'moderate' });
    assert.equal(recommendedStorySupportMode(fluent3), 'independent');
    assert.equal(recommendedStorySupportMode(g1), 'guided');
  });
});
