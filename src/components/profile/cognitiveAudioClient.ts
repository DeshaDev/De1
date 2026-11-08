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

export type CognitiveAudioTaskId = Extract<SubtestId, 'oralReading' | 'ranObjects' | 'ranLetters' | 'wordReading' | 'nonwordReading'>;
export type ReadingListTaskId = Extract<CognitiveAudioTaskId, 'wordReading' | 'nonwordReading'>;

export interface CognitiveAudioWordReceipt {
  itemId: string;
  itemIndex: number;
  assessmentReceipt: string;
  transcript: string;
  durationSeconds: number;
  word: {
    word: string;
    errorType: 'None' | 'Omission' | 'Mispronunciation' | 'Substitution' | 'DialectVariant';
    accuracyScore: number;
    spokenWord: string | null;
  };
}

function assertAudioSession(session: CognitiveAudioSessionContext): void {
  if (
    session.guardianConsentGiven !== true ||
    session.guardianAudioConsentGiven !== true ||
    !session.guardianConsentRecordedAt ||
    !session.guardianAudioConsentRecordedAt
  ) {
    throw new Error('AUDIO_CONSENT_REQUIRED');
  }
  if (!session.speechLocale) throw new Error('UNSUPPORTED_SPEECH_DIALECT');
}

async function readError(response: Response): Promise<never> {
  const payload = await response.json().catch(() => null) as
    | { error?: string; code?: string }
    | null;
  throw new Error(payload?.code || payload?.error || `AUDIO_ASSESSMENT_HTTP_${response.status}`);
}

/** Existing whole-recording path retained for passage reading and rapid naming tasks. */
export async function assessCognitiveAudio(args: {
  taskId: CognitiveAudioTaskId;
  session: CognitiveAudioSessionContext;
  recording: RecordedWavAudio;
}): Promise<CognitiveAudioAssessmentEvidence> {
  const { taskId, session, recording } = args;
  assertAudioSession(session);

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

  if (!response.ok) await readError(response);
  const payload = await response.json().catch(() => null) as
    | { assessment?: CognitiveAudioAssessmentEvidence }
    | null;
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

/** Submit one short recording against one server-selected reference item. */
export async function assessCognitiveAudioWord(args: {
  taskId: ReadingListTaskId;
  itemId: string;
  itemIndex: number;
  attemptId: string;
  session: CognitiveAudioSessionContext;
  recording: RecordedWavAudio;
}): Promise<CognitiveAudioWordReceipt> {
  const { taskId, itemId, itemIndex, attemptId, session, recording } = args;
  assertAudioSession(session);
  if (!/^[a-f0-9]{32}$/i.test(attemptId)) throw new Error('INVALID_AUDIO_ATTEMPT');

  const response = await authenticatedFetch('/api/ai/cognitive-audio-assessment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      itemId,
      itemIndex,
      attemptId,
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
  if (!response.ok) await readError(response);

  const payload = await response.json().catch(() => null) as
    | { wordAssessment?: CognitiveAudioWordReceipt; error?: string; code?: string }
    | null;
  const wordAssessment = payload?.wordAssessment;
  if (
    !wordAssessment ||
    wordAssessment.itemId !== itemId ||
    wordAssessment.itemIndex !== itemIndex ||
    !/^[a-f0-9]{64}$/.test(wordAssessment.assessmentReceipt) ||
    !wordAssessment.word ||
    !['None', 'Omission', 'Mispronunciation', 'Substitution', 'DialectVariant'].includes(wordAssessment.word.errorType) ||
    !Number.isFinite(wordAssessment.word.accuracyScore) ||
    wordAssessment.word.accuracyScore < 0 ||
    wordAssessment.word.accuracyScore > 100
  ) {
    throw new Error('INVALID_VERIFIED_WORD_ASSESSMENT');
  }
  return wordAssessment;
}

/** Finalize only when the server has one valid receipt for every canonical item in sequence. */
export async function finalizeCognitiveAudioWordList(args: {
  taskId: ReadingListTaskId;
  attemptId: string;
  session: CognitiveAudioSessionContext;
  receipts: CognitiveAudioWordReceipt[];
}): Promise<CognitiveAudioAssessmentEvidence> {
  const { taskId, attemptId, session, receipts } = args;
  assertAudioSession(session);
  if (!/^[a-f0-9]{32}$/i.test(attemptId)) throw new Error('INVALID_AUDIO_ATTEMPT');

  const response = await authenticatedFetch('/api/ai/cognitive-audio-assessment/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      studentId: session.studentId,
      attemptId,
      wordReceipts: receipts.map(({ itemId, assessmentReceipt }) => ({ itemId, assessmentReceipt })),
    }),
  });
  if (!response.ok) await readError(response);

  const payload = await response.json().catch(() => null) as
    | { assessment?: CognitiveAudioAssessmentEvidence }
    | null;
  const assessment = payload?.assessment;
  if (
    !assessment ||
    assessment.taskId !== taskId ||
    assessment.sourceModel !== 'azure_pronunciation_assessment' ||
    assessment.assessmentComplete !== true ||
    !/^[a-f0-9]{64}$/.test(assessment.assessmentReceipt) ||
    !Array.isArray(assessment.words) ||
    assessment.words.length !== receipts.length ||
    assessment.words.some((word) => word.errorType === 'Unconfirmed' || word.errorType === 'Insertion')
  ) {
    throw new Error('INVALID_VERIFIED_AUDIO_RESPONSE');
  }
  return assessment;
}
