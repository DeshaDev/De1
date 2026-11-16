/**
 * Transfer measure: can the child read unfamiliar words and a short unseen text?
 *
 * Three counterbalanced forms keep every measurement point (start, middle, end) fresh:
 * 8 real words, 8 pronounceable nonwords, and one short parallel passage per form.
 * Audio is assessed only by the server-side Azure pronunciation service. No adult marks
 * individual words; an incomplete or unresolved assessment is not scored.
 *
 * This is a descriptive, uncalibrated product measure, not an age-normed test or proof
 * of programme efficacy. Candidate nonwords and parallel passages still need pilot review
 * across Arabic dialects and reading backgrounds (see docs/ARABIC_CONTENT_REVIEW.md).
 */
import { READING_MIN_AGE_MONTHS, type ReadItem, perMinute } from './readingTasks';
import type { TrainingProgress } from './training';

export type TransferForm = 'A' | 'B' | 'C';
export type TransferPoint = 'pre' | 'mid' | 'post';
export type TransferTaskKind = 'real' | 'nonword' | 'passage';

export interface TransferPassage {
  id: string;
  titleAr: string;
  text: string;
  words: string[];
  /** Main content words reserved for the overlap audit (function words are intentionally excluded). */
  contentWords: string[];
}

export interface TransferList {
  real: ReadItem[];
  nonword: ReadItem[];
  passage: TransferPassage;
}

export interface TransferAudioTask {
  id: string;
  form: TransferForm;
  kind: TransferTaskKind;
  titleAr: string;
  instructionAr: string;
  displayText: string;
  words: string[];
}

const item = (id: string, text: string, level: ReadItem['level'], structureAr: string): ReadItem => ({ id, text, level, structureAr });

const passage = (form: TransferForm, text: string, contentWords: string[]): TransferPassage => {
  const clean = text.replace(/[،؛.!؟]/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    id: `transfer-${form}-passage`,
    titleAr: 'قصة قصيرة',
    text,
    words: clean.split(' '),
    contentWords,
  };
};

/** Each form follows the same progression: two items at each of four decoding levels. */
export const TRANSFER_FORMS: Record<TransferForm, TransferList> = {
  A: {
    real: [
      item('tA-r1', 'نَهْر', 1, 'مقطع واحد بسكونين'),
      item('tA-r2', 'بَصَل', 1, 'مقطعان بحركات قصيرة'),
      item('tA-r3', 'سَرِير', 2, 'مقطعان بمدّ'),
      item('tA-r4', 'دَفْتَر', 2, 'مقطعان بسكون وسط الكلمة'),
      item('tA-r5', 'غَيْمَة', 3, 'حرف لين وتاء مربوطة'),
      item('tA-r6', 'مِلْعَقَة', 3, 'ثلاثة مقاطع وتاء مربوطة'),
      item('tA-r7', 'حَقِيبَة', 4, 'مدّ وتاء مربوطة'),
      item('tA-r8', 'الشَّارِع', 4, 'لام شمسية وشدّة ومدّ'),
    ],
    nonword: [
      item('tA-n1', 'تَفْج', 1, 'مقطع واحد بسكونين'),
      item('tA-n2', 'شَدَم', 1, 'مقطعان بحركات قصيرة'),
      item('tA-n3', 'زُمَف', 2, 'مقطعان بحركات قصيرة'),
      item('tA-n4', 'سَانِك', 2, 'مدّ في المقطع الأول'),
      item('tA-n5', 'دَمِيك', 3, 'مدّ في المقطع الثاني'),
      item('tA-n6', 'مَشْفُوج', 3, 'وزن مَفْعُول'),
      item('tA-n7', 'سُبْدَال', 4, 'سكون ومدّ'),
      item('tA-n8', 'دَنْكَمَة', 4, 'ثلاثة مقاطع وتاء مربوطة'),
    ],
    passage: passage(
      'A',
      'فِي يَوْمِ الْعُطْلَةِ، ذَهَبَتْ نُورَةُ مَعَ خَالَتِهَا إِلَى الْحَدِيقَةِ. رَأَتْ أُرْجُوحَةً قُرْبَ شَجَرَةٍ كَبِيرَةٍ. جَلَسَتْ نُورَةُ عَلَيْهَا، وَدَفَعَتْهَا خَالَتُهَا بِرِفْقٍ. ضَحِكَتْ نُورَةُ حِينَ ارْتَفَعَتْ قَلِيلًا، ثُمَّ شَرِبَتَا الْمَاءَ وَعَادَتَا قَبْلَ الْغُرُوبِ.',
      ['أُرْجُوحَةً', 'بِرِفْقٍ', 'ارْتَفَعَتْ', 'الْغُرُوبِ']
    ),
  },
  B: {
    real: [
      item('tB-r1', 'بَحْر', 1, 'مقطع واحد بسكونين'),
      item('tB-r2', 'لَبَن', 1, 'مقطعان بحركات قصيرة'),
      item('tB-r3', 'قَمِيص', 2, 'مقطعان بمدّ'),
      item('tB-r4', 'مَطْبَخ', 2, 'مقطعان بسكون وسط الكلمة'),
      item('tB-r5', 'وَرْدَة', 3, 'سكون وتاء مربوطة'),
      item('tB-r6', 'مِكْنَسَة', 3, 'ثلاثة مقاطع وتاء مربوطة'),
      item('tB-r7', 'سَفِينَة', 4, 'مدّ وتاء مربوطة'),
      item('tB-r8', 'الصَّبَاح', 4, 'لام شمسية وشدّة ومدّ'),
    ],
    nonword: [
      item('tB-n1', 'زَفْج', 1, 'مقطع واحد بسكونين'),
      item('tB-n2', 'كَدَف', 1, 'مقطعان بحركات قصيرة'),
      item('tB-n3', 'مُنَس', 2, 'مقطعان بحركات قصيرة'),
      item('tB-n4', 'بَاتِف', 2, 'مدّ في المقطع الأول'),
      item('tB-n5', 'تَمِيف', 3, 'مدّ في المقطع الثاني'),
      item('tB-n6', 'مَفْجُول', 3, 'وزن مَفْعُول'),
      item('tB-n7', 'شُنْدَاف', 4, 'سكون ومدّ'),
      item('tB-n8', 'تَرْمَكَة', 4, 'ثلاثة مقاطع وتاء مربوطة'),
    ],
    passage: passage(
      'B',
      'بَعْدَ الْمَطَرِ، خَرَجَ سَامِرٌ إِلَى الْفِنَاءِ. رَأَى حَلَزُونًا صَغِيرًا قُرْبَ زَهْرَةٍ. لَمْ يَلْمَسْهُ، بَلْ وَضَعَ وَرَقَةً خَضْرَاءَ بِجَانِبِهِ. بَقِيَ سَامِرٌ يُرَاقِبُهُ حَتَّى تَحَرَّكَ بِبُطْءٍ نَحْوَ الْعُشْبِ. ثُمَّ أَخْبَرَ أُخْتَهُ بِمَا شَاهَدَ.',
      ['الْفِنَاءِ', 'حَلَزُونًا', 'بِبُطْءٍ', 'الْعُشْبِ']
    ),
  },
  C: {
    real: [
      item('tC-r1', 'مِلْح', 1, 'مقطع واحد بسكون في آخره'),
      item('tC-r2', 'جِسْر', 1, 'مقطع واحد بسكون وسط الكلمة'),
      item('tC-r3', 'صَدَفَة', 2, 'ثلاثة مقاطع قصيرة'),
      item('tC-r4', 'غَزَال', 2, 'مقطعان ومدّ'),
      item('tC-r5', 'بِئْر', 3, 'همزة ساكنة بعد كسرة'),
      item('tC-r6', 'خُوذَة', 3, 'مدّ وتاء مربوطة'),
      item('tC-r7', 'صُنْدُوق', 4, 'سكون في الوسط ومدّ في المقطع الأخير'),
      item('tC-r8', 'فُسْتَان', 4, 'مقطعان بسكون ومدّ'),
    ],
    nonword: [
      item('tC-n1', 'رَفْج', 1, 'مقطع واحد بسكونين'),
      item('tC-n2', 'تُسَم', 1, 'مقطعان بحركات قصيرة'),
      item('tC-n3', 'نُدَف', 2, 'مقطعان بحركات قصيرة'),
      item('tC-n4', 'كَانِب', 2, 'مدّ في المقطع الأول'),
      item('tC-n5', 'مَدِيك', 3, 'مدّ في المقطع الثاني'),
      item('tC-n6', 'مَشْفُوم', 3, 'سكون ومدّ'),
      item('tC-n7', 'زُنْدَاف', 4, 'سكون ومدّ'),
      item('tC-n8', 'فَرْبَمَة', 4, 'ثلاثة مقاطع وتاء مربوطة'),
    ],
    passage: passage(
      'C',
      'فِي الصَّبَاحِ، سَاعَدَتْ مَرْيَمُ جَدَّتَهَا فِي الْمَطْبَخِ. غَسَلَتْ حَبَّاتِ الْفَرَاوِلَةِ، وَوَضَعَتْهَا فِي طَبَقٍ وَاسِعٍ. أَضَافَتِ الْجَدَّةُ قَلِيلًا مِنَ اللَّبَنِ، ثُمَّ مَزَجَتْهُمَا بِمِلْعَقَةٍ. جَلَسَتَا تَتَنَاوَلَانِ الطَّعَامَ، وَشَكَرَتْ مَرْيَمُ جَدَّتَهَا عَلَى الْمُسَاعَدَةِ.',
      ['حَبَّاتِ', 'الْفَرَاوِلَةِ', 'مَزَجَتْهُمَا', 'تَتَنَاوَلَانِ']
    ),
  },
};

/** Server-side allow-list for transfer recordings. The browser sends IDs, never trusted reference text. */
export function getTransferAudioTask(taskId: unknown): TransferAudioTask | null {
  if (typeof taskId !== 'string') return null;
  const match = /^transfer-([ABC])-(real|nonword|passage)$/.exec(taskId);
  if (!match) return null;
  const form = match[1] as TransferForm;
  const kind = match[2] as TransferTaskKind;
  const list = TRANSFER_FORMS[form];
  if (kind === 'passage') {
    return {
      id: list.passage.id,
      form,
      kind,
      titleAr: list.passage.titleAr,
      instructionAr: 'اِقْرَأِ القِصَّةَ بِصَوْتٍ وَاضِحٍ، وَخُذْ وَقْتَكَ.',
      displayText: list.passage.text,
      words: [...list.passage.words],
    };
  }
  const items = list[kind];
  return {
    id: `transfer-${form}-${kind}`,
    form,
    kind,
    titleAr: kind === 'real' ? 'كلمات جديدة' : 'كلمات غير مألوفة',
    instructionAr: kind === 'real'
      ? 'اِقْرَأِ الكَلِمَاتِ وَاحِدَةً وَاحِدَةً، وَلَا تَسْتَعْجِلْ.'
      : 'حَاوِلْ قِرَاءَةَ هَذِهِ الكَلِمَاتِ كَمَا تَرَاهَا، حَتَّى إِنْ لَمْ تَعْرِفْ مَعْنَاهَا.',
    displayText: items.map((entry) => entry.text).join('   •   '),
    words: items.map((entry) => entry.text),
  };
}

export const TRANSFER_WINDOWS: Record<TransferPoint, [number, number]> = {
  pre: [1, 2],
  mid: [10, 12],
  post: [19, 20],
};

export interface TransferListScore {
  correct: number;
  total: number;
  /** Duration of the captured recording in milliseconds. */
  ms: number;
}

export interface TransferRecord {
  point: TransferPoint;
  form: TransferForm;
  session: number;
  date: string;
  real: TransferListScore;
  nonword: TransferListScore;
  /** Added in the audio-only implementation; absent in older records. */
  passage?: TransferListScore;
  /** Present only when all three parts were resolved by the server pronunciation service. */
  sourceModel?: 'azure_pronunciation_assessment';
  assessmentReceipts?: string[];
}

export function scoreVerifiedTransferAudio(
  words: Array<{ errorType: string; accuracyScore: number | null }>,
  durationSeconds: number
): TransferListScore | null {
  if (
    words.length < 2 ||
    words.length > 80 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 1 ||
    durationSeconds > 88 ||
    words.some((word) =>
      !['None', 'DialectVariant', 'Omission', 'Mispronunciation', 'Substitution'].includes(word.errorType) ||
      typeof word.accuracyScore !== 'number' ||
      !Number.isFinite(word.accuracyScore) ||
      word.accuracyScore < 0 ||
      word.accuracyScore > 100
    )
  ) return null;
  return {
    correct: words.filter((word) => word.errorType === 'None' || word.errorType === 'DialectVariant').length,
    total: words.length,
    ms: Math.round(durationSeconds * 1000),
  };
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

/** Rotate A→B→C (or B→C→A / C→A→B) so no child repeats a form at a measurement point. */
export function formFor(studentId: string, point: TransferPoint, programmeId = ''): TransferForm {
  const order: TransferForm[] = ['A', 'B', 'C'];
  // A new programme gets a new starting form; this reduces accidental reuse if a plan is rebuilt.
  const offset = hash(`${studentId}:${programmeId}`) % 3;
  const pointIndex: Record<TransferPoint, number> = { pre: 0, mid: 1, post: 2 };
  return order[(offset + pointIndex[point]) % order.length];
}

/** The measurement point due in this session, if the child is old enough and has not done it yet. */
export function transferDueAt(progress: TrainingProgress, sessionNumber: number, ageMonths: number | null | undefined): TransferPoint | null {
  if (typeof ageMonths !== 'number' || ageMonths < READING_MIN_AGE_MONTHS) return null;
  const done = new Set((progress.transfer ?? []).map((r) => r.point));
  for (const point of ['pre', 'mid', 'post'] as TransferPoint[]) {
    const [from, to] = TRANSFER_WINDOWS[point];
    if (sessionNumber >= from && sessionNumber <= to && !done.has(point)) {
      if (point !== 'pre' && !done.has('pre')) return null;
      return point;
    }
  }
  return null;
}

export interface TransferSummary {
  pre: TransferRecord;
  latest: TransferRecord;
  realChange: number;
  nonwordChange: number;
  passageChange: number | null;
  realRate: [number, number];
  points: number;
}

const pct = (s: TransferListScore) => (s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0);

export function summarizeTransfer(records: TransferRecord[]): TransferSummary | null {
  const pre = records.find((r) => r.point === 'pre');
  if (!pre) return null;
  const later = records.filter((r) => r.point !== 'pre');
  const latest = later.find((r) => r.point === 'post') ?? later.find((r) => r.point === 'mid') ?? pre;
  return {
    pre,
    latest,
    realChange: pct(latest.real) - pct(pre.real),
    nonwordChange: pct(latest.nonword) - pct(pre.nonword),
    passageChange: pre.passage && latest.passage ? pct(latest.passage) - pct(pre.passage) : null,
    realRate: [perMinute(pre.real.correct, pre.real.ms), perMinute(latest.real.correct, latest.real.ms)],
    points: records.length,
  };
}

export const transferPercent = pct;
