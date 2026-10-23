/**
 * Baseera: reusable Arabic literacy and number-sense practice activities.
 * This prototype does not implement or claim a validated screening or treatment protocol.
 */

export interface RemediationPhonicsOption {
  letter: string;
  letterName: string;
  isCorrect: boolean;
  explanation: string;
}

export interface RemediationPhonicsDrill {
  id: number;
  family: string;
  spokenWord: string;
  wordMeaning: string;
  targetLetter: string;
  options: RemediationPhonicsOption[];
  ruleTip: string;
}

export interface RemediationSyllableDrill {
  id: number;
  targetWord: string;
  wordMeaning: string;
  syllables: string[];
}

export interface RemediationPacerPassage {
  id: number;
  title: string;
  gradeLevel: string;
  words: string[];
}

export interface RemediationMathDrill {
  id: number;
  targetNumber: number;
  min: number;
  max: number;
  prompt: string;
}

export interface RemediationSessionPlan {
  clinicalRationale: string;
  phonicsDrills: RemediationPhonicsDrill[];
  syllableDrills: RemediationSyllableDrill[];
  pacerPassage: RemediationPacerPassage;
  mathDrills: RemediationMathDrill[];
}

/**
 * Deterministic fallback for general educational practice.
 * It does not infer a learning difficulty or claim that errors were observed unless targets were teacher-reviewed.
 */
export function generateAdaptiveRemediationPlan(params: {
  studentName: string;
  gradeLevel: number;
  effectiveWords: string[];
  targetsTeacherReviewed?: boolean;
}): RemediationSessionPlan {
  const { gradeLevel, effectiveWords, targetsTeacherReviewed = false } = params;
  // These are fixed examples whose target letters match the actual word; arbitrary
  // student targets must never be substituted into a phonics item for another letter.

  // 1. Phonics Drills targeting student's actual words
  const phonicsDrills: RemediationPhonicsDrill[] = [
    {
      id: 1,
      family: 'عائلة السين والصاد (الترقيق والتفخيم)',
      spokenWord: 'سَاقِيَة',
      wordMeaning: 'مثال تدريبي على صوت السين والتمييز بينها وبين الصاد',
      targetLetter: 'س',
      options: [
        {
          letter: 'سـ',
          letterName: 'سين (مرققة)',
          isCorrect: true,
          explanation: 'أحسنت! صوت السين هنا مرقق خفيف يخرج بصفير ناعم.',
        },
        {
          letter: 'صـ',
          letterName: 'صاد (مفخمة)',
          isCorrect: false,
          explanation: 'الصاد حرف مفخم يمتلئ به الفم، بينما الكلمة تبدأ بسين مرققة.',
        },
      ],
      ruleTip: 'فرّق بصفير لسانك: السين (س) خفيفة ومرققة، والصاد (ص) مفخمة وممتلئة.',
    },
    {
      id: 2,
      family: 'عائلة الباء والتاء والثاء (الإعجام والتنقيط)',
      spokenWord: 'بُسْتَان',
      wordMeaning: 'حديقة غناء تحوي الأشجار والأزهار',
      targetLetter: 'ب',
      options: [
        {
          letter: 'بـ',
          letterName: 'باء',
          isCorrect: true,
          explanation: 'ممتاز! الباء تحمل نقطة واحدة بالأسفل مثل طبق تحته تمرة.',
        },
        {
          letter: 'تـ',
          letterName: 'تاء',
          isCorrect: false,
          explanation: 'التاء نقطتان في الأعلى، بينما الكلمة تبدأ بباء نقطتها بالأسفل.',
        },
        {
          letter: 'ثـ',
          letterName: 'ثاء',
          isCorrect: false,
          explanation: 'الثاء ثلاث نقاط، انتبه لعدد النقاط.',
        },
      ],
      ruleTip: 'الباء نقطتها بالأسفل، والتاء نقطتان بالأعلى، والثاء ثلاث نقاط كالمثلث.',
    },
    {
      id: 3,
      family: 'عائلة الجيم والحاء والخاء (موضع النقطة)',
      spokenWord: 'خُبْز',
      wordMeaning: 'غذاء يومي أساسي',
      targetLetter: 'خ',
      options: [
        {
          letter: 'جـ',
          letterName: 'جيم',
          isCorrect: false,
          explanation: 'الجيم نقطتها في بطنها بالأسفل، وليست فوق الرأس.',
        },
        {
          letter: 'حـ',
          letterName: 'حاء',
          isCorrect: false,
          explanation: 'الحاء ملساء تماماً وبلا أي نقاط.',
        },
        {
          letter: 'خـ',
          letterName: 'خاء',
          isCorrect: true,
          explanation: 'بطل! الخاء تحمل نقطة فوق رأسها كتاج متألق.',
        },
      ],
      ruleTip: 'الخاء فوقها نقطة كتاج، والجيم في بطنها نقطة، والحاء بلا نقاط.',
    },
    {
      id: 4,
      family: 'عائلة الدال والضاد',
      spokenWord: 'ضَوْء',
      wordMeaning: 'نور ساطع يضيء المكان',
      targetLetter: 'ض',
      options: [
        {
          letter: 'د',
          letterName: 'دال (مرققة)',
          isCorrect: false,
          explanation: 'الدال صوت خفيف ومرقق، والكلمة تبدأ بصوت مفخم.',
        },
        {
          letter: 'ضـ',
          letterName: 'ضاد (مفخمة)',
          isCorrect: true,
          explanation: 'رائع! صوت الضاد قوي ومفخم يمتلئ به الفم.',
        },
      ],
      ruleTip: 'الضاد (ض) حرف مفخم قوي، بينما الدال (د) صوت خفيف ورقيق.',
    },
  ];

  // 2. Syllables derived from student's target words
  const syllableDrills: RemediationSyllableDrill[] = [
    {
      id: 1,
      targetWord: 'سَاقِيَة',
      wordMeaning: 'قناة مائية تسقي الحقول والزروع',
      syllables: ['سَا', 'قِ', 'يَة'],
    },
    {
      id: 2,
      targetWord: 'بُسْتَان',
      wordMeaning: 'واحة الأشجار والأزهار',
      syllables: ['بُسْ', 'تَان'],
    },
    {
      id: 3,
      targetWord: 'مَدْرَسَة',
      wordMeaning: 'صرح التعليم والمعرفة',
      syllables: ['مَدْ', 'رَ', 'سَة'],
    },
    {
      id: 4,
      targetWord: 'عُصْفُور',
      wordMeaning: 'طائر صغير مغرد',
      syllables: ['عُصْ', 'فُور'],
    },
  ];

  // 3. A short general passage with adjustable word-highlighting (not eye-movement training).
  const pacerPassage: RemediationPacerPassage = {
    id: 1,
    title: 'قصة قصيرة للقراءة والتظليل',
    gradeLevel: `الصف ${gradeLevel}`,
    words: [
      'فِي',
      'صَبَاحِ',
      'يَوْمٍ',
      'مُشْرِقٍ،',
      'خَرَجَ',
      'عُمَرُ',
      'إِلَى',
      'الْبُسْتَانِ',
      'الْقَرِيبِ،',
      'حَيْثُ',
      'تَجْرِي',
      'مِيَاهُ',
      'السَّاقِيَةِ',
      'بِعُذُوبَةٍ',
      'وَصَفَاءٍ',
      'بَيْنَ',
      'الْأَشْجَارِ.',
    ],
  };

  // 4. Number line drills
  const mathDrills: RemediationMathDrill[] = [
    { id: 1, targetNumber: 42, min: 0, max: 100, prompt: 'قدّر موقع العدد ٤٢ (انتبه لعدم عكسه إلى ٢٤) من ٠ إلى ١٠٠:' },
    { id: 2, targetNumber: 73, min: 0, max: 100, prompt: 'قدّر موقع العدد ٧٣ (٧ عشرات و ٣ آحاد) من ٠ إلى ١٠٠:' },
    { id: 3, targetNumber: 28, min: 0, max: 100, prompt: 'قدّر موقع العدد ٢٨ على خط الأعداد من ٠ إلى ١٠٠:' },
    { id: 4, targetNumber: 135, min: 0, max: 200, prompt: 'قدّر موقع العدد ١٣٥ على خط الأعداد من ٠ إلى ٢٠٠:' },
  ];

  return {
    clinicalRationale: targetsTeacherReviewed && effectiveWords.length > 0
      ? `أنشطة تعليمية مقترحة للصف ${gradeLevel}. أُضيفت الكلمات التي راجعها المعلم إلى قائمة أهداف قابلة للمراجعة: ${effectiveWords.slice(0, 8).join('، ')}. هذا لا يثبت وجود اضطراب ولا يمثل بروتوكول علاج مُعتمدًا؛ ينبغي اختيار النشاط بحسب السياق ومراجعة المعلم.`
      : `أنشطة عامة للصف ${gradeLevel} للتدرب على الحروف والمقاطع وخط الأعداد. الكلمات الواردة أمثلة تعليمية وليست أخطاء مرصودة لدى هذا الطفل. هذه الخطة ليست اختبارًا معياريًا أو بروتوكول علاج مُعتمدًا.`,
    phonicsDrills,
    syllableDrills,
    pacerPassage,
    mathDrills,
  };
}
