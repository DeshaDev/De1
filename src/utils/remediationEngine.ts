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
  const band = gradeLevel <= 2 ? 'foundational' : gradeLevel <= 4 ? 'developing' : 'advanced';

  const phonicsBank: Record<string, RemediationPhonicsDrill[]> = {
    foundational: [
      { id: 1, family: 'تمييز الباء والتاء', spokenWord: 'بُسْتَان', wordMeaning: 'مكان فيه أشجار ونباتات', targetLetter: 'ب', options: [{ letter: 'ب', letterName: 'باء', isCorrect: true, explanation: 'الكلمة تبدأ بحرف الباء.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'التاء حرف آخر؛ ابحث عن صوت بداية الكلمة.' }], ruleTip: 'انظر إلى حرف البداية ونقاطه.' },
      { id: 2, family: 'تمييز التاء والثاء', spokenWord: 'تُفَّاح', wordMeaning: 'فاكهة معروفة', targetLetter: 'ت', options: [{ letter: 'ت', letterName: 'تاء', isCorrect: true, explanation: 'الكلمة تبدأ بالتاء.' }, { letter: 'ث', letterName: 'ثاء', isCorrect: false, explanation: 'الثاء تحمل ثلاث نقاط.' }], ruleTip: 'ميّز عدد النقاط في الحروف المتقاربة.' },
      { id: 3, family: 'تمييز الجيم والحاء', spokenWord: 'جَبَل', wordMeaning: 'ارتفاع كبير من الأرض', targetLetter: 'ج', options: [{ letter: 'ج', letterName: 'جيم', isCorrect: true, explanation: 'الكلمة تبدأ بالجيم.' }, { letter: 'ح', letterName: 'حاء', isCorrect: false, explanation: 'الحاء تشبه الجيم في الرسم من دون نقطة.' }], ruleTip: 'انتبه إلى موضع النقطة أو غيابها.' },
      { id: 4, family: 'تمييز الخاء والجيم', spokenWord: 'خُرُوف', wordMeaning: 'صغير الضأن', targetLetter: 'خ', options: [{ letter: 'خ', letterName: 'خاء', isCorrect: true, explanation: 'الكلمة تبدأ بالخاء.' }, { letter: 'ج', letterName: 'جيم', isCorrect: false, explanation: 'موضع نقطة الجيم مختلف.' }], ruleTip: 'اقرأ أول صوت ثم اختر الحرف المطابق.' },
    ],
    developing: [
      { id: 1, family: 'تمييز السين والصاد', spokenWord: 'سَاقِيَة', wordMeaning: 'قناة للماء', targetLetter: 'س', options: [{ letter: 'س', letterName: 'سين', isCorrect: true, explanation: 'بداية الكلمة سين.' }, { letter: 'ص', letterName: 'صاد', isCorrect: false, explanation: 'الصاد حرف مفخم مختلف.' }], ruleTip: 'قارن شكل الحرف وصوته داخل الكلمة.' },
      { id: 2, family: 'تمييز السين والصاد', spokenWord: 'صَابُون', wordMeaning: 'مادة للتنظيف', targetLetter: 'ص', options: [{ letter: 'س', letterName: 'سين', isCorrect: false, explanation: 'السين لا تطابق بداية الكلمة.' }, { letter: 'ص', letterName: 'صاد', isCorrect: true, explanation: 'بداية الكلمة صاد.' }], ruleTip: 'تدرب على الحروف المتقاربة في الصوت.' },
      { id: 3, family: 'تمييز الطاء والتاء', spokenWord: 'طَائِر', wordMeaning: 'حيوان له جناحان', targetLetter: 'ط', options: [{ letter: 'ط', letterName: 'طاء', isCorrect: true, explanation: 'بداية الكلمة طاء.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'التاء حرف مختلف في الرسم والصوت.' }], ruleTip: 'تتبّع الحرف في بداية الكلمة.' },
      { id: 4, family: 'تمييز الظاء والضاد', spokenWord: 'ظِلّ', wordMeaning: 'منطقة يحجب عنها الضوء', targetLetter: 'ظ', options: [{ letter: 'ض', letterName: 'ضاد', isCorrect: false, explanation: 'الضاد لا تطابق الحرف المكتوب.' }, { letter: 'ظ', letterName: 'ظاء', isCorrect: true, explanation: 'الكلمة تبدأ بالظاء.' }], ruleTip: 'انتبه إلى اختلاف شكل الظاء والضاد.' },
    ],
    advanced: [
      { id: 1, family: 'تمييز الميم والنون في الكلمات الطويلة', spokenWord: 'مَعْلُومَات', wordMeaning: 'حقائق أو بيانات', targetLetter: 'م', options: [{ letter: 'م', letterName: 'ميم', isCorrect: true, explanation: 'الكلمة تبدأ بالميم.' }, { letter: 'ن', letterName: 'نون', isCorrect: false, explanation: 'النون حرف مختلف.' }], ruleTip: 'افحص بداية الكلمة قبل قراءة بقيتها.' },
      { id: 2, family: 'تمييز الضاد والدال', spokenWord: 'ضَوْء', wordMeaning: 'ما يساعد على الرؤية', targetLetter: 'ض', options: [{ letter: 'د', letterName: 'دال', isCorrect: false, explanation: 'الدال لا تطابق أول حرف.' }, { letter: 'ض', letterName: 'ضاد', isCorrect: true, explanation: 'الكلمة تبدأ بالضاد.' }], ruleTip: 'راجع اتجاه الحرف وموضع النقطة.' },
      { id: 3, family: 'تمييز الغين والعين', spokenWord: 'غِذَاء', wordMeaning: 'ما يأكله الكائن الحي', targetLetter: 'غ', options: [{ letter: 'غ', letterName: 'غين', isCorrect: true, explanation: 'الكلمة تبدأ بالغين.' }, { letter: 'ع', letterName: 'عين', isCorrect: false, explanation: 'العين بلا نقطة فوقها.' }], ruleTip: 'قارن الغين والعين في بداية الكلمة.' },
      { id: 4, family: 'تمييز الهاء والحاء', spokenWord: 'هِجْرَة', wordMeaning: 'انتقال من مكان إلى آخر', targetLetter: 'ه', options: [{ letter: 'ح', letterName: 'حاء', isCorrect: false, explanation: 'الحاء لا تطابق الحرف الأول.' }, { letter: 'ه', letterName: 'هاء', isCorrect: true, explanation: 'الكلمة تبدأ بالهاء.' }], ruleTip: 'لاحظ الاختلاف بين شكل الهاء والحاء.' },
    ],
  };

  const syllableBank: Record<string, RemediationSyllableDrill[]> = {
    foundational: [
      { id: 1, targetWord: 'بُسْتَان', wordMeaning: 'مكان فيه أشجار ونباتات', syllables: ['بُسْ', 'تَان'] },
      { id: 2, targetWord: 'تُفَّاح', wordMeaning: 'فاكهة معروفة', syllables: ['تُفْ', 'فَاح'] },
      { id: 3, targetWord: 'قَلَم', wordMeaning: 'أداة للكتابة', syllables: ['قَ', 'لَم'] },
      { id: 4, targetWord: 'مَدْرَسَة', wordMeaning: 'مكان للتعلم', syllables: ['مَدْ', 'رَ', 'سَة'] },
    ],
    developing: [
      { id: 1, targetWord: 'سَاقِيَة', wordMeaning: 'قناة للماء', syllables: ['سَا', 'قِ', 'يَة'] },
      { id: 2, targetWord: 'حَدِيقَة', wordMeaning: 'مكان للنباتات', syllables: ['حَ', 'دِي', 'قَة'] },
      { id: 3, targetWord: 'مَكْتَبَة', wordMeaning: 'مكان للكتب', syllables: ['مَكْ', 'تَ', 'بَة'] },
      { id: 4, targetWord: 'مَعْلُومَة', wordMeaning: 'فكرة أو حقيقة معروفة', syllables: ['مَعْ', 'لُو', 'مَة'] },
    ],
    advanced: [
      { id: 1, targetWord: 'مَعْلُومَات', wordMeaning: 'حقائق أو بيانات', syllables: ['مَعْ', 'لُو', 'مَات'] },
      { id: 2, targetWord: 'مُخْتَبَر', wordMeaning: 'مكان للتجارب العلمية', syllables: ['مُخْ', 'تَ', 'بَر'] },
      { id: 3, targetWord: 'الْبِيئَة', wordMeaning: 'المحيط الذي تعيش فيه الكائنات', syllables: ['الْ', 'بِي', 'ئَة'] },
      { id: 4, targetWord: 'الطَّاقَة', wordMeaning: 'القدرة على إحداث تغيير أو حركة', syllables: ['الطَّ', 'ا', 'قَة'] },
    ],
  };

  const mathBank: Record<string, RemediationMathDrill[]> = {
    foundational: [
      { id: 1, targetNumber: 7, min: 0, max: 20, prompt: 'ضع العدد ٧ على خط الأعداد من ٠ إلى ٢٠.' },
      { id: 2, targetNumber: 12, min: 0, max: 20, prompt: 'قدّر موقع العدد ١٢ على خط الأعداد من ٠ إلى ٢٠.' },
      { id: 3, targetNumber: 16, min: 0, max: 20, prompt: 'أيّهما أقرب إلى ١٦: عشرة أم عشرون؟ ثم حدّد موقعه.' },
      { id: 4, targetNumber: 5, min: 0, max: 20, prompt: 'ضع العدد ٥ بين ٠ و٢٠ وحدّد العدد الأقرب إليه.' },
    ],
    developing: [
      { id: 1, targetNumber: 34, min: 0, max: 100, prompt: 'قدّر موقع العدد ٣٤ على خط الأعداد من ٠ إلى ١٠٠.' },
      { id: 2, targetNumber: 58, min: 0, max: 100, prompt: 'ضع العدد ٥٨ بين ٠ و١٠٠.' },
      { id: 3, targetNumber: 71, min: 0, max: 100, prompt: 'قدّر موقع العدد ٧١ على خط الأعداد من ٠ إلى ١٠٠.' },
      { id: 4, targetNumber: 26, min: 0, max: 100, prompt: 'حدّد موقع العدد ٢٦ على خط الأعداد من ٠ إلى ١٠٠.' },
    ],
    advanced: [
      { id: 1, targetNumber: 135, min: 0, max: 1000, prompt: 'قدّر موقع العدد ١٣٥ على خط الأعداد من ٠ إلى ١٠٠٠.' },
      { id: 2, targetNumber: 428, min: 0, max: 1000, prompt: 'حدّد موقع العدد ٤٢٨ بين ٠ و١٠٠٠.' },
      { id: 3, targetNumber: 760, min: 0, max: 1000, prompt: 'قدّر موقع العدد ٧٦٠ على خط الأعداد من ٠ إلى ١٠٠٠.' },
      { id: 4, targetNumber: 205, min: 0, max: 1000, prompt: 'ضع العدد ٢٠٥ على خط الأعداد من ٠ إلى ١٠٠٠.' },
    ],
  };

  const normalizeArabic = (value: string) =>
    value.replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[\s.,،؛:!?؟'"“”(){}\[\]\\-]/g, '').toLowerCase();

  const normalizeBandWord = (value: string) => normalizeArabic(value);
  const gradeSyllables = syllableBank[band];
  const reviewed = targetsTeacherReviewed
    ? effectiveWords
        .map((word) => gradeSyllables.find((drill) => normalizeBandWord(drill.targetWord) === normalizeBandWord(word)))
        .filter((drill): drill is RemediationSyllableDrill => Boolean(drill))
    : [];
  const uniqueSyllables = new Map<string, RemediationSyllableDrill>();
  for (const drill of [...reviewed, ...gradeSyllables]) {
    if (!uniqueSyllables.has(normalizeBandWord(drill.targetWord))) uniqueSyllables.set(normalizeBandWord(drill.targetWord), drill);
  }
  const syllableDrills = [...uniqueSyllables.values()].slice(0, 4);
  const mathDrills = mathBank[band];
  const phonicsDrills = phonicsBank[band];

  const pacerByBand: Record<string, RemediationPacerPassage> = {
    foundational: { id: 1, title: 'قصة قصيرة للقراءة والتظليل', gradeLevel: `الصف ${gradeLevel} · مستوى تأسيسي`, words: ['فِي', 'صَبَاحٍ', 'جَمِيلٍ،', 'زَارَ', 'عَلِيٌّ', 'جَدَّتَهُ.', 'حَمَلَ', 'سَلَّةً', 'فِيهَا', 'تُفَّاحٌ', 'وَمَوْزٌ.', 'شَكَرَتْهُ', 'الْجَدَّةُ', 'وَقَدَّمَتْ', 'لَهُ', 'مَاءً', 'بَعْدَ', 'اللَّعِبِ.'] },
    developing: { id: 2, title: 'قصة قصيرة للقراءة والتظليل', gradeLevel: `الصف ${gradeLevel} · مستوى متوسط`, words: ['فِي', 'صَبَاحِ', 'يَوْمٍ', 'مُشْرِقٍ،', 'خَرَجَ', 'عُمَرُ', 'إِلَى', 'الْبُسْتَانِ،', 'حَيْثُ', 'تَجْرِي', 'مِيَاهُ', 'السَّاقِيَةِ', 'بِهُدُوءٍ.', 'تَفَقَّدَ', 'الزَّرْعَ', 'ثُمَّ', 'عَادَ', 'إِلَى', 'بَيْتِهِ.'] },
    advanced: { id: 3, title: 'نص قصير للقراءة والتظليل', gradeLevel: `الصف ${gradeLevel} · مستوى متقدم`, words: ['سَجَّلَ', 'الطُّلَّابُ', 'مُلَاحَظَاتِهِمْ', 'بَعْدَ', 'مُقَابَلَةِ', 'كِبَارِ', 'السِّنِّ.', 'رَاجَعُوا', 'الْأَسْمَاءَ', 'وَالتَّوَارِيخَ', 'وَقَارَنُوا', 'الْحِكَايَاتِ', 'بِالْمَصَادِرِ', 'الْمَكْتُوبَةِ.', 'دَوَّنُوا', 'مَوَاضِعَ', 'الِاخْتِلَافِ', 'قَبْلَ', 'نَشْرِ', 'الْمُلَخَّصِ.'] },
  };
  const pacerPassage = pacerByBand[band];

  return {
    clinicalRationale: targetsTeacherReviewed && effectiveWords.length > 0
      ? `أنشطة تعليمية للصف ${gradeLevel}. لا تُستخدم الكلمات التي راجعها المعلم لتخصيص التدريب إلا إذا طابقت كلمة موجودة في بنك تدريبي مضبوط. لا تثبت النتائج وجود اضطراب ولا تمثل الخطة اختبارًا معياريًا أو بروتوكول علاج معتمدًا.`
      : `أنشطة تدريب عامة للصف ${gradeLevel} مختارة بحسب مستوى القراءة، وتشمل أمثلة للحروف والمقاطع وخط الأعداد. الكلمات أمثلة تعليمية وليست أخطاء مرصودة لدى هذا الطفل. الخطة ليست اختبارًا معياريًا أو بروتوكول علاج معتمدًا.`,
    phonicsDrills,
    syllableDrills,
    pacerPassage,
    mathDrills,
  };
}
