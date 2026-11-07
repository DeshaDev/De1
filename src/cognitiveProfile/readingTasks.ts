/**
 * Direct reading and spelling measures for the screening battery: real-word reading, made-up
 * (nonsense) word decoding, oral passage reading, dictation, and rapid automatized naming (RAN).
 *
 * Why these belong in the core path:
 * - The working definition of dyslexia is difficulty with accurate and/or fluent word recognition,
 *   poor spelling and poor decoding (Lyon, Shaywitz & Shaywitz, 2003, Annals of Dyslexia 53).
 *   Precursor skills predict these; once a child is taught to read they should be measured directly.
 * - Made-up words cannot be read from memory, so they isolate decoding (Rack, Snowling & Olson,
 *   1992, Reading Research Quarterly 27).
 * - In vowelled Arabic, accuracy rises quickly and speed separates readers better, so every list
 *   records time as well as accuracy (Saiegh-Haddad & Joshi, eds., Handbook of Arabic Literacy, 2014).
 * - RAN predicts reading fluency across languages, independently of phonological awareness
 *   (Denckla & Rudel, 1976; Wolf & Bowers, 1999; Norton & Wolf, 2012; Araújo et al., 2015).
 *
 * Administration follows the usual individual tests (TOWRE, DIBELS, the Denckla–Rudel RAN): the
 * child reads aloud; the audio tasks are evaluated only from a complete server-verified Azure receipt.
 * No adult word marking is used. Spelling is typed on letter tiles and scored
 * automatically. None of the items is normed yet: results are reported as raw counts, rates and
 * times, never as percentiles or risk levels.
 */

/** Ages (in months) from which a child is expected to have had reading instruction (Grade 1). */
export const READING_MIN_AGE_MONTHS = 72;

export type ReadLevel = 1 | 2 | 3 | 4;

export interface ReadItem {
  id: string;
  /** Fully vowelled form shown to the child. */
  text: string;
  level: ReadLevel;
  /** What the item adds in difficulty, for the examiner and the review page. */
  structureAr: string;
}

export interface SpellItem {
  id: string;
  /** Vowelled word, as spoken in the dictation. */
  spoken: string;
  /** Expected spelling without short-vowel marks. */
  answer: string;
  level: ReadLevel;
  structureAr: string;
}

// ---------------------------------------------------------------------------
// Real words: frequent in early Arabic readers, graded by syllable structure.
// ---------------------------------------------------------------------------
export const WORD_PRACTICE: ReadItem[] = [
  { id: 'wr-p1', text: 'مَاء', level: 1, structureAr: 'مقطع واحد بمدّ' },
];

export const WORD_ITEMS: ReadItem[] = [
  { id: 'wr-1', text: 'بَاب', level: 1, structureAr: 'مقطع واحد بمدّ' },
  { id: 'wr-2', text: 'فِيل', level: 1, structureAr: 'مقطع واحد بمدّ' },
  { id: 'wr-3', text: 'بَيْت', level: 1, structureAr: 'مقطع واحد بحرف لين وسكون' },
  { id: 'wr-4', text: 'يَد', level: 1, structureAr: 'مقطع واحد قصير' },
  { id: 'wr-5', text: 'قَلَم', level: 2, structureAr: 'مقطعان بحركات قصيرة' },
  { id: 'wr-6', text: 'جَمَل', level: 2, structureAr: 'مقطعان بحركات قصيرة' },
  { id: 'wr-7', text: 'وَلَد', level: 2, structureAr: 'مقطعان بحركات قصيرة' },
  { id: 'wr-8', text: 'كِتَاب', level: 2, structureAr: 'مقطعان بمدّ' },
  { id: 'wr-9', text: 'سَمَكَة', level: 3, structureAr: 'ثلاثة مقاطع وتاء مربوطة' },
  { id: 'wr-10', text: 'شَجَرَة', level: 3, structureAr: 'ثلاثة مقاطع وتاء مربوطة' },
  { id: 'wr-11', text: 'مَدْرَسَة', level: 3, structureAr: 'ثلاثة مقاطع بسكون وسط الكلمة' },
  { id: 'wr-12', text: 'حَدِيقَة', level: 3, structureAr: 'ثلاثة مقاطع بمدّ' },
  { id: 'wr-13', text: 'الشَّمْس', level: 4, structureAr: 'لام شمسية لا تُنطق، وشدّة' },
  { id: 'wr-14', text: 'سَيَّارَة', level: 4, structureAr: 'شدّة ومدّ وتاء مربوطة' },
  { id: 'wr-15', text: 'المُعَلِّم', level: 4, structureAr: 'لام قمرية وشدّة وأربعة مقاطع' },
  { id: 'wr-16', text: 'مُسْتَشْفَى', level: 4, structureAr: 'أربعة مقاطع بسكونين وألف مقصورة' },
];

// ---------------------------------------------------------------------------
// Made-up words: legal Arabic syllables and patterns that are not words.
// Built to avoid ث ذ ظ ق (pronounced differently across dialects; ج is accepted in any dialect form),
// real words in MSA and in the main dialects, and near-homophones of common words. They are candidates: a linguist checks
// lexical absence in each target dialect before norming (docs/VALIDATION_PLAN_AR.md).
// ---------------------------------------------------------------------------
export const NONWORD_PRACTICE: ReadItem[] = [
  { id: 'nw-p1', text: 'فُوب', level: 1, structureAr: 'مقطع واحد بمدّ' },
];

export const NONWORD_ITEMS: ReadItem[] = [
  { id: 'nw-1', text: 'فَزَب', level: 1, structureAr: 'مقطعان بحركات قصيرة' },
  { id: 'nw-2', text: 'دُمَك', level: 1, structureAr: 'مقطعان بحركات قصيرة' },
  { id: 'nw-3', text: 'شِدَف', level: 1, structureAr: 'مقطعان بحركات قصيرة' },
  { id: 'nw-4', text: 'زَفَك', level: 1, structureAr: 'مقطعان بحركات قصيرة' },
  { id: 'nw-5', text: 'بَاكِف', level: 2, structureAr: 'مقطعان بمدّ في الأول' },
  { id: 'nw-6', text: 'تُومَد', level: 2, structureAr: 'مقطعان بمدّ في الأول' },
  { id: 'nw-7', text: 'رِيفَم', level: 2, structureAr: 'مقطعان بمدّ في الأول' },
  { id: 'nw-8', text: 'لَزُوف', level: 2, structureAr: 'مقطعان بمدّ في الثاني' },
  { id: 'nw-9', text: 'مَفْكُوز', level: 3, structureAr: 'وزن مَفْعُول: سكون ومدّ' },
  { id: 'nw-10', text: 'دَنْفَلَة', level: 3, structureAr: 'ثلاثة مقاطع بسكون وتاء مربوطة' },
  { id: 'nw-11', text: 'سُفْتَام', level: 3, structureAr: 'سكون ومدّ' },
  { id: 'nw-12', text: 'جُرْفَال', level: 3, structureAr: 'سكون ومدّ' },
];

// ---------------------------------------------------------------------------
// Oral reading passage: short, fully vowelled, first-grade vocabulary. One minute, adult marks.
// ---------------------------------------------------------------------------
export const PASSAGE_TITLE = 'سَامِي فِي السُّوقِ';
export const PASSAGE_TEXT =
  'ذَهَبَ سَامِي مَعَ أَبِيهِ إِلَى السُّوقِ. رَأَى سَامِي تُفَّاحًا أَحْمَرَ وَمَوْزًا أَصْفَرَ. ' +
  'اشْتَرَى الأَبُ سَمَكَةً كَبِيرَةً وَخُبْزًا سَاخِنًا. فِي الطَّرِيقِ رَأَى سَامِي قِطَّةً صَغِيرَةً تَحْتَ شَجَرَةٍ. ' +
  'أَعْطَاهَا قِطْعَةً مِنَ الخُبْزِ، فَأَكَلَتْ وَفَرِحَتْ. عَادَ سَامِي إِلَى البَيْتِ سَعِيدًا.';
export const PASSAGE_WORDS: string[] = PASSAGE_TEXT.split(/\s+/).filter(Boolean);
export const PASSAGE_TIME_LIMIT_SEC = 60;
export const passageWordId = (index: number) => `or-${index + 1}`;

// ---------------------------------------------------------------------------
// Dictation: the word is spoken; the child builds it from letter tiles.
// ---------------------------------------------------------------------------
export const SPELL_PRACTICE: SpellItem[] = [
  { id: 'sp-p1', spoken: 'دَار', answer: 'دار', level: 1, structureAr: 'مقطع واحد بمدّ' },
];

export const SPELL_ITEMS: SpellItem[] = [
  { id: 'sp-1', spoken: 'بَاب', answer: 'باب', level: 1, structureAr: 'مقطع واحد بمدّ' },
  { id: 'sp-2', spoken: 'فِيل', answer: 'فيل', level: 1, structureAr: 'مقطع واحد بمدّ' },
  { id: 'sp-3', spoken: 'نُور', answer: 'نور', level: 1, structureAr: 'مقطع واحد بمدّ' },
  { id: 'sp-4', spoken: 'قَلَم', answer: 'قلم', level: 2, structureAr: 'حركات قصيرة لا تُكتب حروفًا' },
  { id: 'sp-5', spoken: 'جَمَل', answer: 'جمل', level: 2, structureAr: 'حركات قصيرة لا تُكتب حروفًا' },
  { id: 'sp-6', spoken: 'وَلَد', answer: 'ولد', level: 2, structureAr: 'حركات قصيرة لا تُكتب حروفًا' },
  { id: 'sp-7', spoken: 'كِتَاب', answer: 'كتاب', level: 3, structureAr: 'تمييز الحركة القصيرة من المدّ' },
  { id: 'sp-8', spoken: 'مِفْتَاح', answer: 'مفتاح', level: 3, structureAr: 'سكون ومدّ' },
  { id: 'sp-9', spoken: 'عُصْفُور', answer: 'عصفور', level: 3, structureAr: 'صاد مفخّمة، سكون ومدّ' },
  { id: 'sp-10', spoken: 'شَجَرَة', answer: 'شجرة', level: 4, structureAr: 'تاء مربوطة لا هاء' },
  { id: 'sp-11', spoken: 'الشَّمْس', answer: 'الشمس', level: 4, structureAr: 'لام شمسية تُكتب ولا تُنطق' },
  { id: 'sp-12', spoken: 'مُسْتَشْفَى', answer: 'مستشفى', level: 4, structureAr: 'ألف مقصورة في الآخر' },
];

/** Tile keyboard, in alphabetical order, then the letters whose spelling is taught separately. */
export const SPELL_KEYBOARD: string[] = [
  'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي',
  'ة', 'ى', 'أ', 'إ', 'آ', 'ء', 'ؤ', 'ئ',
];
export const SPELL_MAX_LETTERS = 12;

/** Removes short-vowel marks and tatweel; letters (including hamza seats, ة and ى) are kept. */
export function stripMarks(s: string): string {
  return s.normalize('NFC').replace(/[ً-ْٰـ]/g, '');
}

function editDistance(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/**
 * Letter-level spelling score: 1 − edit distance ÷ the longer length, so a near miss
 * (كتب for كتاب) earns partial credit that a right/wrong score hides.
 */
export function letterAccuracy(typed: string, answer: string): number {
  const a = Array.from(stripMarks(typed));
  const b = Array.from(stripMarks(answer));
  if (a.length === 0 && b.length === 0) return 1;
  return Math.max(0, 1 - editDistance(a, b) / Math.max(a.length, b.length));
}

/** Kinds of spelling error the report names, so the adult sees what to teach. */
export type SpellErrorKind = 'longVowel' | 'taaMarbuta' | 'alifMaqsura' | 'silentLam' | 'hamza' | 'letter';

export function spellingErrorKinds(typed: string, answer: string): SpellErrorKind[] {
  const t = stripMarks(typed);
  const a = stripMarks(answer);
  if (t === a) return [];
  const kinds = new Set<SpellErrorKind>();
  const longVowels = (s: string) => Array.from(s).filter((c) => 'اوي'.includes(c)).length;
  if (a.endsWith('ة') && !t.endsWith('ة')) kinds.add('taaMarbuta');
  if (a.endsWith('ى') && !t.endsWith('ى')) kinds.add('alifMaqsura');
  if (a.startsWith('ال') && /^ا[^ل]/.test(t)) kinds.add('silentLam');
  if (/[أإآءؤئ]/.test(a + t) && t.replace(/[أإآ]/g, 'ا') === a.replace(/[أإآ]/g, 'ا')) kinds.add('hamza');
  if (longVowels(t.replace(/ى$/, '')) !== longVowels(a.replace(/ى$/, ''))) kinds.add('longVowel');
  if (kinds.size === 0) kinds.add('letter');
  return [...kinds];
}

export const SPELL_ERROR_TEXT_AR: Record<SpellErrorKind, string> = {
  longVowel: 'حروف المدّ (ا و ي): حذفها أو إضافتها',
  taaMarbuta: 'التاء المربوطة في آخر الكلمة',
  alifMaqsura: 'الألف المقصورة (ى) في آخر الكلمة',
  silentLam: 'اللام الشمسية التي تُكتب ولا تُنطق',
  hamza: 'كتابة الهمزة',
  letter: 'حرف بحرف آخر أو ترتيب الحروف',
};

// ---------------------------------------------------------------------------
// Rapid automatized naming
// ---------------------------------------------------------------------------
export interface RanSymbol {
  id: string;
  /** Lexicon id for pictures, or the letter itself. */
  value: string;
  nameAr: string;
}

/** Five early-acquired pictures with full name agreement in the Gulf norms (Khwaileh et al., 2018). */
export const RAN_OBJECTS: RanSymbol[] = [
  { id: 'sun', value: 'sun', nameAr: 'شَمْس' },
  { id: 'house', value: 'house', nameAr: 'بَيْت' },
  { id: 'ball', value: 'ball', nameAr: 'كُرَة' },
  { id: 'door', value: 'door', nameAr: 'بَاب' },
  { id: 'key', value: 'key', nameAr: 'مِفْتَاح' },
];

/** Five frequent letters that differ in shape and dots, so the task measures naming, not discrimination. */
export const RAN_LETTERS: RanSymbol[] = [
  { id: 'م', value: 'م', nameAr: 'مِيم' },
  { id: 'ل', value: 'ل', nameAr: 'لَام' },
  { id: 'س', value: 'س', nameAr: 'سِين' },
  { id: 'د', value: 'د', nameAr: 'دَال' },
  { id: 'ب', value: 'ب', nameAr: 'بَاء' },
];

export const RAN_COLUMNS = 5;
export const RAN_ROWS = 8;
export const RAN_GRID_SIZE = RAN_COLUMNS * RAN_ROWS;

/**
 * A fixed grid (the same for every child, as in printed RAN charts): each symbol appears equally
 * often and never twice in a row, including across the end of a row.
 */
export function buildRanGrid(ids: string[], seed: number): string[] {
  let state = seed >>> 0 || 1;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const per = RAN_GRID_SIZE / ids.length;
  for (let attempt = 0; attempt < 200; attempt++) {
    const left = Object.fromEntries(ids.map((id) => [id, per])) as Record<string, number>;
    const grid: string[] = [];
    let ok = true;
    for (let i = 0; i < RAN_GRID_SIZE; i++) {
      const prev = grid[i - 1];
      const options = ids.filter((id) => left[id] > 0 && id !== prev);
      if (options.length === 0) {
        ok = false;
        break;
      }
      // Prefer the symbols with most left, so the end of the grid does not run out of choices.
      const most = Math.max(...options.map((id) => left[id]));
      const pool = options.filter((id) => left[id] >= most - 1);
      const pick = pool[Math.floor(rand() * pool.length)];
      grid.push(pick);
      left[pick]--;
    }
    if (ok) return grid;
  }
  throw new Error('RAN grid could not be built');
}

export const RAN_OBJECT_GRID = buildRanGrid(RAN_OBJECTS.map((s) => s.id), 2026);
export const RAN_LETTER_GRID = buildRanGrid(RAN_LETTERS.map((s) => s.id), 4049);

/** Items per second, the usual RAN rate (higher is faster). */
export function ranRate(items: number, durationMs: number): number {
  return durationMs > 0 ? Number(((items * 1000) / durationMs).toFixed(2)) : 0;
}

/** Words read correctly per minute. */
export function perMinute(correct: number, durationMs: number): number {
  return durationMs > 0 ? Math.round((correct * 60_000) / durationMs) : 0;
}
