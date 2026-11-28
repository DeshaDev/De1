/** Lightweight skill definitions & programme dose constants (zero data-bank imports). */

export type SkillId =
  | 'rhyme'
  | 'soundPosition'
  | 'blending'
  | 'discrimination'
  | 'letterSound'
  | 'visualDiscrimination'
  | 'decoding'
  | 'spelling'
  | 'comprehension'
  | 'morphology'
  | 'auditoryMemory';

export type Level = 1 | 2 | 3;

export interface SkillDefinition {
  id: SkillId;
  nameAr: string;
  icon: string;
  goalAr: string;
  levels: Record<Level, string>;
}

export const SKILLS: Record<SkillId, SkillDefinition> = {
  rhyme: {
    id: 'rhyme',
    nameAr: 'القافية',
    icon: '🎵',
    goalAr: 'يميّز الكلمات المتشابهة في آخرها.',
    levels: { 1: 'الاختيار من صورتين', 2: 'الاختيار من ثلاث صور', 3: 'الاختيار من أربع صور' },
  },
  soundPosition: {
    id: 'soundPosition',
    nameAr: 'الصوت الأول والأخير',
    icon: '🔊',
    goalAr: 'يعزل الصوت الأول ثم الأخير في الكلمة المسموعة.',
    levels: { 1: 'الصوت الأول (أصوات متباعدة)', 2: 'الصوت الأول (أصوات متقاربة)', 3: 'الصوت الأخير' },
  },
  blending: {
    id: 'blending',
    nameAr: 'تركيب المقاطع وعدّها',
    icon: '🧩',
    goalAr: 'يركّب المقاطع المسموعة في كلمة، ويعدّ مقاطع الكلمة.',
    levels: { 1: 'تركيب كلمات من مقطعين', 2: 'تركيب كلمات من ٣–٤ مقاطع', 3: 'عدّ مقاطع الكلمة' },
  },
  discrimination: {
    id: 'discrimination',
    nameAr: 'التمييز السمعي',
    icon: '👂',
    goalAr: 'يفرّق بين الأصوات العربية المتقاربة في المخرج.',
    levels: { 1: 'أصوات متباعدة', 2: 'أصوات متقاربة مع الفتحة', 3: 'أصوات متقاربة مع الكسرة والضمة وأزواج الكلمات' },
  },
  letterSound: {
    id: 'letterSound',
    nameAr: 'ربط الحرف بصوته',
    icon: '✏️',
    goalAr: 'يربط شكل الحرف بصوته بسرعة ودقة.',
    levels: { 1: 'حروف المجموعة الأولى (م ب س ل ر ن)', 2: 'حروف المجموعة الثانية (ت د ف ك ع ح)', 3: 'كل الحروف مع المشتّتات المتشابهة والحركات الثلاث' },
  },
  visualDiscrimination: {
    id: 'visualDiscrimination',
    nameAr: 'التمييز البصري',
    icon: '🦅',
    goalAr: 'يلاحظ الفروق الدقيقة في النقاط وشكل الحروف والكلمات.',
    levels: { 1: 'حروف منفردة', 2: 'حروف في أول الكلمة', 3: 'كلمات كاملة' },
  },
  decoding: { id: 'decoding', nameAr: 'فك الترميز والقراءة', icon: '🔤', goalAr: 'يفكّ الكلمات العربية ويربط الحركات والمدّ والسكون بأصواتها.', levels: { 1: 'كلمات قصيرة مشكولة', 2: 'كلمات متعددة المقاطع والمدود', 3: 'كلمات أطول مع السكون والتاء المربوطة' } },
  spelling: { id: 'spelling', nameAr: 'الإملاء والكتابة', icon: '✍️', goalAr: 'يحوّل الأصوات والمقاطع المسموعة إلى كتابة عربية صحيحة.', levels: { 1: 'كلمات قصيرة وأصوات واضحة', 2: 'المدود والمقاطع', 3: 'التاء المربوطة والألف المقصورة وأنماط الرسم' } },
  comprehension: { id: 'comprehension', nameAr: 'الفهم اللغوي والقرائي', icon: '💡', goalAr: 'يفهم المعنى الصريح وتسلسل الأحداث والسبب والنتيجة والاستدلال.', levels: { 1: 'معلومة صريحة في جملة', 2: 'التسلسل والسبب والنتيجة', 3: 'المفردات من السياق والاستدلال' } },
  morphology: { id: 'morphology', nameAr: 'الوعي الصرفي', icon: '🧩', goalAr: 'يلاحظ الجذور وعائلات الكلمات والعلاقة بين الصيغة والمعنى.', levels: { 1: 'التعرّف إلى كلمات من جذر واحد', 2: 'ربط الجذر بالمعنى', 3: 'مقارنة صيغ مشتقة مختلفة' } },
  auditoryMemory: {
    id: 'auditoryMemory',
    nameAr: 'الذاكرة السمعية',
    icon: '🦜',
    goalAr: 'يحتفظ بتسلسل ما يسمعه ويسترجعه بالترتيب.',
    levels: { 1: 'سلاسل من ٢–٣ كلمات', 2: 'سلاسل من ٣–٤ كلمات', 3: 'سلاسل من ٤–٥ كلمات' },
  },
};

export const PROGRAM_SESSIONS = 20;
export const SESSIONS_PER_WEEK = 5;
export const PROGRAM_WEEKS = PROGRAM_SESSIONS / SESSIONS_PER_WEEK;
export const MINUTES_PER_SESSION = 15;
