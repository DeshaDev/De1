/**
 * Arabic Phoneme Bank & Classical Fusha IPA Phonetic Map (بنك الأصوات الفونيمية العربية الفصحى)
 *
 * Implements standard phonological awareness phoneme mapping for Arabic foundational reading:
 * - 28 letters with short vowels (Fat'ha /a/, Dammah /u/, Kasrah /i/)
 * - Sukoon and Tanween
 * - Long vowels / Madd (/aː/, /uː/, /iː/)
 * - Common CVC foundational syllables (قِطْ، بَطْ، مِرْ، شَمْس...)
 *
 * Eliminates dialectal vowel lowering (e.g. 'تُ' being mispronounced as 'toh' instead of 'Tu').
 */

export const ARABIC_PHONEME_IPA_MAP: Record<string, string> = {
  // Short vowels with letters (الحركات القصيرة مع الحروف - 28 × 3)
  // Hamzah / Alif
  'أَ': 'ʔa',
  'أُ': 'ʔu',
  'إِ': 'ʔi',
  'أْ': 'ʔ',

  // Baa
  'بَ': 'ba',
  'بُ': 'bu',
  'بِ': 'bi',
  'بْ': 'b',

  // Taa
  'تَ': 'ta',
  'تُ': 'tu', // Pure Fusha Tu (not toh!)
  'تِ': 'ti',
  'تْ': 't',

  // Thaa
  'ثَ': 'θa',
  'ثُ': 'θu',
  'ثِ': 'θi',
  'ثْ': 'θ',

  // Jeem
  'جَ': 'd͡ʒa',
  'جُ': 'd͡ʒu',
  'جِ': 'd͡ʒi',
  'جْ': 'd͡ʒ',

  // Haa
  'حَ': 'ħa',
  'حُ': 'ħu',
  'حِ': 'ħi',
  'حْ': 'ħ',

  // Khaa
  'خَ': 'xa',
  'خُ': 'xu',
  'خِ': 'xi',
  'خْ': 'x',

  // Dal
  'دَ': 'da',
  'دُ': 'du',
  'دِ': 'di',
  'دْ': 'd',

  // Dhal
  'ذَ': 'ða',
  'ذُ': 'ðu',
  'ذِ': 'ði',
  'ذْ': 'ð',

  // Raa
  'رَ': 'ra',
  'رُ': 'ru',
  'رِ': 'ri',
  'رْ': 'r',

  // Zay
  'زَ': 'za',
  'زُ': 'zu',
  'زِ': 'zi',
  'زْ': 'z',

  // Seen
  'سَ': 'sa',
  'سُ': 'su',
  'سِ': 'si',
  'سْ': 's',

  // Sheen
  'شَ': 'ʃa',
  'شُ': 'ʃu',
  'شِ': 'ʃi',
  'شْ': 'ʃ',

  // Saad
  'صَ': 'sˤa',
  'صُ': 'sˤu',
  'صِ': 'sˤi',
  'صْ': 'sˤ',

  // Daad
  'ضَ': 'dˤa',
  'ضُ': 'dˤu',
  'ضِ': 'dˤi',
  'ضْ': 'dˤ',

  // Taa (Emphatic)
  'طَ': 'tˤa',
  'طُ': 'tˤu',
  'طِ': 'tˤi',
  'طْ': 'tˤ',

  // Zaa (Emphatic)
  'ظَ': 'ðˤa',
  'ظُ': 'ðˤu',
  'ظِ': 'ðˤi',
  'ظْ': 'ðˤ',

  // Ayn
  'عَ': 'ʕa',
  'عُ': 'ʕu',
  'عِ': 'ʕi',
  'عْ': 'ʕ',

  // Ghayn
  'غَ': 'ɣa',
  'غُ': 'ɣu',
  'غِ': 'ɣi',
  'غْ': 'ɣ',

  // Faa
  'فَ': 'fa',
  'فُ': 'fu',
  'فِ': 'fi',
  'فْ': 'f',

  // Qaaf
  'قَ': 'qa',
  'قُ': 'qu',
  'قِ': 'qi',
  'قْ': 'q',

  // Kaaf
  'كَ': 'ka',
  'كُ': 'ku',
  'كِ': 'ki',
  'كْ': 'k',

  // Laam
  'لَ': 'la',
  'لُ': 'lu',
  'لِ': 'li',
  'لْ': 'l',

  // Meem
  'مَ': 'ma',
  'مُ': 'mu',
  'مِ': 'mi',
  'مْ': 'm',

  // Noon
  'نَ': 'na',
  'نُ': 'nu',
  'نِ': 'ni',
  'نْ': 'n',

  // Haa
  'هَ': 'ha',
  'هُ': 'hu',
  'هِ': 'hi',
  'هْ': 'h',

  // Waw
  'وَ': 'wa',
  'وُ': 'wu',
  'وِ': 'wi',
  'وْ': 'w',

  // Yaa
  'يَ': 'ja',
  'يُ': 'ju',
  'يِ': 'ji',
  'يْ': 'j',

  // Long Vowels / Madd (المدود)
  'آ': 'ʔaː',
  'أُو': 'ʔuː',
  'إِي': 'ʔiː',
  'بَا': 'baː',
  'بُو': 'buː',
  'بِي': 'biː',
  'تَا': 'taː',
  'تُو': 'tuː',
  'تِي': 'tiː',
  'ثَا': 'θaː',
  'ثُو': 'θuː',
  'ثِي': 'θiː',
  'جَا': 'd͡ʒaː',
  'جُو': 'd͡ʒuː',
  'جِي': 'd͡ʒiː',
  'حَا': 'ħaː',
  'حُو': 'ħuː',
  'حِي': 'ħiː',
  'خَا': 'xaː',
  'خُو': 'xuː',
  'خِي': 'xiː',
  'دَا': 'daː',
  'دُو': 'duː',
  'دِي': 'diː',
  'ذَا': 'ðaː',
  'ذُو': 'ðuː',
  'ذِي': 'ðiː',
  'رَا': 'raː',
  'رُو': 'ruː',
  'رِي': 'riː',
  'زَا': 'zaː',
  'زُو': 'zuː',
  'زِي': 'ziː',
  'سَا': 'saː',
  'سُو': 'suː',
  'سِي': 'siː',
  'شَا': 'ʃaː',
  'شُو': 'ʃuː',
  'شِي': 'ʃiː',
  'صَا': 'sˤaː',
  'صُو': 'sˤuː',
  'صِي': 'sˤiː',
  'ضَا': 'dˤaː',
  'ضُو': 'dˤuː',
  'ضِي': 'dˤiː',
  'طَا': 'tˤaː',
  'طُو': 'tˤuː',
  'طِي': 'tˤiː',
  'ظَا': 'ðˤaː',
  'ظُو': 'ðˤuː',
  'ظِي': 'ðˤiː',
  'عَا': 'ʕaː',
  'عُو': 'ʕuː',
  'عِي': 'ʕiː',
  'غَا': 'ɣaː',
  'غُو': 'ɣuː',
  'غِي': 'ɣiː',
  'فَا': 'faː',
  'فُو': 'fuː',
  'فِي': 'fiː',
  'قَا': 'qaː',
  'قُو': 'quː',
  'قِي': 'qiː',
  'كَا': 'kaː',
  'كُو': 'kuː',
  'كِي': 'kiː',
  'لَا': 'laː',
  'لُو': 'luː',
  'لِي': 'liː',
  'مَا': 'maː',
  'مُو': 'muː',
  'مِي': 'miː',
  'نَا': 'naː',
  'نُو': 'nuː',
  'نِي': 'niː',
  'هَا': 'haː',
  'هُو': 'huː',
  'هِي': 'hiː',
  'وَا': 'waː',
  'وُو': 'wuː',
  'وِي': 'wiː',
  'يَا': 'jaː',
  'يُو': 'juː',
  'يِي': 'jiː',

  // Critical Short Syllables in Testing (المقاطع الأساسية في الفحص)
  'قِطْ': 'qitˤ',
  'بَطْ': 'batˤ',
  'شَمْس': 'ʃams',
  'رِبْ': 'rib',
  'مِرْ': 'mir',
  'طَرْ': 'tˤar',
  'مِفْ': 'mif',
  'ثَعْ': 'θaʕ',
  'نَحْ': 'naħ',
  'لَحْ': 'laħ',
  'مَرْ': 'mar',
  'دَعْ': 'daʕ',
  'رَسْ': 'ras',
  'سَيْ': 'saj',
  'ضِفْ': 'dˤif',
  'شُبْ': 'ʃub',
  'فُسْ': 'fus',
  'كُرْ': 'kur',
  'طَة': 'tˤah',
  'لَة': 'lah',
  'رَة': 'rah',
  'جَة': 'd͡ʒah',
  'كَة': 'kah',
  'عَة': 'ʕah',
  'حَة': 'ħah',
  'مَة': 'mah',
  'ضَة': 'dˤah',
  'ئِ': 'ʔi',
};

/**
 * Expands a single-letter short-voweled syllable to its natural elongated Arabic spelling
 * so neural Arabic voices articulate the exact vowel sound (/tu/, /ba/, /ji/)
 * with 100% authentic human pronunciation, without pronouncing the letter name ("باء", "جيم")
 * and without switching to the mechanical/robotic IPA vocoder.
 */
export function expandArabicPhonemeSound(token: string): string {
  const t = token.trim();
  if (t === 'أَ') return 'آ';
  if (t === 'ئِ' || t === 'إِ') return 'إِي';
  if (t === 'أُ' || t === 'ؤُ') return 'أُو';
  const m = t.match(/^([\u0621-\u064A])([\u064E\u064F\u0650])$/);
  if (!m) return t;
  const [, letter, vowel] = m;
  if (vowel === '\u064E') return `${letter}\u064Eا`;
  if (vowel === '\u064F') return `${letter}\u064Fو`;
  if (vowel === '\u0650') return `${letter}\u0650ي`;
  return t;
}

/**
 * Returns the exact Fusha IPA phoneme if the input matches a standalone phoneme/syllable.
 */
export function getArabicPhonemeIpa(token: string): string | null {
  const clean = token.trim();
  return ARABIC_PHONEME_IPA_MAP[clean] || null;
}

/**
 * Formats an Arabic text string into natural human Fusha text for TTS synthesis.
 * Uses natural Arabic orthographic elongation for letter-sound prompts (e.g. 'أَيُّ حَرْفٍ صَوْتُهُ: تُ ... تُ؟' -> 'أَيُّ حَرْفٍ صَوْتُهُ تُو، تُو؟')
 * instead of robotic <phoneme alphabet="ipa"> tags which degrade speech into synthetic robot sounds.
 */
export function formatArabicTextWithPhonemes(rawText: string): string {
  const clean = rawText.trim();
  if (!clean) return '';

  // Check if entire text is a single 1-letter CV syllable (e.g. 'تُ', 'سَ', 'جِ')
  if (/^([\u0621-\u064A])([\u064E\u064F\u0650])$/.test(clean)) {
    return expandArabicPhonemeSound(clean);
  }

  // Handle letter-sound prompt patterns like: 'أَيُّ حَرْفٍ صَوْتُهُ: تُ ... تُ؟'
  const promptMatch = clean.match(/^(.*?صَوْتُهُ\s*:?\s*)([^\s.]+)(\s*\.\.\.\s*|\s*،\s*)([^\s؟?]+)(\s*[؟?]?.*)$/);
  if (promptMatch) {
    const [, prefix, sound1, , sound2, suffix] = promptMatch;
    const formattedSound1 = expandArabicPhonemeSound(sound1);
    const formattedSound2 = expandArabicPhonemeSound(sound2);
    const cleanPrefix = prefix.replace(/:\s*$/, ' ');
    return `${cleanPrefix}${formattedSound1}، ${formattedSound2}${suffix || '؟'}`;
  }

  return clean;
}
