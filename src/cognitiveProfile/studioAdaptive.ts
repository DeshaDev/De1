/**
 * Unified Adaptive Studio Engine («تعلّم العربية والقصص التكيّفي»).
 *
 * Brings genuine Bayesian Knowledge Tracing (BKT), live error-rate scaffolding,
 * developmental placement, and story-to-practice feedback loops to the
 * 18 Arabic literacy stations, Arabic Foundations games, and Hand-Drawn Stories.
 */
import type { StudentRecord } from '../data/seedData';
import type { AdaptivePrescription } from './arabicErrorAdapter';
import type { MovableAlphabetWord, PhonemicBasketRound } from './arabicFoundations';
import type { HandDrawnStory } from './handDrawnStories';
import {
  MASTERY_THRESHOLD,
  observe,
  type SkillLevelState,
} from './knowledgeTracing';
import {
  LEARNING_PATH_STATIONS,
  getStationById,
  type LearningStation,
} from './learningPath';

export interface LetterAccuracyStat {
  hits: number;
  errors: number;
  traced?: boolean;
}

export interface StudioAdaptiveState {
  completedStations: string[];
  stationMastery: Record<string, SkillLevelState>;
  letterAccuracy: Record<string, LetterAccuracyStat>;
  storyPracticeWords: string[];
  completedStories: string[];
  updatedAt?: string;
}

const STORAGE_PREFIX = 'baseera.studioAdaptive.v1';
const DIACRITICS_RE = /[\u064B-\u065F\u0670\u0640]/g;
const stripDiacritics = (s: string) => s.replace(DIACRITICS_RE, '').trim();

export function createEmptyStudioAdaptiveState(): StudioAdaptiveState {
  return {
    completedStations: [],
    stationMastery: {},
    letterAccuracy: {},
    storyPracticeWords: [],
    completedStories: [],
  };
}

export function getStudioAdaptiveStorageKey(studentId?: string): string {
  return studentId ? `${STORAGE_PREFIX}.${studentId}` : STORAGE_PREFIX;
}

export function loadStudioAdaptiveState(studentId?: string): StudioAdaptiveState {
  if (typeof window === 'undefined') return createEmptyStudioAdaptiveState();
  try {
    const raw = window.localStorage.getItem(getStudioAdaptiveStorageKey(studentId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StudioAdaptiveState>;
      return {
        completedStations: Array.isArray(parsed.completedStations)
          ? parsed.completedStations.filter((x): x is string => typeof x === 'string')
          : [],
        stationMastery: parsed.stationMastery && typeof parsed.stationMastery === 'object' ? parsed.stationMastery : {},
        letterAccuracy: parsed.letterAccuracy && typeof parsed.letterAccuracy === 'object' ? parsed.letterAccuracy : {},
        storyPracticeWords: Array.isArray(parsed.storyPracticeWords)
          ? parsed.storyPracticeWords.filter((x): x is string => typeof x === 'string')
          : [],
        completedStories: Array.isArray(parsed.completedStories)
          ? parsed.completedStories.filter((x): x is string => typeof x === 'string')
          : [],
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
      };
    }
    // Migrate legacy completedStations list if present
    const legacyKey = studentId ? `baseera.learningPath.completed.${studentId}` : 'baseera.learningPath.completed';
    const legacyRaw = window.localStorage.getItem(legacyKey);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed)) {
        return {
          ...createEmptyStudioAdaptiveState(),
          completedStations: parsed.filter((x): x is string => typeof x === 'string'),
        };
      }
    }
  } catch {
    /* ignore storage errors */
  }
  return createEmptyStudioAdaptiveState();
}

export function saveStudioAdaptiveState(studentId: string | undefined, state: StudioAdaptiveState): void {
  if (typeof window === 'undefined') return;
  try {
    const next: StudioAdaptiveState = {
      ...state,
      completedStations: [...new Set(state.completedStations)],
      storyPracticeWords: [...new Set(state.storyPracticeWords)].slice(-40),
      completedStories: [...new Set(state.completedStories)],
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(getStudioAdaptiveStorageKey(studentId), JSON.stringify(next));
    const legacyKey = studentId ? `baseera.learningPath.completed.${studentId}` : 'baseera.learningPath.completed';
    window.localStorage.setItem(legacyKey, JSON.stringify(next.completedStations));
  } catch {
    /* ignore storage errors */
  }
}

export function recordLetterAttempt(
  state: StudioAdaptiveState,
  letter: string,
  correct: boolean,
  traced = false,
): StudioAdaptiveState {
  const key = stripDiacritics(letter).slice(0, 1);
  if (!key) return state;
  const prev = state.letterAccuracy[key] ?? { hits: 0, errors: 0 };
  return {
    ...state,
    letterAccuracy: {
      ...state.letterAccuracy,
      [key]: {
        hits: prev.hits + (correct ? 1 : 0),
        errors: prev.errors + (correct ? 0 : 1),
        traced: prev.traced || traced,
      },
    },
  };
}

export function recordStationAnswer(
  state: StudioAdaptiveState,
  stationId: string,
  correct: boolean,
  optionCount = 3,
): StudioAdaptiveState {
  const prev = state.stationMastery[stationId] ?? { p: 0.35, n: 0, c: 0, seq: '' };
  const guess = Math.min(0.5, Math.max(0.15, 1 / Math.max(2, optionCount)));
  const updated = observe(prev, correct, guess, true);
  return {
    ...state,
    stationMastery: {
      ...state.stationMastery,
      [stationId]: updated,
    },
  };
}

export function recordStoryActivity(
  state: StudioAdaptiveState,
  storyId: string,
  practiceWords: string[] = [],
): StudioAdaptiveState {
  const cleanWords = practiceWords.map((w) => w.trim()).filter(Boolean);
  return {
    ...state,
    completedStories: [...new Set([...state.completedStories, storyId])],
    storyPracticeWords: [...new Set([...state.storyPracticeWords, ...cleanWords])].slice(-40),
  };
}

export function getStationMasteryPercent(state: StudioAdaptiveState, stationId: string): number | null {
  const entry = state.stationMastery[stationId];
  if (!entry || entry.n === 0) return null;
  return Math.round(entry.p * 100);
}

/** Rank Arabic letters that need priority practice for this learner. */
export function getPrioritizedWeakLetters(
  student?: StudentRecord | null,
  state?: StudioAdaptiveState,
  fallbackLetter = 'س',
): string[] {
  const scoreByLetter = new Map<string, number>();
  const bump = (ch: string, weight: number) => {
    const clean = stripDiacritics(ch);
    if (!clean || !/[\u0621-\u064A]/.test(clean)) return;
    scoreByLetter.set(clean, (scoreByLetter.get(clean) ?? 0) + weight);
  };

  if (fallbackLetter) bump(fallbackLetter, 3);

  // 1. Live studio letter error telemetry
  if (state) {
    for (const [ch, stat] of Object.entries(state.letterAccuracy)) {
      if (stat.errors > 0) {
        const errRate = stat.errors / Math.max(1, stat.hits + stat.errors);
        bump(ch, 5 + stat.errors * 2 + errRate * 4);
      } else if (stat.hits >= 5 && stat.traced) {
        bump(ch, -3);
      }
    }
    for (const w of state.storyPracticeWords) {
      for (const ch of stripDiacritics(w)) bump(ch, 1.5);
    }
  }

  // 2. Screening / oral reading problematic words & alignment substitutions
  for (const w of student?.problematicWords ?? []) {
    for (const ch of stripDiacritics(w)) bump(ch, 2);
  }
  for (const w of student?.verifiedWordsAlignment ?? []) {
    if (w.status === 'phonetic_substitution' || w.status === 'omitted') {
      for (const ch of stripDiacritics(w.word)) bump(ch, 2.5);
    }
  }

  const defaultCycle = ['س', 'ص', 'ت', 'ط', 'د', 'ض', 'ق', 'ك', 'ب', 'ذ'];
  for (const ch of defaultCycle) {
    if (!scoreByLetter.has(ch)) scoreByLetter.set(ch, 0);
  }

  return [...scoreByLetter.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([ch]) => ch);
}

/** Order Movable Alphabet words so weak letters and struggled reading words appear first. */
export function pickAdaptiveMovableWords(
  words: MovableAlphabetWord[],
  student?: StudentRecord | null,
  state?: StudioAdaptiveState,
): MovableAlphabetWord[] {
  const weakLetters = new Set(getPrioritizedWeakLetters(student, state).slice(0, 6));
  const struggledClean = new Set(
    [...(state?.storyPracticeWords ?? []), ...(student?.problematicWords ?? [])].map(stripDiacritics),
  );

  return [...words].sort((a, b) => {
    const scoreWord = (item: MovableAlphabetWord) => {
      const cleanWord = stripDiacritics(item.word);
      let s = 0;
      if (struggledClean.has(cleanWord)) s += 10;
      for (const l of item.letters) {
        if (weakLetters.has(l)) s += 2;
      }
      return s;
    };
    return scoreWord(b) - scoreWord(a);
  });
}

/** Pick the Phonemic Basket round matching the learner's highest-priority weak sound. */
export function pickAdaptiveBasketIndex(
  rounds: PhonemicBasketRound[],
  student?: StudentRecord | null,
  state?: StudioAdaptiveState,
  completedIds: string[] = [],
): number {
  const weakOrder = getPrioritizedWeakLetters(student, state);
  for (const ch of weakOrder) {
    const idx = rounds.findIndex((r) => r.targetLetter === ch && !completedIds.includes(r.id));
    if (idx !== -1) return idx;
  }
  const firstUnfinished = rounds.findIndex((r) => !completedIds.includes(r.id));
  return firstUnfinished !== -1 ? firstUnfinished : 0;
}

export interface AdaptiveBalloonDifficulty {
  speedScale: number;
  targetProb: number;
  spawnIntervalMs: number;
  levelLabelAr: string;
}

/** Live balloon game difficulty adjusting calmly to streak vs errors. */
export function computeAdaptiveBalloonParams(
  streak: number,
  recentErrors: number,
): AdaptiveBalloonDifficulty {
  if (recentErrors >= 2) {
    return {
      speedScale: 0.75,
      targetProb: 0.68,
      spawnIntervalMs: 1550,
      levelLabelAr: 'تدرّج مريح للتثبيت',
    };
  }
  if (streak >= 3) {
    return {
      speedScale: 1.18,
      targetProb: 0.42,
      spawnIntervalMs: 1180,
      levelLabelAr: 'تحدّي متقدّم',
    };
  }
  return {
    speedScale: 1.0,
    targetProb: 0.5,
    spawnIntervalMs: 1350,
    levelLabelAr: 'توازن ذكي',
  };
}

export interface AdaptiveStationRecommendation {
  station: LearningStation;
  reasonAr: string;
}

/**
 * Selects the truly optimal next station for this learner from age, grade,
 * screening weaknesses, reading error patterns, and live studio mastery.
 */
export function pickAdaptiveRecommendedStation(
  student: StudentRecord | null | undefined,
  prescription: AdaptivePrescription,
  completedStations: string[],
  state?: StudioAdaptiveState,
): AdaptiveStationRecommendation {
  const ageYears = student?.ageYears ?? 7;
  const gradeLevel = student?.gradeLevel ?? 1;
  const risk = student?.readingRiskLevel;
  const hasExplicitEvidence =
    (student?.problematicWords?.length ?? 0) > 0 ||
    (student?.verifiedWordsAlignment?.some(
      (w) => w.status === 'phonetic_substitution' || w.status === 'omitted',
    ) ??
      false) ||
    (student?.cognitiveBattery?.summary?.weaknesses?.length ?? 0) > 0 ||
    risk === 'high' ||
    risk === 'moderate';

  const isWeakFoundational =
    ageYears <= 6 ||
    gradeLevel <= 1 ||
    risk === 'high' ||
    risk === 'moderate' ||
    (hasExplicitEvidence &&
      prescription.detectedPatterns.some(
        (p) => p.id === 'early_foundations' || p.id === 'confusable_letters' || p.id === 'phonemic_decoding',
      ));

  // 1. Check live low-mastery station from BKT telemetry first (remediation priority)
  if (state) {
    const lowMasteryStation = LEARNING_PATH_STATIONS.find((s) => {
      const m = state.stationMastery[s.id];
      return m && m.n >= 2 && m.p < MASTERY_THRESHOLD && !completedStations.includes(s.id);
    });
    if (lowMasteryStation) {
      return {
        station: lowMasteryStation,
        reasonAr: 'تحتاج هذه المهارة إلى تمرين إضافي بسيط قبل الانتقال للمرحلة التالية.',
      };
    }
  }

  // 2. Check explicit diagnostic prescription (only when backed by real learner evidence or early age)
  const topPattern = prescription.detectedPatterns[0];
  if (topPattern && (hasExplicitEvidence || ageYears <= 6 || gradeLevel <= 1)) {
    let targetId: string | null = null;
    if (topPattern.targetTab === 'foundations') {
      targetId = `foundation-${topPattern.targetSubMode || 'trace'}`;
    } else if (topPattern.targetTab === 'spelling') {
      targetId = `spelling-${topPattern.targetSubMode || prescription.recommendedSpellingLessonId}`;
    } else if (topPattern.targetTab === 'fluency') {
      const targetGrade = Math.max(1, Math.min(3, gradeLevel || 1));
      targetId = `fluency-fluency-g${targetGrade}`;
    }
    const prescribedStation = getStationById(targetId);
    if (prescribedStation && !completedStations.includes(prescribedStation.id)) {
      return {
        station: prescribedStation,
        reasonAr: topPattern.reasonAr,
      };
    }
  }

  // 3. Developmentally adaptive start point:
  // Fluent older learners (Grade 2+ with no foundational weakness) start at Spelling/Language
  // instead of forcing Grade 3 students to start with Letter Tracing.
  if (!isWeakFoundational && gradeLevel >= 2) {
    const gradeCandidate =
      gradeLevel >= 3
        ? LEARNING_PATH_STATIONS.find(
            (s) => (s.track === 'fluency' || s.track === 'spelling') && !completedStations.includes(s.id),
          )
        : LEARNING_PATH_STATIONS.find((s) => s.track === 'spelling' && !completedStations.includes(s.id));
    if (gradeCandidate) {
      return {
        station: gradeCandidate,
        reasonAr: `نقطة بداية مكيّفة لصفك الدراسي (الصف ${gradeLevel}) مع إمكانية فتح الأساسيات في أي وقت.`,
      };
    }
  }

  // 4. Sequential progression through uncompleted stations
  const firstUnfinished = LEARNING_PATH_STATIONS.find((s) => !completedStations.includes(s.id));
  if (firstUnfinished) {
    return {
      station: firstUnfinished,
      reasonAr: completedStations.length === 0
        ? 'ابدأ من هنا لتأسيس الحروف والأصوات خطوةً بخطوة.'
        : 'المحطة التالية المناسبة لتقدّمك الحالي.',
    };
  }

  return {
    station: LEARNING_PATH_STATIONS[LEARNING_PATH_STATIONS.length - 1],
    reasonAr: 'أتممت جميع المحطات بنجاح! يمكنك استكشاف المكتبة المصوّرة بحرية.',
  };
}

export function pickAdaptiveReadingLevel(
  student?: StudentRecord | null,
  state?: StudioAdaptiveState,
): 1 | 2 | 3 {
  const age = student?.ageYears ?? 7;
  const grade = student?.gradeLevel ?? 1;
  const risk = student?.readingRiskLevel;
  const doneCount = state?.completedStories.length ?? 0;

  if (age <= 6 || grade <= 1 || risk === 'high') {
    return doneCount >= 3 ? 2 : 1;
  }
  if (grade >= 3 && risk !== 'moderate') return 3;
  return doneCount >= 4 ? 3 : 2;
}

export function recommendedStorySupportMode(
  student?: StudentRecord | null,
  state?: StudioAdaptiveState,
): 'guided' | 'independent' {
  const grade = student?.gradeLevel ?? 1;
  const risk = student?.readingRiskLevel;
  const acc = student?.oralAccuracyPercent;
  const doneCount = state?.completedStories.length ?? 0;
  if (
    grade >= 3 &&
    risk === 'nominal' &&
    (typeof acc !== 'number' || acc >= 85)
  ) {
    return 'independent';
  }
  if (doneCount >= 4 && risk !== 'high') return 'independent';
  return 'guided';
}

export function orderAdaptiveStories(
  stories: HandDrawnStory[],
  student?: StudentRecord | null,
  prescription?: AdaptivePrescription,
  state?: StudioAdaptiveState,
): HandDrawnStory[] {
  const targetLevel = pickAdaptiveReadingLevel(student, state);
  const completed = new Set(state?.completedStories ?? []);
  const recId = prescription?.recommendedStoryId;

  return [...stories].sort((a, b) => {
    const score = (s: HandDrawnStory) => {
      let sc = 0;
      if (!completed.has(s.id)) sc += 20;
      if (s.id === recId) sc += 15;
      const dist = Math.abs(s.level - targetLevel);
      sc += (3 - dist) * 5;
      if (s.id === 'paper-bird') sc += 2;
      return sc;
    };
    return score(b) - score(a);
  });
}
