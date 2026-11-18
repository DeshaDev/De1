/**
 * Browser persistence for battery sessions and training progress.
 * Sensitive child data is encrypted at rest using AES-256-GCM and a non-extractable IndexedDB key.
 */
import { SUBTESTS_BY_ID, type SubtestId } from './battery';
import type { SubtestResult } from './scoring';
import { SKILLS, type TrainingProgress } from './training';
import { emptyLiteracyPracticeProgress, sanitizeLiteracyPracticeProgress, type LiteracyPracticeProgress } from './literacyPracticeProgress';
import { secureStorage } from '../utils/secureLocalStorage';

export type HomeDialect = 'msa' | 'gulf' | 'saudi' | 'levantine' | 'egyptian' | 'iraqi' | 'maghrebi' | 'sudanese' | 'other';
export type PronunciationLocale = 'ar-EG' | 'ar-SA';

const HOME_DIALECTS: readonly HomeDialect[] = [
  'msa', 'gulf', 'saudi', 'levantine', 'egyptian', 'iraqi', 'maghrebi', 'sudanese', 'other',
];

/** Normalise stored child dialects without interpreting a country name as a dialect. */
export function normalizeHomeDialect(value: unknown, country?: string): HomeDialect {
  if (typeof value !== 'string' || !value.trim() || (country && value === country)) return 'other';
  return HOME_DIALECTS.includes(value as HomeDialect) ? value as HomeDialect : 'other';
}

/** Standard Arabic (الفصحى المعيارية - ar-SA) is the unified evaluation benchmark for all children. */
export function pronunciationLocaleForDialect(_dialect?: HomeDialect): PronunciationLocale {
  return 'ar-SA';
}

export const DIALECT_LABELS_AR: Record<HomeDialect, string> = {
  msa: 'فصحى معيارية',
  gulf: 'فصحى معيارية',
  saudi: 'فصحى معيارية',
  levantine: 'فصحى معيارية',
  egyptian: 'فصحى معيارية',
  iraqi: 'فصحى معيارية',
  maghrebi: 'فصحى معيارية',
  sudanese: 'فصحى معيارية',
  other: 'فصحى معيارية',
};

/**
 * Standard Arabic is the sole evaluation benchmark for all children.
 */
export const DIALECT_SENSITIVE_ITEMS: Record<string, { pairAr: string; dialects: HomeDialect[] }> = {};

export interface BatterySession {
  studentId: string;
  childName: string;
  ageMonths: number;
  examinerName: string;
  startedAt: string;
  /** All assessments evaluate against standard Modern Standard Arabic (الفصحى المعيارية). */
  dialect?: HomeDialect;
  guardianConsentGiven?: boolean;
  guardianAudioConsentGiven?: boolean;
  guardianConsentRecordedAt?: string;
  guardianAudioConsentRecordedAt?: string;
  speechLocale?: 'ar-SA' | 'ar-EG';
  results: Partial<Record<SubtestId, SubtestResult>>;
}

const SESSION_KEY = (studentId: string) => `baseera.cognitiveProfile.v1.session.${studentId}`;
const TRAINING_KEY = (studentId: string) => `baseera.cognitiveProfile.v1.training.${studentId}`;
const LITERACY_PRACTICE_KEY = (studentId: string) => `baseera.cognitiveProfile.v1.literacy-practice.${studentId}`;

async function read<T>(key: string): Promise<T | null> {
  return secureStorage.getItem<T>(key);
}

function write(key: string, value: unknown): Promise<void> {
  return secureStorage.setItem(key, value);
}

function remove(key: string): void {
  secureStorage.removeItem(key);
}

/**
 * Results of tasks that are no longer in the battery (for example the visual memory games,
 * removed because they do not predict reading difficulty) are dropped when an older session is read.
 */
export function sanitizeBatterySession(session: BatterySession): BatterySession {
  const results = Object.fromEntries(
    Object.entries(session.results ?? {}).filter(([id]) => id in SUBTESTS_BY_ID)
  ) as BatterySession['results'];
  // «أصدقاء الفضاء» grew from three rounds to six; a three-round result would be scored out of
  // the longer total, so the game is offered again instead.
  const pal = results.pairedAssociate;
  if (pal && !pal.responses?.some((r) => /^pal-[4-9]/.test(r.itemId))) delete results.pairedAssociate;
  return { ...session, results };
}

export const loadBatterySession = async (studentId: string) => {
  const stored = await read<BatterySession>(SESSION_KEY(studentId));
  return stored ? sanitizeBatterySession(stored) : null;
};
export const saveBatterySession = (session: BatterySession) => write(SESSION_KEY(session.studentId), session);
export const clearBatterySession = (studentId: string) => remove(SESSION_KEY(studentId));

/** Skills that are no longer trained (for example visual memory) are dropped from older progress. */
export function sanitizeTrainingProgress(progress: TrainingProgress): TrainingProgress {
  const known = <T extends string>(list: T[] | undefined) => (list ?? []).filter((id) => id in SKILLS);
  return {
    ...progress,
    plan: { ...progress.plan, focus: known(progress.plan.focus) },
    mastered: known(progress.mastered),
    supportFlags: known(progress.supportFlags),
  };
}

export const loadTrainingProgress = async (studentId: string) => {
  const stored = await read<TrainingProgress>(TRAINING_KEY(studentId));
  return stored ? sanitizeTrainingProgress(stored) : null;
};
export const saveTrainingProgress = (studentId: string, progress: TrainingProgress) =>
  write(TRAINING_KEY(studentId), progress);
export const clearTrainingProgress = (studentId: string) => remove(TRAINING_KEY(studentId));

/** Supplementary reading/language practice history, encrypted separately from assessment scores. */
const literacyPracticeWrites = new Map<string, Promise<void>>();
const clearedLiteracyPracticeIds = new Set<string>();

export async function loadLiteracyPracticeProgress(studentId: string): Promise<LiteracyPracticeProgress> {
  const pending = literacyPracticeWrites.get(studentId);
  if (pending) await pending.catch(() => undefined);
  const stored = await read<unknown>(LITERACY_PRACTICE_KEY(studentId));
  return stored ? sanitizeLiteracyPracticeProgress(stored) : emptyLiteracyPracticeProgress();
}

export function saveLiteracyPracticeProgress(studentId: string, progress: LiteracyPracticeProgress): Promise<void> {
  if (clearedLiteracyPracticeIds.has(studentId)) return Promise.resolve();
  const previous = literacyPracticeWrites.get(studentId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() =>
    write(LITERACY_PRACTICE_KEY(studentId), sanitizeLiteracyPracticeProgress(progress))
  );
  literacyPracticeWrites.set(studentId, next);
  void next.finally(() => {
    if (literacyPracticeWrites.get(studentId) === next) literacyPracticeWrites.delete(studentId);
  }).catch(() => undefined);
  return next;
}

export async function clearLiteracyPracticeProgress(studentId: string): Promise<void> {
  clearedLiteracyPracticeIds.add(studentId);
  const pending = literacyPracticeWrites.get(studentId);
  if (pending) await pending.catch(() => undefined);
  remove(LITERACY_PRACTICE_KEY(studentId));
}

/** Summary of a finished screening, kept when the child is screened again so the two can be compared. */
export interface ScreeningSnapshot {
  completedAt: string;
  ageMonths: number;
  risk: 'high' | 'moderate' | 'low' | 'insufficient';
  completedSubtests: number;
  domains: Array<{ domain: string; centile: number }>;
}
const HISTORY_KEY = (studentId: string) => `baseera.cognitiveProfile.v1.history.${studentId}`;
export function sanitizeScreeningHistory(history: ScreeningSnapshot[]): ScreeningSnapshot[] {
  return history.map((snapshot) => ({ ...snapshot, risk: 'insufficient', domains: [] }));
}
export async function loadScreeningHistory(studentId: string): Promise<ScreeningSnapshot[]> {
  const stored = (await read<ScreeningSnapshot[]>(HISTORY_KEY(studentId))) ?? [];
  const safe = sanitizeScreeningHistory(stored);
  if (JSON.stringify(stored) !== JSON.stringify(safe)) await write(HISTORY_KEY(studentId), safe);
  return safe;
}
export const saveScreeningHistory = (studentId: string, history: ScreeningSnapshot[]) =>
  write(HISTORY_KEY(studentId), sanitizeScreeningHistory(history).slice(-10));

export const clearScreeningHistory = (studentId: string) => remove(HISTORY_KEY(studentId));

/** Remove everything this device keeps for one child (screening, training, practice, history). */
export async function clearAllChildData(studentId: string): Promise<void> {
  clearBatterySession(studentId);
  clearTrainingProgress(studentId);
  clearScreeningHistory(studentId);
  await clearLiteracyPracticeProgress(studentId);
}
