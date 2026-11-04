import React, { useState } from 'react';
import { CheckCircle2, FileText, Printer, Sparkles } from 'lucide-react';
import type { StudentRecord } from '../../data/seedData';
import { SUBTESTS_BY_ID } from '../../cognitiveProfile/battery';
import { PROGRAM_SESSIONS, SKILLS, SUBTEST_TO_SKILLS, masteryEstimate, sessionsCompleted, type SkillId, type TrainingProgress } from '../../cognitiveProfile/training';
import { summarizeProbes } from '../../cognitiveProfile/progressProbe';
import {
  ACTIVITY_CATALOG,
  FREQUENCIES,
  buildPlanFacts,
  referralFor,
  rulesDraft,
  validateDraftPlan,
  type DraftPlan,
  type IndividualPlanRecord,
  type PlanFacts,
} from '../../cognitiveProfile/individualPlan';
import { authenticatedFetch } from '../../utils/apiAuth';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/** Facts for the plan, from the child's stored results only. */
export function planFactsFromRecord(student: StudentRecord, progress: TrainingProgress | null): PlanFacts {
  const summary = student.cognitiveBattery?.summary ?? null;
  const weak = (summary?.subtests ?? [])
    .filter((s) => s.band === 'severe' || s.band === 'below')
    .map((s) => ({ skill: (SUBTEST_TO_SKILLS[s.subtestId]?.[0] ?? s.subtestId) as string, labelAr: SUBTESTS_BY_ID[s.subtestId].skillNameAr, centile: s.centile }));
  const strong = (summary?.subtests ?? []).filter((s) => s.band === 'strength').map((s) => ({ labelAr: SUBTESTS_BY_ID[s.subtestId].skillNameAr, centile: s.centile }));
  const probe = progress ? summarizeProbes(progress.probes ?? []) : null;
  return buildPlanFacts({
    ageYears: student.ageYears,
    screening: summary ? { risk: summary.risk, completedGames: summary.completedSubtests, weak, strong } : null,
    programme: progress
      ? {
          sessionsDone: sessionsCompleted(progress),
          sessionsPlanned: PROGRAM_SESSIONS,
          skills: progress.plan.focus.map((skill: SkillId) => ({ skill, level: masteryEstimate(progress, skill).level, p: masteryEstimate(progress, skill).p })),
          probe: probe ? { baseline: probe.baseline, latest: probe.latest, sessions: probe.count, reliable: probe.reliable } : null,
        }
      : null,
    reading: progress?.targets ? { soundPairs: progress.targets.soundPairs, letters: progress.targets.letters } : null,
  });
}

interface Props {
  student: StudentRecord;
  progress: TrainingProgress | null;
  /** A school account that can write this record may approve (the server records who approved). */
  canApprove: boolean;
  onRecordUpdated?: (student: StudentRecord) => void;
}

export function IndividualPlanPanel({ student, progress, canApprove, onRecordUpdated }: Props) {
  const [record, setRecord] = useState<IndividualPlanRecord | null>(student.individualPlan ?? null);
  const [note, setNote] = useState<{ text: string; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<DraftPlan | null>(null);
  const [error, setError] = useState('');

  const generate = async () => {
    setBusy(true);
    setError('');
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
      next = {
        status: 'draft',
        source: data.source,
        plan: data.plan,
        referralAr: data.referralAr ?? null,
        facts: data.facts,
        generatedAt: data.generatedAt,
        agent: data.agent ? { model: String(data.agent.model), trace: Array.isArray(data.agent.trace) ? data.agent.trace : [] } : null,
      };
      setNote(
        data.noteAr
          ? { text: data.noteAr, errors: data.validationErrors ?? [] }
          : data.cached
            ? { text: 'لم تتغير بيانات الطفل منذ آخر مسودة؛ أُعيدت المسودة نفسها دون استدعاء جديد للنموذج.', errors: [] }
            : null
      );
    } catch {
      // No server (e.g. static hosting) or no access: the same rules-based draft, built here.
      next = { status: 'draft', source: 'rules', plan: rulesDraft(facts), referralAr: referralFor(facts), facts, generatedAt: new Date().toISOString() };
      setNote({ text: 'خدمة النموذج اللغوي غير متاحة الآن؛ هذه مسودة مبنية على قواعد ثابتة من بيانات الطفل.', errors: [] });
    }
    setRecord(next);
    setBusy(false);
    if (!student.isDemoRecord) onRecordUpdated?.({ ...student, individualPlan: next });
  };

  const approve = async () => {
    if (!record) return;
    const plan = editing ?? record.plan;
    const checked = validateDraftPlan(plan, record.facts);
    if (!checked.ok) {
      setError(`لا يمكن الاعتماد: ${checked.errors.join('، ')}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await authenticatedFetch(`/api/students/${encodeURIComponent(student.id)}/individual-plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, facts: record.facts, source: record.source, generatedAt: record.generatedAt, editedByReviewer: editing !== null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.student) throw new Error(data?.error || 'تعذر الاعتماد.');
      setRecord(data.student.individualPlan);
      setEditing(null);
      onRecordUpdated?.(data.student);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الاعتماد.');
    } finally {
      setBusy(false);
    }
  };

  const shown = editing ?? record?.plan ?? null;

  return (
    <section className="bz-card p-6 space-y-4 print-report-root" aria-labelledby={`plan-${student.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`plan-${student.id}`} className="bz-h3 flex items-center gap-2"><FileText size={20} aria-hidden="true" /> الخطة التعليمية الفردية</h2>
          {record && (
            <p className="bz-small mt-1">
              {record.status === 'approved' ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 size={15} /> معتمدة من {record.approvedBy} في {new Date(record.approvedAt!).toLocaleDateString('ar-EG')}
                  {record.editedByReviewer ? ' (بعد تعديله)' : ''}
                </span>
              ) : (
                <span className="font-semibold text-warn">مسودة — لا تُعتمد إلا بعد مراجعة معلم أو أخصائي</span>
              )}
              <span className="block text-ink-2">
                {record.source === 'model' ? 'كتبها وكيل ذكي (نموذج لغوي) من بيانات الطفل فقط: حلّل البيانات، وكتب، وتحقق بأداة آلية، وصحّح أخطاءه (لا أرقام من خارج البيانات، ولا لغة تشخيصية).' : 'مبنية على قواعد ثابتة من بيانات الطفل.'}
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" className="bz-btn bz-btn-primary bz-btn-sm" disabled={busy} onClick={generate}>
            <Sparkles size={15} /> {record ? 'مسودة جديدة' : 'اقترح خطة فردية'}
          </button>
          {record && (
            <button type="button" className="bz-btn bz-btn-ghost bz-btn-sm" onClick={() => window.print()}>
              <Printer size={15} /> طباعة
            </button>
          )}
        </div>
      </div>

      {note && (
        <div className="rounded-xl bg-soft p-3 text-xs text-ink-2">
          <p>{note.text}</p>
          {note.errors.length > 0 && (
            <details className="mt-1">
              <summary>لماذا رُفضت مسودة النموذج؟</summary>
              <ul className="list-disc pr-5">{note.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </details>
          )}
        </div>
      )}

      {record?.agent && record.agent.trace.length > 0 && (
        <details className="rounded-xl border border-line p-3 text-xs text-ink-2">
          <summary className="cursor-pointer font-semibold text-ink">خطوات الوكيل الذكي ({record.agent.model})</summary>
          <ol className="mt-2 space-y-1 list-decimal pr-5">
            {record.agent.trace.map((t, i) => (
              <li key={i}>
                <span className={t.ok ? 'text-emerald-700' : 'text-warn'}>{t.ok ? '✓' : '✗'}</span>{' '}
                {{ analysis: 'تحليل', draft: 'كتابة', verify: 'تحقق', revise: 'تصحيح' }[t.step] ?? t.step}: {t.noteAr}
              </li>
            ))}
          </ol>
          <p className="mt-1">
            الكلمات المعالجة (للتكلفة): {ar(record.agent.trace.reduce((n, t) => n + (t.inputTokens ?? 0) + (t.outputTokens ?? 0), 0))} وحدة.
          </p>
        </details>
      )}

      {!record && <p className="bz-small text-ink-2">تُكتب الخطة من نتيجة الفحص وتقدّم البرنامج وتحليل القراءة الجهرية، ثم يراجعها المعلم أو الأخصائي ويعتمدها.</p>}

      {shown && record && (
        <div className="space-y-4 text-sm text-ink">
          {editing ? (
            <textarea className="w-full rounded-xl border border-line p-3" rows={3} value={editing.summaryAr} onChange={(e) => setEditing({ ...editing, summaryAr: e.target.value })} aria-label="ملخص الخطة" />
          ) : (
            <p className="leading-relaxed">{ar(shown.summaryAr)}</p>
          )}
          <div>
            <h3 className="font-semibold">الأهداف</h3>
            <ol className="mt-2 space-y-2 list-decimal pr-5">
              {shown.goals.map((g, i) => (
                <li key={i}>
                  {editing ? (
                    <textarea
                      className="w-full rounded-lg border border-line p-2"
                      rows={2}
                      value={g.goalAr}
                      aria-label={`الهدف ${ar(i + 1)}`}
                      onChange={(e) => setEditing({ ...editing, goals: editing.goals.map((x, j) => (j === i ? { ...x, goalAr: e.target.value } : x)) })}
                    />
                  ) : (
                    <span className="font-semibold">{ar(g.goalAr)}</span>
                  )}
                  <span className="block text-xs text-ink-2">
                    {SKILLS[g.skill as SkillId]?.nameAr ?? g.skill} · الدليل: {ar(g.evidenceAr)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="font-semibold">الأنشطة</h3>
            <ul className="mt-2 space-y-1.5">
              {shown.activities.map((a) => (
                <li key={a.id} className="rounded-lg bg-soft px-3 py-2">
                  <span className="font-semibold">{ACTIVITY_CATALOG[a.id]}</span> · {FREQUENCIES[a.frequency]}
                  <span className="block text-xs text-ink-2">{ar(a.whyAr)}</span>
                </li>
              ))}
            </ul>
          </div>
          {shown.homeTipsAr.length > 0 && (
            <div>
              <h3 className="font-semibold">نصائح للبيت</h3>
              <ul className="mt-1 list-disc pr-5 space-y-1">{shown.homeTipsAr.map((t) => <li key={t}>{ar(t)}</li>)}</ul>
            </div>
          )}
          {record.referralAr && <p className="rounded-xl border border-warn bg-warn-soft p-3 font-semibold text-warn">{record.referralAr}</p>}
          <p className="text-xs text-ink-2">هذه خطة تعليمية مبنية على نتائج فحص مبدئي وتدريب، وليست تشخيصًا.</p>
        </div>
      )}

      {canApprove && record && record.status === 'draft' && (
        <div className="flex flex-wrap gap-2 print:hidden">
          {!editing && <button type="button" className="bz-btn bz-btn-secondary bz-btn-sm" onClick={() => setEditing(record.plan)}>تعديل قبل الاعتماد</button>}
          <button type="button" className="bz-btn bz-btn-primary bz-btn-sm" disabled={busy} onClick={approve}>
            <CheckCircle2 size={15} /> اعتماد الخطة
          </button>
        </div>
      )}
      {!canApprove && record?.status === 'draft' && (
        <p className="text-xs text-ink-2">اطبع المسودة واعرضها على معلم الطفل أو أخصائي؛ الاعتماد يكون من حساب المدرسة.</p>
      )}
      {error && <p role="alert" className="text-sm text-warn">{error}</p>}
    </section>
  );
}

export default IndividualPlanPanel;
