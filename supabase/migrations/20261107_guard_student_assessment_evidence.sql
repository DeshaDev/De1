-- Prevent authenticated browser clients from writing assessment evidence directly
-- into students.raw_data. Verified assessment endpoints use the server-only service_role
-- key only after checking identity, tenant/parent ownership, consent and one-time receipt.
--
-- Apply this migration in the Supabase SQL Editor or through your migration runner.

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
    'mathTrials',
    'guardianAudioConsentGiven',
    'guardianAudioConsentRecordedAt'
  ]::text[]);
$$;

CREATE OR REPLACE FUNCTION public.guard_student_assessment_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
  proposed_evidence jsonb;
BEGIN
  -- The backend uses the server-only service_role key only after it has independently
  -- checked the Supabase owner, stored guardian consent, signed session and audio receipt.
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  proposed_evidence := public.student_assessment_evidence(NEW.raw_data);

  IF TG_OP = 'INSERT' THEN
    IF proposed_evidence <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Assessment evidence must be written by the verified assessment server'
        USING ERRCODE = '42501';
    END IF;
  ELSIF proposed_evidence IS DISTINCT FROM public.student_assessment_evidence(OLD.raw_data) THEN
    RAISE EXCEPTION 'Assessment evidence is server-controlled and cannot be edited directly'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_guard_assessment_evidence ON public.students;
CREATE TRIGGER students_guard_assessment_evidence
BEFORE INSERT OR UPDATE OF raw_data
ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.guard_student_assessment_evidence();

COMMENT ON FUNCTION public.student_assessment_evidence(jsonb) IS
  'Extracts server-controlled assessment evidence fields from a student raw_data record.';
COMMENT ON FUNCTION public.guard_student_assessment_evidence() IS
  'Rejects direct authenticated writes to assessment evidence; verified backend writes use service_role.';
