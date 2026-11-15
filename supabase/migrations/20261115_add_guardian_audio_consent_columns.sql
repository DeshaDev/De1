-- ==============================================================================
-- Migration: 20261115_add_guardian_audio_consent_columns.sql
-- Description: Adds independent guardian audio consent columns to public.students
--              and ensures compatibility with existing production databases.
-- ==============================================================================

-- 1. Safely add columns to public.students if they don't already exist
ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS guardian_audio_consent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS guardian_audio_consent_recorded_at TEXT;

-- 2. Update student_assessment_evidence function to ensure independent guardian consent
-- declarations are not classified as server-generated assessment evidence.
CREATE OR REPLACE FUNCTION public.student_assessment_evidence(raw jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(jsonb_object_agg(item.key, item.value), '{}'::jsonb)
  FROM jsonb_each(COALESCE(raw, '{}'::jsonb)) AS item(key, value)
  WHERE item.key = ANY (ARRAY[
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
    'mathTrials'
  ]::text[]);
$$;
