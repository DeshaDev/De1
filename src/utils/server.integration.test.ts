import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { ARABIC_READING_PASSAGES } from '../data/seedData';

const SCHOOL_A_CLINICIAN_CODE = '3580bd6cfaada2ae57b75b7af6d75cd86fd18211ecc8bc1d';
const SCHOOL_A_EDUCATOR_CODE = 'f0ab09100c10d620b00517b933ab8c45109b7c8eab249f34';
const SCHOOL_B_CLINICIAN_CODE = '3a105ca0e52fb126fd4ed59979ea6ac2e8ddcd0f0edfcd53';
const SCHOOL_B_EDUCATOR_CODE = '44cb83fefd7812bbb449d63d2323160f6ce0d1524910d368';

const TEST_ENV = {
  ...process.env,
  NODE_ENV: 'production',
  TRUST_PROXY_HOPS: '0',
  CLINICAL_STORE_ENCRYPTION_KEY:
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  CLINICAL_SESSION_SECRET:
    'test-hmac-signing-secret-32chars-minimum-distinct-2026!',
  CLINICAL_TENANT_CREDENTIALS: JSON.stringify({
    school_a: {
      clinician: SCHOOL_A_CLINICIAN_CODE,
      educator_readonly: SCHOOL_A_EDUCATOR_CODE,
    },
    school_b: {
      clinician: SCHOOL_B_CLINICIAN_CODE,
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
  const fixations = passage.words.map((word, index) => ({
    wordIndex: index,
    word,
    durationMs: index % 4 === 0 ? 410 : 250,
    visits: index % 5 === 0 && index > 0 ? 2 : 1,
    regressedFromIndex: index % 5 === 0 && index > 0 ? index + 1 : undefined,
    blinks: 0,
    observed: true,
  }));
  return {
    passageId: passage.id,
    readingDurationSeconds: 28,
    blinkCount: 9,
    calibrationAccuracyPercent: 88,
    calibrationValidationMethod: 'leave-one-point-out',
    fixations,
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
    serverProc = spawn('./node_modules/.bin/tsx', ['server.ts'], {
      cwd: process.cwd(),
      env: {
        ...TEST_ENV,
        PORT: String(port),
        CLINICAL_DATA_DIR: tempDir,
      },
      stdio: 'pipe',
    });
    await waitForServer(baseUrl);
  }

  async function stopServerInstance() {
    if (serverProc) {
      const proc = serverProc;
      serverProc = null;
      proc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 300));
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
      body: JSON.stringify({ accessCode, clinicianName: 'مختبر النظام' }),
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
      const session = await loginWithCode(SCHOOL_A_CLINICIAN_CODE);
      assert.equal(session.tenantId, 'school_a');
      assert.equal(session.tenantDisplayNameAr, 'مدرسة الرواد الأولى (أ)');
    }
  });

  it('does not allow client tenant hints to bypass throttling and delays a valid secret after failed attempts', async () => {
    for (let i = 0; i < 8; i++) {
      const res = await fetch(`${baseUrl}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: 'definitely-wrong-access-code', tenantId: `attacker_tenant_${i}` }),
      });
      assert.equal(res.status, 401);
    }
    const ninthWrongAttempt = await fetch(`${baseUrl}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode: 'definitely-wrong-access-code', tenantId: 'school_a' }),
    });
    assert.equal(ninthWrongAttempt.status, 429);
    const validStartedAt = Date.now();
    const validAfterFailures = await loginWithCode(SCHOOL_A_CLINICIAN_CODE);
    assert.equal(validAfterFailures.tenantId, 'school_a');
    assert.ok(
      Date.now() - validStartedAt >= 1_500,
      'valid credentials from an IP with recent failures must receive a short delay'
    );
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

  it('derives reading scores & non-empty recommendations server-side, preserves full Arabic names, tags client-reported, and blocks client score injection', async () => {
    const schoolAClinician = await loginWithCode(SCHOOL_A_CLINICIAN_CODE);
    const schoolBClinician = await loginWithCode(SCHOOL_B_CLINICIAN_CODE);

    // 1. Attempt to inject dyslexiaRiskScore or readingRiskLevel or tenantId -> 400
    const forgedRes = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolAClinician.token}`,
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
        Authorization: `Bearer ${schoolAClinician.token}`,
      },
      body: JSON.stringify({
        id: 'stu-impossible-1',
        name: 'طالب مستحيل',
        gradeLevel: 4,
        ageYears: 10,
        schoolName: 'مدرسة أ',
        ...buildPlausibleReadingEvidence(),
        readingDurationSeconds: 4,
        fixations: passage.words.map((word, index) => ({
          wordIndex: index,
          word,
          durationMs: 420,
          visits: 1,
          blinks: 0,
          observed: true,
        })),
      }),
    });
    assert.equal(impossibleRes.status, 400);

    // A full elementary passage in six seconds must fail the WPM plausibility ceiling.
    const tooFastRes = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolAClinician.token}`,
      },
      body: JSON.stringify({
        id: 'stu-too-fast-1',
        name: 'قارئ سريع بصورة غير معقولة',
        gradeLevel: 4,
        ageYears: 10,
        schoolName: 'مدرسة أ',
        ...buildPlausibleReadingEvidence(),
        readingDurationSeconds: 6,
        fixations: passage.words.map((word, index) => ({
          wordIndex: index,
          word,
          durationMs: 40,
          visits: 1,
          blinks: 0,
          observed: true,
        })),
      }),
    });
    assert.equal(tooFastRes.status, 400);

    // 3. Create valid student record from raw evidence and preserve the full name, including "بن".
    const createRes = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolAClinician.token}`,
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
    assert.ok(Array.isArray(createdBody.student.clinicalReport.interventionExercises));
    assert.ok(createdBody.student.clinicalReport.interventionExercises.length >= 2);
    assert.ok(Array.isArray(createdBody.student.clinicalReport.classroomAccommodations));
    assert.ok(createdBody.student.clinicalReport.classroomAccommodations.length >= 2);

    // 4. Cross-tenant POST with existing ID from School A returns 404 (not 409) so it does not leak ID existence
    const crossTenantCreate = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolBClinician.token}`,
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

  it('enforces strict 4-field PATCH and saves updated AI clinicalReport + mathTrials via dedicated PUT routes', async () => {
    const clinician = await loginWithCode(SCHOOL_A_CLINICIAN_CODE);

    // 1. Sending { clinicalReport } to PATCH /api/students/:id returns 400
    const badPatch = await fetch(`${baseUrl}/api/students/stu-http-school-a-1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinician.token}`,
      },
      body: JSON.stringify({
        clinicalReport: { clinicalSummary: 'محاولة عبر المسار الخاطئ' },
      }),
    });
    assert.equal(badPatch.status, 400);

    // 2. Valid 4-field profile PATCH succeeds and preserves the supplied Arabic name.
    const goodPatch = await fetch(`${baseUrl}/api/students/stu-http-school-a-1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinician.token}`,
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

    // 3. Dedicated PUT /api/students/:id/clinical-report saves full report with exercises & accommodations
    const updatedReport = {
      clinicalSummary: 'ملخص محدث بالذكاء الاصطناعي يوضح استقرار الطلاقة القرائية.',
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
      `${baseUrl}/api/students/stu-http-school-a-1/clinical-report`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinician.token}`,
        },
        body: JSON.stringify({ clinicalReport: updatedReport }),
      }
    );
    assert.equal(putReportRes.status, 200);
    const savedReportBody = (await putReportRes.json()) as { student: Record<string, any> };
    assert.equal(
      savedReportBody.student.clinicalReport.clinicalSummary,
      updatedReport.clinicalSummary
    );
    assert.equal(
      savedReportBody.student.clinicalReport.interventionExercises.length,
      2
    );
    for (const [method, route] of [
      ['PUT', '/api/students/stu-http-school-a-1/report'],
      ['POST', '/api/students/stu-http-school-a-1/report'],
      ['POST', '/api/students/stu-http-school-a-1/clinical-report'],
    ] as const) {
      const deprecatedRes = await fetch(`${baseUrl}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clinician.token}` },
        body: JSON.stringify({ clinicalReport: updatedReport }),
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
          Authorization: `Bearer ${clinician.token}`,
        },
        body: JSON.stringify({ mathTrials: buildCanonicalMathTrials() }),
      }
    );
    assert.equal(putMathRes.status, 200);
    const mathBody = (await putMathRes.json()) as { student: Record<string, any> };
    assert.equal(mathBody.student.dyscalculiaAssessed, true);
    assert.equal(mathBody.student.reversalErrorCount, 1);
    const forgedEnvelopeRes = await fetch(`${baseUrl}/api/students/stu-http-school-a-1/math`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clinician.token}` },
      body: JSON.stringify({ mathTrials: buildCanonicalMathTrials(), mathRiskLevel: 'nominal' }),
    });
    assert.equal(forgedEnvelopeRes.status, 400);
    const forgedNested = JSON.parse(JSON.stringify(buildCanonicalMathTrials()));
    forgedNested.subitizingTrials[0].mathRiskLevel = 'nominal';
    const forgedNestedRes = await fetch(`${baseUrl}/api/students/stu-http-school-a-1/math`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clinician.token}` },
      body: JSON.stringify({ mathTrials: forgedNested }),
    });
    assert.equal(forgedNestedRes.status, 400);
    for (const [method, route] of [
      ['POST', '/api/students/stu-http-school-a-1/math'],
      ['POST', '/api/students/stu-http-school-a-1/math-assessment'],
    ] as const) {
      const deprecatedRes = await fetch(`${baseUrl}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clinician.token}` },
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
          Authorization: `Bearer ${clinician.token}`,
        },
        body: JSON.stringify({ mathTrials: badTrials }),
      }
    );
    assert.equal(badMathRes.status, 400);
  });

  it('persists revoked tokens, audit logs (without child PII), and saved reports across server restart in encrypted security-state.json (mode 600)', async () => {
    const clinicianA = await loginWithCode(SCHOOL_A_CLINICIAN_CODE);
    const educatorA = await loginWithCode(SCHOOL_A_EDUCATOR_CODE);

    // Educator is forbidden from reading audit logs
    const educatorAuditRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${educatorA.token}` },
    });
    assert.equal(educatorAuditRes.status, 403);

    // Clinician can read tenant-isolated audit logs and they contain zero child PII
    const auditRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${clinicianA.token}` },
    });
    assert.equal(auditRes.status, 200);
    const auditBody = (await auditRes.json()) as { auditLogs: Array<Record<string, any>> };
    assert.ok(auditBody.auditLogs.length >= 2);
    const serializedAudit = JSON.stringify(auditBody.auditLogs);
    assert.equal(serializedAudit.includes('نورة'), false);
    assert.equal(serializedAudit.includes('خالد'), false);

    // Revoke clinicianA token via logout
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clinicianA.token}` },
    });
    assert.equal(logoutRes.status, 204);

    // Verify security-state.json exists and has 0600 permissions
    assert.equal(fs.existsSync(securityStateFile), true);
    const mode = fs.statSync(securityStateFile).mode & 0o777;
    assert.equal(mode, 0o600);

    // Restart server process
    await stopServerInstance();
    await startServerInstance();

    // Revoked token MUST still return 401 after restart
    const afterRestartRevoked = await fetch(`${baseUrl}/api/students`, {
      headers: { Authorization: `Bearer ${clinicianA.token}` },
    });
    assert.equal(afterRestartRevoked.status, 401);

    // Fresh login sees persisted report with non-empty recommendations and persisted audit logs
    const freshClinician = await loginWithCode(SCHOOL_A_CLINICIAN_CODE);
    const getStudentsRes = await fetch(`${baseUrl}/api/students`, {
      headers: { Authorization: `Bearer ${freshClinician.token}` },
    });
    assert.equal(getStudentsRes.status, 200);
    const studentsData = (await getStudentsRes.json()) as { students: Array<Record<string, any>> };
    const persistedStudent = studentsData.students.find(
      (s) => s.id === 'stu-http-school-a-1'
    );
    assert.ok(persistedStudent);
    assert.ok(persistedStudent.clinicalReport.interventionExercises.length >= 2);
    assert.ok(persistedStudent.clinicalReport.classroomAccommodations.length >= 2);
    assert.equal(persistedStudent.name, 'نورة بنت سعد العتيبي');
  });
});
