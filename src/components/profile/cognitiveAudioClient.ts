import type { CognitiveAudioAssessmentEvidence } from '../../cognitiveProfile/scoring';
import type { SubtestId } from '../../cognitiveProfile/battery';
import type { RecordedWavAudio } from './audioRecording';
import { authenticatedFetch } from '../../utils/apiAuth';

export interface CognitiveAudioSessionContext {
  studentId: string;
  guardianConsentGiven?: boolean;
  guardianAudioConsentGiven?: boolean;
  guardianConsentRecordedAt?: string;
  guardianAudioConsentRecordedAt?: string;
  speechLocale?: 'ar-EG' | 'ar-SA';
}

export type CognitiveAudioTaskId = Extract<SubtestId, 'oralReading' | 'ranObjects' | 'ranLetters'>;

export async function assessCognitiveAudio(args: {
  taskId: CognitiveAudioTaskId;
  session: CognitiveAudioSessionContext;
  recording: RecordedWavAudio;
}): Promise<CognitiveAudioAssessmentEvidence> {
  const { taskId, session, recording } = args;
  if (
    session.guardianConsentGiven !== true ||
    session.guardianAudioConsentGiven !== true ||
    !session.guardianConsentRecordedAt ||
    !session.guardianAudioConsentRecordedAt
  ) {
    throw new Error('AUDIO_CONSENT_REQUIRED');
  }
  if (!session.speechLocale) throw new Error('UNSUPPORTED_SPEECH_DIALECT');

  const response = await authenticatedFetch('/api/ai/cognitive-audio-assessment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      studentId: session.studentId,
      audioWavBase64: recording.audioWavBase64,
      durationSeconds: recording.durationSeconds,
      language: session.speechLocale,
      guardianConsentGiven: session.guardianConsentGiven,
      guardianAudioConsentGiven: session.guardianAudioConsentGiven,
      guardianConsentRecordedAt: session.guardianConsentRecordedAt,
      guardianAudioConsentRecordedAt: session.guardianAudioConsentRecordedAt,
    }),
  });

  const payload = await response.json().catch(() => null) as
    | { assessment?: CognitiveAudioAssessmentEvidence; error?: string; code?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.code || payload?.error || `AUDIO_ASSESSMENT_HTTP_${response.status}`);
  }

  const assessment = payload?.assessment;
  if (
    !assessment ||
    assessment.taskId !== taskId ||
    assessment.sourceModel !== 'azure_pronunciation_assessment' ||
    assessment.assessmentComplete !== true ||
    !/^[a-f0-9]{64}$/.test(assessment.assessmentReceipt) ||
    !Array.isArray(assessment.words) ||
    assessment.words.some((word) => word.errorType === 'Unconfirmed' || word.errorType === 'Insertion')
  ) {
    throw new Error('INVALID_VERIFIED_AUDIO_RESPONSE');
  }

  return assessment;
}
