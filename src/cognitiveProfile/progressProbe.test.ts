import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROBE_ITEMS_PER_SKILL,
  PROBE_LEVEL,
  RELIABLE_TREND_PROBES,
  buildProbe,
  comparisonSkillFor,
  describeProgressAr,
  scoreProbe,
  summarizeProbes,
  type ProbeRecord,
} from './progressProbe';
import { PROGRAM_SESSIONS, SESSIONS_PER_WEEK, MINUTES_PER_SESSION, applySession, createProgress, type TrainingPlan } from './training';
import { TrainingProgressUploadSchema } from './records';

const plan: TrainingPlan = { createdAt: new Date().toISOString(), preventive: false, focus: ['blending', 'letterSound'], rationaleAr: [] };

const record = (session: number, pct: number, comparisonPct?: number): ProbeRecord => ({
  date: new Date(Date.UTC(2026, 0, session)).toISOString(),
  session,
  correct: pct / 10,
  total: 10,
  bySkill: { blending: { correct: pct / 10, total: 10 } },
  ...(comparisonPct === undefined ? {} : { comparison: { skill: 'discrimination' as const, correct: comparisonPct / 10, total: 10 } }),
});

describe('programme dose (Ehri et al., 2001: largest effects at 5 to 18 hours)', () => {
  it('20 sessions of training plus probe stay within 5 to 18 hours in total', () => {
    const hours = (PROGRAM_SESSIONS * (MINUTES_PER_SESSION + 3)) / 60;
    assert.ok(hours >= 5 && hours <= 18, `${hours} hours`);
    assert.equal(PROGRAM_SESSIONS / SESSIONS_PER_WEEK, 4);
  });
});

describe('daily progress probe', () => {
  it('measures every focus skill and one untrained comparison skill, at one fixed level', () => {
    const items = buildProbe(plan, 'stu-1', 1);
    const comparison = comparisonSkillFor(plan);
    assert.equal(comparison, 'discrimination');
    assert.equal(items.filter((i) => i.role === 'trained').length, plan.focus.length * PROBE_ITEMS_PER_SKILL);
    assert.equal(items.filter((i) => i.role === 'comparison' && i.skill === comparison).length, PROBE_ITEMS_PER_SKILL);
    assert.equal(PROBE_LEVEL, 2);
  });

  it('gives the same form for the same session, a different form for the next, and unique item ids', () => {
    const ids = (s: number) => buildProbe(plan, 'stu-1', s).map((i) => (i.task.kind === 'choice' ? i.task.item.audio.map((a) => a.text).join('|') : i.task.trial.id));
    assert.deepEqual(ids(3), ids(3));
    assert.notDeepEqual(ids(3), ids(4));
    const itemIds = buildProbe(plan, 'stu-1', 3).map((i) => (i.task.kind === 'choice' ? i.task.item.id : i.task.trial.id));
    assert.equal(new Set(itemIds).size, itemIds.length);
  });

  it('scores trained skills and the comparison skill separately', () => {
    const items = buildProbe(plan, 'stu-1', 1);
    const answers = items.map((i) => i.role === 'trained');
    const r = scoreProbe(items, answers, 1);
    assert.equal(r.correct, r.total);
    assert.equal(r.comparison?.correct, 0);
    assert.equal(r.comparison?.total, PROBE_ITEMS_PER_SKILL);
  });

  it('a probe record passes the server schema, and progress keeps probes when a session is applied', () => {
    const items = buildProbe(plan, 'stu-1', 1);
    const probe = scoreProbe(items, items.map(() => true), 1);
    const progress = { ...createProgress(plan), probes: [probe] };
    const { progress: next } = applySession(progress, 'blending', 6, 8);
    assert.equal(next.probes?.length, 1);
    assert.equal(TrainingProgressUploadSchema.safeParse(next).success, true);
  });

  it('reports change as last three minus first three, and the trend as reliable only after enough sessions', () => {
    const probes = [20, 30, 40, 50, 60, 70].map((p, i) => record(i + 1, p, 30));
    const s = summarizeProbes(probes)!;
    assert.equal(s.baseline, 20);
    assert.equal(s.latest, 70);
    assert.equal(s.change, 30);
    assert.equal(s.slopePerSession, 10);
    assert.equal(s.comparisonChange, 0);
    assert.equal(s.reliable, probes.length >= RELIABLE_TREND_PROBES);
    assert.equal(summarizeProbes(probes.slice(0, 2))!.reliable, false);
  });

  it('describes progress without overclaiming', () => {
    assert.match(describeProgressAr(null), /يبدأ قياس التقدّم/);
    assert.match(describeProgressAr(summarizeProbes([record(1, 40)])), /نتيجة البداية/);
    assert.match(describeProgressAr(summarizeProbes([record(1, 40), record(2, 50)])), /يصبح الاتجاه موثوقًا/);
    const text = describeProgressAr(summarizeProbes([20, 30, 40, 50, 60, 70].map((p, i) => record(i + 1, p, 30))));
    assert.match(text, /تحسّن بمقدار ٣٠ نقطة/);
    assert.match(text, /لم تتغير/);
  });
});

describe('daily progress probe audio', () => {
  it('every phrase a probe can speak has a pre-recorded clip', async () => {
    const { buildAudioCatalog, audioKey, normalizeSpokenText } = await import('./audioCatalog');
    const { lex } = await import('./lexicon');
    const { FOCUS_SKILLS } = await import('./training');
    const keys = new Set(buildAudioCatalog().map((e) => e.key));
    const missing = new Set<string>();
    for (const skill of FOCUS_SKILLS) {
      for (let session = 1; session <= 60; session++) {
        for (const { task } of buildProbe({ focus: [skill] }, `stu-${session % 7}`, session)) {
          const texts = task.kind === 'choice' ? task.item.audio.map((a) => a.text) : [...task.trial.sequence, ...task.trial.choices].map((id) => lex(id).word);
          for (const raw of texts) if (!keys.has(audioKey(normalizeSpokenText(raw)))) missing.add(raw);
        }
      }
    }
    assert.deepEqual([...missing], []);
  });
});
