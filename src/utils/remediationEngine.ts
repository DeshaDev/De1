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
    
      { id: 5, family: 'تمييز الكاف والقاف', spokenWord: 'كُرَة', wordMeaning: 'أداة مستديرة للعب', targetLetter: 'ك', options: [{ letter: 'ك', letterName: 'كاف', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ق', letterName: 'قاف', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'اقرأ أول حرف قبل الاختيار.' },
      { id: 6, family: 'تمييز السين والشين', spokenWord: 'سَمَك', wordMeaning: 'حيوانات تعيش في الماء', targetLetter: 'س', options: [{ letter: 'س', letterName: 'سين', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ش', letterName: 'شين', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'قارن عدد النقاط وموضعها.' },
      { id: 7, family: 'تمييز القاف والكاف', spokenWord: 'قَمَر', wordMeaning: 'جرم يظهر في السماء', targetLetter: 'ق', options: [{ letter: 'ك', letterName: 'كاف', isCorrect: false, explanation: 'هذا الحرف لا يطابق بداية الكلمة.' }, { letter: 'ق', letterName: 'قاف', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }], ruleTip: 'تأكد من شكل الحرف قبل الاختيار.' },
      { id: 8, family: 'تمييز اللام والنون', spokenWord: 'لَبَن', wordMeaning: 'شراب غذائي', targetLetter: 'ل', options: [{ letter: 'ل', letterName: 'لام', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ن', letterName: 'نون', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'طابق صوت البداية بالحرف.' },
      { id: 9, family: 'تمييز الباء والتاء', spokenWord: 'بَطَّة', wordMeaning: 'طائر يعيش قرب الماء', targetLetter: 'ب', options: [{ letter: 'ب', letterName: 'باء', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'انظر إلى موضع النقاط.' },
      { id: 10, family: 'تمييز الثاء والتاء', spokenWord: 'ثَوْب', wordMeaning: 'ما يلبسه الإنسان', targetLetter: 'ث', options: [{ letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'هذا الحرف لا يطابق بداية الكلمة.' }, { letter: 'ث', letterName: 'ثاء', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }], ruleTip: 'الثاء تحمل ثلاث نقاط.' },
      { id: 11, family: 'تمييز الجيم والحاء', spokenWord: 'جَرَس', wordMeaning: 'أداة تصدر صوتًا', targetLetter: 'ج', options: [{ letter: 'ج', letterName: 'جيم', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ح', letterName: 'حاء', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'الجيم لها نقطة أسفل الحرف.' },
      { id: 12, family: 'تمييز الخاء والجيم', spokenWord: 'خَيْط', wordMeaning: 'شيء رفيع يستخدم في الخياطة', targetLetter: 'خ', options: [{ letter: 'خ', letterName: 'خاء', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ج', letterName: 'جيم', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'لاحظ موضع النقطة.' },
    ],
    developing: [
      { id: 1, family: 'تمييز السين والصاد', spokenWord: 'سَاقِيَة', wordMeaning: 'قناة للماء', targetLetter: 'س', options: [{ letter: 'س', letterName: 'سين', isCorrect: true, explanation: 'بداية الكلمة سين.' }, { letter: 'ص', letterName: 'صاد', isCorrect: false, explanation: 'الصاد حرف مفخم مختلف.' }], ruleTip: 'قارن شكل الحرف وصوته داخل الكلمة.' },
      { id: 2, family: 'تمييز السين والصاد', spokenWord: 'صَابُون', wordMeaning: 'مادة للتنظيف', targetLetter: 'ص', options: [{ letter: 'س', letterName: 'سين', isCorrect: false, explanation: 'السين لا تطابق بداية الكلمة.' }, { letter: 'ص', letterName: 'صاد', isCorrect: true, explanation: 'بداية الكلمة صاد.' }], ruleTip: 'تدرب على الحروف المتقاربة في الصوت.' },
      { id: 3, family: 'تمييز الطاء والتاء', spokenWord: 'طَائِر', wordMeaning: 'حيوان له جناحان', targetLetter: 'ط', options: [{ letter: 'ط', letterName: 'طاء', isCorrect: true, explanation: 'بداية الكلمة طاء.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'التاء حرف مختلف في الرسم والصوت.' }], ruleTip: 'تتبّع الحرف في بداية الكلمة.' },
      { id: 4, family: 'تمييز الظاء والضاد', spokenWord: 'ظِلّ', wordMeaning: 'منطقة يحجب عنها الضوء', targetLetter: 'ظ', options: [{ letter: 'ض', letterName: 'ضاد', isCorrect: false, explanation: 'الضاد لا تطابق الحرف المكتوب.' }, { letter: 'ظ', letterName: 'ظاء', isCorrect: true, explanation: 'الكلمة تبدأ بالظاء.' }], ruleTip: 'انتبه إلى اختلاف شكل الظاء والضاد.' },
    
      { id: 5, family: 'تمييز الضاد والدال', spokenWord: 'ضِفْدَع', wordMeaning: 'حيوان يعيش في الماء وعلى اليابسة', targetLetter: 'ض', options: [{ letter: 'ض', letterName: 'ضاد', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'د', letterName: 'دال', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'لاحظ شكل الضاد مقارنة بالدال.' },
      { id: 6, family: 'تمييز الراء والزاي', spokenWord: 'رَمْل', wordMeaning: 'حبيبات دقيقة من الصخور', targetLetter: 'ر', options: [{ letter: 'ر', letterName: 'راء', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ز', letterName: 'زاي', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'فرّق بين الحرفين بالنقطة.' },
      { id: 7, family: 'تمييز الطاء والتاء', spokenWord: 'طَرِيق', wordMeaning: 'مسار يسلكه الناس', targetLetter: 'ط', options: [{ letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'هذا الحرف لا يطابق بداية الكلمة.' }, { letter: 'ط', letterName: 'طاء', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }], ruleTip: 'قارن الحرفين في كلمة مألوفة.' },
      { id: 8, family: 'تمييز الغين والعين', spokenWord: 'غُرْفَة', wordMeaning: 'جزء من المنزل', targetLetter: 'غ', options: [{ letter: 'غ', letterName: 'غين', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ع', letterName: 'عين', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'الغين تحمل نقطة.' },
      { id: 9, family: 'تمييز الذال والدال', spokenWord: 'ذَهَب', wordMeaning: 'معدن نفيس', targetLetter: 'ذ', options: [{ letter: 'ذ', letterName: 'ذال', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'د', letterName: 'دال', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'لاحظ النقطة أعلى الذال.' },
      { id: 10, family: 'تمييز الشين والسين', spokenWord: 'شَاطِئ', wordMeaning: 'أرض بمحاذاة البحر', targetLetter: 'ش', options: [{ letter: 'س', letterName: 'سين', isCorrect: false, explanation: 'هذا الحرف لا يطابق بداية الكلمة.' }, { letter: 'ش', letterName: 'شين', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }], ruleTip: 'الشين لها ثلاث نقاط.' },
      { id: 11, family: 'تمييز الظاء والضاد', spokenWord: 'ظَرْف', wordMeaning: 'غلاف للرسالة', targetLetter: 'ظ', options: [{ letter: 'ظ', letterName: 'ظاء', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ض', letterName: 'ضاد', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'راجع شكل الحرف وموضع النقطة.' },
      { id: 12, family: 'تمييز الكاف والقاف', spokenWord: 'كَنْز', wordMeaning: 'شيء ثمين مخبأ', targetLetter: 'ك', options: [{ letter: 'ق', letterName: 'قاف', isCorrect: false, explanation: 'هذا الحرف لا يطابق بداية الكلمة.' }, { letter: 'ك', letterName: 'كاف', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }], ruleTip: 'لا تخلط بين شكل الكاف والقاف.' },
    ],
    advanced: [
      { id: 1, family: 'تمييز الميم والنون في الكلمات الطويلة', spokenWord: 'مَعْلُومَات', wordMeaning: 'حقائق أو بيانات', targetLetter: 'م', options: [{ letter: 'م', letterName: 'ميم', isCorrect: true, explanation: 'الكلمة تبدأ بالميم.' }, { letter: 'ن', letterName: 'نون', isCorrect: false, explanation: 'النون حرف مختلف.' }], ruleTip: 'افحص بداية الكلمة قبل قراءة بقيتها.' },
      { id: 2, family: 'تمييز الضاد والدال', spokenWord: 'ضَوْء', wordMeaning: 'ما يساعد على الرؤية', targetLetter: 'ض', options: [{ letter: 'د', letterName: 'دال', isCorrect: false, explanation: 'الدال لا تطابق أول حرف.' }, { letter: 'ض', letterName: 'ضاد', isCorrect: true, explanation: 'الكلمة تبدأ بالضاد.' }], ruleTip: 'راجع اتجاه الحرف وموضع النقطة.' },
      { id: 3, family: 'تمييز الغين والعين', spokenWord: 'غِذَاء', wordMeaning: 'ما يأكله الكائن الحي', targetLetter: 'غ', options: [{ letter: 'غ', letterName: 'غين', isCorrect: true, explanation: 'الكلمة تبدأ بالغين.' }, { letter: 'ع', letterName: 'عين', isCorrect: false, explanation: 'العين بلا نقطة فوقها.' }], ruleTip: 'قارن الغين والعين في بداية الكلمة.' },
      { id: 4, family: 'تمييز الهاء والحاء', spokenWord: 'هِجْرَة', wordMeaning: 'انتقال من مكان إلى آخر', targetLetter: 'ه', options: [{ letter: 'ح', letterName: 'حاء', isCorrect: false, explanation: 'الحاء لا تطابق الحرف الأول.' }, { letter: 'ه', letterName: 'هاء', isCorrect: true, explanation: 'الكلمة تبدأ بالهاء.' }], ruleTip: 'لاحظ الاختلاف بين شكل الهاء والحاء.' },
    
      { id: 5, family: 'تمييز التاء والثاء', spokenWord: 'تَحْلِيل', wordMeaning: 'فحص أجزاء الشيء لفهمه', targetLetter: 'ت', options: [{ letter: 'ت', letterName: 'تاء', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ث', letterName: 'ثاء', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'تحقق من أول حرف.' },
      { id: 6, family: 'تمييز الباء والتاء', spokenWord: 'بَحْث', wordMeaning: 'عمل منظم للوصول إلى معلومات', targetLetter: 'ب', options: [{ letter: 'ب', letterName: 'باء', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'قارن موضع النقاط.' },
      { id: 7, family: 'تمييز الميم والنون', spokenWord: 'مَصْدَر', wordMeaning: 'مرجع تؤخذ منه المعلومات', targetLetter: 'م', options: [{ letter: 'ن', letterName: 'نون', isCorrect: false, explanation: 'هذا الحرف لا يطابق بداية الكلمة.' }, { letter: 'م', letterName: 'ميم', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }], ruleTip: 'طابق الحرف المكتوب بأول الكلمة.' },
      { id: 8, family: 'تمييز الدال والذال', spokenWord: 'دَلِيل', wordMeaning: 'ما يساعد على فهم أمر أو إثباته', targetLetter: 'د', options: [{ letter: 'د', letterName: 'دال', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ذ', letterName: 'ذال', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'تأكد من وجود النقطة أو غيابها.' },
      { id: 9, family: 'تمييز التاء والثاء', spokenWord: 'تَجْرِبَة', wordMeaning: 'نشاط لاختبار فكرة أو إجراء', targetLetter: 'ت', options: [{ letter: 'ث', letterName: 'ثاء', isCorrect: false, explanation: 'هذا الحرف لا يطابق بداية الكلمة.' }, { letter: 'ت', letterName: 'تاء', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }], ruleTip: 'افحص بداية الكلمة بدقة.' },
      { id: 10, family: 'تمييز الباء والتاء', spokenWord: 'بَيَانَات', wordMeaning: 'معلومات جُمعت للمراجعة', targetLetter: 'ب', options: [{ letter: 'ب', letterName: 'باء', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ت', letterName: 'تاء', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'لاحظ موضع نقطة الباء.' },
      { id: 11, family: 'تمييز التاء والثاء', spokenWord: 'تَفَاصِيل', wordMeaning: 'أجزاء تكمل وصفًا أو فكرة', targetLetter: 'ت', options: [{ letter: 'ت', letterName: 'تاء', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ث', letterName: 'ثاء', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'تمييز النقاط يفيد في الكلمات الطويلة.' },
      { id: 12, family: 'تمييز الدال والذال', spokenWord: 'دِرَاسَة', wordMeaning: 'عمل منظم للتعلم وفهم موضوع', targetLetter: 'د', options: [{ letter: 'د', letterName: 'دال', isCorrect: true, explanation: 'الكلمة تبدأ بالحرف المستهدف.' }, { letter: 'ذ', letterName: 'ذال', isCorrect: false, explanation: 'قارن شكل الحرف وموضع النقطة.' }], ruleTip: 'اربط شكل الحرف بأول صوت.' },
    ],
  };

  const syllableBank: Record<string, RemediationSyllableDrill[]> = {
    foundational: [
      { id: 1, targetWord: 'بُسْتَان', wordMeaning: 'مكان فيه أشجار ونباتات', syllables: ['بُسْ', 'تَان'] },
      { id: 2, targetWord: 'تُفَّاح', wordMeaning: 'فاكهة معروفة', syllables: ['تُفَّ', 'اح'] },
      { id: 3, targetWord: 'قَلَم', wordMeaning: 'أداة للكتابة', syllables: ['قَ', 'لَم'] },
      { id: 4, targetWord: 'مَدْرَسَة', wordMeaning: 'مكان للتعلم', syllables: ['مَدْ', 'رَ', 'سَة'] },
    
      { id: 5, targetWord: 'سَمَك', wordMeaning: 'حيوان يعيش في الماء', syllables: ['سَ', 'مَ', 'ك'] },
      { id: 6, targetWord: 'قَمَر', wordMeaning: 'جرم يظهر في السماء', syllables: ['قَ', 'مَ', 'ر'] },
      { id: 7, targetWord: 'وَرَق', wordMeaning: 'صفحات للكتابة والرسم', syllables: ['وَ', 'رَ', 'ق'] },
      { id: 8, targetWord: 'نَجْم', wordMeaning: 'جسم مضيء في السماء', syllables: ['نَجْ', 'م'] },
      { id: 9, targetWord: 'أَسَد', wordMeaning: 'حيوان قوي يعيش في البرية', syllables: ['أَ', 'سَ', 'د'] },
      { id: 10, targetWord: 'بَحْر', wordMeaning: 'مسطح واسع من الماء', syllables: ['بَحْ', 'ر'] },
      { id: 11, targetWord: 'وَرْد', wordMeaning: 'زهور ذات رائحة جميلة', syllables: ['وَرْ', 'د'] },
      { id: 12, targetWord: 'نَهْر', wordMeaning: 'مجرى طبيعي للماء', syllables: ['نَهْ', 'ر'] },
    ],
    developing: [
      { id: 1, targetWord: 'سَاقِيَة', wordMeaning: 'قناة للماء', syllables: ['سَا', 'قِ', 'يَة'] },
      { id: 2, targetWord: 'حَدِيقَة', wordMeaning: 'مكان للنباتات', syllables: ['حَ', 'دِي', 'قَة'] },
      { id: 3, targetWord: 'مَكْتَبَة', wordMeaning: 'مكان للكتب', syllables: ['مَكْ', 'تَ', 'بَة'] },
      { id: 4, targetWord: 'مَعْلُومَة', wordMeaning: 'فكرة أو حقيقة معروفة', syllables: ['مَعْ', 'لُو', 'مَة'] },
    
      { id: 5, targetWord: 'مَطَر', wordMeaning: 'ماء ينزل من السحاب', syllables: ['مَ', 'طَ', 'ر'] },
      { id: 6, targetWord: 'صَدِيق', wordMeaning: 'شخص تربطنا به مودة', syllables: ['صَ', 'دِي', 'ق'] },
      { id: 7, targetWord: 'حُقُول', wordMeaning: 'أراض تزرع فيها المحاصيل', syllables: ['حُ', 'قُو', 'ل'] },
      { id: 8, targetWord: 'مَدِينَة', wordMeaning: 'مكان يضم أحياء وسكانًا', syllables: ['مَ', 'دِي', 'نَة'] },
      { id: 9, targetWord: 'مَرْسَم', wordMeaning: 'مكان للرسم والفنون', syllables: ['مَرْ', 'سَ', 'م'] },
      { id: 10, targetWord: 'شَاطِئ', wordMeaning: 'أرض بمحاذاة البحر', syllables: ['شَا', 'طِئ'] },
      { id: 11, targetWord: 'رِحْلَة', wordMeaning: 'انتقال إلى مكان آخر', syllables: ['رِحْ', 'لَة'] },
      { id: 12, targetWord: 'كَنْز', wordMeaning: 'شيء ثمين مخبأ', syllables: ['كَنْ', 'ز'] },
    ],
    advanced: [
      { id: 1, targetWord: 'مَعْلُومَات', wordMeaning: 'حقائق أو بيانات', syllables: ['مَعْ', 'لُو', 'مَات'] },
      { id: 2, targetWord: 'مُخْتَبَر', wordMeaning: 'مكان للتجارب العلمية', syllables: ['مُخْ', 'تَ', 'بَر'] },
      { id: 3, targetWord: 'الْبِيئَة', wordMeaning: 'المحيط الذي تعيش فيه الكائنات', syllables: ['الْ', 'بِي', 'ئَة'] },
      { id: 4, targetWord: 'الطَّاقَة', wordMeaning: 'القدرة على إحداث تغيير أو حركة', syllables: ['الطَّ', 'ا', 'قَة'] },
    
      { id: 5, targetWord: 'مُشَارَكَة', wordMeaning: 'عمل يقوم به أكثر من شخص معًا', syllables: ['مُ', 'شَا', 'رَ', 'كَة'] },
      { id: 6, targetWord: 'مَصَادِر', wordMeaning: 'مراجع تجمع منها المعلومات', syllables: ['مَ', 'صَا', 'دِر'] },
      { id: 7, targetWord: 'مُتَطَوِّر', wordMeaning: 'ينمو ويتغير إلى حالة أحدث', syllables: ['مُ', 'تَ', 'طَ', 'وِّر'] },
      { id: 8, targetWord: 'اسْتِقْلَال', wordMeaning: 'الاعتماد على النفس', syllables: ['اسْ', 'تِقْ', 'لَال'] },
      { id: 9, targetWord: 'تَجْرِبَة', wordMeaning: 'نشاط لاختبار فكرة', syllables: ['تَجْ', 'رِ', 'بَة'] },
      { id: 10, targetWord: 'بَيَانَات', wordMeaning: 'معلومات جُمعت للمراجعة', syllables: ['بَ', 'يَا', 'نَات'] },
      { id: 11, targetWord: 'تَفَاصِيل', wordMeaning: 'أجزاء تكمل وصفًا أو فكرة', syllables: ['تَ', 'فَا', 'صِيل'] },
      { id: 12, targetWord: 'دِرَاسَة', wordMeaning: 'عمل منظم للتعلم', syllables: ['دِ', 'رَا', 'سَة'] },
    ],
  };

  const mathBank: Record<string, RemediationMathDrill[]> = {
    foundational: [
      { id: 1, targetNumber: 7, min: 0, max: 20, prompt: 'ضع العدد ٧ على خط الأعداد من ٠ إلى ٢٠.' },
      { id: 2, targetNumber: 12, min: 0, max: 20, prompt: 'قدّر موقع العدد ١٢ على خط الأعداد من ٠ إلى ٢٠.' },
      { id: 3, targetNumber: 16, min: 0, max: 20, prompt: 'أيّهما أقرب إلى ١٦: عشرة أم عشرون؟ ثم حدّد موقعه.' },
      { id: 4, targetNumber: 5, min: 0, max: 20, prompt: 'ضع العدد ٥ بين ٠ و٢٠ وحدّد العدد الأقرب إليه.' },
    
      { id: 5, targetNumber: 9, min: 0, max: 20, prompt: 'حدّد موضع العدد 9 على خط الأعداد من ٠ إلى 20.' },
      { id: 6, targetNumber: 14, min: 0, max: 20, prompt: 'حدّد موضع العدد 14 على خط الأعداد من ٠ إلى 20.' },
      { id: 7, targetNumber: 3, min: 0, max: 20, prompt: 'حدّد موضع العدد 3 على خط الأعداد من ٠ إلى 20.' },
      { id: 8, targetNumber: 18, min: 0, max: 20, prompt: 'حدّد موضع العدد 18 على خط الأعداد من ٠ إلى 20.' },
      { id: 9, targetNumber: 2, min: 0, max: 20, prompt: 'حدّد موضع العدد 2 على خط الأعداد من ٠ إلى 20.' },
      { id: 10, targetNumber: 11, min: 0, max: 20, prompt: 'حدّد موضع العدد 11 على خط الأعداد من ٠ إلى 20.' },
      { id: 11, targetNumber: 19, min: 0, max: 20, prompt: 'حدّد موضع العدد 19 على خط الأعداد من ٠ إلى 20.' },
      { id: 12, targetNumber: 6, min: 0, max: 20, prompt: 'حدّد موضع العدد 6 على خط الأعداد من ٠ إلى 20.' },
    ],
    developing: [
      { id: 1, targetNumber: 34, min: 0, max: 100, prompt: 'قدّر موقع العدد ٣٤ على خط الأعداد من ٠ إلى ١٠٠.' },
      { id: 2, targetNumber: 58, min: 0, max: 100, prompt: 'ضع العدد ٥٨ بين ٠ و١٠٠.' },
      { id: 3, targetNumber: 71, min: 0, max: 100, prompt: 'قدّر موقع العدد ٧١ على خط الأعداد من ٠ إلى ١٠٠.' },
      { id: 4, targetNumber: 26, min: 0, max: 100, prompt: 'حدّد موقع العدد ٢٦ على خط الأعداد من ٠ إلى ١٠٠.' },
    
      { id: 5, targetNumber: 43, min: 0, max: 100, prompt: 'حدّد موضع العدد 43 على خط الأعداد من ٠ إلى 100.' },
      { id: 6, targetNumber: 87, min: 0, max: 100, prompt: 'حدّد موضع العدد 87 على خط الأعداد من ٠ إلى 100.' },
      { id: 7, targetNumber: 15, min: 0, max: 100, prompt: 'حدّد موضع العدد 15 على خط الأعداد من ٠ إلى 100.' },
      { id: 8, targetNumber: 96, min: 0, max: 100, prompt: 'حدّد موضع العدد 96 على خط الأعداد من ٠ إلى 100.' },
      { id: 9, targetNumber: 62, min: 0, max: 100, prompt: 'حدّد موضع العدد 62 على خط الأعداد من ٠ إلى 100.' },
      { id: 10, targetNumber: 8, min: 0, max: 100, prompt: 'حدّد موضع العدد 8 على خط الأعداد من ٠ إلى 100.' },
      { id: 11, targetNumber: 49, min: 0, max: 100, prompt: 'حدّد موضع العدد 49 على خط الأعداد من ٠ إلى 100.' },
      { id: 12, targetNumber: 77, min: 0, max: 100, prompt: 'حدّد موضع العدد 77 على خط الأعداد من ٠ إلى 100.' },
    ],
    advanced: [
      { id: 1, targetNumber: 135, min: 0, max: 1000, prompt: 'قدّر موقع العدد ١٣٥ على خط الأعداد من ٠ إلى ١٠٠٠.' },
      { id: 2, targetNumber: 428, min: 0, max: 1000, prompt: 'حدّد موقع العدد ٤٢٨ بين ٠ و١٠٠٠.' },
      { id: 3, targetNumber: 760, min: 0, max: 1000, prompt: 'قدّر موقع العدد ٧٦٠ على خط الأعداد من ٠ إلى ١٠٠٠.' },
      { id: 4, targetNumber: 205, min: 0, max: 1000, prompt: 'ضع العدد ٢٠٥ على خط الأعداد من ٠ إلى ١٠٠٠.' },
    
      { id: 5, targetNumber: 642, min: 0, max: 1000, prompt: 'حدّد موضع العدد 642 على خط الأعداد من ٠ إلى 1000.' },
      { id: 6, targetNumber: 89, min: 0, max: 1000, prompt: 'حدّد موضع العدد 89 على خط الأعداد من ٠ إلى 1000.' },
      { id: 7, targetNumber: 905, min: 0, max: 1000, prompt: 'حدّد موضع العدد 905 على خط الأعداد من ٠ إلى 1000.' },
      { id: 8, targetNumber: 375, min: 0, max: 1000, prompt: 'حدّد موضع العدد 375 على خط الأعداد من ٠ إلى 1000.' },
      { id: 9, targetNumber: 999, min: 0, max: 1000, prompt: 'حدّد موضع العدد 999 على خط الأعداد من ٠ إلى 1000.' },
      { id: 10, targetNumber: 314, min: 0, max: 1000, prompt: 'حدّد موضع العدد 314 على خط الأعداد من ٠ إلى 1000.' },
      { id: 11, targetNumber: 581, min: 0, max: 1000, prompt: 'حدّد موضع العدد 581 على خط الأعداد من ٠ إلى 1000.' },
      { id: 12, targetNumber: 46, min: 0, max: 1000, prompt: 'حدّد موضع العدد 46 على خط الأعداد من ٠ إلى 1000.' },
    ],
  };

  const normalizeArabic = (value: string) =>
    value.replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[\s.,،؛:!?؟'"“”(){}\[\]\\-]/g, '').toLowerCase();

  const normalizeBandWord = (value: string) => normalizeArabic(value);
  const offset = gradeLevel % 2 === 0 ? 4 : 0;
  const gradeSyllables = syllableBank[band].slice(offset, offset + 8);
  const reviewed = targetsTeacherReviewed
    ? effectiveWords
        .map((word) => gradeSyllables.find((drill) => normalizeBandWord(drill.targetWord) === normalizeBandWord(word)))
        .filter((drill): drill is RemediationSyllableDrill => Boolean(drill))
    : [];
  const uniqueSyllables = new Map<string, RemediationSyllableDrill>();
  for (const drill of [...reviewed, ...gradeSyllables]) {
    if (!uniqueSyllables.has(normalizeBandWord(drill.targetWord))) uniqueSyllables.set(normalizeBandWord(drill.targetWord), drill);
  }
  const syllableDrills = [...uniqueSyllables.values()].slice(0, 8);
  const mathDrills = mathBank[band].slice(offset, offset + 8);
  const phonicsDrills = phonicsBank[band].slice(offset, offset + 8);

  const pacerByBand: Record<string, RemediationPacerPassage> = {
    foundational: { id: 1, title: 'قصة قصيرة للقراءة والتظليل', gradeLevel: `الصف ${gradeLevel} · مستوى تأسيسي`, words: ['فِي', 'صَبَاحٍ', 'جَمِيلٍ،', 'زَارَ', 'عَلِيٌّ', 'جَدَّتَهُ.', 'حَمَلَ', 'سَلَّةً', 'فِيهَا', 'تُفَّاحٌ', 'وَمَوْزٌ.', 'شَكَرَتْهُ', 'الْجَدَّةُ', 'وَقَدَّمَتْ', 'لَهُ', 'مَاءً', 'بَعْدَ', 'اللَّعِبِ.', 'ثُمَّ', 'جَلَسَا', 'مَعًا', 'وَقَرَآ', 'قِصَّةً', 'قَصِيرَةً', 'فِي', 'غُرْفَةٍ', 'هَادِئَةٍ.'] },
    developing: { id: 2, title: 'قصة قصيرة للقراءة والتظليل', gradeLevel: `الصف ${gradeLevel} · مستوى متوسط`, words: ['فِي', 'صَبَاحِ', 'يَوْمٍ', 'مُشْرِقٍ،', 'خَرَجَ', 'عُمَرُ', 'إِلَى', 'الْبُسْتَانِ،', 'حَيْثُ', 'تَجْرِي', 'مِيَاهُ', 'السَّاقِيَةِ', 'بِهُدُوءٍ.', 'تَفَقَّدَ', 'الزَّرْعَ', 'ثُمَّ', 'عَادَ', 'إِلَى', 'بَيْتِهِ.', 'ثُمَّ', 'سَجَّلَ', 'مُلَاحَظَاتٍ', 'عَنِ', 'النَّبَاتَاتِ', 'وَعَادَ', 'إِلَى', 'الْمَنْزِلِ', 'قَبْلَ', 'غُرُوبِ', 'الشَّمْسِ.'] },
    advanced: { id: 3, title: 'نص قصير للقراءة والتظليل', gradeLevel: `الصف ${gradeLevel} · مستوى متقدم`, words: ['سَجَّلَ', 'الطُّلَّابُ', 'مُلَاحَظَاتِهِمْ', 'بَعْدَ', 'مُقَابَلَةِ', 'كِبَارِ', 'السِّنِّ.', 'رَاجَعُوا', 'الْأَسْمَاءَ', 'وَالتَّوَارِيخَ', 'وَقَارَنُوا', 'الْحِكَايَاتِ', 'بِالْمَصَادِرِ', 'الْمَكْتُوبَةِ.', 'دَوَّنُوا', 'مَوَاضِعَ', 'الِاخْتِلَافِ', 'قَبْلَ', 'نَشْرِ', 'الْمُلَخَّصِ.', 'وَاحْتَفَظُوا', 'بِنُسْخَةٍ', 'مُرَتَّبَةٍ', 'فِي', 'مَكْتَبَةِ', 'الْمَدْرَسَةِ', 'لِيَرْجِعَ', 'إِلَيْهَا', 'الطُّلَّابُ', 'لَاحِقًا.'] },
  };
  const pacerAlternateByBand: Record<string, RemediationPacerPassage> = {
    foundational: { id: 101, title: 'ترتيب الألعاب والعناية بالنبات', gradeLevel: 'الصف ' + gradeLevel + ' · مستوى تأسيسي', words: ['فِي','صَبَاحٍ','مُشْمِسٍ،','رَتَّبَتْ','هِنْدٌ','أَلْعَابَهَا.','وَضَعَتِ','الْمُكَعَّبَاتِ','فِي','صُنْدُوقٍ،','ثُمَّ','سَاعَدَتْ','أَخَاهَا','فِي','رَيِّ','نَبْتَةٍ','صَغِيرَةٍ.','بَعْدَ','ذَلِكَ','قَرَأَتْ','مَعَ','أُمِّهَا','قِصَّةً','قَبْلَ','وَجْبَةِ','الْغَدَاءِ.'] },
    developing: { id: 102, title: 'بحث في مكتبة الحي', gradeLevel: 'الصف ' + gradeLevel + ' · مستوى متوسط', words: ['زَارَتْ','مَرْيَمُ','مَكْتَبَةَ','الْحَيِّ','لِتَبْحَثَ','عَنْ','كِتَابٍ','عَنِ','الْبَحْرِ.','قَارَنَتْ','بَيْنَ','عُنْوَانَيْنِ،','وَقَرَأَتْ','فَهْرَسَ','الْكُتُبِ،','ثُمَّ','سَجَّلَتْ','مَصْدَرَ','الْمَعْلُومَةِ','فِي','دَفْتَرِهَا.'] },
    advanced: { id: 103, title: 'مراجعة بيانات الطقس', gradeLevel: 'الصف ' + gradeLevel + ' · مستوى متقدم', words: ['جَمَعَ','الطُّلَّابُ','بَيَانَاتِ','الْمَطَرِ','خِلَالَ','أَرْبَعَةِ','أَسَابِيعَ،','ثُمَّ','نَظَّمُوا','الْأَرْقَامَ','فِي','جَدْوَلٍ.','رَاجَعُوا','الْقِرَاءَاتِ','غَيْرَ','الْمُعْتَادَةِ','وَسَأَلُوا','الْمُعَلِّمَ','عَنْ','سَبَبِ','الِاخْتِلَافِ','قَبْلَ','كِتَابَةِ','اسْتِنْتَاجِهِمُ','النِّهَائِيِّ.'] },
  };
  const pacerPassage = gradeLevel % 2 === 0 ? pacerAlternateByBand[band] : pacerByBand[band];

  return {
    learningRationale: targetsTeacherReviewed && effectiveWords.length > 0
      ? `أنشطة تعليمية للصف ${gradeLevel}. لا تُستخدم الكلمات المستهدفة بالتحليل الذكي لتخصيص التدريب إلا إذا طابقت كلمة موجودة في بنك تدريبي مضبوط. لا تثبت النتائج وجود اضطراب ولا تمثل الخطة اختبارًا معياريًا أو بروتوكول علاج معتمدًا.`
      : `أنشطة تدريب عامة للصف ${gradeLevel} مختارة بحسب مستوى القراءة، وتشمل أمثلة للحروف والمقاطع وخط الأعداد. الكلمات أمثلة تعليمية وليست أخطاء مرصودة لدى هذا الطفل. الخطة ليست اختبارًا معياريًا أو بروتوكول علاج معتمدًا.`,
    phonicsDrills,
    syllableDrills,
    pacerPassage,
    mathDrills,
  };
}
