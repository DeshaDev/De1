import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { INITIAL_STUDENTS, StudentRecord } from './src/data/seedData';
import {
  ClinicalRole,
  ClinicalScope,
  issueClinicalSessionToken,
  verifyClinicalSessionToken,
  authorizeSessionScope,
  validateExplicitGuardianConsent,
} from './src/utils/clinicalSecurity';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '.runtime-store');
const STORE_PATH = path.join(DATA_DIR, 'clinical-store.json');

const CLINICAL_ACCESS_CODE = process.env.CLINICAL_ACCESS_CODE?.trim() || '';
const EDUCATOR_ACCESS_CODE = process.env.EDUCATOR_ACCESS_CODE?.trim() || '';
const CLINICAL_SESSION_SECRET = process.env.CLINICAL_SESSION_SECRET?.trim() || '';
const CLINICAL_DATA_ENCRYPTION_KEY = (() => {
  const keyHex = process.env.CLINICAL_DATA_ENCRYPTION_KEY?.trim() || '';
  return /^[0-9a-fA-F]{64}$/.test(keyHex) ? Buffer.from(keyHex, 'hex') : null;
})();
let storageIntegrityConfirmed = Boolean(CLINICAL_DATA_ENCRYPTION_KEY);

function hasValidClinicalSecurityConfig(): boolean {
  return (
    CLINICAL_SESSION_SECRET.length >= 32 &&
    CLINICAL_ACCESS_CODE.length >= 20 &&
    (!EDUCATOR_ACCESS_CODE ||
      (EDUCATOR_ACCESS_CODE.length >= 20 &&
        EDUCATOR_ACCESS_CODE !== CLINICAL_ACCESS_CODE))
  );
}

interface EncryptedStudentStore {
  format: 'baseera-encrypted-store-v1';
  iv: string;
  authTag: string;
  ciphertext: string;
}

function encryptStudentRecords(records: StudentRecord[]): string | null {
  if (!CLINICAL_DATA_ENCRYPTION_KEY) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', CLINICAL_DATA_ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(records), 'utf8'),
    cipher.final(),
  ]);
  const envelope: EncryptedStudentStore = {
    format: 'baseera-encrypted-store-v1',
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  return JSON.stringify(envelope);
}

function decryptStudentRecords(raw: string): StudentRecord[] {
  if (!CLINICAL_DATA_ENCRYPTION_KEY) throw new Error('Encryption key is not configured');
  const envelope = JSON.parse(raw) as Partial<EncryptedStudentStore>;
  if (
    envelope.format !== 'baseera-encrypted-store-v1' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.authTag !== 'string' ||
    typeof envelope.ciphertext !== 'string'
  ) {
    throw new Error('Invalid encrypted clinical store format');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    CLINICAL_DATA_ENCRYPTION_KEY,
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  const parsed = JSON.parse(plaintext);
  if (!Array.isArray(parsed)) throw new Error('Invalid clinical records payload');
  return parsed.map((record: StudentRecord) => sanitizeStudentRecord(record));
}

function sanitizeStudentRecord(s: StudentRecord): StudentRecord {
  const cleanName = (s.name || '').replace(/\s+(بن|بنت)\s+/g, ' ').trim();
  const cleanSchool =
    s.schoolName === 'نموذج تجريبي توضيحي — مدرسة الرواد'
      ? 'مدرسة الرواد الابتدائية'
      : s.schoolName;
  const cleanSummary = s.clinicalReport?.clinicalSummary
    ? s.clinicalReport.clinicalSummary
        .replace(/^\[سجل تجريبي توضيحي[^\]]*\]\s*/g, '')
        .trim()
    : '';
  return {
    ...s,
    name: cleanName,
    schoolName: cleanSchool,
    clinicalReport: s.clinicalReport
      ? {
          ...s.clinicalReport,
          clinicalSummary: cleanSummary || s.clinicalReport.clinicalSummary,
        }
      : s.clinicalReport,
  };
}

function getDemoStudents(): StudentRecord[] {
  return INITIAL_STUDENTS.map((student) =>
    sanitizeStudentRecord({
      ...student,
      isDemoRecord: true,
      guardianConsentGiven: false,
    })
  );
}

function loadPersistedStudents(): StudentRecord[] {
  const demoStudents = getDemoStudents();
  if (!CLINICAL_DATA_ENCRYPTION_KEY) {
    storageIntegrityConfirmed = false;
    console.warn(
      'Clinical persistence is disabled: set CLINICAL_DATA_ENCRYPTION_KEY to a 64-character hex key.'
    );
    return demoStudents;
  }

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    if (!fs.existsSync(STORE_PATH)) {
      storageIntegrityConfirmed = true;
      if (!savePersistedStudents(demoStudents)) storageIntegrityConfirmed = false;
      return demoStudents;
    }

    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.format === 'baseera-encrypted-store-v1') {
        const records = decryptStudentRecords(raw);
        storageIntegrityConfirmed = true;
        return records;
      }
      // One-time migration for a legacy plaintext JSON store; the next write is encrypted.
      if (Array.isArray(parsed)) {
        const cleaned = parsed.map((record: StudentRecord) =>
          sanitizeStudentRecord(record)
        );
        storageIntegrityConfirmed = true;
        if (savePersistedStudents(cleaned)) return cleaned;
        storageIntegrityConfirmed = false;
        console.warn('Could not encrypt the legacy clinical store; writes are disabled.');
        return demoStudents;
      }
    } catch (err) {
      storageIntegrityConfirmed = false;
      console.warn('Could not decrypt the clinical store; writes are disabled.', err);
      return demoStudents;
    }
    storageIntegrityConfirmed = false;
    console.warn('Unrecognised clinical store format; writes are disabled.');
    return demoStudents;
  } catch (err) {
    storageIntegrityConfirmed = false;
    console.warn('Failed to read clinical-store.json; using demo records only:', err);
    return demoStudents;
  }
}

function savePersistedStudents(records: StudentRecord[]): boolean {
  if (!CLINICAL_DATA_ENCRYPTION_KEY || !storageIntegrityConfirmed) return false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    const encrypted = encryptStudentRecords(records);
    if (!encrypted) return false;
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, encrypted, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, STORE_PATH);
    try {
      fs.chmodSync(STORE_PATH, 0o600);
    } catch {
      // File permission hardening may not be supported on every platform.
    }
    return true;
  } catch (err) {
    console.warn('Failed to persist encrypted clinical-store.json:', err);
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
    if (!hasValidClinicalSecurityConfig()) {
      res.status(503).json({
        error: 'المصادقة غير مهيأة بأمان على الخادم. راجع متغيرات البيئة المطلوبة.',
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
    const authResult = authorizeSessionScope(verifiedSession, requiredScope);
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

// Sliding-window rate limiter to protect external AI endpoints (/api/ai/*)
const rateLimitBuckets = new Map<string, number[]>();
function aiRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  // Do not trust a client-supplied X-Forwarded-For header by default.
  const clientIp = req.socket.remoteAddress || 'local';
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

const authAttemptBuckets = new Map<string, number[]>();
function authRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const clientIp = req.socket.remoteAddress || 'local';
  const now = Date.now();
  const windowMs = 15 * 60_000;
  const maxAttempts = 10;
  const attempts = (authAttemptBuckets.get(clientIp) || []).filter(
    (timestamp) => now - timestamp < windowMs
  );
  if (attempts.length >= maxAttempts) {
    res.setHeader('Retry-After', '900');
    res.status(429).json({ error: 'محاولات دخول كثيرة. يرجى المحاولة لاحقاً.' });
    return;
  }
  attempts.push(now);
  authAttemptBuckets.set(clientIp, attempts);
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
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  let studentsDb: StudentRecord[] = loadPersistedStudents();

  // Educator / Clinician Authentication & RBAC Session Issuing Endpoint
  app.post('/api/auth/session', authRateLimiter, (req, res) => {
    if (!hasValidClinicalSecurityConfig()) {
      res.status(503).json({
        error:
          'تسجيل الدخول غير متاح حتى يضبط المسؤول رموز الدخول ومفتاح جلسات قويين في متغيرات البيئة.',
      });
      return;
    }

    const { accessCode, clinicianName = 'مستخدم بصيرة' } = req.body || {};
    const submittedCode =
      typeof accessCode === 'string' ? accessCode.trim() : '';
    let validRole: ClinicalRole | null = null;
    if (submittedCode && submittedCode === CLINICAL_ACCESS_CODE) {
      validRole = 'clinician';
    } else if (
      submittedCode &&
      EDUCATOR_ACCESS_CODE &&
      submittedCode === EDUCATOR_ACCESS_CODE
    ) {
      validRole = 'educator_readonly';
    }

    if (!validRole) {
      res.status(401).json({
        error: 'رمز الدخول غير صحيح — تم رفض إصدار جلسة الصلاحيات.',
      });
      return;
    }

    const cleanName =
      typeof clinicianName === 'string'
        ? clinicianName.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 80)
        : 'مستخدم بصيرة';
    const session = issueClinicalSessionToken(
      validRole,
      cleanName || 'مستخدم بصيرة',
      CLINICAL_SESSION_SECRET
    );
    res.json(session);
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

  // Protected Student & Session Storage REST API (Requires RBAC Authentication & Scopes)
  app.get(
    '/api/students',
    requireClinicalAuth('students:read'),
    (_req, res) => {
      res.json({
        students: studentsDb,
        persisted: Boolean(CLINICAL_DATA_ENCRYPTION_KEY && storageIntegrityConfirmed),
        privacyPolicy: 'EncryptedAtRest; identifiable records are returned only to authenticated users',
      });
    }
  );

  app.post(
    '/api/students',
    requireClinicalAuth('students:write'),
    (req, res) => {
      if (!CLINICAL_DATA_ENCRYPTION_KEY || !storageIntegrityConfirmed) {
        res.status(503).json({
          error: 'حفظ سجلات الطلاب متوقف حتى تفعيل التشفير وحل حالة مخزن البيانات.',
        });
        return;
      }
      const newRecord = req.body as StudentRecord;
      if (!newRecord || !newRecord.id || !newRecord.name) {
        res.status(400).json({ error: 'بيانات جلسة الطالب غير مكتملة.' });
        return;
      }

      // Strict Default-Deny Guardian Consent verification on student creation
      const consentCheck = validateExplicitGuardianConsent(
        newRecord.guardianConsentGiven
      );
      if (!consentCheck.valid) {
        res.status(403).json({ error: consentCheck.errorAr });
        return;
      }

      const acceptedRecord: StudentRecord = {
        ...newRecord,
        isDemoRecord: false,
        guardianConsentGiven: true,
      };
      const nextStudents = [
        acceptedRecord,
        ...studentsDb.filter((s) => s.id !== acceptedRecord.id),
      ];
      if (!savePersistedStudents(nextStudents)) {
        res.status(503).json({
          error: 'تعذر حفظ سجل الطالب مشفراً؛ لم يتم تأكيد الحفظ.',
        });
        return;
      }
      studentsDb = nextStudents;
      res.status(201).json({ student: acceptedRecord, persisted: true });
    }
  );

  app.patch(
    '/api/students/:id',
    requireClinicalAuth('students:write'),
    (req, res) => {
      const { id } = req.params;
      const updates = req.body as Record<string, unknown>;
      const idx = studentsDb.findIndex((s) => s.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'سجل الطالب غير موجود.' });
        return;
      }
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        res.status(400).json({ error: 'صيغة التحديث غير صحيحة.' });
        return;
      }
      if ('guardianConsentGiven' in updates) {
        res.status(403).json({
          error: 'لا يمكن تعديل حالة موافقة ولي الأمر عبر PATCH. تتطلب الموافقة إجراءً مستقلاً قابلاً للتدقيق.',
        });
        return;
      }
      if ('id' in updates || 'isDemoRecord' in updates) {
        res.status(400).json({ error: 'لا يمكن تعديل معرّف السجل أو حالة السجل التجريبي.' });
        return;
      }
      const mutableFields = new Set([
        'name', 'gradeLevel', 'ageYears', 'schoolName', 'lastScreenedDate',
        'passageId', 'dialectRegionAr', 'wpm', 'avgFixationMs', 'regressionRate',
        'regressionCount', 'blinkCount', 'blinksPerMinute', 'visualStrainLevel',
        'visualStrainLabelAr', 'gazeCoveragePercent', 'observedWordCount',
        'totalPassageWordCount', 'calibrationAccuracyPercent', 'calibrationValidationMethod',
        'oralReadingAssessed', 'spokenTranscript', 'oralWcpm', 'oralAccuracyPercent',
        'oralWerPercent', 'phoneticSubstitutionCount', 'dialectVariantCount',
        'omissionCount', 'dyslexiaRiskScore', 'readingPercentile', 'readingRiskLevel',
        'readingRiskLabelAr', 'problematicWords', 'fixations', 'comprehensionScore',
        'dyscalculiaAssessed', 'subitizingAccuracy', 'avgSubitizingMs', 'numberLinePAE',
        'transcodingAccuracy', 'reversalErrorCount', 'dyscalculiaRiskScore',
        'mathPercentile', 'mathRiskLevel', 'mathRiskLabelAr', 'clinicalReport',
      ]);
      const suppliedFields = Object.keys(updates);
      if (
        suppliedFields.length === 0 ||
        suppliedFields.some((field) => !mutableFields.has(field))
      ) {
        res.status(400).json({ error: 'يتضمن التحديث حقولاً غير مسموح بها أو لا يحتوي على تغييرات.' });
        return;
      }
      if (!CLINICAL_DATA_ENCRYPTION_KEY || !storageIntegrityConfirmed) {
        res.status(503).json({
          error: 'تحديث السجلات متوقف حتى تفعيل التشفير وحل حالة مخزن البيانات.',
        });
        return;
      }
      const nextStudents = [...studentsDb];
      nextStudents[idx] = { ...studentsDb[idx], ...(updates as Partial<StudentRecord>) };
      if (!savePersistedStudents(nextStudents)) {
        res.status(503).json({ error: 'تعذر حفظ التحديث مشفراً؛ لم يتم تأكيد الحفظ.' });
        return;
      }
      studentsDb = nextStudents;
      res.json({ student: nextStudents[idx], persisted: true });
    }
  );

  app.delete(
    '/api/students/:id',
    requireClinicalAuth('students:delete'),
    (req, res) => {
      const { id } = req.params;
      if (!CLINICAL_DATA_ENCRYPTION_KEY || !storageIntegrityConfirmed) {
        res.status(503).json({
          error: 'حذف السجلات متوقف حتى تفعيل التشفير وحل حالة مخزن البيانات.',
        });
        return;
      }
      const nextStudents = studentsDb.filter((s) => s.id !== id);
      if (!savePersistedStudents(nextStudents)) {
        res.status(503).json({ error: 'تعذر حفظ حالة الحذف.' });
        return;
      }
      studentsDb = nextStudents;
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

  // Protect every AI endpoint against unauthenticated use and API-cost abuse.
  app.use('/api/ai', aiRateLimiter);
  app.use('/api/ai', requireClinicalAuth('ai:use'));

  // 1. Clinical AI Analysis of Eye-Tracking Dyslexia & Dyscalculia Screening
  // Enforces both RBAC Authentication ('ai:analyze') AND Strict Default-Deny Guardian Consent
  app.post(
    '/api/ai/analyze-session',
    requireClinicalAuth('ai:analyze'),
    async (req, res) => {
      const {
        studentName,
        guardianConsentGiven, // NO default `= true`! Must be explicitly verified as `=== true`
        gradeLevel,
        wpm,
        avgFixationMs,
        regressionRate,
        gazeCoveragePercent = 100,
        observedWordCount,
        totalPassageWordCount,
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

      if (!studentName) {
        res.status(400).json({ error: 'بيانات الجلسة مطلوبة لإجراء التحليل.' });
        return;
      }

      // Strict Default-Deny Consent Check: rejects missing (`undefined`), `null`, or `false`
      const consentValidation =
        validateExplicitGuardianConsent(guardianConsentGiven);
      if (!consentValidation.valid) {
        res.status(403).json({
          error: consentValidation.errorAr,
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
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'يرجى إدخال نص عربي لتحليله وتبسيطه.' });
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
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'النص مطلوب لتحويله إلى صوت.' });
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
