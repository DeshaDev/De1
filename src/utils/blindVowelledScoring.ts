/**
 * Two-stage Blind Arabic Phonological Assessment Engine (IFM Only):
 *
 * Stage 1 (Blind Transcription): Sends ONLY the raw audio to IFM/Jais-ASR
 * WITHOUT revealing the reference text — eliminating confirmation bias / prior hallucination
 * where models "hear" the expected word even when a child misreads a vowel or nonword.
 * Strict IFM-only policy: never falls back to Google Gemini, OpenRouter, or Azure.
 *
 * Stage 2 (Deterministic Arabic Phonological Scoring): Pure deterministic comparator
 * that inspects consonant skeleton, internal short vowels (e.g., كَتَبَ vs كُتُب),
 * Arabic pausal reading (الوقف بالسكون), and final case/tanween endings (e.g., بَيْتُ vs بَيْتًا).
 */

import { getIfmApiKey, transcribeArabicWithJaisAsr } from './ifmAudioAssessment';
import {
  sanitizeArabicTranscriptText,
  type AzureAlignedWord,
  type AzureAudioAssessmentResult,
  type AzureWordError,
} from './azurePronunciationAssessment';

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
  const normalizedNoPunct = (blindSpokenRaw || '').normalize('NFC').replace(PUNCT_AND_TATWEEL, ' ').replace(/\s+/g, ' ').trim();
  const cleanSpoken = sanitizeArabicTranscriptText(normalizedNoPunct);

  if (!normalizedNoPunct || normalizedNoPunct === 'SILENCE' || normalizedNoPunct === 'صمت' || !cleanSpoken) {
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

  // Pausal taa marbuta whose soft «ـهْ» was not transcribed: دَجَاجَة read «دَجَاجَـهْ» often comes
  // back as «دَجَاجَ». The fatha on the last letter shows the word went on to the taa; «دَجَاجْ»
  // (sukun or no vowel) is the different word دجاج, a real reading error, and stays one.
  if (
    expUnits.length >= 2 &&
    expUnits[expUnits.length - 1].letter === 'ة' &&
    spkCons === expCons.slice(0, -1) &&
    spkUnits.length === expUnits.length - 1 &&
    spkUnits[spkUnits.length - 1].vowel === 'a'
  ) {
    spkUnits.push({ ...expUnits[expUnits.length - 1], vowel: '0' });
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

/**
 * Transcribes child speech strictly BLIND via IFM/Jais-ASR ONLY.
 * ZERO reference text is sent, and ZERO fallback to Gemini, OpenRouter, or Azure is permitted.
 */
export async function transcribeArabicBlind(args: {
  audioWavBase64: string;
  apiKey?: string;
  /** 'passage' transcribes a whole reading (story, list of names) instead of one word. */
  mode?: 'word' | 'passage';
}): Promise<BlindTranscriptionResult> {
  if (!args.audioWavBase64 || args.audioWavBase64.length > 6_000_000) {
    throw new Error('INVALID_AUDIO_PAYLOAD');
  }

  const userKey = (args.apiKey && args.apiKey.trim()) || '';
  const ifmKey = userKey || getIfmApiKey();
  if (!ifmKey) {
    throw new Error('IFM_API_KEY_NOT_CONFIGURED');
  }

  const res = await transcribeArabicWithJaisAsr({
    audioWavBase64: args.audioWavBase64,
    apiKey: ifmKey,
    mode: args.mode,
  });
  return {
    transcript: res.transcript,
    isSilent: res.isSilent,
    sourceModel: 'blind:ifm/jais-asr',
  };
}

/** Backwards-compatible alias preserved for existing imports; strictly routes to IFM/Jais-ASR only. */
export const transcribeArabicBlindWithGemini = transcribeArabicBlind;

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
    transcript: score.spokenWord || (isOmission ? '(صمت)' : score.word),
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


const skeleton = (w: string) =>
  w.normalize('NFC').replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/^ال/, '');

/**
 * Score a whole reading from a blind (reference-free) vowelled transcript. Spoken words are
 * aligned to the text by their letters; each aligned pair is then scored letter by letter and
 * vowel by vowel (scoreBlindSingleWordArabic). Text words with no spoken match are omissions;
 * spoken words with no text match are insertions.
 */
export function scoreBlindPassageArabic(args: {
  referenceWords: string[];
  blindTranscript: string;
  durationSeconds: number;
}): AzureAudioAssessmentResult {
  const ref = args.referenceWords;
  const sanitized = sanitizeArabicTranscriptText(
    args.blindTranscript.normalize('NFC').replace(PUNCT_AND_TATWEEL, ' ')
  );
  const spoken = sanitized ? sanitized.split(/\s+/).filter(Boolean) : [];
  const rs = ref.map(skeleton);
  const ss = spoken.map(skeleton);
  const subCost = (i: number, j: number) => {
    if (rs[i] === ss[j]) return 0;
    const d = levenshtein(rs[i], ss[j]);
    return d <= Math.max(1, Math.floor(rs[i].length / 3)) ? 0.6 : 1.4;
  };
  const n = ref.length, m = spoken.length;
  const dp: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + subCost(i - 1, j - 1));
  }
  const pairs: Array<number | null> = new Array(n).fill(null);
  let insertions = 0;
  for (let i = n, j = m; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + subCost(i - 1, j - 1))) < 1e-9) { pairs[i - 1] = j - 1; i--; j--; }
    else if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + 1)) < 1e-9) { i--; }
    else { insertions++; j--; }
  }

  const words: AzureAlignedWord[] = ref.map((word, i) => {
    const j = pairs[i];
    if (j === null) {
      return { word, errorType: 'Omission', accuracyScore: 0, spokenWord: null, notesAr: 'لم تُقرأ هذه الكلمة.' };
    }
    const score = scoreBlindSingleWordArabic(word, spoken[j]);
    return { word, errorType: score.errorType, accuracyScore: score.accuracyScore, spokenWord: score.spokenWord, notesAr: score.notesAr };
  });
  const correct = words.filter((w) => w.errorType === 'None' || w.errorType === 'DialectVariant').length;
  const omissions = words.filter((w) => w.errorType === 'Omission').length;
  const substitutions = words.length - correct - omissions;
  const minutes = Math.max(1, args.durationSeconds) / 60;
  const percent = n > 0 ? Math.round((correct / n) * 100) : 0;
  return {
    sourceModel: 'azure_pronunciation_assessment',
    assessmentMode: 'short-audio-miscue',
    assessmentComplete: true,
    transcript: spoken.join(' '),
    accuracyScore: percent,
    wordAccuracyPercent: percent,
    fluencyScore: null,
    completenessScore: n > 0 ? Math.round(((n - omissions) / n) * 100) : 0,
    pronScore: percent,
    wordsCount: n,
    correctWordsCount: correct,
    substitutionsCount: substitutions,
    omissionsCount: omissions,
    insertionsCount: insertions,
    wordsPerMinute: Math.round(m / minutes),
    wordsCorrectPerMinute: Math.round(correct / minutes),
    words,
  };
}
