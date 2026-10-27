/**
 * Evidence-informed, Arabic-first instructional pathways.
 *
 * Important: routing cut-offs are provisional teaching heuristics for this prototype,
 * not age norms, diagnostic thresholds, or evidence of a learning disorder.
 */

export type CurriculumDomain = 'reading' | 'math';

export type CurriculumSkillId =
  | 'phonological-awareness'
  | 'letter-sound-mapping'
  | 'short-vowel-decoding'
  | 'syllable-blending'
  | 'long-vowels-and-morphemes'
  | 'connected-text'
  | 'reading-comprehension'
  | 'quantity-cardinality'
  | 'number-symbol-mapping'
  | 'magnitude-number-line'
  | 'place-value'
  | 'addition-subtraction'
  | 'multiplication-division'
  | 'math-word-problems'
  | 'fractions';

export interface CurriculumQuestion {
  id: string;
  prompt: string;
  stimulus?: string;
  options: string[];
  correctIndex: number;
  feedbackCorrect: string;
  scaffold: string;
  dotCount?: number;
  hideStimulus?: boolean;
}

export interface CurriculumLesson {
  id: CurriculumSkillId;
  domain: CurriculumDomain;
  stage: number;
  title: string;
  objective: string;
  model: string;
  guidedPractice: string;
  successGuidance: string;
  retryGuidance: string;
  questions: CurriculumQuestion[];
}

export interface CurriculumStudentEvidence {
  gradeLevel?: number;
  isDemoRecord?: boolean;
  sessionStatus?: 'in_progress' | 'completed';
  evidenceProvenance?: 'client-reported' | 'server-verified-audio' | 'demo-synthetic';
  aiAssessmentVerified?: boolean;
  oralAccuracyPercent?: number | null;
  problematicWords?: string[];
  comprehensionScore?: number;
  cognitiveResults?: {
    phonemicAwarenessScorePercent?: number;
    pseudoWordScorePercent?: number;
  } | null;
  dyscalculiaAssessed?: boolean;
  subitizingAccuracy?: number | null;
  numberLinePAE?: number | null;
  transcodingAccuracy?: number | null;
}

export interface CurriculumRecommendation {
  domain: CurriculumDomain;
  skillId: CurriculumSkillId;
  reasonAr: string;
  evidenceAr: string;
  isBaseline: boolean;
}

export const CURRICULUM_ROUTING_RULES = {
  phonologicalAwarenessReviewPercent: 80,
  decodingReviewPercent: 80,
  comprehensionReviewPercent: 70,
  oralAccuracyReviewPercent: 85,
  quantityReviewPercent: 80,
  numberSymbolReviewPercent: 80,
  numberLineErrorReviewPercent: 20,
  formativeItemsPerRound: 3,
  formativeMasteryItems: 3,
} as const;

const question = (
  id: string,
  prompt: string,
  options: string[],
  correctIndex: number,
  feedbackCorrect: string,
  scaffold: string,
  stimulus?: string,
  dotCount?: number,
  hideStimulus = false,
): CurriculumQuestion => ({
  id, prompt, options, correctIndex, feedbackCorrect, scaffold, stimulus, dotCount, hideStimulus,
});

const readingLessons: CurriculumLesson[] = [
  {
    id: 'phonological-awareness',
    domain: 'reading',
    stage: 1,
    title: 'أستمع إلى الأصوات داخل الكلمة',
    objective: 'تمييز الصوت الأول في كلمة مسموعة قبل التركيز على اسم الحرف.',
    model: 'قل الكلمة ببطء، واستمع إلى أول صوت فيها. نبحث عن الصوت الذي نسمعه أولًا، لا عن اسم الحرف.',
    guidedPractice: 'مثال مختلف: في «فَمٌ»، الصوت الأول /ف/. استمع إلى أول صوت ثم قله وحده.',
    successGuidance: 'أحسنت. انتقل إلى تدريب آخر على الأصوات، مع الاحتفاظ بالكلمات التي تحتاج مراجعة.',
    retryGuidance: 'استمع مرة أخرى، وقل الكلمة ببطء. ابدأ من الصوت الأول ثم اختر الحرف الذي يمثّله.',
    questions: [
      question('pa-1', 'ما الصوت الأول في الكلمة التي تسمعها؟', ['/م/', '/ز/', '/و/'], 0, 'صحيح؛ يبدأ لفظ «موز» بالصوت /م/.', 'استمع مرة أخرى إلى الكلمة؛ ركّز على الصوت الأول فقط.', 'مَوْزٌ', undefined, true),
      question('pa-2', 'ما الصوت الأول في الكلمة التي تسمعها؟', ['/ك/', '/س/', '/م/'], 1, 'صحيح؛ يبدأ لفظ «سمك» بالصوت /س/.', 'استمع إلى الكلمة من بدايتها، ولا تبدأ من آخرها.', 'سَمَكٌ', undefined, true),
      question('pa-3', 'ما الصوت الأول في الكلمة التي تسمعها؟', ['/و/', '/ر/', '/ن/'], 2, 'صحيح؛ يبدأ لفظ «نور» بالصوت /ن/.', 'استمع إلى المقطع الأول ثم اختر الصوت الذي تسمعه أولًا.', 'نُورٌ', undefined, true),
      question('pa-4', 'ما الصوت الأول في الكلمة التي تسمعها؟', ['/ش/', '/ن/', '/م/'], 0, 'صحيح؛ يبدأ لفظ «شمس» بالصوت /ش/.', 'اسمع الكلمة ببطء وركّز على أول صوت.', 'شَمْسٌ', undefined, true),
      question('pa-5', 'ما الصوت الأول في الكلمة التي تسمعها؟', ['/م/', '/ق/', '/ل/'], 1, 'صحيح؛ يبدأ لفظ «قلم» بالصوت /ق/.', 'استمع إلى بداية الكلمة لا إلى اسم آخر حرف.', 'قَلَمٌ', undefined, true),
    ],
  },
  {
    id: 'letter-sound-mapping',
    domain: 'reading',
    stage: 2,
    title: 'أربط صوت الحرف بشكله',
    objective: 'ربط الصوت بالحرف مع ملاحظة النقاط وشكل الحرف داخل الكلمة.',
    model: 'انظر إلى الحرف داخل الكلمة، ولا تعتمد على عدد النقاط وحده. قد يتغير شكل الحرف في أول الكلمة أو وسطها أو آخرها، مع بقاء هويته.',
    guidedPractice: 'مثال مختلف: حرف الباء في «بَحْرٌ» هو ب، ويتغير شكل الحرف بحسب موضعه في الكلمة.',
    successGuidance: 'جيد. واصل الربط بين الصوت والحرف في كلمات متنوعة، لا في بطاقة واحدة فقط.',
    retryGuidance: 'قارن موضع النقاط، ثم اقرأ الكلمة كاملة قبل أن تختار.',
    questions: [
      question('ls-1', 'أي حرف يبدأ به صوت «بَابٌ»؟', ['ت', 'ب', 'ث'], 1, 'صحيح؛ الكلمة تبدأ بحرف الباء.', 'قارن شكل الحروف الثلاثة وموضع نقاطها، ثم أعد قراءة الكلمة.', 'بَابٌ'),
      question('ls-2', 'أي حرف تسمعه في وسط «كَتَبَ»؟', ['ت', 'ك', 'ب'], 0, 'صحيح؛ الحرف الأوسط في «كَتَبَ» هو التاء.', 'انطق الكلمة على ثلاثة مقاطع صوتية: كَ ـ تَ ـ بَ.', 'كَتَبَ'),
      question('ls-3', 'أي حرف يبدأ به «ثَوْبٌ»؟', ['ب', 'ت', 'ث'], 2, 'صحيح؛ «ثوب» تبدأ بالثاء ذات النقاط الثلاث.', 'تذكّر الفرق بين باء وتاء وثاء، ثم استمع إلى الكلمة كاملة.', 'ثَوْبٌ'),
      question('ls-4', 'ما الحرف الذي تسمعه في وسط «قَمَرٌ»؟', ['ق', 'م', 'ر'], 1, 'صحيح؛ الحرف الأوسط في «قمر» هو الميم.', 'انطق الكلمة بهدوء: قَ ـ مَ ـ رٌ.', 'قَمَرٌ'),
      question('ls-5', 'أي حرف يمثّل الصوت الأول في «دَرَجٌ»؟', ['ذ', 'ر', 'د'], 2, 'صحيح؛ تبدأ «دَرَج» بالدال.', 'قارن موضع النقطة في ذال وشكل الدال قبل الإجابة.', 'دَرَجٌ'),
    ],
  },
  {
    id: 'short-vowel-decoding',
    domain: 'reading',
    stage: 3,
    title: 'أقرأ الحركات القصيرة',
    objective: 'التمييز بين الفتحة والضمة والكسرة ودمجها مع أصوات الحروف.',
    model: 'الحركة القصيرة تغيّر طريقة نطق الحرف: بَ، بُ، بِ. اقرأ الصوت مع الحرف ولا تسمِّ الحرف وحده.',
    guidedPractice: 'مثال مختلف: «شَرِبَ» تُقرأ بدمج المقاطع «شَ ـ رِ ـ بَ» بالترتيب.',
    successGuidance: 'جيد. جرّب كلمات جديدة بالتشكيل نفسه قبل تقليل الحركات تدريجيًا.',
    retryGuidance: 'ارجع إلى الحركات في المثال، واقرأ كل جزء بصوت واضح قبل دمج الأجزاء.',
    questions: [
      question('sv-1', 'أي كلمة تبدأ بالمقطع «كَ»؟', ['كِتَابٌ', 'كُرَةٌ', 'كَتَبَ'], 2, 'صحيح؛ «كَتَبَ» تبدأ بفتح الكاف.', 'لاحظ الحركة فوق الكاف في «كَتَبَ»، وتحت الكاف في «كِتاب».'),
      question('sv-2', 'أي كلمة تبدأ بصوت «بِ»؟', ['بَابٌ', 'بِئْرٌ', 'بُرْتُقَالٌ'], 1, 'صحيح؛ الكسرة تحت الباء في «بِئْر».', 'قارن حركة الباء في الكلمات الثلاث: فتحة، كسرة، ضمة.'),
      question('sv-3', 'أي كلمة تبدأ بالمقطع «عِ» ويليه حرف ساكن؟', ['عَلَمٌ', 'عِلْمٌ', 'عَالَمٌ'], 1, 'صحيح؛ «عِلْمٌ» تبدأ بالعين المكسورة يليها اللام الساكنة.', 'اقرأ حركة العين ثم انتبه إلى السكون على اللام.'),
      question('sv-4', 'أي كلمة تبدأ بالمقطع «تُ»؟', ['تُفَّاحٌ', 'تِمْسَاحٌ', 'تَمْرٌ'], 0, 'صحيح؛ الضمة على التاء في «تُفّاح».', 'قارن حركة التاء في أول الكلمات الثلاث.'),
      question('sv-5', 'ما الحركة على التاء في «كِتَابٌ»؟', ['فتحة', 'ضمة', 'كسرة'], 0, 'صحيح؛ التاء في «كِتَابٌ» مفتوحة: تَ.', 'اتبع الكلمة حرفًا حرفًا، ولا تخلط بين حركة الكاف وحركة التاء.', 'كِتَابٌ'),
    ],
  },
  {
    id: 'syllable-blending',
    domain: 'reading',
    stage: 4,
    title: 'أدمج المقاطع لتكوين كلمة',
    objective: 'دمج مقاطع مشكولة بالترتيب من اليمين إلى اليسار لتكوين كلمة مقروءة.',
    model: 'اقرأ كل مقطع، ثم اجمعها دون إضافة صوت أو حذف صوت. يجب أن يطابق ترتيب الأجزاء ترتيب الكلمة.',
    guidedPractice: 'مثال: كَ + تَ + بَ = كَتَبَ. اقرأها متصلة بعد إتقان المقاطع منفردة.',
    successGuidance: 'رائع. بعد دمج الكلمة، أعد قراءتها ضمن جملة قصيرة لفهم معناها.',
    retryGuidance: 'ضع المقاطع بالترتيب، وردّد كل مقطع ثم اجمعها. لا تستعجل.',
    questions: [
      question('sb-1', 'رَ + سَ + مَ تساوي:', ['رَسَمَ', 'رَسْمٌ', 'سَمَرَ'], 0, 'صحيح؛ جمع المقاطع الثلاثة بالترتيب ينتج «رَسَمَ».', 'ابدأ برَ، ثم سَ، ثم مَ؛ حافظ على الحركة وترتيب المقاطع.'),
      question('sb-2', 'سَ + مَ + كٌ تساوي:', ['سَمَكٌ', 'مَسَكٌ', 'سَمَاءٌ'], 0, 'صحيح؛ جمعت المقاطع بالترتيب دون حذف أو تبديل.', 'ابدأ بالمقطع سَ، ثم مَ، ثم كٌ.'),
      question('sb-3', 'لَ + عِ + بَ تساوي:', ['لَعِبَ', 'لَعَبَ', 'عَلِبَ'], 0, 'صحيح؛ الكسرة على العين باقية عند دمج المقاطع.', 'انتبه إلى حركة العين: عِ وليست عَ.'),
      question('sb-4', 'قَ + لَ + مٌ تساوي:', ['قَمَرٌ', 'قَلَمٌ', 'مَقْلَمَةٌ'], 1, 'صحيح؛ جمع المقاطع بالترتيب ينتج «قَلَمٌ».', 'رتّب المقاطع: قَ، ثم لَ، ثم مٌ.'),
      question('sb-5', 'شَ + جَ + رَ + ةٌ تساوي:', ['شَجَرَةٌ', 'شُجْرَةٌ', 'جَرَشَةٌ'], 0, 'صحيح؛ دمج الأجزاء بالترتيب ينتج «شَجَرَةٌ».', 'حافظ على ترتيب المقاطع وحركاتها قبل دمجها.'),
    ],
  },
  {
    id: 'long-vowels-and-morphemes',
    domain: 'reading',
    stage: 5,
    title: 'ألاحظ المدّ وأجزاء الكلمة',
    objective: 'تمييز بعض أنماط المدّ والحركات والتعرّف إلى أجزاء مشتركة في الكلمات.',
    model: 'المدّ يطيل الحركة المناسبة، وتساعد ملاحظة أجزاء الكلمة المتكررة على ربط الكلمات ببعضها. نعلّم كل نمط بأمثلة واضحة ثم نراجعه في نص.',
    guidedPractice: 'مثال: «كَتَبَ، كَاتِب، مَكْتُوب» تشترك في الجذر ك-ت-ب، مع اختلاف الوزن والمعنى.',
    successGuidance: 'أحسنت. انتقل بين كلمات من النمط نفسه وكلمات أخرى حتى لا تعتمد على حفظ مثال واحد.',
    retryGuidance: 'اعزل الجزء المستهدف في الكلمة، ثم أعد قراءتها كاملة وتحقق من الحركات.',
    questions: [
      question('lm-1', 'أي كلمة فيها مدّ بالألف؟', ['بِنْتٌ', 'بَابٌ', 'قَلَمٌ'], 1, 'صحيح؛ الألف بعد الباء تمدّ الصوت في «باب».', 'انظر إلى الألف بعد الفتحة في الكلمة، ولا تخلط بينها وبين الحركة القصيرة.'),
      question('lm-2', 'أي كلمة تشترك في الجذر «ك ت ب»؟', ['مَكْتُوبٌ', 'مَاءٌ', 'كَبِيرٌ'], 0, 'صحيح؛ «مكتوب» من عائلة كتب.', 'قارن الحروف الأصلية بالترتيب، ولا تعتمد على تشابه أول حرف فقط.'),
      question('lm-3', 'أي كلمة تبدأ بمقطع طويل «نُو»؟', ['نُورٌ', 'نَهْرٌ', 'نَمْلٌ'], 0, 'صحيح؛ الواو تمدّ الضمة في «نور».', 'انطق المقطع الأول في كل كلمة ثم قارن مدة الصوت.'),
      question('lm-4', 'أي كلمة فيها مدّ بالياء؟', ['تِينٌ', 'تَمْرٌ', 'تُرَابٌ'], 0, 'صحيح؛ الياء في «تِين» حرف مدّ بعد الكسرة.', 'لاحظ حركة التاء المكسورة وطول صوت الياء بعدها.'),
      question('lm-5', 'أي كلمة تنتمي إلى عائلة «د ر س»؟', ['مَدْرَسَةٌ', 'مَكْتَبَةٌ', 'مَلْعَبٌ'], 0, 'صحيح؛ «مدرسة» تشترك في الجذر د-ر-س.', 'قارن الحروف الأصلية وترتيبها: دال ثم راء ثم سين.'),
    ],
  },
  {
    id: 'connected-text',
    domain: 'reading',
    stage: 6,
    title: 'أقرأ نصًا قصيرًا بدقة ثم بطلاقة',
    objective: 'قراءة نص مناسب للمهارات المتعلمة، وإعادة قراءته مع إعطاء الأولوية للدقة والفهم.',
    model: 'اقرأ بهدوء مرة أولى لتصحيح الكلمات. أعد القراءة مرة ثانية بعد فهم الكلمات الصعبة. السرعة هدف يأتي بعد الدقة، وليست سباقًا.',
    guidedPractice: 'اقرأ النص: «زَارَتْ لَيْلَى الْمَكْتَبَةَ، فَاخْتَارَتْ كِتَابًا عَنِ الْبَحْرِ. قَرَأَتْ صَفَحَتَيْنِ، ثُمَّ حَكَتْ لِأُسْرَتِهَا مَا تَعَلَّمَتْهُ». أعد القراءة وتوقف عند الكلمات الصعبة.',
    successGuidance: 'أحسنت. حاول أن تقرأ النص مرة أخرى بدقة ثم لخّصه بكلماتك.',
    retryGuidance: 'قلل طول النص إلى جملة واحدة، وتأكد من قراءة الكلمات المشكولة قبل العودة إلى النص كاملًا.',
    questions: [
      question('ct-1', 'إلى أين ذهبت ليلى؟', ['إلى المكتبة', 'إلى السوق', 'إلى الحديقة'], 0, 'صحيح؛ ورد في النص أنها زارت المكتبة.', 'ارجع إلى الجملة الأولى وابحث عن المكان الذي زارته ليلى.', 'زَارَتْ لَيْلَى الْمَكْتَبَةَ، فَاخْتَارَتْ كِتَابًا عَنِ الْبَحْرِ. قَرَأَتْ صَفَحَتَيْنِ، ثُمَّ حَكَتْ لِأُسْرَتِهَا مَا تَعَلَّمَتْهُ.'),
      question('ct-2', 'عمّ كان الكتاب؟', ['عن الجبال', 'عن البحر', 'عن الفضاء'], 1, 'صحيح؛ اختارت كتابًا عن البحر.', 'أعد قراءة الجزء «كتابًا عن…»', 'زَارَتْ لَيْلَى الْمَكْتَبَةَ، فَاخْتَارَتْ كِتَابًا عَنِ الْبَحْرِ. قَرَأَتْ صَفَحَتَيْنِ، ثُمَّ حَكَتْ لِأُسْرَتِهَا مَا تَعَلَّمَتْهُ.'),
      question('ct-3', 'ماذا فعلت ليلى بعد القراءة؟', ['نامت', 'ذهبت إلى السوق', 'حكت لأسرتها ما تعلمته'], 2, 'صحيح؛ شرحت لأسرتها ما تعلمته.', 'ابحث عن الفعل الذي جاء بعد «ثمّ».', 'زَارَتْ لَيْلَى الْمَكْتَبَةَ، فَاخْتَارَتْ كِتَابًا عَنِ الْبَحْرِ. قَرَأَتْ صَفَحَتَيْنِ، ثُمَّ حَكَتْ لِأُسْرَتِهَا مَا تَعَلَّمَتْهُ.'),
      question('ct-4', 'كم صفحة قرأت ليلى؟', ['صفحتين', 'عشر صفحات', 'صفحة واحدة'], 0, 'صحيح؛ قرأت صفحتين.', 'ابحث في الجملة الثانية عن عدد الصفحات.', 'زَارَتْ لَيْلَى الْمَكْتَبَةَ، فَاخْتَارَتْ كِتَابًا عَنِ الْبَحْرِ. قَرَأَتْ صَفَحَتَيْنِ، ثُمَّ حَكَتْ لِأُسْرَتِهَا مَا تَعَلَّمَتْهُ.'),
      question('ct-5', 'ما الفائدة التي حققتها ليلى عندما حكت لأسرتها؟', ['شاركت ما تعلمته', 'أعادت الكتاب إلى المتجر', 'غيّرت موضوع الكتاب'], 0, 'صحيح؛ شاركت أسرتها ما تعلمته من القراءة.', 'اجمع بين فعل «حكت» وما جاء بعده في النص.', 'زَارَتْ لَيْلَى الْمَكْتَبَةَ، فَاخْتَارَتْ كِتَابًا عَنِ الْبَحْرِ. قَرَأَتْ صَفَحَتَيْنِ، ثُمَّ حَكَتْ لِأُسْرَتِهَا مَا تَعَلَّمَتْهُ.'),
    ],
  },
  {
    id: 'reading-comprehension',
    domain: 'reading',
    stage: 7,
    title: 'أفهم ما أقرأ وأشرح دليلي',
    objective: 'التدرب على استرجاع معلومة صريحة، وفهم كلمة في السياق، واستنتاج بسيط.',
    model: 'اقرأ السؤال، ثم ارجع إلى النص لتجد الدليل. في سؤال الاستنتاج، اجمع معلومتين من النص بدل تخمين الإجابة.',
    guidedPractice: 'نص قصير: «زرع سامر بذرة في أصيص، ووضعه قرب النافذة. كان يسقيها كل صباح. بعد أيام ظهرت ورقتان خضراوان».',
    successGuidance: 'جيد. حاول أن تشرح الدليل الذي قادك إلى الإجابة.',
    retryGuidance: 'أعد قراءة الجملة المتعلقة بالسؤال، ثم اختر الإجابة التي يدعمها النص لا مجرد إجابة ممكنة.',
    questions: [
      question('rc-1', 'أين وضع سامر الأصيص؟', ['قرب النافذة', 'تحت السرير', 'في الحقيبة'], 0, 'صحيح؛ النص يقول إنه وضعه قرب النافذة.', 'ابحث في الجملة الأولى عن المكان.', 'زَرَعَ سَامِرٌ بَذْرَةً فِي أُصَيْصٍ، وَوَضَعَهُ قُرْبَ النَّافِذَةِ. كَانَ يَسْقِيهَا كُلَّ صَبَاحٍ. بَعْدَ أَيَّامٍ ظَهَرَتْ وَرَقَتَانِ خَضْرَاوَانِ.'),
      question('rc-2', 'ما معنى «ظهرت» في النص؟', ['اختفت', 'بدت ووضحت للعيان', 'جفّت'], 1, 'صحيح؛ ظهرت أي أصبحت مرئية وواضحة.', 'استخدم ما حدث للبذرة لفهم الكلمة.', 'زَرَعَ سَامِرٌ بَذْرَةً فِي أُصَيْصٍ، وَوَضَعَهُ قُرْبَ النَّافِذَةِ. كَانَ يَسْقِيهَا كُلَّ صَبَاحٍ. بَعْدَ أَيَّامٍ ظَهَرَتْ وَرَقَتَانِ خَضْرَاوَانِ.'),
      question('rc-3', 'ما سبب نموِّ النبتةِ في النص؟', ['لأنّ سامراً سقاها ووضعها قرب النافذة', 'لأنها كانت داخل الحقيبة', 'لأنّ سامراً لم يعتنِ بها'], 0, 'صحيح؛ هذا استنتاج تدعمه العناية المذكورة في النص.', 'اربط بين السقي ومكان الأصيص وظهور الأوراق.', 'زَرَعَ سَامِرٌ بَذْرَةً فِي أُصَيْصٍ، وَوَضَعَهُ قُرْبَ النَّافِذَةِ. كَانَ يَسْقِيهَا كُلَّ صَبَاحٍ. بَعْدَ أَيَّامٍ ظَهَرَتْ وَرَقَتَانِ خَضْرَاوَانِ.'),
      question('rc-4', 'متى كان سامر يسقي البذرة؟', ['كل صباح', 'كل أسبوع', 'في منتصف الليل'], 0, 'صحيح؛ كان يسقيها كل صباح.', 'ارجع إلى الجملة التي تصف روتين سامر.', 'زَرَعَ سَامِرٌ بَذْرَةً فِي أُصَيْصٍ، وَوَضَعَهُ قُرْبَ النَّافِذَةِ. كَانَ يَسْقِيهَا كُلَّ صَبَاحٍ. بَعْدَ أَيَّامٍ ظَهَرَتْ وَرَقَتَانِ خَضْرَاوَانِ.'),
      question('rc-5', 'أي دليل في النص يدل على أن البذرة بدأت تنمو؟', ['ظهور ورقتين خضراوين', 'وضع الأصيص قرب النافذة فقط', 'شراء سامر أصيصًا جديدًا'], 0, 'صحيح؛ ظهور الورقتين هو علامة النمو المذكورة.', 'ميّز بين ما فعله سامر وما حدث للبذرة.', 'زَرَعَ سَامِرٌ بَذْرَةً فِي أُصَيْصٍ، وَوَضَعَهُ قُرْبَ النَّافِذَةِ. كَانَ يَسْقِيهَا كُلَّ صَبَاحٍ. بَعْدَ أَيَّامٍ ظَهَرَتْ وَرَقَتَانِ خَضْرَاوَانِ.'),
    ],
  },
];

const mathLessons: CurriculumLesson[] = [
  {
    id: 'quantity-cardinality',
    domain: 'math',
    stage: 1,
    title: 'أفهم الكمية قبل اسم العدد',
    objective: 'ربط مجموعة أشياء بعددها، والتمييز بين رؤية الكمية وتسميتها.',
    model: 'كل نقطة تمثل شيئًا واحدًا. طابق المجموعة مع العدد، ثم تحقق بعدّ نقطة واحدة في كل مرة.',
    guidedPractice: 'مثال: إذا رأيت ثلاث نقاط، فعددها ٣ مهما اختلف ترتيب النقاط.',
    successGuidance: 'جيد. جرّب ترتيبًا بصريًا مختلفًا للكمية نفسها للتأكد من أنك فهمت العدد.',
    retryGuidance: 'عدّ كل نقطة مرة واحدة بالإشارة إليها، ثم اختر العدد المطابق. لا نعتمد على السرعة وحدها.',
    questions: [
      question('qc-1', 'كم نقطة ترى؟', ['٣', '٤', '٥'], 1, 'صحيح؛ توجد أربع نقاط.', 'أشر إلى كل نقطة مرة واحدة وعدّها.', undefined, 4),
      question('qc-2', 'كم نقطة ترى؟', ['٢', '٥', '٦'], 1, 'صحيح؛ توجد خمس نقاط.', 'تتبّع النقاط واحدة واحدة، وتجنب عدّ النقطة مرتين.', undefined, 5),
      question('qc-3', 'كم نقطة ترى؟', ['٦', '٧', '٨'], 0, 'صحيح؛ توجد ست نقاط.', 'قسّم المجموعة بصريًا إلى مجموعتين أصغر ثم اجمع الكميتين.', undefined, 6),
      question('qc-4', 'كم نقطة ترى؟', ['٦', '٧', '٨'], 1, 'صحيح؛ توجد سبع نقاط.', 'عدّ كل نقطة مرة واحدة قبل اختيار الرمز.', undefined, 7),
      question('qc-5', 'كم نقطة ترى؟', ['٧', '٨', '٩'], 1, 'صحيح؛ توجد ثماني نقاط.', 'قسّم النقاط إلى مجموعتين صغيرتين وعدّ كل مجموعة ثم اجمعهما.', undefined, 8),
    ],
  },
  {
    id: 'number-symbol-mapping',
    domain: 'math',
    stage: 2,
    title: 'أربط الكمية برمز العدد',
    objective: 'الربط بين العدد المنطوق ورمزه المكتوب وكمية الأشياء.',
    model: 'العدد له اسم منطوق ورمز مكتوب وكمية تمثله. نتحقق من الأشكال التي يتعلمها الطفل في بيئته، ومنها الأرقام العربية الهندية ٠١٢٣٤٥٦٧٨٩ أو الأرقام الغربية 0123456789.',
    guidedPractice: 'مثال: «خمسة» تمثلها ٥ أو 5 بحسب نظام كتابة الأرقام المستخدم في السؤال.',
    successGuidance: 'أحسنت. اربط العدد بأكثر من تمثيل حتى لا تعتمد على حفظ شكل واحد فقط.',
    retryGuidance: 'قل اسم العدد، ثم عدّ المجموعة، وبعد ذلك اختر الرمز المطابق.',
    questions: [
      question('ns-1', 'أي رمز يمثل «سبعة»؟', ['٧', '٣', '٩'], 0, 'صحيح؛ الرمز ٧ يمثل سبعة.', 'ردد اسم العدد، ثم قارن الرموز قبل الاختيار.', 'سبعة'),
      question('ns-2', 'أي رمز يمثل «اثنا عشر»؟', ['٢١', '١٢', '٢٠'], 1, 'صحيح؛ ١٢ يتكون من عشرة واثنين.', 'اقرأ الرمز ١٢ «اثنا عشر» لا «واحد وعشرون»، وانتبه إلى منزلة العشرات والآحاد.', 'اثنا عشر'),
      question('ns-3', 'أي مجموعة تمثل العدد «أربعة»؟', ['٣ أشياء', '٤ أشياء', '٥ أشياء'], 1, 'صحيح؛ العدد والكمية متطابقان.', 'عدّ العناصر مرة واحدة وقارن المجموع بالرمز.'),
      question('ns-4', 'أي رمز يمثل «تسعة»؟', ['٦', '٩', '٧'], 1, 'صحيح؛ الرمز ٩ يمثل تسعة.', 'قل اسم العدد، ثم قارن شكل الرموز بهدوء.', 'تسعة'),
      question('ns-5', 'ما الاسم الصحيح للعدد ١٥؟', ['خمسة عشر', 'واحد وخمسون', 'خمسة'], 0, 'صحيح؛ ١٥ يعني عشرة وخمسة آحاد.', 'انتبه إلى ترتيب العشرات والآحاد في العدد المكتوب.', '١٥'),
    ],
  },
  {
    id: 'magnitude-number-line',
    domain: 'math',
    stage: 3,
    title: 'أقارن الأعداد وأحدد موقعها',
    objective: 'فهم الأكبر والأصغر والمسافة بين العددين باستخدام خط الأعداد.',
    model: 'على خط الأعداد تزداد القيمة كلما اتجهنا نحو الطرف الأكبر. ابدأ بتحديد طرفي الخط، ثم مكان الصفر والعشرات قبل تقدير موضع العدد.',
    guidedPractice: 'مثال: على خط من ٠ إلى ١٠، يقع العدد ٣ بعد ٢ بخطوة واحدة وقبل ٥ بخطوتين.',
    successGuidance: 'جيد. استخدم نقاطًا مرجعية مثل ٠ والمنتصف والنهاية لتقدير المسافات.',
    retryGuidance: 'حدد البداية والنهاية والمنتصف أولًا، ثم قارن العددين أو احسب عدد الخطوات.',
    questions: [
      question('mn-1', 'أيهما أكبر؟', ['٨', '٥', 'متساويان'], 0, 'صحيح؛ ٨ أكبر من ٥.', 'ضع العددين على خط يبدأ من الصفر، وانظر أيهما يقع إلى اليمين.', '٨ أم ٥'),
      question('mn-2', 'أي عدد أقرب إلى ١٠؟', ['٣', '٨', '٤'], 1, 'صحيح؛ ٨ يبعد خطوتين عن ١٠.', 'قارن المسافة إلى ١٠، لا حجم الرقم المكتوب فقط.', '٣، ٨، ٤'),
      question('mn-3', 'ما العدد الذي يأتي بعد ٢٩ مباشرة؟', ['٢٨', '٣٠', '٣٩'], 1, 'صحيح؛ بعد ٢٩ يأتي ٣٠.', 'عدّ خطوة واحدة للأمام، وانتبه إلى انتقال الآحاد إلى العشرات.', '٢٩ → ؟'),
      question('mn-4', 'ما العدد الواقع بين ٤ و٦؟', ['٣', '٥', '٧'], 1, 'صحيح؛ ٥ يقع بين ٤ و٦.', 'ابدأ من ٤ وتقدم خطوة واحدة على خط الأعداد.', '٤ — ؟ — ٦'),
      question('mn-5', 'إذا تحركت خطوتين إلى اليسار من ٧ على خط الأعداد، فأين تصل؟', ['٥', '٦', '٩'], 0, 'صحيح؛ ٧ ثم ٦ ثم ٥.', 'التحرك يسارًا يعني الانتقال إلى أعداد أصغر في خط الأعداد المعتاد.', '٧ ← ← ؟'),
    ],
  },
  {
    id: 'place-value',
    domain: 'math',
    stage: 4,
    title: 'أفهم العشرات والآحاد',
    objective: 'فهم أن قيمة الرقم مرتبطة بموقعه، وتمثيل العدد بالعشرات والآحاد.',
    model: 'في العدد ٣٦، الرقم ٣ في منزلة العشرات وقيمته ٣٠، والرقم ٦ يمثل ستة آحاد. نستخدم مجموعات من عشرة ثم نكتب الرمز.',
    guidedPractice: 'مثال: ٤٢ = أربع عشرات وآحادان؛ أي ٤٠ + ٢.',
    successGuidance: 'أحسنت. جرّب تفكيك أعداد أخرى إلى عشرات وآحاد ثم أعد تركيبها.',
    retryGuidance: 'كوّن مجموعات من عشرة، ثم عدّ الوحدات المتبقية. لا تقرأ العدد كرقمين منفصلين فقط.',
    questions: [
      question('pv-1', 'في العدد ٤٣، كم عشرة كاملة؟', ['٣', '٤', '٤٣'], 1, 'صحيح؛ فيه أربع عشرات.', 'الرقم الأول من اليسار في هذا العدد يمثل العشرات.', '٤٣'),
      question('pv-2', 'أي تفكيك يمثّل العدد ٢٧؟', ['٢٠ + ٧', '٢ + ٧٠', '٢٠ + ٧٠'], 0, 'صحيح؛ ٢٧ تساوي عشرَتين وسبعة آحاد.', 'افصل العشرات عن الآحاد ثم أعد جمعهما.', '٢٧'),
      question('pv-3', 'ما قيمة الرقم ٥ في العدد ٥٢؟', ['٥', '٥٠', '٢'], 1, 'صحيح؛ الرقم ٥ في منزلة العشرات وقيمته ٥٠.', 'تعرّف إلى المنزلة قبل اختيار القيمة.', '٥٢'),
      question('pv-4', 'ما قيمة الرقم ٨ في العدد ٥٨؟', ['٨', '٨٠', '٥'], 0, 'صحيح؛ الرقم ٨ في منزلة الآحاد وقيمته ٨.', 'ميّز بين منزلة العشرات ومنزلة الآحاد.', '٥٨'),
      question('pv-5', 'أي تفكيك يمثّل العدد ٦٤؟', ['٦ + ٤', '٦٠ + ٤', '٦٠ + ٤٠'], 1, 'صحيح؛ ٦٤ تساوي ستّ عشرات وأربعة آحاد.', 'اكتب قيمة العشرات ثم أضف قيمة الآحاد.', '٦٤'),
    ],
  },
  {
    id: 'addition-subtraction',
    domain: 'math',
    stage: 5,
    title: 'أفكّر في الجمع والطرح',
    objective: 'استخدام استراتيجية واضحة للجمع والطرح بدل الاعتماد على التخمين.',
    model: 'يمكن تفكيك العدد أو تكوين عشرة كاملة. في ٩ + ٢، نأخذ ١ من الاثنين لنكمل ١٠، ويتبقى ١؛ إذن الناتج ١١.',
    guidedPractice: 'مثال آخر: ١٣ − ٤. اطرح ٣ لتصل إلى ١٠، ثم اطرح ١ أخرى؛ الناتج ٩.',
    successGuidance: 'جيد. اشرح الاستراتيجية بكلماتك قبل الانتقال إلى تمارين أسرع.',
    retryGuidance: 'استخدم خط الأعداد أو قسّم العدد إلى جزء يصل إلى عشرة، ثم أكمل العملية.',
    questions: [
      question('as-1', 'ما ناتج ٨ + ٥؟', ['١٢', '١٣', '١٤'], 1, 'صحيح؛ نكمل ١٠ بأخذ ٢ من الخمسة، ويتبقى ٣.', 'قسّم ٥ إلى ٢ و٣، ثم احسب ٨ + ٢ + ٣.', '٨ + ٥'),
      question('as-2', 'ما ناتج ١٤ − ٦؟', ['٨', '٩', '٧'], 0, 'صحيح؛ الناتج ٨.', 'اطرح ٤ لتصل إلى ١٠، ثم اطرح ٢ أخرى.', '١٤ − ٦'),
      question('as-3', 'أي جملة عددية تساوي ١٠؟', ['٦ + ٣', '٧ + ٣', '٨ + ٣'], 1, 'صحيح؛ ٧ + ٣ = ١٠.', 'ابحث عن العدد الذي يكمل ٧ إلى ١٠.', '؟ + ٣ = ١٠'),
      question('as-4', 'ما ناتج ٧ + ٦؟', ['١٢', '١٣', '١٤'], 1, 'صحيح؛ ٧ + ٦ = ١٣.', 'أكمل إلى عشرة: خذ ٣ من الستة، ثم أضف ما تبقّى.', '٧ + ٦'),
      question('as-5', 'ما ناتج ١٥ − ٧؟', ['٧', '٨', '٩'], 1, 'صحيح؛ ١٥ − ٧ = ٨.', 'اطرح ٥ لتصل إلى ١٠، ثم اطرح ٢ أخرى.', '١٥ − ٧'),
    ],
  },
  {
    id: 'multiplication-division',
    domain: 'math',
    stage: 6,
    title: 'أفهم المجموعات المتساوية',
    objective: 'ربط الضرب بالمجموعات المتساوية والقسمة بتوزيع الكمية بالتساوي.',
    model: 'مجموعتان في كل منهما أربعة عناصر تعني ٤ + ٤ = ٨، ويمكن كتابتها ٢ × ٤ = ٨.',
    guidedPractice: 'مثال: ١٠ قطع توزّع بالتساوي على مجموعتين؛ في كل مجموعة ٥ قطع.',
    successGuidance: 'أحسنت. استخدم رسم المجموعات أو مصفوفة قبل الاعتماد على الحقيقة الحسابية المحفوظة.',
    retryGuidance: 'ارسم مجموعات متساوية ثم عدّ العناصر الكلية أو وزّعها بالتساوي.',
    questions: [
      question('md-1', '٣ مجموعات، في كل مجموعة عنصران. كم عنصرًا؟', ['٥', '٦', '٨'], 1, 'صحيح؛ ٢ + ٢ + ٢ = ٦.', 'ارسم ثلاث مجموعات وضع عنصرين في كل مجموعة.'),
      question('md-2', 'ما ناتج ٤ × ٥؟', ['٩', '٢٠', '١٥'], 1, 'صحيح؛ أربع مجموعات من خمسة تساوي ٢٠.', 'حوّل الضرب إلى جمع متكرر: ٥ + ٥ + ٥ + ٥.', '٤ × ٥'),
      question('md-3', '١٢ قطعة تقسم بالتساوي على ٣ أطفال. كم قطعة لكل طفل؟', ['٣', '٤', '٥'], 1, 'صحيح؛ ١٢ ÷ ٣ = ٤.', 'وزّع القطع واحدة تلو الأخرى على ثلاثة أطفال حتى تنتهي.'),
      question('md-4', 'أربع مجموعات، في كل مجموعة ثلاثة عناصر. كم عنصرًا؟', ['٧', '١٢', '٩'], 1, 'صحيح؛ ٤ × ٣ = ١٢.', 'ارسم أربع مجموعات وضع ثلاثة عناصر في كل مجموعة.'),
      question('md-5', 'وُزّعت ١٥ قطعة بالتساوي على خمسة أطفال. كم قطعة لكل طفل؟', ['٥', '٣', '٤'], 1, 'صحيح؛ ١٥ ÷ ٥ = ٣.', 'وزّع القطع على الأطفال واحدًا واحدًا حتى تنتهي.'),
    ],
  },
  {
    id: 'math-word-problems',
    domain: 'math',
    stage: 7,
    title: 'أحوّل المسألة إلى خطة حل',
    objective: 'فهم سياق المسألة، وتحديد المطلوب والكمية والعلاقة، ثم اختيار العملية وتفسير الناتج.',
    model: 'اقرأ المسألة، واشرح ما نعرفه وما نبحث عنه. يمكن رسم الكميات أو وضعها في مخطط قبل اختيار العملية.',
    guidedPractice: 'مثال: لدى سارة ٥ كرات، ثم حصلت على كرتين إضافيتين. نعرف البداية والزيادة، لذا نجمع: ٥ + ٢ = ٧.',
    successGuidance: 'جيد. اشرح لماذا اخترت العملية، وتحقق من أن الإجابة تناسب القصة.',
    retryGuidance: 'أعد صياغة السؤال، وميّز بين ما كان موجودًا وما تغيّر وما يطلبه السؤال.',
    questions: [
      question('wp-1', 'مع مريم ٤ أقلام وأعطاها أخوها ٣ أخرى. كم أصبح معها؟', ['١', '٧', '١٢'], 1, 'صحيح؛ نضيف ٣ إلى ٤ فيصبح المجموع ٧.', 'ارسم ٤ أقلام ثم أضف ٣، وبعدها عدّ المجموع.'),
      question('wp-2', 'كان مع عمر ٩ كرات، وأعطى صديقه ٢. كم بقي معه؟', ['٧', '١١', '٦'], 0, 'صحيح؛ عندما نعطي جزءًا من الكمية يقل ما بقي.', 'ابدأ بـ٩ ثم احذف كرتين أو تحرك خطوتين للخلف.'),
      question('wp-3', 'في كل صندوق ٥ كتب، ولدينا صندوقان. كم كتابًا؟', ['٧', '١٠', '٥'], 1, 'صحيح؛ مجموعتان من خمسة تساويان ١٠.', 'ارسم صندوقين وضع ٥ علامات في كل صندوق، ثم اجمع.'),
      question('wp-4', 'مع هدى ٨ تفاحات، وأكلت ٣. كم تفاحة بقيت؟', ['٥', '١١', '٦'], 0, 'صحيح؛ نطرح ما أكلته من العدد الكلي: ٨ − ٣ = ٥.', 'ابدأ بثماني تفاحات ثم احذف ثلاثًا وعدّ الباقي.'),
      question('wp-5', 'ثلاثة أكياس، في كلِّ كيسٍ منها أربعةُ أقلامٍ. ما مجموعُ الأقلامِ؟', ['٧', '١٢', '٩'], 1, 'صحيح؛ ٣ مجموعات من أربعة تساوي ١٢.', 'مثّل كل كيس كمجموعة مستقلة ثم اجمع الأقلام.'),
    ],
  },
  {
    id: 'fractions',
    domain: 'math',
    stage: 8,
    title: 'أفهم الجزء من الكل',
    objective: 'تمييز الكسور بوصفها أجزاء متساوية من كل واحد.',
    model: 'لا يكفي عدد الأجزاء؛ يجب أن تكون الأجزاء متساوية. في النصف، نقسم الكل إلى جزأين متساويين ونأخذ جزءًا واحدًا.',
    guidedPractice: 'مثال: إذا قُسّم الشكل إلى أربعة أجزاء متساوية وأخذنا ثلاثة، فهذه ثلاثة أرباع.',
    successGuidance: 'أحسنت. اربط الرمز بصورة أجزاء متساوية قبل مقارنة الكسور.',
    retryGuidance: 'تأكد من أن الأجزاء متساوية، ثم حدّد كم جزءًا أخذنا من مجموع الأجزاء.',
    questions: [
      question('fr-1', 'ماذا يعني ١/٢؟', ['جزء واحد من جزأين متساويين', 'جزآن من ثلاثة', 'ثلاثة أجزاء من أربعة'], 0, 'صحيح؛ البسط ١ والمقام ٢.', 'اقرأ المقام بوصفه عدد الأجزاء المتساوية والبسط بوصفه الأجزاء المختارة.', '١/٢'),
      question('fr-2', 'أي مجموعة تمثل ربعًا؟', ['جزء واحد من ٤ أجزاء متساوية', 'جزآن من ٤', '٣ أجزاء من ٤'], 0, 'صحيح؛ الربع جزء واحد من أربعة أجزاء متساوية.', 'تخيّل الكل مقسّمًا إلى أربعة أجزاء متساوية واختر جزءًا واحدًا.', '١/٤'),
      question('fr-3', 'أي كسر أكبر؟', ['١/٢', '١/٤', 'متساويان'], 0, 'صحيح؛ نصف الكل أكبر من ربعه عند تساوي الكل.', 'قارن مقدار الجزء عندما يكون الكل نفسه.'),
      question('fr-4', 'قُسم شكل إلى أربعة أجزاء متساوية وأُخذت ثلاثة. ما الكسر؟', ['١/٤', '٣/٤', '٢/٤'], 1, 'صحيح؛ ثلاثة من أربعة أجزاء متساوية تكتب ٣/٤.', 'المقام عدد الأجزاء كلها، والبسط عدد الأجزاء المختارة.'),
      question('fr-5', 'أي كسر يمثل الشكل كاملاً دون نقص؟', ['٤/٤', '١/٤', '٢/٤'], 0, 'صحيح؛ عندما يتساوى البسط والمقام (٤/٤) فإن الكسر يمثل الكل كاملاً.', 'تذكّر أن الكسر الذي يتساوى فيه البسط مع المقام يمثّل الشكل كاملًا.'),
    ],
  },
];

export const READING_CURRICULUM_SEQUENCE = readingLessons.map(({ id, stage, title }) => ({ id, stage, title }));
export const MATH_CURRICULUM_SEQUENCE = mathLessons.map(({ id, stage, title }) => ({ id, stage, title }));

/** Selects a short formative round from the larger lesson bank. Consecutive rounds overlap
 * deliberately for retrieval, but rotate through new items so a repeat is not the same test. */
export function getCurriculumRoundQuestions(
  lesson: CurriculumLesson,
  roundNumber = 0,
  itemCount = CURRICULUM_ROUTING_RULES.formativeItemsPerRound,
): CurriculumQuestion[] {
  const count = Math.max(1, Math.min(Math.trunc(itemCount) || 1, lesson.questions.length));
  const start = (Math.max(0, Math.trunc(roundNumber)) * count) % lesson.questions.length;
  return Array.from({ length: count }, (_, offset) => lesson.questions[(start + offset) % lesson.questions.length]);
}

/** Rotate answer choice positions between rounds; returned values are indices into the source option list. */
export function getCurriculumOptionOrder(question: CurriculumQuestion, roundNumber = 0): number[] {
  if (question.options.length <= 1) return question.options.map((_, index) => index);
  const idOffset = Array.from(question.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % question.options.length;
  const rotation = (idOffset + Math.max(0, Math.trunc(roundNumber))) % question.options.length;
  return question.options.map((_, index) => (index + rotation) % question.options.length);
}

export function getCurriculumLesson(
  domain: CurriculumDomain,
  skillId: CurriculumSkillId,
): CurriculumLesson | null {
  return (domain === 'reading' ? readingLessons : mathLessons).find((lesson) => lesson.id === skillId) ?? null;
}

const isPercent = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

export function recommendCurriculumSkill(
  student: CurriculumStudentEvidence,
  domain: CurriculumDomain,
): CurriculumRecommendation {
  const grade = Number.isInteger(student.gradeLevel) ? (student.gradeLevel as number) : 1;
  if (domain === 'reading') {
    const cognition = student.isDemoRecord ? null : student.cognitiveResults;
    if (isPercent(cognition?.phonemicAwarenessScorePercent) &&
        cognition.phonemicAwarenessScorePercent < CURRICULUM_ROUTING_RULES.phonologicalAwarenessReviewPercent) {
      return {
        domain, skillId: 'phonological-awareness',
        reasonAr: 'اخترنا تدريب الأصوات أولًا بناءً على نتيجة مهمة الوعي الصوتي المسجلة.',
        evidenceAr: `نتيجة المهمة: ${cognition.phonemicAwarenessScorePercent}%؛ تُستخدم لتوجيه التدريب فقط وليست معيارًا عمريًا أو تشخيصًا.`,
        isBaseline: false,
      };
    }
    // Candidate pseudo-word items are not independently lexicon/dialect-reviewed yet.
    // Do not use their score to route a learner until that content has been reviewed and validated.
    if (
      !student.isDemoRecord &&
      student.evidenceProvenance === 'server-verified-audio' &&
      student.aiAssessmentVerified === true &&
      isPercent(student.oralAccuracyPercent) &&
      student.oralAccuracyPercent < CURRICULUM_ROUTING_RULES.oralAccuracyReviewPercent
    ) {
      return {
        domain, skillId: 'syllable-blending',
        reasonAr: 'نوصي بإعادة تدريب دمج المقاطع وقراءة الكلمات بدقة.',
        evidenceAr: 'هذه الإشارة مشتقة من نتيجة الصوت الآلية المكتملة؛ قد يتأثر التقدير بالتعرف الصوتي واللهجة، لذلك لا تُعامل كحقيقة مرجعية أو تشخيص.',
        isBaseline: false,
      };
    }
    if (!student.isDemoRecord &&
        student.sessionStatus === 'completed' &&
        isPercent(student.comprehensionScore) &&
        student.comprehensionScore < CURRICULUM_ROUTING_RULES.comprehensionReviewPercent) {
      return {
        domain, skillId: 'reading-comprehension',
        reasonAr: 'نبدأ بتمارين فهم النص واستخراج الدليل من القراءة السابقة.',
        evidenceAr: `نتيجة أسئلة النص السابق: ${student.comprehensionScore}%؛ تعكس النص المحدد ولا تُعمّم على القدرة القرائية كلها.`,
        isBaseline: false,
      };
    }
    return {
      domain,
      skillId: grade >= 3 ? 'short-vowel-decoding' : 'phonological-awareness',
      reasonAr: 'ابدأ بجولة تأسيسية قصيرة، ثم دع إجاباتك تحدد المهارة التالية.',
      evidenceAr: 'لا توجد بيانات سابقة كافية لتوجيه أدق؛ لن نفترض وجود صعوبة أو اضطراب.',
      isBaseline: true,
    };
  }

  if (!student.isDemoRecord && student.dyscalculiaAssessed === true) {
    if (isPercent(student.subitizingAccuracy) &&
        student.subitizingAccuracy < CURRICULUM_ROUTING_RULES.quantityReviewPercent) {
      return {
        domain, skillId: 'quantity-cardinality',
        reasonAr: 'نبدأ بربط مجموعات الأشياء بالكمية التي تمثلها.',
        evidenceAr: `دقة تمييز الكميات في المهام السابقة: ${student.subitizingAccuracy}%؛ مقياس وصفي لهذه المهمة فقط.`,
        isBaseline: false,
      };
    }
    if (isPercent(student.transcodingAccuracy) &&
        student.transcodingAccuracy < CURRICULUM_ROUTING_RULES.numberSymbolReviewPercent) {
      return {
        domain, skillId: 'number-symbol-mapping',
        reasonAr: 'نراجع الربط بين اسم العدد ورمزه والكمية.',
        evidenceAr: `دقة ترميز الأعداد في المهام السابقة: ${student.transcodingAccuracy}%؛ مقياس وصفي لهذه المهمة فقط.`,
        isBaseline: false,
      };
    }
    if (isPercent(student.numberLinePAE) &&
        student.numberLinePAE > CURRICULUM_ROUTING_RULES.numberLineErrorReviewPercent) {
      return {
        domain, skillId: 'magnitude-number-line',
        reasonAr: 'نراجع مقارنة الأعداد وتحديد مواقعها على خط الأعداد.',
        evidenceAr: `الخطأ المطلق في موضع خط الأعداد: ${student.numberLinePAE}%؛ لا يُستخدم وحده للحكم على القدرة الرياضية العامة.`,
        isBaseline: false,
      };
    }
  }
  return {
    domain,
    skillId: grade >= 3 ? 'magnitude-number-line' : 'quantity-cardinality',
    reasonAr: 'ابدأ بمهمة تعليمية قصيرة لربط الكمية بالعدد، ثم انتقل وفق الإجابات.',
    evidenceAr: 'لا توجد بيانات كافية لاختيار هدف أضيق؛ لا نفترض وجود صعوبة أو اضطراب.',
    isBaseline: true,
  };
}

export function getNextCurriculumSkill(
  domain: CurriculumDomain,
  currentSkillId: CurriculumSkillId,
  gradeLevel = 1,
): CurriculumSkillId {
  const sequence = domain === 'reading'
    ? readingLessons
    : mathLessons.filter((lesson) => {
        if (lesson.id === 'multiplication-division') return gradeLevel >= 3;
        if (lesson.id === 'fractions') return gradeLevel >= 4;
        return true;
      });
  const index = sequence.findIndex((lesson) => lesson.id === currentSkillId);
  return sequence[Math.min(index < 0 ? 0 : index + 1, sequence.length - 1)].id;
}

export function isFormativeMastery(score: number, itemCount: number): boolean {
  return Number.isInteger(score) &&
    Number.isInteger(itemCount) &&
    itemCount > 0 &&
    score === itemCount &&
    itemCount >= CURRICULUM_ROUTING_RULES.formativeMasteryItems;
}
