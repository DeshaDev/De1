/**
 * Baseera Pronunciation Assessment & Reference-Text Alignment Engine
 *
 * Integrates:
 * 1. Microsoft Azure Speech Pronunciation Assessment (ar-SA, ar-EG) protocol
 * 2. Multi-model Alignment Pipeline (Reference Text vs Recognized Speech)
 * 3. Detailed Word-Level Diagnostic Breakdown:
 *    - Omission (حذف / تخطي)
 *    - Substitution / Mispronunciation (إبدال / تعثر لفظي)
 *    - Insertion (إضافة لفظية)
 *    - Accurate (صحيحة بطلاقة)
 */

import {
  evaluateOralReadingAlignment,
  OralReadingFluencyResult,
  OralWordAlignmentItem,
  ArabicDialectCode,
} from './dyslexiaEngines';

export type SpeechEngineProvider =
  | 'local_dp_aligner'
  | 'azure_speech'
  | 'whisper_transcribe'
  | 'dessa_speech_to_speech';

export interface DessaModelAdapterConfig {
  /** Dessa full-duplex speech-to-speech configuration (Block / Jack Dorsey) */
  enabled: boolean;
  modelVariant: 'dessa-conversational-v1' | 'dessa-research-preview';
  fullDuplexMode: boolean;
  endpointUrl?: string;
  apiKey?: string;
  statusNotesAr: string;
}

export const DESSA_INTEGRATION_PROFILE: DessaModelAdapterConfig = {
  enabled: false,
  modelVariant: 'dessa-research-preview',
  fullDuplexMode: true,
  statusNotesAr:
    'نموذج Dessa (Block / Jack Dorsey) قيد المعاينة البحثية المغلقة (Research Preview) بدون واجهة API عامة متاحة حتى الآن. تم إعداد موصل الربط المعماري لاستقبال الواجهة فور فتحها.',
};

export type WordErrorType =
  | 'None'
  | 'Omission'
  | 'Insertion'
  | 'Mispronunciation'
  | 'Substitution'
  | 'DialectVariant';

export interface EvaluatedWord {
  word: string;
  errorType: WordErrorType;
  accuracyScore: number; // 0 - 100
  spokenWord?: string | null;
  phonemes?: Array<{ phoneme: string; accuracyScore: number }>;
  notesAr?: string;
}

export interface PronunciationAssessmentResult {
  accuracyScore: number; // 0 - 100
  fluencyScore: number; // 0 - 100
  completenessScore: number; // 0 - 100
  pronScore: number; // Overall weighted pronunciation score 0 - 100
  wordsCount: number;
  correctWordsCount: number;
  substitutionsCount: number;
  omissionsCount: number;
  insertionsCount: number;
  wordsPerMinute: number;
  wordsCorrectPerMinute: number;
  words: EvaluatedWord[];
  sourceModel: 'azure_pronunciation_assessment' | 'baseera_reference_aligner';
  diagnosticSummaryAr: string;
}

/**
 * Align spoken transcript with target reference passage tokens.
 * Computes exact word-level diagnostics and scoring.
 */
export function alignSpeechWithReferenceText(
  referenceWords: string[],
  spokenTranscript: string,
  durationSeconds: number,
  dialect: string = 'الفصحى المعيارية'
): PronunciationAssessmentResult {
  const cleanDuration = Math.max(1, durationSeconds);

  // If no transcript at all
  if (!spokenTranscript || spokenTranscript.trim().length === 0) {
    const omittedWords: EvaluatedWord[] = referenceWords.map((w) => ({
      word: w,
      errorType: 'Omission',
      accuracyScore: 0,
      spokenWord: null,
      notesAr: 'لم يُلتقط نطق للكلمة',
    }));

    return {
      accuracyScore: 0,
      fluencyScore: 0,
      completenessScore: 0,
      pronScore: 0,
      wordsCount: referenceWords.length,
      correctWordsCount: 0,
      substitutionsCount: 0,
      omissionsCount: referenceWords.length,
      insertionsCount: 0,
      wordsPerMinute: 0,
      wordsCorrectPerMinute: 0,
      words: omittedWords,
      sourceModel: 'baseera_reference_aligner',
      diagnosticSummaryAr: 'لم يتم التقاط تسجيل صوتي واضح لتحليله مقابل النص المرجعي.',
    };
  }

  // The legacy callers pass display labels; convert them to the engine's stable dialect codes.
  const normalizedDialect: ArabicDialectCode =
    dialect === 'egyptian' || dialect === 'ar-EG' || dialect.includes('المصرية')
      ? 'egyptian'
      : dialect === 'gulf' || dialect === 'ar-SA' || dialect.includes('الخليج')
        ? 'gulf'
        : dialect === 'levantine' || dialect === 'maghrebi'
          ? dialect
          : 'msa';

  // Use Dynamic Programming Sequence Alignment.
  const alignmentResult: OralReadingFluencyResult = evaluateOralReadingAlignment(
    referenceWords,
    spokenTranscript,
    cleanDuration,
    0,
    normalizedDialect
  );

  let correctCount = 0;
  let substitutionCount = 0;
  let omissionCount = 0;

  const evaluatedWords: EvaluatedWord[] = referenceWords.map((targetWord, idx) => {
    const aligned: OralWordAlignmentItem | undefined = alignmentResult.alignment[idx];

    if (!aligned || aligned.status === 'omitted') {
      omissionCount++;
      return {
        word: targetWord,
        errorType: 'Omission' as WordErrorType,
        accuracyScore: 0,
        spokenWord: null,
        notesAr: 'تخطي أو حذف في القراءة',
      };
    }

    if (aligned.status === 'correct') {
      correctCount++;
      return {
        word: targetWord,
        errorType: 'None' as WordErrorType,
        accuracyScore: 100,
        spokenWord: aligned.spokenWord,
        notesAr: 'قراءة صحيحة دقيقة',
      };
    }

    if (aligned.status === 'dialect_variant') {
      correctCount++;
      return {
        word: targetWord,
        errorType: 'DialectVariant' as WordErrorType,
        accuracyScore: 90,
        spokenWord: aligned.spokenWord,
        notesAr: aligned.dialectNoteAr || 'بديل لهجي مقبول',
      };
    }

    // Phonetic substitution / mispronunciation
    substitutionCount++;
    return {
      word: targetWord,
      errorType: 'Substitution' as WordErrorType,
      accuracyScore: Math.max(20, Math.round((1 - aligned.weightedDistance) * 100)),
      spokenWord: aligned.spokenWord,
      notesAr: `نُطقت: "${aligned.spokenWord || ''}" بدلاً من "${targetWord}"`,
    };
  });

  const totalWords = Math.max(1, referenceWords.length);
  const accuracyScore = Math.round((correctCount / totalWords) * 100);
  const completenessScore = Math.round(((totalWords - omissionCount) / totalWords) * 100);
  
  // Fluency score based on reading pace and hesitation pauses
  const targetWpm = 75; // average Grade 2-4 target
  const actualWpm = Math.round((totalWords / cleanDuration) * 60);
  const fluencyRatio = Math.min(1.2, actualWpm / targetWpm);
  const penaltyForHesitations = Math.min(30, alignmentResult.hesitationPauseCount * 5);
  const fluencyScore = Math.max(10, Math.min(100, Math.round(fluencyRatio * 85 - penaltyForHesitations)));

  const pronScore = Math.round(accuracyScore * 0.5 + fluencyScore * 0.3 + completenessScore * 0.2);

  const diagnosticSummaryAr =
    accuracyScore >= 90
      ? `قراءة متقنة وممتازة! تم نطق ${correctCount} من أصل ${totalWords} كلمة بدقة عالية.`
      : accuracyScore >= 70
      ? `قراءة جيدة مع وجود بعض الترددات أو الإبدالات (${substitutionCount} إبدال، ${omissionCount} تخطي) تحتاج لمراجعة هادئة.`
      : `قراءة تحتاج إلى دعم وتدريب تدريجي على فك المقاطع (${substitutionCount} إبدال، ${omissionCount} تخطي).`;

  return {
    accuracyScore,
    fluencyScore,
    completenessScore,
    pronScore,
    wordsCount: totalWords,
    correctWordsCount: correctCount,
    substitutionsCount: substitutionCount,
    omissionsCount: omissionCount,
    insertionsCount: alignmentResult.insertionCount || 0,
    wordsPerMinute: actualWpm,
    wordsCorrectPerMinute: alignmentResult.wcpm,
    words: evaluatedWords,
    sourceModel: 'baseera_reference_aligner',
    diagnosticSummaryAr,
  };
}

/**
 * Call Azure Pronunciation Assessment API if credentials exist,
 * or fallback seamlessly to the local reference aligner.
 */
export async function evaluatePronunciationWithAzureOrLocal(params: {
  referenceText: string;
  referenceWords: string[];
  spokenTranscript?: string;
  audioWavBase64?: string;
  durationSeconds: number;
  language?: 'ar-SA' | 'ar-EG';
}): Promise<PronunciationAssessmentResult> {
  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION;

  // If Azure credentials and audio exist, invoke Azure Speech Pronunciation Assessment REST endpoint
  if (azureKey && azureRegion && params.audioWavBase64) {
    try {
      const pronAssessmentParams = {
        ReferenceText: params.referenceText,
        GradingSystem: 'HundredMark',
        Granularity: 'Word',
        Dimension: 'Comprehensive',
        EnableMiscue: true,
      };

      const pronHeader = Buffer.from(JSON.stringify(pronAssessmentParams)).toString('base64');
      const lang = params.language || 'ar-SA';
      const endpoint = `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${lang}`;

      const audioBuffer = Buffer.from(params.audioWavBase64, 'base64');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          'Pronunciation-Assessment': pronHeader,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          Accept: 'application/json',
        },
        body: audioBuffer,
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const nBest = data.NBest?.[0];
        if (nBest && nBest.Words) {
          const azureWords: EvaluatedWord[] = nBest.Words.map((w: any) => ({
            word: w.Word,
            errorType: (w.ErrorType || 'None') as WordErrorType,
            accuracyScore: Math.round(w.AccuracyScore || 0),
            notesAr:
              w.ErrorType === 'Omission'
                ? 'كلمة محذوفة / متخطاة'
                : w.ErrorType === 'Mispronunciation'
                ? 'خطأ في النطق الصوتي'
                : w.ErrorType === 'Insertion'
                ? 'كلمة مضافة غير موجودة بالنص'
                : 'نطق سليم',
          }));

          const correct = azureWords.filter((w) => w.errorType === 'None').length;
          const omissions = azureWords.filter((w) => w.errorType === 'Omission').length;
          const subs = azureWords.filter(
            (w) => w.errorType === 'Mispronunciation' || w.errorType === 'Substitution'
          ).length;

          return {
            accuracyScore: Math.round(nBest.PronunciationAssessment?.AccuracyScore || 0),
            fluencyScore: Math.round(nBest.PronunciationAssessment?.FluencyScore || 0),
            completenessScore: Math.round(nBest.PronunciationAssessment?.CompletenessScore || 0),
            pronScore: Math.round(nBest.PronunciationAssessment?.PronScore || 0),
            wordsCount: params.referenceWords.length,
            correctWordsCount: correct,
            substitutionsCount: subs,
            omissionsCount: omissions,
            insertionsCount: azureWords.filter((w) => w.errorType === 'Insertion').length,
            wordsPerMinute: Math.round((params.referenceWords.length / Math.max(1, params.durationSeconds)) * 60),
            wordsCorrectPerMinute: Math.round((correct / Math.max(1, params.durationSeconds)) * 60),
            words: azureWords,
            sourceModel: 'azure_pronunciation_assessment',
            diagnosticSummaryAr: `تقييم النطق عبر خادم Azure Speech (${lang}): درجة الدقة ${nBest.PronunciationAssessment?.AccuracyScore || 0}%.`,
          };
        }
      }
    } catch (err) {
      console.warn('Azure Pronunciation Assessment fallback to local alignment:', err);
    }
  }

  // Fallback to Baseera Reference Aligner
  return alignSpeechWithReferenceText(
    params.referenceWords,
    params.spokenTranscript || '',
    params.durationSeconds,
    params.language === 'ar-EG' ? 'المصرية' : 'الفصحى المعيارية / الخليجية'
  );
}
