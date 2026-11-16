import { toArabicNum } from '../utils/arabicDigits';
import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, CheckCircle2, CircleHelp, Lightbulb, RotateCcw, Volume2, Sparkles, ChevronDown, Info,
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
  reading: 'مسار القراءة والوعي الصوتي',
};

const normalizeGrade = (gradeLevel: number) => Math.min(6, Math.max(1, Math.round(gradeLevel || 1)));

const INITIAL_ATTEMPT_HELP = 'اقرأ السؤال مرة أخرى، ثم استخدم التلميح. يمكنك إعادة المحاولة قبل إظهار الحل.';

function LessonVisual({ lesson }: { lesson: CurriculumLesson }) {
  if (lesson.id === 'phonological-awareness') {
    return (
      <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-center space-y-3" aria-label="مثال على سماع الصوت الأول في الكلمة">
        <p className="text-xs font-black text-teal-950">ما أول صوت نسمعه في كلمة «فَمٌ»؟</p>
        <div className="flex items-center justify-center gap-2" dir="rtl">
          <span className="rounded-xl border-2 border-teal-500 bg-teal-600 px-5 py-3 text-3xl font-black text-white">فَ</span>
          <span className="rounded-xl border border-teal-200 bg-white px-5 py-3 text-3xl font-black text-teal-900">مٌ</span>
        </div>
        <p className="text-xs text-slate-600">نسمع صوت الفاء في بداية الكلمة. جرّب أن تقول الصوت وحده.</p>
      </div>
    );
  }

  if (lesson.id === 'short-vowel-decoding') {
    return (
      <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center space-y-3" aria-label="مثال على الحركات القصيرة">
        <p className="text-xs font-black text-amber-950">لاحظ الفرق بين الحركات على حرف الفاء:</p>
        <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto">
          <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-xs">
            <span className="text-2xl font-black text-amber-800">فَ</span>
            <strong className="block text-xs text-slate-800 mt-1">الفَتْحَة</strong>
          </div>
          <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-xs">
            <span className="text-2xl font-black text-amber-800">فُ</span>
            <strong className="block text-xs text-slate-800 mt-1">الضَّمَّة</strong>
          </div>
          <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-xs">
            <span className="text-2xl font-black text-amber-800">فِ</span>
            <strong className="block text-xs text-slate-800 mt-1">الكَسْرَة</strong>
          </div>
        </div>
      </div>
    );
  }

  if (lesson.id === 'syllable-blending') {
    return (
      <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50 p-4 text-center space-y-3" aria-label="نموذج دمج مقطعين">
        <p className="text-xs font-black text-purple-950">نصل المقطعين لتكوين كلمة:</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="px-3 py-2 bg-white rounded-xl border border-purple-300 font-black text-lg text-purple-800 shadow-xs">مَسْ</span>
          <span className="text-purple-400 font-bold">+</span>
          <span className="px-3 py-2 bg-white rounded-xl border border-purple-300 font-black text-lg text-purple-800 shadow-xs">جِدْ</span>
          <span className="text-purple-600 font-bold text-lg">←</span>
          <span className="px-4 py-2 bg-purple-600 text-white rounded-xl font-black text-lg shadow-sm">مَسْجِدْ</span>
        </div>
        <p className="text-xs text-slate-600">اقرأ «مَسْ» ثم «جِدْ»، وبعدها اقرأ الكلمة كاملة.</p>
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
    setShowTeachingModel(true);
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
              <span>درس اليوم</span>
            </div>
            <h2 id="evidence-curriculum-title" className="text-xl sm:text-2xl font-black text-slate-900">
              نتعلّم المهارة خطوةً خطوة
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-500 mt-0.5">
              شاهد المثال، ثم جرّب بنفسك.
            </p>
          </div>
        </div>

      </header>



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
            {isRoundComplete ? 'اكتملت الجولة' : `${toArabicNum(roundQuestions.length)} أسئلة`}
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
                    السؤال {toArabicNum(questionIndex + 1)} من {toArabicNum(roundQuestions.length)}
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
                    <span className="text-xs font-bold text-teal-900">استمع جيدًا ثم ركّز على أول صوت تسمعه.</span>
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
                    ? 'أحسنت! نجحت في هذه الجولة. نواصل التدرّب خطوةً خطوة.'
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

      <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-bold text-slate-700">
          معلومة لولي الأمر
        </summary>
        <p className="mt-3 border-t border-slate-200 pt-3 text-sm leading-6 text-slate-600">
          يعرض التطبيق شرحًا ومثالًا، ثم يتيح للطفل المحاولة مع تلميح وتصحيح فوري. نتيجة الجولة تساعد على اختيار التدريب التالي، ولا تمثل تشخيصًا أو مقارنة معيارية.
        </p>
        {showVerifiedWords && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="text-sm font-bold text-slate-800">كلمات مقترحة للممارسة</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              استُخرجت من تقييم صوتي مكتمل؛ وقد تؤثر اللهجة أو دقة التعرف الصوتي في المطابقة.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {student.problematicWords.slice(0, 6).map((word, index) => (
                <button
                  key={word + '-' + index}
                  type="button"
                  onClick={() => onSpeak?.(word)}
                  disabled={!onSpeak}
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 disabled:opacity-60"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        )}
      </details>
    </section>
  );
};

export default EvidenceBasedCurriculumView;
