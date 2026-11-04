import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickBestModel, runPlanAgent, type AgentMessage, type Generate } from './planAgent';
import { buildPlanFacts } from './individualPlan';

const facts = buildPlanFacts({
  ageYears: 6,
  screening: { completedGames: 9, results: [{ skill: 'rhyme', labelAr: 'الوعي بالقافية', correct: 7, total: 10, percent: 70 }] },
  programme: { sessionsDone: 7, sessionsPlanned: 20, skills: [{ skill: 'rhyme', level: 2 }], probe: null },
  reading: null,
});

const plan = (summaryAr: string) =>
  JSON.stringify({
    summaryAr,
    goals: [{ skill: 'rhyme', goalAr: 'يميّز الكلمات المتشابهة في آخرها.', evidenceAr: 'سُجّلت ٧ إجابات صحيحة من ١٠ داخل المهمة.' }],
    activities: [{ id: 'home-rhyme', whyAr: 'يقوّي القافية في البيت.', frequency: 'most-days' }],
    homeTipsAr: ['جلسات قصيرة ومنتظمة.'],
  });

/** A scripted model: answers in order, and records what it was told. */
function scripted(answers: string[]): { generate: Generate; seen: AgentMessage[][] } {
  const seen: AgentMessage[][] = [];
  let i = 0;
  return {
    seen,
    generate: async (messages) => {
      seen.push(messages.map((m) => ({ ...m })));
      return { text: answers[Math.min(i++, answers.length - 1)], inputTokens: 100, outputTokens: 50 };
    },
  };
}

describe('individual-plan agent', () => {
  it('analyses, drafts, verifies, and corrects its own mistake from the validator feedback', async () => {
    const model = scripted([
      JSON.stringify({ priorities: [{ skill: 'rhyme', reasonAr: 'أضعف مهارة في الفحص.' }, { skill: 'mathematics', reasonAr: 'مهارة غير موجودة.' }] }),
      plan('سيتحسن الطفل بنسبة ٣٠٪ خلال أسبوعين.'),
      plan('أكمل الطفل ٧ جلسات من ٢٠، وتركّز الخطة على القافية.'),
    ]);
    const r = await runPlanAgent(facts, model.generate);
    assert.ok(r.plan, 'the corrected draft is accepted');
    assert.deepEqual(r.priorities.map((p) => p.skill), ['rhyme'], 'priorities outside the data are dropped');
    assert.deepEqual(r.trace.map((t) => `${t.step}:${t.ok}`), ['analysis:true', 'draft:true', 'verify:false', 'revise:true', 'verify:true']);
    const feedback = model.seen[2].at(-1)!.text;
    assert.match(feedback, /رقم غير موجود في البيانات: 30/, 'the model is told exactly what was wrong');
  });

  it('gives up after the allowed revisions and reports why (the caller then uses the rules draft)', async () => {
    const model = scripted([JSON.stringify({ priorities: [{ skill: 'rhyme', reasonAr: 'أضعف مهارة.' }] }), plan('الطفل مصاب بعسر القراءة.')]);
    const r = await runPlanAgent(facts, model.generate, { maxRevisions: 2 });
    assert.equal(r.plan, null);
    assert.ok(r.errors.some((e) => /تشخيصية/.test(e)));
    assert.equal(r.trace.filter((t) => t.step === 'revise').length, 2);
  });

  it('chooses the strongest available model: newest Pro, stable before preview, never Lite or special variants', () => {
    assert.equal(
      pickBestModel(['models/gemini-2.5-pro', 'models/gemini-3.1-pro-preview', 'models/gemini-3.5-flash', 'models/gemini-3.1-flash-lite', 'models/gemini-2.5-flash-preview-tts']),
      'gemini-3.1-pro-preview'
    );
    assert.equal(pickBestModel(['gemini-3.1-pro', 'gemini-3.1-pro-preview']), 'gemini-3.1-pro');
    assert.equal(pickBestModel(['gemini-3.5-flash', 'gemini-3.1-flash-lite']), 'gemini-3.5-flash');
    assert.equal(pickBestModel(['text-embedding-004']), null);
  });
});
