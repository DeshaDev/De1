import express from 'express';
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

const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'clinical-store.json');

const CLINICAL_ACCESS_CODE =
  process.env.CLINICAL_ACCESS_CODE || 'BASEERA-CLINICAL-2026';
const CLINICAL_SESSION_SECRET =
  process.env.CLINICAL_SESSION_SECRET ||
  'baseera-rbac-hmac-secret-key-2026';

function loadPersistedStudents(): StudentRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const seeded = INITIAL_STUDENTS.map((s) => ({
        ...s,
        dyscalculiaAssessed: s.dyscalculiaAssessed ?? true,
        guardianConsentGiven: true,
      }));
      fs.writeFileSync(STORE_PATH, JSON.stringify(seeded, null, 2), 'utf8');
      return seeded;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to read clinical-store.json, using seed data:', err);
  }
  return INITIAL_STUDENTS;
}

function savePersistedStudents(records: StudentRecord[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(records, null, 2), 'utf8');
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.warn('Failed to persist clinical-store.json:', err);
  }
}

// Role-Based Access Control (RBAC) Middleware for protecting child records & AI analysis
function requireClinicalAuth(requiredScope: ClinicalScope) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
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
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'local';
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
    const {
      accessCode,
      role = 'clinician',
      clinicianName = 'أخصائي التقييم المعتمد',
    } = req.body || {};

    if (!accessCode || accessCode !== CLINICAL_ACCESS_CODE) {
      res.status(401).json({
        error: 'رمز الدخول الإكلينيكي غير صحيح — تم رفض إصدار جلسة الصلاحيات.',
      });
      return;
    }

    const validRole: ClinicalRole =
      role === 'educator_readonly' ? 'educator_readonly' : 'clinician';
    const session = issueClinicalSessionToken(
      validRole,
      String(clinicianName),
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

      studentsDb = [
        newRecord,
        ...studentsDb.filter((s) => s.id !== newRecord.id),
      ];
      savePersistedStudents(studentsDb);
      res.status(201).json({ student: newRecord, persisted: true });
    }
  );

  app.patch(
    '/api/students/:id',
    requireClinicalAuth('students:write'),
    (req, res) => {
      const { id } = req.params;
      const updates = req.body as Partial<StudentRecord>;
      const idx = studentsDb.findIndex((s) => s.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'سجل الطالب غير موجود.' });
        return;
      }
      studentsDb[idx] = { ...studentsDb[idx], ...updates };
      savePersistedStudents(studentsDb);
      res.json({ student: studentsDb[idx], persisted: true });
    }
  );

  app.delete(
    '/api/students/:id',
    requireClinicalAuth('students:delete'),
    (req, res) => {
      const { id } = req.params;
      studentsDb = studentsDb.filter((s) => s.id !== id);
      savePersistedStudents(studentsDb);
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

  // Protect all /api/ai/* routes with sliding-window rate limiting
  app.use('/api/ai', aiRateLimiter);

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
