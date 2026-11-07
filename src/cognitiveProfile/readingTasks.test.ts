import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BATTERY, SUBTESTS_BY_ID, scoredItemIds, sittingsForAge, subtestsForAge } from './battery';
import { LEXICON } from './lexicon';
import { buildProfile, scoreSubtest, type SubtestResult } from './scoring';
import { CognitiveBatteryUploadSchema } from './records';
import {
  NONWORD_ITEMS,
  NONWORD_PRACTICE,
  PASSAGE_WORDS,
  RAN_GRID_SIZE,
  RAN_LETTERS,
  RAN_LETTER_GRID,
  RAN_OBJECTS,
  RAN_OBJECT_GRID,
  READING_MIN_AGE_MONTHS,
  SPELL_ITEMS,
  SPELL_KEYBOARD,
  SPELL_PRACTICE,
  WORD_ITEMS,
  WORD_PRACTICE,
  buildRanGrid,
  letterAccuracy,
  passageWordId,
  perMinute,
  spellingErrorKinds,
  stripMarks,
} from './readingTasks';

const HAS_MARKS = /[ً-ْ]/;
const now = new Date('2026-11-04T10:00:00Z').toISOString();

describe('reading items', () => {
  it('every word, made-up word and passage word is fully vowelled, ids are unique, and lists get harder', () => {
    for (const list of [WORD_ITEMS, NONWORD_ITEMS]) {
      const levels = list.map((i) => i.level);
      assert.deepEqual(levels, [...levels].sort((a, b) => a - b), 'graded from easy to hard');
      for (const item of list) assert.ok(HAS_MARKS.test(item.text), item.text);
    }
    const ids = [...WORD_PRACTICE, ...WORD_ITEMS, ...NONWORD_PRACTICE, ...NONWORD_ITEMS, ...SPELL_PRACTICE, ...SPELL_ITEMS].map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const w of PASSAGE_WORDS) assert.ok(HAS_MARKS.test(w), `passage word ${w}`);
  });

  it('made-up words are not real words in the battery, and avoid the dialect-variable letters ث ذ ظ ق', () => {
    const real = new Set([...Object.values(LEXICON).map((e) => stripMarks(e.word)), ...WORD_ITEMS.map((w) => stripMarks(w.text))]);
    for (const nw of [...NONWORD_PRACTICE, ...NONWORD_ITEMS]) {
      assert.ok(!real.has(stripMarks(nw.text)), `${nw.text} is a real word`);
      assert.doesNotMatch(nw.text, /[ثذظق]/, nw.text);
    }
  });

  it('the passage fits the record limit of 60 responses', () => {
    assert.ok(PASSAGE_WORDS.length >= 30 && PASSAGE_WORDS.length <= 60, `${PASSAGE_WORDS.length} words`);
  });

  it('dictation answers are the spoken word without vowel marks, and can be typed on the tiles', () => {
    for (const item of [...SPELL_PRACTICE, ...SPELL_ITEMS]) {
      assert.equal(item.answer, stripMarks(item.spoken), item.id);
      for (const c of item.answer) assert.ok(SPELL_KEYBOARD.includes(c), `${item.id}: ${c}`);
    }
  });
});

describe('rapid automatized naming grid', () => {
  it('is fixed, uses each symbol equally often and never repeats a symbol twice in a row', () => {
    for (const [grid, symbols] of [[RAN_OBJECT_GRID, RAN_OBJECTS], [RAN_LETTER_GRID, RAN_LETTERS]] as const) {
      assert.equal(grid.length, RAN_GRID_SIZE);
      for (const s of symbols) assert.equal(grid.filter((g) => g === s.id).length, RAN_GRID_SIZE / symbols.length, s.id);
      for (let i = 1; i < grid.length; i++) assert.notEqual(grid[i], grid[i - 1], `repeat at ${i}`);
    }
    assert.deepEqual(buildRanGrid(RAN_OBJECTS.map((s) => s.id), 2026), RAN_OBJECT_GRID, 'same grid for every child');
  });

  it('the pictures are lexicon words', () => {
    for (const s of RAN_OBJECTS) assert.ok(LEXICON[s.value], s.value);
  });
});

describe('spelling analysis', () => {
  it('letter accuracy gives partial credit to near misses', () => {
    assert.equal(letterAccuracy('كتاب', 'كتاب'), 1);
    assert.equal(letterAccuracy('كتب', 'كتاب'), 0.75);
    assert.equal(letterAccuracy('', 'باب'), 0);
  });

  it('names the kind of error', () => {
    assert.deepEqual(spellingErrorKinds('شجرة', 'شجرة'), []);
    assert.ok(spellingErrorKinds('شجره', 'شجرة').includes('taaMarbuta'));
    assert.ok(spellingErrorKinds('اشمس', 'الشمس').includes('silentLam'));
    assert.ok(spellingErrorKinds('مستشفا', 'مستشفى').includes('alifMaqsura'));
    assert.ok(spellingErrorKinds('كتب', 'كتاب').includes('longVowel'));
    assert.deepEqual(spellingErrorKinds('ولت', 'ولد'), ['letter']);
  });
});

describe('scoring of the reading and naming measures', () => {
  it('does not treat manual rapid-naming counts as an available score', () => {
    const scored = scoreSubtest({
      subtestId: 'ranObjects',
      responses: [],
      discontinued: false,
      completedAt: now,
      durationMs: 42_000,
      errorCount: 2,
    }, 78);
    assert.equal(scored.scoreAvailable, false);
    assert.equal(scored.total, 0);
    assert.equal(scored.measures?.attempted, 0);
    assert.equal(scored.measures?.seconds, null);
    assert.equal(scored.measures?.errors, undefined);
  });

  it('does not treat manually marked passage words as a valid speech score', () => {
    const responses = Array.from({ length: 30 }, (_, i) => ({ itemId: passageWordId(i), correct: i % 10 !== 0, rtMs: 0, replays: 0 }));
    const scored = scoreSubtest({ subtestId: 'oralReading', responses, discontinued: false, completedAt: now, durationMs: 60_000 }, 84);
    assert.equal(scored.scoreAvailable, false);
    assert.equal(scored.total, 0);
    assert.equal(scored.correct, 0);
    assert.equal(scored.measures?.correctPerMinute, undefined);
    assert.equal(scored.measures?.seconds, null);
  });

  it('does not count manually marked word-list items as an available reading score', () => {
    const responses = WORD_ITEMS.slice(0, 8).map((w, i) => ({ itemId: w.id, correct: i < 3, rtMs: 3000, replays: 0 }));
    const scored = scoreSubtest({ subtestId: 'wordReading', responses, discontinued: true, completedAt: now, durationMs: 24_000 }, 84);
    assert.equal(scored.scoreAvailable, false);
    assert.equal(scored.total, 0);
    assert.equal(scored.correct, 0);
    assert.equal(scored.measures?.correctPerMinute, undefined);
    assert.ok(scored.flags.includes('discontinued'));
  });

  it('dictation: words right, mean letter accuracy and the commonest error kind', () => {
    const typed: Record<string, string> = { 'sp-1': 'باب', 'sp-2': 'فيل', 'sp-10': 'شجره', 'sp-7': 'كتب' };
    const responses = Object.entries(typed).map(([itemId, t]) => ({
      itemId,
      typed: t,
      correct: t === SPELL_ITEMS.find((i) => i.id === itemId)!.answer,
      rtMs: 4000,
      replays: 0,
    }));
    const scored = scoreSubtest({ subtestId: 'spelling', responses, discontinued: false, completedAt: now }, 90);
    assert.equal(scored.correct, 2);
    assert.ok((scored.measures?.letterPercent ?? 0) > 80);
    assert.ok(scored.measures?.spellingErrors?.some((e) => e.kind === 'taaMarbuta'));
  });

  it('scores only complete, receipted Azure audio evidence and reports raw measures without norms', () => {
    const words = PASSAGE_WORDS.map((word, index) => ({
      word,
      errorType: index === 2 ? 'Substitution' as const : 'None' as const,
      accuracyScore: index === 2 ? 42 : 96,
      spokenWord: word,
    }));
    const evidence = {
      taskId: 'oralReading' as const,
      sourceModel: 'azure_pronunciation_assessment' as const,
      assessmentComplete: true as const,
      assessmentReceipt: 'a'.repeat(64),
      transcript: PASSAGE_WORDS.join(' '),
      durationSeconds: 60,
      wordAccuracyPercent: Math.round(((PASSAGE_WORDS.length - 1) / PASSAGE_WORDS.length) * 100),
      wordsCorrectPerMinute: PASSAGE_WORDS.length - 1,
      wordsPerMinute: PASSAGE_WORDS.length,
      correctWordsCount: PASSAGE_WORDS.length - 1,
      substitutionsCount: 1,
      omissionsCount: 0,
      insertionsCount: 0,
      words,
    };
    const scored = scoreSubtest({
      subtestId: 'oralReading',
      responses: words.map((word, index) => ({
        itemId: passageWordId(index),
        correct: word.errorType === 'None',
        rtMs: 0,
        replays: 0,
      })),
      discontinued: false,
      completedAt: now,
      durationMs: 60_000,
      audioAssessment: evidence,
      audioAssessmentReceipt: evidence.assessmentReceipt,
    }, 84);
    assert.equal(scored.scoreAvailable, true);
    assert.equal(scored.correct, PASSAGE_WORDS.length - 1);
    assert.equal(scored.total, PASSAGE_WORDS.length);
    assert.equal(scored.percent, evidence.wordAccuracyPercent);
    assert.equal(scored.z, null);
    assert.equal(scored.centile, null);
    assert.equal(scored.measures?.seconds, 60);
    assert.equal(scored.measures?.correctPerMinute, PASSAGE_WORDS.length - 1);
  });

  it('rejects an audio evidence object when its task does not match the subtest', () => {
    const parsed = CognitiveBatteryUploadSchema.safeParse({
      ageMonths: 84,
      examinerName: '',
      startedAt: now,
      results: {
        oralReading: {
          subtestId: 'oralReading',
          responses: [],
          discontinued: false,
          completedAt: now,
          audioAssessmentReceipt: 'a'.repeat(64),
          audioAssessment: {
            taskId: 'ranObjects',
            sourceModel: 'azure_pronunciation_assessment',
            assessmentComplete: true,
            assessmentReceipt: 'a'.repeat(64),
            transcript: 'شمس',
            durationSeconds: 5,
            wordAccuracyPercent: 100,
            wordsCorrectPerMinute: 12,
            wordsPerMinute: 12,
            correctWordsCount: 1,
            substitutionsCount: 0,
            omissionsCount: 0,
            insertionsCount: 0,
            words: [{ word: 'شَمْس', errorType: 'None', accuracyScore: 99, spokenWord: 'شمس' }],
          },
        },
      },
    });
    assert.equal(parsed.success, false);
  });

  it('speech scores cannot be supplied through arbitrary client metadata', () => {
    const forged = {
      subtestId: 'ranObjects',
      responses: [],
      discontinued: false,
      completedAt: now,
      durationMs: 42_000,
      errorCount: 0,
      attemptedCount: 40,
      assessmentSource: 'azure',
      aiAssessmentReceipt: 'forged-client-receipt',
    } as unknown as SubtestResult;
    const scored = scoreSubtest(forged, 78);
    assert.equal(scored.scoreAvailable, false);
    assert.equal(scored.total, 0);
  });

  it('reading results remain descriptive-only and never create risk classifications', () => {
    const results: Partial<Record<string, SubtestResult>> = {
      ranObjects: { subtestId: 'ranObjects', responses: [], discontinued: false, completedAt: now, durationMs: 90_000, errorCount: 10 },
      nonwordReading: { subtestId: 'nonwordReading', responses: NONWORD_ITEMS.slice(0, 5).map((w) => ({ itemId: w.id, correct: false, rtMs: 5000, replays: 0 })), discontinued: true, completedAt: now },
    };
    const profile = buildProfile(results, 84);
    assert.equal(profile.risk, 'insufficient');
    assert.equal(profile.domains.length, 0);
    assert.deepEqual(profile.weaknesses, []);
  });
});
describe('age rules and sittings', () => {
  it('before six: precursor tasks and rapid naming of pictures, in three sittings', () => {
    const tasks = subtestsForAge(READING_MIN_AGE_MONTHS - 1).map((s) => s.id);
    assert.equal(sittingsForAge(READING_MIN_AGE_MONTHS - 1).length, 3);
    assert.ok(tasks.includes('ranObjects'));
    for (const id of ['ranLetters', 'wordReading', 'nonwordReading', 'oralReading', 'spelling']) assert.ok(!tasks.includes(id as never), id);
  });

  it('from six: every task once, in four sittings, starting with reading', () => {
    const sittings = sittingsForAge(READING_MIN_AGE_MONTHS);
    assert.equal(sittings.length, 4);
    assert.deepEqual(sittings[0].map((s) => s.id), ['wordReading', 'nonwordReading', 'oralReading', 'ranObjects', 'ranLetters']);
    const all = sittings.flat().map((s) => s.id);
    assert.equal(all.length, BATTERY.length);
    assert.equal(new Set(all).size, BATTERY.length);
    for (const sitting of sittings) assert.ok(sitting.reduce((n, s) => n + s.minutes, 0) <= 16, 'short sittings');
  });
});

describe('records', () => {
  const base = { ageMonths: 84, examinerName: '', startedAt: now };

  it('accept the new measures', () => {
    const parsed = CognitiveBatteryUploadSchema.safeParse({
      ...base,
      results: {
        ranLetters: { subtestId: 'ranLetters', responses: [], discontinued: false, completedAt: now, durationMs: 35_000, errorCount: 1 },
        spelling: { subtestId: 'spelling', responses: [{ itemId: 'sp-1', correct: true, rtMs: 3000, replays: 0, typed: 'باب' }], discontinued: false, completedAt: now },
        oralReading: { subtestId: 'oralReading', responses: [{ itemId: passageWordId(0), correct: true, rtMs: 0, replays: 0 }], discontinued: false, completedAt: now, durationMs: 60_000 },
      },
    });
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
  });

  it('reject typed text that is not tile letters, and passage words that do not exist', () => {
    const bad = CognitiveBatteryUploadSchema.safeParse({
      ...base,
      results: { spelling: { subtestId: 'spelling', responses: [{ itemId: 'sp-1', correct: true, rtMs: 1, replays: 0, typed: '<script>' }], discontinued: false, completedAt: now } },
    });
    assert.equal(bad.success, false);
    const beyond = CognitiveBatteryUploadSchema.safeParse({
      ...base,
      results: { oralReading: { subtestId: 'oralReading', responses: [{ itemId: passageWordId(PASSAGE_WORDS.length), correct: true, rtMs: 0, replays: 0 }], discontinued: false, completedAt: now } },
    });
    assert.equal(beyond.success, false);
  });

  it('scored item ids cover every list', () => {
    assert.equal(scoredItemIds(SUBTESTS_BY_ID.oralReading).length, PASSAGE_WORDS.length);
    assert.equal(scoredItemIds(SUBTESTS_BY_ID.ranObjects).length, RAN_GRID_SIZE);
  });
});

describe('audio', () => {
  it('records the prompts, practice models, dictation words and RAN names, but never reads a scored word to the child', async () => {
    const { buildAudioCatalog, normalizeSpokenText } = await import('./audioCatalog');
    const texts = new Set(buildAudioCatalog().map((e) => e.text));
    const has = (t: string) => texts.has(normalizeSpokenText(t));
    for (const s of BATTERY) assert.ok(has(s.introAudio), `${s.id} intro`);
    for (const i of [...SPELL_PRACTICE, ...SPELL_ITEMS]) assert.ok(has(i.spoken), i.spoken);
    for (const s of [...RAN_OBJECTS, ...RAN_LETTERS]) assert.ok(has(s.nameAr), s.nameAr);
    for (const i of [...WORD_PRACTICE, ...NONWORD_PRACTICE]) assert.ok(has(i.text), i.text);
    for (const i of NONWORD_ITEMS) assert.ok(!has(i.text), `scored made-up word ${i.text} must not be recorded`);
  });
});
