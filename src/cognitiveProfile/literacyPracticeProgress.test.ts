import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyLiteracyPracticeProgress,
  recordFluencySessionCompleted,
  recordLiteracyAnswer,
  recordLiteracyStationCompleted,
  sanitizeLiteracyPracticeProgress,
} from './literacyPracticeProgress';

describe('encrypted literacy practice progress ledger', () => {
  it('starts with a safe empty record for each station', () => {
    const progress = emptyLiteracyPracticeProgress();
    assert.equal(progress.schemaVersion, 1);
    assert.equal(progress.stations.decoding.attemptedQuestions, 0);
    assert.equal(progress.stations.fluency.completedSessions, 0);
  });

  it('records attempts and feedback without calling them mastery', () => {
    const first = recordLiteracyAnswer(emptyLiteracyPracticeProgress(), 'decoding', true, new Date('2026-11-15T10:00:00Z'));
    const second = recordLiteracyAnswer(first, 'decoding', false, new Date('2026-11-15T10:01:00Z'));
    assert.equal(second.stations.decoding.attemptedQuestions, 2);
    assert.equal(second.stations.decoding.correctAnswers, 1);
    assert.equal(second.stations.decoding.completedSessions, 0);
  });

  it('records completed station sessions separately from answers', () => {
    const progress = recordLiteracyStationCompleted(emptyLiteracyPracticeProgress(), 'morphology');
    assert.equal(progress.stations.morphology.completedSessions, 1);
    assert.equal(progress.stations.morphology.attemptedQuestions, 0);
  });

  it('records fluency as three repeated readings without scoring the child', () => {
    const progress = recordFluencySessionCompleted(emptyLiteracyPracticeProgress());
    assert.equal(progress.stations.fluency.completedSessions, 1);
    assert.equal(progress.fluencyReadingsCompleted, 3);
    assert.equal(progress.stations.fluency.correctAnswers, 0);
  });

  it('sanitizes malformed or impossible persisted values', () => {
    const progress = sanitizeLiteracyPracticeProgress({
      stations: {
        decoding: { attemptedQuestions: 4.8, correctAnswers: 9, completedSessions: -1, lastPracticedAt: 'bad-date' },
      },
      fluencyReadingsCompleted: '100',
    });
    assert.equal(progress.stations.decoding.attemptedQuestions, 4);
    assert.equal(progress.stations.decoding.correctAnswers, 4);
    assert.equal(progress.stations.decoding.completedSessions, 0);
    assert.equal(progress.stations.decoding.lastPracticedAt, null);
    assert.equal(progress.fluencyReadingsCompleted, 0);
  });
});
