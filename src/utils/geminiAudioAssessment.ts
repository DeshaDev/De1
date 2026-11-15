/**
 * Evaluation of Arabic child speech and reading using Google Gemini Multimodal Audio
 * (Direct Google Generative Language API or OpenRouter Multimodal Gateway).
 * Serves as a side-by-side comparative engine against Microsoft Azure Pronunciation Assessment.
 */

export type GeminiWordError = 'None' | 'Mispronunciation' | 'Substitution' | 'Omission' | 'Insertion';

export interface GeminiAlignedWord {
  word: string;
  spokenWord: string | null;
  errorType: GeminiWordError;
  accuracyScore: number | null;
  notesAr: string;
}

export interface GeminiAudioAssessmentResult {
  sourceModel: string;
  transcript: string;
  wordAccuracyPercent: number | null;
  wordsCount: number;
  correctWordsCount: number;
  substitutionsCount: number;
  omissionsCount: number;
  insertionsCount: number;
  words: GeminiAlignedWord[];
  insertions: string[];
  phoneticObservationsAr: string;
  nonwordAnalysisAr: string;
  summaryAr: string;
  rawResponse?: Record<string, unknown>;
}

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim() === '') {
    return null;
  }
  return key.trim();
}

export function getOpenRouterApiKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key === 'MY_OPENROUTER_API_KEY' || key.trim() === '') {
    return null;
  }
  return key.trim();
}

/**
 * Parses structured JSON response from Gemini / OpenRouter and aligns it to reference tokens.
 */
function parseGeminiJsonPayload(
  rawText: string,
  refWords: string[],
  sourceModel: string
): GeminiAudioAssessmentResult {
  let parsed: any;
  try {
    const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    throw new Error(`GEMINI_INVALID_JSON: ${String(parseErr)}`);
  }

  const parsedWords = Array.isArray(parsed.words) ? parsed.words : [];
  const alignedWords: GeminiAlignedWord[] = refWords.map((refWord, index) => {
    const match = parsedWords[index] || parsedWords.find((w: any) => w.word === refWord);
    if (match) {
      const rawType = String(match.errorType || 'None').trim();
      const validTypes: GeminiWordError[] = ['None', 'Mispronunciation', 'Substitution', 'Omission', 'Insertion'];
      const errorType: GeminiWordError = validTypes.includes(rawType as GeminiWordError)
        ? (rawType as GeminiWordError)
        : (match.accuracyScore && match.accuracyScore < 70 ? 'Mispronunciation' : 'None');

      return {
        word: refWord,
        spokenWord: typeof match.spokenWord === 'string' ? match.spokenWord : null,
        errorType,
        accuracyScore: typeof match.accuracyScore === 'number'
          ? Math.max(0, Math.min(100, Math.round(match.accuracyScore)))
          : null,
        notesAr: typeof match.notesAr === 'string' ? match.notesAr : '',
      };
    }
    return {
      word: refWord,
      spokenWord: null,
      errorType: 'Omission',
      accuracyScore: 0,
      notesAr: 'لم تظهر الكلمة في تقييم النموذج.',
    };
  });

  const correctCount = alignedWords.filter((w) => w.errorType === 'None').length;
  const subCount = alignedWords.filter((w) => w.errorType === 'Substitution').length;
  const omCount = alignedWords.filter((w) => w.errorType === 'Omission').length;
  const insertions = Array.isArray(parsed.insertions) ? parsed.insertions.map(String) : [];

  const rawAccuracy = typeof parsed.wordAccuracyPercent === 'number'
    ? parsed.wordAccuracyPercent
    : Math.round((correctCount / Math.max(1, alignedWords.length)) * 100);

  return {
    sourceModel,
    transcript: String(parsed.transcript || '').trim(),
    wordAccuracyPercent: Math.max(0, Math.min(100, Math.round(rawAccuracy))),
    wordsCount: alignedWords.length,
    correctWordsCount: correctCount,
    substitutionsCount: subCount,
    omissionsCount: omCount,
    insertionsCount: insertions.length,
    words: alignedWords,
    insertions,
    phoneticObservationsAr: String(parsed.phoneticObservationsAr || '').trim(),
    nonwordAnalysisAr: String(parsed.nonwordAnalysisAr || '').trim(),
    summaryAr: String(parsed.summaryAr || '').trim(),
    rawResponse: parsed,
  };
}

/**
 * Calls OpenRouter chat completions API with Gemini multimodal audio input.
 */
async function evaluateViaOpenRouter(args: {
  apiKey: string;
  audioWavBase64: string;
  prompt: string;
  refWords: string[];
  model?: string;
}): Promise<GeminiAudioAssessmentResult> {
  const model = args.model || 'google/gemini-2.5-flash';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Baseera Arabic Reading Lab',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: args.prompt },
            {
              type: 'input_audio',
              input_audio: {
                data: args.audioWavBase64,
                format: 'wav',
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OPENROUTER_HTTP_${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('OPENROUTER_EMPTY_RESPONSE');
  }

  return parseGeminiJsonPayload(rawText, args.refWords, `${model} (OpenRouter)`);
}

/**
 * Assesses an Arabic speech recording (PCM WAV 16kHz) against a reference text using Google Gemini.
 */
export async function assessReadingAudioWithGemini(args: {
  referenceText: string;
  referenceWords?: string[];
  audioWavBase64: string;
  durationSeconds?: number;
  language?: 'ar-EG' | 'ar-SA';
  apiKey?: string;
}): Promise<GeminiAudioAssessmentResult> {
  const cleanRef = (args.referenceText || '').trim();
  if (!cleanRef) {
    throw new Error('INVALID_REFERENCE_TEXT');
  }
  if (!args.audioWavBase64 || args.audioWavBase64.length > 6_000_000) {
    throw new Error('INVALID_AUDIO_PAYLOAD');
  }

  const userKey = (args.apiKey && args.apiKey.trim()) || '';
  const geminiKey = userKey && !userKey.startsWith('sk-or-') ? userKey : getGeminiApiKey();
  const openRouterKey = userKey && userKey.startsWith('sk-or-') ? userKey : getOpenRouterApiKey();

  if (!geminiKey && !openRouterKey) {
    throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
  }

  const refWords = args.referenceWords && args.referenceWords.length > 0
    ? args.referenceWords
    : cleanRef.split(/\s+/).filter(Boolean);

  const dialectNote = 'اللغة المستهدفة: العربية الفصحى المعيارية (Modern Standard Arabic / MSA / ar-SA) بقواعد النطق القرائي السليم وحركات التشكيل والسكون والتنوين ومخارج الحروف الفصيحة الدقيقة دون اعتداد بأي لهجة عامية.';

  const prompt = `أنت خبير لغوي متخصص في تقييم القراءة والنطق للأطفال باللغة العربية، وتعمل كمحرك فحص لعسر القراءة وصعوبات التعلم.
${dialectNote}

النص المرجعي المطلوب من المتحدث قراءته (مع التشكيل أو السكون المستهدف):
"${cleanRef}"

قائمة الكلمات المرجعية بالترتيب:
${JSON.stringify(refWords, null, 2)}

المطلوب بدقة متناهية وفحص صوتي صارم:
1. استمع للتسجيل الصوتي المرفق واكتب التفريغ الحرفي الدقيق لما نُطق به حرفيًا (transcript) مع كامل التشكيل والتنوين المسموع.
2. التدقيق في الحركات والتنوين والسكون (التقييم الفونولوجي الدقيق):
   - إذا كان النص المرجعي ينتهي بسكون (مثل «كِتَابْ») ونطق المتحدث بتنوين (مثل «كِتَابٌ» أو «كِتَابًا» أو «كِتَابٍ») أو العكس، فيجب رصد هذا الفارق صراحة واعتباره خطأ تشكيل أو زيادة تنوين (errorType: "Mispronunciation") وخفض درجة الدقة (مثلاً 60-70%) وتوضيح ذلك في حقل notesAr.
   - إذا نطق الكلمة بحركة مغايرة في الحروف الداخلية (مثل فَتَحَ بدلاً من فُتِحَ) -> errorType: "Mispronunciation".
   - إذا نطق الكلمة سليمة تمامًا بجميع حروفها وحركاتها وسكونها وتنوينها المطابق للمرجع -> errorType: "None" ودقة 95-100%.
   - إذا استبدلها بكلمة أخرى -> errorType: "Substitution".
   - إذا حذفها -> errorType: "Omission".
3. رصد الكلمات المصنوعة (Nonwords): إذا كان النص المرجعي يحتوي كلمات غير حقيقية (مثل ملس، فرت، درك)، هل نطقها المتحدث بفك الترميز النقي، أم صححها تلقائيًا لكلمات مألوفة؟
4. أي كلمات أو أصوات زائدة نطق بها ولم تكن في النص المرجعي (insertions).
5. ملاحظات صوتية دقيقة على الحركات، المدود، ومخارج الحروف المتشابهة.

أرجع النتيجة بصيغة JSON حصرًا بهذا الهيكل:
{
  "transcript": "التفريغ النصي الحرفي الدقيق مع التشكيل المسموع",
  "wordAccuracyPercent": 85,
  "words": [
    {
      "word": "الكلمة المرجعية",
      "spokenWord": "ما سُمع بالضبط مع التشكيل أو null إذا حُذفت",
      "errorType": "None | Mispronunciation | Substitution | Omission",
      "accuracyScore": 90,
      "notesAr": "ملاحظات صوتية على نطق هذه الكلمة والفرق في الحركات والتنوين"
    }
  ],
  "insertions": ["أي كلمات زائدة"],
  "phoneticObservationsAr": "ملاحظات تفصيلية على مخارج الحروف والتشكيل والتنوين",
  "nonwordAnalysisAr": "تحليل نطق الكلمات المصنوعة ومدى الوقوع في فخ التصحيح التلقائي",
  "summaryAr": "ملخص تقييمي إجمالي للأداء القرائي"
}`;

  // If an OpenRouter key is available (provided directly or in .env), use OpenRouter as primary gateway
  if (openRouterKey) {
    try {
      return await evaluateViaOpenRouter({
        apiKey: openRouterKey,
        audioWavBase64: args.audioWavBase64,
        prompt,
        refWords,
      });
    } catch (openRouterErr) {
      console.warn('[GeminiAudio] OpenRouter request failed, checking fallback to direct Gemini:', openRouterErr);
      if (!geminiKey) {
        throw openRouterErr;
      }
    }
  }

  // Otherwise, try direct Google Generative Language API
  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ];

  let lastError: Error | null = null;
  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/wav',
                    data: args.audioWavBase64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
        signal: AbortSignal.timeout(28000),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 402) {
          // If OpenRouter fallback is available, seamless switch!
          if (openRouterKey) {
            return evaluateViaOpenRouter({
              apiKey: openRouterKey,
              audioWavBase64: args.audioWavBase64,
              prompt,
              refWords,
            });
          }
          throw new Error('GEMINI_HTTP_402: رصيد المفتاح الحالي منتهٍ في Google AI Studio (Prepayment Depleted). يمكنك استخدام مفتاح OpenRouter أو مفتاح مجاني.');
        }
        if (res.status === 400 && errorText.includes('API_KEY_INVALID')) {
          throw new Error('GEMINI_API_KEY_INVALID: مفتاح Google Gemini غير صالح أو منتهي الصلاحية.');
        }
        throw new Error(`GEMINI_HTTP_${res.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('GEMINI_EMPTY_RESPONSE');
      }

      return parseGeminiJsonPayload(rawText, refWords, `google/${model}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // If 402 or key issue and OpenRouter is available, route to OpenRouter immediately
      if (openRouterKey && (String(lastError.message).includes('402') || String(lastError.message).includes('Prepayment'))) {
        return evaluateViaOpenRouter({
          apiKey: openRouterKey,
          audioWavBase64: args.audioWavBase64,
          prompt,
          refWords,
        });
      }
      if (!String(lastError.message).includes('404') && !String(lastError.message).includes('NOT_FOUND')) {
        break;
      }
    }
  }

  // Final fallback to OpenRouter if configured
  if (openRouterKey) {
    return evaluateViaOpenRouter({
      apiKey: openRouterKey,
      audioWavBase64: args.audioWavBase64,
      prompt,
      refWords,
    });
  }

  throw lastError || new Error('GEMINI_EVALUATION_FAILED');
}
