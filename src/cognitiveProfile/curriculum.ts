/**
 * The teaching curriculum of the guided programme: explicit, systematic instruction.
 *
 * Every skill level follows the explicit-instruction sequence (Archer & Hughes, 2011; the
 * Structured Literacy approach recommended by the International Dyslexia Association):
 *   1. "I do"   - a short lesson: the app names the skill, models it with real words, and shows
 *                 a counter-example (LESSONS).
 *   2. "We do"  - guided practice: the first items of a block come with a spoken hint and one
 *                 fewer option, and the help is withdrawn as the child succeeds (scaffolding and
 *                 fading; Wood, Bruner & Ross, 1976).
 *   3. "You do" - independent practice with immediate corrective feedback that explains why the
 *                 answer is right, then a second try (explanatory feedback is more effective than
 *                 right/wrong alone; Hattie & Timperley, 2007).
 * Phonological awareness is linked to letters (letter-sound lessons, and sound pairs shown with
 * their letters), which the National Reading Panel found more effective than sound work alone
 * (Ehri et al., 2001). Articulation cues for confusable Arabic sounds use the standard places
 * and manners of articulation (emphatic vs plain, interdental vs alveolar, voiced vs voiceless).
 *
 * All spoken text is fully vowelled so the pre-recorded clips are generated correctly.
 */
import type { AudioSegment, ChoiceItem } from './battery';
import { CONFUSABLE_LETTER_GROUPS, CONFUSABLE_PHONEME_PAIRS, DISTANT_PHONEME_PAIRS, LEXICON, PICTURE_IDS, lex } from './lexicon';
import { cvSyllable, type Level, type SkillId, type TrainingTargets } from './training';

export type LessonVisual =
  | { kind: 'pictures'; ids: string[]; highlight?: string }
  | { kind: 'glyphs'; letters: string[]; notesAr?: string[] }
  | { kind: 'syllables'; parts: string[]; word: string; pictureId?: string };

export interface LessonStep {
  /** What the adult and child read on screen. */
  textAr: string;
  /** What the app says, in order. */
  audio: AudioSegment[];
  visual?: LessonVisual;
}

export interface Lesson {
  key: string;
  skill: SkillId;
  level: Level;
  titleAr: string;
  steps: LessonStep[];
}

const say = (...texts: string[]): AudioSegment[] => texts.map((text) => ({ text, pauseAfterMs: 350 }));
const word = (id: string) => lex(id).word;

// ---------------------------------------------------------------------------
// Articulation cues for each confusable pair (letters sorted for lookup)
// ---------------------------------------------------------------------------
const pairKey = (a: string, b: string) => [a, b].sort().join('|');
export const PAIR_CUES: Record<string, { textAr: string; audio: string }> = {
  [pairKey('س', 'ص')]: { textAr: 'صَ صوت مفخّم ثقيل، وسَ صوت خفيف.', audio: 'صَ صَوْتٌ مُفَخَّمٌ ثَقِيلٌ، وَسَ صَوْتٌ خَفِيفٌ.' },
  [pairKey('ت', 'ط')]: { textAr: 'طَ صوت مفخّم ثقيل، وتَ صوت خفيف.', audio: 'طَ صَوْتٌ مُفَخَّمٌ ثَقِيلٌ، وَتَ صَوْتٌ خَفِيفٌ.' },
  [pairKey('د', 'ض')]: { textAr: 'ضَ صوت مفخّم ثقيل، ودَ صوت خفيف.', audio: 'ضَ صَوْتٌ مُفَخَّمٌ ثَقِيلٌ، وَدَ صَوْتٌ خَفِيفٌ.' },
  [pairKey('ذ', 'ز')]: { textAr: 'في ذَ يخرج طرف اللسان بين الأسنان، وفي زَ يبقى خلفها.', audio: 'فِي ذَ يَخْرُجُ طَرَفُ اللِّسَانِ بَيْنَ الْأَسْنَانِ، وَفِي زَ يَبْقَى خَلْفَهَا.' },
  [pairKey('ث', 'س')]: { textAr: 'في ثَ يخرج طرف اللسان بين الأسنان، وفي سَ يبقى خلفها.', audio: 'فِي ثَ يَخْرُجُ طَرَفُ اللِّسَانِ بَيْنَ الْأَسْنَانِ، وَفِي سَ يَبْقَى خَلْفَهَا.' },
  [pairKey('ذ', 'د')]: { textAr: 'في ذَ يخرج طرف اللسان بين الأسنان، وفي دَ يلمس أصول الأسنان العليا.', audio: 'فِي ذَ يَخْرُجُ طَرَفُ اللِّسَانِ بَيْنَ الْأَسْنَانِ، وَفِي دَ يَلْمِسُ أُصُولَ الْأَسْنَانِ الْعُلْيَا.' },
  [pairKey('ظ', 'ض')]: { textAr: 'في ظَ يخرج طرف اللسان بين الأسنان، وفي ضَ يبقى خلفها؛ وكلاهما مفخّم.', audio: 'فِي ظَ يَخْرُجُ طَرَفُ اللِّسَانِ بَيْنَ الْأَسْنَانِ، وَفِي ضَ يَبْقَى خَلْفَهَا، وَكِلَاهُمَا مُفَخَّمٌ.' },
  [pairKey('ك', 'ق')]: { textAr: 'قَ تخرج من مكان أبعد في الفم من كَ.', audio: 'قَ تَخْرُجُ مِنْ مَكَانٍ أَبْعَدَ فِي الْفَمِ مِنْ كَ.' },
  [pairKey('ح', 'ه')]: { textAr: 'حَ تخرج من وسط الحلق مبحوحة، وهَ من أقصاه بنَفَس خفيف.', audio: 'حَ تَخْرُجُ مِنْ وَسَطِ الْحَلْقِ مَبْحُوحَةً، وَهَ تَخْرُجُ مِنْ أَقْصَاهُ بِنَفَسٍ خَفِيفٍ.' },
  [pairKey('ع', 'ء')]: { textAr: 'عَ تخرج من وسط الحلق، والهمزة من أقصاه.', audio: 'عَ تَخْرُجُ مِنْ وَسَطِ الْحَلْقِ، وَالْهَمْزَةُ مِنْ أَقْصَاهُ.' },
  [pairKey('خ', 'غ')]: { textAr: 'خَ صوت مهموس بلا اهتزاز، وغَ مجهور يهتز معه الحلق.', audio: 'خَ صَوْتٌ مَهْمُوسٌ بِلَا اهْتِزَازٍ، وَغَ مَجْهُورٌ يَهْتَزُّ مَعَهُ الْحَلْقُ.' },
};
const DISTANT_CUE = { textAr: 'هذان صوتان مختلفان تمامًا.', audio: 'هَذَانِ صَوْتَانِ مُخْتَلِفَانِ تَمَامًا.' };

/** Dots and shape for letters in the visually confusable groups. */
export const LETTER_DOTS: Record<string, string> = {
  ب: 'نقطة تحت', ت: 'نقطتان فوق', ث: 'ثلاث نقاط فوق', ن: 'نقطة فوق', ي: 'نقطتان تحت',
  ج: 'نقطة في الوسط', ح: 'بلا نقاط', خ: 'نقطة فوق', د: 'بلا نقاط', ذ: 'نقطة فوق',
  ر: 'بلا نقاط', ز: 'نقطة فوق', س: 'بلا نقاط', ش: 'ثلاث نقاط فوق', ص: 'بلا نقاط',
  ض: 'نقطة فوق', ط: 'بلا نقاط', ظ: 'نقطة فوق', ع: 'بلا نقاط', غ: 'نقطة فوق', ف: 'نقطة فوق', ق: 'نقطتان فوق',
};

const LEVEL_LETTERS: Record<Level, string[]> = {
  1: ['م', 'ب', 'س', 'ل', 'ر', 'ن'],
  2: ['ت', 'د', 'ف', 'ك', 'ع', 'ح'],
  3: ['ب', 'ت', 'ث', 'س', 'ص'],
};

/** A picturable word that starts with this letter, to anchor its sound. */
function exampleFor(letter: string): string | null {
  return PICTURE_IDS.find((id) => LEXICON[id].onset === letter) ?? null;
}

function closing(textAr: string, audio: string): LessonStep {
  return { textAr, audio: say(audio) };
}

/** The lesson for one skill level. Targets (from oral reading) choose the pair or letters shown. */
export function lessonFor(skill: SkillId, level: Level, targets?: TrainingTargets): Lesson | null {
  const key = `${skill}:${level}`;
  switch (skill) {
    case 'rhyme':
      return {
        key, skill, level,
        titleAr: 'القافية: كلمات تتشابه في آخرها',
        steps: [
          { textAr: 'الكلمات التي تتشابه في آخرها نسمّيها قافية.', audio: say('الْكَلِمَاتُ الَّتِي تَتَشَابَهُ فِي آخِرِهَا نُسَمِّيهَا: قَافِيَةً.') },
          { textAr: `«${word('pen')}» و«${word('flag')}» تنتهيان بـ «لَمْ».`, audio: say('اسْمَعْ:', word('pen'), word('flag'), 'كِلْتَاهُمَا تَنْتَهِي بِـ: لَمْ.'), visual: { kind: 'pictures', ids: ['pen', 'flag'] } },
          { textAr: `أما «${word('sun')}» فلا تنتهي مثلهما.`, audio: say('أَمَّا', word('sun'), 'فَلَا تَنْتَهِي مِثْلَهُمَا.'), visual: { kind: 'pictures', ids: ['pen', 'flag', 'sun'], highlight: 'sun' } },
          closing('الآن دورك: اسمع آخر الكلمة جيدًا، ثم اختر.', 'الْآنَ دَوْرُكَ: اسْمَعْ آخِرَ الْكَلِمَةِ جَيِّدًا، ثُمَّ اخْتَرْ.'),
        ],
      };
    case 'soundPosition':
      if (level === 3) {
        return {
          key, skill, level,
          titleAr: 'آخر صوت في الكلمة',
          steps: [
            { textAr: 'نسمع الآن آخر صوت في الكلمة.', audio: say('نَسْمَعُ الْآنَ آخِرَ صَوْتٍ فِي الْكَلِمَةِ.') },
            { textAr: `«${word('door')}» و«${word('book')}» تنتهيان بالصوت نفسه.`, audio: say(word('door'), word('book'), 'تَنْتَهِيَانِ بِالصَّوْتِ نَفْسِهِ.'), visual: { kind: 'pictures', ids: ['door', 'book'] } },
            closing('الآن دورك: قل الكلمة ببطء، واسمع آخرها.', 'الْآنَ دَوْرُكَ: قُلِ الْكَلِمَةَ بِبُطْءٍ، وَاسْمَعْ آخِرَهَا.'),
          ],
        };
      }
      return {
        key, skill, level,
        titleAr: 'أول صوت في الكلمة',
        steps: [
          { textAr: 'كل كلمة تبدأ بصوت. نسمعه إذا قلنا الكلمة ببطء.', audio: say('كُلُّ كَلِمَةٍ تَبْدَأُ بِصَوْتٍ. نَسْمَعُهُ إِذَا قُلْنَا الْكَلِمَةَ بِبُطْءٍ.') },
          { textAr: `«${word('fish')}» أول صوت فيها «سَ».`, audio: say(word('fish'), 'أَوَّلُ صَوْتٍ فِيهَا: سَ.'), visual: { kind: 'pictures', ids: ['fish'] } },
          { textAr: `«${word('car')}» تبدأ بالصوت نفسه.`, audio: say(word('car'), 'تَبْدَأُ بِالصَّوْتِ نَفْسِهِ: سَ.'), visual: { kind: 'pictures', ids: ['fish', 'car'] } },
          closing('الآن دورك: قل الكلمة ببطء، واسمع أولها.', 'الْآنَ دَوْرُكَ: قُلِ الْكَلِمَةَ بِبُطْءٍ، وَاسْمَعْ أَوَّلَهَا.'),
        ],
      };
    case 'blending': {
      if (level === 3) {
        const e = lex('fish');
        return {
          key, skill, level,
          titleAr: 'نعدّ أجزاء الكلمة',
          steps: [
            { textAr: 'نعدّ أجزاء الكلمة بالتصفيق.', audio: say('نَعُدُّ أَجْزَاءَ الْكَلِمَةِ بِالتَّصْفِيقِ.') },
            { textAr: `«${e.word}»: ${e.syllables.join(' | ')} — ثلاث تصفيقات.`, audio: [...e.syllables.map((s) => ({ text: s, pauseAfterMs: 600 })), ...say('ثَلَاثُ تَصْفِيقَاتٍ.')], visual: { kind: 'syllables', parts: e.syllables, word: e.word, pictureId: 'fish' } },
            closing('الآن دورك: صفّق مع كل جزء، ثم اختر العدد.', 'الْآنَ دَوْرُكَ: صَفِّقْ مَعَ كُلِّ جُزْءٍ، ثُمَّ اخْتَرِ الْعَدَدَ.'),
          ],
        };
      }
      const e = lex(level === 1 ? 'pen' : 'fish');
      return {
        key, skill, level,
        titleAr: 'نركّب الأجزاء لنصنع كلمة',
        steps: [
          { textAr: 'الكلمة مصنوعة من أجزاء صغيرة. نصفّق مع كل جزء.', audio: say('الْكَلِمَةُ مَصْنُوعَةٌ مِنْ أَجْزَاءٍ صَغِيرَةٍ. نُصَفِّقُ مَعَ كُلِّ جُزْءٍ.') },
          { textAr: `${e.syllables.join(' + ')} = «${e.word}»`, audio: [...e.syllables.map((s) => ({ text: s, pauseAfterMs: 600 })), ...say('مَعًا:', e.word)], visual: { kind: 'syllables', parts: e.syllables, word: e.word, pictureId: e.id } },
          closing('الآن دورك: اسمع الأجزاء، وركّبها، ثم اختر الصورة.', 'الْآنَ دَوْرُكَ: اسْمَعِ الْأَجْزَاءَ، وَرَكِّبْهَا، ثُمَّ اخْتَرِ الصُّورَةَ.'),
        ],
      };
    }
    case 'discrimination': {
      const own = level === 1 ? [] : (targets?.soundPairs ?? []).filter(([a, b]) => PAIR_CUES[pairKey(a, b)]);
      const [a, b] = own[0] ?? (level === 1 ? DISTANT_PHONEME_PAIRS[0] : CONFUSABLE_PHONEME_PAIRS[1]);
      const cue = level === 1 ? DISTANT_CUE : PAIR_CUES[pairKey(a, b)] ?? DISTANT_CUE;
      const sa = cvSyllable(a, 'a');
      const sb = cvSyllable(b, 'a');
      return {
        key, skill, level,
        titleAr: `أصوات متقاربة: ${a} و${b}`,
        steps: [
          { textAr: 'بعض الأصوات تتشابه، فنسمعها بانتباه.', audio: say('بَعْضُ الْأَصْوَاتِ تَتَشَابَهُ، فَنَسْمَعُهَا بِانْتِبَاهٍ.') },
          { textAr: `${sa} — ${sb}. ${cue.textAr}`, audio: [...say(sa, sb), { text: cue.audio }], visual: { kind: 'glyphs', letters: [a, b] } },
          { textAr: `${sa} ${sa}: الصوت نفسه. ${sa} ${sb}: صوتان مختلفان.`, audio: say(sa, sa, 'الصَّوْتُ نَفْسُهُ.', sa, sb, 'صَوْتَانِ مُخْتَلِفَانِ.'), visual: { kind: 'glyphs', letters: [a, b] } },
          closing('الآن دورك: اسمع جيدًا، ثم اختر.', 'الْآنَ دَوْرُكَ: اسْمَعْ جَيِّدًا، ثُمَّ اخْتَرْ.'),
        ],
      };
    }
    case 'letterSound': {
      const own = (targets?.letters ?? []).filter((l) => LEVEL_LETTERS[level].includes(l));
      const letters = Array.from(new Set([...own, ...LEVEL_LETTERS[level]])).slice(0, level === 3 ? 2 : 3);
      const steps: LessonStep[] = [{ textAr: 'لكل حرف صوت. نسمع صوته ونرى شكله.', audio: say('لِكُلِّ حَرْفٍ صَوْتٌ. نَسْمَعُ صَوْتَهُ، وَنَرَى شَكْلَهُ.') }];
      for (const l of letters) {
        const ex = exampleFor(l);
        steps.push({
          textAr: ex ? `هذا الحرف صوته «${l}َ» مثل أول «${word(ex)}».` : `هذا الحرف صوته «${l}َ».`,
          audio: ex ? say('هَذَا الْحَرْفُ صَوْتُهُ:', `${l}َ`, 'مِثْلَ أَوَّلِ:', word(ex)) : say('هَذَا الْحَرْفُ صَوْتُهُ:', `${l}َ`),
          visual: { kind: 'glyphs', letters: [l] },
        });
      }
      if (level === 3) {
        const l = letters[0];
        steps.push({ textAr: `مع الحركات: ${l}َ ${l}ِ ${l}ُ (الفتحة والكسرة والضمة).`, audio: say(`${l}َ`, `${l}ِ`, `${l}ُ`, 'الْفَتْحَةُ وَالْكَسْرَةُ وَالضَّمَّةُ.'), visual: { kind: 'glyphs', letters: [`${l}َ`, `${l}ِ`, `${l}ُ`] } });
      }
      steps.push(closing('الآن دورك: اسمع الصوت، واختر حرفه.', 'الْآنَ دَوْرُكَ: اسْمَعِ الصَّوْتَ، وَاخْتَرْ حَرْفَهُ.'));
      return { key, skill, level, titleAr: 'ربط الحرف بصوته', steps };
    }
    case 'visualDiscrimination': {
      const ownGroup = CONFUSABLE_LETTER_GROUPS.find((g) => (targets?.letters ?? []).some((l) => g.includes(l)));
      const group = ownGroup ?? CONFUSABLE_LETTER_GROUPS[0];
      return {
        key, skill, level,
        titleAr: 'حروف تتشابه في الشكل',
        steps: [
          { textAr: 'بعض الحروف شكلها واحد، والفرق في النقاط.', audio: say('بَعْضُ الْحُرُوفِ شَكْلُهَا وَاحِدٌ، وَالْفَرْقُ فِي النِّقَاطِ.') },
          { textAr: group.map((l) => `${l}: ${LETTER_DOTS[l] ?? ''}`).join(' · '), audio: say('انْظُرْ: عَدَدُ النِّقَاطِ وَمَكَانُهَا يُغَيِّرُ الْحَرْفَ.'), visual: { kind: 'glyphs', letters: group, notesAr: group.map((l) => LETTER_DOTS[l] ?? '') } },
          closing('الآن دورك: قارن النقاط قبل أن تختار.', 'الْآنَ دَوْرُكَ: قَارِنِ النِّقَاطَ قَبْلَ أَنْ تَخْتَارَ.'),
        ],
      };
    }
    default:
      return null; // memory skills are not trained as goals
  }
}

// ---------------------------------------------------------------------------
// Guided practice: a spoken hint and one fewer option
// ---------------------------------------------------------------------------
export const HINTS: Record<string, string> = {
  rhyme: 'رَكِّزْ عَلَى آخِرِ الْكَلِمَةِ.',
  onset: 'رَكِّزْ عَلَى أَوَّلِ صَوْتٍ.',
  coda: 'رَكِّزْ عَلَى آخِرِ صَوْتٍ.',
  blending: 'صَفِّقْ مَعَ كُلِّ جُزْءٍ.',
  syllableCount: 'صَفِّقْ مَعَ كُلِّ جُزْءٍ.',
  letterSound: 'قُلِ الصَّوْتَ مَعِي.',
  contrast: 'اسْمَعْ بِانْتِبَاهٍ.',
  catch: 'اسْمَعْ بِانْتِبَاهٍ.',
  minimalPair: 'اسْمَعْ بِانْتِبَاهٍ.',
  letter: 'قَارِنِ النِّقَاطَ.',
  word: 'قَارِنِ النِّقَاطَ.',
};
/** Guided items at the start of a block while the model's estimate is below this. */
export const GUIDED_BELOW = 0.5;
export const GUIDED_ITEMS = 2;

/** The same item with a spoken hint first and, when it has 3+ options, one distractor removed. */
export function scaffold(item: ChoiceItem, drop: number = 0): ChoiceItem {
  const hint = item.tag ? HINTS[item.tag] : undefined;
  let options = item.options;
  if (options.length >= 3 && item.tag !== 'syllableCount') {
    const distractors = options.filter((o) => o.id !== item.correctId);
    const removed = distractors[drop % distractors.length].id;
    options = options.filter((o) => o.id !== removed);
  }
  const removedIds = new Set(item.options.filter((o) => !options.includes(o)).map((o) => o.id));
  return {
    ...item,
    id: `${item.id}-g`,
    options,
    audio: [...(hint ? [{ text: hint, pauseAfterMs: 300 }] : []), ...item.audio.filter((s) => !s.highlight || !removedIds.has(s.highlight))],
  };
}

// ---------------------------------------------------------------------------
// Explanatory feedback after a wrong answer
// ---------------------------------------------------------------------------
export interface Explanation {
  textAr: string;
  audio: AudioSegment[];
  pictureIds: string[];
  glyphs: string[];
}

const labelOf = (item: ChoiceItem, id: string) => item.options.find((o) => o.id === id)?.visual.label ?? id;

export function explainMistake(item: ChoiceItem): Explanation | null {
  const correct = item.correctId;
  if (!item.tag) return null;
  const target = item.stimulus?.label;
  const targetId = item.stimulus ? PICTURE_IDS.find((id) => LEXICON[id].emoji === item.stimulus!.value) : undefined;
  switch (item.tag) {
    case 'rhyme':
      return { textAr: `«${target}» و«${labelOf(item, correct)}» تنتهيان بالصوت نفسه.`, audio: say(target!, labelOf(item, correct), 'تَنْتَهِيَانِ بِالصَّوْتِ نَفْسِهِ.'), pictureIds: [targetId!, correct].filter(Boolean), glyphs: [] };
    case 'onset':
      return { textAr: `«${labelOf(item, correct)}» تبدأ مثل «${target}».`, audio: say(labelOf(item, correct), 'تَبْدَأُ مِثْلَ:', target!), pictureIds: [correct, targetId!].filter(Boolean), glyphs: [] };
    case 'coda':
      return { textAr: `«${labelOf(item, correct)}» تنتهي مثل «${target}».`, audio: say(labelOf(item, correct), 'تَنْتَهِي مِثْلَ:', target!), pictureIds: [correct, targetId!].filter(Boolean), glyphs: [] };
    case 'blending': {
      const e = LEXICON[correct];
      if (!e) return null;
      return { textAr: `${e.syllables.join(' + ')} = «${e.word}»`, audio: [...e.syllables.map((s) => ({ text: s, pauseAfterMs: 600 })), ...say('مَعًا:', e.word)], pictureIds: [correct], glyphs: [] };
    }
    case 'syllableCount': {
      const e = targetId ? LEXICON[targetId] : null;
      if (!e) return null;
      return { textAr: `${e.syllables.join(' | ')}: ${e.syllables.length} أجزاء`.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]), audio: [...say('صَفِّقْ مَعِي.'), ...e.syllables.map((s) => ({ text: s, pauseAfterMs: 600 }))], pictureIds: [e.id], glyphs: [] };
    }
    case 'letterSound': {
      const sound = item.audio.map((s) => s.text.match(/صَوْتُهُ: (\S+)/)?.[1]).find(Boolean);
      return { textAr: `هذا هو الحرف الصحيح: ${correct}`, audio: sound ? say('هَذَا هُوَ الْحَرْفُ الصَّحِيحُ، صَوْتُهُ:', sound) : say('هَذَا هُوَ الْحَرْفُ الصَّحِيحُ.'), pictureIds: [], glyphs: [correct] };
    }
    case 'contrast':
    case 'catch': {
      const [first, second] = item.audio;
      const same = correct === 'same';
      return { textAr: same ? 'الصوت نفسه مرتين.' : 'صوتان مختلفان.', audio: [...say(first.text, second.text), { text: same ? 'الصَّوْتُ نَفْسُهُ.' : 'صَوْتَانِ مُخْتَلِفَانِ.' }], pictureIds: [], glyphs: [] };
    }
    case 'minimalPair':
      return { textAr: `هذه «${labelOf(item, correct)}».`, audio: say('هَذِهِ:', labelOf(item, correct)), pictureIds: [correct], glyphs: [] };
    case 'letter':
    case 'word':
      return { textAr: `الصحيح: ${labelOf(item, correct)} — انظر إلى النقاط.`, audio: say('انْظُرْ إِلَى النِّقَاطِ جَيِّدًا.'), pictureIds: [], glyphs: [labelOf(item, correct)] };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Progress measure schedule: the first session, then once a week (every 5 sessions), and the last
// ---------------------------------------------------------------------------
export function probeDueAt(sessionNumber: number, programmeSessions: number): boolean {
  return sessionNumber === 1 || (sessionNumber - 1) % 5 === 0 || sessionNumber === programmeSessions;
}

// ---------------------------------------------------------------------------
// Every phrase the curriculum can speak (for the pre-recorded audio catalogue)
// ---------------------------------------------------------------------------
export function curriculumPhrases(): string[] {
  const out = new Set<string>();
  const addSegs = (segs: AudioSegment[]) => segs.forEach((s) => out.add(s.text));
  const skills: SkillId[] = ['rhyme', 'soundPosition', 'blending', 'discrimination', 'letterSound', 'visualDiscrimination'];
  const pairTargets: TrainingTargets[] = [undefined as unknown as TrainingTargets, ...CONFUSABLE_PHONEME_PAIRS.map((p) => ({ soundPairs: [p], letters: [] }))];
  const letterTargets: TrainingTargets[] = Object.values(LEVEL_LETTERS).flat().map((l) => ({ soundPairs: [], letters: [l] }));
  const groupTargets: TrainingTargets[] = CONFUSABLE_LETTER_GROUPS.map((g) => ({ soundPairs: [], letters: [g[0]] }));
  for (const skill of skills) {
    for (const level of [1, 2, 3] as Level[]) {
      for (const t of [undefined, ...pairTargets, ...letterTargets, ...groupTargets]) {
        lessonFor(skill, level, t ?? undefined)?.steps.forEach((s) => addSegs(s.audio));
      }
    }
  }
  Object.values(HINTS).forEach((h) => out.add(h));
  [
    'تَنْتَهِيَانِ بِالصَّوْتِ نَفْسِهِ.', 'تَبْدَأُ مِثْلَ:', 'تَنْتَهِي مِثْلَ:', 'مَعًا:', 'صَفِّقْ مَعِي.',
    'هَذَا هُوَ الْحَرْفُ الصَّحِيحُ، صَوْتُهُ:', 'هَذَا هُوَ الْحَرْفُ الصَّحِيحُ.', 'الصَّوْتُ نَفْسُهُ.', 'صَوْتَانِ مُخْتَلِفَانِ.',
    'هَذِهِ:', 'انْظُرْ إِلَى النِّقَاطِ جَيِّدًا.', 'حَاوِلْ مَرَّةً أُخْرَى.',
  ].forEach((p) => out.add(p));
  // Words and syllables can be spoken on their own in explanations (e.g. a one-syllable word).
  for (const e of Object.values(LEXICON)) {
    out.add(e.word);
    e.syllables.forEach((syl) => out.add(syl));
  }
  // Letter sounds with each short vowel (lessons and explanations)
  for (const l of 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' ')) for (const v of ['َ', 'ِ', 'ُ']) out.add(l + v);
  return [...out];
}
