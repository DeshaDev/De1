import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ARABIC_READING_PASSAGES } from '../data/seedData';

const credentialMap = {
  school_alpha: {
    clinician: 'test-school-alpha-clinician-secret-123456',
    educator_readonly: 'test-school-alpha-educator-secret-123456',
  },
  school_beta: {
    clinician: 'test-school-beta-clinician-secret-123456',
    educator_readonly: 'test-school-beta-educator-secret-123456',
  },
};

let child: ChildProcessWithoutNullStreams | null = null;
let baseUrl = '';
let serverPort = 0;
let dataDir = '';
let childOutput = '';

async function startTestServer(): Promise<void> {
  baseUrl = `http://127.0.0.1:${serverPort}`;
  childOutput = '';
  child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(serverPort),
      TRUST_PROXY_HOPS: '0',
      CLINICAL_DATA_DIR: dataDir,
      CLINICAL_TENANT_CREDENTIALS: JSON.stringify(credentialMap),
      CLINICAL_SESSION_SECRET: 'integration-test-session-signing-key-not-a-production-secret-64',
      CLINICAL_STORE_ENCRYPTION_KEY: 'd3'.repeat(32),
      GEMINI_API_KEY: '',
    },
    stdio: 'pipe',
  });
  child.stdout.on('data', (chunk) => { childOutput += chunk.toString(); });
  child.stderr.on('data', (chunk) => { childOutput += chunk.toString(); });
  await waitForServer();
}

async function stopTestServer(): Promise<void> {
  if (!child) return;
  const running = child;
  if (running.exitCode === null) {
    running.kill('SIGTERM');
    await Promise.race([
      new Promise<void>((resolve) => running.once('exit', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
    ]);
    if (running.exitCode === null) running.kill('SIGKILL');
  }
  child = null;
}

async function findAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not obtain a test port.');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(): Promise<void> {
  let lastError = '';
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`Test server exited early (exit ${child.exitCode}).\n${childOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status === 401) return;
      lastError = `Unexpected startup status: ${response.status}`;
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Test server did not become ready: ${lastError}\n${childOutput}`);
}

before(async () => {
  serverPort = await findAvailablePort();
  dataDir = mkdtempSync(join(tmpdir(), 'de1-http-security-'));
  await startTestServer();
});

after(async () => {
  await stopTestServer();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

async function login(accessCode: string, roleClaim = 'clinician', spoofedForwardedFor?: string) {
  return fetch(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(spoofedForwardedFor ? { 'X-Forwarded-For': spoofedForwardedFor } : {}),
    },
    body: JSON.stringify({ accessCode, role: roleClaim, clinicianName: 'اختبار تكامل' }),
  });
}

function authorizedHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function validReadingEvidence(overrides: Record<string, unknown> = {}) {
  const passage = ARABIC_READING_PASSAGES.find((item) => item.id === 'passage-g3-astronomy');
  if (!passage) throw new Error('Integration passage fixture was not found.');
  const observedCount = Math.max(4, Math.ceil(passage.words.length * 0.3));
  return {
    passageId: passage.id,
    dialectCode: 'gulf',
    dialectRegionAr: 'لهجة اختبارية',
    readingDurationSeconds: 12,
    blinkCount: 4,
    fixations: passage.words.map((word, wordIndex) => ({
      wordIndex,
      word,
      durationMs: wordIndex < observedCount ? 260 + (wordIndex % 4) * 15 : 0,
      visits: wordIndex < observedCount ? 1 : 0,
      observed: wordIndex < observedCount,
      blinks: 0,
    })),
    comprehensionAnswers: passage.comprehensionQuestions.map((question) => question.correctIndex),
    spokenTranscript: '',
    guardianConsentGiven: true,
    guardianConsentRecordedAt: new Date().toISOString(),
    guardianConsentSource: 'إقرار الواجهة — اختبار تكامل',
    guardianAudioConsentGiven: false,
    speechRecognitionUsed: false,
    calibrationAccuracyPercent: 92,
    calibrationValidationMethod: 'leave-one-point-out',
    ...overrides,
  };
}

function validStudent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: 'مريم بن حسن',
    schoolName: 'مدرسة ألف',
    gradeLevel: 4,
    ageYears: 10,
    ...validReadingEvidence(),
    ...overrides,
  };
}

test('HTTP security regression: tenant isolation, role binding, create-only IDs, consent, update scope and logout revocation', async () => {
  // Old shared credential must not establish a session; client-supplied role does not grant permissions.
  const oldSecret = await login('BASEERA-CLINICAL-2026');
  assert.equal(oldSecret.status, 401);

  const educatorResponse = await login(credentialMap.school_alpha.educator_readonly, 'clinician');
  assert.equal(educatorResponse.status, 200);
  const educator = await educatorResponse.json() as { token: string; role: string; tenantId: string; scopes: string[]; expiresAt: number };
  assert.equal(educator.role, 'educator_readonly');
  assert.equal(educator.tenantId, 'school_alpha');
  assert.equal(educator.scopes.includes('students:write'), false);
  assert.ok(educator.expiresAt - Date.now() <= 60 * 60 * 1000);

  const clinicianResponse = await login(credentialMap.school_alpha.clinician, 'educator_readonly');
  assert.equal(clinicianResponse.status, 200);
  const alpha = await clinicianResponse.json() as { token: string; role: string; tenantId: string; sessionId: string };
  assert.equal(alpha.role, 'clinician');
  assert.equal(alpha.tenantId, 'school_alpha');
  assert.ok(alpha.sessionId);

  const betaResponse = await login(credentialMap.school_beta.clinician);
  assert.equal(betaResponse.status, 200);
  const beta = await betaResponse.json() as { token: string; role: string; tenantId: string };
  assert.equal(beta.tenantId, 'school_beta');

  // No token; malformed/bad token and spoofed tenant headers cannot read records.
  assert.equal((await fetch(`${baseUrl}/api/students`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/students`, {
    headers: { Authorization: 'Bearer not.a.valid-token' },
  })).status, 401);

  // Consent is fail-closed; client role/tenant claims are not trusted.
  const noConsent = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: authorizedHeaders(alpha.token),
    body: JSON.stringify(validStudent('integration-no-consent', { guardianConsentGiven: false })),
  });
  assert.equal(noConsent.status, 400);

  const studentId = 'integration-alpha-student';
  const forgedCreate = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: authorizedHeaders(alpha.token),
    body: JSON.stringify(validStudent('integration-forged-create', {
      tenantId: 'school_beta',
      dyslexiaRiskScore: 1,
      readingRiskLevel: 'nominal',
    })),
  });
  assert.equal(forgedCreate.status, 400);

  const create = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: {
      ...authorizedHeaders(alpha.token),
      'X-Tenant-Id': 'school_beta',
      'X-Forwarded-For': '198.51.100.222',
    },
    body: JSON.stringify(validStudent(studentId)),
  });
  assert.equal(create.status, 201);
  const created = await create.json() as { student: Record<string, unknown> };
  assert.equal(created.student.tenantId, 'school_alpha');
  assert.equal(created.student.name, 'مريم بن حسن');

  // An identifier owned by another school must not reveal a collision.
  const crossTenantCollision = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: authorizedHeaders(beta.token),
    body: JSON.stringify(validStudent(studentId)),
  });
  assert.equal(crossTenantCollision.status, 404);

  // Duplicate POST is not an upsert: original name, school and tenant stay intact.
  const overwriteAttempt = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: authorizedHeaders(alpha.token),
    body: JSON.stringify(validStudent(studentId, { name: 'اسم مهاجم', schoolName: 'مدرسة أخرى' })),
  });
  assert.equal(overwriteAttempt.status, 409);
  const alphaListResponse = await fetch(`${baseUrl}/api/students`, {
    headers: authorizedHeaders(alpha.token),
  });
  assert.equal(alphaListResponse.status, 200);
  const alphaList = await alphaListResponse.json() as { students: Array<Record<string, unknown>> };
  const stored = alphaList.students.find((student) => student.id === studentId);
  assert.equal(stored?.name, 'مريم بن حسن');
  assert.equal(stored?.schoolName, 'مدرسة ألف');
  assert.equal(stored?.tenantId, 'school_alpha');

  // The other school cannot enumerate or mutate this record, even knowing its ID.
  const betaListResponse = await fetch(`${baseUrl}/api/students`, { headers: authorizedHeaders(beta.token) });
  const betaList = await betaListResponse.json() as { students: Array<Record<string, unknown>> };
  assert.equal(betaList.students.some((student) => student.id === studentId), false);
  assert.equal((await fetch(`${baseUrl}/api/students/${studentId}`, {
    method: 'PATCH',
    headers: authorizedHeaders(beta.token),
    body: JSON.stringify({ wpm: 99 }),
  })).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/students/${studentId}`, {
    method: 'DELETE',
    headers: authorizedHeaders(beta.token),
  })).status, 404);

  // Read-only role and PATCH allow-list reject writes, identity fields, consent tampering and client history.
  assert.equal((await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: authorizedHeaders(educator.token),
    body: JSON.stringify(validStudent('integration-readonly-write')),
  })).status, 403);
  for (const forbiddenPatch of [
    { name: 'تغيير الاسم' },
    { schoolName: 'مدرسة مختلفة' },
    { tenantId: 'school_beta' },
    { guardianConsentGiven: false },
    { guardianConsentRecordedAt: new Date().toISOString() },
    { guardianConsentSource: 'spoofed' },
    { assessmentHistory: [] },
    { wpm: 'not-a-number' },
    { gradeLevel: 'not-a-number' },
    { ageYears: 999 },
    { dyslexiaRiskScore: 98 },
    { readingRiskLevel: 'nominal' },
  ]) {
    const response = await fetch(`${baseUrl}/api/students/${studentId}`, {
      method: 'PATCH',
      headers: authorizedHeaders(alpha.token),
      body: JSON.stringify(forbiddenPatch),
    });
    assert.equal(response.status, 400);
  }

  const specialKey = String.fromCharCode(95, 95, 112, 114, 111, 116, 111, 95, 95);
  const specialKeyResponse = await fetch(`${baseUrl}/api/students/${studentId}`, {
    method: 'PATCH',
    headers: authorizedHeaders(alpha.token),
    body: JSON.stringify({ [specialKey]: { tenantId: 'school_beta' } }),
  });
  assert.equal(specialKeyResponse.status, 400);

  // Runtime schemas reject malformed evidence and derive risk scores on the server.
  const mathEvidence = {
    subitizingTrials: [
      { dotCount: 1, chosen: 1, reactionTimeMs: 520 },
      { dotCount: 2, chosen: 2, reactionTimeMs: 690 },
      { dotCount: 3, chosen: 2, reactionTimeMs: 610 },
      { dotCount: 4, chosen: 4, reactionTimeMs: 740 },
    ],
    numberLineTrials: [
      { target: 37, userEstimate: 39, reactionTimeMs: 1940, scaleMin: 0, scaleMax: 100 },
      { target: 156, userEstimate: 151, reactionTimeMs: 2280, scaleMin: 0, scaleMax: 200 },
    ],
    transcodingTrials: [
      { targetNumber: 47, selectedNumber: 74, reactionTimeMs: 2340 },
      { targetNumber: 83, selectedNumber: 83, reactionTimeMs: 2610 },
      { targetNumber: 69, selectedNumber: 69, reactionTimeMs: 1890 },
    ],
  };
  const mathSave = await fetch(`${baseUrl}/api/students/${studentId}/math-assessment`, {
    method: 'POST',
    headers: authorizedHeaders(alpha.token),
    body: JSON.stringify(mathEvidence),
  });
  assert.equal(mathSave.status, 200);
  const mathBody = await mathSave.json() as { scoring: string; student: Record<string, unknown> };
  assert.equal(mathBody.scoring, 'server-derived');
  assert.equal(mathBody.student.dyscalculiaAssessed, true);
  assert.equal(typeof mathBody.student.dyscalculiaRiskScore, 'number');
  assert.equal(mathBody.student.reversalErrorCount, 1);

  const forgedMathScore = await fetch(`${baseUrl}/api/students/${studentId}/math-assessment`, {
    method: 'POST',
    headers: authorizedHeaders(alpha.token),
    body: JSON.stringify({ ...mathEvidence, dyscalculiaRiskScore: 1, mathRiskLevel: 'nominal' }),
  });
  assert.equal(forgedMathScore.status, 400);
  const invalidTiming = await fetch(`${baseUrl}/api/students/${studentId}/math-assessment`, {
    method: 'POST',
    headers: authorizedHeaders(alpha.token),
    body: JSON.stringify({
      ...mathEvidence,
      subitizingTrials: mathEvidence.subitizingTrials.map((trial, index) =>
        index === 0 ? { ...trial, reactionTimeMs: 'fast' } : trial
      ),
    }),
  });
  assert.equal(invalidTiming.status, 400);

  // A repeat assessment updates only session fields; server preserves identity and appends history.
  const followup = await fetch(`${baseUrl}/api/students/${studentId}/sessions`, {
    method: 'POST',
    headers: authorizedHeaders(alpha.token),
    body: JSON.stringify(validReadingEvidence({
      guardianConsentSource: 'إقرار الواجهة — جلسة متابعة اختبارية',
      readingDurationSeconds: 14,
    })),
  });
  assert.equal(followup.status, 200);
  const followupBody = await followup.json() as { student: Record<string, unknown>; scoring: string };
  assert.equal(followupBody.scoring, 'server-derived');
  assert.equal(followupBody.student.name, 'مريم بن حسن');
  assert.equal(followupBody.student.schoolName, 'مدرسة ألف');
  assert.equal(followupBody.student.tenantId, 'school_alpha');
  assert.equal(typeof followupBody.student.wpm, 'number');
  assert.equal(typeof followupBody.student.dyslexiaRiskScore, 'number');
  assert.ok(Array.isArray(followupBody.student.assessmentHistory));
  assert.equal((followupBody.student.assessmentHistory as unknown[]).length, 1);

  const forgedFollowup = await fetch(`${baseUrl}/api/students/${studentId}/sessions`, {
    method: 'POST',
    headers: authorizedHeaders(alpha.token),
    body: JSON.stringify({ ...validReadingEvidence(), dyslexiaRiskScore: 0, readingRiskLevel: 'nominal' }),
  });
  assert.equal(forgedFollowup.status, 400);

  const auditResponse = await fetch(`${baseUrl}/api/audit-events?limit=200`, {
    headers: authorizedHeaders(alpha.token),
  });
  assert.equal(auditResponse.status, 200);
  const auditBody = await auditResponse.json() as { events: Array<Record<string, unknown>> };
  assert.ok(auditBody.events.some((event) => event.action === 'student.create' && event.subjectId === studentId && event.actorLabel === 'اختبار تكامل'));
  assert.ok(auditBody.events.some((event) => event.action === 'student.math-assessment' && event.subjectId === studentId));
  assert.ok(auditBody.events.some((event) => event.action === 'student.session.complete' && event.subjectId === studentId && Array.isArray(event.changedFields) && (event.changedFields as string[]).includes('guardianConsentRecordedAt')));
  assert.ok(auditBody.events.every((event) => event.tenantId === 'school_alpha'));
  const readOnlyAudit = await fetch(`${baseUrl}/api/audit-events`, {
    headers: authorizedHeaders(educator.token),
  });
  assert.equal(readOnlyAudit.status, 403);

  // Speech-recognition usage requires its own explicit, timestamped consent.
  const noAudioConsent = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: authorizedHeaders(alpha.token),
    body: JSON.stringify(validStudent('integration-no-audio-consent', {
      speechRecognitionUsed: true,
      guardianAudioConsentGiven: false,
      guardianAudioConsentRecordedAt: undefined,
    })),
  });
  assert.equal(noAudioConsent.status, 400);

  // AI endpoints must not work anonymously.
  assert.equal((await fetch(`${baseUrl}/api/ai/adapt-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'test' }),
  })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/ai/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'test' }),
  })).status, 401);

  // Authenticated AI requests are rate-limited persistently even when the test endpoint is not implemented.
  for (let index = 0; index < 20; index += 1) {
    await fetch(baseUrl + '/api/ai/security-test-probe', {
      method: 'POST',
      headers: authorizedHeaders(alpha.token),
      body: JSON.stringify({ probe: index }),
    });
  }
  const rateLimitedAi = await fetch(baseUrl + '/api/ai/security-test-probe', {
    method: 'POST',
    headers: authorizedHeaders(alpha.token),
    body: JSON.stringify({ probe: 'limit-check' }),
  });
  assert.equal(rateLimitedAi.status, 429);

  // Logout revokes the bearer token at the server; local clearing is not the only control.
  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: authorizedHeaders(alpha.token),
  });
  assert.equal(logout.status, 204);
  assert.equal((await fetch(`${baseUrl}/api/students`, {
    headers: authorizedHeaders(alpha.token),
  })).status, 401);

  // Persisted login throttling remains in force after a process restart.
  for (let index = 0; index < 8; index += 1) {
    await login(`invalid-integration-secret-${index}-long-enough-123456`, 'clinician', `198.51.100.${index + 1}`);
  }
  assert.equal((await login(credentialMap.school_alpha.clinician)).status, 429);

  // Reboot on a new ephemeral port but the same encrypted data directory.
  await stopTestServer();
  serverPort = await findAvailablePort();
  await startTestServer();
  assert.equal((await fetch(`${baseUrl}/api/students`, {
    headers: authorizedHeaders(alpha.token),
  })).status, 401);
  assert.equal((await login(credentialMap.school_alpha.clinician)).status, 429);
  const persistedAiLimit = await fetch(baseUrl + '/api/ai/security-test-probe', {
    method: 'POST',
    headers: authorizedHeaders(beta.token),
    body: JSON.stringify({ probe: 'after-restart' }),
  });
  assert.equal(persistedAiLimit.status, 429);
});
