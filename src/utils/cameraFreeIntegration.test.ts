import test from 'node:test';
import assert from 'node:assert/strict';
import { ARABIC_READING_PASSAGES } from '../data/seedData';
import {
  validateAndDeriveSessionFromEvidence,
  buildDeterministicLearningReport,
} from './studentDataSecurity';

test('Camera-Free Reading-Only Modality Integration', async (t) => {
  const passage = ARABIC_READING_PASSAGES[0]; // Grade 2, 52 words

  await t.test('accepts reading_only session without eye calibration or fixations', () => {
    const rawPayload = {
      passageId: passage.id,
      assessmentModality: 'reading_only',
      readingDurationSeconds: 45,
      comprehensionAnswers: [0, 1, 2, 0],
      dialectRegionAr: 'الفصحى المعيارية / الخليجية',
      guardianConsentGiven: true,
      guardianConsentRecordedAt: new Date().toISOString(),
      guardianConsentSource: 'إقرار ولي الأمر والمدرسة',
    };

    const derived = validateAndDeriveSessionFromEvidence(rawPayload, {
      name: 'أحمد محمود السالم',
      gradeLevel: 2,
    });

    assert.equal(derived.valid, true);
    assert.ok(derived.derivedFields);
    assert.equal(derived.derivedFields.assessmentModality, 'reading_only');
    assert.equal(derived.derivedFields.passageId, passage.id);
    assert.equal(derived.derivedFields.readingDurationSeconds, 45);
    // 52 words in 45 sec = ~69 WPM
    assert.equal(derived.derivedFields.wpm, Math.round((passage.words.length / 45) * 60));
    assert.equal('calibrationAccuracyPercent' in derived.derivedFields, false);
    assert.equal('fixations' in derived.derivedFields, false);
    assert.equal(typeof derived.derivedFields.comprehensionScore, 'number');
    assert.equal(derived.derivedFields.dyslexiaRiskScore, null);
    assert.equal(derived.derivedFields.readingHeuristicIndicator, null);
    assert.equal(derived.derivedFields.readingRiskLevel, 'unassessed');
    assert.ok(derived.derivedFields.learningReport);
    assert.match(
      derived.derivedFields.learningReport.ocularMotorAnalysis,
      /لا تستخدم بصيرة الحالية الكاميرا أو تتبّع العين/
    );
  });

  await t.test('rejects implausible reading pace (>300 WPM) in reading_only modality', () => {
    const rawPayload = {
      passageId: passage.id,
      assessmentModality: 'reading_only',
      readingDurationSeconds: 5, // 52 words in 5 sec = 624 WPM -> implausible!
      comprehensionAnswers: [0, 1, 2, 0],
    };

    const derived = validateAndDeriveSessionFromEvidence(rawPayload, {
      name: 'سارة خالد',
      gradeLevel: 3,
    });

    assert.equal(derived.valid, false);
    assert.equal(derived.statusCode, 400);
    assert.match(derived.errorAr || '', /حد المعقولية التقني/);
  });

  await t.test('buildDeterministicLearningReport generates camera-free disclosures', () => {
    const report = buildDeterministicLearningReport({
      studentName: 'فيصل العتيبي',
      gradeLevel: 4,
      dialectLabelAr: 'الخليجية',
      totalPassageWordCount: 57,
      wpm: 75,
      problematicWords: [],
      oralReadingAssessed: false,
      oralAccuracyPercent: null,
      phoneticSubstitutionCount: 0,
      dialectVariantCount: 0,
      assessmentModality: 'reading_only',
      dyscalculiaAssessed: false,
      numberLinePAE: null,
      subitizingAccuracy: null,
      reversalErrorCount: null,
    });

    assert.ok(report.learningSummary.includes('جلسة قراءة وفهم تعليمية'));
    assert.ok(report.ocularMotorAnalysis.includes('لا تستخدم بصيرة الحالية الكاميرا أو تتبّع العين'));
    assert.ok(report.interventionExercises.length > 0);
  });
});
