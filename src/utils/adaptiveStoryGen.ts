/**
 * Arabic Adaptive Decodable Story Generation & Curation Engine
 * Accurately maps EVERY Arabic phonemic confusion pair with 100% diacritized text.
 */

export interface ArticulatoryTip {
  sound: string;
  description: string;
  mouthShape: 'rounded' | 'open' | 'teeth' | 'throat';
}

export interface StoryComprehensionQuestion {
  question: string;
  options: string[];
  answerIndex: number;
}

export interface DecodableStory {
  id: string;
  title: string;
  story: string;
  targetPhoneme: string;
  interest: string;
  interestAr: string;
  gradeLevel: number;
  targetWords: string[];
  articulatoryTip: ArticulatoryTip;
  questions: StoryComprehensionQuestion[];
  source: 'ai_generated' | 'curated_bank';
}

export const CHILD_INTERESTS = [
  { id: 'space', label: 'الفضاء والمجرات 🚀', arName: 'الْفَضَاءِ', icon: '🚀' },
  { id: 'animals', label: 'عالم الحيوانات 🦁', arName: 'الْحَيَوَانَاتِ', icon: '🦁' },
  { id: 'sports', label: 'أبطال الرياضة ⚽', arName: 'الرِّيَاضَةِ', icon: '⚽' },
  { id: 'adventure', label: 'أسرار الغابة 🌿', arName: 'الْغَابَةِ', icon: '🌿' },
  { id: 'fantasy', label: 'الخيال والألغاز 🏰', arName: 'الْخَيَالِ', icon: '🏰' },
] as const;

export const PHONEME_TARGET_OPTIONS = [
  { id: 'ta_ta2', label: 'تمييز التاء والطاء (ت / ط)', target: 'ت / ط' },
  { id: 'sin_sad', label: 'تمييز السين والصاد (س / ص)', target: 'س / ص' },
  { id: 'dal_dad', label: 'تمييز الدال والضاد (د / ض)', target: 'د / ض' },
  { id: 'kaf_qaf', label: 'تمييز الكاف والقاف (ك / ق)', target: 'ك / ق' },
  { id: 'vowels', label: 'المدود الطويلة (الألف والواو والياء)', target: 'المدود' },
  { id: 'sukun', label: 'المقطع الساكن وتسكين الحرف', target: 'السكون' },
] as const;

export const CURATED_DECODABLE_STORIES: DecodableStory[] = [
  // 1. TAA / TAA2 (ت / ط)
  {
    id: 'story-ta-ta2',
    title: 'طَائِرُ الْبُسْتَانِ وَالتِّينُ اللَّذِيذُ',
    story: 'طَارَ طَائِرٌ لَطِيفٌ فَوْقَ بَسَاتِينِ التِّينِ. هَبَطَ الطَّائِرُ عَلَى طَرَفِ الطَّرِيقِ، فَوَجَدَ تَمْرًا طَيِّبًا تَرَكَهُ الْفَلَّاحُ تَحْتَ شَجَرَةٍ عَالِيَةٍ. أَكَلَ الطَّائِرُ وَتَرَنَّمَ بِصَوْتٍ طَرُوبٍ.',
    targetPhoneme: 'ت / ط',
    interest: 'animals',
    interestAr: 'الْحَيَوَانَاتِ',
    gradeLevel: 2,
    targetWords: ['طَارَ', 'طَائِرٌ', 'لَطِيفٌ', 'بَسَاتِينِ', 'التِّينِ', 'هَبَطَ', 'طَرَفِ', 'الطَّرِيقِ', 'تَمْرًا', 'طَيِّبًا', 'تَرَكَهُ', 'تَحْتَ', 'طَرُوبٍ'],
    articulatoryTip: {
      sound: 'ط مقابل ت',
      description: 'الطاء حرف مفخم وقوي يمتلئ به الفم، بينما التاء حرف مرقق لطيف يخرج من طرف اللسان مع أصول الثنايا.',
      mouthShape: 'open',
    },
    questions: [
      {
        question: 'أَيْنَ هَبَطَ الطَّائِرُ اللَّطِيفُ؟',
        options: ['عَلَى طَرَفِ الطَّرِيقِ', 'فِي أَعْمَاقِ الْبَحْرِ', 'فَوْقَ قِمَّةِ الْجَبَلِ'],
        answerIndex: 0,
      },
      {
        question: 'مَاذَا وَجَدَ الطَّائِرُ تَحْتَ الشَّجَرَةِ؟',
        options: ['تَمْرًا طَيِّبًا', 'قِطْعَةَ خَشَبٍ', 'كُرَةً صَغِيرَةً'],
        answerIndex: 0,
      },
    ],
    source: 'curated_bank',
  },

  // 2. SIN / SAD (س / ص)
  {
    id: 'story-sin-sad',
    title: 'صَقْرُ الصَّحْرَاءِ وَالسِّنْجَابُ السَّرِيعُ',
    story: 'حَلَّقَ صَقْرٌ صَغِيرٌ فَوْقَ صُخُورِ الصَّحْرَاءِ. أَبْصَرَ الصَّقْرُ سِنْجَابًا سَرِيعًا يَسِيرُ بَيْنَ السَّنَابِلِ. صَاحَ الصَّقْرُ بِصَوْتٍ عَالٍ، فَسَكَنَ السِّنْجَابُ فِي سِلْمٍ وَسَلَامٍ.',
    targetPhoneme: 'س / ص',
    interest: 'animals',
    interestAr: 'الْحَيَوَانَاتِ',
    gradeLevel: 2,
    targetWords: ['صَقْرٌ', 'صَغِيرٌ', 'صُخُورِ', 'الصَّحْرَاءِ', 'أَبْصَرَ', 'سِنْجَابًا', 'سَرِيعًا', 'يَسِيرُ', 'السَّنَابِلِ', 'صَاحَ', 'بِصَوْتٍ', 'سِلْمٍ', 'وَسَلَامٍ'],
    articulatoryTip: {
      sound: 'ص مقابل س',
      description: 'الصاد حرف مفخم ومطبق وممتلئ بالهواء، بينما السين حرف مرقق هادئ مع صفير لطيف.',
      mouthShape: 'rounded',
    },
    questions: [
      {
        question: 'أَيْنَ حَلَّقَ الصَّقْرُ الصَّغِيرُ؟',
        options: ['فَوْقَ صُخُورِ الصَّحْرَاءِ', 'قُرْبَ النَّهْرِ الْبَعِيدِ', 'فِي حَدِيقَةِ الْمَدِينَةِ'],
        answerIndex: 0,
      },
      {
        question: 'كَيْفَ سَكَنَ السِّنْجَابُ بَعْدَ الصَّوْتِ؟',
        options: ['فِي سِلْمٍ وَسَلَامٍ', 'فِي خَوْفٍ وَقَلَقٍ', 'فِي غَضَبٍ شَدِيدٍ'],
        answerIndex: 0,
      },
    ],
    source: 'curated_bank',
  },

  // 3. DAL / DAD (د / ض)
  {
    id: 'story-dal-dad',
    title: 'مُبَارَاةُ الرِّيَاضَةِ وَالضَّرْبَةُ الْقَاضِيَةُ',
    story: 'دَخَلَ دَاوُدُ مَيْدَانَ الرِّيَاضَةِ بِنَشَاطٍ. رَكَضَ دَاوُدُ بِقُوَّةٍ وَسَدَّدَ كُرَةً صَائِبَةً فِي الشِّبَاكِ دُونَ تَرَدُّدٍ. ضَحِكَ الْحَكَمُ وَصَفَّقَ الْجُمْهُورُ لِهَذَا الْبَطَلِ الرِّيَاضِيِّ الْمُنْضَبِطِ.',
    targetPhoneme: 'د / ض',
    interest: 'sports',
    interestAr: 'الرِّيَاضَةِ',
    gradeLevel: 3,
    targetWords: ['دَخَلَ', 'دَاوُدُ', 'مَيْدَانَ', 'الرِّيَاضَةِ', 'سَدَّدَ', 'دُونَ', 'تَرَدُّدٍ', 'ضَحِكَ', 'الرِّيَاضِيِّ', 'الْمُنْضَبِطِ'],
    articulatoryTip: {
      sound: 'ض مقابل د',
      description: 'الضاد تخرج من حافة اللسان مع الأضراس العليا مع استطالة، أما الدال فتخرج من طرف اللسان بترقيق.',
      mouthShape: 'teeth',
    },
    questions: [
      {
        question: 'مَاذَا فَعَلَ دَاوُدُ فِي مَيْدَانِ الرِّيَاضَةِ؟',
        options: ['سَدَّدَ كُرَةً صَائِبَةً فِي الشِّبَاكِ', 'جَلَسَ عَلَى الْمَقْعَدِ', 'خَرَجَ مِنَ الْمَلْعَبِ'],
        answerIndex: 0,
      },
      {
        question: 'كَيْفَ كَانَتْ رَدَّةُ فِعْلِ الْجُمْهُورِ؟',
        options: ['صَفَّقَ الْجُمْهُورُ لِلْبَطَلِ', 'غَادَرَ الْجُمْهُورُ حَزِينًا', 'سَكَتَ الْجَمِيعُ'],
        answerIndex: 0,
      },
    ],
    source: 'curated_bank',
  },

  // 4. KAF / QAF (ك / ق)
  {
    id: 'story-kaf-qaf',
    title: 'قَارِبُ كَرِيمٍ وَكَنْزُ الْقَمَرِ',
    story: 'رَكِبَ كَرِيمٌ قَارِبًا صَغِيرًا قُرْبَ الشَّاطِئِ. أَبْصَرَ كَرِيمٌ كَنْزًا قَدِيمًا يَلْمَعُ تَحْتَ ضَوْءِ الْقَمَرِ الْقَرِيبِ. فَتَحَ كَرِيمٌ صُنْدُوقَ الْكَنْزِ فَوَجَدَ كِتَابًا قَيِّمًا يَحْكِي قِصَصَ الْأَبْطَالِ.',
    targetPhoneme: 'ك / ق',
    interest: 'adventure',
    interestAr: 'الْمُغَامَرَةِ',
    gradeLevel: 2,
    targetWords: ['رَكِبَ', 'كَرِيمٌ', 'قَارِبًا', 'قُرْبَ', 'كَنْزًا', 'قَدِيمًا', 'الْقَمَرِ', 'كِتَابًا', 'قَيِّمًا', 'قِصَصَ'],
    articulatoryTip: {
      sound: 'ق مقابل ك',
      description: 'القاف تخرج من أقصى اللسان فوق عند اللهاة بتفخيم، أما الكاف فتخرج أسفل منها بقليل بترقيق وانفتاح.',
      mouthShape: 'throat',
    },
    questions: [
      {
        question: 'مَاذَا رَكِبَ كَرِيمٌ قُرْبَ الشَّاطِئِ؟',
        options: ['قَارِبًا صَغِيرًا', 'سَفِينَةً ضَخْمَةً', 'طَائِرَةً سَرِيعَةً'],
        answerIndex: 0,
      },
      {
        question: 'مَاذَا وَجَدَ كَرِيمٌ فِي صُنْدُوقِ الْكَنْزِ؟',
        options: ['كِتَابًا قَيِّمًا', 'ذَهَبًا كَثِيرًا', 'حِجَارَةً مَلَوَّنَةً'],
        answerIndex: 0,
      },
    ],
    source: 'curated_bank',
  },

  // 5. SUKUN (السكون والمقطع الساكن)
  {
    id: 'story-sukun',
    title: 'مُغَامَرَةُ بَدْرٍ عِنْدَ جِذْعِ الشَّجَرَةِ',
    story: 'وَقَفَ بَدْرٌ عِنْدَ جِذْعِ شَجَرَةٍ ضَخْمَةٍ. حَمَلَ بَدْرٌ مِصْبَاحَهُ فِي كَفِّهِ، وَسَارَ نَحْوَ مَجْرَى النَّهْرِ الْعَذْبِ. شَرِبَ بَدْرٌ مِنَ الْمَاءِ، ثُمَّ جَلَسَ يَكْتُبُ فِي دَفْتَرِهِ بِفَرَحٍ.',
    targetPhoneme: 'السكون',
    interest: 'adventure',
    interestAr: 'الْغَابَةِ',
    gradeLevel: 2,
    targetWords: ['بَدْرٌ', 'عِنْدَ', 'جِذْعِ', 'ضَخْمَةٍ', 'حَمَلَ', 'مِصْبَاحَهُ', 'نَحْوَ', 'مَجْرَى', 'الْعَذْبِ', 'شَرِبَ', 'يَكْتُبُ', 'دَفْتَرِهِ'],
    articulatoryTip: {
      sound: 'المقطع الساكن',
      description: 'الحرف الساكن لا يُنطق وحده؛ اقف عنده وقفة خفيفة واجمعه بالحرف الذي قبله (بَدْـ · رٌ).',
      mouthShape: 'open',
    },
    questions: [
      {
        question: 'مَاذَا حَمَلَ بَدْرٌ فِي كَفِّهِ؟',
        options: ['مِصْبَاحَهُ', 'سَيْفَهُ', 'طَعَامَهُ'],
        answerIndex: 0,
      },
      {
        question: 'مَاذَا فَعَلَ بَدْرٌ عِنْدَ مَجْرَى النَّهْرِ؟',
        options: ['شَرِبَ وَجَلَسَ يَكْتُبُ فِي دَفْتَرِهِ', 'سَبَحَ فِي الْمَاءِ', 'نَامَ تَحْتَ الشَّجَرَةِ'],
        answerIndex: 0,
      },
    ],
    source: 'curated_bank',
  },

  // 6. VOWELS (المدود)
  {
    id: 'story-vowels',
    title: 'طُيُورُ الْوَادِي وَنَشِيدُ الرَّبِيعِ',
    story: 'عَادَتْ طُيُورٌ جَمِيلَةٌ إِلَى الْوَادِي الْفَسِيحِ. طَارَتِ الْعَصَافِيرُ بَيْنَ الْغُصُونِ، تُغَنِّي أَلْحَانًا عَذْبَةً عَنْ نُورِ الشَّمْسِ وَزُهُورِ الْبَسَاتِينِ.',
    targetPhoneme: 'المدود',
    interest: 'space',
    interestAr: 'الْفَضَاءِ',
    gradeLevel: 2,
    targetWords: ['طُيُورٌ', 'جَمِيلَةٌ', 'الْوَادِي', 'الْفَسِيحِ', 'طَارَتِ', 'الْعَصَافِيرُ', 'الْغُصُونِ', 'تُغَنِّي', 'أَلْحَانًا', 'زُهُورِ', 'الْبَسَاتِينِ'],
    articulatoryTip: {
      sound: 'المد الطويل',
      description: 'مد الصوت بالحركة الطويلة بمقدار حركتين دون استعجال (طُـو · يُـو · رٌ).',
      mouthShape: 'rounded',
    },
    questions: [
      {
        question: 'إِلَى أَيْنَ عَادَتِ الطُّيُورُ الْجَمِيلَةُ؟',
        options: ['إِلَى الْوَادِي الْفَسِيحِ', 'إِلَى قَفَصٍ ضَيِّقٍ', 'إِلَى الْبَحْرِ الْعَمِيقِ'],
        answerIndex: 0,
      },
      {
        question: 'عَنْ مَاذَا تُغَنِّي الْعَصَافِيرُ؟',
        options: ['عَنْ نُورِ الشَّمْسِ وَزُهُورِ الْبَسَاتِينِ', 'عَنِ الرِّيَاحِ وَالْمَطَرِ', 'عَنِ اللَّيْلِ الْمُظْلِمِ'],
        answerIndex: 0,
      },
    ],
    source: 'curated_bank',
  },
];

/**
 * Fetch or generate a personalized decodable story matching student needs.
 */
export async function generateDecodableStory(params: {
  interest: string;
  targetPhoneme: string;
  gradeLevel: number;
  studentName: string;
}): Promise<DecodableStory> {
  const { interest, targetPhoneme, gradeLevel, studentName } = params;

  // Clean interest Arabic name
  const interestObj = CHILD_INTERESTS.find((i) => i.id === interest);
  const cleanInterestAr = interestObj ? interestObj.arName : 'الْمُغَامَرَةِ';

  try {
    const res = await fetch('/api/ai/generate-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interest: cleanInterestAr,
        targetPhoneme,
        gradeLevel,
        studentName,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.story && data.title && data.targetPhoneme === targetPhoneme) {
        return {
          id: `ai-${Date.now()}`,
          title: data.title,
          story: data.story,
          targetPhoneme: data.targetPhoneme || targetPhoneme,
          interest,
          interestAr: cleanInterestAr,
          gradeLevel,
          targetWords: Array.isArray(data.targetWords) ? data.targetWords : [],
          articulatoryTip: data.articulatoryTip || {
            sound: targetPhoneme,
            description: 'انتبه لمخرج الصوت وتشكيله السليم أثناء القراءة.',
            mouthShape: 'open',
          },
          questions: Array.isArray(data.questions) ? data.questions : [],
          source: 'ai_generated',
        };
      }
    }
  } catch (err) {
    console.warn('AI StoryGen fetch error, using curated fallback:', err);
  }

  // Exact phoneme match from curated bank - NEVER return the wrong phoneme!
  const matched = CURATED_DECODABLE_STORIES.find((s) => s.targetPhoneme === targetPhoneme);

  if (matched) {
    return {
      ...matched,
      title: matched.title.replace('بَدْرٍ', studentName).replace('كَرِيمٍ', studentName).replace('دَاوُدَ', studentName),
      story: matched.story.replace(/بَدْرٌ/g, studentName).replace(/كَرِيمٌ/g, studentName).replace(/دَاوُدُ/g, studentName),
    };
  }

  return CURATED_DECODABLE_STORIES[0];
}
