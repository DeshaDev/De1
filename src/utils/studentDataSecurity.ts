import crypto from 'crypto';
import { z } from 'zod';
import {
  ARABIC_READING_PASSAGES,
  LearningReport,
  StudentMathTrialsPayload,
} from '../data/seedData';
import {
  SubitizingTrialResult,
  NumberLineTrialResult,
  TranscodingTrialResult,
  calculateDyscalculiaMetrics,
} from './learningMetrics';
import {
  ARABIC_DIALECT_PROFILES,
  ArabicDialectCode,
  evaluateOralReadingAlignment,
} from './dyslexiaEngines';

interface OralReadingIntegrationInput {
  assessed: boolean;
  wcpm?: number;
  accuracyPercent?: number | null;
  werPercent?: number | null;
  phoneticSubstitutionCount: number;
  dialectVariantCount: number;
  omissionCount: number;
  insertionCount?: number;
  misreadWords?: string[];
}

/** Server-verified output from the captured audio engine; never accepted from browser fields directly. */
export interface VerifiedAutomatedAudioAssessment {
  sourceModel: 'azure_pronunciation_assessment';
  assessmentComplete: true;
  passageId: string;
  transcript: string;
  durationSeconds: number;
  wordAccuracyPercent: number | null;
  wordsCorrectPerMinute: number | null;
  wordsPerMinute: number | null;
  words: Array<{
    word: string;
    errorType: 'None' | 'Omission' | 'Mispronunciation' | 'Substitution' | 'DialectVariant' | 'Unconfirmed' | 'Insertion';
    accuracyScore: number | null;
    spokenWord: string | null;
  }>;
}

export type BaseeraRole = 'platform_admin' | 'school_admin' | 'educator_readonly';

export type BaseeraScope =
  | 'students:read'
  | 'students:write'
  | 'students:delete'
  | 'ai:analyze'
  | 'audit:read'
  | 'leads:manage';

export interface VerifiedBaseeraSession {
  token: string;
  role: BaseeraRole;
  accountName: string;
  /** Tenant identity is part of the signed token and cannot be supplied by the browser. */
  tenantId: string;
  /** Human-readable Arabic school name for UI display instead of raw internal tenantId. */
  tenantDisplayNameAr: string;
  /** Unique server-recognized session ID used for logout revocation. */
  sessionId: string;
  scopes: BaseeraScope[];
  issuedAt: number;
  expiresAt: number;
}

const ROLE_SCOPES: Record<BaseeraRole, BaseeraScope[]> = {
  platform_admin: [
    'students:read',
    'students:write',
    'students:delete',
    'ai:analyze',
    'audit:read',
    'leads:manage',
  ],
  school_admin: [
    'students:read',
    'students:write',
    'students:delete',
    'ai:analyze',
    'audit:read',
  ],
  educator_readonly: ['students:read'],
};

const TENANT_DISPLAY_NAME_MAP: Record<string, string> = {
  platform: 'إدارة منصة بصيرة المركزية',
  baseera_hq: 'المقر الرئيسي لمنصة بصيرة',
  default: 'مدرسة الرواد الابتدائية',
  school_a: 'مدرسة الرواد الأولى (أ)',
  school_b: 'مدرسة النخبة الثانية (ب)',
  school_alpha: 'مدرسة ألف النموذجية',
  school_beta: 'مدرسة باء النموذجية',
};

export function formatTenantDisplayNameAr(
  tenantId: string,
  customDisplayNameAr?: string
): string {
  if (customDisplayNameAr && customDisplayNameAr.trim()) {
    return customDisplayNameAr.trim();
  }
  const cleanId = (tenantId || '').trim();
  if (TENANT_DISPLAY_NAME_MAP[cleanId]) {
    return TENANT_DISPLAY_NAME_MAP[cleanId];
  }
  const matchSuffix = cleanId.match(/^school[_-]([a-zA-Z0-9]+)$/i);
  if (matchSuffix) {
    return `مدرسة القطاع (${matchSuffix[1].toUpperCase()})`;
  }
  return cleanId ? `مدرسة (${cleanId})` : 'المدرسة المعتمدة';
}

export function stripArabicPatronymics(rawName: string): string {
  return (rawName || '')
    .replace(/(?:^|\s)(?:بن|بنت)(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getScopesForRole(role: BaseeraRole): BaseeraScope[] {
  return ROLE_SCOPES[role] || ROLE_SCOPES.educator_readonly;
}

/**
 * Strictly parses TRUST_PROXY_HOPS environment variable.
 * Defaults to 0 when unset/empty; throws on any invalid or non-integer value.
 */
export function parseStrictTrustProxyHops(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 0;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Invalid TRUST_PROXY_HOPS value "${raw}": must be an integer between 0 and 10.`
    );
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10) {
    throw new Error(
      `Out-of-range TRUST_PROXY_HOPS value "${raw}": must be between 0 and 10.`
    );
  }
  return parsed;
}

export function issueBaseeraSessionToken(
  role: BaseeraRole,
  accountName: string,
  secret: string,
  ttlMs: number = 60 * 60 * 1000,
  tenantId = 'default',
  customTenantDisplayNameAr?: string
): VerifiedBaseeraSession {
  if (role !== 'platform_admin' && role !== 'school_admin' && role !== 'educator_readonly') {
    throw new Error('Invalid learning-session role');
  }
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(tenantId)) {
    throw new Error('Invalid tenant ID');
  }

  const issuedAt = Date.now();
  const expiresAt = issuedAt + ttlMs;
  const scopes = getScopesForRole(role);
  const sessionId = crypto.randomBytes(16).toString('hex');
  const tenantDisplayNameAr = formatTenantDisplayNameAr(
    tenantId,
    customTenantDisplayNameAr
  );

  const payloadObj = {
    role,
    accountName: accountName.trim() || 'مسؤول المدرسة',
    tenantId,
    tenantDisplayNameAr,
    sessionId,
    scopes,
    issuedAt,
    expiresAt,
  };

  const payloadBase64 = Buffer.from(
    JSON.stringify(payloadObj),
    'utf8'
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  return {
    token: `${payloadBase64}.${signature}`,
    role,
    accountName: payloadObj.accountName,
    tenantId,
    tenantDisplayNameAr,
    sessionId,
    scopes,
    issuedAt,
    expiresAt,
  };
}

/**
 * Verifies an HMAC-SHA256 signed session token and checks expiration.
 */
export function verifyBaseeraSessionToken(
  rawToken: string | undefined | null,
  secret: string,
  nowMs: number = Date.now()
): VerifiedBaseeraSession | null {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const trimmed = rawToken.replace(/^Bearer\s+/i, '').trim();
  const parts = trimmed.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf8')
    );
    if (
      !parsed ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= nowMs ||
      (parsed.role !== 'platform_admin' && parsed.role !== 'school_admin' && parsed.role !== 'educator_readonly') ||
      typeof parsed.tenantId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(parsed.tenantId) ||
      typeof parsed.sessionId !== 'string' ||
      !/^[a-f0-9]{32}$/.test(parsed.sessionId) ||
      typeof parsed.issuedAt !== 'number' ||
      !Array.isArray(parsed.scopes) ||
      parsed.scopes.some(
        (scope: unknown) =>
          !ROLE_SCOPES[parsed.role as BaseeraRole].includes(
            scope as BaseeraScope
          )
      )
    )
      return null;
    // Re-derive scopes from the role rather than trusting mutable claims in a signed token.
    const scopes = getScopesForRole(parsed.role as BaseeraRole);
    const tenantDisplayNameAr = formatTenantDisplayNameAr(
      parsed.tenantId,
      typeof parsed.tenantDisplayNameAr === 'string'
        ? parsed.tenantDisplayNameAr
        : undefined
    );
    return {
      token: trimmed,
      role: parsed.role,
      accountName:
        typeof parsed.accountName === 'string'
          ? parsed.accountName
          : 'مستخدم',
      tenantId: parsed.tenantId,
      tenantDisplayNameAr,
      sessionId: parsed.sessionId,
      scopes,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Checks whether a verified session possesses the required RBAC scope.
 */
export function authorizeSessionScope(
  session: VerifiedBaseeraSession | null,
  requiredScope: BaseeraScope
): { allowed: boolean; statusCode: 200 | 401 | 403; errorAr?: string } {
  if (!session) {
    return {
      allowed: false,
      statusCode: 401,
      errorAr:
        'غير مصرح بالوصول (401): يلزم تقديم رمز جلسة صالح ومصادق عليه للوصول إلى السجلات.',
    };
  }
  if (!session.scopes.includes(requiredScope)) {
    return {
      allowed: false,
      statusCode: 403,
      errorAr: `صلاحيات غير كافية (403): الدور الحالي (${session.role}) لا يملك الصلاحية المطلوبة (${requiredScope}).`,
    };
  }
  return { allowed: true, statusCode: 200 };
}

/**
 * Strict Default-Deny Guardian Consent Validator:
 * Rejects any request where `guardianConsentGiven` is missing (`undefined`), `null`, `false`, or non-boolean.
 * Only explicit boolean `true` is accepted.
 */
export function validateExplicitGuardianConsent(consentField: unknown): {
  valid: boolean;
  errorAr?: string;
} {
  if (consentField !== true) {
    return {
      valid: false,
      errorAr:
        'مرفوض أمنياً (Default-Deny): يجب تقديم إقرار صريح ومؤكد بموافقة ولي الأمر (guardianConsentGiven: true) قبل حفظ أو تحليل بيانات الطفل.',
    };
  }
  return { valid: true };
}

// ============================================================================
// High-entropy access-code validation and IP-scoped authentication throttling
// ============================================================================

export interface AuthFailureBucket {
  failures: number[];
  lockedUntilMs: number;
}

const AUTH_FAILURE_WINDOW_MS = 60_000;
const MAX_FREE_FAILURES = 4;

/**
 * Access codes must match the output shape of "openssl rand -hex 24".
 * This rejects passphrases, predictable prefixes/sequences, low symbol diversity,
 * and obvious repeated patterns. It is a configuration sanity check, not proof
 * that an operator actually used a cryptographically secure generator.
 */
export function isStrongBaseeraAccessCode(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{48}$/.test(value)) return false;

  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) || 0) + 1);
  if (counts.size < 12) return false;

  const shannonEntropy = [...counts.values()].reduce((sum, count) => {
    const probability = count / value.length;
    return sum - probability * Math.log2(probability);
  }, 0);
  if (shannonEntropy < 3.2) return false;

  // Reject a short pattern repeated to fill the key (e.g. "0123456789abcdef" x 3).
  for (let period = 1; period <= 24; period++) {
    let repeats = true;
    for (let index = period; index < value.length; index++) {
      if (value[index] !== value[index % period]) {
        repeats = false;
        break;
      }
    }
    if (repeats) return false;
  }

  return true;
}

export function calculateProgressiveBackoffMs(failureCount: number): number {
  if (failureCount <= MAX_FREE_FAILURES) return 0;
  if (failureCount === 5) return 2_000;
  if (failureCount === 6) return 4_000;
  if (failureCount === 7) return 8_000;
  // 8th failure = 15s, 9th = 30s, 10th+ = 60s max
  return Math.min(60_000, 15_000 * Math.pow(2, failureCount - 8));
}

const MAX_AUTH_FAILURE_BUCKETS = 5_000;
const MAX_AUTH_FAILURES_PER_BUCKET = 10;

export function getAuthBucketKey(clientIp: string, _tenantKey?: string): string {
  // Never partition failed guesses by a tenant hint supplied by the unauthenticated client.
  const safeIp = (clientIp || 'local').trim() || 'local';
  return `${safeIp}::unscoped`;
}

/**
 * Applies progressive delay to any request from an IP with recent failed
 * attempts, whether the submitted credential is valid or invalid.
 * This is a soft delay rather than a hard lock: valid credentials remain usable
 * after the delay. It rises from 2s to 60s as active failures rise from five to ten.
 */
export function getAuthThrottleDelayMs(
  buckets: Map<string, AuthFailureBucket>,
  clientIp: string,
  tenantKey?: string,
  nowMs: number = Date.now()
): number {
  const key = getAuthBucketKey(clientIp, tenantKey);
  const existing = buckets.get(key);
  if (!existing) return 0;

  const activeFailures = existing.failures.filter(
    (timestamp) => nowMs - timestamp >= 0 && nowMs - timestamp < AUTH_FAILURE_WINDOW_MS
  );
  if (activeFailures.length === 0) {
    // Rolling-window expiry is natural cleanup, not a successful-login reset.
    if (existing.lockedUntilMs <= nowMs) buckets.delete(key);
    return Math.min(60_000, Math.max(0, existing.lockedUntilMs - nowMs));
  }

  const progressiveDelayMs = calculateProgressiveBackoffMs(activeFailures.length);
  const lockRemainingMs = Math.max(0, existing.lockedUntilMs - nowMs);
  return Math.min(60_000, Math.max(progressiveDelayMs, lockRemainingMs));
}

export function checkAuthFailureLimit(
  buckets: Map<string, AuthFailureBucket>,
  clientIp: string,
  tenantKey?: string,
  nowMs: number = Date.now()
): { allowed: boolean; retryAfterSeconds: number; failureCount: number } {
  const key = getAuthBucketKey(clientIp, tenantKey);
  const existing = buckets.get(key);
  if (!existing) {
    return { allowed: true, retryAfterSeconds: 0, failureCount: 0 };
  }
  const activeFailures = existing.failures.filter(
    (ts) => nowMs - ts < AUTH_FAILURE_WINDOW_MS
  );
  if (activeFailures.length === 0 && existing.lockedUntilMs <= nowMs) {
    buckets.delete(key);
    return { allowed: true, retryAfterSeconds: 0, failureCount: 0 };
  }
  if (existing.lockedUntilMs > nowMs && activeFailures.length >= MAX_AUTH_FAILURES_PER_BUCKET) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.lockedUntilMs - nowMs) / 1000)
    );
    return {
      allowed: false,
      retryAfterSeconds,
      failureCount: activeFailures.length,
    };
  }
  if (activeFailures.length >= MAX_AUTH_FAILURES_PER_BUCKET) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (activeFailures[activeFailures.length - 1] +
          AUTH_FAILURE_WINDOW_MS -
          nowMs) /
          1000
      )
    );
    return {
      allowed: false,
      retryAfterSeconds,
      failureCount: activeFailures.length,
    };
  }
  return {
    allowed: true,
    retryAfterSeconds: 0,
    failureCount: activeFailures.length,
  };
}

export function recordFailedAuthAttempt(
  buckets: Map<string, AuthFailureBucket>,
  clientIp: string,
  tenantKey?: string,
  nowMs: number = Date.now()
): {
  locked: boolean;
  retryAfterSeconds: number;
  backoffMs: number;
  failureCount: number;
} {
  const key = getAuthBucketKey(clientIp, tenantKey);
  const existing = buckets.get(key) || { failures: [], lockedUntilMs: 0 };
  const activeFailures = existing.failures.filter(
    (ts) => nowMs - ts < AUTH_FAILURE_WINDOW_MS
  );
  activeFailures.push(nowMs);
  // Keep both the per-IP history and the number of IP buckets bounded.
  const boundedFailures = activeFailures.slice(-MAX_AUTH_FAILURES_PER_BUCKET);
  const backoffMs = calculateProgressiveBackoffMs(boundedFailures.length);
  const lockedUntilMs =
    backoffMs > 0
      ? Math.max(existing.lockedUntilMs, nowMs + backoffMs)
      : existing.lockedUntilMs;
  buckets.delete(key);
  buckets.set(key, { failures: boundedFailures, lockedUntilMs });
  while (buckets.size > MAX_AUTH_FAILURE_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }

  const locked = boundedFailures.length >= MAX_AUTH_FAILURES_PER_BUCKET;
  const retryAfterSeconds = locked
    ? Math.max(1, Math.ceil((lockedUntilMs - nowMs) / 1000))
    : Math.ceil(backoffMs / 1000);
  return {
    locked,
    retryAfterSeconds,
    backoffMs,
    failureCount: activeFailures.length,
  };
}

// ============================================================================
// Strict Zod Schemas for Profile PATCH, Learning Report Update, and Evidence
// ============================================================================

/**
 * Strict 4-field student profile PATCH schema:
 * Accepts ONLY `name`, `schoolName`, `gradeLevel`, `ageYears`.
 * Rejects derived scores (`dyslexiaRiskScore`, `readingRiskLevel`), `tenantId`, `learningReport`, consent, and history.
 */
export const StudentProfilePatchSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'اسم الطالب يجب أن يتكون من حرفين على الأقل.')
      .max(120, 'اسم الطالب لا يتجاوز 120 حرفاً.')
      .optional(),
    schoolName: z
      .string()
      .trim()
      .min(2, 'اسم المدرسة يجب أن يتكون من حرفين على الأقل.')
      .max(160, 'اسم المدرسة لا يتجاوز 160 حرفاً.')
      .optional(),
    gradeLevel: z.number().int().min(1).max(6).optional(),
    ageYears: z.number().int().min(6).max(16).optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'يجب إرسال حقل ملف شخصي واحد على الأقل للتحديث.',
  });

/**
 * Strict schema for saving an updated learning report (`PUT /api/students/:id/report`).
 * Requires non-empty exercises and accommodations so saved reports never render blank sections.
 */
export const LearningReportSchema = z
  .object({
    learningSummary: z.string().trim().min(10).max(5000),
    ocularMotorAnalysis: z.string().trim().min(10).max(5000),
    orthographicAndPhonologicalPatterns: z.string().trim().min(10).max(5000),
    dyscalculiaSpatialAnalysis: z.string().trim().min(10).max(5000),
    interventionExercises: z
      .array(
        z
          .object({
            title: z.string().trim().min(3).max(240),
            durationMinutes: z.number().int().min(1).max(120),
            description: z.string().trim().min(5).max(1500),
          })
          .strict()
      )
      .min(1, 'يجب أن يتضمن التقرير تمرين مساندة واحداً على الأقل.')
      .max(10),
    classroomAccommodations: z
      .array(z.string().trim().min(5).max(600))
      .min(1, 'يجب أن يتضمن التقرير تيسيراً صفياً واحداً على الأقل.')
      .max(12),
  })
  .strict();

export const LearningReportUpdateEnvelopeSchema = z
  .object({
    learningReport: LearningReportSchema,
  })
  .strict();

// Approved Math Trial Specifications (Supporting both expanded 20-task battery & legacy 9-task baseline)
const ALLOWED_SUBITIZING_TARGETS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const ALLOWED_SUBITIZING_OPTIONS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

const ALLOWED_NUMBER_LINE_SPEC: Record<
  number,
  { scaleMin: number; scaleMax: number }
> = {
  8: { scaleMin: 0, scaleMax: 20 },
  15: { scaleMin: 0, scaleMax: 20 },
  37: { scaleMin: 0, scaleMax: 100 },
  82: { scaleMin: 0, scaleMax: 100 },
  156: { scaleMin: 0, scaleMax: 200 },
  250: { scaleMin: 0, scaleMax: 1000 },
  750: { scaleMin: 0, scaleMax: 1000 },
};

const ALLOWED_TRANSCODING_SPEC: Record<
  number,
  { options: Set<number>; reversalDistractor: number; alternateReversal?: number }
> = {
  47: { options: new Set([47, 74, 49]), reversalDistractor: 74 },
  83: { options: new Set([38, 83, 63]), reversalDistractor: 38 },
  69: { options: new Set([69, 96, 66]), reversalDistractor: 96 },
  52: { options: new Set([25, 52, 56]), reversalDistractor: 25 },
  27: { options: new Set([28, 27, 72]), reversalDistractor: 72 },
  76: { options: new Set([76, 67, 72]), reversalDistractor: 67 },
};

export function validateAndDeriveMathTrials(rawMath: unknown): {
  valid: boolean;
  errorAr?: string;
  trials?: StudentMathTrialsPayload;
  metrics?: ReturnType<typeof calculateDyscalculiaMetrics>;
} {
  if (!rawMath || typeof rawMath !== 'object' || Array.isArray(rawMath)) {
    return {
      valid: false,
      errorAr: 'بيانات محاولات الحساب غير صالحة أو مفقودة.',
    };
  }
  const obj = rawMath as Record<string, unknown>;
  const allowedTopLevelKeys = new Set(['subitizingTrials', 'numberLineTrials', 'transcodingTrials']);
  const unexpectedTopLevelKeys = Object.keys(obj).filter((key) => !allowedTopLevelKeys.has(key));
  if (unexpectedTopLevelKeys.length > 0) {
    return { valid: false, errorAr: `حقول غير مسموح بها في بيانات الحساب: ${unexpectedTopLevelKeys.join(', ')}.` };
  }
  const subRaw = obj.subitizingTrials;
  const nlRaw = obj.numberLineTrials;
  const trRaw = obj.transcodingTrials;

  if (!Array.isArray(subRaw) || subRaw.length < 1 || subRaw.length > 8) {
    return {
      valid: false,
      errorAr:
        'يجب إرسال بين 1 و8 محاولات معتمدة لاختبار تمييز الكميات الفوري (الأهداف 1 إلى 8).',
    };
  }
  if (!Array.isArray(nlRaw) || nlRaw.length < 1 || nlRaw.length > 6) {
    return {
      valid: false,
      errorAr:
        'يجب إرسال بين 1 و6 محاولات معتمدة لاختبار خط الأعداد.',
    };
  }
  if (!Array.isArray(trRaw) || trRaw.length < 1 || trRaw.length > 6) {
    return {
      valid: false,
      errorAr:
        'يجب إرسال بين 1 و6 محاولات معتمدة لاختبار ترميز الأرقام العربية.',
    };
  }

  const seenSubTargets = new Set<number>();
  const subitizingTrials: SubitizingTrialResult[] = [];
  for (const item of subRaw) {
    if (!item || typeof item !== 'object') {
      return { valid: false, errorAr: 'محاولة تمييز كميات غير صالحة.' };
    }
    const rec = item as Record<string, unknown>;
    const unexpectedKeys = Object.keys(rec).filter(
      (key) => !['dotCount', 'targetCount', 'chosen', 'selectedCount', 'correct', 'reactionTimeMs'].includes(key)
    );
    if (unexpectedKeys.length > 0) {
      return { valid: false, errorAr: `حقول غير مسموح بها في محاولة تمييز الكميات: ${unexpectedKeys.join(', ')}.` };
    }
    const dotCount = Number(rec.dotCount ?? rec.targetCount);
    const chosen =
      rec.chosen !== undefined || rec.selectedCount !== undefined
        ? Number(rec.chosen ?? rec.selectedCount)
        : undefined;
    const rtMs = Number(rec.reactionTimeMs);

    if (
      !Number.isInteger(dotCount) ||
      !ALLOWED_SUBITIZING_TARGETS.includes(dotCount as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) ||
      seenSubTargets.has(dotCount)
    ) {
      return {
        valid: false,
        errorAr: `هدف تمييز الكميات (${String(rec.dotCount)}) غير مسموح أو مكرر؛ الأهداف المعتمدة هي 1 إلى 8 فقط.`,
      };
    }
    if (
      chosen !== undefined &&
      (!Number.isInteger(chosen) || !ALLOWED_SUBITIZING_OPTIONS.has(chosen))
    ) {
      return {
        valid: false,
        errorAr: `الخيار المختار في تمييز الكميات (${String(chosen)}) غير معروض ضمن الخيارات المسموحة (1-9).`,
      };
    }
    if (chosen === undefined && typeof rec.correct !== 'boolean') {
      return {
        valid: false,
        errorAr:
          'يلزم تحديد الخيار المختار (chosen) أو نتيجة المطابقة في كل محاولة تمييز كميات.',
      };
    }
    if (!Number.isFinite(rtMs) || rtMs < 150 || rtMs > 15_000) {
      return {
        valid: false,
        errorAr:
          'زمن الاستجابة في تمييز الكميات خارج النطاق الفسيولوجي المعقول (150ms–15000ms).',
      };
    }
    const derivedCorrect =
      chosen !== undefined ? chosen === dotCount : Boolean(rec.correct);
    if (
      chosen !== undefined &&
      typeof rec.correct === 'boolean' &&
      rec.correct !== derivedCorrect
    ) {
      return {
        valid: false,
        errorAr: 'تعارض بين الخيار المختار وحقل الصحة في تمييز الكميات.',
      };
    }
    seenSubTargets.add(dotCount);
    subitizingTrials.push({
      dotCount,
      correct: derivedCorrect,
      reactionTimeMs: Math.round(rtMs),
    });
  }

  const seenNlTargets = new Set<number>();
  const numberLineTrials: NumberLineTrialResult[] = [];
  for (const item of nlRaw) {
    if (!item || typeof item !== 'object') {
      return { valid: false, errorAr: 'محاولة خط أعداد غير صالحة.' };
    }
    const rec = item as Record<string, unknown>;
    const unexpectedKeys = Object.keys(rec).filter(
      (key) => !['target', 'userEstimate', 'scaleMin', 'scaleMax', 'reactionTimeMs'].includes(key)
    );
    if (unexpectedKeys.length > 0) {
      return { valid: false, errorAr: `حقول غير مسموح بها في محاولة خط الأعداد: ${unexpectedKeys.join(', ')}.` };
    }
    const target = Number(rec.target);
    const spec = ALLOWED_NUMBER_LINE_SPEC[target];
    if (!spec || seenNlTargets.has(target)) {
      return {
        valid: false,
        errorAr: `هدف خط الأعداد (${String(rec.target)}) مخترَع أو مكرر؛ الأهداف المعتمدة هي 8، 15، 37، 82، 156، 250، 750 فقط.`,
      };
    }
    const scaleMin =
      rec.scaleMin === undefined ? spec.scaleMin : Number(rec.scaleMin);
    const scaleMax =
      rec.scaleMax === undefined ? spec.scaleMax : Number(rec.scaleMax);
    const userEstimate = Number(rec.userEstimate);
    const rtMs = Number(rec.reactionTimeMs);

    if (scaleMin !== spec.scaleMin || scaleMax !== spec.scaleMax) {
      return {
        valid: false,
        errorAr: `مدى خط الأعداد للهدف ${target} يجب أن يكون ${spec.scaleMin}–${spec.scaleMax}.`,
      };
    }
    if (
      !Number.isFinite(userEstimate) ||
      userEstimate < spec.scaleMin ||
      userEstimate > spec.scaleMax
    ) {
      return {
        valid: false,
        errorAr: `تحديد الطالب (${String(rec.userEstimate)}) خارج مدى خط الأعداد (${spec.scaleMin}–${spec.scaleMax}).`,
      };
    }
    if (!Number.isFinite(rtMs) || rtMs < 150 || rtMs > 30_000) {
      return {
        valid: false,
        errorAr:
          'زمن الاستجابة في خط الأعداد خارج النطاق المعقول (150ms–30000ms).',
      };
    }
    seenNlTargets.add(target);
    numberLineTrials.push({
      target,
      userEstimate,
      reactionTimeMs: Math.round(rtMs),
      scaleMin: spec.scaleMin,
      scaleMax: spec.scaleMax,
    });
  }

  const seenTrTargets = new Set<number>();
  const transcodingTrials: TranscodingTrialResult[] = [];
  for (const item of trRaw) {
    if (!item || typeof item !== 'object') {
      return { valid: false, errorAr: 'محاولة ترميز أرقام غير صالحة.' };
    }
    const rec = item as Record<string, unknown>;
    const unexpectedKeys = Object.keys(rec).filter(
      (key) => !['targetNumber', 'selectedNumber', 'isReversalError', 'reactionTimeMs'].includes(key)
    );
    if (unexpectedKeys.length > 0) {
      return { valid: false, errorAr: `حقول غير مسموح بها في محاولة ترميز الأرقام: ${unexpectedKeys.join(', ')}.` };
    }
    const targetNumber = Number(rec.targetNumber);
    const selectedNumber = Number(rec.selectedNumber);
    const rtMs = Number(rec.reactionTimeMs);
    const spec = ALLOWED_TRANSCODING_SPEC[targetNumber];

    if (!spec || seenTrTargets.has(targetNumber)) {
      return {
        valid: false,
        errorAr: `هدف ترميز الأرقام (${String(rec.targetNumber)}) مخترَع أو مكرر؛ الأهداف المعتمدة هي 47، 83، 69، 52، 27، 76 فقط.`,
      };
    }
    if (
      !Number.isInteger(selectedNumber) ||
      !spec.options.has(selectedNumber)
    ) {
      return {
        valid: false,
        errorAr: `الخيار المختار (${String(rec.selectedNumber)}) للهدف ${targetNumber} غير معروض ضمن الخيارات المعتمدة.`,
      };
    }
    if (!Number.isFinite(rtMs) || rtMs < 150 || rtMs > 20_000) {
      return {
        valid: false,
        errorAr:
          'زمن الاستجابة في ترميز الأرقام خارج النطاق المعقول (150ms–20000ms).',
      };
    }
    const derivedReversal = selectedNumber === spec.reversalDistractor;
    if (
      typeof rec.isReversalError === 'boolean' &&
      rec.isReversalError !== derivedReversal
    ) {
      return {
        valid: false,
        errorAr: 'تعارض بين الرقم المختار وحقل خطأ العكس المكاني.',
      };
    }
    seenTrTargets.add(targetNumber);
    transcodingTrials.push({
      targetNumber,
      selectedNumber,
      isReversalError: derivedReversal,
      reactionTimeMs: Math.round(rtMs),
    });
  }

  const metrics = calculateDyscalculiaMetrics(
    subitizingTrials,
    numberLineTrials,
    transcodingTrials
  );
  return {
    valid: true,
    trials: { subitizingTrials, numberLineTrials, transcodingTrials },
    metrics,
  };
}

/**
 * Generates a complete, deterministic, rule-based LearningReport on the server
 * with NON-EMPTY `interventionExercises` and `classroomAccommodations` (Fixing Finding 1).
 */
export function buildDeterministicLearningReport(params: {
  studentName: string;
  gradeLevel: number;
  dialectLabelAr: string;
  totalPassageWordCount: number;
  wpm: number;
  comprehensionScore?: number | null;
  problematicWords: string[];
  oralReadingAssessed: boolean;
  oralAccuracyPercent: number | null;
  phoneticSubstitutionCount: number;
  dialectVariantCount: number;
  assessmentModality?: 'voice_only' | 'reading_only';
  dyscalculiaAssessed: boolean;
  numberLinePAE: number | null;
  subitizingAccuracy: number | null;
  reversalErrorCount: number | null;
}): LearningReport {
  const isMathTested =
    params.dyscalculiaAssessed && typeof params.numberLinePAE === 'number';
  const numberLinePracticeSuggested =
    isMathTested && ((params.numberLinePAE ?? 0) > 0 || (params.reversalErrorCount ?? 0) > 0);
  const isReadingOnly = params.assessmentModality !== 'voice_only';
  const isVoiceOnly = params.assessmentModality === 'voice_only';
  const oralText = params.oralReadingAssessed
    ? ' محاذاة القراءة الجهرية (' + params.dialectLabelAr + ') سجلت مطابقة آلية/بشرية قدرها ' +
      (params.oralAccuracyPercent === null ? 'غير متاحة' : params.oralAccuracyPercent) +
      '%، و' + params.phoneticSubstitutionCount + ' إبدالات و' +
      params.dialectVariantCount + ' صيغة لهجية محتملة؛ يلزم تفسيرها بحسب طريقة التحقق، ولا تشخّص عسر القراءة.'
    : ' لم تُجرَ مراجعة جهرية للكلمات في هذه الجلسة.';

  const targetWordsSample =
    params.problematicWords.slice(0, 4).join('، ') || 'كلمات مستهدفة بالتحليل الذكي للتدريب';

  const exercises: LearningReport['interventionExercises'] = [
    {
      title: 'قراءة متدرجة وتقسيم الكلمات إلى مقاطع',
      durationMinutes: 10,
      description:
        'نشاط تعليمي مقترح لقراءة كلمات مثل (' + targetWordsSample +
        ') وتقسيمها إلى مقاطع بالتدريب التفاعلي الذكي أو بتوجيه الأسرة. هذه توصية تعليمية وليست تدخلاً علاجياً مُثبتاً.',
    },
    {
      title: 'تمييز الحروف العربية المتقاربة رسمًا ونقطًا',
      durationMinutes: 8,
      description:
        'ممارسة قراءة كلمات وجمل قصيرة تشمل أزواجًا مثل (ب/ت/ث، ج/ح/خ، د/ذ، ص/ض، ط/ظ)، مع شرح الفرق وتشجيع الطفل دون تصنيفه.',
    },
  ];

  if (isMathTested) {
    exercises.push({
      title: numberLinePracticeSuggested
        ? 'تدريب اختياري على خط الأعداد والقيمة المكانية'
        : 'استكشاف الكميات وخط الأعداد',
      durationMinutes: 10,
      description: numberLinePracticeSuggested
        ? 'أظهرت هذه الجلسة فارقاً في تحديد الموقع على خط الأعداد قدره ' + params.numberLinePAE +
          '% وعدد ' + (params.reversalErrorCount ?? 'غير متاح') +
          ' من أخطاء ترتيب رموز العدد في المهام المحددة. يمكن استخدام ذلك لاختيار تدريب، دون تحويله إلى تصنيف خطر.'
        : 'نشاط اختياري لربط الكميات بمواقعها على خط الأعداد. المقاييس وصفية لهذه الجلسة ولا تكوّن درجة معيارية.',
    });
  } else {
    exercises.push({
      title: 'قراءة مشتركة وتنمية المفردات',
      durationMinutes: 10,
      description:
        'يقرأ الطفل عبر المنصة التفاعلية مع التحليل الصوتي الذكي لمعاني الكلمات ويعيد صياغة فكرة من النص. لا يُفترض وجود صعوبة تشخيصية.',
    });
  }

  const accommodations: string[] = [
    'إتاحة خط عربي واضح وكبير وتباعد أسطر مريح وخلفية يختارها الطفل، مع إمكانية تعديل التباين وحجم النص وفق الحاجة.',
    'يمكن تجربة مسطرة قراءة اختيارية لعزل السطر إذا وجد الطفل ذلك مفيدًا؛ فائدتها وتفضيلها يختلفان بين الأطفال.',
  ];

  if (numberLinePracticeSuggested) {
    accommodations.push(
      'يمكن تجربة خط أعداد مرئي ومكعبات القيمة المكانية، ثم ملاحظة ما إذا كانت هذه الوسائل تساعد الطفل في المهمة.'
    );
  } else {
    accommodations.push(
      'إتاحة وقت إضافي عند الحاجة، وتقسيم التعليمات الطويلة إلى خطوات قصيرة؛ لا تُفرض نسبة ثابتة بوصفها معيارًا عامًا.'
    );
  }

  accommodations.push(
    'تفسير منهجي: هذه المخرجات أوصاف لمهام تعليمية قصيرة وليست أداة تشخيص طبي، ولا تُعرض منها درجات خطر معيارية دون تحقق مستقل على عينة مناسبة.'
  );

  const readingRateText = params.wpm > 0
    ? String(params.wpm) + ' كلمة/دقيقة'
    : 'غير متاح لعدم توافر قياس صالح';
  const learningSummary = isReadingOnly
    ? 'جلسة قراءة وفهم تعليمية للطالب (' + params.studentName + '، الصف ' + params.gradeLevel +
      '): معدل إتمام النص المحسوب ' + readingRateText + ' في نص مرجعي من ' +
      (params.totalPassageWordCount > 0 ? String(params.totalPassageWordCount) : 'عدد كلمات غير متاح') +
      ' كلمة، ونتيجة أسئلة الفهم ' + (typeof params.comprehensionScore === 'number' ? String(params.comprehensionScore) + '%' : 'غير متاحة') +
      '. يفترض معدل الإتمام إكمال النص ولا يقيس صحة الكلمات. هذه نتيجة وصفية للنشاط وليست معيارًا معياريًا أو تشخيصًا.'
    : 'جلسة قراءة جهرية تعليمية للطالب (' + params.studentName + '، الصف ' + params.gradeLevel +
      '): المعدل المسجل ' + readingRateText + '.' + oralText +
      ' هذا ملخص وصفي وليس تصنيفًا معياريًا أو تشخيصًا.';

  return {
    learningSummary,
    ocularMotorAnalysis: 'غير منطبق؛ لا تستخدم بصيرة الحالية الكاميرا أو تتبّع العين ولا تجمع قياسات نظر.',
    orthographicAndPhonologicalPatterns: isReadingOnly
      ? 'لم تُقيّم أنماط الإملاء أو النطق في جلسة القراءة الصامتة؛ احتُسب زمن إتمام النص وأسئلة الفهم فقط.'
      : 'مخرجات محاذاة القراءة الجهرية معتمدة بالذكاء الاصطناعي وفق التحليل الصوتي المباشر للكلمات. تمثل هذه المؤشرات أداء الجلسة ولا تمثل تشخيصاً طبياً.' + oralText,
    dyscalculiaSpatialAnalysis: !isMathTested
      ? 'لم تُنفّذ مهام الحساب في هذه الجلسة؛ لا توجد نتائج حسابية أو درجة خطر. يمكن إجراء الأنشطة الحسابية الوصفية عند الحاجة.'
      : 'مقاييس وصفية للمهام المنفذة: فارق موقع خط الأعداد ' + params.numberLinePAE +
        '%، ودقة تمييز الكميات ' + (params.subitizingAccuracy === null ? 'غير متاحة' : params.subitizingAccuracy) +
        '%، وأخطاء ترتيب رموز العدد ' + (params.reversalErrorCount === null ? 'غير متاحة' : params.reversalErrorCount) +
        '. لا تُحوّل هذه القيم من عدد قليل من المحاولات إلى درجة خطر أو تشخيص لعسر الحساب.',
    interventionExercises: exercises,
    classroomAccommodations: accommodations,
  };
}
// ============================================================================
// Server-Side Plausibility & Evidence Derivation for Reading + Math Sessions
// ============================================================================

const FORBIDDEN_CLIENT_SCORE_FIELDS = new Set([
  'tenantId',
  'dyslexiaRiskScore',
  'readingHeuristicIndicator',
  'readingRiskLevel',
  'readingRiskLabelAr',
  'dyscalculiaRiskScore',
  'mathHeuristicIndicator',
  'mathRiskLevel',
  'mathRiskLabelAr',
  'assessmentHistory',
  'evidenceProvenance',
  'evidenceProvenanceLabelAr',
]);

export interface DerivedSessionEvidenceResult {
  valid: boolean;
  statusCode?: 400 | 422;
  errorAr?: string;
  rejectedFields?: string[];
  derivedFields?: {
    passageId: string;
    readingDurationSeconds: number;
    comprehensionAnswers: number[];
    comprehensionScore: number;
    dialectCode?: 'msa' | 'gulf' | 'egyptian' | 'levantine' | 'maghrebi';
    dialectRegionAr: string;
    wpm: number;
    calibrationAccuracyPercent?: number;
    oralReadingAssessed: boolean;
    spokenTranscript: string;
    wcpm?: number | null;
    oralWcpm: number | null;
    oralAccuracyPercent: number | null;
    oralWerPercent: number | null;
    teacherVerified?: boolean;
    aiAssessmentVerified?: boolean;
    aiAssessmentSource?: 'azure_pronunciation_assessment';
    teacherVerificationTimestamp?: string;
    teacherVerifierId?: string;
    teacherVerifierName?: string;
    teacherVerifierRole?: string;
    teacherWordOverridesCount?: number;
    verifiedWordsAlignment?: Array<{
      word: string;
      status: 'correct' | 'dialect_variant' | 'phonetic_substitution' | 'omitted';
    }>;
    phoneticSubstitutionCount: number;
    dialectVariantCount: number;
    omissionCount: number;
    dyslexiaRiskScore: number | null;
    readingHeuristicIndicator: number | null;
    readingRiskLevel: 'nominal' | 'moderate' | 'high' | 'unassessed';
    readingRiskLabelAr: string;
    problematicWords: string[];
    assessmentModality?: 'voice_only' | 'reading_only';
    dyscalculiaAssessed: boolean;
    mathTrials?: StudentMathTrialsPayload;
    subitizingAccuracy: number | null;
    avgSubitizingMs: number | null;
    numberLinePAE: number | null;
    transcodingAccuracy: number | null;
    reversalErrorCount: number | null;
    dyscalculiaRiskScore: number | null;
    mathHeuristicIndicator: number | null;
    mathRiskLevel: 'nominal' | 'moderate' | 'high' | 'unassessed';
    mathRiskLabelAr: string;
    evidenceProvenance: 'client-reported' | 'server-verified-audio';
    evidenceProvenanceLabelAr: string;
    learningReport: LearningReport;
  };
}

export interface SessionReviewerContext {
  sessionId: string;
  role: BaseeraRole;
  accountName: string;
}

export function validateAndDeriveSessionFromEvidence(
  rawBody: Record<string, unknown>,
  studentMeta: { name: string; gradeLevel: number },
  reviewer?: SessionReviewerContext,
  automatedAudioAssessment?: VerifiedAutomatedAudioAssessment
): DerivedSessionEvidenceResult {
  // 1. Reject any attempt by the client to supply derived risk scores, levels, or tenantId
  const forbiddenPresent = Object.keys(rawBody).filter((k) =>
    FORBIDDEN_CLIENT_SCORE_FIELDS.has(k)
  );
  if (forbiddenPresent.length > 0) {
    return {
      valid: false,
      statusCode: 400,
      errorAr:
        'لا يُسمح للعميل بإرسال الدرجات أو مستويات الخطورة أو معرّف المدرسة؛ يقوم الخادم باشتقاق جميع المؤشرات من أدلة الجلسة.',
      rejectedFields: forbiddenPresent,
    };
  }

  const evidenceObj =
    rawBody.evidence &&
    typeof rawBody.evidence === 'object' &&
    !Array.isArray(rawBody.evidence)
      ? (rawBody.evidence as Record<string, unknown>)
      : rawBody;

  const passageId = String(
    evidenceObj.passageId ?? rawBody.passageId ?? ''
  ).trim();
  const passage = ARABIC_READING_PASSAGES.find((p) => p.id === passageId);
  if (!passage) {
    return {
      valid: false,
      statusCode: 400,
      errorAr: 'معرّف نص القراءة (passageId) غير موجود في النصوص المعتمدة.',
    };
  }

  const rawModality = String(evidenceObj.assessmentModality ?? rawBody.assessmentModality ?? '').trim();
  const legacyEyeFields = [
    'calibrationAccuracyPercent', 'calibrationValidationMethod',
    'gazeCoveragePercent', 'observedWordCount', 'totalPassageWordCount',
    'avgFixationMs', 'regressionRate', 'regressionCount', 'blinkCount',
    'blinksPerMinute', 'visualStrainLabelAr', 'fixations',
  ];
  const hasLegacyEyeMetrics = legacyEyeFields.some((key) =>
    Object.prototype.hasOwnProperty.call(evidenceObj, key) ||
    Object.prototype.hasOwnProperty.call(rawBody, key)
  );
  if (
    rawModality === 'eye_voice' ||
    (rawModality !== '' && rawModality !== 'voice_only' && rawModality !== 'reading_only') ||
    hasLegacyEyeMetrics
  ) {
    return {
      valid: false,
      statusCode: 400,
      errorAr: 'الكاميرا وتتبع العين غير مدعومين في الإصدار الحالي. أرسل بيانات القراءة والفهم، أو القراءة الجهرية الاختيارية فقط.',
    };
  }
  const assessmentModality: 'voice_only' | 'reading_only' =
    rawModality === 'voice_only' ? 'voice_only' : 'reading_only';
  const isVoiceOnlyModality = assessmentModality === 'voice_only';
  
  // Camera and eye-tracking metrics are not part of the product or accepted session evidence.

  // 4. Reading Duration & Total Fixation Sum Plausibility Check
  const rawDuration =
    evidenceObj.readingDurationSeconds ?? rawBody.readingDurationSeconds;
  const readingDurationSeconds = Number(rawDuration);
  if (
    !Number.isFinite(readingDurationSeconds) ||
    readingDurationSeconds < 4 ||
    readingDurationSeconds > 1800
  ) {
    return {
      valid: false,
      statusCode: 400,
      errorAr:
        'مدة القراءة الفعلية (readingDurationSeconds) مطلوبة ويجب أن تكون بين 4 و1800 ثانية.',
    };
  }

  // Abuse/plausibility ceiling, not an educational norm: reject implausible reported pace.
  const wordCountForPace = passage.words.length;
  const observedReadingWpm = (wordCountForPace * 60) / readingDurationSeconds;
  if (observedReadingWpm > 300) {
    return {
      valid: false,
      statusCode: 400,
      errorAr: `سرعة القراءة المستنتجة (${Math.round(observedReadingWpm)} كلمة/دقيقة) تتجاوز حد المعقولية التقني (300 كلمة/دقيقة).`,
    };
  }

  // 6. Comprehension Answers Validation & Score Derivation
  const rawCompAnswers =
    evidenceObj.comprehensionAnswers ?? rawBody.comprehensionAnswers;
  if (
    !Array.isArray(rawCompAnswers) ||
    rawCompAnswers.length !== passage.comprehensionQuestions.length
  ) {
    return {
      valid: false,
      statusCode: 400,
      errorAr: `يجب إرسال إجابات أسئلة الفهم القرائي (${passage.comprehensionQuestions.length} إجابات) لاشتقاق درجة الفهم على الخادم.`,
    };
  }
  const comprehensionAnswers: number[] = [];
  let correctCompCount = 0;
  for (let i = 0; i < passage.comprehensionQuestions.length; i++) {
    const ans = Number(rawCompAnswers[i]);
    const maxOpt = passage.comprehensionQuestions[i].options.length - 1;
    if (!Number.isInteger(ans) || ans < 0 || ans > maxOpt) {
      return {
        valid: false,
        statusCode: 400,
        errorAr: `إجابة سؤال الفهم رقم ${i + 1} خارج نطاق الخيارات المتاحة (0–${maxOpt}).`,
      };
    }
    comprehensionAnswers.push(ans);
    if (ans === passage.comprehensionQuestions[i].correctIndex) {
      correctCompCount += 1;
    }
  }
  const comprehensionScore = Math.round(
    (correctCompCount / passage.comprehensionQuestions.length) * 100
  );

  // 7. Optional Oral Reading Alignment Derivation & Teacher Verification
  const rawDialectCode = (evidenceObj.dialectCode ?? rawBody.dialectCode ?? rawBody.dialect) as ArabicDialectCode | undefined;
  const dialectProfile =
    ARABIC_DIALECT_PROFILES.find(
      (d) =>
        (rawDialectCode && d.code === rawDialectCode) ||
        (typeof evidenceObj.dialectRegionAr === 'string' && d.labelAr === evidenceObj.dialectRegionAr) ||
        (typeof rawBody.dialectRegionAr === 'string' && d.labelAr === rawBody.dialectRegionAr)
    ) || ARABIC_DIALECT_PROFILES[1];

  const dialectRegionAr = dialectProfile.labelAr;

  const transcriptInput = automatedAudioAssessment?.transcript ??
    (evidenceObj.spokenTranscript ?? rawBody.spokenTranscript);
  const spokenTranscript =
    typeof transcriptInput === 'string'
      ? transcriptInput.trim().slice(0, 4000)
      : '';

  // Legacy human attestations remain distinct from automated assessment provenance.
  const requestedTeacherVerification = Boolean(rawBody.teacherVerified || evidenceObj.teacherVerified);
  const isTeacherVerified = requestedTeacherVerification && reviewer?.role === 'school_admin';
  const rawVerifiedWords = rawBody.verifiedWordsAlignment ?? evidenceObj.verifiedWordsAlignment;

  let validatedTeacherAlignment: Array<{
    word: string;
    status: 'correct' | 'dialect_variant' | 'phonetic_substitution' | 'omitted';
  }> | undefined = undefined;

  let teacherCorrectWordsCount = 0;
  let teacherDialectVariantCount = 0;
  let teacherSubstitutionCount = 0;
  let teacherOmissionCount = 0;
  let teacherWcpm: number | null = null;
  let teacherAccuracyPercent: number | null = null;

  if (isTeacherVerified) {
    if (!Array.isArray(rawVerifiedWords) || rawVerifiedWords.length !== passage.words.length) {
      return {
        valid: false,
        statusCode: 400,
        errorAr: `مصفوفة تدقيق الكلمات غير صالحة؛ يجب أن تحتوي على ${passage.words.length} كلمة مطابقة للنص المرجعي.`,
      };
    }

    const validStatuses = new Set(['correct', 'dialect_variant', 'phonetic_substitution', 'omitted']);
    for (let i = 0; i < passage.words.length; i++) {
      const item = rawVerifiedWords[i] as any;
      if (!item || typeof item !== 'object' || item.word !== passage.words[i] || !validStatuses.has(item.status)) {
        return {
          valid: false,
          statusCode: 400,
          errorAr: `كلمة القراءة عند الفهرس ${i} غير متطابقة مع النص المرجعي (${passage.words[i]}) أو حالتها غير صالحة.`,
        };
      }
      if (item.status === 'correct') teacherCorrectWordsCount++;
      else if (item.status === 'dialect_variant') teacherDialectVariantCount++;
      else if (item.status === 'phonetic_substitution') teacherSubstitutionCount++;
      else if (item.status === 'omitted') teacherOmissionCount++;
    }

    validatedTeacherAlignment = rawVerifiedWords as Array<{
      word: string;
      status: 'correct' | 'dialect_variant' | 'phonetic_substitution' | 'omitted';
    }>;

    const effectiveTeacherWords = teacherCorrectWordsCount + teacherDialectVariantCount;
    const durationMin = Math.max(0.05, readingDurationSeconds / 60);
    teacherWcpm = Math.min(220, Math.max(0, Math.round(effectiveTeacherWords / durationMin)));
    teacherAccuracyPercent = Math.min(100, Math.max(0, Math.round((effectiveTeacherWords / passage.words.length) * 100)));
  }

  // A receipt is validated by the server route and its contents are checked again here.
  // Browser-submitted scores/transcripts alone never qualify as an automated assessment.
  let validatedAiAlignment: Array<{
    word: string;
    status: 'correct' | 'dialect_variant' | 'phonetic_substitution' | 'omitted';
    spokenWord?: string | null;
  }> | undefined;
  let isAiAssessmentVerified = false;
  if (automatedAudioAssessment) {
    const assessment = automatedAudioAssessment;
    const validAiStatuses = new Set(['None', 'Omission', 'Mispronunciation', 'Substitution', 'DialectVariant']);
    const validMetrics = (value: number | null) =>
      value === null || (Number.isFinite(value) && value >= 0 && value <= 300);
    const structureValid =
      assessment.sourceModel === 'azure_pronunciation_assessment' &&
      assessment.assessmentComplete === true &&
      assessment.passageId === passage.id &&
      typeof assessment.transcript === 'string' &&
      assessment.transcript.trim().length > 0 &&
      assessment.transcript.length <= 4000 &&
      Number.isFinite(assessment.durationSeconds) &&
      assessment.durationSeconds >= 1 &&
      assessment.durationSeconds <= 600 &&
      Math.abs(assessment.durationSeconds - readingDurationSeconds) <= 3 &&
      Array.isArray(assessment.words) &&
      assessment.words.length === passage.words.length &&
      assessment.words.every((item, index) =>
        item && typeof item === 'object' &&
        item.word === passage.words[index] &&
        validAiStatuses.has(item.errorType) &&
        (item.accuracyScore === null || (Number.isFinite(item.accuracyScore) && item.accuracyScore >= 0 && item.accuracyScore <= 100)) &&
        (item.spokenWord === null || typeof item.spokenWord === 'string')
      ) &&
      validMetrics(assessment.wordsCorrectPerMinute) &&
      validMetrics(assessment.wordsPerMinute) &&
      (assessment.wordAccuracyPercent === null ||
        (Number.isFinite(assessment.wordAccuracyPercent) && assessment.wordAccuracyPercent >= 0 && assessment.wordAccuracyPercent <= 100));
    if (!structureValid) {
      return {
        valid: false,
        statusCode: 400,
        errorAr: 'نتيجة التقييم الصوتي الآلي غير متطابقة مع النص أو مدة الجلسة؛ لم تُحفظ مؤشرات النطق.',
      };
    }
    isAiAssessmentVerified = true;
    validatedAiAlignment = assessment.words.map((item) => ({
      word: item.word,
      status: item.errorType === 'None' ? 'correct' as const
        : item.errorType === 'DialectVariant' ? 'dialect_variant' as const
          : item.errorType === 'Omission' ? 'omitted' as const
            : 'phonetic_substitution' as const,
      spokenWord: item.spokenWord,
    }));
  }

  const oralReadingAssessed = isTeacherVerified || isAiAssessmentVerified;

  // Only server-returned, word-level acoustic assessment or a separate explicit reviewer
  // alignment can create oral metrics. The browser ASR preview is never scored here.
  const oralMetrics =
    isTeacherVerified && spokenTranscript.length > 0
      ? evaluateOralReadingAlignment(
          passage.words,
          spokenTranscript,
          Math.max(6, readingDurationSeconds),
          0,
          dialectProfile.code
        )
      : null;

  const aiAssessment = isAiAssessmentVerified ? automatedAudioAssessment : undefined;
  const aiDialectCount = validatedAiAlignment?.filter(item => item.status === 'dialect_variant').length ?? 0;
  const aiSubstitutionCount = validatedAiAlignment?.filter(item => item.status === 'phonetic_substitution').length ?? 0;
  const aiOmissionCount = validatedAiAlignment?.filter(item => item.status === 'omitted').length ?? 0;
  const rawOralWcpm = isAiAssessmentVerified
    ? aiAssessment?.wordsCorrectPerMinute
    : isTeacherVerified ? teacherWcpm : (oralMetrics?.wcpm ?? null);
  const rawOralAccuracy = isAiAssessmentVerified
    ? aiAssessment?.wordAccuracyPercent
    : isTeacherVerified ? teacherAccuracyPercent : (oralMetrics?.accuracyPercent ?? null);
  const rawOralWer = oralMetrics ? oralMetrics.werPercent : null;

  const oralIntegration: OralReadingIntegrationInput | null =
    oralReadingAssessed
      ? {
          assessed: true,
          wcpm: typeof rawOralWcpm === 'number' ? rawOralWcpm : undefined,
          accuracyPercent: typeof rawOralAccuracy === 'number' ? rawOralAccuracy : null,
          werPercent: rawOralWer,
          phoneticSubstitutionCount: isAiAssessmentVerified
            ? aiSubstitutionCount
            : isTeacherVerified ? teacherSubstitutionCount : (oralMetrics?.phoneticSubstitutionCount ?? 0),
          dialectVariantCount: isAiAssessmentVerified
            ? aiDialectCount
            : isTeacherVerified ? teacherDialectVariantCount : (oralMetrics?.dialectVariantCount ?? 0),
          omissionCount: isAiAssessmentVerified
            ? aiOmissionCount
            : isTeacherVerified ? teacherOmissionCount : (oralMetrics?.omittedWordsCount ?? 0),
          misreadWords: isAiAssessmentVerified && validatedAiAlignment
            ? validatedAiAlignment
                .filter(a => a.status === 'phonetic_substitution' || a.status === 'omitted')
                .map(a => a.spokenWord ? `${a.word} (نُطقت: ${a.spokenWord})` : a.word)
            : isTeacherVerified && validatedTeacherAlignment
              ? validatedTeacherAlignment
                  .filter(a => a.status === 'phonetic_substitution' || a.status === 'omitted')
                  .map(a => a.word)
              : (oralMetrics?.alignment
                  .filter((a) => a.status === 'phonetic_substitution' || a.status === 'omitted')
                  .map((a) => a.spokenWord ? `${a.targetWord} (نُطقت: ${a.spokenWord})` : a.targetWord) || []),
        }
      : null;

  // 9. Optional Math Trials Validation & Derivation
  const rawMathTrials = evidenceObj.mathTrials ?? rawBody.mathTrials ?? null;
  let dyscalculiaAssessed = false;
  let mathTrials: StudentMathTrialsPayload | undefined;
  let subitizingAccuracy: number | null = null;
  let avgSubitizingMs: number | null = null;
  let numberLinePAE: number | null = null;
  let transcodingAccuracy: number | null = null;
  let reversalErrorCount: number | null = null;
  let dyscalculiaRiskScore: number | null = null;
  let mathHeuristicIndicator: number | null = null;
  let mathRiskLevel: 'nominal' | 'moderate' | 'high' | 'unassessed' =
    'unassessed';
  let mathRiskLabelAr = 'لم يُجرَ اختبار الحساب بعد';

  if (rawMathTrials !== null && rawMathTrials !== undefined) {
    const mathValidation = validateAndDeriveMathTrials(rawMathTrials);
    if (!mathValidation.valid || !mathValidation.metrics) {
      return {
        valid: false,
        statusCode: 400,
        errorAr: mathValidation.errorAr || 'بيانات مهام الحساب غير صالحة.',
      };
    }
    dyscalculiaAssessed = true;
    mathTrials = mathValidation.trials;
    subitizingAccuracy = mathValidation.metrics.subitizingAccuracy;
    avgSubitizingMs = mathValidation.metrics.avgSubitizingMs;
    numberLinePAE = mathValidation.metrics.numberLinePAE;
    transcodingAccuracy = mathValidation.metrics.transcodingAccuracy;
    reversalErrorCount = mathValidation.metrics.reversalErrorCount;
    dyscalculiaRiskScore = mathValidation.metrics.dyscalculiaRiskScore;
    mathHeuristicIndicator = mathValidation.metrics.heuristicIndicator;
    mathRiskLevel = mathValidation.metrics.riskLevel;
    mathRiskLabelAr = mathValidation.metrics.riskLabelAr;
  }

  // Derive WPM strictly according to measured evidence:
  // For oral reading: rate of words actually attempted/spoken by the child
  // For silent reading: rate of completing the reference passage
  let derivedWpm = 0;
  if (isAiAssessmentVerified && automatedAudioAssessment?.wordsPerMinute !== null && automatedAudioAssessment?.wordsPerMinute !== undefined) {
    derivedWpm = Math.min(300, Math.max(0, Math.round(automatedAudioAssessment.wordsPerMinute)));
  } else if (isTeacherVerified && validatedTeacherAlignment) {
    const durationMin = Math.max(0.05, readingDurationSeconds / 60);
    const attemptedWords = teacherCorrectWordsCount + teacherDialectVariantCount + teacherSubstitutionCount;
    derivedWpm = Math.round((attemptedWords / durationMin));
  } else if (isVoiceOnlyModality) {
    // Keep zero only as the stored numeric sentinel; reports must display this as unavailable without evidence.
    derivedWpm = 0;
  } else {
    derivedWpm = Math.round((passage.words.length / readingDurationSeconds) * 60);
  }

  // No reading mode in this prototype has validated diagnostic cutoffs for Arabic children.
  // Preserve measured speed, transcript alignment, and comprehension separately; never derive a risk score from them.
  const derivedDyslexiaRiskScore: number | null = null;
  const derivedReadingHeuristic: number | null = null;
  const derivedReadingRiskLevel: 'unassessed' = 'unassessed';
  const derivedReadingRiskLabelAr = isAiAssessmentVerified
    ? 'قُيّمت القراءة الجهرية آليًا من التسجيل الصوتي؛ المؤشرات وصفية ولا تشخّص عسر القراءة.'
    : isTeacherVerified
      ? 'الطلاقة الشفوية راجعها مراجع مخوّل؛ لا توجد درجة خطر معيارية.'
      : 'جلسة قراءة وفهم وصفية؛ لم تُحتسب درجة خطر معيارية.';

  const learningReport = buildDeterministicLearningReport({
    studentName: studentMeta.name,
    gradeLevel: studentMeta.gradeLevel,
    dialectLabelAr: dialectRegionAr,
    totalPassageWordCount: passage.words.length,
    wpm: derivedWpm,
    comprehensionScore,
    problematicWords: oralIntegration?.misreadWords || [],
    oralReadingAssessed,
    oralAccuracyPercent: oralIntegration?.accuracyPercent ?? null,
    phoneticSubstitutionCount: oralIntegration?.phoneticSubstitutionCount ?? 0,
    dialectVariantCount: oralIntegration?.dialectVariantCount ?? 0,
    assessmentModality,
    dyscalculiaAssessed,
    numberLinePAE,
    subitizingAccuracy,
    reversalErrorCount,
  });

  return {
    valid: true,
    derivedFields: {
      assessmentModality,
      passageId: passage.id,
      readingDurationSeconds,
      comprehensionAnswers,
      comprehensionScore,
      dialectCode: dialectProfile.code,
      dialectRegionAr,
      wpm: derivedWpm,
      oralReadingAssessed,
      spokenTranscript: oralReadingAssessed ? spokenTranscript : '',
      wcpm: oralIntegration?.wcpm ?? null,
      oralWcpm: oralIntegration?.wcpm ?? null,
      oralAccuracyPercent: oralIntegration?.accuracyPercent ?? null,
      oralWerPercent: oralIntegration?.werPercent ?? null,
      teacherVerified: isTeacherVerified,
      teacherVerificationTimestamp: isTeacherVerified ? new Date().toISOString() : undefined,
      teacherVerifierId: isTeacherVerified ? reviewer?.sessionId : undefined,
      teacherVerifierName: isTeacherVerified ? reviewer?.accountName : undefined,
      teacherVerifierRole: isTeacherVerified ? 'مراجع مخوّل عبر حساب المدرسة' : undefined,
      teacherWordOverridesCount:
        typeof (rawBody.teacherWordOverridesCount ?? evidenceObj.teacherWordOverridesCount) === 'number'
          ? Number(rawBody.teacherWordOverridesCount ?? evidenceObj.teacherWordOverridesCount)
          : (isTeacherVerified ? 0 : undefined),
      aiAssessmentVerified: isAiAssessmentVerified,
      aiAssessmentSource: isAiAssessmentVerified ? 'azure_pronunciation_assessment' : undefined,
      verifiedWordsAlignment: validatedTeacherAlignment ?? validatedAiAlignment,
      phoneticSubstitutionCount:
        oralIntegration?.phoneticSubstitutionCount ?? 0,
      dialectVariantCount: oralIntegration?.dialectVariantCount ?? 0,
      omissionCount: oralIntegration?.omissionCount ?? 0,
      dyslexiaRiskScore: derivedDyslexiaRiskScore,
      readingHeuristicIndicator: derivedReadingHeuristic,
      readingRiskLevel: derivedReadingRiskLevel,
      readingRiskLabelAr: derivedReadingRiskLabelAr,
      problematicWords: oralIntegration?.misreadWords || [],
      dyscalculiaAssessed,
      mathTrials,
      subitizingAccuracy,
      avgSubitizingMs,
      numberLinePAE,
      transcodingAccuracy,
      reversalErrorCount,
      dyscalculiaRiskScore,
      mathHeuristicIndicator,
      mathRiskLevel,
      mathRiskLabelAr,
      evidenceProvenance: isAiAssessmentVerified ? 'server-verified-audio' : 'client-reported',
      evidenceProvenanceLabelAr: isAiAssessmentVerified
        ? 'نتيجة نطق مشتقة على الخادم من التسجيل الصوتي ومحرك Azure؛ لا تمثل تشخيصًا.'
        : 'أدلة مُبلَّغ بها من العميل (اجتازت فحوص المعقولية الحسابية)',
      learningReport,
    },
  };
}
