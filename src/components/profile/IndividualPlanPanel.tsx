import React, { useState } from 'react';
import { FileText, Printer, Sparkles } from 'lucide-react';
import type { StudentRecord } from '../../data/seedData';
import { SUBTESTS_BY_ID } from '../../cognitiveProfile/battery';
import { PROGRAM_SESSIONS, SKILLS, SUBTEST_TO_SKILLS, masteryEstimate, sessionsCompleted, type SkillId, type TrainingProgress } from '../../cognitiveProfile/training';
import { summarizeProbes } from '../../cognitiveProfile/progressProbe';
import {
  ACTIVITY_CATALOG,
  FREQUENCIES,
  buildPlanFacts,
  rulesDraft,
  validateDraftPlan,
  type IndividualPlanRecord,
  type PlanFacts,
} from '../../cognitiveProfile/individualPlan';
import { authenticatedFetch } from '../../utils/apiAuth';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/** Build AI-plan inputs from task-level results, never provisional centiles or risk bands. */
export function planFactsFromRecord(student: StudentRecord, progress: TrainingProgress | null): PlanFacts {
  const summary = student.cognitiveBattery?.summary ?? null;
  const results = (summary?.subtests ?? []).map((scored) => ({
    skill: (SUBTEST_TO_SKILLS[scored.subtestId]?.[0] ?? scored.subtestId) as string,
    labelAr: SUBTESTS_BY_ID[scored.subtestId].skillNameAr,
    correct: scored.correct,
    total: scored.total,
    percent: scored.percent,
  }));
  const probe = progress ? summarizeProbes(progress.probes ?? []) : null;
  return buildPlanFacts({
    ageYears: student.ageYears,
    screening: summary ? { completedGames: summary.completedSubtests, results } : null,
    programme: progress
      ? {
          sessionsDone: sessionsCompleted(progress),
          sessionsPlanned: PROGRAM_SESSIONS,
          skills: progress.plan.focus.map((skill: SkillId) => ({ skill, level: masteryEstimate(progress, skill).level })),
          probe: probe ? { baseline: probe.baseline, latest: probe.latest, sessions: probe.count, reliable: probe.reliable } : null,
        }
      : null,
    reading: progress?.targets ? { soundPairs: progress.targets.soundPairs, letters: progress.targets.letters } : null,
  });
}

interface Props {
  student: StudentRecord;
  progress: TrainingProgress | null;
  onRecordUpdated?: (student: StudentRecord) => void;
}

export function IndividualPlanPanel({ student, progress, onRecordUpdated }: Props) {
  const [record, setRecord] = useState<IndividualPlanRecord | null>(student.individualPlan ?? null);
  const [note, setNote] = useState<{ text: string; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    const facts = planFactsFromRecord(student, progress);
    let next: IndividualPlanRecord;
    try {
      const res = await authenticatedFetch('/api/ai/individual-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const checked = validateDraftPlan(data.plan, data.facts);
      if (!checked.ok || !checked.plan) throw new Error('تعذر التحقق من مخرجات الاقتراح الآلي.');
      next = {
        status: 'draft',
        source: data.source === 'model' ? 'model' : 'rules',
        plan: checked.plan,
        referralAr: null,
        facts: data.facts,
        generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : new Date().toISOString(),
        agent: data.agent ? { model: String(data.agent.model), trace: Array.isArray(data.agent.trace) ? data.agent.trace : [] } : null,
      };
      setNote(
        data.noteAr
          ? { text: data.noteAr, errors: Array.isArray(data.validationErrors) ? data.validationErrors : [] }
          : data.cached
            ? { text: 'لم تتغير بيانات الطفل منذ آخر اقتراح؛ أُعيد الاقتراح نفسه دون استدعاء جديد للنموذج.', errors: [] }
            : null
      );
    } catch {
      next = { status: 'draft', source: 'rules', plan: rulesDraft(facts), referralAr: null, facts, generatedAt: new Date().toISOString() };
      setNote({ text: 'خدمة النموذج اللغوي غير متاحة أو لم تجتز المخرجات الفحص الآلي؛ عُرض اقتراح مبني على قواعد ثابتة من نتائج المهام.', errors: [] });
    } finally {
      setBusy(false);
    }
    setRecord(next);
    if (!student.isDemoRecord) onRecordUpdated?.({ ...student, individualPlan: next });
  };

  const shown = record?.plan ?? null;

  return (
    <section className="bz-card p-6 space-y-4 print-report-root" aria-labelledby={`plan-${student.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`plan-${student.id}`} className="bz-h3 flex items-center gap-2"><FileText size={20} aria-hidden="true" /> اقتراحات الممارسة التعليمية</h2>
          {record && (
            <p className="bz-small mt-1">
              {record.status === 'approved' ? (
                <span className="font-semibold text-ink-2">اقتراح محفوظ من إصدار سابق</span>
              ) : (
                <span className="font-semibold text-brand">اقتراح مولّد آليًا · لا يتطلب اعتمادًا يدويًا</span>
              )}
              <span className="block text-ink-2">
                {record.source === 'model'
                  ? 'صاغه نموذج لغوي من ملخصات أداء محدودة، ثم اجتاز تحققًا آليًا من البنية والأرقام واللغة. قد يخطئ النموذج.'
                  : 'اقتراح مبني على قواعد ثابتة من نتائج المهام المتاحة.'}
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" className="bz-btn bz-btn-primary bz-btn-sm" disabled={busy} onClick={generate}>
            <Sparkles size={15} /> {record ? 'إنشاء اقتراح جديد' : 'اقترح أنشطة للممارسة'}
          </button>
          {record && (
            <button type="button" className="bz-btn bz-btn-ghost bz-btn-sm" onClick={() => window.print()}>
              <Printer size={15} /> طباعة
            </button>
          )}
        </div>
      </div>

      {busy && <p role="status" className="bz-small text-ink-2">يجري إعداد الاقتراح والتحقق من مخرجاته…</p>}

      {note && (
        <div className="rounded-xl bg-soft p-3 text-xs text-ink-2">
          <p>{note.text}</p>
          {note.errors.length > 0 && (
            <details className="mt-1">
              <summary>تفاصيل التحقق الآلي</summary>
              <ul className="list-disc pr-5">{note.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </details>
          )}
        </div>
      )}

      {record?.agent && record.agent.trace.length > 0 && (
        <details className="rounded-xl border border-line p-3 text-xs text-ink-2">
          <summary className="cursor-pointer font-semibold text-ink">خطوات التوليد والتحقق ({record.agent.model})</summary>
          <ol className="mt-2 space-y-1 list-decimal pr-5">
            {record.agent.trace.map((t, i) => (
              <li key={i}>
                <span className={t.ok ? 'text-emerald-700' : 'text-warn'}>{t.ok ? '✓' : '✗'}</span>{' '}
                {{ analysis: 'تحليل', draft: 'صياغة', verify: 'تحقق', revise: 'تصحيح' }[t.step] ?? t.step}: {t.noteAr}
              </li>
            ))}
          </ol>
          <p className="mt-1">
            وحدات المعالجة التقديرية للتكلفة: {ar(record.agent.trace.reduce((n, t) => n + (t.inputTokens ?? 0) + (t.outputTokens ?? 0), 0))}.
          </p>
        </details>
      )}

      {!record && (
        <p className="bz-small text-ink-2">
          تُنشأ هذه الاقتراحات آليًا من نتائج المهام وبيانات الممارسة المتاحة. لا يحتاج كل طفل إلى مراجعة أو اعتماد يدوي؛ ويمكن للأسرة اختيار ما يلائم الطفل وتجاهل أي نشاط غير مناسب.
        </p>
      )}

      {shown && record && (
        <div className="space-y-4 text-sm text-ink">
          <p className="leading-relaxed">{ar(shown.summaryAr)}</p>
          <div>
            <h3 className="font-semibold">أهداف ممارسة مقترحة</h3>
            <ol className="mt-2 space-y-2 list-decimal pr-5">
              {shown.goals.map((goal, i) => (
                <li key={i}>
                  <span className="font-semibold">{ar(goal.goalAr)}</span>
                  <span className="block text-xs text-ink-2">
                    {SKILLS[goal.skill as SkillId]?.nameAr ?? goal.skill} · ملاحظة من البيانات: {ar(goal.evidenceAr)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="font-semibold">أنشطة يمكن اختيارها</h3>
            <ul className="mt-2 space-y-1.5">
              {shown.activities.map((activity) => (
                <li key={activity.id} className="rounded-lg bg-soft px-3 py-2">
                  <span className="font-semibold">{ACTIVITY_CATALOG[activity.id]}</span> · {FREQUENCIES[activity.frequency]}
                  <span className="block text-xs text-ink-2">{ar(activity.whyAr)}</span>
                </li>
              ))}
            </ul>
          </div>
          {shown.homeTipsAr.length > 0 && (
            <div>
              <h3 className="font-semibold">أفكار بسيطة للبيت</h3>
              <ul className="mt-1 list-disc pr-5 space-y-1">{shown.homeTipsAr.map((tip) => <li key={tip}>{ar(tip)}</li>)}</ul>
            </div>
          )}
          <p className="text-xs text-ink-2">
            هذه أفكار ممارسة تعليمية استرشادية وليست تشخيصًا أو وصفة علاجية. النسب والأرقام - إن ظهرت - تصف أنشطة المنصة فقط، ولا تثبت مستوى الطفل مقارنةً بأقرانه أو تحسن قراءته خارجها.
          </p>
        </div>
      )}
    </section>
  );
}

export default IndividualPlanPanel;
