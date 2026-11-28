import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Blocks,
  BookOpen,
  Brain,
  CheckCircle2,
  Feather,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  PenTool,
  Play,
  RotateCcw,
  ShoppingBasket,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { playNaturalArabicAudio, stopNaturalArabicAudio } from '../../utils/naturalSpeech';
import { toArabicNum } from '../../utils/arabicDigits';
import {
  FLUENCY_PASSAGES,
  SPELLING_LESSONS,
  type FluencyPassageTrack,
  type SpellingLesson,
} from '../../cognitiveProfile/literacyStudio';
import {
  ARABIC_LANGUAGE_UNITS,
  type ArabicLanguageUnit,
} from '../../cognitiveProfile/arabicFoundations';
import {
  buildAdaptiveArabicPrescription,
  type DetectedErrorPattern,
  type StudioTabId,
} from '../../cognitiveProfile/arabicErrorAdapter';
import {
  LEARNING_PATH_STATIONS,
  getNextStationId,
  getStationById,
  type LearningStation,
  type LearningTrackId,
} from '../../cognitiveProfile/learningPath';
import {
  getStationMasteryPercent,
  loadStudioAdaptiveState,
  pickAdaptiveRecommendedStation,
  recordLetterAttempt,
  recordStationAnswer,
  recordStoryActivity,
  saveStudioAdaptiveState,
  type StudioAdaptiveState,
} from '../../cognitiveProfile/studioAdaptive';
import type { StudentRecord } from '../../data/seedData';
import type { AppTabId } from '../HomeLandingView';
import { ArabicFoundationsView, type FoundationSubMode } from './ArabicFoundationsView';
import { InteractiveStoryReader } from '../reader/InteractiveStoryReader';
import { Mascot } from '../ui/Mascot';

interface ArabicLiteracyStudioViewProps {
  student?: StudentRecord;
  childName?: string;
  gradeLevel?: number;
  ageYears?: number;
  initialTab?: StudioTabId;
  initialStoryId?: string;
  onClose?: () => void;
  onNavigateTab?: (tab: AppTabId) => void;
  onActivityCompleted?: (
    type: 'foundations' | 'spelling' | 'fluency' | 'story',
    id: string,
    extraWords?: string[],
  ) => void;
}

type TrackFilterId = 'all' | Exclude<LearningTrackId, 'language'>;
type SpellingPhase = 'learn' | 'example' | 'practice' | 'build' | 'celebrate';
type LanguagePhase = 'learn' | 'practice' | 'celebrate';
type FluencyPhase = 'listen' | 'phrase' | 'celebrate';

function getStationIcon(station: LearningStation, className = 'w-6 h-6') {
  if (station.kind === 'foundation') {
    if (station.refId === 'trace') return <PenTool className={className} aria-hidden="true" />;
    if (station.refId === 'basket') return <ShoppingBasket className={className} aria-hidden="true" />;
    if (station.refId === 'balloon') return <Sparkles className={className} aria-hidden="true" />;
    return <Blocks className={className} aria-hidden="true" />;
  }
  if (station.kind === 'spelling') return <PenTool className={className} aria-hidden="true" />;
  if (station.kind === 'language') return <GraduationCap className={className} aria-hidden="true" />;
  if (station.kind === 'fluency') return <Feather className={className} aria-hidden="true" />;
  return <BookOpen className={className} aria-hidden="true" />;
}

const ACCENT_CLASSES: Record<
  LearningStation['accent'],
  { card: string; badge: string; btn: string; softBg: string; border: string }
> = {
  emerald: {
    card: 'border-emerald-300 bg-white hover:border-emerald-500 shadow-[0_6px_0_0_rgba(16,185,129,0.14)]',
    badge: 'bg-emerald-100 text-emerald-900',
    btn: 'bg-emerald-600 hover:bg-emerald-700 border-emerald-800',
    softBg: 'bg-emerald-50',
    border: 'border-emerald-300',
  },
  sky: {
    card: 'border-sky-300 bg-white hover:border-sky-500 shadow-[0_6px_0_0_rgba(14,165,233,0.14)]',
    badge: 'bg-sky-100 text-sky-900',
    btn: 'bg-sky-600 hover:bg-sky-700 border-sky-800',
    softBg: 'bg-sky-50',
    border: 'border-sky-300',
  },
  amber: {
    card: 'border-amber-300 bg-white hover:border-amber-500 shadow-[0_6px_0_0_rgba(245,158,11,0.16)]',
    badge: 'bg-amber-100 text-amber-950',
    btn: 'bg-amber-500 hover:bg-amber-600 border-amber-700',
    softBg: 'bg-amber-50',
    border: 'border-amber-300',
  },
  violet: {
    card: 'border-violet-300 bg-white hover:border-violet-500 shadow-[0_6px_0_0_rgba(139,92,246,0.14)]',
    badge: 'bg-violet-100 text-violet-900',
    btn: 'bg-violet-600 hover:bg-violet-700 border-violet-800',
    softBg: 'bg-violet-50',
    border: 'border-violet-300',
  },
  teal: {
    card: 'border-teal-300 bg-white hover:border-teal-500 shadow-[0_6px_0_0_rgba(20,184,166,0.14)]',
    badge: 'bg-teal-100 text-teal-900',
    btn: 'bg-teal-600 hover:bg-teal-700 border-teal-800',
    softBg: 'bg-teal-50',
    border: 'border-teal-300',
  },
};

export const ArabicLiteracyStudioView: React.FC<ArabicLiteracyStudioViewProps> = ({
  student,
  childName = 'البطل',
  gradeLevel = 1,
  ageYears: _ageYears = 7,
  initialTab = 'foundations',
  initialStoryId,
  onClose,
  onNavigateTab,
  onActivityCompleted,
}) => {
  const effectiveName = student?.name || childName;
  const firstName = effectiveName.trim() ? effectiveName.trim().split(/\s+/)[0] : 'البطل';
  const effectiveGrade = student?.gradeLevel ?? gradeLevel;

  const prescription = useMemo(() => buildAdaptiveArabicPrescription(student), [student]);

  const [adaptiveState, setAdaptiveState] = useState<StudioAdaptiveState>(() =>
    loadStudioAdaptiveState(student?.id),
  );
  const completedStations = adaptiveState.completedStations;

  const updateAdaptiveState = useCallback(
    (updater: (prev: StudioAdaptiveState) => StudioAdaptiveState) => {
      setAdaptiveState((prev) => {
        const next = updater(prev);
        saveStudioAdaptiveState(student?.id, next);
        return next;
      });
    },
    [student?.id],
  );

  const adaptiveRecommendation = useMemo(
    () => pickAdaptiveRecommendedStation(student, prescription, completedStations, adaptiveState),
    [student, prescription, completedStations, adaptiveState],
  );
  const recommendedStation = adaptiveRecommendation.station;

  const getInitialStationFromProps = useCallback(
    (tab: StudioTabId, storyId?: string): string | null => {
      if (tab === 'library' || storyId) return 'stories-library';
      return null;
    },
    [],
  );

  const [activeStationId, setActiveStationId] = useState<string | null>(() =>
    getInitialStationFromProps(initialTab, initialStoryId),
  );
  const [trackFilter, setTrackFilter] = useState<TrackFilterId>(() => {
    if (initialTab === 'spelling') return 'spelling';
    if (initialTab === 'fluency') return 'fluency';
    const recTrack = adaptiveRecommendation.station.track;
    return recTrack === 'language' ? 'spelling' : recTrack === 'stories' ? 'letters' : recTrack;
  });
  const [showParentGuide, setShowParentGuide] = useState(false);
  const [isStoryFocused, setIsStoryFocused] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Inner phase states for single-skill stepped player
  const [spellingPhase, setSpellingPhase] = useState<SpellingPhase>('learn');
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [spellingRetryQueue, setSpellingRetryQueue] = useState<number[]>([]);
  const [selectedPracticeOpt, setSelectedPracticeOpt] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [assembledTileIndices, setAssembledTileIndices] = useState<number[]>([]);
  const [assemblyFeedback, setAssemblyFeedback] = useState<string | null>(null);

  const [langPhase, setLangPhase] = useState<LanguagePhase>('learn');
  const [langIdx, setLangIdx] = useState(0);
  const [langRetryQueue, setLangRetryQueue] = useState<number[]>([]);
  const [langChoice, setLangChoice] = useState<string | null>(null);

  const [fluencyPhase, setFluencyPhase] = useState<FluencyPhase>('listen');
  const [phraseIdx, setPhraseIdx] = useState(0);

  const prevStudentIdRef = useRef<string | undefined>(student?.id);

  // Sync URL/external route changes cleanly
  useEffect(() => {
    if (initialTab === 'library' || initialStoryId) {
      setActiveStationId('stories-library');
    } else if (initialTab === 'spelling') {
      setTrackFilter('spelling');
      setActiveStationId(null);
    } else if (initialTab === 'fluency') {
      setTrackFilter('fluency');
      setActiveStationId(null);
    }
  }, [initialTab, initialStoryId]);

  // Reload progress and reset view only when switching to a different student profile
  useEffect(() => {
    if (prevStudentIdRef.current === student?.id) return;
    prevStudentIdRef.current = student?.id;
    stopNaturalArabicAudio();
    setIsPlayingAudio(false);
    setAdaptiveState(loadStudioAdaptiveState(student?.id));
    setActiveStationId(getInitialStationFromProps(initialTab, initialStoryId));
    setSpellingPhase('learn');
    setPracticeIdx(0);
    setSpellingRetryQueue([]);
    setSelectedPracticeOpt(null);
    setShowHint(false);
    setAssembledTileIndices([]);
    setAssemblyFeedback(null);
    setLangPhase('learn');
    setLangIdx(0);
    setLangRetryQueue([]);
    setLangChoice(null);
    setFluencyPhase('listen');
    setPhraseIdx(0);
  }, [student?.id, initialTab, initialStoryId, getInitialStationFromProps]);

  // Immersion focus mode when inside any non-stories skill player
  useEffect(() => {
    if (activeStationId && activeStationId !== 'stories-library') {
      document.body.classList.add('baseera-reading-focus');
      window.scrollTo({ top: 0, behavior: 'auto' });
      return () => {
        document.body.classList.remove('baseera-reading-focus');
      };
    }
    return undefined;
  }, [activeStationId]);

  // Stop speech when leaving station or unmounting
  useEffect(() => {
    return () => {
      stopNaturalArabicAudio();
    };
  }, [activeStationId]);

  const stopAudio = useCallback(() => {
    stopNaturalArabicAudio();
    setIsPlayingAudio(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    try {
      stopNaturalArabicAudio();
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

  const markStationCompleted = useCallback(
    (stationId: string) => {
      updateAdaptiveState((prev) => ({
        ...prev,
        completedStations: [...new Set([...prev.completedStations, stationId])],
      }));
    },
    [updateAdaptiveState],
  );

  const resetStationPlayerState = useCallback(() => {
    stopAudio();
    setAudioError(null);
    setSpellingPhase('learn');
    setPracticeIdx(0);
    setSpellingRetryQueue([]);
    setSelectedPracticeOpt(null);
    setShowHint(false);
    setAssembledTileIndices([]);
    setAssemblyFeedback(null);
    setLangPhase('learn');
    setLangIdx(0);
    setLangRetryQueue([]);
    setLangChoice(null);
    setFluencyPhase('listen');
    setPhraseIdx(0);
  }, [stopAudio]);

  const openStation = useCallback(
    (stationId: string) => {
      resetStationPlayerState();
      setActiveStationId(stationId);
      setShowParentGuide(false);
    },
    [resetStationPlayerState],
  );

  const closePlayer = useCallback(() => {
    stopAudio();
    setActiveStationId(null);
  }, [stopAudio]);

  const handleAdvanceNext = useCallback(() => {
    if (!activeStationId) return;
    const nextId = getNextStationId(activeStationId);
    if (nextId) {
      openStation(nextId);
    } else {
      closePlayer();
    }
  }, [activeStationId, openStation, closePlayer]);

  const activeStation = useMemo(
    () => getStationById(activeStationId),
    [activeStationId],
  );

  const visibleStations = useMemo(() => {
    if (trackFilter === 'all') return LEARNING_PATH_STATIONS;
    if (trackFilter === 'spelling') {
      return LEARNING_PATH_STATIONS.filter(
        (s) => s.track === 'spelling' || s.track === 'language',
      );
    }
    return LEARNING_PATH_STATIONS.filter((s) => s.track === trackFilter);
  }, [trackFilter]);

  const activeSpellingLesson: SpellingLesson | undefined = useMemo(() => {
    if (activeStation?.kind !== 'spelling') return undefined;
    return SPELLING_LESSONS.find((l) => l.id === activeStation.refId) || SPELLING_LESSONS[0];
  }, [activeStation]);

  const availableTiles = useMemo(() => {
    if (!activeSpellingLesson) return [];
    return [
      ...activeSpellingLesson.independentTask.scrambledSyllables,
      ...(activeSpellingLesson.independentTask.distractorTiles || []),
    ].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [activeSpellingLesson]);

  const activeLanguageUnit: ArabicLanguageUnit | undefined = useMemo(() => {
    if (activeStation?.kind !== 'language') return undefined;
    return ARABIC_LANGUAGE_UNITS.find((u) => u.id === activeStation.refId) || ARABIC_LANGUAGE_UNITS[0];
  }, [activeStation]);

  const activeFluencyPassage: FluencyPassageTrack | undefined = useMemo(() => {
    if (activeStation?.kind !== 'fluency') return undefined;
    return FLUENCY_PASSAGES.find((p) => p.id === activeStation.refId) || FLUENCY_PASSAGES[0];
  }, [activeStation]);

  const handleTileIndexClick = (tileIdx: number) => {
    setAssemblyFeedback(null);
    setAssembledTileIndices((prev) =>
      prev.includes(tileIdx) ? prev.filter((x) => x !== tileIdx) : [...prev, tileIdx],
    );
  };

  const checkSpellingAssembly = () => {
    if (!activeSpellingLesson || !activeStation) return;
    const assembledWord = assembledTileIndices.map((idx) => availableTiles[idx] ?? '').join('');
    const target = activeSpellingLesson.independentTask.targetWord.replace(
      /[\u064B-\u065F\u0670\u0640\s]/g,
      '',
    );
    const cleanAssembled = assembledWord.replace(/[\u064B-\u065F\u0670\u0640\s]/g, '');

    if (cleanAssembled === target) {
      setAssemblyFeedback(null);
      markStationCompleted(activeStation.id);
      onActivityCompleted?.('spelling', activeSpellingLesson.id);
      setSpellingPhase('celebrate');
      void speak('أَحْسَنْتَ! إِجَابَةٌ صَحِيحَةٌ.');
    } else {
      setAssemblyFeedback('جرّب إعادة ترتيب المقاطع لتطابق الكلمة المطلوبة.');
      void speak('حاول إعادة ترتيب المقاطع بالترتيب الصحيح.');
    }
  };

  const resolvePatternStationId = (pattern: DetectedErrorPattern): string | null => {
    if (pattern.targetTab === 'foundations') {
      return `foundation-${pattern.targetSubMode || 'trace'}`;
    }
    if (pattern.targetTab === 'spelling') {
      return `spelling-${pattern.targetSubMode || prescription.recommendedSpellingLessonId}`;
    }
    if (pattern.targetTab === 'fluency') {
      return `fluency-fluency-g${Math.max(1, Math.min(3, effectiveGrade || 1))}`;
    }
    return null;
  };

  const handleApplyParentPattern = (pattern: DetectedErrorPattern) => {
    stopAudio();
    if (pattern.targetTab === 'dyslexia-lab' || pattern.targetTab === 'guided-program') {
      setShowParentGuide(false);
      onNavigateTab?.(pattern.targetTab);
      return;
    }
    const targetStation = resolvePatternStationId(pattern);
    if (targetStation && getStationById(targetStation)) {
      openStation(targetStation);
    } else {
      setShowParentGuide(false);
    }
  };

  // Compute progress percentage inside player
  const playerProgressPercent = useMemo(() => {
    if (!activeStation) return 0;
    if (activeStation.kind === 'spelling') {
      const map: Record<SpellingPhase, number> = {
        learn: 20,
        example: 40,
        practice: 65,
        build: 85,
        celebrate: 100,
      };
      return map[spellingPhase];
    }
    if (activeStation.kind === 'language' && activeLanguageUnit) {
      if (langPhase === 'learn') return 20;
      if (langPhase === 'celebrate') return 100;
      return Math.round(30 + ((langIdx + 1) / activeLanguageUnit.items.length) * 65);
    }
    if (activeStation.kind === 'fluency' && activeFluencyPassage) {
      if (fluencyPhase === 'listen') return 15;
      if (fluencyPhase === 'celebrate') return 100;
      return Math.round(25 + ((phraseIdx + 1) / activeFluencyPassage.phrasedLines.length) * 70);
    }
    return 50;
  }, [
    activeStation,
    spellingPhase,
    langPhase,
    langIdx,
    activeLanguageUnit,
    fluencyPhase,
    phraseIdx,
    activeFluencyPassage,
  ]);

  const currentAudioPrompt = useMemo(() => {
    if (!activeStation) return '';
    if (activeStation.kind === 'spelling' && activeSpellingLesson) {
      if (spellingPhase === 'learn') return activeSpellingLesson.ruleAudioTextAr;
      if (spellingPhase === 'example') return activeSpellingLesson.workedExample.targetWord;
      if (spellingPhase === 'practice') {
        const q = activeSpellingLesson.guidedPractices[practiceIdx];
        return q ? `${q.promptAr} ${q.wordContextAr.replace(/\.+/g, '')}` : '';
      }
      if (spellingPhase === 'build') return activeSpellingLesson.independentTask.promptAr;
    }
    if (activeStation.kind === 'language' && activeLanguageUnit) {
      if (langPhase === 'learn') return activeLanguageUnit.ruleAr.join(' ');
      if (langPhase === 'practice') {
        const q = activeLanguageUnit.items[langIdx];
        return q ? q.showAr.replace(/\.\.\./g, '') : '';
      }
    }
    if (activeStation.kind === 'fluency' && activeFluencyPassage) {
      if (fluencyPhase === 'listen') return activeFluencyPassage.fullTextVowelled;
      if (fluencyPhase === 'phrase') {
        return activeFluencyPassage.phrasedLines[phraseIdx]?.textAr || '';
      }
    }
    return '';
  }, [
    activeStation,
    activeSpellingLesson,
    spellingPhase,
    practiceIdx,
    activeLanguageUnit,
    langPhase,
    langIdx,
    activeFluencyPassage,
    fluencyPhase,
    phraseIdx,
  ]);

  // ===========================================================================
  // VIEW B: FULL-SCREEN STORIES LIBRARY STATION
  // ===========================================================================
  if (activeStation?.kind === 'stories') {
    return (
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4" dir="rtl">
        {!isStoryFocused && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-3xl p-4 border-[3px] border-teal-200 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={closePlayer}
                className="min-w-[44px] min-h-[44px] rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black px-3 flex items-center gap-1.5 cursor-pointer"
                aria-label="العودة إلى خريطة المهارات"
              >
                <ArrowRight className="w-5 h-5" />
                <span className="text-sm">خريطة المهارات</span>
              </button>
              <span className="text-base font-black text-slate-900">المكتبة المصوّرة</span>
            </div>
            <button
              type="button"
              onClick={() => setShowParentGuide(true)}
              className="bz-btn bz-btn-ghost text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-teal-700" />
              <span>دليل ولي الأمر</span>
            </button>
          </div>
        )}

        <InteractiveStoryReader
          student={student}
          adaptiveState={adaptiveState}
          recommendedStoryId={prescription.recommendedStoryId}
          childName={firstName}
          initialStoryId={initialStoryId}
          onReadingChange={setIsStoryFocused}
          onActivityCompleted={(storyId, struggledWords) => {
            updateAdaptiveState((prev) => recordStoryActivity(prev, storyId, struggledWords));
            markStationCompleted('stories-library');
            onActivityCompleted?.('story', storyId, struggledWords);
          }}
        />
      </div>
    );
  }

  // ===========================================================================
  // VIEW B: FULL-SCREEN SINGLE-SKILL FOCUS PLAYER
  // ===========================================================================
  if (activeStation) {
    const accent = ACCENT_CLASSES[activeStation.accent];

    return (
      <div className="min-h-[85vh] max-w-3xl mx-auto px-4 py-5 flex flex-col gap-5" dir="rtl">
        {/* Unified Calm Top Bar */}
        <div className="flex items-center gap-3 bg-white rounded-3xl p-3 border-[3px] border-slate-200 shadow-xs">
          <button
            type="button"
            onClick={closePlayer}
            aria-label="العودة إلى خريطة المهارات"
            className="min-w-[44px] min-h-[44px] rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-xs font-black text-slate-600 px-1">
              <span>{activeStation.shortTitleAr}</span>
              <span>
                {toArabicNum(activeStation.order)} / {toArabicNum(LEARNING_PATH_STATIONS.length)}
              </span>
            </div>
            <div className="h-3.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
              <div
                className="h-full bg-gradient-to-l from-teal-500 to-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(10, playerProgressPercent)}%` }}
              />
            </div>
          </div>

          {currentAudioPrompt && (
            <button
              type="button"
              onClick={() => (isPlayingAudio ? stopAudio() : void speak(currentAudioPrompt))}
              aria-label={isPlayingAudio ? 'إيقاف الصوت' : 'استمع للتعليمات'}
              className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center border-2 cursor-pointer transition-all ${
                isPlayingAudio
                  ? 'bg-rose-100 border-rose-300 text-rose-700'
                  : 'bg-teal-50 border-teal-300 text-teal-800 hover:bg-teal-100'
              }`}
            >
              {isPlayingAudio ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          )}
        </div>

        {audioError && (
          <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-2xl text-xs font-bold text-amber-950 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{audioError}</span>
          </div>
        )}

        {/* 1. FOUNDATION GAME IN SINGLE-SKILL MODE */}
        {activeStation.kind === 'foundation' && (
          <ArabicFoundationsView
            singleMode
            student={student}
            studentId={student?.id}
            childName={firstName}
            initialMode={activeStation.refId as FoundationSubMode}
            recommendedLetterFocus={prescription.recommendedLetterFocus}
            adaptiveState={adaptiveState}
            onAdaptiveAttempt={(letter, correct, traced) => {
              updateAdaptiveState((prev) => recordLetterAttempt(prev, letter, correct, traced));
            }}
            onActivityCompleted={(id) => {
              markStationCompleted(activeStation.id);
              onActivityCompleted?.('foundations', id);
            }}
            onNextSkill={handleAdvanceNext}
          />
        )}

        {/* 2. SPELLING STATION (1 STEP AT A TIME) */}
        {activeStation.kind === 'spelling' && activeSpellingLesson && (
          <div className="flex-1 flex flex-col justify-center">
            {spellingPhase === 'learn' && (
              <div className={`rounded-3xl border-[3px] ${accent.border} bg-white p-6 sm:p-8 shadow-md text-center space-y-6`}>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-950">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  تعلّم القاعدة
                </span>

                <div className="py-4 px-6 rounded-3xl bg-amber-50/70 border-2 border-amber-200 inline-block">
                  <p className="text-4xl sm:text-5xl font-black text-amber-950">
                    {activeSpellingLesson.workedExample.targetWord}
                  </p>
                </div>

                <p className="text-lg sm:text-xl font-bold text-slate-800 leading-relaxed max-w-xl mx-auto">
                  {activeSpellingLesson.ruleSummaryAr}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => void speak(activeSpellingLesson.ruleAudioTextAr)}
                    className="min-h-[52px] px-6 rounded-2xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-base flex items-center gap-2 cursor-pointer"
                  >
                    <Volume2 className="w-5 h-5 text-amber-600" />
                    <span>اسمع الشرح</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopAudio();
                      setSpellingPhase('example');
                    }}
                    className="min-h-[52px] px-8 rounded-2xl border-b-4 border-amber-700 bg-amber-500 hover:bg-amber-600 text-white font-black text-base flex items-center gap-2 cursor-pointer"
                  >
                    <span>فهمت! هيا نلعب</span>
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {spellingPhase === 'example' && (
              <div className={`rounded-3xl border-[3px] ${accent.border} bg-white p-6 sm:p-8 shadow-md text-center space-y-6`}>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-sky-100 text-sky-900">
                  شاهد تفكيك الكلمة
                </span>

                <p className="text-4xl sm:text-5xl font-black text-slate-900">
                  {activeSpellingLesson.workedExample.targetWord}
                </p>

                <div className="flex items-center justify-center gap-3 flex-wrap" dir="rtl">
                  {activeSpellingLesson.workedExample.visualBreakdown.map((part, i) => (
                    <span
                      key={i}
                      className="px-5 py-3 rounded-2xl border-[3px] border-amber-300 bg-amber-50 text-2xl sm:text-3xl font-black text-amber-950 shadow-xs"
                    >
                      {part}
                    </span>
                  ))}
                </div>

                <p className="text-base font-bold text-teal-900 bg-teal-50 border border-teal-200 rounded-2xl py-3 px-4 max-w-lg mx-auto">
                  {activeSpellingLesson.workedExample.proofTipAr}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    stopAudio();
                    setPracticeIdx(0);
                    setSelectedPracticeOpt(null);
                    setShowHint(false);
                    setSpellingPhase('practice');
                  }}
                  className="min-h-[52px] px-8 rounded-2xl border-b-4 border-amber-700 bg-amber-500 hover:bg-amber-600 text-white font-black text-base inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>ابدأ التحدي!</span>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            )}

            {spellingPhase === 'practice' && (() => {
              const baseLen = activeSpellingLesson.guidedPractices.length;
              const isRetryTurn = practiceIdx >= baseLen;
              const actualPracticeIdx = isRetryTurn
                ? spellingRetryQueue[practiceIdx - baseLen] ?? 0
                : practiceIdx;
              const totalPracticeSteps = baseLen + spellingRetryQueue.length;
              const q =
                activeSpellingLesson.guidedPractices[actualPracticeIdx] ||
                activeSpellingLesson.guidedPractices[0];
              const isAnswered = selectedPracticeOpt !== null;
              const isCorrect = selectedPracticeOpt === q.correctId;

              return (
                <div className={`rounded-3xl border-[3px] ${accent.border} bg-white p-6 sm:p-8 shadow-md space-y-6`}>
                  <div className="flex items-center justify-between text-xs font-black text-slate-500">
                    <span>
                      {isRetryTurn
                        ? 'مراجعة ذكية لما أخطأنا فيه'
                        : `التحدي ${toArabicNum(practiceIdx + 1)} من ${toArabicNum(totalPracticeSteps)}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowHint((h) => !h)}
                      className="min-h-[36px] px-3 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                      <span>{showHint ? 'إخفاء التلميح' : 'تلميح'}</span>
                    </button>
                  </div>

                  <div className="bg-slate-50 rounded-3xl p-6 border-2 border-slate-200 text-center space-y-2">
                    <p className="text-base font-bold text-slate-600">{q.promptAr}</p>
                    <p className="text-3xl font-black text-slate-900">{q.wordContextAr}</p>
                  </div>

                  {showHint && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-200 text-sm font-bold text-amber-950 text-center">
                      {q.hintAr}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-3">
                    {q.options.map((opt) => {
                      const picked = selectedPracticeOpt === opt.id;
                      const right = opt.id === q.correctId;
                      let cls =
                        'border-slate-200 bg-white text-slate-900 hover:border-amber-400 hover:-translate-y-0.5';
                      if (isAnswered) {
                        if (right) cls = 'border-emerald-500 bg-emerald-50 text-emerald-950';
                        else if (picked) cls = 'border-rose-400 bg-rose-50 text-rose-900';
                        else cls = 'border-slate-200 bg-slate-50 text-slate-400';
                      }
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isAnswered}
                          onClick={() => {
                            setSelectedPracticeOpt(opt.id);
                            updateAdaptiveState((prev) =>
                              recordStationAnswer(prev, activeStation.id, right, q.options.length),
                            );
                            if (!right && !isRetryTurn) {
                              setSpellingRetryQueue((rq) =>
                                rq.includes(actualPracticeIdx) ? rq : [...rq, actualPracticeIdx],
                              );
                            }
                            void speak(q.explanationAr);
                          }}
                          className={`min-h-[60px] p-4 rounded-2xl border-[3px] font-black text-xl transition-all cursor-pointer ${cls}`}
                        >
                          {opt.labelAr}
                        </button>
                      );
                    })}
                  </div>

                  {isAnswered && (
                    <div
                      className={`p-4 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-3 ${
                        isCorrect
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          : 'bg-rose-50 border-rose-200 text-rose-950'
                      }`}
                    >
                      <p className="text-sm font-bold flex-1">{q.explanationAr}</p>
                      <button
                        type="button"
                        onClick={() => {
                          stopAudio();
                          setShowHint(false);
                          setSelectedPracticeOpt(null);
                          if (practiceIdx + 1 < totalPracticeSteps) {
                            setPracticeIdx((p) => p + 1);
                          } else {
                            setAssembledTileIndices([]);
                            setAssemblyFeedback(null);
                            setSpellingPhase('build');
                          }
                        }}
                        className="min-h-[48px] px-6 rounded-2xl border-b-4 border-amber-700 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>التالي</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {spellingPhase === 'build' && (
              <div className={`rounded-3xl border-[3px] ${accent.border} bg-white p-6 sm:p-8 shadow-md space-y-6 text-center`}>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-950">
                  ركّب الكلمة
                </span>

                <p className="text-xl font-black text-slate-900">
                  {activeSpellingLesson.independentTask.promptAr}
                </p>

                <div className="bg-slate-50 rounded-3xl p-6 border-2 border-dashed border-amber-300 min-h-[88px] flex items-center justify-center gap-3 flex-wrap">
                  {assembledTileIndices.length === 0 ? (
                    <span className="text-sm font-bold text-slate-400">اضغط على المقاطع بالترتيب</span>
                  ) : (
                    assembledTileIndices.map((tileIdx, i) => (
                      <button
                        key={`${tileIdx}-${i}`}
                        type="button"
                        onClick={() => handleTileIndexClick(tileIdx)}
                        className="min-h-[48px] px-5 py-2 rounded-2xl bg-amber-500 hover:bg-rose-500 text-white text-2xl font-black shadow-xs cursor-pointer transition-colors"
                      >
                        {availableTiles[tileIdx]}
                      </button>
                    ))
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  {availableTiles.map((tile, i) => {
                    const isUsed = assembledTileIndices.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={isUsed}
                        onClick={() => handleTileIndexClick(i)}
                        className={`min-w-[60px] min-h-[56px] px-5 py-3 rounded-2xl text-2xl font-black border-[3px] transition-all cursor-pointer ${
                          isUsed
                            ? 'bg-slate-100 border-slate-200 text-slate-300 opacity-40'
                            : 'bg-white border-amber-300 text-amber-950 hover:border-amber-500 hover:-translate-y-0.5 shadow-xs'
                        }`}
                      >
                        {tile}
                      </button>
                    );
                  })}
                </div>

                {assemblyFeedback && (
                  <div className="p-3 rounded-2xl bg-rose-50 border-2 border-rose-200 text-sm font-bold text-rose-900">
                    {assemblyFeedback}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAssembledTileIndices([]);
                      setAssemblyFeedback(null);
                    }}
                    className="min-h-[48px] px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>مسح</span>
                  </button>
                  <button
                    type="button"
                    disabled={assembledTileIndices.length === 0}
                    onClick={checkSpellingAssembly}
                    className="min-h-[52px] px-8 rounded-2xl border-b-4 border-amber-700 bg-amber-500 hover:bg-amber-600 text-white font-black text-base flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>تحقق</span>
                  </button>
                </div>
              </div>
            )}

            {spellingPhase === 'celebrate' && (
              <CelebrationCard
                firstName={firstName}
                skillTitle={activeStation.shortTitleAr}
                onNext={getNextStationId(activeStation.id) ? handleAdvanceNext : undefined}
                onBackToMap={closePlayer}
              />
            )}
          </div>
        )}

        {/* 3. ARABIC LANGUAGE UNIT STATION (1 STEP AT A TIME) */}
        {activeStation.kind === 'language' && activeLanguageUnit && (
          <div className="flex-1 flex flex-col justify-center">
            {langPhase === 'learn' && (
              <div className={`rounded-3xl border-[3px] ${accent.border} bg-white p-6 sm:p-8 shadow-md text-center space-y-6`}>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-violet-100 text-violet-900">
                  <Lightbulb className="w-4 h-4 text-violet-600" />
                  تعلّم المهارة
                </span>

                <div className="py-5 px-6 rounded-3xl bg-violet-50/80 border-2 border-violet-200 max-w-xl mx-auto">
                  <p className="text-2xl sm:text-3xl font-black text-violet-950">
                    {activeLanguageUnit.exampleShowAr}
                  </p>
                </div>

                <p className="text-lg font-bold text-slate-800 leading-relaxed max-w-xl mx-auto">
                  {activeLanguageUnit.ruleAr[0]}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => void speak(activeLanguageUnit.ruleAr.join(' '))}
                    className="min-h-[52px] px-6 rounded-2xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-base flex items-center gap-2 cursor-pointer"
                  >
                    <Volume2 className="w-5 h-5 text-violet-600" />
                    <span>اسمع القاعدة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopAudio();
                      setLangIdx(0);
                      setLangChoice(null);
                      setLangPhase('practice');
                    }}
                    className="min-h-[52px] px-8 rounded-2xl border-b-4 border-violet-800 bg-violet-600 hover:bg-violet-700 text-white font-black text-base flex items-center gap-2 cursor-pointer"
                  >
                    <span>هيا نلعب!</span>
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {langPhase === 'practice' && (() => {
              const baseLen = activeLanguageUnit.items.length;
              const isRetryTurn = langIdx >= baseLen;
              const actualLangIdx = isRetryTurn
                ? langRetryQueue[langIdx - baseLen] ?? 0
                : langIdx;
              const totalLangSteps = baseLen + langRetryQueue.length;
              const q = activeLanguageUnit.items[actualLangIdx] || activeLanguageUnit.items[0];
              const answered = langChoice !== null;
              const isCorrect = langChoice === q.correctAnswer;

              return (
                <div className={`rounded-3xl border-[3px] ${accent.border} bg-white p-6 sm:p-8 shadow-md space-y-6`}>
                  <div className="flex items-center justify-between text-xs font-black text-slate-500">
                    <span>
                      {isRetryTurn
                        ? 'مراجعة ذكية لما أخطأنا فيه'
                        : `سؤال ${toArabicNum(langIdx + 1)} من ${toArabicNum(totalLangSteps)}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => void speak(q.showAr.replace(/\.\.\./g, ''))}
                      className="text-violet-700 font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>اسمع</span>
                    </button>
                  </div>

                  <div className="bg-slate-50 rounded-3xl p-6 border-2 border-slate-200 text-center space-y-2">
                    <p className="text-base font-bold text-slate-600">{q.promptAr}</p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900">{q.showAr}</p>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    {q.options.map((opt) => {
                      const chosen = langChoice === opt;
                      const right = opt === q.correctAnswer;
                      let cls =
                        'border-slate-200 bg-white text-slate-900 hover:border-violet-400 hover:-translate-y-0.5';
                      if (answered) {
                        if (right) cls = 'border-emerald-500 bg-emerald-50 text-emerald-950';
                        else if (chosen) cls = 'border-rose-400 bg-rose-50 text-rose-900';
                        else cls = 'border-slate-200 bg-slate-50 text-slate-400';
                      }
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={answered}
                          onClick={() => {
                            setLangChoice(opt);
                            updateAdaptiveState((prev) =>
                              recordStationAnswer(prev, activeStation.id, right, q.options.length),
                            );
                            if (!right && !isRetryTurn) {
                              setLangRetryQueue((rq) =>
                                rq.includes(actualLangIdx) ? rq : [...rq, actualLangIdx],
                              );
                            }
                            void speak(q.explanationAr);
                          }}
                          className={`min-h-[60px] p-4 rounded-2xl border-[3px] font-black text-lg transition-all cursor-pointer ${cls}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {answered && (
                    <div
                      className={`p-4 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-3 ${
                        isCorrect
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          : 'bg-rose-50 border-rose-200 text-rose-950'
                      }`}
                    >
                      <p className="text-sm font-bold flex-1">{q.explanationAr}</p>
                      <button
                        type="button"
                        onClick={() => {
                          stopAudio();
                          setLangChoice(null);
                          if (langIdx + 1 < totalLangSteps) {
                            setLangIdx((p) => p + 1);
                          } else {
                            markStationCompleted(activeStation.id);
                            onActivityCompleted?.('spelling', `lang-${activeLanguageUnit.id}`);
                            setLangPhase('celebrate');
                            void speak('أَحْسَنْتَ! إِجَابَةٌ صَحِيحَةٌ.');
                          }
                        }}
                        className="min-h-[48px] px-6 rounded-2xl border-b-4 border-violet-800 bg-violet-600 hover:bg-violet-700 text-white font-black text-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>التالي</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {langPhase === 'celebrate' && (
              <CelebrationCard
                firstName={firstName}
                skillTitle={activeStation.shortTitleAr}
                onNext={getNextStationId(activeStation.id) ? handleAdvanceNext : undefined}
                onBackToMap={closePlayer}
              />
            )}
          </div>
        )}

        {/* 4. CALM FLUENCY STATION (ONE SINGLE PHRASE PER SCREEN!) */}
        {activeStation.kind === 'fluency' && activeFluencyPassage && (
          <div className="flex-1 flex flex-col justify-center">
            {fluencyPhase === 'listen' && (
              <div className={`rounded-3xl border-[3px] ${accent.border} bg-white p-7 sm:p-10 shadow-md text-center space-y-6`}>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-900">
                  <Feather className="w-4 h-4 text-teal-700" />
                  الصف {toArabicNum(activeFluencyPassage.gradeLevel)}
                </span>

                <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                  {activeFluencyPassage.titleAr}
                </h2>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      isPlayingAudio
                        ? stopAudio()
                        : void speak(activeFluencyPassage.fullTextVowelled)
                    }
                    className="min-h-[56px] px-7 rounded-2xl border-2 border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-950 font-black text-base flex items-center gap-2 cursor-pointer"
                  >
                    {isPlayingAudio ? (
                      <VolumeX className="w-5 h-5 text-rose-600" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-teal-700" />
                    )}
                    <span>{isPlayingAudio ? 'إيقاف الصوت' : 'استمع للنموذج'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopAudio();
                      setPhraseIdx(0);
                      setFluencyPhase('phrase');
                    }}
                    className="min-h-[56px] px-8 rounded-2xl border-b-4 border-teal-800 bg-teal-600 hover:bg-teal-700 text-white font-black text-base flex items-center gap-2 cursor-pointer"
                  >
                    <span>ابدأ القراءة جملةً بجملة</span>
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {fluencyPhase === 'phrase' && (() => {
              const line =
                activeFluencyPassage.phrasedLines[phraseIdx] ||
                activeFluencyPassage.phrasedLines[0];
              const hasMore = phraseIdx + 1 < activeFluencyPassage.phrasedLines.length;

              return (
                <div className={`rounded-3xl border-[3px] ${accent.border} bg-[#FFFDF8] p-7 sm:p-10 shadow-md text-center space-y-7`}>
                  <span className="inline-block px-3.5 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-900">
                    جملة {toArabicNum(phraseIdx + 1)} من{' '}
                    {toArabicNum(activeFluencyPassage.phrasedLines.length)}
                  </span>

                  <p
                    className="text-3xl sm:text-4xl font-black text-slate-900 leading-loose"
                    style={{ fontFamily: 'var(--font-reading)' }}
                  >
                    {line.textAr}
                  </p>

                  {line.cueNotesAr && (
                    <div>
                      <span className="inline-block px-4 py-1.5 rounded-full bg-amber-100 text-amber-950 text-xs font-black">
                        {line.cueNotesAr}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => void speak(line.textAr)}
                      className="min-h-[54px] px-6 rounded-2xl border-2 border-teal-300 bg-white hover:bg-teal-50 text-teal-900 font-black text-base flex items-center gap-2 cursor-pointer"
                    >
                      <Volume2 className="w-5 h-5 text-teal-700" />
                      <span>استمع</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        stopAudio();
                        if (hasMore) {
                          setPhraseIdx((p) => p + 1);
                        } else {
                          markStationCompleted(activeStation.id);
                          onActivityCompleted?.('fluency', activeFluencyPassage.id);
                          setFluencyPhase('celebrate');
                          void speak('أَحْسَنْتَ! إِجَابَةٌ صَحِيحَةٌ.');
                        }
                      }}
                      className="min-h-[54px] px-8 rounded-2xl border-b-4 border-teal-800 bg-teal-600 hover:bg-teal-700 text-white font-black text-base flex items-center gap-2 cursor-pointer"
                    >
                      <span>{hasMore ? 'قرأتها! الجملة التالية' : 'أتممت القراءة!'}</span>
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {fluencyPhase === 'celebrate' && (
              <CelebrationCard
                firstName={firstName}
                skillTitle={activeStation.shortTitleAr}
                onNext={getNextStationId(activeStation.id) ? handleAdvanceNext : undefined}
                onBackToMap={closePlayer}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // VIEW A: CALM VISUAL STEPPING-STONE LEARNING PATH MAP
  // ===========================================================================
  const recAccent = ACCENT_CLASSES[recommendedStation.accent];

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-6" dir="rtl">
      {/* Compact Kid-First Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-3xl p-4 sm:p-5 border-[3px] border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Mascot mood="wave" size={56} />
          <div>
            <h1 className="text-2xl font-black text-slate-900">أهلًا يا {firstName}!</h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-100 text-amber-950 text-xs font-black mt-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-600" aria-hidden="true" />
              <span>
                {toArabicNum(completedStations.length)} / {toArabicNum(LEARNING_PATH_STATIONS.length)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowParentGuide(true)}
            className="min-h-[44px] px-4 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-black text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <GraduationCap className="w-4 h-4 text-teal-700" />
            <span>دليل ولي الأمر</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>الرئيسية</span>
            </button>
          )}
        </div>
      </header>

      {/* Spotlight Card: ONE Recommended Station */}
      <section
        aria-label="محطتك الآن"
        className={`rounded-3xl border-[3px] ${recAccent.border} bg-gradient-to-br from-white via-[#F4FBF9] to-[#E6F7F2] p-6 shadow-[0_8px_0_0_rgba(13,148,136,0.12)] flex flex-wrap items-center justify-between gap-4`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl ${recAccent.badge} flex items-center justify-center shrink-0`}>
            {getStationIcon(recommendedStation, 'w-7 h-7')}
          </div>
          <div>
            <span className="inline-block px-3 py-0.5 rounded-full bg-teal-600 text-white text-xs font-black mb-1">
              محطتك التكيّفية الآن
            </span>
            <h2 className="text-2xl font-black text-slate-900">
              {recommendedStation.shortTitleAr}
            </h2>
            <p className="text-xs sm:text-sm font-bold text-teal-900/80 mt-1 max-w-xl">
              {adaptiveRecommendation.reasonAr}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openStation(recommendedStation.id)}
          className="min-h-[52px] px-7 rounded-2xl border-b-4 border-teal-800 bg-teal-600 hover:bg-teal-700 text-white font-black text-base flex items-center gap-2 cursor-pointer transition-transform active:translate-y-0.5"
        >
          <Play className="w-5 h-5 fill-current" aria-hidden="true" />
          <span>ابدأ الآن</span>
        </button>
      </section>

      {/* 4 Progressive Stage Cards + Optional 'All' Toggle (Fixed Contrast & Typography Hierarchy) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base sm:text-lg font-black text-slate-900">مراحل التعلّم المتدرّجة:</h2>
          <button
            type="button"
            onClick={() => setTrackFilter(trackFilter === 'all' ? 'letters' : 'all')}
            className="text-xs sm:text-sm font-extrabold text-teal-700 hover:text-teal-900 underline cursor-pointer"
          >
            {trackFilter === 'all' ? 'عرض مرحلة واحدة فقط' : `عرض كل المهارات (${toArabicNum(LEARNING_PATH_STATIONS.length)})`}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="tablist" aria-label="مراحل التعلّم">
          {(
            [
              { id: 'letters', step: 'المرحلة ١', label: 'الحروف وأصواتها', sub: '٤ أنشطة تأسيس' },
              { id: 'spelling', step: 'المرحلة ٢', label: 'المقاطع والإملاء', sub: '١٠ مهارات' },
              { id: 'fluency', step: 'المرحلة ٣', label: 'القراءة والطلاقة', sub: '٣ نصوص متدرجة' },
              { id: 'stories', step: 'المرحلة ٤', label: 'القصص المصوّرة', sub: 'قصص ناطقة' },
            ] as Array<{ id: TrackFilterId; step: string; label: string; sub: string }>
          ).map((pill) => {
            const active = trackFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (pill.id === 'stories') {
                    openStation('stories-library');
                  } else {
                    setTrackFilter(pill.id);
                  }
                }}
                className={`min-h-[88px] p-4 rounded-2xl border-[3px] text-right transition-all cursor-pointer flex flex-col justify-between ${
                  active
                    ? 'bg-teal-700 border-teal-900 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-900 hover:border-teal-400'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                      active ? 'bg-teal-950 text-amber-300' : 'bg-teal-50 text-teal-800 border border-teal-200'
                    }`}
                  >
                    {pill.step}
                  </span>
                  <span className={`text-xs font-bold ${active ? 'text-teal-100' : 'text-slate-500'}`}>
                    {pill.sub}
                  </span>
                </div>
                <strong className={`text-base sm:text-lg font-black mt-2 block leading-snug ${active ? 'text-white' : 'text-slate-900'}`}>
                  {pill.label}
                </strong>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stepping-Stone Path Cards (Clear Typography & Action Affordance) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleStations.map((station) => {
          const isDone = completedStations.includes(station.id);
          const isNext = station.id === recommendedStation.id;
          const masteryPct = getStationMasteryPercent(adaptiveState, station.id);
          const accent = ACCENT_CLASSES[station.accent];
          const trackLabel =
            station.kind === 'foundation'
              ? 'تأسيس الحروف والأصوات'
              : station.kind === 'spelling'
              ? 'قاعدة إملائية وتطبيق'
              : station.kind === 'language'
              ? 'مهارة لغوية وتدريب'
              : station.kind === 'fluency'
              ? 'قراءة جهرية معبّرة'
              : 'قصص مصوّرة تفاعلية';

          return (
            <button
              key={station.id}
              type="button"
              onClick={() => openStation(station.id)}
              className={`group rounded-3xl border-[3px] p-5 min-h-[100px] flex items-center justify-between gap-4 text-right transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-teal-400/50 ${
                isDone
                  ? 'border-emerald-400 bg-emerald-50/60 hover:border-emerald-500 shadow-xs'
                  : isNext
                  ? `${accent.card} ring-4 ring-teal-300/40`
                  : accent.card
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${
                    isDone ? 'bg-emerald-600 text-white' : accent.badge
                  }`}
                >
                  {toArabicNum(station.order)}
                </span>

                <div className="min-w-0">
                  <span className="block font-black text-lg sm:text-xl text-slate-900 leading-snug">
                    {station.shortTitleAr}
                  </span>
                  <span className="block text-xs sm:text-sm font-bold text-slate-500 mt-0.5">
                    {trackLabel}{masteryPct !== null ? ` · إتقان ${toArabicNum(masteryPct)}٪` : ''}
                  </span>
                </div>
              </div>

              <span
                className={`px-3.5 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 shrink-0 transition-colors ${
                  isDone
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-teal-50 text-teal-800 border border-teal-200 group-hover:bg-teal-600 group-hover:text-white'
                }`}
              >
                {isDone ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>مكتمل</span>
                  </>
                ) : (
                  <>
                    <span>ابدأ</span>
                    <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Parent & Specialist Guide Modal (Tucks all adult reports away cleanly) */}
      {showParentGuide && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowParentGuide(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="دليل ولي الأمر والمختص"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[88vh] overflow-y-auto p-6 space-y-5 border-[3px] border-teal-200 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-teal-50 text-teal-800">
                  <GraduationCap className="w-4 h-4 text-teal-700" />
                  دليل ولي الأمر والمختص · ملف {firstName}
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">التوجيه التكيفي للأخطاء القرائية</h3>
                <p className="text-sm text-slate-600 mt-1">{prescription.headlineAr}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowParentGuide(false)}
                aria-label="إغلاق الدليل"
                className="min-w-[44px] min-h-[44px] rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {prescription.detectedPatterns.map((pat) => (
                <div
                  key={pat.id}
                  className="rounded-2xl border-2 border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70"
                >
                  <div className="space-y-1 flex-1 min-w-[200px]">
                    <strong className="block text-sm font-black text-slate-900">{pat.labelAr}</strong>
                    <p className="text-xs text-slate-600 leading-relaxed">{pat.reasonAr}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyParentPattern(pat)}
                    className="min-h-[44px] px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <span>{pat.ctaAr}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {onNavigateTab && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold text-slate-500">
                  مسار فحص وعلاج عسر القراءة متاح بالكامل لولي الأمر والمختص:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowParentGuide(false);
                    onNavigateTab('dyslexia-lab');
                  }}
                  className="min-h-[44px] px-5 rounded-2xl bg-teal-50 hover:bg-teal-100 border-2 border-teal-200 text-teal-900 text-xs font-black flex items-center gap-2 cursor-pointer"
                >
                  <Brain className="w-4 h-4 text-teal-700" />
                  <span>فتح مسار فحص ودعم صعوبات القراءة</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface CelebrationCardProps {
  firstName: string;
  skillTitle: string;
  onNext?: () => void;
  onBackToMap: () => void;
}

const CelebrationCard: React.FC<CelebrationCardProps> = ({
  firstName,
  skillTitle,
  onNext,
  onBackToMap,
}) => (
  <div className="rounded-3xl border-[3px] border-emerald-400 bg-white p-8 shadow-md text-center space-y-5">
    <div className="flex justify-center">
      <Mascot mood="proud" size={108} />
    </div>
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-900 text-sm font-black">
      <Award className="w-4 h-4 text-emerald-700" />
      <span>{skillTitle}</span>
    </div>
    <h2 className="text-3xl font-black text-slate-900">أحسنت يا {firstName}!</h2>
    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          className="min-h-[54px] px-8 rounded-2xl border-b-4 border-emerald-800 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base flex items-center gap-2 cursor-pointer"
        >
          <span>انتقل للمهارة التالية</span>
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <button
        type="button"
        onClick={onBackToMap}
        className="min-h-[54px] px-6 rounded-2xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-base cursor-pointer"
      >
        العودة للخريطة
      </button>
    </div>
  </div>
);
