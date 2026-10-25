import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Calculator, CheckCircle2, CircleHelp, Lightbulb, RotateCcw, Volume2 } from 'lucide-react';
import { StudentRecord } from '../data/seedData';
import {
  CurriculumDomain,
  CurriculumLesson,
  CurriculumQuestion,
  CurriculumSkillId,
  getCurriculumLesson,
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

export const EvidenceBasedCurriculumView: React.FC<Props> = ({ student, onSpeak }) => {
  const [domain, setDomain] = useState<CurriculumDomain>('reading');
  const initialRecommendation = useMemo(
    () => recommendCurriculumSkill(student, 'reading'),
    [student],
  );
  const [skillId, setSkillId] = useState<CurriculumSkillId>(initialRecommendation.skillId);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showTeachingModel, setShowTeachingModel] = useState(true);

  const recommendation = useMemo(
    () => recommendCurriculumSkill(student, domain),
    [student, domain],
  );
  const lesson: CurriculumLesson | null = getCurriculumLesson(domain, skillId);
  const question: CurriculumQuestion | undefined = lesson?.questions[questionIndex];
  const selectedAnswer = question ? answers[question.id] : undefined;
  const answered = typeof selectedAnswer === 'number';
  const isRoundComplete = Boolean(lesson && questionIndex >= lesson.questions.length);
  const score = lesson
    ? lesson.questions.reduce((total, item) => total + (answers[item.id] === item.correctIndex ? 1 : 0), 0)
    : 0;
  const masteredThisRound = Boolean(lesson && isFormativeMastery(score, lesson.questions.length));
  const grade = normalizeGrade(student.gradeLevel);

  useEffect(() => {
    setDomain('reading');
    setSkillId(recommendCurriculumSkill(student, 'reading').skillId);
    setQuestionIndex(0);
    setAnswers({});
    setShowTeachingModel(true);
  }, [student.id]);

  useEffect(() => {
    setSkillId(recommendCurriculumSkill(student, domain).skillId);
    setQuestionIndex(0);
    setAnswers({});
    setShowTeachingModel(true);
  }, [domain, student.id]);

  const startLesson = (nextSkill: CurriculumSkillId) => {
    setSkillId(nextSkill);
    setQuestionIndex(0);
    setAnswers({});
    setShowTeachingModel(true);
  };

  const chooseDomain = (nextDomain: CurriculumDomain) => {
    if (nextDomain === domain) return;
    setDomain(nextDomain);
    setSkillId(recommendCurriculumSkill(student, nextDomain).skillId);
    setQuestionIndex(0);
    setAnswers({});
    setShowTeachingModel(true);
  };

  const chooseAnswer = (index: number) => {
    if (!question || answered) return;
    setAnswers((previous) => ({ ...previous, [question.id]: index }));
  };

  const goNextQuestion = () => {
    if (!lesson || !answered) return;
    if (questionIndex < lesson.questions.length - 1) {
      setQuestionIndex((previous) => previous + 1);
      setShowTeachingModel(false);
    } else {
      setQuestionIndex(lesson.questions.length);
      setShowTeachingModel(false);
    }
  };

  const nextSkill = lesson ? getNextCurriculumSkill(domain, lesson.id, grade) : null;
  const showVerifiedWords = !student.isDemoRecord &&
    student.sessionStatus === 'completed' &&
    student.evidenceProvenance === 'server-verified-audio' &&
    student.aiAssessmentVerified === true &&
    Array.isArray(student.problematicWords) &&
    student.problematicWords.length > 0;

  return (
    <section className="space-y-5 rounded-3xl border-2 border-teal-200 bg-gradient-to-b from-white to-teal-50/40 p-4 sm:p-6 shadow-sm" dir="rtl" aria-labelledby="evidence-curriculum-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-black text-teal-900">
            <BookOpen size={15} aria-hidden="true" />
            مسار تعليمي متدرّج
          </div>
          <h2 id="evidence-curriculum-title" className="text-xl sm:text-2xl font-black text-slate-900">
            نتعلّم المهارة خطوةً خطوة
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            يختار بصيرة هدف التدريب من الأدلة التعليمية المسجلة إن توفرت؛ وإلا يبدأ بنشاط تأسيسي. هذه توصية للتعلّم وليست تشخيصًا أو حكمًا ثابتًا على قدرة الطفل.
          </p>
        </div>
        <span className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
          الصف {grade}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(['reading', 'math'] as const).map((item) => {
          const active = item === domain;
          const Icon = item === 'reading' ? BookOpen : Calculator;
          return (
            <button
              key={item}
              type="button"
              onClick={() => chooseDomain(item)}
              aria-pressed={active}
              className={'flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-sm font-black transition ' + (
                active ? 'border-teal-600 bg-teal-700 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'
              )}
            >
              <Icon size={18} aria-hidden="true" />
              {DOMAIN_LABELS[item]}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(230px,1fr)]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-teal-800">الدرس المقترح</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">{lesson?.title ?? 'نشاط تعلّم'}</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              {isRoundComplete ? 'اكتملت الجولة' : 'جولة قصيرة'}
            </span>
          </div>

          {lesson && (
            <>
              <p className="mt-2 text-sm leading-6 text-slate-700">{lesson.objective}</p>
              <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="flex items-center gap-2 text-sm font-black text-sky-950">
                    <Lightbulb size={16} aria-hidden="true" />
                    تعلّم المثال أولًا
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowTeachingModel((value) => !value)}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-sky-800 hover:bg-sky-100"
                    aria-expanded={showTeachingModel}
                  >
                    {showTeachingModel ? 'إخفاء' : 'عرض المثال'}
                  </button>
                </div>
                {showTeachingModel && (
                  <div className="mt-2 space-y-2 text-sm leading-6 text-sky-950">
                    <p>{lesson.model}</p>
                    <p className="rounded-lg bg-white/80 p-3">{lesson.guidedPractice}</p>
                    {onSpeak && question?.stimulus && (
                      <button
                        type="button"
                        onClick={() => onSpeak(question.stimulus || '')}
                        className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100"
                      >
                        <Volume2 size={15} aria-hidden="true" />
                        استمع إلى المثال
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!isRoundComplete && question && (
                <div className="mt-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-black text-slate-900">جرّب بنفسك</h4>
                    <span className="text-xs font-bold text-slate-500">السؤال {questionIndex + 1} من {lesson.questions.length}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-label={'تقدم الجولة ' + (questionIndex + 1) + ' من ' + lesson.questions.length}>
                    <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: (((questionIndex + 1) / lesson.questions.length) * 100) + '%' }} />
                  </div>

                  {question.stimulus && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-xs font-bold text-slate-500">انظر إلى المثال</p>
                      <p className="mt-1 text-2xl font-black tracking-wide text-slate-900">{question.stimulus}</p>
                    </div>
                  )}
                  {typeof question.dotCount === 'number' && (
                    <div className="mx-auto mt-4 grid w-fit max-w-full grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3" aria-label={'مجموعة من ' + question.dotCount + ' نقاط'}>
                      {Array.from({ length: question.dotCount }, (_, index) => (
                        <span key={index} className="h-5 w-5 rounded-full border-2 border-amber-400 bg-amber-300 shadow-sm" aria-hidden="true" />
                      ))}
                    </div>
                  )}
                  <p className="mt-4 text-base font-black leading-7 text-slate-900">{question.prompt}</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {question.options.map((option, index) => {
                      const isChosen = selectedAnswer === index;
                      const isCorrectChoice = answered && index === question.correctIndex;
                      const isWrongChoice = isChosen && answered && index !== question.correctIndex;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => chooseAnswer(index)}
                          disabled={answered}
                          aria-pressed={isChosen}
                          className={'min-h-12 rounded-xl border-2 px-3 py-3 text-sm font-bold transition ' + (
                            isCorrectChoice ? 'border-emerald-500 bg-emerald-50 text-emerald-900' :
                            isWrongChoice ? 'border-rose-400 bg-rose-50 text-rose-900' :
                            'border-slate-200 bg-white text-slate-800 hover:border-teal-400 disabled:cursor-not-allowed disabled:opacity-60'
                          )}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>

                  {answered && (
                    <div className={'mt-4 rounded-xl border p-3 text-sm leading-6 ' + (
                      selectedAnswer === question.correctIndex ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-200 bg-amber-50 text-amber-950'
                    )} role="status" aria-live="polite">
                      <p className="flex items-center gap-2 font-black">
                        {selectedAnswer === question.correctIndex ? <CheckCircle2 size={17} /> : <CircleHelp size={17} />}
                        {selectedAnswer === question.correctIndex ? 'إجابة صحيحة' : 'لنجرّب طريقة أخرى'}
                      </p>
                      <p className="mt-1">{selectedAnswer === question.correctIndex ? question.feedbackCorrect : question.scaffold}</p>
                      {selectedAnswer !== question.correctIndex && <p className="mt-1 font-semibold">{lesson.retryGuidance}</p>}
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={goNextQuestion}
                      disabled={!answered}
                      className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-black text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {questionIndex === lesson.questions.length - 1 ? 'عرض نتيجة الجولة' : 'السؤال التالي'}
                    </button>
                  </div>
                </div>
              )}

              {isRoundComplete && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-lg font-black text-slate-900">نتيجة هذه الجولة: {score} من {lesson.questions.length}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {masteredThisRound
                      ? 'أجبت عن أسئلة الجولة الثلاثة بصورة صحيحة. هذا نجاح في هذه الجولة فقط؛ لا يثبت إتقانًا مستمرًا أو معيارًا عمريًا.'
                      : 'هذه الجولة توضح ما نجح في هذا النشاط وما يحتاج إلى مزيد من التدريب. سنعيد المثال ونوفّر محاولة أخرى.'}
                  </p>
                  {masteredThisRound ? (
                    <button
                      type="button"
                      onClick={() => nextSkill && startLesson(nextSkill)}
                      disabled={!nextSkill || nextSkill === lesson.id}
                      className="mt-4 w-full rounded-xl bg-teal-700 px-5 py-3 text-sm font-black text-white hover:bg-teal-800 disabled:opacity-50"
                    >
                      الانتقال إلى المهارة التالية
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startLesson(lesson.id)}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-teal-700 bg-white px-5 py-3 text-sm font-black text-teal-800 hover:bg-teal-50"
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                      أعد التدريب مع المثال
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
            <p className="mt-2 text-sm leading-6 text-slate-700">{recommendation.reasonAr}</p>
            <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{recommendation.evidenceAr}</p>
          </div>

          {showVerifiedWords && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="text-sm font-black text-amber-950">كلمات لإعادة الممارسة</h4>
              <p className="mt-1 text-xs leading-5 text-amber-900">
                ظهرت هذه الكلمات في نتيجة صوتية آلية مكتملة؛ قد يؤثر التعرف الصوتي أو اللهجة في مطابقة الكلمات. نستخدمها اقتراحًا للتدريب لا دليلًا تشخيصيًا.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {student.problematicWords.slice(0, 6).map((word, index) => (
                  <button
                    key={word + '-' + index}
                    type="button"
                    onClick={() => onSpeak?.(word)}
                    disabled={!onSpeak}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-950 disabled:opacity-60"
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
              <li><span className="font-black">القراءة:</span> الوعي بالأصوات ← ربط الصوت بالحرف ← قراءة الحركات والمقاطع ← النص المتصل ← الفهم.</li>
              <li><span className="font-black">الحساب:</span> الكمية ← رمز العدد ← المقارنة وخط الأعداد ← القيمة المكانية ← العمليات والمسائل.</li>
            </ol>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              استُخدمت قواعد توجيه أولية قابلة للتعديل؛ ليست هذه الحدود معايير تشخيص أو تقديرات معيارية. يلزم اختبار المحتوى مع أطفال ناطقين بالعربية ومراجعين متخصصين قبل ادعاء الفاعلية.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default EvidenceBasedCurriculumView;
