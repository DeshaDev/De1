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
import { SUBTEST_GUIDANCE, RISK_META, PATTERN_META, nextStepsAr, readingMeasureLineAr } from './guidance';
import {
  SKILLS,
  SkillId,
  Level,
  applySession,
  buildTrainingPlan,
  createPersonalizedProgress,
  createProgress,
  generateItems,
  generateSession,
  masteryEstimate,
  summarizePlanSetup,
} from './training';
import { PASSAGE_WORDS, RAN_LETTER_GRID } from './readingTasks';
import { TrainingProgressUploadSchema } from './records';

const choiceItems = (id: SubtestId): ChoiceItem[] => {
  const s = SUBTESTS_BY_ID[id];
  assert.equal(s.kind, 'choice');
  return s.kind === 'choice' ? [...s.practice, ...s.items] : [];
};

test('battery: nine precursor subtests in five domains, plus six direct reading and naming measures', () => {
  assert.equal(BATTERY.length, 15);
  assert.deepEqual(BATTERY.map((s) => s.order), Array.from({ length: 15 }, (_, i) => i + 1));
  const precursor = BATTERY.filter((s) => s.domain !== 'reading' && s.domain !== 'naming');
  assert.equal(precursor.length, 9);
  assert.equal(new Set(precursor.map((s) => s.domain)).size, 5);
  for (const s of BATTERY) {
    assert.ok(scoredItemCount(s) >= 8, `${s.id} needs enough scored items for a stable score`);
    assert.ok(SUBTEST_GUIDANCE[s.id].strategiesAr.length >= 3, `${s.id} needs teaching strategies`);
  }
  assert.equal(REFERENCE_TABLE.status, 'disabled');
  assert.equal(Object.keys(REFERENCE_TABLE.rows).length, 0);
  for (const s of precursor) assert.ok(SUBTEST_GUIDANCE[s.id].strategiesAr.length >= 4, `${s.id} needs teaching strategies`);
  for (const s of BATTERY.filter((t) => t.domain === 'reading' || t.domain === 'naming')) {
    assert.equal(REFERENCE_TABLE.rows[s.id], undefined, s.id);
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

const AT_MEAN_6Y = {} as Record<SubtestId, number>;

test('profile reports raw task results without age norms or risk classifications', () => {
  const profile = profileFor({ rhyme: 75, phonological: 60, letterSound: 45 }, 78);
  assert.equal(profile.referenceStatus, 'disabled');
  assert.equal(profile.subtests.length, 3);
  for (const s of profile.subtests) {
    assert.equal(s.centile, null);
    assert.equal(s.band, null);
    assert.equal(s.z, null);
  }
  assert.deepEqual(profile.domains, []);
  assert.equal(profile.risk, 'insufficient');
  assert.equal(profile.pattern, 'none');
  assert.deepEqual(profile.strengths, []);
  assert.deepEqual(profile.weaknesses, []);
  assert.equal(profile.coreWeakCount, 0);
  assert.equal(profile.coreSevereCount, 0);
});

test('the same raw score remains descriptive at every age until Arabic norms exist', () => {
  const young = scoreSubtest(resultWithPercent('letterSound', 50), 54);
  const older = scoreSubtest(resultWithPercent('letterSound', 50), 90);
  assert.equal(young.percent, older.percent);
  assert.equal(young.correct, older.correct);
  assert.equal(young.centile, null);
  assert.equal(older.centile, null);
  assert.equal(young.band, null);
  assert.equal(older.band, null);
});

test('oral reading scores stay unavailable until a verified automated assessment exists', () => {
  const words = scoreSubtest(resultWithPercent('wordReading', 80), 78);
  const passage = scoreSubtest(resultWithPercent('oralReading', 80), 78);
  assert.equal(words.scoreAvailable, false);
  assert.equal(words.total, 0);
  assert.equal(words.centile, null);
  assert.equal(passage.scoreAvailable, false);
  assert.equal(passage.total, 0);
  assert.equal(readingMeasureLineAr('wordReading', words), 'لا تتوفر نتيجة صوتية آلية صالحة لهذه المهمة؛ لم تُحتسب الدقة أو الأخطاء.');
});

test('letter knowledge is reported without age-based risk classification', () => {
  const profile = profileFor({ letterSound: 0 }, 52);
  const letterScore = profile.subtests.find((s) => s.subtestId === 'letterSound');
  assert.ok(letterScore);
  assert.equal(letterScore!.percent, 0);
  assert.equal(letterScore!.band, null);
  assert.equal(profile.risk, 'insufficient');
  assert.deepEqual(profile.weaknesses, []);
});

test('missing tasks are identified without generating a risk classification', () => {
  const profile = profileFor({ visualSequential: 50, visualAssociative: 60, rhyme: 70 }, 78);
  assert.equal(profile.risk, 'insufficient');
  assert.equal(profile.referenceStatus, 'disabled');
  assert.equal(profile.missing.length, 12);
  assert.equal(profileFor({ visualSequential: 50, visualAssociative: 60, rhyme: 70 }, 54).missing.length, 7);
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

test('training selects distinct personalized focus skills, start levels, priors, and session doses without age norms', () => {
  const profileA = profileFor({ auditoryDiscrimination: 20, rhyme: 63, letterSound: 95 }, 78);
  const planA = buildTrainingPlan(profileA);
  assert.equal(planA.preventive, false);
  assert.deepEqual(planA.focus, ['discrimination', 'rhyme']);
  const progressA = createPersonalizedProgress(planA, profileA);
  const setupA = summarizePlanSetup(planA, profileA);
  assert.equal(progressA.levels.discrimination, 1, 'severe subtest starts at foundational level 1');
  assert.equal(progressA.levels.rhyme, 2, 'borderline subtest starts at intermediate level 2');
  assert.ok(masteryEstimate(progressA, 'discrimination').p < masteryEstimate(progressA, 'rhyme').p);
  assert.ok((setupA.discrimination?.sessionItems ?? 0) > (setupA.rhyme?.sessionItems ?? 0));
  assert.equal(TrainingProgressUploadSchema.safeParse(progressA).success, true);

  const profileB = profileFor({ auditoryDiscrimination: 95, rhyme: 95, phonological: 25, letterSound: 70 }, 78);
  const planB = buildTrainingPlan(profileB);
  assert.equal(planB.preventive, false);
  assert.deepEqual(planB.focus, ['soundPosition', 'blending', 'letterSound']);
  const progressB = createPersonalizedProgress(planB, profileB);
  assert.equal(progressB.levels.soundPosition, 1);
  assert.equal(progressB.levels.letterSound, 2);
  assert.equal(TrainingProgressUploadSchema.safeParse(progressB).success, true);

  // Relative within-child dip (e.g. 78% against 100% tasks) surfaces without claiming a clinical 75% boundary.
  const dipProfile = profileFor({ auditoryDiscrimination: 78, rhyme: 100, letterSound: 100 }, 78);
  const dipPlan = buildTrainingPlan(dipProfile);
  assert.equal(dipPlan.preventive, false);
  assert.deepEqual(dipPlan.focus, ['discrimination']);

  // Uniformly high accuracy tasks or memory-only weakness keep the preventive baseline plan.
  const highScores = profileFor({ auditoryDiscrimination: 90, rhyme: 90, letterSound: 90 }, 78);
  const preventivePlan = buildTrainingPlan(highScores);
  assert.equal(preventivePlan.preventive, true);
  assert.deepEqual(preventivePlan.focus, ['blending', 'letterSound']);
});

test('oral reading confusions scale severity by error frequency, and slow RAN stays descriptive without uncalibrated prescriptions', () => {
  const receipt = 'b'.repeat(64);
  const makeOral = (indicesToSubstitute: number[]) =>
    PASSAGE_WORDS.map((word, index) => {
      if (indicesToSubstitute.includes(index)) {
        return { word, errorType: 'Substitution' as const, accuracyScore: 40, spokenWord: word.replace('س', 'ص') };
      }
      return { word, errorType: 'None' as const, accuracyScore: 95, spokenWord: word };
    });

  const sIdx = PASSAGE_WORDS.map((w, i) => (w.includes('س') ? i : -1)).filter((i) => i >= 0);
  // 1) 1 isolated slip out of 37 words (97%) must NOT force targeted therapy over a single slip.
  const slipWords = makeOral(sIdx.slice(0, 1));
  const slipProfile = buildProfile({
    oralReading: {
      subtestId: 'oralReading',
      responses: [],
      discontinued: false,
      completedAt: '2026-10-28T10:00:00.000Z',
      durationMs: 42_000,
      audioAssessmentReceipt: receipt,
      audioAssessment: {
        taskId: 'oralReading',
        sourceModel: 'azure_pronunciation_assessment',
        assessmentComplete: true,
        assessmentReceipt: receipt,
        transcript: slipWords.map((w) => w.spokenWord).join(' '),
        durationSeconds: 42,
        wordAccuracyPercent: 97,
        wordsCorrectPerMinute: 51,
        wordsPerMinute: 53,
        correctWordsCount: slipWords.length - 1,
        substitutionsCount: 1,
        omissionsCount: 0,
        insertionsCount: 0,
        words: slipWords,
      },
    },
  }, 84);
  assert.equal(slipProfile.readingTargets?.errorCounts?.discrimination, 1);
  assert.equal(buildTrainingPlan(slipProfile).preventive, true, 'single minor slip stays preventive');

  // 2) Moderate repeated س/ص errors (3 confusions, 92% accuracy) vs high errors (6 confusions + lower accuracy)
  const modWords = PASSAGE_WORDS.map((word) => {
    if (word.includes('سَمَكَةً') || word.includes('سَاخِنًا') || word.includes('سَعِيدًا')) {
      return { word, errorType: 'Substitution' as const, accuracyScore: 40, spokenWord: word.replace('س', 'ص') };
    }
    return { word, errorType: 'None' as const, accuracyScore: 95, spokenWord: word };
  });
  const modProfile = buildProfile({
    oralReading: {
      subtestId: 'oralReading',
      responses: [],
      discontinued: false,
      completedAt: '2026-10-28T10:00:00.000Z',
      durationMs: 42_000,
      audioAssessmentReceipt: receipt,
      audioAssessment: {
        taskId: 'oralReading',
        sourceModel: 'azure_pronunciation_assessment',
        assessmentComplete: true,
        assessmentReceipt: receipt,
        transcript: modWords.map((w) => w.spokenWord).join(' '),
        durationSeconds: 42,
        wordAccuracyPercent: 92,
        wordsCorrectPerMinute: 48,
        wordsPerMinute: 53,
        correctWordsCount: modWords.length - 3,
        substitutionsCount: 3,
        omissionsCount: 0,
        insertionsCount: 0,
        words: modWords,
      },
    },
  }, 84);

  const severeWords = makeOral(sIdx.slice(0, 6)).map((w, i) =>
    i >= 25 && i < 31 ? { ...w, errorType: 'Substitution' as const, spokenWord: 'كلمة', accuracyScore: 40 } : w
  );
  const severeProfile = buildProfile({
    oralReading: {
      subtestId: 'oralReading',
      responses: [],
      discontinued: false,
      completedAt: '2026-10-28T10:00:00.000Z',
      durationMs: 48_000,
      audioAssessmentReceipt: receipt,
      audioAssessment: {
        taskId: 'oralReading',
        sourceModel: 'azure_pronunciation_assessment',
        assessmentComplete: true,
        assessmentReceipt: receipt,
        transcript: severeWords.map((w) => w.spokenWord).join(' '),
        durationSeconds: 48,
        wordAccuracyPercent: 68,
        wordsCorrectPerMinute: 31,
        wordsPerMinute: 46,
        correctWordsCount: severeWords.filter((w) => w.errorType === 'None').length,
        substitutionsCount: severeWords.filter((w) => w.errorType !== 'None').length,
        omissionsCount: 0,
        insertionsCount: 0,
        words: severeWords,
      },
    },
  }, 84);

  const modRate = modProfile.readingTargets?.skillRates?.discrimination ?? 100;
  const severeRate = severeProfile.readingTargets?.skillRates?.discrimination ?? 100;
  assert.ok(severeRate < modRate, `expected frequent errors rate (${severeRate}) < moderate (${modRate})`);

  const planMod = buildTrainingPlan(modProfile);
  const progressMod = createPersonalizedProgress(planMod, modProfile);
  assert.equal(planMod.preventive, false);
  assert.ok(planMod.focus.includes('discrimination'));
  assert.equal(progressMod.levels.discrimination, 2, 'moderate confusions start at level 2');
  assert.ok(progressMod.targets?.soundPairs.some((p) => p.includes('س') && p.includes('ص')));

  const planSevere = buildTrainingPlan(severeProfile);
  const progressSevere = createPersonalizedProgress(planSevere, severeProfile);
  assert.equal(progressSevere.levels.discrimination, 1, 'frequent errors start at foundational level 1');
  assert.ok(masteryEstimate(progressSevere, 'discrimination').p < masteryEstimate(progressMod, 'discrimination').p);
  assert.equal(TrainingProgressUploadSchema.safeParse(progressMod).success, true);
  assert.equal(TrainingProgressUploadSchema.safeParse(progressSevere).success, true);
  const items = generateItems('discrimination', progressSevere.levels.discrimination, 42, 8, progressSevere.targets);
  assert.equal(items.length, 8);

  // 3) Slow RAN rate stays descriptive in report/rationale and never imposes automatic skills before age norming.
  const ranWords = RAN_LETTER_GRID.map((word, index) => ({
    word,
    errorType: (index < 2 ? 'Substitution' : 'None') as 'Substitution' | 'None',
    accuracyScore: index < 2 ? 35 : 95,
    spokenWord: word,
  }));
  const childSlowRan = buildProfile({
    ranLetters: {
      subtestId: 'ranLetters',
      responses: [],
      discontinued: false,
      completedAt: '2026-10-28T10:00:00.000Z',
      durationMs: 75_000,
      errorCount: 2,
      audioAssessmentReceipt: receipt,
      audioAssessment: {
        taskId: 'ranLetters',
        sourceModel: 'azure_pronunciation_assessment',
        assessmentComplete: true,
        assessmentReceipt: receipt,
        transcript: ranWords.map((w) => w.word).join(' '),
        durationSeconds: 75,
        wordAccuracyPercent: 95,
        wordsCorrectPerMinute: 30,
        wordsPerMinute: 32,
        correctWordsCount: 38,
        substitutionsCount: 2,
        omissionsCount: 0,
        insertionsCount: 0,
        words: ranWords,
      },
    },
  }, 84);

  const planRan = buildTrainingPlan(childSlowRan);
  assert.equal(planRan.preventive, true, 'uncalibrated RAN speed does not trigger automatic skill prescriptions');
  assert.ok(planRan.rationaleAr.some((r) => r.includes('التسمية السريعة')));
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

test('mastery comes from knowledge tracing: steady correct answers move up a level; sustained errors step back and flag support', () => {
  const plan = { createdAt: new Date().toISOString(), preventive: false, focus: ['rhyme'] as SkillId[], rationaleAr: [] };
  let progress = createProgress(plan);
  progress = applySession(progress, 'rhyme', 8, 8).progress;
  assert.equal(progress.levels.rhyme, 2, 'eight correct answers at chance 1/3 reach P(mastery) ≥ 0.95');

  let wrong = progress;
  let change = 'stay';
  for (let i = 0; i < 8 && change !== 'down'; i++) {
    const r = applySession(wrong, 'rhyme', 0, 1);
    wrong = r.progress;
    change = r.change;
  }
  assert.equal(change, 'down');
  assert.equal(wrong.levels.rhyme, 1);
  assert.ok(wrong.supportFlags.includes('rhyme'));
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
