/**
 * Arabic Literacy Studio: Continuous Literacy Growth Engine.
 *
 * Expands DE1 beyond initial dyslexia remediation into:
 * 1. مختبر الإملاء وبناء الكلمة (Spelling & Orthography Gym) - 4-step explicit instruction:
 *    [شرح القاعدة ➜ مثال محلول ➜ تدريب موجه على المقاطع ➜ تطبيق مستقل]
 * 2. مضمار الطلاقة والتنغيم القرائي (Expressive Fluency Studio) - calm phrase-cued reading,
 *    accuracy, prosody and age-differentiated metrics (never an arbitrary speed race).
 * 3. المكتبة العربية المتدرجة (Smart Leveled Arabic Story Library) - leveled decodable and
 *    developmental stories with reading comprehension, vocabulary, and guided read-aloud.
 */

export interface SpellingWorkedExample {
  targetWord: string;
  visualBreakdown: string[];
  explanationAr: string;
  audioTextAr: string;
  proofTipAr: string;
}

export interface SpellingGuidedPractice {
  id: string;
  promptAr: string;
  wordContextAr: string;
  options: { id: string; labelAr: string }[];
  correctId: string;
  hintAr: string;
  explanationAr: string;
}

export interface SpellingIndependentTask {
  id: string;
  promptAr: string;
  targetWord: string;
  scrambledSyllables: string[];
  distractorTiles?: string[];
  explanationAr: string;
}

export interface SpellingLesson {
  id: string;
  titleAr: string;
  categoryAr: string;
  gradeLevelMin: number;
  ruleSummaryAr: string;
  ruleAudioTextAr: string;
  workedExample: SpellingWorkedExample;
  guidedPractices: SpellingGuidedPractice[];
  independentTask: SpellingIndependentTask;
}

export interface FluencyPhrasedLine {
  textAr: string;
  pauseAfter: 'comma' | 'period' | 'question' | 'none';
  cueNotesAr?: string;
}

export interface FluencyPassageTrack {
  id: string;
  titleAr: string;
  gradeLevel: number;
  recommendedWcpmRange: [number, number];
  themeAr: string;
  synopsisAr: string;
  phrasedLines: FluencyPhrasedLine[];
  fullTextVowelled: string;
  prosodyGuidanceAr: string;
  punctuationTipsAr: string[];
}

export interface StoryComprehensionItem {
  id: string;
  type: 'literal' | 'inferential' | 'vocabulary' | 'theme';
  typeLabelAr: string;
  questionAr: string;
  options: string[];
  correctIndex: number;
  explanationAr: string;
}

export interface LeveledStoryPage {
  pageNumber: number;
  illustrationEmoji: string;
  linesAr: string[];
  vowelledTextAr: string;
}

export interface LeveledArabicStory {
  id: string;
  level: 1 | 2 | 3;
  levelLabelAr: string;
  targetGradeRange: string;
  titleAr: string;
  coverEmoji: string;
  coverBgClass: string;
  themeCategoryAr: string;
  phonicsFocusAr: string;
  wordCount: number;
  synopsisAr: string;
  pages: LeveledStoryPage[];
  vocabularySpotlight: { wordAr: string; meaningAr: string }[];
  comprehensionQuiz: StoryComprehensionItem[];
}

// ---------------------------------------------------------------------------
// 1. SPELLING & ORTHOGRAPHY GYM LESSONS (مختبر الإملاء وبناء الكلمة)
// ---------------------------------------------------------------------------
export const SPELLING_LESSONS: SpellingLesson[] = [
  {
    id: 'ta_marbuta_open',
    titleAr: 'التاء المربوطة والتاء المفتوحة (ـة / ة أو ت)',
    categoryAr: 'النهايات الإملائية',
    gradeLevelMin: 1,
    ruleSummaryAr:
      'قاعدة الوقف الذهبية: انطق الكلمة وسكّن آخرها بالسكون (ْ). إذا نُطقت هاءً خفيفة فهي تاء مربوطة (ـة / ة)، وإذا بقيت تاءً واضحة صريحة فهي تاء مفتوحة (ت).',
    ruleAudioTextAr:
      'قَاعِدَةُ الْوَقْفِ: انْطِقِ الْكَلِمَةَ بِالسُّكُونِ عِنْدَ الْوَقْفِ. إِذَا سَمِعْتَ هَاءً فَهِيَ تَاءٌ مَرْبُوطَة، مِثْلَ: شَجَرَةْ، شَجَرَةٌ. وَإِذَا سَمِعْتَ تَاءً بَقِيَتْ تَاءً، فَهِيَ تَاءٌ مَفْتُوحَة، مِثْلَ: بَيْتْ، بَيْتٌ.',
    workedExample: {
      targetWord: 'شَجَرَة',
      visualBreakdown: ['شَـ', 'ـجَـ', 'ـرَ', 'ـة'],
      explanationAr:
        'نقف عليها فنقول «شَجَرَهْ» (هاء)، وعند الوصل بالضمة نقول «شَجَرَةٌ مُثْمِرَةٌ» (تاء)، إذن تُكتب تاءً مربوطة بنقطتين.',
      audioTextAr:
        'مِثَالٌ مَحْلُول: كَلِمَةُ شَجَرَة. عِنْدَ الْوَقْفِ نَقُولُ: شَجَرَهْ، نَسْمَعُ هَاءً. وَعِنْدَ الْحَرَكَةِ نَقُولُ: شَجَرَةٌ. لِذَلِكَ كَتَبْنَاهَا تَاءً مَرْبُوطَةً.',
      proofTipAr: 'جرّب دائماً نطق الكلمة ساكنة: حَدِيقَةْ ➜ حَدِيقَةٌ | بِنْتْ ➜ بِنْتٌ.',
    },
    guidedPractices: [
      {
        id: 'gm-ta-1',
        promptAr: 'اختر النهاية الصحيحة لكلمة: «لُعْبَـ...» عند الحديث عن دُمية الطفل:',
        wordContextAr: 'اشْتَرَى أَحْمَدُ لُعْبَـ... جَمِيلَةً.',
        options: [
          { id: 'ta_marbuta', labelAr: 'ـة (تاء مربوطة)' },
          { id: 'ta_maftuha', labelAr: 'ـت (تاء مفتوحة)' },
          { id: 'ha', labelAr: 'ـه (هاء دون نقطتين)' },
        ],
        correctId: 'ta_marbuta',
        hintAr: 'سكّن الكلمة: هل تقول لُعْبَهْ أم لُعْبَتْ؟',
        explanationAr: 'عند الوقف نقول «لُعْبَهْ» بالهاء، إذن تكتب تاء مربوطة بنقطتين: «لُعْبَة».',
      },
      {
        id: 'gm-ta-2',
        promptAr: 'اختر الحرف الأخير لكلمة: «بَيْـ...» (المكان الذي نسكن فيه):',
        wordContextAr: 'رَجَعَ سَامِي إِلَى الْبَيْـ...',
        options: [
          { id: 'ta_maftuha', labelAr: 'ـت (تاء مفتوحة)' },
          { id: 'ta_marbuta', labelAr: 'ـة (تاء مربوطة)' },
        ],
        correctId: 'ta_maftuha',
        hintAr: 'سكّن آخر الكلمة: بَيْتْ... هل تغيّر صوت التاء إلى هاء؟',
        explanationAr: 'صوت التاء بقي ثابتاً عند الوقف: «بَيْتْ»، لذلك تُكتب تاءً مفتوحة مبسوطة: «بَيْت».',
      },
      {
        id: 'gm-ta-3',
        promptAr: 'ما الكتابة الصحيحة لكلمة «مَدْرَسَة»؟',
        wordContextAr: 'ذَهَبَتْ سَارَةُ إِلَى الـ...',
        options: [
          { id: 'correct', labelAr: 'مَدْرَسَة' },
          { id: 'error_open', labelAr: 'مَدْرَسَت' },
          { id: 'error_ha', labelAr: 'مَدْرَسَه (دون نقطتين)' },
        ],
        correctId: 'correct',
        hintAr: 'التاء المربوطة لا بد أن تعلوها نقطتان لتفرّقها عن الهاء.',
        explanationAr: 'تُنطق هاءً عند الوقف (مَدْرَسَهْ) وتاءً عند الحركة (مَدْرَسَةُ)، وتُوضع النقطتان دائماً.',
      },
    ],
    independentTask: {
      id: 'ind-ta-1',
      promptAr: 'رتّب المقاطع الصوتية لكتابة كلمة: «حَـ ـدِيـ ـقَـ ـة»:',
      targetWord: 'حَدِيقَة',
      scrambledSyllables: ['قَـ', 'حَـ', 'ـة', 'ـدِيـ'],
      distractorTiles: ['ـت'],
      explanationAr: 'تتكون الكلمة من: حَـ + ـدِيـ (مد ياء) + ـقَـ + ـة (تاء مربوطة لأننا نقف عليها حَدِيقَهْ).',
    },
  },
  {
    id: 'long_vowels',
    titleAr: 'حروف المد الثلاثة والتمييز بينها وبين الحركات القصيرة',
    categoryAr: 'الأصوات والمدود',
    gradeLevelMin: 1,
    ruleSummaryAr:
      'المد صوت طويل ممتد: الألف يحب الفتحة قبله (بَا)، والواو تحب الضمة قبلها (بُو)، والياء تحب الكسرة قبلها (بِي). الحركات القصيرة (َ ُ ِ) سريعة لا نمد الصوت فيها.',
    ruleAudioTextAr:
      'حُرُوفُ الْمَدِّ ثَلَاثَة: الْأَلِفُ مَفْتُوحٌ مَا قَبْلَهَا، وَالْوَاوُ مَضْمُومٌ مَا قَبْلَهَا، وَالْيَاءُ مَكْسُورٌ مَا قَبْلَهَا. لَا تَضَعْ حَرْفَ مَدٍّ إِلَّا إِذَا سَمِعْتَ صَوْتًا طَوِيلًا مَمْدُودًا.',
    workedExample: {
      targetWord: 'كِتَاب',
      visualBreakdown: ['كِـ', 'ـتَا', 'ب'],
      explanationAr:
        'في كلمة «كِتَاب» نمد حرف التاء بالفتحة الطويلة فنقول: «ـتَا»، بينما الكاف قصيرة «كِـ». لذلك كتبنا ألف المد بعد التاء.',
      audioTextAr:
        'مِثَال: كَلِمَةُ كِتَاب. نَقُولُ كِـ بِحَرَكَةٍ قَصِيرَة، ثُمَّ نَمُدُّ: تَـا. لِذَلِكَ نَكْتُبُ أَلِفَ الْمَدِّ بَعْدَ التَّاءِ.',
      proofTipAr: 'قارن بين «كَتَبَ» (كلها قصيرة) وبين «كَاتِب» (ألف مد بعد الكاف).',
    },
    guidedPractices: [
      {
        id: 'gm-vow-1',
        promptAr: 'استمع للكلمة: «نُـ...ـر» (صوت الضمة الطويلة)، أي حرف مد يناسبها؟',
        wordContextAr: 'أَشْرَقَ نُـ...ـرُ الصَّبَاحِ.',
        options: [
          { id: 'waw', labelAr: 'و (مد بالواو)' },
          { id: 'alif', labelAr: 'ا (مد بالألف)' },
          { id: 'yaa', labelAr: 'ي (مد بالياء)' },
        ],
        correctId: 'waw',
        hintAr: 'الحرف الذي يسبق المد مضموم «نُـ»، والضمة تناسبها الواو.',
        explanationAr: 'الضمة الممتدة على النون تنتج مدّ الواو: «نُور».',
      },
      {
        id: 'gm-vow-2',
        promptAr: 'أي الكلمتين كُتبت بالمد الطويل الصحيح لكلمة (طَبِيب)؟',
        wordContextAr: 'فَحَصَ الـ... مَرْيَمَ.',
        options: [
          { id: 'correct', labelAr: 'طَبِيب (مد ياء بعد الباء)' },
          { id: 'short', labelAr: 'طَبِب (دون مد)' },
        ],
        correctId: 'correct',
        hintAr: 'استمع: طَـ + بِيـ...ـب، صوت الكسرة ممتد وطويل.',
        explanationAr: 'كسرة الباء ممدودة بصوت الياء: «طَبِيب».',
      },
    ],
    independentTask: {
      id: 'ind-vow-1',
      promptAr: 'ركّب الكلمة التي تضم مد الألف: «بَـ + ـا + ب»:',
      targetWord: 'بَاب',
      scrambledSyllables: ['ب', 'ـا', 'بَـ'],
      explanationAr: 'الباء المفتوحة اتصلت بألف المد ثم تلتها الباء الأخيرة: «بَاب».',
    },
  },
  {
    id: 'sukun_syllable',
    titleAr: 'المقطع الساكن (الحرف الساكن لا يُنطق وحده)',
    categoryAr: 'المقاطع والتركيب',
    gradeLevelMin: 1,
    ruleSummaryAr:
      'الحرف الساكن (ْ) ضعيف وهادئ، لا يقفز في فمنا بمفرده! نقرؤه دائماً ممسوكاً مع الحرف المتحرك الذي يسبقه في دفعة صوتية واحدة: «مَكْـ + ـتَبْ = مَكْتَب».',
    ruleAudioTextAr:
      'الْمَقْطَعُ السَّاكِنُ: الْحَرْفُ السَّاكِنُ ضَعِيفٌ لَا يُنْطَقُ وَحْدَهُ، بَلْ نَنْطِقُهُ مَعَ الْحَرْفِ الْمُتَحَرِّكِ قَبْلَهُ فِي مَقْطَعٍ وَاحِدٍ، مِثْلَ: مَكْـ فِي كَلِمَةِ مَكْتَبَة.',
    workedExample: {
      targetWord: 'مَسْجِد',
      visualBreakdown: ['مَسْـ', 'ـجِـ', 'ـد'],
      explanationAr:
        'الميم والسين الساكنة يشكلان مقطعاً واحداً: «مَسْـ». لا نقول «مَـ... سَـ...» بل نجمع الصوت الساكن فوراً.',
      audioTextAr:
        'مِثَال: مَسْـ + جِد. نَقْرَأُ مَسْ دَفْعَةً وَاحِدَة، ثُمَّ جِد. السُّكُونُ يَجْمَعُ الْحَرْفَيْنِ مَعًا.',
      proofTipAr: 'قف على الحرف الساكن بهدوء دون زيادة حركة: «أَرْ... نَبْ = أَرْنَب».',
    },
    guidedPractices: [
      {
        id: 'gm-suk-1',
        promptAr: 'ما هو المقطع الساكن الأول في كلمة «مَطْبَخ»؟',
        wordContextAr: 'أَعَدَّتْ أُمِّي الْعَشَاءَ فِي الْمَطْبَخِ.',
        options: [
          { id: 'correct', labelAr: 'مَطْـ (ميم مفتوحة مع طاء ساكنة)' },
          { id: 'single', labelAr: 'مَـ (حرف الميم فقط)' },
          { id: 'wrong', labelAr: 'بَخْـ' },
        ],
        correctId: 'correct',
        hintAr: 'الطاء ساكنة «طْ»، فتُنطق مع الميم «مَطْـ».',
        explanationAr: 'المقطع الساكن يتكون من حرف متحرك يليه حرف ساكن: «مَطْـ».',
      },
    ],
    independentTask: {
      id: 'ind-suk-1',
      promptAr: 'رتّب مقاطع كلمة «مَصْـ ـنَـ ـع»:',
      targetWord: 'مَصْنَع',
      scrambledSyllables: ['ـنَـ', 'مَصْـ', 'ـع'],
      explanationAr: 'المقطع الساكن «مَصْـ» يليه النون «ـنَـ» ثم العين «ـع»: «مَصْنَع».',
    },
  },
  {
    id: 'tanween_noon',
    titleAr: 'التنوين والنون الساكنة (تنوين الفتح والضم والكسر)',
    categoryAr: 'النهايات الإملائية',
    gradeLevelMin: 2,
    ruleSummaryAr:
      'التنوين نون ننطقها بلساننا لكن لا نكتبها بأقلامنا! قاعدة الوقف للاختبار: احذف النون؛ إذا بقيت الكلمة ذات معنى فهي تنوين («كِتَابًا ➜ كِتَابْ»)، أما إذا اختل المعنى فهي نون أصلية («عَيْن ➜ عَيْـ؟»).',
    ruleAudioTextAr:
      'التَّنْوِينُ نُونٌ كَاذِبَة، نَسْمَعُهَا فِي اللِّسَانِ وَلَا نَكْتُبُهَا بِالْقَلَمِ. اخْتِبَارُ الْوَقْفِ: احْذِفِ النُّونَ عِنْدَ السُّكُونِ؛ إِذَا بَقِيَتِ الْكَلِمَةُ صَحِيحَةً فَهُوَ تَنْوِين، مِثْلَ: قَلَمًا، نَقُولُ قَلَمْ.',
    workedExample: {
      targetWord: 'قَلَمًا',
      visualBreakdown: ['قَـ', 'ـلَـ', 'ـمًـا'],
      explanationAr:
        'نسمع في النهاية «نُون»، لكن عند الوقف نقول «قَلَمْ» بالسكوت. الكلمة لم تتأثر بحذف النون، إذن هي تنوين فتح (ـًـا) وليست نوناً.',
      audioTextAr:
        'مِثَال: قَلَمًا. عِنْدَ الْوَقْفِ نَقُولُ قَلَمْ، زَالَتِ النُّونُ وَبَقِيَتِ الْكَلِمَةُ سَلِيمَة، إِذَنْ نَكْتُبُ تَنْوِينَ فَتْحٍ وَلَا نَكْتُبُ نُونًا.',
      proofTipAr: 'انتبه: نون «لِسَان» نون أصلية لا يمكن حذفها؛ أما نون «وَلَدٌ» فهي تنوين ضم.',
    },
    guidedPractices: [
      {
        id: 'gm-tan-1',
        promptAr: 'ما الكتابة الصحيحة لكلمة: «شُكْرًا»؟',
        wordContextAr: 'قَالَ سَامِي لِأَبِيهِ: ... لَكَ يَا أَبِي.',
        options: [
          { id: 'correct', labelAr: 'شُكْرًا (تنوين فتح مع ألف)' },
          { id: 'wrong_noon', labelAr: 'شُكْرَنْ (نون صريحة خطأ)' },
        ],
        correctId: 'correct',
        hintAr: 'احذف صوت النون: «شُكْرْ»... الكلمة لها معنى، إذن هو تنوين.',
        explanationAr: 'التنوين لا يُكتب نوناً مطلقاً؛ الصواب «شُكْرًا».',
      },
    ],
    independentTask: {
      id: 'ind-tan-1',
      promptAr: 'اختر المقطع الصحيح لتنوين كلمة «صَبَاحَـ...»:',
      targetWord: 'صَبَاحًا',
      scrambledSyllables: ['ـحًا', 'صَـ', 'ـبَا'],
      distractorTiles: ['ـحَنْ'],
      explanationAr: 'تنوين الفتح يُكتب فتحتين فوق الحرف وتتبعه ألف التنوين: «صَبَاحًا».',
    },
  },
  {
    id: 'solar_lunar',
    titleAr: 'اللام الشمسية واللام القمرية (الْـ أو الشَّـ)',
    categoryAr: 'السوابق الإملائية',
    gradeLevelMin: 2,
    ruleSummaryAr:
      'اللام القمرية نكتبها وننطقها واضحة مع السكون: «الْـقَمَر». أما اللام الشمسية فنكتبها ولكن لا ننطقها بلساننا، وندغمها في الحرف الذي يليها فيصبح مشدداً: «الشَّـمْس».',
    ruleAudioTextAr:
      'اللَّامُ الْقَمَرِيَّةُ تُكْتَبُ وَتُنْطَقُ وَعَلَيْهَا سُكُون: الْـقَمَر. وَاللَّامُ الشَّمْسِيَّةُ تُكْتَبُ وَلَا تُنْطَقُ، وَيَأْتِي بَعْدَهَا حَرْفٌ مُشَدَّد: الشَّـمْس.',
    workedExample: {
      targetWord: 'الشَّمْس',
      visualBreakdown: ['الـ', 'شَّـ', 'ـمْـ', 'ـس'],
      explanationAr:
        'نسمع بلساننا «أَشَّمْس»، لكن في الإملاء لا ننسى اللام الشمسية المكتوبة! نكتب «الـ» ثم نشدد الشين «الشَّمْس».',
      audioTextAr:
        'مِثَال: الشَّمْس. نَقُولُ أَشَّمْس كَأَنَّ اللَّامَ غَيْرُ مَوْجُودَة، لَكِنَّنَا يَجِبُ أَنْ نَكْتُبَهَا: أَلِفٌ وَلَامٌ تَلِيهَا شِينٌ مُشَدَّدَة.',
      proofTipAr: 'ضع حرف الواو قبل الكلمة لاختبار اللام: «وَالْقَمَر» (ظهرت اللام = قمرية) | «وَالشَّمْس» (قفزنا من الواو للشين = شمسية).',
    },
    guidedPractices: [
      {
        id: 'gm-sun-1',
        promptAr: 'عند نطق «الطَّائِرَة»، كيف نكتب أولها؟',
        wordContextAr: 'حَلَّقَتِ ... فِي السَّمَاءِ.',
        options: [
          { id: 'correct', labelAr: 'الطَّائِرَة (لام شمسية مكتوبة)' },
          { id: 'wrong_no_lam', labelAr: 'أَطَّائِرَة (دون لام - خطأ)' },
        ],
        correctId: 'correct',
        hintAr: 'اللام الشمسية تُكتب دائماً حتى لو لم ينطقها اللسان.',
        explanationAr: 'اللام الشمسية حرف مكتوب لا ننطقه، وبعده حرف الطاء مشدد: «الطَّائِرَة».',
      },
    ],
    independentTask: {
      id: 'ind-sun-1',
      promptAr: 'رتّب كلمة «الْـ ـقَـ ـمَـ ـر» (لام قمرية منطوقة):',
      targetWord: 'الْقَمَر',
      scrambledSyllables: ['ـمَـ', 'الْـ', 'ـر', 'ـقَـ'],
      explanationAr: 'اللام القمرية واضحة بسكونها: «الْقَمَر».',
    },
  },
  {
    id: 'common_hamza',
    titleAr: 'الهمزة في أول الكلمة (همزة القطع المألوفة)',
    categoryAr: 'الهمزات ورسم الحروف',
    gradeLevelMin: 2,
    ruleSummaryAr:
      'همزة القطع تظهر وتُنطق واضحة دائماً: فوق الألف بالفتحة (أَكَلَ) أو الضمة (أُسْرَة)، وتحت الألف بالكسرة (إِبْرِيق). اختبار الواو: «وَأَكَلَ» - تنطق الهمزة حتماً.',
    ruleAudioTextAr:
      'هَمْزَةُ الْقَطْعِ تَظْهَرُ رَأْسَ عَيْنٍ صَغِيرَةٍ فَوْقَ الْأَلِفِ مَعَ الْفَتْحَةِ وَالضَّمَّةِ، وَتَحْتَ الْأَلِفِ مَعَ الْكَسْرَةِ. نَنْطِقُهَا دَائِمًا بِوُضُوح.',
    workedExample: {
      targetWord: 'أَرْنَب',
      visualBreakdown: ['أَرْ', 'ـنَـ', 'ب'],
      explanationAr:
        'في كلمة «أَرْنَب» الهمزة مفتوحة في أول الكلمة، فتُكتب ألفاً تعلوها همزة: «أَ».',
      audioTextAr:
        'مِثَال: أَرْنَب. نَسْمَعُ صَوْتَ الْهَمْزَةِ مَفْتُوحًا فِي الْبِدَايَة: أَ... لِذَلِكَ نَكْتُبُ الْهَمْزَةَ فَوْقَ الْأَلِف.',
      proofTipAr: 'ضع الواو قبلها: «وَأَرْنَب»، الهمزة تقطع الصوت وتثبت مكانها.',
    },
    guidedPractices: [
      {
        id: 'gm-ham-1',
        promptAr: 'ما الكتابة الصحيحة لكلمة «إِبْرَة» (همزة مكسورة)؟',
        wordContextAr: 'اسْتَخْدَمَتِ الْخَيَّاطَةُ الـ...',
        options: [
          { id: 'correct', labelAr: 'إِبْرَة (همزة تحت الألف)' },
          { id: 'wrong_above', labelAr: 'أِبْرَة (همزة فوق الألف)' },
          { id: 'wrong_no_hamza', labelAr: 'ابرة (دون همزة)' },
        ],
        correctId: 'correct',
        hintAr: 'الكسرة تسحب الهمزة إلى أسفل الألف: «إِ».',
        explanationAr: 'مع الكسرة في أول الكلمة تكتب الهمزة تحت الألف دائماً: «إِبْرَة».',
      },
    ],
    independentTask: {
      id: 'ind-ham-1',
      promptAr: 'ركّب الكلمة: «أُسْـ + ـرَ + ة»:',
      targetWord: 'أُسْرَة',
      scrambledSyllables: ['ـرَ', 'ـة', 'أُسْـ'],
      explanationAr: 'همزة مضمومة مع سين ساكنة «أُسْـ» ثم راء وتاء مربوطة: «أُسْرَة».',
    },
  },
];

// ---------------------------------------------------------------------------
// 2. READING FLUENCY TRACK PASSAGES (مضمار الطلاقة والتنغيم القرائي الهادئ)
// ---------------------------------------------------------------------------
export const FLUENCY_PASSAGES: FluencyPassageTrack[] = [
  {
    id: 'fluency_g1_garden',
    titleAr: 'فِي حَدِيقَةِ الْأَزْهَارِ',
    gradeLevel: 1,
    recommendedWcpmRange: [30, 45],
    themeAr: 'الطبيعة والجمال',
    synopsisAr: 'نص هادئ ومريح للمبتدئين يركز على تجميع الكلمات في عبارات ثنائية وثلاثية.',
    phrasedLines: [
      { textAr: 'فِي حَدِيقَةِ بَيْتِنَا،', pauseAfter: 'comma', cueNotesAr: 'وقفة قصيرة عند الفاصلة' },
      { textAr: 'تَتَفَتَّحُ أَزْهَارٌ حَمْرَاءُ وَصَفْرَاءُ.', pauseAfter: 'period', cueNotesAr: 'وقفة تامة عند النقطة' },
      { textAr: 'جَاءَتْ فَرَاشَةٌ صَغِيرَةٌ،', pauseAfter: 'comma', cueNotesAr: 'نغمة لطيفة معتدلة' },
      { textAr: 'فَحَطَّتْ عَلَى الْوَرْدَةِ بِهُدُوءٍ.', pauseAfter: 'period', cueNotesAr: 'صوت هادئ ومستقر' },
      { textAr: 'قَالَ سَامِي مُبْتَسِمًا:', pauseAfter: 'comma', cueNotesAr: 'تمهيد لقول سار' },
      { textAr: 'مَا أَجْمَلَ هَذَا الصَّبَاحَ!', pauseAfter: 'period', cueNotesAr: 'نبرة تعجب وإعجاب لطيف' },
    ],
    fullTextVowelled:
      'فِي حَدِيقَةِ بَيْتِنَا، تَتَفَتَّحُ أَزْهَارٌ حَمْرَاءُ وَصَفْرَاءُ. جَاءَتْ فَرَاشَةٌ صَغِيرَةٌ، فَحَطَّتْ عَلَى الْوَرْدَةِ بِهُدُوءٍ. قَالَ سَامِي مُبْتَسِمًا: مَا أَجْمَلَ هَذَا الصَّبَاحَ!',
    prosodyGuidanceAr:
      'الهدف ليس سرعة الدقائق؛ الهدف هو قراءة الكلمات بحركاتها، والوقوف عند الفاصلة، والابتسام بنبرة صوتك عند علامة التعجب (!).',
    punctuationTipsAr: [
      'الفاصلة (،): نأخذ نَفَسًا سريعًا دون أن نتوقف طويلاً.',
      'النقطة (.): نقف وقفة تامة مطمئنة بنهاية المعنى.',
      'علامة التعجب (!): نرفع نبرة الصوت قليلاً لنُظهر الفرح والإعجاب.',
    ],
  },
  {
    id: 'fluency_g2_cloud',
    titleAr: 'رِحْلَةُ الْغَيْمَةِ الْمُغَامِرَةِ',
    gradeLevel: 2,
    recommendedWcpmRange: [50, 65],
    themeAr: 'المغامرة والاكتشاف',
    synopsisAr: 'نص متصل يعزز القراءة الانسيابية وحكاية الأحداث بتسلسل ممتع.',
    phrasedLines: [
      { textAr: 'عَاشَتْ غَيْمَةٌ بَيْضَاءُ فِي السَّمَاءِ الْعَالِيَةِ،', pauseAfter: 'comma', cueNotesAr: 'وصل العبارة دون تقطيع' },
      { textAr: 'وَكَانَتْ تُحِبُّ التَّجْوَالَ فَوْقَ الْجِبَالِ.', pauseAfter: 'period', cueNotesAr: 'وقفة تامة' },
      { textAr: 'نَظَرَتْ إِلَى الْأَرْضِ ذَاتَ يَوْمٍ،', pauseAfter: 'comma', cueNotesAr: 'تشويق في النبرة' },
      { textAr: 'فَرَأَتْ شَجَرَةً صَغِيرَةً تَعْطَشُ.', pauseAfter: 'period', cueNotesAr: 'تعاطف وهدوء' },
      { textAr: 'هَبَّتِ الرِّيحُ اللَّطِيفَةُ،', pauseAfter: 'comma', cueNotesAr: 'حركة وانتقال' },
      { textAr: 'فَهَطَلَتِ الْغَيْمَةُ مَطَرًا نَقِيًّا،', pauseAfter: 'comma', cueNotesAr: 'فرح بالخير' },
      { textAr: 'فَفَرِحَتِ الشَّجَرَةُ وَشَكَرَتْهَا بِأَوْرَاقِهَا الْخَضْرَاءِ.', pauseAfter: 'period', cueNotesAr: 'ختام دافئ' },
    ],
    fullTextVowelled:
      'عَاشَتْ غَيْمَةٌ بَيْضَاءُ فِي السَّمَاءِ الْعَالِيَةِ، وَكَانَتْ تُحِبُّ التَّجْوَالَ فَوْقَ الْجِبَالِ. نَظَرَتْ إِلَى الْأَرْضِ ذَاتَ يَوْمٍ، فَرَأَتْ شَجَرَةً صَغِيرَةً تَعْطَشُ. هَبَّتِ الرِّيحُ اللَّطِيفَةُ، فَهَطَلَتِ الْغَيْمَةُ مَطَرًا نَقِيًّا، فَفَرِحَتِ الشَّجَرَةُ وَشَكَرَتْهَا بِأَوْرَاقِهَا الْخَضْرَاءِ.',
    prosodyGuidanceAr:
      'اقرأ كأنك تحكي قصة ممتعة لأخيك الصغير. قسّم الجملة الطويلة إلى وحدات معنوية دون تقطيع الحروف.',
    punctuationTipsAr: [
      'حرف العطف (فـ / و): نصِل الصوت بلطف بما قبله دون توقف مفاجئ.',
      'التعبير عن العاطفة: صوّت العطش بهدوء، ثم أبهج صوتك عند هطول المطر.',
    ],
  },
  {
    id: 'fluency_g3_library_mystery',
    titleAr: 'سِرُّ الصُّنْدُوقِ الْقَدِيمِ',
    gradeLevel: 3,
    recommendedWcpmRange: [70, 85],
    themeAr: 'الذكاء والفضول العلمي',
    synopsisAr: 'نص حواري يجمع بين التساؤل والاستنتاج ونغمات القراءة التعبيرية المتنوعة.',
    phrasedLines: [
      { textAr: 'فَتَحَ طَارِقٌ خِزَانَةَ جَدِّهِ الْخَشَبِيَّةَ،', pauseAfter: 'comma', cueNotesAr: 'ترقب وتأنٍّ' },
      { textAr: 'فَوَجَدَ صُنْدُوقًا صَغِيرًا مَنْقُوشًا بِالْفِضَّةِ.', pauseAfter: 'period', cueNotesAr: 'نهاية الفكرة' },
      { textAr: 'سَأَلَ نَفْسَهُ بِدَهْشَةٍ:', pauseAfter: 'comma', cueNotesAr: 'تهيئة للسؤال' },
      { textAr: 'يَا تُرَى، مَاذَا يُخَبِّئُ هَذَا الصُّنْدُوقُ؟', pauseAfter: 'question', cueNotesAr: 'نبرة تساؤل واضحة (؟)' },
      { textAr: 'حِينَ رَفَعَ الْغِطَاءَ بِحَذَرٍ،', pauseAfter: 'comma', cueNotesAr: 'بطء معبر' },
      { textAr: 'لَمْ يَجِدْ ذَهَبًا وَلَا فِضَّةً،', pauseAfter: 'comma', cueNotesAr: 'نفي هادئ' },
      { textAr: 'بَلْ وَجَدَ كِتَابًا عَرَبِيًّا قَدِيمًا فِيهِ خَرَائِطُ وَحِكَايَاتٌ.', pauseAfter: 'period', cueNotesAr: 'نبرة فخر واكتشاف' },
    ],
    fullTextVowelled:
      'فَتَحَ طَارِقٌ خِزَانَةَ جَدِّهِ الْخَشَبِيَّةَ، فَوَجَدَ صُنْدُوقًا صَغِيرًا مَنْقُوشًا بِالْفِضَّةِ. سَأَلَ نَفْسَهُ بِدَهْشَةٍ: يَا تُرَى، مَاذَا يُخَبِّئُ هَذَا الصُّنْدُوقُ؟ حِينَ رَفَعَ الْغِطَاءَ بِحَذَرٍ، لَمْ يَجِدْ ذَهَبًا وَلَا فِضَّةً، بَلْ وَجَدَ كِتَابًا عَرَبِيًّا قَدِيمًا فِيهِ خَرَائِطُ وَحِكَايَاتٌ.',
    prosodyGuidanceAr:
      'أظهر علامة الاستفهام بصوتك: اجعل نبرة السؤال ترتفع في النهاية لتشعر المستمع بفضول طارق.',
    punctuationTipsAr: [
      'النقطتان الرأسيتان (:): وقفة وجيزة جداً لانتظار الكلام المنقول.',
      'علامة الاستفهام (؟): تغيير نبرة الصوت إلى نغمة تساؤل حقيقية.',
    ],
  },
];

// ---------------------------------------------------------------------------
// 3. SMART LEVELED ARABIC STORYBOOK LIBRARY (المكتبة العربية المتدرجة)
// ---------------------------------------------------------------------------
export const LEVELED_STORIES: LeveledArabicStory[] = [
  {
    id: 'story_l1_cat_market',
    level: 1,
    levelLabelAr: 'المستوى ١ · بذور القراءة',
    targetGradeRange: 'الروضة والصف الأول',
    titleAr: 'سَامِي وَالْقِطَّةُ الْبَيْضَاءُ',
    coverEmoji: '🐱',
    coverBgClass: 'from-amber-400 to-orange-500',
    themeCategoryAr: 'الرفق بالحيوان',
    phonicsFocusAr: 'حركات قصيرة، مد الألف، والتاء المربوطة',
    wordCount: 42,
    synopsisAr: 'قصة لطيفة وبسيطة يقرأها الطفل في بدايات تعلمه، بكلمات واضحة وتشكيل كامل.',
    pages: [
      {
        pageNumber: 1,
        illustrationEmoji: '🏡',
        linesAr: ['فِي يَوْمٍ مُشْرِقٍ،', 'خَرَجَ سَامِي إِلَى حَدِيقَةِ الْبَيْتِ.', 'رَأَى قِطَّةً صَغِيرَةً بَيْضَاءَ.'],
        vowelledTextAr: 'فِي يَوْمٍ مُشْرِقٍ، خَرَجَ سَامِي إِلَى حَدِيقَةِ الْبَيْتِ. رَأَى قِطَّةً صَغِيرَةً بَيْضَاءَ.',
      },
      {
        pageNumber: 2,
        illustrationEmoji: '🥛',
        linesAr: ['كَانَتِ الْقِطَّةُ جَائِعَةً تَمُوءُ.', 'أَحْضَرَ سَامِي إِنَاءَ حَلِيبٍ دَافِئٍ،', 'وَوَضَعَهُ عَلَى الْعُشْبِ.'],
        vowelledTextAr: 'كَانَتِ الْقِطَّةُ جَائِعَةً تَمُوءُ. أَحْضَرَ سَامِي إِنَاءَ حَلِيبٍ دَافِئٍ، وَوَضَعَهُ عَلَى الْعُشْبِ.',
      },
      {
        pageNumber: 3,
        illustrationEmoji: '❤️',
        linesAr: ['شَرِبَتِ الْقِطَّةُ كُلَّ الْحَلِيبِ.', 'مَسَحَتْ رَأْسَهَا بِيَدِ سَامِي،', 'فَفَرِحَ سَامِي بِصَدِيقَتِهِ الْجَدِيدَةِ.'],
        vowelledTextAr: 'شَرِبَتِ الْقِطَّةُ كُلَّ الْحَلِيبِ. مَسَحَتْ رَأْسَهَا بِيَدِ سَامِي، فَفَرِحَ سَامِي بِصَدِيقَتِهِ الْجَدِيدَةِ.',
      },
    ],
    vocabularySpotlight: [
      { wordAr: 'إِنَاء', meaningAr: 'وِعَاءٌ نَضَعُ فِيهِ الطَّعَامَ أَوِ الشَّرَابَ.' },
      { wordAr: 'تَمُوءُ', meaningAr: 'تُصْدِرُ صَوْتَ الْقِطَّةِ (مِيَاو).' },
    ],
    comprehensionQuiz: [
      {
        id: 'c-cat-1',
        type: 'literal',
        typeLabelAr: 'استرجاع مباشر',
        questionAr: 'مَاذَا قَدَّمَ سَامِي لِلْقِطَّةِ الْجَائِعَةِ؟',
        options: ['إِنَاءَ مَاءٍ بَارِدٍ', 'إِنَاءَ حَلِيبٍ دَافِئٍ', 'قِطْعَةَ خُبْزٍ'],
        correctIndex: 1,
        explanationAr: 'صحيح؛ ورد في النص أن سامي أحضر إناء حليب دافئ.',
      },
      {
        id: 'c-cat-2',
        type: 'inferential',
        typeLabelAr: 'استنتاج السبب والنتيجة',
        questionAr: 'لِمَاذَا مَسَحَتِ الْقِطَّةُ رَأْسَهَا بِيَدِ سَامِي؟',
        options: ['لِتَشْكُرَهُ وَتُعَبِّرَ عَنْ مَحَبَّتِهَا', 'لِأَنَّهَا خَائِفَةٌ مِنْهُ', 'لِتَهْرُبَ بَعِيدًا'],
        correctIndex: 0,
        explanationAr: 'مسح القط برأسه دليل الود والاطمئنان والشكر بعد أن شبعت.',
      },
      {
        id: 'c-cat-3',
        type: 'theme',
        typeLabelAr: 'الفكرة العامة',
        questionAr: 'مَا الدَّرْسُ الْجَمِيلُ الَّذِي نَتَعَلَّمُهُ مِنْ هَذِهِ الْقِصَّةِ؟',
        options: ['الرِّفْقُ بِالْحَيَوَانِ وَمُسَاعَدَةُ الضَّعِيفِ', 'اللَّعِبُ طَوَالَ الْيَوْمِ', 'النَّوْمُ فِي الْحَدِيقَةِ'],
        correctIndex: 0,
        explanationAr: 'العطف على الحيوانات وإطعامها خلق كريم يمنحنا السعادة.',
      },
    ],
  },
  {
    id: 'story_l2_brave_falcon',
    level: 2,
    levelLabelAr: 'المستوى ٢ · خطوات الطلاقة',
    targetGradeRange: 'الصف الثاني والصف الثالث',
    titleAr: 'سِبَاقُ الصَّقْرِ الشُّجَاعِ',
    coverEmoji: '🦅',
    coverBgClass: 'from-emerald-500 to-teal-700',
    themeCategoryAr: 'الشجاعة والتعاون',
    phonicsFocusAr: 'اللام الشمسية والقمرية، المقاطع الساكنة، وتمييز (س / ص)',
    wordCount: 78,
    synopsisAr: 'قصة مشوقة عن صقر صغير يتعلم الطيران والتعاون مع أصدقاء الوادي لإنقاذ عش الحمام.',
    pages: [
      {
        pageNumber: 1,
        illustrationEmoji: '🏔️',
        linesAr: [
          'فَوْقَ قِمَّةِ الْجَبَلِ الْعَالِي،',
          'عَاشَ صَقْرٌ صَغِيرٌ اسْمُهُ «صَخْرٌ».',
          'كَانَ يَخَافُ أَنْ يَفْرِدَ جَنَاحَيْهِ فِي الرِّيحِ الْقَوِيَّةِ.',
        ],
        vowelledTextAr:
          'فَوْقَ قِمَّةِ الْجَبَلِ الْعَالِي، عَاشَ صَقْرٌ صَغِيرٌ اسْمُهُ صَخْرٌ. كَانَ يَخَافُ أَنْ يَفْرِدَ جَنَاحَيْهِ فِي الرِّيحِ الْقَوِيَّةِ.',
      },
      {
        pageNumber: 2,
        illustrationEmoji: '💨',
        linesAr: [
          'قَالَتْ لَهُ أُمُّهُ بِحَنَانٍ:',
          '«ثِقْ بِنَفْسِكَ يَا بُنَيَّ، فَالرِّيحُ تَحْمِلُ مَنْ يَتَشَجَّعُ».',
          'تَنَفَّسَ صَخْرٌ عَمِيقًا، ثُمَّ قَفَزَ وَفَرَدَ جَنَاحَيْهِ.',
        ],
        vowelledTextAr:
          'قَالَتْ لَهُ أُمُّهُ بِحَنَانٍ: ثِقْ بِنَفْسِكَ يَا بُنَيَّ، فَالرِّيحُ تَحْمِلُ مَنْ يَتَشَجَّعُ. تَنَفَّسَ صَخْرٌ عَمِيقًا، ثُمَّ قَفَزَ وَفَرَدَ جَنَاحَيْهِ.',
      },
      {
        pageNumber: 3,
        illustrationEmoji: '🌈',
        linesAr: [
          'حَلَّقَ صَخْرٌ فِي الْفَضَاءِ الْوَاسِعِ كَالسَّهْمِ.',
          'شَاهَدَ مَنَاظِرَ الْأَوْدِيَةِ الْخَضْرَاءِ،',
          'وَعَرَفَ أَنَّ الشَّجَاعَةَ تَبْدَأُ بِخُطْوَةِ الْمُحَاوَلَةِ.',
        ],
        vowelledTextAr:
          'حَلَّقَ صَخْرٌ فِي الْفَضَاءِ الْوَاسِعِ كَالسَّهْمِ. شَاهَدَ مَنَاظِرَ الْأَوْدِيَةِ الْخَضْرَاءِ، وَعَرَفَ أَنَّ الشَّجَاعَةَ تَبْدَأُ بِخُطْوَةِ الْمُحَاوَلَةِ.',
      },
    ],
    vocabularySpotlight: [
      { wordAr: 'حَلَّقَ', meaningAr: 'طَارَ وَارْتَفَعَ فِي أَعَالِي السَّمَاءِ.' },
      { wordAr: 'الْأَوْدِيَة', meaningAr: 'الْأَرَاضِي الْمُنْخَفِضَةُ بَيْنَ الْجِبَالِ.' },
    ],
    comprehensionQuiz: [
      {
        id: 'c-falcon-1',
        type: 'literal',
        typeLabelAr: 'استرجاع مباشر',
        questionAr: 'أَيْنَ عَاشَ الصَّقْرُ صَخْرٌ؟',
        options: ['فِي أَعْمَاقِ الْبَحْرِ', 'فَوْقَ قِمَّةِ الْجَبَلِ الْعَالِي', 'فِي غَابَةٍ كَثِيفَةٍ'],
        correctIndex: 1,
        explanationAr: 'ورد في بداية القصة: فوق قمة الجبل العالي.',
      },
      {
        id: 'c-falcon-2',
        type: 'inferential',
        typeLabelAr: 'استنتاج المعنى',
        questionAr: 'كَيْفَ تَغَلَّبَ صَخْرٌ عَلَى خَوْفِهِ مِنَ الطَّيَرَانِ؟',
        options: ['اسْتَمَعَ لِنَصِيحَةِ أُمِّهِ وَقَرَّرَ التَّجْرِبَةَ', 'انْتَظَرَ أَنْ تَتَوَقَّفَ الرِّيحُ نِهَائِيًّا', 'تَرَكَ الْجَبَلَ وَمَشَى عَلَى الْأَرْضِ'],
        correctIndex: 0,
        explanationAr: 'شجعته نصيحة أمه فتنفس بعمق وقفز محاولاً بشجاعة.',
      },
    ],
  },
  {
    id: 'story_l3_village_library',
    level: 3,
    levelLabelAr: 'المستوى ٣ · أفق القراءة المستقلة',
    targetGradeRange: 'الصف الثالث وما بعده',
    titleAr: 'مَكْتَبَةُ الْقَرْيَةِ وَصَانِعُ الْوَرَقِ',
    coverEmoji: '📜',
    coverBgClass: 'from-blue-600 to-indigo-800',
    themeCategoryAr: 'حب المعرفة والتراث',
    phonicsFocusAr: 'نصوص مركبة، مشتقات الجذور، وفهم استنتاجي عميق',
    wordCount: 110,
    synopsisAr: 'رحلة استكشافية للأطفال في مكتبة القرية التراثية للتعرف على صناعة الكتب وحب القراءة.',
    pages: [
      {
        pageNumber: 1,
        illustrationEmoji: '🏛️',
        linesAr: [
          'فِي طَرَفِ الْقَرْيَةِ الْهَادِئَةِ،',
          'كَانَتْ هُنَاكَ مَكْتَبَةٌ صَغِيرَةٌ رَائِحَتُهَا كَالْوَرْدِ وَالْوَرَقِ الْقَدِيمِ.',
          'زَارَهَا زِيَادٌ وَأُخْتُهُ نُورُ لِلْبَحْثِ عَنْ كِتَابٍ عَنِ النُّجُومِ.',
        ],
        vowelledTextAr:
          'فِي طَرَفِ الْقَرْيَةِ الْهَادِئَةِ، كَانَتْ هُنَاكَ مَكْتَبَةٌ صَغِيرَةٌ رَائِحَتُهَا كَالْوَرْدِ وَالْوَرَقِ الْقَدِيمِ. زَارَهَا زِيَادٌ وَأُخْتُهُ نُورُ لِلْبَحْثِ عَنْ كِتَابٍ عَنِ النُّجُومِ.',
      },
      {
        pageNumber: 2,
        illustrationEmoji: '👴',
        linesAr: [
          'اسْتَقْبَلَهُمَا الْعَمُّ حَسَنٌ، صَانِعُ الْكُتُبِ وَحَارِسُ الْمَكْتَبَةِ.',
          'ابْتَسَمَ وَقَالَ: «أَهْلًا بِعُلَمَاءِ الْغَدِ، الْكُتُبُ أَجْنِحَةٌ تَحْمِلُ عُقُولَنَا نَحْوَ الْعَالَمِ».',
          'ثُمَّ أَرَاهُمَا كَيْفَ تُجْمَعُ الصَّفَحَاتُ وَتُخَاطُ بِخُيُوطٍ حَرِيرِيَّةٍ قَوِيَّةٍ.',
        ],
        vowelledTextAr:
          'اسْتَقْبَلَهُمَا الْعَمُّ حَسَنٌ، صَانِعُ الْكُتُبِ وَحَارِسُ الْمَكْتَبَةِ. ابْتَسَمَ وَقَالَ: أَهْلًا بِعُلَمَاءِ الْغَدِ، الْكُتُبُ أَجْنِحَةٌ تَحْمِلُ عُقُولَنَا نَحْوَ الْعَالَمِ. ثُمَّ أَرَاهُمَا كَيْفَ تُجْمَعُ الصَّفَحَاتُ وَتُخَاطُ بِخُيُوطٍ حَرِيرِيَّةٍ قَوِيَّةٍ.',
      },
      {
        pageNumber: 3,
        illustrationEmoji: '🌟',
        linesAr: [
          'جَلَسَ زِيَادٌ وَنُورُ يَقْرَآنِ عَنِ الْمَجَرَّاتِ وَالْكَوَاكِبِ.',
          'عِنْدَ الْغُرُوبِ، عَاهَدَا الْعَمَّ حَسَنًا أَنْ يَزُورَا الْمَكْتَبَةَ كُلَّ أُسْبُوعٍ،',
          'لِأَنَّ مَنْ يَقْرَأُ الْيَوْمَ يَبْنِي مُسْتَقْبَلَ الْغَدِ.',
        ],
        vowelledTextAr:
          'جَلَسَ زِيَادٌ وَنُورُ يَقْرَآنِ عَنِ الْمَجَرَّاتِ وَالْكَوَاكِبِ. عِنْدَ الْغُرُوبِ، عَاهَدَا الْعَمَّ حَسَنًا أَنْ يَزُورَا الْمَكْتَبَةَ كُلَّ أُسْبُوعٍ، لِأَنَّ مَنْ يَقْرَأُ الْيَوْمَ يَبْنِي مُسْتَقْبَلَ الْغَدِ.',
      },
    ],
    vocabularySpotlight: [
      { wordAr: 'عَاهَدَا', meaningAr: 'وَعَدَا وَالْتَزَمَا بِصِدْقٍ.' },
      { wordAr: 'الْمَجَرَّات', meaningAr: 'تَجَمُّعَاتٌ هَائِلَةٌ لِمَلَايِينِ النُّجُومِ فِي الْفَضَاءِ.' },
    ],
    comprehensionQuiz: [
      {
        id: 'c-lib-1',
        type: 'literal',
        typeLabelAr: 'استرجاع مباشر',
        questionAr: 'عَمَّ كَانَ يَبْحَثُ زِيَادٌ وَنُورُ فِي الْمَكْتَبَةِ؟',
        options: ['عَنْ كِتَابٍ عَنِ النُّجُومِ وَالْفَضَاءِ', 'عَنْ أَلْعَابٍ خَشَبِيَّةٍ', 'عَنْ صُوَرٍ لِلْحَيَوَانَاتِ'],
        correctIndex: 0,
        explanationAr: 'زارا المكتبة للبحث عن كتاب عن النجوم.',
      },
      {
        id: 'c-lib-2',
        type: 'inferential',
        typeLabelAr: 'استنتاج عميق',
        questionAr: 'مَاذَا قَصَدَ الْعَمُّ حَسَنٌ بِقَوْلِهِ: «الْكُتُبُ أَجْنِحَةٌ تَحْمِلُ عُقُولَنَا»؟',
        options: ['أَنَّ الْكُتُبَ تَطِيرُ فِعْلِيًّا', 'أَنَّ الْقِرَاءَةَ تُوَسِّعُ التَّفْكِيرَ وَتَنْقُلُنَا لِعَوَالِمِ الْمَعْرِفَةِ', 'أَنَّهَا خَفِيفَةُ الْوَزْنِ'],
        correctIndex: 1,
        explanationAr: 'هذا تعبير مجازي بليغ يبين أن القراءة تحلق بعقولنا وتكسبنا المعارف.',
      },
    ],
  },
];

// Helper lookup functions
export function getSpellingLesson(id: string): SpellingLesson | undefined {
  return SPELLING_LESSONS.find((lesson) => lesson.id === id);
}

export function getFluencyPassageById(id: string): FluencyPassageTrack | undefined {
  return FLUENCY_PASSAGES.find((passage) => passage.id === id);
}

export function getLeveledStoryById(id: string): LeveledArabicStory | undefined {
  return LEVELED_STORIES.find((story) => story.id === id);
}

export function getRecommendedFluencyPassage(gradeLevel: number): FluencyPassageTrack {
  const normalizedGrade = Math.max(1, Math.min(3, Math.round(gradeLevel || 1)));
  return FLUENCY_PASSAGES[normalizedGrade - 1] || FLUENCY_PASSAGES[0];
}

export function getRecommendedStoriesForGrade(gradeLevel: number): LeveledArabicStory[] {
  if (gradeLevel <= 1) {
    return LEVELED_STORIES.filter((s) => s.level <= 2);
  }
  return LEVELED_STORIES;
}
