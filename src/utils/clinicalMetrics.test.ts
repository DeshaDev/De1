import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEyeTrackingMetrics,
  calculateDyscalculiaMetrics,
  segmentArabicWordIntoSyllables,
  getConfusableLetterGroup,
  WordFixation,
} from './clinicalMetrics.ts';
import {
  issueClinicalSessionToken,
  verifyClinicalSessionToken,
  authorizeSessionScope,
  validateExplicitGuardianConsent,
} from './clinicalSecurity.ts';

test('calculateEyeTrackingMetrics identifies high dyslexia risk on slow reading with frequent regressions', () => {
  const fixations = [
    { wordIndex: 0, word: 'يَقرَأُ', durationMs: 520, visits: 3, regressedFromIndex: 2 },
    { wordIndex: 1, word: 'الطَّالِبُ', durationMs: 490, visits: 2, regressedFromIndex: 3 },
    { wordIndex: 2, word: 'النَّصَّ', durationMs: 460, visits: 2 },
    { wordIndex: 3, word: 'بِتَركِيزٍ', durationMs: 580, visits: 3, regressedFromIndex: 4 },
    { wordIndex: 4, word: 'عَالٍ.', durationMs: 410, visits: 1 },
  ];

  // 5 words in 12 seconds = 25 WPM (well below Grade 3 benchmark of 85 WPM)
  const result = calculateEyeTrackingMetrics(fixations, 12, 3);

  assert.equal(result.wpm, 25);
  assert.ok(result.regressionCount >= 5);
  assert.equal(result.riskLevel, 'high');
  assert.ok(result.dyslexiaRiskScore >= 62);
  assert.ok(result.problematicWords.includes('يَقرَأُ'));
  assert.ok(result.problematicWords.includes('بِتَركِيزٍ'));
});

test('calculateEyeTrackingMetrics classifies fluent reader with low regressions as nominal', () => {
  const fixations = [
    { wordIndex: 0, word: 'تُشْرِقُ', durationMs: 210, visits: 1 },
    { wordIndex: 1, word: 'الشَّمْسُ', durationMs: 195, visits: 1 },
    { wordIndex: 2, word: 'صَبَاحاً', durationMs: 220, visits: 1 },
    { wordIndex: 3, word: 'فَتَمْلَأُ', durationMs: 230, visits: 1 },
    { wordIndex: 4, word: 'الأُفُقَ', durationMs: 205, visits: 1 },
    { wordIndex: 5, word: 'نُوراً.', durationMs: 190, visits: 1 },
  ];

  // 6 words in 3.8 seconds = ~95 WPM
  const result = calculateEyeTrackingMetrics(fixations, 3.8, 3);

  assert.ok(result.wpm >= 90);
  assert.equal(result.regressionCount, 0);
  assert.equal(result.riskLevel, 'nominal');
  assert.ok(result.percentile >= 70);
});

test('calculateDyscalculiaMetrics detects high dyscalculia risk when PAE and reversals are elevated', () => {
  const subitizing = [
    { dotCount: 4, correct: true, reactionTimeMs: 2100 },
    { dotCount: 5, correct: false, reactionTimeMs: 2600 },
    { dotCount: 6, correct: false, reactionTimeMs: 2900 },
  ];
  const numberLine = [
    { target: 37, userEstimate: 64, reactionTimeMs: 3200 },
    { target: 78, userEstimate: 48, reactionTimeMs: 2900 },
  ];
  const transcoding = [
    { targetNumber: 47, selectedNumber: 74, isReversalError: true, reactionTimeMs: 2800 },
    { targetNumber: 83, selectedNumber: 38, isReversalError: true, reactionTimeMs: 3100 },
  ];

  const metrics = calculateDyscalculiaMetrics(subitizing, numberLine, transcoding);

  assert.equal(metrics.reversalErrorCount, 2);
  assert.ok(metrics.numberLinePAE > 20);
  assert.equal(metrics.riskLevel, 'high');
  assert.ok(metrics.dyscalculiaRiskScore >= 60);
});

test('segmentArabicWordIntoSyllables segments definite article and long vowels cleanly', () => {
  const syllables = segmentArabicWordIntoSyllables('المكتبة');
  assert.ok(syllables.length >= 2);
  assert.equal(syllables[0], 'ال');
  assert.equal(syllables.join(''), 'المكتبة');
});

test('getConfusableLetterGroup identifies homographic Arabic letter families', () => {
  assert.equal(getConfusableLetterGroup('بَ'), 'baa_group');
  assert.equal(getConfusableLetterGroup('ث'), 'baa_group');
  assert.equal(getConfusableLetterGroup('خُ'), 'jeem_group');
  assert.equal(getConfusableLetterGroup('ض'), 'seen_group');
  assert.equal(getConfusableLetterGroup('م'), 'none');
});

test('calculateEyeTrackingMetrics rejects unobserved 0ms words and flags insufficient gaze coverage instead of fabricating 190ms defaults', () => {
  const sparseFixations: WordFixation[] = [
    { wordIndex: 0, word: 'زار', durationMs: 240, visits: 1, observed: true },
    { wordIndex: 1, word: 'طلاب', durationMs: 260, visits: 1, observed: true },
    { wordIndex: 2, word: 'المدرسة', durationMs: 0, visits: 0, observed: false },
    { wordIndex: 3, word: 'المرصد', durationMs: 0, visits: 0, observed: false },
    { wordIndex: 4, word: 'الفلكي', durationMs: 0, visits: 0, observed: false },
    { wordIndex: 5, word: 'مساء', durationMs: 0, visits: 0, observed: false },
    { wordIndex: 6, word: 'صاف', durationMs: 0, visits: 0, observed: false },
    { wordIndex: 7, word: 'لمشاهدة', durationMs: 0, visits: 0, observed: false },
    { wordIndex: 8, word: 'الكواكب', durationMs: 0, visits: 0, observed: false },
    { wordIndex: 9, word: 'المضيئة', durationMs: 0, visits: 0, observed: false },
  ];

  const metrics = calculateEyeTrackingMetrics(sparseFixations, 15, 4);
  assert.equal(metrics.observedWordCount, 2);
  assert.equal(metrics.totalPassageWordCount, 10);
  assert.equal(metrics.gazeCoveragePercent, 20);
  assert.equal(metrics.isSufficientGazeData, false);
  // Average fixation must be computed ONLY from the 2 observed words ((240+260)/2 = 250ms), not diluted by 0ms or 190ms
  assert.equal(metrics.avgFixationMs, 250);
});

test('calculateEyeTrackingMetrics integrates oral reading phonetic substitutions while exempting Arabic dialect variants', () => {
  const normalGaze: WordFixation[] = [
    { wordIndex: 0, word: 'زار', durationMs: 210, visits: 1, observed: true },
    { wordIndex: 1, word: 'طلاب', durationMs: 220, visits: 1, observed: true },
    { wordIndex: 2, word: 'المدرسة', durationMs: 230, visits: 1, observed: true },
    { wordIndex: 3, word: 'المرصد', durationMs: 215, visits: 1, observed: true },
    { wordIndex: 4, word: 'الفلكي', durationMs: 225, visits: 1, observed: true },
  ];

  // 1. Dialect variants only -> should NOT increase risk score
  const withDialectOnly = calculateEyeTrackingMetrics(
    normalGaze,
    4,
    4,
    undefined,
    undefined,
    {
      assessed: true,
      wcpm: 75,
      accuracyPercent: 100,
      werPercent: 0,
      phoneticSubstitutionCount: 0,
      omissionCount: 0,
      dialectVariantCount: 3,
      misreadWords: [],
    }
  );
  assert.equal(withDialectOnly.riskLevel, 'nominal');
  assert.equal(withDialectOnly.dialectVariantCount, 3);

  // 2. Phonetic dyslexia substitutions + omissions -> MUST increase risk score and merge problematic words
  const withPhoneticErrors = calculateEyeTrackingMetrics(
    normalGaze,
    4,
    4,
    undefined,
    undefined,
    {
      assessed: true,
      wcpm: 42,
      accuracyPercent: 55,
      werPercent: 45,
      phoneticSubstitutionCount: 3,
      omissionCount: 2,
      dialectVariantCount: 1,
      misreadWords: ['طلاب (نُطقت: تلاب)', 'المنظار (نُطقت: المنضار)'],
    }
  );
  assert.ok(
    withPhoneticErrors.percentile < withDialectOnly.percentile,
    'Phonetic substitutions and omissions must lower the screening percentile / increase risk'
  );
  assert.ok(
    withPhoneticErrors.problematicWords.some((w) => w.includes('تلاب')),
    'Phonetic error words must be merged into problematicWords'
  );
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

test('clinicalSecurity enforces HMAC-SHA256 RBAC scopes and strict default-deny guardian consent', () => {
  const secret = 'unit-test-hmac-secret-2026';

  // 1. Unauthenticated request is rejected with 401
  const unauthCheck = authorizeSessionScope(null, 'students:read');
  assert.equal(unauthCheck.allowed, false);
  assert.equal(unauthCheck.statusCode, 401);

  // 2. Educator readonly role can read students but is forbidden (403) from deleting or writing
  const readonlySession = issueClinicalSessionToken(
    'educator_readonly',
    'معلم الصف',
    secret
  );
  const verifiedReadonly = verifyClinicalSessionToken(
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

  // 3. Clinician role has full scopes
  const clinicianSession = issueClinicalSessionToken(
    'clinician',
    'د. سارة',
    secret
  );
  const verifiedClinician = verifyClinicalSessionToken(
    clinicianSession.token,
    secret
  );
  assert.equal(
    authorizeSessionScope(verifiedClinician, 'students:delete').allowed,
    true
  );
  assert.equal(
    authorizeSessionScope(verifiedClinician, 'ai:analyze').allowed,
    true
  );

  // 4. Tampered token is rejected
  assert.equal(
    verifyClinicalSessionToken(`${clinicianSession.token}tampered`, secret),
    null
  );

  // 5. Strict Default-Deny Guardian Consent: rejects undefined, null, false, or truthy strings
  assert.equal(validateExplicitGuardianConsent(undefined).valid, false);
  assert.equal(validateExplicitGuardianConsent(null).valid, false);
  assert.equal(validateExplicitGuardianConsent(false).valid, false);
  assert.equal(validateExplicitGuardianConsent('true').valid, false);
  assert.equal(validateExplicitGuardianConsent(true).valid, true);
});


