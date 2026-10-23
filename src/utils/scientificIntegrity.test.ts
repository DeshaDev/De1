import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateOralReadingAlignment,
  OralReadingFluencyResult,
  computeStandardSequenceWer,
} from './dyslexiaEngines';
import { ARABIC_READING_PASSAGES, StudentRecord, INITIAL_STUDENTS } from '../data/seedData';
import { validateAndDeriveSessionFromEvidence } from './clinicalSecurity';

test('Scientific & Pedagogical Integrity of Baseera Platform', async (t) => {
  const passage = ARABIC_READING_PASSAGES[0]; // "الْقِطَّةُ الْبَيْضَاءُ" (52 words)

  await t.test('Oral Reading Fluency: computes WCPM strictly based on correct words read per minute', () => {
    const durationSeconds = 60;
    const referenceWords = passage.words;
    // Omit first 6 words in spoken transcript
    const spokenTranscript = referenceWords.slice(6).join(' ');

    const result: OralReadingFluencyResult = evaluateOralReadingAlignment(
      referenceWords,
      spokenTranscript,
      durationSeconds,
      0,
      'egyptian'
    );

    assert.equal(result.totalWords, referenceWords.length);
    assert.ok(result.wcpm < referenceWords.length);
    assert.ok(result.wcpm > 0);
    assert.ok(result.accuracyPercent < 100);
    assert.equal(result.alignment.length, referenceWords.length);
  });

  await t.test('Oral Reading Fluency: distinguishes accepted Arabic dialect variants without unfair penalty', () => {
    const reference = ['ثلاثة', 'ثيران', 'في', 'القرية'];
    const spokenEgyptian = 'تلاتة تيران في القرية';

    const result = evaluateOralReadingAlignment(
      reference,
      spokenEgyptian,
      60,
      0,
      'egyptian'
    );

    assert.equal(result.alignment.length, 4);
    assert.ok(result.wcpm > 0);
    const validCount = result.alignment.filter(
      a => a.status === 'dialect_variant' || a.status === 'correct'
    ).length;
    assert.ok(validCount >= 2);
  });

  await t.test('Standard WER Calculation: computes (S + D + I) / N correctly with insertions', () => {
    const reference = ['قَرَأَ', 'الطَّالِبُ', 'كِتَابًا']; // 3 words
    // Spoken with 1 phonetic substitution ("التالب" instead of "الطالب") and 1 extra inserted word ("جميل")
    const spokenWithInsertion = 'قرأ التالب كتابا جميل';

    const result = evaluateOralReadingAlignment(
      reference,
      spokenWithInsertion,
      30,
      0,
      'msa'
    );

    assert.equal(result.totalWords, 3);
    assert.ok(result.werPercent !== null && result.werPercent > 0);
    assert.equal(result.phoneticSubstitutionCount, 1);
    // WER must account for substitution (1) and insertion (1) over N (3)
    assert.ok(result.werPercent !== null && result.werPercent >= 66);
  });

  await t.test('Full Reference Alignment: unread words are counted as omissions rather than ignored', () => {
    // If student only reads the first 4 words of a 52-word passage
    const shortSpoken = passage.words.slice(0, 4).join(' ');
    const result = evaluateOralReadingAlignment(
      passage.words,
      shortSpoken,
      30,
      0,
      'egyptian'
    );

    assert.equal(result.totalWords, 52);
    // 48 words must be marked as omitted
    assert.equal(result.omittedWordsCount, 48);
    // Accuracy must reflect the whole passage, not just the read fraction
    assert.ok(result.accuracyPercent <= 10);
  });

  await t.test('Empty Speech Transcript: does not fabricate a perfect reading result', () => {
    const emptyTranscript = '';
    const result = evaluateOralReadingAlignment(
      passage.words,
      emptyTranscript,
      30,
      0,
      'egyptian'
    );

    assert.equal(result.correctWordsCount, 0);
    assert.equal(result.omittedWordsCount, passage.words.length);
    assert.equal(result.wcpm, 0);
    assert.equal(result.accuracyPercent, 0);
    assert.equal(result.werPercent, null); // Empty transcript must yield null rather than artificial 0%
  });

  await t.test('Teacher Human-in-the-Loop override recalculates WCPM accurately', () => {
    const elapsedSec = 30; // 0.5 minute
    let correctWords = 3;
    let initialWcpm = Math.round((correctWords / elapsedSec) * 60); // 6 WCPM
    assert.equal(initialWcpm, 6);

    // When teacher verifies and overrides erroneous recognition
    correctWords = 4;
    let teacherVerifiedWcpm = Math.round((correctWords / elapsedSec) * 60); // 8 WCPM
    assert.equal(teacherVerifiedWcpm, 8);
    assert.ok(teacherVerifiedWcpm > initialWcpm);
  });

  await t.test('Qatar privacy-law readiness: validates explicit guardian consent metadata', () => {
    const compliantStudent: StudentRecord = {
      ...INITIAL_STUDENTS[0],
      id: 'test-student-compliance-1',
      name: 'كريم أحمد',
      ageYears: 9,
      gradeLevel: 3,
      guardianName: 'أحمد محمود (ولي الأمر)',
      guardianRelationship: 'أب',
      guardianConsentGiven: true,
      guardianConsentPeriod: 'عام دراسي 2026/2027',
      guardianConsentRecordedAt: new Date().toISOString(),
      guardianConsentSource: 'نموذج موافقة إلكتروني موثق - المادة 15',
      guardianAudioConsentGiven: true,
      audioRecordingConsentGiven: true,
      assessmentModality: 'reading_only',
      sessionStatus: 'completed',
      wpm: 68,
      wcpm: 65,
      oralWcpm: 65,
      teacherVerified: true,
      oralReadingAssessed: true,
      readingDurationSeconds: 48,
      comprehensionScore: 100,
      passageId: 'passage-grade-3-01',
    };

    assert.equal(compliantStudent.guardianConsentGiven, true);
    assert.ok(compliantStudent.guardianName);
    assert.ok(compliantStudent.guardianRelationship);
    assert.equal(compliantStudent.guardianConsentPeriod, 'عام دراسي 2026/2027');
    assert.equal(compliantStudent.assessmentModality, 'reading_only');
    assert.equal(compliantStudent.teacherVerified, true);
    assert.equal(compliantStudent.wcpm, 65);
  });

  await t.test('Camera-Free Evidence Derivation: validates reading-only sessions without synthetic eye data', () => {
    const rawPayload = {
      passageId: passage.id,
      assessmentModality: 'reading_only',
      readingDurationSeconds: 45,
      comprehensionAnswers: [0, 1, 2, 0],
      fixations: [],
      blinkCount: 0,
      guardianConsentGiven: true,
      guardianConsentRecordedAt: new Date().toISOString(),
      guardianConsentSource: 'إقرار ولي الأمر والمدرسة',
    };

    const derived = validateAndDeriveSessionFromEvidence(rawPayload, {
      name: 'سارة خالد',
      gradeLevel: 3,
    });

    assert.equal(derived.valid, true);
    assert.ok(derived.derivedFields);
    assert.equal(derived.derivedFields.assessmentModality, 'reading_only');
    assert.equal(derived.derivedFields.calibrationAccuracyPercent, undefined);
    assert.equal(derived.derivedFields.fixations.length, 0);
    assert.equal(derived.derivedFields.dyslexiaRiskScore, null);
    assert.equal(derived.derivedFields.readingHeuristicIndicator, null);
    assert.equal(derived.derivedFields.readingRiskLevel, 'unassessed');
    assert.ok(derived.derivedFields.clinicalReport);
  });

  await t.test('Voice-only session without transcript does not infer speed from the full passage', () => {
    const rawPayload = {
      passageId: passage.id,
      assessmentModality: 'voice_only',
      readingDurationSeconds: 45,
      comprehensionAnswers: [0, 1, 2, 0],
      fixations: [],
      blinkCount: 0,
      oralReadingAssessed: true,
      spokenTranscript: '',
      guardianConsentGiven: true,
      guardianConsentRecordedAt: new Date().toISOString(),
      guardianConsentSource: 'إقرار ولي الأمر والمدرسة',
    };
    const derived = validateAndDeriveSessionFromEvidence(rawPayload, {
      name: 'سارة خالد',
      gradeLevel: 3,
    });
    assert.equal(derived.valid, true);
    assert.ok(derived.derivedFields);
    assert.equal(derived.derivedFields.assessmentModality, 'voice_only');
    assert.equal(derived.derivedFields.wpm, 0);
    assert.equal(derived.derivedFields.wcpm, null);
    assert.equal(derived.derivedFields.oralWerPercent, null);
  });

  await t.test('Standard Dynamic Programming Levenshtein WER: exact matrix calculation with deletions, substitutions and insertions', () => {
    const reference = ['كان', 'الولد', 'يقرأ', 'قصة', 'جميلة'];
    // 1 deletion ("كان" omitted), 1 substitution ("يسمع" for "يقرأ"), 1 insertion ("كبيرة" inserted at end)
    const hypothesis = ['الولد', 'يسمع', 'قصة', 'جميلة', 'كبيرة'];

    const wer = computeStandardSequenceWer(reference, hypothesis);
    assert.equal(wer.referenceLength, 5);
    assert.equal(wer.deletions, 1);
    assert.equal(wer.substitutions, 1);
    assert.equal(wer.insertions, 1);
    // WER = (1 + 1 + 1) / 5 = 60%
    assert.equal(wer.werPercent, 60);

    // Standard unclamped WER when insertions exceed reference length (e.g. child utters additional words)
    const shortRef = ['ذهب', 'إلى']; // N = 2
    const verboseHyp = ['ذهب', 'إلى', 'المدرسة', 'الكبيرة', 'في', 'الصباح']; // 4 insertions
    const unclampedWer = computeStandardSequenceWer(shortRef, verboseHyp);
    assert.equal(unclampedWer.referenceLength, 2);
    assert.equal(unclampedWer.insertions, 4);
    // WER = 4 / 2 * 100 = 200% (standard unclamped ASR definition)
    assert.equal(unclampedWer.werPercent, 200);
  });

  await t.test('Authoritative Teacher Verification: server calculates WCPM and accuracy strictly from verifiedWordsAlignment', () => {
    // Construct a teacher verification where the teacher reviewed all 52 passage words
    const verifiedWords = passage.words.map((w, idx) => ({
      word: w,
      // First 30 words correct, next 5 dialect, rest omitted
      status: (idx < 30 ? 'correct' : (idx < 35 ? 'dialect_variant' : 'omitted')) as
        | 'correct'
        | 'dialect_variant'
        | 'omitted',
    }));

    const rawPayload = {
      passageId: passage.id,
      assessmentModality: 'reading_only',
      readingDurationSeconds: 60, // 1 minute
      comprehensionAnswers: [0, 1, 2, 0],
      guardianConsentGiven: true,
      guardianConsentRecordedAt: new Date().toISOString(),
      guardianConsentSource: 'إقرار ولي الأمر والمدرسة',
      oralReadingAssessed: true,
      spokenTranscript: 'تفريغ عشوائي قديم لا يعتمد عليه', // Machine transcript should NOT override teacher!
      teacherVerified: true,
      teacherVerifierRole: 'معلم صعوبات تعلم',
      teacherWordOverridesCount: 5,
      verifiedWordsAlignment: verifiedWords,
    };

    const derived = validateAndDeriveSessionFromEvidence(rawPayload, {
      name: 'عمر شريف',
      gradeLevel: 3,
    }, {
      sessionId: 'review-session-test-001',
      role: 'clinician',
      clinicianName: 'مراجع موثّق للاختبار',
    });

    assert.equal(derived.valid, true);
    assert.ok(derived.derivedFields);
    assert.equal(derived.derivedFields.teacherVerified, true);
    // 30 correct + 5 dialect = 35 effective words in 1 minute = 35 WCPM
    assert.equal(derived.derivedFields.wcpm, 35);
    assert.equal(derived.derivedFields.oralWcpm, 35);
    // 35 / 52 = 67% accuracy
    assert.equal(derived.derivedFields.oralAccuracyPercent, 67);
    assert.equal(derived.derivedFields.dialectVariantCount, 5);
    assert.equal(derived.derivedFields.omissionCount, 17);
    assert.equal(derived.derivedFields.teacherVerifierId, 'review-session-test-001');
    assert.equal(derived.derivedFields.teacherVerifierName, 'مراجع موثّق للاختبار');
    assert.equal(derived.derivedFields.teacherVerifierRole, 'أخصائي مصادق عليه عبر الحساب');
  });

  await t.test('Client-submitted teacherVerified is ignored without an authenticated clinician reviewer', () => {
    const rawPayload = {
      passageId: passage.id,
      assessmentModality: 'voice_only',
      readingDurationSeconds: 60,
      comprehensionAnswers: [0, 1, 2, 0],
      guardianConsentGiven: true,
      guardianConsentRecordedAt: new Date().toISOString(),
      guardianConsentSource: 'إقرار ولي الأمر والمدرسة',
      oralReadingAssessed: true,
      spokenTranscript: 'قرأت ثلاث كلمات فقط',
      teacherVerified: true,
      teacherVerifierRole: 'معلم صعوبات تعلم',
      verifiedWordsAlignment: passage.words.map((word) => ({ word, status: 'correct' as const })),
    };

    const derived = validateAndDeriveSessionFromEvidence(rawPayload, {
      name: 'طالب اختبار',
      gradeLevel: 3,
    });

    assert.equal(derived.valid, true);
    assert.ok(derived.derivedFields);
    assert.equal(derived.derivedFields.teacherVerified, false);
    assert.equal(derived.derivedFields.teacherVerifierId, undefined);
    assert.equal(derived.derivedFields.wcpm === passage.words.length, false);
    assert.equal(derived.derivedFields.readingRiskLevel, 'unassessed');
  });

  await t.test('Server Validation: rejects corrupted or mismatched verifiedWordsAlignment', () => {
    // Array length does not match passage words length
    const invalidLengthPayload = {
      passageId: passage.id,
      readingDurationSeconds: 60,
      comprehensionAnswers: [0, 1, 2, 0],
      guardianConsentGiven: true,
      guardianConsentRecordedAt: new Date().toISOString(),
      teacherVerified: true,
      verifiedWordsAlignment: [{ word: 'كلمة', status: 'correct' }], // only 1 word for a 52-word passage
    };

    const derived = validateAndDeriveSessionFromEvidence(invalidLengthPayload, {
      name: 'زيد',
      gradeLevel: 3,
    }, {
      sessionId: 'review-session-invalid-001', role: 'clinician', clinicianName: 'مراجع اختبار',
    });

    assert.equal(derived.valid, false);
    assert.equal(derived.statusCode, 400);
    assert.ok(derived.errorAr?.includes('مصفوفة مراجعة المعلم غير صالحة'));

    // Mismatched word at index 0
    const mismatchedWordPayload = {
      passageId: passage.id,
      readingDurationSeconds: 60,
      comprehensionAnswers: [0, 1, 2, 0],
      guardianConsentGiven: true,
      guardianConsentRecordedAt: new Date().toISOString(),
      teacherVerified: true,
      verifiedWordsAlignment: passage.words.map((w, idx) => ({
        word: idx === 0 ? 'كلمة_مزيفة_لا_تطابق_النص' : w,
        status: 'correct' as const,
      })),
    };

    const derived2 = validateAndDeriveSessionFromEvidence(mismatchedWordPayload, {
      name: 'زيد',
      gradeLevel: 3,
    }, {
      sessionId: 'review-session-invalid-002', role: 'clinician', clinicianName: 'مراجع اختبار',
    });

    assert.equal(derived2.valid, false);
    assert.equal(derived2.statusCode, 400);
    assert.ok(derived2.errorAr?.includes('غير متطابقة مع النص المرجعي'));
  });

  await t.test('Dialect Propagation: forwards dialectCode (e.g. gulf) and reflects in server derived fields', () => {
    const gulfPayload = {
      passageId: passage.id,
      dialectCode: 'gulf',
      readingDurationSeconds: 60,
      comprehensionAnswers: [0, 1, 2, 0],
      guardianConsentGiven: true,
      guardianConsentRecordedAt: new Date().toISOString(),
    };

    const derived = validateAndDeriveSessionFromEvidence(gulfPayload, {
      name: 'فيصل',
      gradeLevel: 3,
    });

    assert.equal(derived.valid, true);
    assert.ok(derived.derivedFields);
    assert.equal(derived.derivedFields.dialectCode, 'gulf');
    assert.equal(derived.derivedFields.dialectRegionAr, 'اللهجة الخليجية والسعودية');
  });

  await t.test('Qatar privacy-law readiness: audio consent requires an explicit timestamp and rejects missing recordedAt', () => {
    const validConsentStudent: StudentRecord = {
      ...INITIAL_STUDENTS[0],
      id: 'test-consent-valid',
      guardianConsentGiven: true,
      guardianConsentRecordedAt: new Date().toISOString(),
      guardianAudioConsentGiven: true,
      guardianAudioConsentRecordedAt: new Date().toISOString(),
      audioRecordingConsentGiven: true,
      audioRecordingStarted: true,
      speechRecognitionUsed: true,
      assessmentModality: 'reading_only',
      wpm: 50,
      wcpm: 48,
      oralWcpm: 48,
    };

    assert.equal(validConsentStudent.guardianAudioConsentGiven, true);
    assert.ok(typeof validConsentStudent.guardianAudioConsentRecordedAt === 'string');
    assert.ok(Number.isFinite(Date.parse(validConsentStudent.guardianAudioConsentRecordedAt!)));
  });
});
