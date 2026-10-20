import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import {
  calculateDyscalculiaMetrics,
  calculateEyeTrackingMetrics,
  WordFixation,
  SubitizingTrialResult,
  NumberLineTrialResult,
  TranscodingTrialResult,
} from './src/utils/clinicalMetrics';
import { ARABIC_READING_PASSAGES, INITIAL_STUDENTS, StudentRecord } from './src/data/seedData';
import { evaluateOralReadingAlignment } from './src/utils/dyslexiaEngines';
import {
  ClinicalRole,
  ClinicalScope,
  issueClinicalSessionToken,
  verifyClinicalSessionToken,
  authorizeSessionScope,
  validateExplicitGuardianConsent,
  VerifiedClinicalSession,
} from './src/utils/clinicalSecurity';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.CLINICAL_DATA_DIR
  ? path.resolve(process.env.CLINICAL_DATA_DIR)
  : path.join(__dirname, '.runtime-store');
const STORE_PATH = path.join(DATA_DIR, 'clinical-store.json');
let clinicalStoreReady = false;

const CLINICAL_SESSION_SECRET = (process.env.CLINICAL_SESSION_SECRET || '').trim();
const SECURITY_STATE_PATH = path.join(DATA_DIR, 'security-state.json');

interface AuditEvent {
  eventId: string;
  timestamp: string;
  tenantId: string;
  sessionId: string;
  role: ClinicalRole;
  /** Self-declared label from login, not verified individual identity. */
  actorLabel: string;
  action: string;
  subjectId?: string;
  changedFields: string[];
  outcome: 'success' | 'denied';
}

interface SecurityState {
  version: 1;
  revokedSessions: Record<string, number>;
  rateLimitBuckets: {
    auth: Record<string, number[]>;
    ai: Record<string, number[]>;
  };
  auditEvents: AuditEvent[];
}

let securityState: SecurityState = {
  version: 1,
  revokedSessions: {},
  rateLimitBuckets: { auth: {}, ai: {} },
  auditEvents: [],
};
let securityStateReady = false;

interface TenantCredential {
  tenantId: string;
  role: ClinicalRole;
  accessCode: string;
}

/** Role and tenant are derived from an independently provisioned secret, never from request claims. */
function getTenantCredentialEntries(): TenantCredential[] {
  const raw = (process.env.CLINICAL_TENANT_CREDENTIALS || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const entries: TenantCredential[] = [];
    const seenCodes = new Set<string>();
    for (const [tenantId, value] of Object.entries(parsed)) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(tenantId) ||
          !value || typeof value !== 'object' || Array.isArray(value)) return [];
      const credentials = value as Record<string, unknown>;
      for (const role of ['clinician', 'educator_readonly'] as const) {
        const accessCode = credentials[role];
        if (typeof accessCode !== 'string' || accessCode.length < 24 ||
            seenCodes.has(accessCode)) return [];
        seenCodes.add(accessCode);
        entries.push({ tenantId, role, accessCode });
      }
    }
    return entries.length >= 2 ? entries : [];
  } catch {
    return [];
  }
}

function getStoreEncryptionKey(): Buffer | null {
  const raw = (process.env.CLINICAL_STORE_ENCRYPTION_KEY || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(raw)) return null;
  return Buffer.from(raw, 'hex');
}

function isClinicalAuthConfigured(): boolean {
  const storeKeyHex = (process.env.CLINICAL_STORE_ENCRYPTION_KEY || '').trim().toLowerCase();
  const credentials = getTenantCredentialEntries();
  return (
    credentials.length >= 2 &&
    CLINICAL_SESSION_SECRET.length >= 32 &&
    CLINICAL_SESSION_SECRET !== 'baseera-rbac-hmac-secret-key-2026' &&
    CLINICAL_SESSION_SECRET !== storeKeyHex &&
    !credentials.some(({ accessCode }) =>
      accessCode === CLINICAL_SESSION_SECRET ||
      accessCode === storeKeyHex ||
      accessCode === 'BASEERA-CLINICAL-2026'
    ) &&
    getStoreEncryptionKey() !== null
  );
}


function emptySecurityState(): SecurityState {
  return {
    version: 1,
    revokedSessions: {},
    rateLimitBuckets: { auth: {}, ai: {} },
    auditEvents: [],
  };
}

function sealSecurityState(state: SecurityState, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(state), 'utf8'),
    cipher.final(),
  ]);
  return JSON.stringify({
    format: 'baseera-aes-256-gcm-security-v1',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
}

function openSecurityState(raw: string, key: Buffer): SecurityState {
  const envelope = JSON.parse(raw) as {
    format?: unknown;
    iv?: unknown;
    tag?: unknown;
    ciphertext?: unknown;
  };
  if (
    envelope.format !== 'baseera-aes-256-gcm-security-v1' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.tag !== 'string' ||
    typeof envelope.ciphertext !== 'string'
  ) throw new Error('Unsupported encrypted security-state format');

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  const parsed = JSON.parse(plaintext) as Partial<SecurityState>;

  if (
    parsed.version !== 1 ||
    !parsed.revokedSessions ||
    typeof parsed.revokedSessions !== 'object' ||
    Array.isArray(parsed.revokedSessions) ||
    !parsed.rateLimitBuckets ||
    typeof parsed.rateLimitBuckets.auth !== 'object' ||
    typeof parsed.rateLimitBuckets.ai !== 'object' ||
    !Array.isArray(parsed.auditEvents)
  ) throw new Error('Invalid decrypted security-state structure');

  return {
    version: 1,
    revokedSessions: parsed.revokedSessions as Record<string, number>,
    rateLimitBuckets: {
      auth: parsed.rateLimitBuckets.auth as Record<string, number[]>,
      ai: parsed.rateLimitBuckets.ai as Record<string, number[]>,
    },
    auditEvents: (parsed.auditEvents as Array<Partial<AuditEvent>>).map((event) => ({
      ...event,
      actorLabel: typeof event.actorLabel === 'string' ? event.actorLabel : 'هوية غير متحققة',
    })) as AuditEvent[],
  };
}

function persistSecurityState(): boolean {
  const key = getStoreEncryptionKey();
  if (!key) return false;
  const tempPath = `${SECURITY_STATE_PATH}.tmp`;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    fs.chmodSync(DATA_DIR, 0o700);
    fs.writeFileSync(tempPath, sealSecurityState(securityState, key), {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.chmodSync(tempPath, 0o600);
    fs.renameSync(tempPath, SECURITY_STATE_PATH);
    fs.chmodSync(SECURITY_STATE_PATH, 0o600);
    return true;
  } catch {
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    console.error('Unable to persist encrypted authentication/revocation/audit state; protected APIs are being disabled.');
    securityStateReady = false;
    return false;
  }
}

/** Corrupt or unreadable security state is a hard failure: never silently reset revocations or counters. */
function initializeSecurityState(): boolean {
  const key = getStoreEncryptionKey();
  if (!key) {
    securityStateReady = false;
    return false;
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    fs.chmodSync(DATA_DIR, 0o700);
    if (!fs.existsSync(SECURITY_STATE_PATH)) {
      securityState = emptySecurityState();
      if (!persistSecurityState()) return false;
    } else {
      securityState = openSecurityState(fs.readFileSync(SECURITY_STATE_PATH, 'utf8'), key);
    }

    const now = Date.now();
    for (const [id, expiry] of Object.entries(securityState.revokedSessions)) {
      if (!Number.isFinite(expiry) || expiry <= now) delete securityState.revokedSessions[id];
    }
    for (const kind of ['auth', 'ai'] as const) {
      for (const [ip, timestamps] of Object.entries(securityState.rateLimitBuckets[kind])) {
        const retained = Array.isArray(timestamps)
          ? timestamps.filter((timestamp) => Number.isFinite(timestamp) && now - timestamp < 60_000)
          : [];
        if (retained.length === 0) delete securityState.rateLimitBuckets[kind][ip];
        else securityState.rateLimitBuckets[kind][ip] = retained;
      }
    }
    if (securityState.auditEvents.length > 5000) {
      securityState.auditEvents = securityState.auditEvents.slice(-5000);
    }
    securityStateReady = true;
    return persistSecurityState();
  } catch {
    securityStateReady = false;
    console.error('Encrypted security state could not be loaded. Authentication is disabled until the store is repaired.');
    return false;
  }
}

function consumePersistentRateLimit(
  kind: 'auth' | 'ai',
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number; available: boolean } {
  if (!securityStateReady) {
    return { allowed: false, retryAfterSeconds: 60, available: false };
  }
  const now = Date.now();
  const previous = securityState.rateLimitBuckets[kind][key] || [];
  const active = previous.filter((timestamp) => now - timestamp < windowMs);
  if (active.length >= maxAttempts) {
    const oldest = active[0] || now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
      available: true,
    };
  }

  securityState.rateLimitBuckets[kind][key] = [...active, now];
  // Keep persistence bounded if an attacker rotates source addresses.
  const keys = Object.keys(securityState.rateLimitBuckets[kind]);
  if (keys.length > 5000) {
    for (const oldKey of keys.slice(0, keys.length - 5000)) {
      delete securityState.rateLimitBuckets[kind][oldKey];
    }
  }
  if (!persistSecurityState()) {
    securityState.rateLimitBuckets[kind][key] = previous;
    return { allowed: false, retryAfterSeconds: 60, available: false };
  }
  return { allowed: true, retryAfterSeconds: 0, available: true };
}

function appendAuditEvent(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): boolean {
  if (!securityStateReady) return false;
  const priorEvents = securityState.auditEvents;
  securityState.auditEvents = [
    ...priorEvents,
    {
      ...event,
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  ].slice(-5000);
  if (persistSecurityState()) return true;
  securityState.auditEvents = priorEvents;
  return false;
}

function auditForRequest(
  req: express.Request,
  action: string,
  subjectId: string | undefined,
  changedFields: string[]
): boolean {
  const session = (req as any).clinicalSession as VerifiedClinicalSession | undefined;
  if (!session) return false;
  return appendAuditEvent({
    tenantId: session.tenantId,
    sessionId: session.sessionId,
    role: session.role,
    actorLabel: session.clinicianName,
    action,
    subjectId,
    changedFields: [...new Set(changedFields)].sort(),
    outcome: 'success',
  });
}

function readTrustedProxyHops(): number {
  const raw = (process.env.TRUST_PROXY_HOPS || '0').trim();
  if (!raw || [...raw].some((character) => character < '0' || character > '9')) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5.');
  }
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0 || hops > 5) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5.');
  }
  return hops;
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// PATCH is intentionally limited to non-derived profile fields. Measurement outputs and
// screening scores must be derived server-side from validated task evidence.
const studentPatchSchema = z.object({
  gradeLevel: z.number().int().min(1).max(12).optional(),
  ageYears: z.number().int().min(4).max(21).optional(),
  passageId: z.string().trim().min(1).max(120).optional(),
  dialectRegionAr: z.string().trim().min(1).max(100).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one editable profile field is required.',
});

const subitizingSubmissionSchema = z.object({
  dotCount: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  chosen: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  reactionTimeMs: z.number().int().min(1).max(120_000),
}).strict();

const numberLineSubmissionSchema = z.object({
  target: z.union([z.literal(37), z.literal(156)]),
  userEstimate: z.number().finite().min(0).max(200),
  reactionTimeMs: z.number().int().min(1).max(120_000),
  scaleMin: z.literal(0),
  scaleMax: z.union([z.literal(100), z.literal(200)]),
}).strict();

const transcodingSubmissionSchema = z.object({
  targetNumber: z.union([z.literal(47), z.literal(83), z.literal(69)]),
  selectedNumber: z.number().int().min(0).max(999),
  reactionTimeMs: z.number().int().min(1).max(120_000),
}).strict();

const mathAssessmentSchema = z.object({
  subitizingTrials: z.array(subitizingSubmissionSchema).length(4),
  numberLineTrials: z.array(numberLineSubmissionSchema).length(2),
  transcodingTrials: z.array(transcodingSubmissionSchema).length(3),
}).strict().superRefine((value, ctx) => {
  const dotCounts = value.subitizingTrials.map((trial) => trial.dotCount);
  if (new Set(dotCounts).size !== 4) {
    ctx.addIssue({ code: 'custom', path: ['subitizingTrials'], message: 'Each dot count must be represented once.' });
  }

  const numberLineTargets = value.numberLineTrials.map((trial) => trial.target);
  if (new Set(numberLineTargets).size !== 2) {
    ctx.addIssue({ code: 'custom', path: ['numberLineTrials'], message: 'Both fixed number-line targets are required exactly once.' });
  }
  for (const [index, trial] of value.numberLineTrials.entries()) {
    const expectedScale = trial.target === 37 ? 100 : 200;
    if (
      trial.scaleMax !== expectedScale ||
      trial.userEstimate < trial.scaleMin ||
      trial.userEstimate > trial.scaleMax
    ) {
      ctx.addIssue({ code: 'custom', path: ['numberLineTrials', index], message: 'Invalid estimate range for the fixed target.' });
    }
  }

  const allowedChoices: Record<number, number[]> = {
    47: [47, 74, 49],
    83: [83, 38, 63],
    69: [69, 96, 66],
  };
  const transcodingTargets = value.transcodingTrials.map((trial) => trial.targetNumber);
  if (new Set(transcodingTargets).size !== 3) {
    ctx.addIssue({ code: 'custom', path: ['transcodingTrials'], message: 'Each fixed transcoding target is required exactly once.' });
  }
  for (const [index, trial] of value.transcodingTrials.entries()) {
    if (!allowedChoices[trial.targetNumber]?.includes(trial.selectedNumber)) {
      ctx.addIssue({ code: 'custom', path: ['transcodingTrials', index, 'selectedNumber'], message: 'Selected option is not available for this fixed task.' });
    }
  }
});

const arabicDialectSchema = z.enum(['msa', 'gulf', 'egyptian', 'levantine', 'maghrebi']);

const wordFixationEvidenceSchema = z.object({
  wordIndex: z.number().int().min(0).max(1000),
  word: z.string().min(1).max(100),
  durationMs: z.number().int().min(0).max(120_000),
  visits: z.number().int().min(0).max(1000),
  regressedFromIndex: z.number().int().min(0).max(1000).optional(),
  blinks: z.number().int().min(0).max(10_000).optional(),
  observed: z.boolean().optional(),
}).strict();

const readingEvidenceShape = {
  passageId: z.string().trim().min(1).max(120),
  dialectCode: arabicDialectSchema.default('msa'),
  dialectRegionAr: z.string().trim().min(1).max(100).optional(),
  readingDurationSeconds: z.number().finite().min(4).max(3600),
  blinkCount: z.number().int().min(0).max(10_000),
  fixations: z.array(wordFixationEvidenceSchema).min(1).max(1000),
  comprehensionAnswers: z.array(z.number().int().min(0).max(20)).min(1).max(20),
  spokenTranscript: z.string().max(20_000).optional().default(''),
  speechRecognitionUsed: z.boolean().optional().default(false),
  guardianConsentGiven: z.literal(true),
  guardianConsentRecordedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), {
    message: 'Invalid consent timestamp',
  }),
  guardianConsentSource: z.string().trim().min(1).max(300),
  guardianAudioConsentGiven: z.boolean().optional().default(false),
  guardianAudioConsentRecordedAt: z.string().optional().refine(
    (value) => value === undefined || Number.isFinite(Date.parse(value)),
    { message: 'Invalid audio-consent timestamp' }
  ),
  calibrationAccuracyPercent: z.number().int().min(0).max(99),
  calibrationValidationMethod: z.enum(['independent-holdout', 'leave-one-point-out']),
};

const readingSessionEvidenceSchema = z.object(readingEvidenceShape).strict().superRefine((value, ctx) => {
  if (value.speechRecognitionUsed && (
    !value.guardianAudioConsentGiven ||
    !value.guardianAudioConsentRecordedAt
  )) {
    ctx.addIssue({
      code: 'custom',
      path: ['guardianAudioConsentGiven'],
      message: 'Explicit timestamped audio consent is required.',
    });
  }
});

const studentCreateEvidenceSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9._:-]{1,120}$/),
  name: z.string().trim().min(1).max(120),
  schoolName: z.string().trim().min(1).max(160),
  gradeLevel: z.number().int().min(1).max(12),
  ageYears: z.number().int().min(4).max(21),
  ...readingEvidenceShape,
}).strict().superRefine((value, ctx) => {
  if (value.speechRecognitionUsed && (
    !value.guardianAudioConsentGiven ||
    !value.guardianAudioConsentRecordedAt
  )) {
    ctx.addIssue({
      code: 'custom',
      path: ['guardianAudioConsentGiven'],
      message: 'Explicit timestamped audio consent is required.',
    });
  }
});

type ReadingEvidence = z.infer<typeof readingSessionEvidenceSchema>;

function deriveServerReadingMetrics(
  evidence: ReadingEvidence,
  gradeLevel: number
): { metrics: ReturnType<typeof calculateEyeTrackingMetrics>; comprehensionScore: number; clinicalReport: StudentRecord['clinicalReport']; oral: ReturnType<typeof evaluateOralReadingAlignment> | null; passageWords: string[] } | { error: string; statusCode: 400 | 422 } {
  const passage = ARABIC_READING_PASSAGES.find((item) => item.id === evidence.passageId);
  if (!passage) return { error: 'نص القراءة غير معروف؛ أُرفضت أدلة الجلسة.', statusCode: 400 };
  if (evidence.fixations.length !== passage.words.length) {
    return { error: 'عدد سجلات الكلمات لا يطابق نص القراءة المحدد.', statusCode: 400 };
  }
  for (let index = 0; index < passage.words.length; index += 1) {
    const fixation = evidence.fixations[index];
    if (
      fixation.wordIndex !== index ||
      fixation.word !== passage.words[index] ||
      fixation.visits === 0 && fixation.durationMs > 0
    ) {
      return { error: 'تسلسل كلمات التثبيت لا يطابق النص؛ رُفضت البيانات المعدلة.', statusCode: 400 };
    }
  }
  for (const fixation of evidence.fixations) {
    if (
      typeof fixation.regressedFromIndex === 'number' &&
      fixation.regressedFromIndex >= passage.words.length
    ) {
      return { error: 'مؤشر حركة العين خارج حدود النص.', statusCode: 400 };
    }
  }
  if (evidence.comprehensionAnswers.length !== passage.comprehensionQuestions.length) {
    return { error: 'عدد إجابات الفهم لا يطابق أسئلة النص.', statusCode: 400 };
  }
  for (let index = 0; index < evidence.comprehensionAnswers.length; index += 1) {
    const answer = evidence.comprehensionAnswers[index];
    if (answer >= passage.comprehensionQuestions[index].options.length) {
      return { error: 'إجابة فهم خارج خيارات السؤال.', statusCode: 400 };
    }
  }

  const spokenTranscript = evidence.spokenTranscript.trim();
  const oral = spokenTranscript
    ? evaluateOralReadingAlignment(
        passage.words,
        spokenTranscript,
        evidence.readingDurationSeconds,
        0,
        evidence.dialectCode
      )
    : null;
  const oralInput = oral ? {
    assessed: true,
    wcpm: oral.wcpm,
    accuracyPercent: oral.accuracyPercent,
    werPercent: oral.werPercent,
    phoneticSubstitutionCount: oral.phoneticSubstitutionCount,
    dialectVariantCount: oral.dialectVariantCount,
    omissionCount: oral.omittedWordsCount,
    misreadWords: oral.alignment
      .filter((item) => item.status === 'phonetic_substitution' || item.status === 'omitted')
      .map((item) => item.spokenWord ? `${item.targetWord} (نُطقت: ${item.spokenWord})` : item.targetWord),
  } : null;

  const fixations = evidence.fixations as WordFixation[];
  const metrics = calculateEyeTrackingMetrics(
    fixations,
    evidence.readingDurationSeconds,
    gradeLevel,
    evidence.blinkCount,
    passage.words.length,
    oralInput
  );
  if (
    metrics.observedWordCount < 4 ||
    metrics.gazeCoveragePercent < 25 ||
    !metrics.isSufficientGazeData
  ) {
    return {
      error: 'بيانات النظر غير كافية لإصدار نتيجة محفوظة؛ يلزم رصد 4 كلمات وتغطية 25% على الأقل.',
      statusCode: 422,
    };
  }
  const comprehensionCorrect = evidence.comprehensionAnswers.filter(
    (answer, index) => answer === passage.comprehensionQuestions[index].correctIndex
  ).length;
  const comprehensionScore = Math.round(
    (comprehensionCorrect / passage.comprehensionQuestions.length) * 100
  );
  const oralSummary = oral
    ? ` وُزنت المطابقة الصوتية للخادم: ${oral.accuracyPercent}%، ومعدل خطأ الكلمات ${oral.werPercent}%.`
    : ' لم يُرسل نص قراءة منطوقة لهذه الجلسة.';
  const clinicalReport: StudentRecord['clinicalReport'] = {
    clinicalSummary: `نتيجة فرز استرشادي محسوبة على الخادم: ${metrics.observedWordCount}/${metrics.totalPassageWordCount} كلمة مرصودة، وطلاقة ${metrics.wpm} كلمة/دقيقة، ومؤشر خطورة استدلالي ${metrics.dyslexiaRiskScore}/100.${oralSummary} لا تمثل النتيجة تشخيصًا طبيًا أو معيارًا معياريًا.`,
    ocularMotorAnalysis: `متوسط التثبيت ${metrics.avgFixationMs} مللي ثانية، والتغطية المرصودة ${metrics.gazeCoveragePercent}%. مؤشرات وصفية من جلسة واحدة وليست تشخيصًا.`,
    orthographicAndPhonologicalPatterns: metrics.problematicWords.length
      ? `كلمات تستحق المراجعة في هذه الجلسة: ${metrics.problematicWords.join('، ')}.`
      : 'لم تُحدد كلمات بارزة وفق قواعد الفرز الحالية.',
    dyscalculiaSpatialAnalysis: 'لم يجر اختبار الحساب ضمن جلسة القراءة هذه.',
    interventionExercises: [],
    classroomAccommodations: [],
  };
  return { metrics, comprehensionScore, clinicalReport, oral, passageWords: passage.words };
}

function sanitizeStudentRecord(s: StudentRecord): StudentRecord {
  // Migrate records written by older builds, where heuristic indices were mislabeled as percentiles.
  const legacy = s as StudentRecord & {
    readingPercentile?: number;
    mathPercentile?: number;
  };
  const normalized = {
    ...s,
    guardianConsentGiven: s.isDemoRecord ? false : s.guardianConsentGiven,
    readingHeuristicIndicator:
      s.readingHeuristicIndicator ??
      (typeof legacy.readingPercentile === 'number' ? legacy.readingPercentile : 50),
    mathHeuristicIndicator:
      s.mathHeuristicIndicator ??
      (typeof legacy.mathPercentile === 'number' ? legacy.mathPercentile : null),
  } as StudentRecord & { readingPercentile?: number; mathPercentile?: number };
  delete normalized.readingPercentile;
  delete normalized.mathPercentile;

  const cleanName = (normalized.name || '').trim();
  const cleanSchool = normalized.schoolName;
  const cleanSummary = normalized.clinicalReport?.clinicalSummary
    ? normalized.clinicalReport.clinicalSummary
        .replace(/^\\[سجل تجريبي توضيحي[^\\]]*\\]\\s*/g, '')
        .trim()
    : '';
  return {
    ...normalized,
    name: cleanName,
    schoolName: cleanSchool,
    clinicalReport: normalized.clinicalReport
      ? {
          ...normalized.clinicalReport,
          clinicalSummary: cleanSummary || normalized.clinicalReport.clinicalSummary,
        }
      : normalized.clinicalReport,
  };
}
function createSeededStudents(): StudentRecord[] {
  return INITIAL_STUDENTS.map((s) =>
    sanitizeStudentRecord({
      ...s,
      dyscalculiaAssessed: false,
      guardianConsentGiven: false,
    })
  );
}

function encryptStudentRecords(records: StudentRecord[], key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(records), 'utf8'),
    cipher.final(),
  ]);
  return JSON.stringify({
    format: 'baseera-aes-256-gcm-v1',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
}

function decodeStudentRecords(
  raw: string,
  key: Buffer
): { records: StudentRecord[]; wasEncrypted: boolean } {
  const envelope = JSON.parse(raw);
  if (envelope?.format === 'baseera-aes-256-gcm-v1') {
    const iv = Buffer.from(String(envelope.iv || ''), 'base64');
    const tag = Buffer.from(String(envelope.tag || ''), 'base64');
    const ciphertext = Buffer.from(String(envelope.ciphertext || ''), 'base64');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new Error('Invalid encrypted clinical store envelope');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
    const records = JSON.parse(plaintext);
    if (!Array.isArray(records)) throw new Error('Invalid clinical store payload');
    return { records: records as StudentRecord[], wasEncrypted: true };
  }
  if (!Array.isArray(envelope)) throw new Error('Unsupported clinical store format');
  return { records: envelope as StudentRecord[], wasEncrypted: false };
}

function loadPersistedStudents(): StudentRecord[] {
  const key = getStoreEncryptionKey();
  if (!key) {
    clinicalStoreReady = false;
    console.warn('Encrypted clinical persistence is disabled until CLINICAL_STORE_ENCRYPTION_KEY is configured.');
    return createSeededStudents();
  }

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    fs.chmodSync(DATA_DIR, 0o700);
    if (!fs.existsSync(STORE_PATH)) {
      const seeded = createSeededStudents();
      clinicalStoreReady = savePersistedStudents(seeded);
      return seeded;
    }

    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const decoded = decodeStudentRecords(raw, key);
    const cleaned = decoded.records.map((record) =>
      sanitizeStudentRecord({
        ...record,
        // Legacy plaintext records may have had consent defaulted by an older client.
        // Require consent to be captured again rather than treating that value as proof.
        guardianConsentGiven: decoded.wasEncrypted
          ? record.guardianConsentGiven === true
          : false,
      })
    );

    // Migrate a legacy plaintext JSON store on first startup with a valid key.
    if (!decoded.wasEncrypted && !savePersistedStudents(cleaned)) {
      clinicalStoreReady = false;
      console.warn('Legacy clinical store could not be migrated to encrypted storage.');
      return createSeededStudents();
    }
    clinicalStoreReady = true;
    return cleaned;
  } catch {
    clinicalStoreReady = false;
    console.warn('Failed to load the encrypted clinical store; protected persistence endpoints remain disabled.');
    return createSeededStudents();
  }
}

function savePersistedStudents(records: StudentRecord[]): boolean {
  const key = getStoreEncryptionKey();
  if (!key) return false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, encryptStudentRecords(records, key), {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.chmodSync(tmpPath, 0o600);
    fs.renameSync(tmpPath, STORE_PATH);
    fs.chmodSync(STORE_PATH, 0o600);
    return true;
  } catch {
    console.warn('Failed to persist the encrypted clinical store.');
    return false;
  }
}

// Role-Based Access Control (RBAC) Middleware for protecting child records & AI analysis
function requireClinicalAuth(requiredScope: ClinicalScope) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!isClinicalAuthConfigured() || !clinicalStoreReady || !securityStateReady) {
      res.status(503).json({
        error: 'يلزم إعداد الأسرار وتهيئة مخازن الطلاب والأمن المشفرة قبل تفعيل بيانات الطلاب.',
      });
      return;
    }
    const rawHeader =
      (req.headers.authorization as string) ||
      (req.headers['x-clinical-session-token'] as string) ||
      '';
    const verifiedSession = verifyClinicalSessionToken(rawHeader, CLINICAL_SESSION_SECRET);
    const revokedUntil = verifiedSession
      ? securityState.revokedSessions[verifiedSession.sessionId]
      : undefined;
    const activeSession = verifiedSession &&
      !(typeof revokedUntil === 'number' && revokedUntil > Date.now())
      ? verifiedSession
      : null;
    const authResult = authorizeSessionScope(activeSession, requiredScope);
    if (!authResult.allowed) {
      res.status(authResult.statusCode).json({
        error: authResult.errorAr,
        requiredScope,
      });
      return;
    }
    (req as any).clinicalSession = verifiedSession;
    next();
  };
}

// Persistent sliding-window limiter. Source IPs are interpreted after Express has applied
// only the explicitly configured trusted-proxy hop count.
function authRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const clientIp = req.ip || req.socket.remoteAddress || 'local';
  const result = consumePersistentRateLimit('auth', clientIp, 8, 60_000);
  if (!result.available) {
    res.status(503).json({ error: 'تعذر حفظ حالة الحماية؛ تسجيل الدخول متوقف مؤقتًا.' });
    return;
  }
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    res.status(429).json({
      error: 'محاولات تسجيل الدخول كثيرة. يرجى الانتظار قبل المحاولة مجددًا.',
    });
    return;
  }
  next();
}

// Persistent sliding-window limiter for paid AI endpoints.
function aiRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const clientIp = req.ip || req.socket.remoteAddress || 'local';
  const result = consumePersistentRateLimit('ai', clientIp, 20, 60_000);
  if (!result.available) {
    res.status(503).json({ error: 'تعذر حفظ حالة الحماية؛ خدمات التحليل متوقفة مؤقتًا.' });
    return;
  }
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    res.status(429).json({
      error: 'تم تجاوز عدد طلبات التحليل المسموح به. يرجى الانتظار قبل المحاولة مجددًا.',
    });
    return;
  }
  next();
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  app.set('trust proxy', readTrustedProxyHops());

  if (!initializeSecurityState()) {
    console.error('Encrypted security-state initialization failed; protected endpoints will return 503.');
  }
  app.use(express.json({ limit: '5mb' }));

  let studentsDb: StudentRecord[] = loadPersistedStudents();

  // Educator / Clinician Authentication & RBAC Session Issuing Endpoint
  app.post('/api/auth/session', authRateLimiter, (req, res) => {
    if (!isClinicalAuthConfigured()) {
      res.status(503).json({
        error: 'المصادقة غير مفعّلة: اضبط CLINICAL_TENANT_CREDENTIALS وCLINICAL_SESSION_SECRET وCLINICAL_STORE_ENCRYPTION_KEY.',
      });
      return;
    }
    const { accessCode, clinicianName = 'مستخدم بصيرة' } = req.body || {};
    if (typeof accessCode !== 'string') {
      res.status(401).json({ error: 'رمز الدخول غير صحيح أو غير مرتبط بصلاحيات مدرسة.' });
      return;
    }
    const credential = getTenantCredentialEntries().find(({ accessCode: expected }) =>
      constantTimeStringEqual(accessCode, expected)
    );
    if (!credential) {
      res.status(401).json({ error: 'رمز الدخول غير صحيح أو غير مرتبط بصلاحيات مدرسة.' });
      return;
    }

    const safeClinicianName =
      typeof clinicianName === 'string' ? clinicianName.trim().slice(0, 100) : '';
    const session = issueClinicalSessionToken(
      credential.role,
      safeClinicianName || (credential.role === 'clinician' ? 'أخصائي التقييم' : 'معلم'),
      CLINICAL_SESSION_SECRET,
      60 * 60 * 1000,
      credential.tenantId
    );
    if (!appendAuditEvent({
      tenantId: session.tenantId,
      sessionId: session.sessionId,
      role: session.role,
      actorLabel: session.clinicianName,
      action: 'auth.login',
      changedFields: [],
      outcome: 'success',
    })) {
      res.status(503).json({ error: 'تعذر تسجيل حدث الدخول في سجل التدقيق؛ لم تُصدر الجلسة.' });
      return;
    }
    res.json(session);
  });

  app.get(
    '/api/auth/session',
    requireClinicalAuth('students:read'),
    (req, res) => {
      res.json({ authenticated: true, session: (req as any).clinicalSession });
    }
  );

  app.post('/api/auth/logout', requireClinicalAuth('students:read'), (req, res) => {
    const session = (req as any).clinicalSession as VerifiedClinicalSession;
    const previousExpiry = securityState.revokedSessions[session.sessionId];
    const previousEvents = securityState.auditEvents;
    securityState.revokedSessions[session.sessionId] = session.expiresAt;
    securityState.auditEvents = [
      ...previousEvents,
      {
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId: session.tenantId,
        sessionId: session.sessionId,
        role: session.role,
        actorLabel: session.clinicianName,
        action: 'auth.logout',
        changedFields: [],
        outcome: 'success' as const,
      },
    ].slice(-5000);
    if (!persistSecurityState()) {
      if (previousExpiry === undefined) delete securityState.revokedSessions[session.sessionId];
      else securityState.revokedSessions[session.sessionId] = previousExpiry;
      securityState.auditEvents = previousEvents;
      res.status(503).json({ error: 'تعذر حفظ إبطال الجلسة؛ لم يؤكد الخادم تسجيل الخروج.' });
      return;
    }
    res.status(204).end();
  });

  // Each authenticated school sees only its own records.
  app.get('/api/students', requireClinicalAuth('students:read'), (req, res) => {
    const session = (req as any).clinicalSession as VerifiedClinicalSession;
    res.json({
      students: studentsDb.filter((student) => student.tenantId === session.tenantId),
      persisted: true,
      privacyPolicy: 'Tenant-scoped authenticated access; encrypted at rest',
    });
  });

  app.get('/api/audit-events', requireClinicalAuth('students:read'), (req, res) => {
    const session = (req as any).clinicalSession as VerifiedClinicalSession;
    if (session.role !== 'clinician') {
      res.status(403).json({ error: 'سجل التدقيق متاح للأخصائيين المخوّلين فقط.' });
      return;
    }
    const requestedLimit = Number(req.query.limit ?? 100);
    const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(200, requestedLimit)) : 100;
    const events = securityState.auditEvents
      .filter((event) => event.tenantId === session.tenantId)
      .slice(-limit)
      .reverse();
    res.json({ events, encryptedAtRest: true });
  });

  app.post(
    '/api/students',
    requireClinicalAuth('students:write'),
    (req, res) => {
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      const parsed = studentCreateEvidenceSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'بيانات إنشاء الملف أو أدلة القراءة غير صالحة.',
          issues: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })),
        });
        return;
      }
      const incoming = parsed.data;
      const existingId = studentsDb.find((student) => student.id === incoming.id);
      if (existingId && existingId.tenantId !== session.tenantId) {
        res.status(404).json({ error: 'تعذر إنشاء السجل بهذا المعرّف.' });
        return;
      }
      if (existingId) {
        res.status(409).json({ error: 'معرّف الطالب موجود بالفعل؛ رُفض استبدال سجل موجود.' });
        return;
      }

      const derived = deriveServerReadingMetrics(incoming, incoming.gradeLevel);
      if ('error' in derived) {
        res.status(derived.statusCode).json({ error: derived.error });
        return;
      }
      const { metrics, comprehensionScore, clinicalReport, oral } = derived;
      const now = new Date();
      const newRecord: StudentRecord = {
        id: incoming.id,
        name: incoming.name,
        schoolName: incoming.schoolName,
        tenantId: session.tenantId,
        isDemoRecord: false,
        sessionStatus: 'completed',
        sessionCompletedAt: now.toISOString(),
        sessionRoleLabel: 'جلسة فرز',
        assessmentHistory: [],
        gradeLevel: incoming.gradeLevel,
        ageYears: incoming.ageYears,
        lastScreenedDate: now.toLocaleString('ar-EG', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        }),
        passageId: incoming.passageId,
        dialectRegionAr: incoming.dialectRegionAr || incoming.dialectCode,
        dialectCode: incoming.dialectCode,
        readingDurationSeconds: incoming.readingDurationSeconds,
        guardianConsentGiven: true,
        guardianConsentRecordedAt: incoming.guardianConsentRecordedAt,
        guardianConsentSource: incoming.guardianConsentSource,
        guardianAudioConsentGiven: incoming.guardianAudioConsentGiven,
        guardianAudioConsentRecordedAt: incoming.guardianAudioConsentRecordedAt,
        speechRecognitionUsed: incoming.speechRecognitionUsed,
        wpm: metrics.wpm,
        avgFixationMs: metrics.avgFixationMs,
        regressionRate: metrics.regressionRate,
        regressionCount: metrics.regressionCount,
        blinkCount: metrics.blinkCount,
        blinksPerMinute: metrics.blinksPerMinute,
        visualStrainLevel: metrics.visualStrainLevel,
        visualStrainLabelAr: metrics.visualStrainLabelAr,
        gazeCoveragePercent: metrics.gazeCoveragePercent,
        observedWordCount: metrics.observedWordCount,
        totalPassageWordCount: metrics.totalPassageWordCount,
        calibrationAccuracyPercent: incoming.calibrationAccuracyPercent,
        calibrationValidationMethod: incoming.calibrationValidationMethod,
        oralReadingAssessed: Boolean(oral),
        spokenTranscript: incoming.spokenTranscript,
        oralWcpm: oral?.wcpm ?? null,
        oralAccuracyPercent: oral?.accuracyPercent ?? null,
        oralWerPercent: oral?.werPercent ?? null,
        phoneticSubstitutionCount: oral?.phoneticSubstitutionCount ?? 0,
        dialectVariantCount: oral?.dialectVariantCount ?? 0,
        omissionCount: oral?.omittedWordsCount ?? 0,
        dyslexiaRiskScore: metrics.dyslexiaRiskScore,
        readingHeuristicIndicator: metrics.heuristicIndicator,
        readingRiskLevel: metrics.riskLevel,
        readingRiskLabelAr: metrics.riskLabelAr,
        problematicWords: metrics.problematicWords,
        fixations: incoming.fixations as WordFixation[],
        comprehensionScore,
        dyscalculiaAssessed: false,
        subitizingAccuracy: null,
        avgSubitizingMs: null,
        numberLinePAE: null,
        transcodingAccuracy: null,
        reversalErrorCount: null,
        dyscalculiaRiskScore: null,
        mathHeuristicIndicator: null,
        mathRiskLevel: 'unassessed',
        mathRiskLabelAr: 'لم يجر اختبار الحساب بعد',
        clinicalReport,
      };
      const nextRecords = [newRecord, ...studentsDb];
      if (!savePersistedStudents(nextRecords)) {
        res.status(503).json({ error: 'تعذر حفظ السجل في التخزين المشفر.' });
        return;
      }
      if (!auditForRequest(req, 'student.create', newRecord.id, Object.keys(newRecord))) {
        if (!savePersistedStudents(studentsDb)) {
          studentsDb = nextRecords;
          console.error('Audit persistence failed and student-create rollback also failed.');
        }
        res.status(503).json({ error: 'تعذر تسجيل إنشاء السجل في سجل التدقيق المشفر.' });
        return;
      }
      studentsDb = nextRecords;
      res.status(201).json({ student: newRecord, persisted: true, scoring: 'server-derived' });
    }
  );

  // Store repeat screenings as sessions attached to the existing student identity.
  app.post(
    '/api/students/:id/sessions',
    requireClinicalAuth('students:write'),
    (req, res) => {
      const { id } = req.params;
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      const idx = studentsDb.findIndex((student) =>
        student.id === id && student.tenantId === session.tenantId
      );
      if (idx < 0) {
        res.status(404).json({ error: 'سجل الطالب غير موجود في هذه المدرسة.' });
        return;
      }
      const parsed = readingSessionEvidenceSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'بيانات جلسة المتابعة أو أدلة القراءة غير صالحة. لا تقبل نقاط الخطر المرسلة من العميل.',
          issues: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })),
        });
        return;
      }
      const incoming = parsed.data;
      const current = studentsDb[idx];
      const derived = deriveServerReadingMetrics(incoming, current.gradeLevel);
      if ('error' in derived) {
        res.status(derived.statusCode).json({ error: derived.error });
        return;
      }
      const { metrics, comprehensionScore, clinicalReport, oral } = derived;
      const now = new Date();
      const nowIso = now.toISOString();
      const previousSnapshot = current.sessionStatus === 'completed'
        ? {
            sessionId: `${current.id}-${current.sessionCompletedAt || current.lastScreenedDate || nowIso}`,
            completedAt: current.sessionCompletedAt || current.lastScreenedDate || nowIso,
            passageId: current.passageId,
            wpm: current.wpm,
            avgFixationMs: current.avgFixationMs,
            regressionRate: current.regressionRate,
            comprehensionScore: current.comprehensionScore,
            problematicWords: [...(current.problematicWords || [])],
            dyslexiaRiskScore: current.dyslexiaRiskScore,
            readingHeuristicIndicator: current.readingHeuristicIndicator,
            readingRiskLevel: current.readingRiskLevel,
            subitizingAccuracy: current.subitizingAccuracy,
            numberLinePAE: current.numberLinePAE,
            transcodingAccuracy: current.transcodingAccuracy,
            dyscalculiaRiskScore: current.dyscalculiaRiskScore,
            mathRiskLevel: current.mathRiskLevel,
          }
        : null;
      const updatedRecord: StudentRecord = {
        ...current,
        id: current.id,
        name: current.name,
        schoolName: current.schoolName,
        tenantId: current.tenantId,
        isDemoRecord: false,
        sessionStatus: 'completed',
        sessionCompletedAt: nowIso,
        lastScreenedDate: now.toLocaleString('ar-EG', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        }),
        passageId: incoming.passageId,
        dialectCode: incoming.dialectCode,
        dialectRegionAr: incoming.dialectRegionAr || incoming.dialectCode,
        readingDurationSeconds: incoming.readingDurationSeconds,
        guardianConsentGiven: true,
        guardianConsentRecordedAt: incoming.guardianConsentRecordedAt,
        guardianConsentSource: incoming.guardianConsentSource,
        guardianAudioConsentGiven: incoming.guardianAudioConsentGiven,
        guardianAudioConsentRecordedAt: incoming.guardianAudioConsentRecordedAt,
        speechRecognitionUsed: incoming.speechRecognitionUsed,
        spokenTranscript: incoming.spokenTranscript,
        blinkCount: metrics.blinkCount,
        blinksPerMinute: metrics.blinksPerMinute,
        visualStrainLevel: metrics.visualStrainLevel,
        visualStrainLabelAr: metrics.visualStrainLabelAr,
        wpm: metrics.wpm,
        avgFixationMs: metrics.avgFixationMs,
        regressionRate: metrics.regressionRate,
        regressionCount: metrics.regressionCount,
        gazeCoveragePercent: metrics.gazeCoveragePercent,
        observedWordCount: metrics.observedWordCount,
        totalPassageWordCount: metrics.totalPassageWordCount,
        calibrationAccuracyPercent: incoming.calibrationAccuracyPercent,
        calibrationValidationMethod: incoming.calibrationValidationMethod,
        oralReadingAssessed: Boolean(oral),
        oralWcpm: oral?.wcpm ?? null,
        oralAccuracyPercent: oral?.accuracyPercent ?? null,
        oralWerPercent: oral?.werPercent ?? null,
        phoneticSubstitutionCount: oral?.phoneticSubstitutionCount ?? 0,
        dialectVariantCount: oral?.dialectVariantCount ?? 0,
        omissionCount: oral?.omittedWordsCount ?? 0,
        dyslexiaRiskScore: metrics.dyslexiaRiskScore,
        readingHeuristicIndicator: metrics.heuristicIndicator,
        readingRiskLevel: metrics.riskLevel,
        readingRiskLabelAr: metrics.riskLabelAr,
        problematicWords: metrics.problematicWords,
        fixations: incoming.fixations as WordFixation[],
        comprehensionScore,
        clinicalReport,
        assessmentHistory: previousSnapshot
          ? [...(current.assessmentHistory || []), previousSnapshot]
          : [...(current.assessmentHistory || [])],
      };
      const nextRecords = [...studentsDb];
      nextRecords[idx] = updatedRecord;
      if (!savePersistedStudents(nextRecords)) {
        res.status(503).json({ error: 'تعذر حفظ جلسة المتابعة في التخزين المشفر.' });
        return;
      }
      if (!auditForRequest(req, 'student.session.complete', updatedRecord.id, [
        'readingEvidence',
        'wpm', 'dyslexiaRiskScore', 'readingRiskLevel', 'comprehensionScore',
      ])) {
        if (!savePersistedStudents(studentsDb)) {
          studentsDb = nextRecords;
          console.error('Audit persistence failed and repeat-session rollback also failed.');
        }
        res.status(503).json({ error: 'تعذر تسجيل جلسة المتابعة في سجل التدقيق المشفر.' });
        return;
      }
      studentsDb = nextRecords;
      res.status(200).json({ student: updatedRecord, persisted: true, scoring: 'server-derived' });
    }
  );

  app.post(
    '/api/students/:id/math-assessment',
    requireClinicalAuth('students:write'),
    (req, res) => {
      const { id } = req.params;
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      const idx = studentsDb.findIndex((student) =>
        student.id === id && student.tenantId === session.tenantId
      );
      if (idx < 0) {
        res.status(404).json({ error: 'سجل الطالب غير موجود في هذه المدرسة.' });
        return;
      }
      const parsed = mathAssessmentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'أدلة مهام الحساب غير صالحة؛ لم تُقبل أي درجة مشتقة من العميل.',
          issues: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })),
        });
        return;
      }

      const subitizingTrials: SubitizingTrialResult[] = parsed.data.subitizingTrials.map((trial) => ({
        dotCount: trial.dotCount,
        correct: trial.chosen === trial.dotCount,
        reactionTimeMs: trial.reactionTimeMs,
      }));
      const numberLineTrials: NumberLineTrialResult[] = parsed.data.numberLineTrials.map((trial) => ({ ...trial }));
      const reverseAnswers: Record<number, number> = { 47: 74, 83: 38, 69: 96 };
      const transcodingTrials: TranscodingTrialResult[] = parsed.data.transcodingTrials.map((trial) => ({
        targetNumber: trial.targetNumber,
        selectedNumber: trial.selectedNumber,
        isReversalError: reverseAnswers[trial.targetNumber] === trial.selectedNumber,
        reactionTimeMs: trial.reactionTimeMs,
      }));
      const computed = calculateDyscalculiaMetrics(subitizingTrials, numberLineTrials, transcodingTrials);
      const current = studentsDb[idx];
      const updatedRecord: StudentRecord = {
        ...current,
        dyscalculiaAssessed: true,
        subitizingAccuracy: computed.subitizingAccuracy,
        avgSubitizingMs: computed.avgSubitizingMs,
        numberLinePAE: computed.numberLinePAE,
        transcodingAccuracy: computed.transcodingAccuracy,
        reversalErrorCount: computed.reversalErrorCount,
        dyscalculiaRiskScore: computed.dyscalculiaRiskScore,
        mathHeuristicIndicator: computed.heuristicIndicator,
        mathRiskLevel: computed.riskLevel,
        mathRiskLabelAr: computed.riskLabelAr,
      };
      const nextRecords = [...studentsDb];
      nextRecords[idx] = updatedRecord;
      if (!savePersistedStudents(nextRecords)) {
        res.status(503).json({ error: 'تعذر حفظ نتيجة مهام الحساب في التخزين المشفر.' });
        return;
      }
      const derivedFields = [
        'dyscalculiaAssessed', 'subitizingAccuracy', 'avgSubitizingMs',
        'numberLinePAE', 'transcodingAccuracy', 'reversalErrorCount',
        'dyscalculiaRiskScore', 'mathHeuristicIndicator', 'mathRiskLevel', 'mathRiskLabelAr',
      ];
      if (!auditForRequest(req, 'student.math-assessment', id, derivedFields)) {
        if (!savePersistedStudents(studentsDb)) {
          studentsDb = nextRecords;
          console.error('Audit persistence failed and math-assessment rollback also failed.');
        }
        res.status(503).json({ error: 'تعذر تسجيل نتيجة الحساب في سجل التدقيق المشفر.' });
        return;
      }
      studentsDb = nextRecords;
      res.status(200).json({ student: updatedRecord, persisted: true, scoring: 'server-derived' });
    }
  );

  app.patch(
    '/api/students/:id',
    requireClinicalAuth('students:write'),
    (req, res) => {
      const { id } = req.params;
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      const idx = studentsDb.findIndex((student) => student.id === id && student.tenantId === session.tenantId);
      if (idx < 0) {
        res.status(404).json({ error: 'سجل الطالب غير موجود.' });
        return;
      }
      const parsed = studentPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'التحديث غير صالح أو يحاول تعديل نتائج مشتقة/حقول غير مسموحة.',
          issues: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })),
        });
        return;
      }

      const updates = parsed.data;
      const updatedRecord = { ...studentsDb[idx], ...updates };
      const nextRecords = [...studentsDb];
      nextRecords[idx] = updatedRecord;
      if (!savePersistedStudents(nextRecords)) {
        res.status(503).json({ error: 'تعذر حفظ السجل المشفر. تحقق من إعدادات التخزين وصلاحيات الملفات.' });
        return;
      }
      if (!auditForRequest(req, 'student.profile.update', id, Object.keys(updates))) {
        if (!savePersistedStudents(studentsDb)) {
          studentsDb = nextRecords;
          console.error('Audit persistence failed and profile-update rollback also failed.');
        }
        res.status(503).json({ error: 'تعذر تسجيل تعديل الملف في سجل التدقيق المشفر.' });
        return;
      }
      studentsDb = nextRecords;
      res.json({ student: updatedRecord, persisted: true });
    }
  );

  app.delete(
    '/api/students/:id',
    requireClinicalAuth('students:delete'),
    (req, res) => {
      const { id } = req.params;
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      const existsInTenant = studentsDb.some((s) => s.id === id && s.tenantId === session.tenantId);
      if (!existsInTenant) {
        res.status(404).json({ error: 'سجل الطالب غير موجود.' });
        return;
      }
      const nextRecords = studentsDb.filter((s) => !(s.id === id && s.tenantId === session.tenantId));
      if (!savePersistedStudents(nextRecords)) {
        res.status(503).json({ error: 'تعذر حفظ التغيير في التخزين المشفر.' });
        return;
      }
      if (!auditForRequest(req, 'student.delete', id, ['record'])) {
        if (!savePersistedStudents(studentsDb)) {
          studentsDb = nextRecords;
          console.error('Audit persistence failed and delete rollback also failed.');
        }
        res.status(503).json({ error: 'تعذر تسجيل حذف السجل في سجل التدقيق المشفر.' });
        return;
      }
      studentsDb = nextRecords;
      res.json({ deletedId: id, persisted: true });
    }
  );

  const wasmDir = path.join(
    __dirname,
    'node_modules',
    '@mediapipe',
    'tasks-vision',
    'wasm'
  );

  // Silence Emscripten stderr -> console.error mapping in MediaPipe WASM JS loaders
  // so C++ "INFO: Created TensorFlow Lite XNNPACK delegate for CPU." never triggers console.error
  app.get('/mediapipe-wasm/:filename', (req, res, next) => {
    const filename = path.basename(req.params.filename || '');
    if (!filename.endsWith('.js')) {
      next();
      return;
    }
    const filePath = path.join(wasmDir, filename);
    if (!fs.existsSync(filePath)) {
      next();
      return;
    }
    try {
      const rawJs = fs.readFileSync(filePath, 'utf8');
      const patchedJs = rawJs
        .replace(/console\.error\.bind\(console\)/g, '(() => {})')
        .replace(/console\.warn\.bind\(console\)/g, '(() => {})')
        .replace(/console\.warn\.apply\(console,\s*arguments\)/g, 'undefined');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(patchedJs);
    } catch {
      next();
    }
  });

  // Serve exact matching @mediapipe/tasks-vision WASM binaries locally for zero-latency 3D iris tracking
  app.use('/mediapipe-wasm', express.static(wasmDir));

  // Prevent the server from becoming an unauthenticated paid AI proxy.
  app.use('/api/ai', requireClinicalAuth('ai:analyze'), aiRateLimiter);

  // 1. Clinical AI Analysis of Eye-Tracking Dyslexia & Dyscalculia Screening
  // Enforces both RBAC Authentication ('ai:analyze') AND Strict Default-Deny Guardian Consent
  app.post(
    '/api/ai/analyze-session',
    requireClinicalAuth('ai:analyze'),
    async (req, res) => {
      const {
        studentName,
        guardianConsentGiven, // NO default `= true`! Must be explicitly verified as `=== true`
        guardianConsentRecordedAt,
        guardianConsentSource,
        guardianAudioConsentGiven,
        guardianAudioConsentRecordedAt,
        speechRecognitionUsed = false,
        gradeLevel,
        wpm,
        avgFixationMs,
        regressionRate,
        gazeCoveragePercent,
        observedWordCount,
        totalPassageWordCount,
        calibrationAccuracyPercent,
        problematicWords = [],
        oralReadingAssessed = false,
        oralAccuracyPercent = null,
        phoneticSubstitutionCount = 0,
        dialectVariantCount = 0,
        dyscalculiaAssessed = false,
        numberLinePAE = null,
        subitizingAccuracy = null,
        reversalErrorCount = null,
      } = req.body || {};

      if (
        typeof studentName !== 'string' ||
        !studentName.trim() ||
        studentName.length > 120 ||
        !Array.isArray(problematicWords)
      ) {
        res.status(400).json({ error: 'بيانات الجلسة غير مكتملة أو غير صالحة.' });
        return;
      }

      // Strict Default-Deny Consent Check: rejects missing (`undefined`), `null`, or `false`
      const consentValidation =
        validateExplicitGuardianConsent(guardianConsentGiven);
      const consentTimestampValid = typeof guardianConsentRecordedAt === 'string' &&
        Number.isFinite(Date.parse(guardianConsentRecordedAt));
      const consentSourceValid = typeof guardianConsentSource === 'string' &&
        guardianConsentSource.trim().length > 0;
      if (!consentValidation.valid || !consentTimestampValid || !consentSourceValid) {
        res.status(403).json({
          error: consentValidation.valid ? 'يلزم تسجيل وقت الموافقة ومصدرها قبل إنشاء التقرير.' : consentValidation.errorAr,
        });
        return;
      }
      if (speechRecognitionUsed === true && (
        guardianAudioConsentGiven !== true ||
        typeof guardianAudioConsentRecordedAt !== 'string' ||
        !Number.isFinite(Date.parse(guardianAudioConsentRecordedAt))
      )) {
        res.status(403).json({ error: 'استخدام التعرف الصوتي لا يتضمن موافقة صوتية منفصلة مسجلة.' });
        return;
      }

      const hasValidCoverage =
        typeof gazeCoveragePercent === 'number' &&
        typeof observedWordCount === 'number' &&
        typeof totalPassageWordCount === 'number' &&
        Number.isFinite(gazeCoveragePercent) &&
        Number.isFinite(observedWordCount) &&
        Number.isFinite(totalPassageWordCount) &&
        totalPassageWordCount > 0 &&
        observedWordCount >= 4 &&
        observedWordCount <= totalPassageWordCount &&
        gazeCoveragePercent >= 25 &&
        observedWordCount / totalPassageWordCount >= 0.25;
      if (!hasValidCoverage) {
        res.status(422).json({
          error: 'بيانات تتبع العين غير كافية لإصدار تقرير. يلزم رصد 4 كلمات على الأقل وتغطية 25% من النص دون تعويض اصطناعي.',
          reportBlocked: true,
        });
        return;
      }
      if (
        typeof calibrationAccuracyPercent !== 'number' ||
        !Number.isFinite(calibrationAccuracyPercent) ||
        calibrationAccuracyPercent < 70
      ) {
        res.status(422).json({
          error: 'دقة التحقق من معايرة الكاميرا منخفضة أو غير متاحة؛ تم حجب التقرير بدلاً من إصدار نتيجة غير موثوقة.',
          reportBlocked: true,
        });
        return;
      }

    // Child Privacy Protection: NEVER send the child's real name (`studentName`) to external Gemini API!
    // Use an anonymized token (`الطالب [معرّف الجلسة المشفّر #ANON]`) in the outbound LLM prompt.
    const anonymizedToken = 'الطالب [معرّف الجلسة المشفّر #ANON]';
    const ai = getGenAIClient();

    if (ai) {
      try {
        const oralContextLine = oralReadingAssessed
          ? `- تحليل القراءة الجهرية المنطوقة: دقة المطابقة ${oralAccuracyPercent}%، إبدالات فونولوجية ديسلكسية: ${phoneticSubstitutionCount}، بدائل لهجية مقبولة: ${dialectVariantCount}`
          : `- القراءة الجهرية: لم يتم تسجيل قراءة صوتية بالميكروفون في هذه الجلسة`;

        const mathContextLine =
          dyscalculiaAssessed && typeof numberLinePAE === 'number'
            ? `- نتائج فحص عسر الحساب (الديسكالكوليا): خطأ خط الأعداد (PAE) = ${numberLinePAE}%، دقة الإدراك الكمي الفوري = ${subitizingAccuracy}%، أخطاء عكس الأرقام = ${reversalErrorCount ?? 0}`
            : `- فحص عسر الحساب (الديسكالكوليا): لم يُجرَ اختبار الحساب في هذه الجلسة بعد (يجب عدم افتراض أي درجة حسابية)`;

        const prompt = `أنت خبير تربوي وإكلينيكي في الفرز الأولي الاسترشادي لصعوبات التعلم (عسر القراءة / الديسلكسيا وعسر الحساب / الديسكالكوليا) للطلاب العرب.
قم بتحليل مؤشرات الفرز الأولي التالية لـ "${anonymizedToken}" (الصف الدراسي: ${gradeLevel}) مع التأكيد أن هذه النتائج استرشادية أولية وليست تشخيصاً طبياً نهائياً:
- التغطية البصرية الفعلية للنص: ${gazeCoveragePercent}% (${observedWordCount ?? 'مرصود'}/${totalPassageWordCount ?? 'كلي'})
- سرعة القراءة الفعلية: ${wpm} كلمة/دقيقة
- متوسط زمن التثبيت البصري (Fixation Duration): ${avgFixationMs} مللي ثانية
- نسبة التراجع البصري (Regression Rate): ${regressionRate}%
- الكلمات التي شهدت أطول تثبيت بصري أو تعثر فونولوجي: ${problematicWords.join('، ') || 'لا يوجد'}
${oralContextLine}
${mathContextLine}

قدّم تقريراً إرشادياً وتربوياً دقيقاً باللغة العربية الفصحى الواضحة.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                clinicalSummary: {
                  type: Type.STRING,
                  description:
                    'ملخص استرشادي شامل لحالة الطالب القرائية والحسابية.',
                },
                ocularMotorAnalysis: {
                  type: Type.STRING,
                  description:
                    'تفسير دقيق لحركة العين المرصودة (التثبيتات البصرية والقفزات التراجعية).',
                },
                orthographicAndPhonologicalPatterns: {
                  type: Type.STRING,
                  description:
                    'تحليل الصعوبات الصرفية والصوتية في الكلمات العربية المتعثرة ونتائج القراءة الجهرية.',
                },
                dyscalculiaSpatialAnalysis: {
                  type: Type.STRING,
                  description:
                    'تحليل الإدراك الكمي أو توضيح أن اختبار الحساب لم يُجرَ بعد في حال عدم إتمامه.',
                },
                interventionExercises: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      durationMinutes: { type: Type.NUMBER },
                      description: { type: Type.STRING },
                    },
                    required: ['title', 'durationMinutes', 'description'],
                  },
                },
                classroomAccommodations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'clinicalSummary',
                'ocularMotorAnalysis',
                'orthographicAndPhonologicalPatterns',
                'dyscalculiaSpatialAnalysis',
                'interventionExercises',
                'classroomAccommodations',
              ],
            },
          },
        });

        const parsed = JSON.parse((response.text || '{}').trim());
        res.json({
          report: parsed,
          source: 'gemini-3.8-flash',
          piiAnonymized: true,
        });
        return;
      } catch (err: unknown) {
        console.warn('Gemini analyze-session fallback triggered:', err);
      }
    }

    // Deterministic heuristic analysis when API key is not configured or unreachable
    const highReadingRisk = avgFixationMs > 350 || regressionRate > 22;
    const isMathTested =
      dyscalculiaAssessed && typeof numberLinePAE === 'number';
    const highMathRisk =
      isMathTested &&
      ((numberLinePAE ?? 0) > 12 || (reversalErrorCount ?? 0) > 0);

    const oralText = oralReadingAssessed
      ? ` أظهر تحليل القراءة الجهرية دقة مطابقة فونولوجية ${oralAccuracyPercent}% (إبدالات ديسلكسية: ${phoneticSubstitutionCount}، بدائل لهجية مقبولة: ${dialectVariantCount}).`
      : '';

    res.json({
      source: 'clinical-engine',
      piiAnonymized: true,
      report: {
        clinicalSummary: `[مؤشر فرز أولي استرشادي] يُظهر الفحص البصري للطالب (${studentName} - الصف ${gradeLevel}) بتغطية رصد فعلية ${gazeCoveragePercent}% سرعة قراءة تبلغ ${wpm} كلمة/دقيقة مع متوسط تثبيت بصري قدره ${avgFixationMs} مللي ثانية ونسبة تراجع بصري ${regressionRate}%.${oralText} ${
          highReadingRisk
            ? 'تشير هذه المؤشرات الاسترشادية إلى جهد بصري مرتفع في فك الترميز الصوتي والصرفي للكلمات العربية متعددة المقاطع ويوصى بعرضها على أخصائي صعوبات تعلم معتمد.'
            : 'تقع مؤشرات الطلاقة القرائية وحركة العين المرصودة ضمن النطاق الاسترشادي الطبيعي المتوقع للمرحلة العمرية.'
        }`,
        ocularMotorAnalysis: `سجلت الكاميرا متوسط زمن تثبيت ${avgFixationMs}ms على الكلمات المرصودة فعلياً مقارنة بالمعيار الاسترشادي (220-260ms)، مع نسبة قفزات تراجعية (Regressions) بلغت ${regressionRate}%. ${
          problematicWords.length > 0
            ? `تركزت أطول فترات التوقف البصري أو التعثر النطقي عند الكلمات: (${problematicWords.join('، ')}) مما يعكس حاجة العين لإعادة المسح البصري للتمييز بين الحروف المتشابهة رسماً.`
            : 'انتقلت العين بسلاسة من اليمين إلى اليسار عبر الكلمات المرصودة دون تراجعات غير اعتيادية.'
        }`,
        orthographicAndPhonologicalPatterns: `${
          highReadingRisk
            ? 'يُلاحظ بطء في معالجة الكلمات التي تشتمل على حروف متجانسة نقطياً (ب/ت/ث، ج/ح/خ) والمقاطع المشددة أو المنتهية بتنوين، مما يستدعي تفعيل التقطيع المقطعي الملون.'
            : 'قدرة جيدة على الربط بين الرسم الإملائي والتمثيل الصوتي للمقاطع العربية المشكّلة.'
        }${oralText}`,
        dyscalculiaSpatialAnalysis: !isMathTested
          ? 'لم يخضع الطالب لاختبار عسر الحساب (الديسكالكوليا) في هذه الجلسة بعد — لا يقوم النظام بتسجيل درجات حسابية افتراضية قبل إتمام الاختبارات الثلاثة في تبويب «مختبر فحص الديسكالكوليا والحساب».'
          : highMathRisk
            ? `بلغ معدل الخطأ المطلق في خط الأعداد (PAE) ${numberLinePAE}% مع رصد ${reversalErrorCount} أخطاء في ترتيب الآحاد والعشرات، مما يدل على حاجة لتدريب الحس المكاني للأعداد والربط البصري-الكمي.`
            : `أداء متوازن في الإدراك الكمي الفوري (${subitizingAccuracy}%) وتمثيل خط الأعداد الذهني بنسبة خطأ منخفضة (${numberLinePAE}%).`,
        interventionExercises: [
          {
            title: 'تدريب التتبع الإيقاعي بالمقاطع الملونة',
            durationMinutes: 10,
            description: `قراءة فقرات قصيرة مع تفعيل المسطرة البصرية وتقسيم الكلمات المتعثرة (${problematicWords.slice(0, 3).join('، ') || 'الكلمات المركبة'}) إلى مقاطع صوتية ملونة.`,
          },
          {
            title: 'تمييز الحروف المتشابهة بصرياً ونقطياً',
            durationMinutes: 8,
            description:
              'تدريب بصري سريع للتفريق بين (ب/ت/ث/ن) و(ج/ح/خ) داخل سياق جمل مشكّلة.',
          },
          {
            title: 'مختبر خط الأعداد والتمثيل المكاني (0-100)',
            durationMinutes: 10,
            description:
              'ربط الكميات النقطية بموقعها المكاني على خط الأعداد ومعالجة التبديل بين الآحاد والعشرات في العربية.',
          },
        ],
        classroomAccommodations: [
          'استخدام خط عربي واضح وكبير (Readex Pro أو IBM Plex Sans Arabic) مع تباعد أسطر 1.8.',
          'تزويد الطالب بالمسطرة البصرية لعزل السطر المقروء ومنع القفز بين الأسطر.',
          'إخلاء مسؤولية إكلينيكي: هذه النتائج تمثل مؤشرات فرز أولية استرشادية ولا تُعد تشخيصاً طبياً رسمياً إلا بعد اعتمادها من أخصائي معتمد.',
        ],
      },
    });
  });

  // 2. AI Text Adaptation & Morphological Breakdown for Smart Dyslexia Reader
  app.post('/api/ai/adapt-text', async (req, res) => {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim() || text.length > 20000) {
      res.status(400).json({ error: 'يرجى إدخال نص صالح لا يتجاوز 20,000 حرف لتحليله وتبسيطه.' });
      return;
    }

    const ai = getGenAIClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `قم بتبسيط النص العربي التالي ليكون سهل القراءة للطلاب المصابين بعسر القراءة (الديسلكسيا)، مع تشكيل الكلمات الأساسية وتفكيك أصعب 4 كلمات إلى مقاطعها الصوتية وجذرها ومعناها المبسط:
النص: "${text}"`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                simplifiedText: {
                  type: Type.STRING,
                  description: 'نسخة مبسطة ومشكّلة بوضوح بجمل قصيرة ومباشرة.',
                },
                keyIdea: {
                  type: Type.STRING,
                  description: 'الفكرة الرئيسية للنص في جملة واحدة واضحة.',
                },
                wordBreakdowns: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      syllables: { type: Type.STRING },
                      root: { type: Type.STRING },
                      meaning: { type: Type.STRING },
                    },
                    required: ['word', 'syllables', 'root', 'meaning'],
                  },
                },
              },
              required: ['simplifiedText', 'keyIdea', 'wordBreakdowns'],
            },
          },
        });

        const parsed = JSON.parse((response.text || '{}').trim());
        res.json({ adaptation: parsed, source: 'gemini-3.8-flash' });
        return;
      } catch (err) {
        console.warn('Gemini adapt-text fallback triggered:', err);
      }
    }

    // Deterministic morphological adaptation fallback
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .slice(0, 4);

    res.json({
      source: 'morphological-engine',
      adaptation: {
        simplifiedText: text,
        keyIdea: 'يدور هذا النص حول تنمية المهارات المعرفية والملاحظة الدقيقة لفهم الظواهر المحيطة بنا بوضوح.',
        wordBreakdowns: words.map((w) => {
          const clean = w.replace(/[،.؟!]/g, '');
          return {
            word: clean,
            syllables: clean.length > 4 ? `${clean.slice(0, 2)} · ${clean.slice(2, 4)} · ${clean.slice(4)}` : `${clean.slice(0, 2)} · ${clean.slice(2)}`,
            root: clean.replace(/^ال/, '').slice(0, 3).split('').join(' - '),
            meaning: 'مفردة أساسية في سياق الجملة تساعد على توضيح المعنى العام.',
          };
        }),
      },
    });
  });

  // 3. Gemini Text-to-Speech (gemini-3.8-flash-lite-tts) for Auditory Support
  app.post('/api/ai/tts', async (req, res) => {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim() || text.length > 8000) {
      res.status(400).json({ error: 'يلزم إدخال نص صالح لا يتجاوز 8,000 حرف لتحويله إلى صوت.' });
      return;
    }

    const ai = getGenAIClient();
    if (!ai) {
      res.status(503).json({
        error: 'خدمة الصوت السحابية غير مفعلة حالياً، سيتم استخدام القارئ الصوتي المحلي للمتصفح.',
        useBrowserFallback: true,
      });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `اقرأ النص العربي التالي بوضوح وهدوء وتأنٍ مناسب لطالب يتدرب على القراءة: ${text}`,
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
        return;
      }
      res.status(503).json({ useBrowserFallback: true });
    } catch (err) {
      console.warn('Gemini TTS error:', err);
      res.status(503).json({ useBrowserFallback: true });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Baseera Clinical Server running on http://localhost:${PORT}`);
  });
}

startServer();
