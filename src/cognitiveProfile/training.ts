/**
 * Baseera guided training program (برنامج بصيرة التدريبي الموجّه).
 *
 * The program is generated from a child's cognitive profile: the weakest skills become the
 * focus, each skill has a three-level ladder, and the child moves up a level only after two
 * consecutive sessions at or above the mastery criterion. Training items are generated fresh
 * for every session from the lexicon, so the child never practises the scored test items.
 */
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
} from './lexicon';
import type { CognitiveProfile } from './scoring';

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
};

export const MASTERY_PERCENT = 80;
export const STEP_BACK_PERCENT = 50;
export const PROGRAM_WEEKS = 8;
export const SESSIONS_PER_WEEK = 4;
export const MINUTES_PER_SESSION = 15;
const MAX_FOCUS_SKILLS = 3;

export interface TrainingPlan {
  createdAt: string;
  preventive: boolean;
  focus: SkillId[];
  rationaleAr: string[];
}

export function buildTrainingPlan(profile: CognitiveProfile, now = new Date()): TrainingPlan {
  const rationaleAr: string[] = [];
  const ordered: SkillId[] = [];
  for (const subtestId of profile.weaknesses) {
    for (const skill of SUBTEST_TO_SKILLS[subtestId]) {
      if (!ordered.includes(skill)) {
        ordered.push(skill);
      }
    }
  }
  const preventive = ordered.length === 0;
  const chosen = preventive ? (['blending', 'letterSound'] as SkillId[]) : ordered.slice(0, MAX_FOCUS_SKILLS);
  const focus = [...chosen].sort((a, b) => SKILL_ORDER.indexOf(a) - SKILL_ORDER.indexOf(b));

  if (preventive) {
    rationaleAr.push('لا تظهر مهارة دون المتوقع؛ البرنامج وقائي يعزّز التركيب الصوتي وربط الحرف بصوته استعدادًا للقراءة.');
  } else {
    rationaleAr.push('اختيرت المهارات الأضعف في الملف المعرفي (حتى ٣ مهارات) لأن التركيز يحقق أثرًا أكبر من توزيع الجهد.');
    rationaleAr.push('رُتّبت المهارات في الجلسة وفق تسلسل النمو: التمييز السمعي، ثم القافية، ثم الأصوات، ثم التركيب، ثم الحروف.');
    if (ordered.length > MAX_FOCUS_SKILLS) {
      rationaleAr.push('بقية المهارات الضعيفة تُضاف بعد إتقان مهارة من مهارات التركيز الحالية.');
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
}

export function createProgress(plan: TrainingPlan, startLevel: Level = 1): TrainingProgress {
  return {
    plan,
    levels: Object.fromEntries(plan.focus.map((s) => [s, plan.preventive ? 2 : startLevel])),
    mastered: [],
    history: [],
    supportFlags: [],
  };
}

export type LevelChange = 'up' | 'down' | 'mastered' | 'stay';

export function applySession(
  progress: TrainingProgress,
  skill: SkillId,
  correct: number,
  total: number,
  now = new Date()
): { progress: TrainingProgress; change: LevelChange } {
  const level = (progress.levels[skill] ?? 1) as Level;
  const record: SessionRecord = { date: now.toISOString(), skill, level, correct, total };
  const history = [...progress.history, record];
  const atLevel = history.filter((h) => h.skill === skill && h.level === level).slice(-2);
  const pct = (h: SessionRecord) => (h.total === 0 ? 0 : (h.correct / h.total) * 100);

  let change: LevelChange = 'stay';
  const levels = { ...progress.levels };
  let mastered = [...progress.mastered];
  let supportFlags = progress.supportFlags.filter((s) => s !== skill);

  if (atLevel.length === 2 && atLevel.every((h) => pct(h) >= MASTERY_PERCENT)) {
    if (level < 3) {
      levels[skill] = (level + 1) as Level;
      change = 'up';
    } else if (!mastered.includes(skill)) {
      mastered.push(skill);
      change = 'mastered';
    }
  } else if (atLevel.length === 2 && atLevel.every((h) => pct(h) < STEP_BACK_PERCENT)) {
    if (level > 1) {
      levels[skill] = (level - 1) as Level;
      change = 'down';
    }
    supportFlags = [...supportFlags, skill];
  }

  return { progress: { plan: progress.plan, levels, mastered, history, supportFlags }, change };
}

export function sessionsCompleted(progress: TrainingProgress): number {
  return new Set(progress.history.map((h) => h.date.slice(0, 10))).size;
}

export function isReassessmentDue(progress: TrainingProgress, now = new Date()): boolean {
  const days = (now.getTime() - new Date(progress.plan.createdAt).getTime()) / 86_400_000;
  const allMastered = progress.plan.focus.every((s) => progress.mastered.includes(s));
  return allMastered || days >= PROGRAM_WEEKS * 7 || sessionsCompleted(progress) >= PROGRAM_WEEKS * SESSIONS_PER_WEEK;
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

function discriminationTask(random: () => number, level: Level, n: number): ChoiceItem {
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
  const pairs = level === 1 ? DISTANT_PHONEME_PAIRS : CONFUSABLE_PHONEME_PAIRS;
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

function letterSoundTask(random: () => number, level: Level, n: number): ChoiceItem {
  const set = level === 1 ? LETTER_SET_1 : level === 2 ? LETTER_SET_2 : ALL_LETTERS.filter((l) => l !== 'ا');
  const letter = pick(set, random);
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

function visualDiscriminationTask(random: () => number, level: Level, n: number): ChoiceItem | null {
  if (level === 1 || level === 2) {
    const group = pick(CONFUSABLE_LETTER_GROUPS.filter((g) => (level === 2 ? g.length >= 3 : true)), random);
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

export function generateSession(skill: SkillId, level: Level, seed: number): TrainingTask[] {
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

  const generator: Record<string, (r: () => number, l: Level, n: number) => ChoiceItem | null> = {
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
    const item = generator[skill](random, level, n);
    if (!item) continue;
    const signature = `${item.stimulus?.value ?? ''}|${item.audio.map((s) => s.text).join('|')}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    tasks.push({ kind: 'choice', item: { ...item, id: `${item.id}-${tasks.length}` } });
  }
  return tasks;
}
