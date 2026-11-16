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
import { getStructuredLiteracyStations, getFluencyPassage } from './structuredLiteracyStations';
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

export interface GuidedSyllableAssembly {
  /** One spoken syllable per card, in Arabic reading order (right to left). */
  parts: string[];
  word: string;
  pictureId: string;
  instructionAr: string;
}

export interface GuidedLessonChoice {
  promptAr: string;
  promptAudio: AudioSegment[];
  options: Array<{ id: string; labelAr: string; emoji?: string }>;
  correctId: string;
  hintAr: string;
  hintAudio: AudioSegment[];
  successAr: string;
  successAudio: AudioSegment[];
}

export interface Lesson {
  key: string;
  skill: SkillId;
  level: Level;
  titleAr: string;
  steps: LessonStep[];
  /** A non-scored, interactive worked example that happens before placement or practice. */
  guidedAssembly?: GuidedSyllableAssembly;
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
export function lessonFor(skill: SkillId, level: Level, targets?: TrainingTargets, ageYears = 8): Lesson | null {
  // Version the child-facing lesson so saved `lessonsSeen` from the old, text-only lesson
  // cannot skip the newly expanded explanation when a child returns to this skill.
  const key = `${skill}:${level}:child-first-v2`;
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
          { textAr: 'كُلُّ كَلِمَةٍ لَهَا صَوْتٌ فِي أَوَّلِهَا. نُبْطِئُ فِي نُطْقِهَا لِنَسْمَعَهُ.', audio: say('كُلُّ كَلِمَةٍ لَهَا صَوْتٌ فِي أَوَّلِهَا. نُبْطِئُ فِي نُطْقِهَا لِنَسْمَعَهُ.') },
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
        titleAr: 'قِطَارُ الْكَلِمَاتِ: نُرَكِّبُ الْمَقَاطِعَ',
        steps: [
          {
            textAr: 'وَجَدَ هُدْهُدٌ عَرَبَاتٍ صَغِيرَةً مُتَفَرِّقَةً. هَيَّا نُسَاعِدْهُ فِي جَمْعِهَا لِنَصْنَعَ كَلِمَةً!',
            audio: say('وَجَدَ هُدْهُدٌ عَرَبَاتٍ صَغِيرَةً مُتَفَرِّقَةً.', 'هَيَّا نُسَاعِدْهُ فِي جَمْعِهَا لِنَصْنَعَ كَلِمَةً.'),
          },
          {
            textAr: 'كُلُّ عَرَبَةٍ تَحْمِلُ مَقْطَعًا صَغِيرًا. نَقْرَأُ الْمَقَاطِعَ مِنَ الْيَمِينِ إِلَى الْيَسَارِ، ثُمَّ نَصِلُهَا مَعًا.',
            audio: say('كُلُّ عَرَبَةٍ تَحْمِلُ مَقْطَعًا صَغِيرًا.', 'نَقْرَأُ الْمَقَاطِعَ مِنَ الْيَمِينِ إِلَى الْيَسَارِ، ثُمَّ نَصِلُهَا مَعًا.'),
          },
          {
            textAr: `اِسْمَعْ مَعِي: ${e.syllables.join(' ... ')}. عِنْدَمَا نَصِلُهَا بِالتَّرْتِيبِ نَقُولُ: «${e.word}».`,
            audio: [...e.syllables.map((part) => ({ text: part, pauseAfterMs: 700 })), ...say('نَصِلُهَا مَعًا:', e.word)],
            visual: { kind: 'syllables', parts: e.syllables, word: e.word, pictureId: e.id },
          },
          closing('الآن دورك: ساعد هدهد على ترتيب المقاطع، ثم اسمع الكلمة كاملة.', 'الْآنَ دَوْرُكَ: سَاعِدْ هُدْهُدًا عَلَى تَرْتِيبِ الْمَقَاطِعِ، ثُمَّ اسْمَعِ الْكَلِمَةَ كَامِلَةً.'),
        ],
        guidedAssembly: {
          parts: e.syllables,
          word: e.word,
          pictureId: e.id,
          instructionAr: 'اِخْتَرِ الْجُزْءَ الَّذِي نَسْمَعُهُ أَوَّلًا، ثُمَّ أَكْمِلِ الْقِطَارَ.',
        },
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
          { textAr: 'بَعْضُ الْأَصْوَاتِ مُتَشَابِهَةٌ. سَنَسْمَعُ كُلَّ صَوْتٍ وَنُلَاحِظُ الْفَرْقَ بَيْنَهُمَا.', audio: say('بَعْضُ الْأَصْوَاتِ مُتَشَابِهَةٌ. سَنَسْمَعُ كُلَّ صَوْتٍ وَنُلَاحِظُ الْفَرْقَ بَيْنَهُمَا.') },
          { textAr: `${sa} — ${sb}. ${cue.textAr}`, audio: [...say(sa, sb), { text: cue.audio }], visual: { kind: 'glyphs', letters: [a, b] } },
          { textAr: `${sa} ${sa}: الصوت نفسه. ${sa} ${sb}: صوتان مختلفان.`, audio: say(sa, sa, 'الصَّوْتُ نَفْسُهُ.', sa, sb, 'صَوْتَانِ مُخْتَلِفَانِ.'), visual: { kind: 'glyphs', letters: [a, b] } },
          closing('الآن دورك: اسمع جيدًا، ثم اختر.', 'الْآنَ دَوْرُكَ: اسْمَعْ جَيِّدًا، ثُمَّ اخْتَرْ.'),
        ],
      };
    }
    case 'letterSound': {
      const own = (targets?.letters ?? []).filter((l) => LEVEL_LETTERS[level].includes(l));
      const letters = Array.from(new Set([...own, ...LEVEL_LETTERS[level]])).slice(0, level === 3 ? 2 : 3);
      const steps: LessonStep[] = [{ textAr: 'لِلْحَرْفِ شَكْلٌ نَرَاهُ وَصَوْتٌ نَسْمَعُهُ. سَنَقُولُ صَوْتَهُ وَنَرَى شَكْلَهُ.', audio: say('لِلْحَرْفِ شَكْلٌ نَرَاهُ وَصَوْتٌ نَسْمَعُهُ. سَنَقُولُ صَوْتَهُ وَنَرَى شَكْلَهُ.') }];
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
          { textAr: 'بَعْضُ الْحُرُوفِ مُتَشَابِهَةٌ. لِنَنْظُرْ إِلَى النُّقَطِ: عَدَدُهَا وَمَكَانُهَا يُسَاعِدَانِنَا عَلَى مَعْرِفَةِ الْحَرْفِ.', audio: say('بَعْضُ الْحُرُوفِ مُتَشَابِهَةٌ. لِنَنْظُرْ إِلَى النُّقَطِ: عَدَدُهَا وَمَكَانُهَا يُسَاعِدَانِنَا عَلَى مَعْرِفَةِ الْحَرْفِ.') },
          { textAr: group.map((l) => `${l}: ${LETTER_DOTS[l] ?? ''}`).join(' · '), audio: say('انْظُرْ: عَدَدُ النِّقَاطِ وَمَكَانُهَا يُغَيِّرُ الْحَرْفَ.'), visual: { kind: 'glyphs', letters: group, notesAr: group.map((l) => LETTER_DOTS[l] ?? '') } },
          closing('الآن دورك: قارن النقاط قبل أن تختار.', 'الْآنَ دَوْرُكَ: قَارِنِ النِّقَاطَ قَبْلَ أَنْ تَخْتَارَ.'),
        ],
      };
    }
    case 'decoding':
    case 'spelling':
    case 'comprehension':
    case 'morphology': {
      const station = getStructuredLiteracyStations(ageYears).find((entry) => entry.id === skill);
      if (!station) return null;
      return {
        key, skill, level, titleAr: station.titleAr,
        steps: [
          { textAr: station.teachAr, audio: say(station.teachAudioAr) },
          { textAr: station.modelAr, audio: say(station.modelAudioAr) },
          closing('الآن دورك: استخدم ما تعلّمته، ثم فكّر في سبب اختيارك.', 'الْآنَ دَوْرُكَ: اسْتَخْدِمْ مَا تَعَلَّمْتَهُ، ثُمَّ فَكِّرْ فِي سَبَبِ اخْتِيَارِكَ.'),
        ],
      };
    }
    default:
      return null; // memory skills are not trained as goals
  }
}


/**
 * One short, unscored "we do" item after the explanation and worked example.
 * It checks whether the child can use the just-taught idea before placement/practice begins.
 */
export function guidedChoiceForLesson(lesson: Lesson): GuidedLessonChoice | null {
  const make = (
    promptAr: string,
    promptAudio: AudioSegment[],
    options: GuidedLessonChoice['options'],
    correctId: string,
    hintAr: string,
    hintAudio: AudioSegment[],
    successAr: string,
    successAudio: AudioSegment[],
  ): GuidedLessonChoice => ({ promptAr, promptAudio, options, correctId, hintAr, hintAudio, successAr, successAudio });

  switch (lesson.skill) {
    case 'rhyme':
      return make(
        'اِسْمَعْ: قَلَمٌ وَعَلَمٌ. هَلْ يَتَشَابَهَانِ فِي آخِرِهِمَا؟',
        say('اِسْمَعْ: قَلَمٌ وَعَلَمٌ.', 'هَلْ يَتَشَابَهَانِ فِي آخِرِهِمَا؟'),
        [{ id: 'same', labelAr: 'نَعَمْ، النِّهَايَةُ مُتَشَابِهَةٌ' }, { id: 'different', labelAr: 'لَا، النِّهَايَةُ مُخْتَلِفَةٌ' }],
        'same',
        'اِسْمَعْ آخِرَ الْكَلِمَتَيْنِ: لَمْ ... لَمْ.',
        say('اِسْمَعْ آخِرَ الْكَلِمَتَيْنِ:', 'لَمْ.', 'لَمْ.'),
        'أَحْسَنْتَ! قَلَمٌ وَعَلَمٌ يَتَشَابَهَانِ فِي النِّهَايَةِ.',
        say('أَحْسَنْتَ!', 'قَلَمٌ وَعَلَمٌ يَتَشَابَهَانِ فِي النِّهَايَةِ.'),
      );
    case 'soundPosition':
      if (lesson.level === 3) {
        return make(
          'مَا الصَّوْتُ الْأَخِيرُ فِي كَلِمَةِ بَابٍ؟',
          say('كَلِمَةُ بَابٍ.', 'مَا الصَّوْتُ الْأَخِيرُ؟'),
          [{ id: 'بْ', labelAr: 'بْ' }, { id: 'مْ', labelAr: 'مْ' }, { id: 'لْ', labelAr: 'لْ' }],
          'بْ',
          'قُلْ بَابْ بِبُطْءٍ، وَاسْمَعْ آخِرَ صَوْتٍ.',
          say('قُلْ بَابْ بِبُطْءٍ، وَاسْمَعْ آخِرَ صَوْتٍ.'),
          'صَحِيحٌ! آخِرُ صَوْتٍ فِي بَابْ هُوَ بْ.',
          say('صَحِيحٌ!', 'آخِرُ صَوْتٍ فِي بَابْ هُوَ بْ.'),
        );
      }
      return make(
        'مَا الصَّوْتُ الْأَوَّلُ فِي كَلِمَةِ سَمَكَةٍ؟',
        say('سَمَكَةٌ.', 'مَا الصَّوْتُ الْأَوَّلُ؟'),
        [{ id: 'سَ', labelAr: 'سَ' }, { id: 'مَ', labelAr: 'مَ' }, { id: 'كَ', labelAr: 'كَ' }],
        'سَ',
        'اِسْمَعْ بَدْءَ الْكَلِمَةِ: سَ ... مَ ... كَة.',
        say('اِسْمَعْ بَدْءَ الْكَلِمَةِ:', 'سَ.', 'مَ.', 'كَة.'),
        'أَحْسَنْتَ! سَمَكَةٌ تَبْدَأُ بِصَوْتِ سَ.',
        say('أَحْسَنْتَ!', 'سَمَكَةٌ تَبْدَأُ بِصَوْتِ سَ.'),
      );
    case 'blending':
      if (lesson.level !== 3) return null;
      return make(
        'كَمْ مَقْطَعًا نَسْمَعُ فِي كَلِمَةِ سَمَكَةٍ؟',
        say('سَمَكَةٌ.', 'كَمْ مَقْطَعًا نَسْمَعُ؟'),
        [{ id: '2', labelAr: 'مَقْطَعَانِ' }, { id: '3', labelAr: 'ثَلَاثَةُ مَقَاطِعَ' }, { id: '4', labelAr: 'أَرْبَعَةُ مَقَاطِعَ' }],
        '3',
        'صَفِّقْ مَعِي مَرَّةً لِكُلِّ جُزْءٍ: سَ ... مَ ... كَة.',
        say('صَفِّقْ مَعِي مَرَّةً لِكُلِّ جُزْءٍ:', 'سَ.', 'مَ.', 'كَة.'),
        'رَائِعٌ! سَمَكَةٌ فِيهَا ثَلَاثَةُ مَقَاطِعَ.',
        say('رَائِعٌ!', 'سَمَكَةٌ فِيهَا ثَلَاثَةُ مَقَاطِعَ.'),
      );
    case 'discrimination': {
      if (lesson.level === 1) {
        return make(
          'اِسْمَعْ: سَ ... سَ. هَلْ سَمِعْتَ الصَّوْتَ نَفْسَهُ؟',
          say('سَ.', 'سَ.', 'هَلْ سَمِعْتَ الصَّوْتَ نَفْسَهُ؟'),
          [{ id: 'same', labelAr: 'الصَّوْتُ نَفْسُهُ' }, { id: 'different', labelAr: 'صَوْتَانِ مُخْتَلِفَانِ' }],
          'same',
          'اِسْمَعِ الْمَقْطَعَيْنِ مَرَّةً أُخْرَى.',
          say('اِسْمَعِ الْمَقْطَعَيْنِ مَرَّةً أُخْرَى:', 'سَ.', 'سَ.'),
          'صَحِيحٌ! سَ وَسَ هُمَا الصَّوْتُ نَفْسُهُ.',
          say('صَحِيحٌ!', 'سَ وَسَ هُمَا الصَّوْتُ نَفْسُهُ.'),
        );
      }
      const pairVisual = lesson.steps.find((step) => step.visual?.kind === 'glyphs')?.visual;
      const letters = pairVisual?.kind === 'glyphs' ? pairVisual.letters : ['س', 'ص'];
      const first = letters[0] + 'َ';
      const second = letters[1] + 'َ';
      return make(
        'اِسْمَعْ: ' + first + ' ... ' + second + '. هَلْ هُمَا الصَّوْتُ نَفْسُهُ؟',
        say('اِسْمَعْ:', first, second, 'هَلْ هُمَا الصَّوْتُ نَفْسُهُ؟'),
        [{ id: 'same', labelAr: 'الصَّوْتُ نَفْسُهُ' }, { id: 'different', labelAr: 'صَوْتَانِ مُخْتَلِفَانِ' }],
        'different',
        'اِسْمَعْ كُلَّ مَقْطَعٍ وَحْدَهُ، ثُمَّ قَارِنْ بَيْنَهُمَا.',
        say('اِسْمَعْ كُلَّ مَقْطَعٍ وَحْدَهُ، ثُمَّ قَارِنْ بَيْنَهُمَا.'),
        'أَحْسَنْتَ! الْمَقْطَعَانِ مُخْتَلِفَانِ.',
        say('أَحْسَنْتَ!', 'الْمَقْطَعَانِ مُخْتَلِفَانِ.'),
      );
    }
    case 'letterSound': {
      const glyphSteps = lesson.steps.filter((step) => step.visual?.kind === 'glyphs');
      const glyphVisual = glyphSteps[0]?.visual;
      const target = glyphVisual?.kind === 'glyphs' ? glyphVisual.letters[0] : 'م';
      const distractors = ['م', 'ب', 'س', 'ل', 'ر'].filter((letter) => letter !== target).slice(0, 2);
      return make(
        'أَيُّ حَرْفٍ صَوْتُهُ ' + target + 'َ؟',
        say('أَيُّ حَرْفٍ صَوْتُهُ:', target + 'َ؟'),
        [{ id: target, labelAr: target }, ...distractors.map((letter) => ({ id: letter, labelAr: letter }))],
        target,
        'اِسْمَعْ صَوْتَ ' + target + 'َ، وَانْظُرْ إِلَى شَكْلِ الْحَرْفِ.',
        say('اِسْمَعْ صَوْتَ:', target + 'َ،', 'وَانْظُرْ إِلَى شَكْلِ الْحَرْفِ.'),
        'صَحِيحٌ! هَذَا هُوَ الْحَرْفُ ' + target + '.',
        say('صَحِيحٌ!', 'هَذَا هُوَ الْحَرْفُ:', target),
      );
    }
    case 'visualDiscrimination': {
      const glyphVisual = lesson.steps.find((step) => step.visual?.kind === 'glyphs')?.visual;
      const group = glyphVisual?.kind === 'glyphs' ? glyphVisual.letters : ['ب', 'ت', 'ث'];
      const target = group[0];
      const distractors = group.slice(1, 3);
      return make(
        'أَيْنَ حَرْفُ ' + target + '؟',
        say('أَيْنَ حَرْفُ:', target),
        [{ id: target, labelAr: target }, ...distractors.map((letter) => ({ id: letter, labelAr: letter }))],
        target,
        'اُنْظُرْ إِلَى عَدَدِ النُّقَطِ وَمَكَانِهَا.',
        say('اُنْظُرْ إِلَى عَدَدِ النُّقَطِ وَمَكَانِهَا.'),
        'أَحْسَنْتَ! هَذَا هُوَ حَرْفُ ' + target + '.',
        say('أَحْسَنْتَ!', 'هَذَا هُوَ حَرْفُ:', target),
      );
    }
    case 'decoding':
      return make(
        'اِقْرَأْ: قَلَمٌ. ثُمَّ اخْتَرْ صُورَتَهُ.',
        say('اِقْرَأْ:', 'قَلَمٌ.', 'ثُمَّ اخْتَرْ صُورَتَهُ.'),
        [
          { id: 'pen', labelAr: 'قَلَمٌ', emoji: LEXICON.pen.emoji },
          { id: 'key', labelAr: 'مِفْتَاحٌ', emoji: LEXICON.key.emoji },
          { id: 'fish', labelAr: 'سَمَكَةٌ', emoji: LEXICON.fish.emoji },
        ],
        'pen',
        'اِقْرَأْ كُلَّ حَرْفٍ مَعَ حَرَكَتِهِ، ثُمَّ اِجْمَعِ الْأَصْوَاتَ.',
        say('اِقْرَأْ كُلَّ حَرْفٍ مَعَ حَرَكَتِهِ، ثُمَّ اِجْمَعِ الْأَصْوَاتَ.'),
        'رَائِعٌ! قَلَمٌ هُوَ الصُّورَةُ الصَّحِيحَةُ.',
        say('رَائِعٌ!', 'قَلَمٌ هُوَ الصُّورَةُ الصَّحِيحَةُ.'),
      );
    case 'spelling':
      return make(
        'أَيُّ كَلِمَةٍ كُتِبَتْ بِشَكْلٍ صَحِيحٍ؟',
        say('أَيُّ كَلِمَةٍ كُتِبَتْ بِشَكْلٍ صَحِيحٍ؟', 'اِسْمَعْ: شَجَرَةٌ.'),
        [
          { id: 'correct', labelAr: 'شَجَرَةٌ' },
          { id: 'wrong-h', labelAr: 'شَجَرَهْ' },
          { id: 'wrong-t', labelAr: 'شَجَرَتْ' },
        ],
        'correct',
        'اِسْمَعْ نِهَايَةَ الْكَلِمَةِ، وَتَذَكَّرْ أَنَّهَا تَنْتَهِي بِتَاءٍ مَرْبُوطَةٍ.',
        say('اِسْمَعْ نِهَايَةَ الْكَلِمَةِ.', 'تَنْتَهِي شَجَرَةٌ بِتَاءٍ مَرْبُوطَةٍ.'),
        'أَحْسَنْتَ! شَجَرَةٌ تَنْتَهِي بِالتَّاءِ الْمَرْبُوطَةِ.',
        say('أَحْسَنْتَ!', 'شَجَرَةٌ تَنْتَهِي بِالتَّاءِ الْمَرْبُوطَةِ.'),
      );
    case 'comprehension': {
      const listeningOnly = lesson.steps[0]?.textAr.startsWith('استمع إلى الجملة');
      if (listeningOnly) {
        return make(
          'سَمِعْنَا: وَضَعَتْ نُورٌ الْحِذَاءَ فِي الْخِزَانَةِ. أَيْنَ الْحِذَاءُ؟',
          say('وَضَعَتْ نُورٌ الْحِذَاءَ فِي الْخِزَانَةِ.', 'أَيْنَ الْحِذَاءُ؟'),
          [
            { id: 'closet', labelAr: 'فِي الْخِزَانَةِ' },
            { id: 'bag', labelAr: 'فِي الْحَقِيبَةِ' },
            { id: 'garden', labelAr: 'فِي الْحَدِيقَةِ' },
          ],
          'closet',
          'اِسْمَعِ الْجُمْلَةَ مِنْ جَدِيدٍ، وَانْتَبِهْ إِلَى كَلِمَةِ «فِي».',
          say('اِسْمَعِ الْجُمْلَةَ مِنْ جَدِيدٍ.', 'اِنْتَبِهْ إِلَى كَلِمَةِ فِي الْخِزَانَةِ.'),
          'أَحْسَنْتَ! الْحِذَاءُ فِي الْخِزَانَةِ.',
          say('أَحْسَنْتَ!', 'الْحِذَاءُ فِي الْخِزَانَةِ.'),
        );
      }
      return make(
        'هَطَلَ الْمَطَرُ، فَحَمَلَ سَامِي مِظَلَّتَهُ. مَا سَبَبُ حَمْلِ الْمِظَلَّةِ؟',
        say('هَطَلَ الْمَطَرُ، فَحَمَلَ سَامِي مِظَلَّتَهُ.', 'مَا سَبَبُ حَمْلِ الْمِظَلَّةِ؟'),
        [
          { id: 'rain', labelAr: 'الْمَطَرُ' },
          { id: 'play', labelAr: 'اللَّعِبُ' },
          { id: 'outing', labelAr: 'النُّزْهَةُ' },
        ],
        'rain',
        'اِبْحَثْ عَنِ الْحَدَثِ الَّذِي حَدَثَ أَوَّلًا فِي الْجُمْلَةِ.',
        say('اِبْحَثْ عَنِ الْحَدَثِ الَّذِي حَدَثَ أَوَّلًا فِي الْجُمْلَةِ.'),
        'صَحِيحٌ! الْمَطَرُ هُوَ السَّبَبُ.',
        say('صَحِيحٌ!', 'الْمَطَرُ هُوَ السَّبَبُ.'),
      );
    }
    case 'morphology':
      return make(
        'أَيُّ كَلِمَةٍ تَنْتَمِي إِلَى عَائِلَةِ كَتَبَ؟',
        say('أَيُّ كَلِمَةٍ تَنْتَمِي إِلَى عَائِلَةِ كَتَبَ؟'),
        [
          { id: 'book', labelAr: 'كِتَابٌ', emoji: LEXICON.book.emoji },
          { id: 'sun', labelAr: 'شَمْسٌ', emoji: LEXICON.sun.emoji },
          { id: 'fish', labelAr: 'سَمَكَةٌ', emoji: LEXICON.fish.emoji },
        ],
        'book',
        'اِبْحَثْ عَنِ الْحُرُوفِ ك، ت، ب، وَتَذَكَّرِ الْمَعْنَى.',
        say('اِبْحَثْ عَنِ الْحُرُوفِ:', 'كَاف، تَاء، بَاء.', 'وَتَذَكَّرِ الْمَعْنَى.'),
        'أَحْسَنْتَ! كَتَبَ وَكِتَابٌ مِنْ عَائِلَةٍ وَاحِدَةٍ.',
        say('أَحْسَنْتَ!', 'كَتَبَ وَكِتَابٌ مِنْ عَائِلَةٍ وَاحِدَةٍ.'),
      );
    default:
      return null;
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
  'structured-decoding': 'اِنْتَبِهْ إِلَى الْحَرَكَاتِ، وَاجْمَعِ الْأَصْوَاتَ بِالتَّرْتِيبِ.',
  'structured-spelling': 'اِسْمَعِ الْكَلِمَةَ، وَفَكِّرْ فِي الْحُرُوفِ الَّتِي تَسْمَعُهَا.',
  'structured-comprehension': 'تَذَكَّرْ مَا حَدَثَ، وَابْحَثْ عَنِ الْكَلِمَاتِ الَّتِي تُسَاعِدُكَ.',
  'structured-morphology': 'ابْحَثْ عَنِ الْحُرُوفِ الْأَصْلِيَّةِ وَمَعْنَى الْكَلِمَةِ.',
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
  if (item.tag.startsWith('structured-')) {
    if (item.explanationAr && item.explanationAudio?.length) {
      return { textAr: item.explanationAr, audio: item.explanationAudio, pictureIds: LEXICON[correct] ? [correct] : [], glyphs: [] };
    }
    const stationId = item.tag.slice('structured-'.length);
    const station = getStructuredLiteracyStations(8).find((entry) => entry.id === stationId);
    const question = station?.questions.find((entry) => entry.promptAr === item.promptAr);
    if (question) {
      return { textAr: question.explanationAr, audio: question.explanationAudio.map((text) => ({ text })), pictureIds: LEXICON[correct] ? [correct] : [], glyphs: [] };
    }
  }
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
  const skills: SkillId[] = ['rhyme', 'soundPosition', 'blending', 'discrimination', 'letterSound', 'visualDiscrimination', 'decoding', 'spelling', 'comprehension', 'morphology'];
  const pairTargets: TrainingTargets[] = [undefined as unknown as TrainingTargets, ...CONFUSABLE_PHONEME_PAIRS.map((p) => ({ soundPairs: [p], letters: [] }))];
  const letterTargets: TrainingTargets[] = Object.values(LEVEL_LETTERS).flat().map((l) => ({ soundPairs: [], letters: [l] }));
  const groupTargets: TrainingTargets[] = CONFUSABLE_LETTER_GROUPS.map((g) => ({ soundPairs: [], letters: [g[0]] }));
  for (const skill of skills) {
    for (const level of [1, 2, 3] as Level[]) {
      for (const ageYears of [4, 8]) {
        for (const t of [undefined, ...pairTargets, ...letterTargets, ...groupTargets]) {
          const lesson = lessonFor(skill, level, t ?? undefined, ageYears);
          if (!lesson) continue;
          lesson.steps.forEach((step) => addSegs(step.audio));
          const guided = guidedChoiceForLesson(lesson);
          if (guided) {
            addSegs(guided.promptAudio);
            addSegs(guided.hintAudio);
            addSegs(guided.successAudio);
          }
        }
      }
    }
  }
  Object.values(HINTS).forEach((h) => out.add(h));
  [
    'تَنْتَهِيَانِ بِالصَّوْتِ نَفْسِهِ.', 'تَبْدَأُ مِثْلَ:', 'تَنْتَهِي مِثْلَ:', 'مَعًا:', 'صَفِّقْ مَعِي.',
    'هَذَا هُوَ الْحَرْفُ الصَّحِيحُ، صَوْتُهُ:', 'هَذَا هُوَ الْحَرْفُ الصَّحِيحُ.', 'الصَّوْتُ نَفْسُهُ.', 'صَوْتَانِ مُخْتَلِفَانِ.',
    'هَذِهِ:', 'انْظُرْ إِلَى النِّقَاطِ جَيِّدًا.', 'حَاوِلْ مَرَّةً أُخْرَى.',
    'هَيَّا نُرَكِّبُ الْكَلِمَةَ مَعًا.', 'جَمَعْنَا الْمَقَاطِعَ، فَظَهَرَتِ الْكَلِمَةُ كَامِلَةً.', 'اِسْمَعِ الْمَقْطَعَ الْأَوَّلَ، ثُمَّ ابْحَثْ عَنْهُ.', 'اِخْتَرِ الْجُزْءَ الَّذِي نَسْمَعُهُ أَوَّلًا، ثُمَّ أَكْمِلِ الْقِطَارَ.',
  ].forEach((p) => out.add(p));
  // Structured literacy stations share their explicit teaching and feedback language with BKT training.
  for (const ageYears of [4, 8]) {
    const stations = getStructuredLiteracyStations(ageYears);
    for (const station of stations) {
      out.add(station.teachAudioAr);
      out.add(station.modelAudioAr);
      station.questions.forEach((question) => {
        question.audio.forEach((phrase) => out.add(phrase));
        question.explanationAudio.forEach((phrase) => out.add(phrase));
      });
    }
  }
  // Phrase-cued fluency examples are spoken as a model, never timed or scored.
  getFluencyPassage(8).modelAudio.forEach((phrase) => out.add(phrase));

  // Words and syllables can be spoken on their own in explanations (e.g. a one-syllable word).
  for (const e of Object.values(LEXICON)) {
    out.add(e.word);
    e.syllables.forEach((syl) => out.add(syl));
  }
  // Letter sounds with each short vowel (lessons and explanations)
  for (const l of 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' ')) for (const v of ['َ', 'ِ', 'ُ']) out.add(l + v);
  return [...out];
}
