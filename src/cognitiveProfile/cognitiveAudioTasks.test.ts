import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSAGE_WORDS,
  WORD_ITEMS,
  NONWORD_ITEMS,
  RAN_LETTER_GRID,
  RAN_OBJECT_GRID,
} from './readingTasks';
import {
  getCognitiveAudioTaskDefinition,
  isAcceptedRanName,
} from './cognitiveAudioTasks';

describe('trusted cognitive audio task definitions', () => {
  it('derives the passage reference from the canonical checked-in task bank', () => {
    const task = getCognitiveAudioTaskDefinition('oralReading');
    assert.ok(task);
    assert.deepEqual(task.referenceWords, PASSAGE_WORDS);
    assert.equal(task.itemIds.length, PASSAGE_WORDS.length);
    assert.equal(task.itemIds[0], 'or-1');
  });

  it('derives both RAN reference sequences from the fixed server-side grids', () => {
    const objects = getCognitiveAudioTaskDefinition('ranObjects');
    const letters = getCognitiveAudioTaskDefinition('ranLetters');
    assert.ok(objects);
    assert.ok(letters);
    assert.equal(objects.referenceWords.length, 40);
    assert.equal(objects.itemIds.length, 40);
    assert.deepEqual(objects.symbolIds, RAN_OBJECT_GRID);
    assert.equal(letters.referenceWords.length, 40);
    assert.equal(letters.itemIds.length, 40);
    assert.deepEqual(letters.symbolIds, RAN_LETTER_GRID);
  });

  it('accepts only curated aliases for the matching RAN symbol', () => {
    assert.equal(isAcceptedRanName('كورة', 'ball'), true);
    assert.equal(isAcceptedRanName('طابة', 'ball'), true);
    assert.equal(isAcceptedRanName('منزل', 'house'), true);
    assert.equal(isAcceptedRanName('ساروت', 'key'), true);
    assert.equal(isAcceptedRanName('ميم', 'م'), true);
    assert.equal(isAcceptedRanName('مَ', 'م'), true);
    assert.equal(isAcceptedRanName('كورة', 'house'), false);
    assert.equal(isAcceptedRanName('غير معروف', 'ball'), false);
  });

  it('derives real-word and nonword references from the fixed reading bank', () => {
    const realWords = getCognitiveAudioTaskDefinition('wordReading');
    const nonwords = getCognitiveAudioTaskDefinition('nonwordReading');
    assert.ok(realWords);
    assert.ok(nonwords);
    assert.deepEqual(realWords.referenceWords, WORD_ITEMS.map((item) => item.text));
    assert.deepEqual(realWords.itemIds, WORD_ITEMS.map((item) => item.id));
    assert.deepEqual(nonwords.referenceWords, NONWORD_ITEMS.map((item) => item.text));
    assert.deepEqual(nonwords.itemIds, NONWORD_ITEMS.map((item) => item.id));
  });

  it('keeps taa marbuta and alif maqsura distinct while accepting explicit ball aliases', () => {
    assert.equal(isAcceptedRanName('كرة', 'ball'), true);
    assert.equal(isAcceptedRanName('طابة', 'ball'), true);
    assert.equal(isAcceptedRanName('هدى', 'ball'), false);
  });

  it('does not let the browser supply a custom or unknown task reference', () => {
    assert.equal(getCognitiveAudioTaskDefinition('customTextFromClient'), null);
    assert.equal(getCognitiveAudioTaskDefinition('otherReading'), null);
  });
});
