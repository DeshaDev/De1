/**
 * The screening battery of «هَيَّا نَقْرَأْ» (فحص مؤشرات عسر القراءة).
 *
 * Short, game-like tasks for children aged 4:0–8:11. Nine profile the cognitive skills known
 * to predict early reading difficulty: visual and auditory memory, paired sound–symbol
 * learning, phonological awareness, auditory and visual discrimination, and letter–sound
 * knowledge. Rapid naming is given at every age. From six, when reading has been taught,
 * the child also reads real and made-up words and a short passage aloud, and writes dictated
 * words (see readingTasks.ts). The construct coverage follows the published literature on
 * computerised early screening (for example CoPS-style batteries); the Arabic items,
 * games and scoring rules here are original to Baseera.
 *
 * Items are fixed and administered in a fixed order so every child sees the same test.
 * Practice items give feedback; scored items do not.
 */
import { lex } from './lexicon';
import {
  NONWORD_ITEMS,
  NONWORD_PRACTICE,
  PASSAGE_TIME_LIMIT_SEC,
  PASSAGE_TITLE,
  PASSAGE_WORDS,
  RAN_GRID_SIZE,
  RAN_LETTERS,
  RAN_LETTER_GRID,
  RAN_OBJECTS,
  RAN_OBJECT_GRID,
  READING_MIN_AGE_MONTHS,
  SPELL_ITEMS,
  SPELL_PRACTICE,
  WORD_ITEMS,
  WORD_PRACTICE,
  passageWordId,
  type RanSymbol,
  type ReadItem,
  type SpellItem,
} from './readingTasks';

export type SubtestId =
  | 'auditorySequential'
  | 'pairedAssociate'
  | 'rhyme'
  | 'phonological'
  | 'auditoryDiscrimination'
  | 'visualDiscrimination'
  | 'letterSound'
  | 'ranObjects'
  | 'ranLetters'
  | 'wordReading'
  | 'nonwordReading'
  | 'oralReading'
  | 'spelling';

export type DomainId =
  | 'auditoryMemory'
  | 'phonological'
  | 'perceptual'
  | 'alphabetic'
  | 'naming'
  | 'reading';

export type Visual =
  | { type: 'emoji'; value: string; label: string }
  | { type: 'glyph'; value: string; label: string }
  | { type: 'count'; value: number; label: string }
  | { type: 'sameDifferent'; value: 'same' | 'different'; label: string };

export interface ChoiceOption {
  id: string;
  visual: Visual;
}

/** One spoken segment. `highlight` points at 'stimulus' or an option id while it plays. */
export interface AudioSegment {
  text: string;
  highlight?: string;
  /** Silence after this segment, in milliseconds. */
  pauseAfterMs?: number;
}

export interface ChoiceItem {
  id: string;
  /** Short line shown to the adult/child under the stimulus. */
  promptAr: string;
  audio: AudioSegment[];
  stimulus?: Visual;
  options: ChoiceOption[];
  correctId: string;
  /** Sub-skill tag used in item analysis, e.g. 'onset', 'blending'. */
  tag?: string;
  /** For dictation-only training items, collect a typed response instead of choices. */
  responseMode?: 'text';
  /** Expected normalized text for dictation tasks; never rendered to the child. */
  expected?: string;
  /** Corrective feedback for a literacy/dictation task. */
  explanationAr?: string;
  explanationAudio?: AudioSegment[];
}

export interface SpanTrial {
  id: string;
  sequence: string[];
  choices: string[];
}

export interface AssociationBlock {
  id: string;
  /** Lexicon ids of animals, one per house, in house order. */
  residents: string[];
  /** Order in which residents are asked about. */
  queryOrder: string[];
}

export interface PalCreature {
  id: string;
  name: string;
  color: string;
  shape: 'circle' | 'square' | 'triangle' | 'blob';
  eyes: 1 | 2 | 3;
}

export interface PalBlock {
  id: string;
  order: string[];
}

interface SubtestBase {
  id: SubtestId;
  order: number;
  domain: DomainId;
  gameNameAr: string;
  skillNameAr: string;
  icon: string;
  minutes: number;
  /** What the examiner should know before starting. */
  examinerNoteAr: string;
  /** Spoken introduction for the child. */
  introAudio: string;
  /** Probability of a correct answer by guessing (0–1) for one scored item. */
  chance: number;
  /** Youngest age (months) the task is given at; absent = every age the battery covers. */
  minAgeMonths?: number;
  /** Oldest age (months) the task is given at; absent = no upper limit. */
  maxAgeMonths?: number;
  /** The adult scores each item while the child reads or names aloud. */
  adultScored?: boolean;
}

export interface ChoiceSubtest extends SubtestBase {
  kind: 'choice';
  practice: ChoiceItem[];
  items: ChoiceItem[];
  /** Stop after this many consecutive errors on scored items. */
  discontinueAfter: number;
}

export interface SpanSubtest extends SubtestBase {
  kind: 'span';
  modality: 'visual' | 'auditory';
  practice: SpanTrial[];
  trials: SpanTrial[];
}

export interface AssociationSubtest extends SubtestBase {
  kind: 'association';
  practice: AssociationBlock[];
  blocks: AssociationBlock[];
}

export interface PalSubtest extends SubtestBase {
  kind: 'pal';
  creatures: PalCreature[];
  blocks: PalBlock[];
}

/** Rapid automatized naming: name a fixed grid of familiar symbols as fast as possible. */
export interface RanSubtest extends SubtestBase {
  kind: 'ran';
  display: 'picture' | 'letter';
  symbols: RanSymbol[];
  grid: string[];
}

/** A graded list read aloud once and evaluated from a complete, receipted server audio assessment. */
export interface ReadListSubtest extends SubtestBase {
  kind: 'readList';
  practice: ReadItem[];
  items: ReadItem[];
  discontinueAfter: number;
  /** Maximum silence allowance for the future live interaction; not used to mark a response manually. */
  hesitationSec: number;
}

/** A short passage read aloud for a fixed time and evaluated by server-verified word alignment. */
export interface PassageSubtest extends SubtestBase {
  kind: 'passage';
  titleAr: string;
  words: string[];
  timeLimitSec: number;
}

/** Dictation on letter tiles, scored automatically. */
export interface SpellingSubtest extends SubtestBase {
  kind: 'spelling';
  practice: SpellItem[];
  items: SpellItem[];
  discontinueAfter: number;
}

export type Subtest =
  | ChoiceSubtest
  | SpanSubtest
  | AssociationSubtest
  | PalSubtest
  | RanSubtest
  | ReadListSubtest
  | PassageSubtest
  | SpellingSubtest;

export const DOMAINS: Record<DomainId, { nameAr: string; descriptionAr: string; color: string }> = {
  auditoryMemory: {
    nameAr: 'الذاكرة السمعية والتعلّم الترابطي',
    descriptionAr: 'الاحتفاظ بتسلسل ما يُسمع وربط الأسماء بالرموز؛ أساس ربط الحرف بصوته.',
    color: '#6E56CF',
  },
  phonological: {
    nameAr: 'المعالجة الصوتية',
    descriptionAr: 'إدراك بنية الكلمة الصوتية: القافية، الصوت الأول والأخير، تركيب المقاطع وعدّها.',
    color: '#B9611A',
  },
  perceptual: {
    nameAr: 'التمييز السمعي والبصري',
    descriptionAr: 'التفريق بين الأصوات المتقاربة (س/ص، ت/ط) وبين الحروف المتشابهة في الشكل والنقاط.',
    color: '#0B6E69',
  },
  alphabetic: {
    nameAr: 'المعرفة الأبجدية',
    descriptionAr: 'معرفة صوت الحرف المكتوب؛ الجسر المباشر من المهارات المعرفية إلى القراءة.',
    color: '#B4415A',
  },
  naming: {
    nameAr: 'سرعة التسمية',
    descriptionAr: 'سرعة استرجاع أسماء أشياء أو حروف مألوفة متتابعة؛ تنبئ بطلاقة القراءة بشكل مستقل عن الوعي الصوتي.',
    color: '#7A5A00',
  },
  reading: {
    nameAr: 'القراءة والإملاء',
    descriptionAr: 'قراءة كلمات حقيقية وكلمات مصنوعة ونص قصير جهرًا، وكتابة كلمات مسموعة؛ القياس المباشر لما يتعلّمه الطفل في الصف.',
    color: '#1F5F99',
  },
};

// ---------------------------------------------------------------------------
// Item builders
// ---------------------------------------------------------------------------
const pic = (id: string): ChoiceOption => {
  const entry = lex(id);
  return { id, visual: { type: 'emoji', value: entry.emoji, label: entry.word } };
};

const glyph = (value: string): ChoiceOption => ({
  id: value,
  visual: { type: 'glyph', value, label: value },
});

const namedOptions = (ids: string[]): AudioSegment[] =>
  ids.map((id) => ({ text: lex(id).word, highlight: id, pauseAfterMs: 250 }));

function rhymeItem(id: string, target: string, options: string[], correct: string): ChoiceItem {
  const t = lex(target);
  return {
    id,
    promptAr: `أيّ صورة تنتهي مثل «${t.word}»؟`,
    stimulus: { type: 'emoji', value: t.emoji, label: t.word },
    audio: [
      { text: t.word, highlight: 'stimulus', pauseAfterMs: 400 },
      ...namedOptions(options),
      { text: `أَيُّ صُورَةٍ تَنْتَهِي مِثْلَ: ${t.word}؟` },
    ],
    options: options.map(pic),
    correctId: correct,
    tag: 'rhyme',
  };
}

function onsetItem(id: string, target: string, options: string[], correct: string): ChoiceItem {
  const t = lex(target);
  return {
    id,
    promptAr: `أيّ صورة تبدأ بصوت «${t.word}» نفسه؟`,
    stimulus: { type: 'emoji', value: t.emoji, label: t.word },
    audio: [
      { text: t.word, highlight: 'stimulus', pauseAfterMs: 400 },
      ...namedOptions(options),
      { text: `أَيُّ صُورَةٍ تَبْدَأُ بِصَوْتِ: ${t.word}؟` },
    ],
    options: options.map(pic),
    correctId: correct,
    tag: 'onset',
  };
}

function codaItem(id: string, target: string, options: string[], correct: string): ChoiceItem {
  const t = lex(target);
  return {
    id,
    promptAr: `أيّ صورة تنتهي بآخر صوت في «${t.word}»؟`,
    stimulus: { type: 'emoji', value: t.emoji, label: t.word },
    audio: [
      { text: t.word, highlight: 'stimulus', pauseAfterMs: 400 },
      ...namedOptions(options),
      { text: `أَيُّ صُورَةٍ آخِرُ صَوْتٍ فِيهَا مِثْلُ آخِرِ صَوْتٍ فِي: ${t.word}؟` },
    ],
    options: options.map(pic),
    correctId: correct,
    tag: 'coda',
  };
}

function blendItem(id: string, target: string, options: string[]): ChoiceItem {
  const t = lex(target);
  return {
    id,
    promptAr: 'ركّب الأجزاء: ما الكلمة؟',
    audio: [
      { text: 'اسْمَعِ الأَجْزَاءَ وَرَكِّبْهَا.', pauseAfterMs: 400 },
      ...t.syllables.map((s) => ({ text: s, pauseAfterMs: 650 })),
      { text: 'مَا الكَلِمَةُ؟', pauseAfterMs: 200 },
      ...namedOptions(options),
    ],
    options: options.map(pic),
    correctId: target,
    tag: 'blending',
  };
}

function syllableCountItem(id: string, target: string): ChoiceItem {
  const t = lex(target);
  const options: ChoiceOption[] = [1, 2, 3, 4].map((n) => ({
    id: `n${n}`,
    visual: { type: 'count', value: n, label: `${n}` },
  }));
  return {
    id,
    promptAr: `كم مقطعًا في «${t.word}»؟`,
    stimulus: { type: 'emoji', value: t.emoji, label: t.word },
    audio: [{ text: `كَمْ مَقْطَعًا فِي كَلِمَةِ: ${t.word}؟ صَفِّقْ مَعَ كُلِّ مَقْطَعٍ، ثُمَّ اخْتَرْ.`, highlight: 'stimulus' }],
    options,
    correctId: `n${t.syllables.length}`,
    tag: 'syllableCount',
  };
}

const SAME_DIFFERENT: ChoiceOption[] = [
  { id: 'same', visual: { type: 'sameDifferent', value: 'same', label: 'الصوت نفسه' } },
  { id: 'different', visual: { type: 'sameDifferent', value: 'different', label: 'صوتان مختلفان' } },
];

function sameDifferentItem(id: string, first: string, second: string): ChoiceItem {
  return {
    id,
    promptAr: 'هل سمعت الصوت نفسه مرتين؟',
    audio: [
      { text: first, pauseAfterMs: 700 },
      { text: second, pauseAfterMs: 400 },
      { text: 'الصَّوْتُ نَفْسُهُ، أَمْ صَوْتَانِ مُخْتَلِفَانِ؟' },
    ],
    options: SAME_DIFFERENT,
    correctId: first === second ? 'same' : 'different',
    tag: first === second ? 'catch' : 'contrast',
  };
}

function minimalPairItem(id: string, target: string, options: [string, string]): ChoiceItem {
  return {
    id,
    promptAr: 'أين الصورة التي سمعت اسمها؟',
    audio: [{ text: `أَيْنَ: ${lex(target).word}؟` }],
    options: options.map(pic),
    correctId: target,
    tag: 'minimalPair',
  };
}

function matchItem(id: string, target: string, options: string[]): ChoiceItem {
  return {
    id,
    promptAr: 'أين الشكل المطابق تمامًا؟',
    stimulus: { type: 'glyph', value: target, label: target },
    audio: [{ text: 'أَيْنَ مِثْلُهُ تَمَامًا؟' }],
    options: options.map(glyph),
    correctId: target,
    tag: target.length > 2 ? 'word' : 'letter',
  };
}

function letterSoundItem(id: string, sound: string, letter: string, options: string[]): ChoiceItem {
  return {
    id,
    promptAr: 'أيّ حرف له هذا الصوت؟',
    audio: [{ text: `أَيُّ حَرْفٍ صَوْتُهُ: ${sound}؟` }],
    options: options.map(glyph),
    correctId: letter,
    tag: 'letterSound',
  };
}

// ---------------------------------------------------------------------------
// Span and association material
// ---------------------------------------------------------------------------
/** Deterministic PRNG so standardized choice layouts never change between sessions. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWith<T>(list: T[], random: () => number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildSpanTrial(id: string, sequence: string[], pool: string[], seed: number): SpanTrial {
  const random = seededRandom(seed);
  const choiceCount = Math.min(pool.length, Math.max(6, sequence.length + 2));
  const distractors = shuffleWith(pool.filter((p) => !sequence.includes(p)), random).slice(
    0,
    choiceCount - sequence.length
  );
  return { id, sequence, choices: shuffleWith([...sequence, ...distractors], random) };
}

const AUDITORY_SPAN_POOL = ['door', 'sun', 'dog', 'elephant', 'moon', 'banana', 'house', 'hand', 'rooster'];

const AUDITORY_SEQUENCES: string[][] = [
  ['sun', 'dog'],
  ['moon', 'door'],
  ['elephant', 'house', 'hand'],
  ['banana', 'sun', 'rooster'],
  ['dog', 'moon', 'door', 'elephant'],
  ['hand', 'banana', 'house', 'sun'],
  ['rooster', 'door', 'dog', 'banana', 'moon'],
  ['house', 'elephant', 'sun', 'hand', 'rooster'],
  ['door', 'hand', 'moon', 'rooster', 'dog', 'house'],
  ['banana', 'elephant', 'rooster', 'sun', 'door', 'hand'],
];

export const PAL_CREATURES: PalCreature[] = [
  { id: 'c1', name: 'زُوبَا', color: '#6E56CF', shape: 'circle', eyes: 1 },
  { id: 'c2', name: 'نِيكُو', color: '#f97316', shape: 'square', eyes: 2 },
  { id: 'c3', name: 'طَافِي', color: '#14b8a6', shape: 'triangle', eyes: 3 },
  { id: 'c4', name: 'بِيرُو', color: '#ec4899', shape: 'blob', eyes: 2 },
];

// ---------------------------------------------------------------------------
// The screening tasks
// ---------------------------------------------------------------------------
export const BATTERY: Subtest[] = [
  {
    id: 'auditorySequential',
    order: 1,
    kind: 'span',
    modality: 'auditory',
    domain: 'auditoryMemory',
    gameNameAr: 'ببغاء الحديقة',
    skillNameAr: 'الذاكرة السمعية التسلسلية',
    icon: '🦜',
    minutes: 4,
    chance: 0,
    examinerNoteAr:
      'سيسمع الطفل سلسلة من الكلمات دون رؤية صورها، ثم يلمس الصور بالترتيب نفسه الذي سمعه. دورك: تأكّد من هدوء المكان (ويُفضَّل استخدام سماعات)، ولا تكرّر الكلمات للطفل.',
    introAudio:
      'البَبَّغَاءُ سَيَقُولُ كَلِمَاتٍ. اسْمَعْ جَيِّدًا، ثُمَّ الْمِسِ الصُّوَرَ بِالتَّرْتِيبِ الَّذِي سَمِعْتَهُ.',
    practice: [buildSpanTrial('as-p1', ['house', 'banana'], AUDITORY_SPAN_POOL, 301)],
    trials: AUDITORY_SEQUENCES.map((seq, i) => buildSpanTrial(`as-${i + 1}`, seq, AUDITORY_SPAN_POOL, 400 + i)),
  },
  {
    id: 'pairedAssociate',
    order: 2,
    kind: 'pal',
    domain: 'auditoryMemory',
    gameNameAr: 'أصدقاء الفضاء',
    skillNameAr: 'التعلّم الترابطي السمعي-البصري (اسم ↔ رمز)',
    icon: '👾',
    minutes: 5,
    chance: 0.25,
    examinerNoteAr:
      'سيتعرّف الطفل على ٤ شخصيات فضائية لكل منها اسم جديد، ثم يسمع اسمًا ويلمس الشخصية صاحبة الاسم عبر ست جولات قصيرة. يصحّح التطبيق الإجابة تلقائيًا بعد كل محاولة لمساعدته على الحفظ. دورك: لا تلمّح له بالإجابة.',
    introAudio:
      'هَؤُلَاءِ أَصْدِقَاءُ مِنَ الفَضَاءِ، وَلِكُلٍّ مِنْهُمُ اسْمٌ. احْفَظْ أَسْمَاءَهُمْ، ثُمَّ الْمِسْ مَنْ تَسْمَعُ اسْمَهُ.',
    creatures: PAL_CREATURES,
    blocks: [
      { id: 'pal-1', order: ['c3', 'c1', 'c4', 'c2'] },
      { id: 'pal-2', order: ['c2', 'c4', 'c1', 'c3'] },
      { id: 'pal-3', order: ['c4', 'c3', 'c2', 'c1'] },
      { id: 'pal-4', order: ['c1', 'c3', 'c2', 'c4'] },
      { id: 'pal-5', order: ['c3', 'c2', 'c4', 'c1'] },
      { id: 'pal-6', order: ['c2', 'c1', 'c3', 'c4'] },
    ],
  },
  {
    id: 'rhyme',
    order: 3,
    kind: 'choice',
    domain: 'phonological',
    gameNameAr: 'كلمات تتشابه',
    skillNameAr: 'الوعي بالقافية',
    icon: '🎵',
    // Rhyme predicts reading before school; from six, phoneme-level tasks predict better.
    maxAgeMonths: 71,
    minutes: 3,
    chance: 1 / 3,
    discontinueAfter: 4,
    examinerNoteAr:
      'يسمع الطفل اسم الصورة في الأعلى ثم أسماء ثلاث صور في الأسفل، ويختار الصورة التي تنتهي بالصوت نفسه (مثل: قَلَم وعَلَم). دورك: دعه يختار بنفسه ويمكن إعادة سماع الصوت عند الحاجة.',
    introAudio: 'سَنَبْحَثُ عَنْ كَلِمَاتٍ تَتَشَابَهُ فِي آخِرِهَا، مِثْلَ: قَلَم وَعَلَم.',
    practice: [
      rhymeItem('rh-p1', 'pen', ['flag', 'banana', 'sun'], 'flag'),
      rhymeItem('rh-p2', 'door', ['cat', 'book', 'elephant'], 'book'),
    ],
    items: [
      rhymeItem('rh-1', 'cat', ['dog', 'duck', 'sun'], 'duck'),
      rhymeItem('rh-2', 'moon', ['elephant', 'ball', 'rain'], 'rain'),
      rhymeItem('rh-3', 'camel', ['honey', 'house', 'key'], 'honey'),
      rhymeItem('rh-4', 'horse', ['rabbit', 'dress', 'grapes'], 'dress'),
      rhymeItem('rh-5', 'lion', ['duck', 'banana', 'hand'], 'hand'),
      // rh-6 was «طبل ← حبل». In the Gulf norms «طبل» has a late estimated age of acquisition (4.0 ≈ 7–8 years)
      // and 59% name agreement, and «حبل» is not normed. «أرنب/عنب» are both early (≈3) with 100% agreement.
      rhymeItem('rh-6', 'rabbit', ['grapes', 'carrot', 'pen'], 'grapes'),
      rhymeItem('rh-7', 'tree', ['bear', 'cow', 'book'], 'cow'),
      rhymeItem('rh-8', 'ball', ['elephant', 'moon', 'corn'], 'corn'),
    ],
  },
  {
    id: 'phonological',
    order: 4,
    kind: 'choice',
    domain: 'phonological',
    gameNameAr: 'مختبر الأصوات',
    skillNameAr: 'التحليل والتركيب الصوتي',
    icon: '🧪',
    minutes: 4,
    chance: 0.31,
    discontinueAfter: 4,
    examinerNoteAr:
      'أربع خطوات قصيرة بالصوت والصور: اختيار ما يبدأ بالصوت نفسه، ثم ما ينتهي بالصوت نفسه، ثم تركيب مقاطع مسموعة لمعرفة الكلمة، ثم عدّ مقاطع الكلمة. يمكن للطفل التصفيق مع المقاطع. دورك: الجلوس بجانبه دون توجيهه للإجابة.',
    introAudio: 'فِي مُخْتَبَرِ الأَصْوَاتِ سَنَلْعَبُ بِأَصْوَاتِ الكَلِمَاتِ: أَوَّلِهَا وَآخِرِهَا وَأَجْزَائِهَا.',
    practice: [
      onsetItem('ph-p1', 'sun', ['tree', 'moon', 'door'], 'tree'),
      blendItem('ph-p2', 'pen', ['flag', 'pen', 'elephant']),
    ],
    items: [
      onsetItem('ph-1', 'fish', ['sun', 'car', 'moon'], 'car'),
      onsetItem('ph-2', 'duck', ['banana', 'elephant', 'door'], 'door'),
      onsetItem('ph-3', 'bear', ['rooster', 'key', 'apple'], 'rooster'),
      onsetItem('ph-4', 'dog', ['tree', 'ball', 'camel'], 'ball'),
      codaItem('ph-5', 'book', ['bear', 'house', 'elephant'], 'bear'),
      codaItem('ph-6', 'sun', ['fish', 'bell', 'moon'], 'bell'),
      // ph-7 was «ديك → شبّاك». In Gulf Arabic the window is «دريشة» and ك is often affricated
      // (سمكة → سمچة) (Khwaileh et al., 2018, Table 1), so a Gulf child could miss it for dialect
      // reasons. The answer is «جمل», not «طبل»: in the same norms «طبل» is late (age of acquisition 4.0)
      // with 59% name agreement, while «جمل» is 3.2 with 100%. ل is stable in all dialects.
      codaItem('ph-7', 'elephant', ['lion', 'house', 'camel'], 'camel'),
      blendItem('ph-8', 'rabbit', ['lion', 'rabbit', 'grapes']),
      blendItem('ph-9', 'turtle', ['turtle', 'fish', 'frog']),
      blendItem('ph-10', 'orange', ['apple', 'cow', 'orange']),
      syllableCountItem('ph-11', 'pen'),
      syllableCountItem('ph-12', 'car'),
    ],
  },
  {
    id: 'auditoryDiscrimination',
    order: 5,
    kind: 'choice',
    domain: 'perceptual',
    gameNameAr: 'الأذن الذهبية',
    skillNameAr: 'التمييز السمعي للأصوات المتقاربة',
    icon: '👂',
    minutes: 3,
    chance: 0.5,
    discontinueAfter: 6,
    examinerNoteAr:
      'سيسمع الطفل صوتين متقاربين ويختار هل هما «الصوت نفسه» أم «صوتان مختلفان»، ثم يختار بين صورتين يختلف اسماهما بصوت واحد (مثل: كلب/قلب). دورك: وفّر مكانًا هادئًا ويُفضَّل استخدام سماعات، ولا تكرّر الأصوات بصوتك.',
    introAudio: 'سَتَسْمَعُ صَوْتَيْنِ. إِذَا كَانَا مُتَشَابِهَيْنِ تَمَامًا فَاخْتَرْ: نَفْسُ الصَّوْتِ. وَإِذَا كَانَا مُخْتَلِفَيْنِ فَاخْتَرْ: مُخْتَلِفَانِ.',
    practice: [sameDifferentItem('ad-p1', 'بَا', 'بَا'), sameDifferentItem('ad-p2', 'بَا', 'مَا')],
    items: [
      sameDifferentItem('ad-1', 'تَا', 'طَا'),
      sameDifferentItem('ad-2', 'سَا', 'صَا'),
      sameDifferentItem('ad-3', 'دَا', 'دَا'),
      sameDifferentItem('ad-4', 'ذَا', 'زَا'),
      sameDifferentItem('ad-5', 'كَا', 'قَا'),
      sameDifferentItem('ad-6', 'حَا', 'حَا'),
      sameDifferentItem('ad-7', 'حَا', 'هَا'),
      sameDifferentItem('ad-8', 'ثَا', 'سَا'),
      sameDifferentItem('ad-9', 'عَا', 'عَا'),
      sameDifferentItem('ad-10', 'دَا', 'ضَا'),
      minimalPairItem('ad-11', 'heart', ['dog', 'heart']),
      minimalPairItem('ad-12', 'palm', ['bee', 'palm']),
      minimalPairItem('ad-13', 'summer', ['sword', 'summer']),
      minimalPairItem('ad-14', 'dog', ['heart', 'dog']),
    ],
  },
  {
    id: 'visualDiscrimination',
    order: 6,
    kind: 'choice',
    domain: 'perceptual',
    gameNameAr: 'عين الصقر',
    skillNameAr: 'التمييز البصري للحروف والكلمات',
    icon: '🦅',
    // Letter-shape discrimination reaches ceiling by about age seven.
    maxAgeMonths: 83,
    minutes: 3,
    chance: 0.25,
    discontinueAfter: 5,
    examinerNoteAr:
      'يظهر شكل أو حرف أو كلمة في الأعلى، ويختار الطفل الشكل المطابق لها تمامًا من بين الاختيارات (مع الانتباه للنقاط والاتجاه). لا تتطلب هذه اللعبة معرفة القراءة. دورك: شجّعه على النظر بهدوء دون الإشارة للخيار الصحيح.',
    introAudio: 'انْظُرْ إِلَى الشَّكْلِ فِي الأَعْلَى، ثُمَّ ابْحَثْ عَنْ شَكْلٍ مِثْلِهِ تَمَامًا. انْتَبِهْ لِلنِّقَاطِ!',
    practice: [matchItem('vd-p1', '▲', ['▼', '▲', '◀', '▶']), matchItem('vd-p2', 'ب', ['ن', 'ب', 'ت', 'ي'])],
    items: [
      matchItem('vd-1', 'ت', ['ث', 'ب', 'ت', 'ن']),
      matchItem('vd-2', 'ج', ['ح', 'خ', 'ج', 'ع']),
      matchItem('vd-3', 'ذ', ['د', 'ذ', 'ز', 'ر']),
      matchItem('vd-4', 'ش', ['س', 'ص', 'ش', 'ض']),
      matchItem('vd-5', 'ظ', ['ط', 'ظ', 'ض', 'ص']),
      matchItem('vd-6', 'غ', ['ع', 'ف', 'غ', 'ق']),
      matchItem('vd-7', 'نـ', ['بـ', 'تـ', 'يـ', 'نـ']),
      matchItem('vd-8', 'يـ', ['يـ', 'بـ', 'ثـ', 'نـ']),
      matchItem('vd-9', 'بيت', ['بنت', 'نبت', 'بيت', 'ثبت']),
      matchItem('vd-10', 'قلم', ['قلم', 'فلم', 'علم', 'قلب']),
      matchItem('vd-11', 'خبز', ['حبز', 'خبز', 'جبز', 'خبر']),
      matchItem('vd-12', 'نخلة', ['نحلة', 'نجلة', 'تخلة', 'نخلة']),
    ],
  },
  {
    id: 'letterSound',
    order: 7,
    kind: 'choice',
    domain: 'alphabetic',
    gameNameAr: 'صندوق الحروف',
    skillNameAr: 'معرفة أصوات الحروف',
    icon: '📦',
    // Letter-sound knowledge reaches ceiling by about age seven; later it no longer separates readers.
    maxAgeMonths: 83,
    minutes: 3,
    chance: 0.25,
    discontinueAfter: 5,
    examinerNoteAr:
      'سيسمع الطفل صوت حرف ويلمس الحرف المطابق له من بين أربعة حروف. دورك: دعه يختار بنفسه دون نطق اسم الحرف أو الإشارة إليه (ومن الطبيعي في الأعمار الصغيرة ألا يعرف كل الحروف بعد).',
    introAudio: 'سَتَسْمَعُ صَوْتَ حَرْفٍ. الْمِسِ الحَرْفَ الَّذِي يُصْدِرُ هَذَا الصَّوْتَ.',
    practice: [letterSoundItem('ls-p1', 'مَ', 'م', ['ك', 'م', 'ع', 'و'])],
    items: [
      letterSoundItem('ls-1', 'بَ', 'ب', ['ب', 'ت', 'ن', 'ث']),
      letterSoundItem('ls-2', 'سَ', 'س', ['ش', 'س', 'ص', 'ز']),
      letterSoundItem('ls-3', 'دَ', 'د', ['ذ', 'ر', 'د', 'ز']),
      letterSoundItem('ls-4', 'كَ', 'ك', ['ق', 'ك', 'ف', 'ل']),
      letterSoundItem('ls-5', 'حَ', 'ح', ['خ', 'ج', 'ه', 'ح']),
      letterSoundItem('ls-6', 'تَ', 'ت', ['ط', 'ت', 'ث', 'ب']),
      letterSoundItem('ls-7', 'رَ', 'ر', ['ز', 'ر', 'و', 'د']),
      letterSoundItem('ls-8', 'عَ', 'ع', ['غ', 'ا', 'ع', 'ح']),
      letterSoundItem('ls-9', 'فَ', 'ف', ['ق', 'ف', 'غ', 'ع']),
      letterSoundItem('ls-10', 'صَ', 'ص', ['س', 'ض', 'ص', 'ش']),
      letterSoundItem('ls-11', 'لَ', 'ل', ['ك', 'ل', 'ا', 'م']),
      letterSoundItem('ls-12', 'نَ', 'ن', ['ب', 'ن', 'ت', 'ي']),
    ],
  },
  {
    id: 'ranObjects',
    order: 8,
    kind: 'ran',
    display: 'picture',
    domain: 'naming',
    gameNameAr: 'سباق الصور',
    skillNameAr: 'التسمية السريعة للصور',
    icon: '🏁',
    // From six, letter naming (ranLetters) is the stronger RAN predictor of reading.
    maxAgeMonths: 71,
    minutes: 1,
    chance: 0,
    adultScored: false,
    examinerNoteAr:
      'في البداية يتعرّف الطفل على أسماء ٥ صور، ثم تظهر شبكة من الصور ويسمّيها الطفل بصوت عالٍ وبأسرع ما يستطيع من اليمين إلى اليسار سطرًا بسطر أثناء التسجيل. دورك: اضغط بدء التسجيل ثم إيقافه عند الانتهاء، ولا تصحّح له أثناء السباق.',
    introAudio:
      'سَتَرَى صُوَرًا كَثِيرَةً. قُلْ اسْمَ كُلِّ صُورَةٍ بِأَسْرَعِ مَا تَسْتَطِيعُ، مِنْ أَوَّلِ السَّطْرِ إِلَى آخِرِهِ.',
    symbols: RAN_OBJECTS,
    grid: RAN_OBJECT_GRID,
  },
  {
    id: 'ranLetters',
    order: 9,
    kind: 'ran',
    display: 'letter',
    domain: 'naming',
    gameNameAr: 'سباق الحروف',
    skillNameAr: 'التسمية السريعة للحروف',
    icon: '🔤',
    minutes: 1,
    chance: 0,
    minAgeMonths: READING_MIN_AGE_MONTHS,
    adultScored: false,
    examinerNoteAr:
      'في البداية يتعرّف الطفل على ٥ حروف، ثم تظهر شبكة من الحروف ويقرأ الطفل اسم كل حرف بصوت عالٍ وبأسرع ما يستطيع من اليمين إلى اليسار سطرًا بسطر أثناء التسجيل. دورك: اضغط بدء التسجيل ثم إيقافه عند الانتهاء، ولا تصحّح له أثناء القراءة.',
    introAudio: 'وَالآنَ حُرُوفٌ. قُلْ اسْمَ كُلِّ حَرْفٍ بِأَسْرَعِ مَا تَسْتَطِيعُ.',
    symbols: RAN_LETTERS,
    grid: RAN_LETTER_GRID,
  },
  {
    id: 'wordReading',
    order: 10,
    kind: 'readList',
    domain: 'reading',
    gameNameAr: 'قارئ الكلمات',
    skillNameAr: 'قراءة كلمات حقيقية',
    icon: '📗',
    minutes: 3,
    chance: 0,
    minAgeMonths: READING_MIN_AGE_MONTHS,
    adultScored: false,
    discontinueAfter: 5,
    hesitationSec: 5,
    examinerNoteAr:
      'ستظهر كلمات حقيقية واحدة تلو الأخرى، والمطلوب أن يقرأ الطفل كل كلمة بصوت عالٍ وواضح بعد الضغط على زر التسجيل. دورك: شجّع الطفل بهدوء، ولا تصحّح قراءته أو تنطق الكلمة نيابةً عنه.',
    introAudio: 'سَتَظْهَرُ كَلِمَاتٌ. اقْرَأْ كُلَّ كَلِمَةٍ بِصَوْتٍ عَالٍ.',
    practice: WORD_PRACTICE,
    items: WORD_ITEMS,
  },
  {
    id: 'nonwordReading',
    order: 11,
    kind: 'readList',
    domain: 'reading',
    gameNameAr: 'كلمات من كوكب آخر',
    skillNameAr: 'فك ترميز كلمات غير حقيقية',
    icon: '🪐',
    minutes: 3,
    chance: 0,
    minAgeMonths: READING_MIN_AGE_MONTHS,
    adultScored: false,
    discontinueAfter: 5,
    hesitationSec: 5,
    examinerNoteAr:
      'ستظهر كلمات مصنوعة ليس لها معنى (مثل: بَتَمُ)، ويسجل الطفل قراءة الكلمات المصنوعة كما تظهر بصوت عالٍ، دون أن يحوّلها البالغ إلى كلمات مألوفة أو يصححها.',
    introAudio:
      'هَذِهِ كَلِمَاتٌ مِنْ كَوْكَبٍ آخَرَ، لَيْسَ لَهَا مَعْنًى. اقْرَأْهَا كَمَا هِيَ مَكْتُوبَةٌ بِالضَّبْطِ.',
    practice: NONWORD_PRACTICE,
    items: NONWORD_ITEMS,
  },
  {
    id: 'oralReading',
    order: 12,
    kind: 'passage',
    domain: 'reading',
    gameNameAr: 'قصة سامي',
    skillNameAr: 'دقة القراءة الجهرية وطلاقتها',
    icon: '📖',
    minutes: 2,
    chance: 0,
    minAgeMonths: READING_MIN_AGE_MONTHS,
    adultScored: false,
    examinerNoteAr:
      'ستظهر قصة قصيرة، ويقرأها الطفل بصوت عالٍ وواضح كما يقرأ في الصف أثناء تشغيل التسجيل (حتى دقيقة واحدة). دورك: اضغط بدء التسجيل واترك الطفل يقرأ بهدوء دون تصحيح أو مقاطعة.',
    introAudio: 'اقْرَأْ هَذِهِ القِصَّةَ بِصَوْتٍ عَالٍ، كَمَا تَقْرَأُ فِي الصَّفِّ.',
    titleAr: PASSAGE_TITLE,
    words: PASSAGE_WORDS,
    timeLimitSec: PASSAGE_TIME_LIMIT_SEC,
  },
  {
    id: 'spelling',
    order: 13,
    kind: 'spelling',
    domain: 'reading',
    gameNameAr: 'الكاتب الصغير',
    skillNameAr: 'الإملاء (كتابة كلمات مسموعة)',
    icon: '✍️',
    minutes: 6,
    chance: 0,
    minAgeMonths: READING_MIN_AGE_MONTHS,
    discontinueAfter: 4,
    examinerNoteAr:
      'سيسمع الطفل كلمة، ثم يكتبها بلمس الحروف على الشاشة (دون تشكيل) ويضغط «تمّ». يمكنه إعادة سماع الكلمة أو مسح حرف إذا أخطأ. دورك: لا تتهجّ الكلمة له ولا تشر إلى الحروف.',
    introAudio: 'سَتَسْمَعُ كَلِمَةً. اكْتُبْهَا بِلَمْسِ الحُرُوفِ، ثُمَّ اضْغَطْ: تَمَّ.',
    practice: SPELL_PRACTICE,
    items: SPELL_ITEMS,
  },
];

export const SUBTESTS_BY_ID: Record<SubtestId, Subtest> = Object.fromEntries(
  BATTERY.map((s) => [s.id, s])
) as Record<SubtestId, Subtest>;

/** Number of scored units (items, trials, queries, grid cells or passage words) in a subtest. */
export function scoredItemCount(subtest: Subtest): number {
  switch (subtest.kind) {
    case 'choice':
    case 'readList':
    case 'spelling':
      return subtest.items.length;
    case 'span':
      return subtest.trials.length;
    case 'association':
      return subtest.blocks.reduce((sum, b) => sum + b.queryOrder.length, 0);
    case 'pal':
      return subtest.blocks.reduce((sum, b) => sum + b.order.length, 0);
    case 'ran':
      return RAN_GRID_SIZE;
    case 'passage':
      return subtest.words.length;
  }
}

/** Ids of every scored response a subtest can produce. */
export function scoredItemIds(subtest: Subtest): string[] {
  switch (subtest.kind) {
    case 'choice':
    case 'readList':
    case 'spelling':
      return subtest.items.map((i) => i.id);
    case 'span':
      return subtest.trials.map((t) => t.id);
    case 'association':
      return subtest.blocks.flatMap((b) => b.residents.map((r) => `${b.id}-${r}`));
    case 'pal':
      return subtest.blocks.flatMap((b) => b.order.map((c) => `${b.id}-${c}`));
    case 'ran':
      return Array.from({ length: RAN_GRID_SIZE }, (_, index) => `ran-${index + 1}`);
    case 'passage':
      return subtest.words.map((_, i) => passageWordId(i));
  }
}

export const appliesAtAge = (subtest: Subtest, ageMonths: number) =>
  ageMonths >= (subtest.minAgeMonths ?? 0) && ageMonths <= (subtest.maxAgeMonths ?? Infinity);

/** Age tiers for adaptive screening (4:0 to 5:11, 6:0 to 7:5, 7:6 to 8:11+) */
export const AGE_PRE_READING_MAX_MONTHS = 71;
export const AGE_GRADE_1_MAX_MONTHS = 89;
export const AGE_PRIMARY_MIN_MONTHS = 90;

export type ScreeningMode = 'fast' | 'comprehensive';

/**
 * Fast-track screening battery (single sitting, ~16–25 minutes depending on age).
 * Clinically targeted to the child's exact age and reading instruction stage:
 * - Age 4-5 (Under 72 months): Phonological awareness, rhyme, letter sound, RAN objects, auditory discrimination. Zero reading tasks.
 * - Age 6-7 (72-89 months, Grade 1): Word reading, nonword decoding, phonological awareness, letter sounds, RAN letters, spelling, oral passage.
 * - Age 8+ (90+ months, Grades 2-4+): Nonword decoding, word reading, oral passage WCPM, RAN letters, dictation, phonological manipulation, verbal working memory.
 */
export function fastTrackSubtestsForAge(ageMonths: number): Subtest[] {
  let ids: SubtestId[];
  if (ageMonths < READING_MIN_AGE_MONTHS) {
    ids = ['phonological', 'rhyme', 'letterSound', 'ranObjects', 'auditoryDiscrimination'];
  } else if (ageMonths <= AGE_GRADE_1_MAX_MONTHS) {
    ids = ['wordReading', 'nonwordReading', 'phonological', 'letterSound', 'ranLetters', 'spelling', 'oralReading'];
  } else {
    ids = ['nonwordReading', 'wordReading', 'oralReading', 'ranLetters', 'spelling', 'phonological', 'auditorySequential'];
  }
  return ids.map((id) => SUBTESTS_BY_ID[id]).filter((s) => appliesAtAge(s, ageMonths));
}

/**
 * The battery in short sittings of about 10–15 minutes, for this child's age. From six, when
 * reading instruction has begun, the direct reading measures come first: they answer the parent's
 * question most directly, and a child who stops after one sitting has still been asked to read.
 */
export function sittingsForAge(ageMonths: number, mode: ScreeningMode = 'comprehensive'): Subtest[][] {
  if (mode === 'fast') {
    return [fastTrackSubtestsForAge(ageMonths)];
  }
  // Only tasks with published evidence that they predict or reveal reading difficulty or dyslexia.
  // Age limits (minAgeMonths / maxAgeMonths on each task) drop the ones that stop separating
  // readers at this age; an emptied sitting is removed below.
  const ids: SubtestId[][] =
    ageMonths >= READING_MIN_AGE_MONTHS
      ? [
          ['wordReading', 'nonwordReading', 'oralReading', 'ranLetters'],
          ['phonological', 'spelling', 'letterSound', 'auditoryDiscrimination'],
          ['pairedAssociate', 'auditorySequential', 'visualDiscrimination'],
        ]
      : [
          ['phonological', 'rhyme', 'letterSound', 'auditoryDiscrimination'],
          ['ranObjects', 'pairedAssociate', 'auditorySequential', 'visualDiscrimination'],
        ];
  return ids
    .map((sitting) => sitting.map((id) => SUBTESTS_BY_ID[id]).filter((s) => appliesAtAge(s, ageMonths)))
    .filter((sitting) => sitting.length > 0);
}

/** Every task this child is given, in the order they are given. */
export const subtestsForAge = (ageMonths: number, mode: ScreeningMode = 'comprehensive'): Subtest[] => sittingsForAge(ageMonths, mode).flat();

export const minutesForAge = (ageMonths: number, mode: ScreeningMode = 'comprehensive') => subtestsForAge(ageMonths, mode).reduce((sum, s) => sum + s.minutes, 0);

/** Minutes for the full battery at the oldest ages (every task). */
export const TOTAL_BATTERY_MINUTES = BATTERY.reduce((sum, s) => sum + s.minutes, 0);
