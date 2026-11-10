/**
 * Baseera guided training program (برنامج بصيرة التدريبي الموجّه).
 *
 * The program is generated from a child's cognitive profile: the weakest skills become the
 * focus, each skill has a three-level ladder, and the child moves up a level only after two
 * consecutive sessions at or above the mastery criterion. Training items are generated fresh
 * for every session from the lexicon, so the child never practises the scored test items.
 */
import type { ProbeRecord } from './progressProbe';
import type { Band, CognitiveProfile, ScoredSubtest } from './scoring';
import {
  MIN_ATTEMPTS_FOR_MASTERY,
  STEP_BACK_BELOW,
  STEP_BACK_MIN_ATTEMPTS,
  SUPPORT_MIN_ATTEMPTS,
  allocateItems,
  bktKey,
  initialStates,
  isMastered,
  observe,
  priorFor,
  type BktLevel,
  type BktStates,
} from './knowledgeTracing';
import {
  AudioSegment,
  ChoiceItem,
  ChoiceOption,
  SpanTrial,
  SubtestId,
  shuffleWith,
} from './battery';
import {
  CONFUSABLE_LETTER_GROUPS,
  CONFUSABLE_PHONEME_PAIRS,
  DISTANT_PHONEME_PAIRS,
  LEXICON,
  LEXICON_IDS,
  PICTURE_IDS,
  dialectMerged,
  LexiconEntry,
  lex,
  showsSynonymPair,
} from './lexicon';

export type SkillId =
  | 'rhyme'
  | 'soundPosition'
  | 'blending'
  | 'discrimination'
  | 'letterSound'
  | 'visualDiscrimination'
  | 'auditoryMemory'
  | 'visualMemory';

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
  auditoryMemory: {
    id: 'auditoryMemory',
    nameAr: 'الذاكرة السمعية',
    icon: '🦜',
    goalAr: 'يحتفظ بتسلسل ما يسمعه ويسترجعه بالترتيب.',
    levels: { 1: 'سلاسل من ٢–٣ كلمات', 2: 'سلاسل من ٣–٤ كلمات', 3: 'سلاسل من ٤–٥ كلمات' },
  },
  visualMemory: {
    id: 'visualMemory',
    nameAr: 'الذاكرة البصرية',
    icon: '🏰',
    goalAr: 'يتذكّر تسلسل ما يراه ويعيد ترتيبه.',
    levels: { 1: 'سلاسل من ٢–٣ صور', 2: 'سلاسل من ٣–٤ صور', 3: 'سلاسل من ٤–٥ صور' },
  },
};

export interface MasteryBadge {
  id: SkillId;
  skill: SkillId;
  titleAr: string;
  icon: string;
  descriptionAr: string;
}

export const SKILL_BADGES: Record<SkillId, MasteryBadge> = {
  rhyme: {
    id: 'rhyme',
    skill: 'rhyme',
    titleAr: 'سفير القافية',
    icon: '🎵',
    descriptionAr: 'يميز إيقاعات وأواخر الكلمات ببراعة وسرعة.',
  },
  soundPosition: {
    id: 'soundPosition',
    skill: 'soundPosition',
    titleAr: 'صقر الأصوات',
    icon: '🔊',
    descriptionAr: 'يصطاد الصوت الأول والأخير في الكلمة بدقة تامة.',
  },
  blending: {
    id: 'blending',
    skill: 'blending',
    titleAr: 'عبقري المقاطع',
    icon: '🧩',
    descriptionAr: 'يركّب المقاطع المسموعة بسلاسة لبناء الكلمات.',
  },
  discrimination: {
    id: 'discrimination',
    skill: 'discrimination',
    titleAr: 'بطل التمييز السمعي',
    icon: '👂',
    descriptionAr: 'يفرّق بذكاء بين أصوات الحروف المتقاربة في المخرج.',
  },
  letterSound: {
    id: 'letterSound',
    skill: 'letterSound',
    titleAr: 'فارس الحروف',
    icon: '✏️',
    descriptionAr: 'يربط شكل الحرف بصوته وحركاته بانسيابية وثقة.',
  },
  visualDiscrimination: {
    id: 'visualDiscrimination',
    skill: 'visualDiscrimination',
    titleAr: 'عين الصقر البصرية',
    icon: '🦅',
    descriptionAr: 'يلاحظ الفروق الدقيقة بين نقاط الحروف ورسمها دون تردد.',
  },
  auditoryMemory: {
    id: 'auditoryMemory',
    skill: 'auditoryMemory',
    titleAr: 'حارس الذاكرة السمعية',
    icon: '🦜',
    descriptionAr: 'يسترجع تسلسل الكلمات المسموعة بالترتيب الصحيح.',
  },
  visualMemory: {
    id: 'visualMemory',
    skill: 'visualMemory',
    titleAr: 'مهندس الذاكرة البصرية',
    icon: '🏰',
    descriptionAr: 'يتذكر ترتيب الأشكال والرموز بدقة ممتازة.',
  },
};

/** Developmental order used to sequence focus skills inside a session. */
const SKILL_ORDER: SkillId[] = [
  'discrimination',
  'rhyme',
  'soundPosition',
  'blending',
  'letterSound',
  'visualDiscrimination',
  'auditoryMemory',
  'visualMemory',
];

export const SUBTEST_TO_SKILLS: Record<SubtestId, SkillId[]> = {
  visualSequential: ['visualMemory'],
  visualAssociative: ['visualMemory'],
  auditorySequential: ['auditoryMemory'],
  pairedAssociate: ['letterSound'],
  rhyme: ['rhyme'],
  phonological: ['soundPosition', 'blending'],
  auditoryDiscrimination: ['discrimination'],
  visualDiscrimination: ['visualDiscrimination'],
  letterSound: ['letterSound'],
  // Reading and naming measures now map to their directly addressable fluency/decoding targets
  // (using provisional within-task accuracy & rate heuristics until Arabic norming completes).
  ranObjects: ['soundPosition'],
  ranLetters: ['letterSound', 'visualDiscrimination'],
  wordReading: ['letterSound', 'blending'],
  nonwordReading: ['blending', 'letterSound', 'soundPosition'],
  oralReading: ['blending', 'letterSound'],
  spelling: ['letterSound', 'soundPosition'],
};

/**
 * Programme dose: 20 sessions, 5 a week (about 4 weeks), 15 minutes of training plus a 2-minute
 * progress probe, about 5.7 hours in all. In the National Reading Panel meta-analysis, phonemic
 * awareness instruction had its largest effects at 5 to 18 hours in total; longer programmes were
 * less effective (Ehri et al., 2001, Reading Research Quarterly 36(3), 250-287).
 */
export const PROGRAM_SESSIONS = 20;
export const SESSIONS_PER_WEEK = 5;
export const PROGRAM_WEEKS = PROGRAM_SESSIONS / SESSIONS_PER_WEEK;
export const MINUTES_PER_SESSION = 15;
/** Missed days are normal; reassessment is offered at the latest two weeks after the planned end. */
const LATEST_REASSESSMENT_DAYS = (PROGRAM_WEEKS + 2) * 7;
const MAX_FOCUS_SKILLS = 3;

/**
 * Skills the programme does not choose as training goals. Training memory improves memory
 * tasks but does not transfer to word decoding or reading comprehension (Melby-Lervåg,
 * Redick & Hulme, 2016, meta-analysis of 87 publications). A memory weakness stays in the
 * report with teaching accommodations; training time goes to phonological and letter skills.
 * The definitions remain so plans created before this rule still run.
 */
export const NOT_TRAINED_AS_FOCUS: ReadonlySet<SkillId> = new Set<SkillId>(['auditoryMemory', 'visualMemory']);
export const FOCUS_SKILLS = (Object.keys(SKILLS) as SkillId[]).filter((id) => !NOT_TRAINED_AS_FOCUS.has(id));

export interface TrainingPlan {
  createdAt: string;
  preventive: boolean;
  focus: SkillId[];
  rationaleAr: string[];
}

/**
 * Provisional operational heuristic used only to sort relative training priorities while
 * independent Arabic norms are pending. It is NOT a standardized cutoff dividing mastered
 * skills from clinical impairment.
 */
const PROVISIONAL_PRIORITY_PERCENT = 75;
const RELATIVE_DIP_POINTS = 20;
const RELATIVE_DIP_CEILING = 85;
const LETTER_SOUND_PRIORITY_MIN_AGE_MONTHS = 60;
const MODERATE_START_MIN_PERCENT = 55;

/**
 * Effective descriptive performance (0-100) used strictly for relative within-child skill
 * ordering. Combines accuracy with provisional naming/fluency signals when RAN or oral reading
 * metrics are present, without making normative peer claims.
 */
export function effectiveSubtestPercent(s: ScoredSubtest): number | null {
  if (s.scoreAvailable === false || s.total <= 0) return null;
  let effective = s.percent;
  if ((s.subtestId === 'ranObjects' || s.subtestId === 'ranLetters') && typeof s.measures?.itemsPerSecond === 'number') {
    if (s.measures.itemsPerSecond < 0.85) {
      effective = Math.min(effective, Math.round(s.measures.itemsPerSecond * 80));
    }
  }
  if (s.subtestId === 'oralReading' && typeof s.measures?.correctPerMinute === 'number') {
    if (s.measures.correctPerMinute < 20) {
      effective = Math.min(effective, 68);
    }
  }
  return Math.max(0, Math.min(100, effective));
}

function skillsForScoredSubtest(s: ScoredSubtest, ageMonths: number): SkillId[] {
  const skills = [...(SUBTEST_TO_SKILLS[s.subtestId] ?? [])];
  if (
    s.subtestId === 'spelling' &&
    s.measures?.spellingErrors?.some((e) => e.kind === 'letter' || e.kind === 'taaMarbuta' || e.kind === 'alifMaqsura') &&
    !skills.includes('visualDiscrimination')
  ) {
    skills.push('visualDiscrimination');
  }
  if (ageMonths < LETTER_SOUND_PRIORITY_MIN_AGE_MONTHS) {
    return skills.filter((sk) => sk !== 'letterSound');
  }
  return skills;
}

export function buildTrainingPlan(profile: CognitiveProfile, now = new Date()): TrainingPlan {
  const rationaleAr: string[] = [];
  const ordered: SkillId[] = [];
  const weaknesses = Array.isArray(profile?.weaknesses) ? profile.weaknesses : [];
  const subtests = Array.isArray(profile?.subtests) ? profile.subtests : [];
  const ageMonths = profile?.ageMonths ?? 72;

  for (const subtestId of weaknesses) {
    for (const skill of SUBTEST_TO_SKILLS[subtestId] ?? []) {
      if (!ordered.includes(skill)) {
        ordered.push(skill);
      }
    }
  }

  let fromTaskEvidence = false;
  let fromReadingTargets = false;
  if (ordered.length === 0 && (subtests.length > 0 || (profile?.readingTargets?.skills?.length ?? 0) > 0)) {
    const scoredEntries = subtests
      .map((s) => ({ subtest: s, effective: effectiveSubtestPercent(s) }))
      .filter((entry): entry is { subtest: ScoredSubtest; effective: number } => entry.effective !== null);

    const nonMemoryBest = scoredEntries
      .filter(({ subtest }) => !(SUBTEST_TO_SKILLS[subtest.subtestId] ?? []).every((sk) => NOT_TRAINED_AS_FOCUS.has(sk)))
      .reduce((max, { effective }) => Math.max(max, effective), 0);

    const skillPriority = new Map<SkillId, number>();
    const addSkillScore = (skill: SkillId, score: number) => {
      if (ageMonths < LETTER_SOUND_PRIORITY_MIN_AGE_MONTHS && skill === 'letterSound') return;
      const prev = skillPriority.get(skill);
      if (prev === undefined || score < prev) skillPriority.set(skill, score);
    };

    for (const { subtest, effective } of scoredEntries) {
      const belowProvisional = effective < PROVISIONAL_PRIORITY_PERCENT;
      const relativeDip = nonMemoryBest - effective >= RELATIVE_DIP_POINTS && effective < RELATIVE_DIP_CEILING;
      if (!belowProvisional && !relativeDip) continue;
      for (const skill of skillsForScoredSubtest(subtest, ageMonths)) {
        addSkillScore(skill, effective);
      }
    }

    if (profile?.readingTargets && profile.readingTargets.skills.length > 0) {
      const oral = scoredEntries.find((e) => e.subtest.subtestId === 'oralReading')?.effective ?? 65;
      const targetPriority = Math.min(oral, 62);
      for (const skill of profile.readingTargets.skills) {
        addSkillScore(skill, targetPriority);
      }
      fromReadingTargets = true;
    }

    const sortedSkills = Array.from(skillPriority.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([skill]) => skill);
    for (const skill of sortedSkills) {
      if (!ordered.includes(skill)) ordered.push(skill);
    }
    fromTaskEvidence = ordered.length > 0;
  }

  const memoryOnly = ordered.filter((s) => NOT_TRAINED_AS_FOCUS.has(s));
  const trainable = ordered.filter((s) => !NOT_TRAINED_AS_FOCUS.has(s));
  const preventive = trainable.length === 0;
  const chosen = preventive ? (['blending', 'letterSound'] as SkillId[]) : trainable.slice(0, MAX_FOCUS_SKILLS);
  const focus = [...chosen].sort((a, b) => SKILL_ORDER.indexOf(a) - SKILL_ORDER.indexOf(b));

  if (memoryOnly.length > 0) {
    rationaleAr.push('ظهر تراجع في مهام الذاكرة، لكن تدريب الذاكرة لا ينتقل أثره إلى القراءة في الأبحاث؛ لذلك يركّز البرنامج على مهارات القراءة والأصوات وتُعرض تكييفات التدريس في التقرير.');
  }
  if (preventive) {
    rationaleAr.push(
      memoryOnly.length > 0
        ? 'يركّز البرنامج على التركيب الصوتي وربط الحرف بصوته، وهما أساس تعلّم القراءة.'
        : 'لم تُسجَّل فجوات نسبية في المهام المكتملة؛ البرنامج وقائي يعزّز التركيب الصوتي وربط الحرف بصوته استعدادًا للقراءة.'
    );
  } else {
    rationaleAr.push(
      fromTaskEvidence
        ? 'اختيرت مهارات التركيز (حتى ٣ مهارات) بالترتيب من أدنى المهام أداءً أو الأبطأ تسميةً، وهو ترتيب تشغيلي مؤقت دون عتبات معيارية مقننة.'
        : 'اختيرت المهارات الأضعف في الملف المعرفي (حتى ٣ مهارات) لأن التركيز يحقق أثرًا أكبر من توزيع الجهد.'
    );
    if (fromReadingTargets) {
      rationaleAr.push('رُبطت أخطاء القراءة الجهرية المرصودة (الأصوات أو الحروف المتشابهة) مباشرة بمهارات التركيز.');
    }
    rationaleAr.push('تُضبط مستويات البداية (١ أو ٢) وعدد تمارين الجلسة وفق نسبة الأداء الملاحظة في الفحص لكل مهارة.');
    if (trainable.length > MAX_FOCUS_SKILLS) {
      rationaleAr.push('بقية المهارات الأقل دقة تُضاف بعد إتقان مهارة من مهارات التركيز الحالية.');
    }
  }
  return { createdAt: now.toISOString(), preventive, focus, rationaleAr };
}

// ---------------------------------------------------------------------------
// Progress and mastery
// ---------------------------------------------------------------------------
export interface SessionRecord {
  date: string;
  skill: SkillId;
  level: Level;
  correct: number;
  total: number;
}

export interface TrainingProgress {
  plan: TrainingPlan;
  levels: Record<string, Level>;
  mastered: SkillId[];
  history: SessionRecord[];
  /** Skills that dropped back a level and may need adult support. */
  supportFlags: SkillId[];
  /** One fixed-difficulty progress probe per session (see progressProbe.ts). Absent in older records. */
  probes?: ProbeRecord[];
  /** Knowledge-tracing state per skill and level (see knowledgeTracing.ts). Absent in older records. */
  bkt?: BktStates;
  /** Sounds and letters to practise more often, from the child's oral-reading errors. */
  targets?: TrainingTargets;
  /** Lessons (skill:level) the child has been taught; a lesson repeats after stepping back. */
  lessonsSeen?: string[];
  /** Earned mastery badge skill ids. */
  badges?: string[];
}

export interface TrainingTargets {
  /** Confusable sound pairs the child mixed up while reading (only pairs the exercises can voice). */
  soundPairs: Array<[string, string]>;
  /** Letters the child confused while reading. */
  letters: string[];
  /** When and from which reading passage the targets came. */
  source?: { passageId: string; analysedAt: string };
}

/** Half of the relevant items practise the child's own confusions; the rest keep the skill broad. */
const TARGET_SHARE = 0.5;

const BAND_ORDER: Band[] = ['severe', 'below', 'average', 'strength'];

/** The screening band behind each trainable skill (the weakest subtest that feeds it). */
export function skillBandsFromProfile(profile: Pick<CognitiveProfile, 'subtests'> | null | undefined): Partial<Record<SkillId, Band>> {
  const bands: Partial<Record<SkillId, Band>> = {};
  for (const s of profile?.subtests ?? []) {
    for (const skill of SUBTEST_TO_SKILLS[s.subtestId] ?? []) {
      const current = bands[skill];
      if (s.band && (!current || BAND_ORDER.indexOf(s.band) < BAND_ORDER.indexOf(current))) bands[skill] = s.band;
    }
  }
  return bands;
}

/** Observed within-task percent behind each trainable skill (lowest effective metric among feeding tasks). */
export function skillObservedPercentsFromProfile(
  profile: Pick<CognitiveProfile, 'subtests' | 'readingTargets'> | null | undefined
): Partial<Record<SkillId, number>> {
  const percents: Partial<Record<SkillId, number>> = {};
  const setMin = (skill: SkillId, val: number) => {
    const cur = percents[skill];
    if (cur === undefined || val < cur) percents[skill] = val;
  };
  for (const s of profile?.subtests ?? []) {
    const eff = effectiveSubtestPercent(s);
    if (eff === null) continue;
    for (const skill of SUBTEST_TO_SKILLS[s.subtestId] ?? []) {
      setMin(skill, eff);
    }
    if (
      s.subtestId === 'spelling' &&
      s.measures?.spellingErrors?.some((e) => e.kind === 'letter' || e.kind === 'taaMarbuta' || e.kind === 'alifMaqsura')
    ) {
      setMin('visualDiscrimination', eff);
    }
  }
  if (profile?.readingTargets && profile.readingTargets.skills.length > 0) {
    const oral = profile.subtests?.find((s) => s.subtestId === 'oralReading');
    const oralEff = oral ? effectiveSubtestPercent(oral) : null;
    const readingPriorityPct = Math.min(oralEff ?? 62, 62);
    for (const skill of profile.readingTargets.skills) {
      setMin(skill, readingPriorityPct);
    }
  }
  return percents;
}

/** Determine initial level (1 foundational, 2 intermediate/borderline) per skill from screening results. */
export function startLevelsFromProfile(
  plan: TrainingPlan,
  profile: Pick<CognitiveProfile, 'subtests' | 'readingTargets'> | null | undefined,
  fallback: Level = 1
): Record<SkillId, Level> {
  const bands = skillBandsFromProfile(profile);
  const observed = skillObservedPercentsFromProfile(profile);
  const levels = {} as Record<SkillId, Level>;
  for (const skill of plan.focus) {
    if (plan.preventive) {
      levels[skill] = 2;
      continue;
    }
    const band = bands[skill];
    const pct = observed[skill];
    if (band === 'severe') {
      levels[skill] = 1;
    } else if (typeof pct === 'number') {
      levels[skill] = pct < MODERATE_START_MIN_PERCENT ? 1 : 2;
    } else if (band === 'average' || band === 'strength') {
      levels[skill] = 2;
    } else {
      levels[skill] = fallback;
    }
  }
  return levels;
}

export function createProgress(
  plan: TrainingPlan,
  startLevelOrLevels: Level | Partial<Record<SkillId, Level>> = 1,
  bands: Partial<Record<SkillId, Band>> = {},
  observedPercents: Partial<Record<SkillId, number>> = {}
): TrainingProgress {
  const levels = Object.fromEntries(
    plan.focus.map((s) => {
      const assigned = typeof startLevelOrLevels === 'number' ? startLevelOrLevels : (startLevelOrLevels[s] ?? 1);
      return [s, plan.preventive ? 2 : assigned];
    })
  ) as Record<string, Level>;
  return {
    plan,
    levels,
    mastered: [],
    history: [],
    supportFlags: [],
    probes: [],
    badges: [],
    bkt: initialStates(plan.focus, bands, levels as Record<string, BktLevel>, observedPercents),
  };
}

/** Build initial TrainingProgress directly from a TrainingPlan + CognitiveProfile (levels, BKT priors, and reading error targets). */
export function createPersonalizedProgress(
  plan: TrainingPlan,
  profile: CognitiveProfile | null | undefined
): TrainingProgress {
  const bands = skillBandsFromProfile(profile);
  const observed = skillObservedPercentsFromProfile(profile);
  const startLevels = startLevelsFromProfile(plan, profile, 1);
  const base = createProgress(plan, startLevels, bands, observed);
  if (profile?.readingTargets && (profile.readingTargets.soundPairs.length > 0 || profile.readingTargets.letters.length > 0)) {
    return {
      ...base,
      targets: {
        soundPairs: profile.readingTargets.soundPairs.slice(0, 6),
        letters: profile.readingTargets.letters.slice(0, 10),
        source: { passageId: profile.readingTargets.passageId, analysedAt: profile.readingTargets.analysedAt },
      },
    };
  }
  return base;
}

export interface PlanSkillSetup {
  level: Level;
  initialP: number;
  sessionItems: number;
  observedPercent?: number;
}

/** Preview exact starting level, initial mastery estimate, and allocated session dose per focus skill. */
export function summarizePlanSetup(
  plan: TrainingPlan,
  profile: CognitiveProfile | null | undefined
): Partial<Record<SkillId, PlanSkillSetup>> {
  const preview = createPersonalizedProgress(plan, profile);
  const observed = skillObservedPercentsFromProfile(profile);
  const alloc = allocateItems(
    plan.focus.map((skill) => ({ skill, p: masteryEstimate(preview, skill).p }))
  );
  const out: Partial<Record<SkillId, PlanSkillSetup>> = {};
  for (const skill of plan.focus) {
    const est = masteryEstimate(preview, skill);
    out[skill] = {
      level: est.level,
      initialP: est.p,
      sessionItems: alloc[skill] ?? 8,
      ...(typeof observed[skill] === 'number' ? { observedPercent: observed[skill] } : {}),
    };
  }
  return out;
}

/** Award a mastery badge for a skill if not already earned. */
export function awardBadge(progress: TrainingProgress, skill: SkillId): { progress: TrainingProgress; newlyAwarded: boolean } {
  const currentBadges = progress.badges ?? [];
  if (currentBadges.includes(skill)) {
    return { progress, newlyAwarded: false };
  }
  return {
    progress: {
      ...progress,
      badges: [...currentBadges, skill],
    },
    newlyAwarded: true,
  };
}

export interface HomeActivity {
  titleAr: string;
  activityAr: string;
  exampleWords: string[];
}

/** 1-minute actionable home activity connecting the session's training with daily family life. */
export function getHomeActivity(skill: SkillId, targets?: TrainingTargets): HomeActivity {
  switch (skill) {
    case 'rhyme':
      return {
        titleAr: 'لعبة صيد القوافي في المنزل 🎵',
        activityAr: 'اطلب من طفلك أن يجد في البيت أو محيطه كلمات تتناغم مع كلمة تختارها مثل (باب / كتاب / سحاب) واحتفلوا بالإيقاع المتشابه.',
        exampleWords: ['بَاب', 'كِتَاب', 'سَحَاب'],
      };
    case 'soundPosition':
      return {
        titleAr: 'لعبة الصوت الأول والأخير السريع 🔊',
        activityAr: 'أشر إلى أشياء حولكم في الغرفة واطلب من طفلك استخراج الصوت الأول أو الأخير فوراً بصوته الصافي (مثل: سَـرير / كُـرسي).',
        exampleWords: ['سَرِير', 'كُرْسِي', 'طَاوِلَة'],
      };
    case 'blending':
      return {
        titleAr: 'لعبة التصفيق المقطعي 🧩',
        activityAr: 'انطق الكلمة مقطعة مع التصفيق (طَـ ... بَق) واطلب من طفلك أن يقفز ويقول الكلمة مجمعة كاملة (طَبَق!).',
        exampleWords: ['طَبَق', 'قَلَم', 'كِتَاب'],
      };
    case 'discrimination':
      if (targets?.soundPairs && targets.soundPairs.length > 0) {
        const pair = targets.soundPairs[0];
        return {
          titleAr: `تحدي التمييز الصوتي (${pair.join(' / ')}) 👂`,
          activityAr: `ضع يد طفلك أمام فمه ليميز الفارق الحركي؛ مثلاً الهواء الصافر الخفيف في حرف (${pair[0]}) مقابل الامتلاء والتفخيم في حرف (${pair[1]}).`,
          exampleWords: pair[0] === 'س' ? ['سَيْف', 'صَيْف', 'سَبِيل', 'صَبْر'] : ['تِين', 'طِين', 'دَار', 'ضَار'],
        };
      }
      return {
        titleAr: 'لعبة الأذن الذكية والأصوات المتقاربة 👂',
        activityAr: 'انطق كلمتين واسأل طفلك: هل سمعت نفس الصوت أم صوتاً مختلفاً؟ (مثل: تين / طين).',
        exampleWords: ['تِين', 'طِين', 'دَار', 'ضَار'],
      };
    case 'letterSound':
      return {
        titleAr: 'الرسم بالهواء والأصابع ✏️',
        activityAr: 'ارسم الحرف بإصبعك على كف طفلك أو في الهواء واطلب منه نطق صوته الصافي بحركته (مَ / مُ / مِ) مع ذكر كلمة تبدأ به.',
        exampleWords: ['مَوْز', 'بَاب', 'رَمْل'],
      };
    case 'visualDiscrimination':
      return {
        titleAr: 'لعبة النقطة الخفية وشكل الحرف 🦅',
        activityAr: 'اكتب حروفاً متشابهة رسماً واسأل طفلك كالمحقق: أين هربت النقطة في الباء (تحت)؟ وكم نقطة في التاء (اثنتان فوق)؟',
        exampleWords: ['بَيْت', 'تِين', 'ثَوْب'],
      };
    default:
      return {
        titleAr: 'دقيقة تشجيع قرائي ممتعة ⭐',
        activityAr: 'اقرأ مع طفلك لافتة أو عنوان قصة ودعه يشير إلى الكلمات التي يعرف أصوات حروفها.',
        exampleWords: ['نُور', 'قَمَر', 'شَمْس'],
      };
  }
}

/** Older progress records have no knowledge-tracing state: rebuild a neutral one from their levels. */
export function ensureBkt(progress: TrainingProgress): TrainingProgress & { bkt: BktStates } {
  if (progress.bkt) return progress as TrainingProgress & { bkt: BktStates };
  const bkt: BktStates = {};
  for (const skill of progress.plan.focus) {
    const current = (progress.levels[skill] ?? 1) as BktLevel;
    const done = progress.mastered.includes(skill);
    for (const level of [1, 2, 3] as BktLevel[]) {
      const known = done || level < current;
      bkt[bktKey(skill, level)] = known ? { p: 0.95, n: MIN_ATTEMPTS_FOR_MASTERY, c: MIN_ATTEMPTS_FOR_MASTERY, seq: '' } : { p: priorFor(undefined, level), n: 0, c: 0, seq: '' };
    }
  }
  return { ...progress, bkt };
}

/** The model's current estimate for a skill: the level being practised and P(mastered) there. */
export function masteryEstimate(progress: TrainingProgress, skill: SkillId): { level: Level; p: number } {
  const p = ensureBkt(progress);
  const level = (p.levels[skill] ?? 1) as Level;
  const state = p.bkt[bktKey(skill, p.mastered.includes(skill) ? 3 : level)];
  return { level, p: state?.p ?? 0 };
}

export type LevelChange = 'up' | 'down' | 'mastered' | 'stay';

/**
 * One practice answer (with feedback). The knowledge-tracing model updates P(mastered) for the
 * skill's current level and decides: move up at P >= 0.95 (after at least 5 answers), step back
 * a level when P stays below 0.2 after 8 answers, or flag adult support at level 1.
 */
export function recordAnswer(
  progress: TrainingProgress,
  skill: SkillId,
  correct: boolean,
  guess: number
): { progress: TrainingProgress; change: LevelChange } {
  const p = ensureBkt(progress);
  const level = (p.levels[skill] ?? 1) as BktLevel;
  const key = bktKey(skill, level);
  const state = observe(p.bkt[key] ?? { p: priorFor(undefined, level), n: 0, c: 0, seq: '' }, correct, guess, true);
  const bkt: BktStates = { ...p.bkt, [key]: state };
  const levels = { ...p.levels };
  const mastered = [...p.mastered];
  let supportFlags = [...p.supportFlags];
  let change: LevelChange = 'stay';

  if (isMastered(state)) {
    supportFlags = supportFlags.filter((s) => s !== skill);
    if (level < 3) {
      levels[skill] = (level + 1) as Level;
      change = 'up';
    } else if (!mastered.includes(skill)) {
      mastered.push(skill);
      change = 'mastered';
    }
  } else if (level > 1 && state.n >= STEP_BACK_MIN_ATTEMPTS && state.p < STEP_BACK_BELOW) {
    levels[skill] = (level - 1) as Level;
    // The easier level was assumed secure; this evidence says it is not, so it must be re-earned.
    const lower = bktKey(skill, (level - 1) as BktLevel);
    bkt[lower] = { ...bkt[lower], p: Math.min(bkt[lower]?.p ?? 0.5, 0.6), n: 0 };
    bkt[key] = { ...state, n: 0 };
    if (!supportFlags.includes(skill)) supportFlags.push(skill);
    change = 'down';
  } else if (level === 1 && state.n >= SUPPORT_MIN_ATTEMPTS && state.p < STEP_BACK_BELOW && !supportFlags.includes(skill)) {
    supportFlags.push(skill);
  }
  return { progress: { ...p, bkt, levels, mastered, supportFlags }, change };
}

/** Log one block of practice for the session history (sessions count and teacher table). */
export function recordSkillBlock(progress: TrainingProgress, skill: SkillId, level: Level, correct: number, total: number, now = new Date()): TrainingProgress {
  return { ...progress, history: [...progress.history, { date: now.toISOString(), skill, level, correct, total }] };
}

/**
 * Probe answers are evidence without learning: they update the level-2 estimate of each trained
 * skill. A child still at level 1 who has clearly mastered level 2 on the probe moves up.
 */
export function applyProbeEvidence(
  progress: TrainingProgress,
  answers: Array<{ skill: SkillId; correct: boolean; guess: number }>
): { progress: TrainingProgress; promoted: SkillId[] } {
  const p = ensureBkt(progress);
  const bkt: BktStates = { ...p.bkt };
  const levels = { ...p.levels };
  for (const a of answers) {
    if (!p.plan.focus.includes(a.skill)) continue;
    const key = bktKey(a.skill, 2);
    bkt[key] = observe(bkt[key] ?? { p: priorFor(undefined, 2), n: 0, c: 0, seq: '' }, a.correct, a.guess, false);
  }
  const promoted: SkillId[] = [];
  for (const skill of p.plan.focus) {
    if ((levels[skill] ?? 1) === 1 && isMastered(bkt[bktKey(skill, 2)])) {
      levels[skill] = 2;
      bkt[bktKey(skill, 1)] = { ...bkt[bktKey(skill, 1)], p: Math.max(bkt[bktKey(skill, 1)]?.p ?? 0, 0.95) };
      promoted.push(skill);
    }
  }
  return { progress: { ...p, bkt, levels }, promoted };
}

/**
 * Compatibility for callers that only know a block score: replays the block as answers
 * (correct and wrong answers spread evenly) at chance level `guess`, then logs it.
 */
export function applySession(
  progress: TrainingProgress,
  skill: SkillId,
  correct: number,
  total: number,
  now = new Date(),
  guess = 1 / 3
): { progress: TrainingProgress; change: LevelChange } {
  const level = (progress.levels[skill] ?? 1) as Level;
  let current = progress;
  let change: LevelChange = 'stay';
  for (let i = 0; i < total; i++) {
    const isCorrect = Math.floor(((i + 1) * correct) / total) > Math.floor((i * correct) / total);
    const r = recordAnswer(current, skill, isCorrect, guess);
    current = r.progress;
    if (r.change !== 'stay') change = r.change;
  }
  return { progress: recordSkillBlock(current, skill, level, correct, total, now), change };
}

/** Chance of answering an item right by guessing: the "guess" parameter of the model. */
export function chanceOf(task: TrainingTask): number {
  if (task.kind === 'choice') return 1 / Math.max(2, task.item.options.length);
  return 0.05;
}

export function sessionsCompleted(progress: TrainingProgress): number {
  return new Set(progress.history.map((h) => h.date.slice(0, 10))).size;
}

export function isReassessmentDue(progress: TrainingProgress, now = new Date()): boolean {
  const days = (now.getTime() - new Date(progress.plan.createdAt).getTime()) / 86_400_000;
  const allMastered = progress.plan.focus.every((s) => progress.mastered.includes(s));
  return allMastered || days >= LATEST_REASSESSMENT_DAYS || sessionsCompleted(progress) >= PROGRAM_SESSIONS;
}

// ---------------------------------------------------------------------------
// Item generators
// ---------------------------------------------------------------------------
export type TrainingTask =
  | { kind: 'choice'; item: ChoiceItem }
  | { kind: 'span'; modality: 'visual' | 'auditory'; trial: SpanTrial };

const ITEMS_PER_SESSION = 8;
const SPAN_TRIALS_PER_SESSION = 5;

const pic = (id: string): ChoiceOption => {
  const entry = lex(id);
  return { id, visual: { type: 'emoji', value: entry.emoji, label: entry.word } };
};
const glyph = (value: string): ChoiceOption => ({ id: value, visual: { type: 'glyph', value, label: value } });
const named = (ids: string[]): AudioSegment[] => ids.map((id) => ({ text: lex(id).word, highlight: id, pauseAfterMs: 250 }));
const pick = <T,>(list: T[], random: () => number): T => list[Math.floor(random() * list.length)];

function stripDiacritics(text: string): string {
  return text.replace(/[ً-ْٰ]/g, '');
}

function rhymeTask(random: () => number, level: Level, n: number): ChoiceItem | null {
  const optionCount = level + 1;
  const groups = new Map<string, LexiconEntry[]>();
  for (const id of PICTURE_IDS) {
    const e = LEXICON[id];
    groups.set(e.rhyme, [...(groups.get(e.rhyme) ?? []), e]);
  }
  const rhymingSets = Array.from(groups.values()).filter((g) => g.length >= 2);
  const set = pick(rhymingSets, random);
  const [target, answer] = shuffleWith(set, random);
  const distractors = shuffleWith(
    PICTURE_IDS.map((id) => LEXICON[id]).filter((e) => e.rhyme !== target.rhyme),
    random
  ).slice(0, optionCount - 1);
  const options = shuffleWith([answer, ...distractors], random).map((e) => e.id);
  return {
    id: `tr-rhyme-${n}`,
    promptAr: `أيّ صورة تنتهي مثل «${target.word}»؟`,
    stimulus: { type: 'emoji', value: target.emoji, label: target.word },
    audio: [
      { text: target.word, highlight: 'stimulus', pauseAfterMs: 400 },
      ...named(options),
      { text: `أَيُّ صُورَةٍ تَنْتَهِي مِثْلَ: ${target.word}؟` },
    ],
    options: options.map(pic),
    correctId: answer.id,
    tag: 'rhyme',
  };
}

function confusableWith(letter: string): string[] {
  const fromPairs = CONFUSABLE_PHONEME_PAIRS.filter((p) => p.includes(letter)).map((p) => (p[0] === letter ? p[1] : p[0]));
  const fromGroups = CONFUSABLE_LETTER_GROUPS.find((g) => g.includes(letter))?.filter((l) => l !== letter) ?? [];
  return Array.from(new Set([...fromPairs, ...fromGroups]));
}

function soundPositionTask(random: () => number, level: Level, n: number): ChoiceItem | null {
  const useCoda = level === 3;
  const key = (e: LexiconEntry) => (useCoda ? e.coda : e.onset);
  const entries = PICTURE_IDS.map((id) => LEXICON[id]).filter((e) => key(e) !== null);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const target = pick(entries, random);
    const sound = key(target) as string;
    const matches = entries.filter((e) => e.id !== target.id && key(e) === sound);
    if (matches.length === 0) continue;
    const answer = pick(matches, random);
    const close = level === 2 ? confusableWith(sound) : [];
    // Outside the deliberate fine-contrast level, never offer a distractor whose sound a common
    // dialect merges with the answer's (it could be a second correct answer for that child).
    const pool = entries.filter(
      (e) => key(e) !== sound && e.id !== target.id && (close.includes(key(e) as string) || !dialectMerged(key(e) as string, sound))
    );
    const preferred = shuffleWith(pool.filter((e) => close.includes(key(e) as string)), random);
    const others = shuffleWith(pool.filter((e) => !close.includes(key(e) as string)), random);
    const distractors = [...preferred, ...others].slice(0, 2);
    const options = shuffleWith([answer, ...distractors], random).map((e) => e.id);
    return {
      id: `tr-pos-${n}`,
      promptAr: useCoda ? `أيّ صورة تنتهي بآخر صوت في «${target.word}»؟` : `أيّ صورة تبدأ بصوت «${target.word}» نفسه؟`,
      stimulus: { type: 'emoji', value: target.emoji, label: target.word },
      audio: [
        { text: target.word, highlight: 'stimulus', pauseAfterMs: 400 },
        ...named(options),
        {
          text: useCoda
            ? `أَيُّ صُورَةٍ آخِرُ صَوْتٍ فِيهَا مِثْلُ آخِرِ صَوْتٍ فِي: ${target.word}؟`
            : `أَيُّ صُورَةٍ تَبْدَأُ بِصَوْتِ: ${target.word}؟`,
        },
      ],
      options: options.map(pic),
      correctId: answer.id,
      tag: useCoda ? 'coda' : 'onset',
    };
  }
  return null;
}

function blendingTask(random: () => number, level: Level, n: number): ChoiceItem | null {
  const entries = PICTURE_IDS.map((id) => LEXICON[id]);
  if (level === 3) {
    const target = pick(entries.filter((e) => e.syllables.length <= 4), random);
    return {
      id: `tr-count-${n}`,
      promptAr: `كم مقطعًا في «${target.word}»؟`,
      stimulus: { type: 'emoji', value: target.emoji, label: target.word },
      audio: [{ text: `كَمْ مَقْطَعًا فِي كَلِمَةِ: ${target.word}؟ صَفِّقْ مَعَ كُلِّ مَقْطَعٍ.`, highlight: 'stimulus' }],
      options: [1, 2, 3, 4].map((v) => ({ id: `n${v}`, visual: { type: 'count', value: v, label: `${v}` } })),
      correctId: `n${target.syllables.length}`,
      tag: 'syllableCount',
    };
  }
  const candidates = entries.filter((e) => (level === 1 ? e.syllables.length === 2 : e.syllables.length >= 3));
  const target = pick(candidates, random);
  // Distractors share the first syllable's onset or length so the child must blend, not guess.
  const distractors = shuffleWith(
    entries.filter((e) => e.id !== target.id && (e.onset === target.onset || e.syllables.length === target.syllables.length)),
    random
  ).slice(0, 2);
  const options = shuffleWith([target, ...distractors], random).map((e) => e.id);
  return {
    id: `tr-blend-${n}`,
    promptAr: 'ركّب الأجزاء: ما الكلمة؟',
    audio: [
      { text: 'اسْمَعِ الأَجْزَاءَ وَرَكِّبْهَا.', pauseAfterMs: 400 },
      ...target.syllables.map((s) => ({ text: s, pauseAfterMs: 650 })),
      { text: 'مَا الكَلِمَةُ؟', pauseAfterMs: 200 },
      ...named(options),
    ],
    options: options.map(pic),
    correctId: target.id,
    tag: 'blending',
  };
}

const LONG_VOWEL = { a: 'َا', i: 'ِي', u: 'ُو' } as const;
export function cvSyllable(letter: string, vowel: keyof typeof LONG_VOWEL): string {
  if (letter === 'ء') return vowel === 'a' ? 'آ' : vowel === 'i' ? 'إِي' : 'أُو';
  return letter + LONG_VOWEL[vowel];
}

const MINIMAL_PAIRS: Array<[string, string]> = [
  ['dog', 'heart'],
  ['bee', 'palm'],
  ['sword', 'summer'],
];

function discriminationTask(random: () => number, level: Level, n: number, targets?: TrainingTargets): ChoiceItem {
  if (level === 3 && random() < 0.35) {
    const pair = pick(MINIMAL_PAIRS, random);
    const target = pick(pair, random);
    const options = shuffleWith([...pair], random);
    return {
      id: `tr-mp-${n}`,
      promptAr: 'أين الصورة التي سمعت اسمها؟',
      audio: [{ text: `أَيْنَ: ${lex(target).word}؟` }],
      options: options.map(pic),
      correctId: target,
      tag: 'minimalPair',
    };
  }
  const ownPairs = level === 1 ? [] : (targets?.soundPairs ?? []).filter(([x, y]) => CONFUSABLE_PHONEME_PAIRS.some(([p, q]) => (p === x && q === y) || (p === y && q === x)));
  const pairs = level === 1 ? DISTANT_PHONEME_PAIRS : ownPairs.length > 0 && random() < TARGET_SHARE ? ownPairs : CONFUSABLE_PHONEME_PAIRS;
  const [a, b] = shuffleWith([...pick(pairs, random)], random);
  const vowel = level === 3 ? pick(['i', 'u'] as const, random) : 'a';
  const same = random() < 0.3;
  const first = cvSyllable(a, vowel);
  const second = cvSyllable(same ? a : b, vowel);
  return {
    id: `tr-sd-${n}`,
    promptAr: 'هل سمعت الصوت نفسه مرتين؟',
    audio: [
      { text: first, pauseAfterMs: 700 },
      { text: second, pauseAfterMs: 400 },
      { text: 'الصَّوْتُ نَفْسُهُ، أَمْ صَوْتَانِ مُخْتَلِفَانِ؟' },
    ],
    options: [
      { id: 'same', visual: { type: 'sameDifferent', value: 'same', label: 'الصوت نفسه' } },
      { id: 'different', visual: { type: 'sameDifferent', value: 'different', label: 'صوتان مختلفان' } },
    ],
    correctId: same ? 'same' : 'different',
    tag: same ? 'catch' : 'contrast',
  };
}

const LETTER_SET_1 = ['م', 'ب', 'س', 'ل', 'ر', 'ن'];
const LETTER_SET_2 = ['ت', 'د', 'ف', 'ك', 'ع', 'ح'];
const ALL_LETTERS = 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' ');
const SHORT_VOWEL = { a: 'َ', i: 'ِ', u: 'ُ' } as const;

function letterSoundTask(random: () => number, level: Level, n: number, targets?: TrainingTargets): ChoiceItem {
  const set = level === 1 ? LETTER_SET_1 : level === 2 ? LETTER_SET_2 : ALL_LETTERS.filter((l) => l !== 'ا');
  const own = (targets?.letters ?? []).filter((l) => set.includes(l));
  const letter = own.length > 0 && random() < TARGET_SHARE ? pick(own, random) : pick(set, random);
  const close = level === 3 ? confusableWith(letter).filter((l) => ALL_LETTERS.includes(l)) : [];
  const farPool = (level === 3 ? ALL_LETTERS : set).filter((l) => l !== letter && !close.includes(l));
  const distractors = [...shuffleWith(close, random), ...shuffleWith(farPool, random)].slice(0, 3);
  const vowel = level === 3 ? pick(['a', 'i', 'u'] as const, random) : 'a';
  const sound = letter + SHORT_VOWEL[vowel];
  return {
    id: `tr-ls-${n}`,
    promptAr: 'أيّ حرف له هذا الصوت؟',
    audio: [{ text: `أَيُّ حَرْفٍ صَوْتُهُ: ${sound} ... ${sound}؟` }],
    options: shuffleWith([letter, ...distractors], random).map(glyph),
    correctId: letter,
    tag: 'letterSound',
  };
}

function swapOneLetter(word: string, random: () => number): string | null {
  const chars = Array.from(word);
  const positions = shuffleWith(chars.map((_, i) => i), random);
  for (const i of positions) {
    const group = CONFUSABLE_LETTER_GROUPS.find((g) => g.includes(chars[i]));
    if (!group) continue;
    const replacement = pick(group.filter((l) => l !== chars[i]), random);
    const copy = [...chars];
    copy[i] = replacement;
    return copy.join('');
  }
  return null;
}

function visualDiscriminationTask(random: () => number, level: Level, n: number, targets?: TrainingTargets): ChoiceItem | null {
  if (level === 1 || level === 2) {
    const eligible = CONFUSABLE_LETTER_GROUPS.filter((g) => (level === 2 ? g.length >= 3 : true));
    const own = eligible.filter((g) => (targets?.letters ?? []).some((l) => g.includes(l)));
    const group = pick(own.length > 0 && random() < TARGET_SHARE ? own : eligible, random);
    const nonConnecting = ['د', 'ذ', 'ر', 'ز'];
    const extraGroups = CONFUSABLE_LETTER_GROUPS.filter(
      (g) => g !== group && (level === 1 || !g.some((l) => nonConnecting.includes(l)))
    );
    const extended = group.length >= 4 ? group : [...group, ...pick(extraGroups, random)];
    const options = shuffleWith(extended, random).slice(0, 4);
    const target = pick(options, random);
    const shape = (l: string) => (level === 2 ? `${l}ـ` : l);
    return {
      id: `tr-vd-${n}`,
      promptAr: 'أين الشكل المطابق تمامًا؟',
      stimulus: { type: 'glyph', value: shape(target), label: shape(target) },
      audio: [{ text: 'أَيْنَ مِثْلُهُ تَمَامًا؟' }],
      options: options.map((l) => glyph(shape(l))),
      correctId: shape(target),
      tag: 'letter',
    };
  }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const word = stripDiacritics(pick(LEXICON_IDS.map((id) => LEXICON[id].word), random));
    const variants = new Set<string>([word]);
    for (let k = 0; k < 12 && variants.size < 4; k += 1) {
      const v = swapOneLetter(word, random);
      if (v) variants.add(v);
    }
    if (variants.size < 4) continue;
    return {
      id: `tr-vdw-${n}`,
      promptAr: 'أين الكلمة المطابقة تمامًا؟',
      stimulus: { type: 'glyph', value: word, label: word },
      audio: [{ text: 'أَيْنَ مِثْلُهَا تَمَامًا؟' }],
      options: shuffleWith(Array.from(variants), random).map(glyph),
      correctId: word,
      tag: 'word',
    };
  }
  return null;
}

const SPAN_POOL = ['door', 'sun', 'dog', 'elephant', 'moon', 'banana', 'house', 'hand', 'rooster', 'apple', 'star', 'key', 'car', 'tree', 'fish'];

function spanTask(random: () => number, level: Level, n: number): SpanTrial {
  const lengths: Record<Level, [number, number]> = { 1: [2, 3], 2: [3, 4], 3: [4, 5] };
  const [lo, hi] = lengths[level];
  const length = n < SPAN_TRIALS_PER_SESSION / 2 ? lo : hi;
  const pool = shuffleWith(SPAN_POOL, random).slice(0, Math.max(6, length + 2));
  const sequence = pool.slice(0, length);
  return { id: `tr-span-${n}`, sequence, choices: shuffleWith(pool, random) };
}

export function generateSession(skill: SkillId, level: Level, seed: number, targets?: TrainingTargets): TrainingTask[] {
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  if (skill === 'auditoryMemory' || skill === 'visualMemory') {
    return Array.from({ length: SPAN_TRIALS_PER_SESSION }, (_, n) => ({
      kind: 'span' as const,
      modality: skill === 'auditoryMemory' ? ('auditory' as const) : ('visual' as const),
      trial: spanTask(random, level, n),
    }));
  }

  const generator: Record<string, (r: () => number, l: Level, n: number, t?: TrainingTargets) => ChoiceItem | null> = {
    rhyme: rhymeTask,
    soundPosition: soundPositionTask,
    blending: blendingTask,
    discrimination: discriminationTask,
    letterSound: letterSoundTask,
    visualDiscrimination: visualDiscriminationTask,
  };
  const tasks: TrainingTask[] = [];
  const seen = new Set<string>();
  for (let n = 0; tasks.length < ITEMS_PER_SESSION && n < ITEMS_PER_SESSION * 6; n += 1) {
    const item = generator[skill](random, level, n, targets);
    if (!item) continue;
    const pictureIds = [item.stimulus, ...item.options.map((o) => o.visual)].flatMap((v) =>
      v && v.type === 'emoji' ? Object.values(LEXICON).filter((e) => e.emoji === v.value).map((e) => e.id) : []
    );
    if (showsSynonymPair(pictureIds)) continue;
    const signature = `${item.stimulus?.value ?? ''}|${item.audio.map((s) => s.text).join('|')}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    tasks.push({ kind: 'choice', item: { ...item, id: `${item.id}-${tasks.length}` } });
  }
  return tasks;
}

/** `count` practice items for one skill and level (more or fewer than one standard block). */
export function generateItems(skill: SkillId, level: Level, seed: number, count: number, targets?: TrainingTargets): TrainingTask[] {
  const out: TrainingTask[] = [];
  const seen = new Set<string>();
  for (let k = 0; out.length < count && k < 8; k++) {
    for (const task of generateSession(skill, level, seed + k * 104_729, targets)) {
      if (out.length >= count) break;
      const signature = task.kind === 'choice' ? `${task.item.stimulus?.value ?? ''}|${task.item.audio.map((a) => a.text).join('|')}` : `${task.trial.sequence.join(',')}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      out.push(
        task.kind === 'choice'
          ? { ...task, item: { ...task.item, id: `${task.item.id}-b${k}` } }
          : { ...task, trial: { ...task.trial, id: `${task.trial.id}-b${k}` } }
      );
    }
  }
  return out;
}

/**
 * Add what an oral reading revealed to the running programme: the recommended skills join the
 * focus (up to 3 skills, memory never), with knowledge-tracing states, and the child's own
 * confusions become practice targets.
 */
export function applyReadingTargets(
  progress: TrainingProgress,
  rec: { skills: SkillId[]; soundPairs: Array<[string, string]>; letters: string[]; passageId: string; analysedAt: string }
): { progress: TrainingProgress; added: SkillId[] } {
  const p = ensureBkt(progress);
  const focus = [...p.plan.focus];
  const added: SkillId[] = [];
  for (const skill of rec.skills) {
    if (focus.includes(skill) || NOT_TRAINED_AS_FOCUS.has(skill) || focus.length >= MAX_FOCUS_SKILLS) continue;
    focus.push(skill);
    added.push(skill);
  }
  const ordered = focus.sort((a, b) => SKILL_ORDER.indexOf(a) - SKILL_ORDER.indexOf(b));
  const bkt = { ...p.bkt, ...initialStates(added, {}, Object.fromEntries(added.map((s) => [s, 1])) as Record<string, BktLevel>) };
  const levels = { ...p.levels, ...Object.fromEntries(added.map((s) => [s, 1 as Level])) };
  const rationaleAr = added.length > 0
    ? [...p.plan.rationaleAr, `أُضيفت من تحليل القراءة الجهرية: ${added.map((s) => SKILLS[s].nameAr).join('، ')}.`].slice(-10)
    : p.plan.rationaleAr;
  return {
    progress: {
      ...p,
      plan: { ...p.plan, focus: ordered, rationaleAr },
      levels,
      bkt,
      targets: { soundPairs: rec.soundPairs.slice(0, 6), letters: rec.letters.slice(0, 10), source: { passageId: rec.passageId, analysedAt: rec.analysedAt } },
    },
    added,
  };
}
