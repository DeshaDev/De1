/**
 * Daily progress probe: a short, fixed-difficulty check at the start of every training session.
 *
 * Why: the training score of a session cannot show progress, because the level changes as the
 * child improves. Progress monitoring uses equivalent short forms at one fixed difficulty, given
 * repeatedly, and judges growth by the trend across sessions (curriculum-based measurement;
 * Deno, 1985; Fuchs & Fuchs). Each probe here is a new set of items generated at level 2 for the
 * plan's focus skills, with no feedback, so scores are comparable from session to session.
 *
 * Trained skills are compared with one skill the plan does not train (multiple baseline across
 * skills, a single-case design accepted as evidence by the What Works Clearinghouse). If the trained
 * skills rise and the comparison skill does not, the gain is more likely the training than
 * familiarity with the task format.
 *
 * Honest limits: a single session's score is noisy, so the trend is shown as reliable only after
 * RELIABLE_TREND_PROBES sessions. Probe forms are generated, not yet calibrated on children for
 * equal difficulty; that calibration is part of the child pilot (docs/VALIDATION_PLAN_AR.md).
 */
import { FOCUS_SKILLS, SKILLS, generateSession, type Level, type SkillId, type TrainingPlan, type TrainingTask } from './training';

export const PROBE_LEVEL: Level = 2;
export const PROBE_ITEMS_PER_SKILL = 4;
export const PROBE_MINUTES = 3;
/** Fewer points than this give a trend too noisy to report as reliable. */
export const RELIABLE_TREND_PROBES = 5;

export interface ProbeScore {
  correct: number;
  total: number;
}

export interface ProbeRecord {
  date: string;
  /** 1 for the first probe of the programme (the baseline). */
  session: number;
  /** Trained (focus) skills only. */
  correct: number;
  total: number;
  bySkill: Partial<Record<SkillId, ProbeScore>>;
  /** The untrained comparison skill, when the plan has one. */
  comparison?: { skill: SkillId } & ProbeScore;
}

export interface ProbeItem {
  skill: SkillId;
  role: 'trained' | 'comparison';
  task: TrainingTask;
}

/** Developmental order of the trainable skills, used to pick the comparison skill deterministically. */
const COMPARISON_ORDER: SkillId[] = ['discrimination', 'rhyme', 'soundPosition', 'blending', 'letterSound', 'visualDiscrimination'];

/** A trainable skill outside the plan, measured but never trained, or null if the plan trains all of them. */
export function comparisonSkillFor(plan: Pick<TrainingPlan, 'focus'>): SkillId | null {
  return COMPARISON_ORDER.find((s) => FOCUS_SKILLS.includes(s) && !plan.focus.includes(s)) ?? null;
}

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * The probe for one session. Seeds depend on the child and the session number, so the same
 * session always gets the same form and two sessions never share a seed.
 */
export function buildProbe(plan: Pick<TrainingPlan, 'focus'>, studentId: string, session: number): ProbeItem[] {
  const items: ProbeItem[] = [];
  const comparison = comparisonSkillFor(plan);
  const skills: Array<{ skill: SkillId; role: ProbeItem['role'] }> = [
    ...plan.focus.map((skill) => ({ skill, role: 'trained' as const })),
    ...(comparison ? [{ skill: comparison, role: 'comparison' as const }] : []),
  ];
  skills.forEach(({ skill, role }, i) => {
    const seed = hash(`probe|${studentId}|${session}|${skill}|${i}`);
    for (const task of generateSession(skill, PROBE_LEVEL, seed).slice(0, PROBE_ITEMS_PER_SKILL)) {
      const tagged: TrainingTask =
        task.kind === 'choice'
          ? { ...task, item: { ...task.item, id: `probe-${session}-${skill}-${task.item.id}` } }
          : { ...task, trial: { ...task.trial, id: `probe-${session}-${skill}-${task.trial.id}` } };
      items.push({ skill, role, task: tagged });
    }
  });
  return items;
}

/** Turn the answers of one probe into a record. `answers[i]` is the result of `items[i]`. */
export function scoreProbe(items: ProbeItem[], answers: boolean[], session: number, now = new Date()): ProbeRecord {
  const bySkill: Partial<Record<SkillId, ProbeScore>> = {};
  let comparison: ProbeRecord['comparison'];
  items.forEach((item, i) => {
    const ok = answers[i] === true;
    if (item.role === 'comparison') {
      comparison = comparison ?? { skill: item.skill, correct: 0, total: 0 };
      comparison.total += 1;
      if (ok) comparison.correct += 1;
      return;
    }
    const s = (bySkill[item.skill] = bySkill[item.skill] ?? { correct: 0, total: 0 });
    s.total += 1;
    if (ok) s.correct += 1;
  });
  const trained = Object.values(bySkill) as ProbeScore[];
  return {
    date: now.toISOString(),
    session,
    correct: trained.reduce((n, s) => n + s.correct, 0),
    total: trained.reduce((n, s) => n + s.total, 0),
    bySkill,
    ...(comparison ? { comparison } : {}),
  };
}

export const probePercent = (s: ProbeScore) => (s.total === 0 ? 0 : Math.round((s.correct / s.total) * 100));

/** Least-squares slope of y over x (percentage points per session). */
function slope(points: Array<[number, number]>): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const mx = points.reduce((a, [x]) => a + x, 0) / n;
  const my = points.reduce((a, [, y]) => a + y, 0) / n;
  const sxx = points.reduce((a, [x]) => a + (x - mx) ** 2, 0);
  if (sxx === 0) return 0;
  return points.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0) / sxx;
}

const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);

export interface ProbeSummary {
  count: number;
  baseline: number;
  latest: number;
  /** Mean of the last three probes minus the mean of the first three (percentage points). */
  change: number;
  /** Trend in percentage points per session. */
  slopePerSession: number;
  comparisonSkill: SkillId | null;
  comparisonChange: number | null;
  reliable: boolean;
  bySkill: Array<{ skill: SkillId; baseline: number; latest: number; change: number }>;
}

export function summarizeProbes(probes: ProbeRecord[]): ProbeSummary | null {
  if (probes.length === 0) return null;
  const sorted = [...probes].sort((a, b) => a.session - b.session);
  const pct = sorted.map((p) => probePercent(p));
  const head = pct.slice(0, 3);
  const tail = pct.slice(-3);
  const comparisons = sorted.filter((p) => p.comparison).map((p) => probePercent(p.comparison!));
  const skills = Array.from(new Set(sorted.flatMap((p) => Object.keys(p.bySkill) as SkillId[])));
  return {
    count: sorted.length,
    baseline: pct[0],
    latest: pct[pct.length - 1],
    change: Math.round(mean(tail) - mean(head)),
    slopePerSession: Math.round(slope(sorted.map((p, i) => [p.session, pct[i]])) * 10) / 10,
    comparisonSkill: sorted.find((p) => p.comparison)?.comparison?.skill ?? null,
    comparisonChange: comparisons.length >= 2 ? Math.round(mean(comparisons.slice(-3)) - mean(comparisons.slice(0, 3))) : null,
    reliable: sorted.length >= RELIABLE_TREND_PROBES,
    bySkill: skills.map((skill) => {
      const series = sorted.filter((p) => p.bySkill[skill]).map((p) => probePercent(p.bySkill[skill]!));
      return {
        skill,
        baseline: series[0],
        latest: series[series.length - 1],
        change: Math.round(mean(series.slice(-3)) - mean(series.slice(0, 3))),
      };
    }),
  };
}

const arDigits = (v: number) => String(Math.abs(v)).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
/** Arabic counted noun: ١ نقطة، ٢ نقطتان، ٣–١٠ نقاط، ١١+ نقطة. */
function counted(n: number, one: string, two: string, plural: string): string {
  const v = Math.abs(n);
  if (v === 1) return `${one} واحدة`;
  if (v === 2) return two;
  return `${arDigits(v)} ${v >= 3 && v <= 10 ? plural : one}`;
}
const points = (n: number) => counted(n, 'نقطة', 'نقطتين', 'نقاط');
const sessions = (n: number) => counted(n, 'جلسة', 'جلستين', 'جلسات');

/** One plain sentence for parents and teachers. Never claims more than the data shows. */
export function describeProgressAr(summary: ProbeSummary | null): string {
  if (!summary) return 'يبدأ قياس التقدّم مع أول جلسة: مقياس قصير ثابت الصعوبة في بداية كل جلسة.';
  if (summary.count === 1) return `نتيجة البداية: ${arDigits(summary.baseline)}٪. تظهر المقارنة من الجلسة الثانية.`;
  if (!summary.reliable) {
    return `من ${arDigits(summary.baseline)}٪ في البداية إلى ${arDigits(summary.latest)}٪ في آخر جلسة. النتائج تتذبذب من يوم لآخر، ويصبح الاتجاه موثوقًا بعد ${sessions(RELIABLE_TREND_PROBES)}.`;
  }
  const direction =
    summary.change > 0 ? `تحسّن بمقدار ${points(summary.change)}` : summary.change < 0 ? `انخفاض بمقدار ${points(summary.change)}` : 'ثبات';
  let comparison = '';
  if (summary.comparisonSkill && summary.comparisonChange !== null) {
    const c = summary.comparisonChange;
    const how = c > 0 ? `ارتفعت ${points(c)}` : c < 0 ? `انخفضت ${points(c)}` : 'لم تتغير';
    comparison = ` للمقارنة: مهارة «${SKILLS[summary.comparisonSkill].nameAr}» التي لا يتدرّب عليها الطفل ${how}.`;
  }
  return `${direction} في المهارات المدرَّبة بين أول ثلاث جلسات وآخر ثلاث (${sessions(summary.count)} مقيسة).${comparison}`;
}
