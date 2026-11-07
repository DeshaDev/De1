import type { StudentRecord } from '../data/seedData';

export interface ExistingSupabaseStudentForSync {
  raw_data?: Partial<StudentRecord> | null;
  guardian_consent?: boolean | null;
  guardian_consent_recorded_at?: string | null;
}

// These fields are written only by authenticated server-side assessment routes.
// Generic profile sync must never create or replace them from a browser object.
const SERVER_CONTROLLED_FIELDS = [
  'cognitiveBattery',
  'assessmentHistory',
  'screeningHistory',
  'cognitiveResults',
  'sessionStatus',
  'sessionCompletedAt',
  'lastScreenedDate',
  'evidenceProvenance',
  'evidenceProvenanceLabelAr',
  'assessmentModality',
  'passageId',
  'readingDurationSeconds',
  'wpm',
  'wcpm',
  'oralWcpm',
  'oralAccuracyPercent',
  'oralReadingAssessed',
  'speechRecognitionUsed',
  'audioRecordingStarted',
  'audioRecordingConsentGiven',
  'teacherVerified',
  'teacherVerifierRole',
  'teacherVerificationTimestamp',
  'teacherVerifierId',
  'teacherVerifierName',
  'teacherWordOverridesCount',
  'verifiedWordsAlignment',
  'aiAssessmentVerified',
  'aiAssessmentReceipt',
  'phoneticSubstitutionCount',
  'dialectVariantCount',
  'omissionCount',
  'spokenTranscript',
  'problematicWords',
  'dyslexiaRiskScore',
  'readingHeuristicIndicator',
  'readingRiskLevel',
  'readingRiskLabelAr',
  'comprehensionScore',
  'comprehensionAnswers',
  'learningReport',
  'dyscalculiaAssessed',
  'subitizingAccuracy',
  'avgSubitizingMs',
  'numberLinePAE',
  'transcodingAccuracy',
  'reversalErrorCount',
  'dyscalculiaRiskScore',
  'mathHeuristicIndicator',
  'mathRiskLevel',
  'mathRiskLabelAr',
  'mathTrials',
  'guardianAudioConsentGiven',
  'guardianAudioConsentRecordedAt',
] as const satisfies readonly (keyof StudentRecord)[];

/**
 * Generic profile synchronization is not an assessment write API.
 * New/local records are stripped of client-submitted scores and receipts;
 * existing records retain their server-persisted assessment evidence verbatim.
 */
export function prepareStudentRecordForGenericSupabaseSync(
  incoming: StudentRecord,
  existing?: ExistingSupabaseStudentForSync | null
): StudentRecord {
  const safe = { ...incoming } as StudentRecord & Record<string, unknown>;
  const raw = existing?.raw_data as (Partial<StudentRecord> & Record<string, unknown>) | null | undefined;

  for (const field of SERVER_CONTROLLED_FIELDS) {
    if (raw && Object.prototype.hasOwnProperty.call(raw, field)) {
      safe[field] = raw[field];
    } else {
      delete safe[field];
    }
  }

  // The database consent columns are authoritative once a row exists. A generic
  // upsert cannot change or recreate a prior consent by altering raw_data.
  if (existing) {
    safe.guardianConsentGiven = existing.guardian_consent === true;
    safe.guardianConsentRecordedAt =
      existing.guardian_consent_recorded_at || raw?.guardianConsentRecordedAt || undefined;
    if (raw && Object.prototype.hasOwnProperty.call(raw, 'guardianConsentSource')) {
      safe.guardianConsentSource = raw.guardianConsentSource;
    } else {
      delete safe.guardianConsentSource;
    }
  }

  return safe;
}
