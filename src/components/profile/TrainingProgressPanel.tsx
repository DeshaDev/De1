import React from 'react';
import { TrendingUp } from 'lucide-react';
import type { StudentRecord } from '../../data/seedData';
import { PROGRAM_SESSIONS, SKILLS, masteryEstimate } from '../../cognitiveProfile/training';
import { describeProgressAr, summarizeProbes } from '../../cognitiveProfile/progressProbe';
import ProgressChart from './ProgressChart';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const signed = (v: number) => (v > 0 ? `+${ar(v)}` : v < 0 ? `−${ar(Math.abs(v))}` : ar(0));

/** Programme progress for reports: sessions done, the daily probe trend and per-skill change. */
export function TrainingProgressPanel({ student, compact = false }: { student: StudentRecord; compact?: boolean }) {
  const progress = student.trainingProgress;
  if (!progress) return null;
  const sessions = new Set(progress.history.map((h) => h.date.slice(0, 10))).size;
  const probes = progress.probes ?? [];
  const summary = summarizeProbes(probes);

  return (
    <section className="bz-card p-6 space-y-4" aria-labelledby={`training-progress-${student.id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`training-progress-${student.id}`} className="bz-h3 flex items-center gap-2">
          <TrendingUp size={20} aria-hidden="true" /> تقدّم البرنامج التدريبي
        </h2>
        <p className="bz-small text-ink-2">
          الجلسات: <strong className="text-ink">{ar(sessions)}</strong> من {ar(PROGRAM_SESSIONS)}
          {summary && <> · البداية <strong className="text-ink">{ar(summary.baseline)}٪</strong> · آخر جلسة <strong className="text-ink">{ar(summary.latest)}٪</strong></>}
        </p>
      </div>
      <p className="bz-small text-ink-2">{describeProgressAr(summary)}</p>
      {probes.length > 0 && <ProgressChart probes={probes} height={compact ? 140 : 180} />}
      {!compact && (
        <div>
          <p className="bz-small font-semibold text-ink">تقدير نموذج تتبّع المعرفة (احتمال إتقان المستوى الحالي)</p>
          <ul className="mt-2 grid sm:grid-cols-3 gap-2">
            {progress.plan.focus.map((skill) => {
              const e = masteryEstimate(progress, skill);
              const done = progress.mastered.includes(skill);
              return (
                <li key={skill} className="rounded-xl border border-line px-3 py-2 text-sm">
                  <span className="font-semibold">{SKILLS[skill].nameAr}</span>
                  <span className="block text-xs text-ink-2">{done ? 'أُتقنت كل المستويات' : `المستوى ${ar(e.level)}`} · {ar(Math.round(e.p * 100))}٪</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {!compact && summary && summary.bySkill.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-ink-2">
              <th className="text-right p-1.5">المهارة المدرَّبة</th>
              <th className="p-1.5">البداية</th>
              <th className="p-1.5">آخر جلسة</th>
              <th className="p-1.5">التغيّر (أول ٣ ← آخر ٣ جلسات)</th>
            </tr>
          </thead>
          <tbody>
            {summary.bySkill.map((s) => (
              <tr key={s.skill} className="border-t border-line">
                <td className="p-1.5 font-semibold">{SKILLS[s.skill].nameAr}</td>
                <td className="p-1.5 text-center">{ar(s.baseline)}٪</td>
                <td className="p-1.5 text-center">{ar(s.latest)}٪</td>
                <td className="p-1.5 text-center font-semibold">{signed(s.change)}</td>
              </tr>
            ))}
            {summary.comparisonSkill && summary.comparisonChange !== null && (
              <tr className="border-t border-line text-ink-2">
                <td className="p-1.5">{SKILLS[summary.comparisonSkill].nameAr} (غير مدرَّبة، للمقارنة)</td>
                <td className="p-1.5 text-center" colSpan={2}>—</td>
                <td className="p-1.5 text-center">{signed(summary.comparisonChange)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {!compact && (
        <p className="text-xs text-ink-2">
          المقياس أسئلة جديدة بصعوبة ثابتة في الجلسة الأولى ثم أسبوعيًا، بلا تصحيح. الاتجاه عبر القياسات هو المؤشر، لا نتيجة يوم واحد. المقياس لم يُعايَر بعد على عينة من الأطفال.
        </p>
      )}
    </section>
  );
}

export default TrainingProgressPanel;
