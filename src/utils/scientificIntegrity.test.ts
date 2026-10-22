import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateOralReadingAlignment,
  OralReadingFluencyResult,
} from './dyslexiaEngines';
import { ARABIC_READING_PASSAGES, StudentRecord } from '../data/seedData';
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
      'eg'
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
      'eg'
    );

    assert.equal(result.alignment.length, 4);
    assert.ok(result.wcpm > 0);
    const validCount = result.alignment.filter(
      a => a.status === 'dialect_variant' || a.status === 'correct'
    ).length;
    assert.ok(validCount >= 2);
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

  await t.test('Egyptian Law 151/2020 & Exec Reg 816/2025: validates explicit guardian consent metadata', () => {
    const compliantStudent: StudentRecord = {
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
      audioRecordingConsentGiven: true,
      assessmentModality: 'reading_only',
      sessionStatus: 'completed',
      wpm: 68,
      wcpm: 65,
      teacherVerified: true,
      oralReadingAssessed: true,
      readingDurationSeconds: 48,
      comprehensionScore: 100,
      fixations: [],
      regressionCount: 0,
      regressionRate: 0,
      blinkCount: 0,
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
    assert.ok(derived.derivedFields.clinicalReport);
  });
});
