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
  /** Legacy API field name; content is educational context, never a clinical rationale. */
  clinicalRationale: string;
  phonicsDrills: RemediationPhonicsDrill[];
  syllableDrills: RemediationSyllableDrill[];
  pacerPassage: RemediationPacerPassage;
  mathDrills: RemediationMathDrill[];
}

/**
 * Structural validation for model-generated learning activities. This checks consistency,
 * not educational efficacy; invalid or malformed output should fall back to curated examples.
 */
export function isStructurallyValidRemediationSessionPlan(value: unknown): value is RemediationSessionPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const plan = value as Record<string, unknown>;
  const normalize = (word: unknown): string =>
    typeof word === 'string'
      ? word.normalize('NFC').replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[\s·,،;؛.:!?؟\-]/g, '')
      : '';

  if (typeof plan.clinicalRationale !== 'string' || !plan.clinicalRationale.trim()) return false;
  if (!Array.isArray(plan.phonicsDrills) || plan.phonicsDrills.length !== 4) return false;
  for (const raw of plan.phonicsDrills) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const drill = raw as Record<string, unknown>;
    const target = normalize(drill.targetLetter);
    const spokenWord = normalize(drill.spokenWord);
    if (
      !Number.isInteger(drill.id) ||
      typeof drill.family !== 'string' ||
      typeof drill.wordMeaning !== 'string' ||
      !target ||
      !spokenWord.includes(target) ||
      typeof drill.ruleTip !== 'string' ||
      !Array.isArray(drill.options) || drill.options.length < 2 || drill.options.length > 3
    ) return false;
    const options = drill.options as unknown[];
    const correct = options.filter((option) =>
      !!option && typeof option === 'object' && !Array.isArray(option) &&
      (option as Record<string, unknown>).isCorrect === true
    ) as Record<string, unknown>[];
    if (correct.length !== 1 || normalize(correct[0].letter) !== target) return false;
    if (options.some((option) => {
      if (!option || typeof option !== 'object' || Array.isArray(option)) return true;
      const item = option as Record<string, unknown>;
      return typeof item.letter !== 'string' || typeof item.letterName !== 'string' ||
        typeof item.explanation !== 'string' || typeof item.isCorrect !== 'boolean';
    })) return false;
  }

  if (!Array.isArray(plan.syllableDrills) || plan.syllableDrills.length !== 4) return false;
  for (const raw of plan.syllableDrills) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const drill = raw as Record<string, unknown>;
    if (
      !Number.isInteger(drill.id) ||
      typeof drill.targetWord !== 'string' ||
      !drill.targetWord.trim() ||
      typeof drill.wordMeaning !== 'string' ||
      !Array.isArray(drill.syllables) || drill.syllables.length < 2 ||
      drill.syllables.some((part) => typeof part !== 'string' || !part.trim()) ||
      normalize((drill.syllables as string[]).join('')) !== normalize(drill.targetWord)
    ) return false;
  }

  if (!plan.pacerPassage || typeof plan.pacerPassage !== 'object' || Array.isArray(plan.pacerPassage)) return false;
  const passage = plan.pacerPassage as Record<string, unknown>;
  if (
    !Number.isInteger(passage.id) ||
    typeof passage.title !== 'string' || !passage.title.trim() ||
    typeof passage.gradeLevel !== 'string' ||
    !Array.isArray(passage.words) || passage.words.length < 16 || passage.words.length > 22 ||
    passage.words.some((word) => typeof word !== 'string' || !word.trim())
  ) return false;

  if (!Array.isArray(plan.mathDrills) || plan.mathDrills.length !== 4) return false;
  for (const raw of plan.mathDrills) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const drill = raw as Record<string, unknown>;
    if (
      !Number.isInteger(drill.id) ||
      !Number.isInteger(drill.targetNumber) ||
      !Number.isInteger(drill.min) || !Number.isInteger(drill.max) ||
      (drill.min as number) >= (drill.max as number) ||
      (drill.targetNumber as number) < (drill.min as number) ||
      (drill.targetNumber as number) > (drill.max as number) ||
      typeof drill.prompt !== 'string' || !drill.prompt.trim()
    ) return false;
  }
  return true;
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

  // 1. General phonics examples; do not infer that the student's own errors match these items.
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
