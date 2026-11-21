/**
 * A child's workspace: three clear cards (Screening, Training, Report) and the report below.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Play,
  Sparkles,
  CheckCircle2,
  Clock,
  BookOpen,
  Gamepad2,
  UserCheck,
  Users,
  Cloud,
  PauseCircle,
} from 'lucide-react';
import type { StudentRecord } from '../../data/seedData';
import { SUBTESTS_BY_ID, subtestsForAge, type SubtestId } from '../../cognitiveProfile/battery';
import { buildProfile } from '../../cognitiveProfile/scoring';
import { SKILLS, type TrainingProgress } from '../../cognitiveProfile/training';
import {
  loadBatterySession,
  loadTrainingProgress,
  type BatterySession,
} from '../../cognitiveProfile/storage';
import { summarizeBattery } from '../../cognitiveProfile/records';
import ProfileReportView from './ProfileReportView';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

interface Props {
  student: StudentRecord;
  childrenList?: StudentRecord[];
  students?: StudentRecord[];
  onSelectChild?: (id: string) => void;
  onSelectStudent?: (id: string) => void;
  onStartScreening?: () => void;
  onOpenScreening?: () => void;
  onStartTraining?: () => void;
  onOpenTraining?: () => void;
  onOpenReader?: () => void;
  onOpenGames?: () => void;
  onOpenParentPortal?: () => void;
  showTeacherTools?: boolean;
  onRecordUpdated?: (student: StudentRecord) => void;
  supabaseUser?: any;
}

export const ChildDashboard: React.FC<Props> = ({
  student,
  childrenList,
  students,
  onSelectChild,
  onSelectStudent,
  onStartScreening,
  onOpenScreening,
  onStartTraining,
  onOpenTraining,
  onOpenReader,
  onOpenGames,
  onOpenParentPortal,
  onRecordUpdated,
  supabaseUser,
}) => {
  const allChildren = childrenList ?? students ?? [];
  const handleSelectChild = onSelectChild ?? onSelectStudent ?? (() => undefined);
  const handleStartScreening = onStartScreening ?? onOpenScreening ?? (() => undefined);
  const handleStartTraining = onStartTraining ?? onOpenTraining ?? (() => undefined);

  const [localSession, setLocalSession] = useState<BatterySession | null>(null);
  const [localTraining, setLocalTraining] = useState<TrainingProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLocalSession(null);
    setLocalTraining(null);
    void loadBatterySession(student.id)
      .then((sess) => {
        if (cancelled || !sess) return;
        setLocalSession(sess);
        const existingResultsCount = Object.keys(student.cognitiveBattery?.results ?? {}).length;
        const localResultsCount = Object.keys(sess.results ?? {}).length;
        if (
          !student.isDemoRecord &&
          (!student.cognitiveBattery || localResultsCount > existingResultsCount)
        ) {
          const mergedResults = {
            ...(student.cognitiveBattery?.results ?? {}),
            ...(sess.results ?? {}),
          };
          onRecordUpdated?.({
            ...student,
            cognitiveBattery: {
              ageMonths: sess.ageMonths,
              examinerName: sess.examinerName,
              startedAt: sess.startedAt,
              dialect: sess.dialect,
              updatedAt: new Date().toISOString(),
              results: mergedResults,
              summary: summarizeBattery(mergedResults, sess.ageMonths),
            },
          });
        }
      })
      .catch(() => undefined);

    void loadTrainingProgress(student.id)
      .then((tp) => {
        if (!cancelled && tp) setLocalTraining(tp);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [student.id]);

  const battery = student.cognitiveBattery;
  const ageMonths = localSession?.ageMonths ?? battery?.ageMonths ?? Math.max(48, (student.ageYears || 7) * 12);
  const tasksTotal = subtestsForAge(ageMonths).length;

  const session: BatterySession | null = useMemo(() => {
    if (!battery && !localSession) return null;
    const mergedResults = {
      ...(battery?.results ?? {}),
      ...(localSession?.results ?? {}),
    };
    return {
      studentId: student.id,
      childName: student.name,
      ageMonths,
      examinerName: localSession?.examinerName ?? battery?.examinerName ?? '',
      startedAt: localSession?.startedAt ?? battery?.startedAt ?? new Date().toISOString(),
      dialect: localSession?.dialect ?? battery?.dialect,
      results: mergedResults,
      ...(localSession?.inProgress ? { inProgress: localSession.inProgress } : {}),
    };
  }, [battery, localSession, student.id, student.name, ageMonths]);

  const pausedIds = useMemo(
    () => (Object.keys(session?.inProgress ?? {}) as SubtestId[]).filter((id) => id in SUBTESTS_BY_ID),
    [session]
  );
  const tasksDone = session
    ? Object.keys(session.results).filter((id) => !session.inProgress?.[id as SubtestId]).length
    : 0;
  const hasAnySavedData = Boolean(
    session && (Object.keys(session.results).length > 0 || pausedIds.length > 0)
  );
  const screeningComplete = tasksDone >= tasksTotal && tasksTotal > 0;

  const training = student.trainingProgress ?? localTraining;
  const sessionsDone = training?.history?.length ?? 0;
  const focusSkills = (training?.plan?.focus ?? [])
    .slice(0, 3)
    .map((sk) => SKILLS[sk]?.nameAr)
    .filter(Boolean);

  const profile = useMemo(
    () => (session ? buildProfile(session.results, session.ageMonths) : null),
    [session]
  );

  const realChildren = allChildren.filter((c) => !c.isDemoRecord);

  const screeningStatusText =
    tasksDone === 0 && pausedIds.length > 0
      ? `محفوظ مؤقتًا عند «${pausedIds.map((id) => SUBTESTS_BY_ID[id].gameNameAr).join('، ')}»`
      : tasksDone === 0 && session
        ? 'بدأ الفحص ومحفوظ للاستكمال'
        : tasksDone === 0
          ? 'لم يبدأ بعد'
          : screeningComplete
            ? `مكتمل (${ar(tasksDone)} من ${ar(tasksTotal)})`
            : `محفوظ: ${ar(tasksDone)} من ${ar(tasksTotal)} مهمة${pausedIds.length > 0 ? ` · توقف عند «${SUBTESTS_BY_ID[pausedIds[0]].gameNameAr}»` : ''}`;

  const reportStatusText = !session
    ? 'يظهر بعد بدء الفحص'
    : screeningComplete
      ? 'جاهز للعرض والطباعة'
      : hasAnySavedData
        ? `تقرير مرحلي محفوظ (${ar(Object.keys(session.results).length)} مهمة مسجلة)`
        : 'تم حفظ الجلسة — استكمل أول مهمة لعرض الدرجات';

  return (
    <div className="space-y-8" dir="rtl">
      {/* Child header + child switcher */}
      <section className="bz-card bz-card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand text-white flex items-center justify-center font-black text-2xl shrink-0">
            {student.name.trim().charAt(0)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="bz-h2">{student.name}</h1>
              <span className="bz-badge bz-badge-brand">
                {ar(student.ageYears || 7)} {(student.ageYears || 7) >= 11 ? 'سنة' : 'سنوات'}
              </span>
              {supabaseUser && (
                <span className="bz-badge bz-badge-neutral">
                  <Cloud className="w-3.5 h-3.5" /> محفوظ سحابيًا
                </span>
              )}
            </div>
            <p className="bz-small text-ink-2 mt-1">
              لوحة متابعة وتقرير {student.name} — يمكنك استكمال الفحص أو مراجعة التقرير بالأسفل في أي وقت.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {realChildren.length > 1 && (
            <label className="inline-flex items-center gap-2 text-xs font-bold text-ink-2 bg-soft px-3 py-2 rounded-xl border border-line">
              <Users className="w-4 h-4 text-brand" />
              <span>تبديل الطفل:</span>
              <select
                value={student.id}
                onChange={(e) => handleSelectChild(e.target.value)}
                className="bg-transparent font-bold text-ink focus:outline-none cursor-pointer"
              >
                {realChildren.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({ar(c.ageYears)} سنوات)
                  </option>
                ))}
              </select>
            </label>
          )}
          {onOpenParentPortal && (
            <button
              type="button"
              onClick={onOpenParentPortal}
              className="bz-btn bz-btn-ghost bz-btn-sm"
            >
              إدارة ملفات الأطفال
            </button>
          )}
        </div>
      </section>

      {/* Saved / Paused progress banner if screening is in progress */}
      {session && !screeningComplete && (
        <section className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <p className="font-bold text-emerald-950 text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>
                تم حفظ تقدّم {student.name} بنجاح!
                {pausedIds.length > 0
                  ? ` (متوقف مؤقتًا عند لعبة «${pausedIds.map((id) => SUBTESTS_BY_ID[id].gameNameAr).join('، ')}»)`
                  : ''}
              </span>
            </p>
            <p className="bz-small text-emerald-900">
              المهام المكتملة حتى الآن: <strong>{ar(tasksDone)} من {ar(tasksTotal)}</strong>. يمكنك استكمال الفحص من نفس النقطة التي توقفتم عندها، أو مراجعة التقرير المرحلي بالأسفل.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleStartScreening}
              className="bz-btn bz-btn-primary"
            >
              <Play className="w-4 h-4" /> استكمال الفحص من حيث توقفنا
            </button>
            <a href="#child-report" className="bz-btn bz-btn-secondary">
              <FileText className="w-4 h-4" /> عرض التقرير بالأسفل
            </a>
          </div>
        </section>
      )}

      {/* Three primary cards: Screening, Training, Report */}
      <section className="grid md:grid-cols-3 gap-5" aria-label="مسار الطفل">
        {[
          {
            step: '١',
            title: 'الفحص التأسيسي',
            status: screeningStatusText,
            done: screeningComplete,
            paused: Boolean(session && !screeningComplete),
            desc:
              tasksDone === 0 && pausedIds.length > 0
                ? `تم حفظ التوقف المؤقت عند «${SUBTESTS_BY_ID[pausedIds[0]].gameNameAr}». اضغط للاستكمال من نفس السؤال.`
                : tasksDone === 0
                  ? 'مهام قصيرة بالصوت والصور والقراءة لتحديد نقاط القوة والمهارات التي تحتاج تدريبًا.'
                  : 'يُحفظ التقدّم بعد كل سؤال؛ يمكنك الاستكمال أو إعادة أي مهمة في أي وقت.',
            cta:
              tasksDone === 0 && !session
                ? 'ابدأ الفحص'
                : screeningComplete
                  ? 'مراجعة أو إعادة الفحص'
                  : 'استكمال الفحص المحفوظ',
            action: handleStartScreening,
            primary: !screeningComplete,
          },
          {
            step: '٢',
            title: 'البرنامج التدريبي',
            status:
              sessionsDone > 0
                ? `${ar(sessionsDone)} جلسة مكتملة`
                : focusSkills.length > 0
                  ? 'الخطة جاهزة للبدء'
                  : 'يبنى تلقائيًا بعد الفحص',
            done: sessionsDone > 0,
            paused: false,
            desc:
              focusSkills.length > 0
                ? `يركّز على: ${focusSkills.join('، ')}.`
                : 'جلسات يومية قصيرة (١٠–١٥ دقيقة) تتكيّف مع إجابات الطفل خطوة بخطوة.',
            cta: sessionsDone > 0 ? 'أكمل جلسة اليوم' : 'افتح البرنامج التدريبي',
            action: handleStartTraining,
            primary: screeningComplete,
          },
          {
            step: '٣',
            title: 'التقرير الشامل',
            status: reportStatusText,
            done: Boolean(profile && Object.keys(session?.results ?? {}).length > 0),
            paused: Boolean(session && Object.keys(session.results).length === 0),
            desc:
              'يعرض المهام المكتملة والمحفوظة مؤقتًا، وما أتقنه الطفل، وما يحتاج إلى تدريب، وتفاصيل القراءة كلمةً كلمة.',
            cta: session ? 'انتقل إلى التقرير أدناه' : 'ابدأ الفحص أولًا',
            action: () => {
              if (session) {
                document.getElementById('child-report')?.scrollIntoView({ behavior: 'smooth' });
              } else {
                handleStartScreening();
              }
            },
            primary: false,
          },
        ].map((card) => (
          <div
            key={card.step}
            className={`bz-card bz-card-pad flex flex-col justify-between gap-5 ${
              card.primary ? 'border-2 border-brand' : ''
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="w-8 h-8 rounded-xl bg-brand-soft text-brand font-black flex items-center justify-center bz-num">
                  {card.step}
                </span>
                <span
                  className={`bz-badge ${
                    card.done
                      ? 'bz-badge-brand'
                      : card.paused
                        ? 'bz-badge-warn'
                        : 'bz-badge-neutral'
                  }`}
                >
                  {card.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : card.paused ? (
                    <PauseCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  {card.status}
                </span>
              </div>
              <h2 className="bz-h3">{card.title}</h2>
              <p className="bz-small text-ink-2">{card.desc}</p>
            </div>

            <button
              type="button"
              onClick={card.action}
              className={`bz-btn ${card.primary ? 'bz-btn-primary' : 'bz-btn-secondary'} w-full justify-center`}
            >
              <Play className="w-4 h-4" />
              {card.cta}
            </button>
          </div>
        ))}
      </section>

      {/* Full Report Section */}
      <section id="child-report" className="space-y-4">
        {profile && session ? (
          <ProfileReportView
            profile={profile}
            session={session}
            embedded
            onBack={handleStartScreening}
            onStartTraining={handleStartTraining}
          />
        ) : (
          <div className="bz-card bz-card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="bz-h3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand" />
                التقرير الشامل لـ {student.name}
              </h2>
              <p className="bz-small text-ink-2">
                ابدأ الفحص التأسيسي ليظهر التقرير الشامل وتفاصيل أداء كل مهمة وخطة التدريب المقترحة هنا مباشرة.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartScreening}
              className="bz-btn bz-btn-primary shrink-0"
            >
              <Sparkles className="w-4 h-4" /> ابدأ الفحص الآن
            </button>
          </div>
        )}
      </section>

      {/* Secondary practice tools */}
      {(onOpenReader || onOpenGames || onOpenParentPortal) && (
        <section className="bz-card-quiet p-5 flex flex-wrap items-center justify-between gap-3">
          <span className="bz-small font-semibold text-ink-2">أنشطة مساندة اختيارية:</span>
          <div className="flex flex-wrap gap-2">
            {onOpenReader && (
              <button type="button" onClick={onOpenReader} className="bz-btn bz-btn-ghost bz-btn-sm">
                <BookOpen className="w-4 h-4" /> القارئ التكيّفي
              </button>
            )}
            {onOpenGames && (
              <button type="button" onClick={onOpenGames} className="bz-btn bz-btn-ghost bz-btn-sm">
                <Gamepad2 className="w-4 h-4" /> ألعاب الطلاقة المساندة
              </button>
            )}
            {onOpenParentPortal && (
              <button type="button" onClick={onOpenParentPortal} className="bz-btn bz-btn-ghost bz-btn-sm">
                <UserCheck className="w-4 h-4" /> سجل الملاحظات والمشاركة
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default ChildDashboard;
