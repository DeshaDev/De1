/**
 * Supplemental structured-literacy practice stations for Arabic readers aged 4–8.
 *
 * These are instructional practice activities, not a diagnostic instrument and not a
 * substitute for a validated, individualized intervention. Reading/spelling stations are
 * offered only from age six; morphology from age seven. Younger children receive listening-
 * comprehension activities without being asked to decode print.
 *
 * Fluency practice uses modeled and repeated reading with phrasing and punctuation. It does
 * not time, score, record, or automatically judge a child's voice.
 */

export type LiteracyStationId = 'decoding' | 'spelling' | 'morphology' | 'comprehension' | 'fluency';

export interface LiteracyOption {
  id: string;
  labelAr: string;
  emoji?: string;
}

export interface LiteracyQuestion {
  id: string;
  promptAr: string;
  /** Model narration or spoken prompt. Fully vowelled Arabic is preferred. */
  audio: string[];
  options: LiteracyOption[];
  correctId: string;
  explanationAr: string;
  explanationAudio: string[];
}

export interface LiteracyStation {
  id: LiteracyStationId;
  titleAr: string;
  subtitleAr: string;
  purposeAr: string;
  ageNoteAr: string;
  questions: LiteracyQuestion[];
}

export interface FluencyPassage {
  titleAr: string;
  /** Phrase-cued lines; preserve punctuation and read for accuracy, phrasing and meaning. */
  linesAr: string[];
  modelAudio: string[];
  reflectionAr: string;
}

const decoding: LiteracyQuestion[] = [
  {
    id: 'decode-door',
    promptAr: 'اِقْرَأِ الْكَلِمَةَ الظَّاهِرَةَ، ثُمَّ اخْتَرِ الصُّورَةَ الَّتِي تُمَثِّلُهَا: بَاب',
    audio: ['اِقْرَأِ الْكَلِمَةَ الظَّاهِرَةَ، ثُمَّ اخْتَرِ الصُّورَةَ الْمُنَاسِبَةَ.'],
    options: [
      { id: 'door', labelAr: 'باب', emoji: '🚪' },
      { id: 'book', labelAr: 'كتاب', emoji: '📘' },
      { id: 'sun', labelAr: 'شمس', emoji: '☀️' },
    ],
    correctId: 'door',
    explanationAr: 'بَاب: نَقْرَأُ الْبَاءَ، ثُمَّ صَوْتَ الْمَدِّ، ثُمَّ الْبَاءَ فِي آخِرِ الْكَلِمَةِ.',
    explanationAudio: ['بَابٌ: نَقْرَأُ الْبَاءَ، ثُمَّ صَوْتَ الْمَدِّ، ثُمَّ الْبَاءَ فِي آخِرِ الْكَلِمَةِ.'],
  },
  {
    id: 'decode-elephant',
    promptAr: 'اِقْرَأِ الْكَلِمَةَ، وَاخْتَرْ مَعْنَاهَا: فِيل',
    audio: ['اِقْرَأِ الْكَلِمَةَ، وَاخْتَرِ الصُّورَةَ الَّتِي تُطَابِقُهَا.'],
    options: [
      { id: 'elephant', labelAr: 'فيل', emoji: '🐘' },
      { id: 'horse', labelAr: 'حصان', emoji: '🐴' },
      { id: 'fish', labelAr: 'سمكة', emoji: '🐟' },
    ],
    correctId: 'elephant',
    explanationAr: 'فِيل: نَنْتَبِهُ إِلَى الْكَسْرَةِ فِي أَوَّلِ الْكَلِمَةِ، وَإِلَى الْمَدِّ بِالْيَاءِ.',
    explanationAudio: ['فِيلٌ: نَنْتَبِهُ إِلَى الْكَسْرَةِ فِي أَوَّلِ الْكَلِمَةِ، وَإِلَى الْمَدِّ بِالْيَاءِ.'],
  },
  {
    id: 'decode-pen',
    promptAr: 'اِقْرَأِ الْكَلِمَةَ، وَاخْتَرْ مَعْنَاهَا: قَلَم',
    audio: ['اِقْرَأِ الْكَلِمَةَ، ثُمَّ اخْتَرِ الصُّورَةَ الْمُنَاسِبَةَ.'],
    options: [
      { id: 'pen', labelAr: 'قلم', emoji: '✏️' },
      { id: 'key', labelAr: 'مفتاح', emoji: '🔑' },
      { id: 'moon', labelAr: 'قمر', emoji: '🌙' },
    ],
    correctId: 'pen',
    explanationAr: 'قَلَم: نَقْرَأُ الْحَرَكَاتِ الْقَصِيرَةَ مَعَ الْحُرُوفِ، وَلَا نُضِيفُ حَرْفَ مَدٍّ غَيْرَ مَكْتُوبٍ.',
    explanationAudio: ['قَلَمٌ: نَقْرَأُ الْحَرَكَاتِ الْقَصِيرَةَ مَعَ الْحُرُوفِ، وَلَا نُضِيفُ حَرْفَ مَدٍّ غَيْرَ مَكْتُوبٍ.'],
  },
  {
    id: 'decode-school',
    promptAr: 'اِقْرَأِ الْكَلِمَةَ، وَاخْتَرْ مَعْنَاهَا: مَدْرَسَة',
    audio: ['اِقْرَأِ الْكَلِمَةَ، وَاخْتَرِ الصُّورَةَ الَّتِي تُمَثِّلُهَا.'],
    options: [
      { id: 'school', labelAr: 'مدرسة', emoji: '🏫' },
      { id: 'garden', labelAr: 'حديقة', emoji: '🌳' },
      { id: 'house', labelAr: 'بيت', emoji: '🏠' },
    ],
    correctId: 'school',
    explanationAr: 'مَدْرَسَة: نَقْرَأُ الْمَقَاطِعَ بِالتَّرْتِيبِ، وَنَنْتَبِهُ إِلَى السُّكُونِ وَالتَّاءِ الْمَرْبُوطَةِ.',
    explanationAudio: ['مَدْرَسَةٌ: نَقْرَأُ الْمَقَاطِعَ بِالتَّرْتِيبِ، وَنَنْتَبِهُ إِلَى السُّكُونِ وَالتَّاءِ الْمَرْبُوطَةِ.'],
  },
];

const spelling: LiteracyQuestion[] = [
  {
    id: 'spell-door',
    promptAr: 'اِسْمَعِ الْكَلِمَةَ، ثُمَّ اخْتَرِ الْكِتَابَةَ الصَّحِيحَةَ.',
    audio: ['اِسْمَعِ الْكَلِمَةَ:', 'بَابٌ', 'أَيُّ كِتَابَةٍ صَحِيحَةٌ؟'],
    options: [
      { id: 'باب', labelAr: 'باب' },
      { id: 'بب', labelAr: 'بب' },
      { id: 'بوب', labelAr: 'بوب' },
    ],
    correctId: 'باب',
    explanationAr: 'نَكْتُبُ حَرْفَ الْمَدِّ «ا» بَيْنَ الْبَاءَيْنِ: بَاب.',
    explanationAudio: ['نَكْتُبُ حَرْفَ الْمَدِّ أَلِفًا بَيْنَ الْبَاءَيْنِ: بَاب.'],
  },
  {
    id: 'spell-pen',
    promptAr: 'اِسْمَعِ الْكَلِمَةَ، وَاخْتَرْ رَسْمَهَا الصَّحِيحَ.',
    audio: ['اِسْمَعِ الْكَلِمَةَ:', 'قَلَمٌ', 'اخْتَرِ الْكِتَابَةَ الصَّحِيحَةَ.'],
    options: [
      { id: 'قلم', labelAr: 'قلم' },
      { id: 'قالم', labelAr: 'قالم' },
      { id: 'قلمم', labelAr: 'قلمم' },
    ],
    correctId: 'قلم',
    explanationAr: 'فِي «قَلَم» نَسْمَعُ الْحَرَكَاتِ الْقَصِيرَةَ، وَلَا نَكْتُبُ لَهَا حُرُوفَ مَدٍّ.',
    explanationAudio: ['فِي قَلَمٍ نَسْمَعُ الْحَرَكَاتِ الْقَصِيرَةَ، وَلَا نَكْتُبُ لَهَا حُرُوفَ مَدٍّ.'],
  },
  {
    id: 'spell-tree',
    promptAr: 'اِسْمَعِ الْكَلِمَةَ، ثُمَّ اخْتَرْ نِهَايَتَهَا الصَّحِيحَةَ.',
    audio: ['اِسْمَعِ الْكَلِمَةَ:', 'شَجَرَةٌ', 'أَيُّ كِتَابَةٍ صَحِيحَةٌ؟'],
    options: [
      { id: 'شجرة', labelAr: 'شجرة' },
      { id: 'شجره', labelAr: 'شجره' },
      { id: 'شجرت', labelAr: 'شجرت' },
    ],
    correctId: 'شجرة',
    explanationAr: 'تُنْتَهِي كَلِمَةُ «شَجَرَة» بِتَاءٍ مَرْبُوطَةٍ «ة»، وَلَيْسَتْ هَاءً.',
    explanationAudio: ['تَنْتَهِي كَلِمَةُ شَجَرَةٍ بِتَاءٍ مَرْبُوطَةٍ: ة، وَلَيْسَتْ هَاءً.'],
  },
  {
    id: 'spell-hospital',
    promptAr: 'اِسْمَعِ الْكَلِمَةَ، وَانْتَبِهْ إِلَى آخِرِهَا.',
    audio: ['اِسْمَعِ الْكَلِمَةَ:', 'مُسْتَشْفَى', 'اخْتَرْ كِتَابَتَهَا الصَّحِيحَةَ.'],
    options: [
      { id: 'مستشفى', labelAr: 'مستشفى' },
      { id: 'مستشفي', labelAr: 'مستشفي' },
      { id: 'مستشفا', labelAr: 'مستشفا' },
    ],
    correctId: 'مستشفى',
    explanationAr: 'تُكْتَبُ الْأَلِفُ الْمَقْصُورَةُ «ى» فِي آخِرِ كَلِمَةِ «مُسْتَشْفَى».',
    explanationAudio: ['تُكْتَبُ الْأَلِفُ الْمَقْصُورَةُ ى فِي آخِرِ كَلِمَةِ مُسْتَشْفَى.'],
  },
];

const morphology: LiteracyQuestion[] = [
  {
    id: 'morphology-write',
    promptAr: 'هَذِهِ كَلِمَةٌ: كَتَبَ. أَيُّ كَلِمَةٍ تَنْتَمِي إِلَى عَائِلَتِهَا؟',
    audio: ['هَذِهِ كَلِمَةٌ: كَتَبَ.', 'اخْتَرْ كَلِمَةً مِنَ الْعَائِلَةِ نَفْسِهَا.'],
    options: [
      { id: 'كتاب', labelAr: 'كِتَاب' },
      { id: 'شمس', labelAr: 'شَمْس' },
      { id: 'مدرسة', labelAr: 'مَدْرَسَة' },
    ],
    correctId: 'كتاب',
    explanationAr: 'كَتَبَ وَكِتَابٌ مِنْ عَائِلَةٍ وَاحِدَةٍ؛ تَشْتَرِكَانِ فِي الْحُرُوفِ الْأَصْلِيَّةِ ك، ت، ب وَفِي مَعْنَى الْكِتَابَةِ.',
    explanationAudio: ['كَتَبَ وَكِتَابٌ مِنْ عَائِلَةٍ وَاحِدَةٍ؛ تَشْتَرِكَانِ فِي الْحُرُوفِ الْأَصْلِيَّةِ كَاف، تَاء، بَاء، وَفِي مَعْنَى الْكِتَابَةِ.'],
  },
  {
    id: 'morphology-play',
    promptAr: 'هَذِهِ كَلِمَةٌ: لَعِبَ. أَيُّ كَلِمَةٍ مِنْ عَائِلَتِهَا؟',
    audio: ['لَعِبَ.', 'اخْتَرْ كَلِمَةً تَرْتَبِطُ بِهَا فِي الْحُرُوفِ وَالْمَعْنَى.'],
    options: [
      { id: 'لعبة', labelAr: 'لُعْبَة' },
      { id: 'قلم', labelAr: 'قَلَم' },
      { id: 'بيت', labelAr: 'بَيْت' },
    ],
    correctId: 'لعبة',
    explanationAr: 'لَعِبَ وَلُعْبَةٌ تَرْتَبِطَانِ بِالْجِذْرِ نَفْسِهِ، وَتَدُلَّانِ عَلَى مَعْنًى مُتَّصِلٍ بِاللَّعِبِ.',
    explanationAudio: ['لَعِبَ وَلُعْبَةٌ تَرْتَبِطَانِ بِالْجِذْرِ نَفْسِهِ، وَتَدُلَّانِ عَلَى مَعْنًى مُتَّصِلٍ بِاللَّعِبِ.'],
  },
  {
    id: 'morphology-farm',
    promptAr: 'هَذِهِ كَلِمَةٌ: زَرَعَ. أَيُّ كَلِمَةٍ تَشْتَرِكُ مَعَهَا فِي الْعَائِلَةِ؟',
    audio: ['زَرَعَ.', 'اِخْتَرْ كَلِمَةً مِنْ عَائِلَتِهَا.'],
    options: [
      { id: 'زارع', labelAr: 'زَارِع' },
      { id: 'قارىء', labelAr: 'قَارِئ' },
      { id: 'كاتب', labelAr: 'كَاتِب' },
    ],
    correctId: 'زارع',
    explanationAr: 'زَرَعَ وَزَارِعٌ تَشْتَرِكَانِ فِي الْجِذْرِ ز، ر، ع، وَتَرْتَبِطَانِ بِالزِّرَاعَةِ.',
    explanationAudio: ['زَرَعَ وَزَارِعٌ تَشْتَرِكَانِ فِي الْجِذْرِ زَاي، رَاء، عَيْن، وَتَرْتَبِطَانِ بِالزِّرَاعَةِ.'],
  },
  {
    id: 'morphology-teach',
    promptAr: 'هَذِهِ كَلِمَةٌ: دَرَسَ. أَيُّ كَلِمَةٍ مِنْ عَائِلَتِهَا؟',
    audio: ['دَرَسَ.', 'اِخْتَرْ كَلِمَةً تَشْتَرِكُ مَعَهَا فِي الْجِذْرِ وَالْمَعْنَى.'],
    options: [
      { id: 'مدرسة', labelAr: 'مَدْرَسَة' },
      { id: 'مزرعة', labelAr: 'مَزْرَعَة' },
      { id: 'مكتبة', labelAr: 'مَكْتَبَة' },
    ],
    correctId: 'مدرسة',
    explanationAr: 'دَرَسَ وَمَدْرَسَةٌ مِنْ عَائِلَةِ الْجِذْرِ د، ر، س.',
    explanationAudio: ['دَرَسَ وَمَدْرَسَةٌ مِنْ عَائِلَةِ الْجِذْرِ دَال، رَاء، سِين.'],
  },
];

const listeningComprehension: LiteracyQuestion[] = [
  {
    id: 'listen-flower',
    promptAr: 'لَيْلَى تَسْقِي زَهْرَةً. مَاذَا سَقَتْ لَيْلَى؟',
    audio: ['لَيْلَى تَسْقِي زَهْرَةً.', 'مَاذَا سَقَتْ لَيْلَى؟'],
    options: [
      { id: 'flower', labelAr: 'زهرة', emoji: '🌷' },
      { id: 'ball', labelAr: 'كرة', emoji: '⚽' },
      { id: 'book', labelAr: 'كتاب', emoji: '📗' },
    ],
    correctId: 'flower',
    explanationAr: 'سَقَتْ لَيْلَى الزَّهْرَةَ؛ هَذَا مَذْكُورٌ بِوُضُوحٍ فِي الْجُمْلَةِ.',
    explanationAudio: ['سَقَتْ لَيْلَى الزَّهْرَةَ؛ هَذَا مَذْكُورٌ بِوُضُوحٍ فِي الْجُمْلَةِ.'],
  },
  {
    id: 'listen-bag',
    promptAr: 'وَضَعَ عُمَرُ كِتَابَهُ فِي الْحَقِيبَةِ. أَيْنَ وَضَعَ عُمَرُ الْكِتَابَ؟',
    audio: ['وَضَعَ عُمَرُ كِتَابَهُ فِي الْحَقِيبَةِ.', 'أَيْنَ وَضَعَ عُمَرُ الْكِتَابَ؟'],
    options: [
      { id: 'bag', labelAr: 'حقيبة', emoji: '🎒' },
      { id: 'chair', labelAr: 'كرسي', emoji: '🪑' },
      { id: 'window', labelAr: 'نافذة', emoji: '🪟' },
    ],
    correctId: 'bag',
    explanationAr: 'وَضَعَ عُمَرُ الْكِتَابَ فِي الْحَقِيبَةِ، كَمَا قَالَتِ الْجُمْلَةُ.',
    explanationAudio: ['وَضَعَ عُمَرُ الْكِتَابَ فِي الْحَقِيبَةِ، كَمَا قَالَتِ الْجُمْلَةُ.'],
  },
];

const readingComprehension: LiteracyQuestion[] = [
  {
    id: 'read-samira',
    promptAr: 'رَتَّبَتْ مَرْيَمُ كُتُبَهَا قَبْلَ النَّوْمِ؛ لِأَنَّهَا سَتَقْرَأُ قِصَّةً فِي الصَّبَاحِ. لِمَاذَا رَتَّبَتْ مَرْيَمُ كُتُبَهَا؟',
    audio: ['اِقْرَأِ النَّصَّ، ثُمَّ أَجِبْ عَنِ السُّؤَالِ.', 'رَتَّبَتْ مَرْيَمُ كُتُبَهَا قَبْلَ النَّوْمِ؛ لِأَنَّهَا سَتَقْرَأُ قِصَّةً فِي الصَّبَاحِ.', 'لِمَاذَا رَتَّبَتْ مَرْيَمُ كُتُبَهَا؟'],
    options: [
      { id: 'morning-story', labelAr: 'لتقرأ قصة في الصباح' },
      { id: 'clean-room', labelAr: 'لتنظف غرفتها' },
      { id: 'give-away', labelAr: 'لتعطيها لصديقتها' },
    ],
    correctId: 'morning-story',
    explanationAr: 'ذَكَرَ النَّصُّ السَّبَبَ بِوُضُوحٍ: رَتَّبَتْ كُتُبَهَا لِتَقْرَأَ قِصَّةً فِي الصَّبَاحِ.',
    explanationAudio: ['ذَكَرَ النَّصُّ السَّبَبَ بِوُضُوحٍ: رَتَّبَتْ كُتُبَهَا لِتَقْرَأَ قِصَّةً فِي الصَّبَاحِ.'],
  },
  {
    id: 'read-rain',
    promptAr: 'هَطَلَ الْمَطَرُ، فَحَمَلَ سَامِي مِظَلَّتَهُ قَبْلَ أَنْ يَخْرُجَ. لِمَاذَا حَمَلَ سَامِي مِظَلَّتَهُ؟',
    audio: ['اِقْرَأِ النَّصَّ، وَفَكِّرْ فِي السَّبَبِ.', 'هَطَلَ الْمَطَرُ، فَحَمَلَ سَامِي مِظَلَّتَهُ قَبْلَ أَنْ يَخْرُجَ.', 'لِمَاذَا حَمَلَ سَامِي مِظَلَّتَهُ؟'],
    options: [
      { id: 'rain', labelAr: 'لأن المطر هطل' },
      { id: 'sun', labelAr: 'لأن الجو حار' },
      { id: 'play', labelAr: 'ليذهب إلى الملعب' },
    ],
    correctId: 'rain',
    explanationAr: 'حَمَلَ سَامِي الْمِظَلَّةَ بَعْدَ هُطُولِ الْمَطَرِ؛ فَالْمَطَرُ هُوَ السَّبَبُ.',
    explanationAudio: ['حَمَلَ سَامِي الْمِظَلَّةَ بَعْدَ هُطُولِ الْمَطَرِ؛ فَالْمَطَرُ هُوَ السَّبَبُ.'],
  },
];

const fluencyPassages: FluencyPassage[] = [
  {
    titleAr: 'سَلْمَى فِي الْحَدِيقَةِ',
    linesAr: [
      'ذَهَبَتْ سَلْمَى إِلَى الْحَدِيقَةِ.',
      'رَأَتْ زَهْرَةً جَمِيلَةً.',
      'سَقَتْهَا بِالْمَاءِ، ثُمَّ عَادَتْ إِلَى الْبَيْتِ.',
    ],
    modelAudio: [
      'ذَهَبَتْ سَلْمَى إِلَى الْحَدِيقَةِ.',
      'رَأَتْ زَهْرَةً جَمِيلَةً.',
      'سَقَتْهَا بِالْمَاءِ، ثُمَّ عَادَتْ إِلَى الْبَيْتِ.',
    ],
    reflectionAr: 'هَلْ قَرَأْتَ الْكَلِمَاتِ بِدِقَّةٍ؟ هَلْ تَوَقَّفْتَ عِنْدَ النُّقْطَةِ؟ هَلْ كَانَ صَوْتُكَ وَاضِحًا؟',
  },
  {
    titleAr: 'رِحْلَةُ عُمَرَ',
    linesAr: [
      'خَرَجَ عُمَرُ مَعَ أُسْرَتِهِ فِي صَبَاحٍ جَمِيلٍ.',
      'شَاهَدُوا عُصْفُورًا فَوْقَ غُصْنٍ قَرِيبٍ.',
      'هَدَأُوا وَاسْتَمْتَعُوا بِصَوْتِهِ، ثُمَّ عَادُوا إِلَى الْبَيْتِ.',
    ],
    modelAudio: [
      'خَرَجَ عُمَرُ مَعَ أُسْرَتِهِ فِي صَبَاحٍ جَمِيلٍ.',
      'شَاهَدُوا عُصْفُورًا فَوْقَ غُصْنٍ قَرِيبٍ.',
      'هَدَأُوا وَاسْتَمْتَعُوا بِصَوْتِهِ، ثُمَّ عَادُوا إِلَى الْبَيْتِ.',
    ],
    reflectionAr: 'حَاوِلْ أَنْ تَجْمَعَ الْكَلِمَاتِ فِي عِبَارَاتٍ مُنَاسِبَةٍ، وَخُذْ وَقْفَةً قَصِيرَةً عِنْدَ عَلامَةِ الْوَقْفِ.',
  },
];

export function getStructuredLiteracyStations(ageYears: number): LiteracyStation[] {
  const stations: LiteracyStation[] = [
    {
      id: 'comprehension',
      titleAr: ageYears < 6 ? 'الفهم المسموع واللغة' : 'الفهم القرائي واللغة',
      subtitleAr: ageYears < 6 ? 'نستمع ونفهم ما تحكيه الجملة' : 'نقرأ النص ونفهم فكرته',
      purposeAr: ageYears < 6
        ? 'تنمية فهم الجمل القصيرة والمفردات من خلال الاستماع والصور، دون مطالبة الطفل بقراءة النص.'
        : 'فهم المعلومات الصريحة، وربط السبب بالنتيجة في نصوص قصيرة مناسبة للعمر.',
      ageNoteAr: ageYears < 6 ? 'مناسب لعمر ٤–٥ سنوات: فهم مسموع، لا اختبار قراءة.' : 'مناسب لمن بدأ تعلّم القراءة؛ يمكن الاستماع إلى النص ثم قراءته.',
      questions: ageYears < 6 ? listeningComprehension : readingComprehension,
    },
  ];

  if (ageYears >= 6) {
    stations.unshift(
      {
        id: 'decoding',
        titleAr: 'فك الترميز وقراءة الكلمات',
        subtitleAr: 'من الحروف والحركات إلى الكلمة',
        purposeAr: 'قراءة كلمات مألوفة مشكولة، والانتباه إلى الحركة القصيرة والمدّ والسكون.',
        ageNoteAr: 'متاح من عمر ٦ سنوات، بعد بدء تعلّم القراءة.',
        questions: decoding,
      },
      {
        id: 'spelling',
        titleAr: 'الإملاء وبناء الكلمة',
        subtitleAr: 'نسمع الكلمة وننتبه إلى رسمها',
        purposeAr: 'التمييز بين أنماط كتابية عربية شائعة مثل المدّ والتاء المربوطة والألف المقصورة.',
        ageNoteAr: 'متاح من عمر ٦ سنوات، ولا تُستخدم نتائجه كدرجة معيارية.',
        questions: spelling,
      },
    );
    stations.push({
      id: 'fluency',
      titleAr: 'الطلاقة والقراءة المتكررة',
      subtitleAr: 'نقرأ بدقة وعبارات واضحة، لا سباق سرعة',
      purposeAr: 'الاستماع إلى نموذج، ثم إعادة قراءة نص قصير مع مراعاة الدقة والتجميع والوقف.',
      ageNoteAr: 'متاح للأطفال الذين بدأوا قراءة النصوص؛ لا يقيس السرعة ولا يسجّل الصوت.',
      questions: [],
    });
  }

  if (ageYears >= 7) {
    stations.push({
      id: 'morphology',
      titleAr: 'الوعي الصرفي وعائلات الكلمات',
      subtitleAr: 'نكتشف الجذر والكلمات المرتبطة به',
      purposeAr: 'ملاحظة الحروف الأصلية والعلاقة في المعنى بين كلمات عربية من عائلة واحدة.',
      ageNoteAr: 'محتوى تمهيدي لعمر ٧–٨ سنوات، ويحتاج مراجعة لغوية قبل اعتماده كمنهج معياري.',
      questions: morphology,
    });
  }

  return stations;
}

export function getFluencyPassage(ageYears: number): FluencyPassage {
  return ageYears >= 8 ? fluencyPassages[1] : fluencyPassages[0];
}
