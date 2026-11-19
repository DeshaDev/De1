/**
 * Worked examples shown before each new kind of question in the screening ("I do" before "you do").
 * Every example uses words that are NOT in any scored question, so the example teaches the rule
 * without giving away an answer. Audio never speaks an isolated sound: the voice reads whole words.
 */
export interface ExampleRow {
  /** Picture id from the lexicon, or a letter/word shown as text. */
  picture?: string;
  glyph?: string;
  /** The name under the picture, with diacritics. */
  word: string;
  /** The part of the word the rule is about, shown highlighted (e.g. «نَـ»). */
  partAr?: string;
  /** true = matches the rule, false = does not; absent = the model word. */
  ok?: boolean;
}

export interface TaskExample {
  titleAr: string;
  rows: ExampleRow[];
  /** What the child should notice, in one or two short sentences. */
  explainAr: string;
  /** What to do in the questions that follow. */
  nowAr: string;
  audio: string[];
}

const EXAMPLES: Record<string, TaskExample> = {
  onset: {
    titleAr: 'مثال: الصوت الأول',
    rows: [
      { picture: 'fire', word: 'نَار', partAr: 'نَـ' },
      { picture: 'tiger', word: 'نَمِر', partAr: 'نَـ', ok: true },
      { picture: 'milk', word: 'حَلِيب', partAr: 'حَـ', ok: false },
    ],
    explainAr: '«نَار» و«نَمِر» تبدآن بالصوت نفسه «نَـ». أمّا «حَلِيب» فتبدأ بصوت آخر «حَـ».',
    nowAr: 'الآن: اسمع اسم الصورة الكبيرة، ثم اختر الصورة التي يبدأ اسمها بالصوت نفسه.',
    audio: [
      'مِثَالٌ: نَار، نَمِر. الْكَلِمَتَانِ تَبْدَآنِ بِالصَّوْتِ نَفْسِهِ.',
      'أَمَّا حَلِيب فَتَبْدَأُ بِصَوْتٍ آخَرَ.',
      'الْآنَ اخْتَرِ الصُّورَةَ الَّتِي يَبْدَأُ اسْمُهَا مِثْلَ الصُّورَةِ الْكَبِيرَةِ.',
    ],
  },
  coda: {
    titleAr: 'مثال: الصوت الأخير',
    rows: [
      { picture: 'boat', word: 'قَارِب', partAr: 'ـبْ' },
      { picture: 'milk', word: 'حَلِيب', partAr: 'ـبْ', ok: true },
      { picture: 'fire', word: 'نَار', partAr: 'ـرْ', ok: false },
    ],
    explainAr: '«قَارِب» و«حَلِيب» تنتهيان بالصوت نفسه «ـبْ». أمّا «نَار» فتنتهي بصوت آخر «ـرْ».',
    nowAr: 'الآن: اسمع اسم الصورة الكبيرة، ثم اختر الصورة التي ينتهي اسمها بآخر صوت فيه.',
    audio: [
      'مِثَالٌ: قَارِب، حَلِيب. الْكَلِمَتَانِ تَنْتَهِيَانِ بِالصَّوْتِ نَفْسِهِ.',
      'أَمَّا نَار فَتَنْتَهِي بِصَوْتٍ آخَرَ.',
      'الْآنَ اخْتَرِ الصُّورَةَ الَّتِي يَنْتَهِي اسْمُهَا بِآخِرِ صَوْتٍ فِي اسْمِ الصُّورَةِ الْكَبِيرَةِ.',
    ],
  },
  rhyme: {
    titleAr: 'مثال: كلمات تنتهي بالطريقة نفسها',
    rows: [
      { picture: 'drum', word: 'طَبْل', partAr: 'ـبْل' },
      { picture: 'rope', word: 'حَبْل', partAr: 'ـبْل', ok: true },
      { picture: 'snow', word: 'ثَلْج', partAr: 'ـلْج', ok: false },
    ],
    explainAr: '«طَبْل» و«حَبْل» تنتهيان بالنغمة نفسها «ـبْل». أمّا «ثَلْج» فنهايتها مختلفة.',
    nowAr: 'الآن: اسمع اسم الصورة الكبيرة، ثم اختر الصورة التي ينتهي اسمها مثلها.',
    audio: [
      'مِثَالٌ: طَبْل، حَبْل. الْكَلِمَتَانِ تَنْتَهِيَانِ بِالطَّرِيقَةِ نَفْسِهَا.',
      'أَمَّا ثَلْج فَنِهَايَتُهَا مُخْتَلِفَةٌ.',
      'الْآنَ اخْتَرِ الصُّورَةَ الَّتِي يَنْتَهِي اسْمُهَا مِثْلَ الصُّورَةِ الْكَبِيرَةِ.',
    ],
  },
  blending: {
    titleAr: 'مثال: تركيب الكلمة من أجزائها',
    rows: [
      { word: 'نَـ', glyph: 'نَـ' },
      { word: 'مِرْ', glyph: 'مِرْ' },
      { picture: 'tiger', word: 'نَمِر', ok: true },
    ],
    explainAr: 'نسمع الجزأين «نَـ» ثم «مِرْ»، ونضمّهما معًا بسرعة، فنسمع الكلمة: «نَمِر».',
    nowAr: 'الآن: اسمع أجزاء الكلمة، ثم اختر صورتها.',
    audio: [
      'مِثَالٌ: نَسْمَعُ جُزْأَيْنِ، ثُمَّ نَضُمُّهُمَا مَعًا، فَنَسْمَعُ الْكَلِمَةَ: نَمِر.',
      'الْآنَ اسْمَعْ أَجْزَاءَ الْكَلِمَةِ، ثُمَّ اخْتَرْ صُورَتَهَا.',
    ],
  },
  syllableCount: {
    titleAr: 'مثال: عدّ المقاطع بالتصفيق',
    rows: [
      { picture: 'plane', word: 'طَائِرَة', partAr: 'طَا 👏 ئِ 👏 رَة 👏' },
    ],
    explainAr: 'نقول «طَائِرَة» ببطء ونصفّق مع كل جزء: طَا 👏 ئِ 👏 رَة 👏. ثلاث صفقات، إذن فيها ثلاثة مقاطع.',
    nowAr: 'الآن: قل اسم الصورة ببطء، وصفّق مع كل جزء، ثم اختر عدد الصفقات.',
    audio: [
      'مِثَالٌ: نَقُولُ طَائِرَة بِبُطْءٍ، وَنُصَفِّقُ مَعَ كُلِّ جُزْءٍ. ثَلَاثُ صَفَقَاتٍ، إِذَنْ فِيهَا ثَلَاثَةُ مَقَاطِعَ.',
      'الْآنَ قُلِ اسْمَ الصُّورَةِ بِبُطْءٍ، وَصَفِّقْ، ثُمَّ اخْتَرْ عَدَدَ الصَّفَقَاتِ.',
    ],
  },
  sameDifferent: {
    titleAr: 'مثال: الصوت نفسه أم صوتان مختلفان؟',
    rows: [
      { glyph: 'سَمَك ← سَمَك', word: 'سَمَك سَمَك', partAr: 'الصوت نفسه', ok: true },
      { glyph: 'سَار ← صَار', word: 'سَار صَار', partAr: 'صوتان مختلفان', ok: false },
    ],
    explainAr: 'إذا سمعت الصوت نفسه مرتين فالمس «الصوت نفسه». وإذا تغيّر الصوت ولو قليلًا فالمس «صوتان مختلفان».',
    nowAr: 'الآن: اسمع الصوتين جيدًا، ثم اختر.',
    audio: [
      'مِثَالٌ: سَمَك، سَمَك. هَذَا الصَّوْتُ نَفْسُهُ.',
      'سَار، صَار. هَذَانِ صَوْتَانِ مُخْتَلِفَانِ.',
      'الْآنَ اسْمَعِ الصَّوْتَيْنِ جَيِّدًا، ثُمَّ اخْتَرْ.',
    ],
  },
  minimalPair: {
    titleAr: 'مثال: المس صورة الكلمة التي تسمعها',
    rows: [
      { picture: 'drum', word: 'طَبْل', ok: true },
      { picture: 'rope', word: 'حَبْل', ok: false },
    ],
    explainAr: 'الكلمتان متقاربتان جدًا. إذا سمعت «طَبْل» فالمس صورة الطبل، لا الحبل.',
    nowAr: 'الآن: اسمع الكلمة جيدًا، ثم المس صورتها.',
    audio: [
      'مِثَالٌ: إِذَا سَمِعْتَ: طَبْل، فَالْمِسْ صُورَةَ الطَّبْلِ، لَا الْحَبْلِ.',
      'الْآنَ اسْمَعِ الْكَلِمَةَ جَيِّدًا، ثُمَّ الْمِسْ صُورَتَهَا.',
    ],
  },
  letterSound: {
    titleAr: 'مثال: صوت الحرف',
    rows: [
      { picture: 'egg', word: 'بَيْضَة', partAr: 'بَـ' },
      { glyph: 'بَ', word: 'بَ', ok: true },
      { glyph: 'نَ', word: 'نَ', ok: false },
    ],
    explainAr: 'أول صوت في «بَيْضَة» هو صوت حرف الباء «بَ»، فنلمس «بَ». نسمع صوت الحرف، لا اسمه.',
    nowAr: 'الآن: اسمع الصوت، ثم المس الحرف الذي له هذا الصوت.',
    audio: [
      'مِثَالٌ: أَوَّلُ صَوْتٍ فِي بَيْضَة هُوَ صَوْتُ حَرْفِ الْبَاءِ، فَنَلْمِسُ حَرْفَ الْبَاءِ.',
      'الْآنَ اسْمَعِ الصَّوْتَ، ثُمَّ الْمِسِ الْحَرْفَ الَّذِي لَهُ هَذَا الصَّوْتُ.',
    ],
  },
  letter: {
    titleAr: 'مثال: انتبه للنقاط',
    rows: [
      { glyph: 'ب', word: 'ب', partAr: 'نقطة تحت', ok: true },
      { glyph: 'ت', word: 'ت', partAr: 'نقطتان فوق', ok: false },
      { glyph: 'ث', word: 'ث', partAr: 'ثلاث نقاط فوق', ok: false },
    ],
    explainAr: 'هذه الحروف شكلها واحد، ويفرّق بينها عدد النقاط ومكانها. الشكل المطابق تمامًا له النقاط نفسها في المكان نفسه.',
    nowAr: 'الآن: انظر إلى الشكل في الأعلى، ثم المس الشكل المطابق له تمامًا.',
    audio: [
      'مِثَالٌ: هَذِهِ الْحُرُوفُ شَكْلُهَا وَاحِدٌ، وَيُفَرِّقُ بَيْنَهَا عَدَدُ النِّقَاطِ وَمَكَانُهَا.',
      'الْآنَ انْظُرْ إِلَى الشَّكْلِ فِي الْأَعْلَى، ثُمَّ الْمِسِ الشَّكْلَ الْمُطَابِقَ لَهُ تَمَامًا.',
    ],
  },
  word: {
    titleAr: 'مثال: قارن الكلمة حرفًا حرفًا',
    rows: [
      { glyph: 'نار', word: 'نار', ok: true },
      { glyph: 'نان', word: 'نان', partAr: 'الحرف الأخير مختلف', ok: false },
    ],
    explainAr: 'نقرأ الكلمتين من اليمين حرفًا حرفًا. «نار» و«نان» تختلفان في الحرف الأخير، فليستا متطابقتين.',
    nowAr: 'الآن: انظر إلى الكلمة في الأعلى، ثم المس الكلمة المطابقة لها تمامًا.',
    audio: [
      'مِثَالٌ: نَقْرَأُ الْكَلِمَتَيْنِ مِنَ الْيَمِينِ حَرْفًا حَرْفًا، وَنَبْحَثُ عَنْ أَيِّ حَرْفٍ مُخْتَلِفٍ.',
      'الْآنَ انْظُرْ إِلَى الْكَلِمَةِ فِي الْأَعْلَى، ثُمَّ الْمِسِ الْكَلِمَةَ الْمُطَابِقَةَ لَهَا تَمَامًا.',
    ],
  },
};

const TAG_TO_EXAMPLE: Record<string, string> = { contrast: 'sameDifferent', catch: 'sameDifferent' };

/** The example for an item's question type, if one exists. */
export function exampleForTag(tag: string | undefined): { key: string; example: TaskExample } | null {
  if (!tag) return null;
  const key = TAG_TO_EXAMPLE[tag] ?? tag;
  const example = EXAMPLES[key];
  return example ? { key, example } : null;
}

export const ALL_EXAMPLES: TaskExample[] = Object.values(EXAMPLES);
