import crypto from 'crypto';
import { z } from 'zod';
import {
  ARABIC_READING_PASSAGES,
  ClinicalReport,
  StudentMathTrialsPayload,
} from '../data/seedData';
import {
  WordFixation,
  OralReadingIntegrationInput,
  SubitizingTrialResult,
  NumberLineTrialResult,
  TranscodingTrialResult,
  calculateEyeTrackingMetrics,
  calculateDyscalculiaMetrics,
} from './clinicalMetrics';
import {
  ARABIC_DIALECT_PROFILES,
  ArabicDialectCode,
  evaluateOralReadingAlignment,
} from './dyslexiaEngines';

export type ClinicalRole = 'clinician' | 'educator_readonly';

export type ClinicalScope =
  | 'students:read'
  | 'students:write'
  | 'students:delete'
  | 'ai:analyze'
  | 'audit:read';

export interface VerifiedClinicalSession {
  token: string;
  role: ClinicalRole;
  clinicianName: string;
  /** Tenant identity is part of the signed token and cannot be supplied by the browser. */
  tenantId: string;
  /** Human-readable Arabic school name for UI display instead of raw internal tenantId. */
  tenantDisplayNameAr: string;
  /** Unique server-recognized session ID used for logout revocation. */
  sessionId: string;
  scopes: ClinicalScope[];
  issuedAt: number;
  expiresAt: number;
}

const ROLE_SCOPES: Record<ClinicalRole, ClinicalScope[]> = {
  clinician: [
    'students:read',
    'students:write',
    'students:delete',
    'ai:analyze',
    'audit:read',
  ],
  educator_readonly: ['students:read'],
};

const TENANT_DISPLAY_NAME_MAP: Record<string, string> = {
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

export function getScopesForRole(role: ClinicalRole): ClinicalScope[] {
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

/**
 * Strictly normalizes calibrationValidationMethod without ever defaulting unknown strings to 'leave-one-point-out'.
 */
export function normalizeCalibrationValidationMethod(
  rawMethod: unknown,
  isManualOrNoCamera = false
): {
  code:
    | 'independent-holdout'
    | 'leave-one-point-out'
    | 'single-point-unvalidated';
  labelAr: string;
  isValidated: boolean;
} {
  if (isManualOrNoCamera) {
    return {
      code: 'single-point-unvalidated',
      labelAr:
        'وضع محاكاة يدوية بالماوس (بدون كاميرا — لا توجد بيانات نظر من الكاميرا)',
      isValidated: false,
    };
  }
  if (typeof rawMethod === 'string') {
    const trimmed = rawMethod.trim();
    if (
      trimmed === 'independent-holdout' ||
      trimmed === 'تحقق مستقل (Independent Holdout)'
    ) {
      return {
        code: 'independent-holdout',
        labelAr: 'تحقق مستقل (Independent Holdout)',
        isValidated: true,
      };
    }
    if (
      trimmed === 'leave-one-point-out' ||
      trimmed === 'تحقق متقاطع (Leave-One-Point-Out CV)'
    ) {
      return {
        code: 'leave-one-point-out',
        labelAr: 'تحقق متقاطع (Leave-One-Point-Out CV)',
        isValidated: true,
      };
    }
  }
  return {
    code: 'single-point-unvalidated',
    labelAr: 'غير مُتحقَّق منه (معايرة غير مكتملة أو طريقة غير معروفة)',
    isValidated: false,
  };
}

/**
 * Issues a cryptographically signed HMAC-SHA256 session token for an authenticated clinician or educator.
 */
export function issueClinicalSessionToken(
  role: ClinicalRole,
  clinicianName: string,
  secret: string,
  ttlMs: number = 60 * 60 * 1000,
  tenantId = 'default',
  customTenantDisplayNameAr?: string
): VerifiedClinicalSession {
  if (role !== 'clinician' && role !== 'educator_readonly') {
    throw new Error('Invalid clinical role');
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
    clinicianName: clinicianName.trim() || 'أخصائي التقييم',
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
    clinicianName: payloadObj.clinicianName,
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
export function verifyClinicalSessionToken(
  rawToken: string | undefined | null,
  secret: string,
  nowMs: number = Date.now()
): VerifiedClinicalSession | null {
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
      (parsed.role !== 'clinician' && parsed.role !== 'educator_readonly') ||
      typeof parsed.tenantId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(parsed.tenantId) ||
      typeof parsed.sessionId !== 'string' ||
      !/^[a-f0-9]{32}$/.test(parsed.sessionId) ||
      typeof parsed.issuedAt !== 'number' ||
      !Array.isArray(parsed.scopes) ||
      parsed.scopes.some(
        (scope: unknown) =>
          !ROLE_SCOPES[parsed.role as ClinicalRole].includes(
            scope as ClinicalScope
          )
      )
    )
      return null;
    // Re-derive scopes from the role rather than trusting mutable claims in a signed token.
    const scopes = getScopesForRole(parsed.role as ClinicalRole);
    const tenantDisplayNameAr = formatTenantDisplayNameAr(
      parsed.tenantId,
      typeof parsed.tenantDisplayNameAr === 'string'
        ? parsed.tenantDisplayNameAr
        : undefined
    );
    return {
      token: trimmed,
      role: parsed.role,
      clinicianName:
        typeof parsed.clinicianName === 'string'
          ? parsed.clinicianName
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
  session: VerifiedClinicalSession | null,
  requiredScope: ClinicalScope
): { allowed: boolean; statusCode: 200 | 401 | 403; errorAr?: string } {
  if (!session) {
    return {
      allowed: false,
      statusCode: 401,
      errorAr:
        'غير مصرح بالوصول (401): يلزم تقديم رمز جلسة أخصائي/معلم صالح للوصول إلى سجلات الأطفال.',
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
export function isStrongClinicalAccessCode(value: unknown): value is string {
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
// Strict Zod Schemas for Profile PATCH, Clinical Report Update, and Evidence
// ============================================================================

/**
 * Strict 4-field student profile PATCH schema:
 * Accepts ONLY `name`, `schoolName`, `gradeLevel`, `ageYears`.
 * Rejects derived scores (`dyslexiaRiskScore`, `readingRiskLevel`), `tenantId`, `clinicalReport`, consent, and history.
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
 * Strict schema for saving an updated clinical report (`PUT /api/students/:id/report`).
 * Requires non-empty exercises and accommodations so saved reports never render blank sections.
 */
export const ClinicalReportSchema = z
  .object({
    clinicalSummary: z.string().trim().min(10).max(5000),
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

export const ClinicalReportUpdateEnvelopeSchema = z
  .object({
    clinicalReport: ClinicalReportSchema,
  })
  .strict();

// Fixed Math Trial Specifications (4 Subitizing + 2 Number Line + 3 Transcoding)
const ALLOWED_SUBITIZING_TARGETS = [1, 2, 3, 4] as const;
const ALLOWED_SUBITIZING_OPTIONS = new Set([1, 2, 3, 4]);

const ALLOWED_NUMBER_LINE_SPEC: Record<
  number,
  { scaleMin: number; scaleMax: number }
> = {
  37: { scaleMin: 0, scaleMax: 100 },
  156: { scaleMin: 0, scaleMax: 200 },
};

const ALLOWED_TRANSCODING_SPEC: Record<
  number,
  { options: Set<number>; reversalDistractor: number }
> = {
  47: { options: new Set([47, 74, 49]), reversalDistractor: 74 },
  83: { options: new Set([38, 83, 63]), reversalDistractor: 38 },
  69: { options: new Set([69, 96, 66]), reversalDistractor: 96 },
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

  if (!Array.isArray(subRaw) || subRaw.length !== 4) {
    return {
      valid: false,
      errorAr:
        'يجب إرسال 4 محاولات ثابتة بالضبط لاختبار تمييز الكميات الفوري (الأهداف 1، 2، 3، 4).',
    };
  }
  if (!Array.isArray(nlRaw) || nlRaw.length !== 2) {
    return {
      valid: false,
      errorAr:
        'يجب إرسال محاولتين ثابتتين بالضبط لاختبار خط الأعداد (الهدف 37 على 0-100 والهدف 156 على 0-200).',
    };
  }
  if (!Array.isArray(trRaw) || trRaw.length !== 3) {
    return {
      valid: false,
      errorAr:
        'يجب إرسال 3 محاولات ثابتة بالضبط لاختبار ترميز الأرقام العربية (الأهداف 47، 83، 69).',
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
      !ALLOWED_SUBITIZING_TARGETS.includes(dotCount as 1 | 2 | 3 | 4) ||
      seenSubTargets.has(dotCount)
    ) {
      return {
        valid: false,
        errorAr: `هدف تمييز الكميات (${String(rec.dotCount)}) غير مسموح أو مكرر؛ الأهداف المعتمدة هي 1 و2 و3 و4 فقط.`,
      };
    }
    if (
      chosen !== undefined &&
      (!Number.isInteger(chosen) || !ALLOWED_SUBITIZING_OPTIONS.has(chosen))
    ) {
      return {
        valid: false,
        errorAr: `الخيار المختار في تمييز الكميات (${String(chosen)}) غير معروض ضمن الخيارات المسموحة (1-4).`,
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
        errorAr: `هدف خط الأعداد (${String(rec.target)}) مخترَع أو مكرر؛ الأهداف المعتمدة هي 37 و156 فقط.`,
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
        errorAr: `تقدير الطالب (${String(rec.userEstimate)}) خارج مدى خط الأعداد (${spec.scaleMin}–${spec.scaleMax}).`,
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
        errorAr: `هدف ترميز الأرقام (${String(rec.targetNumber)}) مخترَع أو مكرر؛ الأهداف المعتمدة هي 47 و83 و69 فقط.`,
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
 * Generates a complete, deterministic, rule-based ClinicalReport on the server
 * with NON-EMPTY `interventionExercises` and `classroomAccommodations` (Fixing Finding 1).
 */
export function buildDeterministicClinicalReport(params: {
  studentName: string;
  gradeLevel: number;
  dialectLabelAr: string;
  gazeCoveragePercent: number;
  observedWordCount: number;
  totalPassageWordCount: number;
  wpm: number;
  avgFixationMs: number;
  regressionRate: number;
  regressionCount: number;
  blinkCount: number;
  blinksPerMinute: number;
  visualStrainLabelAr: string;
  calibrationAccuracyPercent: number;
  calibrationValidationLabelAr: string;
  problematicWords: string[];
  oralReadingAssessed: boolean;
  oralAccuracyPercent: number | null;
  phoneticSubstitutionCount: number;
  dialectVariantCount: number;
  assessmentModality?: 'voice_only' | 'eye_voice' | 'reading_only';
    dyscalculiaAssessed: boolean;
  numberLinePAE: number | null;
  subitizingAccuracy: number | null;
  reversalErrorCount: number | null;
}): ClinicalReport {
  const highReadingRisk =
    params.avgFixationMs > 350 || params.regressionRate > 22;
  const isMathTested =
    params.dyscalculiaAssessed && typeof params.numberLinePAE === 'number';
  const highMathRisk =
    isMathTested &&
    ((params.numberLinePAE ?? 0) > 12 || (params.reversalErrorCount ?? 0) > 0);

  const oralText = params.oralReadingAssessed
    ? ` أظهر تحليل القراءة الجهرية (${params.dialectLabelAr}) دقة مطابقة فونولوجية ${params.oralAccuracyPercent ?? 0}% (إبدالات ديسلكسية: ${params.phoneticSubstitutionCount}، بدائل لهجية مقبولة: ${params.dialectVariantCount}).`
    : ' (لم يتم تفعيل تسجيل القراءة الجهرية بالميكروفون في هذه الجلسة).';

  const targetWordsSample =
    params.problematicWords.slice(0, 4).join('، ') ||
    'الكلمات متعددة المقاطع';

  const exercises: ClinicalReport['interventionExercises'] = [
    {
      title: 'تدريب التتبع الإيقاعي بالمقاطع الصوتية الملونة',
      durationMinutes: 10,
      description: `قراءة فقرات متدرجة مع تفعيل المسطرة البصرية وتقسيم الكلمات المستهدفة (${targetWordsSample}) إلى مقاطع صوتية ملونة لتخفيف عبء فك الترميز البصري.`,
    },
    {
      title: 'تمييز الحروف العربية المتشابهة رسماً ونقطياً',
      durationMinutes: 8,
      description:
        'تدريب بصري وفونولوجي سريع للتفريق بين الحروف المتجانسة (ب/ت/ث/ن، ج/ح/خ، د/ذ، ص/ض، ط/ظ) داخل جمل مشكّلة.',
    },
  ];

  if (isMathTested) {
    exercises.push({
      title: highMathRisk
        ? 'معايرة خط الأعداد الذهني وتثبيت خانتي الآحاد والعشرات'
        : 'تعزيز الطلاقة الكمية والتمثيل المكاني على خط الأعداد (0-200)',
      durationMinutes: 10,
      description: highMathRisk
        ? `تدريب ملموس لتقليص الانحراف المكاني على خط الأعداد (PAE الحالي ${params.numberLinePAE}%) ومعالجة عكس ترتيب الآحاد والعشرات (${params.reversalErrorCount ?? 0} أخطاء).`
        : `أنشطة إثرائية لربط الكميات النقطية السريعة (${params.subitizingAccuracy}%) بموقعها المكاني الدقيق على خط الأعداد.`,
    });
  } else {
    exercises.push({
      title: 'القراءة الجهرية الموجهة وتنمية الحصيلة المعجمية',
      durationMinutes: 10,
      description:
        'قراءة ثنائية مع المعلم أو ولي الأمر لرفع الطلاقة القرائية وتثبيت الربط بين الرسم الإملائي والنطق الصوتي.',
    });
  }

  const accommodations: string[] = [
    'استخدام خط عربي واضح وكبير (Readex Pro أو IBM Plex Sans Arabic بحجم 22–24px) مع تباعد أسطر 1.8 وخلفية كريمية دافئة لتقليل الإجهاد البصري.',
    'تزويد الطالب بالمسطرة البصرية (Reading Ruler) لعزل السطر المقروء ومنع القفز أو التراجع البصري بين الأسطر.',
  ];

  if (highMathRisk) {
    accommodations.push(
      'توفير خط أعداد مرئي وشبكة مربعات ملونة لتمييز خانة الآحاد عن العشرات أثناء حل المسائل الحسابية.'
    );
  } else {
    accommodations.push(
      'منح وقت إضافي بنسبة 25% عند قراءة النصوص الطويلة وتجزئة الأسئلة المركبة إلى خطوات قصيرة.'
    );
  }

  accommodations.push(
    'تنبيه منهجي وإخلاء مسؤولية: هذه المؤشرات مبنية على أدلة مُبلَّغ بها من العميل وقواعد فرز استدلالية (Heuristic Screening) ولا تُعد تشخيصاً طبياً أو إكلينيكياً نهائياً.'
  );

  const isReadingOnly = params.assessmentModality === 'reading_only';
  const isVoiceOnly = params.assessmentModality === 'voice_only';

  return {
    clinicalSummary: isReadingOnly
      ? `[مؤشر فرز قرائي وفهم استرشادي — أدلة مقاسة ومُبلَّغ بها] يُظهر التقييم المباشر للطالب (${params.studentName} · الصف ${params.gradeLevel}) سرعة قراءة تبلغ ${params.wpm} كلمة/دقيقة مع إجابة أسئلة الفهم القرائي للنص المعتمد (${params.totalPassageWordCount} كلمة).${oralText} تقع المؤشرات المقاسة ضمن النطاق الاسترشادي ويوصى بالمتابعة الصفية المعتادة.`
      : (isVoiceOnly
        ? `[مؤشر فرز قرائي صوتي استرشادي — أدلة مُبلَّغ بها من العميل] يُظهر التقييم الشفهي للطالب (${params.studentName} · الصف ${params.gradeLevel}) سرعة قراءة تبلغ ${params.wpm} كلمة/دقيقة.${oralText} تقع المؤشرات الصوتية ضمن النطاق الاسترشادي ويوصى بالمتابعة التربوية المعتادة.`
        : `[مؤشر فرز أولي استرشادي — أدلة مُبلَّغ بها من العميل] يُظهر الفحص البصري للطالب (${params.studentName} · الصف ${params.gradeLevel}) بتغطية رصد فعلية ${params.gazeCoveragePercent}% (${params.observedWordCount}/${params.totalPassageWordCount} كلمة) سرعة قراءة تبلغ ${params.wpm} كلمة/دقيقة مع متوسط تثبيت بصري قدره ${params.avgFixationMs} مللي ثانية ونسبة تراجع بصري ${params.regressionRate}% ومعدل رمش ${params.blinksPerMinute} رمشة/دقيقة (${params.visualStrainLabelAr}).${oralText} ${
            highReadingRisk
              ? 'تشير هذه المؤشرات الاسترشادية إلى جهد بصري مرتفع في فك الترميز الصوتي والصرفي للكلمات العربية متعددة المقاطع ويوصى بعرضها على أخصائي صعوبات تعلم معتمد.'
              : 'تقع مؤشرات الطلاقة القرائية وحركة العين المرصودة ضمن النطاق الاسترشادي الطبيعي المتوقع للمرحلة العمرية.'
          }`),
    ocularMotorAnalysis: isReadingOnly
      ? 'تم إجراء الجلسة بنمط القراءة المباشرة وحساب زمن الإنجاز وأسئلة الفهم دون كاميرا أو تتبع للعين، التزاماً بالمصداقية العلمية المباشرة وحماية لخصوصية الطفل.'
      : (isVoiceOnly
        ? 'تم إجراء الجلسة بنمط القراءة الجهرية الشفهية فقط دون تفعيل تتبع بؤبؤ العين بالكاميرا، وبالتالي لم تُسجل بيانات التثبيت أو القفزات التراجعية البصرية (Regressions).'
        : `سُجلت بيانات التثبيت البصري على ${params.observedWordCount} كلمة بمتوسط زمن تثبيت ${params.avgFixationMs}ms مقارنة بالمعيار الاسترشادي (220-260ms)، مع نسبة قفزات تراجعية (Regressions) بلغت ${params.regressionRate}% (${params.regressionCount} قفزة تراجعية)، وإجمالي ${params.blinkCount} رمشة عين (${params.blinksPerMinute} رمشة/دقيقة · دقة معايرة ${params.calibrationAccuracyPercent}% · ${params.calibrationValidationLabelAr}). ${
            params.problematicWords.length > 0
              ? `تركزت أطول فترات التوقف البصري أو التعثر النطقي عند الكلمات: (${params.problematicWords.join('، ')}) مما يعكس حاجة العين لإعادة المسح البصري للتمييز بين الحروف المتشابهة رسماً.`
              : 'انتقلت العين بسلاسة من اليمين إلى اليسار عبر الكلمات المرصودة دون تراجعات غير اعتيادية.'
          }`),
    orthographicAndPhonologicalPatterns: `${
      highReadingRisk
        ? 'يُلاحظ تأنٍّ في معالجة الكلمات التي تشتمل على حروف متجانسة نقطياً (ب/ت/ث، ج/ح/خ) والمقاطع المشددة أو المتصلة بضمائر، مما يستدعي تفعيل التقطيع المقطعي الملون.'
        : 'قدرة متوازنة على الربط بين الرسم الإملائي والتمثيل الصوتي للمقاطع العربية المشكّلة.'
    }${oralText}`,
    dyscalculiaSpatialAnalysis: !isMathTested
      ? 'لم يخضع الطالب لاختبار عسر الحساب (الديسكالكوليا) في هذه الجلسة بعد — لا يقوم النظام بتسجيل درجات حسابية افتراضية قبل إتمام المحطات الثلاث في تبويب «مهام الحساب».'
      : highMathRisk
        ? `بلغ معدل الخطأ المطلق المطبّع في خط الأعداد (PAE) ${params.numberLinePAE}% مع دقة إدراك كمي فوري ${params.subitizingAccuracy}% ورصد ${params.reversalErrorCount ?? 0} أخطاء في ترتيب الآحاد والعشرات، مما يدل على حاجة لتدريب الحس المكاني للأعداد.`
        : `أداء متوازن في الإدراك الكمي الفوري (${params.subitizingAccuracy}%) وتمثيل خط الأعداد الذهني بنسبة خطأ منخفضة (${params.numberLinePAE}%).`,
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
    avgFixationMs: number;
    regressionRate: number;
    regressionCount: number;
    blinkCount: number;
    blinksPerMinute: number;
    visualStrainLevel: 'nominal' | 'moderate' | 'high' | 'severe';
    visualStrainLabelAr: string;
    gazeCoveragePercent: number;
    observedWordCount: number;
    totalPassageWordCount: number;
    calibrationAccuracyPercent?: number;
    calibrationValidationMethod: string;
    oralReadingAssessed: boolean;
    spokenTranscript: string;
    wcpm?: number | null;
    oralWcpm: number | null;
    oralAccuracyPercent: number | null;
    oralWerPercent: number | null;
    teacherVerified?: boolean;
    teacherVerificationTimestamp?: string;
    teacherVerifierRole?: string;
    teacherWordOverridesCount?: number;
    verifiedWordsAlignment?: Array<{
      word: string;
      status: 'correct' | 'dialect_variant' | 'phonetic_substitution' | 'omitted';
    }>;
    phoneticSubstitutionCount: number;
    dialectVariantCount: number;
    omissionCount: number;
    dyslexiaRiskScore: number;
    readingHeuristicIndicator: number;
    readingRiskLevel: 'nominal' | 'moderate' | 'high';
    readingRiskLabelAr: string;
    problematicWords: string[];
    fixations: WordFixation[];
    assessmentModality?: 'voice_only' | 'eye_voice' | 'reading_only';
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
    evidenceProvenance: 'client-reported';
    evidenceProvenanceLabelAr: string;
    clinicalReport: ClinicalReport;
  };
}

export function validateAndDeriveSessionFromEvidence(
  rawBody: Record<string, unknown>,
  studentMeta: { name: string; gradeLevel: number }
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
  const hasEyeEvidence =
    (Array.isArray(evidenceObj.fixations) && evidenceObj.fixations.length > 0) ||
    (Array.isArray(rawBody.fixations) && rawBody.fixations.length > 0) ||
    Number.isFinite(Number(evidenceObj.calibrationAccuracyPercent ?? rawBody.calibrationAccuracyPercent));

  const assessmentModality: 'voice_only' | 'eye_voice' | 'reading_only' =
    rawModality === 'voice_only'
      ? 'voice_only'
      : (rawModality === 'reading_only'
          ? 'reading_only'
          : (rawModality === 'eye_voice' || hasEyeEvidence
              ? 'eye_voice'
              : 'reading_only'));

  const isVoiceOnlyModality = assessmentModality === 'voice_only';
  const isReadingOnlyModality = assessmentModality === 'reading_only';
  const isNoEyeModality = isVoiceOnlyModality || isReadingOnlyModality;

  let calibrationAccuracyPercent: number | undefined = undefined;
  let normalizedCalMethod = {
    isValidated: false,
    labelAr: isReadingOnlyModality
      ? 'غير منطبق (جلسة قراءة وفهم مباشرة بدون كاميرا)'
      : (isVoiceOnlyModality ? 'غير منطبق (جلسة صوتية)' : 'معايرة عين'),
    normalizedMethod: isReadingOnlyModality
      ? ('standardized-passage-orf' as const)
      : ('voice-first-orf' as const),
  };

  if (!isNoEyeModality) {
    const rawCalib = Number(
      evidenceObj.calibrationAccuracyPercent ?? rawBody.calibrationAccuracyPercent
    );
    if (
      !Number.isFinite(rawCalib) ||
      rawCalib < 70 ||
      rawCalib > 100
    ) {
      return {
        valid: false,
        statusCode: 400,
        errorAr:
          'دقة التحقق من معايرة الكاميرا أقل من الحد الأدنى المطلوب (70%) أو خارج النطاق (70–100%).',
      };
    }
    calibrationAccuracyPercent = rawCalib;

    const rawCalMethod =
      evidenceObj.calibrationValidationMethod ??
      rawBody.calibrationValidationMethod ??
      'independent-holdout';
    const normCal = normalizeCalibrationValidationMethod(
      rawCalMethod,
      false
    );
    if (!normCal.isValidated) {
      return {
        valid: false,
        statusCode: 400,
        errorAr:
          'طريقة التحقق من المعايرة غير صالحة أو غير مكتملة؛ يلزم تحقق مستقل (independent-holdout) أو تقاطعي (leave-one-point-out).',
      };
    }
    normalizedCalMethod = {
      isValidated: normCal.isValidated,
      labelAr: normCal.labelAr,
      normalizedMethod: normCal.code as any,
    };
  }

  // 3. Validate Fixations Array & Plausibility against Passage and Reading Duration
  const rawFixations = evidenceObj.fixations ?? rawBody.fixations;
  const seenWordIndices = new Set<number>();
  const validatedFixations: WordFixation[] = [];
  let totalObservedFixationMs = 0;
  let wordBlinksSum = 0;

  if (isNoEyeModality && (!Array.isArray(rawFixations) || rawFixations.length === 0)) {
    // Camera-free modality without raw fixations: do NOT fabricate synthetic fixations.
    // Genuinely return empty fixations array and zero ocular duration.
  } else {
    if (!Array.isArray(rawFixations) || rawFixations.length === 0) {
      return {
        valid: false,
        statusCode: 400,
        errorAr: 'أدلة التثبيت البصري (fixations) مطلوبة ولا يمكن أن تكون فارغة للجلسات المعتمدة على العين.',
      };
    }

  for (const item of rawFixations) {
    if (!item || typeof item !== 'object') {
      return {
        valid: false,
        statusCode: 400,
        errorAr: 'عنصر تثبيت بصري غير صالح.',
      };
    }
    const f = item as Record<string, unknown>;
    const wordIndex = Number(f.wordIndex);
    const durationMs = Number(f.durationMs);
    const visits = Number(f.visits);
    const blinks = f.blinks === undefined ? 0 : Number(f.blinks);
    const observed = f.observed !== false && durationMs > 0 && visits > 0;

    if (
      !Number.isInteger(wordIndex) ||
      wordIndex < 0 ||
      wordIndex >= passage.words.length ||
      seenWordIndices.has(wordIndex)
    ) {
      return {
        valid: false,
        statusCode: 400,
        errorAr: `فهرس الكلمة (${String(f.wordIndex)}) خارج حدود النص أو مكرر.`,
      };
    }
    seenWordIndices.add(wordIndex);

    if (!observed) {
      continue;
    }

    if (
      !Number.isFinite(durationMs) ||
      durationMs < 40 ||
      durationMs > 10_000 ||
      !Number.isInteger(visits) ||
      visits < 1 ||
      visits > 50 ||
      !Number.isInteger(blinks) ||
      blinks < 0 ||
      blinks > 25
    ) {
      return {
        valid: false,
        statusCode: 400,
        errorAr:
          'قيم زمن التثبيت أو عدد الزيارات أو الرمشات للكلمة خارج الحدود الفيزيائية المعقولة.',
      };
    }

    let regressedFromIndex: number | undefined;
    if (
      f.regressedFromIndex !== undefined &&
      f.regressedFromIndex !== null
    ) {
      const regIdx = Number(f.regressedFromIndex);
      if (
        !Number.isInteger(regIdx) ||
        regIdx < 0 ||
        regIdx >= passage.words.length
      ) {
        return {
          valid: false,
          statusCode: 400,
          errorAr: 'فهرس التراجع البصري (regressedFromIndex) غير صالح.',
        };
      }
      regressedFromIndex = regIdx;
    }

    totalObservedFixationMs += Math.round(durationMs);
    wordBlinksSum += blinks;
    validatedFixations.push({
      wordIndex,
      word: passage.words[wordIndex],
      durationMs: Math.round(durationMs),
      visits,
      regressedFromIndex,
      blinks,
      observed: true,
    });
  }

  if (!isNoEyeModality) {
    const minRequiredWords = Math.max(4, Math.ceil(passage.words.length * 0.25));
    if (validatedFixations.length < minRequiredWords) {
      return {
        valid: false,
        statusCode: 422,
        errorAr: `تغطية تتبع العين غير كافية: رُصدت ${validatedFixations.length} كلمات من أصل ${passage.words.length} (الحد الأدنى ${minRequiredWords} كلمات / 25%).`,
      };
    }
  }
  }

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

  // Abuse/plausibility ceiling, not a clinical norm: reject implausible reported pace.
  const wordCountForPace = validatedFixations.length > 0 ? validatedFixations.length : passage.words.length;
  const observedReadingWpm = (wordCountForPace * 60) / readingDurationSeconds;
  if (observedReadingWpm > 300) {
    return {
      valid: false,
      statusCode: 400,
      errorAr: `سرعة القراءة المستنتجة (${Math.round(observedReadingWpm)} كلمة/دقيقة) تتجاوز حد المعقولية التقني (300 كلمة/دقيقة).`,
    };
  }

  if (totalObservedFixationMs > 0 && totalObservedFixationMs > readingDurationSeconds * 1000) {
    return {
      valid: false,
      statusCode: 400,
      errorAr: `بيانات غير معقولة فيزيائياً: مجموع أزمنة التثبيت البصري (${(totalObservedFixationMs / 1000).toFixed(1)} ثانية) يتجاوز مدة القراءة الكلية (${readingDurationSeconds} ثانية).`,
    };
  }

  // 5. Blink Count & Physiological Blink Rate Ceiling (<= 120 blinks/min)
  const rawBlinkCount =
    evidenceObj.blinkCount ?? rawBody.blinkCount ?? (isNoEyeModality ? 0 : wordBlinksSum);
  const blinkCount = Number(rawBlinkCount);
  if (!Number.isInteger(blinkCount) || blinkCount < 0) {
    return {
      valid: false,
      statusCode: 400,
      errorAr: 'عدد الرمشات (blinkCount) يجب أن يكون عدداً صحيحاً غير سالب.',
    };
  }
  const effectiveBlinkCount = Math.max(blinkCount, wordBlinksSum);
  const computedBlinksPerMinute = Math.round(
    (effectiveBlinkCount / readingDurationSeconds) * 60
  );
  if (computedBlinksPerMinute > 120) {
    return {
      valid: false,
      statusCode: 400,
      errorAr: `معدل الرمش المُبلَّغ به (${computedBlinksPerMinute} رمشة/دقيقة) يتجاوز السقف الفسيولوجي المعقول (120 رمشة/دقيقة).`,
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

  const spokenTranscript =
    typeof (evidenceObj.spokenTranscript ?? rawBody.spokenTranscript) ===
    'string'
      ? String(evidenceObj.spokenTranscript ?? rawBody.spokenTranscript)
          .trim()
          .slice(0, 4000)
      : '';

  // Teacher Human-in-the-Loop review validation
  const isTeacherVerified = Boolean(rawBody.teacherVerified || evidenceObj.teacherVerified);
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
        errorAr: `مصفوفة مراجعة المعلم غير صالحة؛ يجب أن تحتوي على ${passage.words.length} كلمة مطابقة تماماً للنص المرجعي.`,
      };
    }

    const validStatuses = new Set(['correct', 'dialect_variant', 'phonetic_substitution', 'omitted']);
    for (let i = 0; i < passage.words.length; i++) {
      const item = rawVerifiedWords[i] as any;
      if (!item || typeof item !== 'object' || item.word !== passage.words[i] || !validStatuses.has(item.status)) {
        return {
          valid: false,
          statusCode: 400,
          errorAr: `كلمة مراجعة المعلم عند الفهرس ${i} (${String(item?.word)}) غير متطابقة مع النص المرجعي (${passage.words[i]}) أو حالتها غير صالحة.`,
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

  const oralReadingAssessed =
    isTeacherVerified ||
    (Boolean(evidenceObj.oralReadingAssessed ?? rawBody.oralReadingAssessed) &&
      spokenTranscript.length > 0);

  // Always evaluate oral reading alignment against the FULL reference passage words
  // to avoid artificially inflating accuracy if the child read only a fraction of the text.
  const oralMetrics =
    spokenTranscript.length > 0
      ? evaluateOralReadingAlignment(
          passage.words,
          spokenTranscript,
          Math.max(6, readingDurationSeconds),
          0,
          dialectProfile.code
        )
      : null;

  const rawOralWcpm = isTeacherVerified ? teacherWcpm : (oralMetrics?.wcpm ?? null);
  const rawOralAccuracy = isTeacherVerified ? teacherAccuracyPercent : (oralMetrics?.accuracyPercent ?? null);
  const rawOralWer = oralMetrics?.werPercent ?? 0;

  const oralIntegration: OralReadingIntegrationInput | null =
    oralReadingAssessed
      ? {
          assessed: true,
          wcpm: typeof rawOralWcpm === 'number' ? rawOralWcpm : undefined,
          accuracyPercent: typeof rawOralAccuracy === 'number' ? rawOralAccuracy : 0,
          werPercent: typeof rawOralWer === 'number' ? rawOralWer : 0,
          phoneticSubstitutionCount: isTeacherVerified ? teacherSubstitutionCount : (oralMetrics?.phoneticSubstitutionCount ?? 0),
          dialectVariantCount: isTeacherVerified ? teacherDialectVariantCount : (oralMetrics?.dialectVariantCount ?? 0),
          omissionCount: isTeacherVerified ? teacherOmissionCount : (oralMetrics?.omittedWordsCount ?? 0),
          misreadWords: isTeacherVerified && validatedTeacherAlignment
            ? validatedTeacherAlignment
                .filter(a => a.status === 'phonetic_substitution' || a.status === 'omitted')
                .map(a => a.word)
            : (oralMetrics?.alignment
                .filter(
                  (a) =>
                    a.status === 'phonetic_substitution' || a.status === 'omitted'
                )
                .map((a) =>
                  a.spokenWord
                    ? `${a.targetWord} (نُطقت: ${a.spokenWord})`
                    : a.targetWord
                ) || []),
        }
      : null;

  // 8. Server-Side Eye-Tracking & Reading Risk Derivation
  const eyeMetrics = !isNoEyeModality && validatedFixations.length > 0
    ? calculateEyeTrackingMetrics(
        validatedFixations,
        readingDurationSeconds,
        studentMeta.gradeLevel,
        effectiveBlinkCount,
        passage.words.length,
        oralIntegration
      )
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

  const derivedWpm = eyeMetrics
    ? eyeMetrics.wpm
    : Math.round((passage.words.length / readingDurationSeconds) * 60);

  // Derive risk indicators objectively based on measured modality
  let derivedDyslexiaRiskScore = 40;
  let derivedReadingHeuristic = 75;
  let derivedReadingRiskLevel: 'nominal' | 'moderate' | 'high' = 'nominal';
  let derivedReadingRiskLabelAr = 'تقييم قراءة وفهم استرشادي';

  if (eyeMetrics) {
    derivedDyslexiaRiskScore = eyeMetrics.dyslexiaRiskScore;
    derivedReadingHeuristic = eyeMetrics.heuristicIndicator;
    derivedReadingRiskLevel = eyeMetrics.riskLevel;
    derivedReadingRiskLabelAr = eyeMetrics.riskLabelAr;
  } else if (oralIntegration) {
    derivedDyslexiaRiskScore = Math.max(10, Math.min(90, Math.round(100 - (oralIntegration.accuracyPercent ?? 75))));
    derivedReadingHeuristic = oralIntegration.accuracyPercent ?? 75;
    derivedReadingRiskLevel = derivedReadingHeuristic >= 75 ? 'nominal' : (derivedReadingHeuristic >= 50 ? 'moderate' : 'high');
    derivedReadingRiskLabelAr = 'فرز صوتي استرشادي';
  } else if (isReadingOnlyModality) {
    // Pedagogical reading and comprehension index (combining WPM fluency & comprehension score)
    const expectedGradeWpm = Math.max(35, studentMeta.gradeLevel * 18);
    const fluencyRatio = Math.min(1.2, derivedWpm / expectedGradeWpm);
    const fluencyScore = Math.round(Math.min(100, fluencyRatio * 100));
    derivedReadingHeuristic = Math.round((fluencyScore * 0.5) + (comprehensionScore * 0.5));
    derivedDyslexiaRiskScore = Math.max(10, Math.min(90, 100 - derivedReadingHeuristic));
    derivedReadingRiskLevel = derivedReadingHeuristic >= 70 ? 'nominal' : (derivedReadingHeuristic >= 45 ? 'moderate' : 'high');
    derivedReadingRiskLabelAr = derivedReadingRiskLevel === 'nominal'
      ? 'أداء قرائي واستيعابي نمائي ملائم للصف'
      : (derivedReadingRiskLevel === 'moderate'
          ? 'مؤشرات استرشادية تستدعي مساندة في الطلاقة أو الاستيعاب'
          : 'مؤشرات استرشادية لتعثر قرائي يستدعي تدخلاً فردياً');
  }

  const clinicalReport = buildDeterministicClinicalReport({
    studentName: studentMeta.name,
    gradeLevel: studentMeta.gradeLevel,
    dialectLabelAr: dialectRegionAr,
    gazeCoveragePercent: eyeMetrics ? eyeMetrics.gazeCoveragePercent : 0,
    observedWordCount: eyeMetrics ? eyeMetrics.observedWordCount : 0,
    totalPassageWordCount: passage.words.length,
    wpm: derivedWpm,
    avgFixationMs: eyeMetrics ? eyeMetrics.avgFixationMs : 0,
    regressionRate: eyeMetrics ? eyeMetrics.regressionRate : 0,
    regressionCount: eyeMetrics ? eyeMetrics.regressionCount : 0,
    blinkCount: eyeMetrics ? eyeMetrics.blinkCount : 0,
    blinksPerMinute: eyeMetrics ? eyeMetrics.blinksPerMinute : 0,
    visualStrainLabelAr: eyeMetrics
      ? eyeMetrics.visualStrainLabelAr
      : (isReadingOnlyModality ? 'غير منطبق (جلسة قراءة بدون كاميرا)' : 'غير منطبق (جلسة صوتية)'),
    calibrationAccuracyPercent:
      calibrationAccuracyPercent !== undefined
        ? Math.round(calibrationAccuracyPercent)
        : 0,
    calibrationValidationLabelAr: normalizedCalMethod.labelAr,
    problematicWords: eyeMetrics
      ? eyeMetrics.problematicWords
      : (oralIntegration?.misreadWords || []),
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
      avgFixationMs: eyeMetrics ? eyeMetrics.avgFixationMs : 0,
      regressionRate: eyeMetrics ? eyeMetrics.regressionRate : 0,
      regressionCount: eyeMetrics ? eyeMetrics.regressionCount : 0,
      blinkCount: eyeMetrics ? eyeMetrics.blinkCount : 0,
      blinksPerMinute: eyeMetrics ? eyeMetrics.blinksPerMinute : 0,
      visualStrainLevel: eyeMetrics ? eyeMetrics.visualStrainLevel : 'nominal',
      visualStrainLabelAr: eyeMetrics
        ? eyeMetrics.visualStrainLabelAr
        : (isReadingOnlyModality ? 'غير منطبق (جلسة قراءة بدون كاميرا)' : 'غير منطبق (جلسة صوتية)'),
      gazeCoveragePercent: eyeMetrics ? eyeMetrics.gazeCoveragePercent : 0,
      observedWordCount: eyeMetrics ? eyeMetrics.observedWordCount : 0,
      totalPassageWordCount: passage.words.length,
      calibrationAccuracyPercent:
        calibrationAccuracyPercent !== undefined
          ? Math.round(calibrationAccuracyPercent)
          : undefined,
      calibrationValidationMethod: normalizedCalMethod.labelAr,
      oralReadingAssessed,
      spokenTranscript: oralReadingAssessed ? spokenTranscript : '',
      wcpm: oralIntegration?.wcpm ?? null,
      oralWcpm: oralIntegration?.wcpm ?? null,
      oralAccuracyPercent: oralIntegration?.accuracyPercent ?? null,
      oralWerPercent: oralIntegration?.werPercent ?? null,
      teacherVerified: isTeacherVerified,
      teacherVerificationTimestamp: isTeacherVerified
        ? (typeof (rawBody.teacherVerificationTimestamp ?? evidenceObj.teacherVerificationTimestamp) === 'string'
            ? String(rawBody.teacherVerificationTimestamp ?? evidenceObj.teacherVerificationTimestamp)
            : new Date().toISOString())
        : undefined,
      teacherVerifierRole:
        typeof (rawBody.teacherVerifierRole ?? evidenceObj.teacherVerifierRole) === 'string'
          ? String(rawBody.teacherVerifierRole ?? evidenceObj.teacherVerifierRole)
          : (isTeacherVerified ? 'معلم / أخصائي قرائي معتمد' : undefined),
      teacherWordOverridesCount:
        typeof (rawBody.teacherWordOverridesCount ?? evidenceObj.teacherWordOverridesCount) === 'number'
          ? Number(rawBody.teacherWordOverridesCount ?? evidenceObj.teacherWordOverridesCount)
          : (isTeacherVerified ? 0 : undefined),
      verifiedWordsAlignment: validatedTeacherAlignment,
      phoneticSubstitutionCount:
        oralIntegration?.phoneticSubstitutionCount ?? 0,
      dialectVariantCount: oralIntegration?.dialectVariantCount ?? 0,
      omissionCount: oralIntegration?.omissionCount ?? 0,
      dyslexiaRiskScore: derivedDyslexiaRiskScore,
      readingHeuristicIndicator: derivedReadingHeuristic,
      readingRiskLevel: derivedReadingRiskLevel,
      readingRiskLabelAr: derivedReadingRiskLabelAr,
      problematicWords: eyeMetrics
        ? eyeMetrics.problematicWords
        : (oralIntegration?.misreadWords || []),
      fixations: validatedFixations,
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
      evidenceProvenance: 'client-reported',
      evidenceProvenanceLabelAr:
        'أدلة مُبلَّغ بها من العميل (اجتازت فحوص المعقولية الحسابية)',
      clinicalReport,
    },
  };
}
