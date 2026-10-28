import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BATTERY, ChoiceItem, SUBTESTS_BY_ID, SubtestId, scoredItemCount } from './battery';
import { LEXICON, lex } from './lexicon';
import {
  ItemResponse,
  SubtestResult,
  buildProfile,
  centileFromZ,
  formatAge,
  maxSpanFrom,
  scoreSpanTrial,
  scoreSubtest,
  shouldDiscontinue,
  shouldStopSpan,
  REFERENCE_TABLE,
  AGE_BANDS,
} from './scoring';
import { SUBTEST_GUIDANCE, RISK_META, PATTERN_META, nextStepsAr } from './guidance';
import {
  SKILLS,
  SkillId,
  Level,
  applySession,
  buildTrainingPlan,
  createProgress,
  generateSession,
} from './training';

const choiceItems = (id: SubtestId): ChoiceItem[] => {
  const s = SUBTESTS_BY_ID[id];
  assert.equal(s.kind, 'choice');
  return s.kind === 'choice' ? [...s.practice, ...s.items] : [];
};

test('battery has nine subtests covering five domains in a fixed order', () => {
  assert.equal(BATTERY.length, 9);
  assert.deepEqual(BATTERY.map((s) => s.order), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(new Set(BATTERY.map((s) => s.domain)).size, 5);
  for (const s of BATTERY) {
    assert.ok(scoredItemCount(s) >= 8, `${s.id} needs enough scored items for a stable score`);
    assert.ok(REFERENCE_TABLE.rows[s.id].length === AGE_BANDS.length, `${s.id} reference row per age band`);
    assert.ok(SUBTEST_GUIDANCE[s.id].strategiesAr.length >= 4, `${s.id} needs teaching strategies`);
  }
});

test('every choice item has a unique set of options containing the correct answer', () => {
  for (const s of BATTERY) {
    if (s.kind !== 'choice') continue;
    for (const item of [...s.practice, ...s.items]) {
      const ids = item.options.map((o) => o.id);
      assert.equal(new Set(ids).size, ids.length, `${item.id} duplicate options`);
      assert.ok(ids.includes(item.correctId), `${item.id} correct answer missing`);
    }
  }
});

test('rhyme items: the answer rhymes with the target and no distractor does', () => {
  for (const item of choiceItems('rhyme')) {
    const target = Object.values(LEXICON).find((e) => e.word === item.stimulus?.label);
    assert.ok(target, item.id);
    for (const option of item.options) {
      const rhymes: boolean = lex(option.id).rhyme === target!.rhyme;
      assert.equal(rhymes, option.id === item.correctId, `${item.id}: ${option.id}`);
    }
  }
});

test('phonological items: onset, coda, blending and counting answers are linguistically correct', () => {
  for (const item of choiceItems('phonological')) {
    const target = Object.values(LEXICON).find((e) => e.word === item.stimulus?.label);
    if (item.tag === 'onset') {
      for (const o of item.options) {
        assert.equal(lex(o.id).onset === target!.onset, o.id === item.correctId, `${item.id}: ${o.id}`);
      }
    } else if (item.tag === 'coda') {
      for (const o of item.options) {
        assert.equal(lex(o.id).coda === target!.coda, o.id === item.correctId, `${item.id}: ${o.id}`);
      }
    } else if (item.tag === 'blending') {
      const spoken = item.audio.map((a) => a.text);
      assert.ok(lex(item.correctId).syllables.every((syl) => spoken.includes(syl)), item.id);
    } else if (item.tag === 'syllableCount') {
      assert.equal(item.correctId, `n${target!.syllables.length}`);
    } else {
      assert.fail(`unexpected tag ${item.tag}`);
    }
  }
});

test('auditory discrimination: same/different keys match the spoken syllables', () => {
  for (const item of choiceItems('auditoryDiscrimination')) {
    if (item.tag === 'minimalPair') {
      const [a, b] = item.options.map((o) => lex(o.id).word);
      const differing = Array.from(a).filter((ch, i) => ch !== Array.from(b)[i]).length;
      assert.equal(differing, 1, `${item.id} must differ by exactly one letter`);
      continue;
    }
    const [first, second] = item.audio.map((s) => s.text);
    assert.equal(item.correctId, first === second ? 'same' : 'different', item.id);
  }
});

test('visual discrimination: exactly one option is identical to the target', () => {
  for (const item of choiceItems('visualDiscrimination')) {
    const identical = item.options.filter((o) => o.visual.type === 'glyph' && o.visual.value === item.stimulus?.value);
    assert.equal(identical.length, 1, item.id);
  }
});

test('span trials show every sequence item among the choices', () => {
  for (const s of BATTERY) {
    if (s.kind !== 'span') continue;
    for (const t of [...s.practice, ...s.trials]) {
      assert.ok(t.sequence.every((id) => t.choices.includes(id)), t.id);
      assert.equal(new Set(t.choices).size, t.choices.length, t.id);
      assert.ok(t.choices.length >= t.sequence.length + 2 || t.choices.length >= 6);
    }
  }
});

const respond = (pattern: boolean[]): ItemResponse[] =>
  pattern.map((correct, i) => ({ itemId: `i${i}`, correct, rtMs: 1800, replays: 0 }));

function resultWithPercent(id: SubtestId, percent: number): SubtestResult {
  const total = scoredItemCount(SUBTESTS_BY_ID[id]);
  const correct = Math.round((percent / 100) * total);
  return {
    subtestId: id,
    responses: respond(Array.from({ length: total }, (_, i) => i < correct)),
    discontinued: false,
    completedAt: '2026-10-28T10:00:00.000Z',
  };
}

function profileFor(percents: Partial<Record<SubtestId, number>>, ageMonths: number) {
  const results: Partial<Record<SubtestId, SubtestResult>> = {};
  for (const [id, pct] of Object.entries(percents)) results[id as SubtestId] = resultWithPercent(id as SubtestId, pct!);
  return buildProfile(results, ageMonths);
}

const AT_MEAN_6Y = Object.fromEntries(
  BATTERY.map((s) => [s.id, REFERENCE_TABLE.rows[s.id][2][0]])
) as Record<SubtestId, number>;

test('a child scoring at the age expectation lands in the average band with low risk', () => {
  const profile = profileFor(AT_MEAN_6Y, 78);
  assert.equal(profile.subtests.length, 9);
  for (const s of profile.subtests) assert.equal(s.band, 'average', s.subtestId);
  assert.equal(profile.risk, 'low');
  assert.equal(profile.pattern, 'none');
});

test('the same raw score is interpreted relative to age', () => {
  const young = scoreSubtest(resultWithPercent('letterSound', 50), 54);
  const older = scoreSubtest(resultWithPercent('letterSound', 50), 90);
  assert.ok(young.centile > older.centile);
  assert.ok(older.band === 'severe' || older.band === 'below');
});

test('phonological weakness with intact visual skills gives a high-risk phonological pattern', () => {
  const profile = profileFor({ ...AT_MEAN_6Y, rhyme: 25, phonological: 17, pairedAssociate: 25 }, 78);
  assert.equal(profile.risk, 'high');
  assert.equal(profile.pattern, 'phonological');
  assert.deepEqual([...profile.weaknesses].sort(), ['pairedAssociate', 'phonological', 'rhyme']);
});

test('a single core weakness gives moderate risk', () => {
  const profile = profileFor({ ...AT_MEAN_6Y, rhyme: 38 }, 78);
  assert.equal(profile.risk, 'moderate');
});

test('low scores everywhere are reported as a general pattern, not a dyslexia pattern', () => {
  const all = Object.fromEntries(BATTERY.map((s) => [s.id, 8])) as Record<SubtestId, number>;
  const profile = profileFor(all, 80);
  assert.equal(profile.pattern, 'general');
  assert.ok(nextStepsAr(profile.risk, profile.pattern).some((s) => s.includes('سمع')));
});

test('letter knowledge does not raise risk before age five', () => {
  const profile = profileFor({ ...AT_MEAN_6Y, letterSound: 0 }, 52);
  assert.equal(profile.subtests.find((s) => s.subtestId === 'letterSound')!.band !== undefined, true);
  assert.equal(profile.coreWeakCount, profile.subtests.filter((s) => s.subtestId !== 'letterSound' && (s.band === 'below' || s.band === 'severe') && ['rhyme', 'phonological', 'auditorySequential', 'pairedAssociate', 'auditoryDiscrimination'].includes(s.subtestId)).length);
});

test('risk is withheld when too few core subtests were completed', () => {
  const profile = profileFor({ visualSequential: 50, visualAssociative: 60, rhyme: 70 }, 78);
  assert.equal(profile.risk, 'insufficient');
  assert.equal(profile.missing.length, 6);
});

test('validity flags: near-chance and discontinued results are flagged', () => {
  const result = resultWithPercent('rhyme', 38);
  const scored = scoreSubtest({ ...result, discontinued: true }, 78);
  assert.ok(scored.flags.includes('nearChance'));
  assert.ok(scored.flags.includes('discontinued'));
});

test('centiles stay within 1–99 and are monotonic', () => {
  assert.equal(centileFromZ(-5), 1);
  assert.equal(centileFromZ(5), 99);
  assert.equal(centileFromZ(0), 50);
  assert.ok(centileFromZ(-1) < centileFromZ(-0.5));
  assert.equal(centileFromZ(-0.84), 20);
});

test('span scoring, discontinue and max span rules', () => {
  assert.deepEqual(scoreSpanTrial(['a', 'b', 'c'], ['a', 'b', 'c']), { correct: true, positions: 3 });
  assert.deepEqual(scoreSpanTrial(['a', 'b', 'c'], ['a', 'c', 'b']), { correct: false, positions: 1 });
  const lengths = [2, 2, 3, 3, 4, 4];
  assert.equal(shouldStopSpan(lengths, respond([true, false, false])), false);
  assert.equal(shouldStopSpan(lengths, respond([true, false, false, false])), true);
  assert.equal(maxSpanFrom(lengths, respond([true, false, true, false])), 3);
  assert.equal(shouldDiscontinue(respond([true, false, false, false, false]), 4), true);
  assert.equal(shouldDiscontinue(respond([false, false, true, false]), 4), false);
});

test('Arabic age formatting agrees with the number', () => {
  assert.equal(formatAge(72), '6 سنوات');
  assert.equal(formatAge(75), '6 سنوات و3 أشهر');
  assert.equal(formatAge(61), '5 سنوات وشهر');
  assert.equal(formatAge(95), '7 سنوات و11 شهرًا');
});

test('training plan targets the weakest skills in developmental order', () => {
  const profile = profileFor({ ...AT_MEAN_6Y, letterSound: 20, auditoryDiscrimination: 30, phonological: 25 }, 78);
  const plan = buildTrainingPlan(profile);
  assert.equal(plan.preventive, false);
  assert.equal(plan.focus.length, 3);
  assert.equal(plan.focus[0], 'discrimination');
  const preventive = buildTrainingPlan(profileFor(AT_MEAN_6Y, 78));
  assert.equal(preventive.preventive, true);
});

test('every training skill and level generates valid, varied items', () => {
  for (const skill of Object.keys(SKILLS) as SkillId[]) {
    for (const level of [1, 2, 3] as Level[]) {
      for (const seed of [1, 7, 42]) {
        const tasks = generateSession(skill, level, seed);
        assert.ok(tasks.length >= 5, `${skill} L${level} produced ${tasks.length}`);
        for (const task of tasks) {
          if (task.kind === 'span') {
            assert.ok(task.trial.sequence.every((id) => task.trial.choices.includes(id)));
            continue;
          }
          const ids = task.item.options.map((o) => o.id);
          assert.equal(new Set(ids).size, ids.length, `${skill} L${level} duplicate options`);
          assert.ok(ids.includes(task.item.correctId), `${skill} L${level} missing answer`);
          if (task.item.tag === 'rhyme') {
            const target = Object.values(LEXICON).find((e) => e.word === task.item.stimulus?.label)!;
            for (const o of task.item.options) {
              assert.equal(lex(o.id).rhyme === target.rhyme, o.id === task.item.correctId);
            }
          }
          if (task.item.tag === 'onset' || task.item.tag === 'coda') {
            const key = task.item.tag === 'onset' ? 'onset' : 'coda';
            const target = Object.values(LEXICON).find((e) => e.word === task.item.stimulus?.label)!;
            for (const o of task.item.options) {
              assert.equal(lex(o.id)[key] === target[key], o.id === task.item.correctId, `${skill} L${level} ${o.id}`);
            }
          }
        }
      }
    }
  }
});

test('training items never reuse a scored battery item verbatim', () => {
  const batteryPrompts = new Set(
    BATTERY.flatMap((s) => (s.kind === 'choice' ? s.items : [])).map(
      (i) => `${i.stimulus?.value ?? ''}|${i.options.map((o) => o.id).join(',')}`
    )
  );
  let collisions = 0;
  let total = 0;
  for (const skill of ['rhyme', 'soundPosition', 'visualDiscrimination'] as SkillId[]) {
    for (let seed = 0; seed < 20; seed += 1) {
      for (const t of generateSession(skill, 2, seed)) {
        if (t.kind !== 'choice') continue;
        total += 1;
        if (batteryPrompts.has(`${t.item.stimulus?.value ?? ''}|${t.item.options.map((o) => o.id).join(',')}`)) collisions += 1;
      }
    }
  }
  assert.ok(collisions / total < 0.02, `collisions ${collisions}/${total}`);
});

test('mastery: two sessions at ≥80% move up a level; two below 50% step back and flag support', () => {
  const plan = { createdAt: new Date().toISOString(), preventive: false, focus: ['rhyme'] as SkillId[], rationaleAr: [] };
  let progress = createProgress(plan);
  progress = applySession(progress, 'rhyme', 7, 8).progress;
  const up = applySession(progress, 'rhyme', 8, 8);
  assert.equal(up.change, 'up');
  assert.equal(up.progress.levels.rhyme, 2);

  let p2 = up.progress;
  p2 = applySession(p2, 'rhyme', 3, 8).progress;
  const down = applySession(p2, 'rhyme', 2, 8);
  assert.equal(down.change, 'down');
  assert.equal(down.progress.levels.rhyme, 1);
  assert.ok(down.progress.supportFlags.includes('rhyme'));
});

test('report language describes indicators and never claims a diagnosis or cure', () => {
  const text = JSON.stringify([SUBTEST_GUIDANCE, RISK_META, PATTERN_META, SKILLS]);
  assert.doesNotMatch(text, /تشخيص مؤكد|يشخّص عسر|يعالج عسر|يشفي|مصاب بعسر/);
});

describe('audio catalogue', () => {
  it('covers every text that unseen training sessions speak', async () => {
    const { buildAudioCatalog, audioKey } = await import('./audioCatalog');
    const { generateSession, SKILLS } = await import('./training');
    const { lex } = await import('./lexicon');
    const keys = new Set(buildAudioCatalog().map((e) => e.key));
    const missing = new Set<string>();
    for (const skill of Object.keys(SKILLS) as Array<keyof typeof SKILLS>) {
      for (const level of [1, 2, 3] as const) {
        for (let seed = 90_000; seed < 90_150; seed++) {
          for (const task of generateSession(skill, level, seed)) {
            const texts = task.kind === 'choice'
              ? task.item.audio.map((s) => s.text)
              : [...task.trial.sequence, ...task.trial.choices].map((id) => lex(id).word);
            for (const t of texts) if (!keys.has(audioKey(t))) missing.add(t);
          }
        }
      }
    }
    assert.deepEqual([...missing], []);
  });

  it('keys are stable and ignore spacing and Unicode composition differences', async () => {
    const { audioKey } = await import('./audioCatalog');
    assert.equal(audioKey('مَا الكَلِمَةُ؟'), audioKey('  مَا   الكَلِمَةُ؟ '));
    assert.match(audioKey('بَ'), /^[0-9a-f]{16}$/);
    assert.notEqual(audioKey('تِين'), audioKey('طِين'));
  });
});
