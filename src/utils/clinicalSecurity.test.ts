import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  issueClinicalSessionToken,
  verifyClinicalSessionToken,
  authorizeSessionScope,
  validateExplicitGuardianConsent,
  parseStrictTrustProxyHops,
  stripArabicPatronymics,
  formatTenantDisplayNameAr,
  normalizeCalibrationValidationMethod,
  checkAuthFailureLimit,
  recordFailedAuthAttempt,
  getAuthThrottleDelayMs,
  isStrongClinicalAccessCode,
  AuthFailureBucket,
  validateAndDeriveSessionFromEvidence,
  validateAndDeriveMathTrials,
  buildDeterministicClinicalReport,
  StudentProfilePatchSchema,
  ClinicalReportUpdateEnvelopeSchema,
} from './clinicalSecurity';
import { ARABIC_READING_PASSAGES } from '../data/seedData';

const TEST_SECRET = 'test-clinical-hmac-secret-key-2026-secure';

describe('Clinical RBAC, Evidence Derivation, Plausibility Gates & Rate Limiting Unit Tests', () => {
  it('issues and verifies a clinician session token with full scopes and Arabic tenant display name', () => {
    const issued = issueClinicalSessionToken(
      'clinician',
      'د. سارة المنصور',
      TEST_SECRET,
      60_000,
      'school_a'
    );
    assert.ok(issued.token.includes('.'));
    assert.equal(issued.role, 'clinician');
    assert.equal(issued.tenantId, 'school_a');
    assert.equal(issued.tenantDisplayNameAr, 'مدرسة الرواد الأولى (أ)');
    assert.deepEqual(issued.scopes, [
      'students:read',
      'students:write',
      'students:delete',
      'ai:analyze',
      'audit:read',
    ]);

    const verified = verifyClinicalSessionToken(issued.token, TEST_SECRET);
    assert.ok(verified);
    assert.equal(verified.role, 'clinician');
    assert.equal(verified.tenantId, 'school_a');
    assert.equal(verified.tenantDisplayNameAr, 'مدرسة الرواد الأولى (أ)');
  });

  it('rejects tampered or expired tokens and enforces educator_readonly restrictions', () => {
    const issued = issueClinicalSessionToken(
      'educator_readonly',
      'أ. هند السالم',
      TEST_SECRET,
      60_000,
      'school_b'
    );
    const verified = verifyClinicalSessionToken(issued.token, TEST_SECRET);
    assert.ok(verified);
    assert.equal(verified.tenantDisplayNameAr, 'مدرسة النخبة الثانية (ب)');
    assert.equal(
      authorizeSessionScope(verified, 'students:read').statusCode,
      200
    );
    assert.equal(
      authorizeSessionScope(verified, 'students:write').statusCode,
      403
    );
    assert.equal(
      authorizeSessionScope(verified, 'ai:analyze').statusCode,
      403
    );
    assert.equal(
      authorizeSessionScope(verified, 'audit:read').statusCode,
      403
    );

    const [payloadB64, sig] = issued.token.split('.');
    const tamperedSig =
      sig.slice(0, -2) + (sig.endsWith('aa') ? 'bb' : 'aa');
    assert.equal(
      verifyClinicalSessionToken(`${payloadB64}.${tamperedSig}`, TEST_SECRET),
      null
    );
  });

  it('enforces default-deny guardian consent validation', () => {
    assert.equal(validateExplicitGuardianConsent(undefined).valid, false);
    assert.equal(validateExplicitGuardianConsent(null).valid, false);
    assert.equal(validateExplicitGuardianConsent(false).valid, false);
    assert.equal(validateExplicitGuardianConsent('true').valid, false);
    assert.equal(validateExplicitGuardianConsent(true).valid, true);
  });

  it('strictly parses TRUST_PROXY_HOPS (default 0, rejects invalid strings or negatives)', () => {
    assert.equal(parseStrictTrustProxyHops(undefined), 0);
    assert.equal(parseStrictTrustProxyHops(''), 0);
    assert.equal(parseStrictTrustProxyHops('0'), 0);
    assert.equal(parseStrictTrustProxyHops('2'), 2);
    assert.throws(() => parseStrictTrustProxyHops('-1'));
    assert.throws(() => parseStrictTrustProxyHops('true'));
    assert.throws(() => parseStrictTrustProxyHops('1.5'));
    assert.throws(() => parseStrictTrustProxyHops('99'));
  });

  it('keeps patronymic minimization as a separate helper for anonymized AI prompts', () => {
    assert.equal(stripArabicPatronymics('أحمد بن خالد العتيبي'), 'أحمد خالد العتيبي');
    assert.equal(stripArabicPatronymics('سارة بنت محمد القحطاني'), 'سارة محمد القحطاني');
    assert.equal(formatTenantDisplayNameAr('school_a'), 'مدرسة الرواد الأولى (أ)');
    assert.equal(formatTenantDisplayNameAr('school_b'), 'مدرسة النخبة الثانية (ب)');
  });

  it('normalizes known calibrationValidationMethod values and never defaults unknown strings to leave-one-point-out', () => {
    const lopo = normalizeCalibrationValidationMethod('leave-one-point-out');
    assert.equal(lopo.code, 'leave-one-point-out');
    assert.equal(lopo.isValidated, true);

    const holdout = normalizeCalibrationValidationMethod('independent-holdout');
    assert.equal(holdout.code, 'independent-holdout');
    assert.equal(holdout.isValidated, true);

    const unknown = normalizeCalibrationValidationMethod('weird-unknown-method');
    assert.equal(unknown.code, 'single-point-unvalidated');
    assert.equal(unknown.isValidated, false);
  });

  it('accepts only high-diversity 48-character hex access codes and rejects predictable tokens', () => {
    assert.equal(
      isStrongClinicalAccessCode('3580bd6cfaada2ae57b75b7af6d75cd86fd18211ecc8bc1d'),
      true
    );
    assert.equal(isStrongClinicalAccessCode('A-clinician-secret-0123456789abc'), false);
    assert.equal(isStrongClinicalAccessCode('a'.repeat(48)), false);
    assert.equal(isStrongClinicalAccessCode('0123456789abcdef'.repeat(3)), false);
    assert.equal(isStrongClinicalAccessCode('f'.repeat(47)), false);
  });

  it('applies progressive IP throttling from 2s at five failures through 60s at ten', () => {
    const now = 1_700_000_000_000;
    const expectedDelayByFailureCount = new Map<number, number>([
      [1, 0], [2, 0], [3, 0], [4, 0],
      [5, 2_000], [6, 4_000], [7, 8_000],
      [8, 15_000], [9, 30_000], [10, 60_000],
    ]);

    for (const [failureCount, expectedDelayMs] of expectedDelayByFailureCount) {
      const buckets = new Map<string, AuthFailureBucket>();
      for (let i = 1; i <= failureCount; i++) {
        recordFailedAuthAttempt(buckets, '10.0.0.9', undefined, now + i);
      }
      assert.equal(
        getAuthThrottleDelayMs(buckets, '10.0.0.9', undefined, now + 20),
        expectedDelayMs,
        `unexpected delay after ${failureCount} consecutive failed attempts`
      );
    }

    const expired = new Map<string, AuthFailureBucket>();
    for (let i = 1; i <= 10; i++) {
      recordFailedAuthAttempt(expired, '10.0.0.10', undefined, now + i);
    }
    assert.equal(getAuthThrottleDelayMs(expired, '10.0.0.10', undefined, now + 61_000), 0);
    assert.equal(expired.size, 0, 'expired failures should be discarded by window expiry');
  });

  it('counts failed guesses per IP, ignores client tenant hints, and bounds storage', () => {
    const buckets = new Map<string, AuthFailureBucket>();
    const now = 1_700_000_000_000;

    // 4 failures have 0ms backoff and remain unlocked
    for (let i = 1; i <= 4; i++) {
      const res = recordFailedAuthAttempt(buckets, '10.0.0.1', 'school_a', now + i * 100);
      assert.equal(res.locked, false);
      assert.equal(res.backoffMs, 0);
    }

    // 5th failure triggers 2000ms progressive backoff
    const fifth = recordFailedAuthAttempt(buckets, '10.0.0.1', 'school_a', now + 500);
    assert.equal(fifth.backoffMs, 2000);
    assert.equal(fifth.locked, false);

    // A different client-supplied school hint cannot create a clean bucket.
    const sameIpDifferentHint = checkAuthFailureLimit(buckets, '10.0.0.1', 'school_b', now + 600);
    assert.equal(sameIpDifferentHint.allowed, true);
    assert.equal(sameIpDifferentHint.failureCount, 5);
    const manyHints = new Map<string, AuthFailureBucket>();
    for (let i = 0; i < 2_300; i++) {
      recordFailedAuthAttempt(manyHints, '10.0.0.2', `attacker_tenant_${i}`, now + i);
    }
    assert.equal(manyHints.size, 1);
    assert.equal([...manyHints.values()][0].failures.length, 10);
  });

  it('derives camera-free reading observations and rejects legacy eye evidence', () => {
    const passage = ARABIC_READING_PASSAGES[0];
    const answers = passage.comprehensionQuestions.map((q) => q.correctIndex);

    const readingSession = validateAndDeriveSessionFromEvidence(
      {
        assessmentModality: 'reading_only',
        passageId: passage.id,
        readingDurationSeconds: 28,
        comprehensionAnswers: answers,
      },
      { name: 'طالب تجريبي', gradeLevel: passage.gradeLevel }
    );
    assert.equal(readingSession.valid, true);
    assert.ok(readingSession.derivedFields);
    assert.equal(readingSession.derivedFields.assessmentModality, 'reading_only');
    assert.equal(readingSession.derivedFields.comprehensionScore, 100);
    assert.equal(readingSession.derivedFields.calibrationAccuracyPercent, undefined);
    assert.deepEqual(readingSession.derivedFields.fixations, []);
    assert.equal(readingSession.derivedFields.dyslexiaRiskScore, null);
    assert.equal(readingSession.derivedFields.readingHeuristicIndicator, null);
    assert.equal(readingSession.derivedFields.readingRiskLevel, 'unassessed');
    assert.ok(readingSession.derivedFields.wpm > 0);
    assert.match(
      readingSession.derivedFields.clinicalReport.ocularMotorAnalysis,
      /لا تستخدم بصيرة الحالية الكاميرا أو تتبّع العين/
    );
    assert.ok(readingSession.derivedFields.clinicalReport.interventionExercises.length >= 2);
    assert.ok(readingSession.derivedFields.clinicalReport.classroomAccommodations.length >= 2);

    const voiceOnlySession = validateAndDeriveSessionFromEvidence(
      {
        assessmentModality: 'voice_only',
        passageId: passage.id,
        readingDurationSeconds: 30,
        comprehensionAnswers: answers,
      },
      { name: 'طالب صوتي', gradeLevel: passage.gradeLevel }
    );
    assert.equal(voiceOnlySession.valid, true);
    assert.ok(voiceOnlySession.derivedFields);
    assert.deepEqual(voiceOnlySession.derivedFields.fixations, []);
    assert.equal(voiceOnlySession.derivedFields.calibrationAccuracyPercent, undefined);
    assert.equal(voiceOnlySession.derivedFields.wpm, 0);
    assert.equal(voiceOnlySession.derivedFields.wcpm, null);
    assert.equal(voiceOnlySession.derivedFields.oralWerPercent, null);

    const legacyEyeMode = validateAndDeriveSessionFromEvidence(
      {
        assessmentModality: 'eye_voice',
        passageId: passage.id,
        readingDurationSeconds: 28,
        comprehensionAnswers: answers,
        calibrationAccuracyPercent: 88,
      },
      { name: 'طالب قديم', gradeLevel: passage.gradeLevel }
    );
    assert.equal(legacyEyeMode.valid, false);
    assert.equal(legacyEyeMode.statusCode, 400);

    const legacyFixations = validateAndDeriveSessionFromEvidence(
      {
        assessmentModality: 'reading_only',
        passageId: passage.id,
        readingDurationSeconds: 28,
        comprehensionAnswers: answers,
        fixations: [{ wordIndex: 0, durationMs: 250, visits: 1 }],
      },
      { name: 'طالب قديم', gradeLevel: passage.gradeLevel }
    );
    assert.equal(legacyFixations.valid, false);
    assert.equal(legacyFixations.statusCode, 400);

    const forgedScore = validateAndDeriveSessionFromEvidence(
      {
        assessmentModality: 'reading_only',
        passageId: passage.id,
        readingDurationSeconds: 28,
        comprehensionAnswers: answers,
        dyslexiaRiskScore: 5,
      },
      { name: 'طالب تجريبي', gradeLevel: passage.gradeLevel }
    );
    assert.equal(forgedScore.valid, false);
    assert.equal(forgedScore.statusCode, 400);

    for (const seconds of [4, 6]) {
      const tooFast = validateAndDeriveSessionFromEvidence(
        {
          assessmentModality: 'reading_only',
          passageId: passage.id,
          readingDurationSeconds: seconds,
          comprehensionAnswers: answers,
        },
        { name: 'سرعة غير معقولة', gradeLevel: passage.gradeLevel }
      );
      assert.equal(tooFast.valid, false);
      assert.equal(tooFast.statusCode, 400);
      assert.match(tooFast.errorAr || '', /حد المعقولية التقني/);
    }
  });

  it('validates canonical 4+2+3 math trials and rejects invented targets or choices', () => {
    const validMath = validateAndDeriveMathTrials({
      subitizingTrials: [
        { dotCount: 1, chosen: 1, correct: true, reactionTimeMs: 650 },
        { dotCount: 2, chosen: 2, correct: true, reactionTimeMs: 700 },
        { dotCount: 3, chosen: 3, correct: true, reactionTimeMs: 780 },
        { dotCount: 4, chosen: 4, correct: true, reactionTimeMs: 820 },
      ],
      numberLineTrials: [
        { target: 37, userEstimate: 39, scaleMin: 0, scaleMax: 100, reactionTimeMs: 2100 },
        { target: 156, userEstimate: 150, scaleMin: 0, scaleMax: 200, reactionTimeMs: 2400 },
      ],
      transcodingTrials: [
        { targetNumber: 47, selectedNumber: 47, isReversalError: false, reactionTimeMs: 1800 },
        { targetNumber: 83, selectedNumber: 38, isReversalError: true, reactionTimeMs: 2200 },
        { targetNumber: 69, selectedNumber: 69, isReversalError: false, reactionTimeMs: 2500 },
      ],
    });
    assert.equal(validMath.valid, true);
    assert.ok(validMath.metrics);
    assert.equal(validMath.metrics.reversalErrorCount, 1);

    // Invented target 99 on number line must fail
    const inventedTarget = validateAndDeriveMathTrials({
      subitizingTrials: [
        { dotCount: 1, chosen: 1, correct: true, reactionTimeMs: 650 },
        { dotCount: 2, chosen: 2, correct: true, reactionTimeMs: 700 },
        { dotCount: 3, chosen: 3, correct: true, reactionTimeMs: 780 },
        { dotCount: 4, chosen: 4, correct: true, reactionTimeMs: 820 },
      ],
      numberLineTrials: [
        { target: 99, userEstimate: 39, scaleMin: 0, scaleMax: 100, reactionTimeMs: 2100 },
        { target: 156, userEstimate: 150, scaleMin: 0, scaleMax: 200, reactionTimeMs: 2400 },
      ],
      transcodingTrials: [
        { targetNumber: 47, selectedNumber: 47, isReversalError: false, reactionTimeMs: 1800 },
        { targetNumber: 83, selectedNumber: 83, isReversalError: false, reactionTimeMs: 2200 },
        { targetNumber: 69, selectedNumber: 69, isReversalError: false, reactionTimeMs: 2500 },
      ],
    });
    assert.equal(inventedTarget.valid, false);

    // Unoffered option 999 on transcoding trial must fail
    const unofferedOption = validateAndDeriveMathTrials({
      subitizingTrials: [
        { dotCount: 1, chosen: 1, correct: true, reactionTimeMs: 650 },
        { dotCount: 2, chosen: 2, correct: true, reactionTimeMs: 700 },
        { dotCount: 3, chosen: 3, correct: true, reactionTimeMs: 780 },
        { dotCount: 4, chosen: 4, correct: true, reactionTimeMs: 820 },
      ],
      numberLineTrials: [
        { target: 37, userEstimate: 39, scaleMin: 0, scaleMax: 100, reactionTimeMs: 2100 },
        { target: 156, userEstimate: 150, scaleMin: 0, scaleMax: 200, reactionTimeMs: 2400 },
      ],
      transcodingTrials: [
        { targetNumber: 47, selectedNumber: 999, isReversalError: false, reactionTimeMs: 1800 },
        { targetNumber: 83, selectedNumber: 83, isReversalError: false, reactionTimeMs: 2200 },
        { targetNumber: 69, selectedNumber: 69, isReversalError: false, reactionTimeMs: 2500 },
      ],
    });
    assert.equal(unofferedOption.valid, false);
  });

  it('enforces strict StudentProfilePatchSchema and ClinicalReportUpdateEnvelopeSchema', () => {
    assert.equal(
      StudentProfilePatchSchema.safeParse({ name: 'طالب محدث', gradeLevel: 4 }).success,
      true
    );
    assert.equal(
      StudentProfilePatchSchema.safeParse({ clinicalReport: {} }).success,
      false
    );
    assert.equal(
      StudentProfilePatchSchema.safeParse({ dyslexiaRiskScore: 10 }).success,
      false
    );

    assert.equal(
      ClinicalReportUpdateEnvelopeSchema.safeParse({
        clinicalReport: {
          clinicalSummary: 'ملخص مؤشرات القراءة الاسترشادية للطالب بعد الفحص.',
          ocularMotorAnalysis: 'تحليل حركة العين والتثبيتات البصرية المسجلة.',
          orthographicAndPhonologicalPatterns: 'تحليل الأنماط الإملائية والصوتية.',
          dyscalculiaSpatialAnalysis: 'تحليل الإدراك العددي والمكاني.',
          interventionExercises: [
            { title: 'تمرين التتبع المقطعي', description: 'وصف تفصيلي للتمرين اليومي المقترح.', durationMinutes: 10 },
          ],
          classroomAccommodations: ['تيسير صفي أول واضح وقابل للتطبيق داخل الفصل.'],
        },
      }).success,
      true
    );
  });
});
