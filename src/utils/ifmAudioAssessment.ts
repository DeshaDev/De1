/**
 * Institute of Foundation Models (IFM / Jais) Speech & Reading Assessment Engine:
 *
 * 1. Automatic Speech Recognition (ASR):
 *    - Model: IFM/Jais-ASR (via https://api.ifm.ai/v1/audio/transcriptions)
 *    - Purpose-built for Arabic phonetics, Modern Standard Arabic (MSA), and regional dialects
 *    - Native silence & non-speech detection ('no_speech': true)
 *    - Zero confirmation bias / hallucination (pure blind acoustic model)
 *
 * 2. Native Arabic Pedagogical & Phonetic Diagnosis:
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
};

function quickLatinToArabicPhonetics(text: string): string {
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
 * into authentic diacritized Arabic script using Jais-3, with instant phonetic fallback.
 */
export async function transliterateLatinToArabicWithJais(
  latinText: string,
  apiKey: string
): Promise<string> {
  const clean = (latinText || '').trim();
  if (!clean || !/[a-zA-Z]/.test(clean)) {
    return clean;
  }

  // Instant 0ms return for known nonwords and syllables
  const directMatch = PHONETIC_ARABIC_MAP[clean.toLowerCase()];
  if (directMatch) {
    return directMatch;
  }

  const fallback = quickLatinToArabicPhonetics(clean);

  try {
    const res = await fetch('https://api.ifm.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'IFM/Jais-3-MoVA-36B-A4B',
        messages: [
          {
            role: 'system',
            content:
              'حول أي تفريغ صوتي بحروف لاتينية إلى كلمات وحروف عربية مشكولة بدقة صوتية للأطفال. أرجع الكلمة العربية فقط دون أي شرح أو مقدمات أو علامات إضافية.',
          },
          { role: 'user', content: clean },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        const arOnly = content.replace(/[`*]/g, '').trim().split(/\s+/)[0];
        if (arOnly && /[\u0600-\u06FF]/.test(arOnly)) {
          return arOnly;
        }
      }
    }
  } catch (err) {
    console.warn('[IFM] Transliteration fallback warning:', err);
  }

  return fallback;
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

  const audioBytes = Buffer.from(args.audioWavBase64, 'base64');
  const blob = new Blob([audioBytes], { type: 'audio/wav' });

  const form = new FormData();
  form.append('file', blob, 'recording.wav');
  form.append('model', 'IFM/Jais-ASR');
  form.append('language', args.language === 'ar-EG' ? 'ar' : 'ar');

  const timeoutMs = args.mode === 'passage' ? 25000 : 10000;
  const res = await fetch('https://api.ifm.ai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${effectiveKey}`,
    },
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`IFM_ASR_HTTP_${res.status}: ${errorText.slice(0, 200)}`);
  }

  const payload: any = await res.json();
  const rawText = typeof payload.text === 'string' ? payload.text.trim() : '';
  const noSpeech = payload.no_speech === true;
  const isSilent = noSpeech || rawText.length === 0;

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
    finalTranscript = await transliterateLatinToArabicWithJais(finalTranscript, effectiveKey);
  }

  return {
    transcript: finalTranscript,
    isSilent: false,
    language: payload.language ?? null,
    sourceModel: 'ifm/jais-asr',
    rawResponse: payload,
  };
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
}
