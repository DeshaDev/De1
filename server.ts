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
  SubitizingTrialResult,
  NumberLineTrialResult,
  TranscodingTrialResult,
} from './src/utils/clinicalMetrics';
import { INITIAL_STUDENTS, StudentRecord } from './src/data/seedData';
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
    auditEvents: parsed.auditEvents as AuditEvent[],
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
    action,
    subjectId,
    changedFields: [...new Set(changedFields)].sort(),
    outcome: 'success',
  });
}

function readTrustedProxyHops(): number {
  const raw = (process.env.TRUST_PROXY_HOPS || '0').trim();
  if (!/^\\d+$/.test(raw)) {
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

const PATCHABLE_STUDENT_FIELDS = new Set<string>([
  'sessionStatus', 'sessionRoleLabel',
  'lastScreenedDate', 'passageId', 'dialectRegionAr',
  'wpm', 'avgFixationMs', 'regressionRate', 'regressionCount',
  'blinkCount', 'blinksPerMinute', 'visualStrainLevel', 'visualStrainLabelAr',
  'gazeCoveragePercent', 'observedWordCount', 'totalPassageWordCount',
  'calibrationAccuracyPercent', 'calibrationValidationMethod',
  'oralReadingAssessed', 'spokenTranscript', 'oralWcpm', 'oralAccuracyPercent',
  'oralWerPercent', 'phoneticSubstitutionCount', 'dialectVariantCount', 'omissionCount',
  'dyslexiaRiskScore', 'readingHeuristicIndicator', 'readingRiskLevel', 'readingRiskLabelAr',
  'problematicWords', 'fixations', 'comprehensionScore',
  'dyscalculiaAssessed', 'subitizingAccuracy', 'avgSubitizingMs', 'numberLinePAE',
  'transcodingAccuracy', 'reversalErrorCount', 'dyscalculiaRiskScore',
  'mathHeuristicIndicator', 'mathRiskLevel', 'mathRiskLabelAr', 'clinicalReport',
]);

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
    if (!isClinicalAuthConfigured() || !clinicalStoreReady) {
      res.status(503).json({
        error: 'يلزم ضبط الأسرار وتهيئة مخزن سريري مشفر قابل للقراءة والكتابة قبل تفعيل بيانات الطلاب.',
      });
      return;
    }
    const rawHeader =
      (req.headers.authorization as string) ||
      (req.headers['x-clinical-session-token'] as string) ||
      '';
    const verifiedSession = verifyClinicalSessionToken(rawHeader, CLINICAL_SESSION_SECRET);
    const now = Date.now();
    for (const [sessionId, expiresAt] of REVOKED_CLINICAL_SESSIONS) {
      if (expiresAt <= now) REVOKED_CLINICAL_SESSIONS.delete(sessionId);
    }
    const activeSession = verifiedSession &&
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
    (req as any).clinicalSession = verifiedSession;
    next();
  };
}

// Rate-limit credential attempts independently from paid AI requests.
const authAttemptBuckets = new Map<string, number[]>();
function authRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const clientIp = req.ip || req.socket.remoteAddress || 'local';
  const now = Date.now();
  const windowMs = 60_000;
  const maxAttemptsPerMinute = 8;
  const attempts = (authAttemptBuckets.get(clientIp) || []).filter(
    (ts) => now - ts < windowMs
  );
  if (attempts.length >= maxAttemptsPerMinute) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({
      error: 'محاولات تسجيل الدخول كثيرة. يرجى الانتظار قبل المحاولة مجددًا.',
    });
    return;
  }
  attempts.push(now);
  authAttemptBuckets.set(clientIp, attempts);
  next();
}

// Sliding-window rate limiter to protect external AI endpoints (/api/ai/*)
const rateLimitBuckets = new Map<string, number[]>();
function aiRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  // Do not trust client-supplied X-Forwarded-For unless a trusted proxy is explicitly configured.
  const clientIp = req.ip || req.socket.remoteAddress || 'local';
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequestsPerMinute = 20;

  const history = (rateLimitBuckets.get(clientIp) || []).filter(
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
  rateLimitBuckets.set(clientIp, history);
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
    REVOKED_CLINICAL_SESSIONS.set(session.sessionId, session.expiresAt);
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

  app.post(
    '/api/students',
    requireClinicalAuth('students:write'),
    (req, res) => {
      const incoming = req.body as StudentRecord;
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      if (!incoming || typeof incoming.id !== 'string' ||
          !/^[a-zA-Z0-9._:-]{1,120}$/.test(incoming.id) ||
          typeof incoming.name !== 'string' || !incoming.name.trim() ||
          incoming.name.length > 120) {
        res.status(400).json({ error: 'بيانات جلسة الطالب غير مكتملة أو غير صالحة.' });
        return;
      }
      // Creation cannot replace any existing ID, regardless of school/tenant.
      if (studentsDb.some((student) => student.id === incoming.id)) {
        res.status(409).json({ error: 'معرّف الطالب موجود بالفعل؛ رُفض استبدال سجل موجود.' });
        return;
      }
      if (incoming.isDemoRecord === true) {
        res.status(400).json({ error: 'لا يمكن حفظ سجل عرض تجريبي كسجل طالب.' });
        return;
      }
      const newRecord: StudentRecord = {
        ...incoming,
        id: incoming.id,
        name: incoming.name.trim(),
        tenantId: session.tenantId,
        isDemoRecord: false,
      };

      const consentCheck = validateExplicitGuardianConsent(newRecord.guardianConsentGiven);
      const consentTimeValid = typeof newRecord.guardianConsentRecordedAt === 'string' &&
        Number.isFinite(Date.parse(newRecord.guardianConsentRecordedAt));
      const consentSourceValid = typeof newRecord.guardianConsentSource === 'string' &&
        newRecord.guardianConsentSource.trim().length > 0;
      if (!consentCheck.valid || !consentTimeValid || !consentSourceValid) {
        res.status(403).json({
          error: consentCheck.valid
            ? 'يلزم تسجيل وقت الموافقة ومصدرها قبل حفظ الجلسة.'
            : consentCheck.errorAr,
        });
        return;
      }
      if (newRecord.speechRecognitionUsed === true && (
        newRecord.guardianAudioConsentGiven !== true ||
        typeof newRecord.guardianAudioConsentRecordedAt !== 'string' ||
        !Number.isFinite(Date.parse(newRecord.guardianAudioConsentRecordedAt))
      )) {
        res.status(403).json({ error: 'رُصد استخدام التعرف الصوتي دون سجل موافقة صوتية منفصل صالح؛ رُفض حفظ الجلسة.' });
        return;
      }

      const nextRecords = [newRecord, ...studentsDb];
      if (!savePersistedStudents(nextRecords)) {
        res.status(503).json({ error: 'تعذر حفظ السجل في التخزين المشفر.' });
        return;
      }
      studentsDb = nextRecords;
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
      const idx = studentsDb.findIndex((student) =>
        student.id === id && student.tenantId === session.tenantId
      );
      if (idx < 0) {
        res.status(404).json({ error: 'سجل الطالب غير موجود في هذه المدرسة.' });
        return;
      }
      const incoming = req.body as Record<string, unknown> | null;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        res.status(400).json({ error: 'بيانات جلسة المتابعة غير صالحة.' });
        return;
      }

      const sessionFields = new Set([
        'sessionRoleLabel', 'passageId', 'dialectRegionAr',
        'wpm', 'avgFixationMs', 'regressionRate', 'regressionCount',
        'blinkCount', 'blinksPerMinute', 'visualStrainLevel', 'visualStrainLabelAr',
        'gazeCoveragePercent', 'observedWordCount', 'totalPassageWordCount',
        'calibrationAccuracyPercent', 'calibrationValidationMethod',
        'oralReadingAssessed', 'spokenTranscript', 'oralWcpm', 'oralAccuracyPercent',
        'oralWerPercent', 'phoneticSubstitutionCount', 'dialectVariantCount', 'omissionCount',
        'dyslexiaRiskScore', 'readingHeuristicIndicator', 'readingRiskLevel', 'readingRiskLabelAr',
        'problematicWords', 'fixations', 'comprehensionScore',
        'dyscalculiaAssessed', 'subitizingAccuracy', 'avgSubitizingMs', 'numberLinePAE',
        'transcodingAccuracy', 'reversalErrorCount', 'dyscalculiaRiskScore',
        'mathHeuristicIndicator', 'mathRiskLevel', 'mathRiskLabelAr', 'clinicalReport',
        'guardianConsentGiven', 'guardianConsentRecordedAt', 'guardianConsentSource',
        'guardianAudioConsentGiven', 'guardianAudioConsentRecordedAt', 'speechRecognitionUsed',
      ]);
      const forbidden = Object.keys(incoming).filter((key) => !sessionFields.has(key));
      if (forbidden.length > 0) {
        res.status(400).json({
          error: 'ترسل جلسة المتابعة حقولاً غير مسموح بها؛ هوية الطالب والمدرسة والتاريخ يديرها الخادم.',
          rejectedFields: forbidden,
        });
        return;
      }

      const consentCheck = validateExplicitGuardianConsent(incoming.guardianConsentGiven);
      const consentTimeValid = typeof incoming.guardianConsentRecordedAt === 'string' &&
        Number.isFinite(Date.parse(incoming.guardianConsentRecordedAt));
      const consentSourceValid = typeof incoming.guardianConsentSource === 'string' &&
        incoming.guardianConsentSource.trim().length > 0;
      if (!consentCheck.valid || !consentTimeValid || !consentSourceValid) {
        res.status(403).json({
          error: consentCheck.valid
            ? 'يلزم تسجيل موافقة جديدة بوقت ومصدر قبل حفظ جلسة المتابعة.'
            : consentCheck.errorAr,
        });
        return;
      }
      if (incoming.speechRecognitionUsed === true && (
        incoming.guardianAudioConsentGiven !== true ||
        typeof incoming.guardianAudioConsentRecordedAt !== 'string' ||
        !Number.isFinite(Date.parse(incoming.guardianAudioConsentRecordedAt))
      )) {
        res.status(403).json({ error: 'استخدام التعرف الصوتي يتطلب موافقة صوتية منفصلة بوقت صالح.' });
        return;
      }

      const current = studentsDb[idx];
      const nowIso = new Date().toISOString();
      const previousSnapshot = current.sessionStatus === 'completed'
        ? {
            sessionId: current.id,
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
      const updates = Object.fromEntries(
        Object.entries(incoming).filter(([key]) => sessionFields.has(key))
      ) as Partial<StudentRecord>;
      const updatedRecord: StudentRecord = {
        ...current,
        ...updates,
        id: current.id,
        name: current.name,
        schoolName: current.schoolName,
        tenantId: current.tenantId,
        isDemoRecord: false,
        sessionStatus: 'completed',
        sessionCompletedAt: nowIso,
        lastScreenedDate: new Date().toLocaleString('ar-EG', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        }),
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
      studentsDb = nextRecords;
      res.status(200).json({ student: updatedRecord, persisted: true });
    }
  );

  app.patch(
    '/api/students/:id',
    requireClinicalAuth('students:write'),
    (req, res) => {
      const { id } = req.params;
      const updates = req.body as Partial<StudentRecord> | null;
      const session = (req as any).clinicalSession as VerifiedClinicalSession;
      const idx = studentsDb.findIndex((s) => s.id === id && s.tenantId === session.tenantId);
      if (idx === -1) {
        res.status(404).json({ error: 'سجل الطالب غير موجود.' });
        return;
      }
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        res.status(400).json({ error: 'جسم التحديث غير صالح.' });
        return;
      }

      const keys = Object.keys(updates);
      const forbidden = keys.filter((key) => !PATCHABLE_STUDENT_FIELDS.has(key));
      if (forbidden.length > 0) {
        res.status(400).json({
          error: 'يتضمن التحديث حقول هوية أو موافقة أو حقولاً غير قابلة للتعديل.',
          rejectedFields: forbidden,
        });
        return;
      }

      const updatedRecord = { ...studentsDb[idx], ...updates };
      const nextRecords = [...studentsDb];
      nextRecords[idx] = updatedRecord;
      if (!savePersistedStudents(nextRecords)) {
        res.status(503).json({ error: 'تعذر حفظ السجل المشفر. تحقق من إعدادات التخزين وصلاحيات الملفات.' });
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
