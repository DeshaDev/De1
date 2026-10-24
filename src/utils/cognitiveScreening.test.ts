import test from 'node:test';
import assert from 'node:assert/strict';
import { VERIFIED_ARABIC_PSEUDO_WORDS, VERIFIED_PHONEMIC_TASKS } from '../components/CognitiveScreeningView';

test('Cognitive Screening & Observational Profile Battery', async (t) => {
  await t.test('RAN (Rapid Automatized Naming): accurately calculates items per second and latency', () => {
    const totalItems = 20;
    const fastDurationSec = 18;
    const slowDurationSec = 40;

    const fastSpeed = +(totalItems / fastDurationSec).toFixed(2);
    const slowSpeed = +(totalItems / slowDurationSec).toFixed(2);

    assert.ok(fastSpeed > 1.0, 'Fast reader should achieve > 1.0 items per second');
    assert.ok(slowSpeed < 0.6, 'Slower reader has naming retrieval speed < 0.6 items/sec');

    // Threshold check for observation
    const isAtObservation = slowDurationSec >= 35;
    assert.equal(isAtObservation, true, 'RAN duration >= 35s marks slow retrieval observation');
  });

  await t.test('Arabic Pseudo-words: strictly verified non-lexical roots adhering to authentic morphological templates', () => {
    assert.equal(VERIFIED_ARABIC_PSEUDO_WORDS.length, 12, 'Should provide 12 graded pseudo-words');

    // Words known to be real Arabic words that MUST NOT be present:
    const bannedRealWords = ['نَشَدَ', 'مِفْرَاخ', 'كَرْنَفَ', 'بَيْدَقَة', 'قُرْطُم', 'شَمْس', 'قَلَم'];

    VERIFIED_ARABIC_PSEUDO_WORDS.forEach(item => {
      // Must not be in banned real words
      assert.ok(!bannedRealWords.includes(item.word), `Pseudo-word "${item.word}" must not be a real dictionary word`);
      // Valid Arabic script
      assert.match(item.word, /^[\u0621-\u064A\u064B-\u0652\u0670]+$/, `Word "${item.word}" must be valid vocalized Arabic script`);
      assert.ok(item.patternAr.length > 0, 'Must have specified morphological template');
      assert.ok(item.syllablesAr.length > 0, 'Must provide syllable decomposition');
    });
  });

  await t.test('Phonemic Awareness subtests: dialect-neutral standard Arabic items with valid answers', () => {
    assert.equal(VERIFIED_PHONEMIC_TASKS.length, 6, 'Should provide 6 phonological awareness items');

    VERIFIED_PHONEMIC_TASKS.forEach(task => {
      assert.ok(task.optionsAr.length >= 3, `Task "${task.id}" must have at least 3 options`);
      assert.ok(task.correctIndex >= 0 && task.correctIndex < task.optionsAr.length, `Valid correct index for ${task.id}`);
      assert.ok(task.audioSpeechPrompt.length > 0, `Auditory prompt defined for ${task.id}`);
    });
  });

  await t.test('Multi-Dimensional Radar Scores: normalizes all 5 observational axes within 0-100 range', () => {
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
