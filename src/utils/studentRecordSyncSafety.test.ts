import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { StudentRecord } from '../data/seedData';
import { prepareStudentRecordForGenericSupabaseSync } from './studentRecordSyncSafety';

const consentAt = '2026-11-07T10:00:00.000Z';

function student(overrides: Partial<StudentRecord> = {}): StudentRecord {
  return {
    id: 'child-1',
    name: 'طفل تجريبي',
    gradeLevel: 1,
    ageYears: 6,
    schoolName: 'مدرسة الاختبار',
    lastScreenedDate: '—',
    passageId: 'passage-1',
    guardianConsentGiven: true,
    guardianConsentRecordedAt: consentAt,
    guardianConsentSource: 'إقرار ولي الأمر',
    wpm: 0,
    dyslexiaRiskScore: null,
    readingHeuristicIndicator: null,
    readingRiskLevel: 'unassessed',
    readingRiskLabelAr: 'لم يُقيّم',
    problematicWords: [],
    comprehensionScore: 0,
    subitizingAccuracy: null,
    avgSubitizingMs: null,
    numberLinePAE: null,
    transcodingAccuracy: null,
    reversalErrorCount: null,
    dyscalculiaRiskScore: null,
    mathHeuristicIndicator: null,
    mathRiskLevel: 'unassessed',
    mathRiskLabelAr: 'لم يُقيّم',
    ...overrides,
  } as StudentRecord;
}

describe('generic Supabase student sync safety', () => {
  it('strips browser-created assessment scores and receipts for a new/local record', () => {
    const incoming = student({
      cognitiveBattery: { results: {} } as StudentRecord['cognitiveBattery'],
      oralReadingAssessed: true,
      oralWcpm: 88,
      wcpm: 92,
      aiAssessmentVerified: true,
      aiAssessmentSource: 'azure_pronunciation_assessment',
      aiAssessmentReceipt: 'a'.repeat(64),
      verifiedWordsAlignment: [{ word: 'باب', status: 'correct' }],
      guardianAudioConsentGiven: true,
      guardianAudioConsentRecordedAt: consentAt,
      dyslexiaRiskScore: 12,
      readingRiskLevel: 'high',
    });

    const safe = prepareStudentRecordForGenericSupabaseSync(incoming);

    assert.equal(safe.name, 'طفل تجريبي');
    assert.equal(safe.guardianConsentGiven, true);
    assert.equal(safe.guardianConsentRecordedAt, consentAt);
    assert.equal(safe.cognitiveBattery, undefined);
    assert.equal(safe.oralReadingAssessed, undefined);
    assert.equal(safe.oralWcpm, undefined);
    assert.equal(safe.wcpm, undefined);
    assert.equal(safe.aiAssessmentVerified, undefined);
    assert.equal(safe.aiAssessmentSource, undefined);
    assert.equal(safe.aiAssessmentReceipt, undefined);
    assert.equal(safe.verifiedWordsAlignment, undefined);
    assert.equal(safe.guardianAudioConsentGiven, undefined);
    assert.equal(safe.guardianAudioConsentRecordedAt, undefined);
    assert.equal(safe.dyslexiaRiskScore, undefined);
    assert.equal(safe.readingRiskLevel, undefined);
  });

  it('preserves existing server evidence while allowing an ordinary profile update', () => {
    const storedBattery = { results: { oralReading: { server: true } } } as unknown as NonNullable<StudentRecord['cognitiveBattery']>;
    const existingRecord = student({
      name: 'الاسم المحفوظ',
      cognitiveBattery: storedBattery,
      oralReadingAssessed: true,
      oralWcpm: 51,
      wcpm: 51,
      aiAssessmentVerified: true,
      aiAssessmentSource: 'azure_pronunciation_assessment',
      aiAssessmentReceipt: 'b'.repeat(64),
      guardianAudioConsentGiven: true,
      guardianAudioConsentRecordedAt: consentAt,
      guardianConsentGiven: true,
      guardianConsentRecordedAt: consentAt,
    });
    const incoming = student({
      name: 'اسم جديد',
      cognitiveBattery: { results: { forged: true } } as unknown as StudentRecord['cognitiveBattery'],
      oralReadingAssessed: true,
      oralWcpm: 999,
      wcpm: 999,
      aiAssessmentVerified: false,
      aiAssessmentReceipt: 'c'.repeat(64),
      guardianConsentGiven: false,
      guardianConsentRecordedAt: '1999-01-01T00:00:00.000Z',
      guardianAudioConsentGiven: false,
      guardianAudioConsentRecordedAt: undefined,
    });

    const safe = prepareStudentRecordForGenericSupabaseSync(incoming, {
      raw_data: existingRecord,
      guardian_consent: true,
      guardian_consent_recorded_at: consentAt,
    });

    assert.equal(safe.name, 'اسم جديد');
    assert.deepEqual(safe.cognitiveBattery, storedBattery);
    assert.equal(safe.oralReadingAssessed, true);
    assert.equal(safe.oralWcpm, 51);
    assert.equal(safe.wcpm, 51);
    assert.equal(safe.aiAssessmentVerified, true);
    assert.equal(safe.aiAssessmentSource, 'azure_pronunciation_assessment');
    assert.equal(safe.aiAssessmentReceipt, 'b'.repeat(64));
    assert.equal(safe.guardianAudioConsentGiven, true);
    assert.equal(safe.guardianAudioConsentRecordedAt, consentAt);
    assert.equal(safe.guardianConsentGiven, true);
    assert.equal(safe.guardianConsentRecordedAt, consentAt);
  });

  it('does not recreate revoked guardian consent from a stale browser record', () => {
    const incoming = student({
      guardianConsentGiven: true,
      guardianConsentRecordedAt: consentAt,
      guardianConsentSource: 'old browser value',
      guardianAudioConsentGiven: true,
      guardianAudioConsentRecordedAt: consentAt,
    });
    const safe = prepareStudentRecordForGenericSupabaseSync(incoming, {
      raw_data: student({
        guardianConsentGiven: false,
        guardianAudioConsentGiven: true,
        guardianAudioConsentRecordedAt: consentAt,
      }),
      guardian_consent: false,
      guardian_consent_recorded_at: null,
    });

    assert.equal(safe.guardianConsentGiven, false);
    assert.equal(safe.guardianConsentRecordedAt, undefined);
    assert.equal(safe.guardianConsentSource, undefined);
    assert.equal(safe.guardianAudioConsentGiven, false);
    assert.equal(safe.guardianAudioConsentRecordedAt, undefined);
  });

  it('allows an explicit consent withdrawal without accepting stale timestamps', () => {
    const incoming = student({
      guardianConsentGiven: false,
      guardianConsentRecordedAt: undefined,
      guardianAudioConsentGiven: true,
      guardianAudioConsentRecordedAt: consentAt,
    });
    const safe = prepareStudentRecordForGenericSupabaseSync(incoming, {
      raw_data: student({
        guardianConsentGiven: true,
        guardianConsentRecordedAt: consentAt,
        guardianAudioConsentGiven: true,
        guardianAudioConsentRecordedAt: consentAt,
      }),
      guardian_consent: true,
      guardian_consent_recorded_at: consentAt,
    });

    assert.equal(safe.guardianConsentGiven, false);
    assert.equal(safe.guardianConsentRecordedAt, undefined);
    assert.equal(safe.guardianAudioConsentGiven, false);
    assert.equal(safe.guardianAudioConsentRecordedAt, undefined);
  });
});
