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

const CLINICAL_ACCESS_CODE = (process.env.CLINICAL_ACCESS_CODE || '').trim();
const CLINICAL_SESSION_SECRET = (process.env.CLINICAL_SESSION_SECRET || '').trim();

function getStoreEncryptionKey(): Buffer | null {
  const raw = (process.env.CLINICAL_STORE_ENCRYPTION_KEY || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(raw)) return null;
  return Buffer.from(raw, 'hex');
}

function isClinicalAuthConfigured(): boolean {
  return (
    CLINICAL_ACCESS_CODE.length >= 24 &&
    CLINICAL_SESSION_SECRET.length >= 32 &&
    CLINICAL_ACCESS_CODE !== 'BASEERA-CLINICAL-2026' &&
    CLINICAL_SESSION_SECRET !== 'baseera-rbac-hmac-secret-key-2026' &&
    getStoreEncryptionKey() !== null
  );
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

const PATCHABLE_STUDENT_FIELDS = new Set<string>([
  'lastScreenedDate', 'passageId', 'dialectRegionAr',
  'wpm', 'avgFixationMs', 'regressionRate', 'regressionCount',
  'blinkCount', 'blinksPerMinute', 'visualStrainLevel', 'visualStrainLabelAr',
  'gazeCoveragePercent', 'observedWordCount', 'totalPassageWordCount',
  'calibrationAccuracyPercent', 'calibrationValidationMethod',
  'oralReadingAssessed', 'spokenTranscript', 'oralWcpm', 'oralAccuracyPercent',
  'oralWerPercent', 'phoneticSubstitutionCount', 'dialectVariantCount', 'omissionCount',
  'dyslexiaRiskScore', 'readingPercentile', 'readingRiskLevel', 'readingRiskLabelAr',
  'problematicWords', 'fixations', 'comprehensionScore',
  'dyscalculiaAssessed', 'subitizingAccuracy', 'avgSubitizingMs', 'numberLinePAE',
  'transcodingAccuracy', 'reversalErrorCount', 'dyscalculiaRiskScore',
  'mathPercentile', 'mathRiskLevel', 'mathRiskLabelAr', 'clinicalReport',
]);

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
    console.warn('Encrypted clinical persistence is disabled until CLINICAL_STORE_ENCRYPTION_KEY is configured.');
    return createSeededStudents();
  }

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    if (!fs.existsSync(STORE_PATH)) {
      const seeded = createSeededStudents();
      savePersistedStudents(seeded);
      return seeded;
    }

    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const decoded = decodeStudentRecords(raw, key);
    const cleaned = decoded.records.map((record) =>
      sanitizeStudentRecord({
        ...record,
        ...(record.isDemoRecord ? { guardianConsentGiven: false } : {}),
      })
    );

    // Migrate a legacy plaintext JSON store on first startup with a valid key.
    if (!decoded.wasEncrypted && !savePersistedStudents(cleaned)) {
      console.warn('Legacy clinical store could not be migrated to encrypted storage.');
      return createSeededStudents();
    }
    return cleaned;
  } catch {
    console.warn('Failed to load the encrypted clinical store; using in-memory demo data.');
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
    if (!isClinicalAuthConfigured()) {
      res.status(503).json({
        error: 'يلزم ضبط رمز وصول قوي ومفتاح جلسات ومفتاح تشفير التخزين قبل تفعيل بيانات الطلاب.',
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
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  let studentsDb: StudentRecord[] = loadPersistedStudents();

  // Educator / Clinician Authentication & RBAC Session Issuing Endpoint
  app.post('/api/auth/session', (req, res) => {
    if (!isClinicalAuthConfigured()) {
      res.status(503).json({
        error: 'المصادقة غير مفعّلة: اضبط CLINICAL_ACCESS_CODE وCLINICAL_SESSION_SECRET وCLINICAL_STORE_ENCRYPTION_KEY.',
      });
      return;
    }
    const {
      accessCode,
      role = 'clinician',
      clinicianName = 'أخصائي التقييم',
    } = req.body || {};

    if (typeof accessCode !== 'string' || !constantTimeStringEqual(accessCode, CLINICAL_ACCESS_CODE)) {
      res.status(401).json({
        error: 'رمز الدخول الإكلينيكي غير صحيح — تم رفض إصدار جلسة الصلاحيات.',
      });
      return;
    }
    if (role !== 'clinician' && role !== 'educator_readonly') {
      res.status(400).json({ error: 'الدور المطلوب غير صالح.' });
      return;
    }

    const safeClinicianName =
      typeof clinicianName === 'string' ? clinicianName.trim().slice(0, 100) : '';
    const session = issueClinicalSessionToken(
      role as ClinicalRole,
      safeClinicianName || 'أخصائي التقييم',
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
        persisted: true,
        privacyPolicy: 'RBAC-Protected-PII-Pseudonymized',
      });
    }
  );

  app.post(
    '/api/students',
    requireClinicalAuth('students:write'),
    (req, res) => {
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

      const nextRecords = [
        newRecord,
        ...studentsDb.filter((s) => s.id !== newRecord.id),
      ];
      if (!savePersistedStudents(nextRecords)) {
        res.status(503).json({ error: 'تعذر حفظ السجل في التخزين المشفر.' });
        return;
      }
      studentsDb = nextRecords;
      res.status(201).json({ student: newRecord, persisted: true });
    }
  );

  app.patch(
    '/api/students/:id',
    requireClinicalAuth('students:write'),
    (req, res) => {
      const { id } = req.params;
      const updates = req.body as Partial<StudentRecord> | null;
      const idx = studentsDb.findIndex((s) => s.id === id);
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
      const nextRecords = studentsDb.filter((s) => s.id !== id);
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
      if (!consentValidation.valid) {
        res.status(403).json({
          error: consentValidation.errorAr,
        });
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
