import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDyscalculiaMetrics,
  segmentArabicWordIntoSyllables,
  getConfusableLetterGroup,
} from './learningMetrics.ts';
import {
  issueBaseeraSessionToken,
  verifyBaseeraSessionToken,
  authorizeSessionScope,
  validateExplicitGuardianConsent,
} from './studentDataSecurity.ts';

test('calculateDyscalculiaMetrics reports measured task observations without inventing a risk classification', () => {
  const subitizing = [
    { dotCount: 4, correct: true, reactionTimeMs: 2100 },
    { dotCount: 5, correct: false, reactionTimeMs: 2600 },
    { dotCount: 6, correct: false, reactionTimeMs: 2900 },
  ];
  const numberLine = [
    { target: 37, userEstimate: 64, reactionTimeMs: 3200, scaleMin: 0, scaleMax: 100 },
    { target: 78, userEstimate: 48, reactionTimeMs: 2900, scaleMin: 0, scaleMax: 100 },
  ];
  const transcoding = [
    { targetNumber: 47, selectedNumber: 74, isReversalError: true, reactionTimeMs: 2800 },
    { targetNumber: 83, selectedNumber: 38, isReversalError: true, reactionTimeMs: 3100 },
  ];

  const metrics = calculateDyscalculiaMetrics(subitizing, numberLine, transcoding);

  assert.equal(metrics.reversalErrorCount, 2);
  assert.equal(typeof metrics.numberLinePAE, 'number');
  assert.ok((metrics.numberLinePAE ?? 0) > 20);
  assert.equal(metrics.riskLevel, 'unassessed');
  assert.equal(metrics.dyscalculiaRiskScore, null);
  assert.equal(metrics.heuristicIndicator, null);
});

test('calculateDyscalculiaMetrics treats empty task groups as unmeasured rather than perfect performance', () => {
  const metrics = calculateDyscalculiaMetrics([], [], []);
  assert.equal(metrics.subitizingAccuracy, null);
  assert.equal(metrics.avgSubitizingMs, null);
  assert.equal(metrics.numberLinePAE, null);
  assert.equal(metrics.transcodingAccuracy, null);
  assert.equal(metrics.reversalErrorCount, null);
  assert.equal(metrics.dyscalculiaRiskScore, null);
  assert.equal(metrics.riskLevel, 'unassessed');
});

test('segmentArabicWordIntoSyllables leaves unvocalized Arabic intact instead of inventing boundaries', () => {
  assert.deepEqual(segmentArabicWordIntoSyllables('المكتبة'), ['المكتبة']);
  assert.deepEqual(segmentArabicWordIntoSyllables('المدرسة.'), ['المدرسة.']);
});

test('segmentArabicWordIntoSyllables conservatively segments a fully vocalized simple word', () => {
  const syllables = segmentArabicWordIntoSyllables('شَاهَدَتْ');
  assert.deepEqual(syllables, ['شَا', 'هَ', 'دَتْ']);
  assert.equal(syllables.join(''), 'شَاهَدَتْ');
});

test('segmentArabicWordIntoSyllables keeps shadda/gemination intact when uncertain', () => {
  assert.deepEqual(segmentArabicWordIntoSyllables('التُّفَّاحِ'), ['التُّفَّاحِ']);
});

test('getConfusableLetterGroup identifies homographic Arabic letter families', () => {
  assert.equal(getConfusableLetterGroup('بَ'), 'baa_group');
  assert.equal(getConfusableLetterGroup('ث'), 'baa_group');
  assert.equal(getConfusableLetterGroup('خُ'), 'jeem_group');
  assert.equal(getConfusableLetterGroup('ض'), 'seen_group');
  assert.equal(getConfusableLetterGroup('م'), 'none');
});

test('calculateDyscalculiaMetrics normalizes PAE by scale range (scaleMax - scaleMin) per Siegler & Booth (2004)', () => {
  const subitizing = [{ dotCount: 5, correct: true, reactionTimeMs: 920 }];
  // Trial 1: target 37, estimate 47 on 0-100 scale -> |47 - 37| / 100 = 10.0% PAE
  // Trial 2: target 156, estimate 176 on 0-200 scale -> |176 - 156| / 200 = 10.0% PAE (NOT 20% raw absolute error!)
  const numberLine = [
    {
      target: 37,
      userEstimate: 47,
      reactionTimeMs: 1450,
      scaleMin: 0,
      scaleMax: 100,
    },
    {
      target: 156,
      userEstimate: 176,
      reactionTimeMs: 1650,
      scaleMin: 0,
      scaleMax: 200,
    },
  ];
  const transcoding = [
    {
      targetNumber: 47,
      selectedNumber: 47,
      isReversalError: false,
      reactionTimeMs: 1100,
    },
  ];

  const metrics = calculateDyscalculiaMetrics(
    subitizing,
    numberLine,
    transcoding
  );
  assert.equal(metrics.numberLinePAE, 10);
  assert.equal(metrics.avgNumberLineMs, 1550);
});

test('studentDataSecurity enforces HMAC-SHA256 RBAC scopes and strict default-deny guardian consent', () => {
  const secret = 'unit-test-hmac-secret-2026';

  // 1. Unauthenticated request is rejected with 401
  const unauthCheck = authorizeSessionScope(null, 'students:read');
  assert.equal(unauthCheck.allowed, false);
  assert.equal(unauthCheck.statusCode, 401);

  // 2. Educator readonly role can read students but is forbidden (403) from deleting or writing
  const readonlySession = issueBaseeraSessionToken(
    'educator_readonly',
    'معلم الصف',
    secret
  );
  const verifiedReadonly = verifyBaseeraSessionToken(
    `Bearer ${readonlySession.token}`,
    secret
  );
  assert.ok(verifiedReadonly);
  assert.equal(
    authorizeSessionScope(verifiedReadonly, 'students:read').allowed,
    true
  );
  const deleteAttempt = authorizeSessionScope(
    verifiedReadonly,
    'students:delete'
  );
  assert.equal(deleteAttempt.allowed, false);
  assert.equal(deleteAttempt.statusCode, 403);

  // 3. School administrator role has full scopes
  const schoolAdminSession = issueBaseeraSessionToken(
    'school_admin',
    'د. سارة',
    secret
  );
  const verifiedSchoolAdmin = verifyBaseeraSessionToken(
    schoolAdminSession.token,
    secret
  );
  assert.equal(
    authorizeSessionScope(verifiedSchoolAdmin, 'students:delete').allowed,
    true
  );
  assert.equal(
    authorizeSessionScope(verifiedSchoolAdmin, 'ai:analyze').allowed,
    true
  );

  // 4. Tampered token is rejected
  assert.equal(
    verifyBaseeraSessionToken(`${schoolAdminSession.token}tampered`, secret),
    null
  );

  // 5. Strict Default-Deny Guardian Consent: rejects undefined, null, false, or truthy strings
  assert.equal(validateExplicitGuardianConsent(undefined).valid, false);
  assert.equal(validateExplicitGuardianConsent(null).valid, false);
  assert.equal(validateExplicitGuardianConsent(false).valid, false);
  assert.equal(validateExplicitGuardianConsent('true').valid, false);
  assert.equal(validateExplicitGuardianConsent(true).valid, true);
});


