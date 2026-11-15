import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getFluencyPassage, getStructuredLiteracyStations } from './structuredLiteracyStations';

describe('age-appropriate structured literacy practice stations', () => {
  it('keeps early-years children in listening comprehension and pre-reading support', () => {
    for (const age of [4, 5]) {
      const stations = getStructuredLiteracyStations(age);
      const ids = stations.map((station) => station.id);
      assert.deepEqual(ids, ['comprehension']);
      assert.match(stations[0].titleAr, /المسموع/);
      assert.ok(stations[0].questions.length >= 2);
    }
  });

  it('adds decoding, spelling and unscored fluency practice after reading instruction begins', () => {
    const stations = getStructuredLiteracyStations(6);
    const ids = stations.map((station) => station.id);
    assert.ok(ids.includes('decoding'));
    assert.ok(ids.includes('spelling'));
    assert.ok(ids.includes('fluency'));
    assert.ok(ids.includes('comprehension'));
    assert.ok(!ids.includes('morphology'));
  });

  it('adds introductory morphology only for the oldest children in the product age range', () => {
    const stations = getStructuredLiteracyStations(7);
    assert.ok(stations.some((station) => station.id === 'morphology'));
    assert.equal(getStructuredLiteracyStations(8).some((station) => station.id === 'morphology'), true);
  });

  it('gives every multiple-choice question unique options and exactly one correct answer', () => {
    for (const age of [4, 5, 6, 7, 8]) {
      for (const station of getStructuredLiteracyStations(age)) {
        for (const question of station.questions) {
          const ids = question.options.map((option) => option.id);
          assert.ok(ids.length >= 2, `${station.id}/${question.id}: too few options`);
          assert.equal(new Set(ids).size, ids.length, `${station.id}/${question.id}: duplicate option`);
          assert.equal(ids.filter((id) => id === question.correctId).length, 1, `${station.id}/${question.id}: answer is missing or ambiguous`);
          assert.ok(question.explanationAr.length >= 15);
          assert.ok(question.explanationAudio.length > 0);
        }
      }
    }
  });

  it('keeps fluency practice untimed and unscored', () => {
    const passage = getFluencyPassage(8);
    assert.ok(passage.linesAr.length >= 3);
    assert.equal(typeof passage.reflectionAr, 'string');
    assert.match(passage.reflectionAr, /دِقَّةٍ|عَلامَةِ/);
  });
});
