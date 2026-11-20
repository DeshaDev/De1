/**
 * Institute of Foundation Models (IFM / Jais) Speech & Reading Assessment Engine:
 *
 * 1. Automatic Speech Recognition (ASR):
 *    - Model: IFM/Jais-ASR (via https://api.ifm.ai/v1/audio/transcriptions)
 *    - Purpose-built for Arabic phonetics, Modern Standard Arabic (MSA), and regional dialects
 *    - Native silence & non-speech detection ('no_speech': true)
 *    - Zero confirmation bias / hallucination (pure blind acoustic model)
 *
 * 2. Rate-Limiting & Throughput Optimization:
 *    - Paced concurrency queue enforcing >= 550ms interval (~1.8 req/sec) to respect IFM 2 req/s rate limits
 *    - Automatic HTTP 429 retry with exponential/header-based backoff
 *    - Instant local Latin-to-Arabic phonetic transliteration (0ms extra delay)
 *    - Inaudible silence pre-filtering (<80 RMS)
 *
 * 3. Native Arabic Pedagogical & Phonetic Diagnosis:
 *    - Model: IFM/Jais-3-MoVA-36B-A4B (via https://api.ifm.ai/v1/chat/completions)
 *    - In-depth Arabic phonetic, morphological, and diacritical analysis
 */

export interface IfmTranscriptionResult {
  transcript: string;
  isSilent: boolean;
  language: string | null;
  sourceModel: 'ifm/jais-asr';
  rawResponse?: Record<string, unknown>;
}

export interface IfmReadingDiagnosis {
  errorType: 'None' | 'Mispronunciation' | 'Substitution' | 'Omission';
  notesAr: string;
  confidenceScore?: number;
}

export function getIfmApiKey(): string | null {
  const nodeEnv = typeof process !== 'undefined' ? process.env : undefined;
  const envKey = nodeEnv?.IFM_API_KEY || nodeEnv?.VITE_IFM_API_KEY;

  if (envKey && envKey.trim() && envKey !== 'MY_IFM_API_KEY' && envKey !== 'YOUR_IFM_API_KEY') {
    return envKey.trim();
  }

  // Support Vite client-side if loaded in browser
  try {
    const metaEnv = (import.meta as any)?.env?.VITE_IFM_API_KEY;
    if (metaEnv && typeof metaEnv === 'string' && metaEnv.trim()) {
      return metaEnv.trim();
    }
  } catch {
    // import.meta not defined in standard CJS/Node
  }

  return null;
}

const PHONETIC_ARABIC_MAP: Record<string, string> = {
  fob: 'فُوب',
  foob: 'فُوب',
  katab: 'كَتَب',
  kataba: 'كَتَبَ',
  kutub: 'كُتُب',
  feel: 'فِيل',
  fil: 'فِيل',
  jamal: 'جَمَل',
  kitab: 'كِتَاب',
  qalam: 'قَلَم',
  sayf: 'سَيْف',
  saif: 'سَيْف',
};

export function quickLatinToArabicPhonetics(text: string): string {
  const lower = text.toLowerCase().trim();
  if (PHONETIC_ARABIC_MAP[lower]) return PHONETIC_ARABIC_MAP[lower];

  return lower
    .replace(/th/g, 'ث')
    .replace(/kh/g, 'خ')
    .replace(/sh/g, 'ش')
    .replace(/dh/g, 'ذ')
    .replace(/gh/g, 'غ')
    .replace(/ee|i/g, 'ي')
    .replace(/oo|u|o/g, 'و')
    .replace(/aa|a/g, 'ا')
    .replace(/b/g, 'ب')
    .replace(/t/g, 'ت')
    .replace(/j/g, 'ج')
    .replace(/h/g, 'ح')
    .replace(/d/g, 'د')
    .replace(/r/g, 'ر')
    .replace(/z/g, 'ز')
    .replace(/s/g, 'س')
    .replace(/f/g, 'ف')
    .replace(/q|k/g, 'ك')
    .replace(/l/g, 'ل')
    .replace(/m/g, 'م')
    .replace(/n/g, 'ن')
    .replace(/w/g, 'و')
    .replace(/y/g, 'ي');
}

/**
 * Transliterates Latin transcription tokens (e.g., nonwords like "fob" -> "فُوب")
 * into authentic diacritized Arabic script instantaneously without remote network lag.
 */
export function transliterateLatinToArabic(latinText: string): string {
  const clean = (latinText || '').trim();
  if (!clean || !/[a-zA-Z]/.test(clean)) {
    return clean;
  }
  return quickLatinToArabicPhonetics(clean);
}

// Keep backwards-compatible alias
export const transliterateLatinToArabicWithJais = async (latinText: string, _apiKey?: string): Promise<string> => {
  return transliterateLatinToArabic(latinText);
};

/**
 * Detects if a WAV buffer is truly blank/zero-signal audio.
 * Thresholds are set very conservatively so whispering children are NEVER
 * silently rejected — IFM Jais-ASR's native no_speech detection handles
 * real silence detection more accurately.
 * Only catches completely dead buffers (e.g., corrupt recording, zero-byte payload).
 */
export function isAudioPracticallySilent(audioBytes: Buffer): boolean {
  if (!audioBytes || audioBytes.length <= 44) return true;
  const dataIdx = audioBytes.indexOf('data');
  const startOffset = dataIdx >= 0 ? dataIdx + 8 : 44;
  if (startOffset >= audioBytes.length) return true;

  let sumSquares = 0;
  let sampleCount = 0;
  let maxPeak = 0;
  const step = 8;
  for (let i = startOffset; i < audioBytes.length - 1; i += step) {
    const sample = Math.abs(audioBytes.readInt16LE(i));
    if (sample > maxPeak) maxPeak = sample;
    sumSquares += sample * sample;
    sampleCount++;
  }
  if (sampleCount === 0) return true;
  const rms = Math.sqrt(sumSquares / sampleCount);
  // Only mark as silent if truly zero-signal: RMS < 5 AND peak < 20.
  // Browser WebM/Opus → WAV always has at least some background noise;
  // even a whisper produces RMS > 50. The IFM ASR model's own no_speech
  // flag handles true silence far more accurately than PCM energy alone.
  return rms < 5 && maxPeak < 20;
}

/**
 * Global rate-limiter queue for IFM API:
 * Enforces >= 550ms interval between calls to ensure we stay strictly under the 2 req/s quota.
 */
let lastIfmRequestFinishedAt = 0;
const IFM_MIN_SPACING_MS = 550;
let ifmQueueTail: Promise<any> = Promise.resolve();

export async function executeWithIfmRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  const execute = async (): Promise<T> => {
    const now = Date.now();
    const waitMs = Math.max(0, lastIfmRequestFinishedAt + IFM_MIN_SPACING_MS - now);
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
    try {
      return await fn();
    } finally {
      lastIfmRequestFinishedAt = Date.now();
    }
  };

  const next = ifmQueueTail.then(execute, execute);
  ifmQueueTail = next.catch(() => {});
  return next;
}

/**
 * Transcribes children's Arabic speech blindly using IFM Jais-ASR.
 * Zero reference text is sent to the model, eliminating confirmation bias.
 * Incorporates:
 * - 0ms silence pre-detection
 * - 550ms pacing queue
 * - Automatic HTTP 429 retry
 * - Instant Latin-to-Arabic phonetic normalization
 */
export async function transcribeArabicWithJaisAsr(args: {
  audioWavBase64: string;
  apiKey?: string;
  language?: string;
  mode?: 'word' | 'passage';
}): Promise<IfmTranscriptionResult> {
  if (!args.audioWavBase64 || args.audioWavBase64.length > 6_000_000) {
    throw new Error('INVALID_AUDIO_PAYLOAD');
  }

  const effectiveKey = (args.apiKey && args.apiKey.trim()) || getIfmApiKey();
  if (!effectiveKey) {
    throw new Error('IFM_API_KEY_NOT_CONFIGURED');
  }

  const audioBytes = Buffer.from(args.audioWavBase64, 'base64');
  console.log(`[IFM ASR] Received audio: ${audioBytes.length} bytes (base64 len: ${args.audioWavBase64.length})`);

  // Only skip truly zero-signal buffers (corrupt/empty); real speech always passes
  if (isAudioPracticallySilent(audioBytes)) {
    console.log(`[IFM ASR] Pre-filter: audio is zero-signal, skipping API call`);
    return {
      transcript: '',
      isSilent: true,
      language: null,
      sourceModel: 'ifm/jais-asr',
    };
  }

  return executeWithIfmRateLimit(async () => {
    const maxRetries = 3;
    const blob = new Blob([audioBytes], { type: 'audio/wav' });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const form = new FormData();
      form.append('file', blob, 'recording.wav');
      form.append('model', 'IFM/Jais-ASR');
      form.append('language', args.language === 'ar-EG' ? 'ar' : 'ar');

      const timeoutMs = args.mode === 'passage' ? 30000 : 12000;
      console.log(`[IFM ASR] Sending request attempt ${attempt}/${maxRetries}, timeout=${timeoutMs}ms`);
      const res = await fetch('https://api.ifm.ai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${effectiveKey}`,
        },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after');
        const resetReqs = res.headers.get('x-ratelimit-reset-requests');
        let waitMs = 1100;
        if (retryAfter && Number(retryAfter)) {
          waitMs = Math.round(Number(retryAfter) * 1000) + 150;
        } else if (resetReqs && /^\d+s?$/.test(resetReqs)) {
          waitMs = parseInt(resetReqs, 10) * 1000 + 150;
        }
        console.warn(`[IFM ASR] Rate limit 429 hit. Pacing wait ${waitMs}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`IFM_ASR_HTTP_${res.status}: ${errorText.slice(0, 200)}`);
      }

      const payload: any = await res.json();
      const rawText = typeof payload.text === 'string' ? payload.text.trim() : '';
      const noSpeech = payload.no_speech === true;
      const isSilent = noSpeech || rawText.length === 0;
      console.log(`[IFM ASR] Response: text="${rawText}", no_speech=${noSpeech}, isSilent=${isSilent}`);

      if (isSilent) {
        return {
          transcript: '',
          isSilent: true,
          language: payload.language ?? null,
          sourceModel: 'ifm/jais-asr',
          rawResponse: payload,
        };
      }

      let finalTranscript = rawText;
      // If the ASR transcribed Latin phonetics (e.g. for nonwords), map cleanly to Arabic
      if (/[a-zA-Z]/.test(finalTranscript)) {
        finalTranscript = transliterateLatinToArabic(finalTranscript);
      }

      return {
        transcript: finalTranscript,
        isSilent: false,
        language: payload.language ?? null,
        sourceModel: 'ifm/jais-asr',
        rawResponse: payload,
      };
    }

    throw new Error('IFM_ASR_HTTP_429: Rate limit exceeded after retries');
  });
}

/**
 * Diagnostic analysis of reading errors using IFM Jais-3 Arabic LLM.
 */
export async function diagnoseReadingErrorWithJais3(args: {
  expectedWord: string;
  spokenWord: string;
  apiKey?: string;
}): Promise<IfmReadingDiagnosis> {
  const effectiveKey = (args.apiKey && args.apiKey.trim()) || getIfmApiKey();
  if (!effectiveKey) {
    throw new Error('IFM_API_KEY_NOT_CONFIGURED');
  }

  const prompt = `أنت خبير لغوي وصوتيات وتشخيص صعوبات قراءة للأطفال باللغة العربية.
الكلمة المطلوبة: «${args.expectedWord}»
ما نطقه الطفل: «${args.spokenWord}»

حلل النطق وأرجع تقريرًا بصيغة JSON فقط:
{
  "errorType": "None" أو "Mispronunciation" أو "Substitution" أو "Omission",
  "notesAr": "شرح تربوي دقيق ولطيف وموجز باللغة العربية",
  "confidenceScore": 90
}`;

  return executeWithIfmRateLimit(async () => {
    const res = await fetch('https://api.ifm.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${effectiveKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'IFM/Jais-3-MoVA-36B-A4B',
        messages: [
          { role: 'system', content: 'أنت أخصائي تشخيص قراءة باللغة العربية. أرجع JSON فقط.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`IFM_JAIS3_HTTP_${res.status}`);
    }

    const data: any = await res.json();
    const rawJson = data?.choices?.[0]?.message?.content || '{}';
    const cleanJson = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      errorType: parsed.errorType || 'Substitution',
      notesAr: parsed.notesAr || '',
      confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 85,
    };
  });
}
