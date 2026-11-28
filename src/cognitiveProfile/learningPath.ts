/**
 * Stepping-Stone Single-Skill Arabic Learning Path (`هَيَّا نَقْرَأْ`).
 *
 * Transforms the Arabic curriculum into 18 bite-sized, sequential stations so a
 * child sees ONE skill card at a time ("تعلّم ← العب وتدرّب ← أحسنت ← انتقل للمهارة التالية")
 * without cognitive overload.
 */
import type { AdaptivePrescription } from './arabicErrorAdapter';
import { ARABIC_LANGUAGE_UNITS, type ArabicLanguageUnit } from './arabicFoundations';
import {
  FLUENCY_PASSAGES,
  SPELLING_LESSONS,
  getRecommendedFluencyPassage,
} from './literacyStudio';

export type LearningTrackId = 'letters' | 'spelling' | 'language' | 'fluency' | 'stories';

export interface LearningStation {
  id: string;
  order: number;
  track: LearningTrackId;
  shortTitleAr: string;
  kind: 'foundation' | 'spelling' | 'language' | 'fluency' | 'stories';
  refId: string;
  accent: 'emerald' | 'sky' | 'amber' | 'violet' | 'teal';
}

const SHORT_SPELLING_TITLES: Record<string, string> = {
  ta_marbuta_open: 'التاء المربوطة والمفتوحة',
  long_vowels: 'حروف المدّ الثلاثة',
  sukun_syllable: 'المقطع الساكن',
  tanween_noon: 'التنوين والنون',
  solar_lunar: 'اللام الشمسية والقمرية',
  common_hamza: 'الهمزة في أول الكلمة',
};

const SHORT_LANGUAGE_TITLES: Record<ArabicLanguageUnit['id'], string> = {
  fem_verb: 'ذَهَبَ أم ذَهَبَتْ؟',
  word_types: 'اسم وفعل وحرف',
  noun_kinds: 'دلالات الاسم',
  ta_ha: 'التاء والهاء',
};

const RAW_STATIONS: Array<Omit<LearningStation, 'order'>> = [
  // Track 1: Letters & Phonological Foundations (4 stations)
  {
    id: 'foundation-trace',
    track: 'letters',
    shortTitleAr: 'الحروف والحركات',
    kind: 'foundation',
    refId: 'trace',
    accent: 'emerald',
  },
  {
    id: 'foundation-basket',
    track: 'letters',
    shortTitleAr: 'سلة الأصوات',
    kind: 'foundation',
    refId: 'basket',
    accent: 'emerald',
  },
  {
    id: 'foundation-balloon',
    track: 'letters',
    shortTitleAr: 'صيد الحروف',
    kind: 'foundation',
    refId: 'balloon',
    accent: 'sky',
  },
  {
    id: 'foundation-movable',
    track: 'letters',
    shortTitleAr: 'تركيب الكلمات',
    kind: 'foundation',
    refId: 'movable',
    accent: 'sky',
  },

  // Track 2: Spelling & Orthography (6 stations)
  ...SPELLING_LESSONS.map((lesson) => ({
    id: `spelling-${lesson.id}`,
    track: 'spelling' as const,
    shortTitleAr: SHORT_SPELLING_TITLES[lesson.id] || lesson.titleAr,
    kind: 'spelling' as const,
    refId: lesson.id,
    accent: 'amber' as const,
  })),

  // Track 3: Arabic Language & Grammar (4 stations)
  ...ARABIC_LANGUAGE_UNITS.map((unit) => ({
    id: `language-${unit.id}`,
    track: 'language' as const,
    shortTitleAr: SHORT_LANGUAGE_TITLES[unit.id] || unit.titleAr,
    kind: 'language' as const,
    refId: unit.id,
    accent: 'violet' as const,
  })),

  // Track 4: Calm Expressive Fluency (3 stations)
  ...FLUENCY_PASSAGES.map((passage) => ({
    id: `fluency-${passage.id}`,
    track: 'fluency' as const,
    shortTitleAr: passage.titleAr,
    kind: 'fluency' as const,
    refId: passage.id,
    accent: 'teal' as const,
  })),

  // Track 5: Hand-Drawn Illustrated Stories (1 station)
  {
    id: 'stories-library',
    track: 'stories',
    shortTitleAr: 'المكتبة المصوّرة',
    kind: 'stories',
    refId: 'library',
    accent: 'teal',
  },
];

export const LEARNING_PATH_STATIONS: LearningStation[] = RAW_STATIONS.map((station, idx) => ({
  ...station,
  order: idx + 1,
}));

export function getStationById(id: string | null | undefined): LearningStation | undefined {
  if (!id) return undefined;
  return LEARNING_PATH_STATIONS.find((s) => s.id === id);
}

export function getRecommendedStationId(
  prescription: AdaptivePrescription,
  gradeLevel: number,
): string {
  const topPattern = prescription.detectedPatterns[0];
  let candidate = 'foundation-trace';

  if (topPattern?.targetTab === 'foundations') {
    candidate = `foundation-${topPattern.targetSubMode || 'trace'}`;
  } else if (topPattern?.targetTab === 'spelling') {
    candidate = `spelling-${
      topPattern.targetSubMode || prescription.recommendedSpellingLessonId || SPELLING_LESSONS[0].id
    }`;
  } else if (topPattern?.targetTab === 'fluency') {
    candidate = `fluency-${getRecommendedFluencyPassage(gradeLevel).id}`;
  }

  return LEARNING_PATH_STATIONS.some((s) => s.id === candidate) ? candidate : 'foundation-trace';
}

export function getNextStationId(currentId: string): string | null {
  const idx = LEARNING_PATH_STATIONS.findIndex((s) => s.id === currentId);
  if (idx < 0 || idx + 1 >= LEARNING_PATH_STATIONS.length) return null;
  return LEARNING_PATH_STATIONS[idx + 1].id;
}
