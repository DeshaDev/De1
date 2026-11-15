/**
 * Browser persistence for battery sessions and training progress.
 * Sensitive child data is encrypted at rest using AES-256-GCM and a non-extractable IndexedDB key.
 */
import type { SubtestId } from './battery';
import type { SubtestResult } from './scoring';
import type { TrainingProgress } from './training';
import {
  emptyLiteracyPracticeProgress,
  sanitizeLiteracyPracticeProgress,
  type LiteracyPracticeProgress,
} from './literacyPracticeProgress';
import { secureStorage } from '../utils/secureLocalStorage';

export type HomeDialect = 'msa' | 'gulf' | 'levantine' | 'egyptian' | 'iraqi' | 'maghrebi' | 'sudanese' | 'other';

export const DIALECT_LABELS_AR: Record<HomeDialect, string> = {
  msa: 'فصحى معيارية',
  gulf: 'فصحى معيارية',
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
  speechLocale?: 'ar-SA';
  results: Partial<Record<SubtestId, SubtestResult>>;
}

const SESSION_KEY = (studentId: string) => `baseera.cognitiveProfile.v1.session.${studentId}`;
const TRAINING_KEY = (studentId: string) => `baseera.cognitiveProfile.v1.training.${studentId}`;
const LITERACY_PRACTICE_KEY = (studentId: string) => `baseera.cognitiveProfile.v1.literacyPractice.${studentId}`;

async function read<T>(key: string): Promise<T | null> {
  return secureStorage.getItem<T>(key);
}

function write(key: string, value: unknown): Promise<void> {
  return secureStorage.setItem(key, value);
}

function remove(key: string): void {
  secureStorage.removeItem(key);
}

export const loadBatterySession = (studentId: string) => read<BatterySession>(SESSION_KEY(studentId));
export const saveBatterySession = (session: BatterySession) => write(SESSION_KEY(session.studentId), session);
export const clearBatterySession = (studentId: string) => remove(SESSION_KEY(studentId));

export const loadTrainingProgress = (studentId: string) => read<TrainingProgress>(TRAINING_KEY(studentId));
export const saveTrainingProgress = (studentId: string, progress: TrainingProgress) =>
  write(TRAINING_KEY(studentId), progress);
export const clearTrainingProgress = (studentId: string) => remove(TRAINING_KEY(studentId));

/** Supplementary literacy practice history, encrypted at rest and deliberately non-diagnostic. */
export async function loadLiteracyPracticeProgress(studentId: string): Promise<LiteracyPracticeProgress> {
  const stored = await read<unknown>(LITERACY_PRACTICE_KEY(studentId));
  return stored ? sanitizeLiteracyPracticeProgress(stored) : emptyLiteracyPracticeProgress();
}

export const saveLiteracyPracticeProgress = (studentId: string, progress: LiteracyPracticeProgress) =>
  write(LITERACY_PRACTICE_KEY(studentId), sanitizeLiteracyPracticeProgress(progress));

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
