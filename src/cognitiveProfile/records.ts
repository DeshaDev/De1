/**
 * What the school record stores about the cognitive battery and the training programme,
 * and how the server validates it. The browser sends only raw item responses; the server
 * recomputes the profile itself so a client can never write its own centiles or risk level.
 */
import { z } from 'zod';
import { BATTERY, SUBTESTS_BY_ID, SubtestId } from './battery';
import { REFERENCE_TABLE, buildProfile, type Band, type ProfilePattern, type RiskLevel, type SubtestResult } from './scoring';
import { SKILLS, type SkillId, type TrainingProgress } from './training';
import type { HomeDialect } from './storage';

export interface CognitiveBatterySummary {
  referenceVersion: string;
  referenceStatus: 'provisional' | 'normed';
  ageBandLabelAr: string;
  completedSubtests: number;
  risk: RiskLevel;
  pattern: ProfilePattern;
  strengths: SubtestId[];
  weaknesses: SubtestId[];
  domains: Array<{ domain: string; centile: number; band: Band }>;
  subtests: Array<{ subtestId: SubtestId; centile: number; band: Band; percent: number }>;
}

export interface StoredCognitiveBattery {
  ageMonths: number;
  examinerName: string;
  startedAt: string;
  updatedAt: string;
  dialect?: HomeDialect;
  results: Partial<Record<SubtestId, SubtestResult>>;
  summary: CognitiveBatterySummary | null;
}

export interface StoredTrainingProgress extends TrainingProgress {
  updatedAt: string;
}

/** Every response id a subtest can legitimately produce (scored items only). */
function validItemIds(id: SubtestId): Set<string> {
  const s = SUBTESTS_BY_ID[id];
  const ids = new Set<string>();
  if (s.kind === 'choice') s.items.forEach((i) => ids.add(i.id));
  if (s.kind === 'span') s.trials.forEach((t) => ids.add(t.id));
  if (s.kind === 'association') s.blocks.forEach((b) => b.residents.forEach((r) => ids.add(`${b.id}-${r}`)));
  if (s.kind === 'pal') s.blocks.forEach((b) => b.order.forEach((c) => ids.add(`${b.id}-${c}`)));
  return ids;
}

const VALID_IDS: Record<string, Set<string>> = Object.fromEntries(BATTERY.map((s) => [s.id, validItemIds(s.id)]));
const SUBTEST_IDS = BATTERY.map((s) => s.id) as [SubtestId, ...SubtestId[]];
const isoDate = z.string().max(40).refine((v) => Number.isFinite(Date.parse(v)), 'تاريخ غير صالح');

const ItemResponseSchema = z
  .object({
    itemId: z.string().min(1).max(60),
    correct: z.boolean(),
    rtMs: z.number().finite().min(0).max(600_000),
    replays: z.number().int().min(0).max(50),
    partialCredit: z.number().int().min(0).max(10).optional(),
  })
  .strict();

const SubtestResultSchema = z
  .object({
    subtestId: z.enum(SUBTEST_IDS),
    responses: z.array(ItemResponseSchema).max(60),
    discontinued: z.boolean(),
    completedAt: isoDate,
    maxSpan: z.number().int().min(0).max(10).optional(),
    blockScores: z.array(z.number().int().min(0).max(10)).max(10).optional(),
  })
  .strict();

export const CognitiveBatteryUploadSchema = z
  .object({
    ageMonths: z.number().int().min(36).max(144),
    examinerName: z.string().max(80).default(''),
    startedAt: isoDate,
    dialect: z.enum(['gulf', 'levantine', 'egyptian', 'iraqi', 'maghrebi', 'sudanese', 'other']).optional(),
    results: z.record(z.string(), SubtestResultSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const [key, result] of Object.entries(value.results)) {
      if (key !== result.subtestId) {
        ctx.addIssue({ code: 'custom', message: `مفتاح الاختبار ${key} لا يطابق محتواه.` });
        continue;
      }
      const allowed = VALID_IDS[key];
      const seen = new Set<string>();
      for (const r of result.responses) {
        if (!allowed?.has(r.itemId)) ctx.addIssue({ code: 'custom', message: `بند غير معروف في ${key}: ${r.itemId}` });
        if (seen.has(r.itemId)) ctx.addIssue({ code: 'custom', message: `بند مكرر في ${key}: ${r.itemId}` });
        seen.add(r.itemId);
      }
    }
  });

const SKILL_IDS = Object.keys(SKILLS) as [SkillId, ...SkillId[]];
const LevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const TrainingProgressUploadSchema = z
  .object({
    plan: z
      .object({
        createdAt: isoDate,
        preventive: z.boolean(),
        focus: z.array(z.enum(SKILL_IDS)).min(1).max(8),
        rationaleAr: z.array(z.string().max(300)).max(10),
      })
      .strict(),
    levels: z.partialRecord(z.enum(SKILL_IDS), LevelSchema),
    mastered: z.array(z.enum(SKILL_IDS)).max(8),
    history: z
      .array(
        z
          .object({
            date: isoDate,
            skill: z.enum(SKILL_IDS),
            level: LevelSchema,
            correct: z.number().int().min(0).max(50),
            total: z.number().int().min(1).max(50),
          })
          .strict()
          .refine((h) => h.correct <= h.total, 'نتيجة جلسة غير منطقية')
      )
      .max(400),
    supportFlags: z.array(z.enum(SKILL_IDS)).max(8),
  })
  .strict();

/** Server-side: recompute everything a report needs from the raw responses. */
export function summarizeBattery(
  results: Partial<Record<SubtestId, SubtestResult>>,
  ageMonths: number
): CognitiveBatterySummary | null {
  if (Object.keys(results).length === 0) return null;
  const profile = buildProfile(results, ageMonths);
  return {
    referenceVersion: REFERENCE_TABLE.version,
    referenceStatus: profile.referenceStatus,
    ageBandLabelAr: profile.ageBandLabelAr,
    completedSubtests: profile.subtests.length,
    risk: profile.risk,
    pattern: profile.pattern,
    strengths: profile.strengths,
    weaknesses: profile.weaknesses,
    domains: profile.domains.map((d) => ({ domain: d.domain, centile: d.centile, band: d.band })),
    subtests: profile.subtests.map((s) => ({ subtestId: s.subtestId, centile: s.centile, band: s.band, percent: s.percent })),
  };
}
