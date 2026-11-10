/**
 * What «هُدهُد» says. Short, warm and specific: praise the effort and the strategy, never the
 * child's "cleverness", and after a mistake say what to do next. Children who are anxious about
 * reading respond better to feedback about effort and process than about ability
 * (Mueller & Dweck, 1998; Hattie & Timperley, 2007).
 */
const pick = <T,>(list: readonly T[], seed: number) => list[Math.abs(seed) % list.length];

export const MASCOT_LINES = {
  welcomeGame: (game: string) => `مرحبًا يا بطل! هيا نلعب «${game}» معًا.`,
  ready: 'دورك الآن! خذ وقتك، وحاول أفضل ما تستطيع.',
  gameDone: (game: string) => `أحسنت! أنهيت «${game}». أنا فخور بمحاولتك.`,
  sittingDone: 'انتهت جلسة اليوم. استرح قليلًا، ونكمل في يوم آخر!',
  allDone: 'أنهيت كل الألعاب! هذه ميدالية بطل القراءة لك.',
  practiceCorrect: ['رائع! إجابة صحيحة.', 'أحسنت! استمعت جيدًا.', 'ممتاز! هكذا تمامًا.'] as const,
  practiceWrong: ['محاولة جميلة! انظر إلى الإجابة الصحيحة.', 'لا بأس! هذه هي الإجابة، وسنحاول مرة أخرى.'] as const,
  explainMistake: 'لا بأس، الخطأ يساعدنا على التعلّم. لنفهم الإجابة معًا.',
  spellPracticeCorrect: 'كتابة صحيحة! أحسنت.',
  spellPracticeWrong: 'محاولة جميلة! انظر كيف تُكتب.',
  probeIntro: 'أسئلة قصيرة أولًا، ثم نتعلّم معًا.',
  placementIntro: 'أسئلة قليلة لنعرف من أين نبدأ. لا بأس إن كانت صعبة!',
  transferIntro: 'سنقرأ كلمات جديدة لم نتدرّب عليها. خذ وقتك.',
  skillIntro: (skill: string) => `هيا نتدرّب على ${skill}!`,
  resultUp: 'عمل رائع! انتقلت إلى مستوى جديد.',
  resultMastered: 'أتقنت هذه المهارة! أنا فخور بتعبك.',
  resultStay: 'أحسنت! كل تمرين يقرّبك من الإتقان.',
  resultDown: 'أحسنت المحاولة! سنتدرّب على خطوة أسهل قليلًا.',
  sessionDone: 'انتهت جلسة اليوم! أنت تتقدّم خطوة كل يوم.',
  readyToRead: 'اقرأ بهدوء، ولا تستعجل. أنا أنتظرك هنا بعد القراءة!',
  storyTip: 'نصيحة من هُدهُد:',
  homeHello: 'مرحبًا! أنا هُدهُد، صديق طفلك في رحلة القراءة.',
  readerDone: 'قرأت النص كله! خطوة رائعة.',
  sprintDone: 'رائع! أكملت تحدي اليوم.',
  storyDone: 'قرأت القصة وأجبت عن التحدي. أحسنت!',
} as const;

export const pickLine = pick;
