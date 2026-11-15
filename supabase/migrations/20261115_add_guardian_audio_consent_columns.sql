-- ==============================================================================
-- Migration: 20261115_add_guardian_audio_consent_columns.sql
-- Description: Adds independent guardian audio consent and backfills legacy values.
-- ==============================================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS guardian_audio_consent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS guardian_audio_consent_recorded_at TEXT;

-- Backfill BEFORE the application starts treating the new columns as authoritative.
-- Existing rows receive FALSE from the column default, so explicitly restore any
-- legacy consent captured in raw_data. Unknown/missing legacy values remain FALSE.
UPDATE public.students
SET
  guardian_audio_consent = CASE
    WHEN lower(COALESCE(raw_data->>'guardianAudioConsentGiven', raw_data->>'guardian_audio_consent', '')) IN ('true', '1', 'yes')
      THEN TRUE
    WHEN lower(COALESCE(raw_data->>'guardianAudioConsentGiven', raw_data->>'guardian_audio_consent', '')) IN ('false', '0', 'no')
      THEN FALSE
    ELSE COALESCE(guardian_audio_consent, FALSE)
  END,
  guardian_audio_consent_recorded_at = COALESCE(
    NULLIF(raw_data->>'guardianAudioConsentRecordedAt', ''),
    NULLIF(raw_data->>'guardian_audio_consent_recorded_at', ''),
    guardian_audio_consent_recorded_at
  )
WHERE raw_data IS NOT NULL;

-- Keep timestamps only for affirmative consent; a recorded withdrawal must not
-- accidentally look like an active consent grant.
UPDATE public.students
SET guardian_audio_consent_recorded_at = NULL
WHERE guardian_audio_consent IS NOT TRUE;

CREATE OR REPLACE FUNCTION public.student_assessment_evidence(raw jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(jsonb_object_agg(item.key, item.value), '{}'::jsonb)
  FROM jsonb_each(COALESCE(raw, '{}'::jsonb)) AS item(key, value)
  WHERE item.key = ANY (ARRAY[
    'cognitiveBattery','assessmentHistory','screeningHistory','cognitiveResults',
    'sessionStatus','sessionCompletedAt','lastScreenedDate','evidenceProvenance',
    'evidenceProvenanceLabelAr','assessmentModality','passageId','readingDurationSeconds',
    'wpm','wcpm','oralWcpm','oralAccuracyPercent','oralWerPercent','oralReadingAssessed',
    'speechRecognitionUsed','audioRecordingStarted','audioRecordingConsentGiven',
    'teacherVerified','teacherVerifierRole','teacherVerificationTimestamp','teacherVerifierId',
    'teacherVerifierName','teacherWordOverridesCount','verifiedWordsAlignment',
    'aiAssessmentVerified','aiAssessmentSource','aiAssessmentReceipt','phoneticSubstitutionCount',
    'dialectVariantCount','omissionCount','spokenTranscript','problematicWords',
    'dyslexiaRiskScore','readingHeuristicIndicator','readingRiskLevel','readingRiskLabelAr',
    'comprehensionScore','comprehensionAnswers','learningReport','dyscalculiaAssessed',
    'subitizingAccuracy','avgSubitizingMs','numberLinePAE','transcodingAccuracy',
    'reversalErrorCount','dyscalculiaRiskScore','mathHeuristicIndicator','mathRiskLevel',
    'mathRiskLabelAr','mathTrials'
  ]::text[]);
$$;
