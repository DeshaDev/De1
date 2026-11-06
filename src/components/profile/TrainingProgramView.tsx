import { PHRASES } from '../../cognitiveProfile/phrases';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarCheck, CheckCircle2, Play, Target, AlertTriangle, RefreshCw, TrendingUp, Award, Zap, Home } from 'lucide-react';
import type { CognitiveProfile } from '../../cognitiveProfile/scoring';
import {
  Level,
  LevelChange,
  MINUTES_PER_SESSION,
  PROGRAM_SESSIONS,
  PROGRAM_WEEKS,
  SESSIONS_PER_WEEK,
  SKILLS,
  SKILL_BADGES,
  SkillId,
  TrainingPlan,
  TrainingProgress,
  TrainingTask,
  applyProbeEvidence,
  applyReadingTargets,
  awardBadge,
  buildTrainingPlan,
  chanceOf,
  createProgress,
  generateItems,
  getHomeActivity,
  isReassessmentDue,
  masteryEstimate,
  recordAnswer,
  recordSkillBlock,
  sessionsCompleted,
  skillBandsFromProfile,
} from '../../cognitiveProfile/training';
import { MASTERY_THRESHOLD, allocateItems } from '../../cognitiveProfile/knowledgeTracing';
import { loadTrainingProgress, saveTrainingProgress } from '../../cognitiveProfile/storage';
import { syncTrainingToSchool } from '../../cognitiveProfile/sync';
import { trackUsage } from '../../utils/usageTracking';
import { GUEST_CHILD_NAME, type StudentRecord } from '../../data/seedData';
import { ChoicePlayer, SpanPlayer } from './TaskPlayers';
import { speak } from './audio';
import {
  PROBE_MINUTES,
  buildProbe,
  comparisonSkillFor,
  describeProgressAr,
  probePercent,
  scoreProbe,
  summarizeProbes,
  type ProbeItem,
  type ProbeRecord,
} from '../../cognitiveProfile/progressProbe';
import ProgressChart from './ProgressChart';
import { takePendingReadingTargets } from '../ReadingErrorPanel';
import IndividualPlanPanel from './IndividualPlanPanel';
import { LessonPlayer, TeachingChoicePlayer } from './TeachingPlayers';
import { GUIDED_BELOW, GUIDED_ITEMS, lessonFor, probeDueAt, scaffold, type Lesson } from '../../cognitiveProfile/curriculum';

const toArabicDigits = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

const CHANGE_TEXT: Record<LevelChange, string> = {
  up: 'أتقن المستوى! انتقل إلى المستوى التالي 🎉',
  mastered: 'أتقن المهارة بكل مستوياتها 🏆',
  down: 'سنعود خطوة إلى مستوى أسهل لتثبيت المهارة.',
  stay: 'نستمر في المستوى نفسه حتى الإتقان.',
};
const pct = (p: number) => toArabicDigits(Math.round(p * 100));

/** P(mastered) from the knowledge-tracing model, as a labelled bar. */
function MasteryBar({ p, label }: { p: number; label: string }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-ink-2">
        <span>{label}</span>
        <strong className="text-ink">{pct(p)}٪</strong>
      </div>
      <div className="relative h-2 rounded-full bg-soft mt-1 overflow-hidden" role="img" aria-label={`${label}: ${pct(p)}٪`}>
        <span className="absolute inset-y-0 right-0 rounded-full bg-brand" style={{ width: `${Math.round(p * 100)}%` }} />
        <span className="absolute inset-y-0 w-px bg-ink" style={{ right: `${MASTERY_THRESHOLD * 100}%` }} aria-hidden="true" />
      </div>
    </div>
  );
}

function LevelLadder({ skill, level, mastered }: { skill: SkillId; level: Level; mastered: boolean }) {
  return (
    <ol className="flex flex-col gap-1.5 mt-3">
      {([1, 2, 3] as Level[]).map((l) => {
        const done = mastered || l < level;
        const current = !mastered && l === level;
        return (
          <li
            key={l}
            className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 ${
              current ? 'bg-emerald-50 text-emerald-900 font-black border border-emerald-200' : done ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${done ? 'bg-brand text-on-brand' : current ? 'bg-card border-2 border-brand text-brand' : 'bg-slate-100'}`}>
              {done ? '✓' : toArabicDigits(l)}
            </span>
            {SKILLS[skill].levels[l]}
          </li>
        );
      })}
    </ol>
  );
}

type Run = {
  skills: SkillId[];
  skillIndex: number;
  tasks: TrainingTask[];
  taskIndex: number;
  correct: number;
  phase: 'probeIntro' | 'probe' | 'lesson' | 'intro' | 'task' | 'result' | 'summary';
  /** The lesson for the current skill level ("I do"), when the child has not had it yet. */
  lesson: Lesson | null;
  /** How many items at the start of the block are guided (hint + one fewer option). */
  guided: number;
  /** First-try correct answers this session. */
  stars: number;
  change: LevelChange | null;
  results: Array<{
    skill: SkillId;
    correct: number;
    total: number;
    change: LevelChange;
    pBefore: number;
    pAfter: number;
    avgRtMs?: number;
    automaticCount?: number;
  }>;
  /** Practice items per skill this session, chosen from the model's mastery estimates. */
  alloc: Record<string, number>;
  /** Level and P(mastered) when the current skill block started. */
  blockStart: { level: Level; p: number } | null;
  /** Skills the probe moved up a level today. */
  promoted: SkillId[];
  /** The fixed-difficulty progress probe that opens every session. */
  probe: { items: ProbeItem[]; index: number; answers: boolean[] } | null;
  todayProbe: ProbeRecord | null;
  /** Response time latencies for current skill block. */
  latencies: number[];
  /** Count of fast automatic responses (<= 2500ms) for current skill block. */
  fastCount: number;
  /** Mastery badges awarded in today's run. */
  newBadges: SkillId[];
};

interface Props {
  studentId: string;
  childName: string;
  profile: CognitiveProfile | null;
  onBack: () => void;
  onGoToBattery: () => void;
  onRunningChange?: (running: boolean) => void;
  /** Progress stored in the school record, used when this device has none. */
  serverProgress?: TrainingProgress | null;
  /** Mirror progress to the school record (school account signed in). */
  syncEnabled?: boolean;
  onRecordUpdated?: (student: StudentRecord) => void;
  student?: StudentRecord;
  /** Show a back button (only when the user came here from the games map or the report). */
  showBack?: boolean;
  onOpenExtra?: (tab: 'remediation-gym' | 'adaptive-reader' | 'reading-lab') => void;
}

export function TrainingProgramView({ studentId, childName, profile, onBack, onGoToBattery, onRunningChange, serverProgress = null, syncEnabled = false, onRecordUpdated, student, showBack = true, onOpenExtra }: Props) {
  const [progress, setProgress] = useState<TrainingProgress | null>(() => loadTrainingProgress(studentId) ?? serverProgress);
  const [run, setRun] = useState<Run | null>(null);
  useEffect(() => {
    onRunningChange?.(run !== null);
  }, [run !== null, onRunningChange]);
  const seed = useRef(Date.now());

  const proposedPlan: TrainingPlan | null = useMemo(() => (profile ? buildTrainingPlan(profile) : null), [profile]);

  /** Keep each answer on this device; the record and the school/family database are updated per block. */
  const persistLocal = (p: TrainingProgress) => {
    setProgress(p);
    saveTrainingProgress(studentId, p);
  };

  const persist = (p: TrainingProgress) => {
    setProgress(p);
    saveTrainingProgress(studentId, p);
    if (syncEnabled) {
      syncTrainingToSchool(studentId, p, student)
        .then((student) => student && onRecordUpdated?.(student))
        .catch(() => {
          // Progress is kept on this device; the next session retries the sync.
        });
    } else if (student && !student.isDemoRecord) {
      // Family accounts: the record (with its progress) is saved to the family's database by the app.
      onRecordUpdated?.({ ...student, trainingProgress: { ...p, updatedAt: new Date().toISOString() } });
    }
  };

  const startProgram = (plan: TrainingPlan) => {
    trackUsage('training_started');
    const created = createProgress(plan, 1, skillBandsFromProfile(profile));
    // Exercises saved from an oral reading before the programme existed are added now.
    const pending = takePendingReadingTargets(studentId);
    persist(pending ? applyReadingTargets(created, pending).progress : created);
  };

  const activeSkills = progress ? progress.plan.focus.filter((s) => !progress.mastered.includes(s)) : [];
  const todaySkills = activeSkills.length > 0 ? activeSkills : progress?.plan.focus ?? [];
  const sessionSkills = run?.skills ?? todaySkills;

  /**
   * A session: the progress measure when it is due (first session, then weekly, and the last),
   * then for each skill a lesson when new, guided practice, and independent practice.
   */
  const beginSession = () => {
    if (!progress) return;
    const today = new Date().toISOString().slice(0, 10);
    const trainedToday = progress.history.some((h) => h.date.slice(0, 10) === today);
    const sessionNumber = sessionsCompleted(progress) + (trainedToday ? 0 : 1);
    const probedToday = (progress.probes ?? []).some((p) => p.date.slice(0, 10) === today);
    const session = (progress.probes?.length ?? 0) + 1;
    if (!probeDueAt(sessionNumber, PROGRAM_SESSIONS) || probedToday) {
      const alloc = allocateItems(todaySkills.map((skill) => ({ skill, p: masteryEstimate(progress, skill).p })));
      beginSkill(0, {
        skills: todaySkills, skillIndex: 0, tasks: [], taskIndex: 0, correct: 0, phase: 'intro', change: null, results: [],
        probe: null, todayProbe: null, alloc, blockStart: null, promoted: [], lesson: null, guided: 0, stars: 0,
        latencies: [], fastCount: 0, newBadges: [],
      });
      return;
    }
    setRun({
      skills: todaySkills,
      skillIndex: 0,
      tasks: [],
      taskIndex: 0,
      correct: 0,
      phase: 'probeIntro',
      change: null,
      results: [],
      probe: { items: buildProbe(progress.plan, studentId, session), index: 0, answers: [] },
      todayProbe: null,
      alloc: {},
      blockStart: null,
      promoted: [],
      lesson: null,
      guided: 0,
      stars: 0,
      latencies: [],
      fastCount: 0,
      newBadges: [],
    });
  };

  const onProbeItemDone = (correct: boolean) => {
    if (!run?.probe || !progress) return;
    const answers = [...run.probe.answers, correct];
    if (run.probe.index + 1 < run.probe.items.length) {
      setRun({ ...run, probe: { ...run.probe, index: run.probe.index + 1, answers } });
      return;
    }
    const session = (progress.probes?.length ?? 0) + 1;
    const record = scoreProbe(run.probe.items, answers, session);
    // The probe also feeds the knowledge-tracing model (evidence only, no learning).
    const evidence = run.probe.items
      .map((item, i) => ({ skill: item.skill, correct: answers[i] === true, guess: chanceOf(item.task), trained: item.role === 'trained' }))
      .filter((a) => a.trained);
    const { progress: traced, promoted } = applyProbeEvidence(progress, evidence);
    const next = { ...traced, probes: [...(progress.probes ?? []), record] };
    persist(next);
    // Practice time goes where the model is least sure the child has mastered the skill.
    const alloc = allocateItems(todaySkills.map((skill) => ({ skill, p: masteryEstimate(next, skill).p })));
    beginSkill(0, { ...run, probe: null, todayProbe: record, alloc, promoted }, next);
  };

  const beginSkill = (skillIndex: number, prev: Run | null, current: TrainingProgress | null = progress) => {
    if (!current) return;
    const skills = prev?.skills ?? todaySkills;
    const skill = skills[skillIndex];
    const estimate = masteryEstimate(current, skill);
    seed.current += 7919;
    const lesson = (current.lessonsSeen ?? []).includes(`${skill}:${estimate.level}`) ? null : lessonFor(skill, estimate.level, current.targets);
    const guided = lesson || estimate.p < GUIDED_BELOW ? GUIDED_ITEMS : 0;
    const raw = generateItems(skill, estimate.level, seed.current, prev?.alloc[skill] ?? 8, current.targets);
    // "We do": the first items come with a hint and one fewer option.
    const tasks = raw.map((t, i) => (i < guided && t.kind === 'choice' ? { ...t, item: scaffold(t.item, i) } : t));
    setRun({
      skills,
      skillIndex,
      tasks,
      taskIndex: 0,
      correct: 0,
      phase: lesson ? 'lesson' : 'intro',
      lesson,
      guided,
      stars: prev?.stars ?? 0,
      change: null,
      results: prev?.results ?? [],
      probe: null,
      todayProbe: prev?.todayProbe ?? null,
      alloc: prev?.alloc ?? {},
      blockStart: estimate,
      promoted: prev?.promoted ?? [],
      latencies: [],
      fastCount: 0,
      newBadges: prev?.newBadges ?? [],
    });
  };

  /** Every answer updates the knowledge-tracing model; the level can change in the middle of a block. */
  const onTaskDone = (correct: boolean, rtMs?: number) => {
    if (!run || !progress) return;
    const skill = sessionSkills[run.skillIndex];
    const task = run.tasks[run.taskIndex];
    const isFast = correct && typeof rtMs === 'number' && rtMs > 0 && rtMs <= 2500;
    const nextLatencies = typeof rtMs === 'number' && rtMs > 0 ? [...run.latencies, rtMs] : run.latencies;
    const nextFastCount = run.fastCount + (isFast ? 1 : 0);

    const { progress: updated, change } = recordAnswer(progress, skill, correct, chanceOf(task));
    const nextCorrect = run.correct + (correct ? 1 : 0);
    const blockChange: LevelChange =
      change === 'mastered' || run.change === 'mastered' ? 'mastered' : change === 'up' || run.change === 'up' ? 'up' : change === 'down' || run.change === 'down' ? 'down' : 'stay';
    let tasks = run.tasks;
    if ((change === 'up' || change === 'down') && run.taskIndex + 1 < run.tasks.length) {
      // The model moved the child to another level: the rest of the block is generated at that level.
      seed.current += 7919;
      const remaining = run.tasks.length - run.taskIndex - 1;
      tasks = [...run.tasks.slice(0, run.taskIndex + 1), ...generateItems(skill, (updated.levels[skill] ?? 1) as Level, seed.current, remaining, updated.targets)];
    }
    // Moving up ends the block: the next block starts with the lesson for the new level.
    const finishedSkill = change === 'mastered' || change === 'up';
    let traced = updated;
    if (change === 'down') {
      // Stepping back means the easier level must be taught again.
      const lower = `${skill}:${updated.levels[skill] ?? 1}`;
      traced = { ...updated, lessonsSeen: (updated.lessonsSeen ?? []).filter((k) => k !== lower) };
    }

    // Award badge if skill was mastered
    let nextBadges = run.newBadges;
    if (change === 'mastered' || updated.mastered.includes(skill)) {
      const { progress: badgedProgress, newlyAwarded } = awardBadge(traced, skill);
      traced = badgedProgress;
      if (newlyAwarded && !nextBadges.includes(skill)) {
        nextBadges = [...nextBadges, skill];
      }
    }

    const stars = run.stars + (correct ? 1 : 0);
    if (run.taskIndex + 1 < tasks.length && !finishedSkill) {
      persistLocal(traced);
      setRun({
        ...run,
        tasks,
        taskIndex: run.taskIndex + 1,
        correct: nextCorrect,
        stars,
        change: blockChange === 'stay' ? run.change : blockChange,
        latencies: nextLatencies,
        fastCount: nextFastCount,
        newBadges: nextBadges,
      });
      return;
    }
    const answered = run.taskIndex + 1;
    const logged = recordSkillBlock(traced, skill, run.blockStart?.level ?? ((progress.levels[skill] ?? 1) as Level), nextCorrect, answered);
    persist(logged);
    if (change === 'up' || change === 'mastered') speak(PHRASES.levelUp);
    const pAfter = masteryEstimate(logged, skill).p;
    const avgRtMs = nextLatencies.length > 0 ? Math.round(nextLatencies.reduce((a, b) => a + b, 0) / nextLatencies.length) : undefined;
    setRun({
      ...run,
      tasks: tasks.slice(0, answered),
      correct: nextCorrect,
      stars,
      phase: 'result',
      change: blockChange,
      latencies: [],
      fastCount: 0,
      newBadges: nextBadges,
      results: [
        ...run.results,
        {
          skill,
          correct: nextCorrect,
          total: answered,
          change: blockChange,
          pBefore: run.blockStart?.p ?? 0,
          pAfter,
          avgRtMs,
          automaticCount: nextFastCount,
        },
      ],
    });
  };

  // ---------------------------------------------------------------- running a session
  if (run && progress && run.probe) {
    const { items, index } = run.probe;
    const item = items[index];
    return (
      <div className="bz-card overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }} dir="rtl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-soft">
          <p className="font-child font-black text-slate-900 flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">📏</span> مقياس التقدّم الأسبوعي
          </p>
          <p className="text-xs font-bold text-slate-500">
            {toArabicDigits(index + 1)} من {toArabicDigits(items.length)}
          </p>
        </div>
        {run.phase === 'probe' && (
          <div className="px-6 pt-4">
            <div className="bz-progress"><span style={{ width: `${(index / items.length) * 100}%` }} /></div>
          </div>
        )}
        <div className="p-5 sm:p-10 min-h-[460px] flex flex-col items-center justify-center">
          {run.phase === 'probeIntro' && (
            <div className="flex flex-col items-center text-center gap-4 max-w-md">
              <span className="grid place-items-center w-32 h-32 rounded-[36px] bg-sun-soft text-7xl" aria-hidden="true">📏</span>
              <h2 className="font-child text-2xl font-black text-slate-900">مقياس الأسبوع، ثم وقت التعلّم</h2>
              <p className="text-sm text-slate-600">
                أسئلة قصيرة (نحو {toArabicDigits(PROBE_MINUTES)} دقائق) بالصعوبة نفسها في أول جلسة ثم مرة كل أسبوع، بلا تصحيح، لنقيس تقدّم {childName === GUEST_CHILD_NAME ? 'الطفل' : childName}. بعدها يبدأ التعلّم بالدروس والتمارين.
              </p>
              <button type="button" onClick={() => setRun({ ...run, phase: 'probe' })} className="font-child bz-btn bz-btn-sun bz-btn-lg text-xl px-10">
                <Play className="w-6 h-6" /> ابدأ
              </button>
            </div>
          )}
          {run.phase === 'probe' && item.task.kind === 'choice' && (
            <ChoicePlayer key={item.task.item.id} item={item.task.item} showFeedback={false} onDone={(r) => onProbeItemDone(r.correct)} />
          )}
          {run.phase === 'probe' && item.task.kind === 'span' && (
            <SpanPlayer key={item.task.trial.id} trial={item.task.trial} modality={item.task.modality} showFeedback={false} onDone={(r) => onProbeItemDone(r.correct)} />
          )}
        </div>
      </div>
    );
  }

  if (run && progress) {
    const skill = sessionSkills[run.skillIndex];
    const def = SKILLS[skill];
    const task = run.tasks[run.taskIndex];
    return (
      <div className="bz-card overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }} dir="rtl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-soft">
          <p className="font-child font-black text-slate-900 flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">{def.icon}</span> وقت التعلّم: {def.nameAr}
            <span className="text-xs font-bold text-slate-500">· المستوى {toArabicDigits(progress.levels[skill] ?? 1)}</span>
          </p>
          <p className="text-xs font-bold text-slate-500 flex items-center gap-3">
            <span aria-label={`نجوم الجلسة: ${toArabicDigits(run.stars)}`}>⭐ {toArabicDigits(run.stars)}</span>
            <span>المهارة {toArabicDigits(run.skillIndex + 1)} من {toArabicDigits(sessionSkills.length)}</span>
          </p>
        </div>
        {run.phase === 'task' && (
          <div className="px-6 pt-4">
            <div className="bz-progress"><span style={{ width: `${(run.taskIndex / run.tasks.length) * 100}%` }} /></div>
          </div>
        )}
        <div className="p-5 sm:p-10 min-h-[460px] flex flex-col items-center justify-center">
          {run.phase === 'lesson' && run.lesson && (
            <LessonPlayer
              lesson={run.lesson}
              onDone={() => {
                const key = run.lesson!.key;
                persistLocal({ ...progress, lessonsSeen: Array.from(new Set([...(progress.lessonsSeen ?? []), key])).slice(-30) });
                setRun({ ...run, phase: 'task' });
              }}
            />
          )}
          {run.phase === 'intro' && (
            <div className="flex flex-col items-center text-center gap-4 max-w-md">
              <span className="grid place-items-center w-32 h-32 rounded-[36px] bg-sun-soft text-7xl" aria-hidden="true">{def.icon}</span>
              <h2 className="font-child text-2xl font-black text-slate-900">{def.nameAr}</h2>
              <p className="text-sm text-slate-600">{SKILLS[skill].levels[(progress.levels[skill] ?? 1) as Level]}</p>
              <button
                type="button"
                onClick={() => setRun({ ...run, phase: 'task' })}
                className="font-child bz-btn bz-btn-sun bz-btn-lg text-xl px-10"
              >
                <Play className="w-6 h-6" /> ابدأ
              </button>
              {lessonFor(skill, (progress.levels[skill] ?? 1) as Level, progress.targets) && (
                <button
                  type="button"
                  className="bz-btn bz-btn-ghost bz-btn-sm"
                  onClick={() => setRun({ ...run, phase: 'lesson', lesson: lessonFor(skill, (progress.levels[skill] ?? 1) as Level, progress.targets) })}
                >
                  شاهد الدرس مرة أخرى
                </button>
              )}
            </div>
          )}
          {run.phase === 'task' && task.kind === 'choice' && (
            <TeachingChoicePlayer key={task.item.id} item={task.item} guided={run.taskIndex < run.guided} onDone={(correct, rtMs) => onTaskDone(correct, rtMs)} />
          )}
          {run.phase === 'task' && task.kind === 'span' && (
            <SpanPlayer key={task.trial.id + run.taskIndex} trial={task.trial} modality={task.modality} showFeedback onDone={(r) => onTaskDone(r.correct, r.rtMs)} />
          )}
          {run.phase === 'result' && run.change && (
            <div className="flex flex-col items-center text-center gap-4">
              <span className="text-7xl" aria-hidden="true">{run.change === 'down' ? '💪' : '⭐'}</span>
              <p className="font-child text-2xl font-black text-slate-900">
                {toArabicDigits(run.correct)} من {toArabicDigits(run.tasks.length)} إجابات صحيحة
              </p>
              <p className="text-sm font-bold text-slate-600">{CHANGE_TEXT[run.change]}</p>
              {run.results.length > 0 && (
                <p className="text-xs text-ink-2 max-w-sm">
                  تقدير النموذج لإتقان المستوى الحالي: من {pct(run.results[run.results.length - 1].pBefore)}٪ إلى {pct(run.results[run.results.length - 1].pAfter)}٪
                </p>
              )}
              <button
                type="button"
                onClick={() =>
                  run.skillIndex + 1 < sessionSkills.length ? beginSkill(run.skillIndex + 1, run) : (trackUsage('training_session_completed'), setRun({ ...run, phase: 'summary' }))
                }
                className="bz-btn bz-btn-primary bz-btn-lg"
              >
                {run.skillIndex + 1 < sessionSkills.length ? 'المهارة التالية' : 'إنهاء الجلسة'}
              </button>
            </div>
          )}
          {run.phase === 'summary' && (
            <div className="flex flex-col items-center text-center gap-4 w-full max-w-md">
              <span className="text-7xl" aria-hidden="true">🏆</span>
              <p className="font-child text-2xl font-black text-slate-900">انتهت جلسة اليوم!</p>
              <p className="font-child text-xl text-ink">⭐ {toArabicDigits(run.stars)} نجمة اليوم</p>
              
              {run.newBadges.length > 0 && (
                <div className="w-full space-y-2">
                  {run.newBadges.map((badgeSkill) => {
                    const badge = SKILL_BADGES[badgeSkill];
                    return (
                      <div key={badgeSkill} className="w-full rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-center shadow-md animate-bounce">
                        <span className="text-5xl block mb-2">{badge.icon}</span>
                        <p className="font-child text-lg font-black text-amber-900">وسام إتقان جديد: {badge.titleAr}! 🏆</p>
                        <p className="text-xs text-amber-800 mt-1">{badge.descriptionAr}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {run.todayProbe && <TodayProbeCard today={run.todayProbe} probes={progress.probes ?? []} />}
              {run.promoted.length > 0 && (
                <p className="w-full rounded-xl bg-brand-tint px-4 py-2.5 text-sm text-right">
                  أظهر مقياس اليوم إتقان المستوى الثاني في: {run.promoted.map((s) => SKILLS[s].nameAr).join('، ')}، فانتقل إليه مباشرة.
                </p>
              )}

              {/* Fluency and automaticity metric */}
              {(() => {
                const totalItems = run.results.reduce((acc, r) => acc + r.total, 0);
                const totalFast = run.results.reduce((acc, r) => acc + (r.automaticCount ?? 0), 0);
                const autoPct = totalItems > 0 ? Math.round((totalFast / totalItems) * 100) : 0;
                return totalItems > 0 ? (
                  <div className="w-full rounded-2xl border border-line bg-card p-4 text-right">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm flex items-center gap-1.5 text-slate-800">
                        <Zap className="w-4 h-4 text-amber-500" /> مؤشر التلقائية والطلاقة (Automaticity)
                      </span>
                      <span className="font-black text-amber-600">{toArabicDigits(autoPct)}٪</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-slate-100 mt-2 overflow-hidden">
                      <span className="absolute inset-y-0 right-0 rounded-full bg-amber-500" style={{ width: `${autoPct}%` }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {autoPct >= 70
                        ? 'استجابات سريعة وتلقائية تدل على تمكّن وثقة ذهنية عالية ⚡'
                        : autoPct >= 40
                        ? 'دقة جيدة مع استغراق وقت للتفكير والتهجئة 🎯'
                        : 'يحتاج مزيداً من التكرار والممارسة لاكتساب السرعة والطلاقة ⏳'}
                    </p>
                  </div>
                ) : null;
              })()}

              <ul className="w-full space-y-2">
                {run.results.map((r) => (
                  <li key={r.skill} className="rounded-xl bg-soft px-4 py-2.5 text-sm text-right">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{SKILLS[r.skill].nameAr}</span>
                      <span>{toArabicDigits(r.correct)} من {toArabicDigits(r.total)}</span>
                    </div>
                    <p className="text-xs text-ink-2 mt-1">احتمال الإتقان: {pct(r.pBefore)}٪ ← {pct(r.pAfter)}٪{r.change === 'up' ? ' · انتقل مستوى' : r.change === 'mastered' ? ' · أتقن المهارة' : r.change === 'down' ? ' · عاد مستوى' : ''}</p>
                  </li>
                ))}
              </ul>

              {/* Actionable home bridge activity */}
              {(() => {
                const primarySkill = run.results[0]?.skill ?? todaySkills[0];
                if (!primarySkill) return null;
                const homeAct = getHomeActivity(primarySkill, progress.targets);
                return (
                  <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-right">
                    <p className="font-bold text-sm text-emerald-950 flex items-center gap-1.5">
                      <Home className="w-4 h-4 text-emerald-600" /> {homeAct.titleAr}
                    </p>
                    <p className="text-xs text-emerald-800 mt-1 leading-relaxed">{homeAct.activityAr}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {homeAct.exampleWords.map((w) => (
                        <span key={w} className="px-2.5 py-1 rounded-lg bg-white text-emerald-900 text-xs font-bold shadow-xs">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <button type="button" onClick={() => setRun(null)} className="bz-btn bz-btn-primary bz-btn-lg">
                العودة إلى البرنامج
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- plan proposal (no program yet)
  if (!progress) {
    const plan = proposedPlan;
    return (
      <div className="space-y-6" dir="rtl">
        {showBack && (
          <button type="button" onClick={onBack} className="bz-btn bz-btn-ghost">
            <ArrowRight className="w-4 h-4" /> العودة
          </button>
        )}
        <section className="bz-card bz-card-pad space-y-6">
          <div><p className="bz-small text-brand font-semibold">{childName === GUEST_CHILD_NAME ? childName : `الطفل: ${childName}`}</p><h2 className="bz-h3 mt-1" style={{ fontSize: 22 }}>{plan ? 'الخطة المقترحة من نتائج الفحص' : 'لم يُجرَ الفحص بعد'}</h2></div>
          {!plan ? (
            <div className="space-y-4">
              <p className="bz-body">
                يُبنى البرنامج من نتيجة فحص مؤشرات عسر القراءة: يختار المهارات الأضعف ويحدد مستوى البداية لكل منها. أكمل الفحص أولًا (ولو جزئيًا) للحصول على برنامج مخصص.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={onGoToBattery} className="bz-btn bz-btn-primary bz-btn-lg">
                  الذهاب إلى الفحص
                </button>
                <button
                  type="button"
                  onClick={() => startProgram({ createdAt: new Date().toISOString(), preventive: true, focus: ['blending', 'letterSound'], rationaleAr: ['برنامج عام للاستعداد للقراءة دون فحص مسبق.'] })}
                  className="bz-btn bz-btn-secondary bz-btn-lg"
                >
                  برنامج عام للاستعداد للقراءة
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-3 gap-4">
                {plan.focus.map((s) => (
                  <div key={s} className="rounded-2xl border border-line bg-brand-tint p-5">
                    <span className="text-4xl" aria-hidden="true">{SKILLS[s].icon}</span>
                    <p className="font-display font-semibold text-ink text-lg mt-3">{SKILLS[s].nameAr}</p>
                    <p className="bz-small text-ink-2 mt-1">{SKILLS[s].goalAr}</p>
                  </div>
                ))}
              </div>
              <ul className="bz-small text-ink-2 list-disc pr-5 space-y-1">
                {plan.rationaleAr.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <ProgramRules />
              <button type="button" onClick={() => startProgram(plan)} className="bz-btn bz-btn-primary bz-btn-lg">
                اعتماد الخطة وبدء البرنامج
              </button>
            </>
          )}
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------- program dashboard
  const done = sessionsCompleted(progress);
  const target = PROGRAM_SESSIONS;
  const probes = progress.probes ?? [];
  const summary = summarizeProbes(probes);
  const comparison = comparisonSkillFor(progress.plan);
  const due = isReassessmentDue(progress);
  const recent = [...progress.history].reverse().slice(0, 8);

  return (
    <div className="space-y-6" dir="rtl">
      {showBack && (
        <button type="button" onClick={onBack} className="bz-btn bz-btn-ghost">
          <ArrowRight className="w-4 h-4" /> العودة
        </button>
      )}

      <section className="bz-card bz-card-pad flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="bz-small text-brand font-semibold">{progress.plan.preventive ? 'برنامج وقائي' : 'برنامج علاجي-تدريبي موجّه'}</p>
          <h2 className="bz-h2 mt-1" style={{ fontSize: 'clamp(22px, 2.4vw, 30px)' }}>برنامج {childName}</h2>
          <p className="text-sm text-slate-600 mt-1">
            الجلسات المنجزة: <strong>{toArabicDigits(done)}</strong> من {toArabicDigits(target)} · {toArabicDigits(SESSIONS_PER_WEEK)} جلسات أسبوعيًا × {toArabicDigits(MINUTES_PER_SESSION + PROBE_MINUTES)} دقيقة
          </p>
          <div className="bz-progress mt-4 w-full md:w-96"><span style={{ width: `${Math.min(100, (done / target) * 100)}%` }} /></div>
        </div>
        <button
          type="button"
          onClick={beginSession}
          className="bz-btn bz-btn-primary bz-btn-lg"
        >
          <Play className="w-6 h-6" /> ابدأ جلسة اليوم
        </button>
      </section>

      {due && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-info-soft border border-line p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-info">
            <CalendarCheck className="w-5 h-5" /> حان وقت إعادة الفحص: في صفحة الفحص اضغط «فحص جديد»، فتُحفظ نتيجة الفحص الأول وتظهر المقارنة قبل وبعد في التقرير.
          </p>
          <button type="button" onClick={onGoToBattery} className="bz-btn bz-btn-primary bz-btn-sm">
            الذهاب إلى الفحص
          </button>
        </div>
      )}

      <section className="bz-card p-5 space-y-3" aria-labelledby="progress-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="progress-heading" className="font-black text-slate-900 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> التقدّم من جلسة إلى جلسة</h3>
          {summary && (
            <p className="text-sm text-ink-2">
              البداية <strong className="text-ink">{toArabicDigits(summary.baseline)}٪</strong> · آخر جلسة <strong className="text-ink">{toArabicDigits(summary.latest)}٪</strong>
            </p>
          )}
        </div>
        <p className="text-sm text-ink-2">{describeProgressAr(summary)}</p>
        {probes.length > 0 && <ProgressChart probes={probes} />}
        {probes.length === 0 && comparison && (
          <p className="text-xs text-slate-500">سيقيس المقياس أيضًا مهارة «{SKILLS[comparison].nameAr}» دون تدريب عليها، للمقارنة.</p>
        )}
      </section>

      {/* لوحة أوسمة الإتقان وجواز الإنجاز */}
      <section className="bz-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" /> لوحة أوسمة الإتقان وجواز الإنجاز
          </h3>
          <span className="text-xs font-bold text-slate-500">
            {toArabicDigits((progress.badges ?? []).length)} من {toArabicDigits(progress.plan.focus.length)} أوسمة
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          {progress.plan.focus.map((s) => {
            const badge = SKILL_BADGES[s];
            const isEarned = (progress.badges ?? []).includes(s) || progress.mastered.includes(s);
            return (
              <div
                key={s}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  isEarned
                    ? 'border-amber-300 bg-amber-50/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50/50 opacity-60'
                }`}
              >
                <span className="text-3xl shrink-0" aria-hidden="true">
                  {badge.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-child text-sm font-black text-slate-900 truncate">{badge.titleAr}</p>
                  <p className="text-[11px] font-bold text-slate-500">
                    {isEarned ? <span className="text-emerald-700">مكتسب 🏆</span> : <span>قيد التدريب ⭐</span>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {progress.targets && (progress.targets.soundPairs.length > 0 || progress.targets.letters.length > 0) && (
        <p className="rounded-2xl border border-line bg-brand-tint px-4 py-3 text-sm text-ink">
          تمارين موجّهة لأخطاء القراءة الجهرية:
          {progress.targets.soundPairs.length > 0 && <> أصوات {progress.targets.soundPairs.map((p) => p.join('/')).join('، ')}.</>}
          {progress.targets.letters.length > 0 && <> حروف {progress.targets.letters.join(' ')}.</>}
          {' '}نصف تمارين هذه المهارات تركّز عليها.
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {progress.plan.focus.map((s) => {
          const level = (progress.levels[s] ?? 1) as Level;
          const isMastered = progress.mastered.includes(s);
          const last = [...progress.history].reverse().find((h) => h.skill === s);
          return (
            <div key={s} className="bz-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-4xl" aria-hidden="true">{SKILLS[s].icon}</span>
                {isMastered && <span className="flex items-center gap-1 text-xs font-black text-emerald-700"><CheckCircle2 className="w-4 h-4" /> أُتقنت</span>}
              </div>
              <p className="font-display font-semibold text-ink text-lg mt-3">{SKILLS[s].nameAr}</p>
              <p className="bz-small text-ink-2 mt-0.5">{SKILLS[s].goalAr}</p>
              <LevelLadder skill={s} level={level} mastered={isMastered} />
              <MasteryBar p={masteryEstimate(progress, s).p} label={isMastered ? 'احتمال الإتقان (المستوى الثالث)' : `احتمال إتقان المستوى ${toArabicDigits(level)}`} />
              {last && (
                <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> آخر جلسة: {toArabicDigits(Math.round((last.correct / last.total) * 100))}٪
                </p>
              )}
              {progress.supportFlags.includes(s) && (
                <p className="mt-3 text-[13px] font-semibold text-warn bg-warn-soft rounded-lg p-2.5 flex gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> يحتاج دعمًا مباشرًا من المعلم: طبّق الاستراتيجيات المقترحة في التقرير بجانب التمرين.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {onOpenExtra && (
        <section className="bz-card-quiet p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900">أنشطة إضافية اختيارية</h3>
            <p className="text-xs text-ink-2 mt-1">بعد جلسة اليوم، لا بدلًا منها. القارئ الميسّر للطفل الذي بدأ يقرأ.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="bz-btn bz-btn-secondary bz-btn-sm" onClick={() => onOpenExtra('remediation-gym')}>ألعاب إضافية</button>
            <button type="button" className="bz-btn bz-btn-secondary bz-btn-sm" onClick={() => onOpenExtra('adaptive-reader')}>القارئ الميسّر</button>
            {(student?.ageYears ?? 0) >= 6 && (
              <button type="button" className="bz-btn bz-btn-secondary bz-btn-sm" onClick={() => onOpenExtra('reading-lab')}>قراءة جهرية مع تحليل الأخطاء</button>
            )}
          </div>
        </section>
      )}

      {student && <IndividualPlanPanel student={student} progress={progress} canApprove={syncEnabled} onRecordUpdated={onRecordUpdated} />}

      <ProgramRules />

      {recent.length > 0 && (
        <section className="bz-card p-5">
          <h3 className="font-black text-slate-900 flex items-center gap-2"><Target className="w-4 h-4" /> سجل الجلسات الأخيرة</h3>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="text-slate-500 text-xs">
                <th className="text-right p-1.5">التاريخ</th>
                <th className="text-right p-1.5">المهارة</th>
                <th className="p-1.5">المستوى</th>
                <th className="p-1.5">النتيجة</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((h, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="p-1.5">{new Date(h.date).toLocaleDateString('ar-EG')}</td>
                  <td className="p-1.5 font-bold">{SKILLS[h.skill].nameAr}</td>
                  <td className="p-1.5 text-center">{toArabicDigits(h.level)}</td>
                  <td className="p-1.5 text-center font-bold text-slate-700">
                    {toArabicDigits(h.correct)} من {toArabicDigits(h.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {proposedPlan && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm('إعادة بناء الخطة من آخر فحص؟ سيُعاد ضبط المستويات.')) startProgram(proposedPlan);
          }}
          className="bz-btn bz-btn-ghost bz-btn-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> إعادة بناء الخطة من آخر فحص
        </button>
      )}
    </div>
  );
}

function TodayProbeCard({ today, probes }: { today: ProbeRecord; probes: ProbeRecord[] }) {
  const first = [...probes].sort((a, b) => a.session - b.session)[0];
  const isFirst = !first || first.session === today.session;
  return (
    <div className="w-full rounded-2xl border border-line bg-brand-tint p-4 text-right">
      <p className="text-sm font-bold text-ink">مقياس اليوم: {toArabicDigits(probePercent(today))}٪</p>
      <p className="text-xs text-ink-2 mt-1">
        {isFirst
          ? 'هذه نتيجة البداية، وكل جلسة قادمة تُقارن بها.'
          : `نتيجة البداية: ${toArabicDigits(probePercent(first))}٪. التذبذب من يوم لآخر طبيعي؛ انظر إلى اتجاه الرسم في صفحة البرنامج.`}
      </p>
    </div>
  );
}

function ProgramRules() {
  return (
    <section className="bz-card-quiet p-6 grid md:grid-cols-2 gap-6 text-sm text-ink-2">
      <div>
        <h3 className="font-black text-slate-900">تركيب الجلسة (نحو {toArabicDigits(MINUTES_PER_SESSION + PROBE_MINUTES)} دقيقة)</h3>
        <ol className="list-decimal pr-5 mt-2 space-y-1 leading-relaxed">
          <li><strong>درس قصير (أنا أعلّمك):</strong> عند أول لقاء بكل مستوى، وعند الرجوع مستوى: شرح بالصوت والصورة ونموذج ومثال مضاد.</li>
          <li><strong>ممارسة موجّهة (نفعلها معًا):</strong> أول تمرينين بتلميح مسموع وخيار أقل، ثم تُسحب المساعدة.</li>
          <li><strong>ممارسة مستقلة (افعلها وحدك):</strong> عند الخطأ يشرح التطبيق لماذا الإجابة الصحيحة صحيحة، ثم محاولة ثانية. عدد البنود (٤ إلى ١٢) يحدده نموذج تتبّع المعرفة.</li>
          <li><strong>مقياس التقدّم ({toArabicDigits(PROBE_MINUTES)} دقائق):</strong> في أول جلسة ثم مرة كل أسبوع وفي الجلسة الأخيرة، بلا تصحيح، مع مهارة غير مدرَّبة للمقارنة. التقدّم اليومي يظهر من تقدير النموذج بعد كل إجابة.</li>
          <li>تُرتَّب المهارات من الأسهل نمائيًا: التمييز السمعي ← القافية ← الأصوات ← التركيب ← الحروف.</li>
          <li>بنود التدريب تُولَّد جديدة في كل جلسة ولا تكرر بنود الفحص، كي لا يتدرّب الطفل على الاختبار نفسه.</li>
        </ol>
      </div>
      <div>
        <h3 className="font-black text-slate-900">قواعد التقدّم والمتابعة</h3>
        <ul className="list-disc pr-5 mt-2 space-y-1 leading-relaxed">
          <li><strong>نموذج تتبّع المعرفة (Bayesian Knowledge Tracing):</strong> بعد كل إجابة يحدّث احتمال أن الطفل أتقن المستوى، مع احتساب احتمال التخمين (حسب عدد الخيارات) واحتمال الخطأ رغم الإتقان. يبدأ التقدير من نتيجة الفحص.</li>
          <li><strong>الإتقان:</strong> حين يبلغ الاحتمال ٩٥٪ بعد ٥ إجابات على الأقل ← المستوى التالي فورًا، ولو في منتصف التمرين.</li>
          <li><strong>الرجوع خطوة:</strong> حين يبقى الاحتمال أقل من ٢٠٪ بعد ٨ إجابات ← مستوى أسهل وتنبيه للمعلم.</li>
          <li><strong>مقياس التقدّم:</strong> إجاباته تحدّث تقدير المستوى الثاني دون تعلّم، فإن أظهر إتقانه انتقل الطفل إليه مباشرة.</li>
          <li><strong>المدة:</strong> {toArabicDigits(PROGRAM_SESSIONS)} جلسة، {toArabicDigits(SESSIONS_PER_WEEK)} جلسات أسبوعيًا (نحو {toArabicDigits(PROGRAM_WEEKS)} أسابيع)، ثم إعادة الفحص لقياس الأثر وتحديث الخطة. مجموعها نحو ٦ ساعات، في المدى الذي حقق فيه تدريب الوعي الصوتي أكبر أثر في التحليل البعدي للجنة القراءة الوطنية الأمريكية (٥ إلى ١٨ ساعة).</li>
        </ul>
      </div>
    </section>
  );
}

export default TrainingProgramView;
