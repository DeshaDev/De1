/**
 * Baseera: reusable Arabic literacy and number-sense practice activities.
 * Grounded in Arabic phonology, structured multisensory literacy, and cognitive numerical interventions
 * for developmental dyslexia and dyscalculia in primary grades (1 to 6).
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
  /** Legacy API field name; content is educational context, never a learning rationale. */
  learningRationale: string;
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

  if (typeof plan.learningRationale !== 'string' || !plan.learningRationale.trim()) return false;
  if (!Array.isArray(plan.phonicsDrills) || plan.phonicsDrills.length !== 8) return false;
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

  if (!Array.isArray(plan.syllableDrills) || plan.syllableDrills.length !== 8) return false;
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
    !Array.isArray(passage.words) || passage.words.length < 16 || passage.words.length > 36 ||
    passage.words.some((word) => typeof word !== 'string' || !word.trim())
  ) return false;

  if (!Array.isArray(plan.mathDrills) || plan.mathDrills.length !== 8) return false;
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
 * Deterministic planner for Arabic literacy and numeracy practice.
 * Uses validated AI word-level reading evidence and actual missed math items when available.
 */
export function generateAdaptiveRemediationPlan(params: {
  studentName: string;
  gradeLevel: number;
  effectiveWords: string[];
  targetsTeacherReviewed?: boolean;
  targetsAIValidated?: boolean;
  targetsMathValidated?: boolean;
  mathTargets?: Array<{ targetNumber: number; min: number; max: number }>;
}): RemediationSessionPlan {
  const {
    gradeLevel,
    effectiveWords,
    targetsTeacherReviewed = false,
    targetsAIValidated = false,
    targetsMathValidated = false,
    mathTargets = [],
  } = params;
  const band = gradeLevel <= 2 ? 'foundational' : gradeLevel <= 4 ? 'developing' : 'advanced';

  const phonicsBank: Record<string, RemediationPhonicsDrill[]> = {
    foundational: [
      { id: 1, family: 'تمييز الباء والتاء', spokenWord: 'بَابٌ', wordMeaning: 'مدخل للغرفة أو البيت', targetLetter: 'ب', options: [{ letter: 'ب', letterName: 'باء', isCorrect: true, explanation: 'الكلمة تبدأ بحرف الباء ونقطتها بالأسفل.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'التاء تحمل نقطتين بالأعلى.' }], ruleTip: 'انظر إلى موضع النقطة أسفل الباء.' },
      { id: 2, family: 'تمييز التاء والثاء', spokenWord: 'تَمْرٌ', wordMeaning: 'ثمر النخيل اللذيذ والمغذي', targetLetter: 'ت', options: [{ letter: 'ت', letterName: 'تاء', isCorrect: true, explanation: 'الكلمة تبدأ بالتاء بنقطتين.' }, { letter: 'ث', letterName: 'ثاء', isCorrect: false, explanation: 'الثاء تحمل ثلاث نقاط ويخرج فيها طرف اللسان.' }], ruleTip: 'ميّز عدد النقاط: التاء نقطتان والثاء ثلاث.' },
      { id: 3, family: 'تمييز الجيم والحاء', spokenWord: 'جَبَلٌ', wordMeaning: 'ارتفاع صخري كبير من الأرض', targetLetter: 'ج', options: [{ letter: 'ج', letterName: 'جيم', isCorrect: true, explanation: 'الكلمة تبدأ بالجيم بنقطة في بطنها.' }, { letter: 'ح', letterName: 'حاء', isCorrect: false, explanation: 'الحاء تشبه الجيم لكن دون أي نقطة.' }], ruleTip: 'انتبه إلى موضع نقطة الجيم بالأسفل.' },
      { id: 4, family: 'تمييز الخاء والجيم', spokenWord: 'خُرُوفٌ', wordMeaning: 'حيوان أليف من الماشية يكسوه الصوف', targetLetter: 'خ', options: [{ letter: 'خ', letterName: 'خاء', isCorrect: true, explanation: 'الكلمة تبدأ بالخاء بنقطة فوق رأسها.' }, { letter: 'ج', letterName: 'جيم', isCorrect: false, explanation: 'موضع نقطة الجيم بالأسفل وليس بالأعلى.' }], ruleTip: 'نقطة الخاء تقع دائماً فوق الحرف.' },
      { id: 5, family: 'تمييز الكاف والقاف', spokenWord: 'كُرَةٌ', wordMeaning: 'أداة مستديرة نلعب بها', targetLetter: 'ك', options: [{ letter: 'ك', letterName: 'كاف', isCorrect: true, explanation: 'الكلمة تبدأ بالكاف المهموسة الخفيفة.' }, { letter: 'ق', letterName: 'قاف', isCorrect: false, explanation: 'القاف حرف لهوي مستعلٍ بنقطتين.' }], ruleTip: 'الكاف ترسم كخط منفرج وبداخله كاف صغيرة.' },
      { id: 6, family: 'تمييز السين والشين', spokenWord: 'سَمَكٌ', wordMeaning: 'حيوانات مائية تسبح بزعانف', targetLetter: 'س', options: [{ letter: 'س', letterName: 'سين', isCorrect: true, explanation: 'الكلمة تبدأ بالسين بثلاث أسنان بلا نقط.' }, { letter: 'ش', letterName: 'شين', isCorrect: false, explanation: 'الشين تشبه السين ولكن فوقها ثلاث نقاط.' }], ruleTip: 'السين مجردة من النقط ولها ثلاثة أسنان.' },
      { id: 7, family: 'تمييز القاف والكاف', spokenWord: 'قَمَرٌ', wordMeaning: 'جرم مضيء يزين سماء الليل', targetLetter: 'ق', options: [{ letter: 'ك', letterName: 'كاف', isCorrect: false, explanation: 'الكاف تختلف في الصوت والشكل.' }, { letter: 'ق', letterName: 'قاف', isCorrect: true, explanation: 'الكلمة تبدأ بالقاف بنقطتين بالأعلى.' }], ruleTip: 'القاف لها رأس مستدير ونقطتان بالأعلى.' },
      { id: 8, family: 'تمييز اللام والنون', spokenWord: 'لَبَنٌ', wordMeaning: 'شراب أبيض مغذٍ وصحي', targetLetter: 'ل', options: [{ letter: 'ل', letterName: 'لام', isCorrect: true, explanation: 'الكلمة تبدأ باللام الرشيقة.' }, { letter: 'ن', letterName: 'نون', isCorrect: false, explanation: 'النون صحن مستدير بنقطة وسطه.' }], ruleTip: 'اللام قائمة كالعصا وتتصل بما بعدها.' },
      { id: 9, family: 'تمييز الباء والتاء', spokenWord: 'بَطَّةٌ', wordMeaning: 'طائر مائي أليف يسبح برقة', targetLetter: 'ب', options: [{ letter: 'ب', letterName: 'باء', isCorrect: true, explanation: 'الكلمة تبدأ بالباء بنقطة أسفلها.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'التاء تحمل نقطتين بالأعلى.' }], ruleTip: 'انظر لموضع النقطة أسفل الصحن.' },
      { id: 10, family: 'تمييز الثاء والتاء', spokenWord: 'ثَوْبٌ', wordMeaning: 'لباس جميل وأنيق', targetLetter: 'ث', options: [{ letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'التاء نقطتان فقط.' }, { letter: 'ث', letterName: 'ثاء', isCorrect: true, explanation: 'الكلمة تبدأ بالثاء اللثوية بثلاث نقاط.' }], ruleTip: 'الثاء يخرج فيها طرف اللسان قليلاً.' },
      { id: 11, family: 'تمييز الجيم والحاء', spokenWord: 'جَرَسٌ', wordMeaning: 'أداة معدنية تصدر رنيناً عذباً', targetLetter: 'ج', options: [{ letter: 'ج', letterName: 'جيم', isCorrect: true, explanation: 'الكلمة تبدأ بالجيم بنقطة سفلية.' }, { letter: 'ح', letterName: 'حاء', isCorrect: false, explanation: 'الحاء مهملة بلا أي نقطة.' }], ruleTip: 'الجيم نقطتها بأسفل الحرف دائماً.' },
      { id: 12, family: 'تمييز الخاء والجيم', spokenWord: 'خَيْطٌ', wordMeaning: 'سلك رفيع نستخدمه في الخياطة', targetLetter: 'خ', options: [{ letter: 'خ', letterName: 'خاء', isCorrect: true, explanation: 'الكلمة تبدأ بالخاء ونقطتها بالأعلى.' }, { letter: 'ج', letterName: 'جيم', isCorrect: false, explanation: 'الجيم نقطتها بالأسفل.' }], ruleTip: 'لاحظ النقطة المرتفعة فوق رأس الخاء.' },
      { id: 13, family: 'تمييز الدال والذال', spokenWord: 'دُبٌّ', wordMeaning: 'حيوان فروي قوي يعيش في الغابة', targetLetter: 'د', options: [{ letter: 'د', letterName: 'دال', isCorrect: true, explanation: 'الكلمة تبدأ بالدال المهملة بلا نقطة.' }, { letter: 'ذ', letterName: 'ذال', isCorrect: false, explanation: 'الذال فوقها نقطة لثوية.' }], ruleTip: 'الدال بلا نقطة والذال مع نقطة.' },
      { id: 14, family: 'تمييز الراء والزاي', spokenWord: 'رُمَّانٌ', wordMeaning: 'فاكهة حمراء مليئة بالحبوب الياقوتية', targetLetter: 'ر', options: [{ letter: 'ر', letterName: 'راء', isCorrect: true, explanation: 'الكلمة تبدأ بالراء المهملة.' }, { letter: 'ز', letterName: 'زاي', isCorrect: false, explanation: 'الزاي فوقها نقطة رنانة.' }], ruleTip: 'الراء تنزلق كالزحلوقة دون أي نقطة.' },
      { id: 15, family: 'تمييز الفاء والقاف', spokenWord: 'فَرَاشَةٌ', wordMeaning: 'حشرة جميلة ذات أجنحة ملونة', targetLetter: 'ف', options: [{ letter: 'ف', letterName: 'فاء', isCorrect: true, explanation: 'الكلمة تبدأ بالفاء بنقطة واحدة بالأعلى.' }, { letter: 'ق', letterName: 'قاف', isCorrect: false, explanation: 'القاف تحمل نقطتين وصحنها أعمق.' }], ruleTip: 'الفاء نقطة واحدة فوق الرأس المستدير.' },
      { id: 16, family: 'تمييز العين والغين', spokenWord: 'عُصْفُورٌ', wordMeaning: 'طائر صغير يغرد في الصباح', targetLetter: 'ع', options: [{ letter: 'ع', letterName: 'عين', isCorrect: true, explanation: 'الكلمة تبدأ بالعين الحلقية بلا نقط.' }, { letter: 'غ', letterName: 'غين', isCorrect: false, explanation: 'الغين تحمل نقطة في الأعلى.' }], ruleTip: 'العين عين صافية لا نقطة تعلوها.' },
      { id: 17, family: 'تمييز النون والباء', spokenWord: 'نَحْلَةٌ', wordMeaning: 'حشرة نشيطة تصنع العسل اللذيذ', targetLetter: 'ن', options: [{ letter: 'ن', letterName: 'نون', isCorrect: true, explanation: 'الكلمة تبدأ بالنون بنقطة في الأعلى.' }, { letter: 'ب', letterName: 'باء', isCorrect: false, explanation: 'الباء نقطتها بالأسفل.' }], ruleTip: 'النون نقطتها في الأعلى مثل الشمس.' },
      { id: 18, family: 'تمييز الميم والنون', spokenWord: 'مَوْزٌ', wordMeaning: 'فاكهة صفراء غنية بالطاقة', targetLetter: 'م', options: [{ letter: 'م', letterName: 'ميم', isCorrect: true, explanation: 'الكلمة تبدأ بالميم الشفوية.' }, { letter: 'ن', letterName: 'نون', isCorrect: false, explanation: 'النون حرف مختلف تماماً في الرسم.' }], ruleTip: 'الميم لها دائرة صغيرة جميلة.' },
      { id: 19, family: 'تمييز الهاء والتاء المربوطة', spokenWord: 'هَدِيَّةٌ', wordMeaning: 'عطية جميلة تدخل السرور', targetLetter: 'ه', options: [{ letter: 'ه', letterName: 'هاء', isCorrect: true, explanation: 'الكلمة تبدأ بالهاء ذات الدائرتين المتداخلتين.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'التاء حرف بنقطتين بالأعلى.' }], ruleTip: 'الهاء في البداية ترسم كحلقة داخل حلقة.' },
      { id: 20, family: 'تمييز الواو والياء', spokenWord: 'وَرْدَةٌ', wordMeaning: 'زهرة عطرة ذات ألوان زاهية', targetLetter: 'و', options: [{ letter: 'و', letterName: 'واو', isCorrect: true, explanation: 'الكلمة تبدأ بالواو برأس مستدير وجسم مقوس.' }, { letter: 'ي', letterName: 'ياء', isCorrect: false, explanation: 'الياء في البداية لها نقطتان بالأسفل.' }], ruleTip: 'الواو لا تتصل بما بعدها ورأسها مستدير.' },
    ],
    developing: [
      { id: 1, family: 'تمييز السين والصاد', spokenWord: 'سَمَكَةٌ', wordMeaning: 'كائن بحري يسبح بزعانف ورشاقة', targetLetter: 'س', options: [{ letter: 'س', letterName: 'سين', isCorrect: true, explanation: 'الكلمة تبدأ بالسين المُرَقَّقَة واللسان ينبسط.' }, { letter: 'ص', letterName: 'صاد', isCorrect: false, explanation: 'الصاد حرف مفخم يملأ الفم صدى.' }], ruleTip: 'قارن صوت السين المرقق المنبسط بصوت الصاد المفخم.' },
      { id: 2, family: 'تمييز السين والصاد', spokenWord: 'صَابُونٌ', wordMeaning: 'مادة لطيفة نغسل بها أيدينا لنظافة تامة', targetLetter: 'ص', options: [{ letter: 'س', letterName: 'سين', isCorrect: false, explanation: 'السين مرققة ولا تطابق بداية الكلمة.' }, { letter: 'ص', letterName: 'صاد', isCorrect: true, explanation: 'بداية الكلمة صاد مفخمة ومستعلية.' }], ruleTip: 'الصاد لها سن وصحن أعمق وأقصى اللسان يرتفع.' },
      { id: 3, family: 'تمييز الطاء والتاء', spokenWord: 'طَائِرٌ', wordMeaning: 'مخلوق يسبح في الهواء بجناحين', targetLetter: 'ط', options: [{ letter: 'ط', letterName: 'طاء', isCorrect: true, explanation: 'بداية الكلمة طاء مفخمة قوية ومطبقة.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'التاء حرف مرقق مهموس مختلف.' }], ruleTip: 'الطاء لها عصا قائمة وتفخيم يملأ الفم.' },
      { id: 4, family: 'تمييز الظاء والضاد', spokenWord: 'ظِلٌّ', wordMeaning: 'مساحة تحجب عنها أشعة الشمس فتبرد', targetLetter: 'ظ', options: [{ letter: 'ض', letterName: 'ضاد', isCorrect: false, explanation: 'الضاد ليس لها عصا وتخرج من حافة اللسان.' }, { letter: 'ظ', letterName: 'ظاء', isCorrect: true, explanation: 'الكلمة تبدأ بالظاء اللثوية المفخمة بعصا ونقطة.' }], ruleTip: 'الظاء تجمع بين العصا والنقطة وإخراج طرف اللسان.' },
      { id: 5, family: 'تمييز الضاد والدال', spokenWord: 'ضِفْدَعٌ', wordMeaning: 'حيوان برمائي يقفز بمهارة قرب البرك', targetLetter: 'ض', options: [{ letter: 'ض', letterName: 'ضاد', isCorrect: true, explanation: 'الكلمة تبدأ بالضاد المفخمة المستطيلة.' }, { letter: 'د', letterName: 'دال', isCorrect: false, explanation: 'الدال مرققة تخرج من طرف اللسان.' }], ruleTip: 'الضاد حرف لغتنا العربية الفريد يمتد من حافة اللسان.' },
      { id: 6, family: 'تمييز الراء والزاي', spokenWord: 'رَمْلٌ', wordMeaning: 'حبيبات ناعمة ذهبية على شاطئ البحر', targetLetter: 'ر', options: [{ letter: 'ر', letterName: 'راء', isCorrect: true, explanation: 'الكلمة تبدأ بالراء الخالية من النقط.' }, { letter: 'ز', letterName: 'زاي', isCorrect: false, explanation: 'الزاي لها صوت صفيري ونقطة بالأعلى.' }], ruleTip: 'فرّق بين الراء المهملة والزاي ذات النقطة.' },
      { id: 7, family: 'تمييز الطاء والتاء', spokenWord: 'طَرِيقٌ', wordMeaning: 'ممر واسع نسير عليه بأمان', targetLetter: 'ط', options: [{ letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'التاء مرققة ولا تلائم التفخيم هنا.' }, { letter: 'ط', letterName: 'طاء', isCorrect: true, explanation: 'الكلمة تبدأ بالطاء المفخمة القوية.' }], ruleTip: 'انتبه إلى تفخيم الطاء مقارنة بترقيق التاء.' },
      { id: 8, family: 'تمييز الغين والعين', spokenWord: 'غُرْفَةٌ', wordMeaning: 'مكان مرتب ومريح داخل بيتنا', targetLetter: 'غ', options: [{ letter: 'غ', letterName: 'غين', isCorrect: true, explanation: 'الكلمة تبدأ بالغين ذات النقطة المرتفعة.' }, { letter: 'ع', letterName: 'عين', isCorrect: false, explanation: 'العين حرف مهمل بلا نقطة.' }], ruleTip: 'الغين صوت حلقي رخو تعلوه نقطة.' },
      { id: 9, family: 'تمييز الذال والدال', spokenWord: 'ذَهَبٌ', wordMeaning: 'معدن أصفر براق ثمين', targetLetter: 'ذ', options: [{ letter: 'ذ', letterName: 'ذال', isCorrect: true, explanation: 'الكلمة تبدأ بالذال اللثوية بنقطة.' }, { letter: 'د', letterName: 'دال', isCorrect: false, explanation: 'الدال لا يخرج معها طرف اللسان ولا نقطة لها.' }], ruleTip: 'الذال يخرج معها طرف اللسان برقة ونقطتها بالأعلى.' },
      { id: 10, family: 'تمييز الشين والسين', spokenWord: 'شَاطِئٌ', wordMeaning: 'ساحل جميل تلتقي عنده الرمال بموج البحر', targetLetter: 'ش', options: [{ letter: 'س', letterName: 'سين', isCorrect: false, explanation: 'السين خالية من النقط.' }, { letter: 'ش', letterName: 'شين', isCorrect: true, explanation: 'الكلمة تبدأ بالشين ذات النقاط الثلاث المتفشية.' }], ruleTip: 'الشين يتفشى هواؤها في الفم ولها ثلاث نقاط.' },
      { id: 11, family: 'تمييز الظاء والضاد', spokenWord: 'ظَرْفٌ', wordMeaning: 'غلاف أنيق نضع فيه الرسائل الجميلة', targetLetter: 'ظ', options: [{ letter: 'ظ', letterName: 'ظاء', isCorrect: true, explanation: 'الكلمة تبدأ بالظاء بعصا ونقطة.' }, { letter: 'ض', letterName: 'ضاد', isCorrect: false, explanation: 'الضاد بلا عصا.' }], ruleTip: 'تأكد من شكل العصا والنقطة في الظاء.' },
      { id: 12, family: 'تمييز الكاف والقاف', spokenWord: 'كَنْزٌ', wordMeaning: 'شيء ثمين ومحبوب نحافظ عليه', targetLetter: 'ك', options: [{ letter: 'ق', letterName: 'قاف', isCorrect: false, explanation: 'القاف صوت لهوي عميق ومختلف.' }, { letter: 'ك', letterName: 'كاف', isCorrect: true, explanation: 'الكلمة تبدأ بالكاف المهموسة الخفيفة.' }], ruleTip: 'الكاف تخرج بهواء ناعم ولا تستعلي كالمفخمة.' },
      { id: 13, family: 'تمييز الحاء والهاء', spokenWord: 'حَقِيبَةٌ', wordMeaning: 'وعاء أنيق نحمل فيه كتبنا وأدواتنا', targetLetter: 'ح', options: [{ letter: 'ح', letterName: 'حاء', isCorrect: true, explanation: 'الكلمة تبدأ بالحاء الحلقية الصافية.' }, { letter: 'ه', letterName: 'هاء', isCorrect: false, explanation: 'الهاء تخرج من أقصى الحلق برقة.' }], ruleTip: 'الحاء وسطية نقية والهاء أعمق وأخف.' },
      { id: 14, family: 'تمييز الثاء والسين', spokenWord: 'ثَعْلَبٌ', wordMeaning: 'حيوان ذكي وسريع ذو ذيل كثيف', targetLetter: 'ث', options: [{ letter: 'ث', letterName: 'ثاء', isCorrect: true, explanation: 'الكلمة تبدأ بالثاء اللثوية بثلاث نقاط.' }, { letter: 'س', letterName: 'سين', isCorrect: false, explanation: 'السين صوت صفيري لا يخرج معه طرف اللسان.' }], ruleTip: 'الثاء يخرج فيها طرف اللسان بينما السين داخل الأسنان.' },
      { id: 15, family: 'تمييز القاف والغين', spokenWord: 'قِطَارٌ', wordMeaning: 'مركبة سريعة تسير فوق القضبان الحديدية', targetLetter: 'ق', options: [{ letter: 'ق', letterName: 'قاف', isCorrect: true, explanation: 'الكلمة تبدأ بالقاف اللهوية الصلبة بنقطتين.' }, { letter: 'غ', letterName: 'غين', isCorrect: false, explanation: 'الغين صوت رخو يجري معه الصوت.' }], ruleTip: 'القاف صوت شديد بنقطتين والغين بنقطة واحدة.' },
      { id: 16, family: 'تمييز الجيم والخاء', spokenWord: 'جَدْوَلٌ', wordMeaning: 'مجرى مائي عذب وصغير ينساب في الحقل', targetLetter: 'ج', options: [{ letter: 'ج', letterName: 'جيم', isCorrect: true, explanation: 'الكلمة تبدأ بالجيم بنقطة سفلية.' }, { letter: 'خ', letterName: 'خاء', isCorrect: false, explanation: 'الخاء نقطتها بالأعلى.' }], ruleTip: 'نقطة الجيم في الأسفل ونقطة الخاء في الأعلى.' },
      { id: 17, family: 'تمييز العين والهمزة', spokenWord: 'عَسَلٌ', wordMeaning: 'غذاء حلو ومفيد يصنعه النحل', targetLetter: 'ع', options: [{ letter: 'ع', letterName: 'عين', isCorrect: true, explanation: 'الكلمة تبدأ بالعين الحلقية العميقة.' }, { letter: 'أ', letterName: 'ألف مهموزة', isCorrect: false, explanation: 'الهمزة تقرع أقصى الحلق بشدة.' }], ruleTip: 'العين تخرج من وسط الحلق بانسياب وسلاسة.' },
      { id: 18, family: 'تمييز الفاء والثاء', spokenWord: 'فِيلٌ', wordMeaning: 'أكبر حيوان ثديي على اليابسة ذو خرطوم طويل', targetLetter: 'ف', options: [{ letter: 'ف', letterName: 'فاء', isCorrect: true, explanation: 'الكلمة تبدأ بالفاء الشفوية بنقطة واحدة.' }, { letter: 'ث', letterName: 'ثاء', isCorrect: false, explanation: 'الثاء لثوية بثلاث نقاط.' }], ruleTip: 'الفاء تلامس فيها الأسنان العلوية الشفة السفلية.' },
      { id: 19, family: 'تمييز النون واللام', spokenWord: 'نَافِذَةٌ', wordMeaning: 'فتحة في جدار الغرفة يدخل منها الضوء والهواء', targetLetter: 'ن', options: [{ letter: 'ن', letterName: 'نون', isCorrect: true, explanation: 'الكلمة تبدأ بالنون الأنفية الغناء.' }, { letter: 'ل', letterName: 'لام', isCorrect: false, explanation: 'اللام حرف مائع ينزلق من حافتي اللسان.' }], ruleTip: 'النون صحن وسطه نقطة وحيدة في الأعلى.' },
      { id: 20, family: 'تمييز الصاد والضاد', spokenWord: 'صُنْدُوقٌ', wordMeaning: 'وعاء مكعب لحفظ الألعاب والأدوات الثمينة', targetLetter: 'ص', options: [{ letter: 'ص', letterName: 'صاد', isCorrect: true, explanation: 'الكلمة تبدأ بالصاد المهملة بلا نقط.' }, { letter: 'ض', letterName: 'ضاد', isCorrect: false, explanation: 'الضاد حرف معجم تعلوه نقطة.' }], ruleTip: 'الصاد خالية من أي نقطة بينما الضاد فوقها نقطة.' },
    ],
    advanced: [
      { id: 1, family: 'تمييز الميم والنون في الكلمات الطويلة', spokenWord: 'مَعْلُومَاتٌ', wordMeaning: 'حقائق وبيانات علمية مفيدة', targetLetter: 'م', options: [{ letter: 'م', letterName: 'ميم', isCorrect: true, explanation: 'الكلمة تبدأ بالميم الشفوية.' }, { letter: 'ن', letterName: 'نون', isCorrect: false, explanation: 'النون حرف مختلف تماماً.' }], ruleTip: 'افحص بداية الكلمة بدقة قبل قراءة سياقها.' },
      { id: 2, family: 'تمييز الضاد والدال في الكلمات الدقيقة', spokenWord: 'ضَوْءٌ', wordMeaning: 'شعاع مشرق ينير الدروب ويبدد الظلام', targetLetter: 'ض', options: [{ letter: 'د', letterName: 'دال', isCorrect: false, explanation: 'الدال مرققة ولا تطابق بداية الكلمة.' }, { letter: 'ض', letterName: 'ضاد', isCorrect: true, explanation: 'الكلمة تبدأ بالضاد المفخمة المستطيلة.' }], ruleTip: 'انتبه لاستطالة الضاد وتفخيمها وتمايزها عن الدال.' },
      { id: 3, family: 'تمييز الغين والعين في المفردات الأكاديمية', spokenWord: 'غِذَاءٌ', wordMeaning: 'طعام صحي يبني أجسادنا ويمدنا بالحيوية', targetLetter: 'غ', options: [{ letter: 'غ', letterName: 'غين', isCorrect: true, explanation: 'الكلمة تبدأ بالغين المعجمة بنقطة.' }, { letter: 'ع', letterName: 'عين', isCorrect: false, explanation: 'العين بلا نقطة تعلوها.' }], ruleTip: 'الغين صوت رخو مستعلٍ تعلوه نقطة وحيدة.' },
      { id: 4, family: 'تمييز الهاء والحاء في الاشتقاقات المتقدمة', spokenWord: 'هِجْرَةٌ', wordMeaning: 'انتقال وسفر نحو أفق جديد ومشرق', targetLetter: 'ه', options: [{ letter: 'ح', letterName: 'حاء', isCorrect: false, explanation: 'الحاء مخرجها وسط الحلق وليس أقصاه.' }, { letter: 'ه', letterName: 'هاء', isCorrect: true, explanation: 'الكلمة تبدأ بالهاء الحلقية الخفيفة.' }], ruleTip: 'الهاء تخرج مع زفرة هوائية ناعمة من أقصى الحلق.' },
      { id: 5, family: 'تمييز التاء والثاء في التحليل الصوتي', spokenWord: 'تَحْلِيلٌ', wordMeaning: 'تفكيك المسألة إلى عناصرها لفهمها بعمق', targetLetter: 'ت', options: [{ letter: 'ت', letterName: 'تاء', isCorrect: true, explanation: 'الكلمة تبدأ بالتاء بنقطتين.' }, { letter: 'ث', letterName: 'ثاء', isCorrect: false, explanation: 'الثاء لثوية بثلاث نقاط.' }], ruleTip: 'تحقق من نطق أول حرف قبل اختيار التحليل.' },
      { id: 6, family: 'تمييز الباء والتاء في بدايات الجذور', spokenWord: 'بَحْثٌ', wordMeaning: 'استقصاء منظم للحقائق والمعارف', targetLetter: 'ب', options: [{ letter: 'ب', letterName: 'باء', isCorrect: true, explanation: 'الكلمة تبدأ بالباء بنقطة سفلية.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'التاء نقطتان في الأعلى.' }], ruleTip: 'قارن موضع النقطة أسفل الباء وأعلى التاء.' },
      { id: 7, family: 'تمييز الميم والنون في المصطلحات العلمية', spokenWord: 'مَصْدَرٌ', wordMeaning: 'مرجع أصيل وموثوق نستقي منه المعرفة', targetLetter: 'م', options: [{ letter: 'ن', letterName: 'نون', isCorrect: false, explanation: 'النون تختلف في الرسم والمخرج.' }, { letter: 'م', letterName: 'ميم', isCorrect: true, explanation: 'الكلمة تبدأ بالميم الشفوية.' }], ruleTip: 'طابق الحرف المكتوب بالصوت المنطوق فوراً.' },
      { id: 8, family: 'تمييز الدال والذال في السياقات البرهانية', spokenWord: 'دَلِيلٌ', wordMeaning: 'برهان ناصع يؤكد الحقيقة ويبين الصواب', targetLetter: 'د', options: [{ letter: 'د', letterName: 'دال', isCorrect: true, explanation: 'الكلمة تبدأ بالدال المهملة.' }, { letter: 'ذ', letterName: 'ذال', isCorrect: false, explanation: 'الذال لثوية تعلوها نقطة.' }], ruleTip: 'الدال لا نقطة لها واللسان داخل الفم لا يخرج.' },
      { id: 9, family: 'تمييز التاء والطاء في المفردات التجريبية', spokenWord: 'تَجْرِبَةٌ', wordMeaning: 'نشاط علمي عملي لاختبار فكرة أو فرضية', targetLetter: 'ت', options: [{ letter: 'ط', letterName: 'طاء', isCorrect: false, explanation: 'الطاء مفخمة ومطبقة وليست مرققة.' }, { letter: 'ت', letterName: 'تاء', isCorrect: true, explanation: 'الكلمة تبدأ بالتاء المُرَقَّقَة اللطيفة.' }], ruleTip: 'التاء تنبسط معها الشفتان برقة دون أي تفخيم.' },
      { id: 10, family: 'تمييز الباء والتاء في معالجة البيانات', spokenWord: 'بَيَانَاتٌ', wordMeaning: 'أرقام ومعلومات منظمة للدراسة والاستنتاج', targetLetter: 'ب', options: [{ letter: 'ب', letterName: 'باء', isCorrect: true, explanation: 'الكلمة تبدأ بالباء بنقطة بالأسفل.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'التاء نقطتان في الأعلى.' }], ruleTip: 'انتبه للنقطة السفلية في الباء في بداية الكلمة.' },
      { id: 11, family: 'تمييز التاء والطاء في التفاصيل البصرية', spokenWord: 'تَفَاصِيلُ', wordMeaning: 'دقائق وجزئيات توضح المعنى وتكمله', targetLetter: 'ت', options: [{ letter: 'ت', letterName: 'تاء', isCorrect: true, explanation: 'الكلمة تبدأ بالتاء المُرَقَّقَة.' }, { letter: 'ط', letterName: 'طاء', isCorrect: false, explanation: 'الطاء حرف مفخم بعصا قائمة.' }], ruleTip: 'التاء رقيقة ونقطتاها واضحتان بالأعلى.' },
      { id: 12, family: 'تمييز الدال والضاد في الدراسات الأكاديمية', spokenWord: 'دِرَاسَةٌ', wordMeaning: 'عمل ذهني منظم ومنهجي لفهم العلوم', targetLetter: 'د', options: [{ letter: 'د', letterName: 'دال', isCorrect: true, explanation: 'الكلمة تبدأ بالدال المُرَقَّقَة المهملة.' }, { letter: 'ض', letterName: 'ضاد', isCorrect: false, explanation: 'الضاد مفخمة تعلوها نقطة.' }], ruleTip: 'الدال خفيفة واللسان يقرع أصول الثنايا برقة.' },
      { id: 13, family: 'تمييز الحاء والخاء في التاريخ والحضارة', spokenWord: 'حَضَارَةٌ', wordMeaning: 'إنجازات إنسانية متقدمة في الفكر والبناء', targetLetter: 'ح', options: [{ letter: 'ح', letterName: 'حاء', isCorrect: true, explanation: 'الكلمة تبدأ بالحاء المهملة بلا نقط.' }, { letter: 'خ', letterName: 'خاء', isCorrect: false, explanation: 'الخاء تعلوها نقطة ومخرجها أدنى الحلق.' }], ruleTip: 'الحاء صافية تخرج من وسط الحلق بلا أي نقطة.' },
      { id: 14, family: 'تمييز الألف والهمزة في الابتكار', spokenWord: 'ابْتِكَارٌ', wordMeaning: 'إبداع فكرة حديثة لم تسبق إليها العقول', targetLetter: 'ا', options: [{ letter: 'ا', letterName: 'ألف وصل', isCorrect: true, explanation: 'الكلمة تبدأ بهمزة وصل تسقط في درج الكلام.' }, { letter: 'ع', letterName: 'عين', isCorrect: false, explanation: 'العين مخرجها وسط الحلق ورسمها مختلف.' }], ruleTip: 'مصدر الافتعال يبدأ دائماً بهمزة وصل قائمة.' },
      { id: 15, family: 'تمييز الألف والهمزة في الاستكشاف', spokenWord: 'اسْتِكْشَافٌ', wordMeaning: 'رحلة مشوقة للتعرف على المجهول وتوسيع المدارك', targetLetter: 'ا', options: [{ letter: 'ا', letterName: 'ألف وصل', isCorrect: true, explanation: 'الكلمة تبدأ بهمزة وصل على وزن استفعال.' }, { letter: 'ه', letterName: 'هاء', isCorrect: false, explanation: 'الهاء حرف آخر تماماً.' }], ruleTip: 'ألف الوصل قائمة كالقلم بلا همزة مرسومة.' },
      { id: 16, family: 'تمييز الميم والنون في المجتمع', spokenWord: 'مُجْتَمَعٌ', wordMeaning: 'بيئة إنسانية متعاونة نعيش فيها بمحبة وأمان', targetLetter: 'م', options: [{ letter: 'م', letterName: 'ميم', isCorrect: true, explanation: 'الكلمة تبدأ بالميم المضمومة.' }, { letter: 'ن', letterName: 'نون', isCorrect: false, explanation: 'النون صحن وسطه نقطة.' }], ruleTip: 'الميم حرف شفوي مستدير الرأس.' },
      { id: 17, family: 'تمييز الميم والهاء في الهندسة', spokenWord: 'مُهَنْدِسٌ', wordMeaning: 'مبدع يخطط ويبني المدن والجسور ببراعة', targetLetter: 'م', options: [{ letter: 'م', letterName: 'ميم', isCorrect: true, explanation: 'الكلمة تبدأ بالميم المضمومة.' }, { letter: 'ه', letterName: 'هاء', isCorrect: false, explanation: 'الهاء الحرف الثاني في الكلمة وليست البداية.' }], ruleTip: 'انظر لأول حرف يفتتح به اللفظ.' },
      { id: 18, family: 'تمييز الألف والتاء في الاكتشاف', spokenWord: 'اكْتِشَافٌ', wordMeaning: 'الوصول إلى سر من أسرار الطبيعة والكون', targetLetter: 'ا', options: [{ letter: 'ا', letterName: 'ألف وصل', isCorrect: true, explanation: 'الكلمة تبدأ بألف الوصل المستقيمة.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'التاء تلي الكاف وليست الحرف الأول.' }], ruleTip: 'ألف الوصل تستفتح بها مصادر الأفعال الخماسية.' },
      { id: 19, family: 'تمييز التاء والطاء في التواصل', spokenWord: 'تَوَاصُلٌ', wordMeaning: 'تبادل الأفكار والمشاعر بلطف وتفاهم', targetLetter: 'ت', options: [{ letter: 'ت', letterName: 'تاء', isCorrect: true, explanation: 'الكلمة تبدأ بالتاء المُرَقَّقَة المفتوحة.' }, { letter: 'ط', letterName: 'طاء', isCorrect: false, explanation: 'الطاء حرف مطبق مفخم.' }], ruleTip: 'التاء مرققة ينبسط معها الفم بلطف.' },
      { id: 20, family: 'تمييز الألف والخاء في الاختراع', spokenWord: 'اخْتِرَاعٌ', wordMeaning: 'صناعة جهاز أو وسيلة تخدم البشرية وتيسر الحياة', targetLetter: 'ا', options: [{ letter: 'ا', letterName: 'ألف وصل', isCorrect: true, explanation: 'الكلمة تبدأ بهمزة وصل قائمة.' }, { letter: 'خ', letterName: 'خاء', isCorrect: false, explanation: 'الخاء الحرف الثاني في الجذر.' }], ruleTip: 'الألف قائمة تليها الخاء المعجمة بنقطة بالأعلى.' },
    ],
  };

  const syllableBank: Record<string, RemediationSyllableDrill[]> = {
    foundational: [
      { id: 1, targetWord: 'حَدِيقَةٌ', wordMeaning: 'مكان جميل فيه أزهار ونباتات', syllables: ['حَ', 'دِي', 'قَ', 'ةٌ'] },
      { id: 2, targetWord: 'كِتَابٌ', wordMeaning: 'أوراق مجموعة للقراءة والمعرفة', syllables: ['كِ', 'تَا', 'بٌ'] },
      { id: 3, targetWord: 'قَلَمٌ', wordMeaning: 'أداة جميلة للكتابة والرسم', syllables: ['قَ', 'لَ', 'مٌ'] },
      { id: 4, targetWord: 'مَدْرَسَةٌ', wordMeaning: 'مكان مبهج نلتقي فيه لنتعلم ونلعب', syllables: ['مَدْ', 'رَ', 'سَ', 'ةٌ'] },
      { id: 5, targetWord: 'سَمَكٌ', wordMeaning: 'كائنات بحرية تسبح بزعانف ملونة', syllables: ['سَ', 'مَ', 'كٌ'] },
      { id: 6, targetWord: 'قَمَرٌ', wordMeaning: 'جرم مضيء في سماء الليل', syllables: ['قَ', 'مَ', 'رٌ'] },
      { id: 7, targetWord: 'وَرَقٌ', wordMeaning: 'صفحات بيضاء جميلة نكتب ونرسم عليها', syllables: ['وَ', 'رَ', 'قٌ'] },
      { id: 8, targetWord: 'نَجْمٌ', wordMeaning: 'جسم متلألئ في السماء العالية', syllables: ['نَجْ', 'مٌ'] },
      { id: 9, targetWord: 'أَسَدٌ', wordMeaning: 'حيوان قوي وشجاع يعيش في البرية', syllables: ['أَ', 'سَ', 'دٌ'] },
      { id: 10, targetWord: 'بَحْرٌ', wordMeaning: 'مسطح واسع وعميق من الماء الأزرق', syllables: ['بَحْ', 'رٌ'] },
      { id: 11, targetWord: 'وَرْدٌ', wordMeaning: 'زهور عطرة ذات رائحة منعشة', syllables: ['وَرْ', 'دٌ'] },
      { id: 12, targetWord: 'نَهْرٌ', wordMeaning: 'مجرى طبيعي للماء العذب النقي', syllables: ['نَهْ', 'رٌ'] },
      { id: 13, targetWord: 'شَجَرَةٌ', wordMeaning: 'نبات كبير وارف الظلال يعطينا الأكسجين والثمار', syllables: ['شَ', 'جَ', 'رَ', 'ةٌ'] },
      { id: 14, targetWord: 'عَلَمٌ', wordMeaning: 'راية ترفرف بشموخ وفخر في سماء الوطن', syllables: ['عَ', 'لَ', 'مٌ'] },
      { id: 15, targetWord: 'جَبَلٌ', wordMeaning: 'كتلة صخرية شامخة تعانق السحاب', syllables: ['جَ', 'بَ', 'لٌ'] },
      { id: 16, targetWord: 'طَرِيقٌ', wordMeaning: 'درب ممهد نسير فيه بأمان واطمئنان', syllables: ['طَ', 'رِي', 'قٌ'] },
      { id: 17, targetWord: 'مَسْجِدٌ', wordMeaning: 'بيت من بيوت الله للصلاة والسكينة', syllables: ['مَسْ', 'جِ', 'دٌ'] },
      { id: 18, targetWord: 'مَطَرٌ', wordMeaning: 'حبات ماء نقية تنزل من السحاب لتروي الأرض', syllables: ['مَ', 'طَ', 'رٌ'] },
      { id: 19, targetWord: 'لَبَنٌ', wordMeaning: 'غذاء أبيض صافٍ يقوي العظام والأسنان', syllables: ['لَ', 'بَ', 'نٌ'] },
      { id: 20, targetWord: 'بَلَدٌ', wordMeaning: 'وطن غالٍ نحبه ونعيش في رحابه بأمان', syllables: ['بَ', 'لَ', 'دٌ'] },
    ],
    developing: [
      { id: 1, targetWord: 'سَمَكَةٌ', wordMeaning: 'كائن بحري رشيق يسبح في الماء العذب', syllables: ['سَ', 'مَ', 'كَ', 'ةٌ'] },
      { id: 2, targetWord: 'حَدِيقَةٌ', wordMeaning: 'واحة خضراء مبهجة مليئة بالأزهار والرياحين', syllables: ['حَ', 'دِي', 'قَ', 'ةٌ'] },
      { id: 3, targetWord: 'مَكْتَبَةٌ', wordMeaning: 'صرح ثقافي يضم آلاف الكتب والقصص المفيدة', syllables: ['مَكْ', 'تَ', 'بَ', 'ةٌ'] },
      { id: 4, targetWord: 'مَعْلُومَةٌ', wordMeaning: 'فكرة مفيدة وحقيقة علمية تثري عقولنا', syllables: ['مَعْ', 'لُو', 'مَ', 'ةٌ'] },
      { id: 5, targetWord: 'مَطَرٌ', wordMeaning: 'خير ينزل من السماء فيحيي النبات والزرع', syllables: ['مَ', 'طَ', 'رٌ'] },
      { id: 6, targetWord: 'صَدِيقٌ', wordMeaning: 'رفيق وفي يشاركنا اللعب والتعلم والمحبة', syllables: ['صَ', 'دِي', 'قٌ'] },
      { id: 7, targetWord: 'حُقُولٌ', wordMeaning: 'مساحات خضراء شاسعة تزرع فيها سنابل القمح', syllables: ['حُ', 'قُو', 'لٌ'] },
      { id: 8, targetWord: 'مَدِينَةٌ', wordMeaning: 'حاضرة واسعة تضم مدارس وأسواقاً ومتاحف', syllables: ['مَ', 'دِي', 'نَ', 'ةٌ'] },
      { id: 9, targetWord: 'مَرْسَمٌ', wordMeaning: 'قاعة فنية ملهمة نلون فيها بالألوان الجميلة', syllables: ['مَرْ', 'سَ', 'مٌ'] },
      { id: 10, targetWord: 'شَاطِئٌ', wordMeaning: 'ضفة رملية ذهبية تستقبل أمواج البحر الهادئة', syllables: ['شَا', 'طِ', 'ئٌ'] },
      { id: 11, targetWord: 'رِحْلَةٌ', wordMeaning: 'جولة استكشافية ممتعة في الطبيعة مع الأصدقاء', syllables: ['رِحْ', 'لَ', 'ةٌ'] },
      { id: 12, targetWord: 'كَنْزٌ', wordMeaning: 'جوهرة ثمينة ومقتنيات نفيسة نحافظ عليها', syllables: ['كَنْ', 'زٌ'] },
      { id: 13, targetWord: 'سَفِينَةٌ', wordMeaning: 'مركب عملاق يبحر في المحيط بأمان وقوة', syllables: ['سَ', 'فِي', 'نَ', 'ةٌ'] },
      { id: 14, targetWord: 'عُصْفُورٌ', wordMeaning: 'طائر مغرد يبني عشه بين أغصان الشجر', syllables: ['عُصْ', 'فُو', 'رٌ'] },
      { id: 15, targetWord: 'صُنْدُوقٌ', wordMeaning: 'وعاء متين لحفظ الألعاب والأدوات الثمينة', syllables: ['صُنْ', 'دُو', 'قٌ'] },
      { id: 16, targetWord: 'طَاوُوسٌ', wordMeaning: 'طائر بديع يتزين بريش ملون جذاب ومبهر', syllables: ['طَا', 'وُو', 'سٌ'] },
      { id: 17, targetWord: 'حَقِيبَةٌ', wordMeaning: 'حقيبة مدرسية أنيقة تضم دفاترنا الملونة', syllables: ['حَ', 'قِي', 'بَ', 'ةٌ'] },
      { id: 18, targetWord: 'مِفْتَاحٌ', wordMeaning: 'أداة معدنية نفتح بها الأبواب والصناديق', syllables: ['مِفْ', 'تَا', 'حٌ'] },
      { id: 19, targetWord: 'قِطَارٌ', wordMeaning: 'مركبة طويلة وسريعة تسافر بين المحطات', syllables: ['قِ', 'طَا', 'رٌ'] },
      { id: 20, targetWord: 'نَافِذَةٌ', wordMeaning: 'شرفة زجاجية نطل منها على شروق الشمس الجميل', syllables: ['نَا', 'فِ', 'ذَ', 'ةٌ'] },
    ],
    advanced: [
      { id: 1, targetWord: 'مَعْلُومَاتٌ', wordMeaning: 'بيانات وحقائق علمية دقيقة ومرتبة', syllables: ['مَعْ', 'لُو', 'مَا', 'تٌ'] },
      { id: 2, targetWord: 'مُخْتَبَرٌ', wordMeaning: 'مقر علمي مجهز بالأدوات لإجراء التجارب المتقنة', syllables: ['مُخْ', 'تَ', 'بَ', 'رٌ'] },
      { id: 3, targetWord: 'الْبِيئَةُ', wordMeaning: 'المحيط الطبيعي الحيوي الذي نحرص على نظافته', syllables: ['الْ', 'بِي', 'ئَ', 'ةُ'] },
      { id: 4, targetWord: 'مُشَارَكَةٌ', wordMeaning: 'تعاون وعمل جماعي يحقق النجاح والتفوق للجميع', syllables: ['مُ', 'شَا', 'رَ', 'كَ', 'ةٌ'] },
      { id: 5, targetWord: 'مَصَادِرُ', wordMeaning: 'مراجع وأصول نعتمد عليها في توثيق أبحاثنا', syllables: ['مَ', 'صَا', 'دِ', 'رُ'] },
      { id: 6, targetWord: 'مُسْتَقْبَلٌ', wordMeaning: 'الأيام المشرقة القادمة المليئة بالإنجازات', syllables: ['مُسْ', 'تَقْ', 'بَ', 'لٌ'] },
      { id: 7, targetWord: 'اسْتِقْلَالٌ', wordMeaning: 'اعتماد راسخ على النفس وبناء القدرات الذاتية', syllables: ['اسْ', 'تِقْ', 'لَا', 'لٌ'] },
      { id: 8, targetWord: 'تَجْرِبَةٌ', wordMeaning: 'نشاط علمي ممنهج لاختبار الأفكار وصقلها', syllables: ['تَجْ', 'رِ', 'بَ', 'ةٌ'] },
      { id: 9, targetWord: 'بَيَانَاتٌ', wordMeaning: 'أرقام وإحصاءات دقيقة يتم جمعها وتحليلها', syllables: ['بَ', 'يَا', 'نَا', 'تٌ'] },
      { id: 10, targetWord: 'تَفَاصِيلُ', wordMeaning: 'عناصر دقيقة تكمل الفكرة وتجعل الرؤية جلية', syllables: ['تَ', 'فَا', 'صِي', 'لُ'] },
      { id: 11, targetWord: 'دِرَاسَةٌ', wordMeaning: 'بحث معرفي منظم لاستكشاف الحقائق العلمية', syllables: ['دِ', 'رَا', 'سَ', 'ةٌ'] },
      { id: 12, targetWord: 'حَضَارَةٌ', wordMeaning: 'إرث إنساني خالد وثقافة عريقة متوارثة', syllables: ['حَ', 'ضَا', 'رَ', 'ةٌ'] },
      { id: 13, targetWord: 'ابْتِكَارٌ', wordMeaning: 'تصميم حلول جديدة وغير مسبوقة تخدم الإنسانية', syllables: ['ابْ', 'تِ', 'كَا', 'رٌ'] },
      { id: 14, targetWord: 'اسْتِكْشَافٌ', wordMeaning: 'رحلة معرفية لفك أسرار الكواكب والبحار', syllables: ['اسْ', 'تِكْ', 'شَا', 'فٌ'] },
      { id: 15, targetWord: 'مُجْتَمَعٌ', wordMeaning: 'نسيج إنساني متماسك يبنى على المحبة والتعاون', syllables: ['مُجْ', 'تَ', 'مَ', 'عٌ'] },
      { id: 16, targetWord: 'مُهَنْدِسٌ', wordMeaning: 'مبتكر يصمم المنشآت والتقنيات الذكية بدقة', syllables: ['مُ', 'هَنْ', 'دِ', 'سٌ'] },
      { id: 17, targetWord: 'اكْتِشَافٌ', wordMeaning: 'التوصل إلى معرفة علمية جديدة تغير حياة البشر', syllables: ['اكْ', 'تِ', 'شَا', 'فٌ'] },
      { id: 18, targetWord: 'تَوَاصُلٌ', wordMeaning: 'تبادل حواري راقٍ يثمر تفاهماً وتعاوناً إيجابياً', syllables: ['تَ', 'وَا', 'صُ', 'لٌ'] },
      { id: 19, targetWord: 'مُسْتَشْفَى', wordMeaning: 'صرح طبي يقدم الرعاية والعلاج لشفاء المرضى', syllables: ['مُسْ', 'تَشْ', 'فَى'] },
      { id: 20, targetWord: 'اخْتِرَاعٌ', wordMeaning: 'ابتكار أداة تقنية متطورة تحل مشاكل العصر', syllables: ['اخْ', 'تِ', 'رَا', 'عٌ'] },
    ],
  };

  const mathBank: Record<string, RemediationMathDrill[]> = {
    foundational: [
      { id: 1, targetNumber: 7, min: 0, max: 20, prompt: 'ضع العدد ٧ على خط الأعداد من ٠ إلى ٢٠، وتذكر أنه بعد العدد ٥ بخطوتين.' },
      { id: 2, targetNumber: 12, min: 0, max: 20, prompt: 'قدّر موقع العدد ١٢ على خط الأعداد من ٠ إلى ٢٠ (أقرب إلى العشرة من العشرين).' },
      { id: 3, targetNumber: 16, min: 0, max: 20, prompt: 'أيّهما أقرب إلى ١٦: عشرة أم عشرون؟ حدّد موقعه بدقة.' },
      { id: 4, targetNumber: 5, min: 0, max: 20, prompt: 'ضع العدد ٥ بين ٠ و٢٠، ولاحظ أنه ربع المسافة نحو العشرين.' },
      { id: 5, targetNumber: 9, min: 0, max: 20, prompt: 'حدّد موضع العدد ٩ على خط الأعداد من ٠ إلى ٢٠، خطوة واحدة قبل العشرة.' },
      { id: 6, targetNumber: 14, min: 0, max: 20, prompt: 'حدّد موضع العدد ١٤ على خط الأعداد من ٠ إلى ٢٠، قريباً من المنتصف.' },
      { id: 7, targetNumber: 3, min: 0, max: 20, prompt: 'حدّد موضع العدد ٣ على خط الأعداد من ٠ إلى ٢٠ بالقرب من نقطة البداية.' },
      { id: 8, targetNumber: 18, min: 0, max: 20, prompt: 'حدّد موضع العدد ١٨ على خط الأعداد من ٠ إلى ٢٠، خطوتان فقط قبل العشرين.' },
      { id: 9, targetNumber: 2, min: 0, max: 20, prompt: 'حدّد موضع العدد ٢ على خط الأعداد من ٠ إلى ٢٠ في بداية المسار.' },
      { id: 10, targetNumber: 11, min: 0, max: 20, prompt: 'حدّد موضع العدد ١١ على خط الأعداد من ٠ إلى ٢٠، خطوة واحدة بعد العشرة.' },
      { id: 11, targetNumber: 19, min: 0, max: 20, prompt: 'حدّد موضع العدد ١٩ على خط الأعداد من ٠ إلى ٢٠ ملاصقاً للعدد ٢٠.' },
      { id: 12, targetNumber: 6, min: 0, max: 20, prompt: 'حدّد موضع العدد ٦ على خط الأعداد من ٠ إلى ٢٠ خطوة واحدة بعد الخمسة.' },
      { id: 13, targetNumber: 15, min: 0, max: 20, prompt: 'حدّد موضع العدد ١٥ على خط الأعداد من ٠ إلى ٢٠، في المنتصف بين ١٠ و٢٠.' },
      { id: 14, targetNumber: 8, min: 0, max: 20, prompt: 'حدّد موضع العدد ٨ على خط الأعداد من ٠ إلى ٢٠، خطوتين قبل العشرة.' },
      { id: 15, targetNumber: 4, min: 0, max: 20, prompt: 'حدّد موضع العدد ٤ على خط الأعداد من ٠ إلى ٢٠، خطوة واحدة قبل الخمسة.' },
      { id: 16, targetNumber: 17, min: 0, max: 20, prompt: 'حدّد موضع العدد ١٧ على خط الأعداد من ٠ إلى ٢٠، أقرب إلى العشرين.' },
      { id: 17, targetNumber: 10, min: 0, max: 20, prompt: 'ضع العدد ١٠ في منتصف خط الأعداد بالضبط بين ٠ و٢٠.' },
      { id: 18, targetNumber: 13, min: 0, max: 20, prompt: 'حدّد موضع العدد ١٣ على خط الأعداد من ٠ إلى ٢٠، ثلاث خطوات بعد العشرة.' },
      { id: 19, targetNumber: 1, min: 0, max: 20, prompt: 'حدّد موضع العدد ١ على خط الأعداد من ٠ إلى ٢٠ مباشرة بعد الصفر.' },
      { id: 20, targetNumber: 20, min: 0, max: 20, prompt: 'ضع المؤشر عند نهاية خط الأعداد تماماً عند العدد ٢٠.' },
    ],
    developing: [
      { id: 1, targetNumber: 34, min: 0, max: 100, prompt: 'قدّر موقع العدد ٣٤ على خط الأعداد من ٠ إلى ١٠٠، أقرب إلى الثلاثين من الأربعين.' },
      { id: 2, targetNumber: 58, min: 0, max: 100, prompt: 'ضع العدد ٥٨ بين ٠ و١٠٠، مباشرة بعد علامة المنتصف (٥٠).' },
      { id: 3, targetNumber: 71, min: 0, max: 100, prompt: 'قدّر موقع العدد ٧١ على خط الأعداد من ٠ إلى ١٠٠ بالقرب من السبعين.' },
      { id: 4, targetNumber: 26, min: 0, max: 100, prompt: 'حدّد موقع العدد ٢٦ على خط الأعداد من ٠ إلى ١٠٠ في الربع الأول.' },
      { id: 5, targetNumber: 43, min: 0, max: 100, prompt: 'حدّد موضع العدد ٤٣ على خط الأعداد من ٠ إلى ١٠٠ قبل الخمسين بقليل.' },
      { id: 6, targetNumber: 87, min: 0, max: 100, prompt: 'حدّد موضع العدد ٨٧ على خط الأعداد من ٠ إلى ١٠٠ قريباً من التسعين.' },
      { id: 7, targetNumber: 15, min: 0, max: 100, prompt: 'حدّد موضع العدد ١٥ على خط الأعداد من ٠ إلى ١٠٠ في بداية المسار.' },
      { id: 8, targetNumber: 96, min: 0, max: 100, prompt: 'حدّد موضع العدد ٩٦ على خط الأعداد من ٠ إلى ١٠٠ ملاصقاً للمائة.' },
      { id: 9, targetNumber: 62, min: 0, max: 100, prompt: 'حدّد موضع العدد ٦٢ على خط الأعداد من ٠ إلى ١٠٠ بعد الستين بقليل.' },
      { id: 10, targetNumber: 8, min: 0, max: 100, prompt: 'حدّد موضع العدد ٨ على خط الأعداد من ٠ إلى ١٠٠ قريباً من الصفر.' },
      { id: 11, targetNumber: 49, min: 0, max: 100, prompt: 'حدّد موضع العدد ٤٩ على خط الأعداد من ٠ إلى ١٠٠ خطوة واحدة قبل المنتصف.' },
      { id: 12, targetNumber: 77, min: 0, max: 100, prompt: 'حدّد موضع العدد ٧٧ على خط الأعداد من ٠ إلى ١٠٠ بين ٧٠ و٨٠.' },
      { id: 13, targetNumber: 23, min: 0, max: 100, prompt: 'حدّد موضع العدد ٢٣ على خط الأعداد من ٠ إلى ١٠٠ قريباً من العشرين.' },
      { id: 14, targetNumber: 55, min: 0, max: 100, prompt: 'حدّد موضع العدد ٥٥ على خط الأعداد من ٠ إلى ١٠٠ بعد المنتصف بخمس خطوات.' },
      { id: 15, targetNumber: 81, min: 0, max: 100, prompt: 'حدّد موضع العدد ٨١ على خط الأعداد من ٠ إلى ١٠٠ مباشرة بعد الثمانين.' },
      { id: 16, targetNumber: 39, min: 0, max: 100, prompt: 'حدّد موضع العدد ٣٩ على خط الأعداد من ٠ إلى ١٠٠ خطوة واحدة قبل الأربعين.' },
      { id: 17, targetNumber: 92, min: 0, max: 100, prompt: 'حدّد موضع العدد ٩٢ على خط الأعداد من ٠ إلى ١٠٠ بين التسعين والمائة.' },
      { id: 18, targetNumber: 19, min: 0, max: 100, prompt: 'حدّد موضع العدد ١٩ على خط الأعداد من ٠ إلى ١٠٠ خطوة واحدة قبل العشرين.' },
      { id: 19, targetNumber: 68, min: 0, max: 100, prompt: 'حدّد موضع العدد ٦٨ على خط الأعداد من ٠ إلى ١٠٠ قريباً من السبعين.' },
      { id: 20, targetNumber: 99, min: 0, max: 100, prompt: 'ضع المؤشر خطوة واحدة قبل نهاية خط الأعداد تماماً عند ٩٩.' },
    ],
    advanced: [
      { id: 1, targetNumber: 135, min: 0, max: 1000, prompt: 'قدّر موقع العدد ١٣٥ على خط الأعداد من ٠ إلى ١٠٠٠ بين ١٠٠ و٢٠٠.' },
      { id: 2, targetNumber: 428, min: 0, max: 1000, prompt: 'حدّد موقع العدد ٤٢٨ بين ٠ و١٠٠٠ قريباً من منتصف المسار (٥٠٠).' },
      { id: 3, targetNumber: 760, min: 0, max: 1000, prompt: 'قدّر موقع العدد ٧٦٠ على خط الأعداد من ٠ إلى ١٠٠٠ بعد ٧٥٠ بقليل.' },
      { id: 4, targetNumber: 205, min: 0, max: 1000, prompt: 'ضع العدد ٢٠٥ على خط الأعداد من ٠ إلى ١٠٠٠ مباشرة بعد المائتين.' },
      { id: 5, targetNumber: 642, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٦٤٢ على خط الأعداد من ٠ إلى ١٠٠٠ بين ٦٠٠ و٧٠٠.' },
      { id: 6, targetNumber: 89, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٨٩ على خط الأعداد من ٠ إلى ١٠٠٠ قريباً من البداية.' },
      { id: 7, targetNumber: 905, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٩٠٥ على خط الأعداد من ٠ إلى ١٠٠٠ في العُشر الأخير.' },
      { id: 8, targetNumber: 375, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٣٧٥ على خط الأعداد من ٠ إلى ١٠٠٠ في المنتصف بين ٢٥٠ و٥٠٠.' },
      { id: 9, targetNumber: 999, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٩٩٩ على خط الأعداد من ٠ إلى ١٠٠٠ ملاصقاً للألف.' },
      { id: 10, targetNumber: 314, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٣١٤ على خط الأعداد من ٠ إلى ١٠٠٠ بعد الثلاثمائة.' },
      { id: 11, targetNumber: 581, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٥٨١ على خط الأعداد من ٠ إلى ١٠٠٠ بعد علامة المنتصف ٥٠٠.' },
      { id: 12, targetNumber: 46, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٤٦ على خط الأعداد من ٠ إلى ١٠٠٠ في أول مسافة صغيرة.' },
      { id: 13, targetNumber: 820, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٨٢٠ على خط الأعداد من ٠ إلى ١٠٠٠ بعد الثمانمائة.' },
      { id: 14, targetNumber: 250, min: 0, max: 1000, prompt: 'ضع العدد ٢٥٠ في الربع الأول تماماً على خط الأعداد من ٠ إلى ١٠٠٠.' },
      { id: 15, targetNumber: 675, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٦٧٥ على خط الأعداد من ٠ إلى ١٠٠٠ بين ٦٥٠ و٧٠٠.' },
      { id: 16, targetNumber: 490, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٤٩٠ على خط الأعداد من ٠ إلى ١٠٠٠ خطوة واحدة قبل المنتصف ٥٠٠.' },
      { id: 17, targetNumber: 120, min: 0, max: 1000, prompt: 'حدّد موضع العدد ١٢٠ على خط الأعداد من ٠ إلى ١٠٠٠ قريباً من المائة.' },
      { id: 18, targetNumber: 950, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٩٥٠ في منتصف المسافة بين ٩٠٠ و١٠٠٠.' },
      { id: 19, targetNumber: 333, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٣٣٣ في الثلث الأول على خط الأعداد من ٠ إلى ١٠٠٠.' },
      { id: 20, targetNumber: 715, min: 0, max: 1000, prompt: 'حدّد موضع العدد ٧١٥ على خط الأعداد من ٠ إلى ١٠٠٠ بعد السبعمائة بقليل.' },
    ],
  };

  const normalizeArabic = (value: string) =>
    value.replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[\s.,،؛:!?؟'"“”(){}\[\]\\-]/g, '').toLowerCase();

  const normalizeBandWord = (value: string) => normalizeArabic(value);
  const offset = gradeLevel % 2 === 0 ? 4 : 0;
  const gradeSyllables = syllableBank[band].slice(offset, offset + 8);
  const hasTrustedReadingTargets = targetsTeacherReviewed || targetsAIValidated;
  const reviewed = hasTrustedReadingTargets
    ? effectiveWords
        .map((word) => syllableBank[band].find((drill) => normalizeBandWord(drill.targetWord) === normalizeBandWord(word)))
        .filter((drill): drill is RemediationSyllableDrill => Boolean(drill))
    : [];
  const uniqueSyllables = new Map<string, RemediationSyllableDrill>();
  for (const drill of [...reviewed, ...gradeSyllables]) {
    if (!uniqueSyllables.has(normalizeBandWord(drill.targetWord))) uniqueSyllables.set(normalizeBandWord(drill.targetWord), drill);
  }
  const syllableDrills = [...uniqueSyllables.values()].slice(0, 8);
  const curatedMathDrills = mathBank[band].slice(offset, offset + 8);
  const cleanMathTargets = targetsMathValidated
    ? mathTargets.filter((target) =>
        Number.isInteger(target.targetNumber) &&
        Number.isInteger(target.min) &&
        Number.isInteger(target.max) &&
        target.min >= 0 &&
        target.min < target.max &&
        target.targetNumber >= target.min &&
        target.targetNumber <= target.max &&
        target.max <= 10000
      ).slice(0, 8)
    : [];
  const targetedMathDrills: RemediationMathDrill[] = cleanMathTargets.map((target, index) => ({
    id: 1000 + index,
    targetNumber: target.targetNumber,
    min: target.min,
    max: target.max,
    prompt: `تدرّب على تحديد العدد ${target.targetNumber} على خط الأعداد من ${target.min} إلى ${target.max}، ثم قارن موضعك بالعدد المطلوب.`,
  }));
  const mathDrills = [...targetedMathDrills, ...curatedMathDrills].slice(0, 8);
  const phonicsDrills = phonicsBank[band].slice(offset, offset + 8);

  const pacerByBand: Record<string, RemediationPacerPassage> = {
    foundational: { id: 1, title: 'قصة قصيرة للقراءة والتظليل', gradeLevel: `الصف ${gradeLevel} · مستوى تأسيسي`, words: ['فِي', 'صَبَاحٍ', 'جَمِيلٍ،', 'زَارَ', 'عَلِيٌّ', 'جَدَّتَهُ.', 'حَمَلَ', 'سَلَّةً', 'فِيهَا', 'تُفَّاحٌ', 'وَمَوْزٌ.', 'شَكَرَتْهُ', 'الْجَدَّةُ', 'وَقَدَّمَتْ', 'لَهُ', 'مَاءً', 'بَعْدَ', 'اللَّعِبِ.', 'ثُمَّ', 'جَلَسَا', 'مَعًا', 'وَقَرَآ', 'قِصَّةً', 'قَصِيرَةً', 'فِي', 'غُرْفَةٍ', 'هَادِئَةٍ.'] },
    developing: { id: 2, title: 'قصة قصيرة للقراءة والتظليل', gradeLevel: `الصف ${gradeLevel} · مستوى متوسط`, words: ['فِي', 'صَبَاحِ', 'يَوْمٍ', 'مُشْرِقٍ،', 'خَرَجَ', 'عُمَرُ', 'إِلَى', 'الْحَدِيقَةِ،', 'حَيْثُ', 'تَجْرِي', 'مِيَاهُ', 'الْيَنْبُوعِ', 'بِهُدُوءٍ.', 'تَفَقَّدَ', 'الزَّرْعَ', 'ثُمَّ', 'عَادَ', 'إِلَى', 'بَيْتِهِ.', 'ثُمَّ', 'سَجَّلَ', 'مُلَاحَظَاتٍ', 'عَنِ', 'النَّبَاتَاتِ', 'وَعَادَ', 'إِلَى', 'الْمَنْزِلِ', 'قَبْلَ', 'غُرُوبِ', 'الشَّمْسِ.'] },
    advanced: { id: 3, title: 'نص قصير للقراءة والتظليل', gradeLevel: `الصف ${gradeLevel} · مستوى متقدم`, words: ['سَجَّلَ', 'الطُّلَّابُ', 'مُلَاحَظَاتِهِمْ', 'بَعْدَ', 'مُقَابَلَةِ', 'كِبَارِ', 'السِّنِّ.', 'رَاجَعُوا', 'الْأَسْمَاءَ', 'وَالتَّوَارِيخَ', 'وَقَارَنُوا', 'الْحِكَايَاتِ', 'بِالْمَصَادِرِ', 'الْمَكْتُوبَةِ.', 'دَوَّنُوا', 'مَوَاضِعَ', 'الِاخْتِلَافِ', 'قَبْلَ', 'نَشْرِ', 'الْمُلَخَّصِ.', 'وَاحْتَفَظُوا', 'بِنُسْخَةٍ', 'مُرَتَّبَةٍ', 'فِي', 'مَكْتَبَةِ', 'الْمَدْرَسَةِ', 'لِيَرْجِعَ', 'إِلَيْهَا', 'الطُّلَّابُ', 'لَاحِقًا.'] },
  };
  const pacerAlternateByBand: Record<string, RemediationPacerPassage> = {
    foundational: { id: 101, title: 'ترتيب الألعاب والعناية بالنبات', gradeLevel: 'الصف ' + gradeLevel + ' · مستوى تأسيسي', words: ['فِي','صَبَاحٍ','مُشْمِسٍ،','رَتَّبَتْ','هِنْدٌ','أَلْعَابَهَا.','وَضَعَتِ','الْمُكَعَّبَاتِ','فِي','صُنْدُوقٍ،','ثُمَّ','سَاعَدَتْ','أَخَاهَا','فِي','رَيِّ','نَبْتَةٍ','صَغِيرَةٍ.','بَعْدَ','ذَلِكَ','قَرَأَتْ','مَعَ','أُمِّهَا','قِصَّةً','قَبْلَ','وَجْبَةِ','الْغَدَاءِ.'] },
    developing: { id: 102, title: 'بحث في مكتبة الحي', gradeLevel: 'الصف ' + gradeLevel + ' · مستوى متوسط', words: ['زَارَتْ','مَرْيَمُ','مَكْتَبَةَ','الْحَيِّ','لِتَبْحَثَ','عَنْ','كِتَابٍ','عَنِ','الْبَحْرِ.','قَارَنَتْ','بَيْنَ','عُنْوَانَيْنِ،','وَقَرَأَتْ','فَهْرَسَ','الْكُتُبِ،','ثُمَّ','سَجَّلَتْ','مَصْدَرَ','الْمَعْلُومَةِ','فِي','دَفْتَرِهَا.'] },
    advanced: { id: 103, title: 'مراجعة بيانات الطقس', gradeLevel: 'الصف ' + gradeLevel + ' · مستوى متقدم', words: ['جَمَعَ','الطُّلَّابُ','بَيَانَاتِ','الْمَطَرِ','خِلَالَ','أَرْبَعَةِ','أَسَابِيعَ،','ثُمَّ','نَظَّمُوا','الْأَرْقَامَ','فِي','جَدْوَلٍ.','رَاجَعُوا','الْقِرَاءَاتِ','غَيْرَ','الْمُعْتَادَةِ','وَسَأَلُوا','الْمُعَلِّمَ','عَنْ','سَبَبِ','الِاخْتِلَافِ','قَبْلَ','كِتَابَةِ','اسْتِنْتَاجِهِمُ','النِّهَائِيِّ.'] },
  };
  const pacerPassage = gradeLevel % 2 === 0 ? pacerAlternateByBand[band] : pacerByBand[band];

  return {
    learningRationale: targetsAIValidated && effectiveWords.length > 0 && targetsMathValidated && cleanMathTargets.length > 0
      ? `خطة تدريب للصف ${gradeLevel} بُنيت على كلمات حسمها التقييم الصوتي الآلي ومحاولات حساب موثقة آليًا، مع الاقتصار على عناصر البنك التدريبي. المؤشرات وصفية ولا تشخّص عسر القراءة أو عسر الحساب.`
      : targetsAIValidated && effectiveWords.length > 0
        ? `أنشطة قراءة للصف ${gradeLevel} اختيرت من الكلمات التي حسمها محرك الصوت في تسجيل مكتمل، مع الاقتصار على كلمات موجودة في بنك مضبوط. هذه المؤشرات وصفية ولا تشخّص عسر القراءة.`
        : targetsMathValidated && cleanMathTargets.length > 0
          ? `أنشطة حساب للصف ${gradeLevel} اختيرت من محاولات عددية موثقة آليًا وأعداد أخطأ الطالب في تحديدها. هذه مؤشرات تعليمية وصفية ولا تشخّص عسر الحساب.`
          : targetsTeacherReviewed && effectiveWords.length > 0
            ? `أنشطة تعليمية للصف ${gradeLevel}. الكلمات المستهدفة بالتحليل الذكي مطابقة لبنك تدريبي مضبوط؛ النتائج لا تثبت وجود اضطراب ولا تمثل اختبارًا معياريًا أو بروتوكول علاج معتمدًا.`
            : `أنشطة تدريب عامة للصف ${gradeLevel} مختارة بحسب الصف، وتشمل أمثلة للحروف والمقاطع وخط الأعداد. الكلمات أمثلة تعليمية وليست أخطاء مرصودة لدى هذا الطفل. الخطة ليست اختبارًا معياريًا أو بروتوكول علاج معتمدًا.`,
    phonicsDrills,
    syllableDrills,
    pacerPassage,
    mathDrills,
  };
}
