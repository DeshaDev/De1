/**
 * Transfer measure: does the child read better on words they never practised?
 *
 * The weekly progress probe measures the trained pre-reading skills. Improvement there does not show
 * that reading itself improved, or that it carries over to new material (the "transfer" question in
 * intervention research). This measure answers that question directly, with the child's own reading:
 * - two equivalent forms (A and B), each 8 real words and 8 made-up words, graded the same way;
 * - none of the words is used in the screening, the training items, the lessons or the story;
 * - the adult marks each word as the child reads aloud (no speech engine involved), so the result is
 *   independent of the automatic voice scoring and can also serve as a human reference for it;
 * - given at the start (sessions 1–2), the middle (10–12) and the end (19–20) of the programme.
 *   Forms are counterbalanced: half the children read A first and B at the end, half the reverse, so a
 *   difference in form difficulty averages out across a pilot group.
 *
 * Only for children from six (when reading is taught). The forms are candidates: equivalence of A and
 * B, and the lexical status of the made-up words in each dialect, are checked in the pilot
 * (docs/VALIDATION_PLAN_AR.md, docs/PILOT_PROTOCOL_AR.md).
 */
import { READING_MIN_AGE_MONTHS, type ReadItem, perMinute } from './readingTasks';
import type { TrainingProgress } from './training';

export type TransferForm = 'A' | 'B';
export type TransferPoint = 'pre' | 'mid' | 'post';

export interface TransferList {
  real: ReadItem[];
  nonword: ReadItem[];
}

const item = (id: string, text: string, level: ReadItem['level'], structureAr: string): ReadItem => ({ id, text, level, structureAr });

/** Slot by slot the two forms have the same syllable structure. */
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
  },
  B: {
    real: [
      item('tB-r1', 'بَحْر', 1, 'مقطع واحد بسكونين'),
      item('tB-r2', 'لَبَن', 1, 'مقطعان بحركات قصيرة'),
      item('tB-r3', 'قَمِيص', 2, 'مقطعان بمدّ'),
      item('tB-r4', 'مَكْتَب', 2, 'مقطعان بسكون وسط الكلمة'),
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
  },
};

/** Seconds without an attempt after which the adult marks the word wrong and moves on. */
export const TRANSFER_HESITATION_SEC = 5;

/** Sessions in which each measurement point can be given; a missed point is offered again within its window. */
export const TRANSFER_WINDOWS: Record<TransferPoint, [number, number]> = {
  pre: [1, 2],
  mid: [10, 12],
  post: [19, 20],
};

export interface TransferListScore {
  correct: number;
  total: number;
  /** Time from the first word shown to the last word marked. */
  ms: number;
}

export interface TransferRecord {
  point: TransferPoint;
  form: TransferForm;
  session: number;
  date: string;
  real: TransferListScore;
  nonword: TransferListScore;
}

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Counterbalanced: the first form is A for about half the children and B for the others. */
export function formFor(studentId: string, point: TransferPoint): TransferForm {
  const first: TransferForm = hash(studentId) % 2 === 0 ? 'A' : 'B';
  const second: TransferForm = first === 'A' ? 'B' : 'A';
  // Start and middle on the first form, end on the other: start-to-end change is not inflated by
  // having read the same words before; the middle point tracks the trend on familiar difficulty.
  return point === 'post' ? second : first;
}

/** The measurement point due in this session, if the child is old enough and has not done it yet. */
export function transferDueAt(progress: TrainingProgress, sessionNumber: number, ageMonths: number | null | undefined): TransferPoint | null {
  if (typeof ageMonths !== 'number' || ageMonths < READING_MIN_AGE_MONTHS) return null;
  const done = new Set((progress.transfer ?? []).map((r) => r.point));
  for (const point of ['pre', 'mid', 'post'] as TransferPoint[]) {
    const [from, to] = TRANSFER_WINDOWS[point];
    if (sessionNumber >= from && sessionNumber <= to && !done.has(point)) {
      // The end point is only meaningful with a start point to compare against.
      if (point !== 'pre' && !done.has('pre')) return null;
      return point;
    }
  }
  return null;
}

export function scoreTransferList(answers: Array<{ correct: boolean; rtMs: number }>): TransferListScore {
  return {
    correct: answers.filter((a) => a.correct).length,
    total: answers.length,
    ms: answers.reduce((sum, a) => sum + a.rtMs, 0),
  };
}

const pct = (s: TransferListScore) => (s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0);

export interface TransferSummary {
  pre: TransferRecord;
  latest: TransferRecord;
  /** Percentage-point change from the start, on untrained words. */
  realChange: number;
  nonwordChange: number;
  /** Correct words per minute at the start and now (real words). */
  realRate: [number, number];
  points: number;
}

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
    realRate: [perMinute(pre.real.correct, pre.real.ms), perMinute(latest.real.correct, latest.real.ms)],
    points: records.length,
  };
}

export const transferPercent = pct;
