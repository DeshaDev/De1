/**
 * Two-stage Blind Arabic Phonological Assessment Engine:
 *
 * Stage 1 (Blind Transcription): Sends ONLY the raw audio to a multimodal model
 * WITHOUT revealing the reference text — eliminating confirmation bias / prior hallucination
 * where models "hear" the expected word even when a child misreads a vowel or nonword.
 *
 * Stage 2 (Deterministic Arabic Phonological Scoring): Pure deterministic comparator
 * that inspects consonant skeleton, internal short vowels (e.g., كَتَبَ vs كُتُب),
 * Arabic pausal reading (الوقف بالسكون), and final case/tanween endings (e.g., بَيْتُ vs بَيْتًا).
 */

import { getGeminiApiKey, getOpenRouterApiKey } from './geminiAudioAssessment';
import type { AzureAlignedWord, AzureAudioAssessmentResult, AzureWordError } from './azurePronunciationAssessment';

export type ArabicVowel = 'a' | 'u' | 'i' | 'an' | 'un' | 'in' | '0' | null;

export interface ParsedArabicUnit {
  letter: string;
  vowel: ArabicVowel;
  shaddah: boolean;
}

export interface BlindTranscriptionResult {
  transcript: string;
  isSilent: boolean;
  sourceModel: string;
}

export interface BlindWordScore {
  word: string;
  spokenWord: string | null;
  errorType: AzureWordError;
  accuracyScore: number;
  notesAr: string;
  mismatchKind: 'exact' | 'pause' | 'silence' | 'substitution' | 'letter_swap' | 'internal_vowel' | 'final_case';
}

const ARABIC_BASE_LETTER = /[\u0621-\u064A\u0671]/;
const DIACRITIC_SET = /[\u064B-\u065F\u0670]/;
const PUNCT_AND_TATWEEL = /[.,!?،؟؛:"«»()[\]{}…\-–—\u0640]/g;

function normalizeConsonantChar(ch: string): string {
  if (ch === 'أ' || ch === 'إ' || ch === 'آ' || ch === 'ٱ') return 'ا';
  return ch;
}

function vowelFromMark(mark: string): ArabicVowel {
  switch (mark) {
    case '\u064E': return 'a';  // فتحة
    case '\u064F': return 'u';  // ضمة
    case '\u0650': return 'i';  // كسرة
    case '\u064B': return 'an'; // تنوين فتح
    case '\u064C': return 'un'; // تنوين ضم
    case '\u064D': return 'in'; // تنوين كسر
    case '\u0652': return '0';  // سكون
    default: return null;
  }
}

export function vowelNameAr(v: ArabicVowel): string {
  switch (v) {
    case 'a': return 'الفتحة';
    case 'u': return 'الضمة';
    case 'i': return 'الكسرة';
    case 'an': return 'تنوين الفتح';
    case 'un': return 'تنوين الضم';
    case 'in': return 'تنوين الكسر';
    case '0': return 'السكون';
    default: return 'بدون حركة';
  }
}

/**
 * Parses a single Arabic word into base letters with attached short vowel & shaddah state.
 * Folds trailing silent tanween-alif (e.g. بَيْتًا / بيتاً) onto the preceding consonant as vowel='an'.
 */
export function parseArabicWordUnits(rawWord: string): ParsedArabicUnit[] {
  const clean = (rawWord || '').normalize('NFC').replace(PUNCT_AND_TATWEEL, '').trim();
  const units: ParsedArabicUnit[] = [];

  for (const ch of clean) {
    if (ARABIC_BASE_LETTER.test(ch)) {
      units.push({ letter: ch, vowel: null, shaddah: false });
    } else if (DIACRITIC_SET.test(ch) && units.length > 0) {
      const current = units[units.length - 1];
      if (ch === '\u0651') {
        current.shaddah = true;
      } else {
        const v = vowelFromMark(ch);
        if (v !== null) current.vowel = v;
      }
    }
  }

  // Fold tanween fat-h trailing alif:
  // Pattern 1: بَيْتًا -> [..., {letter:'ت', vowel:'an'}, {letter:'ا', vowel:null}]
  // Pattern 2: بيتاً -> [..., {letter:'ت', vowel:null}, {letter:'ا', vowel:'an'}]
  if (units.length >= 2) {
    const last = units[units.length - 1];
    const prev = units[units.length - 2];
    if (last.letter === 'ا' && !last.shaddah) {
      if (prev.vowel === 'an' && last.vowel === null) {
        units.pop();
      } else if (last.vowel === 'an' && prev.vowel === null) {
        prev.vowel = 'an';
        units.pop();
      }
    }
  }

  return units;
}

function consonantSkeleton(units: ParsedArabicUnit[]): string {
  return units.map((u) => normalizeConsonantChar(u.letter)).join('');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * Deterministically evaluates a blindly transcribed Arabic utterance against a fully vowelled
 * target word. Distinguishes:
 * - Complete substitution (e.g. كتاب vs قَلَمُ, دارفيل vs فِيلُ)
 * - Single-letter substitution (e.g. صَيْف vs سَيْف)
 * - Internal short-vowel error (e.g. كُتُب vs كَتَبَ)
 * - Final case/tanween mismatch (e.g. بَيْتًا vs بَيْتُ)
 * - Valid Arabic pausal reading (e.g. بَيْتْ vs بَيْتُ)
 * - Exact vowelled reading (e.g. بَيْتُ vs بَيْتُ, بَيْتُو vs بَيْتُ)
 */
export function scoreBlindSingleWordArabic(expectedWord: string, blindSpokenRaw: string | null): BlindWordScore {
  const cleanSpoken = (blindSpokenRaw || '').normalize('NFC').replace(PUNCT_AND_TATWEEL, ' ').replace(/\s+/g, ' ').trim();

  if (!cleanSpoken || cleanSpoken === 'SILENCE' || cleanSpoken === 'صمت') {
    return {
      word: expectedWord,
      spokenWord: null,
      errorType: 'Omission',
      accuracyScore: 0,
      notesAr: 'لم يُلتقط صوت واضح للكلمة؛ صمت أو صوت منخفض جدًا.',
      mismatchKind: 'silence',
    };
  }

  // Collapse exact consecutive duplicate tokens (e.g. "فِيلُ فِيلُ" -> "فِيلُ")
  const rawTokens = cleanSpoken.split(/\s+/).filter(Boolean);
  const dedupedTokens = rawTokens.filter((t, i) => i === 0 || t !== rawTokens[i - 1]);
  const displaySpoken = dedupedTokens.join(' ');

  // Multi-word utterance against a single target word (e.g. "دار فيل" vs "فِيلُ")
  if (dedupedTokens.length > 1) {
    return {
      word: expectedWord,
      spokenWord: displaySpoken,
      errorType: 'Substitution',
      accuracyScore: 0,
      notesAr: `استبدال كلمة؛ سُمع «${displaySpoken}» بدلًا من «${expectedWord}».`,
      mismatchKind: 'substitution',
    };
  }

  const expUnits = parseArabicWordUnits(expectedWord);
  const spkUnits = parseArabicWordUnits(displaySpoken);

  if (spkUnits.length === 0) {
    return {
      word: expectedWord,
      spokenWord: null,
      errorType: 'Omission',
      accuracyScore: 0,
      notesAr: 'لم يُلتقط صوت واضح للكلمة؛ صمت أو صوت منخفض جدًا.',
      mismatchKind: 'silence',
    };
  }

  let expCons = consonantSkeleton(expUnits);
  let spkCons = consonantSkeleton(spkUnits);

  // Check phonetic vowel elongation on final consonant:
  // 1) "بيتا" (unmarked tanween alif) against "بَيْتُ" -> fold trailing 'ا' as final vowel='an'
  if (
    spkUnits.length === expUnits.length + 1 &&
    spkCons.slice(0, -1) === expCons &&
    spkUnits[spkUnits.length - 1].letter === 'ا' &&
    expUnits[expUnits.length - 1].letter !== 'ا'
  ) {
    spkUnits.pop();
    spkUnits[spkUnits.length - 1].vowel = 'an';
    spkCons = consonantSkeleton(spkUnits);
  }

  // 2) "بيتو" (phonetic dammah elongation) against "بَيْتُ" -> fold trailing 'و' as final vowel='u'
  if (
    spkUnits.length === expUnits.length + 1 &&
    spkCons.slice(0, -1) === expCons &&
    spkUnits[spkUnits.length - 1].letter === 'و' &&
    expUnits[expUnits.length - 1].letter !== 'و'
  ) {
    spkUnits.pop();
    spkUnits[spkUnits.length - 1].vowel = 'u';
    spkCons = consonantSkeleton(spkUnits);
  }

  // 3) Pausal Taa Marbuta -> Haa at end of word (e.g., سَمَكَهْ vs سَمَكَةُ)
  const expConsPause = expCons.replace(/ة$/, 'ه');
  const spkConsPause = spkCons.replace(/ة$/, 'ه');

  if (expConsPause !== spkConsPause) {
    const dist = levenshtein(expConsPause, spkConsPause);
    if (dist === 1 && Math.abs(expConsPause.length - spkConsPause.length) === 0 && expConsPause.length >= 2) {
      return {
        word: expectedWord,
        spokenWord: displaySpoken,
        errorType: 'Substitution',
        accuracyScore: 30,
        notesAr: `إبدال حرف؛ سُمع «${displaySpoken}» بدلًا من «${expectedWord}».`,
        mismatchKind: 'letter_swap',
      };
    }
    return {
      word: expectedWord,
      spokenWord: displaySpoken,
      errorType: 'Substitution',
      accuracyScore: 0,
      notesAr: `استبدال كلمة؛ سُمع «${displaySpoken}» بدلًا من «${expectedWord}».`,
      mismatchKind: 'substitution',
    };
  }

  // Consonant skeletons match! Now inspect INTERNAL short vowels (positions 0 .. len - 2).
  // This catches reading errors like "كُتُب" for "كَتَبَ", "جُمَل" for "جَمَلُ", "فَلُ" for "فِيلُ", etc.
  const internalMismatches: Array<{ letter: string; expected: ArabicVowel; heard: ArabicVowel }> = [];
  const len = Math.min(expUnits.length, spkUnits.length);

  for (let i = 0; i < len - 1; i++) {
    const eu = expUnits[i];
    const su = spkUnits[i];

    // Skip silent definite article alif/lam-shamsiyyah & unvowelled long madd letters (ا، و، ي)
    if (eu.vowel === null) continue;
    if (su.vowel === null) continue;
    if (i === 0 && normalizeConsonantChar(eu.letter) === 'ا' && expUnits[1]?.letter === 'ل') continue;

    // Compare vowel quality
    if (eu.vowel !== su.vowel) {
      // Allow sukun vs unmarked or equivalent madd transition only when not conflicting short vowels
      internalMismatches.push({ letter: eu.letter, expected: eu.vowel, heard: su.vowel });
    }
  }

  if (internalMismatches.length > 0) {
    const first = internalMismatches[0];
    const score = internalMismatches.length === 1 ? 55 : 40;
    return {
      word: expectedWord,
      spokenWord: displaySpoken,
      errorType: 'Mispronunciation',
      accuracyScore: score,
      notesAr: `تطابقت الحروف ولكن اختلفت الحركات الداخلية (سُمع حرف «${first.letter}» بـ${vowelNameAr(first.heard)} بدلًا من ${vowelNameAr(first.expected)}: «${displaySpoken}» بدلًا من «${expectedWord}»).`,
      mismatchKind: 'internal_vowel',
    };
  }

  // Internal vowels match! Now inspect FINAL letter vowel / Arabic pausal reading.
  const lastExp = expUnits[len - 1];
  const lastSpk = spkUnits[len - 1];

  // Exact match on final vowel (or target itself has no explicit final vowel / ends in alif maqsura)
  if (lastExp.vowel === null || lastExp.vowel === lastSpk.vowel) {
    return {
      word: expectedWord,
      spokenWord: displaySpoken,
      errorType: 'None',
      accuracyScore: 100,
      notesAr: 'قراءة صحيحة ودقيقة بالحروف والتشكيل.',
      mismatchKind: 'exact',
    };
  }

  // Valid Arabic pausal reading (الوقف بالسكون على الحرف الأخير عند قراءة كلمة منفردة)
  if (lastSpk.vowel === '0' || lastSpk.vowel === null) {
    return {
      word: expectedWord,
      spokenWord: displaySpoken,
      errorType: 'None',
      accuracyScore: 95,
      notesAr: 'قراءة صحيحة للكلمة بالوقف السليم على آخرها.',
      mismatchKind: 'pause',
    };
  }

  // Speaker explicitly pronounced a DIFFERENT final vowel or tanween (e.g., بَيْتًا or بَيْتِ for بَيْتُ)
  return {
    word: expectedWord,
    spokenWord: displaySpoken,
    errorType: 'Mispronunciation',
    accuracyScore: 72,
    notesAr: `تطابقت حروف الكلمة وحركاتها الداخلية، لكن اختلفت حركة آخر الكلمة (سُمع «${displaySpoken}» بـ${vowelNameAr(lastSpk.vowel)} بدلًا من ${vowelNameAr(lastExp.vowel)} في «${expectedWord}»).`,
    mismatchKind: 'final_case',
  };
}

const BLIND_CHILD_SPEECH_PROMPT = `أنت خبير صوتيات ولغة عربية متخصص في التفريغ الصوتي الحرفي لقراءة الأطفال.
مهمتك الوحيدة هي الاستماع إلى التسجيل الصوتي المرفق وكتابة ما نطقه المتحدث **حرفيًا مع كامل التشكيل المسموع** دون أي تصحيح تلقائي أو تخمين.

قواعد صارمة جدًا:
1. اكتب الحروف والتشكيل الفعلي الذي سمعته في الصوت بالضبط (فتحة َ، ضمة ُ، كسرة ِ، سكون ْ، شدة ّ، تنوين ً ٌ ٍ).
2. المتحدث قد يقرأ كلمة حقيقية أو كلمة مصنوعة غير حقيقية (مثل: بَتَمُ، دُمَكُ، فُوبُ، شِدَفُ، زَفَكُ، بَاكِفُ) — لا تحوّل الكلمة المصنوعة أبدًا إلى كلمة عربية مألوفة! اكتب الأصوات كما سمعتها حرفيًا.
3. التزم برصد الحركات الداخلية وحركة الحرف الأخير والتنوين بدقة:
   - إذا سمعت «كُتُب» اكتب «كُتُب» ولا تصححها إلى «كَتَبَ».
   - إذا سمعت «بَيْتًا» بتنوين الفتح اكتب «بَيْتًا».
   - إذا سمعت «بَيْتُ» أو «بَيْتُو» بالضمة اكتب «بَيْتُ».
   - إذا سمعت «بَيْتْ» بالسكون الوقفي اكتب «بَيْتْ».
   - إذا سمعت «دارْفِيل» أو «كِتَاب» اكتبها كما سمعتها حرفيًا.
4. إذا كان التسجيل صامتًا أو ضوضاء فقط بلا كلام، اجعل isSilent = true و transcript = "".

أرجع JSON فقط بهذا الشكل:
{
  "transcript": "النص المسموع حرفيًا مع كامل التشكيل أو سلسلة فارغة عند الصمت",
  "isSilent": false
}`;

/**
 * Calls Gemini Multimodal Audio (OpenRouter primary, direct Gemini fallback) strictly BLIND
 * — ZERO reference text is sent to the model.
 */
export async function transcribeArabicBlindWithGemini(args: {
  audioWavBase64: string;
  apiKey?: string;
}): Promise<BlindTranscriptionResult> {
  if (!args.audioWavBase64 || args.audioWavBase64.length > 6_000_000) {
    throw new Error('INVALID_AUDIO_PAYLOAD');
  }

  const userKey = (args.apiKey && args.apiKey.trim()) || '';
  const openRouterKey = userKey.startsWith('sk-or-') ? userKey : getOpenRouterApiKey();
  const geminiKey = userKey && !userKey.startsWith('sk-or-') ? userKey : getGeminiApiKey();

  if (!openRouterKey && !geminiKey) {
    throw new Error('BLIND_ASR_KEY_NOT_CONFIGURED');
  }

  const parsePayload = (rawText: string, sourceModel: string): BlindTranscriptionResult => {
    const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleanJson);
    const transcript = typeof parsed.transcript === 'string' ? parsed.transcript.trim() : '';
    const isSilent = parsed.isSilent === true || transcript.length === 0;
    return { transcript: isSilent ? '' : transcript, isSilent, sourceModel };
  };

  // Prefer direct Google Gemini API first (zero proxy hop, ~3-6x faster than OpenRouter)
  // with thinkingBudget: 0 so Gemini 2.5 Flash skips hidden reasoning tokens for single-word ASR.
  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'audio/wav', data: args.audioWavBase64 } },
                { text: BLIND_CHILD_SPEECH_PROMPT },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0,
            maxOutputTokens: 120,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data: any = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof rawText === 'string' && rawText.trim()) {
          return parsePayload(rawText, 'blind:google/gemini-2.5-flash');
        }
      }
      if (!openRouterKey) {
        throw new Error(`BLIND_GEMINI_HTTP_${res.status}`);
      }
    } catch (directErr) {
      if (!openRouterKey) throw directErr;
    }
  }

  // Fallback to OpenRouter if direct Gemini API key is absent or transiently failed
  if (openRouterKey) {
    const model = 'google/gemini-2.5-flash';
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hayanaqra.com',
        'X-Title': 'Haya Naqra Blind Arabic Transcription',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 120,
        reasoning: { effort: 'none' },
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: BLIND_CHILD_SPEECH_PROMPT },
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
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`BLIND_OPENROUTER_HTTP_${res.status}`);
    }
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('BLIND_OPENROUTER_EMPTY_RESPONSE');
    }
    return parsePayload(content, `blind:${model}`);
  }

  throw new Error('BLIND_ASR_KEY_NOT_CONFIGURED');
}

/**
 * Wraps a blind single-word score into the standard AzureAudioAssessmentResult contract
 * expected by the screening receipt store and ReadingPlayers UI.
 */
export function buildSingleWordAssessmentFromBlindScore(args: {
  score: BlindWordScore;
  durationSeconds: number;
}): AzureAudioAssessmentResult {
  const { score, durationSeconds } = args;
  const isCorrect = score.errorType === 'None' || score.errorType === 'DialectVariant';
  const isOmission = score.errorType === 'Omission';
  const isSub = score.errorType === 'Substitution' || score.errorType === 'Mispronunciation';

  const alignedWord: AzureAlignedWord = {
    word: score.word,
    errorType: score.errorType,
    accuracyScore: score.accuracyScore,
    spokenWord: score.spokenWord,
    notesAr: score.notesAr,
  };

  return {
    sourceModel: 'azure_pronunciation_assessment',
    assessmentMode: 'short-audio-miscue',
    assessmentComplete: true,
    transcript: score.spokenWord || '',
    accuracyScore: score.accuracyScore,
    wordAccuracyPercent: isCorrect ? 100 : 0,
    fluencyScore: isOmission ? 0 : 90,
    completenessScore: isOmission ? 0 : 100,
    pronScore: score.accuracyScore,
    wordsCount: 1,
    correctWordsCount: isCorrect ? 1 : 0,
    substitutionsCount: isSub ? 1 : 0,
    omissionsCount: isOmission ? 1 : 0,
    insertionsCount: 0,
    wordsPerMinute: isOmission ? 0 : Math.round(60 / Math.max(0.5, durationSeconds)),
    wordsCorrectPerMinute: isCorrect ? Math.round(60 / Math.max(0.5, durationSeconds)) : 0,
    words: [alignedWord],
  };
}
