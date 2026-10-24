/**
 * Arabic Adaptive Decodable Story Generation & Curation Engine
 * Inspired by LUCA AI (StoryGen / SoundScout) and Science of Reading.
 * Generates and provides 100% fully-diacritized, phonetic-targeted decodable stories
 * aligned with the child's identified phonemic deficit and personal interest.
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
  gradeLevel: number;
  targetWords: string[];
  articulatoryTip: ArticulatoryTip;
  questions: StoryComprehensionQuestion[];
  source: 'ai_generated' | 'curated_bank';
}

export const CHILD_INTERESTS = [
  { id: 'space', label: 'الفضاء والمجرات 🚀', icon: '🚀' },
  { id: 'animals', label: 'عالم الحيوانات 🦁', icon: '🦁' },
  { id: 'sports', label: 'أبطال كرة القدم والرياضة ⚽', icon: '⚽' },
  { id: 'adventure', label: 'المغامرة والاستكشاف 🌿', icon: '🌿' },
  { id: 'fantasy', label: 'الخيال والألغاز 🏰', icon: '🏰' },
] as const;

export const PHONEME_TARGET_OPTIONS = [
  { id: 'sin_sad', label: 'تمييز السين والصاد (س / ص)', target: 'س / ص' },
  { id: 'dal_dad', label: 'تمييز الدال والضاد (د / ض)', target: 'د / ض' },
  { id: 'ta_ta2', label: 'تمييز التاء والطاء (ت / ط)', target: 'ت / ط' },
  { id: 'kaf_qaf', label: 'تمييز الكاف والقاف (ك / ق)', target: 'ك / ق' },
  { id: 'vowels', label: 'المدود الطويلة (الألف والواو والياء)', target: 'المدود' },
  { id: 'sukun', label: 'المقطع الساكن وتسكين الحرف', target: 'السكون' },
  { id: 'lam_shamsiya', label: 'اللام الشمسية واللام القمرية', target: 'اللامات' },
] as const;

export const CURATED_DECODABLE_STORIES: DecodableStory[] = [
  {
    id: 'story-space-sin-sad',
    title: 'رِحْلَةُ سَامِي فِي الْفَضَاءِ',
    story: 'سَافَرَ سَامِي فِي مَرْكَبَةِ الْفَضَاءِ الْوَاسِعَةِ. شَاهَدَ سَامِي كَوْكَبًا يَلْمَعُ فِي السَّمَاءِ، وَسَمِعَ صَوْتًا صَادِرًا مِنْ جِهَازِ الرَّصْدِ. صَمَدَ سَامِي بِشَجَاعَةٍ وَصَافَحَ صَدِيقَهُ الْفَضَائِيَّ بِسُرُورٍ.',
    targetPhoneme: 'س / ص',
    interest: 'space',
    gradeLevel: 2,
    targetWords: ['سَافَرَ', 'سَامِي', 'الْوَاسِعَةِ', 'السَّمَاءِ', 'سَمِعَ', 'صَوْتًا', 'صَادِرًا', 'الرَّصْدِ', 'صَمَدَ', 'صَافَحَ', 'صَدِيقَهُ', 'بِسُرُورٍ'],
    articulatoryTip: {
      sound: 'ص مقابل س',
      description: 'حرف الصاد مفخم ومطبق: يرتفع أقصى اللسان وتستدير الشفتان قليلاً ويمتلئ الفم بالهواء. أما السين فمرققة ومنفتحة مع صفير لطيف.',
      mouthShape: 'rounded',
    },
    questions: [
      {
        question: 'إِلَى أَيْنَ سَافَرَ سَامِي؟',
        options: ['فِي مَرْكَبَةِ الْفَضَاءِ الْوَاسِعَةِ', 'فِي سَفِينَةٍ بَحْرِيَّةٍ', 'فِي قِطَارٍ سَرِيعٍ'],
        answerIndex: 0,
      },
      {
        question: 'كَيْفَ صَافَحَ سَامِي صَدِيقَهُ؟',
        options: ['بِسُرُورٍ', 'بِخَوْفٍ', 'بِتَرَدُّدٍ'],
        answerIndex: 0,
      },
    ],
    source: 'curated_bank',
  },
  {
    id: 'story-animals-sin-sad',
    title: 'صَقْرُ الصَّحْرَاءِ وَالسِّنْجَابُ',
    story: 'حَلَّقَ صَقْرٌ صَغِيرٌ فَوْقَ صُخُورِ الصَّحْرَاءِ. أَبْصَرَ الصَّقْرُ سِنْجَابًا سَرِيعًا يَسِيرُ بَيْنَ السَّنَابِلِ. صَاحَ الصَّقْرُ بِصَوْتٍ عَالٍ، فَسَكَنَ السِّنْجَابُ فِي سِلْمٍ وَسَلَامٍ.',
    targetPhoneme: 'س / ص',
    interest: 'animals',
    gradeLevel: 2,
    targetWords: ['صَقْرٌ', 'صَغِيرٌ', 'صُخُورِ', 'الصَّحْرَاءِ', 'أَبْصَرَ', 'سِنْجَابًا', 'سَرِيعًا', 'يَسِيرُ', 'السَّنَابِلِ', 'صَاحَ', 'بِصَوْتٍ', 'فَسَكَنَ', 'سِلْمٍ', 'وَسَلَامٍ'],
    articulatoryTip: {
      sound: 'ص مقابل س',
      description: 'راقب صوت (صـ) في (صَقْر) - الصوت ممتلئ وفخم، بينما في (سِنْجَاب) الصوت رقيق وهادئ.',
      mouthShape: 'rounded',
    },
    questions: [
      {
        question: 'أَيْنَ حَلَّقَ الصَّقْرُ الصَّغِيرُ؟',
        options: ['فَوْقَ صُخُورِ الصَّحْرَاءِ', 'فَوْقَ الْأَشْجَارِ الْعَالِيَةِ', 'قُرْبَ النَّهْرِ الْجَارِي'],
        answerIndex: 0,
      },
      {
        question: 'كَيْفَ سَكَنَ السِّنْجَابُ؟',
        options: ['فِي سِلْمٍ وَسَلَامٍ', 'فِي خَوْفٍ وَقَلَقٍ', 'فِي غَضَبٍ كَبِيرٍ'],
        answerIndex: 0,
      },
    ],
    source: 'curated_bank',
  },
  {
    id: 'story-sports-dal-dad',
    title: 'مُبَارَاةُ الرِّيَاضَةِ وَالضَّرْبَةُ الْقَاضِيَةُ',
    story: 'دَخَلَ دَاوُدُ مَيْدَانَ الرِّيَاضَةِ بِنَشَاطٍ. رَكَضَ دَاوُدُ بِقُوَّةٍ وَسَدَّدَ كُرَةً صَائِبَةً فِي الشِّبَاكِ دُونَ تَرَدُّدٍ. ضَحِكَ الْحَكَمُ وَصَفَّقَ الْجُمْهُورُ لِهَذَا الْبَطَلِ الرِّيَاضِيِّ الْمُنْضَبِطِ.',
    targetPhoneme: 'د / ض',
    interest: 'sports',
    gradeLevel: 3,
    targetWords: ['دَخَلَ', 'دَاوُدُ', 'مَيْدَانَ', 'الرِّيَاضَةِ', 'سَدَّدَ', 'دُونَ', 'تَرَدُّدٍ', 'ضَحِكَ', 'الرِّيَاضِيِّ', 'الْمُنْضَبِطِ'],
    articulatoryTip: {
      sound: 'ض مقابل د',
      description: 'الضاد تخرج من إحدى حافتي اللسان مع ما يجاورها من الأضراس العليا مع استطالة، أما الدال فتخرج من طرف اللسان مع أصول الثنايا العليا بترقيق.',
      mouthShape: 'teeth',
    },
    questions: [
      {
        question: 'مَاذَا فَعَلَ دَاوُدُ بَعْدَمَا رَكَضَ؟',
        options: ['سَدَّدَ كُرَةً صَائِبَةً فِي الشِّبَاكِ', 'جَلَسَ عَلَى الْمَقْعَدِ', 'خَرَجَ مِنَ الْمَلْعَبِ'],
        answerIndex: 0,
      },
      {
        question: 'كَيْفَ كَانَ شُعُورُ الْجُمْهُورِ؟',
        options: ['صَفَّقَ الْجُمْهُورُ لِلْبَطَلِ', 'غَادَرَ الْجُمْهُورُ حَزِينًا', 'سَكَتَ الْجُمْهُورُ'],
        answerIndex: 0,
      },
    ],
    source: 'curated_bank',
  },
  {
    id: 'story-adventure-sukun',
    title: 'مُغَامَرَةٌ فِي الْغَابَةِ الْخَضْرَاءِ',
    story: 'وَقَفَ بَدْرٌ عِنْدَ جِذْعِ شَجَرَةٍ ضَخْمَةٍ. حَمَلَ بَدْرٌ مِصْبَاحَهُ فِي كَفِّهِ، وَسَارَ نَحْوَ مَجْرَى النَّهْرِ الْعَذْبِ. شَرِبَ بَدْرٌ مِنَ الْمَاءِ، ثُمَّ جَلَسَ يَكْتُبُ فِي دَفْتَرِهِ بِفَرَحٍ.',
    targetPhoneme: 'السكون',
    interest: 'adventure',
    gradeLevel: 2,
    targetWords: ['بَدْرٌ', 'عِنْدَ', 'جِذْعِ', 'ضَخْمَةٍ', 'حَمَلَ', 'مِصْبَاحَهُ', 'نَحْوَ', 'مَجْرَى', 'الْعَذْبِ', 'شَرِبَ', 'يَكْتُبُ', 'دَفْتَرِهِ'],
    articulatoryTip: {
      sound: 'المقطع الساكن',
      description: 'الحرف الساكن لا يُنطق وحده؛ اربطه دائماً بالحرف المتحرك قبله واقف عليه وقفة قصيرة (بَدْـ · رٌ).',
      mouthShape: 'open',
    },
    questions: [
      {
        question: 'مَاذَا حَمَلَ بَدْرٌ فِي كَفِّهِ؟',
        options: ['مِصْبَاحَهُ', 'كِتَابَهُ', 'طَعَامَهُ'],
        answerIndex: 0,
      },
      {
        question: 'مَاذَا فَعَلَ بَدْرٌ عِنْدَ مَجْرَى النَّهْرِ؟',
        options: ['شَرِبَ مِنَ الْمَاءِ وَجَلَسَ يَكْتُبُ', 'سَبَحَ فِي الْمَاءِ', 'نَامَ تَحْتَ الشَّجَرَةِ'],
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

  try {
    const res = await fetch('/api/ai/generate-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interest, targetPhoneme, gradeLevel, studentName }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.story && data.title) {
        return {
          id: `ai-${Date.now()}`,
          title: data.title,
          story: data.story,
          targetPhoneme: data.targetPhoneme || targetPhoneme,
          interest,
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

  // Fallback to closest curated story
  const matched = CURATED_DECODABLE_STORIES.find(
    (s) => s.targetPhoneme === targetPhoneme || s.interest === interest
  );

  return matched || CURATED_DECODABLE_STORIES[0];
}
