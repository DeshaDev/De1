/**
 * Anonymous product usage counts (no names, student ids, answers or content).
 * Each device sends a random id that the server hashes before storing, so
 * the store can count distinct devices per day without knowing who they are.
 */
import { z } from 'zod';
import { BATTERY, type SubtestId } from '../cognitiveProfile/battery';

export const USAGE_EVENTS = [
  'visit',
  'battery_started',
  'subtest_completed',
  'battery_completed',
  'report_viewed',
  'training_started',
  'training_session_completed',
] as const;
export type UsageEvent = (typeof USAGE_EVENTS)[number];

const SUBTEST_IDS = BATTERY.map((s) => s.id) as [SubtestId, ...SubtestId[]];

export const UsageEventSchema = z
  .object({
    event: z.enum(USAGE_EVENTS),
    device: z.string().regex(/^[a-f0-9-]{16,64}$/),
    subtestId: z.enum(SUBTEST_IDS).optional(),
    discontinued: z.boolean().optional(),
  })
  .strict();
export type UsageEventInput = z.infer<typeof UsageEventSchema>;

export interface UsageDay {
  events: Partial<Record<UsageEvent, number>>;
  subtests: Partial<Record<SubtestId, { completed: number; discontinued: number }>>;
  /** Hashed device ids seen that day (capped). */
  devices: string[];
}

export interface UsageStore {
  version: 1;
  days: Record<string, UsageDay>;
}

export const RETENTION_DAYS = 400;
const MAX_DEVICES_PER_DAY = 20_000;

export const emptyUsageStore = (): UsageStore => ({ version: 1, days: {} });

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function recordUsageEvent(store: UsageStore, input: UsageEventInput, hashedDevice: string, now = new Date()): UsageStore {
  const key = dayKey(now);
  const day: UsageDay = store.days[key] ?? { events: {}, subtests: {}, devices: [] };
  day.events[input.event] = (day.events[input.event] ?? 0) + 1;
  if (input.event === 'subtest_completed' && input.subtestId) {
    const s = day.subtests[input.subtestId] ?? { completed: 0, discontinued: 0 };
    s.completed += 1;
    if (input.discontinued) s.discontinued += 1;
    day.subtests[input.subtestId] = s;
  }
  if (!day.devices.includes(hashedDevice) && day.devices.length < MAX_DEVICES_PER_DAY) day.devices.push(hashedDevice);
  store.days[key] = day;

  const cutoff = dayKey(new Date(now.getTime() - RETENTION_DAYS * 86_400_000));
  for (const k of Object.keys(store.days)) if (k < cutoff) delete store.days[k];
  return store;
}

export interface UsageSummary {
  rangeDays: number;
  uniqueDevices: number;
  totals: Record<UsageEvent, number>;
  /** Share of started batteries that reached all nine games (0–100), or null with no starts. */
  completionRate: number | null;
  subtests: Array<{ subtestId: SubtestId; completed: number; discontinuedRate: number | null }>;
  daily: Array<{ date: string; visits: number; devices: number; batteriesCompleted: number; trainingSessions: number }>;
}

export function summarizeUsage(store: UsageStore, rangeDays: number, now = new Date()): UsageSummary {
  const totals = Object.fromEntries(USAGE_EVENTS.map((e) => [e, 0])) as Record<UsageEvent, number>;
  const devices = new Set<string>();
  const sub = new Map<SubtestId, { completed: number; discontinued: number }>();
  const daily: UsageSummary['daily'] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * 86_400_000));
    const day = store.days[key];
    daily.push({
      date: key,
      visits: day?.events.visit ?? 0,
      devices: day?.devices.length ?? 0,
      batteriesCompleted: day?.events.battery_completed ?? 0,
      trainingSessions: day?.events.training_session_completed ?? 0,
    });
    if (!day) continue;
    for (const e of USAGE_EVENTS) totals[e] += day.events[e] ?? 0;
    day.devices.forEach((d) => devices.add(d));
    for (const [id, v] of Object.entries(day.subtests) as Array<[SubtestId, { completed: number; discontinued: number }]>) {
      const cur = sub.get(id) ?? { completed: 0, discontinued: 0 };
      sub.set(id, { completed: cur.completed + v.completed, discontinued: cur.discontinued + v.discontinued });
    }
  }
  return {
    rangeDays,
    uniqueDevices: devices.size,
    totals,
    completionRate: totals.battery_started > 0 ? Math.round((totals.battery_completed / totals.battery_started) * 100) : null,
    subtests: BATTERY.map((s) => {
      const v = sub.get(s.id) ?? { completed: 0, discontinued: 0 };
      return { subtestId: s.id, completed: v.completed, discontinuedRate: v.completed > 0 ? Math.round((v.discontinued / v.completed) * 100) : null };
    }),
    daily,
  };
}
