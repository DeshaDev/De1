import { alignSpeechWithReferenceText } from './pronunciationAssessment';

export type AzureWordError = 'None' | 'Omission' | 'Insertion' | 'Mispronunciation' | 'Substitution' | 'DialectVariant' | 'Unconfirmed';

export interface AzureAlignedWord {
  word: string;
  errorType: AzureWordError;
  accuracyScore: number | null;
  spokenWord: string | null;
  notesAr: string;
}

export interface AzureAudioAssessmentResult {
  sourceModel: 'azure_pronunciation_assessment';
  assessmentMode: 'short-audio-miscue' | 'continuous-audio-alignment';
  assessmentComplete: boolean;
  transcript: string;
  accuracyScore: number | null;
  wordAccuracyPercent: number | null;
  fluencyScore: number | null;
  completenessScore: number | null;
  pronScore: number | null;
  wordsCount: number;
  correctWordsCount: number;
  substitutionsCount: number;
  omissionsCount: number;
  insertionsCount: number;
  wordsPerMinute: number | null;
  wordsCorrectPerMinute: number | null;
  words: AzureAlignedWord[];
}

export interface AzureRawWord {
  word: string;
  errorType: string;
  accuracyScore: number | null;
}

const DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;

function normalizeArabicToken(value: string): string {
  return value
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[.,!?،؟؛:"«»()[\]{}]/g, '')
    .trim();
}

function canonicalErrorType(value: string | undefined): AzureWordError {
  switch ((value || '').toLowerCase()) {
    case 'omission': return 'Omission';
    case 'insertion': return 'Insertion';
    case 'mispronunciation': return 'Mispronunciation';
    case 'substitution': return 'Substitution';
    case 'dialectvariant': return 'DialectVariant';
    default: return 'None';
  }
}

function safeScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : null;
}

export function normalizeAzureWordResults(records: unknown[]): AzureRawWord[] {
  return records.flatMap((record: any) => {
    if (!record || typeof record.Word !== 'string' || !record.Word.trim()) return [];
    // The Azure SDK returns scores inside each word's PronunciationAssessment object.
    // Accept the flat REST shape too, so the mapper remains resilient across SDK versions.
    const assessment = record.PronunciationAssessment || record.pronunciationAssessment || {};
    return [{
      word: record.Word.trim(),
      errorType: String(assessment.ErrorType || assessment.errorType || record.ErrorType || 'None'),
      accuracyScore: safeScore(assessment.AccuracyScore ?? assessment.accuracyScore ?? record.AccuracyScore),
    }];
  });
}

function normalizeAssessmentMetrics(payload: any): {
  accuracyScore: number | null;
  fluencyScore: number | null;
  completenessScore: number | null;
  pronScore: number | null;
} {
  const nBest = payload?.NBest?.[0] ?? payload?.nBest?.[0] ?? payload;
  const assessment = nBest?.PronunciationAssessment ?? nBest?.pronunciationAssessment ?? {};
  return {
    accuracyScore: safeScore(assessment.AccuracyScore ?? assessment.accuracyScore),
    fluencyScore: safeScore(assessment.FluencyScore ?? assessment.fluencyScore),
    completenessScore: safeScore(assessment.CompletenessScore ?? assessment.completenessScore),
    pronScore: safeScore(assessment.PronScore ?? assessment.pronScore ?? assessment.PronunciationScore),
  };
}

/**
 * Maps Azure's word-level output onto the exact reference-word list. An absence in a
 * transcript is not automatically an omission: that is only confirmed when Azure's
 * scripted short-audio response explicitly marks the reference word as Omission.
 * Continuous mode does not support EnableMiscue, so unmatched words stay unresolved.
 */
export function mapAzureAssessmentToReferenceWords(args: {
  referenceWords: string[];
  transcript: string;
  durationSeconds: number;
  dialectLabel?: string;
  enableMiscue: boolean;
  providerWords: AzureRawWord[];
  globalMetrics?: Partial<Pick<AzureAudioAssessmentResult, 'accuracyScore' | 'fluencyScore' | 'completenessScore' | 'pronScore'>>;
  providerInsertions?: number;
}): AzureAudioAssessmentResult {
  const { referenceWords, transcript, durationSeconds, enableMiscue, providerWords } = args;
  const aligned = alignSpeechWithReferenceText(
    referenceWords,
    transcript,
    durationSeconds,
    args.dialectLabel || 'الفصحى المعيارية'
  );
  const unused = new Set(providerWords.map((_, index) => index));
  let cursor = 0;
  let confirmedCorrect = 0;
  let substitutions = 0;
  let omissions = 0;
  let unresolved = 0;

  const findScoredWord = (spokenWord: string | null, targetWord: string): AzureRawWord | undefined => {
    const keys = [spokenWord, targetWord].filter((x): x is string => Boolean(x)).map(normalizeArabicToken).filter(Boolean);
    const indexes = [...unused];
    const search = [...indexes.filter(i => i >= cursor), ...indexes.filter(i => i < cursor)];
    for (const index of search) {
      const candidate = providerWords[index];
      const kind = canonicalErrorType(candidate.errorType);
      if (kind === 'Omission' || kind === 'Insertion') continue;
      if (keys.includes(normalizeArabicToken(candidate.word))) {
        unused.delete(index);
        cursor = index + 1;
        return candidate;
      }
    }
    // Some Azure result shapes use the target spelling on a mispronunciation record.
    for (const index of indexes) {
      const candidate = providerWords[index];
      if (
        normalizeArabicToken(candidate.word) === normalizeArabicToken(targetWord) &&
        ['Mispronunciation', 'Substitution'].includes(canonicalErrorType(candidate.errorType))
      ) {
        unused.delete(index);
        cursor = index + 1;
        return candidate;
      }
    }
    return undefined;
  };

  const words: AzureAlignedWord[] = referenceWords.map((targetWord, index) => {
    const omission = enableMiscue
      ? providerWords.find(item =>
          canonicalErrorType(item.errorType) === 'Omission' &&
          normalizeArabicToken(item.word) === normalizeArabicToken(targetWord))
      : undefined;
    if (omission) {
      omissions += 1;
      return {
        word: targetWord,
        errorType: 'Omission',
        accuracyScore: 0,
        spokenWord: null,
        notesAr: 'صنّفه تقييم Azure على أنه حذف في المقارنة بالنص المرجعي.',
      };
    }

    const alignedWord = aligned.words[index];
    const scored = findScoredWord(alignedWord?.spokenWord ?? null, targetWord);
    const providerError = canonicalErrorType(scored?.errorType);
    const score = scored?.accuracyScore ?? null;

    // Continuous mode cannot confirm omission/insertion tags. Do not convert the
    // local alignment engine's unmatched word into a child error.
    if (!scored || alignedWord?.errorType === 'Omission') {
      unresolved += 1;
      return {
        word: targetWord,
        errorType: 'Unconfirmed',
        accuracyScore: score,
        spokenWord: alignedWord?.spokenWord ?? null,
        notesAr: enableMiscue
          ? 'لم يحسم تقييم Azure هذه الكلمة؛ يلزم التحقق من الصوت قبل تصنيفها.'
          : 'وضع Azure المستمر لا يؤكد الحذف؛ الكلمة غير محسومة آلياً.',
      };
    }

    const providerConfirmsError =
      providerError === 'Mispronunciation' ||
      providerError === 'Substitution' ||
      (score !== null && score < 60);

    if (alignedWord?.errorType === 'Substitution' || alignedWord?.errorType === 'Mispronunciation') {
      if (!providerConfirmsError) {
        unresolved += 1;
        return {
          word: targetWord,
          errorType: 'Unconfirmed',
          accuracyScore: score,
          spokenWord: alignedWord.spokenWord,
          notesAr: 'يوجد اختلاف بين النص والتفريغ، لكن Azure لم يؤكد خطأ النطق؛ النتيجة غير محسومة.',
        };
      }
      substitutions += 1;
      return {
        word: targetWord,
        errorType: 'Substitution',
        accuracyScore: score,
        spokenWord: alignedWord.spokenWord,
        notesAr: 'رُصد اختلاف لفظي وأيده تقييم النطق الصوتي.',
      };
    }

    if (providerConfirmsError) {
      substitutions += 1;
      return {
        word: targetWord,
        errorType: 'Mispronunciation',
        accuracyScore: score,
        spokenWord: alignedWord.spokenWord,
        notesAr: 'رصد Azure انخفاضاً في دقة نطق الكلمة.',
      };
    }

    if (alignedWord?.errorType === 'DialectVariant') {
      confirmedCorrect += 1;
      return {
        word: targetWord,
        errorType: 'DialectVariant',
        accuracyScore: score,
        spokenWord: alignedWord.spokenWord,
        notesAr: alignedWord.notesAr || 'بديل لهجي مقبول في المطابقة.',
      };
    }

    confirmedCorrect += 1;
    return {
      word: targetWord,
      errorType: 'None',
      accuracyScore: score,
      spokenWord: alignedWord?.spokenWord ?? scored.word,
      notesAr: 'تطابق النص مع التفريغ ولم يرصد Azure خطأ نطق.',
    };
  });

  const totalWords = referenceWords.length;
  const assessmentComplete = unresolved === 0;
  const tokenCount = transcript.trim() ? transcript.trim().split(/\s+/).filter(Boolean).length : 0;
  const durationMin = Math.max(1, durationSeconds) / 60;
  const global = args.globalMetrics || {};
  const derivedWordAccuracy = totalWords > 0
    ? Math.round((confirmedCorrect / totalWords) * 100)
    : null;

  return {
    sourceModel: 'azure_pronunciation_assessment',
    assessmentMode: enableMiscue ? 'short-audio-miscue' : 'continuous-audio-alignment',
    assessmentComplete,
    transcript,
    accuracyScore: global.accuracyScore ?? (assessmentComplete ? derivedWordAccuracy : null),
    wordAccuracyPercent: assessmentComplete ? derivedWordAccuracy : null,
    fluencyScore: global.fluencyScore ?? null,
    completenessScore: global.completenessScore ?? null,
    pronScore: global.pronScore ?? null,
    wordsCount: totalWords,
    correctWordsCount: confirmedCorrect,
    substitutionsCount: substitutions,
    omissionsCount: omissions,
    insertionsCount: args.providerInsertions ?? providerWords.filter(w => canonicalErrorType(w.errorType) === 'Insertion').length,
    wordsPerMinute: assessmentComplete && tokenCount > 0 ? Math.round(tokenCount / durationMin) : null,
    wordsCorrectPerMinute: assessmentComplete ? Math.round((confirmedCorrect / durationMin)) : null,
    words,
  };
}

function extractWordsAndMetrics(payloads: any[]): { words: AzureRawWord[]; metrics: {accuracyScore:number|null;fluencyScore:number|null;completenessScore:number|null;pronScore:number|null} } {
  const words: AzureRawWord[] = [];
  const metricRows: Array<{ metrics: ReturnType<typeof normalizeAssessmentMetrics>; count: number }> = [];
  for (const payload of payloads) {
    const nBest = payload?.NBest?.[0] ?? payload?.nBest?.[0];
    words.push(...normalizeAzureWordResults(nBest?.Words ?? nBest?.words ?? []));
    const count = Array.isArray(nBest?.Words) ? nBest.Words.length : 1;
    metricRows.push({ metrics: normalizeAssessmentMetrics(payload), count: Math.max(1, count) });
  }
  const average = (key: keyof ReturnType<typeof normalizeAssessmentMetrics>) => {
    const valid = metricRows.filter(row => row.metrics[key] !== null);
    if (valid.length === 0) return null;
    const total = valid.reduce((sum, row) => sum + (row.metrics[key] as number) * row.count, 0);
    const weight = valid.reduce((sum, row) => sum + row.count, 0);
    return Math.round(total / weight);
  };
  return {
    words,
    metrics: {
      accuracyScore: average('accuracyScore'),
      fluencyScore: average('fluencyScore'),
      completenessScore: average('completenessScore'),
      pronScore: average('pronScore'),
    },
  };
}

/**
 * Scores the actual captured WAV recording with Azure Speech SDK. Short readings use
 * reference-text miscue assessment. Long readings use continuous recognition; because
 * Azure documents that continuous mode cannot emit EnableMiscue omission/insertion tags,
 * unmatched words are deliberately reported as unresolved.
 */
export async function assessReadingAudioWithAzure(args: {
  referenceText: string;
  referenceWords: string[];
  audioWavBase64: string;
  durationSeconds: number;
  language: 'ar-EG' | 'ar-SA';
  dialectLabel?: string;
}): Promise<AzureAudioAssessmentResult> {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!key || !region) {
    throw new Error('AZURE_SPEECH_NOT_CONFIGURED');
  }
  if (!args.audioWavBase64 || args.audioWavBase64.length > 4_500_000) {
    throw new Error('INVALID_AUDIO_PAYLOAD');
  }
  if (args.referenceWords.length < 2 || args.referenceWords.length > 300) {
    throw new Error('INVALID_REFERENCE_WORDS');
  }
  if (args.durationSeconds < 1 || args.durationSeconds > 600) {
    throw new Error('INVALID_AUDIO_DURATION');
  }

  const wav = Buffer.from(args.audioWavBase64, 'base64');
  if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('INVALID_WAV_HEADER');
  }
  if (wav.readUInt16LE(20) !== 1 || wav.readUInt16LE(22) !== 1 || wav.readUInt32LE(24) !== 16000 || wav.readUInt16LE(34) !== 16) {
    throw new Error('UNSUPPORTED_WAV_FORMAT');
  }

  const sdk: any = await import('microsoft-cognitiveservices-speech-sdk');
  const enableMiscue = args.durationSeconds <= 28 && args.referenceText.length <= 100;
  const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
  speechConfig.speechRecognitionLanguage = args.language;
  speechConfig.setProperty(sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, '1200');
  const audioConfig = sdk.AudioConfig.fromWavFileInput(wav);
  const recognizer = new sdk.SpeechRecognizer(speechConfig, args.language, audioConfig);
  const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
    args.referenceText,
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Word,
    enableMiscue
  );
  pronunciationConfig.applyTo(recognizer);

  try {
    const payloads: any[] = [];
    const transcripts: string[] = [];
    const processResult = (result: any) => {
      if (result?.reason !== sdk.ResultReason.RecognizedSpeech) return;
      if (typeof result.text === 'string' && result.text.trim()) transcripts.push(result.text.trim());
      const json = result.properties?.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult);
      if (json) {
        try { payloads.push(JSON.parse(json)); } catch { /* malformed provider payload is handled below */ }
      }
    };

    if (enableMiscue) {
      await new Promise<void>((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result: any) => {
            try {
              processResult(result);
              if (result?.reason === sdk.ResultReason.Canceled) {
                const details = sdk.CancellationDetails.fromResult(result);
                reject(new Error(details?.errorDetails || 'AZURE_RECOGNITION_CANCELED'));
              } else {
                resolve();
              }
            } catch (error) {
              reject(error);
            }
          },
          (error: any) => reject(new Error(String(error || 'AZURE_RECOGNITION_FAILED')))
        );
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          try { recognizer.stopContinuousRecognitionAsync(); } catch { /* already closed */ }
          reject(new Error('AZURE_RECOGNITION_TIMEOUT'));
        }, 90_000);
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (error) reject(error);
          else resolve();
        };
        recognizer.recognized = (_sender: unknown, event: any) => processResult(event?.result);
        recognizer.canceled = (_sender: unknown, event: any) => {
          if (event?.reason === sdk.CancellationReason.Error) {
            finish(new Error(String(event?.errorDetails || event?.errorCode || 'AZURE_RECOGNITION_CANCELED')));
          }
        };
        recognizer.sessionStopped = () => finish();
        recognizer.startContinuousRecognitionAsync(
          () => undefined,
          (error: any) => finish(new Error(String(error || 'AZURE_RECOGNITION_FAILED')))
        );
      });
    }

    const transcript = transcripts.join(' ').replace(/\s+/g, ' ').trim();
    if (!transcript || payloads.length === 0) {
      throw new Error('AZURE_NO_RECOGNIZED_SPEECH');
    }
    const provider = extractWordsAndMetrics(payloads);
    if (provider.words.length === 0) {
      throw new Error('AZURE_NO_WORD_LEVEL_RESULTS');
    }

    return mapAzureAssessmentToReferenceWords({
      referenceWords: args.referenceWords,
      transcript,
      durationSeconds: args.durationSeconds,
      dialectLabel: args.dialectLabel,
      enableMiscue,
      providerWords: provider.words,
      globalMetrics: provider.metrics,
    });
  } finally {
    try { recognizer.close(); } catch { /* SDK cleanup is best effort */ }
    try { audioConfig.close(); } catch { /* SDK cleanup is best effort */ }
    try { speechConfig.close?.(); } catch { /* SDK cleanup is best effort */ }
  }
}
