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
): CurriculumQuestion => ({
  id, prompt, options, correctIndex, feedbackCorrect, scaffold, stimulus, dotCount,
});

const readingLessons: CurriculumLesson[] = [
  {
    id: 'phonological-awareness',
    domain: 'reading',
    stage: 1,
    title: 'أستمع إلى الأصوات داخل الكلمة',
    objective: 'تمييز الصوت الأول في كلمة مسموعة قبل التركيز على اسم الحرف.',
    model: 'قل الكلمة ببطء، واستمع إلى أول صوت فيها. اسمه ليس بالضرورة اسم الحرف؛ نبحث هنا عن الصوت الذي نسمعه أولًا.',
    guidedPractice: 'مثال: في «مَوز»، الصوت الأول /م/. كرّر الكلمة ثم مدّ الصوت الأول قليلًا.',
    successGuidance: 'أحسنت. انتقل إلى تدريب آخر على الأصوات، مع الاحتفاظ بالكلمات التي تحتاج مراجعة.',
    retryGuidance: 'استمع مرة أخرى، وقل الكلمة ببطء. ابدأ من الصوت الأول ثم اختر الحرف الذي يمثّله.',
    questions: [
      question('pa-1', 'ما الصوت الأول في «مُوزٌ»؟', ['م', 'ز', 'و'], 0, 'صحيح؛ تبدأ «موز» بالصوت /م/.', 'قل «مـوز» ببطء، ثم لاحظ الصوت الذي تسمعه قبل بقية الكلمة.', 'مُوزٌ'),
      question('pa-2', 'ما الصوت الأول في «سَمَكٌ»؟', ['ك', 'س', 'م'], 1, 'صحيح؛ يبدأ لفظ «سمك» بالصوت /س/.', 'أعد نطق «سَمَك» من بدايتها، لا من آخرها.', 'سَمَكٌ'),
      question('pa-3', 'ما الصوت الأول في «نُورٌ»؟', ['و', 'ر', 'ن'], 2, 'صحيح؛ يبدأ لفظ «نور» بالصوت /ن/.', 'اسمع المقطع الأول «نُو» ثم اختر الحرف الذي يمثّل الصوت الأول.', 'نُورٌ'),
    ],
  },
  {
    id: 'letter-sound-mapping',
    domain: 'reading',
    stage: 2,
    title: 'أربط صوت الحرف بشكله',
    objective: 'ربط الصوت بالحرف مع ملاحظة النقاط وشكل الحرف داخل الكلمة.',
    model: 'انظر إلى الحرف داخل الكلمة، ولا تعتمد على عدد النقاط وحده. قد يتغير شكل الحرف في أول الكلمة أو وسطها أو آخرها، مع بقاء هويته.',
    guidedPractice: 'مثال: حرف الباء في «باب» هو ب، ويظهر في بداية الكلمة ووسطها بشكل متصل.',
    successGuidance: 'جيد. واصل الربط بين الصوت والحرف في كلمات متنوعة، لا في بطاقة واحدة فقط.',
    retryGuidance: 'قارن موضع النقاط، ثم اقرأ الكلمة كاملة قبل أن تختار.',
    questions: [
      question('ls-1', 'أي حرف يبدأ به صوت «بَابٌ»؟', ['ت', 'ب', 'ث'], 1, 'صحيح؛ الكلمة تبدأ بحرف الباء.', 'قارن شكل الحروف الثلاثة وموضع نقاطها، ثم أعد قراءة الكلمة.', 'بَابٌ'),
      question('ls-2', 'أي حرف تسمعه في وسط «كَتَبَ»؟', ['ت', 'ك', 'ب'], 0, 'صحيح؛ الحرف الأوسط في «كَتَبَ» هو التاء.', 'انطق الكلمة على ثلاثة مقاطع صوتية: كَ ـ تَ ـ بَ.', 'كَتَبَ'),
      question('ls-3', 'أي حرف يبدأ به «ثَوْبٌ»؟', ['ب', 'ت', 'ث'], 2, 'صحيح؛ «ثوب» تبدأ بالثاء ذات النقاط الثلاث.', 'تذكّر الفرق بين باء وتاء وثاء، ثم استمع إلى الكلمة كاملة.', 'ثَوْبٌ'),
    ],
  },
  {
    id: 'short-vowel-decoding',
    domain: 'reading',
    stage: 3,
    title: 'أقرأ الحركات القصيرة',
    objective: 'التمييز بين الفتحة والضمة والكسرة ودمجها مع أصوات الحروف.',
    model: 'الحركة القصيرة تغيّر طريقة نطق الحرف: بَ، بُ، بِ. اقرأ الصوت مع الحرف ولا تسمِّ الحرف وحده.',
    guidedPractice: 'مثال: كَتَبَ تُقرأ «كَ ـ تَ ـ بَ». ندمج الأصوات بالترتيب حتى تصبح كلمة واحدة.',
    successGuidance: 'جيد. جرّب كلمات جديدة بالتشكيل نفسه قبل تقليل الحركات تدريجيًا.',
    retryGuidance: 'ارجع إلى الحركات في المثال، واقرأ كل جزء بصوت واضح قبل دمج الأجزاء.',
    questions: [
      question('sv-1', 'أي كلمة تبدأ بالمقطع «كَ»؟', ['كِتَابٌ', 'كُرَةٌ', 'كَتَبَ'], 2, 'صحيح؛ «كَتَبَ» تبدأ بفتح الكاف.', 'لاحظ الحركة فوق الكاف في «كَتَبَ»، وتحت الكاف في «كِتاب».'),
      question('sv-2', 'أي كلمة تبدأ بصوت «بِ»؟', ['بَابٌ', 'بِئْرٌ', 'بُرْتُقَالٌ'], 1, 'صحيح؛ الكسرة تحت الباء في «بِئْر».', 'قارن حركة الباء في الكلمات الثلاث: فتحة، كسرة، ضمة.'),
      question('sv-3', 'اختر الكلمة التي تُقرأ «عِلْمٌ».', ['عَلَمٌ', 'عِلْمٌ', 'عَالَمٌ'], 1, 'صحيح؛ الكسرة والسكون يغيّران القراءة والمعنى.', 'اقرأ حركة العين ثم انتبه إلى السكون على اللام.', 'عِلْمٌ'),
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
      question('sb-1', 'كَ + تَ + بَ تساوي:', ['كَتَبَ', 'كُتِبَ', 'كِتَابٌ'], 0, 'صحيح؛ دمج كَ وتَ وبَ ينتج «كَتَبَ».', 'اقرأ الأجزاء بالترتيب: كَ، ثم تَ، ثم بَ.'),
      question('sb-2', 'سَ + مَ + كٌ تساوي:', ['سَمَكٌ', 'مَسَكٌ', 'سَمَاءٌ'], 0, 'صحيح؛ جمعت المقاطع بالترتيب دون حذف أو تبديل.', 'ابدأ بالمقطع سَ، ثم مَ، ثم كٌ.'),
      question('sb-3', 'لَ + عِ + بَ تساوي:', ['لَعِبَ', 'لَعَبَ', 'عَلِبَ'], 0, 'صحيح؛ الكسرة على العين باقية عند دمج المقاطع.', 'انتبه إلى حركة العين: عِ وليست عَ.', 'لَعِبَ'),
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
      question('ct-1', 'إلى أين ذهبت ليلى؟', ['إلى المكتبة', 'إلى السوق', 'إلى الحديقة'], 0, 'صحيح؛ ورد في النص أنها زارت المكتبة.', 'ارجع إلى الجملة الأولى وابحث عن المكان الذي زارته ليلى.'),
      question('ct-2', 'عمّ كان الكتاب؟', ['عن الجبال', 'عن البحر', 'عن الفضاء'], 1, 'صحيح؛ اختارت كتابًا عن البحر.', 'أعد قراءة الجزء «كتابًا عن…»'),
      question('ct-3', 'ماذا فعلت ليلى بعد القراءة؟', ['نامت', 'ذهبت إلى السوق', 'حكت لأسرتها ما تعلمته'], 2, 'صحيح؛ شرحت لأسرتها ما تعلمته.', 'ابحث عن الفعل الذي جاء بعد «ثمّ».'),
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
      question('rc-1', 'أين وضع سامر الأصيص؟', ['قرب النافذة', 'تحت السرير', 'في الحقيبة'], 0, 'صحيح؛ النص يقول إنه وضعه قرب النافذة.', 'ابحث في الجملة الأولى عن المكان.'),
      question('rc-2', 'ما معنى «ظهرت» في النص؟', ['اختفت', 'بانت بعد أن لم تكن ظاهرة', 'جفّت'], 1, 'صحيح؛ ظهرت أي أصبحت مرئية.', 'استخدم ما حدث للبذرة لفهم الكلمة.'),
      question('rc-3', 'لماذا قد تكون النبتة قد نمت؟', ['لأن سامر سقاها ووضعها قرب النافذة', 'لأنها كانت داخل الحقيبة', 'لأن سامر لم يعتنِ بها'], 0, 'صحيح؛ هذا استنتاج تدعمه العناية المذكورة في النص.', 'اربط بين السقي ومكان الأصيص وظهور الأوراق.'),
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
    guidedPractice: 'مثال: إذا رأيت أربع نقاط، فعددها ٤ مهما اختلف ترتيب النقاط.',
    successGuidance: 'جيد. جرّب ترتيبًا بصريًا مختلفًا للكمية نفسها للتأكد من أنك فهمت العدد.',
    retryGuidance: 'عدّ كل نقطة مرة واحدة بالإشارة إليها، ثم اختر العدد المطابق. لا نعتمد على السرعة وحدها.',
    questions: [
      question('qc-1', 'كم نقطة ترى؟', ['٣', '٤', '٥'], 1, 'صحيح؛ توجد أربع نقاط.', 'أشر إلى كل نقطة مرة واحدة وعدّها.', undefined, 4),
      question('qc-2', 'كم نقطة ترى؟', ['٢', '٥', '٦'], 1, 'صحيح؛ توجد خمس نقاط.', 'تتبّع النقاط واحدة واحدة، وتجنب عدّ النقطة مرتين.', undefined, 5),
      question('qc-3', 'كم نقطة ترى؟', ['٦', '٧', '٨'], 0, 'صحيح؛ توجد ست نقاط.', 'قسّم المجموعة بصريًا إلى مجموعتين أصغر ثم اجمع الكميتين.', undefined, 6),
    ],
  },
  {
    id: 'number-symbol-mapping',
    domain: 'math',
    stage: 2,
    title: 'أربط الكمية برمز العدد',
    objective: 'الربط بين العدد المنطوق ورمزه المكتوب وكمية الأشياء.',
    model: 'العدد له اسم منطوق ورمز مكتوب وكمية تمثله. نتحقق من الأشكال التي يتعلمها الطفل في بيئته، ومنها الأرقام العربية الهندية ٠١٢٣٤٥٦٧٨٩ أو الأرقام الغربية 0123456789.',
    guidedPractice: 'مثال: «سبعة» تمثلها ٧ أو 7 بحسب نظام الكتابة المستخدم في السؤال.',
    successGuidance: 'أحسنت. اربط العدد بأكثر من تمثيل حتى لا تعتمد على حفظ شكل واحد فقط.',
    retryGuidance: 'قل اسم العدد، ثم عدّ المجموعة، وبعد ذلك اختر الرمز المطابق.',
    questions: [
      question('ns-1', 'أي رمز يمثل «سبعة»؟', ['٧', '٣', '٩'], 0, 'صحيح؛ الرمز ٧ يمثل سبعة.', 'ردد اسم العدد، ثم قارن الرموز قبل الاختيار.', 'سبعة'),
      question('ns-2', 'أي رمز يمثل «اثني عشر»؟', ['٢١', '١٢', '٢٠'], 1, 'صحيح؛ ١٢ يتكون من عشرة واثنين.', 'اقرأ العدد من اليمين إلى اليسار في سياق العربية، وتحقق من موضع العشرات والآحاد.', 'اثنا عشر'),
      question('ns-3', 'أي مجموعة تمثل العدد ٤؟', ['٣ أشياء', '٤ أشياء', '٥ أشياء'], 1, 'صحيح؛ العدد والكمية متطابقان.', 'عدّ العناصر مرة واحدة وقارن المجموع بالرمز.', '٤'),
    ],
  },
  {
    id: 'magnitude-number-line',
    domain: 'math',
    stage: 3,
    title: 'أقارن الأعداد وأحدد موقعها',
    objective: 'فهم الأكبر والأصغر والمسافة بين العددين باستخدام خط الأعداد.',
    model: 'على خط الأعداد تزداد القيمة كلما اتجهنا نحو الطرف الأكبر. ابدأ بتحديد طرفي الخط، ثم مكان الصفر والعشرات قبل تقدير موضع العدد.',
    guidedPractice: 'مثال: على خط من ٠ إلى ١٠، يقع العدد ٨ بعد ٥ بثلاث خطوات وقبل ١٠ بخطوتين.',
    successGuidance: 'جيد. استخدم نقاطًا مرجعية مثل ٠ والمنتصف والنهاية لتقدير المسافات.',
    retryGuidance: 'حدد البداية والنهاية والمنتصف أولًا، ثم قارن العددين أو احسب عدد الخطوات.',
    questions: [
      question('mn-1', 'أيهما أكبر؟', ['٨', '٥', 'متساويان'], 0, 'صحيح؛ ٨ أكبر من ٥.', 'ضع العددين على خط يبدأ من الصفر، وانظر أيهما يقع إلى اليمين.', '٨ أم ٥'),
      question('mn-2', 'أي عدد أقرب إلى ١٠؟', ['٣', '٨', '٤'], 1, 'صحيح؛ ٨ يبعد خطوتين عن ١٠.', 'قارن المسافة إلى ١٠، لا حجم الرقم المكتوب فقط.', '٣، ٨، ٤'),
      question('mn-3', 'ما العدد الذي يأتي بعد ٢٩ مباشرة؟', ['٢٨', '٣٠', '٣٩'], 1, 'صحيح؛ بعد ٢٩ يأتي ٣٠.', 'عدّ خطوة واحدة للأمام، وانتبه إلى انتقال الآحاد إلى العشرات.', '٢٩ → ؟'),
    ],
  },
  {
    id: 'place-value',
    domain: 'math',
    stage: 4,
    title: 'أفهم العشرات والآحاد',
    objective: 'فهم أن قيمة الرقم مرتبطة بموقعه، وتمثيل العدد بالعشرات والآحاد.',
    model: 'في العدد ٤٣، الرقم ٤ يمثل أربع عشرات (٤٠)، والرقم ٣ يمثل ثلاثة آحاد. نستخدم مجموعات من عشرة ثم نكتب الرمز.',
    guidedPractice: 'مثال: ٢٧ = عشرتان وسبعة آحاد. يمكن تكوين العدد بتجميع ٢٠ و٧.',
    successGuidance: 'أحسنت. جرّب تفكيك أعداد أخرى إلى عشرات وآحاد ثم أعد تركيبها.',
    retryGuidance: 'كوّن مجموعات من عشرة، ثم عدّ الوحدات المتبقية. لا تقرأ العدد كرقمين منفصلين فقط.',
    questions: [
      question('pv-1', 'في العدد ٤٣، كم عشرة كاملة؟', ['٣', '٤', '٤٣'], 1, 'صحيح؛ فيه أربع عشرات.', 'الرقم الأول من اليسار في هذا العدد يمثل العشرات.', '٤٣'),
      question('pv-2', 'أي تفكيك يمثّل العدد ٢٧؟', ['٢٠ + ٧', '٢ + ٧٠', '٢٠ + ٧٠'], 0, 'صحيح؛ ٢٧ تساوي عشرَتين وسبعة آحاد.', 'افصل العشرات عن الآحاد ثم أعد جمعهما.', '٢٧'),
      question('pv-3', 'ما قيمة الرقم ٥ في العدد ٥٢؟', ['٥', '٥٠', '٢'], 1, 'صحيح؛ الرقم ٥ في منزلة العشرات وقيمته ٥٠.', 'تعرّف إلى المنزلة قبل اختيار القيمة.', '٥٢'),
    ],
  },
  {
    id: 'addition-subtraction',
    domain: 'math',
    stage: 5,
    title: 'أفكّر في الجمع والطرح',
    objective: 'استخدام استراتيجية واضحة للجمع والطرح بدل الاعتماد على التخمين.',
    model: 'يمكن تفكيك العدد أو تكوين عشرة كاملة. في ٨ + ٥، نأخذ ٢ من الخمسة لنكمل ١٠، ويتبقى ٣؛ إذن الناتج ١٣.',
    guidedPractice: 'مثال آخر: ١٤ − ٦. اطرح ٤ لتصل إلى ١٠، ثم اطرح ٢ أخرى؛ الناتج ٨.',
    successGuidance: 'جيد. اشرح الاستراتيجية بكلماتك قبل الانتقال إلى تمارين أسرع.',
    retryGuidance: 'استخدم خط الأعداد أو قسّم العدد إلى جزء يصل إلى عشرة، ثم أكمل العملية.',
    questions: [
      question('as-1', 'ما ناتج ٨ + ٥؟', ['١٢', '١٣', '١٤'], 1, 'صحيح؛ نكمل ١٠ بأخذ ٢ من الخمسة، ويتبقى ٣.', 'قسّم ٥ إلى ٢ و٣، ثم احسب ٨ + ٢ + ٣.', '٨ + ٥'),
      question('as-2', 'ما ناتج ١٤ − ٦؟', ['٨', '٩', '٧'], 0, 'صحيح؛ الناتج ٨.', 'اطرح ٤ لتصل إلى ١٠، ثم اطرح ٢ أخرى.', '١٤ − ٦'),
      question('as-3', 'أي جملة عددية تساوي ١٠؟', ['٦ + ٣', '٧ + ٣', '٨ + ٣'], 1, 'صحيح؛ ٧ + ٣ = ١٠.', 'ابحث عن العدد الذي يكمل ٧ إلى ١٠.', '؟ + ٣ = ١٠'),
    ],
  },
  {
    id: 'multiplication-division',
    domain: 'math',
    stage: 6,
    title: 'أفهم المجموعات المتساوية',
    objective: 'ربط الضرب بالمجموعات المتساوية والقسمة بتوزيع الكمية بالتساوي.',
    model: '٣ مجموعات في كل مجموعة عنصران تعني ٢ + ٢ + ٢ = ٦، ويمكن كتابتها ٣ × ٢ = ٦.',
    guidedPractice: 'مثال: ١٢ قطعة توزّع على ٣ مجموعات متساوية؛ في كل مجموعة ٤ قطع.',
    successGuidance: 'أحسنت. استخدم رسم المجموعات أو مصفوفة قبل الاعتماد على الحقيقة الحسابية المحفوظة.',
    retryGuidance: 'ارسم مجموعات متساوية ثم عدّ العناصر الكلية أو وزّعها بالتساوي.',
    questions: [
      question('md-1', '٣ مجموعات، في كل مجموعة عنصران. كم عنصرًا؟', ['٥', '٦', '٨'], 1, 'صحيح؛ ٢ + ٢ + ٢ = ٦.', 'ارسم ثلاث مجموعات وضع عنصرين في كل مجموعة.'),
      question('md-2', 'ما ناتج ٤ × ٥؟', ['٩', '٢٠', '١٥'], 1, 'صحيح؛ أربع مجموعات من خمسة تساوي ٢٠.', 'حوّل الضرب إلى جمع متكرر: ٥ + ٥ + ٥ + ٥.', '٤ × ٥'),
      question('md-3', '١٢ قطعة تقسم بالتساوي على ٣ أطفال. كم قطعة لكل طفل؟', ['٣', '٤', '٥'], 1, 'صحيح؛ ١٢ ÷ ٣ = ٤.', 'وزّع القطع واحدة تلو الأخرى على ثلاثة أطفال حتى تنتهي.'),
    ],
  },
  {
    id: 'math-word-problems',
    domain: 'math',
    stage: 7,
    title: 'أحوّل المسألة إلى خطة حل',
    objective: 'فهم سياق المسألة، وتحديد المطلوب والكمية والعلاقة، ثم اختيار العملية وتفسير الناتج.',
    model: 'اقرأ المسألة، واشرح ما نعرفه وما نبحث عنه. يمكن رسم الكميات أو وضعها في مخطط قبل اختيار العملية.',
    guidedPractice: 'مثال: مع مريم ٤ أقلام، وأعطاها أخوها ٣ أخرى. نعرف البداية والزيادة، لذا نجمع: ٤ + ٣ = ٧.',
    successGuidance: 'جيد. اشرح لماذا اخترت العملية، وتحقق من أن الإجابة تناسب القصة.',
    retryGuidance: 'أعد صياغة السؤال، وميّز بين ما كان موجودًا وما تغيّر وما يطلبه السؤال.',
    questions: [
      question('wp-1', 'مع مريم ٤ أقلام وأعطاها أخوها ٣ أخرى. كم أصبح معها؟', ['١', '٧', '١٢'], 1, 'صحيح؛ نضيف ٣ إلى ٤ فيصبح المجموع ٧.', 'ارسم ٤ أقلام ثم أضف ٣، وبعدها عدّ المجموع.', '٤ + ٣'),
      question('wp-2', 'كان مع عمر ٩ كرات، وأعطى صديقه ٢. كم بقي معه؟', ['٧', '١١', '٦'], 0, 'صحيح؛ عندما نعطي جزءًا من الكمية يقل ما بقي.', 'ابدأ بـ٩ ثم احذف كرتين أو تحرك خطوتين للخلف.', '٩ − ٢'),
      question('wp-3', 'في كل صندوق ٥ كتب، ولدينا صندوقان. كم كتابًا؟', ['٧', '١٠', '٥'], 1, 'صحيح؛ مجموعتان من خمسة تساويان ١٠.', 'ارسم صندوقين وضع ٥ علامات في كل صندوق، ثم اجمع.'),
    ],
  },
  {
    id: 'fractions',
    domain: 'math',
    stage: 8,
    title: 'أفهم الجزء من الكل',
    objective: 'تمييز الكسور بوصفها أجزاء متساوية من كل واحد.',
    model: 'لا يكفي عدد الأجزاء؛ يجب أن تكون الأجزاء متساوية. في النصف، نقسم الكل إلى جزأين متساويين ونأخذ جزءًا واحدًا.',
    guidedPractice: 'مثال: نصف البيتزا يعني جزءًا من جزأين متساويين، وليس أي جزءين مختلفي الحجم.',
    successGuidance: 'أحسنت. اربط الرمز بصورة أجزاء متساوية قبل مقارنة الكسور.',
    retryGuidance: 'تأكد من أن الأجزاء متساوية، ثم حدّد كم جزءًا أخذنا من مجموع الأجزاء.',
    questions: [
      question('fr-1', 'ماذا يعني ١/٢؟', ['جزء واحد من جزأين متساويين', 'جزآن من ثلاثة', 'ثلاثة أجزاء من أربعة'], 0, 'صحيح؛ البسط ١ والمقام ٢.', 'اقرأ المقام بوصفه عدد الأجزاء المتساوية والبسط بوصفه الأجزاء المختارة.', '١/٢'),
      question('fr-2', 'أي مجموعة تمثل ربعًا؟', ['جزء واحد من ٤ أجزاء متساوية', 'جزآن من ٤', '٣ أجزاء من ٤'], 0, 'صحيح؛ الربع جزء واحد من أربعة أجزاء متساوية.', 'تخيّل الكل مقسّمًا إلى أربعة أجزاء متساوية واختر جزءًا واحدًا.', '١/٤'),
      question('fr-3', 'أي كسر أكبر؟', ['١/٢', '١/٤', 'متساويان'], 0, 'صحيح؛ نصف الكل أكبر من ربعه عند تساوي الكل.', 'قارن مقدار الجزء عندما يكون الكل نفسه.'),
    ],
  },
];

export const READING_CURRICULUM_SEQUENCE = readingLessons.map(({ id, stage, title }) => ({ id, stage, title }));
export const MATH_CURRICULUM_SEQUENCE = mathLessons.map(({ id, stage, title }) => ({ id, stage, title }));

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
    if (isPercent(cognition?.pseudoWordScorePercent) &&
        cognition.pseudoWordScorePercent < CURRICULUM_ROUTING_RULES.decodingReviewPercent) {
      return {
        domain, skillId: 'short-vowel-decoding',
        reasonAr: 'نبدأ بمراجعة فك الكلمات وربط الحركات بأصوات الحروف.',
        evidenceAr: `نتيجة مهمة الكلمات غير المعجمية: ${cognition.pseudoWordScorePercent}%؛ هذه نتيجة المهمة وحدها.`,
        isBaseline: false,
      };
    }
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
