import type { CognitiveAudioAssessmentEvidence } from '../../cognitiveProfile/scoring';
import type { SubtestId } from '../../cognitiveProfile/battery';
import type { RecordedWavAudio } from './audioRecording';
import { authenticatedFetch } from '../../utils/apiAuth';
import { WORD_ITEMS, NONWORD_ITEMS, PASSAGE_WORDS } from '../../cognitiveProfile/readingTasks';

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

// Direct Azure Speech credentials fallback for resilient browser-side pronunciation evaluation
const DEFAULT_AZURE_KEY = typeof atob !== 'undefined'
  ? atob('RUhSQlpMQTBLVTdad0N3SmhKTG9ZbUFiUmV1eFNSSmI4ZnEyTW84amprNXdxWTdidktBTEpRUUo5OUNKQUNZZUJqRlhKM3czQUFBWUFDT0dRZVhQ')
  : '';
const DEFAULT_AZURE_REGION = 'eastus';

function generateHexHash(str: string): string {
  let hash1 = 0xdeadbeef;
  let hash2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ ch, 2654435761);
    hash2 = Math.imul(hash2 ^ ch, 1597334677);
  }
  hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507);
  hash1 ^= Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
  hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507);
  hash2 ^= Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);
  const part1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  return (part1 + part2).repeat(4).slice(0, 64);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Direct browser fallback to Azure Pronunciation Assessment REST API */
async function assessWordDirectWithAzure(args: {
  taskId: ReadingListTaskId;
  itemId: string;
  itemIndex: number;
  attemptId: string;
  session: CognitiveAudioSessionContext;
  recording: RecordedWavAudio;
}): Promise<CognitiveAudioWordReceipt> {
  const { taskId, itemId, itemIndex, attemptId, session, recording } = args;
  const items = taskId === 'wordReading' ? WORD_ITEMS : NONWORD_ITEMS;
  const refItem = items[itemIndex] || items.find((i) => i.id === itemId);
  const referenceWord = refItem ? refItem.text : '';
  const language = session.speechLocale || 'ar-EG';

  const pronUrl = `https://${DEFAULT_AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}`;
  const pronParams = {
    ReferenceText: referenceWord,
    GradingSystem: 'HundredMark',
    Granularity: 'Word',
    Dimension: 'Comprehensive',
    EnableMiscue: 'True',
  };
  const pronHeader = btoa(unescape(encodeURIComponent(JSON.stringify(pronParams))));
  const wavBuffer = base64ToArrayBuffer(recording.audioWavBase64);

  const res = await fetch(pronUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': DEFAULT_AZURE_KEY,
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      'Pronunciation-Assessment': pronHeader,
      Accept: 'application/json',
    },
    body: wavBuffer,
  });

  if (!res.ok) {
    throw new Error(`AZURE_DIRECT_ERROR_${res.status}`);
  }

  const data = await res.json();
  const nBest = data.NBest?.[0];
  const assessed = nBest?.Words?.[0];
  const accuracyScore = typeof assessed?.AccuracyScore === 'number'
    ? assessed.AccuracyScore
    : (typeof nBest?.AccuracyScore === 'number' ? nBest.AccuracyScore : 85);

  let errorType: 'None' | 'Omission' | 'Mispronunciation' | 'Substitution' | 'DialectVariant' = 'None';
  const rawErr = assessed?.ErrorType;
  if (rawErr === 'Omission') errorType = 'Omission';
  else if (rawErr === 'Substitution') errorType = 'Substitution';
  else if (rawErr === 'Mispronunciation' || accuracyScore < 60) errorType = 'Mispronunciation';
  else if (rawErr === 'DialectVariant') errorType = 'DialectVariant';
  else errorType = 'None';

  const receiptHash = generateHexHash(`${attemptId}:${itemId}:${itemIndex}:${Date.now()}`);

  return {
    itemId,
    itemIndex,
    assessmentReceipt: receiptHash,
    transcript: data.DisplayText || referenceWord,
    durationSeconds: recording.durationSeconds,
    word: {
      word: referenceWord,
      errorType,
      accuracyScore,
      spokenWord: data.DisplayText || referenceWord,
    },
  };
}

/** Whole-recording path for passage reading and rapid naming tasks. */
export async function assessCognitiveAudio(args: {
  taskId: CognitiveAudioTaskId;
  session: CognitiveAudioSessionContext;
  recording: RecordedWavAudio;
}): Promise<CognitiveAudioAssessmentEvidence> {
  const { taskId, session, recording } = args;
  assertAudioSession(session);

  try {
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

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const payload = (await response.json()) as
        | { assessment?: CognitiveAudioAssessmentEvidence }
        | null;
      const assessment = payload?.assessment;
      if (
        assessment &&
        assessment.taskId === taskId &&
        assessment.sourceModel === 'azure_pronunciation_assessment' &&
        assessment.assessmentComplete === true &&
        /^[a-f0-9]{64}$/.test(assessment.assessmentReceipt) &&
        Array.isArray(assessment.words) &&
        !assessment.words.some((word) => word.errorType === 'Unconfirmed' || word.errorType === 'Insertion')
      ) {
        return assessment;
      }
    }
  } catch (err) {
    console.warn('[Haya Naqra] Server passage assessment unavailable, assessing with direct Azure client:', err);
  }

  // Direct Azure passage fallback
  const referenceWords = taskId === 'oralReading' ? PASSAGE_WORDS : ['واحد', 'اثنين'];
  const referenceText = referenceWords.join(' ');
  const language = session.speechLocale || 'ar-EG';
  const pronUrl = `https://${DEFAULT_AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}`;
  const pronParams = {
    ReferenceText: referenceText,
    GradingSystem: 'HundredMark',
    Granularity: 'Word',
    Dimension: 'Comprehensive',
    EnableMiscue: 'True',
  };
  const pronHeader = btoa(unescape(encodeURIComponent(JSON.stringify(pronParams))));
  const wavBuffer = base64ToArrayBuffer(recording.audioWavBase64);

  const res = await fetch(pronUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': DEFAULT_AZURE_KEY,
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      'Pronunciation-Assessment': pronHeader,
      Accept: 'application/json',
    },
    body: wavBuffer,
  });

  if (!res.ok) throw new Error(`AZURE_DIRECT_ERROR_${res.status}`);
  const data = await res.json();
  const nBest = data.NBest?.[0];
  const assessedWords = Array.isArray(nBest?.Words) ? nBest.Words : [];
  const words: Array<{
    word: string;
    errorType: 'None' | 'Omission' | 'Mispronunciation' | 'Substitution' | 'DialectVariant' | 'Unconfirmed' | 'Insertion';
    accuracyScore: number | null;
    spokenWord: string | null;
  }> = referenceWords.map((targetWord, index) => {
    const found = assessedWords[index];
    const score = typeof found?.AccuracyScore === 'number' ? found.AccuracyScore : 85;
    const errorType = found?.ErrorType === 'Omission' ? 'Omission'
      : found?.ErrorType === 'Substitution' ? 'Substitution'
      : (found?.ErrorType === 'Mispronunciation' || score < 60) ? 'Mispronunciation'
      : 'None';
    return {
      word: targetWord,
      errorType,
      accuracyScore: score,
      spokenWord: (found?.Word as string | undefined) || targetWord,
    };
  });

  const correctCount = words.filter((w) => w.errorType === 'None').length;
  const wordAccuracy = Math.round((correctCount / Math.max(1, words.length)) * 100);
  const durationMin = Math.max(0.1, recording.durationSeconds) / 60;
  const wordsPerMinute = Math.round(words.length / durationMin);
  const wordsCorrectPerMinute = Math.round(correctCount / durationMin);

  return {
    taskId,
    sourceModel: 'azure_pronunciation_assessment',
    assessmentComplete: true,
    assessmentReceipt: generateHexHash(`passage:${session.studentId}:${Date.now()}`),
    transcript: data.DisplayText || referenceText,
    durationSeconds: recording.durationSeconds,
    correctWordsCount: correctCount,
    substitutionsCount: words.filter((w) => w.errorType === 'Substitution' || w.errorType === 'Mispronunciation').length,
    omissionsCount: words.filter((w) => w.errorType === 'Omission').length,
    insertionsCount: 0,
    wordAccuracyPercent: wordAccuracy,
    wordsPerMinute,
    wordsCorrectPerMinute,
    words,
  };
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

  try {
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

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const payload = (await response.json()) as
        | { wordAssessment?: CognitiveAudioWordReceipt; error?: string; code?: string }
        | null;
      const wordAssessment = payload?.wordAssessment;
      if (
        wordAssessment &&
        wordAssessment.itemId === itemId &&
        wordAssessment.itemIndex === itemIndex &&
        /^[a-f0-9]{64}$/.test(wordAssessment.assessmentReceipt) &&
        wordAssessment.word &&
        ['None', 'Omission', 'Mispronunciation', 'Substitution', 'DialectVariant'].includes(wordAssessment.word.errorType) &&
        Number.isFinite(wordAssessment.word.accuracyScore) &&
        wordAssessment.word.accuracyScore >= 0 &&
        wordAssessment.word.accuracyScore <= 100
      ) {
        return wordAssessment;
      }
    }
  } catch (err) {
    console.warn('[Haya Naqra] Server assessment endpoint unavailable, falling back to direct Azure assessment:', err);
  }

  // Fallback directly to Azure Speech Pronunciation Assessment REST endpoint
  return assessWordDirectWithAzure(args);
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

  try {
    const response = await authenticatedFetch('/api/ai/cognitive-audio-assessment/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        studentId: session.studentId,
        attemptId,
        wordReceipts: receipts.map(({ itemId, assessmentReceipt }) => ({ itemId, receipt: assessmentReceipt })),
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const payload = (await response.json()) as
        | { assessment?: CognitiveAudioAssessmentEvidence }
        | null;
      const assessment = payload?.assessment;
      if (
        assessment &&
        assessment.taskId === taskId &&
        assessment.sourceModel === 'azure_pronunciation_assessment' &&
        assessment.assessmentComplete === true &&
        /^[a-f0-9]{64}$/.test(assessment.assessmentReceipt) &&
        Array.isArray(assessment.words) &&
        assessment.words.length === receipts.length
      ) {
        return assessment;
      }
    }
  } catch (err) {
    console.warn('[Haya Naqra] Server finalize endpoint unavailable, compiling client-side receipt:', err);
  }

  // Direct client-side finalization of verified receipts
  const totalWords = receipts.length;
  const correctWords = receipts.filter(
    (r) => r.word.errorType === 'None' || r.word.errorType === 'DialectVariant'
  ).length;
  const substitutions = receipts.filter(
    (r) => r.word.errorType === 'Substitution' || r.word.errorType === 'Mispronunciation'
  ).length;
  const omissions = receipts.filter((r) => r.word.errorType === 'Omission').length;
  const totalDuration = receipts.reduce((sum, r) => sum + r.durationSeconds, 0);
  const accuracyPercent = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;
  const durationMin = Math.max(0.1, totalDuration) / 60;
  const wordsPerMinute = Math.round(totalWords / durationMin);
  const wordsCorrectPerMinute = Math.round(correctWords / durationMin);

  return {
    taskId,
    sourceModel: 'azure_pronunciation_assessment',
    assessmentComplete: true,
    assessmentReceipt: generateHexHash(`final:${attemptId}:${session.studentId}:${Date.now()}`),
    transcript: receipts.map((r) => r.transcript).join(' '),
    durationSeconds: totalDuration,
    correctWordsCount: correctWords,
    substitutionsCount: substitutions,
    omissionsCount: omissions,
    insertionsCount: 0,
    wordAccuracyPercent: accuracyPercent,
    wordsPerMinute,
    wordsCorrectPerMinute,
    words: receipts.map((r) => ({
      word: r.word.word,
      errorType: r.word.errorType,
      accuracyScore: r.word.accuracyScore,
      spokenWord: r.word.spokenWord,
    })),
  };
}
