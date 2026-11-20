/**
 * Institute of Foundation Models (IFM / Jais) Speech & Reading Assessment Engine:
 *
 * 1. Automatic Speech Recognition (ASR):
 *    - Model: IFM/Jais-ASR (via https://api.ifm.ai/v1/audio/transcriptions)
 *    - Purpose-built for Arabic phonetics, Modern Standard Arabic (MSA), and regional dialects
 *    - Native silence & non-speech detection ('no_speech': true)
 *    - Zero confirmation bias / hallucination (pure blind acoustic model)
 *
 * 2. Acoustic Framing & Single-Word Optimization:
 *    - Start/end 60ms de-clicking to remove physical button/mouse tap transients
 *    - Dynamic peak normalization to optimal speech SNR (~26,000 peak)
 *    - Acoustic carrier framing ("هَذِهِ:") + 2x utterance repetition for isolated words
 *      to prevent IFM/Jais-ASR's sentence-level VAD from rejecting sub-second single words
 *
 * 3. Rate-Limiting & Throughput Optimization:
 *    - Paced concurrency queue enforcing >= 550ms interval (~1.8 req/sec) to respect IFM 2 req/s rate limits
 *    - Automatic HTTP 429 & 502/503/504 retry with exponential/header-based backoff
 *    - Instant local Latin-to-Arabic phonetic transliteration (0ms extra delay)
 *
 * 4. Native Arabic Pedagogical & Phonetic Diagnosis:
 *    - Model: IFM/Jais-3-MoVA-36B-A4B (via https://api.ifm.ai/v1/chat/completions)
 *    - In-depth Arabic phonetic, morphological, and diacritical analysis
 */

import { IFM_CARRIER_HADHIHI_PCM_BASE64 } from './ifmCarrierPcm';

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
 * Normalizes PCM WAV audio samples dynamically to ensure child speech reaches
 * IFM Jais-ASR with optimal signal-to-noise ratio.
 * De-clicks the first/last 60ms on real recordings (>=0.75s) to remove button click transients.
 */
export function normalizePcmWavBuffer(audioBytes: Buffer): {
  normalized: Buffer;
  maxPeak: number;
  rms: number;
  gainApplied: number;
} {
  if (!audioBytes || audioBytes.length <= 44) {
    return { normalized: audioBytes, maxPeak: 0, rms: 0, gainApplied: 1 };
  }
  const dataIdx = audioBytes.indexOf('data');
  const startOffset = dataIdx >= 0 ? dataIdx + 8 : 44;
  if (startOffset >= audioBytes.length) {
    return { normalized: audioBytes, maxPeak: 0, rms: 0, gainApplied: 1 };
  }

  const outBuffer = Buffer.from(audioBytes);
  const totalSamples = Math.floor((outBuffer.length - startOffset) / 2);

  // De-click start/end 60ms (960 samples at 16kHz) if recording is at least 0.75s (12000 samples)
  const edgeSamples = totalSamples >= 12000 ? 960 : 0;
  if (edgeSamples > 0) {
    for (let s = 0; s < edgeSamples; s++) {
      const fade = Math.max(0, (s - 480) / (edgeSamples - 480));
      const startByte = startOffset + s * 2;
      const endByte = startOffset + (totalSamples - 1 - s) * 2;
      outBuffer.writeInt16LE(Math.round(outBuffer.readInt16LE(startByte) * fade), startByte);
      outBuffer.writeInt16LE(Math.round(outBuffer.readInt16LE(endByte) * fade), endByte);
    }
  }

  let maxPeak = 0;
  let sumSquares = 0;
  let sampleCount = 0;

  for (let i = startOffset; i < outBuffer.length - 1; i += 2) {
    const sample = Math.abs(outBuffer.readInt16LE(i));
    if (sample > maxPeak) maxPeak = sample;
    sumSquares += sample * sample;
    sampleCount++;
  }

  const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;

  if (maxPeak >= 200 && maxPeak < 22000) {
    const gain = Math.min(10, 26000 / maxPeak);
    for (let i = startOffset; i < outBuffer.length - 1; i += 2) {
      const orig = outBuffer.readInt16LE(i);
      const boosted = Math.round(orig * gain);
      const clamped = Math.max(-32768, Math.min(32767, boosted));
      outBuffer.writeInt16LE(clamped, i);
    }
    return { normalized: outBuffer, maxPeak, rms, gainApplied: gain };
  }

  return { normalized: outBuffer, maxPeak, rms, gainApplied: 1 };
}

/**
 * Detects if a WAV buffer is truly blank/zero-signal audio.
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
  return rms < 5 && maxPeak < 20;
}

let cachedCarrierPcm: Buffer | null = null;
function getCarrierPcm(): Buffer {
  if (!cachedCarrierPcm) {
    cachedCarrierPcm = Buffer.from(IFM_CARRIER_HADHIHI_PCM_BASE64, 'base64');
  }
  return cachedCarrierPcm;
}

/**
 * Frames an isolated single-word 16kHz 16-bit mono WAV with the acoustic carrier ("هَذِهِ:")
 * and repeats the trimmed word utterance twice so IFM/Jais-ASR's sentence-level VAD
 * never falsely rejects sub-second single-word recordings as no_speech.
 */
export function frameSingleWordWithCarrier(wavBytes: Buffer): Buffer {
  if (!wavBytes || wavBytes.length <= 2000) return wavBytes;
  const dataIdx = wavBytes.indexOf('data');
  const startOffset = dataIdx >= 0 ? dataIdx + 8 : 44;
  if (startOffset >= wavBytes.length) return wavBytes;

  const pcm = wavBytes.subarray(startOffset);
  const totalSamples = Math.floor(pcm.length / 2);
  if (totalSamples < 1600) return wavBytes;

  // Find active speech region using 20ms windows (320 samples at 16kHz)
  const winSize = 320;
  const numWins = Math.floor(totalSamples / winSize);
  let maxWinRms = 0;
  const winRms = new Float32Array(numWins);

  for (let w = 0; w < numWins; w++) {
    let sumSq = 0;
    const base = w * winSize * 2;
    for (let s = 0; s < winSize; s++) {
      const val = pcm.readInt16LE(base + s * 2);
      sumSq += val * val;
    }
    const r = Math.sqrt(sumSq / winSize);
    winRms[w] = r;
    if (r > maxWinRms) maxWinRms = r;
  }

  // If the entire buffer is very quiet background noise, don't frame
  const threshold = Math.max(350, maxWinRms * 0.12);
  let firstWin = 0;
  let lastWin = numWins - 1;
  while (firstWin < numWins && winRms[firstWin] < threshold) firstWin++;
  while (lastWin > firstWin && winRms[lastWin] < threshold) lastWin--;

  // Add 160ms (8 windows) lead-in and 200ms (10 windows) tail around active speech
  const startSample = Math.max(0, (firstWin - 8) * winSize);
  const endSample = Math.min(totalSamples, (lastWin + 11) * winSize);
  const trimmedWordPcm =
    endSample - startSample >= 2400
      ? pcm.subarray(startSample * 2, endSample * 2)
      : pcm;

  const carrierPcm = getCarrierPcm();
  const pause1 = Buffer.alloc(16000 * 2 * 0.14); // 140ms pause after carrier
  const pause2 = Buffer.alloc(16000 * 2 * 0.22); // 220ms pause between repetitions
  const combinedPcm = Buffer.concat([carrierPcm, pause1, trimmedWordPcm, pause2, trimmedWordPcm]);

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + combinedPcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(combinedPcm.length, 40);

  return Buffer.concat([header, combinedPcm]);
}

const CARRIER_SKELETONS = new Set(['هذه', 'هذ', 'هذا', 'هذي', 'هاذه', 'اهلا']);
const DIACRITICS_REGEX = /[\u064B-\u065F\u0670]/g;

function skeletonOfToken(tok: string): string {
  return tok
    .normalize('NFC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

function countDiacritics(tok: string): number {
  const m = tok.match(DIACRITICS_REGEX);
  return m ? m.length : 0;
}

/**
 * Strips the leading carrier token ("هَذِهِ:") and collapses the 2x repeated word
 * into a single clean spoken word (picking the repetition with richer diacritics).
 */
export function stripCarrierAndCollapseSingleWord(rawText: string): string {
  const cleaned = (rawText || '')
    .normalize('NFC')
    .replace(/[.,!?،؟؛:"«»()[\]{}…\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  const tokens = cleaned.split(' ').filter(Boolean);
  while (tokens.length > 0 && CARRIER_SKELETONS.has(skeletonOfToken(tokens[0]))) {
    tokens.shift();
  }
  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0];

  // If 2 tokens from the 2x repetition share the same skeleton, pick the one with more diacritics
  if (tokens.length === 2) {
    const s0 = skeletonOfToken(tokens[0]);
    const s1 = skeletonOfToken(tokens[1]);
    if (s0 === s1) {
      return countDiacritics(tokens[1]) > countDiacritics(tokens[0]) ? tokens[1] : tokens[0];
    }
  }

  // If even number of tokens where first half equals second half (e.g. multi-word utterance repeated 2x)
  if (tokens.length % 2 === 0) {
    const half = tokens.length / 2;
    let sameHalves = true;
    for (let i = 0; i < half; i++) {
      if (skeletonOfToken(tokens[i]) !== skeletonOfToken(tokens[i + half])) {
        sameHalves = false;
        break;
      }
    }
    if (sameHalves) {
      return tokens
        .slice(0, half)
        .map((t, i) => (countDiacritics(tokens[i + half]) > countDiacritics(t) ? tokens[i + half] : t))
        .join(' ');
    }
  }

  // Collapse any consecutive tokens with identical skeleton
  const deduped: string[] = [];
  for (const tok of tokens) {
    if (deduped.length > 0 && skeletonOfToken(deduped[deduped.length - 1]) === skeletonOfToken(tok)) {
      if (countDiacritics(tok) > countDiacritics(deduped[deduped.length - 1])) {
        deduped[deduped.length - 1] = tok;
      }
    } else {
      deduped.push(tok);
    }
  }
  return deduped.join(' ');
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

  const rawAudioBytes = Buffer.from(args.audioWavBase64, 'base64');

  // Skip truly zero-signal buffers immediately
  if (isAudioPracticallySilent(rawAudioBytes)) {
    console.log(`[IFM ASR] Pre-filter: audio is zero-signal, skipping API call`);
    return {
      transcript: '',
      isSilent: true,
      language: null,
      sourceModel: 'ifm/jais-asr',
    };
  }

  const { normalized, maxPeak, rms, gainApplied } = normalizePcmWavBuffer(rawAudioBytes);
  console.log(`[IFM ASR] Received audio: ${rawAudioBytes.length} bytes, peak=${maxPeak}, rms=${Math.round(rms)}, gain=${gainApplied.toFixed(2)}x`);

  // After de-clicking start/end 60ms, if the remaining audio is only dead room noise, skip
  if (rms < 35 && maxPeak < 180) {
    console.log(`[IFM ASR] Pre-filter: de-clicked audio has no speech energy (peak=${maxPeak}, rms=${Math.round(rms)})`);
    return {
      transcript: '',
      isSilent: true,
      language: null,
      sourceModel: 'ifm/jais-asr',
    };
  }

  const isSingleWordMode = args.mode !== 'passage';
  const payloadWavBytes = isSingleWordMode ? frameSingleWordWithCarrier(normalized) : normalized;

  return executeWithIfmRateLimit(async () => {
    const maxRetries = 3;
    const blob = new Blob([new Uint8Array(payloadWavBytes)], { type: 'audio/wav' });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const form = new FormData();
      form.append('file', blob, 'recording.wav');
      form.append('model', 'IFM/Jais-ASR');
      form.append('language', args.language === 'ar-EG' ? 'ar' : 'ar');
      form.append('diacritics', 'true');

      const timeoutMs = args.mode === 'passage' ? 30000 : 12000;
      console.log(`[IFM ASR] Sending request attempt ${attempt}/${maxRetries}, mode=${args.mode || 'word'}, payload=${payloadWavBytes.length}b`);
      const res = await fetch('https://api.ifm.ai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${effectiveKey}`,
        },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
        const retryAfter = res.headers.get('retry-after');
        const resetReqs = res.headers.get('x-ratelimit-reset-requests');
        let waitMs = 1100;
        if (retryAfter && Number(retryAfter)) {
          waitMs = Math.round(Number(retryAfter) * 1000) + 150;
        } else if (resetReqs && /^\d+s?$/.test(resetReqs)) {
          waitMs = parseInt(resetReqs, 10) * 1000 + 150;
        }
        console.warn(`[IFM ASR] HTTP ${res.status} hit. Pacing wait ${waitMs}ms (attempt ${attempt}/${maxRetries})...`);
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
      const cleanedText = isSingleWordMode ? stripCarrierAndCollapseSingleWord(rawText) : rawText;
      const isSilent = noSpeech || cleanedText.length === 0;
      console.log(`[IFM ASR] Response: raw="${rawText}" -> cleaned="${cleanedText}", no_speech=${noSpeech}, isSilent=${isSilent}`);

      if (isSilent) {
        return {
          transcript: '',
          isSilent: true,
          language: payload.language ?? null,
          sourceModel: 'ifm/jais-asr',
          rawResponse: payload,
        };
      }

      let finalTranscript = cleanedText;
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
