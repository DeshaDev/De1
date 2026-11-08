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
  aggregateCognitiveWordAssessments,
  applyRanNameVariants,
  getCognitiveAudioTaskDefinition,
  isAcceptedRanName,
} from './cognitiveAudioTasks';
import type { AzureAudioAssessmentResult } from '../utils/azurePronunciationAssessment';

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


function ranAssessment(
  errorType: AzureAudioAssessmentResult['words'][number]['errorType'],
  accuracyScore: number | null,
  spokenWord: string
): AzureAudioAssessmentResult {
  return {
    sourceModel: 'azure_pronunciation_assessment',
    assessmentMode: 'continuous-audio-alignment',
    assessmentComplete: errorType !== 'Unconfirmed',
    transcript: spokenWord,
    accuracyScore: null,
    wordAccuracyPercent: null,
    fluencyScore: null,
    completenessScore: null,
    pronScore: null,
    wordsCount: 1,
    correctWordsCount: 0,
    substitutionsCount: errorType === 'Substitution' || errorType === 'Mispronunciation' ? 1 : 0,
    omissionsCount: 0,
    insertionsCount: 0,
    wordsPerMinute: 30,
    wordsCorrectPerMinute: 0,
    words: [{
      word: 'كرة',
      errorType,
      accuracyScore,
      spokenWord,
      notesAr: '',
    }],
  };
}

describe('RAN spoken aliases must preserve Azure pronunciation evidence', () => {
  const task = {
    taskId: 'ranObjects' as const,
    referenceWords: ['كرة'],
    itemIds: ['ran-1'],
    symbolIds: ['ball'],
  };

  it('does not turn a low-scoring pronunciation into an accepted dialect variant', () => {
    const result = applyRanNameVariants(
      ranAssessment('Mispronunciation', 42, 'طابة'),
      task,
      2
    );
    assert.equal(result.words[0].errorType, 'Mispronunciation');
    assert.equal(result.correctWordsCount, 0);
    assert.equal(result.wordAccuracyPercent, 0);
  });

  it('accepts a curated spoken alias only when Azure score supports the substitution', () => {
    const result = applyRanNameVariants(
      ranAssessment('Substitution', 82, 'طابة'),
      task,
      2
    );
    assert.equal(result.words[0].errorType, 'DialectVariant');
    assert.equal(result.correctWordsCount, 1);
    assert.equal(result.wordAccuracyPercent, 100);
  });

  it('does not override an explicit Azure mispronunciation even when its score is high', () => {
    const result = applyRanNameVariants(
      ranAssessment('Mispronunciation', 92, 'طابة'),
      task,
      2
    );
    assert.equal(result.words[0].errorType, 'Mispronunciation');
    assert.equal(result.correctWordsCount, 0);
  });

  it('does not resolve an unconfirmed word from transcript text alone', () => {
    const result = applyRanNameVariants(
      ranAssessment('Unconfirmed', 99, 'طابة'),
      task,
      2
    );
    assert.equal(result.words[0].errorType, 'Unconfirmed');
    assert.equal(result.assessmentComplete, false);
    assert.equal(result.wordAccuracyPercent, null);
  });
});


describe('per-word reading assessment aggregation', () => {
  const task = getCognitiveAudioTaskDefinition('wordReading')!;
  const records = () => task.itemIds.map((itemId, itemIndex) => ({
    itemId,
    itemIndex,
    transcript: task.referenceWords[itemIndex].replace(/[ً-ْ]/g, ''),
    durationSeconds: 0.6,
    word: {
      word: task.referenceWords[itemIndex],
      errorType: 'None' as const,
      accuracyScore: 96,
      spokenWord: task.referenceWords[itemIndex],
      notesAr: '',
    },
  }));

  it('aggregates all one-word receipts in canonical sequence into one complete score', () => {
    const aggregated = aggregateCognitiveWordAssessments(task, records());
    assert.ok(aggregated);
    assert.equal(aggregated.taskId, 'wordReading');
    assert.equal(aggregated.words.length, task.itemIds.length);
    assert.equal(aggregated.words[0].word, task.referenceWords[0]);
    assert.equal(aggregated.words.at(-1)?.word, task.referenceWords.at(-1));
    assert.equal(aggregated.correctWordsCount, task.itemIds.length);
    assert.equal(aggregated.wordAccuracyPercent, 100);
    assert.ok(Math.abs(aggregated.durationSeconds - 9.6) < 0.001);
  });

  it('rejects a missing, duplicated, or out-of-order word receipt', () => {
    const complete = records();
    assert.equal(aggregateCognitiveWordAssessments(task, complete.slice(0, -1)), null);
    const duplicate = [...complete];
    duplicate[1] = { ...duplicate[1], itemId: duplicate[0].itemId };
    assert.equal(aggregateCognitiveWordAssessments(task, duplicate), null);
    const reordered = [...complete];
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
    assert.equal(aggregateCognitiveWordAssessments(task, reordered), null);
  });

  it('never promotes an unresolved word to a confirmed error or success', () => {
    const incomplete = records();
    incomplete[4] = {
      ...incomplete[4],
      word: { ...incomplete[4].word, errorType: 'Unconfirmed' as const },
    };
    assert.equal(aggregateCognitiveWordAssessments(task, incomplete), null);
  });

  it('rejects duplicate reference ids even when the supplied sequence length matches', () => {
    const duplicateTask = { ...task, itemIds: [...task.itemIds] };
    duplicateTask.itemIds[1] = duplicateTask.itemIds[0];
    assert.equal(aggregateCognitiveWordAssessments(duplicateTask, records()), null);
  });
});
