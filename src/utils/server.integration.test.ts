import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execSync, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { ARABIC_READING_PASSAGES } from '../data/seedData';
import { SUBTESTS_BY_ID } from '../cognitiveProfile/battery';

const PLATFORM_ADMIN_CODE = 'ee7c3523458b091f0923ac7815de4231b578cde09852341a';
const SCHOOL_A_ADMIN_CODE = '3580bd6cfaada2ae57b75b7af6d75cd86fd18211ecc8bc1d';
const SCHOOL_A_EDUCATOR_CODE = 'f0ab09100c10d620b00517b933ab8c45109b7c8eab249f34';
const SCHOOL_B_ADMIN_CODE = '3a105ca0e52fb126fd4ed59979ea6ac2e8ddcd0f0edfcd53';
const SCHOOL_B_EDUCATOR_CODE = '44cb83fefd7812bbb449d63d2323160f6ce0d1524910d368';

const TEST_ENV = {
  ...process.env,
  GEMINI_API_KEY: '', // Keep integration tests deterministic and prevent external model calls.
  NODE_ENV: 'production',
  TRUST_PROXY_HOPS: '0',
  BASEERA_STORE_ENCRYPTION_KEY:
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  BASEERA_SESSION_SECRET:
    'test-hmac-signing-secret-32chars-minimum-distinct-2026!',
  BASEERA_PLATFORM_ADMIN_CODE: PLATFORM_ADMIN_CODE,
  BASEERA_TENANT_CREDENTIALS: JSON.stringify({
    school_a: {
      school_admin: SCHOOL_A_ADMIN_CODE,
      educator_readonly: SCHOOL_A_EDUCATOR_CODE,
    },
    school_b: {
      school_admin: SCHOOL_B_ADMIN_CODE,
      educator_readonly: SCHOOL_B_EDUCATOR_CODE,
    },
  }),
};

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
    srv.on('error', reject);
  });
}

async function waitForServer(baseUrl: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/students`);
      if (res.status === 401 || res.status === 200) return;
    } catch {
      // Server not listening yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Server at ${baseUrl} did not start within ${timeoutMs}ms`);
}

function buildPlausibleReadingEvidence() {
  const passage = ARABIC_READING_PASSAGES[0];
  return {
    assessmentModality: 'reading_only',
    passageId: passage.id,
    readingDurationSeconds: 28,
    comprehensionAnswers: passage.comprehensionQuestions.map((q) => q.correctIndex),
    guardianConsentGiven: true,
    guardianConsentRecordedAt: '2026-03-01T08:00:00.000Z',
    guardianConsentSource: 'نموذج موافقة ولي الأمر الورقي المؤرشف بالمدرسة',
  };
}

function buildCanonicalMathTrials() {
  return {
    subitizingTrials: [
      { dotCount: 1, chosen: 1, correct: true, reactionTimeMs: 620 },
      { dotCount: 2, chosen: 2, correct: true, reactionTimeMs: 680 },
      { dotCount: 3, chosen: 3, correct: true, reactionTimeMs: 740 },
      { dotCount: 4, chosen: 4, correct: true, reactionTimeMs: 810 },
    ],
    numberLineTrials: [
      { target: 37, userEstimate: 39, scaleMin: 0, scaleMax: 100, reactionTimeMs: 2100 },
      { target: 156, userEstimate: 150, scaleMin: 0, scaleMax: 200, reactionTimeMs: 2300 },
    ],
    transcodingTrials: [
      { targetNumber: 47, selectedNumber: 47, isReversalError: false, reactionTimeMs: 1750 },
      { targetNumber: 83, selectedNumber: 38, isReversalError: true, reactionTimeMs: 2200 },
      { targetNumber: 69, selectedNumber: 69, isReversalError: false, reactionTimeMs: 2450 },
    ],
  };
}

describe('Real HTTP Server Integration Tests (server.ts)', () => {
  let serverProc: ChildProcess | null = null;
  let baseUrl = '';
  let tempDir = '';
  let securityStateFile = '';
  let port = 0;

  async function startServerInstance() {
    port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const tsxBin =
      process.platform === 'win32'
        ? path.resolve(process.cwd(), 'node_modules/.bin/tsx.cmd')
        : path.resolve(process.cwd(), 'node_modules/.bin/tsx');
    serverProc = spawn(tsxBin, ['server.ts'], {
      cwd: process.cwd(),
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ...TEST_ENV,
        PORT: String(port),
        BASEERA_DATA_DIR: tempDir,
      },
      stdio: 'pipe',
    });
    await waitForServer(baseUrl);
  }

  async function stopServerInstance() {
    if (serverProc) {
      const proc = serverProc;
      serverProc = null;
      if (process.platform === 'win32' && proc.pid) {
        try {
          execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
        } catch {}
      } else {
        proc.kill('SIGTERM');
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseera-http-test-'));
    securityStateFile = path.join(tempDir, 'security-state.json');
    await startServerInstance();
  });

  after(async () => {
    await stopServerInstance();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  async function loginWithCode(accessCode: string) {
    const res = await fetch(`${baseUrl}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode, accountName: 'مختبر النظام' }),
    });
    assert.equal(res.status, 200);
    return (await res.json()) as {
      token: string;
      role: string;
      tenantId: string;
      tenantDisplayNameAr: string;
      scopes: string[];
    };
  }

  it('allows >10 consecutive valid logins without triggering 429 and returns Arabic school display name', async () => {
    for (let i = 0; i < 11; i++) {
      const session = await loginWithCode(SCHOOL_A_ADMIN_CODE);
      assert.equal(session.tenantId, 'school_a');
      assert.equal(session.tenantDisplayNameAr, 'مدرسة الرواد الأولى (أ)');
    }
  });

  it('returns JSON 404 for unknown API routes and never serves the SPA shell to non-GET requests', async () => {
    for (const [method, route] of [
      ['GET', '/api/route-that-does-not-exist'],
      ['DELETE', '/api/route-that-does-not-exist'],
    ] as const) {
      const response = await fetch(`${baseUrl}${route}`, { method });
      assert.equal(response.status, 404);
      assert.match(response.headers.get('content-type') || '', /application\/json/);
      const body = (await response.json()) as { error: string };
      assert.equal(body.error, 'مسار API غير موجود.');
    }

    const deleteUnknownPage = await fetch(`${baseUrl}/route-that-does-not-exist`, {
      method: 'DELETE',
    });
    assert.equal(deleteUnknownPage.status, 404);
    assert.match(deleteUnknownPage.headers.get('content-type') || '', /application\/json/);
    assert.equal(
      ((await deleteUnknownPage.json()) as { error: string }).error,
      'المسار غير موجود.'
    );
  });

  it('requires an authenticated learning session for AI training and never trusts client-supplied words as teacher-reviewed', async () => {
    const noSession = await fetch(`${baseUrl}/api/remediation/curated-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gradeLevel: 3, problematicWords: ['كلمات اخترعها العميل'] }),
    });
    assert.equal(noSession.status, 401);

    const session = await loginWithCode(SCHOOL_A_ADMIN_CODE);
    const forgedTargets = await fetch(`${baseUrl}/api/remediation/curated-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        gradeLevel: 3,
        dialect: 'msa',
        problematicWords: ['كلمات اخترعها العميل'],
      }),
    });
    assert.equal(forgedTargets.status, 200);
    const payload = (await forgedTargets.json()) as {
      targetWordsUsed: string[];
      targetWordsAreTeacherReviewed: boolean;
      session: { learningRationale: string };
    };
    assert.deepEqual(payload.targetWordsUsed, []);
    assert.equal(payload.targetWordsAreTeacherReviewed, false);
    assert.match(payload.session.learningRationale, /أمثلة تعليمية وليست أخطاء مرصودة/);
  });

  it('protects all cloud AI endpoints and retires the fabricated IEP generator', async () => {
    const cloudRoutes = [
      '/api/ai/generate-story',
      '/api/ai/generate-iep',
      '/api/ai/tts',
      '/api/ai/pronunciation-assessment',
    ];

    for (const route of cloudRoutes) {
      const response = await fetch(`${baseUrl}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'اختبار بلا بيانات طفل' }),
      });
      assert.equal(response.status, 401, `${route} must require an authenticated session`);
    }

    const session = await loginWithCode(SCHOOL_A_ADMIN_CODE);
    const retiredIep = await fetch(`${baseUrl}/api/ai/generate-iep`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(retiredIep.status, 410);
    const retiredPayload = (await retiredIep.json()) as { code: string; baselineSummary?: string };
    assert.equal(retiredPayload.code, 'IEP_GENERATOR_RETIRED');
    assert.equal(retiredPayload.baselineSummary, undefined);
  });

  it('derives reading scores & non-empty recommendations server-side, preserves full Arabic names, tags client-reported, and blocks client score injection', async () => {
    const schoolAAdmin = await loginWithCode(SCHOOL_A_ADMIN_CODE);
    const schoolBAdmin = await loginWithCode(SCHOOL_B_ADMIN_CODE);

    // 1. Attempt to inject dyslexiaRiskScore or readingRiskLevel or tenantId -> 400
    const forgedRes = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolAAdmin.token}`,
      },
      body: JSON.stringify({
        id: 'stu-forged-1',
        name: 'طالب مزيف',
        gradeLevel: 4,
        ageYears: 10,
        schoolName: 'مدرسة أ',
        dyslexiaRiskScore: 5,
        ...buildPlausibleReadingEvidence(),
      }),
    });
    assert.equal(forgedRes.status, 400);

    // 2. Attempt implausible evidence: 53 words * 420ms in readingDurationSeconds=4 -> 400
    const passage = ARABIC_READING_PASSAGES[0];
    const impossibleRes = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolAAdmin.token}`,
      },
      body: JSON.stringify({
        id: 'stu-impossible-1',
        name: 'طالب مستحيل',
        gradeLevel: 4,
        ageYears: 10,
        schoolName: 'مدرسة أ',
        ...buildPlausibleReadingEvidence(),
        readingDurationSeconds: 4,
      }),
    });
    assert.equal(impossibleRes.status, 400);

    // A full elementary passage in six seconds must fail the WPM plausibility ceiling.
    const tooFastRes = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolAAdmin.token}`,
      },
      body: JSON.stringify({
        id: 'stu-too-fast-1',
        name: 'قارئ سريع بصورة غير معقولة',
        gradeLevel: 4,
        ageYears: 10,
        schoolName: 'مدرسة أ',
        ...buildPlausibleReadingEvidence(),
        readingDurationSeconds: 6,
      }),
    });
    assert.equal(tooFastRes.status, 400);

    // 3. Create valid student record from raw evidence and preserve the full name, including "بن".
    const createRes = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolAAdmin.token}`,
      },
      body: JSON.stringify({
        id: 'stu-http-school-a-1',
        name: 'طالب بن خالد التجريبي',
        gradeLevel: 4,
        ageYears: 10,
        schoolName: 'مدرسة أ',
        ...buildPlausibleReadingEvidence(),
      }),
    });
    assert.equal(createRes.status, 201);
    const createdBody = (await createRes.json()) as { student: Record<string, any> };
    assert.equal(createdBody.student.name, 'طالب بن خالد التجريبي');
    assert.equal(createdBody.student.evidenceProvenance, 'client-reported');
    assert.ok(createdBody.student.wpm > 0);
    assert.equal(createdBody.student.comprehensionScore, 100);
    assert.ok(Array.isArray(createdBody.student.learningReport.interventionExercises));
    assert.ok(createdBody.student.learningReport.interventionExercises.length >= 2);
    assert.ok(Array.isArray(createdBody.student.learningReport.classroomAccommodations));
    assert.ok(createdBody.student.learningReport.classroomAccommodations.length >= 2);

    // 4. Cross-tenant POST with existing ID from School A returns 404 (not 409) so it does not leak ID existence
    const crossTenantCreate = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolBAdmin.token}`,
      },
      body: JSON.stringify({
        id: 'stu-http-school-a-1',
        name: 'طالب مدرسة ب',
        gradeLevel: 4,
        ageYears: 10,
        schoolName: 'مدرسة ب',
        ...buildPlausibleReadingEvidence(),
      }),
    });
    assert.equal(crossTenantCreate.status, 404);
  });

  it('enforces strict 4-field PATCH and saves updated AI learningReport + mathTrials via dedicated PUT routes', async () => {
    const schoolAdmin = await loginWithCode(SCHOOL_A_ADMIN_CODE);

    // 1. Sending { learningReport } to PATCH /api/students/:id returns 400
    const badPatch = await fetch(`${baseUrl}/api/students/stu-http-school-a-1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolAdmin.token}`,
      },
      body: JSON.stringify({
        learningReport: { learningSummary: 'محاولة عبر المسار الخاطئ' },
      }),
    });
    assert.equal(badPatch.status, 400);

    // 2. Valid 4-field profile PATCH succeeds and preserves the supplied Arabic name.
    const goodPatch = await fetch(`${baseUrl}/api/students/stu-http-school-a-1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolAdmin.token}`,
      },
      body: JSON.stringify({
        name: 'نورة بنت سعد العتيبي',
        schoolName: 'مدرسة أ المحدثة',
        gradeLevel: 4,
        ageYears: 10,
      }),
    });
    assert.equal(goodPatch.status, 200);
    const patchedBody = (await goodPatch.json()) as { student: Record<string, any> };
    assert.equal(patchedBody.student.name, 'نورة بنت سعد العتيبي');

    // 3. Dedicated PUT /api/students/:id/learning-report saves full report with exercises & accommodations
    const updatedReport = {
      learningSummary: 'ملخص محدث بالذكاء الاصطناعي يوضح استقرار الطلاقة القرائية.',
      ocularMotorAnalysis: 'تحليل حركة العين بعد التحديث يظهر تثبيتات منتظمة.',
      orthographicAndPhonologicalPatterns: 'تحليل الصرف والأصوات العربية المحدث.',
      dyscalculiaSpatialAnalysis: 'تحليل الحس العددي والمكاني المحدث.',
      interventionExercises: [
        {
          title: 'تدريب الطلاقة المقطعية المحدث',
          description: 'قراءة الجمل العربية المقسمة بصرياً لمدة عشر دقائق يومياً.',
          durationMinutes: 10,
        },
        {
          title: 'تثبيت المسار البصري بالمسطرة',
          description: 'استخدام مسطرة التتبع القرائي للحد من الارتدادات.',
          durationMinutes: 10,
        },
      ],
      classroomAccommodations: [
        'توفير نسخة مكبرة بتباعد مريح بين الأسطر.',
        'منح وقت إضافي بنسبة 25% في المهام القرائية.',
      ],
    };

    const putReportRes = await fetch(
      `${baseUrl}/api/students/stu-http-school-a-1/learning-report`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${schoolAdmin.token}`,
        },
        body: JSON.stringify({ learningReport: updatedReport }),
      }
    );
    assert.equal(putReportRes.status, 200);
    const savedReportBody = (await putReportRes.json()) as { student: Record<string, any> };
    assert.equal(
      savedReportBody.student.learningReport.learningSummary,
      updatedReport.learningSummary
    );
    assert.equal(
      savedReportBody.student.learningReport.interventionExercises.length,
      2
    );
    for (const [method, route] of [
      ['PUT', '/api/students/stu-http-school-a-1/report'],
      ['POST', '/api/students/stu-http-school-a-1/report'],
      ['POST', '/api/students/stu-http-school-a-1/learning-report'],
    ] as const) {
      const deprecatedRes = await fetch(`${baseUrl}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${schoolAdmin.token}` },
        body: JSON.stringify({ learningReport: updatedReport }),
      });
      assert.equal(deprecatedRes.status, 404);
    }

    // 4. Dedicated PUT /api/students/:id/math derives math scores from canonical 4+2+3 trials
    const putMathRes = await fetch(
      `${baseUrl}/api/students/stu-http-school-a-1/math`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${schoolAdmin.token}`,
        },
        body: JSON.stringify({ mathTrials: buildCanonicalMathTrials() }),
      }
    );
    assert.equal(putMathRes.status, 200);
    const mathBody = (await putMathRes.json()) as { student: Record<string, any> };
    assert.equal(mathBody.student.dyscalculiaAssessed, true);
    assert.equal(mathBody.student.reversalErrorCount, 1);

    // Also test full 20-task battery with target 27 selected as 72 (reversal) over real HTTP PUT
    const full20Res = await fetch(
      `${baseUrl}/api/students/stu-http-school-a-1/math`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${schoolAdmin.token}`,
        },
        body: JSON.stringify({
          mathTrials: {
            subitizingTrials: [
              { dotCount: 1, chosen: 1, correct: true, reactionTimeMs: 600 },
              { dotCount: 2, chosen: 2, correct: true, reactionTimeMs: 650 },
              { dotCount: 3, chosen: 3, correct: true, reactionTimeMs: 700 },
              { dotCount: 4, chosen: 4, correct: true, reactionTimeMs: 750 },
              { dotCount: 5, chosen: 5, correct: true, reactionTimeMs: 900 },
              { dotCount: 6, chosen: 6, correct: true, reactionTimeMs: 1100 },
              { dotCount: 7, chosen: 7, correct: true, reactionTimeMs: 1200 },
              { dotCount: 8, chosen: 8, correct: true, reactionTimeMs: 1300 },
            ],
            numberLineTrials: [
              { target: 8, userEstimate: 8, scaleMin: 0, scaleMax: 20, reactionTimeMs: 1800 },
              { target: 15, userEstimate: 14, scaleMin: 0, scaleMax: 20, reactionTimeMs: 1900 },
              { target: 37, userEstimate: 40, scaleMin: 0, scaleMax: 100, reactionTimeMs: 2100 },
              { target: 82, userEstimate: 80, scaleMin: 0, scaleMax: 100, reactionTimeMs: 2200 },
              { target: 250, userEstimate: 245, scaleMin: 0, scaleMax: 1000, reactionTimeMs: 2500 },
              { target: 750, userEstimate: 760, scaleMin: 0, scaleMax: 1000, reactionTimeMs: 2600 },
            ],
            transcodingTrials: [
              { targetNumber: 47, selectedNumber: 74, isReversalError: true, reactionTimeMs: 1800 },
              { targetNumber: 83, selectedNumber: 83, isReversalError: false, reactionTimeMs: 1900 },
              { targetNumber: 69, selectedNumber: 69, isReversalError: false, reactionTimeMs: 2000 },
              { targetNumber: 52, selectedNumber: 25, isReversalError: true, reactionTimeMs: 2100 },
              { targetNumber: 27, selectedNumber: 72, isReversalError: true, reactionTimeMs: 1700 },
              { targetNumber: 76, selectedNumber: 76, isReversalError: false, reactionTimeMs: 1950 },
            ],
          },
        }),
      }
    );
    assert.equal(full20Res.status, 200);
    const full20Body = (await full20Res.json()) as { student: Record<string, any> };
    assert.equal(full20Body.student.reversalErrorCount, 3);
    const forgedEnvelopeRes = await fetch(`${baseUrl}/api/students/stu-http-school-a-1/math`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${schoolAdmin.token}` },
      body: JSON.stringify({ mathTrials: buildCanonicalMathTrials(), mathRiskLevel: 'nominal' }),
    });
    assert.equal(forgedEnvelopeRes.status, 400);
    const forgedNested = JSON.parse(JSON.stringify(buildCanonicalMathTrials()));
    forgedNested.subitizingTrials[0].mathRiskLevel = 'nominal';
    const forgedNestedRes = await fetch(`${baseUrl}/api/students/stu-http-school-a-1/math`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${schoolAdmin.token}` },
      body: JSON.stringify({ mathTrials: forgedNested }),
    });
    assert.equal(forgedNestedRes.status, 400);
    for (const [method, route] of [
      ['POST', '/api/students/stu-http-school-a-1/math'],
      ['POST', '/api/students/stu-http-school-a-1/math-assessment'],
    ] as const) {
      const deprecatedRes = await fetch(`${baseUrl}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${schoolAdmin.token}` },
        body: JSON.stringify({ mathTrials: buildCanonicalMathTrials() }),
      });
      assert.equal(deprecatedRes.status, 404);
    }

    // Reject invented target on math endpoint -> 400
    const badTrials = buildCanonicalMathTrials();
    badTrials.numberLineTrials[0].target = 99;
    const badMathRes = await fetch(
      `${baseUrl}/api/students/stu-http-school-a-1/math`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${schoolAdmin.token}`,
        },
        body: JSON.stringify({ mathTrials: badTrials }),
      }
    );
    assert.equal(badMathRes.status, 400);
  });

  it('persists revoked tokens, audit logs (without child PII), and saved reports across server restart in encrypted security-state.json (mode 600)', async () => {
    const schoolAdminA = await loginWithCode(SCHOOL_A_ADMIN_CODE);
    const educatorA = await loginWithCode(SCHOOL_A_EDUCATOR_CODE);

    // Educator is forbidden from reading audit logs
    const educatorAuditRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${educatorA.token}` },
    });
    assert.equal(educatorAuditRes.status, 403);

    // School admin can read tenant-isolated audit logs and they contain zero child PII
    const auditRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${schoolAdminA.token}` },
    });
    assert.equal(auditRes.status, 200);
    const auditBody = (await auditRes.json()) as { auditLogs: Array<Record<string, any>> };
    assert.ok(auditBody.auditLogs.length >= 2);
    const serializedAudit = JSON.stringify(auditBody.auditLogs);
    assert.equal(serializedAudit.includes('نورة'), false);
    assert.equal(serializedAudit.includes('خالد'), false);

    // Revoke schoolAdminA token via logout
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${schoolAdminA.token}` },
    });
    assert.equal(logoutRes.status, 204);

    // Verify security-state.json exists and has 0600 permissions
    assert.equal(fs.existsSync(securityStateFile), true);
    if (process.platform !== 'win32') {
      const mode = fs.statSync(securityStateFile).mode & 0o777;
      assert.equal(mode, 0o600);
    }

    // Restart server process
    await stopServerInstance();
    await startServerInstance();

    // Revoked token MUST still return 401 after restart
    const afterRestartRevoked = await fetch(`${baseUrl}/api/students`, {
      headers: { Authorization: `Bearer ${schoolAdminA.token}` },
    });
    assert.equal(afterRestartRevoked.status, 401);

    // Fresh login sees persisted report with non-empty recommendations and persisted audit logs
    const freshSchoolAdmin = await loginWithCode(SCHOOL_A_ADMIN_CODE);
    const getStudentsRes = await fetch(`${baseUrl}/api/students`, {
      headers: { Authorization: `Bearer ${freshSchoolAdmin.token}` },
    });
    assert.equal(getStudentsRes.status, 200);
    const studentsData = (await getStudentsRes.json()) as { students: Array<Record<string, any>> };
    const persistedStudent = studentsData.students.find(
      (s) => s.id === 'stu-http-school-a-1'
    );
    assert.ok(persistedStudent);
    assert.ok(persistedStudent.learningReport.interventionExercises.length >= 2);
    assert.ok(persistedStudent.learningReport.classroomAccommodations.length >= 2);
    assert.equal(persistedStudent.name, 'نورة بنت سعد العتيبي');
  });

  it('does not let tenant hints bypass throttling and does not reset failures after a valid login to another school', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: 'definitely-wrong-access-code', tenantId: `attacker_tenant_${i}` }),
      });
      assert.equal(res.status, 401);
    }

    const schoolBStartedAt = Date.now();
    const validSchoolB = await loginWithCode(SCHOOL_B_ADMIN_CODE);
    assert.equal(validSchoolB.tenantId, 'school_b');
    assert.ok(
      Date.now() - schoolBStartedAt >= 1_500,
      'the fifth failure should introduce a real two-second delay'
    );

    const schoolAStartedAt = Date.now();
    const validSchoolA = await loginWithCode(SCHOOL_A_ADMIN_CODE);
    assert.equal(validSchoolA.tenantId, 'school_a');
    assert.ok(
      Date.now() - schoolAStartedAt >= 1_500,
      'a valid login to another school must not clear the IP failure count'
    );
  });

  it('validates and accepts school demo requests honestly', async () => {
    // 1. Invalid payload: missing email
    const badRes = await fetch(`${baseUrl}/api/school-demo-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolName: 'مدرسة قطر الابتدائية',
        contactName: 'أ. جاسم الكواري',
        phone: '97444112233',
      }),
    });
    assert.equal(badRes.status, 400);
    const badJson = await badRes.json() as { error?: string };
    assert.ok(badJson.error);

    // 2. Valid payload
    const goodRes = await fetch(`${baseUrl}/api/school-demo-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolName: 'مدرسة قطر النموذجية',
        contactName: 'أ. مريم السليطي',
        roleTitle: 'منسقة الدعم التعليمي الإضافي',
        workEmail: 'mariam@qatar-school.edu.qa',
        phone: '+97455001122',
        expectedStudents: '20-30',
        notes: 'نرغب في تجربة المنصة مع قسم الدعم لطلاب الصفين الثالث والرابع.',
      }),
    });
    assert.equal(goodRes.status, 201);
    const goodJson = await goodRes.json() as { ok?: boolean; message?: string };
    assert.equal(goodJson.ok, true);
    assert.ok(goodJson.message && goodJson.message.includes('تم استلام طلبكم بنجاح'));
    assert.equal(goodJson.message?.includes('٢٤ إلى ٤٨'), false, 'lead receipt must not promise an unconfigured outreach SLA');

    // 3. Admin review endpoint RBAC verification
    // 3a. Unauthorized request -> 401
    const noAuth = await fetch(`${baseUrl}/api/admin/school-demo-requests`);
    assert.equal(noAuth.status, 401);

    // 3b. Educator readonly -> 403
    const educator = await loginWithCode(SCHOOL_A_EDUCATOR_CODE);
    const educatorRes = await fetch(`${baseUrl}/api/admin/school-demo-requests`, {
      headers: { Authorization: `Bearer ${educator.token}` },
    });
    assert.equal(educatorRes.status, 403);

    // 3c. School admin -> 403 Forbidden (Strict Scope & Tenant Isolation: school admin cannot read platform leads)
    const schoolAdmin = await loginWithCode(SCHOOL_A_ADMIN_CODE);
    const schoolAdminRes = await fetch(`${baseUrl}/api/admin/school-demo-requests`, {
      headers: { Authorization: `Bearer ${schoolAdmin.token}` },
    });
    assert.equal(schoolAdminRes.status, 403, 'school_admin must be strictly denied from leads:manage endpoint');

    // 3d. Platform admin -> 200 OK with decrypted list including submitted lead
    const platformAdmin = await loginWithCode(PLATFORM_ADMIN_CODE);
    const platformAdminRes = await fetch(`${baseUrl}/api/admin/school-demo-requests`, {
      headers: { Authorization: `Bearer ${platformAdmin.token}` },
    });
    assert.equal(platformAdminRes.status, 200);
    const adminJson = (await platformAdminRes.json()) as {
      ok: boolean;
      requests: Array<{ id: string; workEmail: string; schoolName: string; status?: string }>;
    };
    assert.equal(adminJson.ok, true);
    assert.ok(Array.isArray(adminJson.requests));
    const targetLead = adminJson.requests.find((r) => r.workEmail === 'mariam@qatar-school.edu.qa');
    assert.ok(targetLead);
    assert.equal(targetLead.status, 'new');

    // 3e. Platform admin updates lead status via PATCH -> 200 OK
    const patchRes = await fetch(`${baseUrl}/api/admin/school-demo-requests/${targetLead.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${platformAdmin.token}`,
      },
      body: JSON.stringify({ status: 'contacted', adminNotes: 'تم التواصل بالهاتف وجدولة التجربة' }),
    });
    assert.equal(patchRes.status, 200);

    // 3f. School admin attempting to delete lead -> 403 Forbidden
    const unauthDelete = await fetch(`${baseUrl}/api/admin/school-demo-requests/${targetLead.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${schoolAdmin.token}` },
    });
    assert.equal(unauthDelete.status, 403);

    // 3g. Platform admin deletes lead (Privacy Erasure SLA) -> 200 OK
    const authDelete = await fetch(`${baseUrl}/api/admin/school-demo-requests/${targetLead.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${platformAdmin.token}` },
    });
    assert.equal(authDelete.status, 200);

    // 3h. Confirm permanent deletion from encrypted file
    const verifyDelRes = await fetch(`${baseUrl}/api/admin/school-demo-requests`, {
      headers: { Authorization: `Bearer ${platformAdmin.token}` },
    });
    const verifyDelJson = (await verifyDelRes.json()) as { requests: Array<{ id: string }> };
    assert.ok(!verifyDelJson.requests.some((r) => r.id === targetLead.id));
  });

  it('stores cognitive battery responses, recomputes the profile on the server, and enforces role, tenant and item checks', async () => {
    const admin = await loginWithCode(SCHOOL_A_ADMIN_CODE);
    const educator = await loginWithCode(SCHOOL_A_EDUCATOR_CODE);
    const otherSchool = await loginWithCode(SCHOOL_B_ADMIN_CODE);
    const json = (token: string, method: string, body: unknown) => ({
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    const created = await fetch(`${baseUrl}/api/students`, json(admin.token, 'POST', {
      id: 'stu-battery-1',
      name: 'طالب الفحص',
      gradeLevel: 1,
      ageYears: 6,
      schoolName: 'مدرسة أ',
      ...buildPlausibleReadingEvidence(),
    }));
    assert.equal(created.status, 201);

    const rhyme = SUBTESTS_BY_ID.rhyme;
    assert.equal(rhyme.kind, 'choice');
    const items = rhyme.kind === 'choice' ? rhyme.items : [];
    const results = {
      rhyme: {
        subtestId: 'rhyme',
        responses: items.map((item, i) => ({ itemId: item.id, correct: i % 4 === 0, rtMs: 2100, replays: 0 })),
        discontinued: false,
        completedAt: '2026-10-01T09:00:00.000Z',
      },
    };
    const upload = { ageMonths: 78, examinerName: 'أ. منى', startedAt: '2026-10-01T08:50:00.000Z', results };
    const route = `${baseUrl}/api/students/stu-battery-1/cognitive-battery`;

    const saved = await fetch(route, json(admin.token, 'PUT', upload));
    assert.equal(saved.status, 200, await saved.clone().text());
    const savedBody = (await saved.json()) as { student: { cognitiveBattery: { summary: { completedSubtests: number; referenceStatus: string; subtests: Array<{ centile: number }> } } } };
    const summary = savedBody.student.cognitiveBattery.summary;
    assert.equal(summary.completedSubtests, 1);
    assert.equal(summary.referenceStatus, 'provisional');
    assert.ok(summary.subtests[0].centile >= 1 && summary.subtests[0].centile <= 99);

    // A client-supplied summary is rejected rather than stored.
    const forgedSummary = await fetch(route, json(admin.token, 'PUT', { ...upload, summary: { risk: 'low' } }));
    assert.equal(forgedSummary.status, 400);

    // Unknown or duplicated item ids are rejected.
    const forgedItem = await fetch(route, json(admin.token, 'PUT', {
      ...upload,
      results: { rhyme: { ...results.rhyme, responses: [{ itemId: 'made-up', correct: true, rtMs: 900, replays: 0 }] } },
    }));
    assert.equal(forgedItem.status, 400);
    const duplicated = await fetch(route, json(admin.token, 'PUT', {
      ...upload,
      results: { rhyme: { ...results.rhyme, responses: [results.rhyme.responses[0], results.rhyme.responses[0]] } },
    }));
    assert.equal(duplicated.status, 400);

    // Read-only educators cannot write; other schools cannot see the record.
    assert.equal((await fetch(route, json(educator.token, 'PUT', upload))).status, 403);
    assert.equal((await fetch(route, json(otherSchool.token, 'PUT', upload))).status, 404);

    // The educator can read the stored summary.
    const list = await fetch(`${baseUrl}/api/students`, { headers: { Authorization: `Bearer ${educator.token}` } });
    const listed = ((await list.json()) as { students: Array<{ id: string; cognitiveBattery?: { summary?: unknown } }> }).students;
    assert.ok(listed.find((s) => s.id === 'stu-battery-1')?.cognitiveBattery?.summary);

    // Training progress is validated and stored.
    const progressRoute = `${baseUrl}/api/students/stu-battery-1/training-progress`;
    const progress = {
      plan: { createdAt: '2026-10-02T08:00:00.000Z', preventive: false, focus: ['rhyme'], rationaleAr: ['اختبار'] },
      levels: { rhyme: 1 },
      mastered: [],
      history: [{ date: '2026-10-02T08:10:00.000Z', skill: 'rhyme', level: 1, correct: 6, total: 8 }],
      supportFlags: [],
    };
    const progressRes = await fetch(progressRoute, json(admin.token, 'PUT', progress));
    assert.equal(progressRes.status, 200, await progressRes.clone().text());
    const impossible = { ...progress, history: [{ ...progress.history[0], correct: 9, total: 8 }] };
    assert.equal((await fetch(progressRoute, json(admin.token, 'PUT', impossible))).status, 400);
  });
});
