import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Volume2,
  VolumeX,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Star,
  Award,
  Layers,
  Feather,
  Smile,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Check,
  X,
  Clock,
  ShieldCheck,
  BookmarkCheck,
} from 'lucide-react';
import { playNaturalArabicAudio, stopNaturalArabicAudio } from '../../utils/naturalSpeech';
import { toArabicNum } from '../../utils/arabicDigits';
import {
  SPELLING_LESSONS,
  FLUENCY_PASSAGES,
  LEVELED_STORIES,
  SpellingLesson,
  FluencyPassageTrack,
  LeveledArabicStory,
  getRecommendedFluencyPassage,
  getRecommendedStoriesForGrade,
} from '../../cognitiveProfile/literacyStudio';

interface ArabicLiteracyStudioViewProps {
  childName?: string;
  gradeLevel?: number;
  ageYears?: number;
  initialTab?: 'spelling' | 'fluency' | 'library';
  onClose?: () => void;
  onActivityCompleted?: (type: 'spelling' | 'fluency' | 'story', id: string) => void;
}

export const ArabicLiteracyStudioView: React.FC<ArabicLiteracyStudioViewProps> = ({
  childName = 'البطل',
  gradeLevel = 1,
  ageYears = 7,
  initialTab = 'spelling',
  onClose,
  onActivityCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<'spelling' | 'fluency' | 'library'>(initialTab);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Stop audio when component unmounts or activeTab changes
  useEffect(() => {
    return () => {
      stopNaturalArabicAudio();
    };
  }, [activeTab]);

  const speak = useCallback(async (text: string) => {
    try {
      setAudioError(null);
      setIsPlayingAudio(true);
      await playNaturalArabicAudio(text, {
        voice: 'ar-AE-FatimaNeural',
        rate: '0%',
        pitch: '0%',
      });
    } catch {
      setAudioError('تعذّر تشغيل الصوت؛ يمكنك المتابعة بقراءة النص المشكول.');
    } finally {
      setIsPlayingAudio(false);
    }
  }, []);

  const stopAudio = useCallback(() => {
    stopNaturalArabicAudio();
    setIsPlayingAudio(false);
  }, []);

  // -------------------------------------------------------------------------
  // 1. SPELLING GYM STATE
  // -------------------------------------------------------------------------
  const [selectedSpellingId, setSelectedSpellingId] = useState<string>(SPELLING_LESSONS[0].id);
  const [spellingStep, setSpellingStep] = useState<1 | 2 | 3 | 4>(1);
  const [guidedPracticeIndex, setGuidedPracticeIndex] = useState<number>(0);
  const [selectedPracticeOption, setSelectedPracticeOption] = useState<string | null>(null);
  const [showPracticeHint, setShowPracticeHint] = useState<boolean>(false);
  const [assembledSyllables, setAssembledSyllables] = useState<string[]>([]);
  const [independentCompleted, setIndependentCompleted] = useState<boolean>(false);

  const activeSpellingLesson = useMemo<SpellingLesson>(() => {
    return SPELLING_LESSONS.find((l) => l.id === selectedSpellingId) || SPELLING_LESSONS[0];
  }, [selectedSpellingId]);

  const handleSelectLesson = (lessonId: string) => {
    stopAudio();
    setSelectedSpellingId(lessonId);
    setSpellingStep(1);
    setGuidedPracticeIndex(0);
    setSelectedPracticeOption(null);
    setShowPracticeHint(false);
    setAssembledSyllables([]);
    setIndependentCompleted(false);
  };

  const handleTileClick = (tile: string) => {
    if (assembledSyllables.includes(tile)) {
      setAssembledSyllables((prev) => prev.filter((t) => t !== tile));
    } else {
      setAssembledSyllables((prev) => [...prev, tile]);
    }
  };

  const checkIndependentAssembly = () => {
    const assembledWord = assembledSyllables.join('');
    const target = activeSpellingLesson.independentTask.targetWord.replace(/[\u064B-\u065F\u0670\u0640\s]/g, '');
    const cleanAssembled = assembledWord.replace(/[\u064B-\u065F\u0670\u0640\s]/g, '');

    if (cleanAssembled === target || assembledSyllables.length === activeSpellingLesson.independentTask.scrambledSyllables.length) {
      setIndependentCompleted(true);
      speak(`رائع يا ${childName}! كتابة صحيحة تمامًا: ${activeSpellingLesson.independentTask.targetWord}`);
      onActivityCompleted?.('spelling', activeSpellingLesson.id);
    } else {
      speak('حاول إعادة ترتيب المقاطع بالترتيب الصحيح.');
    }
  };

  // -------------------------------------------------------------------------
  // 2. FLUENCY TRACK STATE
  // -------------------------------------------------------------------------
  const [selectedFluencyId, setSelectedFluencyId] = useState<string>(
    getRecommendedFluencyPassage(gradeLevel).id
  );
  const [activePhraseIndex, setActivePhraseIndex] = useState<number | null>(null);
  const [fluencyChecklist, setFluencyChecklist] = useState<{ accuracy: boolean; phrasing: boolean; expression: boolean }>({
    accuracy: false,
    phrasing: false,
    expression: false,
  });
  const [fluencySessionDone, setFluencySessionDone] = useState<boolean>(false);

  const activeFluencyPassage = useMemo<FluencyPassageTrack>(() => {
    return FLUENCY_PASSAGES.find((p) => p.id === selectedFluencyId) || FLUENCY_PASSAGES[0];
  }, [selectedFluencyId]);

  const handleSelectFluency = (id: string) => {
    stopAudio();
    setSelectedFluencyId(id);
    setActivePhraseIndex(null);
    setFluencyChecklist({ accuracy: false, phrasing: false, expression: false });
    setFluencySessionDone(false);
  };

  const handleReadPhrase = async (phrase: string, index: number) => {
    setActivePhraseIndex(index);
    await speak(phrase);
  };

  // -------------------------------------------------------------------------
  // 3. LEVELED LIBRARY STATE
  // -------------------------------------------------------------------------
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [currentStoryPage, setCurrentStoryPage] = useState<number>(1);
  const [selectedStoryLevel, setSelectedStoryLevel] = useState<number>(0); // 0 = all
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);

  const activeStory = useMemo<LeveledArabicStory | null>(() => {
    if (!selectedStoryId) return null;
    return LEVELED_STORIES.find((s) => s.id === selectedStoryId) || null;
  }, [selectedStoryId]);

  const filteredStories = useMemo(() => {
    if (selectedStoryLevel === 0) return LEVELED_STORIES;
    return LEVELED_STORIES.filter((s) => s.level === selectedStoryLevel);
  }, [selectedStoryLevel]);

  const handleOpenStory = (story: LeveledArabicStory) => {
    stopAudio();
    setSelectedStoryId(story.id);
    setCurrentStoryPage(1);
    setQuizAnswers({});
    setQuizSubmitted(false);
  };

  const handleCloseStory = () => {
    stopAudio();
    setSelectedStoryId(null);
  };

  const handleQuizAnswer = (questionId: string, optionIndex: number) => {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const submitQuiz = () => {
    setQuizSubmitted(true);
    if (activeStory) {
      let correct = 0;
      activeStory.comprehensionQuiz.forEach((q) => {
        if (quizAnswers[q.id] === q.correctIndex) correct++;
      });
      speak(`أحسنت يا ${childName}! أجبت على ${toArabicNum(correct)} من ${toArabicNum(activeStory.comprehensionQuiz.length)} في الفهم القرائي.`);
      onActivityCompleted?.('story', activeStory.id);
    }
  };

  // -------------------------------------------------------------------------
  // RENDER HELPERS
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 py-4" dir="rtl">
      {/* HEADER & TOP NAVIGATION */}
      <header className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-teal-50 text-teal-800 border border-teal-200">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                استوديو النمو القرائي واللغوي المستمر
              </span>
              <span className="text-xs text-slate-500 font-medium">
                ملف {childName} · الصف {toArabicNum(gradeLevel)}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              تطوير مهارات القراءة والكتابة العربية
            </h1>
            <p className="text-sm text-slate-600">
              رحلة متكاملة ترافق الطفل من فك الرموز إلى الطلاقة التعبيرية، وإتقان قواعد الإملاء، والاستمتاع بمكتبة القصص المتدرجة.
            </p>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="bz-btn bz-btn-ghost text-slate-600 hover:text-slate-900 text-sm flex items-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" />
              العودة للرئيسية
            </button>
          )}
        </div>

        {/* 3 CORE PILLARS TAB BAR */}
        <nav className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100" aria-label="أقسام الاستوديو">
          <button
            type="button"
            onClick={() => {
              setActiveTab('spelling');
              handleCloseStory();
            }}
            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-black text-sm transition-all ${
              activeTab === 'spelling'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="text-lg">✍️</span>
            <span>مختبر الإملاء وبناء الكلمة</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('fluency');
              handleCloseStory();
            }}
            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-black text-sm transition-all ${
              activeTab === 'fluency'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="text-lg">📖</span>
            <span>مضمار الطلاقة والتنغيم</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('library');
            }}
            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-black text-sm transition-all ${
              activeTab === 'library'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="text-lg">📚</span>
            <span>المكتبة العربية المتدرجة</span>
          </button>
        </nav>
      </header>

      {audioError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{audioError}</span>
        </div>
      )}

      {/* =====================================================================
          TAB 1: SPELLING & ORTHOGRAPHY GYM
         ===================================================================== */}
      {activeTab === 'spelling' && (
        <div className="space-y-6">
          {/* Topic Selector Chips */}
          <section className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-2">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider px-1">اختر مهارة إملائية للتدرّب عليها:</h2>
            <div className="flex flex-wrap gap-2">
              {SPELLING_LESSONS.map((lesson) => {
                const isSelected = lesson.id === activeSpellingLesson.id;
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => handleSelectLesson(lesson.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-100 text-amber-950 border-2 border-amber-500 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{lesson.titleAr}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Active Spelling Lesson Container with 4 Explicit Pedagogical Steps */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Lesson Title & 4-Step Tracker Header */}
            <div className="bg-amber-50/70 p-6 border-b border-amber-100 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-amber-800 bg-amber-200/60 px-2.5 py-0.5 rounded-full">
                    {activeSpellingLesson.categoryAr}
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mt-1">{activeSpellingLesson.titleAr}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => (isPlayingAudio ? stopAudio() : speak(activeSpellingLesson.ruleAudioTextAr))}
                    className="bz-btn bz-btn-secondary text-xs flex items-center gap-1.5 bg-white shadow-xs"
                  >
                    {isPlayingAudio ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-amber-600" />}
                    <span>{isPlayingAudio ? 'إيقاف الصوت' : 'استمع لشرح القاعدة'}</span>
                  </button>
                </div>
              </div>

              {/* Step indicator breadcrumbs */}
              <div className="grid grid-cols-4 gap-2 pt-2">
                {[
                  { step: 1, label: '١. شرح القاعدة' },
                  { step: 2, label: '٢. مثال محلول' },
                  { step: 3, label: '٣. تدريب موجه' },
                  { step: 4, label: '٤. تطبيق مستقل' },
                ].map(({ step, label }) => {
                  const isActive = spellingStep === step;
                  const isDone = spellingStep > step;
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setSpellingStep(step as 1 | 2 | 3 | 4)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-black transition-all ${
                        isActive
                          ? 'bg-amber-500 text-white shadow-xs'
                          : isDone
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-white text-slate-500 border border-slate-200/60'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 1: RULE EXPLANATION */}
            {spellingStep === 1 && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-200/60 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-black text-base">
                    <Lightbulb className="w-5 h-5 text-amber-600" />
                    <span>القاعدة الإملائية المبسّطة:</span>
                  </div>
                  <p className="text-base sm:text-lg text-slate-800 leading-relaxed font-semibold">
                    {activeSpellingLesson.ruleSummaryAr}
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSpellingStep(2)}
                    className="bz-btn bz-btn-primary bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2"
                  >
                    <span>انتقل إلى المثال المحلول</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: WORKED EXAMPLE */}
            {spellingStep === 2 && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="text-center space-y-4">
                  <span className="text-xs font-black text-slate-500">الكلمة النموذجية المشروحة:</span>
                  <div className="inline-block bg-slate-50 rounded-3xl p-6 border border-slate-200 shadow-xs">
                    <span className="text-4xl sm:text-5xl font-black text-amber-800 tracking-wider">
                      {activeSpellingLesson.workedExample.targetWord}
                    </span>

                    {/* Syllable Breakdown */}
                    <div className="flex items-center justify-center gap-2 mt-4" dir="rtl">
                      {activeSpellingLesson.workedExample.visualBreakdown.map((part, i) => (
                        <span
                          key={i}
                          className="px-3.5 py-1.5 bg-white border-2 border-amber-300 text-amber-900 rounded-xl text-xl font-black shadow-2xs"
                        >
                          {part}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="max-w-xl mx-auto text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
                    {activeSpellingLesson.workedExample.explanationAr}
                  </p>

                  <div className="inline-flex items-center gap-2 p-3 bg-teal-50 border border-teal-200 rounded-2xl text-xs sm:text-sm text-teal-900 font-bold">
                    <BookmarkCheck className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>تلميح التحقق: {activeSpellingLesson.workedExample.proofTipAr}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setSpellingStep(1)} className="bz-btn bz-btn-ghost text-xs">
                    <ArrowRight className="w-4 h-4" /> السابق (القاعدة)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpellingStep(3)}
                    className="bz-btn bz-btn-primary bg-amber-500 hover:bg-amber-600 text-white text-xs flex items-center gap-1.5"
                  >
                    <span>ابدأ التدريب الموجه</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: GUIDED PRACTICE */}
            {spellingStep === 3 && (
              <div className="p-6 sm:p-8 space-y-6">
                {(() => {
                  const practice = activeSpellingLesson.guidedPractices[guidedPracticeIndex] || activeSpellingLesson.guidedPractices[0];
                  const isAnswered = selectedPracticeOption !== null;
                  const isCorrect = selectedPracticeOption === practice.correctId;

                  return (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                        <span>تدريب موجه رقم {toArabicNum(guidedPracticeIndex + 1)} من {toArabicNum(activeSpellingLesson.guidedPractices.length)}</span>
                        <button
                          type="button"
                          onClick={() => setShowPracticeHint(!showPracticeHint)}
                          className="text-amber-700 hover:underline flex items-center gap-1"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>{showPracticeHint ? 'إخفاء التلميح' : 'أحتاج تلميحًا'}</span>
                        </button>
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-center space-y-2">
                        <p className="text-base sm:text-lg font-black text-slate-900">{practice.promptAr}</p>
                        <p className="text-xl font-bold text-amber-900 py-2">{practice.wordContextAr}</p>
                      </div>

                      {showPracticeHint && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                          💡 <strong>تلميح:</strong> {practice.hintAr}
                        </div>
                      )}

                      {/* Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {practice.options.map((opt) => {
                          const isOptionSelected = selectedPracticeOption === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setSelectedPracticeOption(opt.id)}
                              className={`p-4 rounded-2xl border-2 text-right font-black text-base transition-all ${
                                isOptionSelected
                                  ? opt.id === practice.correctId
                                    ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-sm'
                                    : 'bg-rose-50 border-rose-400 text-rose-900'
                                  : 'bg-white border-slate-200 hover:border-amber-300 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{opt.labelAr}</span>
                                {isOptionSelected && (
                                  <span>{opt.id === practice.correctId ? '✅' : '❌'}</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Feedback after answer */}
                      {isAnswered && (
                        <div
                          className={`p-4 rounded-2xl text-sm font-semibold space-y-1 ${
                            isCorrect ? 'bg-teal-50 text-teal-900 border border-teal-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isCorrect ? <CheckCircle2 className="w-5 h-5 text-teal-600" /> : <X className="w-5 h-5 text-rose-500" />}
                            <span>{isCorrect ? 'إجابة متميزة!' : 'انتبه إلى القاعدة:'}</span>
                          </div>
                          <p className="text-xs text-slate-700">{practice.explanationAr}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setSpellingStep(2)} className="bz-btn bz-btn-ghost text-xs">
                          <ArrowRight className="w-4 h-4" /> السابق
                        </button>

                        {isAnswered && guidedPracticeIndex < activeSpellingLesson.guidedPractices.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setGuidedPracticeIndex((prev) => prev + 1);
                              setSelectedPracticeOption(null);
                              setShowPracticeHint(false);
                            }}
                            className="bz-btn bz-btn-secondary text-xs flex items-center gap-1.5"
                          >
                            <span>التدريب التالي</span>
                            <ArrowLeft className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!isAnswered}
                            onClick={() => setSpellingStep(4)}
                            className="bz-btn bz-btn-primary bg-amber-500 hover:bg-amber-600 text-white text-xs flex items-center gap-1.5 disabled:opacity-40"
                          >
                            <span>الانتقال للتطبيق المستقل</span>
                            <ArrowLeft className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* STEP 4: INDEPENDENT APPLICATION (Syllable Assembly / Word Building) */}
            {spellingStep === 4 && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="text-center space-y-3">
                  <span className="text-xs font-black text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
                    تحدي بناء الكلمة الذكي
                  </span>
                  <p className="text-base sm:text-lg font-black text-slate-900">
                    {activeSpellingLesson.independentTask.promptAr}
                  </p>
                </div>

                {/* Assembly workspace */}
                <div className="bg-slate-50 rounded-3xl p-6 border-2 border-dashed border-amber-300 text-center min-h-[90px] flex items-center justify-center gap-3 flex-wrap">
                  {assembledSyllables.length === 0 ? (
                    <span className="text-sm text-slate-400 font-medium">اضغط على المقاطع بالترتيب لتكوين الكلمة هُنا...</span>
                  ) : (
                    assembledSyllables.map((tile, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleTileClick(tile)}
                        className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xl font-black shadow-xs hover:bg-rose-500 transition-colors"
                        title="اضغط للإزالة"
                      >
                        {tile}
                      </button>
                    ))
                  )}
                </div>

                {/* Available Scrambled Tiles */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  {[
                    ...activeSpellingLesson.independentTask.scrambledSyllables,
                    ...(activeSpellingLesson.independentTask.distractorTiles || []),
                  ]
                    .sort()
                    .map((tile, i) => {
                      const isUsed = assembledSyllables.includes(tile);
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={isUsed}
                          onClick={() => handleTileClick(tile)}
                          className={`px-5 py-3 rounded-2xl text-2xl font-black border-2 transition-all ${
                            isUsed
                              ? 'bg-slate-100 border-slate-200 text-slate-300 opacity-40'
                              : 'bg-white border-amber-400 text-amber-950 hover:bg-amber-50 hover:scale-105 shadow-xs'
                          }`}
                        >
                          {tile}
                        </button>
                      );
                    })}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setAssembledSyllables([])}
                    className="bz-btn bz-btn-ghost text-xs flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إعادة المحاولة</span>
                  </button>

                  <button
                    type="button"
                    onClick={checkIndependentAssembly}
                    disabled={assembledSyllables.length === 0 || independentCompleted}
                    className="bz-btn bz-btn-primary bg-amber-500 hover:bg-amber-600 text-white text-sm px-6 py-2.5 flex items-center gap-2 shadow-xs disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تحقق من كتابة الكلمة</span>
                  </button>
                </div>

                {independentCompleted && (
                  <div className="bg-teal-50 border border-teal-300 rounded-3xl p-6 text-center space-y-3">
                    <div className="w-12 h-12 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto text-2xl">
                      ⭐
                    </div>
                    <h4 className="text-xl font-black text-teal-950">إتقان ممتاز يا {childName}!</h4>
                    <p className="text-sm text-slate-700 max-w-md mx-auto font-medium">
                      {activeSpellingLesson.independentTask.explanationAr}
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const currentIndex = SPELLING_LESSONS.findIndex((l) => l.id === activeSpellingLesson.id);
                          const nextLesson = SPELLING_LESSONS[(currentIndex + 1) % SPELLING_LESSONS.length];
                          handleSelectLesson(nextLesson.id);
                        }}
                        className="bz-btn bz-btn-primary bg-teal-600 hover:bg-teal-700 text-white text-xs px-5 py-2 inline-flex items-center gap-2"
                      >
                        <span>المهارة الإملائية التالية</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: CALM EXPRESSIVE FLUENCY STUDIO
         ===================================================================== */}
      {activeTab === 'fluency' && (
        <div className="space-y-6">
          {/* Passage Selector Bar */}
          <section className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-2">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider px-1">اختر مضمار الطلاقة المناسب لصف الطفل:</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FLUENCY_PASSAGES.map((passage) => {
                const isSelected = passage.id === activeFluencyPassage.id;
                return (
                  <button
                    key={passage.id}
                    type="button"
                    onClick={() => handleSelectFluency(passage.id)}
                    className={`p-4 rounded-2xl border-2 text-right transition-all ${
                      isSelected
                        ? 'bg-teal-50/80 border-teal-600 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    <span className="text-xs font-black text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                      الصف {toArabicNum(passage.gradeLevel)}
                    </span>
                    <h3 className="text-base font-black text-slate-900 mt-2">{passage.titleAr}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{passage.themeAr}</p>
                    <span className="text-2xs text-teal-900 font-bold block mt-2">
                      معدل مريح: {toArabicNum(passage.recommendedWcpmRange[0])}–{toArabicNum(passage.recommendedWcpmRange[1])} كلمة/د
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Three Pedagogical Fluency Pillars Banner (No Blind Speed) */}
          <div className="bg-teal-900 text-white rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-teal-300 text-xs font-black">الطلاقة الحقيقية ليست سباق سرعة</span>
                <h3 className="text-xl sm:text-2xl font-black mt-0.5">{activeFluencyPassage.titleAr}</h3>
              </div>
              <button
                type="button"
                onClick={() => (isPlayingAudio ? stopAudio() : speak(activeFluencyPassage.fullTextVowelled))}
                className="bz-btn bg-teal-700 hover:bg-teal-600 text-white text-xs flex items-center gap-1.5 border border-teal-500/50 shadow-xs"
              >
                {isPlayingAudio ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-teal-200" />}
                <span>{isPlayingAudio ? 'إيقاف النموذج' : 'استمع للنموذج الكامل بتنغيم'}</span>
              </button>
            </div>

            {/* 3 Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="bg-teal-800/60 rounded-xl p-3 border border-teal-700/60 space-y-1">
                <span className="font-black text-teal-200 block">🎯 ١. دقة الحركات</span>
                <span className="text-teal-100 leading-relaxed block">نطق الحركات والمدود بصوت هادئ دون تخمين.</span>
              </div>
              <div className="bg-teal-800/60 rounded-xl p-3 border border-teal-700/60 space-y-1">
                <span className="font-black text-teal-200 block">🌊 ٢. تجميع العبارات</span>
                <span className="text-teal-100 leading-relaxed block">قراءة العبارة كوحدة معنوية واحدة دون تقطيع الحروف.</span>
              </div>
              <div className="bg-teal-800/60 rounded-xl p-3 border border-teal-700/60 space-y-1">
                <span className="font-black text-teal-200 block">🎭 ٣. التنغيم والوقف</span>
                <span className="text-teal-100 leading-relaxed block">الوقوف عند الفاصلة والتعبير عن السؤال والتعجب.</span>
              </div>
            </div>
          </div>

          {/* Phrase-Cued Reading Workspace */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold border-b border-slate-100 pb-3">
              <span>تدرّب على قراءة العبارات بالترتيب:</span>
              <span>اضغط على العبارة للاستماع إليها وتكرارها بصوتك</span>
            </div>

            {/* Chunked Lines */}
            <div className="space-y-3">
              {activeFluencyPassage.phrasedLines.map((line, index) => {
                const isActive = activePhraseIndex === index;
                return (
                  <div
                    key={index}
                    onClick={() => handleReadPhrase(line.textAr, index)}
                    className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-wrap items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-teal-50 border-teal-500 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-white border border-slate-300 flex items-center justify-center text-xs font-black text-slate-700 shrink-0">
                        {toArabicNum(index + 1)}
                      </span>
                      <span className="text-lg sm:text-xl font-black text-slate-900 tracking-wide">
                        {line.textAr}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {line.cueNotesAr && (
                        <span className="text-2xs bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 font-semibold">
                          {line.cueNotesAr}
                        </span>
                      )}
                      <Volume2 className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Prosody & Punctuation Advice */}
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2 text-xs">
              <span className="font-black text-amber-950 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-600" />
                إرشاد التنغيم لمرافقة الطفل:
              </span>
              <p className="text-slate-700 leading-relaxed font-medium">
                {activeFluencyPassage.prosodyGuidanceAr}
              </p>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5 pt-1">
                {activeFluencyPassage.punctuationTipsAr.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>

            {/* Self-Reflection Checklist */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-black text-slate-800 block">تقييم جولة القراءة المتكررة (مع ولي الأمر):</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-white p-3 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={fluencyChecklist.accuracy}
                    onChange={(e) => setFluencyChecklist({ ...fluencyChecklist, accuracy: e.target.checked })}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>قرأت كل الحركات بدقة دون إبدال</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-white p-3 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={fluencyChecklist.phrasing}
                    onChange={(e) => setFluencyChecklist({ ...fluencyChecklist, phrasing: e.target.checked })}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>وصلت الكلمات ووقفت عند الوقف</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-white p-3 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={fluencyChecklist.expression}
                    onChange={(e) => setFluencyChecklist({ ...fluencyChecklist, expression: e.target.checked })}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>عبّرت بنبرة صوتي عن المعنى</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={!fluencyChecklist.accuracy || !fluencyChecklist.phrasing || fluencySessionDone}
                  onClick={() => {
                    setFluencySessionDone(true);
                    speak(`أحسنت القراءة يا ${childName}! طلاقتك وتعبيرك في تحسن مستمر.`);
                    onActivityCompleted?.('fluency', activeFluencyPassage.id);
                  }}
                  className="bz-btn bz-btn-primary bg-teal-600 hover:bg-teal-700 text-white text-xs flex items-center gap-2 disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{fluencySessionDone ? 'تم توثيق جولة الطلاقة بنجاح ⭐' : 'تأكيد إتمام جولة القراءة المتكررة'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: SMART LEVELED ARABIC STORYBOOK LIBRARY
         ===================================================================== */}
      {activeTab === 'library' && (
        <div className="space-y-6">
          {!activeStory ? (
            /* STORY CATALOG VIEW */
            <div className="space-y-6">
              {/* Level Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-black text-slate-800">رفوف المكتبة المصنفة:</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {[
                    { id: 0, label: 'جميع المستويات' },
                    { id: 1, label: 'المستوى ١ (بذور القراءة)' },
                    { id: 2, label: 'المستوى ٢ (خطوات الطلاقة)' },
                    { id: 3, label: 'المستوى ٣ (القراءة المستقلة)' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedStoryLevel(id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                        selectedStoryLevel === id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Story Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {filteredStories.map((story) => (
                  <article
                    key={story.id}
                    className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Cover header */}
                      <div className={`p-6 text-white text-center bg-gradient-to-br ${story.coverBgClass} space-y-2`}>
                        <span className="text-5xl block transform hover:scale-110 transition-transform">
                          {story.coverEmoji}
                        </span>
                        <span className="inline-block text-2xs font-black bg-black/20 px-2.5 py-0.5 rounded-full">
                          {story.levelLabelAr}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between text-2xs text-slate-500 font-bold">
                          <span>{story.targetGradeRange}</span>
                          <span>{toArabicNum(story.wordCount)} كلمة</span>
                        </div>

                        <h3 className="text-lg font-black text-slate-900 leading-snug">{story.titleAr}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{story.synopsisAr}</p>

                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-2xs text-slate-700 font-medium">
                          🎯 <strong>التركيز:</strong> {story.phonicsFocusAr}
                        </div>
                      </div>
                    </div>

                    <div className="p-5 pt-0">
                      <button
                        type="button"
                        onClick={() => handleOpenStory(story)}
                        className="w-full bz-btn bz-btn-primary bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2.5 rounded-xl font-black flex items-center justify-center gap-2 shadow-xs"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>افتح القصة واقرأ</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            /* ACTIVE STORY READER & COMPREHENSION VIEW */
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-6">
              {/* Story Reader Top Bar */}
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCloseStory}
                    className="bz-btn bz-btn-ghost text-xs flex items-center gap-1 text-slate-600 hover:text-slate-900"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>فهرس القصص</span>
                  </button>
                  <span className="text-slate-300">|</span>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                    <span>{activeStory.coverEmoji}</span>
                    <span>{activeStory.titleAr}</span>
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">
                    صفحة {toArabicNum(currentStoryPage)} من {toArabicNum(activeStory.pages.length)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const page = activeStory.pages[currentStoryPage - 1];
                      if (isPlayingAudio) {
                        stopAudio();
                      } else if (page) {
                        speak(page.vowelledTextAr);
                      }
                    }}
                    className="bz-btn bz-btn-secondary text-xs flex items-center gap-1 bg-white shadow-xs"
                  >
                    {isPlayingAudio ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-indigo-600" />}
                    <span>{isPlayingAudio ? 'إيقاف' : 'استمع للصفحة'}</span>
                  </button>
                </div>
              </div>

              {/* Story Page Display */}
              {(() => {
                const page = activeStory.pages[currentStoryPage - 1] || activeStory.pages[0];
                return (
                  <div className="p-8 max-w-2xl mx-auto space-y-8">
                    {/* Illustration */}
                    <div className="text-center">
                      <span className="text-6xl block transform hover:scale-110 transition-transform">
                        {page.illustrationEmoji}
                      </span>
                    </div>

                    {/* Vowelled Text Lines */}
                    <div className="bg-amber-50/40 rounded-3xl p-6 sm:p-8 border border-amber-200/60 shadow-xs space-y-4 text-center">
                      {page.linesAr.map((line, idx) => (
                        <p
                          key={idx}
                          className="text-2xl sm:text-3xl font-black text-slate-900 leading-loose tracking-wide font-serif"
                        >
                          {line}
                        </p>
                      ))}
                    </div>

                    {/* Page Navigation */}
                    <div className="flex items-center justify-between pt-4">
                      <button
                        type="button"
                        disabled={currentStoryPage <= 1}
                        onClick={() => {
                          stopAudio();
                          setCurrentStoryPage((prev) => Math.max(1, prev - 1));
                        }}
                        className="bz-btn bz-btn-secondary text-xs flex items-center gap-1 disabled:opacity-30"
                      >
                        <ChevronRight className="w-4 h-4" />
                        <span>الصفحة السابقة</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {activeStory.pages.map((p) => (
                          <span
                            key={p.pageNumber}
                            className={`w-3 h-3 rounded-full ${
                              currentStoryPage === p.pageNumber ? 'bg-indigo-600 scale-125' : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={currentStoryPage >= activeStory.pages.length}
                        onClick={() => {
                          stopAudio();
                          setCurrentStoryPage((prev) => Math.min(activeStory.pages.length, prev + 1));
                        }}
                        className="bz-btn bz-btn-primary bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center gap-1 disabled:opacity-30"
                      >
                        <span>الصفحة التالية</span>
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* VOCABULARY SPOTLIGHT */}
              {activeStory.vocabularySpotlight.length > 0 && (
                <div className="p-6 bg-indigo-50/60 border-t border-indigo-100 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-950 font-black text-xs uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>مفردات القصة الجديدة:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeStory.vocabularySpotlight.map((vocab, i) => (
                      <div key={i} className="p-3 bg-white rounded-xl border border-indigo-200/80 text-xs space-y-0.5">
                        <strong className="text-indigo-900 font-black text-sm block">{vocab.wordAr}</strong>
                        <span className="text-slate-600">{vocab.meaningAr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* COMPREHENSION QUIZ (Shown after reading all pages) */}
              <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-200 space-y-6">
                <div className="space-y-1">
                  <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full">
                    تحدي الفهم القرائي والاستيعاب
                  </span>
                  <h4 className="text-xl font-black text-slate-900">ماذا تعلمنا من القصة؟</h4>
                  <p className="text-xs text-slate-600">أجب عن الأسئلة التالية للتأكد من فهمك للأحداث والمعاني.</p>
                </div>

                <div className="space-y-6">
                  {activeStory.comprehensionQuiz.map((item, qIdx) => {
                    const selectedOpt = quizAnswers[item.id];
                    return (
                      <div key={item.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-indigo-900">
                            السؤال {toArabicNum(qIdx + 1)}: {item.questionAr}
                          </span>
                          <span className="text-2xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                            {item.typeLabelAr}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {item.options.map((opt, optIdx) => {
                            const isChosen = selectedOpt === optIdx;
                            const isCorrect = item.correctIndex === optIdx;
                            let btnStyle = 'bg-slate-50 border-slate-200 text-slate-800 hover:border-indigo-300';

                            if (quizSubmitted) {
                              if (isCorrect) btnStyle = 'bg-teal-50 border-teal-500 text-teal-900 font-black';
                              else if (isChosen) btnStyle = 'bg-rose-50 border-rose-400 text-rose-900 line-through';
                            } else if (isChosen) {
                              btnStyle = 'bg-indigo-50 border-indigo-600 text-indigo-950 font-black';
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                disabled={quizSubmitted}
                                onClick={() => handleQuizAnswer(item.id, optIdx)}
                                className={`p-3 rounded-xl border text-right text-xs transition-all ${btnStyle}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>

                        {quizSubmitted && (
                          <p className="text-xs text-slate-600 pt-1 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            💡 <strong>الشرح:</strong> {item.explanationAr}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  {!quizSubmitted ? (
                    <button
                      type="button"
                      disabled={Object.keys(quizAnswers).length < activeStory.comprehensionQuiz.length}
                      onClick={submitQuiz}
                      className="bz-btn bz-btn-primary bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-6 py-2.5 flex items-center gap-2 shadow-xs disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد الإجابات واكتساب النقاط ⭐</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCloseStory}
                      className="bz-btn bz-btn-secondary text-xs flex items-center gap-2"
                    >
                      <span>العودة لرفوف المكتبة واختيار قصة أخرى</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
