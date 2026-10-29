/**
 * Picture vocabulary used by the Baseera cognitive profile battery and its training program.
 *
 * Every entry is a concrete, picturable word familiar to Arabic-speaking children aged 4–8.
 * Phonological annotations follow pausal (وقف) pronunciation, which is how a child hears an
 * isolated word:
 *  - syllables: spoken syllable segmentation used for blending and counting tasks.
 *  - onset: first consonant (ء for words starting with hamza).
 *  - coda: last pronounced consonant, or null when the word ends in taa marbuta (pausal /h/),
 *    which children do not perceive as a stable final consonant.
 *  - rhyme: rime key; two words rhyme when their keys are equal. Capital vowels mark long vowels.
 */
export interface LexiconEntry {
  id: string;
  word: string;
  emoji: string;
  syllables: string[];
  onset: string;
  coda: string | null;
  rhyme: string;
}

const entries: LexiconEntry[] = [
  { id: 'cat', word: 'قِطَّة', emoji: '🐱', syllables: ['قِطْ', 'طَة'], onset: 'ق', coda: null, rhyme: 'aTTa' },
  { id: 'duck', word: 'بَطَّة', emoji: '🦆', syllables: ['بَطْ', 'طَة'], onset: 'ب', coda: null, rhyme: 'aTTa' },
  { id: 'dog', word: 'كَلْب', emoji: '🐶', syllables: ['كَلْبْ'], onset: 'ك', coda: 'ب', rhyme: 'alb' },
  { id: 'heart', word: 'قَلْب', emoji: '❤️', syllables: ['قَلْبْ'], onset: 'ق', coda: 'ب', rhyme: 'alb' },
  { id: 'bee', word: 'نَحْلَة', emoji: '🐝', syllables: ['نَحْ', 'لَة'], onset: 'ن', coda: null, rhyme: 'aHla' },
  { id: 'palm', word: 'نَخْلَة', emoji: '🌴', syllables: ['نَخْ', 'لَة'], onset: 'ن', coda: null, rhyme: 'axla' },
  { id: 'sword', word: 'سَيْف', emoji: '🗡️', syllables: ['سَيْفْ'], onset: 'س', coda: 'ف', rhyme: 'ayf' },
  { id: 'summer', word: 'صَيْف', emoji: '🏖️', syllables: ['صَيْفْ'], onset: 'ص', coda: 'ف', rhyme: 'ayf' },
  { id: 'sun', word: 'شَمْس', emoji: '☀️', syllables: ['شَمْسْ'], onset: 'ش', coda: 'س', rhyme: 'ams' },
  { id: 'moon', word: 'قَمَر', emoji: '🌙', syllables: ['قَ', 'مَرْ'], onset: 'ق', coda: 'ر', rhyme: 'ar' },
  { id: 'rain', word: 'مَطَر', emoji: '🌧️', syllables: ['مَ', 'طَرْ'], onset: 'م', coda: 'ر', rhyme: 'ar' },
  { id: 'door', word: 'بَاب', emoji: '🚪', syllables: ['بَابْ'], onset: 'ب', coda: 'ب', rhyme: 'Ab' },
  { id: 'book', word: 'كِتَاب', emoji: '📖', syllables: ['كِ', 'تَابْ'], onset: 'ك', coda: 'ب', rhyme: 'Ab' },
  { id: 'house', word: 'بَيْت', emoji: '🏠', syllables: ['بَيْتْ'], onset: 'ب', coda: 'ت', rhyme: 'ayt' },
  { id: 'pen', word: 'قَلَم', emoji: '✏️', syllables: ['قَ', 'لَمْ'], onset: 'ق', coda: 'م', rhyme: 'am' },
  { id: 'flag', word: 'عَلَم', emoji: '🚩', syllables: ['عَ', 'لَمْ'], onset: 'ع', coda: 'م', rhyme: 'am' },
  { id: 'mouth', word: 'فَم', emoji: '👄', syllables: ['فَمْ'], onset: 'ف', coda: 'م', rhyme: 'am' },
  { id: 'camel', word: 'جَمَل', emoji: '🐪', syllables: ['جَ', 'مَلْ'], onset: 'ج', coda: 'ل', rhyme: 'al' },
  { id: 'honey', word: 'عَسَل', emoji: '🍯', syllables: ['عَ', 'سَلْ'], onset: 'ع', coda: 'ل', rhyme: 'al' },
  { id: 'fish', word: 'سَمَكَة', emoji: '🐟', syllables: ['سَ', 'مَ', 'كَة'], onset: 'س', coda: null, rhyme: 'aka' },
  { id: 'elephant', word: 'فِيل', emoji: '🐘', syllables: ['فِيلْ'], onset: 'ف', coda: 'ل', rhyme: 'Il' },
  { id: 'banana', word: 'مَوْز', emoji: '🍌', syllables: ['مَوْزْ'], onset: 'م', coda: 'ز', rhyme: 'awz' },
  { id: 'apple', word: 'تُفَّاحَة', emoji: '🍎', syllables: ['تُفْ', 'فَا', 'حَة'], onset: 'ت', coda: null, rhyme: 'AHa' },
  { id: 'ball', word: 'كُرَة', emoji: '⚽', syllables: ['كُ', 'رَة'], onset: 'ك', coda: null, rhyme: 'ura' },
  { id: 'corn', word: 'ذُرَة', emoji: '🌽', syllables: ['ذُ', 'رَة'], onset: 'ذ', coda: null, rhyme: 'ura' },
  { id: 'car', word: 'سَيَّارَة', emoji: '🚗', syllables: ['سَيْ', 'يَا', 'رَة'], onset: 'س', coda: null, rhyme: 'Ara' },
  { id: 'lion', word: 'أَسَد', emoji: '🦁', syllables: ['أَ', 'سَدْ'], onset: 'ء', coda: 'د', rhyme: 'ad' },
  { id: 'hand', word: 'يَد', emoji: '✋', syllables: ['يَدْ'], onset: 'ي', coda: 'د', rhyme: 'ad' },
  { id: 'rabbit', word: 'أَرْنَب', emoji: '🐰', syllables: ['أَرْ', 'نَبْ'], onset: 'ء', coda: 'ب', rhyme: 'ab' },
  { id: 'grapes', word: 'عِنَب', emoji: '🍇', syllables: ['عِ', 'نَبْ'], onset: 'ع', coda: 'ب', rhyme: 'ab' },
  { id: 'fox', word: 'ثَعْلَب', emoji: '🦊', syllables: ['ثَعْ', 'لَبْ'], onset: 'ث', coda: 'ب', rhyme: 'ab' },
  { id: 'horse', word: 'حِصَان', emoji: '🐴', syllables: ['حِ', 'صَانْ'], onset: 'ح', coda: 'ن', rhyme: 'An' },
  { id: 'dress', word: 'فُسْتَان', emoji: '👗', syllables: ['فُسْ', 'تَانْ'], onset: 'ف', coda: 'ن', rhyme: 'An' },
  { id: 'bell', word: 'جَرَس', emoji: '🔔', syllables: ['جَ', 'رَسْ'], onset: 'ج', coda: 'س', rhyme: 'as' },
  { id: 'drum', word: 'طَبْل', emoji: '🥁', syllables: ['طَبْلْ'], onset: 'ط', coda: 'ل', rhyme: 'abl' },
  { id: 'rope', word: 'حَبْل', emoji: '🪢', syllables: ['حَبْلْ'], onset: 'ح', coda: 'ل', rhyme: 'abl' },
  { id: 'carrot', word: 'جَزَرَة', emoji: '🥕', syllables: ['جَ', 'زَ', 'رَة'], onset: 'ج', coda: null, rhyme: 'ara' },
  { id: 'tree', word: 'شَجَرَة', emoji: '🌳', syllables: ['شَ', 'جَ', 'رَة'], onset: 'ش', coda: null, rhyme: 'ara' },
  { id: 'cow', word: 'بَقَرَة', emoji: '🐄', syllables: ['بَ', 'قَ', 'رَة'], onset: 'ب', coda: null, rhyme: 'ara' },
  { id: 'bear', word: 'دُبّ', emoji: '🐻', syllables: ['دُبّ'], onset: 'د', coda: 'ب', rhyme: 'ubb' },
  { id: 'rooster', word: 'دِيك', emoji: '🐓', syllables: ['دِيكْ'], onset: 'د', coda: 'ك', rhyme: 'Ik' },
  { id: 'window', word: 'شُبَّاك', emoji: '🪟', syllables: ['شُبْ', 'بَاكْ'], onset: 'ش', coda: 'ك', rhyme: 'Ak' },
  { id: 'orange', word: 'بُرْتُقَالَة', emoji: '🍊', syllables: ['بُرْ', 'تُ', 'قَا', 'لَة'], onset: 'ب', coda: null, rhyme: 'Ala' },
  { id: 'turtle', word: 'سُلَحْفَاة', emoji: '🐢', syllables: ['سُ', 'لَحْ', 'فَاة'], onset: 'س', coda: null, rhyme: 'Ah' },
  { id: 'frog', word: 'ضِفْدَع', emoji: '🐸', syllables: ['ضِفْ', 'دَعْ'], onset: 'ض', coda: 'ع', rhyme: 'aE' },
  { id: 'key', word: 'مِفْتَاح', emoji: '🔑', syllables: ['مِفْ', 'تَاحْ'], onset: 'م', coda: 'ح', rhyme: 'AH' },
  { id: 'star', word: 'نَجْمَة', emoji: '⭐', syllables: ['نَجْ', 'مَة'], onset: 'ن', coda: null, rhyme: 'ama' },
  { id: 'mouse', word: 'فَأْر', emoji: '🐭', syllables: ['فَأْرْ'], onset: 'ف', coda: 'ر', rhyme: "a'r" },
  { id: 'eye', word: 'عَيْن', emoji: '👁️', syllables: ['عَيْنْ'], onset: 'ع', coda: 'ن', rhyme: 'ayn' },
  { id: 'milk', word: 'حَلِيب', emoji: '🥛', syllables: ['حَ', 'لِيبْ'], onset: 'ح', coda: 'ب', rhyme: 'Ib' },
  { id: 'bread', word: 'خُبْز', emoji: '🍞', syllables: ['خُبْزْ'], onset: 'خ', coda: 'ز', rhyme: 'ubz' },
  { id: 'snow', word: 'ثَلْج', emoji: '❄️', syllables: ['ثَلْجْ'], onset: 'ث', coda: 'ج', rhyme: 'alj' },
  { id: 'fire', word: 'نَار', emoji: '🔥', syllables: ['نَارْ'], onset: 'ن', coda: 'ر', rhyme: 'Ar' },
  { id: 'umbrella', word: 'مِظَلَّة', emoji: '☂️', syllables: ['مِ', 'ظَلْ', 'لَة'], onset: 'م', coda: null, rhyme: 'alla' },
  { id: 'egg', word: 'بَيْضَة', emoji: '🥚', syllables: ['بَيْ', 'ضَة'], onset: 'ب', coda: null, rhyme: 'ayDa' },
  { id: 'chicken', word: 'دَجَاجَة', emoji: '🐔', syllables: ['دَ', 'جَا', 'جَة'], onset: 'د', coda: null, rhyme: 'Aja' },
  { id: 'boat', word: 'قَارِب', emoji: '⛵', syllables: ['قَا', 'رِبْ'], onset: 'ق', coda: 'ب', rhyme: 'ib' },
  { id: 'plane', word: 'طَائِرَة', emoji: '✈️', syllables: ['طَا', 'ئِ', 'رَة'], onset: 'ط', coda: null, rhyme: 'ira' },
  { id: 'ear', word: 'أُذُن', emoji: '👂', syllables: ['أُ', 'ذُنْ'], onset: 'ء', coda: 'ن', rhyme: 'un' },
  { id: 'tiger', word: 'نَمِر', emoji: '🐯', syllables: ['نَ', 'مِرْ'], onset: 'ن', coda: 'ر', rhyme: 'ir' },
  { id: 'watch', word: 'سَاعَة', emoji: '⌚', syllables: ['سَا', 'عَة'], onset: 'س', coda: null, rhyme: 'Aa' },
  { id: 'chair', word: 'كُرْسِيّ', emoji: '🪑', syllables: ['كُرْ', 'سِيّ'], onset: 'ك', coda: 'ي', rhyme: 'iyy' },
];

export const LEXICON: Record<string, LexiconEntry> = Object.fromEntries(
  entries.map((entry) => [entry.id, entry])
);

export const LEXICON_IDS = entries.map((entry) => entry.id);

/**
 * Words whose picture a young child would not name with that word (e.g. 🏖️ for «صَيْف»,
 * which children call «بَحْر» or «شَاطِئ»). They are used in listening-only items, never as
 * pictures in training tasks.
 */
export const NOT_PICTURABLE = new Set(['summer']);

/**
 * Picture pairs a young child may call by the same name. They never appear together in one
 * question, because the answer would change with the name the child uses (name agreement is
 * the strongest predictor of picture naming; Khwaileh et al., 2018, Gulf Arabic norms).
 */
export const PICTURE_SYNONYMS: Array<[string, string]> = [
  ['horse', 'mare'],
  ['rooster', 'chicken'],
];
export const showsSynonymPair = (ids: string[]) => PICTURE_SYNONYMS.some(([a, b]) => ids.includes(a) && ids.includes(b));
export const PICTURE_IDS = LEXICON_IDS.filter((id) => !NOT_PICTURABLE.has(id));

export function lex(id: string): LexiconEntry {
  const entry = LEXICON[id];
  if (!entry) throw new Error(`Unknown lexicon id: ${id}`);
  return entry;
}

/** Arabic letter groups whose members differ only by dots or a small stroke. */
export const CONFUSABLE_LETTER_GROUPS: string[][] = [
  ['ب', 'ت', 'ث', 'ن', 'ي'],
  ['ج', 'ح', 'خ'],
  ['د', 'ذ'],
  ['ر', 'ز'],
  ['س', 'ش'],
  ['ص', 'ض'],
  ['ط', 'ظ'],
  ['ع', 'غ'],
  ['ف', 'ق'],
];

/**
 * Standard-Arabic sounds that common spoken dialects merge (e.g. «ذُرَة» is «دُرَة» in Egyptian and
 * Levantine speech, «ثَلْج» is «تَلْج», «قَمَر» is «ءَمَر» or «گَمَر»). In a first/last-sound item
 * two options from the same group could both be "right" for a child of that dialect, so scored
 * items never put them side by side (see Saiegh-Haddad 2003, 2004 on diglossia and phonological awareness).
 */
export const DIALECT_MERGE_GROUPS: string[][] = [
  ['ث', 'ت', 'س'],
  ['ذ', 'د', 'ز'],
  ['ظ', 'ض', 'ز', 'د'],
  ['ق', 'ء', 'ك'],
];

export function dialectMerged(a: string, b: string): boolean {
  return a !== b && DIALECT_MERGE_GROUPS.some((g) => g.includes(a) && g.includes(b));
}

/** Arabic phoneme pairs that young readers commonly confuse when listening or spelling. */
export const CONFUSABLE_PHONEME_PAIRS: Array<[string, string]> = [
  ['ت', 'ط'],
  ['س', 'ص'],
  ['د', 'ض'],
  ['ذ', 'ز'],
  ['ك', 'ق'],
  ['ح', 'ه'],
  ['ث', 'س'],
  ['ذ', 'د'],
  ['ظ', 'ض'],
  ['ع', 'ء'],
  ['خ', 'غ'],
];

/** Pairs that differ in place and manner; used for easy (early) discrimination training. */
export const DISTANT_PHONEME_PAIRS: Array<[string, string]> = [
  ['ب', 'م'],
  ['س', 'ل'],
  ['ك', 'ر'],
  ['ف', 'ن'],
  ['د', 'ش'],
];
