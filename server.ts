import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { generateAdaptiveRemediationPlan } from './src/utils/remediationEngine';
import { INITIAL_STUDENTS, StudentRecord } from './src/data/seedData';
import {
  ClinicalRole,
  ClinicalScope,
  AuthFailureBucket,
  issueClinicalSessionToken,
  verifyClinicalSessionToken,
  authorizeSessionScope,
  validateExplicitGuardianConsent,
  VerifiedClinicalSession,
  parseStrictTrustProxyHops,
  stripArabicPatronymics,
  formatTenantDisplayNameAr,
  checkAuthFailureLimit,
  getAuthBucketKey,
  recordFailedAuthAttempt,
  getAuthThrottleDelayMs,
  isStrongClinicalAccessCode,
  StudentProfilePatchSchema,
  ClinicalReportUpdateEnvelopeSchema,
  validateAndDeriveMathTrials,
  validateAndDeriveSessionFromEvidence,
  buildDeterministicClinicalReport,
} from './src/utils/clinicalSecurity';

dotenv.config();

// Fail-fast validation of TRUST_PROXY_HOPS before starting the server
const TRUST_PROXY_HOPS = parseStrictTrustProxyHops(
  process.env.TRUST_PROXY_HOPS
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.CLINICAL_DATA_DIR
  ? path.resolve(process.env.CLINICAL_DATA_DIR)
  : path.join(__dirname, '.runtime-store');
const STORE_PATH = path.join(DATA_DIR, 'clinical-store.json');
const SECURITY_STATE_PATH = path.join(DATA_DIR, 'security-state.json');

let clinicalStoreReady = false;
let securityStateReady = false;

const CLINICAL_SESSION_SECRET = (
  process.env.CLINICAL_SESSION_SECRET || ''
).trim();

export interface ClinicalAuditLogEntry {
  eventId: string;
  timestamp: string;
  tenantId: string;
  actorRole: ClinicalRole;
  sessionId: string;
  action:
    | 'student.create'
    | 'student.session.append'
    | 'student.math.assess'
    | 'student.report.update'
    | 'student.profile.patch'
    | 'student.delete';
  targetStudentId: string;
  changedFields: string[];
}

interface PersistedSecurityState {
  revokedSessions: Record<string, number>;
  failedAuthBuckets: Record<string, AuthFailureBucket>;
  aiRateBuckets: Record<string, number[]>;
  auditLogs: ClinicalAuditLogEntry[];
}

const REVOKED_CLINICAL_SESSIONS = new Map<string, number>();
const failedAuthBuckets = new Map<string, AuthFailureBucket>();
const aiRateLimitBuckets = new Map<string, number[]>();
// Invalid login attempts are serialized per IP so parallel requests cannot all
// pass through an empty failure bucket at once. Valid credentials use a priority
// path with a short delay, so an attacker cannot queue them behind a long backlog.
const authAttemptTails = new Map<string, Promise<void>>();
const pendingAuthAttempts = new Map<string, number>();
const MAX_PENDING_AUTH_ATTEMPTS_PER_IP = 16;
let auditLogsDb: ClinicalAuditLogEntry[] = [];

interface TenantCredential {
  tenantId: string;
  tenantDisplayNameAr: string;
  role: ClinicalRole;
  accessCode: string;
}

/** Role and tenant are derived from an independently provisioned secret, never from request claims. */
function getTenantCredentialEntries(): TenantCredential[] {
  const raw = (process.env.CLINICAL_TENANT_CREDENTIALS || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return [];
    const entries: TenantCredential[] = [];
    const seenCodes = new Set<string>();
    for (const [tenantId, value] of Object.entries(parsed)) {
      if (
        !/^[a-zA-Z0-9_-]{1,80}$/.test(tenantId) ||
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value)
      )
        return [];
      const credentials = value as Record<string, unknown>;
      const customSchoolName =
        typeof credentials.schoolName === 'string'
          ? credentials.schoolName
          : typeof credentials.displayNameAr === 'string'
            ? credentials.displayNameAr
            : undefined;
      const tenantDisplayNameAr = formatTenantDisplayNameAr(
        tenantId,
        customSchoolName
      );
      for (const role of ['clinician', 'educator_readonly'] as const) {
        const accessCode = credentials[role];
        if (
          !isStrongClinicalAccessCode(accessCode) ||
          seenCodes.has(accessCode)
        )
          return [];
        seenCodes.add(accessCode);
        entries.push({
          tenantId,
          tenantDisplayNameAr,
          role,
          accessCode,
        });
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
  const storeKeyHex = (process.env.CLINICAL_STORE_ENCRYPTION_KEY || '')
    .trim()
    .toLowerCase();
  const credentials = getTenantCredentialEntries();
  return (
    credentials.length >= 2 &&
    CLINICAL_SESSION_SECRET.length >= 32 &&
    CLINICAL_SESSION_SECRET !== 'baseera-rbac-hmac-secret-key-2026' &&
    CLINICAL_SESSION_SECRET !== storeKeyHex &&
    !credentials.some(
      ({ accessCode }) =>
        accessCode === CLINICAL_SESSION_SECRET ||
        accessCode === storeKeyHex ||
        accessCode === 'BASEERA-CLINICAL-2026'
    ) &&
    getStoreEncryptionKey() !== null
  );
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hasForbiddenPrototypeKeys(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const protoKeys = ['__proto__', 'constructor', 'prototype'];
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (protoKeys.includes(key)) return true;
    const child = (input as Record<string, unknown>)[key];
    if (child && typeof child === 'object' && hasForbiddenPrototypeKeys(child)) {
      return true;
    }
  }
  return false;
}

function sanitizeStudentRecord(s: StudentRecord): StudentRecord {
  const legacy = s as StudentRecord & {
    readingPercentile?: number;
    mathPercentile?: number;
  };
  const normalized = {
    ...s,
    guardianConsentGiven: s.isDemoRecord ? false : s.guardianConsentGiven,
    evidenceProvenance: s.isDemoRecord
      ? 'demo-synthetic'
      : (s.evidenceProvenance ?? 'client-reported'),
    evidenceProvenanceLabelAr: s.isDemoRecord
      ? 'نموذج توضيحي اصطناعي (غير مخصص للتشخيص)'
      : (s.evidenceProvenanceLabelAr ??
        'أدلة مُبلَّغ بها من العميل (اجتازت فحوص المعقولية الحسابية)'),
    readingHeuristicIndicator:
      s.readingHeuristicIndicator ??
      (typeof legacy.readingPercentile === 'number'
        ? legacy.readingPercentile
        : 50),
    mathHeuristicIndicator:
      s.mathHeuristicIndicator ??
      (typeof legacy.mathPercentile === 'number'
        ? legacy.mathPercentile
        : null),
  } as StudentRecord & {
    readingPercentile?: number;
    mathPercentile?: number;
  };
  delete normalized.readingPercentile;
  delete normalized.mathPercentile;

  const cleanName = (normalized.name || '').trim().replace(/\s+/g, ' ');
  const cleanSchool = (normalized.schoolName || '').trim();
  const cleanSummary = normalized.clinicalReport?.clinicalSummary
    ? normalized.clinicalReport.clinicalSummary
        .replace(/^\[سجل تجريبي توضيحي[^\]]*\]\s*/g, '')
        .trim()
    : '';
  return {
    ...normalized,
    name: cleanName,
    schoolName: cleanSchool,
    clinicalReport: normalized.clinicalReport
      ? {
          ...normalized.clinicalReport,
          clinicalSummary:
            cleanSummary || normalized.clinicalReport.clinicalSummary,
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

function encryptJsonPayload(
  payload: unknown,
  key: Buffer,
  formatTag = 'baseera-aes-256-gcm-v1'
): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return JSON.stringify({
    format: formatTag,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
}

function decryptJsonPayload<T>(
  raw: string,
  key: Buffer,
  expectedFormat = 'baseera-aes-256-gcm-v1'
): { data: T; wasEncrypted: boolean } {
  const envelope = JSON.parse(raw);
  if (envelope?.format === expectedFormat) {
    const iv = Buffer.from(String(envelope.iv || ''), 'base64');
    const tag = Buffer.from(String(envelope.tag || ''), 'base64');
    const ciphertext = Buffer.from(String(envelope.ciphertext || ''), 'base64');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new Error('Invalid encrypted store envelope');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
    return { data: JSON.parse(plaintext) as T, wasEncrypted: true };
  }
  return { data: envelope as T, wasEncrypted: false };
}

function writeEncryptedFileAtomic(
  targetPath: string,
  encryptedContent: string
): boolean {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    fs.chmodSync(DATA_DIR, 0o700);
    const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, encryptedContent, {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.chmodSync(tmpPath, 0o600);
    fs.renameSync(tmpPath, targetPath);
    fs.chmodSync(targetPath, 0o600);
    return true;
  } catch {
    return false;
  }
}

function savePersistedStudents(records: StudentRecord[]): boolean {
  const key = getStoreEncryptionKey();
  if (!key) return false;
  const ok = writeEncryptedFileAtomic(
    STORE_PATH,
    encryptJsonPayload(records, key, 'baseera-aes-256-gcm-v1')
  );
  if (!ok) {
    console.warn('Failed to persist the encrypted clinical store.');
  }
  return ok;
}

function loadPersistedStudents(): StudentRecord[] {
  const key = getStoreEncryptionKey();
  if (!key) {
    clinicalStoreReady = false;
    console.warn(
      'Encrypted clinical persistence is disabled until CLINICAL_STORE_ENCRYPTION_KEY is configured.'
    );
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
    const decoded = decryptJsonPayload<StudentRecord[]>(
      raw,
      key,
      'baseera-aes-256-gcm-v1'
    );
    if (!Array.isArray(decoded.data)) {
      throw new Error('Invalid clinical store payload');
    }
    const cleaned = decoded.data.map((record) =>
      sanitizeStudentRecord({
        ...record,
        guardianConsentGiven: decoded.wasEncrypted
          ? record.guardianConsentGiven === true
          : false,
      })
    );

    if (!decoded.wasEncrypted && !savePersistedStudents(cleaned)) {
      clinicalStoreReady = false;
      console.warn(
        'Legacy clinical store could not be migrated to encrypted storage.'
      );
      return createSeededStudents();
    }
    clinicalStoreReady = true;
    return cleaned;
  } catch {
    clinicalStoreReady = false;
    console.warn(
      'Failed to load the encrypted clinical store; protected persistence endpoints remain disabled.'
    );
    return createSeededStudents();
  }
}

function serializeSecurityState(): PersistedSecurityState {
  const now = Date.now();
  const revokedSessions: Record<string, number> = {};
  for (const [sid, exp] of REVOKED_CLINICAL_SESSIONS.entries()) {
    if (exp > now) revokedSessions[sid] = exp;
  }
  const failedAuth: Record<string, AuthFailureBucket> = {};
  for (const [k, bucket] of failedAuthBuckets.entries()) {
    const recent = bucket.failures.filter((ts) => now - ts < 60_000);
    if (recent.length > 0 || bucket.lockedUntilMs > now) {
      failedAuth[k] = {
        failures: recent,
        lockedUntilMs: bucket.lockedUntilMs,
      };
    }
  }
  const aiBuckets: Record<string, number[]> = {};
  for (const [ip, timestamps] of aiRateLimitBuckets.entries()) {
    const recent = timestamps.filter((ts) => now - ts < 60_000);
    if (recent.length > 0) aiBuckets[ip] = recent;
  }
  return {
    revokedSessions,
    failedAuthBuckets: failedAuth,
    aiRateBuckets: aiBuckets,
    auditLogs: auditLogsDb,
  };
}

function saveSecurityState(): boolean {
  const key = getStoreEncryptionKey();
  if (!key) return false;
  const ok = writeEncryptedFileAtomic(
    SECURITY_STATE_PATH,
    encryptJsonPayload(
      serializeSecurityState(),
      key,
      'baseera-security-state-aes-256-gcm-v1'
    )
  );
  if (!ok) {
    console.warn('Failed to persist encrypted security-state.json.');
  }
  return ok;
}

function loadSecurityState(): void {
  const key = getStoreEncryptionKey();
  if (!key) {
    securityStateReady = false;
    return;
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    fs.chmodSync(DATA_DIR, 0o700);
    if (!fs.existsSync(SECURITY_STATE_PATH)) {
      securityStateReady = saveSecurityState();
      return;
    }
    const raw = fs.readFileSync(SECURITY_STATE_PATH, 'utf8');
    const decoded = decryptJsonPayload<PersistedSecurityState>(
      raw,
      key,
      'baseera-security-state-aes-256-gcm-v1'
    );
    if (!decoded.wasEncrypted || !decoded.data || typeof decoded.data !== 'object') {
      throw new Error('Invalid security state envelope');
    }
    const now = Date.now();
    REVOKED_CLINICAL_SESSIONS.clear();
    for (const [sid, exp] of Object.entries(
      decoded.data.revokedSessions || {}
    )) {
      if (typeof exp === 'number' && exp > now) {
        REVOKED_CLINICAL_SESSIONS.set(sid, exp);
      }
    }
    failedAuthBuckets.clear();
    // Migrate legacy IP+tenant keys to one IP-only bucket per client address.
    for (const [legacyKey, bucket] of Object.entries(decoded.data.failedAuthBuckets || {})) {
      if (!bucket || !Array.isArray(bucket.failures)) continue;
      const separator = legacyKey.lastIndexOf('::');
      const clientIp = separator >= 0 ? legacyKey.slice(0, separator) : legacyKey;
      const unifiedKey = getAuthBucketKey(clientIp);
      const recent = bucket.failures.filter((ts) => typeof ts === 'number' && now - ts < 60_000);
      const lockedUntilMs = typeof bucket.lockedUntilMs === 'number' ? bucket.lockedUntilMs : 0;
      if (recent.length === 0 && lockedUntilMs <= now) continue;
      const existing = failedAuthBuckets.get(unifiedKey);
      const mergedFailures = [...(existing?.failures || []), ...recent].sort((a, b) => a - b).slice(-10);
      failedAuthBuckets.delete(unifiedKey);
      failedAuthBuckets.set(unifiedKey, {
        failures: mergedFailures,
        lockedUntilMs: Math.max(existing?.lockedUntilMs || 0, lockedUntilMs),
      });
      while (failedAuthBuckets.size > 5_000) {
        const oldestKey = failedAuthBuckets.keys().next().value;
        if (oldestKey === undefined) break;
        failedAuthBuckets.delete(oldestKey);
      }
    }
    aiRateLimitBuckets.clear();
    for (const [ip, list] of Object.entries(decoded.data.aiRateBuckets || {})) {
      if (Array.isArray(list)) {
        const recent = list.filter(
          (ts) => typeof ts === 'number' && now - ts < 60_000
        );
        if (recent.length > 0) aiRateLimitBuckets.set(ip, recent);
      }
    }
    auditLogsDb = Array.isArray(decoded.data.auditLogs)
      ? decoded.data.auditLogs
      : [];
    securityStateReady = true;
  } catch {
    securityStateReady = false;
    console.warn('Failed to load encrypted security-state.json.');
  }
}

/**
 * Atomically persists both the student database and a non-PII audit log entry.
 * If either write fails, rolls back in-memory state and returns false.
 */
function commitStudentMutationWithAudit(
  currentStudents: StudentRecord[],
  nextStudents: StudentRecord[],
  session: VerifiedClinicalSession,
  action: ClinicalAuditLogEntry['action'],
  targetStudentId: string,
  changedFields: string[]
): { ok: boolean; students: StudentRecord[] } {
  const prevAuditLogs = auditLogsDb;
  const entry: ClinicalAuditLogEntry = {
    eventId: `aud-${crypto.randomBytes(12).toString('hex')}`,
    timestamp: new Date().toISOString(),
    tenantId: session.tenantId,
    actorRole: session.role,
    sessionId: session.sessionId,
    action,
    targetStudentId,
    changedFields,
  };
  auditLogsDb = [entry, ...auditLogsDb];

  if (!saveSecurityState()) {
    auditLogsDb = prevAuditLogs;
    return { ok: false, students: currentStudents };
  }
  if (!savePersistedStudents(nextStudents)) {
    auditLogsDb = prevAuditLogs;
    saveSecurityState();
    return { ok: false, students: currentStudents };
  }
  return { ok: true, students: nextStudents };
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
        error:
          'يلزم ضبط الأسرار وتهيئة مخزن سريري مشفر قابل للقراءة والكتابة قبل تفعيل بيانات الطلاب.',
      });
      return;
    }
    const rawHeader =
      (req.headers.authorization as string) ||
      (req.headers['x-clinical-session-token'] as string) ||
      '';
    const verifiedSession = verifyClinicalSessionToken(
      rawHeader,
      CLINICAL_SESSION_SECRET
    );
    const now = Date.now();
    for (const [sessionId, expiresAt] of REVOKED_CLINICAL_SESSIONS) {
      if (expiresAt <= now) REVOKED_CLINICAL_SESSIONS.delete(sessionId);
    }
    const activeSession =
      verifiedSession &&
      !REVOKED_CLINICAL_SESSIONS.has(verifiedSession.sessionId)
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
    (req as any).clinicalSession = activeSession;
    next();
  };
}

// Sliding-window rate limiter to protect external AI endpoints (/api/ai/*)
function aiRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const clientIp = req.ip || req.socket.remoteAddress || 'local';
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequestsPerMinute = 20;

  const history = (aiRateLimitBuckets.get(clientIp) || []).filter(
    (ts) => now - ts < windowMs
  );
  if (history.length >= maxRequestsPerMinute) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({
      error:
        'تم تجاوز الحد الأقصى لطلبات الذكاء الاصطناعي في الدقيقة لحماية الخدمة. يرجى المحاولة بعد قليل.',
    });
    return;
  }
  history.push(now);
  aiRateLimitBuckets.set(clientIp, history);
  saveSecurityState();
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

  if (TRUST_PROXY_HOPS > 0) {
    app.set('trust proxy', TRUST_PROXY_HOPS);
  } else {
    app.set('trust proxy', false);
  }

  app.use(express.json({ limit: '5mb' }));

  let studentsDb: StudentRecord[] = loadPersistedStudents();
  loadSecurityState();

  // Educator / Clinician Authentication & RBAC Session Issuing Endpoint.
  // Failed attempts are IP-scoped; unauthenticated tenant hints never influence throttling.
  app.post('/api/auth/session', async (req, res) => {
    if (!isClinicalAuthConfigured() || !clinicalStoreReady || !securityStateReady) {
      res.status(503).json({
        error:
          'المصادقة غير مفعّلة: اضبط CLINICAL_TENANT_CREDENTIALS وCLINICAL_SESSION_SECRET وCLINICAL_STORE_ENCRYPTION_KEY.',
      });
      return;
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'local';
    const { accessCode, clinicianName = 'مستخدم بصيرة' } = req.body || {};
    const credential =
      typeof accessCode === 'string'
        ? getTenantCredentialEntries().find(({ accessCode: expected }) =>
            constantTimeStringEqual(accessCode, expected)
          )
        : undefined;

    if (credential) {
      // Priority path: valid credentials are never rejected just because an
      // attacker has filled the invalid-attempt queue for this IP.
      const pending = pendingAuthAttempts.get(clientIp) || 0;
      const throttleDelayMs = Math.max(
        getAuthThrottleDelayMs(failedAuthBuckets, clientIp, undefined, Date.now()),
        pending > 0 ? 2_000 : 0
      );
      if (throttleDelayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, throttleDelayMs));
      }

      // A successful authentication does not clear prior failures. The IP-wide
      // rolling window expires them naturally, even if credentials for different
      // schools are successfully used from the same address.

      const safeClinicianName =
        typeof clinicianName === 'string'
          ? clinicianName.trim().slice(0, 100)
          : '';
      const session = issueClinicalSessionToken(
        credential.role,
        safeClinicianName ||
          (credential.role === 'clinician' ? 'أخصائي التقييم' : 'معلم'),
        CLINICAL_SESSION_SECRET,
        60 * 60 * 1000,
        credential.tenantId,
        credential.tenantDisplayNameAr
      );
      res.json(session);
      return;
    }

    // Keep a small, serialized invalid-attempt queue. Excess bursts get 429,
    // but they cannot consume the valid-credential priority path above.
    const pending = pendingAuthAttempts.get(clientIp) || 0;
    if (pending >= MAX_PENDING_AUTH_ATTEMPTS_PER_IP) {
      res.setHeader('Retry-After', '1');
      res.status(429).json({
        error: 'طلبات تسجيل الدخول المتزامنة كثيرة. يرجى الانتظار ثم المحاولة مجدداً.',
        retryAfterSeconds: 1,
      });
      return;
    }

    const previous = authAttemptTails.get(clientIp) || Promise.resolve();
    let releaseQueueSlot!: () => void;
    const queueSlot = new Promise<void>((resolve) => {
      releaseQueueSlot = resolve;
    });
    const tail = previous.then(() => queueSlot);
    authAttemptTails.set(clientIp, tail);
    pendingAuthAttempts.set(clientIp, pending + 1);

    await previous;
    try {
      const throttleDelayMs = getAuthThrottleDelayMs(
        failedAuthBuckets,
        clientIp,
        undefined,
        Date.now()
      );
      if (throttleDelayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, throttleDelayMs));
      }

      const now = Date.now();
      const preCheck = checkAuthFailureLimit(failedAuthBuckets, clientIp, undefined, now);
      if (!preCheck.allowed) {
        res.setHeader('Retry-After', String(preCheck.retryAfterSeconds));
        res.status(429).json({
          error:
            'محاولات تسجيل الدخول الفاشلة كثيرة. يرجى الانتظار قبل المحاولة مجدداً.',
          retryAfterSeconds: preCheck.retryAfterSeconds,
        });
        return;
      }

      const failStatus = recordFailedAuthAttempt(failedAuthBuckets, clientIp, undefined, Date.now());
      if (!saveSecurityState()) {
        res.status(503).json({
          error: 'تعذر حفظ حالة الأمان المشفرة؛ تم إيقاف المصادقة مؤقتاً.',
        });
        return;
      }
      if (failStatus.backoffMs > 0) {
        res.setHeader('Retry-After', String(failStatus.retryAfterSeconds));
      }
      res.status(401).json({
        error: 'رمز الدخول غير صحيح أو غير مرتبط بصلاحيات مدرسة.',
      });
    } finally {
      releaseQueueSlot();
      const remaining = (pendingAuthAttempts.get(clientIp) || 1) - 1;
      if (remaining <= 0) pendingAuthAttempts.delete(clientIp);
      else pendingAuthAttempts.set(clientIp, remaining);
      if (authAttemptTails.get(clientIp) === tail) {
        authAttemptTails.delete(clientIp);
      }
    }
  });

  app.get(
    '/api/auth/session',
    requireClinicalAuth('students:read'),
    (req, res) => {
      res.json({
        authenticated: true,
        session: (req as any).clinicalSession,
      });
    }
  );

  app.post(
    '/api/auth/logout',
    requireClinicalAuth('students:read'),
    (req, res) => {
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      REVOKED_CLINICAL_SESSIONS.set(session.sessionId, session.expiresAt);
      if (!saveSecurityState()) {
        REVOKED_CLINICAL_SESSIONS.delete(session.sessionId);
        res.status(503).json({
          error: 'تعذر تثبيت إبطال الجلسة في التخزين المشفر.',
        });
        return;
      }
      res.status(204).end();
    }
  );

  // Clinician-only, tenant-isolated, PII-free Audit Log endpoint
  app.get(
    '/api/audit-logs',
    requireClinicalAuth('audit:read'),
    (req, res) => {
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      res.json({
        auditLogs: auditLogsDb.filter(
          (entry) => entry.tenantId === session.tenantId
        ),
        persisted: true,
      });
    }
  );

  // Each authenticated school sees only its own records.
  app.get('/api/students', requireClinicalAuth('students:read'), (req, res) => {
    const session = (req as any).clinicalSession as VerifiedClinicalSession;
    res.json({
      students: studentsDb.filter(
        (student) => student.tenantId === session.tenantId
      ),
      persisted: true,
      privacyPolicy: 'Tenant-scoped authenticated access; encrypted at rest',
    });
  });

  // Create new student record with server-derived reading & math metrics from client-reported evidence
  app.post(
    '/api/students',
    requireClinicalAuth('students:write'),
    (req, res) => {
      const incoming = req.body as Record<string, unknown> | null;
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      if (
        !incoming ||
        typeof incoming !== 'object' ||
        Array.isArray(incoming) ||
        hasForbiddenPrototypeKeys(incoming)
      ) {
        res.status(400).json({ error: 'بيانات جلسة الطالب غير صالحة.' });
        return;
      }

      const id = typeof incoming.id === 'string' ? incoming.id.trim() : '';
      const rawName =
        typeof incoming.name === 'string' ? incoming.name.trim() : '';
      const cleanName = rawName.replace(/\s+/g, ' ');
      const schoolName =
        typeof incoming.schoolName === 'string' && incoming.schoolName.trim()
          ? incoming.schoolName.trim().slice(0, 160)
          : session.tenantDisplayNameAr;
      const gradeLevel = Number(incoming.gradeLevel);
      const ageYears =
        incoming.ageYears !== undefined
          ? Number(incoming.ageYears)
          : gradeLevel + 6;

      if (
        !/^[a-zA-Z0-9._:-]{1,120}$/.test(id) ||
        cleanName.length < 2 ||
        cleanName.length > 120 ||
        !Number.isInteger(gradeLevel) ||
        gradeLevel < 1 ||
        gradeLevel > 6 ||
        !Number.isInteger(ageYears) ||
        ageYears < 5 ||
        ageYears > 16
      ) {
        res
          .status(400)
          .json({ error: 'بيانات هوية الطالب أو الصف غير مكتملة أو غير صالحة.' });
        return;
      }

      if (incoming.isDemoRecord === true) {
        res
          .status(400)
          .json({ error: 'لا يمكن حفظ سجل عرض تجريبي كسجل طالب.' });
        return;
      }

      // Cross-tenant ID protection: never reveal another school's IDs with 409; return 404 if owned by another school
      const existingRecord = studentsDb.find((student) => student.id === id);
      if (existingRecord) {
        if (existingRecord.tenantId !== session.tenantId) {
          res
            .status(404)
            .json({ error: 'سجل الطالب غير موجود في هذه المدرسة.' });
          return;
        }
        res.status(409).json({
          error: 'معرّف الطالب موجود بالفعل؛ رُفض استبدال سجل موجود.',
        });
        return;
      }

      // Strict Default-Deny Consent Check
      const consentCheck = validateExplicitGuardianConsent(
        incoming.guardianConsentGiven
      );
      const consentTimeValid =
        typeof incoming.guardianConsentRecordedAt === 'string' &&
        Number.isFinite(Date.parse(incoming.guardianConsentRecordedAt));
      const consentSourceValid =
        typeof incoming.guardianConsentSource === 'string' &&
        incoming.guardianConsentSource.trim().length > 0;
      if (!consentCheck.valid || !consentTimeValid || !consentSourceValid) {
        res.status(403).json({
          error: consentCheck.valid
            ? 'يلزم تسجيل وقت الموافقة ومصدرها قبل حفظ الجلسة.'
            : consentCheck.errorAr,
        });
        return;
      }
      if (
        (incoming.speechRecognitionUsed === true || incoming.audioRecordingStarted === true) &&
        (incoming.guardianAudioConsentGiven !== true ||
          typeof incoming.guardianAudioConsentRecordedAt !== 'string' ||
          !Number.isFinite(Date.parse(incoming.guardianAudioConsentRecordedAt)))
      ) {
        res.status(403).json({
          error:
            'رُصد تسجيل صوتي أو استخدام للتعرف الصوتي دون سجل موافقة صوتية منفصل صالح ومؤرخ؛ رُفض حفظ الجلسة.',
        });
        return;
      }

      // Server-side derivation and plausibility validation of reading & math evidence
      const derived = validateAndDeriveSessionFromEvidence(incoming, {
        name: cleanName,
        gradeLevel,
      }, {
        sessionId: session.sessionId,
        role: session.role,
        clinicianName: session.clinicianName,
      });
      if (!derived.valid || !derived.derivedFields) {
        res.status(derived.statusCode || 400).json({
          error: derived.errorAr,
          rejectedFields: derived.rejectedFields,
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const newRecord: StudentRecord = {
        id,
        tenantId: session.tenantId,
        name: cleanName,
        isDemoRecord: false,
        sessionStatus: 'completed',
        sessionCompletedAt: nowIso,
        sessionRoleLabel:
          typeof incoming.sessionRoleLabel === 'string'
            ? incoming.sessionRoleLabel.trim().slice(0, 80)
            : 'أخصائي صعوبات تعلم',
        assessmentHistory: [],
        gradeLevel,
        ageYears,
        schoolName,
        lastScreenedDate: new Date().toLocaleString('ar-EG', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        guardianConsentGiven: true,
        guardianConsentRecordedAt: String(incoming.guardianConsentRecordedAt),
        guardianConsentSource: String(incoming.guardianConsentSource).trim(),
        guardianAudioConsentGiven: incoming.guardianAudioConsentGiven === true,
        guardianAudioConsentRecordedAt:
          incoming.guardianAudioConsentGiven === true &&
          typeof incoming.guardianAudioConsentRecordedAt === 'string'
            ? incoming.guardianAudioConsentRecordedAt
            : undefined,
        audioRecordingConsentGiven: incoming.guardianAudioConsentGiven === true,
        audioRecordingStarted: incoming.audioRecordingStarted === true,
        speechRecognitionUsed: incoming.speechRecognitionUsed === true,
        ...derived.derivedFields,
      };

      const nextRecords = [newRecord, ...studentsDb];
      const committed = commitStudentMutationWithAudit(
        studentsDb,
        nextRecords,
        session,
        'student.create',
        newRecord.id,
        ['session', 'evidence', 'clinicalReport']
      );
      if (!committed.ok) {
        res
          .status(503)
          .json({ error: 'تعذر حفظ السجل وسجل التدقيق في التخزين المشفر.' });
        return;
      }
      studentsDb = committed.students;
      res.status(201).json({ student: newRecord, persisted: true });
    }
  );

  // Store repeat screenings as sessions attached to the existing student identity.
  app.post(
    '/api/students/:id/sessions',
    requireClinicalAuth('students:write'),
    (req, res) => {
      const { id } = req.params;
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      const idx = studentsDb.findIndex(
        (student) =>
          student.id === id && student.tenantId === session.tenantId
      );
      if (idx < 0) {
        res
          .status(404)
          .json({ error: 'سجل الطالب غير موجود في هذه المدرسة.' });
        return;
      }
      const incoming = req.body as Record<string, unknown> | null;
      if (
        !incoming ||
        typeof incoming !== 'object' ||
        Array.isArray(incoming) ||
        hasForbiddenPrototypeKeys(incoming)
      ) {
        res.status(400).json({ error: 'بيانات جلسة المتابعة غير صالحة.' });
        return;
      }

      const forbiddenIdentityFields = [
        'id',
        'name',
        'schoolName',
        'tenantId',
        'lastScreenedDate',
        'sessionCompletedAt',
      ].filter((k) => k in incoming);
      if (forbiddenIdentityFields.length > 0) {
        res.status(400).json({
          error:
            'ترسل جلسة المتابعة حقولاً غير مسموح بها؛ هوية الطالب والمدرسة والتاريخ يديرها الخادم.',
          rejectedFields: forbiddenIdentityFields,
        });
        return;
      }

      const consentCheck = validateExplicitGuardianConsent(
        incoming.guardianConsentGiven
      );
      const consentTimeValid =
        typeof incoming.guardianConsentRecordedAt === 'string' &&
        Number.isFinite(Date.parse(incoming.guardianConsentRecordedAt));
      const consentSourceValid =
        typeof incoming.guardianConsentSource === 'string' &&
        incoming.guardianConsentSource.trim().length > 0;
      if (!consentCheck.valid || !consentTimeValid || !consentSourceValid) {
        res.status(403).json({
          error: consentCheck.valid
            ? 'يلزم تسجيل موافقة جديدة بوقت ومصدر قبل حفظ جلسة المتابعة.'
            : consentCheck.errorAr,
        });
        return;
      }
      if (
        (incoming.speechRecognitionUsed === true || incoming.audioRecordingStarted === true) &&
        (incoming.guardianAudioConsentGiven !== true ||
          typeof incoming.guardianAudioConsentRecordedAt !== 'string' ||
          !Number.isFinite(Date.parse(incoming.guardianAudioConsentRecordedAt)))
      ) {
        res.status(403).json({
          error: 'التسجيل الصوتي أو استخدام التعرف الصوتي يتطلب موافقة صوتية منفصلة بوقت صالح.',
        });
        return;
      }

      const current = studentsDb[idx];
      const derived = validateAndDeriveSessionFromEvidence(incoming, {
        name: current.name,
        gradeLevel: current.gradeLevel,
      }, {
        sessionId: session.sessionId,
        role: session.role,
        clinicianName: session.clinicianName,
      });
      if (!derived.valid || !derived.derivedFields) {
        res.status(derived.statusCode || 400).json({
          error: derived.errorAr,
          rejectedFields: derived.rejectedFields,
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const previousSnapshot =
        current.sessionStatus === 'completed'
          ? {
              sessionId: `sess-${current.id}-${Date.now()}`,
              completedAt:
                current.sessionCompletedAt || current.lastScreenedDate || nowIso,
              passageId: current.passageId,
              assessmentModality: current.assessmentModality,
              wcpm: current.wcpm ?? current.oralWcpm ?? null,
              teacherVerified: current.teacherVerified === true,
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
        ...derived.derivedFields,
        id: current.id,
        name: current.name,
        schoolName: current.schoolName,
        tenantId: current.tenantId,
        isDemoRecord: false,
        sessionStatus: 'completed',
        sessionCompletedAt: nowIso,
        sessionRoleLabel:
          typeof incoming.sessionRoleLabel === 'string'
            ? incoming.sessionRoleLabel.trim().slice(0, 80)
            : current.sessionRoleLabel,
        lastScreenedDate: new Date().toLocaleString('ar-EG', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        guardianConsentGiven: true,
        guardianConsentRecordedAt: String(incoming.guardianConsentRecordedAt),
        guardianConsentSource: String(incoming.guardianConsentSource).trim(),
        guardianAudioConsentGiven: incoming.guardianAudioConsentGiven === true,
        guardianAudioConsentRecordedAt:
          incoming.guardianAudioConsentGiven === true &&
          typeof incoming.guardianAudioConsentRecordedAt === 'string'
            ? incoming.guardianAudioConsentRecordedAt
            : undefined,
        audioRecordingConsentGiven: incoming.guardianAudioConsentGiven === true,
        audioRecordingStarted: incoming.audioRecordingStarted === true,
        speechRecognitionUsed: incoming.speechRecognitionUsed === true,
        assessmentHistory: previousSnapshot
          ? [...(current.assessmentHistory || []), previousSnapshot]
          : [...(current.assessmentHistory || [])],
      };

      const nextRecords = [...studentsDb];
      nextRecords[idx] = updatedRecord;
      const committed = commitStudentMutationWithAudit(
        studentsDb,
        nextRecords,
        session,
        'student.session.append',
        updatedRecord.id,
        ['session', 'evidence', 'assessmentHistory', 'clinicalReport']
      );
      if (!committed.ok) {
        res
          .status(503)
          .json({ error: 'تعذر حفظ جلسة المتابعة في التخزين المشفر.' });
        return;
      }
      studentsDb = committed.students;
      res.status(200).json({ student: updatedRecord, persisted: true });
    }
  );

  // Dedicated endpoint to record/update Dyscalculia 4+2+3 fixed trials and derive math scores & report on the server
  const handleMathTrialsUpdate = (
    req: express.Request,
    res: express.Response
  ) => {
    const { id } = req.params;
    const session = (req as any).clinicalSession as VerifiedClinicalSession;
    const idx = studentsDb.findIndex(
      (s) => s.id === id && s.tenantId === session.tenantId
    );
    if (idx === -1) {
      res.status(404).json({ error: 'سجل الطالب غير موجود في هذه المدرسة.' });
      return;
    }
    const rawBody = req.body as Record<string, unknown> | null;
    if (
      !rawBody ||
      typeof rawBody !== 'object' ||
      Array.isArray(rawBody) ||
      hasForbiddenPrototypeKeys(rawBody)
    ) {
      res.status(400).json({ error: 'بيانات محاولات الحساب غير صالحة.' });
      return;
    }

    if (
      Object.keys(rawBody).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(rawBody, 'mathTrials')
    ) {
      res.status(400).json({ error: 'يقبل مسار الحساب كائن mathTrials فقط دون حقول إضافية.' });
      return;
    }
    const mathValidation = validateAndDeriveMathTrials(rawBody.mathTrials);
    if (!mathValidation.valid || !mathValidation.metrics || !mathValidation.trials) {
      res.status(400).json({
        error: mathValidation.errorAr || 'بيانات مهام الحساب غير صالحة.',
      });
      return;
    }

    const current = studentsDb[idx];
    const m = mathValidation.metrics;
    const updatedReport = buildDeterministicClinicalReport({
      studentName: current.name,
      gradeLevel: current.gradeLevel,
      dialectLabelAr: current.dialectRegionAr || 'الفصحى المعيارية / الخليجية',
      gazeCoveragePercent: current.gazeCoveragePercent ?? 100,
      observedWordCount: current.observedWordCount ?? current.fixations.length,
      totalPassageWordCount:
        current.totalPassageWordCount ?? current.fixations.length,
      wpm: current.wpm,
      avgFixationMs: current.avgFixationMs,
      regressionRate: current.regressionRate,
      regressionCount: current.regressionCount,
      blinkCount: current.blinkCount ?? 0,
      blinksPerMinute: current.blinksPerMinute ?? 0,
      visualStrainLabelAr:
        current.visualStrainLabelAr || 'معدل رمش طبيعي ومريح بصرياً',
      calibrationAccuracyPercent: current.calibrationAccuracyPercent ?? 85,
      calibrationValidationLabelAr:
        current.calibrationValidationMethod || 'تحقق مستقل (Independent Holdout)',
      problematicWords: current.problematicWords || [],
      oralReadingAssessed: current.oralReadingAssessed === true,
      oralAccuracyPercent: current.oralAccuracyPercent ?? null,
      phoneticSubstitutionCount: current.phoneticSubstitutionCount ?? 0,
      dialectVariantCount: current.dialectVariantCount ?? 0,
      dyscalculiaAssessed: true,
      numberLinePAE: m.numberLinePAE,
      subitizingAccuracy: m.subitizingAccuracy,
      reversalErrorCount: m.reversalErrorCount,
    });

    const updatedRecord: StudentRecord = {
      ...current,
      dyscalculiaAssessed: true,
      mathTrials: mathValidation.trials,
      subitizingAccuracy: m.subitizingAccuracy,
      avgSubitizingMs: m.avgSubitizingMs,
      numberLinePAE: m.numberLinePAE,
      transcodingAccuracy: m.transcodingAccuracy,
      reversalErrorCount: m.reversalErrorCount,
      dyscalculiaRiskScore: m.dyscalculiaRiskScore,
      mathHeuristicIndicator: m.heuristicIndicator,
      mathRiskLevel: m.riskLevel,
      mathRiskLabelAr: m.riskLabelAr,
      clinicalReport: updatedReport,
    };

    const nextRecords = [...studentsDb];
    nextRecords[idx] = updatedRecord;
    const committed = commitStudentMutationWithAudit(
      studentsDb,
      nextRecords,
      session,
      'student.math.assess',
      updatedRecord.id,
      ['mathTrials', 'dyscalculiaRiskScore', 'mathRiskLevel', 'clinicalReport']
    );
    if (!committed.ok) {
      res
        .status(503)
        .json({ error: 'تعذر حفظ نتائج الحساب في التخزين المشفر.' });
      return;
    }
    studentsDb = committed.students;
    res.status(200).json({ student: updatedRecord, persisted: true });
  };

  app.put(
    '/api/students/:id/math',
    requireClinicalAuth('students:write'),
    handleMathTrialsUpdate
  );

  // Dedicated endpoint to persist an updated AI or clinician report (Fixing Finding 1)
  const handleUpdateClinicalReport = (
    req: express.Request,
    res: express.Response
  ) => {
    const { id } = req.params;
    const session = (req as any).clinicalSession as VerifiedClinicalSession;
    const idx = studentsDb.findIndex(
      (s) => s.id === id && s.tenantId === session.tenantId
    );
    if (idx === -1) {
      res.status(404).json({ error: 'سجل الطالب غير موجود في هذه المدرسة.' });
      return;
    }
    const rawBody = req.body as Record<string, unknown> | null;
    if (
      !rawBody ||
      typeof rawBody !== 'object' ||
      Array.isArray(rawBody) ||
      hasForbiddenPrototypeKeys(rawBody)
    ) {
      res.status(400).json({ error: 'جسم تحديث التقرير غير صالح.' });
      return;
    }

    const current = studentsDb[idx];
    const consentCheck = validateExplicitGuardianConsent(
      current.guardianConsentGiven
    );
    if (!consentCheck.valid || !current.guardianConsentRecordedAt) {
      res.status(403).json({
        error: 'لا يمكن حفظ تحديث التقرير لسجل لا يتضمن موافقة ولي أمر مسجلة.',
      });
      return;
    }

    const parsedEnvelope = ClinicalReportUpdateEnvelopeSchema.safeParse(rawBody);
    if (!parsedEnvelope.success) {
      res.status(400).json({
        error:
          'بنية التقرير غير صالحة أو تنقصها أنشطة المساندة والتيسيرات الصفية الإلزامية.',
        issues: parsedEnvelope.error.issues.map((i) => i.message),
      });
      return;
    }

    const validatedReport = parsedEnvelope.data.clinicalReport;

    const updatedRecord: StudentRecord = {
      ...current,
      clinicalReport: validatedReport,
    };

    const nextRecords = [...studentsDb];
    nextRecords[idx] = updatedRecord;
    const committed = commitStudentMutationWithAudit(
      studentsDb,
      nextRecords,
      session,
      'student.report.update',
      updatedRecord.id,
      ['clinicalReport']
    );
    if (!committed.ok) {
      res
        .status(503)
        .json({ error: 'تعذر حفظ التقرير المحدث في التخزين المشفر.' });
      return;
    }
    studentsDb = committed.students;
    res.status(200).json({ student: updatedRecord, persisted: true });
  };

  app.put(
    '/api/students/:id/clinical-report',
    requireClinicalAuth('students:write'),
    handleUpdateClinicalReport
  );

  // Strict 4-field profile PATCH (`name`, `schoolName`, `gradeLevel`, `ageYears` only)
  app.patch(
    '/api/students/:id',
    requireClinicalAuth('students:write'),
    (req, res) => {
      const { id } = req.params;
      const rawUpdates = req.body as Record<string, unknown> | null;
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      const idx = studentsDb.findIndex(
        (s) => s.id === id && s.tenantId === session.tenantId
      );
      if (idx === -1) {
        res.status(404).json({ error: 'سجل الطالب غير موجود.' });
        return;
      }
      if (
        !rawUpdates ||
        typeof rawUpdates !== 'object' ||
        Array.isArray(rawUpdates) ||
        hasForbiddenPrototypeKeys(rawUpdates)
      ) {
        res.status(400).json({ error: 'جسم التحديث غير صالح.' });
        return;
      }

      const parsed = StudentProfilePatchSchema.safeParse(rawUpdates);
      if (!parsed.success) {
        res.status(400).json({
          error:
            'يقبل مسار PATCH حقول الملف الشخصي الأربعة فقط (name, schoolName, gradeLevel, ageYears)؛ لا يُسمح بتعديل الدرجات أو المدرسة أو التقرير عبر هذا المسار.',
          issues: parsed.error.issues.map((i) => i.message),
        });
        return;
      }

      const cleanUpdates = {
        ...parsed.data,
        ...(parsed.data.name !== undefined
          ? { name: parsed.data.name.trim().replace(/\s+/g, ' ') }
          : {}),
      };
      if (cleanUpdates.name !== undefined && cleanUpdates.name.length < 2) {
        res.status(400).json({ error: 'اسم الطالب بعد توحيد المسافات قصير جداً.' });
        return;
      }

      const updatedRecord: StudentRecord = {
        ...studentsDb[idx],
        ...cleanUpdates,
      };
      const nextRecords = [...studentsDb];
      nextRecords[idx] = updatedRecord;
      const committed = commitStudentMutationWithAudit(
        studentsDb,
        nextRecords,
        session,
        'student.profile.patch',
        updatedRecord.id,
        Object.keys(cleanUpdates)
      );
      if (!committed.ok) {
        res.status(503).json({
          error:
            'تعذر حفظ السجل المشفر. تحقق من إعدادات التخزين وصلاحيات الملفات.',
        });
        return;
      }
      studentsDb = committed.students;
      res.json({ student: updatedRecord, persisted: true });
    }
  );

  app.delete(
    '/api/students/:id',
    requireClinicalAuth('students:delete'),
    (req, res) => {
      const { id } = req.params;
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      const existsInTenant = studentsDb.some(
        (s) => s.id === id && s.tenantId === session.tenantId
      );
      if (!existsInTenant) {
        res.status(404).json({ error: 'سجل الطالب غير موجود.' });
        return;
      }
      const nextRecords = studentsDb.filter(
        (s) => !(s.id === id && s.tenantId === session.tenantId)
      );
      const committed = commitStudentMutationWithAudit(
        studentsDb,
        nextRecords,
        session,
        'student.delete',
        id,
        ['deleted']
      );
      if (!committed.ok) {
        res
          .status(503)
          .json({ error: 'تعذر حفظ التغيير في التخزين المشفر.' });
        return;
      }
      studentsDb = committed.students;
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

  app.use('/mediapipe-wasm', express.static(wasmDir));

  // Prevent the server from becoming an unauthenticated paid AI proxy.
  app.use('/api/ai', requireClinicalAuth('ai:analyze'), aiRateLimiter);

  // 1. Clinical AI Analysis of Eye-Tracking Dyslexia & Dyscalculia Screening
  app.post(
    '/api/ai/analyze-session',
    requireClinicalAuth('ai:analyze'),
    async (req, res) => {
      const {
        studentName,
        guardianConsentGiven,
        guardianConsentRecordedAt,
        guardianConsentSource,
        guardianAudioConsentGiven,
        guardianAudioConsentRecordedAt,
        speechRecognitionUsed = false,
        audioRecordingStarted = false,
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
        res
          .status(400)
          .json({ error: 'بيانات الجلسة غير مكتملة أو غير صالحة.' });
        return;
      }

      const consentValidation =
        validateExplicitGuardianConsent(guardianConsentGiven);
      const consentTimestampValid =
        typeof guardianConsentRecordedAt === 'string' &&
        Number.isFinite(Date.parse(guardianConsentRecordedAt));
      const consentSourceValid =
        typeof guardianConsentSource === 'string' &&
        guardianConsentSource.trim().length > 0;
      if (
        !consentValidation.valid ||
        !consentTimestampValid ||
        !consentSourceValid
      ) {
        res.status(403).json({
          error: consentValidation.valid
            ? 'يلزم تسجيل وقت الموافقة ومصدرها قبل إنشاء التقرير.'
            : consentValidation.errorAr,
        });
        return;
      }
      if (
        (speechRecognitionUsed === true || audioRecordingStarted === true) &&
        (guardianAudioConsentGiven !== true ||
          typeof guardianAudioConsentRecordedAt !== 'string' ||
          !Number.isFinite(Date.parse(guardianAudioConsentRecordedAt)))
      ) {
        res.status(403).json({
          error: 'التسجيل الصوتي أو استخدام التعرف الصوتي لا يتضمن موافقة صوتية منفصلة مسجلة.',
        });
        return;
      }

      const reqModality = req.body?.assessmentModality;
      const isNoEyeModality =
        reqModality === 'reading_only' ||
        reqModality === 'voice_only' ||
        (oralReadingAssessed === true && (observedWordCount === 0 || observedWordCount === undefined || calibrationAccuracyPercent === null || calibrationAccuracyPercent === undefined)) ||
        (observedWordCount === 0 && (calibrationAccuracyPercent === null || calibrationAccuracyPercent === undefined));

      if (!isNoEyeModality) {
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
            error:
              'بيانات تتبع العين غير كافية لإصدار تقرير. يلزم رصد 4 كلمات على الأقل وتغطية 25% من النص دون تعويض اصطناعي.',
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
            error:
              'دقة التحقق من معايرة الكاميرا منخفضة أو غير متاحة؛ تم حجب التقرير بدلاً من إصدار نتيجة غير موثوقة.',
            reportBlocked: true,
          });
          return;
        }
      }

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

          const eyeContextLine = isNoEyeModality
            ? `- نمط الجلسة: تقييم مباشر للطلاقة القرائية واستيعاب النص بدون كاميرا (تم استبعاد تتبع العين التزاماً بالمصداقية وحماية الخصوصية)`
            : `- التغطية البصرية الفعلية للنص: ${gazeCoveragePercent}% (${observedWordCount ?? 'مرصود'}/${totalPassageWordCount ?? 'كلي'})
- متوسط زمن التثبيت البصري (Fixation Duration): ${avgFixationMs} مللي ثانية
- نسبة التراجع البصري (Regression Rate): ${regressionRate}%`;

          const prompt = `أنت خبير تربوي وإكلينيكي في الفرز الأولي الاسترشادي لصعوبات التعلم (عسر القراءة / الديسلكسيا وعسر الحساب / الديسكالكوليا) للطلاب العرب.
قم بتحليل مؤشرات الفرز الأولي التالية لـ "${anonymizedToken}" (الصف الدراسي: ${gradeLevel}) مع التأكيد أن هذه النتائج استرشادية أولية وليست تشخيصاً طبياً نهائياً:
${eyeContextLine}
- سرعة القراءة الفعلية: ${wpm} كلمة/دقيقة
- الكلمات التي شهدت أطول توقف أو تعثر فونولوجي: ${problematicWords.join('، ') || 'لا يوجد'}
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

      const fallbackReport = buildDeterministicClinicalReport({
        studentName: stripArabicPatronymics(studentName),
        gradeLevel: Number(gradeLevel) || 3,
        dialectLabelAr: 'الفصحى المعيارية / الخليجية',
        gazeCoveragePercent: Number(gazeCoveragePercent) || 100,
        observedWordCount: Number(observedWordCount) || 10,
        totalPassageWordCount: Number(totalPassageWordCount) || 40,
        wpm: Number(wpm) || 60,
        avgFixationMs: Number(avgFixationMs) || 0,
        regressionRate: Number(regressionRate) || 0,
        regressionCount: isNoEyeModality ? 0 : 4,
        blinkCount: isNoEyeModality ? 0 : 10,
        blinksPerMinute: isNoEyeModality ? 0 : 15,
        visualStrainLabelAr: isNoEyeModality ? 'غير منطبق (جلسة قراءة بدون كاميرا)' : 'معدل رمش طبيعي ومريح بصرياً',
        calibrationAccuracyPercent: Number(calibrationAccuracyPercent) || (isNoEyeModality ? 0 : 85),
        calibrationValidationLabelAr: isNoEyeModality ? 'غير منطبق (جلسة قراءة بدون كاميرا)' : 'تحقق مستقل (Independent Holdout)',
        assessmentModality: isNoEyeModality ? 'reading_only' : 'eye_voice',
        problematicWords: problematicWords.map(String),
        oralReadingAssessed: Boolean(oralReadingAssessed),
        oralAccuracyPercent:
          typeof oralAccuracyPercent === 'number' ? oralAccuracyPercent : null,
        phoneticSubstitutionCount: Number(phoneticSubstitutionCount) || 0,
        dialectVariantCount: Number(dialectVariantCount) || 0,
        dyscalculiaAssessed: Boolean(dyscalculiaAssessed),
        numberLinePAE: typeof numberLinePAE === 'number' ? numberLinePAE : null,
        subitizingAccuracy:
          typeof subitizingAccuracy === 'number' ? subitizingAccuracy : null,
        reversalErrorCount:
          typeof reversalErrorCount === 'number' ? reversalErrorCount : null,
      });

      res.json({
        source: 'clinical-engine',
        piiAnonymized: true,
        report: fallbackReport,
      });
    }
  );

  // 2. AI Text Adaptation & Morphological Breakdown for Smart Dyslexia Reader
  app.post('/api/ai/adapt-text', async (req, res) => {
    const { text } = req.body || {};
    if (
      !text ||
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > 20000
    ) {
      res.status(400).json({
        error: 'يرجى إدخال نص صالح لا يتجاوز 20,000 حرف لتحليله وتبسيطه.',
      });
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
                  description:
                    'نسخة مبسطة ومشكّلة بوضوح بجمل قصيرة ومباشرة.',
                },
                keyIdea: {
                  type: Type.STRING,
                  description:
                    'الفكرة الرئيسية للنص في جملة واحدة واضحة.',
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

    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .slice(0, 4);

    res.json({
      source: 'morphological-engine',
      adaptation: {
        simplifiedText: text,
        keyIdea:
          'يدور هذا النص حول تنمية المهارات المعرفية والملاحظة الدقيقة لفهم الظواهر المحيطة بنا بوضوح.',
        wordBreakdowns: words.map((w) => {
          const clean = w.replace(/[،.؟!]/g, '');
          return {
            word: clean,
            syllables:
              clean.length > 4
                ? `${clean.slice(0, 2)} · ${clean.slice(2, 4)} · ${clean.slice(4)}`
                : `${clean.slice(0, 2)} · ${clean.slice(2)}`,
            root: clean
              .replace(/^ال/, '')
              .slice(0, 3)
              .split('')
              .join(' - '),
            meaning:
              'مفردة أساسية في سياق الجملة تساعد على توضيح المعنى العام.',
          };
        }),
      },
    });
  });

  // 2b. Optional AI-assisted educational activity planner; not a diagnostic or validated treatment engine.
  app.post('/api/remediation/generate-personalized-session', aiRateLimiter, async (req, res) => {
    const rawBody = req.body as Record<string, unknown> | null;
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      res.status(400).json({ error: 'بيانات التدريب غير صالحة.' });
      return;
    }

    const requestedGrade = Number(rawBody.gradeLevel ?? 3);
    if (!Number.isInteger(requestedGrade) || requestedGrade < 1 || requestedGrade > 6) {
      res.status(400).json({ error: 'يجب اختيار صف دراسي من 1 إلى 6.' });
      return;
    }
    const gradeLevel = requestedGrade;
    const allowedDialects = new Set(['msa', 'gulf', 'egyptian', 'levantine', 'maghrebi']);
    const dialect = typeof rawBody.dialect === 'string' && allowedDialects.has(rawBody.dialect)
      ? rawBody.dialect
      : 'msa';
    const problematicWords = rawBody.problematicWords;

    // Only accept a small set of short Arabic words; never pass arbitrary client text to the prompt.
    const cleanWords = Array.isArray(problematicWords)
      ? problematicWords
          .filter((word: unknown): word is string => typeof word === 'string')
          .slice(0, 8)
          .map((word: string) => word.normalize('NFC').replace(/[^\u0600-\u06FF\u064B-\u065F\u0670ـ\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40))
          .filter(Boolean)
      : [];

    const hasTeacherReviewedTargets = cleanWords.length > 0;
    const effectiveWords =
      hasTeacherReviewedTargets ? cleanWords : ['السَّاقِيَةِ', 'بُسْتَانِ', 'الْجَدْوَلِ'];
    const targetContext = hasTeacherReviewedTargets
      ? 'هذه كلمات راجعها معلم يدويًا ويمكن استخدامها أهدافًا تدريبية.'
      : 'هذه أمثلة عامة للتدريب وليست أخطاء مرصودة لدى الطالب؛ لا تنسبها إليه.';

    const ai = getGenAIClient();
    if (ai) {
      try {
        const prompt = `أنت مساعد تربوي لإنشاء أنشطة تعليمية عربية للقراءة والحس العددي. أنشئ خطة تدريب تعليمية، لا تشخيصًا ولا علاجًا سريريًا، ولا تدّع أنها برنامج علاجي معتمد أو أنها تعتمد على بيانات لم تصل إليك.
الطفل في الصف ${gradeLevel}، واللهجة المفضلة ${dialect}. لا تحتاج إلى اسم الطفل أو أي مُعرّف شخصي.
سياق الأهداف: ${targetContext}
قائمة العمل: [${effectiveWords.join('، ')}].

المطلوب:
1. phonicsDrills: أربعة أنشطة قصيرة للتدرب على تمييز الحروف العربية المتقاربة في الرسم أو الصوت (ب/ت/ث، ج/ح/خ، س/ش، د/ذ)، بخيارات واضحة وتغذية راجعة تعليمية بسيطة.
2. syllableDrills: أربع كلمات مناسبة للصف مقسمة إلى مقاطع عربية صحيحة؛ لا تفكك الكلمة بطريقة تخالف النطق المكتوب.
3. pacerPassage: نص مفهوم من 16–22 كلمة مناسب للصف، مع كلمات يمكن قراءتها ببطء وبتركيز؛ لا تدّع أنه تمرين علاجي لحركة العين.
4. mathDrills: أربعة أنشطة اختيارية لخط الأعداد والقيمة المكانية، مع شرح يعلّم الخطوات بدل وصف الطفل بأنه متعثر.
5. clinicalRationale: أبق اسم الحقل للتوافق البرمجي، لكن اكتب داخله مبررًا تعليميًا موجزًا، لا حكمًا إكلينيكيًا.
اجعل التعليمات لطيفة وقصيرة وملائمة للطفل. إذا كانت الكلمات أمثلة عامة، فقل ذلك ولا تنسبها إلى أداء الطالب.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                clinicalRationale: { type: Type.STRING },
                phonicsDrills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      family: { type: Type.STRING },
                      spokenWord: { type: Type.STRING },
                      wordMeaning: { type: Type.STRING },
                      targetLetter: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            letter: { type: Type.STRING },
                            letterName: { type: Type.STRING },
                            isCorrect: { type: Type.BOOLEAN },
                            explanation: { type: Type.STRING },
                          },
                          required: ['letter', 'letterName', 'isCorrect', 'explanation'],
                        },
                      },
                      ruleTip: { type: Type.STRING },
                    },
                    required: ['id', 'family', 'spokenWord', 'wordMeaning', 'targetLetter', 'options', 'ruleTip'],
                  },
                },
                syllableDrills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      targetWord: { type: Type.STRING },
                      wordMeaning: { type: Type.STRING },
                      syllables: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: ['id', 'targetWord', 'wordMeaning', 'syllables'],
                  },
                },
                pacerPassage: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    gradeLevel: { type: Type.STRING },
                    words: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['id', 'title', 'gradeLevel', 'words'],
                },
                mathDrills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      targetNumber: { type: Type.INTEGER },
                      min: { type: Type.INTEGER },
                      max: { type: Type.INTEGER },
                      prompt: { type: Type.STRING },
                    },
                    required: ['id', 'targetNumber', 'min', 'max', 'prompt'],
                  },
                },
              },
              required: ['clinicalRationale', 'phonicsDrills', 'syllableDrills', 'pacerPassage', 'mathDrills'],
            },
          },
        });

        const parsed = JSON.parse((response.text || '{}').trim());
        res.json({
          source: 'gemini-3.8-flash-ai',
          targetWordsUsed: hasTeacherReviewedTargets ? effectiveWords : [],
          targetWordsAreTeacherReviewed: hasTeacherReviewedTargets,
          session: parsed,
        });
        return;
      } catch (err) {
        console.warn('Gemini remediation synthesis fallback triggered:', err);
      }
    }

    // Deterministic grade-level educational fallback if the model is unavailable.
    const deterministicSession = generateAdaptiveRemediationPlan({
      studentName: 'الطالب',
      gradeLevel: Number(gradeLevel),
      effectiveWords,
    });

    res.json({
      source: 'rule-based-learning-plan',
      targetWordsUsed: hasTeacherReviewedTargets ? effectiveWords : [],
      targetWordsAreTeacherReviewed: hasTeacherReviewedTargets,
      session: deterministicSession,
    });
  });

  // 3. Gemini Text-to-Speech (gemini-3.8-flash-lite-tts) for Auditory Support
  app.post('/api/ai/tts', async (req, res) => {
    const { text } = req.body || {};
    if (
      !text ||
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > 8000
    ) {
      res.status(400).json({
        error: 'يلزم إدخال نص صالح لا يتجاوز 8,000 حرف لتحويله إلى صوت.',
      });
      return;
    }

    const ai = getGenAIClient();
    if (!ai) {
      res.status(503).json({
        error:
          'خدمة الصوت السحابية غير مفعلة حالياً، سيتم استخدام القارئ الصوتي المحلي للمتصفح.',
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

  // Unknown API routes must never fall through to the SPA index.html.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'مسار API غير موجود.' });
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
    // Only browser GET navigation requests may receive the SPA shell.
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET') {
        next();
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }

  // Final not-found handler for unmatched non-API routes and non-GET methods.
  app.use((_req, res) => {
    res.status(404).json({ error: 'المسار غير موجود.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Baseera Clinical Server running on http://localhost:${PORT}`);
  });
}

startServer();
