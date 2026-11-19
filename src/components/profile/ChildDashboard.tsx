import React from 'react';
import { Brain, Dumbbell, TrendingUp } from 'lucide-react';
import type { StudentRecord } from '../../data/seedData';
import { subtestsForAge } from '../../cognitiveProfile/battery';
import { buildProfile, formatAge } from '../../cognitiveProfile/scoring';
import { PROGRAM_SESSIONS, SKILLS } from '../../cognitiveProfile/training';
import { summarizeProbes } from '../../cognitiveProfile/progressProbe';
import type { BatterySession } from '../../cognitiveProfile/storage';
import { ProfileReportView } from './ProfileReportView';
import { TrainingProgressPanel } from './TrainingProgressPanel';
import { IndividualPlanPanel } from './IndividualPlanPanel';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const signed = (v: number) => (v > 0 ? `+${ar(v)}` : v < 0 ? `−${ar(Math.abs(v))}` : ar(0));

function gradeLabel(grade: number): string {
  if (grade === 0) return 'الروضة';
  if (grade === 7) return 'الصف الأول المتوسط';
  return `الصف ${ar(grade)} الابتدائي`;
}

interface Props {
  student: StudentRecord;
  students: StudentRecord[];
  onSelectStudent: (id: string) => void;
  onOpenScreening: () => void;
  onOpenTraining: () => void;
  onRecordUpdated: (student: StudentRecord) => void;
  /** Teachers and specialists also see the reading-passage result and the individual plan. */
  showTeacherTools: boolean;
}

/**
 * One child at a glance: who the child is, the full screening report (every task, every word),
 * progress in the training programme, and what still needs work.
 */
export function ChildDashboard({ student, students, onSelectStudent, onOpenScreening, onOpenTraining, onRecordUpdated, showTeacherTools }: Props) {
  const battery = student.cognitiveBattery;
  const hasScreening = Boolean(battery && Object.keys(battery.results ?? {}).length > 0);
  const profile = hasScreening ? buildProfile(battery!.results, battery!.ageMonths) : null;
  const session: BatterySession | null = hasScreening
    ? {
        studentId: student.id,
        childName: student.name,
        ageMonths: battery!.ageMonths,
        examinerName: battery!.examinerName,
        startedAt: battery!.startedAt,
        dialect: battery!.dialect,
        results: battery!.results,
      }
    : null;
  const tasksTotal = battery ? subtestsForAge(battery.ageMonths).length : 0;
  const tasksDone = profile ? profile.subtests.length : 0;

  const progress = student.trainingProgress ?? null;
  const sessionsDone = progress ? new Set(progress.history.map((h) => h.date.slice(0, 10))).size : 0;
  const probe = progress ? summarizeProbes(progress.probes ?? []) : null;
  const ageText = battery ? formatAge(battery.ageMonths) : student.ageYears ? `${student.ageYears} سنوات` : '';

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. The child */}
      <section className="bz-card p-6 sm:p-8 flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-1">
          <p className="bz-small text-brand font-semibold">ملف الطفل</p>
          <h1 className="bz-h2" style={{ fontSize: 'clamp(24px, 2.6vw, 32px)' }}>{student.name}</h1>
          <p className="bz-small text-ink-2">
            {[ageText && ar(ageText), gradeLabel(student.gradeLevel), student.schoolName && student.schoolName !== 'مدرستي' ? student.schoolName : '']
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {students.length > 1 && (
          <label className="flex items-center gap-2 bz-small text-ink-2">
            طفل آخر:
            <select
              value={student.id}
              onChange={(e) => onSelectStudent(e.target.value)}
              className="px-3 py-2 rounded-lg border border-line bg-card text-ink font-semibold"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}
      </section>

      {/* 2. Three numbers */}
      <section className="grid sm:grid-cols-3 gap-4" aria-label="الملخص">
        <div className="bz-card p-5">
          <p className="bz-small text-ink-2 flex items-center gap-1.5"><Brain size={16} aria-hidden="true" /> فحص مهارات القراءة</p>
          <p className="text-2xl font-bold text-ink mt-1 bz-num">{hasScreening ? `${ar(tasksDone)} من ${ar(tasksTotal)} مهام` : 'لم يبدأ بعد'}</p>
          <button type="button" className="bz-link bz-small mt-2" onClick={onOpenScreening}>
            {hasScreening && tasksDone < tasksTotal ? 'أكمل الفحص' : hasScreening ? 'فحص جديد' : 'ابدأ الفحص'}
          </button>
        </div>
        <div className="bz-card p-5">
          <p className="bz-small text-ink-2 flex items-center gap-1.5"><Dumbbell size={16} aria-hidden="true" /> البرنامج التدريبي</p>
          <p className="text-2xl font-bold text-ink mt-1 bz-num">{progress ? `${ar(sessionsDone)} من ${ar(PROGRAM_SESSIONS)} جلسة` : 'لم يبدأ بعد'}</p>
          <button type="button" className="bz-link bz-small mt-2" onClick={onOpenTraining}>
            {progress ? 'تابع التدريب' : 'ابدأ التدريب'}
          </button>
        </div>
        <div className="bz-card p-5">
          <p className="bz-small text-ink-2 flex items-center gap-1.5"><TrendingUp size={16} aria-hidden="true" /> التحسّن في التدريب</p>
          {probe && probe.count >= 2 ? (
            <>
              <p className="text-2xl font-bold text-ink mt-1 bz-num">{signed(probe.change)} نقطة</p>
              <p className="bz-small text-ink-2 mt-1 bz-num">من {ar(probe.baseline)}٪ في البداية إلى {ar(probe.latest)}٪ في آخر جلسة</p>
            </>
          ) : (
            <p className="bz-small text-ink-2 mt-2">يظهر بعد جلستين تدريبيتين على الأقل.</p>
          )}
        </div>
      </section>

      {/* 3. Training: what improved, what still needs support */}
      {progress && (
        <section className="space-y-3" aria-labelledby="training-skills-title">
          {(progress.mastered.length > 0 || progress.supportFlags.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4" id="training-skills-title">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                <h3 className="font-bold text-emerald-900">مهارات أتقنها في التدريب</h3>
                <p className="mt-2 bz-small text-ink">
                  {progress.mastered.length > 0 ? progress.mastered.map((s) => SKILLS[s]?.nameAr).filter(Boolean).join('، ') : 'لا توجد بعد.'}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                <h3 className="font-bold text-amber-950">مهارات تحتاج مساعدة من الكبار</h3>
                <p className="mt-2 bz-small text-ink">
                  {progress.supportFlags.length > 0
                    ? `${progress.supportFlags.map((s) => SKILLS[s]?.nameAr).filter(Boolean).join('، ')} — تراجع فيها المستوى، فاجلس معه في الجلسة القادمة.`
                    : 'لا توجد.'}
                </p>
              </div>
            </div>
          )}
          <TrainingProgressPanel student={student} />
        </section>
      )}

      {/* 4. The full screening report */}
      {profile && session ? (
        <ProfileReportView profile={profile} session={session} embedded onBack={() => undefined} onStartTraining={onOpenTraining} />
      ) : (
        <section className="bz-card p-6 flex flex-wrap items-center justify-between gap-4">
          <p className="bz-small text-ink-2">لا يوجد تقرير بعد. يظهر التقرير هنا بعد أن يلعب الطفل ألعاب الفحص.</p>
          <button type="button" className="bz-btn bz-btn-primary" onClick={onOpenScreening}>ابدأ الفحص</button>
        </section>
      )}

      {/* 5. For the teacher or specialist */}
      {showTeacherTools && (
        <details className="bz-card p-5">
          <summary className="cursor-pointer font-bold text-ink">للمعلم والأخصائي: قراءة النص والخطة الفردية</summary>
          <div className="mt-4 space-y-4">
            {student.sessionStatus === 'completed' ? (
              <div className="rounded-xl border border-line p-4 bz-small text-ink-2 space-y-1">
                <p className="font-semibold text-ink">قراءة نص وفهمه</p>
                <p className="bz-num">
                  الفهم: {ar(student.comprehensionScore)}٪
                  {student.oralWcpm != null ? ` · ${ar(student.oralWcpm)} كلمة صحيحة في الدقيقة` : ''}
                </p>
                {student.problematicWords?.length > 0 && <p>كلمات صعبة: {student.problematicWords.join('، ')}</p>}
              </div>
            ) : (
              <p className="bz-small text-ink-2">لم تُسجَّل قراءة نص بعد.</p>
            )}
            <IndividualPlanPanel student={student} progress={progress} onRecordUpdated={onRecordUpdated} />
          </div>
        </details>
      )}
    </div>
  );
}

export default ChildDashboard;
