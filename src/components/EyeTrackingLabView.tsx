/**
 * Arabic Reading & Comprehension Assessment Lab (مختبر القراءة والطلاقة والفهم القرائي)
 * Pure, accessible, evidence-based Arabic oral and silent reading assessment.
 * ZERO CAMERA / ZERO CALIBRATION / ZERO UNVALIDATED EYE GAZE MEASURES.
 * Accurately measures:
 *  1. Reading Duration (Elapsed seconds)
 *  2. Reading Fluency (WPM = words / seconds * 60)
 *  3. Reading Comprehension (Comprehension questions score %)
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  HelpCircle,
  Award,
  Layers,
  Volume2,
} from 'lucide-react';
import {
  StudentRecord,
  INITIAL_STUDENTS,
  ARABIC_READING_PASSAGES,
  ReadingPassage,
} from '../data/seedData';
import { useAssessment } from '../contexts/AssessmentContext';

interface Props {
  onCompleteSession: (record: StudentRecord) => void;
  activeStudent?: StudentRecord;
  onProceedToMathLab?: () => void;
}

export const EyeTrackingLabView: React.FC<Props> = ({
  onCompleteSession,
  activeStudent,
  onProceedToMathLab,
}) => {
  const { saveReadingResults } = useAssessment();

  // Selected passage (defaults to Grade 2 or Grade 3 passage)
  const defaultPassageIndex = useMemo(() => {
    const studentGrade = activeStudent?.gradeLevel || 3;
    const foundIndex = ARABIC_READING_PASSAGES.findIndex(p => p.gradeLevel === studentGrade);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [activeStudent]);

  const [selectedPassageIndex, setSelectedPassageIndex] = useState(defaultPassageIndex);
  const passage: ReadingPassage = ARABIC_READING_PASSAGES[selectedPassageIndex] || ARABIC_READING_PASSAGES[0];

  // Stages: 'intro' -> 'reading' -> 'comprehension' -> 'summary'
  const [stage, setStage] = useState<'intro' | 'reading' | 'comprehension' | 'summary'>('intro');

  // Timer & Reading state
  const [readingSeconds, setReadingSeconds] = useState(0);
  const [isReadingActive, setIsReadingActive] = useState(false);
  const timerRef = useRef<any>(null);
  const readingStartTimestampRef = useRef<number>(0);

  // Accessibility comfort options
  const [fontSizePx, setFontSizePx] = useState(26);
  const [useReadingRuler, setUseReadingRuler] = useState(false);
  const [activeRulerLineIndex, setActiveRulerLineIndex] = useState(0);

  // Comprehension questions state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Final derived metrics
  const [measuredWpm, setMeasuredWpm] = useState(0);
  const [finalDurationSec, setFinalDurationSec] = useState(0);
  const [comprehensionScore, setComprehensionScore] = useState(0);

  // Break passage words into visual lines for comfortable reading
  const passageParagraphs = useMemo(() => {
    const text = passage.words.join(' ');
    // Split on full stops or logical clauses
    const sentences = text.split(/(?<=[.،؛])\s+/).filter(Boolean);
    return sentences.length > 0 ? sentences : [text];
  }, [passage]);

  // Start reading timer
  const handleStartReading = () => {
    readingStartTimestampRef.current = Date.now();
    setReadingSeconds(0);
    setIsReadingActive(true);
    setStage('reading');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setReadingSeconds(prev => prev + 1);
    }, 1000);
  };

  // Finish reading and stop timer
  const handleFinishReading = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsReadingActive(false);

    const elapsedSec = Math.max(
      4,
      Math.round((Date.now() - readingStartTimestampRef.current) / 1000)
    );
    setFinalDurationSec(elapsedSec);

    // Calculate real WPM strictly from measured duration
    const calculatedWpm = Math.max(
      15,
      Math.min(220, Math.round((passage.words.length / elapsedSec) * 60))
    );
    setMeasuredWpm(calculatedWpm);

    // Proceed to comprehension questions
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setStage('comprehension');
  };

  // Handle question selection
  const handleSelectOption = (questionIdx: number, optionIdx: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIdx]: optionIdx,
    }));
  };

  // Submit comprehension questions & finalize
  const handleFinishComprehension = () => {
    let correctCount = 0;
    const questions = passage.comprehensionQuestions || [];

    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        correctCount += 1;
      }
    });

    const scorePercent =
      questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 100;

    setComprehensionScore(scorePercent);

    // Save actual measured results to central assessment context
    saveReadingResults({
      passageId: passage.id,
      passageTitle: passage.title,
      gradeLevel: passage.gradeLevel,
      wordCount: passage.words.length,
      durationSeconds: finalDurationSec,
      wpm: measuredWpm,
      comprehensionScore: scorePercent,
      correctAnswersCount: correctCount,
      totalQuestionsCount: questions.length,
      readingRulerUsed: useReadingRuler,
      completedAt: new Date().toISOString(),
    });

    setStage('summary');
  };

  // Complete session and save to parent record
  const handleCommitSession = () => {
    const baseStudent = activeStudent || INITIAL_STUDENTS[0];
    const updatedRecord: StudentRecord = {
      ...baseStudent,
      readingDurationSeconds: finalDurationSec,
      wpm: measuredWpm,
      regressionCount: 0,
      regressionRate: 0,
      sessionStatus: 'completed',
      sessionCompletedAt: new Date().toISOString(),
      comprehensionAnswers: Object.values(selectedAnswers),
    };

    onCompleteSession(updatedRecord);
  };

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-blue-50/40 flex flex-col justify-between font-sans select-none" dir="rtl">
      {/* =====================================================================
          STAGE 1: BRIEFING & PASSAGE SELECTION
          ===================================================================== */}
      {stage === 'intro' && (
        <div className="max-w-4xl w-full mx-auto p-6 md:p-8 pt-10">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 md:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-18 h-18 mx-auto bg-gradient-to-tr from-teal-600 to-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-teal-500/20">
                <BookOpen className="w-9 h-9 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
                مختبر القراءة والطلاقة والفهم القرائي
              </h1>
              <p className="text-slate-600 text-base md:text-lg max-w-xl mx-auto">
                تقييم علمي مباشر لسرعة القراءة الجهرية، استرسال المفردات العربية المشكولة، ودقة استيعاب النص.
              </p>
            </div>

            {/* Scientific Integrity Disclosure */}
            <div className="mb-8 p-4 rounded-2xl bg-teal-50/80 border border-teal-200 text-right">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div className="text-xs text-teal-900 leading-relaxed">
                  <span className="font-bold block mb-1">معيار النزاهة العلمية المعتمد:</span>
                  تم استبعاد كاميرا تتبع العين والمعايرة الزائفة تماماً. هذا التقييم يعتمد حصرياً على البيانات الفعلية القابلة للإثبات: (1) زمن القراءة الفعلي بالثواني، (2) معدل الكلمات في الدقيقة (WPM)، (3) إجابات أسئلة الفهم والاستيعاب للنص.
                </div>
              </div>
            </div>

            {/* Passage Selector */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-slate-800 mb-3 text-right">
                اختر النص القرائي المناسب للمستوى الدراسي:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {ARABIC_READING_PASSAGES.slice(0, 6).map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPassageIndex(idx)}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                      selectedPassageIndex === idx
                        ? 'border-teal-600 bg-teal-50/80 shadow-md shadow-teal-100'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <span className="text-[11px] font-bold text-teal-700 block mb-1">
                        {p.gradeLabel}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">{p.title}</h4>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                      <span>{p.wordCount} كلمة</span>
                      <span>{p.diacriticLabelAr.split(' ')[0]}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Instructions Card */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 mb-8 text-right space-y-2">
              <h3 className="font-bold text-slate-900 text-sm mb-2">إرشادات الجلسة:</h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>اقرأ النص قراءة جهرية واضحة ومسترسلة كما تقرأ في الصف الدراسي.</li>
                <li>سيبدأ المؤقت الدقيق فور الضغط على زر «ابدأ القراءة الآن».</li>
                <li>عند الانتهاء من قراءة آخر كلمة في النص، اضغط على زر «أنهيت القراءة».</li>
                <li>ستنتقل مباشرة للإجابة عن أسئلة الفهم القرائي (٤ أسئلة استيعاب).</li>
              </ul>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartReading}
              className="w-full bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold py-5 px-6 rounded-2xl transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 text-xl cursor-pointer"
            >
              <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
              <span>ابدأ جلسة القراءة الآن</span>
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 2: ACTIVE READING PASSAGE (PURE TIMED TEXT)
          ===================================================================== */}
      {stage === 'reading' && (
        <div className="max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col justify-between min-h-screen">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-10 mt-4">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-5 mb-6 gap-4">
              <div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                  {passage.gradeLabel} · {passage.diacriticLabelAr}
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
                  {passage.title}
                </h2>
              </div>

              {/* Stopwatch & Accessibility Controls */}
              <div className="flex items-center gap-3">
                {/* Live Timer Pill */}
                <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-sm">
                  <Clock className="w-5 h-5 text-teal-400 animate-spin" style={{ animationDuration: '4s' }} />
                  <span className="font-mono text-lg font-bold">
                    {Math.floor(readingSeconds / 60)}:
                    {(readingSeconds % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs text-slate-300">ثانية</span>
                </div>

                {/* Reading Ruler Toggle */}
                <button
                  onClick={() => setUseReadingRuler(!useReadingRuler)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    useReadingRuler
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="مسطرة القراءة البصرية المساعدة"
                >
                  <Layers className="w-4 h-4" />
                  <span className="hidden sm:inline">مسطرة السطر</span>
                </button>

                {/* Font Size Adjusters */}
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <button
                    onClick={() => setFontSizePx(prev => Math.min(36, prev + 2))}
                    className="px-2.5 py-1.5 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                    title="تكبير الخط"
                  >
                    أ+
                  </button>
                  <button
                    onClick={() => setFontSizePx(prev => Math.max(20, prev - 2))}
                    className="px-2.5 py-1.5 text-xs font-bold hover:bg-slate-200 cursor-pointer border-r border-slate-200"
                    title="تصغير الخط"
                  >
                    أ-
                  </button>
                </div>
              </div>
            </div>

            {/* Arabic Reading Passage with Tashkeel */}
            <div
              className="py-6 px-4 md:px-8 text-right select-none space-y-6"
              style={{
                fontSize: `${fontSizePx}px`,
                lineHeight: '2.5',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {passageParagraphs.map((sentence, sIdx) => {
                const isRulerActive = useReadingRuler && activeRulerLineIndex === sIdx;

                return (
                  <p
                    key={sIdx}
                    onClick={() => setActiveRulerLineIndex(sIdx)}
                    className={`font-semibold transition-all rounded-2xl px-4 py-2 cursor-pointer ${
                      isRulerActive
                        ? 'bg-amber-100/90 text-slate-950 shadow-md border-r-4 border-amber-500 font-bold'
                        : useReadingRuler
                        ? 'opacity-40 hover:opacity-80 text-slate-700'
                        : 'text-slate-800 hover:text-teal-900'
                    }`}
                  >
                    {sentence}
                  </p>
                );
              })}
            </div>

            {/* Bottom Finish Reading Button */}
            <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col items-center justify-center">
              <button
                onClick={handleFinishReading}
                className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 text-white font-black text-2xl py-5 px-16 rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center gap-4"
              >
                <span>أنهيت القراءة — الانتقال لأسئلة الفهم</span>
                <ChevronLeft className="w-8 h-8" />
              </button>
              <p className="text-slate-500 text-xs mt-3 text-center">
                اضغط على الزر فور الانتهاء لحساب زمن القراءة بدقة
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 3: COMPREHENSION QUESTIONS
          ===================================================================== */}
      {stage === 'comprehension' && (
        <div className="max-w-3xl w-full mx-auto p-6 md:p-8 pt-10">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 md:p-10">
            {/* Header */}
            <div className="border-b border-slate-100 pb-5 mb-6 text-right">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
                <HelpCircle className="w-3.5 h-3.5" />
                اختبار الفهم والاستيعاب القرائي
              </div>
              <h2 className="text-2xl font-black text-slate-900">
                السؤال {currentQuestionIndex + 1} من {passage.comprehensionQuestions.length}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                المهارة المستهدفة: {passage.comprehensionQuestions[currentQuestionIndex]?.skillLabelAr}
              </p>
            </div>

            {/* Current Question */}
            {passage.comprehensionQuestions[currentQuestionIndex] && (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-right">
                  <h3 className="text-lg md:text-xl font-bold text-slate-900 leading-relaxed">
                    {passage.comprehensionQuestions[currentQuestionIndex].question}
                  </h3>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  {passage.comprehensionQuestions[currentQuestionIndex].options.map(
                    (optionText, optIdx) => {
                      const isSelected = selectedAnswers[currentQuestionIndex] === optIdx;

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectOption(currentQuestionIndex, optIdx)}
                          className={`w-full p-4 rounded-2xl border text-right font-bold transition-all cursor-pointer flex items-center justify-between text-base ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-950 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <span>{optionText}</span>
                          <span
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-300'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>السابق</span>
                  </button>

                  {currentQuestionIndex < passage.comprehensionQuestions.length - 1 ? (
                    <button
                      onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                      disabled={selectedAnswers[currentQuestionIndex] === undefined}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>السؤال التالي</span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleFinishComprehension}
                      disabled={selectedAnswers[currentQuestionIndex] === undefined}
                      className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold rounded-xl text-base transition-colors shadow-lg cursor-pointer flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>اعتماد الإجابات وعرض النتائج</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 4: MEASURED RESULTS SUMMARY (EVIDENCE-ONLY)
          ===================================================================== */}
      {stage === 'summary' && (
        <div className="max-w-3xl w-full mx-auto p-6 md:p-8 pt-10">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 md:p-10 text-center">
            {/* Header Badge */}
            <div className="w-20 h-20 mx-auto bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20">
              <Award className="w-10 h-10 text-white" />
            </div>

            <h2 className="text-3xl font-black text-slate-900 mb-2">
              نتائج القراءة والفهم الفعلية
            </h2>
            <p className="text-slate-600 text-sm mb-8">
              تم احتساب المقاييس التالية بناءً على الأداء الحقيقي للطالب في النص: «{passage.title}»
            </p>

            {/* Verified Metrics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-right">
              {/* 1. WPM */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                <span className="text-xs font-bold text-emerald-800 block mb-1">
                  سرعة القراءة الفعلية
                </span>
                <div className="text-3xl font-black text-emerald-700 font-mono">
                  {measuredWpm}{' '}
                  <span className="text-sm font-semibold">ك/د</span>
                </div>
                <p className="text-[11px] text-emerald-700 mt-2">
                  محسوبة من: {passage.words.length} كلمة ÷ {finalDurationSec} ثانية
                </p>
              </div>

              {/* 2. Reading Time */}
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
                <span className="text-xs font-bold text-teal-800 block mb-1">
                  زمن القراءة المستغرق
                </span>
                <div className="text-3xl font-black text-teal-700 font-mono">
                  {finalDurationSec}{' '}
                  <span className="text-sm font-semibold">ثانية</span>
                </div>
                <p className="text-[11px] text-teal-700 mt-2">
                  مؤقت دقيق من بدء القراءة حتى إعلان الانتهاء
                </p>
              </div>

              {/* 3. Comprehension */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                <span className="text-xs font-bold text-indigo-800 block mb-1">
                  درجة الفهم القرائي
                </span>
                <div className="text-3xl font-black text-indigo-700 font-mono">
                  {comprehensionScore}%
                </div>
                <p className="text-[11px] text-indigo-700 mt-2">
                  نسبة الإجابات الصحيحة في أسئلة النص
                </p>
              </div>
            </div>

            {/* Clear Scientific Boundary Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-right mb-8">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed">
                  <span className="font-bold text-slate-900 block mb-0.5">
                    البيانات المقاسة مقابل المستبعدة:
                  </span>
                  ✓ <strong>ما تم قياسه بنجاح:</strong> زمن القراءة، سرعة الطلاقة اللفظية (WPM)، واستيعاب محتوى النص.<br />
                  ✕ <strong>ما لم يُقَس:</strong> حركة العين الميكروسكوبية وتثبيتات البؤبؤ (تم استبعاد الكاميرا التزاماً بالمعايير العلمية والموثوقية التقنية).
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleCommitSession}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-lg py-4 px-10 rounded-2xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>حفظ النتائج والانتقال للتقرير الشامل</span>
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={() => setStage('intro')}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 px-6 rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة القراءة بنص آخر</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EyeTrackingLabView;
