/**
 * Baseera Cognitive Profile Battery (بطارية بصيرة للملف المعرفي القرائي).
 *
 * Nine short, game-like subtests for children aged 4:0–8:11 that profile the cognitive
 * skills known to predict early reading difficulty: visual and auditory memory, paired
 * sound–symbol learning, phonological awareness, auditory and visual discrimination, and
 * letter–sound knowledge. The construct coverage follows the published literature on
 * computerised early screening (for example CoPS-style batteries); the Arabic items,
 * games and scoring rules here are original to Baseera.
 *
 * Items are fixed and administered in a fixed order so every child sees the same test.
 * Practice items give feedback; scored items do not.
 */
import { lex } from './lexicon';

export type SubtestId =
  | 'visualSequential'
  | 'visualAssociative'
  | 'auditorySequential'
  | 'pairedAssociate'
  | 'rhyme'
  | 'phonological'
  | 'auditoryDiscrimination'
  | 'visualDiscrimination'
  | 'letterSound';

export type DomainId =
  | 'visualMemory'
  | 'auditoryMemory'
  | 'phonological'
  | 'perceptual'
  | 'alphabetic';

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

export type Subtest = ChoiceSubtest | SpanSubtest | AssociationSubtest | PalSubtest;

export const DOMAINS: Record<DomainId, { nameAr: string; descriptionAr: string; color: string }> = {
  visualMemory: {
    nameAr: 'الذاكرة البصرية',
    descriptionAr: 'الاحتفاظ بما يراه الطفل وترتيبه وربطه بمكانه؛ تدعم تذكّر أشكال الحروف والكلمات.',
    color: '#2F6DB5',
  },
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
    audio: [{ text: `أَيُّ حَرْفٍ صَوْتُهُ: ${sound} ... ${sound}؟` }],
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

const VISUAL_SPAN_POOL = ['apple', 'star', 'key', 'car', 'tree', 'fish', 'bell', 'pen', 'carrot'];
const AUDITORY_SPAN_POOL = ['door', 'sun', 'dog', 'elephant', 'moon', 'banana', 'house', 'hand', 'rooster'];

const VISUAL_SEQUENCES: string[][] = [
  ['star', 'fish'],
  ['car', 'apple'],
  ['tree', 'key', 'bell'],
  ['pen', 'star', 'carrot'],
  ['fish', 'car', 'tree', 'apple'],
  ['bell', 'carrot', 'key', 'star'],
  ['apple', 'pen', 'fish', 'bell', 'car'],
  ['key', 'tree', 'carrot', 'star', 'pen'],
  ['car', 'bell', 'apple', 'key', 'fish', 'tree'],
  ['carrot', 'star', 'pen', 'tree', 'car', 'apple'],
];

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
// The nine subtests
// ---------------------------------------------------------------------------
export const BATTERY: Subtest[] = [
  {
    id: 'visualSequential',
    order: 1,
    kind: 'span',
    modality: 'visual',
    domain: 'visualMemory',
    gameNameAr: 'نوافذ القلعة',
    skillNameAr: 'الذاكرة البصرية التسلسلية',
    icon: '🏰',
    minutes: 4,
    chance: 0,
    examinerNoteAr:
      'تظهر الصور واحدة تلو الأخرى في نافذة القلعة، ثم يلمس الطفل الصور بالترتيب نفسه. يبدأ الطول بصورتين ويزيد حتى ست. يتوقف الاختبار تلقائيًا إذا أخفق الطفل في محاولتي الطول نفسه. لا تُسمِّ الصور للطفل.',
    introAudio:
      'سَتَظْهَرُ صُوَرٌ فِي نَافِذَةِ القَلْعَةِ وَاحِدَةً بَعْدَ وَاحِدَةٍ. انْظُرْ جَيِّدًا، ثُمَّ الْمِسِ الصُّوَرَ بِالتَّرْتِيبِ نَفْسِهِ.',
    practice: [buildSpanTrial('vs-p1', ['apple', 'key'], VISUAL_SPAN_POOL, 101)],
    trials: VISUAL_SEQUENCES.map((seq, i) => buildSpanTrial(`vs-${i + 1}`, seq, VISUAL_SPAN_POOL, 200 + i)),
  },
  {
    id: 'visualAssociative',
    order: 2,
    kind: 'association',
    domain: 'visualMemory',
    gameNameAr: 'بيوت الحيوانات',
    skillNameAr: 'الذاكرة البصرية الترابطية (الشيء ومكانه)',
    icon: '🏘️',
    minutes: 4,
    chance: 0.3,
    examinerNoteAr:
      'تُفتح أبواب البيوت واحدًا تلو الآخر ويظهر في كل بيت حيوان، ثم تُغلق. بعدها يظهر حيوان ويلمس الطفل باب بيته. يزيد عدد البيوت من ٢ إلى ٥.',
    introAudio:
      'فِي كُلِّ بَيْتٍ حَيَوَانٌ صَغِيرٌ. انْظُرْ أَيْنَ يَسْكُنُ كُلُّ حَيَوَانٍ، ثُمَّ سَاعِدْهُ عَلَى الرُّجُوعِ إِلَى بَيْتِهِ.',
    practice: [{ id: 'va-p1', residents: ['dog', 'cat'], queryOrder: ['cat', 'dog'] }],
    blocks: [
      { id: 'va-1', residents: ['rabbit', 'lion'], queryOrder: ['lion', 'rabbit'] },
      { id: 'va-2', residents: ['bear', 'fox', 'frog'], queryOrder: ['frog', 'bear', 'fox'] },
      { id: 'va-3', residents: ['turtle', 'chicken', 'horse', 'elephant'], queryOrder: ['horse', 'turtle', 'elephant', 'chicken'] },
      { id: 'va-4', residents: ['mouse', 'camel', 'cow', 'duck', 'fish'], queryOrder: ['cow', 'fish', 'mouse', 'duck', 'camel'] },
    ],
  },
  {
    id: 'auditorySequential',
    order: 3,
    kind: 'span',
    modality: 'auditory',
    domain: 'auditoryMemory',
    gameNameAr: 'ببغاء الحديقة',
    skillNameAr: 'الذاكرة السمعية التسلسلية',
    icon: '🦜',
    minutes: 4,
    chance: 0,
    examinerNoteAr:
      'يسمع الطفل كلمات متتابعة دون أن يرى صورها، ثم يلمس الصور بالترتيب الذي سمعه. لا تُكرّر الكلمات للطفل ولا تسمح بإعادة الاستماع؛ هذا يقيس الذاكرة السمعية. يُفضَّل استخدام سماعات.',
    introAudio:
      'البَبَّغَاءُ سَيَقُولُ كَلِمَاتٍ. اسْمَعْ جَيِّدًا، ثُمَّ الْمِسِ الصُّوَرَ بِالتَّرْتِيبِ الَّذِي سَمِعْتَهُ.',
    practice: [buildSpanTrial('as-p1', ['house', 'banana'], AUDITORY_SPAN_POOL, 301)],
    trials: AUDITORY_SEQUENCES.map((seq, i) => buildSpanTrial(`as-${i + 1}`, seq, AUDITORY_SPAN_POOL, 400 + i)),
  },
  {
    id: 'pairedAssociate',
    order: 4,
    kind: 'pal',
    domain: 'auditoryMemory',
    gameNameAr: 'أصدقاء الفضاء',
    skillNameAr: 'التعلّم الترابطي السمعي-البصري (اسم ↔ رمز)',
    icon: '👾',
    minutes: 4,
    chance: 0.25,
    examinerNoteAr:
      'يتعلم الطفل أسماء أربع شخصيات بأسماء غير مألوفة، ثم يسمع الاسم ويلمس صاحبه. تُعرض الإجابة الصحيحة بعد كل محاولة لأن الهدف قياس سرعة التعلّم عبر ثلاث جولات. هذه المهارة تشبه تعلّم ربط شكل الحرف بصوته.',
    introAudio:
      'هَؤُلَاءِ أَصْدِقَاءُ مِنَ الفَضَاءِ، وَلِكُلٍّ مِنْهُمُ اسْمٌ. احْفَظْ أَسْمَاءَهُمْ، ثُمَّ الْمِسْ مَنْ تَسْمَعُ اسْمَهُ.',
    creatures: PAL_CREATURES,
    blocks: [
      { id: 'pal-1', order: ['c3', 'c1', 'c4', 'c2'] },
      { id: 'pal-2', order: ['c2', 'c4', 'c1', 'c3'] },
      { id: 'pal-3', order: ['c4', 'c3', 'c2', 'c1'] },
    ],
  },
  {
    id: 'rhyme',
    order: 5,
    kind: 'choice',
    domain: 'phonological',
    gameNameAr: 'كلمات تتشابه',
    skillNameAr: 'الوعي بالقافية',
    icon: '🎵',
    minutes: 3,
    chance: 1 / 3,
    discontinueAfter: 4,
    examinerNoteAr:
      'يسمع الطفل اسم الصورة العليا ثم أسماء ثلاث صور، ويختار الصورة التي تنتهي مثلها (القافية). تُسمّى كل الصور صوتيًا كي لا تقيس المهمة المفردات.',
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
      rhymeItem('rh-6', 'drum', ['rope', 'carrot', 'pen'], 'rope'),
      rhymeItem('rh-7', 'tree', ['bear', 'cow', 'book'], 'cow'),
      rhymeItem('rh-8', 'ball', ['elephant', 'moon', 'corn'], 'corn'),
    ],
  },
  {
    id: 'phonological',
    order: 6,
    kind: 'choice',
    domain: 'phonological',
    gameNameAr: 'مختبر الأصوات',
    skillNameAr: 'التحليل والتركيب الصوتي',
    icon: '🧪',
    minutes: 5,
    chance: 0.31,
    discontinueAfter: 4,
    examinerNoteAr:
      'بنود متدرجة: الصوت الأول، ثم الصوت الأخير، ثم تركيب المقاطع المسموعة في كلمة، ثم عدّ المقاطع. يُسمح للطفل بالتصفيق. يتوقف الاختبار بعد ٤ أخطاء متتالية.',
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
      codaItem('ph-7', 'rooster', ['dog', 'window', 'bear'], 'window'),
      blendItem('ph-8', 'rabbit', ['lion', 'rabbit', 'grapes']),
      blendItem('ph-9', 'turtle', ['turtle', 'fish', 'frog']),
      blendItem('ph-10', 'orange', ['apple', 'cow', 'orange']),
      syllableCountItem('ph-11', 'pen'),
      syllableCountItem('ph-12', 'car'),
    ],
  },
  {
    id: 'auditoryDiscrimination',
    order: 7,
    kind: 'choice',
    domain: 'perceptual',
    gameNameAr: 'الأذن الذهبية',
    skillNameAr: 'التمييز السمعي للأصوات المتقاربة',
    icon: '👂',
    minutes: 3,
    chance: 0.5,
    discontinueAfter: 6,
    examinerNoteAr:
      'يسمع الطفل مقطعين ويقرر إن كانا متطابقين أو مختلفين، ثم يختار بين صورتين يختلف اسماهما في صوت واحد (كلب/قلب). البنود تستهدف أزواجًا عربية شائعة الخلط: ت/ط، س/ص، د/ض، ذ/ز، ك/ق، ح/هـ. استخدم سماعات في مكان هادئ.',
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
    order: 8,
    kind: 'choice',
    domain: 'perceptual',
    gameNameAr: 'عين الصقر',
    skillNameAr: 'التمييز البصري للحروف والكلمات',
    icon: '🦅',
    minutes: 3,
    chance: 0.25,
    discontinueAfter: 5,
    examinerNoteAr:
      'يطابق الطفل شكلًا مع مثيله بين أشكال تختلف في النقاط أو الاتجاه أو حرف واحد. لا يتطلب معرفة القراءة؛ إنه تمييز بصري. يُسجَّل زمن الاستجابة أيضًا كمؤشر على سرعة المعالجة.',
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
    order: 9,
    kind: 'choice',
    domain: 'alphabetic',
    gameNameAr: 'صندوق الحروف',
    skillNameAr: 'معرفة أصوات الحروف',
    icon: '📦',
    minutes: 3,
    chance: 0.25,
    discontinueAfter: 5,
    examinerNoteAr:
      'يسمع الطفل صوت حرف بالفتحة ويلمس الحرف المناسب بين حروف متشابهة شكلًا أو صوتًا. من الطبيعي أن تكون الدرجة منخفضة قبل سن الخامسة؛ تُقارن النتيجة بتوقع العمر.',
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
];

export const SUBTESTS_BY_ID: Record<SubtestId, Subtest> = Object.fromEntries(
  BATTERY.map((s) => [s.id, s])
) as Record<SubtestId, Subtest>;

/** Number of scored units (items, trials or queries) in a subtest. */
export function scoredItemCount(subtest: Subtest): number {
  switch (subtest.kind) {
    case 'choice':
      return subtest.items.length;
    case 'span':
      return subtest.trials.length;
    case 'association':
      return subtest.blocks.reduce((sum, b) => sum + b.queryOrder.length, 0);
    case 'pal':
      return subtest.blocks.reduce((sum, b) => sum + b.order.length, 0);
  }
}

export const TOTAL_BATTERY_MINUTES = BATTERY.reduce((sum, s) => sum + s.minutes, 0);
