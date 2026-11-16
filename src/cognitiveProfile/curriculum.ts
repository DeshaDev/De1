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
  | { kind: 'syllables'; parts: string[]; word: string; pictureId?: string }
  | { kind: 'story'; frames: { symbol: string; titleAr: string; detailAr: string }[]; relationAr?: string };

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

/**
 * Repeat the short teaching sequence at the start of a later session, but do not show it twice
 * while the same session moves from lesson -> placement -> practice.
 */
export function shouldShowSkillLesson(lessonSeen: boolean, previousPhase?: string | null): boolean {
  if (!lessonSeen) return true;
  return previousPhase !== 'lesson' && previousPhase !== 'placementIntro' && previousPhase !== 'placement';
}

const say = (...texts: string[]): AudioSegment[] => texts.map((text) => ({ text, pauseAfterMs: 350 }));
const word = (id: string) => lex(id).word;

/** One worked syllable-blending example, with the parts spoken before the complete word. */
function syllableExample(id: string, textAr: string, spokenLead: string): LessonStep {
  const entry = lex(id);
  return {
    textAr,
    audio: [
      ...say(spokenLead),
      ...entry.syllables.map((part) => ({ text: part, pauseAfterMs: 650 })),
      ...say('مَعًا:', entry.word),
    ],
    visual: {
      kind: 'syllables',
      parts: entry.syllables,
      word: entry.word,
      pictureId: id,
    },
  };
}

/** A counting model makes each spoken syllable visible as one clap. */
function syllableCountExample(id: string, textAr: string, spokenCount: string): LessonStep {
  const entry = lex(id);
  return {
    textAr,
    audio: [
      ...say('اِسْمَعِ الْكَلِمَةَ بِبُطْءٍ، وَصَفِّقْ مَعَ كُلِّ مَقْطَعٍ.'),
      ...entry.syllables.map((part) => ({ text: part, pauseAfterMs: 650 })),
      ...say(spokenCount),
    ],
    visual: {
      kind: 'syllables',
      parts: entry.syllables,
      word: entry.word,
      pictureId: id,
    },
  };
}

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

function pictureModel(ids: string[], textAr: string, spoken: string): LessonStep {
  return { textAr, audio: say(spoken), visual: { kind: 'pictures', ids } };
}

function glyphModel(letters: string[], textAr: string, spoken: string, notesAr?: string[]): LessonStep {
  return { textAr, audio: say(spoken), visual: { kind: 'glyphs', letters, ...(notesAr ? { notesAr } : {}) } };
}

function storyModel(
  textAr: string,
  spoken: string,
  frames: Array<{ symbol: string; titleAr: string; detailAr: string }>,
  relationAr: string
): LessonStep {
  return { textAr, audio: say(spoken), visual: { kind: 'story', frames, relationAr } };
}

interface StructuredLessonCopy {
  teachAr: string;
  teachAudioAr: string;
  modelAr: string;
  modelAudioAr: string;
}

/** Explicit instruction changes with the actual skill level, not merely with the child's age. */
function structuredLessonCopy(skill: SkillId, level: Level, ageYears: number): StructuredLessonCopy {
  if (skill === 'decoding') {
    const copy: Record<Level, StructuredLessonCopy> = {
      1: {
        teachAr: 'أَنْظُرُ إِلَى كُلِّ حَرْفٍ وَحَرَكَتِهِ. أَقْرَأُ الصَّوْتَ الصَّغِيرَ، ثُمَّ أَجْمَعُ الْأَصْوَاتَ بِتَرْتِيبِهَا.',
        teachAudioAr: 'أَنْظُرُ إِلَى كُلِّ حَرْفٍ وَحَرَكَتِهِ. أَقْرَأُ الصَّوْتَ الصَّغِيرَ، ثُمَّ أَجْمَعُ الْأَصْوَاتَ بِتَرْتِيبِهَا.',
        modelAr: 'مثال: قَلَمٌ. أقرأ قَ، ثم لَ، ثم مٌ، وأجمعها لأقرأ: قَلَمٌ. لا أضيف حرفًا غير مكتوب.',
        modelAudioAr: 'مِثَالٌ: قَلَمٌ. أَقْرَأُ قَ، ثُمَّ لَ، ثُمَّ مٌ، وَأَجْمَعُهَا لِأَقْرَأَ: قَلَمٌ. لَا أُضِيفُ حَرْفًا غَيْرَ مَكْتُوبٍ.',
      },
      2: {
        teachAr: 'أَقْرَأُ الْكَلِمَةَ عَلَى مَقَاطِعَ أَكْبَرَ. أَنْتَبِهُ إِلَى الْحَرْفِ السَّاكِنِ وَإِلَى شَكْلِ التَّاءِ فِي آخِرِ الْكَلِمَةِ.',
        teachAudioAr: 'أَقْرَأُ الْكَلِمَةَ عَلَى مَقَاطِعَ أَكْبَرَ. أَنْتَبِهُ إِلَى الْحَرْفِ السَّاكِنِ وَإِلَى شَكْلِ التَّاءِ فِي آخِرِ الْكَلِمَةِ.',
        modelAr: 'مثال: مَدْرَسَةٌ. ألاحظ السكون على الدال، وأقرأ بقية الحروف بترتيبها، وأتذكر أن ة في آخر الكلمة تاء مربوطة.',
        modelAudioAr: 'مِثَالٌ: مَدْرَسَةٌ. أُلَاحِظُ السُّكُونَ عَلَى الدَّالِ، وَأَقْرَأُ بَقِيَّةَ الْحُرُوفِ بِتَرْتِيبِهَا، وَأَتَذَكَّرُ أَنَّ التَّاءَ الْمَرْبُوطَةَ تَأْتِي فِي آخِرِ الْكَلِمَةِ.',
      },
      3: {
        teachAr: 'أَقْرَأُ الْكَلِمَاتِ الْأَطْوَلَ بِتَجْمِيعِ مَقَاطِعِهَا. أُرَاقِبُ السُّكُونَ وَحَرْفَ الْمَدِّ، ثُمَّ أُعِيدُ قِرَاءَةَ الْكَلِمَةِ كَامِلَةً.',
        teachAudioAr: 'أَقْرَأُ الْكَلِمَاتِ الْأَطْوَلَ بِتَجْمِيعِ مَقَاطِعِهَا. أُرَاقِبُ السُّكُونَ وَحَرْفَ الْمَدِّ، ثُمَّ أُعِيدُ قِرَاءَةَ الْكَلِمَةِ كَامِلَةً.',
        modelAr: 'مثال: مِفْتَاحٌ. أقرأ مِفْ ثم تَاحٌ، وألاحظ أن الألف تطيل صوت الفتحة، ثم أصل المقطعين.',
        modelAudioAr: 'مِثَالٌ: مِفْتَاحٌ. أَقْرَأُ مِفْ، ثُمَّ تَاحٌ، وَأُلَاحِظُ أَنَّ الْأَلِفَ تُطِيلُ صَوْتَ الْفَتْحَةِ، ثُمَّ أَصِلُ الْمَقْطَعَيْنِ.',
      },
    };
    return copy[level];
  }
  if (skill === 'spelling') {
    const copy: Record<Level, StructuredLessonCopy> = {
      1: {
        teachAr: 'أَسْمَعُ الْكَلِمَةَ بِهُدُوءٍ، وَأَنْتَبِهُ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. أَكْتُبُ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ أَزِيدَ حَرْفًا.',
        teachAudioAr: 'أَسْمَعُ الْكَلِمَةَ بِهُدُوءٍ، وَأَنْتَبِهُ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. أَكْتُبُ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ أَزِيدَ حَرْفًا.',
        modelAr: 'مثال: قَلَمٌ. أكتب ق، ثم ل، ثم م. الحركات تساعدني على القراءة، ولا أكتب ألف مدّ غير موجودة.',
        modelAudioAr: 'مِثَالٌ: قَلَمٌ. أَكْتُبُ قَافًا، ثُمَّ لَامًا، ثُمَّ مِيمًا. الْحَرَكَاتُ تُسَاعِدُنِي عَلَى الْقِرَاءَةِ، وَلَا أَكْتُبُ أَلِفَ مَدٍّ غَيْرَ مَوْجُودَةٍ.',
      },
      2: {
        teachAr: 'أُصْغِي إِلَى مَدِّ الصَّوْتِ، وَأَتَذَكَّرُ أَنَّ الْمَدَّ قَدْ يُكْتَبُ بِالْأَلِفِ أَوِ الْوَاوِ أَوِ الْيَاءِ. أُرَاجِعُ شَكْلَ نِهَايَةِ الْكَلِمَةِ.',
        teachAudioAr: 'أُصْغِي إِلَى مَدِّ الصَّوْتِ، وَأَتَذَكَّرُ أَنَّ الْمَدَّ قَدْ يُكْتَبُ بِالْأَلِفِ أَوِ الْوَاوِ أَوِ الْيَاءِ. أُرَاجِعُ شَكْلَ نِهَايَةِ الْكَلِمَةِ.',
        modelAr: 'مثال: كِتَابٌ. أسمع المدّ بعد التاء، فأكتب الألف: كِتَاب. وأراجع ترتيب الحروف قبل أن أنتهي.',
        modelAudioAr: 'مِثَالٌ: كِتَابٌ. أَسْمَعُ الْمَدَّ بَعْدَ التَّاءِ، فَأَكْتُبُ الْأَلِفَ: كِتَابٌ. وَأُرَاجِعُ تَرْتِيبَ الْحُرُوفِ قَبْلَ أَنْ أَنْتَهِيَ.',
      },
      3: {
        teachAr: 'أُرَاجِعُ آخِرَ الْكَلِمَةِ بِعِنَايَةٍ. أُمَيِّزُ بَيْنَ التَّاءِ الْمَرْبُوطَةِ وَالْهَاءِ وَالْأَلِفِ الْمَقْصُورَةِ وَالْيَاءِ.',
        teachAudioAr: 'أُرَاجِعُ آخِرَ الْكَلِمَةِ بِعِنَايَةٍ. أُمَيِّزُ بَيْنَ التَّاءِ الْمَرْبُوطَةِ وَالْهَاءِ وَالْأَلِفِ الْمَقْصُورَةِ وَالْيَاءِ.',
        modelAr: 'مثال: هُدَى. تنتهي الكلمة بألف مقصورة ى، وليست بياء ي. أنظر إلى الكلمة كاملة، لا إلى صوت النهاية وحده.',
        modelAudioAr: 'مِثَالٌ: هُدَى. تَنْتَهِي الْكَلِمَةُ بِأَلِفٍ مَقْصُورَةٍ: ى، وَلَيْسَتْ بِيَاءٍ: ي. أَنْظُرُ إِلَى الْكَلِمَةِ كَامِلَةً، لَا إِلَى صَوْتِ النِّهَايَةِ وَحْدَهُ.',
      },
    };
    return copy[level];
  }
  if (skill === 'comprehension') {
    const listening = ageYears < 6;
    const copy: Record<Level, StructuredLessonCopy> = listening ? {
      1: {
        teachAr: 'أستمع إلى الجملة، وأتذكر الشخص والفعل أو الشيء المذكور فيها. أجيب من الكلام الذي سمعته.',
        teachAudioAr: 'أَسْتَمِعُ إِلَى الْجُمْلَةِ، وَأَتَذَكَّرُ الشَّخْصَ وَالْفِعْلَ أَوِ الشَّيْءَ الْمَذْكُورَ فِيهَا. أُجِيبُ مِنَ الْكَلَامِ الَّذِي سَمِعْتُهُ.',
        modelAr: 'مثال: سَقَتْ لَيْلَى زَهْرَةً. عندما نسأل: ماذا سقت ليلى؟ نجيب: زهرة.',
        modelAudioAr: 'مِثَالٌ: سَقَتْ لَيْلَى زَهْرَةً. عِنْدَمَا نَسْأَلُ: مَاذَا سَقَتْ لَيْلَى؟ نُجِيبُ: زَهْرَةً.',
      },
      2: {
        teachAr: 'أنتبه إلى كلمات الترتيب مثل «أولًا» و«ثم». أتذكر ما حدث في البداية، ثم ما حدث بعده.',
        teachAudioAr: 'أَنْتَبِهُ إِلَى كَلِمَاتِ التَّرْتِيبِ مِثْلَ: أَوَّلًا وَثُمَّ. أَتَذَكَّرُ مَا حَدَثَ فِي الْبِدَايَةِ، ثُمَّ مَا حَدَثَ بَعْدَهُ.',
        modelAr: 'مثال: غَسَلَتْ هِنْدٌ يَدَيْهَا، ثُمَّ جَلَسَتْ لِتَأْكُلَ. غسل اليدين حدث أولًا.',
        modelAudioAr: 'مِثَالٌ: غَسَلَتْ هِنْدٌ يَدَيْهَا، ثُمَّ جَلَسَتْ لِتَأْكُلَ. غَسْلُ الْيَدَيْنِ حَدَثَ أَوَّلًا.',
      },
      3: {
        teachAr: 'أربط بين الحدث وسببه. أبحث عمّا حدث أولًا، ثم أسأل نفسي: لماذا حدث الأمر الآخر؟',
        teachAudioAr: 'أَرْبِطُ بَيْنَ الْحَدَثِ وَسَبَبِهِ. أَبْحَثُ عَمَّا حَدَثَ أَوَّلًا، ثُمَّ أَسْأَلُ نَفْسِي: لِمَاذَا حَدَثَ الْأَمْرُ الْآخَرُ؟',
        modelAr: 'مثال: شَعَرَ خَالِدٌ بِالْبَرْدِ، فَلَبِسَ مِعْطَفَهُ. البرد هو السبب، ولبس المعطف هو النتيجة.',
        modelAudioAr: 'مِثَالٌ: شَعَرَ خَالِدٌ بِالْبَرْدِ، فَلَبِسَ مِعْطَفَهُ. الْبَرْدُ هُوَ السَّبَبُ، وَلُبْسُ الْمِعْطَفِ هُوَ النَّتِيجَةُ.',
      },
    } : {
      1: {
        teachAr: 'أقرأ الجملة وأبحث عن المعلومة التي يطلبها السؤال. أعود إلى الكلمات نفسها بدل التخمين.',
        teachAudioAr: 'أَقْرَأُ الْجُمْلَةَ وَأَبْحَثُ عَنِ الْمَعْلُومَةِ الَّتِي يَطْلُبُهَا السُّؤَالُ. أَعُودُ إِلَى الْكَلِمَاتِ نَفْسِهَا بَدَلَ التَّخْمِينِ.',
        modelAr: 'مثال: سَقَتْ لَيْلَى زَهْرَةً. السؤال: ماذا سقت ليلى؟ أجد الإجابة في الجملة: زهرة.',
        modelAudioAr: 'مِثَالٌ: سَقَتْ لَيْلَى زَهْرَةً. السُّؤَالُ: مَاذَا سَقَتْ لَيْلَى؟ أَجِدُ الْإِجَابَةَ فِي الْجُمْلَةِ: زَهْرَةً.',
      },
      2: {
        teachAr: 'أنتبه إلى كلمات الترتيب والسبب مثل «ثم» و«لأن». أستخدمها لأعرف ما حدث أولًا وما الذي ترتب عليه.',
        teachAudioAr: 'أَنْتَبِهُ إِلَى كَلِمَاتِ التَّرْتِيبِ وَالسَّبَبِ مِثْلَ: ثُمَّ وَلِأَنَّ. أَسْتَخْدِمُهَا لِأَعْرِفَ مَا حَدَثَ أَوَّلًا وَمَا الَّذِي تَرَتَّبَ عَلَيْهِ.',
        modelAr: 'مثال: رَسَمَتْ لَيْلَى شَكْلًا، ثُمَّ لَوَّنَتْهُ. كلمة «ثم» تخبرنا أن التلوين جاء بعد الرسم.',
        modelAudioAr: 'مِثَالٌ: رَسَمَتْ لَيْلَى شَكْلًا، ثُمَّ لَوَّنَتْهُ. كَلِمَةُ ثُمَّ تُخْبِرُنَا أَنَّ التَّلْوِينَ جَاءَ بَعْدَ الرَّسْمِ.',
      },
      3: {
        teachAr: 'أستدل من قرائن النص. قد لا تكون الإجابة مكتوبة بالكلمات نفسها، لذلك أجمع أكثر من معلومة قبل أن أستنتج.',
        teachAudioAr: 'أَسْتَدِلُّ مِنْ قَرَائِنِ النَّصِّ. قَدْ لَا تَكُونُ الْإِجَابَةُ مَكْتُوبَةً بِالْكَلِمَاتِ نَفْسِهَا، لِذَلِكَ أَجْمَعُ أَكْثَرَ مِنْ مَعْلُومَةٍ قَبْلَ أَنْ أَسْتَنْتِجَ.',
        modelAr: 'مثال: رأى عادل أن التراب جاف، ثم سقى النبتة. نفهم أن النبتة تحتاج إلى الماء من جفاف التراب وسقيها.',
        modelAudioAr: 'مِثَالٌ: رَأَى عَادِلٌ أَنَّ التُّرَابَ جَافٌّ، فَأَحْضَرَ الْمَاءَ وَسَقَى النَّبْتَةَ. نَفْهَمُ أَنَّ النَّبْتَةَ تَحْتَاجُ إِلَى الْمَاءِ مِنْ جَفَافِ التُّرَابِ وَسَقْيِهَا.',
      },
    };
    return copy[level];
  }
  if (skill === 'morphology') {
    const copy: Record<Level, StructuredLessonCopy> = {
      1: {
        teachAr: 'بعض الكلمات تنتمي إلى عائلة واحدة. نبحث عن الحروف الأصلية المشتركة، ثم نلاحظ المعنى الذي يجمعها.',
        teachAudioAr: 'بَعْضُ الْكَلِمَاتِ تَنْتَمِي إِلَى عَائِلَةٍ وَاحِدَةٍ. نَبْحَثُ عَنِ الْحُرُوفِ الْأَصْلِيَّةِ الْمُشْتَرَكَةِ، ثُمَّ نُلَاحِظُ الْمَعْنَى الَّذِي يَجْمَعُهَا.',
        modelAr: 'مثال: كَتَبَ وكِتَابٌ. تشترك الكلمتان في الحروف ك، ت، ب، وترتبطان بمعنى الكتابة.',
        modelAudioAr: 'مِثَالٌ: كَتَبَ وَكِتَابٌ. تَشْتَرِكُ الْكَلِمَتَانِ فِي الْحُرُوفِ كَاف، تَاء، بَاء، وَتَرْتَبِطَانِ بِمَعْنَى الْكِتَابَةِ.',
      },
      2: {
        teachAr: 'أتعرف إلى المشتقات الشائعة من الجذر؛ مثل اسم من يقوم بالفعل، واسم المكان الذي يحدث فيه.',
        teachAudioAr: 'أَتَعَرَّفُ إِلَى الْمُشْتَقَّاتِ الشَّائِعَةِ مِنَ الْجِذْرِ؛ مِثْلَ اسْمِ مَنْ يَقُومُ بِالْفِعْلِ، وَاسْمِ الْمَكَانِ الَّذِي يَحْدُثُ فِيهِ.',
        modelAr: 'مثال: سَمِعَ وسَامِعٌ. الجذر س، م، ع، والمعنى في الكلمتين مرتبط بالسمع.',
        modelAudioAr: 'مِثَالٌ: سَمِعَ وَسَامِعٌ. الْجِذْرُ سِين، مِيم، عَيْن، وَالْمَعْنَى فِي الْكَلِمَتَيْنِ مُرْتَبِطٌ بِالسَّمْعِ.',
      },
      3: {
        teachAr: 'قد يأتي من الجذر الواحد أكثر من شكل للكلمة. أتعرف إلى اسم المفعول، وأقارنه باسم الفاعل، وأنتبه إلى من فعل الفعل ومن وقع عليه.',
        teachAudioAr: 'قَدْ يَأْتِي مِنَ الْجِذْرِ الْوَاحِدِ أَكْثَرُ مِنْ شَكْلٍ لِلْكَلِمَةِ. أَتَعَرَّفُ إِلَى اسْمِ الْمَفْعُولِ، وَأُقَارِنُهُ بِاسْمِ الْفَاعِلِ، وَأَنْتَبِهُ إِلَى مَنْ فَعَلَ الْفِعْلَ وَمَنْ وَقَعَ عَلَيْهِ.',
        modelAr: 'مثال: كَتَبَ وكَاتِبٌ ومَكْتُوبٌ. تشترك الكلمات في الجذر ك، ت، ب؛ كاتب هو من يقوم بالكتابة، ومكتوب هو ما كُتِب.',
        modelAudioAr: 'مِثَالٌ: كَتَبَ وَكَاتِبٌ وَمَكْتُوبٌ. تَشْتَرِكُ الْكَلِمَاتُ فِي الْجِذْرِ كَاف، تَاء، بَاء؛ كَاتِبٌ هُوَ مَنْ يَقُومُ بِالْكِتَابَةِ، وَمَكْتُوبٌ هُوَ مَا كُتِبَ.',
      },
    };
    return copy[level];
  }
  throw new Error(`No structured lesson copy for ${skill}`);
}

/** A visual worked example for literacy skills that otherwise appeared as plain paragraphs. */
function stationModelVisual(skill: SkillId, ageYears: number, level: Level): LessonVisual | undefined {
  switch (skill) {
    case 'decoding':
      if (level === 1) return {
        kind: 'story',
        frames: [
          { symbol: 'قَ', titleAr: 'الصوت الأول', detailAr: 'قاف مع فتحة' },
          { symbol: 'لَ', titleAr: 'الصوت الثاني', detailAr: 'لام مع فتحة' },
          { symbol: 'مٌ', titleAr: 'الصوت الأخير', detailAr: 'ميم مع تنوين الضم' },
        ],
        relationAr: 'قَ + لَ + مٌ = قَلَمٌ. نجمع الأصوات بالترتيب.',
      };
      if (level === 2) return {
        kind: 'story',
        frames: [
          { symbol: 'مَدْ', titleAr: 'ألاحظ السكون', detailAr: 'الدال ساكنة' },
          { symbol: 'رَسَةٌ', titleAr: 'أتابع القراءة', detailAr: 'راء وسين، ثم تاء مربوطة' },
          { symbol: 'مَدْرَسَةٌ', titleAr: 'الكلمة كاملة', detailAr: 'أقرأها متصلة' },
        ],
        relationAr: 'في مَدْرَسَةٌ ننتبه إلى السكون وإلى التاء المربوطة.',
      };
      return {
        kind: 'story',
        frames: [
          { symbol: 'مِفْ', titleAr: 'المقطع الأول', detailAr: 'ميم مكسورة وفاء ساكنة' },
          { symbol: 'تَاحٌ', titleAr: 'المقطع الثاني', detailAr: 'التاء مفتوحة وبعدها ألف مد' },
          { symbol: 'مِفْتَاحٌ', titleAr: 'الكلمة كاملة', detailAr: 'أصل المقطعين معًا' },
        ],
        relationAr: 'مِفْ + تَاحٌ = مِفْتَاحٌ.',
      };
    case 'spelling':
      if (level === 1) return {
        kind: 'story',
        frames: [
          { symbol: 'قَ', titleAr: 'أسمع البداية', detailAr: 'صوت القاف' },
          { symbol: 'لَ', titleAr: 'أسمع الوسط', detailAr: 'صوت اللام' },
          { symbol: 'م', titleAr: 'أكتب النهاية', detailAr: 'صوت الميم' },
        ],
        relationAr: 'أكتب الحروف بالترتيب: ق + ل + م = قلم.',
      };
      if (level === 2) return {
        kind: 'story',
        frames: [
          { symbol: 'كِ', titleAr: 'أبدأ بالكاف', detailAr: 'كاف مكسورة' },
          { symbol: 'تَا', titleAr: 'ألاحظ المدّ', detailAr: 'ألف بعد التاء' },
          { symbol: 'بٌ', titleAr: 'أكمل الكلمة', detailAr: 'باء في النهاية' },
        ],
        relationAr: 'كِ + تَا + بٌ = كِتَابٌ. أكتب الألف التي تمثل المدّ.',
      };
      return {
        kind: 'story',
        frames: [
          { symbol: 'هُدَ', titleAr: 'أقرأ الكلمة', detailAr: 'هاء مضمومة ودال مفتوحة' },
          { symbol: 'ى', titleAr: 'ألاحظ النهاية', detailAr: 'ألف مقصورة' },
          { symbol: 'هُدَى', titleAr: 'أكتبها كاملة', detailAr: 'ليست ياءً' },
        ],
        relationAr: 'هُدَى تنتهي بألف مقصورة (ى)، لا بياء (ي).',
      };
    case 'comprehension':
      if (level === 1) return ageYears < 6
        ? {
            kind: 'story',
            frames: [
              { symbol: '👧', titleAr: 'من؟', detailAr: 'لَيْلَى' },
              { symbol: '💧', titleAr: 'ماذا فعلت؟', detailAr: 'سَقَتْ زَهْرَةً' },
            ],
            relationAr: 'نستمع إلى الجملة ونبحث عن المعلومة المذكورة بوضوح.',
          }
        : {
            kind: 'story',
            frames: [
              { symbol: '👧', titleAr: 'من؟', detailAr: 'لَيْلَى' },
              { symbol: '🌷', titleAr: 'ماذا سقت؟', detailAr: 'زَهْرَةً' },
            ],
            relationAr: 'نعود إلى كلمات الجملة لنجد الإجابة الصريحة.',
          };
      if (level === 2) return {
        kind: 'story',
        frames: [
          { symbol: '١', titleAr: 'أولًا', detailAr: 'غَسَلَتْ هِنْدٌ يَدَيْهَا' },
          { symbol: '٢', titleAr: 'ثم', detailAr: 'جَلَسَتْ لِتَأْكُلَ' },
        ],
        relationAr: ageYears < 6 ? 'نتذكر ترتيب ما سمعناه.' : 'كلمة «ثم» توضّح ترتيب الأحداث في النص.',
      };
      return {
        kind: 'story',
        frames: [
          { symbol: '❄️', titleAr: 'السبب', detailAr: 'شَعَرَ خَالِدٌ بِالْبَرْدِ' },
          { symbol: '🧥', titleAr: 'النتيجة', detailAr: 'لَبِسَ مِعْطَفَهُ' },
        ],
        relationAr: ageYears < 6 ? 'نسأل: لماذا لبس خالد معطفه؟' : 'نربط الحدث بالسبب الذي يوضحه النص.',
      };
    case 'morphology':
      if (level === 1) return {
        kind: 'story',
        frames: [
          { symbol: 'كَتَبَ', titleAr: 'الكلمة الأولى', detailAr: 'فعل يدل على الكتابة' },
          { symbol: 'كِتَابٌ', titleAr: 'الكلمة الثانية', detailAr: 'شيء نقرأه' },
          { symbol: 'ك ت ب', titleAr: 'الحروف المشتركة', detailAr: 'كاف، تاء، باء' },
        ],
        relationAr: 'كَتَبَ وكِتَابٌ من عائلة واحدة، ومعناهما مرتبط بالكتابة.',
      };
      if (level === 2) return {
        kind: 'story',
        frames: [
          { symbol: 'سَمِعَ', titleAr: 'الفعل', detailAr: 'وصل الصوت إلى الأذن' },
          { symbol: 'سَامِعٌ', titleAr: 'اسم الفاعل', detailAr: 'الشخص الذي يسمع' },
          { symbol: 'س م ع', titleAr: 'الجذر', detailAr: 'سين، ميم، عين' },
        ],
        relationAr: 'تغيّر شكل الكلمة، وبقي الجذر والمعنى مرتبطين بالسمع.',
      };
      return {
        kind: 'story',
        frames: [
          { symbol: 'كَتَبَ', titleAr: 'الفعل', detailAr: 'قام بالكتابة' },
          { symbol: 'كَاتِبٌ', titleAr: 'اسم الفاعل', detailAr: 'من يكتب' },
          { symbol: 'مَكْتُوبٌ', titleAr: 'اسم المفعول', detailAr: 'ما كُتِبَ' },
        ],
        relationAr: 'الصيغ الثلاث تشترك في الجذر ك، ت، ب، ولكل صيغة معنى مختلف.',
      };
    default:
      return undefined;
  }
}

/** A second worked example ensures that the child sees the rule applied beyond one word or sentence. */
function structuredSecondModel(skill: SkillId, level: Level, ageYears: number): LessonStep {
  if (skill === 'decoding') {
    if (level === 1) return storyModel(
      'مثال آخر: عَسَلٌ. أقرأ العين والسين واللام مع حركاتها، ثم أجمع الأصوات.',
      'مِثَالٌ آخَرُ: عَسَلٌ. أَقْرَأُ الْعَيْنَ وَالسِّينَ وَاللَّامَ مَعَ حَرَكَاتِهَا، ثُمَّ أَجْمَعُ الْأَصْوَاتَ.',
      [
        { symbol: 'عَ', titleAr: 'الصوت الأول', detailAr: 'عين مع فتحة' },
        { symbol: 'سَ', titleAr: 'الصوت الثاني', detailAr: 'سين مع فتحة' },
        { symbol: 'لٌ', titleAr: 'الصوت الأخير', detailAr: 'لام في آخر الكلمة' },
      ],
      'عَ + سَ + لٌ = عَسَلٌ.'
    );
    if (level === 2) return storyModel(
      'مثال آخر: نَخْلَةٌ. ألاحظ الخاء الساكنة، وأقرأ التاء المربوطة في النهاية.',
      'مِثَالٌ آخَرُ: نَخْلَةٌ. أُلَاحِظُ الْخَاءَ السَّاكِنَةَ، وَأَقْرَأُ التَّاءَ الْمَرْبُوطَةَ فِي النِّهَايَةِ.',
      [
        { symbol: 'نَخْ', titleAr: 'المقطع الأول', detailAr: 'نون مفتوحة وخاء ساكنة' },
        { symbol: 'لَةٌ', titleAr: 'المقطع الثاني', detailAr: 'لام وتاء مربوطة' },
        { symbol: 'نَخْلَةٌ', titleAr: 'الكلمة كاملة', detailAr: 'أصل المقطعين بالترتيب' },
      ],
      'نَخْ + لَةٌ = نَخْلَةٌ.'
    );
    return storyModel(
      'مثال آخر: مِسْطَرَةٌ. أقرأ المقاطع بالترتيب، وأنتبه إلى السكون والتاء المربوطة.',
      'مِثَالٌ آخَرُ: مِسْطَرَةٌ. أَقْرَأُ الْمَقَاطِعَ بِالتَّرْتِيبِ، وَأَنْتَبِهُ إِلَى السُّكُونِ وَالتَّاءِ الْمَرْبُوطَةِ.',
      [
        { symbol: 'مِسْ', titleAr: 'المقطع الأول', detailAr: 'ميم مكسورة وسين ساكنة' },
        { symbol: 'طَ', titleAr: 'المقطع الثاني', detailAr: 'طاء مفتوحة' },
        { symbol: 'رَةٌ', titleAr: 'المقطع الأخير', detailAr: 'راء وتاء مربوطة' },
      ],
      'مِسْ + طَ + رَةٌ = مِسْطَرَةٌ.'
    );
  }

  if (skill === 'spelling') {
    if (level === 1) return storyModel(
      'مثال آخر: عَسَل. أكتب العين ثم السين ثم اللام؛ الحركات لا تتحول إلى حروف مد.',
      'مِثَالٌ آخَرُ: عَسَلٌ. أَكْتُبُ الْعَيْنَ، ثُمَّ السِّينَ، ثُمَّ اللَّامَ. الْحَرَكَاتُ لَا تَتَحَوَّلُ إِلَى حُرُوفِ مَدٍّ.',
      [
        { symbol: 'ع', titleAr: 'الحرف الأول', detailAr: 'عين' },
        { symbol: 'س', titleAr: 'الحرف الثاني', detailAr: 'سين' },
        { symbol: 'ل', titleAr: 'الحرف الأخير', detailAr: 'لام' },
      ],
      'ع + س + ل = عَسَل.'
    );
    if (level === 2) return storyModel(
      'مثال آخر: حَلِيب. أسمع المد الطويل بالياء، فأكتب الياء في مكانها.',
      'مِثَالٌ آخَرُ: حَلِيبٌ. أَسْمَعُ الْمَدَّ الطَّوِيلَ بِالْيَاءِ، فَأَكْتُبُ الْيَاءَ فِي مَكَانِهَا.',
      [
        { symbol: 'حَ', titleAr: 'البداية', detailAr: 'حاء مع فتحة' },
        { symbol: 'لِي', titleAr: 'المد', detailAr: 'ياء تمد صوت الكسرة' },
        { symbol: 'ب', titleAr: 'النهاية', detailAr: 'باء' },
      ],
      'حَ + لِي + ب = حَلِيب.'
    );
    return storyModel(
      'مثال آخر: وَجْهٌ. تنتهي الكلمة بهاء «ه»، أما «هُدَى» فتنتهي بألف مقصورة «ى».',
      'مِثَالٌ آخَرُ: وَجْهٌ. تَنْتَهِي الْكَلِمَةُ بِهَاءٍ، أَمَّا هُدَى فَتَنْتَهِي بِأَلِفٍ مَقْصُورَةٍ.',
      [
        { symbol: 'وَجْه', titleAr: 'هاء في النهاية', detailAr: 'الحرف الأخير ه' },
        { symbol: 'هُدَى', titleAr: 'ألف مقصورة', detailAr: 'الحرف الأخير ى' },
        { symbol: 'شَجَرَة', titleAr: 'تاء مربوطة', detailAr: 'الحرف الأخير ة' },
      ],
      'نراجع شكل الحرف الأخير في الكلمة كاملة، ولا نعتمد على الصوت وحده.'
    );
  }

  if (skill === 'comprehension') {
    if (level === 1) return ageYears < 6
      ? storyModel(
          'مثال آخر: رَسَمَ عُمَرُ شَمْسًا. عندما نسأل: ماذا رسم عمر؟ نجيب: شمسًا.',
          'مِثَالٌ آخَرُ: رَسَمَ عُمَرُ شَمْسًا. مَاذَا رَسَمَ عُمَرُ؟ رَسَمَ شَمْسًا.',
          [
            { symbol: '👦', titleAr: 'من؟', detailAr: 'عُمَر' },
            { symbol: '🖍️', titleAr: 'ماذا فعل؟', detailAr: 'رَسَمَ' },
            { symbol: '☀️', titleAr: 'ماذا رسم؟', detailAr: 'شَمْسًا' },
          ],
          'نستمع إلى الجملة ثم نجيب من المعلومة التي سمعناها.'
        )
      : storyModel(
          'مثال آخر: رَسَمَ عُمَرُ شَمْسًا. السؤال: ماذا رسم عمر؟ أعود إلى الجملة وأجد «شمسًا».',
          'مِثَالٌ آخَرُ: رَسَمَ عُمَرُ شَمْسًا. السُّؤَالُ: مَاذَا رَسَمَ عُمَرُ؟ أَعُودُ إِلَى الْجُمْلَةِ وَأَجِدُ: شَمْسًا.',
          [
            { symbol: 'رَسَمَ', titleAr: 'الفعل', detailAr: 'ماذا فعل عمر؟' },
            { symbol: 'عُمَر', titleAr: 'الشخص', detailAr: 'من قام بالفعل؟' },
            { symbol: 'شَمْسًا', titleAr: 'الإجابة', detailAr: 'ماذا رسم؟' },
          ],
          'الإجابة مذكورة بوضوح في الجملة.'
        );
    if (level === 2) return ageYears < 6
      ? storyModel(
          'مثال آخر: لَبِسَ عُمَرُ حِذَاءَهُ، ثُمَّ خَرَجَ. لبس الحذاء حدث أولًا.',
          'مِثَالٌ آخَرُ: لَبِسَ عُمَرُ حِذَاءَهُ، ثُمَّ خَرَجَ. مَاذَا فَعَلَ أَوَّلًا؟ لَبِسَ حِذَاءَهُ.',
          [
            { symbol: '👟', titleAr: 'أولًا', detailAr: 'لَبِسَ حِذَاءَهُ' },
            { symbol: '🚪', titleAr: 'ثم', detailAr: 'خَرَجَ' },
          ],
          'كلمة «ثم» تخبرنا بترتيب الحدثين.'
        )
      : storyModel(
          'مثال آخر: زَرَعَتْ سَارَةُ بَذْرَةً، ثُمَّ سَقَتْهَا. الزراعة حدثت قبل السقي.',
          'مِثَالٌ آخَرُ: زَرَعَتْ سَارَةُ بَذْرَةً، ثُمَّ سَقَتْهَا. الزِّرَاعَةُ حَدَثَتْ قَبْلَ السَّقْيِ.',
          [
            { symbol: '🌱', titleAr: 'أولًا', detailAr: 'زَرَعَتْ بَذْرَةً' },
            { symbol: '💧', titleAr: 'ثم', detailAr: 'سَقَتْهَا' },
          ],
          'كلمة «ثم» تدل على أن السقي جاء بعد الزراعة.'
        );
    return ageYears < 6
      ? storyModel(
          'مثال آخر: التربة جافة والنبتة ذابلة، ثم سقاها عادل. نفهم أنها كانت تحتاج إلى الماء.',
          'مِثَالٌ آخَرُ: التُّرْبَةُ جَافَّةٌ وَالنَّبْتَةُ ذَابِلَةٌ، ثُمَّ سَقَاهَا عَادِلٌ. نَفْهَمُ أَنَّهَا كَانَتْ تَحْتَاجُ إِلَى الْمَاءِ.',
          [
            { symbol: '🏜️', titleAr: 'قرينة أولى', detailAr: 'التربة جافة' },
            { symbol: '🥀', titleAr: 'قرينة ثانية', detailAr: 'النبتة ذابلة' },
            { symbol: '💧', titleAr: 'ما فعله عادل', detailAr: 'سقاها بالماء' },
          ],
          'نجمع القرائن حتى نفهم ما لا تقوله الجملة مباشرة.'
        )
      : storyModel(
          'مثال آخر: كانت التربة جافة والنبتة ذابلة، فسقاها عادل. نستنتج أن النبتة كانت تحتاج إلى الماء.',
          'مِثَالٌ آخَرُ: كَانَتِ التُّرْبَةُ جَافَّةً وَالنَّبْتَةُ ذَابِلَةً، فَسَقَاهَا عَادِلٌ. نَسْتَنْتِجُ أَنَّ النَّبْتَةَ كَانَتْ تَحْتَاجُ إِلَى الْمَاءِ.',
          [
            { symbol: '🌱', titleAr: 'القرينة الأولى', detailAr: 'التربة جافة' },
            { symbol: '🥀', titleAr: 'القرينة الثانية', detailAr: 'النبتة ذابلة' },
            { symbol: '💧', titleAr: 'النتيجة', detailAr: 'سقاها عادل' },
          ],
          'الاستنتاج يعتمد على أكثر من معلومة، وليس على التخمين.'
        );
  }

  if (skill === 'morphology') {
    if (level === 1) return storyModel(
      'مثال آخر: لَعِبَ ولُعْبَةٌ. تشترك الكلمتان في الجذر ل، ع، ب، ويرتبط معناهما باللعب.',
      'مِثَالٌ آخَرُ: لَعِبَ وَلُعْبَةٌ. تَشْتَرِكُ الْكَلِمَتَانِ فِي الْجَذْرِ لَام، عَيْن، بَاء، وَيَرْتَبِطُ مَعْنَاهُمَا بِاللَّعِبِ.',
      [
        { symbol: 'لَعِبَ', titleAr: 'فعل', detailAr: 'قام باللعب' },
        { symbol: 'لُعْبَة', titleAr: 'اسم', detailAr: 'شيء نلعب به' },
        { symbol: 'ل ع ب', titleAr: 'الجذر', detailAr: 'الحروف الأصلية' },
      ],
      'نبحث عن الحروف الأصلية وعن العلاقة في المعنى معًا.'
    );
    if (level === 2) return storyModel(
      'مثال آخر: لَعِبَ ومَلْعَب. «مَلْعَب» اسم مكان؛ أي المكان الذي نلعب فيه.',
      'مِثَالٌ آخَرُ: لَعِبَ وَمَلْعَبٌ. مَلْعَبٌ اسْمُ مَكَانٍ؛ أَيْ مَكَانٌ نَلْعَبُ فِيهِ.',
      [
        { symbol: 'لَعِبَ', titleAr: 'الفعل', detailAr: 'قام باللعب' },
        { symbol: 'مَلْعَب', titleAr: 'اسم المكان', detailAr: 'مكان اللعب' },
        { symbol: 'ل ع ب', titleAr: 'الجذر', detailAr: 'الحروف الأصلية' },
      ],
      'تغيرت صيغة الكلمة، وبقي الجذر والمعنى مرتبطين.'
    );
    return storyModel(
      'مثال آخر: فَتَحَ وفَاتِح ومَفْتُوح. الفاتح قام بالفعل، والمفتوح وقع عليه الفعل.',
      'مِثَالٌ آخَرُ: فَتَحَ وَفَاتِحٌ وَمَفْتُوحٌ. الْفَاتِحُ قَامَ بِالْفِعْلِ، وَالْمَفْتُوحُ وَقَعَ عَلَيْهِ الْفِعْلُ.',
      [
        { symbol: 'فَتَحَ', titleAr: 'الفعل', detailAr: 'حدث الفتح' },
        { symbol: 'فَاتِح', titleAr: 'اسم الفاعل', detailAr: 'من قام بالفتح' },
        { symbol: 'مَفْتُوح', titleAr: 'اسم المفعول', detailAr: 'ما وقع عليه الفتح' },
      ],
      'الجذر واحد، لكن الصيغة تغيّر المعنى والدور في الجملة.'
    );
  }
  throw new Error('No second worked model for ' + skill + '/L' + level);
}

function structuredLessonTitle(skill: SkillId, level: Level): string {
  const titles: Partial<Record<SkillId, Record<Level, string>>> = {
    decoding: { 1: 'نقرأ الحروف والحركات', 2: 'نقرأ السكون ونهاية الكلمة', 3: 'نجمع المقاطع والمدود' },
    spelling: { 1: 'نكتب الحروف بالترتيب', 2: 'نكتب حروف المدّ', 3: 'نميز نهايات الكلمات' },
    comprehension: { 1: 'نبحث عن المعلومة', 2: 'نرتب الأحداث', 3: 'نستنتج من القرائن' },
    morphology: { 1: 'نكتشف عائلة الكلمة', 2: 'نتعرف إلى المشتقات', 3: 'نقارن الفاعل والمفعول' },
  };
  return titles[skill]?.[level] ?? skill;
}

/** The lesson for one skill level. Targets (from oral reading) choose the pair or letters shown. */
export function lessonFor(skill: SkillId, level: Level, targets?: TrainingTargets, ageYears = 8): Lesson | null {
  const key = `${skill}:${level}`;
  switch (skill) {
    case 'rhyme': {
      if (level === 1) {
        return {
          key, skill, level, titleAr: 'نسمع النهايات المتشابهة',
          steps: [
            { textAr: 'نسمع آخر الكلمة. إذا تشابه آخر كلمتين فبينهما قافية.', audio: say('نَسْمَعُ آخِرَ الْكَلِمَةِ. إِذَا تَشَابَهَ آخِرُ كَلِمَتَيْنِ فَبَيْنَهُمَا قَافِيَةٌ.') },
            pictureModel(['door', 'book'], '«بَاب» و«كِتَاب»: نسمع النهاية «ـاب» في الكلمتين.', 'بَابٌ، كِتَابٌ. نَسْمَعُ النِّهَايَةَ نَفْسَهَا.'),
            pictureModel(['sun', 'moon'], '«شَمْس» لا تنتهي مثل «قَمَر».', 'شَمْسٌ لَا تَنْتَهِي مِثْلَ قَمَرٍ.'),
            pictureModel(['cat', 'duck'], '«قِطَّة» و«بَطَّة» مثال آخر لنهاية متشابهة.', 'قِطَّةٌ، بَطَّةٌ. نُنْصِتُ إِلَى النِّهَايَةِ فِي الْكَلِمَتَيْنِ.'),
            closing('الآن دورك: اسمع الكلمة وابحث عن صورة تنتهي مثلها.', 'الْآنَ دَوْرُكَ: اِسْمَعِ الْكَلِمَةَ وَابْحَثْ عَنْ صُورَةٍ تَنْتَهِي مِثْلَهَا.'),
          ],
        };
      }
      if (level === 2) {
        return {
          key, skill, level, titleAr: 'نقارن نهاية كلمات مختلفة',
          steps: [
            { textAr: 'قد تختلف بداية الكلمتين، لكننا نبحث عن النهاية المتشابهة.', audio: say('قَدْ تَخْتَلِفُ بِدَايَةُ الْكَلِمَتَيْنِ، لَكِنَّنَا نَبْحَثُ عَنِ النِّهَايَةِ الْمُتَشَابِهَةِ.') },
            pictureModel(['camel', 'honey'], '«جَمَل» و«عَسَل»: يتشابه الجزء الأخير المسموع.', 'جَمَلٌ، عَسَلٌ. نَنْتَبِهُ إِلَى الْجُزْءِ الْأَخِيرِ.'),
            pictureModel(['moon', 'camel', 'honey'], '«قَمَر» لا يشاركهما النهاية نفسها.', 'قَمَرٌ لَا يَنْتَهِي مِثْلَ جَمَلٍ وَعَسَلٍ.'),
            pictureModel(['pen', 'flag'], '«قَلَم» و«عَلَم» مثال آخر؛ نسمع «لَم» في النهاية.', 'قَلَمٌ، عَلَمٌ. نَسْمَعُ «لَمْ» فِي آخِرِ الْكَلِمَتَيْنِ.'),
            closing('الآن دورك: قارن نهاية الكلمة بين ثلاث صور.', 'الْآنَ دَوْرُكَ: قَارِنْ نِهَايَةَ الْكَلِمَةِ بَيْنَ ثَلَاثِ صُوَرٍ.'),
          ],
        };
      }
      return {
        key, skill, level, titleAr: 'نختار القافية بين أربع كلمات',
        steps: [
          { textAr: 'قد تطول الكلمة، لكننا نبحث عن آخر جزء مسموع، لا عن أول حرف.', audio: say('قَدْ تَطُولُ الْكَلِمَةُ، لَكِنَّنَا نَبْحَثُ عَنْ آخِرِ جُزْءٍ مَسْمُوعٍ، لَا عَنْ أَوَّلِ حَرْفٍ.') },
          pictureModel(['moon', 'rain'], '«قَمَر» و«مَطَر»: يتشابه الجزء الأخير المسموع.', 'قَمَرٌ، مَطَرٌ. نَسْمَعُ النِّهَايَةَ الْمُتَشَابِهَةَ.'),
          pictureModel(['moon', 'sun', 'rain', 'pen'], '«شَمْس» و«قَلَم» لا تنتهيان مثل «قَمَر».', 'شَمْسٌ وَقَلَمٌ لَا يَنْتَهِيَانِ مِثْلَ قَمَرٍ.'),
          pictureModel(['dog', 'heart'], '«كَلْب» و«قَلْب» مثال آخر لنهاية متشابهة.', 'كَلْبٌ، قَلْبٌ. نُقَارِنُ النِّهَايَةَ وَلَا نَنْظُرُ إِلَى الْبِدَايَةِ.'),
          closing('الآن دورك: استمع إلى الكلمة، ثم اختر القافية من أربع صور.', 'الْآنَ دَوْرُكَ: اسْتَمِعْ إِلَى الْكَلِمَةِ، ثُمَّ اخْتَرِ الْقَافِيَةَ مِنْ أَرْبَعِ صُوَرٍ.'),
        ],
      };
    }
    case 'soundPosition': {
      if (level === 1) {
        return {
          key, skill, level, titleAr: 'نسمع أول صوت في الكلمة',
          steps: [
            { textAr: 'نقول الكلمة ببطء، وننتبه إلى أول صوت نسمعه.', audio: say('نَقُولُ الْكَلِمَةَ بِبُطْءٍ، وَنَنْتَبِهُ إِلَى أَوَّلِ صَوْتٍ نَسْمَعُهُ.') },
            pictureModel(['fish', 'car'], '«سَمَكَة» و«سَيَّارَة» تبدآن بصوت «س».', 'سَمَكَةٌ، سَيَّارَةٌ. أَوَّلُ صَوْتٍ فِيهِمَا سَ.'),
            pictureModel(['bee', 'banana'], '«نَحْلَة» تبدأ بالنون، و«مَوْز» يبدأ بالميم.', 'نَحْلَةٌ تَبْدَأُ بِالنُّونِ، وَمَوْزٌ يَبْدَأُ بِالْمِيمِ.'),
            pictureModel(['fish', 'moon'], '«قَمَر» لا يبدأ بصوت «س».', 'قَمَرٌ لَا يَبْدَأُ بِصَوْتِ سَ.'),
            closing('الآن دورك: اسمع الكلمة، ثم ابحث عن صورة تبدأ بالصوت نفسه.', 'الْآنَ دَوْرُكَ: اسْمَعِ الْكَلِمَةَ، ثُمَّ ابْحَثْ عَنْ صُورَةٍ تَبْدَأُ بِالصَّوْتِ نَفْسِهِ.'),
          ],
        };
      }
      if (level === 2) {
        const [a, b] = (targets?.soundPairs ?? []).find(([x, y]) => PAIR_CUES[pairKey(x, y)]) ?? CONFUSABLE_PHONEME_PAIRS[1];
        const cue = PAIR_CUES[pairKey(a, b)];
        return {
          key, skill, level, titleAr: 'ننتبه إلى أول صوت في الكلمات',
          steps: [
            { textAr: 'قد يتقارب صوتان، لذلك ننصت إلى بداية الكلمة ولا نعتمد على تخمين الصورة.', audio: say('قَدْ يَتَقَارَبُ صَوْتَانِ، لِذَلِكَ نُنْصِتُ إِلَى بِدَايَةِ الْكَلِمَةِ وَلَا نَعْتَمِدُ عَلَى تَخْمِينِ الصُّورَةِ.') },
            glyphModel([`${a}َ`, `${b}َ`], `نقارن ${a}َ و${b}َ؛ نركز على أول صوت.`, `نَسْمَعُ ${a}َ، ثُمَّ ${b}َ. ${cue?.audio ?? 'نُنْصِتُ إِلَى الْفَرْقِ بَيْنَ الصَّوْتَيْنِ.'}`),
            pictureModel(['fish', 'car'], '«سَمَكَة» و«سَيَّارَة» تبدآن بالصوت نفسه: س.', 'سَمَكَةٌ، سَيَّارَةٌ. أَوَّلُ صَوْتٍ فِيهِمَا سَ.'),
            pictureModel(['dog', 'ball'], '«كَلْب» و«كُرَة» تبدآن بالصوت نفسه: ك.', 'كَلْبٌ، كُرَةٌ. أَوَّلُ صَوْتٍ فِيهِمَا كَ.'),
            pictureModel(['bee', 'banana'], '«نَحْلَة» و«مَوْز» لا تبدآن بالصوت نفسه.', 'نَحْلَةٌ، مَوْزٌ. أَوَّلُ صَوْتٍ فِيهِمَا مُخْتَلِفٌ.'),
            closing('الآن دورك: اسمع أول صوت، ثم اختر كلمة تبدأ به.', 'الْآنَ دَوْرُكَ: اسْمَعْ أَوَّلَ صَوْتٍ، ثُمَّ اخْتَرْ كَلِمَةً تَبْدَأُ بِهِ.'),
          ],
        };
      }
      return {
        key, skill, level, titleAr: 'نسمع آخر صوت في الكلمة',
        steps: [
          { textAr: 'هذه المرة لا نبحث عن البداية؛ ننتبه إلى آخر صوت في الكلمة.', audio: say('هَذِهِ الْمَرَّةَ لَا نَبْحَثُ عَنِ الْبِدَايَةِ؛ نَنْتَبِهُ إِلَى آخِرِ صَوْتٍ فِي الْكَلِمَةِ.') },
          pictureModel(['door', 'book'], '«بَاب» و«كِتَاب» تنتهيان بصوت «ب».', 'بَابٌ، كِتَابٌ. آخِرُ صَوْتٍ فِيهِمَا بَ.'),
          pictureModel(['dog', 'heart'], '«كَلْب» و«قَلْب» تنتهيان أيضًا بصوت «ب».', 'كَلْبٌ، قَلْبٌ. نَسْمَعُ الْبَاءَ فِي النِّهَايَةِ.'),
          pictureModel(['pen', 'sun'], '«قَلَم» ينتهي بالميم، لا بالباء.', 'قَلَمٌ يَنْتَهِي بِالْمِيمِ، وَلَيْسَ بِالْبَاءِ.'),
          closing('الآن دورك: قل الكلمة ببطء، واسمع آخر صوت فيها.', 'الْآنَ دَوْرُكَ: قُلِ الْكَلِمَةَ بِبُطْءٍ، وَاسْمَعْ آخِرَ صَوْتٍ فِيهَا.'),
        ],
      };
    }
    case 'blending': {
      if (level === 1) {
        return {
          key, skill, level,
          titleAr: 'نركّب مقطعين لنصنع كلمة',
          steps: [
            {
              textAr: 'نسمع الكلمة في مقطعين. نقول الأول، ثم الثاني، وبعدها نضمهما معًا.',
              audio: say('نَسْمَعُ الْكَلِمَةَ فِي مَقْطَعَيْنِ. نَقُولُ الْأَوَّلَ، ثُمَّ الثَّانِيَ، وَبَعْدَهَا نَضُمُّهُمَا مَعًا.'),
            },
            syllableExample('pen', 'نسمع المقطعين منفصلين، ثم نقولهما معًا.', 'اِسْمَعِ الْمَقْطَعَيْنِ، ثُمَّ قُلْهُمَا مَعًا.'),
            syllableExample('rain', 'نجرّب كلمة أخرى، ونحافظ على ترتيب المقطعين.', 'نُكَرِّرُ الطَّرِيقَةَ نَفْسَهَا، مَعَ تَرْتِيبِ الْمَقْطَعَيْنِ.'),
            syllableExample('moon', 'كل مقطع يأتي في مكانه؛ لا نبدّل الأول بالثاني.', 'نَسْمَعُ الْأَوَّلَ، ثُمَّ الثَّانِيَ، وَلَا نُبَدِّلُ مَكَانَهُمَا.'),
            closing('الآن دورك: اسمع مقطعين، ثم ركّبهما بالترتيب واختر الصورة.', 'الْآنَ دَوْرُكَ: اِسْمَعْ مَقْطَعَيْنِ، ثُمَّ رَكِّبْهُمَا بِالتَّرْتِيبِ وَاخْتَرِ الصُّورَةَ.'),
          ],
        };
      }

      if (level === 2) {
        return {
          key, skill, level,
          titleAr: 'نركّب ثلاثة أو أربعة مقاطع',
          steps: [
            {
              textAr: 'نسمع المقاطع واحدًا بعد الآخر، ثم نضمها بالترتيب من أول مقطع إلى آخر مقطع.',
              audio: say('نَسْمَعُ الْمَقَاطِعَ وَاحِدًا بَعْدَ الْآخَرِ، ثُمَّ نَضُمُّهَا بِالتَّرْتِيبِ مِنْ أَوَّلِ مَقْطَعٍ إِلَى آخِرِ مَقْطَعٍ.'),
            },
            syllableExample('fish', 'نبدأ بالمقطع الأول، ثم نضيف الثاني، ثم الثالث.', 'نَبْدَأُ بِالْمَقْطَعِ الْأَوَّلِ، ثُمَّ نُضِيفُ الثَّانِيَ، ثُمَّ الثَّالِثَ.'),
            syllableExample('apple', 'نحافظ على ترتيب المقاطع كما سمعناها.', 'نُحَافِظُ عَلَى تَرْتِيبِ الْمَقَاطِعِ كَمَا سَمِعْنَاهَا.'),
            syllableExample('orange', 'هذه الكلمة أطول؛ نصل المقاطع الأربعة بالترتيب نفسه.', 'هَذِهِ الْكَلِمَةُ أَطْوَلُ؛ نَصِلُ الْمَقَاطِعَ الْأَرْبَعَةَ بِالتَّرْتِيبِ نَفْسِهِ.'),
            {
              textAr: 'لا نقف طويلًا بين المقاطع؛ نقرّبها من بعضها حتى نسمع الكلمة كاملة.',
              audio: say('لَا نَقِفُ طَوِيلًا بَيْنَ الْمَقَاطِعِ؛ نُقَرِّبُهَا مِنْ بَعْضِهَا حَتَّى نَسْمَعَ الْكَلِمَةَ كَامِلَةً.'),
            },
            closing('الآن دورك: اسمع ثلاثة أو أربعة مقاطع، ثم ركّب الكلمة واختر صورتها.', 'الْآنَ دَوْرُكَ: اِسْمَعْ ثَلَاثَةَ أَوْ أَرْبَعَةَ مَقَاطِعَ، ثُمَّ رَكِّبِ الْكَلِمَةَ وَاخْتَرْ صُورَتَهَا.'),
          ],
        };
      }

      return {
        key, skill, level,
        titleAr: 'نعدّ مقاطع الكلمة',
        steps: [
          {
            textAr: 'نقول الكلمة ببطء. نصفّق مرة مع كل مقطع، ثم نعدّ التصفيقات.',
            audio: say('نَقُولُ الْكَلِمَةَ بِبُطْءٍ. نُصَفِّقُ مَرَّةً مَعَ كُلِّ مَقْطَعٍ، ثُمَّ نَعُدُّ التَّصْفِيقَاتِ.'),
          },
          syllableCountExample('pen', 'في «قَلَم» مقطعان؛ لذلك نصفّق مرتين.', 'مَقْطَعَانِ، وَتَصْفِيقَتَانِ.'),
          syllableCountExample('fish', 'في «سَمَكَة» ثلاثة مقاطع؛ لذلك نصفّق ثلاث مرات.', 'ثَلَاثَةُ مَقَاطِعَ، وَثَلَاثُ تَصْفِيقَاتٍ.'),
          syllableCountExample('orange', 'في «بُرْتُقَالَة» أربعة مقاطع؛ لذلك نصفّق أربع مرات.', 'أَرْبَعَةُ مَقَاطِعَ، وَأَرْبَعُ تَصْفِيقَاتٍ.'),
          {
            textAr: 'نعدّ أجزاء النطق التي نسمعها، لا عدد الحروف المكتوبة.',
            audio: say('نَعُدُّ أَجْزَاءَ النُّطْقِ الَّتِي نَسْمَعُهَا، لَا عَدَدَ الْحُرُوفِ الْمَكْتُوبَةِ.'),
          },
          closing('الآن دورك: قل الكلمة ببطء، وصفّق مع كل مقطع، ثم اختر العدد.', 'الْآنَ دَوْرُكَ: قُلِ الْكَلِمَةَ بِبُطْءٍ، وَصَفِّقْ مَعَ كُلِّ مَقْطَعٍ، ثُمَّ اخْتَرِ الْعَدَدَ.'),
        ],
      };
    }
    case 'discrimination': {
      const own = level === 1
        ? DISTANT_PHONEME_PAIRS[0]
        : (targets?.soundPairs ?? []).find(([x, y]) => PAIR_CUES[pairKey(x, y)]) ?? CONFUSABLE_PHONEME_PAIRS[1];
      const [a, b] = own;
      const cue = PAIR_CUES[pairKey(a, b)];
      if (level === 1) {
        const first = `${a}َ`;
        const second = `${b}َ`;
        return {
          key, skill, level, titleAr: 'نميّز الصوت نفسه من الصوت المختلف',
          steps: [
            { textAr: 'نستمع إلى الصوتين. إذا سمعنا الصوت نفسه مرتين نختار «نفسه»، وإذا تغيّر الحرف نختار «مختلف».', audio: say('نَسْتَمِعُ إِلَى الصَّوْتَيْنِ. إِذَا سَمِعْنَا الصَّوْتَ نَفْسَهُ مَرَّتَيْنِ نَخْتَارُ: نَفْسُهُ. وَإِذَا تَغَيَّرَ الْحَرْفُ نَخْتَارُ: مُخْتَلِفٌ.') },
            glyphModel([first, second], `مثال مختلف: ${first} ثم ${second}.`, `مِثَالٌ مُخْتَلِفٌ: ${first}، ثُمَّ ${second}. صَوْتَانِ مُخْتَلِفَانِ.`),
            glyphModel([first, first], `مثال متشابه: ${first} ثم ${first}.`, `مِثَالٌ مُتَشَابِهٌ: ${first}، ثُمَّ ${first}. الصَّوْتُ نَفْسُهُ.`),
            glyphModel(['سَ', 'لَ'], 'السين واللام صوتان مختلفان.', 'سَ، لَ. صَوْتَانِ مُخْتَلِفَانِ.'),
            closing('الآن دورك: اسمع الصوتين، ثم اختر: الصوت نفسه أم صوتان مختلفان؟', 'الْآنَ دَوْرُكَ: اسْمَعِ الصَّوْتَيْنِ، ثُمَّ اخْتَرْ: الصَّوْتُ نَفْسُهُ أَمْ صَوْتَانِ مُخْتَلِفَانِ؟'),
          ],
        };
      }
      if (level === 2) {
        const first = `${a}َ`;
        const second = `${b}َ`;
        return {
          key, skill, level, titleAr: `نميّز الصوتين ${a} و${b} مع الفتحة`,
          steps: [
            { textAr: 'بعض الحروف متقاربة في النطق. ننصت إلى الفرق في موضع اللسان أو تفخيم الصوت.', audio: say('بَعْضُ الْحُرُوفِ مُتَقَارِبَةٌ فِي النُّطْقِ. نُنْصِتُ إِلَى الْفَرْقِ فِي مَوْضِعِ اللِّسَانِ أَوْ تَفْخِيمِ الصَّوْتِ.') },
            glyphModel([first, second], `نقارن ${first} و${second} مع الفتحة نفسها.`, `نُقَارِنُ ${first} وَ${second} مَعَ الْفَتْحَةِ نَفْسِهَا. ${cue?.audio ?? 'نُنْصِتُ إِلَى الْفَرْقِ بَيْنَ الْحَرْفَيْنِ.'}`),
            glyphModel([first, first, second], 'إذا تكرر الصوت نفسه نسمعه مرتين، وإذا تغيّر الحرف نسمع صوتًا آخر.', `نَسْمَعُ ${first} مَرَّتَيْنِ، ثُمَّ ${second}. نَنْتَبِهُ إِلَى الْحَرْفِ الْأَوَّلِ.`),
            glyphModel(
              (a === 'ت' && b === 'ط') || (a === 'ط' && b === 'ت') ? ['سَ', 'صَ'] : ['تَ', 'طَ'],
              (a === 'ت' && b === 'ط') || (a === 'ط' && b === 'ت') ? 'السين صوت خفيف، والصاد صوت مفخّم.' : 'التاء صوت خفيف، والطاء صوت مفخّم.',
              (a === 'ت' && b === 'ط') || (a === 'ط' && b === 'ت') ? 'سَ صَوْتٌ خَفِيفٌ، وَصَ صَوْتٌ مُفَخَّمٌ.' : 'تَ صَوْتٌ خَفِيفٌ، وَطَ صَوْتٌ مُفَخَّمٌ.'
            ),
            closing('الآن دورك: اسمع جيدًا، ثم اختر هل الصوتان متشابهان أم مختلفان.', 'الْآنَ دَوْرُكَ: اسْمَعْ جَيِّدًا، ثُمَّ اخْتَرْ هَلِ الصَّوْتَانِ مُتَشَابِهَانِ أَمْ مُخْتَلِفَانِ.'),
          ],
        };
      }
      const first = cvSyllable(a, 'i');
      const second = cvSyllable(b, 'i');
      const firstU = cvSyllable(a, 'u');
      const secondU = cvSyllable(b, 'u');
      return {
        key, skill, level, titleAr: 'نميّز الأصوات المتقاربة مع المدّ',
        steps: [
          { textAr: 'نُبقي المدّ متشابهًا، وننصت إلى الحرف الذي يبدأ به المقطع.', audio: say('نُبْقِي الْمَدَّ مُتَشَابِهًا، وَنُنْصِتُ إِلَى الْحَرْفِ الَّذِي يَبْدَأُ بِهِ الْمَقْطَعُ.') },
          glyphModel([first, second], `نقارن ${first} و${second}؛ المدّ بالياء في الاثنين.`, `نُقَارِنُ ${first} وَ${second}. الْمَدُّ بِالْيَاءِ فِي الِاثْنَيْنِ، وَالْحَرْفُ الْأَوَّلُ مُخْتَلِفٌ.`),
          glyphModel([firstU, secondU], `نقارن ${firstU} و${secondU}؛ المدّ بالواو في الاثنين.`, `نُقَارِنُ ${firstU} وَ${secondU}. الْمَدُّ بِالْوَاوِ فِي الِاثْنَيْنِ.`),
          pictureModel(['dog', 'heart'], '«كَلْب» و«قَلْب» يختلفان في الصوت الأول؛ ننصت إلى البداية.', 'كَلْبٌ، قَلْبٌ. نُنْصِتُ إِلَى الْحَرْفِ الَّذِي يَبْدَأُ بِهِ كُلُّ اسْمٍ.'),
          pictureModel(['bee', 'palm'], '«نَحْلَة» و«نَخْلَة» مثال آخر؛ نقارن الصوت المسموع في الاسمين.', 'نَحْلَةٌ، نَخْلَةٌ. نُقَارِنُ الصَّوْتَ الْمَسْمُوعَ فِي الِاسْمَيْنِ.'),
          glyphModel(['سَ', 'صَ'], 'السين صوت خفيف، والصاد صوت مفخّم؛ نسمع الفرق في الحرف الأول.', 'سَ صَوْتٌ خَفِيفٌ، وَصَ صَوْتٌ مُفَخَّمٌ.'),
          closing('الآن دورك: اسمع المقطع كاملًا، ثم اختر الإجابة.', 'الْآنَ دَوْرُكَ: اسْمَعِ الْمَقْطَعَ كَامِلًا، ثُمَّ اخْتَرِ الْإِجَابَةَ.'),
        ],
      };
    }
    case 'letterSound': {
      const letters = LEVEL_LETTERS[level];
      const soundNotes = letters.map((l) => {
        const example = exampleFor(l);
        return example ? `مثل أول «${word(example)}»` : 'صوت الحرف';
      });
      const steps: LessonStep[] = [
        {
          textAr: level === 1
            ? 'أنظر إلى الحرف وأقول صوته القصير بالفتحة، لا اسم الحرف.'
            : level === 2
              ? 'نتعلم مجموعة جديدة من الحروف. لكل حرف شكل وصوت نسمعه.'
              : 'قد يبقى الحرف نفسه ويتغير صوته مع الفتحة والكسرة والضمة.',
          audio: say(
            level === 1
              ? 'أَنْظُرُ إِلَى الْحَرْفِ وَأَقُولُ صَوْتَهُ الْقَصِيرَ بِالْفَتْحَةِ، لَا اسْمَ الْحَرْفِ.'
              : level === 2
                ? 'نَتَعَلَّمُ مَجْمُوعَةً جَدِيدَةً مِنَ الْحُرُوفِ. لِكُلِّ حَرْفٍ شَكْلٌ وَصَوْتٌ نَسْمَعُهُ.'
                : 'قَدْ يَبْقَى الْحَرْفُ نَفْسُهُ وَيَتَغَيَّرُ صَوْتُهُ مَعَ الْفَتْحَةِ وَالْكَسْرَةِ وَالضَّمَّةِ.'
          ),
        },
        glyphModel(letters.slice(0, 3).map((l) => `${l}َ`), `المجموعة الأولى: ${letters.slice(0, 3).join('، ')}.`, 'نَسْمَعُ صَوْتَ كُلِّ حَرْفٍ مَعَ الْفَتْحَةِ.', soundNotes.slice(0, 3)),
        glyphModel(letters.slice(3).map((l) => `${l}َ`), `المجموعة الثانية: ${letters.slice(3).join('، ')}.`, 'نُكْمِلُ الْمَجْمُوعَةَ وَنَسْمَعُ صَوْتَ كُلِّ حَرْفٍ.', soundNotes.slice(3)),
      ];
      if (level === 3) {
        for (let i = 0; i < letters.length; i += 2) {
          const group = letters.slice(i, i + 2);
          const marked = group.flatMap((l) => [`${l}َ`, `${l}ِ`, `${l}ُ`]);
          steps.push(glyphModel(
            marked,
            `نسمع ${group.join('، ')} مع الفتحة والكسرة والضمة.`,
            'نَسْمَعُ الْحَرْفَ بِالْفَتْحَةِ، ثُمَّ بِالْكَسْرَةِ، ثُمَّ بِالضَّمَّةِ.',
            group.flatMap(() => ['فتحة', 'كسرة', 'ضمة'])
          ));
        }
      }
      steps.push(closing(
        level === 3 ? 'الآن دورك: اسمع صوت الحرف مع حركته، ثم اختر الحرف.' : 'الآن دورك: اسمع الصوت، واختر الحرف الذي يمثله.',
        level === 3 ? 'الْآنَ دَوْرُكَ: اسْمَعْ صَوْتَ الْحَرْفِ مَعَ حَرَكَتِهِ، ثُمَّ اخْتَرِ الْحَرْفَ.' : 'الْآنَ دَوْرُكَ: اسْمَعِ الصَّوْتَ، وَاخْتَرِ الْحَرْفَ الَّذِي يُمَثِّلُهُ.'
      ));
      return {
        key, skill, level,
        titleAr: level === 1 ? 'نربط الحرف بصوته' : level === 2 ? 'نتعلم أصوات مجموعة جديدة' : 'نميز الحركات الثلاث',
        steps,
      };
    }
    case 'visualDiscrimination': {
      const eligibleGroups = CONFUSABLE_LETTER_GROUPS.filter((g) => level === 1 || g.length >= 3);
      const ownGroup = eligibleGroups.find((g) => (targets?.letters ?? []).some((l) => g.includes(l)));
      const group = ownGroup ?? eligibleGroups[0];
      if (level === 1) {
        const otherGroup = eligibleGroups.find((g) => g !== group) ?? eligibleGroups[1];
        return {
          key, skill, level, titleAr: 'نلاحظ شكل الحرف والنقاط',
          steps: [
            { textAr: 'ننظر إلى جسم الحرف أولًا، ثم نعدّ النقاط ونلاحظ مكانها.', audio: say('نَنْظُرُ إِلَى جِسْمِ الْحَرْفِ أَوَّلًا، ثُمَّ نَعُدُّ النِّقَاطَ وَنُلَاحِظُ مَكَانَهَا.') },
            glyphModel(group, 'هذه حروف متقاربة في شكلها، لكن النقاط تميز كل حرف.', 'تَتَشَابَهُ بَعْضُ الْحُرُوفِ فِي الشَّكْلِ، وَتُمَيِّزُهَا النِّقَاطُ.', group.map((l) => LETTER_DOTS[l] ?? '')),
            glyphModel(otherGroup.slice(0, 3), 'نطبق الطريقة نفسها على مجموعة أخرى: ننظر إلى عدد النقاط ومكانها.', 'نُطَبِّقُ الطَّرِيقَةَ نَفْسَهَا: نَنْظُرُ إِلَى عَدَدِ النِّقَاطِ وَمَكَانِهَا.', otherGroup.slice(0, 3).map((l) => LETTER_DOTS[l] ?? '')),
            closing('الآن دورك: ابحث عن الحرف المطابق تمامًا، ولا تنسَ النقاط.', 'الْآنَ دَوْرُكَ: ابْحَثْ عَنِ الْحَرْفِ الْمُطَابِقِ تَمَامًا، وَلَا تَنْسَ النِّقَاطَ.'),
          ],
        };
      }
      if (level === 2) {
        const initialLetters = group;
        const initialForms = initialLetters.map((l) => `${l}ـ`);
        const examples = initialLetters.map((l, index) => {
          const id = exampleFor(l);
          return { symbol: initialForms[index], titleAr: id ? `أول كلمة ${word(id)}` : 'شكل الحرف في البداية', detailAr: LETTER_DOTS[l] ?? '' };
        });
        return {
          key, skill, level, titleAr: 'نلاحظ الحرف في أول الكلمة',
          steps: [
            { textAr: 'يتصل الحرف بما بعده في أول الكلمة، وقد يتغير شكله. نبحث عن النقاط أيضًا.', audio: say('يَتَّصِلُ الْحَرْفُ بِمَا بَعْدَهُ فِي أَوَّلِ الْكَلِمَةِ، وَقَدْ يَتَغَيَّرُ شَكْلُهُ. نَبْحَثُ عَنِ النِّقَاطِ أَيْضًا.') },
            glyphModel(initialForms, 'نقارن أشكال الحروف عندما تأتي في بداية الكلمة.', 'نُقَارِنُ أَشْكَالَ الْحُرُوفِ عِنْدَمَا تَأْتِي فِي بِدَايَةِ الْكَلِمَةِ.', initialLetters.map((l) => LETTER_DOTS[l] ?? '')),
            storyModel('انظر إلى أول حرف في كل كلمة، ثم لاحظ النقاط.', 'نَنْظُرُ إِلَى أَوَّلِ حَرْفٍ فِي كُلِّ كَلِمَةٍ، ثُمَّ نُلَاحِظُ النِّقَاطَ.', examples, 'شكل الحرف في البداية والنقاط يساعداننا على معرفة الحرف.'),
            closing('الآن دورك: طابق شكل الحرف في بداية الكلمة.', 'الْآنَ دَوْرُكَ: طَابِقْ شَكْلَ الْحَرْفِ فِي بِدَايَةِ الْكَلِمَةِ.'),
          ],
        };
      }
      return {
        key, skill, level, titleAr: 'نقارن الكلمات كاملة',
        steps: [
          { textAr: 'نقرأ شكل الكلمة من اليمين إلى اليسار، ونقارن الحروف واحدًا واحدًا.', audio: say('نَنْظُرُ إِلَى شَكْلِ الْكَلِمَةِ مِنَ الْيَمِينِ إِلَى الْيَسَارِ، وَنُقَارِنُ الْحُرُوفَ وَاحِدًا وَاحِدًا.') },
          glyphModel(['قَلَم', 'عَلَم'], '«قَلَم» و«عَلَم»: نلاحظ اختلاف الحرف الأول.', 'قَلَمٌ، عَلَمٌ. نُلَاحِظُ اخْتِلَافَ الْحَرْفِ الْأَوَّلِ.'),
          glyphModel(['بَاب', 'بَيْت'], '«بَاب» و«بَيْت»: البداية متشابهة، لكن بقية الحروف تختلف.', 'بَابٌ، بَيْتٌ. الْبِدَايَةُ مُتَشَابِهَةٌ، وَبَقِيَّةُ الْحُرُوفِ مُخْتَلِفَةٌ.'),
          closing('الآن دورك: ابحث عن الكلمة المطابقة حرفًا حرفًا.', 'الْآنَ دَوْرُكَ: ابْحَثْ عَنِ الْكَلِمَةِ الْمُطَابِقَةِ حَرْفًا حَرْفًا.'),
        ],
      };
    }
    case 'decoding':
    case 'spelling':
    case 'comprehension':
    case 'morphology': {
      const station = getStructuredLiteracyStations(ageYears).find((entry) => entry.id === skill);
      if (!station) return null;
      const copy = structuredLessonCopy(skill, level, ageYears);
      const modelVisual = stationModelVisual(skill, ageYears, level);
      const secondModel = structuredSecondModel(skill, level, ageYears);
      return {
        key, skill, level,
        titleAr: structuredLessonTitle(skill, level),
        steps: [
          { textAr: copy.teachAr, audio: say(copy.teachAudioAr) },
          { textAr: copy.modelAr, audio: say(copy.modelAudioAr), ...(modelVisual ? { visual: modelVisual } : {}) },
          secondModel,
          closing('الآن دورك: استخدم ما تعلّمته في مثال جديد، ثم فكّر في سبب اختيارك.', 'الْآنَ دَوْرُكَ: اسْتَخْدِمْ مَا تَعَلَّمْتَهُ فِي مِثَالٍ جَدِيدٍ، ثُمَّ فَكِّرْ فِي سَبَبِ اخْتِيَارِكَ.'),
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
  for (const age of [4, 8]) {
    for (const skill of skills) {
      for (const level of [1, 2, 3] as Level[]) {
        for (const t of [undefined, ...pairTargets, ...letterTargets, ...groupTargets]) {
          lessonFor(skill, level, t ?? undefined, age)?.steps.forEach((s) => addSegs(s.audio));
        }
      }
    }
  }
  Object.values(HINTS).forEach((h) => out.add(h));
  [
    'تَنْتَهِيَانِ بِالصَّوْتِ نَفْسِهِ.', 'تَبْدَأُ مِثْلَ:', 'تَنْتَهِي مِثْلَ:', 'مَعًا:', 'صَفِّقْ مَعِي.',
    'هَذَا هُوَ الْحَرْفُ الصَّحِيحُ، صَوْتُهُ:', 'هَذَا هُوَ الْحَرْفُ الصَّحِيحُ.', 'الصَّوْتُ نَفْسُهُ.', 'صَوْتَانِ مُخْتَلِفَانِ.',
    'هَذِهِ:', 'انْظُرْ إِلَى النِّقَاطِ جَيِّدًا.', 'حَاوِلْ مَرَّةً أُخْرَى.',
  ].forEach((p) => out.add(p));
  // Structured literacy stations share their explicit teaching and feedback language with BKT training.
  const stations = [...getStructuredLiteracyStations(4), ...getStructuredLiteracyStations(8)];
  for (const station of stations) {
    out.add(station.teachAudioAr);
    out.add(station.modelAudioAr);
    station.questions.forEach((question) => {
      question.audio.forEach((phrase) => out.add(phrase));
      question.explanationAudio.forEach((phrase) => out.add(phrase));
    });
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
