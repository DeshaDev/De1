/**
 * Arabic language comparison helpers for educational reading practice.
 * These heuristic outputs are exploratory, are not normed, and do not diagnose learning disorders.
 * This product contains no camera or eye-tracking workflow.
 */

// 1. ARABIC PHONETIC AND ORTHOGRAPHIC COMPARISON
// ============================================================================

export type DyslexicPatternType =
  | 'visual_mirror_reversal' // Kept for compatible output; intended for genuine visual reversal pairs such as Latin b/d or p/q
  | 'grapheme_confusion' // Arabic letter-form/dot confusions; not necessarily mirror images
  | 'phonetic_spelling' // froot -> fruit, fone -> phone, ض/ظ, س/ص
  | 'kinetic_transposition' // teh -> the, form -> from
  | 'vowel_omission_or_shift' // reedig -> reading, كتابه -> كتابة
  | 'general_orthographic';

export interface DyslexicErrorPattern {
  type: DyslexicPatternType;
  labelAr: string;
  detailAr: string;
  costApplied: number;
}

export type LinguisticVariationCategory =
  | 'exact_lexicon_match'
  | 'valid_dialect_lexical'
  | 'dialect_phonological_shift'
  | 'orthographic_convention'
  | 'phonological_or_visual_confusion';

export interface DyslexicoWordAnalysis {
  originalWord: string;
  cleanWord: string;
  isCorrect: boolean;
  variationCategory: LinguisticVariationCategory;
  variationCategoryLabelAr: string;
  requiresTeacherReview: boolean;
  contextualCautionAr: string;
  language: 'ar' | 'en';
  phoneticCodeInput: string;
  soundexCodeInput: string;
  bestCorrection: string;
  phoneticCodeTarget: string;
  standardLevenshteinDistance: number;
  weightedDyslexicDistance: number;
  similarityScorePercent: number;
  detectedPatterns: DyslexicErrorPattern[];
  candidates: {
    word: string;
    phoneticCode: string;
    standardDist: number;
    weightedDist: number;
    reasonAr: string;
  }[];
}

/**
 * Standard American Soundex (4-character phonetic hash) for English words.
 */
export function encodeSoundex(word: string): string {
  const clean = word.toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return '0000';

  const firstLetter = clean[0];
  const map: Record<string, string> = {
    B: '1',
    F: '1',
    P: '1',
    V: '1',
    C: '2',
    G: '2',
    J: '2',
    K: '2',
    Q: '2',
    S: '2',
    X: '2',
    Z: '2',
    D: '3',
    T: '3',
    L: '4',
    M: '5',
    N: '5',
    R: '6',
  };

  let code = firstLetter;
  let prevDigit = map[firstLetter] || '0';

  for (let i = 1; i < clean.length && code.length < 4; i++) {
    const ch = clean[i];
    const digit = map[ch] || '0';
    if (digit !== '0' && digit !== prevDigit) {
      code += digit;
    }
    if (!['A', 'E', 'I', 'O', 'U', 'Y', 'H', 'W'].includes(ch)) {
      prevDigit = digit;
    } else if (['A', 'E', 'I', 'O', 'U', 'Y'].includes(ch)) {
      prevDigit = '0';
    }
  }

  return (code + '0000').slice(0, 4);
}

/**
 * Double Metaphone / Dyslexic Phonetic Skeleton for English words.
 * Maps phonetically identical dyslexic spellings (e.g., "froot" & "fruit" -> "FRT",
 * "fone" & "phone" -> "FN", "kash" & "cash" -> "KX") to the same phonetic key.
 */
export function encodeDoubleMetaphoneLite(word: string): string {
  let s = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return '';

  // Normalize multi-letter dyslexic phonetic clusters first
  s = s
    .replace(/ph/g, 'f')
    .replace(/ght/g, 't')
    .replace(/gh/g, 'f')
    .replace(/^kn/g, 'n')
    .replace(/^wr/g, 'r')
    .replace(/^wh/g, 'w')
    .replace(/sh/g, 'x')
    .replace(/ch/g, 'x')
    .replace(/tch/g, 'x')
    .replace(/ck/g, 'k')
    .replace(/qu/g, 'kw')
    .replace(/oo/g, 'u')
    .replace(/ui/g, 'u')
    .replace(/ee/g, 'i')
    .replace(/ea/g, 'i')
    .replace(/ie/g, 'i')
    .replace(/ei/g, 'i');

  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1] || '';

    // Drop duplicate adjacent letters
    if (i > 0 && ch === s[i - 1]) continue;

    // Silent trailing 'e'
    if (ch === 'e' && i === s.length - 1 && s.length > 2) continue;

    // Keep initial vowel as 'A', strip internal vowels for consonant-skeleton matching
    if ('aeiouy'.includes(ch)) {
      if (i === 0) out += 'A';
      continue;
    }

    if (ch === 'c') {
      out += 'eiy'.includes(next) ? 'S' : 'K';
    } else if (ch === 'q') {
      out += 'K';
    } else if (ch === 'g') {
      out += 'eiy'.includes(next) ? 'J' : 'K';
    } else if (ch === 'z') {
      out += 'S';
    } else if (ch === 'v') {
      out += 'F';
    } else {
      out += ch.toUpperCase();
    }
  }

  return out || 'A';
}

/**
 * Arabic Phonetic & Visual-Grapheme Skeleton Encoder.
 * Normalizes Arabic emphatic/non-emphatic homophones (ض/ظ, ت/ط, س/ص, د/ذ/ز, ه/ة)
 * so phonetically spelled Arabic words match their canonical dictionary target.
 */
export function encodeArabicPhoneticSkeleton(word: string): string {
  const clean = word
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // Strip tashkeel & tatweel
    .replace(/[^\u0621-\u064A]/g, '');
  if (!clean) return '';

  const phoneticMap: Record<string, string> = {
    أ: 'ا',
    إ: 'ا',
    آ: 'ا',
    ٱ: 'ا',
    ى: 'ا',
    ئ: 'ي',
    ؤ: 'و',
    ة: 'ه',
    ط: 'ت',
    ظ: 'ض',
    ص: 'س',
    ذ: 'د',
    ز: 'د',
    ث: 'ت',
    غ: 'ع',
    خ: 'ح',
  };

  let skeleton = '';
  for (const ch of clean) {
    const mapped = phoneticMap[ch] || ch;
    if (skeleton.length === 0 || skeleton[skeleton.length - 1] !== mapped) {
      skeleton += mapped;
    }
  }
  return skeleton;
}

/**
 * Standard Wagner-Fischer Levenshtein Distance (all operations cost = 1.0).
 */
export function computeStandardLevenshtein(a: string, b: string): number {
  const s1 = a.toLowerCase().replace(/[\u064B-\u0652\u0670]/g, '');
  const s2 = b.toLowerCase().replace(/[\u064B-\u0652\u0670]/g, '');
  const m = s1.length;
  const n = s2.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

// Candidate visual-confusability pairs. Arabic dot-related pairs are grapheme confusions, not literal mirror reversals.
const VISUAL_REVERSAL_PAIRS = new Set<string>([
  'b:d',
  'd:b',
  'p:q',
  'q:p',
  'b:p',
  'p:b',
  'd:q',
  'q:d',
  'm:w',
  'w:m',
  'u:n',
  'n:u',
  // Arabic visual dot reversals
  'ب:ت',
  'ت:ب',
  'ب:ث',
  'ث:ب',
  'ت:ث',
  'ث:ت',
  'ب:ن',
  'ن:ب',
  'ت:ن',
  'ن:ت',
  'ج:ح',
  'ح:ج',
  'ج:خ',
  'خ:ج',
  'ح:خ',
  'خ:ح',
  'ر:ز',
  'ز:ر',
  'د:ذ',
  'ذ:د',
  'ف:ق',
  'ق:ف',
  'ع:غ',
  'غ:ع',
  'س:ش',
  'ش:س',
]);

// Phonetic confusion pairs (Phonological Dyslexia)
const PHONETIC_CONFUSION_PAIRS = new Set<string>([
  'c:k',
  'k:c',
  'c:s',
  's:c',
  'f:v',
  'v:f',
  's:z',
  'z:s',
  'g:j',
  'j:g',
  'o:u',
  'u:o',
  'e:i',
  'i:e',
  'a:e',
  'e:a',
  // Arabic phonetic / orthographic confusions
  'ض:ظ',
  'ظ:ض',
  'ت:ط',
  'ط:ت',
  'س:ص',
  'ص:س',
  'د:ط',
  'ط:د',
  'ذ:ز',
  'ز:ذ',
  'ث:س',
  'س:ث',
  'ه:ة',
  'ة:ه',
  'ا:أ',
  'أ:ا',
  'ا:إ',
  'إ:ا',
  'أ:إ',
  'إ:أ',
  'ي:ى',
  'ى:ي',
  'ق:ك',
  'ك:ق',
]);

/**
 * Dyslexico Weighted Damerau-Levenshtein Distance:
 * Heuristic text-similarity weights for candidate letter substitutions and transpositions.
 * These values are not empirical probabilities, educational diagnoses, or validated Arabic error weights.
 */
export function computeDyslexicoWeightedLevenshtein(
  sourceRaw: string,
  targetRaw: string
): {
  weightedDistance: number;
  standardDistance: number;
  detectedPatterns: DyslexicErrorPattern[];
} {
  // Normalize vowel clusters before DP for multi-char phonetic equivalents (like oo <-> ui in froot/fruit, ph <-> f in fone/phone)
  const normMulti = (w: string) =>
    w
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0670]/g, '')
      .replace(/oo/g, 'ū')
      .replace(/ui/g, 'ū')
      .replace(/ee/g, 'ī')
      .replace(/ea/g, 'ī')
      .replace(/ph/g, 'f');

  const s1Raw = sourceRaw.toLowerCase().replace(/[\u064B-\u0652\u0670]/g, '');
  const s2Raw = targetRaw.toLowerCase().replace(/[\u064B-\u0652\u0670]/g, '');
  const standardDistance = computeStandardLevenshtein(s1Raw, s2Raw);

  const detectedPatterns: DyslexicErrorPattern[] = [];

  if (s1Raw === s2Raw) {
    return { weightedDistance: 0, standardDistance: 0, detectedPatterns };
  }

  // Detect multi-char phonetic vowel/digraph shifts (froot -> fruit, fone -> phone, reedig -> reading)
  const s1 = normMulti(s1Raw);
  const s2 = normMulti(s2Raw);

  if (s1 !== s1Raw || s2 !== s2Raw) {
    if (
      (s1Raw.includes('oo') && s2Raw.includes('ui')) ||
      (s1Raw.includes('ee') && s2Raw.includes('ea')) ||
      (s1Raw.includes('f') && s2Raw.includes('ph'))
    ) {
      detectedPatterns.push({
        type: 'phonetic_spelling',
        labelAr: 'كتابة صوتية مطابقة للنطق (Phonetic Grapheme Mapping)',
        detailAr: `كتابة المقطع الصوتي كما يُنطق (${sourceRaw} ← ${targetRaw})`,
        costApplied: 0.16,
      });
    }
  }

  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i * 0.75;
  for (let j = 0; j <= n; j++) dp[0][j] = j * 0.75;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c1 = s1[i - 1];
      const c2 = s2[j - 1];
      const pairKey = `${c1}:${c2}`;

      let subCost = 1.0;
      if (c1 === c2) {
        subCost = 0;
      } else if (VISUAL_REVERSAL_PAIRS.has(pairKey)) {
        subCost = 0.14; // Heuristic similarity weight; not an estimate of the child's underlying skill.
        const isArabicGraphemePair = /[\\u0600-\\u06FF]/u.test(c1 + c2);
        const patternType: DyslexicPatternType = isArabicGraphemePair
          ? 'grapheme_confusion'
          : 'visual_mirror_reversal';
        if (!detectedPatterns.some((p) => p.type === patternType)) {
          detectedPatterns.push({
            type: patternType,
            labelAr: isArabicGraphemePair
              ? 'التباس محتمل في شكل الحرف أو موضع النقاط'
              : 'استبدال محتمل بين حرفين متشابهين بصريًا',
            detailAr: isArabicGraphemePair
              ? `تشابه محتمل في الرسم أو موضع النقاط بين (${c1}) و(${c2})؛ لا يثبت سبب الخطأ`
              : `تشابه بصري محتمل بين الحرف (${c1}) والحرف (${c2})؛ لا يثبت سبب الخطأ`,
            costApplied: 0.14,
          });
        }
      } else if (PHONETIC_CONFUSION_PAIRS.has(pairKey)) {
        subCost = 0.18; // Near-zero cost for phonetic confusion (ض/ظ, ه/ة, c/k)
        if (!detectedPatterns.some((p) => p.type === 'phonetic_spelling')) {
          detectedPatterns.push({
            type: 'phonetic_spelling',
            labelAr: 'تشابه فونولوجي صوتي (Phonological Substitution)',
            detailAr: `تقارب مخرج الصوت بين (${c1}) و (${c2})`,
            costApplied: 0.18,
          });
        }
      }

      // Deletion / Insertion cost (lower if vowel/silent letter omission like "boks" -> "books" or "reedig" -> "reading")
      const delCost = 'aeiouūīاويىهةn'.includes(c1) ? 0.32 : 0.75;
      const insCost = 'aeiouūīاويىهةn'.includes(c2) ? 0.32 : 0.75;

      dp[i][j] = Math.min(
        dp[i - 1][j] + delCost,
        dp[i][j - 1] + insCost,
        dp[i - 1][j - 1] + subCost
      );

      // Adjacent Damerau Transposition (e.g. "teh" -> "the", "form" -> "from")
      if (
        i > 1 &&
        j > 1 &&
        s1[i - 1] === s2[j - 2] &&
        s1[i - 2] === s2[j - 1] &&
        s1[i - 1] !== s1[i - 2]
      ) {
        const transCost = 0.22;
        if (dp[i - 2][j - 2] + transCost < dp[i][j]) {
          dp[i][j] = dp[i - 2][j - 2] + transCost;
          if (
            !detectedPatterns.some((p) => p.type === 'kinetic_transposition')
          ) {
            detectedPatterns.push({
              type: 'kinetic_transposition',
              labelAr: 'قلب مكاني لتسلسل الحروف (Kinetic Letter Transposition)',
              detailAr: `تبديل ترتيب الحرفين المتجاورين (${s1[i - 2]}${s1[i - 1]} ← ${s2[j - 2]}${s2[j - 1]})`,
              costApplied: transCost,
            });
          }
        }
      }
    }
  }

  // Add small base cost if multi-char normalization already simplified the string
  const multiCharOffset =
    s1 === s2 && s1Raw !== s2Raw ? 0.16 : 0;
  const weightedDistance =
    Math.round((dp[m][n] + multiCharOffset) * 100) / 100;

  return {
    weightedDistance,
    standardDistance,
    detectedPatterns,
  };
}

// Built-in bilingual lexicon for real-time Dyslexico spellchecking & phonetic matching
const ENGLISH_SPECIALIST_TERMINOLOGY = [
  'fruit',
  'the',
  'reading',
  'books',
  'phone',
  'because',
  'friend',
  'school',
  'people',
  'water',
  'animal',
  'number',
  'letter',
  'write',
  'right',
  'night',
  'light',
  'laugh',
  'enough',
  'cash',
  'bird',
  'door',
  'board',
  'deep',
  'queen',
  'play',
  'from',
  'girl',
  'first',
  'love',
  'eating',
  'daddy',
  'baby',
  'paper',
  'table',
  'apple',
  'train',
  'brain',
  'cloud',
  'house',
  'and',
  'on',
  'a',
  'an',
  'in',
  'to',
  'of',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'i',
  'he',
  'she',
  'we',
  'they',
].map((w) => w.toLowerCase());

export type ArabicDialectCode =
  | 'msa'
  | 'gulf'
  | 'egyptian'
  | 'levantine'
  | 'maghrebi';

export interface ArabicDialectProfile {
  code: ArabicDialectCode;
  labelAr: string;
  speechRecognitionLang: string;
  phonologicalNotesAr: string;
}

export const ARABIC_DIALECT_PROFILES: ArabicDialectProfile[] = [
  {
    code: 'gulf',
    labelAr: 'اللهجة الخليجية والسعودية',
    speechRecognitionLang: 'ar-SA',
    phonologicalNotesAr:
      'تراعي نطق القاف (گـ/ك)، إبدال الجيم ياءً في بعض المفردات، وتجانس الظاء والضاد (منضار/منظار).',
  },
  {
    code: 'egyptian',
    labelAr: 'اللهجة المصرية',
    speechRecognitionLang: 'ar-EG',
    phonologicalNotesAr:
      'تراعي إبدال الثاء (ت/س)، الذال (د/ز)، الظاء (ض/ز)، ونطق القاف همزة (ألم/قلم، دهب/ذهب، تلاميز/تلاميذ).',
  },
  {
    code: 'levantine',
    labelAr: 'اللهجة الشامية',
    speechRecognitionLang: 'ar-JO',
    phonologicalNotesAr:
      'تراعي إبدال الثاء تاءً والذال دالاً أو زاياً وتخفيف الهمزة وتسهيل التاء المربوطة.',
  },
  {
    code: 'maghrebi',
    labelAr: 'اللهجة المغاربية',
    speechRecognitionLang: 'ar-MA',
    phonologicalNotesAr:
      'تراعي تسكين المقطع الأول وتفخيم التاء إلى طاء في جوار الحروف المفخمة ومفردات الدارجة المدرسية.',
  },
  {
    code: 'msa',
    labelAr: 'العربية الفصحى المعيارية',
    speechRecognitionLang: 'ar-SA',
    phonologicalNotesAr:
      'معيار النطق المدرسي الفصيح مع التمييز الكامل بين مخارج الحروف اللثوية والمفخمة.',
  },
];

// Map common Arab student dialectal words & phonetic pronunciations to their MSA canonical target,
// explicitly distinguishing valid lexical dialect words ('lexical') from dialectal phonological shifts ('phonological')
// and orthographic conventions ('orthographic').
const ARABIC_DIALECT_LEXICAL_MAP: Record<
  string,
  {
    canonicalMsa: string;
    canonicalMsaAlternates?: string[];
    dialectLabelAr: string;
    kind: 'lexical' | 'phonological' | 'orthographic';
    allowedDialects?: ArabicDialectCode[];
  }
> = {
  // Orthographic writing conventions / pause-form normalization (NOT dyslexia errors — valid in all modes including MSA)
  المدرسه: {
    canonicalMsa: 'المدرسة',
    dialectLabelAr: 'اختلاف إملائي شائع في كتابة التاء المربوطة هاءً عند الوقف (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  مدرسه: {
    canonicalMsa: 'المدرسة',
    canonicalMsaAlternates: ['مدرسة', 'المدرسة'],
    dialectLabelAr: 'اختلاف إملائي شائع في كتابة التاء المربوطة هاءً (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  الواضحه: {
    canonicalMsa: 'الواضحة',
    dialectLabelAr: 'اختلاف إملائي في التاء المربوطة عند الوقف (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  الحديقه: {
    canonicalMsa: 'الحديقة',
    canonicalMsaAlternates: ['حديقة', 'الحديقة'],
    dialectLabelAr: 'اختلاف إملائي في التاء المربوطة عند الوقف (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  قطه: {
    canonicalMsa: 'قطة',
    dialectLabelAr: 'اختلاف إملائي في التاء المربوطة عند الوقف (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  ازرق: {
    canonicalMsa: 'أزرق',
    dialectLabelAr: 'تطبيع إملائي لهمزة القطع في الكتابة الرقمية (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  امام: {
    canonicalMsa: 'أمام',
    dialectLabelAr: 'تطبيع إملائي لهمزة القطع في الكتابة الرقمية (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  الى: {
    canonicalMsa: 'إلى',
    dialectLabelAr: 'تطبيع إملائي لهمزة القطع في الكتابة الرقمية (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  الاطفال: {
    canonicalMsa: 'الأطفال',
    dialectLabelAr: 'تطبيع إملائي للهمزة في الكتابة الرقمية (ليس مؤشر عسر قراءة)',
    kind: 'orthographic',
  },
  قري: {
    canonicalMsa: 'قرأ',
    dialectLabelAr: 'تسهيل الهمزة المتطرفة أو اختلاف رسم الألف/الياء (تطبيع كتابي/نطقي)',
    kind: 'orthographic',
  },
  مسا: {
    canonicalMsa: 'مساء',
    dialectLabelAr: 'تخفيف الهمزة المتطرفة عند الوقف (استعمال صوتي شائع)',
    kind: 'orthographic',
  },
  صافي: {
    canonicalMsa: 'صاف',
    dialectLabelAr: 'إشباع الاسم المنقوص ياءً عند الوقف (استعمال عربي شائع)',
    kind: 'orthographic',
  },

  // Valid Arabic dialectal & pan-Arab lexical words (Correct in colloquial dialects — NEVER classify as spelling errors!)
  شاف: {
    canonicalMsa: 'شاهد',
    canonicalMsaAlternates: ['شاهد', 'رأى', 'نظر', 'أبصر'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («شاف» بمعنى «شاهد/رأى» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  شافت: {
    canonicalMsa: 'شاهدت',
    canonicalMsaAlternates: ['شاهدت', 'رأت', 'نظرت', 'أبصرت'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («شافت» بمعنى «شاهدت/رأت» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  شافوا: {
    canonicalMsa: 'لمشاهدة',
    canonicalMsaAlternates: ['لمشاهدة', 'شاهدوا', 'رأوا'],
    dialectLabelAr: 'استعمال لهجي صحيح («شافوا» بمعنى «شاهدوا» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  يشوف: {
    canonicalMsa: 'يشاهد',
    canonicalMsaAlternates: ['يشاهد', 'يرى', 'ينظر', 'لمشاهدة'],
    dialectLabelAr: 'استعمال لهجي صحيح («يشوف» بمعنى «يرى/يشاهد» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  تشوف: {
    canonicalMsa: 'تشاهد',
    canonicalMsaAlternates: ['تشاهد', 'ترى', 'تنظر'],
    dialectLabelAr: 'استعمال لهجي صحيح («تشوف» بمعنى «ترى/تشاهد» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  صوب: {
    canonicalMsa: 'نحو',
    canonicalMsaAlternates: ['نحو', 'باتجاه', 'تجاه', 'إلى'],
    dialectLabelAr: 'استعمال عربي ولهجي صحيح («صَوْب» بمعنى «نحو/اتجاه» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'levantine', 'egyptian'],
  },
  راح: {
    canonicalMsa: 'ذهب',
    canonicalMsaAlternates: ['ذهب', 'توجه', 'مضى', 'زار'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («راح» بمعنى «ذهب» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  راحت: {
    canonicalMsa: 'خرجت',
    canonicalMsaAlternates: ['خرجت', 'ذهبت', 'توجهت'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («راحت» بمعنى «ذهبت/خرجت» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  راحوا: {
    canonicalMsa: 'زار',
    canonicalMsaAlternates: ['زار', 'زاروا', 'ذهبوا', 'ذهب'],
    dialectLabelAr: 'استعمال لهجي صحيح («راحوا» بمعنى «زاروا/ذهبوا» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  مشى: {
    canonicalMsa: 'ذهب',
    canonicalMsaAlternates: ['ذهب', 'سار', 'توجه'],
    dialectLabelAr: 'استعمال لهجي مغاربي وعربي صحيح («مشى» بمعنى «ذهب/سار» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['maghrebi', 'gulf', 'egyptian', 'levantine'],
  },
  مشوا: {
    canonicalMsa: 'زار',
    canonicalMsaAlternates: ['زار', 'ذهبوا', 'زاروا'],
    dialectLabelAr: 'استعمال لهجي مغاربي صحيح («مشوا» بمعنى «ذهبوا» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['maghrebi', 'gulf'],
  },
  جاب: {
    canonicalMsa: 'أحضر',
    canonicalMsaAlternates: ['أحضر', 'جلب', 'حمل'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («جاب» بمعنى «أحضر/جلب» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  جابت: {
    canonicalMsa: 'أحضرت',
    canonicalMsaAlternates: ['أحضرت', 'جلبت', 'حملت'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («جابت» بمعنى «أحضرت» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  حط: {
    canonicalMsa: 'وضع',
    canonicalMsaAlternates: ['وضع', 'ثبت', 'جعل'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («حطّ» بمعنى «وضع» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  حطت: {
    canonicalMsa: 'وضعت',
    canonicalMsaAlternates: ['وضعت', 'ثبتت'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («حطّت» بمعنى «وضعت» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  العيال: {
    canonicalMsa: 'الأطفال',
    canonicalMsaAlternates: ['الأطفال', 'الأبناء', 'الطلاب', 'طلاب'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («العيال» بمعنى «الأطفال/الأبناء» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian'],
  },
  عيال: {
    canonicalMsa: 'الأطفال',
    canonicalMsaAlternates: ['الأطفال', 'أطفال', 'طلاب', 'الأبناء'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («عيال» بمعنى «أطفال/أبناء» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian'],
  },
  الولاد: {
    canonicalMsa: 'الأطفال',
    canonicalMsaAlternates: ['الأطفال', 'الأولاد', 'الأبناء', 'الطلاب'],
    dialectLabelAr: 'استعمال لهجي صحيح («الولاد/الأولاد» بمعنى «الأطفال» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['egyptian', 'levantine'],
  },
  الدراري: {
    canonicalMsa: 'الأطفال',
    canonicalMsaAlternates: ['الأطفال', 'الأبناء', 'الطلاب'],
    dialectLabelAr: 'استعمال لهجي مغاربي صحيح («الدراري» بمعنى «الأطفال» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['maghrebi'],
  },
  بزاف: {
    canonicalMsa: 'شديد',
    canonicalMsaAlternates: ['شديد', 'كثير', 'كثيرا', 'جدا', 'كبيرا'],
    dialectLabelAr: 'استعمال لهجي مغاربي صحيح («بزاف» بمعنى «كثير/شديد» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['maghrebi'],
  },
  واجد: {
    canonicalMsa: 'شديد',
    canonicalMsaAlternates: ['شديد', 'كثير', 'كثيرا', 'جدا', 'كبيرا'],
    dialectLabelAr: 'استعمال لهجي خليجي صحيح («واجد» بمعنى «كثير/شديد» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  وايد: {
    canonicalMsa: 'كثير',
    canonicalMsaAlternates: ['كثير', 'كثيرا', 'شديد', 'جدا', 'كبيرا'],
    dialectLabelAr: 'استعمال لهجي خليجي صحيح («وايد» بمعنى «كثير/جداً» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  حيل: {
    canonicalMsa: 'شديد',
    canonicalMsaAlternates: ['شديد', 'كثير', 'كثيرا', 'جدا'],
    dialectLabelAr: 'استعمال لهجي خليجي/عراقي صحيح («حيل» بمعنى «جداً/شديد» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  الحين: {
    canonicalMsa: 'اليوم',
    canonicalMsaAlternates: ['اليوم', 'الآن', 'حاليا'],
    dialectLabelAr: 'استعمال لهجي وعربي صحيح («الحين» بمعنى «الآن/اليوم» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'levantine'],
  },
  ذحين: {
    canonicalMsa: 'اليوم',
    canonicalMsaAlternates: ['اليوم', 'الآن', 'حاليا'],
    dialectLabelAr: 'استعمال لهجي حجازي صحيح («ذحين» بمعنى «الآن» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  دلوقتي: {
    canonicalMsa: 'اليوم',
    canonicalMsaAlternates: ['اليوم', 'الآن', 'حاليا'],
    dialectLabelAr: 'استعمال لهجي مصري صحيح («دلوقتي» بمعنى «الآن» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['egyptian'],
  },
  هلق: {
    canonicalMsa: 'اليوم',
    canonicalMsaAlternates: ['اليوم', 'الآن', 'حاليا'],
    dialectLabelAr: 'استعمال لهجي شامي صحيح («هلق» بمعنى «الآن» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['levantine'],
  },
  دابا: {
    canonicalMsa: 'اليوم',
    canonicalMsaAlternates: ['اليوم', 'الآن', 'حاليا'],
    dialectLabelAr: 'استعمال لهجي مغاربي صحيح («دابا» بمعنى «الآن» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['maghrebi'],
  },
  موية: {
    canonicalMsa: 'الماء',
    canonicalMsaAlternates: ['الماء', 'ماء', 'المياه', 'مياه'],
    dialectLabelAr: 'استعمال لهجي صحيح («موية» بمعنى «ماء» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  ميه: {
    canonicalMsa: 'الماء',
    canonicalMsaAlternates: ['الماء', 'ماء', 'المياه', 'مياه'],
    dialectLabelAr: 'استعمال لهجي مصري/شامي صحيح («ميه» بمعنى «ماء» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['egyptian', 'levantine'],
  },
  ماي: {
    canonicalMsa: 'الماء',
    canonicalMsaAlternates: ['الماء', 'ماء', 'المياه', 'مياه'],
    dialectLabelAr: 'استعمال لهجي خليجي صحيح («ماي» بمعنى «ماء» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  زين: {
    canonicalMsa: 'جميل',
    canonicalMsaAlternates: ['جميل', 'جيد', 'مرتب', 'حسن'],
    dialectLabelAr: 'استعمال لهجي خليجي وعربي صحيح («زين» بمعنى «جميل/جيد» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  كويس: {
    canonicalMsa: 'جميل',
    canonicalMsaAlternates: ['جميل', 'جيد', 'مرتب', 'حسن'],
    dialectLabelAr: 'استعمال لهجي مصري/شامي صحيح («كويس» بمعنى «جيد/جميل» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['egyptian', 'levantine'],
  },
  منيح: {
    canonicalMsa: 'جميل',
    canonicalMsaAlternates: ['جميل', 'جيد', 'مرتب', 'حسن'],
    dialectLabelAr: 'استعمال لهجي شامي صحيح («منيح» بمعنى «جيد/جميل» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['levantine'],
  },
  مزيان: {
    canonicalMsa: 'جميل',
    canonicalMsaAlternates: ['جميل', 'جيد', 'مرتب', 'حسن'],
    dialectLabelAr: 'استعمال لهجي مغاربي صحيح («مزيان» بمعنى «جيد/جميل» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['maghrebi'],
  },
  المضوية: {
    canonicalMsa: 'المضيئة',
    canonicalMsaAlternates: ['المضيئة', 'الساطعة'],
    dialectLabelAr: 'استعمال لهجي شامي/مغاربي صحيح («المضوية» بمعنى «المضيئة» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['levantine', 'maghrebi'],
  },
  المنورة: {
    canonicalMsa: 'المضيئة',
    canonicalMsaAlternates: ['المضيئة', 'الساطعة'],
    dialectLabelAr: 'استعمال لهجي صحيح («المنورة» بمعنى «المضيئة» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine', 'maghrebi'],
  },
  لشوفة: {
    canonicalMsa: 'لمشاهدة',
    canonicalMsaAlternates: ['لمشاهدة', 'مشاهدة'],
    dialectLabelAr: 'استعمال لهجي صحيح («لشوفة» بمعنى «لمشاهدة» — لا يُعدّ خطأً)',
    kind: 'lexical',
    allowedDialects: ['gulf'],
  },
  عشان: {
    canonicalMsa: 'لمشاهدة',
    canonicalMsaAlternates: ['لمشاهدة', 'لحماية', 'لتوزيع', 'لتيسير', 'ليستفيد', 'لأن', 'لكي'],
    dialectLabelAr: 'أداة تعليل لهجية دارجة صحيحة في السياق الشفهي',
    kind: 'lexical',
    allowedDialects: ['gulf', 'egyptian', 'levantine'],
  },
  علشان: {
    canonicalMsa: 'لمشاهدة',
    canonicalMsaAlternates: ['لمشاهدة', 'لحماية', 'لتوزيع', 'لتيسير', 'ليستفيد', 'لأن', 'لكي'],
    dialectLabelAr: 'أداة تعليل لهجية مصرية صحيحة في السياق الشفهي',
    kind: 'lexical',
    allowedDialects: ['egyptian'],
  },
  مشان: {
    canonicalMsa: 'لمشاهدة',
    canonicalMsaAlternates: ['لمشاهدة', 'لحماية', 'لتوزيع', 'لتيسير', 'ليستفيد', 'لأن', 'لكي'],
    dialectLabelAr: 'أداة تعليل لهجية شامية صحيحة في السياق الشفهي',
    kind: 'lexical',
    allowedDialects: ['levantine'],
  },
  باش: {
    canonicalMsa: 'لمشاهدة',
    canonicalMsaAlternates: ['لمشاهدة', 'لحماية', 'لتوزيع', 'لتيسير', 'ليستفيد', 'لأن', 'لكي'],
    dialectLabelAr: 'أداة تعليل لهجية مغاربية صحيحة في السياق الشفهي',
    kind: 'lexical',
    allowedDialects: ['maghrebi'],
  },

  // Dialectal phonological shifts (ث->ت/س, ذ->د/ز, ق->أ/گ, ج->ي)
  تلاميز: {
    canonicalMsa: 'تلاميذ',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ذ ← ز — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  تلميز: {
    canonicalMsa: 'تلميذ',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ذ ← ز — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  دهب: {
    canonicalMsa: 'ذهب',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي/مغاربي: ذ ← د — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine', 'maghrebi'],
  },
  تلاته: {
    canonicalMsa: 'ثلاثة',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ث ← ت — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine', 'maghrebi'],
  },
  تلاتة: {
    canonicalMsa: 'ثلاثة',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ث ← ت — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine', 'maghrebi'],
  },
  كتير: {
    canonicalMsa: 'كثير',
    canonicalMsaAlternates: ['كثير', 'كثيرا', 'شديد'],
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ث ← ت — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  الملاحزات: {
    canonicalMsa: 'الملاحظات',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ظ ← ز — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  ملاحزات: {
    canonicalMsa: 'ملاحظات',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ظ ← ز — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  ملاحزاتهم: {
    canonicalMsa: 'ملاحظاتهم',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: ظ ← ز — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  ألم: {
    canonicalMsa: 'قلم',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: إبدال القاف همزة — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  بألم: {
    canonicalMsa: 'بقلم',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: إبدال القاف همزة — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  أمر: {
    canonicalMsa: 'قمر',
    dialectLabelAr: 'نطق لهجي صوتي (مصري/شامي: إبدال القاف همزة — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  كال: {
    canonicalMsa: 'قال',
    dialectLabelAr: 'نطق لهجي خليجي (ق ← ك/گ — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['gulf'],
  },
  الدكيك: {
    canonicalMsa: 'الدقيق',
    dialectLabelAr: 'نطق لهجي خليجي (ق ← ك/گ — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['gulf'],
  },
  الدئيئ: {
    canonicalMsa: 'الدقيق',
    dialectLabelAr: 'نطق لهجي مصري/شامي (ق ← ء — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['egyptian', 'levantine'],
  },
  مسيد: {
    canonicalMsa: 'مسجد',
    dialectLabelAr: 'نطق لهجي خليجي (ج ← ي — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['gulf'],
  },
  ريال: {
    canonicalMsa: 'رجال',
    dialectLabelAr: 'نطق لهجي خليجي (ج ← ي — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['gulf'],
  },
  شيرة: {
    canonicalMsa: 'شجرة',
    dialectLabelAr: 'نطق لهجي خليجي (ج ← ي — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['gulf'],
  },
  يديد: {
    canonicalMsa: 'جديد',
    canonicalMsaAlternates: ['جديد', 'جديدة'],
    dialectLabelAr: 'نطق لهجي خليجي (ج ← ي — لا يُعامل كخطأ ديسلكسي)',
    kind: 'phonological',
    allowedDialects: ['gulf'],
  },
};

function isEntryAllowedInDialect(
  entry: {
    kind: 'lexical' | 'phonological' | 'orthographic';
    allowedDialects?: ArabicDialectCode[];
  },
  dialect?: ArabicDialectCode
): boolean {
  // Orthographic conventions apply across all Arabic modes
  if (entry.kind === 'orthographic') return true;
  // When no specific dialect filter is passed, accept all documented Arab dialects
  if (!dialect) return true;
  // In strict Standard Arabic (MSA) mode, colloquial/phonological shifts are NOT exempted
  if (dialect === 'msa') return false;
  if (!entry.allowedDialects || entry.allowedDialects.length === 0) return true;
  return entry.allowedDialects.includes(dialect);
}

/**
 * Normalizes an Arab student's spoken or written token across Arabic dialects,
 * identifying whether it is a valid dialectal lexical item, a dialectal phonological shift,
 * an orthographic writing convention, or a candidate for letter-level confusion analysis.
 * Supports Arabic proclitics (وال، فال، بال، لل، و، ف، ب، ل، ك) and active dialect filtering.
 */
export function normalizeArabicDialectWord(
  rawWord: string,
  dialect?: ArabicDialectCode
): {
  cleaned: string;
  canonicalMsa: string;
  canonicalMsaAlternates: string[];
  isDialectVariant: boolean;
  dialectKind?: 'lexical' | 'phonological' | 'orthographic';
  dialectNoteAr?: string;
} {
  const cleaned = rawWord
    .replace(/[.,!?،؟؛:"«»()[\]\u064B-\u0652\u0670\u0640]/g, '')
    .trim();
  const directEntry = ARABIC_DIALECT_LEXICAL_MAP[cleaned];
  if (directEntry && isEntryAllowedInDialect(directEntry, dialect)) {
    const alts = Array.from(
      new Set([directEntry.canonicalMsa, ...(directEntry.canonicalMsaAlternates || [])])
    );
    return {
      cleaned,
      canonicalMsa: directEntry.canonicalMsa,
      canonicalMsaAlternates: alts,
      isDialectVariant: true,
      dialectKind: directEntry.kind,
      dialectNoteAr: directEntry.dialectLabelAr,
    };
  }

  // Check compound proclitics (وال، فال، بال، كال، لل) and single-letter proclitics (و، ف، ب، ل، ك)
  const proclitics = ['وال', 'فال', 'بال', 'كال', 'لل', 'و', 'ف', 'ب', 'ل', 'ك'];
  for (const prefix of proclitics) {
    if (cleaned.length >= prefix.length + 2 && cleaned.startsWith(prefix)) {
      const stem = cleaned.slice(prefix.length);
      const stemEntry = ARABIC_DIALECT_LEXICAL_MAP[stem];
      if (stemEntry && isEntryAllowedInDialect(stemEntry, dialect)) {
        const baseAlts = [
          stemEntry.canonicalMsa,
          ...(stemEntry.canonicalMsaAlternates || []),
        ];
        const prefixedAlts = baseAlts.map((a) => `${prefix}${a}`);
        return {
          cleaned,
          canonicalMsa: stemEntry.canonicalMsa,
          canonicalMsaAlternates: Array.from(new Set([...baseAlts, ...prefixedAlts])),
          isDialectVariant: true,
          dialectKind: stemEntry.kind,
          dialectNoteAr: stemEntry.dialectLabelAr,
        };
      }
      // Also check if prefix includes ال (e.g. والمنورة -> المنورة)
      if (prefix.endsWith('ال')) {
        const stemWithAl = `ال${stem}`;
        const alEntry = ARABIC_DIALECT_LEXICAL_MAP[stemWithAl];
        if (alEntry && isEntryAllowedInDialect(alEntry, dialect)) {
          const singlePrefix = prefix.slice(0, -2);
          const baseAlts = [
            alEntry.canonicalMsa,
            ...(alEntry.canonicalMsaAlternates || []),
          ];
          const prefixedAlts = baseAlts.map((a) => `${singlePrefix}${a}`);
          return {
            cleaned,
            canonicalMsa: alEntry.canonicalMsa,
            canonicalMsaAlternates: Array.from(new Set([...baseAlts, ...prefixedAlts])),
            isDialectVariant: true,
            dialectKind: alEntry.kind,
            dialectNoteAr: alEntry.dialectLabelAr,
          };
        }
      }
    }
  }

  return {
    cleaned,
    canonicalMsa: cleaned,
    canonicalMsaAlternates: [cleaned],
    isDialectVariant: false,
  };
}

const ARABIC_SPECIALIST_TERMINOLOGY = [
  'قرأ',
  'الطالب',
  'طلاب',
  'كتاب',
  'كتابة',
  'في',
  'المدرسة',
  'وكتب',
  'كتب',
  'بقلم',
  'قلم',
  'أزرق',
  'عن',
  'إلى',
  'على',
  'من',
  'مع',
  'عبر',
  'بين',
  'والضوء',
  'المرشد',
  'الدرس',
  'الظل',
  'الضوء',
  'الصباح',
  'المساء',
  'مساء',
  'صاف',
  'المنظار',
  'الدقيق',
  'نحو',
  'فظهرت',
  'حلقات',
  'الواضحة',
  'أمام',
  'الجميع',
  'سجل',
  'الأطفال',
  'ملاحظات',
  'ملاحظاتهم',
  'دفتر',
  'البحث',
  'العلمي',
  'بحماس',
  'شديد',
  'الكواكب',
  'المضيئة',
  'وضع',
  'المهندس',
  'النجوم',
  'السماء',
  'الأرض',
  'العلوم',
  'المكتبة',
  'القراءة',
  'الحروف',
  'الكلمات',
  'الحديقة',
  'الأزهار',
  'الفراشة',
  'الطبيعة',
  'مستقبل',
  'أصدقائه',
  'بطريقة',
  'صحيحة',
  'جميلة',
  'سعيدة',
  'الرياضيات',
  'الأعداد',
  'ذهب',
  'زار',
  'تلاميذ',
  'تلميذ',
  'ثلاثة',
  'كثير',
  'قال',
  'مسجد',
  'رجال',
  'شاهد',
  'قمر',
  'ظهر',
  'المرصد',
  'الفلكي',
  'الكبير',
  'لمشاهدة',
  'مشاهدة',
  'كوكب',
  'زحل',
  'تتميز',
  'الواحات',
  'العربية',
  'بنظام',
  'هندسي',
  'عريق',
  'يعرف',
  'باسم',
  'الأفلاج',
  'المائية',
  'تنساب',
  'المياه',
  'العذبة',
  'الينابيع',
  'الجبلية',
  'قنوات',
  'متصلة',
  'لتروي',
  'بساتين',
  'النخيل',
  'والحقول',
  'الخضراء',
  'يتعاون',
  'المزارعون',
  'يوميا',
  'لتوزيع',
  'الحصص',
  'بالعدل',
  'والدقة',
  'المتناهية',
  'طارق',
  'توجه',
  'الجبل',
  'سلمى',
  'حديقة',
  'البيت',
  'قطة',
  'بيضاء',
  'شجرة',
  'التفاح',
  'حليب',
  'دافئ',
  'خبز',
  'طري',
  'القرية',
  'قرية',
  'القمح',
  'قمح',
  'الذهبي',
  'جديد',
  'جديدة',
  'ثقيلة',
  'لذيذة',
];

function isPureOrthographicNormalization(wordA: string, wordB: string): boolean {
  if (!wordA || !wordB || wordA === wordB) return false;
  const norm = (s: string) =>
    s
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة$/g, 'ه')
      .replace(/ى$/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي');
  if (norm(wordA) === norm(wordB)) return true;
  // Also recognize oral/written pause form (Waqf) where final tanween alif is omitted (e.g. صباح <-> صباحا، كامل <-> كاملا)
  if (wordB.endsWith('ا') && wordB.length >= 4 && norm(wordA) === norm(wordB.slice(0, -1))) {
    return true;
  }
  if (wordA.endsWith('ا') && wordA.length >= 4 && norm(wordA.slice(0, -1)) === norm(wordB)) {
    return true;
  }
  return false;
}

/**
 * Checks whether a spoken/written Arabic word differs from the target MSA word solely by systematic
 * regional phonological shifts (e.g. ث->ت/س, ذ->د/ز, ظ->ز, ق->أ/ء/ئ/ك, ج->ي) that match the active
 * `dialect` profile AND occur within contextual reading (`hasSentenceContext`), preventing isolated
 * or multi-consonant garbled errors from being excused as dialectal pronunciation.
 */
export function checkSystematicDialectPhonologicalShift(
  spokenClean: string,
  targetClean: string,
  dialect: ArabicDialectCode = 'gulf',
  hasSentenceContext: boolean = true
): { isShift: boolean; noteAr?: string } {
  if (
    !spokenClean ||
    !targetClean ||
    spokenClean === targetClean ||
    dialect === 'msa' ||
    !hasSentenceContext
  ) {
    return { isShift: false };
  }
  const normOrtho = (s: string) =>
    s
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة$/g, 'ه')
      .replace(/ى$/g, 'ي');

  let sNorm = normOrtho(spokenClean);
  let tNorm = normOrtho(targetClean);

  // Allow tanween alif pause dropping on target
  if (tNorm.endsWith('ا') && tNorm.length === sNorm.length + 1) {
    tNorm = tNorm.slice(0, -1);
  }
  if (sNorm.length !== tNorm.length || sNorm === tNorm) {
    return { isShift: false };
  }

  const allowEgyptianLevantine =
    dialect === 'egyptian' || dialect === 'levantine';
  const allowGulf = dialect === 'gulf';
  const allowMaghrebi = dialect === 'maghrebi';

  const shiftDescriptions: string[] = [];
  const shiftedTargetLetters = new Set<string>();

  for (let i = 0; i < tNorm.length; i++) {
    const tc = tNorm[i];
    const sc = sNorm[i];
    if (tc === sc) continue;

    if (
      tc === 'ث' &&
      ((sc === 'ت' && (allowEgyptianLevantine || allowMaghrebi)) ||
        (sc === 'س' && allowEgyptianLevantine))
    ) {
      shiftDescriptions.push(`ث ← ${sc}`);
      shiftedTargetLetters.add(tc);
    } else if (
      tc === 'ذ' &&
      ((sc === 'د' && (allowEgyptianLevantine || allowMaghrebi)) ||
        (sc === 'ز' && allowEgyptianLevantine))
    ) {
      shiftDescriptions.push(`ذ ← ${sc}`);
      shiftedTargetLetters.add(tc);
    } else if (tc === 'ظ' && sc === 'ز' && allowEgyptianLevantine) {
      shiftDescriptions.push('ظ ← ز');
      shiftedTargetLetters.add(tc);
    } else if (
      tc === 'ق' &&
      (((sc === 'ا' || sc === 'ء' || sc === 'ئ') && allowEgyptianLevantine) ||
        ((sc === 'ك' || sc === 'گ') && (allowGulf || allowMaghrebi)))
    ) {
      shiftDescriptions.push(`ق ← ${sc === 'ا' ? 'أ' : sc}`);
      shiftedTargetLetters.add(tc);
    } else if (tc === 'ج' && sc === 'ي' && allowGulf) {
      shiftDescriptions.push('ج ← ي');
      shiftedTargetLetters.add(tc);
    } else {
      return { isShift: false };
    }
  }

  // Only allow a single consonant family shift per word so multi-error words are not excused
  if (shiftDescriptions.length > 0 && shiftedTargetLetters.size === 1) {
    return {
      isShift: true,
      noteAr: `نطق لهجي صوتي منتظم في السياق (${Array.from(new Set(shiftDescriptions)).join('، ')}) — لا يُعامل كخطأ قرائي`,
    };
  }
  return { isShift: false };
}

/**
 * Analyzes an input word or full sentence using Dyslexico's Phonetic + Weighted Levenshtein
 * and Arabic Dialect-Aware pipeline, actively using the selected `dialect` profile (`gulf`, `egyptian`,
 * `levantine`, `maghrebi`, or strict `msa`) and sentence context to separate:
 * 1. Valid dialectal/lexical usage matching the active dialect -> NOT an error
 * 2. Orthographic/typing conventions (e.g., المدرسه/المدرسة، ازرق/أزرق) -> Orthographic normalization, NOT dyslexia
 * 3. Phonological/visual letter confusions (or dialect shifts outside the active dialect/MSA) -> Requires contextual repetition
 */
export function analyzeTextWithDyslexico(
  inputText: string,
  dialect: ArabicDialectCode = 'gulf'
): DyslexicoWordAnalysis[] {
  const rawTokens = inputText
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const hasSentenceContext = rawTokens.length >= 2;

  return rawTokens.map((rawToken) => {
    const cleanWord = rawToken
      .replace(/[.,!?،؟؛:"«»()[\]\u064B-\u0652\u0670]/g, '')
      .trim();
    const isArabic = /[\u0600-\u06FF]/.test(cleanWord);
    const language: 'ar' | 'en' = isArabic ? 'ar' : 'en';

    const lexicon = isArabic
      ? ARABIC_SPECIALIST_TERMINOLOGY
      : ENGLISH_SPECIALIST_TERMINOLOGY;

    const phoneticCodeInput = isArabic
      ? encodeArabicPhoneticSkeleton(cleanWord)
      : encodeDoubleMetaphoneLite(cleanWord);
    const soundexCodeInput = isArabic
      ? phoneticCodeInput
      : encodeSoundex(cleanWord);

    // Check direct match or Arabic proclitic prefix match (و، ف، ب، ل، ك)
    const strippedPrefixWord =
      isArabic && cleanWord.length > 3 && /^[وفبلك]/.test(cleanWord)
        ? cleanWord.slice(1)
        : cleanWord;
    const exactMatch = lexicon.find(
      (w) =>
        w.toLowerCase() === cleanWord.toLowerCase() ||
        (isArabic && w === strippedPrefixWord)
    );
    if (exactMatch) {
      return {
        originalWord: rawToken,
        cleanWord,
        isCorrect: true,
        variationCategory: 'exact_lexicon_match',
        variationCategoryLabelAr: 'كلمة فصيحة/معجمية مطابقة',
        requiresTeacherReview: false,
        contextualCautionAr: 'مطابقة تامة للمعجم العربي المدرسي.',
        language,
        phoneticCodeInput,
        soundexCodeInput,
        bestCorrection: cleanWord,
        phoneticCodeTarget: phoneticCodeInput,
        standardLevenshteinDistance: 0,
        weightedDyslexicDistance: 0,
        similarityScorePercent: 100,
        detectedPatterns: [],
        candidates: [],
      };
    }

    // Check if the token is a known Arabic dialectal or orthographic form under the active `dialect`
    const directDialectCheck = isArabic
      ? normalizeArabicDialectWord(cleanWord, dialect)
      : null;
    const strippedDialectCheck =
      isArabic &&
      !directDialectCheck?.isDialectVariant &&
      strippedPrefixWord !== cleanWord
        ? normalizeArabicDialectWord(strippedPrefixWord, dialect)
        : null;
    const dialectCheck =
      directDialectCheck?.isDialectVariant
        ? directDialectCheck
        : strippedDialectCheck?.isDialectVariant
          ? strippedDialectCheck
          : directDialectCheck;

    // Score all lexicon candidates
    const scoredCandidates = lexicon
      .map((candidate) => {
        const candPhonetic = isArabic
          ? encodeArabicPhoneticSkeleton(candidate)
          : encodeDoubleMetaphoneLite(candidate);
        const { weightedDistance, standardDistance, detectedPatterns } =
          computeDyslexicoWeightedLevenshtein(cleanWord, candidate);

        const sysShift = isArabic
          ? checkSystematicDialectPhonologicalShift(
              cleanWord,
              candidate,
              dialect,
              hasSentenceContext
            )
          : { isShift: false };

        const isDialectTarget =
          (Boolean(dialectCheck?.isDialectVariant) &&
            (dialectCheck?.canonicalMsa === candidate ||
              Boolean(
                dialectCheck?.canonicalMsaAlternates?.includes(candidate)
              ))) ||
          sysShift.isShift;

        // Phonetic or Dialect match bonus
        const phoneticExactBonus = isDialectTarget
          ? -0.45
          : candPhonetic === phoneticCodeInput
            ? -0.25
            : 0;
        const effectiveScore = Math.max(
          0.08,
          Math.round((weightedDistance + phoneticExactBonus) * 100) / 100
        );

        let reasonAr = 'تقارب إملائي معياري';
        const enrichedPatterns = [...detectedPatterns];
        const activeNoteAr = dialectCheck?.dialectNoteAr || sysShift.noteAr;
        if (isDialectTarget && activeNoteAr) {
          reasonAr = `${activeNoteAr} · المقابل الفصيح (${candidate})`;
          if (!enrichedPatterns.some((p) => p.detailAr === activeNoteAr)) {
            enrichedPatterns.unshift({
              type:
                dialectCheck?.dialectKind === 'orthographic'
                  ? 'vowel_omission_or_shift'
                  : 'phonetic_spelling',
              labelAr: activeNoteAr,
              detailAr: `المقابل المدرسي الفصيح لكلمة (${cleanWord}) هو (${candidate})`,
              costApplied: 0.12,
            });
          }
        } else if (candPhonetic === phoneticCodeInput) {
          reasonAr = `تطابق الكود الصوتي الفونولوجي (${candPhonetic})`;
        } else if (detectedPatterns.length > 0) {
          reasonAr = detectedPatterns[0].labelAr;
        }

        return {
          word: candidate,
          phoneticCode: candPhonetic,
          standardDist: standardDistance,
          weightedDist: isDialectTarget
            ? Math.min(0.18, weightedDistance)
            : weightedDistance,
          effectiveScore,
          detectedPatterns: enrichedPatterns,
          reasonAr,
          isSystematicShift: sysShift.isShift,
          systematicShiftNoteAr: sysShift.noteAr,
        };
      })
      .sort((a, b) => a.effectiveScore - b.effectiveScore);

    const top = scoredCandidates[0];
    const maxLen = Math.max(cleanWord.length, top.word.length, 1);
    const similarityScorePercent = Math.round(
      Math.max(15, Math.min(99, (1 - top.weightedDist / maxLen) * 100))
    );

    // Determine exact LinguisticVariationCategory using active `dialect` and sentence context
    let variationCategory: LinguisticVariationCategory =
      'phonological_or_visual_confusion';
    let variationCategoryLabelAr =
      'تبديل حرفي بصري أو صوتي محتمل (يتطلب تكرار السياق)';
    let requiresTeacherReview = true;
    let isCorrectToken = false;
    let contextualCautionAr =
      'ملاحظة حرفية منفردة — الخطأ الفردي لا يساوي عسر القراءة؛ يلزم النظر إلى سياق القراءة وتكرار النمط.';

    if (
      dialectCheck?.isDialectVariant &&
      dialectCheck.dialectKind === 'lexical'
    ) {
      variationCategory = 'valid_dialect_lexical';
      variationCategoryLabelAr =
        'استعمال لهجي أو معجمي عربي صحيح (لا يُعدّ خطأً)';
      requiresTeacherReview = false;
      isCorrectToken = true;
      contextualCautionAr =
        dialectCheck.dialectNoteAr ||
        'استعمال لغوي صحيح في لهجة الطالب المحددة — يُعرض المرادف الفصيح للموائمة المدرسية فقط ولا يُصنّف خطأً قرائياً.';
    } else if (
      (dialectCheck?.isDialectVariant &&
        dialectCheck.dialectKind === 'phonological') ||
      top.isSystematicShift
    ) {
      variationCategory = 'dialect_phonological_shift';
      variationCategoryLabelAr =
        'نطق لهجي صوتي طبيعي مطابق للهجة المحددة (لا يُعدّ مؤشر عسر قراءة)';
      requiresTeacherReview = false;
      isCorrectToken = true;
      contextualCautionAr =
        dialectCheck?.dialectNoteAr ||
        top.systematicShiftNoteAr ||
        'نطق صوتي طبيعي في لهجة الطالب لا يُحتسب خطأً في الفرز القرائي.';
    } else if (
      (dialectCheck?.isDialectVariant &&
        dialectCheck.dialectKind === 'orthographic') ||
      (isArabic && isPureOrthographicNormalization(cleanWord, top.word))
    ) {
      variationCategory = 'orthographic_convention';
      variationCategoryLabelAr =
        'اختلاف إملائي أو تطبيع كتابي (ليس مؤشر عسر قراءة)';
      requiresTeacherReview = false;
      isCorrectToken = false;
      contextualCautionAr =
        dialectCheck?.dialectNoteAr ||
        'اختلاف إملائي شائع في كتابة التاء المربوطة/الهاء أو الهمزة، وهو تطبيع كتابي لا يكفي لإثبات عسر القراءة.';
    }

    return {
      originalWord: rawToken,
      cleanWord,
      isCorrect: isCorrectToken,
      variationCategory,
      variationCategoryLabelAr,
      requiresTeacherReview,
      contextualCautionAr,
      language,
      phoneticCodeInput,
      soundexCodeInput,
      bestCorrection: top.word,
      phoneticCodeTarget: top.phoneticCode,
      standardLevenshteinDistance: top.standardDist,
      weightedDyslexicDistance: top.weightedDist,
      similarityScorePercent,
      detectedPatterns: top.detectedPatterns,
      candidates: scoredCandidates.slice(0, 3).map((c) => ({
        word: c.word,
        phoneticCode: c.phoneticCode,
        standardDist: c.standardDist,
        weightedDist: c.weightedDist,
        reasonAr: c.reasonAr,
      })),
    };
  });
}

// ============================================================================
// 2. ORAL READING ALIGNMENT (EXPLORATORY, HUMAN-REVIEW REQUIRED)

export interface OralWordAlignmentItem {
  targetWord: string;
  spokenWord: string | null;
  status: 'correct' | 'dialect_variant' | 'phonetic_substitution' | 'omitted';
  weightedDistance: number;
  dialectNoteAr?: string;
}

/** A browser transcript mismatch is not proof that the child made a reading error. */
export type AutomatedOralReadingStatus = OralWordAlignmentItem['status'] | 'unconfirmed';

export function toConservativeAutomatedOralReadingStatus(
  aligned: OralWordAlignmentItem | undefined | null
): AutomatedOralReadingStatus {
  if (!aligned || aligned.status === 'omitted' || aligned.status === 'phonetic_substitution') {
    return 'unconfirmed';
  }
  return aligned.status;
}

export interface OralReadingFluencyResult {
  wcpm: number; // Words Correct Per Minute
  totalWords: number;
  correctWordsCount: number;
  dialectVariantCount: number;
  phoneticSubstitutionCount: number;
  omittedWordsCount: number;
  insertionCount?: number;
  substitutionsCount?: number;
  deletionsCount?: number;
  accuracyPercent: number;
  werPercent: number | null; // Standard Levenshtein Word Error Rate: (S + D + I) / N (null if no transcript available)
  standardWerPercent?: number | null;
  hesitationPauseCount: number;
  alignment: OralWordAlignmentItem[];
}

/**
 * Standard Levenshtein Dynamic Programming Word Error Rate (WER) algorithm.
 * Operates on normalized sequence tokens using an exact DP matrix and backtrace
 * to objectively count minimum edit operations: Substitutions (S), Deletions (D), and Insertions (I).
 */
export function computeStandardSequenceWer(
  referenceTokens: string[],
  hypothesisTokens: string[]
): {
  werPercent: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceLength: number;
} {
  const normalize = (tok: string) =>
    tok.replace(/[.,!?،؟؛:"«»()[\]\u064B-\u0652\u0670]/g, '').trim();

  const refClean = referenceTokens.map(normalize).filter(Boolean);
  const hypClean = hypothesisTokens.map(normalize).filter(Boolean);
  const n = refClean.length;
  const m = hypClean.length;

  if (n === 0) {
    return {
      werPercent: m === 0 ? 0 : 100,
      substitutions: 0,
      deletions: 0,
      insertions: m,
      referenceLength: 0,
    };
  }

  // DP table: d[i][j] is the minimum distance between refClean[0..i-1] and hypClean[0..j-1]
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (refClean[i - 1] === hypClean[j - 1]) {
        d[i][j] = d[i - 1][j - 1];
      } else {
        d[i][j] = Math.min(
          d[i - 1][j] + 1,     // deletion from reference
          d[i][j - 1] + 1,     // insertion into reference
          d[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  // Backtrace to count exact substitutions, deletions, and insertions
  let i = n;
  let j = m;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && refClean[i - 1] === hypClean[j - 1]) {
      i--;
      j--;
    } else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) {
      substitutions++;
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      deletions++;
      i--;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      insertions++;
      j--;
    } else {
      if (i > 0) { deletions++; i--; }
      else if (j > 0) { insertions++; j--; }
    }
  }

  const totalErrors = substitutions + deletions + insertions;
  const werPercent = Math.round((totalErrors / n) * 100);

  return {
    werPercent,
    substitutions,
    deletions,
    insertions,
    referenceLength: n,
  };
}

/**
 * Aligns oral reading transcript against target passage words using Dyslexico phonetic/weighted matching
 * and Arabic Dialect Normalization to compute reviewed oral-reading WCPM and distinguish dialectal pronunciation from dyslexia.
 */
export function evaluateOralReadingAlignment(
  referenceWordsInput: string[] | string,
  spokenTranscript: string,
  durationSeconds: number,
  hesitationPauseCount: number = 0,
  dialect?: ArabicDialectCode
): OralReadingFluencyResult {
  const referenceWords = Array.isArray(referenceWordsInput)
    ? referenceWordsInput
    : typeof referenceWordsInput === 'string'
      ? referenceWordsInput
          .trim()
          .split(/\s+/)
          .filter(Boolean)
      : [];

  const spokenTokens = (spokenTranscript || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const totalWords = Math.max(1, referenceWords.length);
  const safeDurationMin = Math.max(0.05, durationSeconds / 60);
  const hasSentenceContext = referenceWords.length >= 2 && spokenTokens.length >= 2;

  if (spokenTokens.length === 0) {
    const alignment: OralWordAlignmentItem[] = referenceWords.map((w) => ({
      targetWord: w,
      spokenWord: null,
      status: 'omitted',
      weightedDistance: 1.0,
    }));
    return {
      wcpm: 0,
      totalWords,
      correctWordsCount: 0,
      dialectVariantCount: 0,
      phoneticSubstitutionCount: 0,
      omittedWordsCount: referenceWords.length,
      insertionCount: 0,
      substitutionsCount: 0,
      deletionsCount: referenceWords.length,
      accuracyPercent: 0,
      werPercent: null,
      standardWerPercent: null,
      hesitationPauseCount,
      alignment,
    };
  }

  const n = referenceWords.length;
  const m = spokenTokens.length;

  type MatchClass = {
    status: 'correct' | 'dialect_variant' | 'phonetic_substitution' | 'mismatch';
    cost: number;
    weightedDistance: number;
    dialectNoteAr?: string;
  };

  function classifyPair(targetRaw: string, candidateRaw: string): MatchClass {
    const targetClean = targetRaw
      .replace(/[.,!?،؟؛:"«»()[\]\u064B-\u0652\u0670]/g, '')
      .trim();
    const candidateClean = candidateRaw
      .replace(/[.,!?،؟؛:"«»()[\]\u064B-\u0652\u0670]/g, '')
      .trim();

    if (!targetClean || !candidateClean) {
      return { status: 'mismatch', cost: 1.2, weightedDistance: 1.0 };
    }

    const dialectInfo = normalizeArabicDialectWord(candidateClean, dialect);
    const { weightedDistance } = computeDyslexicoWeightedLevenshtein(
      candidateClean,
      targetClean
    );
    const orthoOrPauseMatch = isPureOrthographicNormalization(
      candidateClean,
      targetClean
    );
    const systematicShift = checkSystematicDialectPhonologicalShift(
      candidateClean,
      targetClean,
      dialect || 'egyptian',
      hasSentenceContext
    );

    if (
      (weightedDistance === 0 && candidateClean === targetClean) ||
      orthoOrPauseMatch
    ) {
      return {
        status: 'correct',
        cost: 0.0,
        weightedDistance: 0.0,
        dialectNoteAr: orthoOrPauseMatch
          ? 'تطبيع وقفي/إملائي قياسي (وقف بدون تنوين أو تاء مربوطة/همزة)'
          : undefined,
      };
    }

    if (
      dialectInfo.isDialectVariant &&
      (dialectInfo.canonicalMsa === targetClean ||
        dialectInfo.canonicalMsaAlternates.includes(targetClean))
    ) {
      return {
        status: 'dialect_variant',
        cost: 0.05,
        weightedDistance: Math.min(0.15, weightedDistance),
        dialectNoteAr: dialectInfo.dialectNoteAr,
      };
    }

    if (systematicShift.isShift) {
      return {
        status: 'dialect_variant',
        cost: 0.05,
        weightedDistance: Math.min(0.15, weightedDistance),
        dialectNoteAr: systematicShift.noteAr,
      };
    }

    if (weightedDistance <= 0.65) {
      return {
        status: 'phonetic_substitution',
        cost: 0.4 + weightedDistance * 0.4,
        weightedDistance,
      };
    }

    // Prefer pairing a clearly different ASR token as a substitution candidate (1.35)
    // over a deletion plus insertion (1.0 + 0.4). Downstream status remains unconfirmed
    // until a human or acoustic assessment verifies the child's actual pronunciation.
    return {
      status: 'mismatch',
      cost: 1.35,
      weightedDistance,
    };
  }

  // Precompute classification cache
  const memo: MatchClass[][] = Array.from({ length: n }, () => new Array(m));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      memo[i][j] = classifyPair(referenceWords[i], spokenTokens[j]);
    }
  }

  // Dynamic Programming Matrix for Global Sequence Alignment
  // Deletion (omitted reference word) cost = 1.0
  // Insertion (extra spoken word) cost = 0.4
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i * 1.0;
  for (let j = 0; j <= m; j++) dp[0][j] = j * 0.4;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const c = memo[i - 1][j - 1];
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + c.cost,
        dp[i - 1][j] + 1.0,
        dp[i][j - 1] + 0.4
      );
    }
  }

  // Backtrace to align all reference words
  let i = n;
  let j = m;
  const reversedAlignment: OralWordAlignmentItem[] = [];
  let correctWordsCount = 0;
  let dialectVariantCount = 0;
  let phoneticSubstitutionCount = 0;
  let omittedWordsCount = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const c = memo[i - 1][j - 1];
      if (Math.abs(dp[i][j] - (dp[i - 1][j - 1] + c.cost)) < 1e-5) {
        // A high-distance match is only a substitution candidate: the transcript may
        // contain an ASR recognition error, so report it for review rather than diagnosis.
        const alignmentStatus = c.status === 'mismatch' ? 'phonetic_substitution' : c.status;
        reversedAlignment.push({
          targetWord: referenceWords[i - 1],
          spokenWord: spokenTokens[j - 1],
          status: alignmentStatus,
          weightedDistance: c.weightedDistance,
          dialectNoteAr: c.dialectNoteAr,
        });
        if (alignmentStatus === 'correct') {
          correctWordsCount++;
        } else if (alignmentStatus === 'dialect_variant') {
          dialectVariantCount++;
          correctWordsCount++;
        } else if (alignmentStatus === 'phonetic_substitution') {
          phoneticSubstitutionCount++;
        }
        i--;
        j--;
        continue;
      }
    }

    if (i > 0 && (j === 0 || Math.abs(dp[i][j] - (dp[i - 1][j] + 1.0)) < 1e-5)) {
      reversedAlignment.push({
        targetWord: referenceWords[i - 1],
        spokenWord: null,
        status: 'omitted',
        weightedDistance: 1.0,
      });
      omittedWordsCount++;
      i--;
    } else {
      // Spoken token was an extra insertion
      j--;
    }
  }

  const alignment = reversedAlignment.reverse();
  const wcpm = Math.round(correctWordsCount / safeDurationMin);
  const accuracyPercent = Math.round((correctWordsCount / totalWords) * 100);

  const standardWerResult = computeStandardSequenceWer(referenceWords, spokenTokens);

  return {
    wcpm,
    totalWords,
    correctWordsCount,
    dialectVariantCount,
    phoneticSubstitutionCount,
    omittedWordsCount,
    insertionCount: standardWerResult ? standardWerResult.insertions : 0,
    substitutionsCount: standardWerResult ? standardWerResult.substitutions : 0,
    deletionsCount: standardWerResult ? standardWerResult.deletions : referenceWords.length,
    accuracyPercent,
    werPercent: standardWerResult ? standardWerResult.werPercent : null,
    standardWerPercent: standardWerResult ? standardWerResult.werPercent : null,
    hesitationPauseCount,
    alignment,
  };
}

