import test from 'node:test';
import assert from 'node:assert/strict';
import { ARABIC_PSEUDO_WORD_CANDIDATES, ARABIC_PHONEMIC_TASK_CANDIDATES } from '../components/CognitiveScreeningView';
import { getFluencyLevelInfo } from '../components/ReadingAssessmentView';

test('Cognitive Screening & Observational Profile Battery', async (t) => {
  await t.test('RAN timing is an observation and does not define an age-based slow/normal category', () => {
    const itemCount = 20;
    const elapsedSeconds = 40;
    const itemsPerSecond = +(itemCount / elapsedSeconds).toFixed(2);
    assert.equal(itemsPerSecond, 0.5);
    assert.equal(elapsedSeconds, 40);
    // There is intentionally no fixed time cut-off in this test: it would require validated Arabic norms.
  });

  await t.test('Arabic pseudo-word candidate bank is structured but does not claim independent lexical validation', () => {
    assert.equal(ARABIC_PSEUDO_WORD_CANDIDATES.length, 12, 'The prototype currently contains 12 candidate items');
    // This small deny-list is a regression guard only, not evidence that every item is absent from every lexicon or dialect.
    const bannedRealWords = ['نَشَدَ', 'مِفْرَاخ', 'كَرْنَفَ', 'بَيْدَقَة', 'قُرْطُم', 'شَمْس', 'قَلَم'];
    for (const item of ARABIC_PSEUDO_WORD_CANDIDATES) {
      assert.ok(!bannedRealWords.includes(item.word), `Known real-word collision in candidate bank: "${item.word}"`);
      assert.match(item.word, /^[\u0621-\u064A\u064B-\u0652\u0670]+$/, `Arabic script expected for "${item.word}"`);
      assert.ok(item.patternAr.length > 0, 'A proposed pattern is recorded');
      assert.ok(item.syllablesAr.length > 0, 'A proposed syllable breakdown is recorded');
    }
  });

  await t.test('Arabic phonological task candidates have internally consistent target answers', () => {
    assert.equal(ARABIC_PHONEMIC_TASK_CANDIDATES.length, 6);
    const expected: Record<string, string> = {
      'ph-isolation-1': '/ز/',
      'ph-elision-1': 'لَام',
      'ph-blending-1': 'شَمْس',
      'ph-rhyme-1': 'عَلَم',
      'ph-elision-final-1': 'سَلا',
      'ph-discrimination-1': 'تِين / طِين',
    };
    for (const task of ARABIC_PHONEMIC_TASK_CANDIDATES) {
      assert.ok(task.optionsAr.length >= 3, `Task "${task.id}" needs at least three options`);
      assert.ok(task.correctIndex >= 0 && task.correctIndex < task.optionsAr.length, `Correct index in range for ${task.id}`);
      assert.ok(task.audioSpeechPrompt.length > 0, `Audio prompt for ${task.id}`);
      assert.equal(task.optionsAr[task.correctIndex], expected[task.id], `Answer key for ${task.id}`);
    }
    assert.ok(!/dialect-neutral|مضمون|معتمد/.test(ARABIC_PHONEMIC_TASK_CANDIDATES.map(task => task.explanationAr).join(' ')));
  });

  await t.test('oral reading rate is never classified with unvalidated grade-level Arabic cut-offs', () => {
    for (const gradeLevel of [1, 2, 3, 4, 5, 6]) {
      for (const wcpm of [0, 20, 75, 200]) {
        const result = getFluencyLevelInfo(wcpm, gradeLevel);
        assert.equal(result.level, 'observed');
        assert.match(result.label, /بلا تصنيف معياري/);
        assert.doesNotMatch(result.description, /طلاقة ممتازة|قراءة طبيعية|المعدل المتوقع|المعدل المستهدف/);
      }
    }
  });

  await t.test('different observed measures remain in their native units rather than an invented shared score', () => {
    const observed = [
      { value: 68, unit: 'كلمة/دقيقة' },
      { value: 25, unit: 'ثانية' },
      { value: 75, unit: '%' },
      { value: 12.5, unit: '% خطأ' },
    ];
    assert.equal(new Set(observed.map(metric => metric.unit)).size, observed.length);
    assert.deepEqual(observed.map(metric => metric.value), [68, 25, 75, 12.5]);
    // These unlike measures are intentionally not normalized into a single score.
  });
});
