import {
  PASSAGE_WORDS,
  WORD_ITEMS,
  NONWORD_ITEMS,
  RAN_LETTER_GRID,
  RAN_LETTERS,
  RAN_OBJECT_GRID,
  RAN_OBJECTS,
  passageWordId,
} from './readingTasks';
import { SUBTESTS_BY_ID } from './battery';
import type { AzureAudioAssessmentResult } from '../utils/azurePronunciationAssessment';

export type CognitiveAudioTaskId = 'oralReading' | 'ranObjects' | 'ranLetters' | 'wordReading' | 'nonwordReading';

export interface CognitiveAudioTaskDefinition {
  taskId: CognitiveAudioTaskId;
  referenceWords: string[];
  itemIds: string[];
  symbolIds?: string[];
}

/** The server derives these targets from the checked-in task bank; the browser never supplies them. */
export function getCognitiveAudioTaskDefinition(taskId: unknown): CognitiveAudioTaskDefinition | null {
  if (taskId === 'oralReading') {
    return {
      taskId,
      referenceWords: [...PASSAGE_WORDS],
      itemIds: PASSAGE_WORDS.map((_, index) => passageWordId(index)),
    };
  }

  if (taskId === 'wordReading' || taskId === 'nonwordReading') {
    const subtest = SUBTESTS_BY_ID[taskId];
    if (subtest.kind !== 'readList') return null;
    const expectedItems = taskId === 'wordReading' ? WORD_ITEMS : NONWORD_ITEMS;
    if (
      subtest.items.length !== expectedItems.length ||
      subtest.items.some((item, index) => item.id !== expectedItems[index].id || item.text !== expectedItems[index].text)
    ) return null;
    return {
      taskId,
      referenceWords: subtest.items.map((item) => item.text),
      itemIds: subtest.items.map((item) => item.id),
    };
  }

  if (taskId === 'ranObjects' || taskId === 'ranLetters') {
    const symbols = taskId === 'ranObjects' ? RAN_OBJECTS : RAN_LETTERS;
    const grid = taskId === 'ranObjects' ? RAN_OBJECT_GRID : RAN_LETTER_GRID;
    const byId = new Map<string, (typeof symbols)[number]>(symbols.map((symbol): [string, (typeof symbols)[number]] => [symbol.id, symbol]));
    const ordered = grid.map((id) => byId.get(id)).filter((symbol) => Boolean(symbol));
    if (ordered.length !== grid.length || grid.length !== 40) return null;
    return {
      taskId,
      referenceWords: ordered.map((symbol) => symbol!.nameAr),
      itemIds: ordered.map((_, index) => `ran-${index + 1}`),
      symbolIds: [...grid],
    };
  }

  return null;
}

function normalizeArabicToken(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[.,!?،؟؛:"«»()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Small, explicit naming variants for the five checked-in RAN symbols.
 * These affect only word matching; they do not alter task order or speed.
 */
const RAN_NAME_VARIANTS: Record<string, string[]> = {
  sun: ['شمس', 'الشمس', 'شموسه'],
  house: ['بيت', 'البيت', 'منزل', 'المنزل', 'دار', 'الدار', 'حوش', 'الحوش'],
  ball: ['كرة', 'الكرة', 'كره', 'كوره', 'كورة', 'الكُره', 'الكوره', 'الكورة', 'طابة', 'الطابة', 'طابه', 'الطابه'],
  door: ['باب', 'الباب', 'بوابه', 'البوابه'],
  key: ['مفتاح', 'المفتاح', 'ساروت', 'الساروت'],
  'م': ['ميم', 'الميم', 'م', 'ما', 'مو', 'مي', 'حرف الميم'],
  'ل': ['لام', 'اللام', 'ل', 'لا', 'لو', 'لي', 'حرف اللام'],
  'س': ['سين', 'السين', 'س', 'سا', 'سو', 'سي', 'حرف السين'],
  'د': ['دال', 'الدال', 'د', 'دا', 'دو', 'دي', 'حرف الدال'],
  'ب': ['باء', 'الباء', 'ب', 'با', 'بو', 'بي', 'حرف الباء'],
};

export function isAcceptedRanName(spoken: string | null | undefined, symbolId: string): boolean {
  if (!spoken) return false;
  const actual = normalizeArabicToken(spoken);
  if (!actual) return false;
  const allowed = RAN_NAME_VARIANTS[symbolId];
  return Boolean(allowed?.some((candidate) => normalizeArabicToken(candidate) === actual));
}

/** Accept a curated spoken alias only when Azure's returned word alignment identifies it at this position. */
export function applyRanNameVariants(
  result: AzureAudioAssessmentResult,
  task: CognitiveAudioTaskDefinition,
  durationSeconds: number
): AzureAudioAssessmentResult {
  if (!task.symbolIds || task.symbolIds.length !== result.words.length) return result;

  const words = result.words.map((word, index) => {
    if (!isAcceptedRanName(word.spokenWord, task.symbolIds![index])) return word;
    return {
      ...word,
      errorType: 'DialectVariant' as const,
      notesAr: 'اسم بديل مقبول لهذا الرمز في قائمة الأسماء العربية.',
    };
  });

  const complete = words.every((word) =>
    word.errorType !== 'Unconfirmed' && word.errorType !== 'Insertion'
  );
  const correctWordsCount = words.filter((word) =>
    word.errorType === 'None' || word.errorType === 'DialectVariant'
  ).length;
  const substitutionsCount = words.filter((word) =>
    word.errorType === 'Substitution' || word.errorType === 'Mispronunciation'
  ).length;
  const omissionsCount = words.filter((word) => word.errorType === 'Omission').length;
  const safeDurationSeconds = Math.max(1, durationSeconds);

  return {
    ...result,
    words,
    assessmentComplete: complete,
    correctWordsCount,
    substitutionsCount,
    omissionsCount,
    wordAccuracyPercent: complete ? Math.round((correctWordsCount / words.length) * 100) : null,
    wordsCorrectPerMinute: complete ? Math.round((correctWordsCount * 60) / safeDurationSeconds) : null,
    wordsPerMinute: result.wordsPerMinute,
  };
}
