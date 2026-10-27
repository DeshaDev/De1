import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Calculator, CheckCircle2, CircleHelp, Lightbulb, RotateCcw, Volume2, Sparkles, ChevronDown, Info,
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
  onExploreGames?: () => void;
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

export const EvidenceBasedCurriculumView: React.FC<Props> = ({ student, onSpeak, onExploreGames }) => {
  const [domain, setDomain] = useState<CurriculumDomain>('reading');
  const [skillId, setSkillId] = useState<CurriculumSkillId>(() => recommendCurriculumSkill(student, 'reading').skillId);
  const [roundNumber, setRoundNumber] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [firstAnswers, setFirstAnswers] = useState<Record<string, number>>({});
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [showTeachingModel, setShowTeachingModel] = useState(false);

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
    setShowTeachingModel(false);
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
    setShowTeachingModel(false);
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
    <section className="space-y-5 max-w-3xl mx-auto" dir="rtl" aria-labelledby="evidence-curriculum-title">
      {/* 1. Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white rounded-3xl p-5 border-2 border-teal-100 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-black shrink-0 shadow-xs">
            <BookOpen size={24} aria-hidden="true" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full mb-1">
              <span>خطوة بخطوة · تدريب مخصص</span>
            </div>
            <h2 id="evidence-curriculum-title" className="text-xl sm:text-2xl font-black text-slate-900">
              نتعلّم المهارة خطوةً خطوة
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-500 mt-0.5">
              تدريب يومي سريع وممتع (٣ أسئلة فقط) لتقوية المهارة دون إرهاق.
            </p>
          </div>
        </div>
        <span className="shrink-0 self-start sm:self-center rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-xs font-black text-teal-900">
          الصف {grade}
        </span>
      </header>

      {/* 2. Domain Switcher */}
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
              className={'flex min-h-12 items-center justify-center gap-2.5 rounded-2xl border-2 px-4 py-3 text-sm font-black transition-all cursor-pointer ' + (
                active
                  ? 'border-teal-700 bg-teal-700 text-white shadow-md scale-101'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-teal-400 hover:bg-slate-50'
              )}
            >
              <Icon size={18} aria-hidden="true" />
              {DOMAIN_LABELS[item]}
            </button>
          );
        })}
      </div>

      {/* 3. Main Single-Column Focused Exercise Card */}
      <div className="rounded-3xl border-2 border-teal-100 bg-white p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              نشاط التدريب
            </span>
            <h3 className="mt-2 text-xl font-black leading-7 text-slate-900">
              {lesson?.title ?? 'نشاط تعلّم'}
            </h3>
            {lesson && (
              <p className="mt-1 text-sm font-bold text-slate-600">{lesson.objective}</p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
            {isRoundComplete ? 'اكتملت الجولة' : '٣ أسئلة'}
          </span>
        </div>

        {lesson && (
          <>
            {/* Teaching Model Collapsible Button & Banner */}
            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 text-xs sm:text-sm font-black text-sky-950">
                  <Lightbulb size={16} aria-hidden="true" />
                  <span>تعلّم الفكرة والمثال</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowTeachingModel((value) => !value)}
                  className="rounded-xl px-3 py-1.5 text-xs font-black text-sky-900 bg-white border border-sky-200 hover:bg-sky-100 transition cursor-pointer shadow-xs"
                  aria-expanded={showTeachingModel}
                  aria-controls="curriculum-teaching-model"
                >
                  {showTeachingModel ? 'إخفاء المثال ✕' : 'عرض المثال التوضيحي 💡'}
                </button>
              </div>
              {showTeachingModel && (
                <div id="curriculum-teaching-model" className="mt-3 space-y-2 text-sm leading-7 text-sky-950 border-t border-sky-200/60 pt-3">
                  <p>{lesson.model}</p>
                  <p className="rounded-xl bg-white p-3 border border-sky-100 shadow-xs">{lesson.guidedPractice}</p>
                </div>
              )}
            </div>

            <LessonVisual lesson={lesson} />

            {!isRoundComplete && question && (
              <div className="mt-5 space-y-4" aria-labelledby="curriculum-question-title">
                {/* Progress Header */}
                <div className="flex items-center justify-between gap-2">
                  <h4 id="curriculum-question-title" className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>جرّب بنفسك</span>
                  </h4>
                  <span className="text-xs font-bold tabular-nums text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                    السؤال {questionIndex + 1} من {roundQuestions.length}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 border border-slate-200" role="progressbar" aria-label="تقدم الجولة" aria-valuemin={0} aria-valuemax={roundQuestions.length} aria-valuenow={questionIndex + 1}>
                  <div className="h-full rounded-full bg-teal-600 transition-all duration-300" style={{ width: (((questionIndex + 1) / roundQuestions.length) * 100) + '%' }} />
                </div>

                {/* Stimulus Word/Number Box */}
                {question.stimulus && !question.hideStimulus && (
                  <div className="mt-4 rounded-2xl border-2 border-teal-100 bg-teal-50/40 p-5 text-center shadow-xs">
                    <span className="text-xs font-bold text-teal-800 block mb-1">اقرأ المثال:</span>
                    <p className="mt-1 text-3xl sm:text-4xl font-black tracking-wide text-slate-900 font-serif" lang="ar">
                      {question.stimulus}
                    </p>
                    {onSpeak && (
                      <button
                        type="button"
                        onClick={() => onSpeak(question.stimulus || '')}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-teal-300 text-teal-900 rounded-xl text-xs font-bold hover:bg-teal-50 shadow-xs cursor-pointer transition"
                      >
                        <Volume2 size={16} />
                        <span>استمع لنطق الكلمة</span>
                      </button>
                    )}
                  </div>
                )}

                {typeof question.dotCount === 'number' && (
                  <div className="mx-auto mt-4 flex w-fit max-w-full flex-wrap justify-center gap-2.5 rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-4 shadow-xs" role="img" aria-label={'مجموعة من ' + question.dotCount.toLocaleString('ar-EG') + ' نقاط'}>
                    {Array.from({ length: question.dotCount }, (_, index) => (
                      <span key={index} className="h-6 w-6 rounded-full border-2 border-amber-500 bg-amber-300 shadow-xs" aria-hidden="true" />
                    ))}
                  </div>
                )}

                {/* Question Prompt */}
                <div className="mt-4 flex items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-base sm:text-lg font-black leading-7 text-slate-900">{question.prompt}</p>
                  {onSpeak && (
                    <button
                      type="button"
                      onClick={() => onSpeak(question.prompt)}
                      className="shrink-0 p-2 text-slate-500 hover:text-teal-700 hover:bg-white rounded-xl transition cursor-pointer"
                      title="استمع إلى السؤال"
                    >
                      <Volume2 size={18} />
                    </button>
                  )}
                </div>

                {question.hideStimulus && question.stimulus && (
                  <div className="mt-3 flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-teal-50 border border-teal-200">
                    {onSpeak && (
                      <button
                        type="button"
                        onClick={() => onSpeak(question.stimulus || '')}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-black hover:bg-teal-800 transition shadow-xs cursor-pointer"
                      >
                        <Volume2 size={18} aria-hidden="true" />
                        استمع إلى الكلمة
                      </button>
                    )}
                    <span className="text-xs font-bold text-teal-900">استمع جيداً ثم ركّز على أول صوت تسمعه.</span>
                  </div>
                )}

                {/* 3 Answer Choice Buttons */}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                        className={'min-h-14 rounded-2xl border-2 px-4 py-3 text-base font-black leading-6 transition-all shadow-xs cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ' + (
                          showCorrect ? 'border-emerald-600 bg-emerald-50 text-emerald-950 scale-102 shadow-md' :
                          showWrong ? 'border-rose-400 bg-rose-50 text-rose-950' :
                          'border-slate-200 bg-white text-slate-800 hover:border-teal-500 hover:bg-teal-50/40 hover:scale-101 active:scale-98 disabled:cursor-not-allowed disabled:opacity-80'
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                {/* Feedback Box */}
                {answered && (
                  <div className={'mt-4 rounded-2xl border-2 p-4 text-sm leading-6 shadow-xs ' + (
                    selectedAnswer === question.correctIndex || answerRevealed
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                      : 'border-amber-300 bg-amber-50 text-amber-950'
                  )} role="status" aria-live="polite">
                    <p className="flex items-center gap-2 font-black text-base">
                      {selectedAnswer === question.correctIndex ? <CheckCircle2 size={19} className="text-emerald-600" aria-hidden="true" /> : <CircleHelp size={19} className="text-amber-600" aria-hidden="true" />}
                      {selectedAnswer === question.correctIndex
                        ? (firstAnswers[question.id] === question.correctIndex ? 'أحسنت! إجابة صحيحة 🌟' : 'رائع! إجابة موفقة بعد التفكير 👍')
                        : answerRevealed ? 'الإجابة الصحيحة موضّحة أمامك' : 'محاولة جيدة! دعنا نراجع خطوة صغيرة:'}
                    </p>
                    <p className="mt-1.5 font-bold">
                      {selectedAnswer === question.correctIndex
                        ? question.feedbackCorrect
                        : answerRevealed
                          ? question.feedbackCorrect
                          : question.scaffold}
                    </p>
                    {selectedAnswer !== question.correctIndex && !answerRevealed && (
                      <p className="mt-1 text-xs font-semibold text-amber-800">{lesson.retryGuidance || INITIAL_ATTEMPT_HELP}</p>
                    )}
                  </div>
                )}

                {/* Retry Buttons */}
                {answered && selectedAnswer !== question.correctIndex && !answerRevealed && (
                  <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
                    {attemptCount < 2 && (
                      <button
                        type="button"
                        onClick={retryQuestion}
                        className="min-h-12 flex-1 rounded-xl border-2 border-teal-700 bg-white px-4 py-2.5 text-sm font-black text-teal-900 hover:bg-teal-50 transition shadow-xs cursor-pointer"
                      >
                        حاول مرة أخرى 🔄
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={revealAnswer}
                      className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs cursor-pointer"
                    >
                      {attemptCount < 2 ? 'اعرض الإجابة ثم تابع' : 'اعرض الإجابة الصحيحة'}
                    </button>
                  </div>
                )}

                {/* Next Question Button */}
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={goNextQuestion}
                    disabled={!canAdvance}
                    className="min-h-12 rounded-2xl bg-teal-800 px-6 py-3 text-sm font-black text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40 transition shadow-sm cursor-pointer"
                  >
                    {questionIndex === roundQuestions.length - 1 ? 'عرض نتيجة الجولة 🏁' : 'السؤال التالي ⬅️'}
                  </button>
                </div>
              </div>
            )}

            {/* Round Completed Screen */}
            {isRoundComplete && (
              <div className="mt-5 rounded-3xl border-2 border-teal-200 bg-gradient-to-b from-teal-50/60 to-white p-6 text-center space-y-4 shadow-sm" role="status" aria-live="polite">
                <div className="w-16 h-16 rounded-full bg-teal-100 border-2 border-teal-300 text-teal-800 flex items-center justify-center mx-auto text-2xl font-black shadow-inner">
                  🌟
                </div>
                <h3 className="text-2xl font-black text-slate-900">
                  نتيجة الجولة: {score} من {roundQuestions.length}
                </h3>
                <p className="max-w-md mx-auto text-sm font-bold leading-6 text-slate-600">
                  {passedThisRound
                    ? 'أحسنت يا بطل! أجبت عن أسئلة الجولة بنجاح تام، وأثبت فهمك للمهارة.'
                    : 'محاولة رائعة! تدرّبنا على المهارة وسنعيد التحدي بأسئلة جديدة لترسيخ الفهم.'}
                </p>
                <div className="flex flex-col gap-3 max-w-sm mx-auto pt-2">
                  {passedThisRound ? (
                    <>
                      <button
                        type="button"
                        onClick={() => nextSkill && startLesson(nextSkill)}
                        disabled={!nextSkill || nextSkill === lesson.id}
                        className="min-h-12 w-full rounded-2xl bg-teal-800 px-5 py-3 text-sm font-black text-white hover:bg-teal-900 disabled:opacity-50 transition shadow-md cursor-pointer"
                      >
                        الانتقال إلى المهارة التالية ⬅️
                      </button>
                      {onExploreGames && (
                        <button
                          type="button"
                          onClick={onExploreGames}
                          className="min-h-12 w-full rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-900 hover:bg-emerald-100 flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          <Sparkles size={18} />
                          <span>العب في صالة ألعاب المهارات الآن! 🎮</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startLesson(lesson.id)}
                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-teal-700 bg-white px-5 py-3 text-sm font-black text-teal-900 hover:bg-teal-50 transition shadow-xs cursor-pointer"
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                        أعد التدريب مع أسئلة جديدة
                      </button>
                      {onExploreGames && (
                        <button
                          type="button"
                          onClick={onExploreGames}
                          className="min-h-12 w-full rounded-2xl border border-slate-300 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          <Sparkles size={18} />
                          <span>جرّب ألعاب المهارات للمساعدة</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. EDUCATOR & PARENT NOTES ACCORDION (Collapsible, zero distraction for the child) */}
      <details className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm group">
        <summary className="cursor-pointer text-xs font-black text-slate-600 hover:text-teal-800 flex items-center justify-between list-none">
          <span className="flex items-center gap-2">
            <Info size={16} className="text-teal-600" />
            دليل المنهج والملاحظات التعليمية (للأهل والمعلم)
          </span>
          <span className="text-xs font-bold text-teal-700">اضغط لعرض التفاصيل ▼</span>
        </summary>
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 text-xs leading-6 text-slate-700">
          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
            <h4 className="font-black text-slate-900 mb-1">لماذا اخترنا هذا التدريب؟</h4>
            <p>{isRecommendedLesson ? recommendation.reasonAr : 'هذا هو التدريب التالي في تسلسل المهارات، وليس حكمًا على مستوى الطفل.'}</p>
            <p className="mt-2 text-slate-500 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200">
              {isRecommendedLesson ? recommendation.evidenceAr : 'تُستخدم نتيجة الجولة لاختيار ممارسة تعليمية تالية. لا تمثل ثلاث إجابات معيارًا عمريًا أو تشخيصًا.'}
            </p>
          </div>

          {showVerifiedWords && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <h4 className="font-black text-amber-950 mb-1">كلمات لإعادة الممارسة</h4>
              <p className="text-xs leading-5 text-amber-900 mb-2">
                ظهرت هذه الكلمات في تقييم صوتي مكتمل موثّق المصدر. قد يؤثر التعرف الصوتي أو اللهجة في المطابقة؛ نستخدمها اقتراحًا للممارسة فقط.
              </p>
              <div className="flex flex-wrap gap-2">
                {student.problematicWords.slice(0, 6).map((word, index) => (
                  <button
                    key={word + '-' + index}
                    type="button"
                    onClick={() => onSpeak?.(word)}
                    disabled={!onSpeak}
                    className="min-h-10 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-950 disabled:opacity-60"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
            <h4 className="font-black text-slate-900 mb-2">كيف يسير المنهج؟</h4>
            <ol className="space-y-1.5 text-slate-700">
              <li><span className="font-black text-slate-900">القراءة:</span> الوعي بالأصوات ← ربط الصوت بالحرف ← الحركات وفك الكلمات ← النص المتصل ← الفهم.</li>
              <li><span className="font-black text-slate-900">الحساب:</span> الكمية ← رمز العدد ← المقارنة وخط الأعداد ← القيمة المكانية ← العمليات والمسائل.</li>
            </ol>
            <p className="mt-3 text-[11px] leading-5 text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200">
              الأمثلة مكتوبة بالفصحى، وقد تختلف بعض الكلمات عن لهجة الطفل المألوفة. يساعد المعلم أو ولي الأمر في وصل الكلمة المنطوقة المألوفة بالفصحى؛ ولا ينبغي اعتبار اختلاف اللهجة وحده خطأ. النسخة الحالية لا تضبط المحتوى تلقائيًا حسب اللهجة. ثلاث إجابات تقيس الجولة الحالية فقط، ويحتاج التحقق من التعلم إلى العودة للمهارة عبر جولات لاحقة.
            </p>
          </div>
        </div>
      </details>
    </section>
  );
};

export default EvidenceBasedCurriculumView;
