import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseArabicWordUnits,
  scoreBlindSingleWordArabic,
  buildSingleWordAssessmentFromBlindScore,
} from './blindVowelledScoring';

test('parseArabicWordUnits folds tanween fat-h alif onto preceding consonant', () => {
  const u1 = parseArabicWordUnits('بَيْتًا');
  assert.equal(u1.length, 3);
  assert.equal(u1[2].letter, 'ت');
  assert.equal(u1[2].vowel, 'an');

  const u2 = parseArabicWordUnits('بيتاً');
  assert.equal(u2.length, 3);
  assert.equal(u2[2].letter, 'ت');
  assert.equal(u2[2].vowel, 'an');
});

test('detects internal short-vowel reading error: كَتَبَ read as كُتُب is Mispronunciation, NOT correct', () => {
  const res = scoreBlindSingleWordArabic('كَتَبَ', 'كُتُب');
  assert.equal(res.errorType, 'Mispronunciation');
  assert.equal(res.mismatchKind, 'internal_vowel');
  assert.equal(res.spokenWord, 'كُتُب');
  assert.ok(res.accuracyScore < 70);
  assert.match(res.notesAr, /الحركات الداخلية/);
});

test('accepts exact vowelled reading and phonetic dammah elongation (بيتو for بَيْتُ)', () => {
  const exact = scoreBlindSingleWordArabic('بَيْتُ', 'بَيْتُ');
  assert.equal(exact.errorType, 'None');
  assert.equal(exact.accuracyScore, 100);
  assert.equal(exact.spokenWord, 'بَيْتُ');

  const dammahWaw = scoreBlindSingleWordArabic('بَيْتُ', 'بيتو');
  assert.equal(dammahWaw.errorType, 'None');
  assert.equal(dammahWaw.accuracyScore, 100);
  assert.equal(dammahWaw.spokenWord, 'بيتو');
});

test('accepts valid Arabic pausal reading (الوقف بالسكون) on isolated words', () => {
  const pausal = scoreBlindSingleWordArabic('بَيْتُ', 'بَيْتْ');
  assert.equal(pausal.errorType, 'None');
  assert.equal(pausal.mismatchKind, 'pause');
  assert.equal(pausal.accuracyScore, 95);

  const taaMarbutaPause = scoreBlindSingleWordArabic('سَمَكَةُ', 'سَمَكَهْ');
  assert.equal(taaMarbutaPause.errorType, 'None');
  assert.equal(taaMarbutaPause.mismatchKind, 'pause');
});

test('detects conflicting final case/tanween: بَيْتًا or بيتا for بَيْتُ preserves spokenWord and flags final_case', () => {
  const tanween = scoreBlindSingleWordArabic('بَيْتُ', 'بَيْتًا');
  assert.equal(tanween.errorType, 'Mispronunciation');
  assert.equal(tanween.mismatchKind, 'final_case');
  assert.equal(tanween.spokenWord, 'بَيْتًا');
  assert.match(tanween.notesAr, /تنوين الفتح/);

  const unmarkedAlif = scoreBlindSingleWordArabic('بَيْتُ', 'بيتا');
  assert.equal(unmarkedAlif.errorType, 'Mispronunciation');
  assert.equal(unmarkedAlif.mismatchKind, 'final_case');
  assert.equal(unmarkedAlif.spokenWord, 'بيتا');
});

test('detects complete word substitution (كتاب vs قَلَمُ, دارْفِيل vs فِيلُ) and never echoes target', () => {
  const kitab = scoreBlindSingleWordArabic('قَلَمُ', 'كِتَاب');
  assert.equal(kitab.errorType, 'Substitution');
  assert.equal(kitab.spokenWord, 'كِتَاب');
  assert.equal(kitab.accuracyScore, 0);

  const darfeel = scoreBlindSingleWordArabic('فِيلُ', 'دارْفِيل');
  assert.equal(darfeel.errorType, 'Substitution');
  assert.equal(darfeel.spokenWord, 'دارْفِيل');
  assert.equal(darfeel.accuracyScore, 0);
});

test('keeps Arabic emphatic/plain minimal pairs distinct (سَيْف vs صَيْف)', () => {
  const swap = scoreBlindSingleWordArabic('سَيْف', 'صَيْف');
  assert.equal(swap.errorType, 'Substitution');
  assert.equal(swap.mismatchKind, 'letter_swap');
  assert.equal(swap.spokenWord, 'صَيْف');
});

test('scores nonwords accurately without real-word distortion', () => {
  const ok = scoreBlindSingleWordArabic('فُوبُ', 'فُوبُ');
  assert.equal(ok.errorType, 'None');
  assert.equal(ok.accuracyScore, 100);

  const wrong = scoreBlindSingleWordArabic('فُوبُ', 'دُوبُو');
  assert.equal(wrong.errorType, 'Substitution');
  assert.equal(wrong.spokenWord, 'دُوبُو');

  const wrongVowel = scoreBlindSingleWordArabic('بَتَمُ', 'بُتُمُ');
  assert.equal(wrongVowel.errorType, 'Mispronunciation');
  assert.equal(wrongVowel.mismatchKind, 'internal_vowel');
});

test('handles silence as Omission and wraps cleanly into AzureAudioAssessmentResult', () => {
  const silent = scoreBlindSingleWordArabic('بَابُ', '');
  assert.equal(silent.errorType, 'Omission');
  assert.equal(silent.spokenWord, null);

  const wrapped = buildSingleWordAssessmentFromBlindScore({
    score: scoreBlindSingleWordArabic('كَتَبَ', 'كُتُب'),
    durationSeconds: 1.1,
  });
  assert.equal(wrapped.assessmentComplete, true);
  assert.equal(wrapped.words[0].errorType, 'Mispronunciation');
  assert.equal(wrapped.words[0].spokenWord, 'كُتُب');
  assert.equal(wrapped.correctWordsCount, 0);
  assert.equal(wrapped.substitutionsCount, 1);
});
