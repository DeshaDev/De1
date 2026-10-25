import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Calculator, CheckCircle2, CircleHelp, Lightbulb, RotateCcw, Volume2,
} from 'lucide-react';
import { StudentRecord } from '../data/seedData';
import {
  CurriculumDomain,
  CurriculumLesson,
  CurriculumQuestion,
  CurriculumSkillId,
  getCurriculumLesson,
  getCurriculumOptionOrder,
  getCurriculumRoundQuestions,
  getNextCurriculumSkill,
  isFormativeMastery,
  recommendCurriculumSkill,
} from '../utils/evidenceBasedCurriculum';

interface Props {
  student: StudentRecord;
  onSpeak?: (text: string) => void;
}

const DOMAIN_LABELS: Record<CurriculumDomain, string> = {
  reading: 'مسار القراءة',
  math: 'مسار الحساب',
};

const normalizeGrade = (gradeLevel: number) => Math.min(6, Math.max(1, Math.round(gradeLevel || 1)));

const INITIAL_ATTEMPT_HELP = 'اقرأ السؤال مرة أخرى، ثم استخدم التلميح. يمكنك إعادة المحاولة قبل إظهار الحل.';

function LessonVisual({ lesson }: { lesson: CurriculumLesson }) {
  if (lesson.id === 'magnitude-number-line') {
    return (
      <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4" aria-label="تمثيل بصري لخط الأعداد من صفر إلى عشرة">
        <p className="mb-3 text-center text-xs font-black text-sky-950">خط الأعداد: تزداد القيم في اتجاه السهم</p>
        <div dir="ltr" className="relative px-1 pt-1">
          <div className="absolute left-2 right-2 top-[17px] h-1 rounded-full bg-sky-400" />
          <div className="relative grid grid-cols-11 gap-0">
            {Array.from({ length: 11 }, (_, index) => (
              <div key={index} className="flex min-w-0 flex-col items-center gap-2">
                <span className="z-10 h-3.5 w-1 rounded-full bg-sky-700" aria-hidden="true" />
                <span className="text-xs font-bold tabular-nums text-slate-800">{index.toLocaleString('ar-EG')}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-end text-sky-800" aria-hidden="true">→</div>
        </div>
        <p className="mt-2 text-center text-xs leading-5 text-slate-600">ابدأ من الصفر، وحدد المنتصف، ثم قارن المسافة بين الأعداد.</p>
      </div>
    );
  }

  if (lesson.id === 'place-value') {
    return (
      <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
        <p className="mb-3 text-center text-sm font-black text-amber-950">٣٦ = ٣ عشرات + ٦ آحاد</p>
        <div className="flex flex-wrap items-end justify-center gap-5" aria-label="تمثيل العدد ستة وثلاثين بثلاث عشرات وستة آحاد">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-end gap-1">
              {Array.from({ length: 3 }, (_, rod) => (
                <div key={rod} className="flex flex-col gap-0.5 rounded-md border border-sky-400 bg-sky-100 p-1" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, unit) => (
                    <span key={unit} className="h-2.5 w-4 rounded-sm border border-sky-500 bg-sky-300" />
                  ))}
                </div>
              ))}
            </div>
            <span className="text-xs font-bold text-sky-950">٣ عشرات = ٣٠</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="grid grid-cols-3 gap-1.5 rounded-md bg-white p-1.5">
              {Array.from({ length: 6 }, (_, unit) => (
                <span key={unit} className="h-4 w-4 rounded-sm border border-amber-500 bg-amber-300" aria-hidden="true" />
              ))}
            </div>
            <span className="text-xs font-bold text-amber-950">٦ آحاد = ٦</span>
          </div>
        </div>
      </div>
    );
  }

  if (lesson.id === 'addition-subtraction') {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="text-center text-sm font-black text-emerald-950">نُكمل العشرة ثم نضيف الباقي</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm font-black text-slate-800">
          <span className="rounded-lg bg-white px-3 py-2">٩ + ١ = ١٠</span>
          <span aria-hidden="true">←</span>
          <span className="rounded-lg bg-white px-3 py-2">١٠ + ١ = ١١</span>
        </div>
        <p className="mt-2 text-center text-xs leading-5 text-slate-600">قسّم العدد لتصل إلى عشرة، ثم أضف ما تبقّى. يمكن استخدام الطريقة نفسها في الطرح بالعودة إلى عشرة.</p>
      </div>
    );
  }

  if (lesson.id === 'multiplication-division') {
    return (
      <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4">
        <p className="text-center text-sm font-black text-violet-950">مجموعتان متساويتان: ٢ × ٤ = ٨</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          {[0, 1].map((group) => (
            <div key={group} className="flex min-w-24 flex-col items-center rounded-xl border border-violet-200 bg-white p-3">
              <span className="mb-2 text-xs font-bold text-violet-900">المجموعة {group + 1}</span>
              <div className="grid grid-cols-2 gap-2" aria-hidden="true">
                {Array.from({ length: 4 }, (_, dot) => (
                  <span key={dot} className="h-4 w-4 rounded-full border border-violet-500 bg-violet-300" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-xs leading-5 text-slate-600">الضرب يجمع مجموعات متساوية؛ والقسمة توزّع كمية إلى مجموعات أو حصص متساوية.</p>
      </div>
    );
  }

  if (lesson.id === 'fractions') {
    return (
      <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-4">
        <p className="text-center text-sm font-black text-rose-950">الكل نفسه، مقسّم إلى أجزاء متساوية</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: '١/٢', cells: 2, filled: 1 },
            { label: '١/٤', cells: 4, filled: 1 },
          ].map((bar) => (
            <div key={bar.label} className="rounded-xl border border-rose-200 bg-white p-2">
              <div className="flex gap-1" aria-label={bar.label}>
                {Array.from({ length: bar.cells }, (_, index) => (
                  <span key={index} className={'h-8 min-w-0 flex-1 rounded-sm border ' + (index < bar.filled ? 'border-rose-500 bg-rose-300' : 'border-slate-300 bg-slate-100')} aria-hidden="true" />
                ))}
              </div>
              <p className="mt-1 text-center text-xs font-black text-slate-800">{bar.label}</p>
            </div>
          ))}
          <div className="col-span-2 flex items-center justify-center rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold leading-5 text-rose-950 sm:col-span-2">
            يجب أن تكون الأجزاء متساوية حتى نمثل الكل بكسر صحيح.
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export const EvidenceBasedCurriculumView: React.FC<Props> = ({ student, onSpeak }) => {
  const [domain, setDomain] = useState<CurriculumDomain>('reading');
  const [skillId, setSkillId] = useState<CurriculumSkillId>(() => recommendCurriculumSkill(student, 'reading').skillId);
  const [roundNumber, setRoundNumber] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [firstAnswers, setFirstAnswers] = useState<Record<string, number>>({});
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [showTeachingModel, setShowTeachingModel] = useState(true);

  const recommendation = useMemo(() => recommendCurriculumSkill(student, domain), [student, domain]);
  const lesson: CurriculumLesson | null = getCurriculumLesson(domain, skillId);
  const roundQuestions = useMemo(
    () => lesson ? getCurriculumRoundQuestions(lesson, roundNumber) : [],
    [lesson, roundNumber],
  );
  const question: CurriculumQuestion | undefined = roundQuestions[questionIndex];
  const selectedAnswer = question ? answers[question.id] : undefined;
  const answered = typeof selectedAnswer === 'number';
  const attemptCount = question ? (attemptCounts[question.id] ?? 0) : 0;
  const answerRevealed = question ? revealedAnswers[question.id] === true : false;
  const canAdvance = Boolean(question && answered && (selectedAnswer === question.correctIndex || answerRevealed));
  const isRoundComplete = Boolean(lesson && questionIndex >= roundQuestions.length);
  const score = roundQuestions.reduce(
    (total, item) => total + (firstAnswers[item.id] === item.correctIndex ? 1 : 0),
    0,
  );
  const passedThisRound = Boolean(roundQuestions.length && isFormativeMastery(score, roundQuestions.length));
  const grade = normalizeGrade(student.gradeLevel);
  const isRecommendedLesson = lesson?.id === recommendation.skillId;
  const optionOrder = useMemo(
    () => question ? getCurriculumOptionOrder(question, roundNumber) : [],
    [question, roundNumber],
  );

  const clearRound = () => {
    setQuestionIndex(0);
    setAnswers({});
    setFirstAnswers({});
    setAttemptCounts({});
    setRevealedAnswers({});
    setShowTeachingModel(true);
  };

  useEffect(() => {
    setDomain('reading');
    setSkillId(recommendCurriculumSkill(student, 'reading').skillId);
    setRoundNumber((value) => value + 1);
    setQuestionIndex(0);
    setAnswers({});
    setFirstAnswers({});
    setAttemptCounts({});
    setRevealedAnswers({});
    setShowTeachingModel(true);
  }, [student.id]);

  const startLesson = (nextSkill: CurriculumSkillId) => {
    setSkillId(nextSkill);
    setRoundNumber((value) => value + 1);
    clearRound();
  };

  const chooseDomain = (nextDomain: CurriculumDomain) => {
    if (nextDomain === domain) return;
    setDomain(nextDomain);
    setSkillId(recommendCurriculumSkill(student, nextDomain).skillId);
    setRoundNumber((value) => value + 1);
    clearRound();
  };

  const chooseAnswer = (originalIndex: number) => {
    if (!question || answered || isRoundComplete) return;
    setAnswers((previous) => ({ ...previous, [question.id]: originalIndex }));
    setFirstAnswers((previous) => Object.prototype.hasOwnProperty.call(previous, question.id)
      ? previous
      : { ...previous, [question.id]: originalIndex });
    setAttemptCounts((previous) => ({ ...previous, [question.id]: (previous[question.id] ?? 0) + 1 }));
  };

  const retryQuestion = () => {
    if (!question) return;
    setAnswers((previous) => {
      const next = { ...previous };
      delete next[question.id];
      return next;
    });
    setShowTeachingModel(true);
  };

  const revealAnswer = () => {
    if (!question) return;
    setRevealedAnswers((previous) => ({ ...previous, [question.id]: true }));
  };

  const goNextQuestion = () => {
    if (!question || !canAdvance) return;
    setQuestionIndex((previous) => previous + 1);
    setShowTeachingModel(false);
  };

  const nextSkill = lesson ? getNextCurriculumSkill(domain, lesson.id, grade) : null;
  const showVerifiedWords = !student.isDemoRecord &&
    student.sessionStatus === 'completed' &&
    student.evidenceProvenance === 'server-verified-audio' &&
    student.aiAssessmentVerified === true &&
    Array.isArray(student.problematicWords) &&
    student.problematicWords.length > 0;

  return (
    <section className="space-y-5 rounded-3xl border border-teal-200 bg-white p-4 shadow-sm sm:p-6" dir="rtl" aria-labelledby="evidence-curriculum-title">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-black text-teal-900">
            <BookOpen size={15} aria-hidden="true" />
            منهج تدريبي متدرّج
          </div>
          <h2 id="evidence-curriculum-title" className="text-xl font-black leading-8 text-slate-900 sm:text-2xl">
            نتعلّم المهارة خطوةً خطوة
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            شرح قصير، ثم تمرين، ثم تلميح عند الحاجة. يرشّح بصيرة نشاطًا بناءً على نتائج المهام المتاحة؛ ولا يحوّل جولة قصيرة إلى حكم على قدرة الطفل.
          </p>
        </div>
        <span className="shrink-0 self-start rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
          الصف {grade}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3" role="group" aria-label="اختر مجال التدريب">
        {(['reading', 'math'] as const).map((item) => {
          const active = item === domain;
          const Icon = item === 'reading' ? BookOpen : Calculator;
          return (
            <button
              key={item}
              type="button"
              onClick={() => chooseDomain(item)}
              aria-pressed={active}
              className={'flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ' + (
                active ? 'border-teal-700 bg-teal-700 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-400'
              )}
            >
              <Icon size={18} aria-hidden="true" />
              {DOMAIN_LABELS[item]}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,1fr)]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-teal-800">نشاط التدريب</p>
              <h3 className="mt-1 text-lg font-black leading-7 text-slate-900">{lesson?.title ?? 'نشاط تعلّم'}</h3>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
              {isRoundComplete ? 'اكتملت الجولة' : '٣ أسئلة'}
            </span>
          </div>

          {lesson && (
            <>
              <p className="mt-2 text-sm leading-6 text-slate-700">{lesson.objective}</p>
              <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="flex items-center gap-2 text-sm font-black text-sky-950">
                    <Lightbulb size={16} aria-hidden="true" />
                    تعلّم المثال
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowTeachingModel((value) => !value)}
                    className="min-h-10 rounded-lg px-3 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                    aria-expanded={showTeachingModel}
                    aria-controls="curriculum-teaching-model"
                  >
                    {showTeachingModel ? 'إخفاء المثال' : 'عرض المثال'}
                  </button>
                </div>
                {showTeachingModel && (
                  <div id="curriculum-teaching-model" className="mt-2 space-y-2 text-sm leading-7 text-sky-950">
                    <p>{lesson.model}</p>
                    <p className="rounded-lg bg-white p-3">{lesson.guidedPractice}</p>
                  </div>
                )}
              </div>

              <LessonVisual lesson={lesson} />

              {!isRoundComplete && question && (
                <div className="mt-5" aria-labelledby="curriculum-question-title">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 id="curriculum-question-title" className="text-sm font-black text-slate-900">جرّب بنفسك</h4>
                    <span className="text-xs font-bold tabular-nums text-slate-600">السؤال {questionIndex + 1} من {roundQuestions.length}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="تقدم الجولة" aria-valuemin={0} aria-valuemax={roundQuestions.length} aria-valuenow={questionIndex + 1}>
                    <div className="h-full rounded-full bg-teal-700 transition-all" style={{ width: (((questionIndex + 1) / roundQuestions.length) * 100) + '%' }} />
                  </div>

                  {question.stimulus && !question.hideStimulus && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-center">
                      <p className="text-xs font-bold text-slate-500">مثال مكتوب</p>
                      <p className="mt-1 text-2xl font-black tracking-wide text-slate-900" lang="ar">{question.stimulus}</p>
                    </div>
                  )}

                  {typeof question.dotCount === 'number' && (
                    <div className="mx-auto mt-4 flex w-fit max-w-full flex-wrap justify-center gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3" role="img" aria-label={'مجموعة من ' + question.dotCount.toLocaleString('ar-EG') + ' نقاط'}>
                      {Array.from({ length: question.dotCount }, (_, index) => (
                        <span key={index} className="h-5 w-5 rounded-full border-2 border-amber-500 bg-amber-300" aria-hidden="true" />
                      ))}
                    </div>
                  )}

                  <p className="mt-4 text-base font-black leading-8 text-slate-900">{question.prompt}</p>
                  {question.hideStimulus && question.stimulus && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {onSpeak && (
                        <button
                          type="button"
                          onClick={() => onSpeak(question.stimulus || '')}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-950 hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                        >
                          <Volume2 size={17} aria-hidden="true" />
                          استمع إلى الكلمة
                        </button>
                      )}
                      <span className="text-xs leading-5 text-slate-600">ركّز على أول صوت تسمعه.</span>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {optionOrder.map((originalIndex) => {
                      const option = question.options[originalIndex];
                      const isChosen = selectedAnswer === originalIndex;
                      const showCorrect = (canAdvance || answerRevealed) && originalIndex === question.correctIndex;
                      const showWrong = isChosen && answered && selectedAnswer !== question.correctIndex && !answerRevealed;
                      return (
                        <button
                          key={question.id + '-' + originalIndex}
                          data-testid="curriculum-answer-option"
                          type="button"
                          onClick={() => chooseAnswer(originalIndex)}
                          disabled={answered || answerRevealed}
                          aria-pressed={isChosen}
                          className={'min-h-12 rounded-xl border-2 px-3 py-3 text-sm font-bold leading-6 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ' + (
                            showCorrect ? 'border-emerald-600 bg-emerald-50 text-emerald-950' :
                            showWrong ? 'border-rose-400 bg-rose-50 text-rose-950' :
                            'border-slate-200 bg-white text-slate-800 hover:border-teal-500 disabled:cursor-not-allowed disabled:opacity-80'
                          )}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>

                  {answered && (
                    <div className={'mt-4 rounded-xl border p-3 text-sm leading-6 ' + (
                      selectedAnswer === question.correctIndex || answerRevealed
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                        : 'border-amber-200 bg-amber-50 text-amber-950'
                    )} role="status" aria-live="polite">
                      <p className="flex items-center gap-2 font-black">
                        {selectedAnswer === question.correctIndex ? <CheckCircle2 size={17} aria-hidden="true" /> : <CircleHelp size={17} aria-hidden="true" />}
                        {selectedAnswer === question.correctIndex
                          ? (firstAnswers[question.id] === question.correctIndex ? 'إجابة صحيحة من المحاولة الأولى' : 'صحيح بعد إعادة المحاولة')
                          : answerRevealed ? 'الإجابة الصحيحة موضّحة' : 'لنجرّب خطوة أخرى'}
                      </p>
                      <p className="mt-1">
                        {selectedAnswer === question.correctIndex
                          ? question.feedbackCorrect
                          : answerRevealed
                            ? question.feedbackCorrect
                            : question.scaffold}
                      </p>
                      {selectedAnswer !== question.correctIndex && !answerRevealed && (
                        <p className="mt-1 font-semibold">{lesson.retryGuidance || INITIAL_ATTEMPT_HELP}</p>
                      )}
                    </div>
                  )}

                  {answered && selectedAnswer !== question.correctIndex && !answerRevealed && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      {attemptCount < 2 && (
                        <button
                          type="button"
                          onClick={retryQuestion}
                          className="min-h-11 flex-1 rounded-xl border-2 border-teal-700 bg-white px-4 py-2 text-sm font-black text-teal-900 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                        >
                          أعد المحاولة بعد التلميح
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={revealAnswer}
                        className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                      >
                        {attemptCount < 2 ? 'اعرض الإجابة ثم تابع' : 'اعرض الإجابة الصحيحة'}
                      </button>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={goNextQuestion}
                      disabled={!canAdvance}
                      className="min-h-11 rounded-xl bg-teal-800 px-5 py-3 text-sm font-black text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      {questionIndex === roundQuestions.length - 1 ? 'عرض ملخص الجولة' : 'السؤال التالي'}
                    </button>
                  </div>
                </div>
              )}

              {isRoundComplete && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4" role="status" aria-live="polite">
                  <p className="text-lg font-black text-slate-900">نتيجة الجولة: {score} من {roundQuestions.length}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">
                    {passedThisRound
                      ? 'أجبت عن الأسئلة الثلاثة من المحاولة الأولى. هذه إشارة إيجابية في الجولة الحالية؛ ويفيد الرجوع إلى المهارة في جولات لاحقة للتحقق من استمرار التعلّم.'
                      : 'استخدمت الجولة لإظهار المهارة التي تحتاج إلى مزيد من التدريب. سنعيد الشرح ونعرض مجموعة مختلفة من الأسئلة في الجولة التالية.'}
                  </p>
                  {passedThisRound ? (
                    <button
                      type="button"
                      onClick={() => nextSkill && startLesson(nextSkill)}
                      disabled={!nextSkill || nextSkill === lesson.id}
                      className="mt-4 min-h-12 w-full rounded-xl bg-teal-800 px-5 py-3 text-sm font-black text-white hover:bg-teal-900 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      الانتقال إلى التدريب التالي
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startLesson(lesson.id)}
                      className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-teal-700 bg-white px-5 py-3 text-sm font-black text-teal-900 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                      أعد التدريب مع أسئلة مختلفة
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-black text-slate-900">لماذا اخترنا هذا التدريب؟</h4>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {isRecommendedLesson ? recommendation.reasonAr : 'هذا هو التدريب التالي في تسلسل المهارات، وليس حكمًا على مستوى الطفل.'}
            </p>
            <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              {isRecommendedLesson ? recommendation.evidenceAr : 'تُستخدم نتيجة الجولة لاختيار ممارسة تعليمية تالية. لا تمثل ثلاث إجابات معيارًا عمريًا أو تشخيصًا.'}
            </p>
          </div>

          {showVerifiedWords && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="text-sm font-black text-amber-950">كلمات لإعادة الممارسة</h4>
              <p className="mt-1 text-xs leading-5 text-amber-900">
                ظهرت هذه الكلمات في تقييم صوتي مكتمل موثّق المصدر. قد يؤثر التعرف الصوتي أو اللهجة في المطابقة؛ نستخدمها اقتراحًا للممارسة فقط.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {student.problematicWords.slice(0, 6).map((word, index) => (
                  <button
                    key={word + '-' + index}
                    type="button"
                    onClick={() => onSpeak?.(word)}
                    disabled={!onSpeak}
                    className="min-h-10 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-950 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-black text-slate-900">كيف يسير المنهج؟</h4>
            <ol className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
              <li><span className="font-black">القراءة:</span> الوعي بالأصوات ← ربط الصوت بالحرف ← الحركات وفك الكلمات ← النص المتصل ← الفهم.</li>
              <li><span className="font-black">الحساب:</span> الكمية ← رمز العدد ← المقارنة وخط الأعداد ← القيمة المكانية ← العمليات والمسائل.</li>
            </ol>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              الأمثلة مكتوبة بالفصحى، وقد تختلف بعض الكلمات عن لهجة الطفل المألوفة. يساعد المعلم أو ولي الأمر في وصل الكلمة المنطوقة المألوفة بالفصحى؛ ولا ينبغي اعتبار اختلاف اللهجة وحده خطأ. النسخة الحالية لا تضبط المحتوى تلقائيًا حسب اللهجة. ثلاث إجابات تقيس الجولة الحالية فقط، ويحتاج التحقق من التعلم إلى العودة للمهارة عبر جولات لاحقة.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default EvidenceBasedCurriculumView;
