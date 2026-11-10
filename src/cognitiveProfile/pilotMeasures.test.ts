import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyPlacement, needsPlacement, nextPlacementStep, placementAgreement, type PlacementAnswer } from './placement';
import { TRANSFER_FORMS, formFor, scoreTransferList, summarizeTransfer, transferDueAt, type TransferRecord } from './transferProbe';
import { LEXICON } from './lexicon';
import { NONWORD_ITEMS, PASSAGE_WORDS, SPELL_ITEMS, WORD_ITEMS, stripMarks } from './readingTasks';
import { buildTrainingPlan, createProgress, generateSession, FOCUS_SKILLS, masteryEstimate, type Level, type TrainingPlan } from './training';
import { TrainingProgressUploadSchema } from './records';

const plan: TrainingPlan = { createdAt: '2026-11-10T00:00:00.000Z', preventive: false, focus: ['rhyme', 'blending'], rationaleAr: [] };
const ans = (level: Level, ...correct: boolean[]): PlacementAnswer[] => correct.map((c) => ({ level, correct: c, guess: 1 / 3 }));

describe('starting-level check (placement)', () => {
  it('keeps the suggestion when the child gets two of three', () => {
    assert.deepEqual(nextPlacementStep(2, ans(2, true)), { action: 'ask', level: 2, count: 2 });
    assert.deepEqual(nextPlacementStep(2, ans(2, true, false, true)), { action: 'done', placed: 2 });
  });

  it('tries one level up after three of three, and moves up only on two of three there', () => {
    assert.deepEqual(nextPlacementStep(1, ans(1, true, true, true)), { action: 'ask', level: 2, count: 3 });
    assert.deepEqual(nextPlacementStep(1, [...ans(1, true, true, true), ...ans(2, true, true, false)]), { action: 'done', placed: 2 });
    assert.deepEqual(nextPlacementStep(1, [...ans(1, true, true, true), ...ans(2, false, true, false)]), { action: 'done', placed: 1 });
  });

  it('steps down after at most one of three, and never below level 1 or above level 3', () => {
    assert.deepEqual(nextPlacementStep(2, ans(2, false, true, false)), { action: 'ask', level: 1, count: 3 });
    assert.deepEqual(nextPlacementStep(2, [...ans(2, false, false, false), ...ans(1, false, false, false)]), { action: 'done', placed: 1 });
    assert.deepEqual(nextPlacementStep(1, ans(1, false, false, false)), { action: 'done', placed: 1 });
    assert.deepEqual(nextPlacementStep(3, ans(3, true, true, true)), { action: 'done', placed: 3 });
  });

  it('a guessing child is rarely moved up: three of three by chance is under 4% with three options', () => {
    assert.ok((1 / 3) ** 3 < 0.04);
  });

  it('is asked once per skill, sets the level, feeds the model as evidence, and is saved', () => {
    const p = createProgress(plan, 1);
    assert.equal(needsPlacement(p, 'rhyme'), true);
    const answers = [...ans(1, true, true, true), ...ans(2, true, true, true)];
    const placed = applyPlacement(p, 'rhyme', 1, answers, 2);
    assert.equal(placed.levels.rhyme, 2);
    assert.equal(masteryEstimate(placed, 'rhyme').level, 2);
    assert.equal(needsPlacement(placed, 'rhyme'), false);
    assert.equal(placed.placements?.[0].suggested, 1);
    assert.equal(placed.placements?.[0].placed, 2);
    assert.ok((placed.bkt?.['rhyme:2']?.n ?? 0) >= 3, 'answers at level 2 are evidence for level 2');
    assert.ok(TrainingProgressUploadSchema.safeParse(placed).success, 'the record is accepted by the server');
  });

  it('summarises how often the rule matched across children', () => {
    const r = (suggested: Level, placed: Level) => ({ skill: 'rhyme' as const, date: '2026-11-10T00:00:00.000Z', suggested, placed, answers: [] });
    assert.deepEqual(placementAgreement([r(1, 1), r(1, 2), r(2, 1), r(2, 2)]), { n: 4, agreementPercent: 50, placedHigher: 1, placedLower: 1 });
    assert.equal(placementAgreement([]), null);
  });
});

describe('transfer measure (untrained words)', () => {
  const used = new Set<string>([
    ...Object.values(LEXICON).map((e) => stripMarks(e.word)),
    ...[...WORD_ITEMS, ...NONWORD_ITEMS].map((i) => stripMarks(i.text)),
    ...SPELL_ITEMS.map((i) => i.answer),
    ...PASSAGE_WORDS.map((w) => stripMarks(w).replace(/[.,،]/g, '')),
  ]);
  const trainingText = FOCUS_SKILLS.flatMap((skill) => ([1, 2, 3] as Level[]).flatMap((level) => [1, 2, 3, 4, 5].map((seed) => JSON.stringify(generateSession(skill, level, seed))))).join(' ');
  const all = (['A', 'B'] as const).flatMap((f) => [...TRANSFER_FORMS[f].real, ...TRANSFER_FORMS[f].nonword]);

  it('no word appears in the screening, the story, the lexicon or the training items', () => {
    for (const w of all) {
      const bare = stripMarks(w.text);
      assert.ok(!used.has(bare), `${w.text} is already used`);
      assert.ok(!trainingText.includes(w.text) && !trainingText.includes(bare), `${w.text} appears in training`);
    }
    assert.equal(new Set(all.map((w) => stripMarks(w.text))).size, all.length, 'no word twice');
  });

  it('the two forms match slot by slot in level and size, and every word is vowelled', () => {
    for (const kind of ['real', 'nonword'] as const) {
      assert.equal(TRANSFER_FORMS.A[kind].length, TRANSFER_FORMS.B[kind].length);
      TRANSFER_FORMS.A[kind].forEach((a, i) => assert.equal(a.level, TRANSFER_FORMS.B[kind][i].level, `${kind} slot ${i}`));
    }
    for (const w of all) assert.match(w.text, /[ً-ْ]/, w.text);
    for (const w of all.filter((x) => x.id.includes('-n'))) assert.doesNotMatch(w.text, /[ثذظق]/, w.text);
  });

  it('is counterbalanced: the end uses the other form than the start, and forms split across children', () => {
    for (const id of ['s1', 's2', 's3', 'child-x']) assert.notEqual(formFor(id, 'pre'), formFor(id, 'post'));
    const firsts = Array.from({ length: 200 }, (_, i) => formFor(`student-${i}`, 'pre'));
    const a = firsts.filter((f) => f === 'A').length;
    assert.ok(a > 70 && a < 130, `about half start on A (${a}/200)`);
  });

  it('is due at the start, middle and end, only from six, and the end needs a start to compare with', () => {
    const p = createProgress(plan, 1);
    assert.equal(transferDueAt(p, 1, 84), 'pre');
    assert.equal(transferDueAt(p, 1, 60), null, 'not before six');
    assert.equal(transferDueAt(p, 5, 84), null, 'outside the windows');
    assert.equal(transferDueAt(p, 19, 84), null, 'no end measure without a start');
    const rec = (point: TransferRecord['point']): TransferRecord => ({ point, form: 'A', session: 1, date: '2026-11-10T00:00:00.000Z', real: { correct: 4, total: 8, ms: 40_000 }, nonword: { correct: 2, total: 8, ms: 50_000 } });
    const withPre = { ...p, transfer: [rec('pre')] };
    assert.equal(transferDueAt(withPre, 2, 84), null, 'start already done');
    assert.equal(transferDueAt(withPre, 11, 84), 'mid');
    assert.equal(transferDueAt(withPre, 20, 84), 'post');
    assert.ok(TrainingProgressUploadSchema.safeParse({ ...withPre }).success);
  });

  it('summarises the change on untrained words from the start', () => {
    const pre: TransferRecord = { point: 'pre', form: 'A', session: 1, date: '2026-11-10T00:00:00.000Z', real: scoreTransferList([true, true, false, false, true, false, false, false].map((c) => ({ correct: c, rtMs: 5000 }))), nonword: { correct: 1, total: 8, ms: 60_000 } };
    const post: TransferRecord = { ...pre, point: 'post', form: 'B', session: 20, real: { correct: 6, total: 8, ms: 30_000 }, nonword: { correct: 4, total: 8, ms: 50_000 } };
    const s = summarizeTransfer([pre, post])!;
    assert.equal(s.realChange, 75 - 38);
    assert.equal(s.nonwordChange, 50 - 13);
    assert.deepEqual(s.realRate, [5, 12]);
    assert.equal(summarizeTransfer([]), null);
  });
});

describe('plan still builds', () => {
  it('buildTrainingPlan is unaffected', () => {
    assert.ok(buildTrainingPlan);
  });
});

describe('voice-scoring agreement with the adult', async () => {
  const { agreementPairs, audioAgreement, kappaLabelAr } = await import('./audioAgreement');
  const { CognitiveBatteryUploadSchema } = await import('./records');
  const now = '2026-11-10T10:00:00.000Z';

  it('computes agreement, kappa, sensitivity and specificity with the adult as reference', () => {
    // 10 words: both right 6, both wrong 2, engine missed an error 1, engine flagged a right word 1.
    const pairs = [
      ...Array(6).fill({ engine: true, human: true }),
      ...Array(2).fill({ engine: false, human: false }),
      { engine: true, human: false },
      { engine: false, human: true },
    ];
    const a = audioAgreement(pairs)!;
    assert.equal(a.n, 10);
    assert.equal(a.agreementPercent, 80);
    assert.equal(a.sensitivityPercent, 67); // 2 of 3 adult-heard errors
    assert.equal(a.specificityPercent, 86); // 6 of 7 adult-heard correct words
    // po = .8, pe = .7*.7 + .3*.3 = .58, kappa = .22/.42 = 0.52
    assert.equal(a.kappa, 0.52);
    assert.equal(kappaLabelAr(a.kappa), 'اتفاق متوسط');
  });

  it('kappa is undefined when everything is in one category, and no pairs give no summary', () => {
    assert.equal(audioAgreement(Array(5).fill({ engine: true, human: true }))!.kappa, null);
    assert.equal(audioAgreement([]), null);
  });

  it('reads pairs only from voice-scored word lists with an adult mark, and the record accepts the mark', () => {
    const results = {
      wordReading: {
        subtestId: 'wordReading' as const,
        discontinued: false,
        completedAt: now,
        responses: [
          { itemId: WORD_ITEMS[0].id, correct: true, rtMs: 0, replays: 0, humanCorrect: true },
          { itemId: WORD_ITEMS[1].id, correct: false, rtMs: 0, replays: 0 },
        ],
      },
    };
    assert.deepEqual(agreementPairs(results), [{ engine: true, human: true }]);
    const parsed = CognitiveBatteryUploadSchema.safeParse({ ageMonths: 84, examinerName: '', startedAt: now, results });
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues?.slice(0, 2)));
  });
});

describe('pilot evidence summary', async () => {
  const { pilotSummary, pilotReportAr } = await import('./pilotEvidence');
  it('pools the three measures over children, ignores demo records, and states every sample size', () => {
    const progress = {
      ...createProgress(plan, 1),
      placements: [
        { skill: 'rhyme' as const, date: '2026-11-10T00:00:00.000Z', suggested: 1 as Level, placed: 1 as Level, answers: [] },
        { skill: 'blending' as const, date: '2026-11-10T00:00:00.000Z', suggested: 1 as Level, placed: 2 as Level, answers: [] },
      ],
      transfer: [
        { point: 'pre' as const, form: 'A' as const, session: 1, date: '2026-11-01T00:00:00.000Z', real: { correct: 2, total: 8, ms: 60_000 }, nonword: { correct: 1, total: 8, ms: 60_000 } },
        { point: 'post' as const, form: 'B' as const, session: 20, date: '2026-11-30T00:00:00.000Z', real: { correct: 6, total: 8, ms: 40_000 }, nonword: { correct: 3, total: 8, ms: 50_000 } },
      ],
    };
    const child = { id: 'c1', name: 'x', trainingProgress: progress, cognitiveBattery: { results: { wordReading: { subtestId: 'wordReading', discontinued: false, completedAt: '2026-11-01T00:00:00.000Z', responses: [{ itemId: 'wr-1', correct: false, rtMs: 0, replays: 0, humanCorrect: false }] } } } };
    const demo = { ...child, id: 'demo', isDemoRecord: true };
    const s = pilotSummary([child, demo] as never);
    assert.equal(s.children, 1);
    assert.equal(s.placement?.agreementPercent, 50);
    assert.equal(s.transfer.n, 1);
    assert.equal(s.transfer.meanRealChange, 50);
    assert.equal(s.audio?.n, 1);
    const text = pilotReportAr(s);
    assert.match(text, /مجموعة مقارنة/, 'the report states its limit');
    assert.doesNotMatch(text, /[A-Za-z]{3,}/, 'Arabic only');
  });
});
