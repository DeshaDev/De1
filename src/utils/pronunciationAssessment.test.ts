import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignSpeechWithReferenceText,
  evaluatePronunciationWithAzureOrLocal,
} from './pronunciationAssessment';
import {
  mapAzureAssessmentToReferenceWords,
  normalizeAzureWordResults,
} from './azurePronunciationAssessment';

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


test('Azure SDK word responses read nested PronunciationAssessment scores', () => {
  const words = normalizeAzureWordResults([
    {
      Word: 'الولد',
      PronunciationAssessment: { AccuracyScore: 47, ErrorType: 'Mispronunciation' },
    },
    {
      Word: 'قرأ',
      PronunciationAssessment: { AccuracyScore: 98, ErrorType: 'None' },
    },
  ]);
  assert.deepEqual(words, [
    { word: 'الولد', errorType: 'Mispronunciation', accuracyScore: 47 },
    { word: 'قرأ', errorType: 'None', accuracyScore: 98 },
  ]);
});

test('Azure reference alignment confirms a substitution only when audio scoring supports it', () => {
  const result = mapAzureAssessmentToReferenceWords({
    referenceWords: ['قرأ', 'الطِّفْلُ', 'قصة'],
    transcript: 'قرأ الولد قصة',
    durationSeconds: 8,
    enableMiscue: true,
    providerWords: [
      { word: 'قرأ', errorType: 'None', accuracyScore: 98 },
      { word: 'الولد', errorType: 'Mispronunciation', accuracyScore: 42 },
      { word: 'قصة', errorType: 'None', accuracyScore: 94 },
    ],
  });
  assert.equal(result.sourceModel, 'azure_pronunciation_assessment');
  assert.equal(result.words.length, 3);
  assert.equal(result.words[1].word, 'الطِّفْلُ');
  assert.equal(result.words[1].errorType, 'Substitution');
  assert.equal(result.words[1].spokenWord, 'الولد');
  assert.equal(result.assessmentComplete, true);
});

test('Azure omission is confirmed only when the provider explicitly returns an omission tag', () => {
  const confirmed = mapAzureAssessmentToReferenceWords({
    referenceWords: ['قرأ', 'الطِّفْلُ', 'قصة'],
    transcript: 'قرأ قصة',
    durationSeconds: 8,
    enableMiscue: true,
    providerWords: [
      { word: 'قرأ', errorType: 'None', accuracyScore: 98 },
      { word: 'الطِّفْلُ', errorType: 'Omission', accuracyScore: 0 },
      { word: 'قصة', errorType: 'None', accuracyScore: 95 },
    ],
  });
  assert.equal(confirmed.words[1].errorType, 'Omission');
  assert.equal(confirmed.omissionsCount, 1);
  assert.equal(confirmed.assessmentComplete, true);

  const unconfirmed = mapAzureAssessmentToReferenceWords({
    referenceWords: ['قرأ', 'الطِّفْلُ', 'قصة'],
    transcript: 'قرأ قصة',
    durationSeconds: 8,
    enableMiscue: false,
    providerWords: [
      { word: 'قرأ', errorType: 'None', accuracyScore: 98 },
      { word: 'قصة', errorType: 'None', accuracyScore: 95 },
    ],
  });
  assert.equal(unconfirmed.words[1].errorType, 'Unconfirmed');
  assert.equal(unconfirmed.omissionsCount, 0);
  assert.equal(unconfirmed.assessmentComplete, false);
  assert.equal(unconfirmed.wordsCorrectPerMinute, null);
});
