import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  issueBaseeraSessionToken,
  verifyBaseeraSessionToken,
  authorizeSessionScope,
  validateExplicitGuardianConsent,
  parseStrictTrustProxyHops,
  stripArabicPatronymics,
  formatTenantDisplayNameAr,
  checkAuthFailureLimit,
  recordFailedAuthAttempt,
  getAuthThrottleDelayMs,
  isStrongBaseeraAccessCode,
  AuthFailureBucket,
  validateAndDeriveSessionFromEvidence,
  validateAndDeriveMathTrials,
  buildDeterministicLearningReport,
  StudentProfilePatchSchema,
  LearningReportUpdateEnvelopeSchema,
} from './studentDataSecurity';
import { ARABIC_READING_PASSAGES } from '../data/seedData';

const TEST_SECRET = 'test-learning-hmac-secret-key-2026-secure';

describe('Learning-session RBAC, Evidence Derivation, Plausibility Gates & Rate Limiting Unit Tests', () => {
  it('issues and verifies a Baseera session token with full scopes and Arabic tenant display name', () => {
    const issued = issueBaseeraSessionToken(
      'school_admin',
      'د. سارة المنصور',
      TEST_SECRET,
      60_000,
      'school_a'
    );
    assert.ok(issued.token.includes('.'));
    assert.equal(issued.role, 'school_admin');
    assert.equal(issued.tenantId, 'school_a');
    assert.equal(issued.tenantDisplayNameAr, 'مدرسة الرواد الأولى (أ)');
    assert.deepEqual(issued.scopes, [
      'students:read',
      'students:write',
      'students:delete',
      'ai:analyze',
      'audit:read',
    ]);

    const verified = verifyBaseeraSessionToken(issued.token, TEST_SECRET);
    assert.ok(verified);
    assert.equal(verified.role, 'school_admin');
    assert.equal(verified.tenantId, 'school_a');
    assert.equal(verified.tenantDisplayNameAr, 'مدرسة الرواد الأولى (أ)');
  });

  it('rejects tampered or expired tokens and enforces educator_readonly restrictions', () => {
    const issued = issueBaseeraSessionToken(
      'educator_readonly',
      'أ. هند السالم',
      TEST_SECRET,
      60_000,
      'school_b'
    );
    const verified = verifyBaseeraSessionToken(issued.token, TEST_SECRET);
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
      verifyBaseeraSessionToken(`${payloadB64}.${tamperedSig}`, TEST_SECRET),
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

  it('accepts only high-diversity 48-character hex access codes and rejects predictable tokens', () => {
    assert.equal(
      isStrongBaseeraAccessCode('3580bd6cfaada2ae57b75b7af6d75cd86fd18211ecc8bc1d'),
      true
    );
    assert.equal(isStrongBaseeraAccessCode('A-school administrator-secret-0123456789abc'), false);
    assert.equal(isStrongBaseeraAccessCode('a'.repeat(48)), false);
    assert.equal(isStrongBaseeraAccessCode('0123456789abcdef'.repeat(3)), false);
    assert.equal(isStrongBaseeraAccessCode('f'.repeat(47)), false);
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
    assert.equal('calibrationAccuracyPercent' in readingSession.derivedFields, false);
    assert.equal('fixations' in readingSession.derivedFields, false);
    assert.equal(readingSession.derivedFields.dyslexiaRiskScore, null);
    assert.equal(readingSession.derivedFields.readingHeuristicIndicator, null);
    assert.equal(readingSession.derivedFields.readingRiskLevel, 'unassessed');
    assert.ok(readingSession.derivedFields.wpm > 0);
    assert.match(
      readingSession.derivedFields.learningReport.ocularMotorAnalysis,
      /لا تستخدم بصيرة الحالية الكاميرا أو تتبّع العين/
    );
    assert.ok(readingSession.derivedFields.learningReport.interventionExercises.length >= 2);
    assert.ok(readingSession.derivedFields.learningReport.classroomAccommodations.length >= 2);

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
    assert.equal('fixations' in voiceOnlySession.derivedFields, false);
    assert.equal('calibrationAccuracyPercent' in voiceOnlySession.derivedFields, false);
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

  it('validates expanded 20-task battery (8 subitizing, 6 number line, 6 transcoding) from DyscalculiaLabView', () => {
    const expandedMath = validateAndDeriveMathTrials({
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
    });
    assert.equal(expandedMath.valid, true);
    assert.ok(expandedMath.metrics);
    assert.equal(expandedMath.metrics.reversalErrorCount, 3);
    assert.equal(expandedMath.metrics.subitizingAccuracy, 100);
  });

  it('exhaustively validates every offered choice across all 8 subitizing, 6 number line, and 6 transcoding items', () => {
    const SUBITIZING_SPECS = [
      { id: 1, targetCount: 1, options: [1, 2, 3, 4] },
      { id: 2, targetCount: 2, options: [1, 2, 3, 4] },
      { id: 3, targetCount: 3, options: [1, 2, 3, 4] },
      { id: 4, targetCount: 4, options: [1, 2, 3, 4] },
      { id: 5, targetCount: 5, options: [3, 4, 5, 6] },
      { id: 6, targetCount: 6, options: [4, 5, 6, 7] },
      { id: 7, targetCount: 7, options: [5, 6, 7, 8] },
      { id: 8, targetCount: 8, options: [6, 7, 8, 9] },
    ];

    const NUMBER_LINE_SPECS = [
      { target: 8, min: 0, max: 20 },
      { target: 15, min: 0, max: 20 },
      { target: 37, min: 0, max: 100 },
      { target: 82, min: 0, max: 100 },
      { target: 250, min: 0, max: 1000 },
      { target: 750, min: 0, max: 1000 },
    ];

    const TRANSCODING_SPECS = [
      { targetNumber: 47, options: [47, 74, 49], reversalDistractor: 74 },
      { targetNumber: 83, options: [38, 83, 63], reversalDistractor: 38 },
      { targetNumber: 69, options: [69, 96, 66], reversalDistractor: 96 },
      { targetNumber: 52, options: [25, 52, 56], reversalDistractor: 25 },
      { targetNumber: 27, options: [28, 27, 72], reversalDistractor: 72 },
      { targetNumber: 76, options: [76, 67, 72], reversalDistractor: 67 },
    ];

    const baselineSub = SUBITIZING_SPECS.map((p) => ({
      dotCount: p.targetCount,
      chosen: p.targetCount,
      correct: true,
      reactionTimeMs: 700,
    }));

    const baselineNl = NUMBER_LINE_SPECS.map((t) => ({
      target: t.target,
      userEstimate: t.target,
      scaleMin: t.min,
      scaleMax: t.max,
      reactionTimeMs: 2000,
    }));

    const baselineTr = TRANSCODING_SPECS.map((it) => ({
      targetNumber: it.targetNumber,
      selectedNumber: it.targetNumber,
      isReversalError: false,
      reactionTimeMs: 1800,
    }));

    // 1. Subitizing: test all 8 items with every offered option
    for (const pattern of SUBITIZING_SPECS) {
      for (const opt of pattern.options) {
        const subTrials = SUBITIZING_SPECS.map((p) => {
          const chosen = p.id === pattern.id ? opt : p.targetCount;
          return {
            dotCount: p.targetCount,
            chosen,
            correct: chosen === p.targetCount,
            reactionTimeMs: 700,
          };
        });
        const res = validateAndDeriveMathTrials({
          subitizingTrials: subTrials,
          numberLineTrials: baselineNl,
          transcodingTrials: baselineTr,
        });
        assert.equal(res.valid, true, `Subitizing pattern ${pattern.id} with option ${opt} failed validation: ${res.errorAr}`);
      }
    }

    // 2. Number line: test all 6 tasks with multiple valid positions across each scale
    for (const nlTask of NUMBER_LINE_SPECS) {
      const sampleEstimates = [
        nlTask.min,
        nlTask.min + 1,
        nlTask.target,
        Math.round((nlTask.min + nlTask.max) / 2),
        nlTask.max - 1,
        nlTask.max,
      ];
      for (const estimate of sampleEstimates) {
        const nlTrials = NUMBER_LINE_SPECS.map((t) => ({
          target: t.target,
          userEstimate: t.target === nlTask.target ? estimate : t.target,
          scaleMin: t.min,
          scaleMax: t.max,
          reactionTimeMs: 2000,
        }));
        const res = validateAndDeriveMathTrials({
          subitizingTrials: baselineSub,
          numberLineTrials: nlTrials,
          transcodingTrials: baselineTr,
        });
        assert.equal(res.valid, true, `Number line target ${nlTask.target} with estimate ${estimate} failed validation: ${res.errorAr}`);
      }
    }

    // 3. Transcoding: test EVERY option of all 6 items as constructed by DyscalculiaLabView
    for (const item of TRANSCODING_SPECS) {
      for (const opt of item.options) {
        const trTrials = TRANSCODING_SPECS.map((it) => {
          const selected = it.targetNumber === item.targetNumber ? opt : it.targetNumber;
          return {
            targetNumber: it.targetNumber,
            selectedNumber: selected,
            isReversalError: selected === it.reversalDistractor,
            reactionTimeMs: 1800,
          };
        });
        const res = validateAndDeriveMathTrials({
          subitizingTrials: baselineSub,
          numberLineTrials: baselineNl,
          transcodingTrials: trTrials,
        });
        assert.equal(res.valid, true, `Transcoding target ${item.targetNumber} with choice ${opt} failed validation: ${res.errorAr}`);
      }
    }

    // Explicit check for target 27 specifically (28, 27, 72)
    const spec27 = TRANSCODING_SPECS.find((s) => s.targetNumber === 27)!;
    assert.equal(spec27.reversalDistractor, 72);

    // Choosing 72 must set isReversalError: true and pass
    const trial72 = validateAndDeriveMathTrials({
      subitizingTrials: baselineSub,
      numberLineTrials: baselineNl,
      transcodingTrials: [
        { targetNumber: 27, selectedNumber: 72, isReversalError: true, reactionTimeMs: 1500 },
      ],
    });
    assert.equal(trial72.valid, true);
    assert.equal(trial72.metrics?.reversalErrorCount, 1);

    // Choosing 28 must set isReversalError: false and pass
    const trial28 = validateAndDeriveMathTrials({
      subitizingTrials: baselineSub,
      numberLineTrials: baselineNl,
      transcodingTrials: [
        { targetNumber: 27, selectedNumber: 28, isReversalError: false, reactionTimeMs: 1500 },
      ],
    });
    assert.equal(trial28.valid, true);
    assert.equal(trial28.metrics?.reversalErrorCount, 0);

    // Choosing 27 must set isReversalError: false and pass
    const trial27 = validateAndDeriveMathTrials({
      subitizingTrials: baselineSub,
      numberLineTrials: baselineNl,
      transcodingTrials: [
        { targetNumber: 27, selectedNumber: 27, isReversalError: false, reactionTimeMs: 1500 },
      ],
    });
    assert.equal(trial27.valid, true);
    assert.equal(trial27.metrics?.reversalErrorCount, 0);

    // Reject unoffered option e.g. 99 for target 27
    const trial99 = validateAndDeriveMathTrials({
      subitizingTrials: baselineSub,
      numberLineTrials: baselineNl,
      transcodingTrials: [
        { targetNumber: 27, selectedNumber: 99, isReversalError: false, reactionTimeMs: 1500 },
      ],
    });
    assert.equal(trial99.valid, false);

    // Reject contradictory reversal flag (chosen 72 but sent isReversalError: false)
    const trialConflict = validateAndDeriveMathTrials({
      subitizingTrials: baselineSub,
      numberLineTrials: baselineNl,
      transcodingTrials: [
        { targetNumber: 27, selectedNumber: 72, isReversalError: false, reactionTimeMs: 1500 },
      ],
    });
    assert.equal(trialConflict.valid, false);
  });

  it('enforces strict StudentProfilePatchSchema and LearningReportUpdateEnvelopeSchema', () => {
    assert.equal(
      StudentProfilePatchSchema.safeParse({ name: 'طالب محدث', gradeLevel: 4 }).success,
      true
    );
    assert.equal(
      StudentProfilePatchSchema.safeParse({ learningReport: {} }).success,
      false
    );
    assert.equal(
      StudentProfilePatchSchema.safeParse({ dyslexiaRiskScore: 10 }).success,
      false
    );

    assert.equal(
      LearningReportUpdateEnvelopeSchema.safeParse({
        learningReport: {
          learningSummary: 'ملخص مؤشرات القراءة الاسترشادية للطالب بعد الفحص.',
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


it('derives oral-reading metrics only from a complete server-verified Azure assessment', () => {
  const passage = ARABIC_READING_PASSAGES[0];
  const answers = passage.comprehensionQuestions.map((q) => q.correctIndex);
  const assessment = {
    sourceModel: 'azure_pronunciation_assessment' as const,
    assessmentComplete: true as const,
    passageId: passage.id,
    transcript: passage.words.slice(1).join(' '),
    durationSeconds: 45,
    wordAccuracyPercent: Math.round(((passage.words.length - 1) / passage.words.length) * 100),
    wordsCorrectPerMinute: 30,
    wordsPerMinute: 35,
    words: passage.words.map((word, index) => ({
      word,
      errorType: index === 0 ? 'Substitution' as const : 'None' as const,
      accuracyScore: index === 0 ? 45 : 96,
      spokenWord: index === 0 ? 'كلمة مختلفة' : word,
    })),
  };

  const result = validateAndDeriveSessionFromEvidence(
    {
      assessmentModality: 'voice_only',
      passageId: passage.id,
      readingDurationSeconds: 45,
      comprehensionAnswers: answers,
    },
    { name: 'طالب تجريبي', gradeLevel: passage.gradeLevel },
    undefined,
    assessment,
  );

  assert.equal(result.valid, true);
  assert.ok(result.derivedFields);
  assert.equal(result.derivedFields.oralReadingAssessed, true);
  assert.equal(result.derivedFields.aiAssessmentVerified, true);
  assert.equal(result.derivedFields.aiAssessmentSource, 'azure_pronunciation_assessment');
  assert.equal(result.derivedFields.evidenceProvenance, 'server-verified-audio');
  assert.equal(result.derivedFields.oralWcpm, 30);
  assert.equal(result.derivedFields.oralAccuracyPercent, assessment.wordAccuracyPercent);
  assert.equal(result.derivedFields.phoneticSubstitutionCount, 1);
  assert.equal(result.derivedFields.verifiedWordsAlignment?.[0].status, 'phonetic_substitution');
  assert.equal(result.derivedFields.readingRiskLevel, 'unassessed');
  assert.equal(result.derivedFields.dyslexiaRiskScore, null);
});

it('does not trust client-submitted AI flags or browser transcript as an audio assessment', () => {
  const passage = ARABIC_READING_PASSAGES[0];
  const answers = passage.comprehensionQuestions.map((q) => q.correctIndex);
  const result = validateAndDeriveSessionFromEvidence(
    {
      assessmentModality: 'voice_only',
      passageId: passage.id,
      readingDurationSeconds: 45,
      comprehensionAnswers: answers,
      spokenTranscript: passage.words.join(' '),
      aiAssessmentVerified: true,
      aiAssessmentSource: 'azure_pronunciation_assessment',
      oralReadingAssessed: true,
      wcpm: 200,
      oralAccuracyPercent: 100,
    },
    { name: 'طالب تجريبي', gradeLevel: passage.gradeLevel },
  );

  assert.equal(result.valid, true);
  assert.ok(result.derivedFields);
  assert.equal(result.derivedFields.aiAssessmentVerified, false);
  assert.equal(result.derivedFields.oralReadingAssessed, false);
  assert.equal(result.derivedFields.wcpm, null);
  assert.equal(result.derivedFields.oralWcpm, null);
  assert.equal(result.derivedFields.oralAccuracyPercent, null);
  assert.equal(result.derivedFields.evidenceProvenance, 'client-reported');
});
