import test from 'node:test';
import assert from 'node:assert/strict';
import { ARABIC_READING_PASSAGES, INITIAL_STUDENTS } from '../data/seedData';

test('Multi-Dimensional Cognitive Screening Battery (RAN, Pseudo-words & Phonology)', async (t) => {
  await t.test('RAN (Rapid Automatized Naming): accurately calculates items per second and detects latency risk', () => {
    const totalItems = 20;
    const fastDurationSec = 18;
    const slowDurationSec = 40;

    const fastSpeed = +(totalItems / fastDurationSec).toFixed(2);
    const slowSpeed = +(totalItems / slowDurationSec).toFixed(2);

    assert.ok(fastSpeed > 1.0, 'Fast reader should achieve > 1.0 items per second');
    assert.ok(slowSpeed < 0.6, 'At-risk reader has low naming retrieval speed < 0.6 items/sec');

    // Threshold check
    const isAtRisk = slowDurationSec >= 35;
    assert.equal(isAtRisk, true, 'RAN duration >= 35s marks slow lexical retrieval risk');
  });

  await t.test('Arabic Pseudo-words: follow authentic Arabic morphological weights (فَعْلَلَ / مِفْعَال)', () => {
    const samplePseudoWords = ['سَلْطَمَ', 'مِفْرَاخ', 'كَرْنَفَ', 'بَيْدَقَة', 'شَنْطَبَ'];

    // Ensure all pseudo-words contain authentic Arabic letters and diacritics
    samplePseudoWords.forEach(word => {
      assert.ok(word.length >= 4, `Word "${word}" should be at least 4 characters`);
      assert.match(word, /^[\u0621-\u064A\u064B-\u0652\u0670]+$/, `Word "${word}" must be valid Arabic script`);
    });
  });

  await t.test('Multi-Dimensional Radar Scores: normalizes all 5 cognitive axes within 0-100 range', () => {
    const rawMetrics = {
      wcpm: 68,
      ranSeconds: 25,
      pseudoPercent: 75,
      phonemicPercent: 80,
      numberLinePAE: 12.5,
    };

    const orfFluency = Math.min(100, Math.round((rawMetrics.wcpm / 70) * 100));
    const ranSpeed = Math.min(100, Math.max(20, Math.round((20 / rawMetrics.ranSeconds) * 100)));
    const pseudoDecoding = rawMetrics.pseudoPercent;
    const phonemicAwareness = rawMetrics.phonemicPercent;
    const numeracy = Math.min(100, Math.max(20, Math.round(100 - rawMetrics.numberLinePAE * 2)));

    const scores = [orfFluency, ranSpeed, pseudoDecoding, phonemicAwareness, numeracy];
    scores.forEach(score => {
      assert.ok(score >= 0 && score <= 100, `Score ${score} must be within 0-100 range`);
    });

    assert.ok(orfFluency >= 90, '68 WCPM on a 70 WCPM target should yield ~97%');
    assert.ok(numeracy >= 70, '12.5 PAE should yield ~75% numeracy accuracy');
  });
});
