import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarCheck, CheckCircle2, Play, Target, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import type { CognitiveProfile } from '../../cognitiveProfile/scoring';
import {
  Level,
  LevelChange,
  MASTERY_PERCENT,
  MINUTES_PER_SESSION,
  PROGRAM_WEEKS,
  SESSIONS_PER_WEEK,
  SKILLS,
  STEP_BACK_PERCENT,
  SkillId,
  TrainingPlan,
  TrainingProgress,
  TrainingTask,
  applySession,
  buildTrainingPlan,
  createProgress,
  generateSession,
  isReassessmentDue,
  sessionsCompleted,
} from '../../cognitiveProfile/training';
import { loadTrainingProgress, saveTrainingProgress } from '../../cognitiveProfile/storage';
import { ChoicePlayer, SpanPlayer } from './TaskPlayers';
import { speak } from './audio';

const toArabicDigits = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

const CHANGE_TEXT: Record<LevelChange, string> = {
  up: 'أتقن المستوى! انتقل إلى المستوى التالي 🎉',
  mastered: 'أتقن المهارة بكل مستوياتها 🏆',
  down: 'سنعود خطوة إلى مستوى أسهل لتثبيت المهارة.',
  stay: 'نستمر في المستوى نفسه حتى الإتقان.',
};

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
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${done ? 'bg-emerald-500 text-white' : current ? 'bg-white border-2 border-emerald-500 text-emerald-700' : 'bg-slate-100'}`}>
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
  phase: 'intro' | 'task' | 'result' | 'summary';
  change: LevelChange | null;
  results: Array<{ skill: SkillId; correct: number; total: number; change: LevelChange }>;
};

interface Props {
  studentId: string;
  childName: string;
  profile: CognitiveProfile | null;
  onBack: () => void;
  onGoToBattery: () => void;
  onRunningChange?: (running: boolean) => void;
}

export function TrainingProgramView({ studentId, childName, profile, onBack, onGoToBattery, onRunningChange }: Props) {
  const [progress, setProgress] = useState<TrainingProgress | null>(() => loadTrainingProgress(studentId));
  const [run, setRun] = useState<Run | null>(null);
  useEffect(() => {
    onRunningChange?.(run !== null);
  }, [run !== null, onRunningChange]);
  const seed = useRef(Date.now());

  const proposedPlan: TrainingPlan | null = useMemo(() => (profile ? buildTrainingPlan(profile) : null), [profile]);

  const persist = (p: TrainingProgress) => {
    setProgress(p);
    saveTrainingProgress(studentId, p);
  };

  const startProgram = (plan: TrainingPlan) => persist(createProgress(plan));

  const activeSkills = progress ? progress.plan.focus.filter((s) => !progress.mastered.includes(s)) : [];
  const todaySkills = activeSkills.length > 0 ? activeSkills : progress?.plan.focus ?? [];
  const sessionSkills = run?.skills ?? todaySkills;

  const beginSkill = (skillIndex: number, prev: Run | null) => {
    const skills = prev?.skills ?? todaySkills;
    const skill = skills[skillIndex];
    const level = (progress!.levels[skill] ?? 1) as Level;
    seed.current += 7919;
    setRun({
      skills,
      skillIndex,
      tasks: generateSession(skill, level, seed.current),
      taskIndex: 0,
      correct: 0,
      phase: 'intro',
      change: null,
      results: prev?.results ?? [],
    });
  };

  const onTaskDone = (correct: boolean) => {
    if (!run || !progress) return;
    const nextCorrect = run.correct + (correct ? 1 : 0);
    if (run.taskIndex + 1 < run.tasks.length) {
      setRun({ ...run, taskIndex: run.taskIndex + 1, correct: nextCorrect });
      return;
    }
    const skill = sessionSkills[run.skillIndex];
    const { progress: updated, change } = applySession(progress, skill, nextCorrect, run.tasks.length);
    persist(updated);
    if (change === 'up' || change === 'mastered') speak('أَحْسَنْتَ! انْتَقَلْتَ إِلَى مُسْتَوًى جَدِيدٍ.');
    setRun({
      ...run,
      correct: nextCorrect,
      phase: 'result',
      change,
      results: [...run.results, { skill, correct: nextCorrect, total: run.tasks.length, change }],
    });
  };

  // ---------------------------------------------------------------- running a session
  if (run && progress) {
    const skill = sessionSkills[run.skillIndex];
    const def = SKILLS[skill];
    const task = run.tasks[run.taskIndex];
    return (
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden" dir="rtl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/70">
          <p className="font-child font-black text-slate-900 flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">{def.icon}</span> {def.nameAr}
            <span className="text-xs font-bold text-slate-500">· المستوى {toArabicDigits(progress.levels[skill] ?? 1)}</span>
          </p>
          <p className="text-xs font-bold text-slate-500">
            المهارة {toArabicDigits(run.skillIndex + 1)} من {toArabicDigits(sessionSkills.length)}
          </p>
        </div>
        {run.phase === 'task' && (
          <div className="px-6 pt-4">
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(run.taskIndex / run.tasks.length) * 100}%` }} />
            </div>
          </div>
        )}
        <div className="p-5 sm:p-8 min-h-[420px] flex flex-col items-center justify-center">
          {run.phase === 'intro' && (
            <div className="flex flex-col items-center text-center gap-4 max-w-md">
              <span className="text-7xl" aria-hidden="true">{def.icon}</span>
              <h2 className="font-child text-2xl font-black text-slate-900">{def.nameAr}</h2>
              <p className="text-sm text-slate-600">{SKILLS[skill].levels[(progress.levels[skill] ?? 1) as Level]}</p>
              <button
                type="button"
                onClick={() => setRun({ ...run, phase: 'task' })}
                className="font-child flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-600 text-white text-xl font-black shadow-lg cursor-pointer"
              >
                <Play className="w-6 h-6" /> ابدأ
              </button>
            </div>
          )}
          {run.phase === 'task' && task.kind === 'choice' && (
            <ChoicePlayer key={task.item.id} item={task.item} showFeedback onDone={(r) => onTaskDone(r.correct)} />
          )}
          {run.phase === 'task' && task.kind === 'span' && (
            <SpanPlayer key={task.trial.id + run.taskIndex} trial={task.trial} modality={task.modality} showFeedback onDone={(r) => onTaskDone(r.correct)} />
          )}
          {run.phase === 'result' && run.change && (
            <div className="flex flex-col items-center text-center gap-4">
              <span className="text-7xl" aria-hidden="true">{run.change === 'down' ? '💪' : '⭐'}</span>
              <p className="font-child text-2xl font-black text-slate-900">
                {toArabicDigits(run.correct)} من {toArabicDigits(run.tasks.length)} إجابات صحيحة
              </p>
              <p className="text-sm font-bold text-slate-600">{CHANGE_TEXT[run.change]}</p>
              <button
                type="button"
                onClick={() =>
                  run.skillIndex + 1 < sessionSkills.length ? beginSkill(run.skillIndex + 1, run) : setRun({ ...run, phase: 'summary' })
                }
                className="font-child px-8 py-4 rounded-2xl bg-sky-600 text-white text-lg font-black shadow cursor-pointer"
              >
                {run.skillIndex + 1 < sessionSkills.length ? 'المهارة التالية' : 'إنهاء الجلسة'}
              </button>
            </div>
          )}
          {run.phase === 'summary' && (
            <div className="flex flex-col items-center text-center gap-4 w-full max-w-md">
              <span className="text-7xl" aria-hidden="true">🏆</span>
              <p className="font-child text-2xl font-black text-slate-900">انتهت جلسة اليوم!</p>
              <ul className="w-full space-y-2">
                {run.results.map((r) => (
                  <li key={r.skill} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2 text-sm">
                    <span className="font-bold">{SKILLS[r.skill].nameAr}</span>
                    <span>{toArabicDigits(Math.round((r.correct / r.total) * 100))}٪</span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setRun(null)} className="font-child px-8 py-3 rounded-2xl bg-emerald-600 text-white font-black cursor-pointer">
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
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-slate-600 cursor-pointer">
          <ArrowRight className="w-4 h-4" /> رجوع
        </button>
        <section className="bg-white rounded-[2rem] border border-slate-200 p-6 sm:p-8 space-y-5">
          <h2 className="text-2xl font-black text-slate-900">البرنامج التدريبي الموجّه لـ{childName}</h2>
          {!plan ? (
            <div className="space-y-4">
              <p className="text-slate-700 leading-relaxed">
                يُبنى البرنامج من نتائج الفحص المعرفي: يختار المهارات الأضعف ويحدد مستوى البداية لكل منها. أكمل الفحص أولًا (ولو جزئيًا) للحصول على برنامج مخصص.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={onGoToBattery} className="px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black cursor-pointer">
                  الذهاب إلى الفحص
                </button>
                <button
                  type="button"
                  onClick={() => startProgram({ createdAt: new Date().toISOString(), preventive: true, focus: ['blending', 'letterSound'], rationaleAr: ['برنامج عام للاستعداد للقراءة دون فحص مسبق.'] })}
                  className="px-5 py-3 rounded-2xl border-2 border-slate-300 font-bold text-slate-700 cursor-pointer"
                >
                  برنامج عام للاستعداد للقراءة
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-3 gap-4">
                {plan.focus.map((s) => (
                  <div key={s} className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4">
                    <span className="text-4xl" aria-hidden="true">{SKILLS[s].icon}</span>
                    <p className="font-black text-slate-900 mt-2">{SKILLS[s].nameAr}</p>
                    <p className="text-xs text-slate-600 mt-1">{SKILLS[s].goalAr}</p>
                  </div>
                ))}
              </div>
              <ul className="text-sm text-slate-700 list-disc pr-5 space-y-1">
                {plan.rationaleAr.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <ProgramRules />
              <button type="button" onClick={() => startProgram(plan)} className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-600 text-white text-lg font-black shadow cursor-pointer">
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
  const target = PROGRAM_WEEKS * SESSIONS_PER_WEEK;
  const due = isReassessmentDue(progress);
  const recent = [...progress.history].reverse().slice(0, 8);

  return (
    <div className="space-y-6" dir="rtl">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-slate-600 cursor-pointer">
        <ArrowRight className="w-4 h-4" /> رجوع
      </button>

      <section className="bg-white rounded-[2rem] border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <p className="text-xs font-black text-emerald-700">{progress.plan.preventive ? 'برنامج وقائي' : 'برنامج علاجي-تدريبي موجّه'}</p>
          <h2 className="text-2xl font-black text-slate-900 mt-0.5">برنامج {childName}</h2>
          <p className="text-sm text-slate-600 mt-1">
            الجلسات المنجزة: <strong>{toArabicDigits(done)}</strong> من {toArabicDigits(target)} · {toArabicDigits(SESSIONS_PER_WEEK)} جلسات أسبوعيًا × {toArabicDigits(MINUTES_PER_SESSION)} دقيقة
          </p>
          <div className="mt-3 h-3 w-full md:w-80 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (done / target) * 100)}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => beginSkill(0, null)}
          className="font-child flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-emerald-600 text-white text-xl font-black shadow-lg cursor-pointer"
        >
          <Play className="w-6 h-6" /> ابدأ جلسة اليوم
        </button>
      </section>

      {due && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sky-50 border border-sky-200 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-sky-900">
            <CalendarCheck className="w-5 h-5" /> حان وقت إعادة الفحص لقياس التقدّم وتحديث الخطة.
          </p>
          <button type="button" onClick={onGoToBattery} className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-black cursor-pointer">
            الذهاب إلى الفحص
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {progress.plan.focus.map((s) => {
          const level = (progress.levels[s] ?? 1) as Level;
          const isMastered = progress.mastered.includes(s);
          const last = [...progress.history].reverse().find((h) => h.skill === s);
          return (
            <div key={s} className="bg-white rounded-3xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <span className="text-4xl" aria-hidden="true">{SKILLS[s].icon}</span>
                {isMastered && <span className="flex items-center gap-1 text-xs font-black text-emerald-700"><CheckCircle2 className="w-4 h-4" /> أُتقنت</span>}
              </div>
              <p className="font-black text-slate-900 mt-2">{SKILLS[s].nameAr}</p>
              <p className="text-xs text-slate-600 mt-0.5">{SKILLS[s].goalAr}</p>
              <LevelLadder skill={s} level={level} mastered={isMastered} />
              {last && (
                <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> آخر جلسة: {toArabicDigits(Math.round((last.correct / last.total) * 100))}٪
                </p>
              )}
              {progress.supportFlags.includes(s) && (
                <p className="mt-2 text-xs font-bold text-amber-800 bg-amber-50 rounded-lg p-2 flex gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> يحتاج دعمًا مباشرًا من المعلم: طبّق الاستراتيجيات المقترحة في التقرير بجانب التمرين.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <ProgramRules />

      {recent.length > 0 && (
        <section className="bg-white rounded-3xl border border-slate-200 p-5">
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
                  <td className={`p-1.5 text-center font-bold ${(h.correct / h.total) * 100 >= MASTERY_PERCENT ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {toArabicDigits(Math.round((h.correct / h.total) * 100))}٪
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
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> إعادة بناء الخطة من آخر فحص
        </button>
      )}
    </div>
  );
}

function ProgramRules() {
  return (
    <section className="rounded-3xl bg-slate-50 border border-slate-200 p-5 grid md:grid-cols-2 gap-5 text-sm text-slate-700">
      <div>
        <h3 className="font-black text-slate-900">تركيب الجلسة ({toArabicDigits(MINUTES_PER_SESSION)} دقيقة)</h3>
        <ol className="list-decimal pr-5 mt-2 space-y-1 leading-relaxed">
          <li>تمرين قصير لكل مهارة من مهارات التركيز (٨ بنود أو ٥ سلاسل) مع تصحيح فوري.</li>
          <li>تُرتَّب المهارات من الأسهل نمائيًا: التمييز السمعي ← القافية ← الأصوات ← التركيب ← الحروف.</li>
          <li>بنود التدريب تُولَّد جديدة في كل جلسة ولا تكرر بنود الفحص، كي لا يتدرّب الطفل على الاختبار نفسه.</li>
        </ol>
      </div>
      <div>
        <h3 className="font-black text-slate-900">قواعد التقدّم والمتابعة</h3>
        <ul className="list-disc pr-5 mt-2 space-y-1 leading-relaxed">
          <li><strong>الإتقان:</strong> {toArabicDigits(MASTERY_PERCENT)}٪ فأكثر في جلستين متتاليتين ← المستوى التالي.</li>
          <li><strong>الرجوع خطوة:</strong> أقل من {toArabicDigits(STEP_BACK_PERCENT)}٪ في جلستين متتاليتين ← مستوى أسهل وتنبيه للمعلم.</li>
          <li><strong>المدة:</strong> {toArabicDigits(PROGRAM_WEEKS)} أسابيع × {toArabicDigits(SESSIONS_PER_WEEK)} جلسات، ثم إعادة الفحص لقياس الأثر وتحديث الخطة.</li>
        </ul>
      </div>
    </section>
  );
}

export default TrainingProgramView;
