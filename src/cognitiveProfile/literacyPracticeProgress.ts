/**
 * Encrypted local progress ledger for the supplementary literacy practice stations.
 *
 * This records activity and completion only. It is deliberately not a proficiency score,
 * standardized measure, or input to screening decisions.
 */
export type LiteracyStationId = 'decoding' | 'spelling' | 'morphology' | 'comprehension' | 'fluency';

export interface LiteracyStationStats {
  attemptedQuestions: number;
  correctAnswers: number;
  completedSessions: number;
  lastPracticedAt: string | null;
}

export interface LiteracyPracticeProgress {
  schemaVersion: 1;
  stations: Record<LiteracyStationId, LiteracyStationStats>;
  fluencyReadingsCompleted: number;
}

const STATION_IDS: LiteracyStationId[] = ['decoding', 'spelling', 'morphology', 'comprehension', 'fluency'];

export function emptyLiteracyPracticeProgress(): LiteracyPracticeProgress {
  const stations = Object.fromEntries(
    STATION_IDS.map((id) => [id, {
      attemptedQuestions: 0,
      correctAnswers: 0,
      completedSessions: 0,
      lastPracticedAt: null,
    }])
  ) as Record<LiteracyStationId, LiteracyStationStats>;
  return { schemaVersion: 1, stations, fluencyReadingsCompleted: 0 };
}

/** Ignore optional vowel marks while preserving actual Arabic spelling contrasts. */
export function normalizeArabicSpelling(value: string): string {
  return value.normalize('NFC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/\s+/g, '');
}

export function arabicSpellingMatches(response: string, expected: string): boolean {
  const normalizedResponse = normalizeArabicSpelling(response);
  return normalizedResponse.length > 0 && normalizedResponse === normalizeArabicSpelling(expected);
}

const safeCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(1_000_000, Math.floor(value))
    : 0;

export function sanitizeLiteracyPracticeProgress(value: unknown): LiteracyPracticeProgress {
  const empty = emptyLiteracyPracticeProgress();
  if (!value || typeof value !== 'object') return empty;
  const raw = value as Partial<LiteracyPracticeProgress>;
  for (const id of STATION_IDS) {
    const entry = raw.stations?.[id] as Partial<LiteracyStationStats> | undefined;
    if (!entry || typeof entry !== 'object') continue;
    empty.stations[id] = {
      attemptedQuestions: safeCount(entry.attemptedQuestions),
      correctAnswers: Math.min(safeCount(entry.correctAnswers), safeCount(entry.attemptedQuestions)),
      completedSessions: safeCount(entry.completedSessions),
      lastPracticedAt: typeof entry.lastPracticedAt === 'string' && !Number.isNaN(Date.parse(entry.lastPracticedAt))
        ? entry.lastPracticedAt
        : null,
    };
  }
  empty.fluencyReadingsCompleted = safeCount(raw.fluencyReadingsCompleted);
  return empty;
}

export function recordLiteracyAnswer(
  current: LiteracyPracticeProgress,
  station: Exclude<LiteracyStationId, 'fluency'>,
  correct: boolean,
  now = new Date()
): LiteracyPracticeProgress {
  const safe = sanitizeLiteracyPracticeProgress(current);
  const stats = safe.stations[station];
  return {
    ...safe,
    stations: {
      ...safe.stations,
      [station]: {
        ...stats,
        attemptedQuestions: stats.attemptedQuestions + 1,
        correctAnswers: stats.correctAnswers + (correct ? 1 : 0),
        lastPracticedAt: now.toISOString(),
      },
    },
  };
}

export function recordLiteracyStationCompleted(
  current: LiteracyPracticeProgress,
  station: Exclude<LiteracyStationId, 'fluency'>,
  now = new Date()
): LiteracyPracticeProgress {
  const safe = sanitizeLiteracyPracticeProgress(current);
  const stats = safe.stations[station];
  return {
    ...safe,
    stations: {
      ...safe.stations,
      [station]: {
        ...stats,
        completedSessions: stats.completedSessions + 1,
        lastPracticedAt: now.toISOString(),
      },
    },
  };
}

export function recordFluencySessionCompleted(
  current: LiteracyPracticeProgress,
  now = new Date()
): LiteracyPracticeProgress {
  const safe = sanitizeLiteracyPracticeProgress(current);
  const stats = safe.stations.fluency;
  return {
    ...safe,
    stations: {
      ...safe.stations,
      fluency: {
        ...stats,
        completedSessions: stats.completedSessions + 1,
        lastPracticedAt: now.toISOString(),
      },
    },
    fluencyReadingsCompleted: safe.fluencyReadingsCompleted + 3,
  };
}
