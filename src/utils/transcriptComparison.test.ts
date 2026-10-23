import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareArabicTranscript, normalizeArabicTranscript } from './transcriptComparison';

test('normalizes Arabic diacritics, tatweel, whitespace, and punctuation', () => {
  assert.equal(normalizeArabicTranscript('  بَيْتٌ، '), 'بيت');
  assert.equal(normalizeArabicTranscript('بـيـت؟'), 'بيت');
});

test('reports only an exact text match, not pronunciation accuracy', () => {
  const result = compareArabicTranscript('بَيْتٌ', 'بيتٌ،');
  assert.equal(result.exactMatch, true);
  assert.equal(result.comparison.status, 'exact_match');
  assert.match(result.comparison.notes, /لا تثبت وحدها صحة النطق/);
});

test('marks absent browser transcript as unavailable', () => {
  const result = compareArabicTranscript('بَيْتٌ', '   ');
  assert.equal(result.exactMatch, false);
  assert.equal(result.comparison.status, 'unavailable');
  assert.equal(result.normalizedRecognized, '');
});

test('marks extra or different recognized text for manual review', () => {
  const result = compareArabicTranscript('بيت', 'بيت صغير');
  assert.equal(result.exactMatch, false);
  assert.equal(result.comparison.status, 'transcript_difference');
  assert.match(result.comparison.notes, /التعرف الصوتي/);
});
