import type { StudentRecord } from '../data/seedData';

const time = (iso: string | undefined | null) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};

const batteryScore = (s: StudentRecord) => {
  const b = s.cognitiveBattery;
  if (!b) return [0, 0] as const;
  return [time(b.updatedAt), Object.keys(b.results ?? {}).length] as const;
};

const trainingScore = (s: StudentRecord) => {
  const p = s.trainingProgress as (StudentRecord['trainingProgress'] & { updatedAt?: string }) | null | undefined;
  if (!p) return [0, 0] as const;
  return [time(p.updatedAt), p.history?.length ?? 0] as const;
};

const newer = (a: readonly [number, number], b: readonly [number, number]) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);

/**
 * Combine two copies of the same children (e.g. the cloud copy and this device's copy).
 * `incoming` wins for profile fields, but each child keeps whichever screening and training
 * progress is newer, so a cloud copy that lacks a result never erases one kept on the device.
 * Children only in `existing` are kept.
 */
export function mergeStudentRecords(existing: StudentRecord[], incoming: StudentRecord[]): StudentRecord[] {
  const byId = new Map(existing.map((s) => [s.id, s]));
  const merged = incoming.map((next) => {
    const prev = byId.get(next.id);
    if (!prev) return next;
    const out: StudentRecord = { ...prev, ...next };
    if (newer(batteryScore(prev), batteryScore(next))) out.cognitiveBattery = prev.cognitiveBattery;
    if (newer(trainingScore(prev), trainingScore(next))) out.trainingProgress = prev.trainingProgress;
    return out;
  });
  const incomingIds = new Set(incoming.map((s) => s.id));
  return [...merged, ...existing.filter((s) => !incomingIds.has(s.id))];
}
