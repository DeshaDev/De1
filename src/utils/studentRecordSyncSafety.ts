import type { StudentRecord } from '../data/seedData';

export interface ExistingSupabaseStudentForSync {
  raw_data?: Partial<StudentRecord> | null;
  guardian_consent?: boolean | null;
  guardian_consent_recorded_at?: string | null;
  guardian_audio_consent?: boolean | null;
  guardian_audio_consent_recorded_at?: string | null;
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
  'oralWerPercent',
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
  'aiAssessmentSource',
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
] as const satisfies readonly (keyof StudentRecord)[];

/**
 * Generic profile synchronization is not an assessment write API.
 * New/local records are stripped of client-submitted scores and receipts;
 * existing records retain their server-persisted assessment evidence verbatim.
 *
 * Guardian general consent and independent audio consent are legal declarations:
 * - On new registrations: both valid consents (with timestamps) are preserved for Supabase persistence.
 * - On existing records: database consent state is authoritative and cannot be silently recreated,
 *   while explicit withdrawals take effect immediately. Audio consent cannot remain active if general
 *   consent is withdrawn.
 */
export function prepareStudentRecordForGenericSupabaseSync(
  incoming: StudentRecord,
  existing?: ExistingSupabaseStudentForSync | null
): StudentRecord {
  const safe = { ...incoming } as StudentRecord & Record<string, unknown>;
  const raw = existing?.raw_data as (Partial<StudentRecord> & Record<string, unknown>) | null | undefined;

  for (const field of SERVER_CONTROLLED_FIELDS) {
    if (raw && Object.prototype.hasOwnProperty.call(raw, field)) {
      (safe as Record<string, unknown>)[field] = (raw as Record<string, unknown>)[field];
    } else {
      delete (safe as Record<string, unknown>)[field];
    }
  }

  // Transfer scores are server-derived from one-use Azure receipts. Generic profile
  // sync may update ordinary training progress, but it must not create or replace that evidence.
  const rawTraining = raw?.trainingProgress as (Partial<NonNullable<StudentRecord['trainingProgress']>> & Record<string, unknown>) | undefined;
  if (rawTraining) {
    const incomingTraining = safe.trainingProgress as (NonNullable<StudentRecord['trainingProgress']> & Record<string, unknown>) | undefined;
    const mergedTraining = { ...(incomingTraining ?? rawTraining) } as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(rawTraining, 'transfer')) {
      mergedTraining.transfer = rawTraining.transfer;
    } else {
      delete mergedTraining.transfer;
    }
    safe.trainingProgress = mergedTraining as unknown as StudentRecord['trainingProgress'];
  } else if (safe.trainingProgress) {
    const incomingTraining = { ...safe.trainingProgress } as Record<string, unknown>;
    delete incomingTraining.transfer;
    safe.trainingProgress = incomingTraining as unknown as StudentRecord['trainingProgress'];
  }



  if (existing) {
    // Database consent columns are authoritative once a row exists.
    // A parent may withdraw consent, but a stale browser snapshot must never turn a database revocation back into consent.
    const consentRemainsActive =
      existing.guardian_consent === true && incoming.guardianConsentGiven !== false;
    safe.guardianConsentGiven = consentRemainsActive;
    safe.guardianConsentRecordedAt = consentRemainsActive
      ? existing.guardian_consent_recorded_at || raw?.guardianConsentRecordedAt || undefined
      : undefined;

    if (consentRemainsActive && raw && Object.prototype.hasOwnProperty.call(raw, 'guardianConsentSource')) {
      safe.guardianConsentSource = raw.guardianConsentSource;
    } else {
      delete safe.guardianConsentSource;
    }

    if (!consentRemainsActive) {
      safe.guardianAudioConsentGiven = false;
      delete (safe as Record<string, unknown>).guardianAudioConsentRecordedAt;
    } else {
      // General consent is active. Manage independent audio consent:
      if (incoming.guardianAudioConsentGiven === false) {
        // Explicit withdrawal
        safe.guardianAudioConsentGiven = false;
        delete (safe as Record<string, unknown>).guardianAudioConsentRecordedAt;
      } else if (existing.guardian_audio_consent === true || raw?.guardianAudioConsentGiven === true) {
        // Preserved from database
        safe.guardianAudioConsentGiven = true;
        safe.guardianAudioConsentRecordedAt =
          existing.guardian_audio_consent_recorded_at ||
          raw?.guardianAudioConsentRecordedAt ||
          incoming.guardianAudioConsentRecordedAt ||
          undefined;
      } else if (incoming.guardianAudioConsentGiven === true && incoming.guardianAudioConsentRecordedAt) {
        // Newly granted on existing profile with explicit timestamp
        safe.guardianAudioConsentGiven = true;
        safe.guardianAudioConsentRecordedAt = incoming.guardianAudioConsentRecordedAt;
      } else {
        safe.guardianAudioConsentGiven = false;
        delete (safe as Record<string, unknown>).guardianAudioConsentRecordedAt;
      }
    }
  } else {
    // New child registration: preserve parent's explicit consent declarations
    if (incoming.guardianConsentGiven === true && incoming.guardianConsentRecordedAt) {
      safe.guardianConsentGiven = true;
      safe.guardianConsentRecordedAt = incoming.guardianConsentRecordedAt;
      if (incoming.guardianAudioConsentGiven === true && incoming.guardianAudioConsentRecordedAt) {
        safe.guardianAudioConsentGiven = true;
        safe.guardianAudioConsentRecordedAt = incoming.guardianAudioConsentRecordedAt;
      } else {
        safe.guardianAudioConsentGiven = false;
        delete (safe as Record<string, unknown>).guardianAudioConsentRecordedAt;
      }
    } else {
      safe.guardianConsentGiven = false;
      delete (safe as Record<string, unknown>).guardianConsentRecordedAt;
      safe.guardianAudioConsentGiven = false;
      delete (safe as Record<string, unknown>).guardianAudioConsentRecordedAt;
    }
  }

  return safe;
}
