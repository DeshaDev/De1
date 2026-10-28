/**
 * Mirrors battery results and training progress to the school record when a school
 * account with write access is signed in. Without one, everything stays on this device.
 */
import type { StudentRecord } from '../data/seedData';
import { authenticatedFetch, getStoredBaseeraSession } from '../utils/apiAuth';
import type { BatterySession } from './storage';
import type { TrainingProgress } from './training';

export type SyncState = 'local' | 'saving' | 'saved' | 'error';

export function canSyncToSchool(student: Pick<StudentRecord, 'isDemoRecord' | 'guardianConsentGiven'>): boolean {
  const session = getStoredBaseeraSession();
  return Boolean(session && session.role === 'school_admin' && !student.isDemoRecord && student.guardianConsentGiven === true);
}

async function enroll(student: StudentRecord): Promise<void> {
  const res = await authenticatedFetch('/api/students/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: student.id,
      name: student.name,
      gradeLevel: Math.max(0, Math.min(6, student.gradeLevel || 0)),
      ageYears: Math.max(4, Math.min(16, student.ageYears || 6)),
      schoolName: student.schoolName && student.schoolName !== 'مدرستي' ? student.schoolName : undefined,
      guardianConsentGiven: true,
      guardianConsentRecordedAt: student.guardianConsentRecordedAt,
      guardianConsentSource: student.guardianConsentSource,
      guardianName: student.guardianName,
      guardianRelationship: student.guardianRelationship,
    }),
  });
  if (!res.ok) throw new Error(`enroll failed: ${res.status}`);
}

/** PUT to a student sub-resource, enrolling the learner first if the school record does not have them yet. */
async function put(url: string, body: unknown, student?: StudentRecord): Promise<StudentRecord | null> {
  const send = () =>
    authenticatedFetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  let res = await send();
  if (res.status === 404 && student && student.guardianConsentRecordedAt && student.guardianConsentSource) {
    await enroll(student);
    res = await send();
  }
  if (!res.ok) throw new Error(`sync failed: ${res.status}`);
  const data = (await res.json().catch(() => null)) as { student?: StudentRecord } | null;
  return data?.student ?? null;
}

export function syncBatteryToSchool(session: BatterySession, student?: StudentRecord): Promise<StudentRecord | null> {
  return put(
    `/api/students/${encodeURIComponent(session.studentId)}/cognitive-battery`,
    {
      ageMonths: session.ageMonths,
      examinerName: session.examinerName,
      startedAt: session.startedAt,
      results: session.results,
    },
    student
  );
}

export function syncTrainingToSchool(studentId: string, progress: TrainingProgress, student?: StudentRecord): Promise<StudentRecord | null> {
  const { plan, levels, mastered, history, supportFlags } = progress;
  return put(
    `/api/students/${encodeURIComponent(studentId)}/training-progress`,
    { plan, levels, mastered, history: history.slice(-400), supportFlags },
    student
  );
}

/** Rebuild a device session from the school record (e.g. when opening on another device). */
export function batterySessionFromRecord(student: StudentRecord): BatterySession | null {
  const stored = student.cognitiveBattery;
  if (!stored || !stored.results || Object.keys(stored.results).length === 0) return null;
  return {
    studentId: student.id,
    childName: student.name,
    ageMonths: stored.ageMonths,
    examinerName: stored.examinerName,
    startedAt: stored.startedAt,
    results: stored.results,
  };
}

export function trainingFromRecord(student: StudentRecord): TrainingProgress | null {
  const stored = student.trainingProgress;
  if (!stored) return null;
  const { updatedAt: _updatedAt, ...progress } = stored;
  return progress;
}
