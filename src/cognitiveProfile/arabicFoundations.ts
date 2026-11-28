/**
 * Comprehensive Arabic Reading & Language Foundations Curriculum (`هَيَّا نَقْرَأْ`).
 *
 * Synthesized & adapted from our verified Arabic pedagogy modules:
 * - Montessori Sandpaper Letters & Movable Alphabet (`skills.ts` / `SandLetters.tsx`)
 * - Gulf KG1–KG2 Phonemic & Syllabic Units (`kg.ts` / `lessons.ts`)
 * - 28-Letter Visual & Phonetic Cards (`alphabet.ts`)
 * - Gulf Primary Arabic Language & Morphology Units (`arabic/skills.ts`)
 *
 * All words carry accurate diacritics so children hear and see exact phonemic patterns.
 */

export interface VowelSyllableTile {
  text: string;
  say: string;
}

export interface FoundationLetter {
  id: number;
  letter: string;
  nameAr: string;
  soundFatha: string;
  vowelStrip: VowelSyllableTile[];
  wordAr: string;
  art: string;
  isLongVowel: boolean;
  confusableWith: string[];
  color: string;
  bgColor: string;
}

export interface MovableAlphabetWord {
  word: string;
  letters: string[];
  art: string;
  focusAr: string;
}

export interface PhonemicBasketItem {
  art: string;
  name: string;
}

export interface PhonemicBasketRound {
  id: string;
  titleAr: string;
  targetLetter: string;
  targetSound: string;
  promptAr: string;
  hits: PhonemicBasketItem[];
  misses: PhonemicBasketItem[];
}

export interface ArabicLanguageItem {
  id: string;
  promptAr: string;
  showAr: string;
  options: string[];
  correctAnswer: string;
  explanationAr: string;
}

export interface ArabicLanguageUnit {
  id: 'fem_verb' | 'word_types' | 'noun_kinds' | 'ta_ha';
  titleAr: string;
  emoji: string;
  gradeLabelAr: string;
  goalAr: string;
  ruleAr: string[];
  exampleShowAr: string;
  exampleNoteAr: string;
  items: ArabicLanguageItem[];
}

export const LONG_VOWELS = new Set(['ا', 'و', 'ي']);

/** Arabic right-joining-only letters ("الحروف الرافصة"): connect to preceding letter only, never the following letter. */
export const NON_CONNECTING_AFTER_LETTERS = new Set([
  'ا',
  'أ',
  'إ',
  'آ',
  'د',
  'ذ',
  'ر',
  'ز',
  'و',
  'ة',
  'ء',
  'ى',
  'ؤ',
]);

export type LetterConnectionPosition = 'isolated' | 'initial' | 'medial' | 'final';

export interface PositionalLetterForms {
  letter: string;
  isolated: string;
  initial: string;
  medial: string;
  final: string;
  connectsLeft: boolean;
  positionHintAr: string;
}

export interface WordConnectedLetterSlot {
  letter: string;
  form: string;
  position: LetterConnectionPosition;
  connectsToPrev: boolean;
  connectsToNext: boolean;
}

const DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u0640]/g;

function stripDiacritics(charOrWord: string): string {
  return charOrWord.replace(DIACRITICS_REGEX, '').trim();
}

/**
 * Returns the 4 Arabic positional forms (isolated, initial, medial, final)
 * for any Arabic letter, respecting non-left-connecting ("رافصة") letters.
 */
export function getPositionalLetterForms(letter: string): PositionalLetterForms {
  const clean = stripDiacritics(letter) || letter.trim();
  const baseChar = Array.from(clean)[0] ?? clean;
  const connectsLeft = Boolean(baseChar) && !NON_CONNECTING_AFTER_LETTERS.has(baseChar);

  if (!connectsLeft) {
    return {
      letter: baseChar,
      isolated: baseChar,
      initial: baseChar,
      medial: `ـ${baseChar}`,
      final: `ـ${baseChar}`,
      connectsLeft: false,
      positionHintAr: 'حرف رافص أنيق: يمسك بالحرف قبله فقط ولا يمدّ يده لما بعده',
    };
  }

  return {
    letter: baseChar,
    isolated: baseChar,
    initial: `${baseChar}ـ`,
    medial: `ـ${baseChar}ـ`,
    final: `ـ${baseChar}`,
    connectsLeft: true,
    positionHintAr: 'حرف متصل: يمدّ يده ليمسك بأصدقائه في الكلمة',
  };
}

/**
 * Computes the exact contextual connected shape for each letter in a decomposed word,
 * e.g. ['ك', 'ت', 'ا', 'ب'] -> ['كـ', 'ـتـ', 'ـا', 'ب'].
 */
export function getWordConnectedForms(letters: string[]): WordConnectedLetterSlot[] {
  return letters.map((rawLetter, index) => {
    const clean = stripDiacritics(rawLetter) || rawLetter.trim();
    const prevRaw = index > 0 ? stripDiacritics(letters[index - 1] ?? '') : '';
    const prevConnectsLeft = Boolean(prevRaw) && !NON_CONNECTING_AFTER_LETTERS.has(prevRaw);
    const hasNext = index < letters.length - 1;
    const currentConnectsLeft = Boolean(clean) && !NON_CONNECTING_AFTER_LETTERS.has(clean);

    const connectsToPrev = index > 0 && prevConnectsLeft;
    const connectsToNext = hasNext && currentConnectsLeft;

    let position: LetterConnectionPosition = 'isolated';
    if (connectsToPrev && connectsToNext) {
      position = 'medial';
    } else if (!connectsToPrev && connectsToNext) {
      position = 'initial';
    } else if (connectsToPrev && !connectsToNext) {
      position = 'final';
    }

    const form = `${connectsToPrev ? 'ـ' : ''}${rawLetter.trim()}${connectsToNext ? 'ـ' : ''}`;

    return {
      letter: rawLetter.trim(),
      form,
      position,
      connectsToPrev,
      connectsToNext,
    };
  });
}

function makeStrip(base: string): VowelSyllableTile[] {
  if (base === 'ا') {
    return [
      { text: 'أَ', say: 'أَ' },
      { text: 'أُ', say: 'أُ' },
      { text: 'إِ', say: 'إِ' },
      { text: 'آ', say: 'آ' },
      { text: 'أُو', say: 'أُو' },
      { text: 'إِي', say: 'إِي' },
    ];
  }
  return [
    { text: `${base}َ`, say: `${base}َ` },
    { text: `${base}ُ`, say: `${base}ُ` },
    { text: `${base}ِ`, say: `${base}ِ` },
    { text: `${base}َا`, say: `${base}َا` },
    { text: `${base}ُو`, say: `${base}ُو` },
    { text: `${base}ِي`, say: `${base}ِي` },
  ];
}

export const ARABIC_FOUNDATION_LETTERS: FoundationLetter[] = [
  { id: 0, letter: 'ا', nameAr: 'أَلِف', soundFatha: 'أَ', vowelStrip: makeStrip('ا'), wordAr: 'أَرْنَب', art: '🐰', isLongVowel: true, confusableWith: ['ع', 'ل'], color: '#E11D48', bgColor: '#FFF1F2' },
  { id: 1, letter: 'ب', nameAr: 'بَاء', soundFatha: 'بَ', vowelStrip: makeStrip('ب'), wordAr: 'بَطَّة', art: '🦆', isLongVowel: false, confusableWith: ['ت', 'ث', 'ن'], color: '#0D9488', bgColor: '#F0FDFA' },
  { id: 2, letter: 'ت', nameAr: 'تَاء', soundFatha: 'تَ', vowelStrip: makeStrip('ت'), wordAr: 'تُفَّاحَة', art: '🍎', isLongVowel: false, confusableWith: ['ط', 'ث', 'ب'], color: '#0284C7', bgColor: '#F0F9FF' },
  { id: 3, letter: 'ث', nameAr: 'ثَاء', soundFatha: 'ثَ', vowelStrip: makeStrip('ث'), wordAr: 'ثَعْلَب', art: '🦊', isLongVowel: false, confusableWith: ['ت', 'س', 'ذ'], color: '#059669', bgColor: '#ECFDF5' },
  { id: 4, letter: 'ج', nameAr: 'جِيم', soundFatha: 'جَ', vowelStrip: makeStrip('ج'), wordAr: 'جَمَل', art: '🐪', isLongVowel: false, confusableWith: ['ح', 'خ'], color: '#D97706', bgColor: '#FFFBEB' },
  { id: 5, letter: 'ح', nameAr: 'حَاء', soundFatha: 'حَ', vowelStrip: makeStrip('ح'), wordAr: 'حِصَان', art: '🐴', isLongVowel: false, confusableWith: ['ج', 'خ', 'ه'], color: '#9333EA', bgColor: '#FAF5FF' },
  { id: 6, letter: 'خ', nameAr: 'خَاء', soundFatha: 'خَ', vowelStrip: makeStrip('خ'), wordAr: 'خَرُوف', art: '🐑', isLongVowel: false, confusableWith: ['ح', 'ج', 'غ'], color: '#EA580C', bgColor: '#FFF7ED' },
  { id: 7, letter: 'د', nameAr: 'دَال', soundFatha: 'دَ', vowelStrip: makeStrip('د'), wordAr: 'دُبّ', art: '🐻', isLongVowel: false, confusableWith: ['ض', 'ذ', 'ر'], color: '#0F766E', bgColor: '#F0FDFA' },
  { id: 8, letter: 'ذ', nameAr: 'ذَال', soundFatha: 'ذَ', vowelStrip: makeStrip('ذ'), wordAr: 'ذُرَة', art: '🌽', isLongVowel: false, confusableWith: ['ز', 'د', 'ظ'], color: '#0369A1', bgColor: '#F0F9FF' },
  { id: 9, letter: 'ر', nameAr: 'رَاء', soundFatha: 'رَ', vowelStrip: makeStrip('ر'), wordAr: 'رِيشَة', art: '🪶', isLongVowel: false, confusableWith: ['ز', 'د'], color: '#BE185D', bgColor: '#FDF2F8' },
  { id: 10, letter: 'ز', nameAr: 'زَاي', soundFatha: 'زَ', vowelStrip: makeStrip('ز'), wordAr: 'زَهْرَة', art: '🌸', isLongVowel: false, confusableWith: ['ذ', 'ر', 'ظ'], color: '#10B981', bgColor: '#ECFDF5' },
  { id: 11, letter: 'س', nameAr: 'سِين', soundFatha: 'سَ', vowelStrip: makeStrip('س'), wordAr: 'سَمَكَة', art: '🐟', isLongVowel: false, confusableWith: ['ص', 'ش', 'ث'], color: '#4F46E5', bgColor: '#EEF2FF' },
  { id: 12, letter: 'ش', nameAr: 'شِين', soundFatha: 'شَ', vowelStrip: makeStrip('ش'), wordAr: 'شَمْس', art: '☀️', isLongVowel: false, confusableWith: ['س', 'ث'], color: '#E11D48', bgColor: '#FFF1F2' },
  { id: 13, letter: 'ص', nameAr: 'صَاد', soundFatha: 'صَ', vowelStrip: makeStrip('ص'), wordAr: 'صَقْر', art: '🦅', isLongVowel: false, confusableWith: ['س', 'ض'], color: '#65A30D', bgColor: '#F7FEE7' },
  { id: 14, letter: 'ض', nameAr: 'ضَاد', soundFatha: 'ضَ', vowelStrip: makeStrip('ض'), wordAr: 'ضِفْدَع', art: '🐸', isLongVowel: false, confusableWith: ['د', 'ص', 'ظ'], color: '#059669', bgColor: '#ECFDF5' },
  { id: 15, letter: 'ط', nameAr: 'طَاء', soundFatha: 'طَ', vowelStrip: makeStrip('ط'), wordAr: 'طَائِرَة', art: '✈️', isLongVowel: false, confusableWith: ['ت', 'ظ'], color: '#D97706', bgColor: '#FFFBEB' },
  { id: 16, letter: 'ظ', nameAr: 'ظَاء', soundFatha: 'ظَ', vowelStrip: makeStrip('ظ'), wordAr: 'ظَرْف', art: '✉️', isLongVowel: false, confusableWith: ['ذ', 'ط', 'ض'], color: '#0891B2', bgColor: '#ECFEFF' },
  { id: 17, letter: 'ع', nameAr: 'عَيْن', soundFatha: 'عَ', vowelStrip: makeStrip('ع'), wordAr: 'عِنَب', art: '🍇', isLongVowel: false, confusableWith: ['غ', 'ا'], color: '#DB2777', bgColor: '#FDF2F8' },
  { id: 18, letter: 'غ', nameAr: 'غَيْن', soundFatha: 'غَ', vowelStrip: makeStrip('غ'), wordAr: 'غَيْمَة', art: '☁️', isLongVowel: false, confusableWith: ['ع', 'خ'], color: '#7C3AED', bgColor: '#F5F3FF' },
  { id: 19, letter: 'ف', nameAr: 'فَاء', soundFatha: 'فَ', vowelStrip: makeStrip('ف'), wordAr: 'فِيل', art: '🐘', isLongVowel: false, confusableWith: ['ق'], color: '#2563EB', bgColor: '#EFF6FF' },
  { id: 20, letter: 'ق', nameAr: 'قَاف', soundFatha: 'قَ', vowelStrip: makeStrip('ق'), wordAr: 'قَمَر', art: '🌙', isLongVowel: false, confusableWith: ['ف', 'ك'], color: '#0D9488', bgColor: '#F0FDFA' },
  { id: 21, letter: 'ك', nameAr: 'كَاف', soundFatha: 'كَ', vowelStrip: makeStrip('ك'), wordAr: 'كِتَاب', art: '📖', isLongVowel: false, confusableWith: ['ق', 'ل'], color: '#CA8A04', bgColor: '#FEFCE8' },
  { id: 22, letter: 'ل', nameAr: 'لَام', soundFatha: 'لَ', vowelStrip: makeStrip('ل'), wordAr: 'لَيْمُون', art: '🍋', isLongVowel: false, confusableWith: ['ا', 'ك'], color: '#E11D48', bgColor: '#FFF1F2' },
  { id: 23, letter: 'م', nameAr: 'مِيم', soundFatha: 'مَ', vowelStrip: makeStrip('م'), wordAr: 'مَوْز', art: '🍌', isLongVowel: false, confusableWith: ['ن', 'ه'], color: '#0284C7', bgColor: '#F0F9FF' },
  { id: 24, letter: 'ن', nameAr: 'نُون', soundFatha: 'نَ', vowelStrip: makeStrip('ن'), wordAr: 'نَمِر', art: '🐯', isLongVowel: false, confusableWith: ['ب', 'ت', 'ي'], color: '#65A30D', bgColor: '#F7FEE7' },
  { id: 25, letter: 'ه', nameAr: 'هَاء', soundFatha: 'هَ', vowelStrip: makeStrip('ه'), wordAr: 'هَدِيَّة', art: '🎁', isLongVowel: false, confusableWith: ['ح', 'م'], color: '#EA580C', bgColor: '#FFF7ED' },
  { id: 26, letter: 'و', nameAr: 'وَاو', soundFatha: 'وَ', vowelStrip: makeStrip('و'), wordAr: 'وَرْدَة', art: '🌹', isLongVowel: true, confusableWith: ['ف', 'ق'], color: '#0284C7', bgColor: '#F0F9FF' },
  { id: 27, letter: 'ي', nameAr: 'يَاء', soundFatha: 'يَ', vowelStrip: makeStrip('ي'), wordAr: 'يَد', art: '✋', isLongVowel: true, confusableWith: ['ب', 'ت', 'ن'], color: '#0891B2', bgColor: '#ECFEFF' },
];

export const MOVABLE_ALPHABET_WORDS: MovableAlphabetWord[] = [
  { word: 'بَاب', letters: ['ب', 'ا', 'ب'], art: '🚪', focusAr: 'مدّ الألف' },
  { word: 'بَيْت', letters: ['ب', 'ي', 'ت'], art: '🏠', focusAr: 'الْيَاء السَّاكِنَة' },
  { word: 'قَلَم', letters: ['ق', 'ل', 'م'], art: '✏️', focusAr: 'حركات قصيرة' },
  { word: 'شَمْس', letters: ['ش', 'م', 'س'], art: '☀️', focusAr: 'مقطع ساكن' },
  { word: 'قَمَر', letters: ['ق', 'م', 'ر'], art: '🌙', focusAr: 'التمييز ق / ك' },
  { word: 'جَمَل', letters: ['ج', 'م', 'ل'], art: '🐪', focusAr: 'فتح متتالي' },
  { word: 'فِيل', letters: ['ف', 'ي', 'ل'], art: '🐘', focusAr: 'مدّ الياء' },
  { word: 'حُوت', letters: ['ح', 'و', 'ت'], art: '🐋', focusAr: 'مدّ الواو' },
  { word: 'نَمِر', letters: ['ن', 'م', 'ر'], art: '🐯', focusAr: 'فتحة وكسرة' },
  { word: 'أَسَد', letters: ['أ', 'س', 'د'], art: '🦁', focusAr: 'همزة القطع' },
  { word: 'سَمَك', letters: ['س', 'م', 'ك'], art: '🐟', focusAr: 'حرف السين' },
  { word: 'وَرْد', letters: ['و', 'ر', 'د'], art: '🌹', focusAr: 'مقطع ساكن' },
  { word: 'عِنَب', letters: ['ع', 'ن', 'ب'], art: '🍇', focusAr: 'حرف العين' },
  { word: 'مَوْز', letters: ['م', 'و', 'ز'], art: '🍌', focusAr: 'مقطع ساكن' },
  { word: 'تَمْر', letters: ['ت', 'م', 'ر'], art: '🌴', focusAr: 'حرف التاء' },
  { word: 'دِيك', letters: ['د', 'ي', 'ك'], art: '🐓', focusAr: 'مدّ الياء' },
  { word: 'بَحْر', letters: ['ب', 'ح', 'ر'], art: '🌊', focusAr: 'حرف الحاء' },
  { word: 'نَجْم', letters: ['ن', 'ج', 'م'], art: '⭐', focusAr: 'مقطع ساكن' },
  { word: 'كِتَاب', letters: ['ك', 'ت', 'ا', 'ب'], art: '📖', focusAr: 'مدّ الألف' },
  { word: 'طَرِيق', letters: ['ط', 'ر', 'ي', 'ق'], art: '🛣️', focusAr: 'مدّ الياء والطاء' },
];

export const PHONEMIC_BASKET_ROUNDS: PhonemicBasketRound[] = [
  {
    id: 'basket-ba',
    titleAr: 'سَلَّةُ الْبَاءِ (بَ / بُ / بِ)',
    targetLetter: 'ب',
    targetSound: 'بَ',
    promptAr: 'اِسْمَعِ الصَّوْتَ، ثُمَّ ضَعْ فِي السَّلَّةِ كُلَّ صُورَةٍ تَبْدَأُ بِحَرْفِ الْبَاءِ.',
    hits: [
      { art: '🦆', name: 'بَطَّة' },
      { art: '🎈', name: 'بَالُون' },
      { art: '🚪', name: 'بَاب' },
      { art: '🏠', name: 'بَيْت' },
    ],
    misses: [
      { art: '🍌', name: 'مَوْزَة' },
      { art: '🐟', name: 'سَمَكَة' },
      { art: '🌙', name: 'قَمَر' },
    ],
  },
  {
    id: 'basket-sin',
    titleAr: 'سَلَّةُ السِّينِ (سَ / سُ / سِ)',
    targetLetter: 'س',
    targetSound: 'سَ',
    promptAr: 'اِسْمَعِ الصَّوْتَ، ثُمَّ ضَعْ فِي السَّلَّةِ كُلَّ صُورَةٍ تَبْدَأُ بِحَرْفِ السِّينِ.',
    hits: [
      { art: '🐟', name: 'سَمَكَة' },
      { art: '🚗', name: 'سَيَّارَة' },
      { art: '⌚', name: 'سَاعَة' },
      { art: '🐢', name: 'سُلَحْفَاة' },
    ],
    misses: [
      { art: '🦅', name: 'صَقْر' },
      { art: '🐪', name: 'جَمَل' },
      { art: '🍎', name: 'تُفَّاحَة' },
    ],
  },
  {
    id: 'basket-dal',
    titleAr: 'سَلَّةُ الدَّالِ (دَ / دُ / دِ)',
    targetLetter: 'د',
    targetSound: 'دَ',
    promptAr: 'اِسْمَعِ الصَّوْتَ، ثُمَّ ضَعْ فِي السَّلَّةِ كُلَّ صُورَةٍ تَبْدَأُ بِحَرْفِ الدَّالِ.',
    hits: [
      { art: '🐻', name: 'دُبّ' },
      { art: '🐓', name: 'دِيك' },
      { art: '🚲', name: 'دَرَّاجَة' },
      { art: '🐬', name: 'دُلْفِين' },
    ],
    misses: [
      { art: '🐘', name: 'فِيل' },
      { art: '✈️', name: 'طَائِرَة' },
      { art: '🐸', name: 'ضِفْدَع' },
    ],
  },
  {
    id: 'basket-mim',
    titleAr: 'سَلَّةُ الْمِيمِ (مَ / مُ / مِ)',
    targetLetter: 'م',
    targetSound: 'مَ',
    promptAr: 'اِسْمَعِ الصَّوْتَ، ثُمَّ ضَعْ فِي السَّلَّةِ كُلَّ صُورَةٍ تَبْدَأُ بِحَرْفِ الْمِيمِ.',
    hits: [
      { art: '🍌', name: 'مَوْز' },
      { art: '🏫', name: 'مَدْرَسَة' },
      { art: '🔑', name: 'مِفْتَاح' },
      { art: '🌧️', name: 'مَطَر' },
    ],
    misses: [
      { art: '🐯', name: 'نَمِر' },
      { art: '🌹', name: 'وَرْدَة' },
      { art: '📖', name: 'كِتَاب' },
    ],
  },
  {
    id: 'basket-shin',
    titleAr: 'سَلَّةُ الشِّينِ (شَ / شُ / شِ)',
    targetLetter: 'ش',
    targetSound: 'شَ',
    promptAr: 'اِسْمَعِ الصَّوْتَ، ثُمَّ ضَعْ فِي السَّلَّةِ كُلَّ صُورَةٍ تَبْدَأُ بِحَرْفِ الشِّينِ.',
    hits: [
      { art: '☀️', name: 'شَمْس' },
      { art: '🌳', name: 'شَجَرَة' },
      { art: '🕯️', name: 'شَمْعَة' },
      { art: '⛵', name: 'شِرَاع' },
    ],
    misses: [
      { art: '🐟', name: 'سَمَكَة' },
      { art: '✏️', name: 'قَلَم' },
      { art: '🦁', name: 'أَسَد' },
    ],
  },
  {
    id: 'basket-qaf',
    titleAr: 'سَلَّةُ الْقَافِ (قَ / قُ / قِ)',
    targetLetter: 'ق',
    targetSound: 'قَ',
    promptAr: 'اِسْمَعِ الصَّوْتَ، ثُمَّ ضَعْ فِي السَّلَّةِ كُلَّ صُورَةٍ تَبْدَأُ بِحَرْفِ الْقَافِ.',
    hits: [
      { art: '🌙', name: 'قَمَر' },
      { art: '✏️', name: 'قَلَم' },
      { art: '🐱', name: 'قِطَّة' },
      { art: '🚂', name: 'قِطَار' },
    ],
    misses: [
      { art: '📖', name: 'كِتَاب' },
      { art: '🐘', name: 'فِيل' },
      { art: '☀️', name: 'شَمْس' },
    ],
  },
];

export const ARABIC_LANGUAGE_UNITS: ArabicLanguageUnit[] = [
  {
    id: 'fem_verb',
    titleAr: 'تذكير الفعل وتأنيثه: ذَهَبَ أم ذَهَبَتْ؟',
    emoji: '👧',
    gradeLabelAr: 'الصف الأول والثاني',
    goalAr: 'أُذكّر الفعل مع الفاعل المذكر، وأضيف تاء التأنيث الساكنة مع المؤنث.',
    ruleAr: [
      'مع المذكر نكتب الفعل دون زيادة: ذَهَبَ الْوَلَدُ.',
      'مع المؤنث نزيد تاءً ساكنةً في آخر الفعل الماضي: ذَهَبَتِ الْبِنْتُ.',
    ],
    exampleShowAr: 'كَتَبَتْ فَاطِمَةُ الدَّرْسَ',
    exampleNoteAr: 'فاطمة اسم مؤنث، لذلك لحقت بالفعل تاء التأنيث: كَتَبَتْ.',
    items: [
      {
        id: 'fv-1',
        promptAr: 'اختر الفعل الصحيح للجملة:',
        showAr: '... الْوَلَدُ إِلَى الْمَدْرَسَةِ.',
        options: ['ذَهَبَ', 'ذَهَبَتْ'],
        correctAnswer: 'ذَهَبَ',
        explanationAr: 'الولد اسم مذكر، لذلك نختار الفعل: ذَهَبَ.',
      },
      {
        id: 'fv-2',
        promptAr: 'اختر الفعل الصحيح للجملة:',
        showAr: '... الْقِطَّةُ الْحَلِيبَ الدَّافِئَ.',
        options: ['شَرِبَ', 'شَرِبَتْ'],
        correctAnswer: 'شَرِبَتْ',
        explanationAr: 'القطة اسم مؤنث، فنزيد تاء التأنيث الساكنة: شَرِبَتْ.',
      },
      {
        id: 'fv-3',
        promptAr: 'اختر الفعل الصحيح للجملة:',
        showAr: '... خَالِدٌ بِالْكُرَةِ فِي الْحَدِيقَةِ.',
        options: ['لَعِبَ', 'لَعِبَتْ'],
        correctAnswer: 'لَعِبَ',
        explanationAr: 'خالد اسم مذكر، فنقول: لَعِبَ.',
      },
      {
        id: 'fv-4',
        promptAr: 'اختر الفعل الصحيح للجملة:',
        showAr: '... سَارَةُ زَهْرَةً حَمْرَاءَ.',
        options: ['رَسَمَ', 'رَسَمَتْ'],
        correctAnswer: 'رَسَمَتْ',
        explanationAr: 'سارة اسم مؤنث، فنقول: رَسَمَتْ.',
      },
      {
        id: 'fv-5',
        promptAr: 'اختر الفعل الصحيح للجملة:',
        showAr: '... الْحَمَامَةُ فَوْقَ السَّحَابِ.',
        options: ['طَارَ', 'طَارَتْ'],
        correctAnswer: 'طَارَتْ',
        explanationAr: 'الحمامة اسم مؤنث، فنقول: طَارَتْ.',
      },
    ],
  },
  {
    id: 'word_types',
    titleAr: 'أقسام الكلمة: اسم أم فعل أم حرف؟',
    emoji: '🧩',
    gradeLabelAr: 'الصف الثاني',
    goalAr: 'أصنّف الكلمات العربية بثقة بين الاسم والفعل والحرف.',
    ruleAr: [
      'الاسم يدلّ على إنسان أو حيوان أو نبات أو مكان أو شيء: كِتَابٌ، مَدْرَسَةٌ.',
      'الفعل يدلّ على عمل يحدث في زمن: كَتَبَ، يَلْعَبُ، اقْرَأْ.',
      'الحرف يربط الكلمات ولا يظهر معناه كاملًا إلا داخل الجملة: فِي، مِنْ، عَلَى، إِلَى.',
    ],
    exampleShowAr: 'كَتَبَ الطَّالِبُ فِي الدَّفْتَرِ',
    exampleNoteAr: '«كَتَبَ» فعل يدل على حدث، «الطَّالِبُ» اسم إنسان، «فِي» حرف جر.',
    items: [
      {
        id: 'wt-1',
        promptAr: 'ما نوع كلمة «كَتَبَ»؟',
        showAr: 'كَتَبَ',
        options: ['فعل', 'اسم', 'حرف'],
        correctAnswer: 'فعل',
        explanationAr: '«كَتَبَ» تدل على حدث وقع في الزمن الماضي، فهي فعل.',
      },
      {
        id: 'wt-2',
        promptAr: 'ما نوع كلمة «مَدْرَسَة»؟',
        showAr: 'مَدْرَسَة',
        options: ['فعل', 'اسم', 'حرف'],
        correctAnswer: 'اسم',
        explanationAr: '«مَدْرَسَة» تدل على مكان نتعلم فيه، وتقبل «الـ» والتاء المربوطة، فهي اسم.',
      },
      {
        id: 'wt-3',
        promptAr: 'ما نوع كلمة «عَلَى»؟',
        showAr: 'عَلَى',
        options: ['اسم', 'فعل', 'حرف'],
        correctAnswer: 'حرف',
        explanationAr: '«عَلَى» حرف جر لا يكتمل معناه وحده دون الكلمة التالية له.',
      },
      {
        id: 'wt-4',
        promptAr: 'ما نوع كلمة «يَرْسُمُ»؟',
        showAr: 'يَرْسُمُ',
        options: ['اسم', 'فعل', 'حرف'],
        correctAnswer: 'فعل',
        explanationAr: '«يَرْسُمُ» تدل على عمل مستمر الآن، فهي فعل مضارع.',
      },
      {
        id: 'wt-5',
        promptAr: 'ما نوع كلمة «جَمَل»؟',
        showAr: 'جَمَل',
        options: ['فعل', 'حرف', 'اسم'],
        correctAnswer: 'اسم',
        explanationAr: '«جَمَل» اسم حيوان.',
      },
    ],
  },
  {
    id: 'noun_kinds',
    titleAr: 'دلالات الاسم: إنسان أم حيوان أم نبات أم مكان؟',
    emoji: '🏷️',
    gradeLabelAr: 'الصف الأول والثاني',
    goalAr: 'أربط الأسماء العربية بمعانيها ومجالاتها لتوسيع المعجم القرائي.',
    ruleAr: [
      'كل اسم عربي يدلّ على معنى واضح: إنسان (طَبِيب)، حيوان (صَقْر)، نبات (نَخْلَة)، مكان (حَدِيقَة)، أو جماد (قَلَم).',
    ],
    exampleShowAr: 'نَخْلَةٌ ← نَبَاتٌ | سُوقٌ ← مَكَانٌ',
    exampleNoteAr: 'فهم دلالة الكلمة يساعد الطفل على القراءة الفاهمة بدل القراءة الآلية.',
    items: [
      {
        id: 'nk-1',
        promptAr: 'على أي شيء يدلّ اسم «طَبِيب»؟',
        showAr: 'طَبِيب',
        options: ['إنسان', 'مكان', 'جماد'],
        correctAnswer: 'إنسان',
        explanationAr: 'الطبيب شخص يعالج المرضى، فهو يدلّ على إنسان.',
      },
      {
        id: 'nk-2',
        promptAr: 'على أي شيء يدلّ اسم «نَخْلَة»؟',
        showAr: 'نَخْلَة',
        options: ['حيوان', 'نبات', 'جماد'],
        correctAnswer: 'نبات',
        explanationAr: 'النخلة شجرة مثمرة تنمو وتحتاج إلى الماء، فهي نبات.',
      },
      {
        id: 'nk-3',
        promptAr: 'على أي شيء يدلّ اسم «مَكْتَبَة»؟',
        showAr: 'مَكْتَبَة',
        options: ['حيوان', 'إنسان', 'مكان'],
        correctAnswer: 'مكان',
        explanationAr: 'المكتبة مكان نجد فيه الكتب والقصص.',
      },
      {
        id: 'nk-4',
        promptAr: 'على أي شيء يدلّ اسم «قَلَم»؟',
        showAr: 'قَلَم',
        options: ['نبات', 'جماد', 'حيوان'],
        correctAnswer: 'جماد',
        explanationAr: 'القلم أداة لا تنمو ولا تتغذى، فهو جماد.',
      },
      {
        id: 'nk-5',
        promptAr: 'على أي شيء يدلّ اسم «عُصْفُور»؟',
        showAr: 'عُصْفُور',
        options: ['مكان', 'نبات', 'حيوان'],
        correctAnswer: 'حيوان',
        explanationAr: 'العصفور طائر يطير ويتغذى، وهو من عالم الحيوان.',
      },
    ],
  },
  {
    id: 'ta_ha',
    titleAr: 'التفريق الدقيق بين التاء المربوطة (ة) والهاء (ه)',
    emoji: '📝',
    gradeLabelAr: 'الصف الثاني والثالث',
    goalAr: 'أميّز التاء المربوطة بنقطتيها عن الهاء الأصلية وهاء الضمير.',
    ruleAr: [
      'التاء المربوطة (ـة / ة) نسمعها هاءً عند الوقف، لكنها تتحول إلى تاء صريحة عند الوصل أو التنوين: مَدْرَسَةٌ جَمِيلَةٌ.',
      'الهاء (ـه / ه) تبقى هاءً دائمًا في الوقف وفي الوصل: وَجْهٌ، كِتَابُهُ.',
    ],
    exampleShowAr: 'قِصَّةٌ مُفِيدَةٌ (تاء)  |  كِتَابُهُ جَدِيدٌ (هاء)',
    exampleNoteAr: 'حرّك آخر الكلمة بالتنوين: في «قِصَّةٌ» نسمع صوت التاء، أما «وَجْهٌ» فتبقى هاءً في الوصل والوقف.',
    items: [
      {
        id: 'th-1',
        promptAr: 'ما الحرف الصحيح في نهاية كلمة «وَجْـ...»؟',
        showAr: 'وَجْـ... مُشْرِقٌ',
        options: ['ه (هاء دون نقطتين)', 'ة (تاء مربوطة)'],
        correctAnswer: 'ه (هاء دون نقطتين)',
        explanationAr: 'نسمع صوت الهاء في «وَجْهٌ» عند الوصل والوقف، إذن نكتبها هاءً دون نقطتين: وَجْه.',
      },
      {
        id: 'th-2',
        promptAr: 'ما الحرف الصحيح في نهاية كلمة «فَاكِهَـ...»؟',
        showAr: 'فَاكِهَـ... طَازَجَةٌ',
        options: ['ه (هاء دون نقطتين)', 'ة (تاء مربوطة)'],
        correctAnswer: 'ة (تاء مربوطة)',
        explanationAr: 'عند الوصل أو التنوين في «فَاكِهَةٌ» نسمع صوت التاء، فنضع النقطتين: فَاكِهَة.',
      },
      {
        id: 'th-3',
        promptAr: 'ما الحرف الصحيح في نهاية كلمة «قَلَمَـ...» (أي قلم الولد)؟',
        showAr: 'نَسِيَ طَارِقٌ قَلَمَـ... عَلَى الطَّاوِلَةِ.',
        options: ['ه (هاء دون نقطتين)', 'ة (تاء مربوطة)'],
        correctAnswer: 'ه (هاء دون نقطتين)',
        explanationAr: 'الهاء هنا هاء الغائب الضميرية (قَلَمَهُ)، وتبقى هاءً دائمًا دون نقطتين.',
      },
      {
        id: 'th-4',
        promptAr: 'ما الحرف الصحيح في نهاية كلمة «حَدِيقَـ...»؟',
        showAr: 'حَدِيقَـ... وَاسِعَةٌ',
        options: ['ه (هاء دون نقطتين)', 'ة (تاء مربوطة)'],
        correctAnswer: 'ة (تاء مربوطة)',
        explanationAr: 'عند التنوين في «حَدِيقَةٌ» يظهر صوت التاء واضحًا فتُكتب بنقطتين: حَدِيقَة.',
      },
      {
        id: 'th-5',
        promptAr: 'ما الحرف الصحيح في نهاية الفعل «انْتَبِـ...»؟',
        showAr: 'انْتَبِـ... يَا صَدِيقِي!',
        options: ['ة (تاء مربوطة)', 'ه (هاء دون نقطتين)'],
        correctAnswer: 'ه (هاء دون نقطتين)',
        explanationAr: '«انتبِه» فعل أمر ينتهي بهاء أصلية، والأفعال لا تقبل التاء المربوطة أبدًا.',
      },
    ],
  },
];

export function getFoundationLetter(letterOrId: string | number): FoundationLetter | undefined {
  if (typeof letterOrId === 'number') {
    return ARABIC_FOUNDATION_LETTERS.find((l) => l.id === letterOrId);
  }
  const clean = letterOrId === 'أ' ? 'ا' : letterOrId;
  return ARABIC_FOUNDATION_LETTERS.find((l) => l.letter === clean);
}

export function getArabicLanguageUnit(id: ArabicLanguageUnit['id']): ArabicLanguageUnit | undefined {
  return ARABIC_LANGUAGE_UNITS.find((u) => u.id === id);
}
