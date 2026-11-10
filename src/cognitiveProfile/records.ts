/**
 * What the school record stores about the cognitive battery and the training programme,
 * and how the server validates it. The browser sends only raw item responses; the server
 * recomputes the profile itself so a client can never write its own centiles or risk level.
 */
import { z } from 'zod';
import { BATTERY, SubtestId, scoredItemIds, subtestsForAge } from './battery';
import { REFERENCE_TABLE, buildProfile, type Band, type ProfilePattern, type ReadingMeasures, type RiskLevel, type SubtestResult, type ReferenceStatus } from './scoring';
import { SPELL_KEYBOARD, SPELL_MAX_LETTERS } from './readingTasks';
import { SKILLS, type SkillId, type TrainingProgress } from './training';
import type { HomeDialect } from './storage';

export interface CognitiveBatterySummary {
  referenceVersion: string;
  referenceStatus: ReferenceStatus;
  ageBandLabelAr: string;
  completedSubtests: number;
  /** Tasks given at this child's age (older summaries lack it: nine). */
  totalSubtests?: number;
  risk: RiskLevel;
  pattern: ProfilePattern;
  strengths: SubtestId[];
  weaknesses: SubtestId[];
  domains: Array<{ domain: string; centile: number; band: Band }>;
  subtests: Array<{ subtestId: SubtestId; centile: number | null; band: Band | null; percent: number; scoreAvailable?: boolean; correct?: number; total?: number; measures?: ReadingMeasures }>;
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

const VALID_IDS: Record<string, Set<string>> = Object.fromEntries(BATTERY.map((s) => [s.id, new Set(scoredItemIds(s))]));
const SPELL_LETTERS = new Set(SPELL_KEYBOARD);
const SUBTEST_IDS = BATTERY.map((s) => s.id) as [SubtestId, ...SubtestId[]];
const isoDate = z.string().max(40).refine((v) => Number.isFinite(Date.parse(v)), 'تاريخ غير صالح');

const ItemResponseSchema = z
  .object({
    itemId: z.string().min(1).max(60),
    correct: z.boolean(),
    rtMs: z.number().finite().min(0).max(600_000),
    replays: z.number().int().min(0).max(50),
    partialCredit: z.number().int().min(0).max(10).optional(),
    typed: z
      .string()
      .max(SPELL_MAX_LETTERS * 2)
      .refine((v) => Array.from(v).length <= SPELL_MAX_LETTERS && Array.from(v).every((c) => SPELL_LETTERS.has(c)), 'حروف غير صالحة')
      .optional(),
    humanCorrect: z.boolean().optional(),
  })
  .strict();

const CognitiveAudioAssessmentSchema = z
  .object({
    taskId: z.enum(['oralReading', 'ranObjects', 'ranLetters', 'wordReading', 'nonwordReading']),
    sourceModel: z.literal('azure_pronunciation_assessment'),
    assessmentComplete: z.literal(true),
    assessmentReceipt: z.string().regex(/^[a-f0-9]{64}$/),
    transcript: z.string().max(10_000),
    durationSeconds: z.number().finite().min(1).max(88),
    wordAccuracyPercent: z.number().min(0).max(100),
    wordsCorrectPerMinute: z.number().min(0).max(600).nullable(),
    wordsPerMinute: z.number().min(0).max(600).nullable(),
    correctWordsCount: z.number().int().min(0).max(60),
    substitutionsCount: z.number().int().min(0).max(60),
    omissionsCount: z.number().int().min(0).max(60),
    insertionsCount: z.number().int().min(0).max(60),
    words: z.array(
      z.object({
        word: z.string().min(1).max(100),
        errorType: z.enum(['None', 'Omission', 'Mispronunciation', 'Substitution', 'DialectVariant', 'Unconfirmed', 'Insertion']),
        accuracyScore: z.number().min(0).max(100).nullable(),
        spokenWord: z.string().max(100).nullable(),
      }).strict()
    ).min(1).max(60),
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
    durationMs: z.number().finite().min(0).max(900_000).optional(),
    errorCount: z.number().int().min(0).max(60).optional(),
    audioAssessment: CognitiveAudioAssessmentSchema.optional(),
    audioAssessmentReceipt: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  })
  .strict();

export const CognitiveBatteryUploadSchema = z
  .object({
    ageMonths: z.number().int().min(36).max(144),
    examinerName: z.string().max(80).default(''),
    startedAt: isoDate,
    dialect: z.enum(['msa', 'gulf', 'levantine', 'egyptian', 'iraqi', 'maghrebi', 'sudanese', 'other']).optional(),
    guardianAudioConsentGiven: z.boolean().optional(),
    guardianAudioConsentRecordedAt: isoDate.optional(),
    results: z.record(z.string(), SubtestResultSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const [key, result] of Object.entries(value.results)) {
      if (key !== result.subtestId) {
        ctx.addIssue({ code: 'custom', message: `مفتاح الاختبار ${key} لا يطابق محتواه.` });
        continue;
      }
      const speechTask = ['oralReading', 'ranObjects', 'ranLetters', 'wordReading', 'nonwordReading'].includes(key);
      if (!speechTask && (result.audioAssessment || result.audioAssessmentReceipt)) {
        ctx.addIssue({ code: 'custom', message: `إيصال صوتي غير مسموح في ${key}.` });
      }
      if (Boolean(result.audioAssessment) !== Boolean(result.audioAssessmentReceipt)) {
        ctx.addIssue({ code: 'custom', message: `يجب إرسال نتيجة الصوت وإيصالها معًا في ${key}.` });
      }
      if (result.audioAssessment && result.audioAssessment.taskId !== result.subtestId) {
        ctx.addIssue({ code: 'custom', message: `مهمة الإيصال الصوتي لا تطابق ${key}.` });
      }
      if (
        result.audioAssessment &&
        (result.audioAssessment.assessmentReceipt !== result.audioAssessmentReceipt ||
          result.audioAssessment.words.some((word) => word.errorType === 'Unconfirmed' || word.errorType === 'Insertion') ||
          result.audioAssessment.words.length !== (VALID_IDS[key]?.size ?? 0))
      ) {
        ctx.addIssue({ code: 'custom', message: `نتيجة الصوت غير مكتملة أو لا تطابق البنود في ${key}.` });
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
const ProbeScoreSchema = z
  .object({ correct: z.number().int().min(0).max(60), total: z.number().int().min(1).max(60) })
  .strict()
  .refine((s) => s.correct <= s.total, 'نتيجة مقياس غير منطقية');

const TransferScoreSchema = z
  .object({ correct: z.number().int().min(0).max(8), total: z.number().int().min(0).max(8), ms: z.number().finite().min(0).max(900_000) })
  .strict()
  .refine((v) => v.correct <= v.total, 'نتيجة غير منطقية');

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
    probes: z
      .array(
        z
          .object({
            date: isoDate,
            session: z.number().int().min(1).max(500),
            correct: z.number().int().min(0).max(60),
            total: z.number().int().min(1).max(60),
            bySkill: z.partialRecord(z.enum(SKILL_IDS), ProbeScoreSchema),
            comparison: ProbeScoreSchema.extend({ skill: z.enum(SKILL_IDS) }).strict().optional(),
          })
          .strict()
          .refine((p) => p.correct <= p.total, 'نتيجة مقياس غير منطقية')
      )
      .max(200)
      .optional(),
    bkt: z
      .record(
        z.string().regex(/^[a-zA-Z]+:[123]$/),
        z
          .object({
            p: z.number().min(0).max(1),
            n: z.number().int().min(0).max(5000),
            c: z.number().int().min(0).max(5000),
            seq: z.string().max(300).regex(/^[01]*$/),
          })
          .strict()
      )
      .refine((r) => Object.keys(r).length <= 30, 'حالات كثيرة')
      .optional(),
    lessonsSeen: z.array(z.string().regex(/^[a-zA-Z]+:[123]$/)).max(30).optional(),
    badges: z.array(z.string().max(60)).max(30).optional(),
    placements: z
      .array(
        z
          .object({
            skill: z.enum(SKILL_IDS),
            date: isoDate,
            suggested: LevelSchema,
            placed: LevelSchema,
            answers: z.array(z.object({ level: LevelSchema, correct: z.boolean() }).strict()).max(6),
          })
          .strict()
      )
      .max(24)
      .optional(),
    transfer: z
      .array(
        z
          .object({
            point: z.enum(['pre', 'mid', 'post']),
            form: z.enum(['A', 'B']),
            session: z.number().int().min(1).max(60),
            date: isoDate,
            real: TransferScoreSchema,
            nonword: TransferScoreSchema,
          })
          .strict()
      )
      .max(6)
      .optional(),
    targets: z
      .object({
        soundPairs: z.array(z.tuple([z.string().length(1), z.string().length(1)])).max(6),
        letters: z.array(z.string().length(1)).max(10),
        source: z.object({ passageId: z.string().max(80), analysedAt: isoDate }).strict().optional(),
      })
      .strict()
      .optional(),
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
    completedSubtests: profile.subtests.filter((subtest) => subtest.scoreAvailable !== false).length,
    totalSubtests: subtestsForAge(ageMonths).length,
    risk: profile.risk,
    pattern: profile.pattern,
    strengths: profile.strengths,
    weaknesses: profile.weaknesses,
    domains: profile.domains.map((d) => ({ domain: d.domain, centile: d.centile, band: d.band })),
    subtests: profile.subtests.map((s) => ({
      subtestId: s.subtestId,
      centile: s.centile,
      band: s.band,
      percent: s.percent,
      scoreAvailable: s.scoreAvailable !== false,
      correct: s.correct,
      total: s.total,
      ...(s.measures ? { measures: s.measures } : {}),
    })),
  };
}
