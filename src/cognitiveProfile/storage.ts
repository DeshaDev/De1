/**
 * Browser persistence for battery sessions and training progress.
 * Data stays on this device; nothing here is sent to the server.
 */
import type { SubtestId } from './battery';
import type { SubtestResult } from './scoring';
import type { TrainingProgress } from './training';

export type HomeDialect = 'gulf' | 'levantine' | 'egyptian' | 'iraqi' | 'maghrebi' | 'sudanese' | 'other';

export const DIALECT_LABELS_AR: Record<HomeDialect, string> = {
  gulf: 'خليجية',
  levantine: 'شامية',
  egyptian: 'مصرية',
  iraqi: 'عراقية',
  maghrebi: 'مغاربية',
  sudanese: 'سودانية',
  other: 'أخرى',
};

/**
 * Listening items whose contrast these dialects merge in everyday speech (ث/س, ذ/ز, ق/ك …).
 * An error on them is reported as possibly dialect-related, not as a discrimination weakness.
 */
export const DIALECT_SENSITIVE_ITEMS: Record<string, { pairAr: string; dialects: HomeDialect[] }> = {
  'ad-4': { pairAr: 'ذ/ز', dialects: ['levantine', 'egyptian', 'sudanese'] },
  'ad-8': { pairAr: 'ث/س', dialects: ['levantine', 'egyptian', 'sudanese'] },
  'ad-5': { pairAr: 'ك/ق', dialects: ['levantine', 'egyptian'] },
  'ad-10': { pairAr: 'د/ض', dialects: ['maghrebi'] },
};

export interface BatterySession {
  studentId: string;
  childName: string;
  ageMonths: number;
  examinerName: string;
  startedAt: string;
  /** Home dialect, used to interpret dialect-sensitive sound contrasts (optional). */
  dialect?: HomeDialect;
  results: Partial<Record<SubtestId, SubtestResult>>;
}

const SESSION_KEY = (studentId: string) => `baseera.cognitiveProfile.v1.session.${studentId}`;
const TRAINING_KEY = (studentId: string) => `baseera.cognitiveProfile.v1.training.${studentId}`;

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the session still works in memory.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const loadBatterySession = (studentId: string) => read<BatterySession>(SESSION_KEY(studentId));
export const saveBatterySession = (session: BatterySession) => write(SESSION_KEY(session.studentId), session);
export const clearBatterySession = (studentId: string) => remove(SESSION_KEY(studentId));

export const loadTrainingProgress = (studentId: string) => read<TrainingProgress>(TRAINING_KEY(studentId));
export const saveTrainingProgress = (studentId: string, progress: TrainingProgress) =>
  write(TRAINING_KEY(studentId), progress);
export const clearTrainingProgress = (studentId: string) => remove(TRAINING_KEY(studentId));
