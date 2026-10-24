import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignSpeechWithReferenceText,
  evaluatePronunciationWithAzureOrLocal,
} from './pronunciationAssessment';

test('Pronunciation Assessment & Reference-Text Alignment Engine', async (t) => {
  const referenceWords = ['قَرَأَ', 'الطِّفْلُ', 'قِصَّةً', 'مُفِيدَةً'];

  await t.test('accurately classifies exact match reading', () => {
    const transcript = 'قرأ الطفل قصة مفيدة';
    const result = alignSpeechWithReferenceText(referenceWords, transcript, 10);

    assert.equal(result.accuracyScore, 100);
    assert.equal(result.wordsCount, 4);
    assert.equal(result.correctWordsCount, 4);
    assert.equal(result.substitutionsCount, 0);
    assert.equal(result.omissionsCount, 0);
    assert.ok(result.wordsCorrectPerMinute > 0);
  });

  await t.test('detects omissions when child skips words', () => {
    const transcript = 'قرأ الطفل مفيدة'; // skipped "قصة"
    const result = alignSpeechWithReferenceText(referenceWords, transcript, 10);

    assert.ok(result.accuracyScore < 100);
    assert.equal(result.omissionsCount, 1);
    const omittedWord = result.words.find((w) => w.word === 'قِصَّةً');
    assert.ok(omittedWord);
    assert.equal(omittedWord?.errorType, 'Omission');
  });

  await t.test('detects phonetic substitution when child misreads a word', () => {
    const transcript = 'قرأ الولد قصة مفيدة'; // substituted "الطفل" with "الولد"
    const result = alignSpeechWithReferenceText(referenceWords, transcript, 10);

    assert.ok(result.substitutionsCount >= 1);
    const subWord = result.words.find((w) => w.word === 'الطِّفْلُ');
    assert.ok(subWord);
    assert.equal(subWord?.errorType, 'Substitution');
    assert.equal(subWord?.spokenWord, 'الولد');
  });

  await t.test('handles empty audio/transcript cleanly without crashing', async () => {
    const result = await evaluatePronunciationWithAzureOrLocal({
      referenceText: 'قَرَأَ الطِّفْلُ',
      referenceWords: ['قَرَأَ', 'الطِّفْلُ'],
      spokenTranscript: '',
      durationSeconds: 15,
    });

    assert.equal(result.accuracyScore, 0);
    assert.equal(result.omissionsCount, 2);
    assert.equal(result.sourceModel, 'baseera_reference_aligner');
  });
});
