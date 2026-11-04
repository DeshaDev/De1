/**
 * Reading-error patterns from an oral reading checked by speech recognition.
 *
 * For each word the recogniser marked as misread, the letters of the target word are aligned with
 * the letters of what the child said (edit distance with back-trace), and each difference is
 * classified:
 * - visual confusion: letters with the same skeleton that differ only in dots (ب/ت/ث/ن/ي, ج/ح/خ ...);
 * - sound confusion: neighbouring Arabic sounds children commonly confuse (ت/ط, س/ص, ذ/ز ...);
 * - long-vowel error: a long vowel letter (ا و ي) added or dropped (كتاب ← كتب);
 * - whole-word substitution: too different to be a letter slip (a guess from context or the first letter).
 *
 * Limits, stated in the result and the report:
 * - The recogniser's text has no short-vowel marks, so short-vowel (حركات) errors cannot be judged here.
 * - One reading of one passage is a sample, not a diagnosis; patterns need repeating across readings.
 * - Dialect variants marked by the assessment are not counted as errors.
 */
import { CONFUSABLE_LETTER_GROUPS, CONFUSABLE_PHONEME_PAIRS } from '../cognitiveProfile/lexicon';
import type { SkillId } from '../cognitiveProfile/training';

export interface ReadWord {
  word: string;
  status: 'correct' | 'dialect_variant' | 'phonetic_substitution' | 'omitted' | 'unconfirmed';
  spokenWord?: string | null;
}

export type ConfusionKind = 'visual' | 'sound';

export interface LetterConfusion {
  pair: [string, string];
  kind: ConfusionKind;
  count: number;
  examples: Array<{ target: string; spoken: string }>;
}

export interface ReadingErrorProfile {
  analysedAt: string;
  passageId: string;
  wordsTotal: number;
  wordsMisread: number;
  omittedWords: string[];
  letterConfusions: LetterConfusion[];
  longVowelErrors: Array<{ target: string; spoken: string }>;
  wholeWordSubstitutions: Array<{ target: string; spoken: string }>;
  /** Misread or omitted words, for practice in the reader. */
  practiceWords: string[];
  recommendations: {
    skills: SkillId[];
    soundPairs: Array<[string, string]>;
    letters: string[];
    reasonsAr: string[];
  };
  limitsAr: string[];
}

const DIACRITICS = /[ً-ٰٟـ]/g;
const LONG_VOWELS = new Set(['ا', 'و', 'ي', 'ى']);

/** Letters only: no short vowels or tatweel; hamza seats and alef forms unified; ة as ه, ى as ي. */
export function lettersOf(word: string): string[] {
  return Array.from(
    word
      .replace(DIACRITICS, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[^ء-ي]/g, '')
  );
}

type Edit = { op: 'sub'; a: string; b: string } | { op: 'del'; a: string } | { op: 'ins'; b: string };

/** Minimal letter edits turning `a` into `b` (Levenshtein with back-trace). */
export function letterEdits(a: string[], b: string[]): Edit[] {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  const edits: Edit[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      if (a[i - 1] !== b[j - 1]) edits.push({ op: 'sub', a: a[i - 1], b: b[j - 1] });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      edits.push({ op: 'del', a: a[i - 1] });
      i--;
    } else {
      edits.push({ op: 'ins', b: b[j - 1] });
      j--;
    }
  }
  return edits.reverse();
}

const samePair = (p: [string, string], x: string, y: string) => (p[0] === x && p[1] === y) || (p[0] === y && p[1] === x);

export function classifyConfusion(x: string, y: string): ConfusionKind | null {
  if (CONFUSABLE_PHONEME_PAIRS.some((p) => samePair(p, x, y))) return 'sound';
  if (CONFUSABLE_LETTER_GROUPS.some((g) => g.includes(x) && g.includes(y))) return 'visual';
  return null;
}

const key = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

export function analyseReadingErrors(words: ReadWord[], passageId: string, now = new Date()): ReadingErrorProfile {
  const confusions = new Map<string, LetterConfusion>();
  const longVowelErrors: Array<{ target: string; spoken: string }> = [];
  const wholeWordSubstitutions: Array<{ target: string; spoken: string }> = [];
  const omittedWords: string[] = [];
  const practice = new Set<string>();

  for (const w of words) {
    if (w.status === 'omitted') {
      omittedWords.push(w.word);
      practice.add(w.word);
      continue;
    }
    if (w.status !== 'phonetic_substitution') continue;
    practice.add(w.word);
    const spoken = w.spokenWord?.trim();
    if (!spoken) continue;
    const target = lettersOf(w.word);
    const said = lettersOf(spoken);
    if (target.join('') === said.join('')) continue; // differs only in short vowels: not judged here
    const edits = letterEdits(target, said);
    // More than half the letters changed: a different word, not a letter slip.
    if (edits.length > Math.max(1, Math.floor(target.length / 2))) {
      wholeWordSubstitutions.push({ target: w.word, spoken });
      continue;
    }
    let vowelError = false;
    for (const e of edits) {
      if (e.op === 'sub') {
        const kind = classifyConfusion(e.a, e.b);
        if (kind) {
          const pair = key(e.a, e.b);
          const id = pair.join('|');
          const entry = confusions.get(id) ?? { pair, kind, count: 0, examples: [] };
          entry.count += 1;
          if (entry.examples.length < 3) entry.examples.push({ target: w.word, spoken });
          confusions.set(id, entry);
        } else if (LONG_VOWELS.has(e.a) || LONG_VOWELS.has(e.b)) {
          vowelError = true;
        }
      } else if ((e.op === 'del' && LONG_VOWELS.has(e.a)) || (e.op === 'ins' && LONG_VOWELS.has(e.b))) {
        vowelError = true;
      }
    }
    if (vowelError) longVowelErrors.push({ target: w.word, spoken });
  }

  const letterConfusions = [...confusions.values()].sort((a, b) => b.count - a.count);
  const soundPairs = letterConfusions
    .filter((c) => c.kind === 'sound')
    .map((c) => c.pair)
    .filter((p) => CONFUSABLE_PHONEME_PAIRS.some((q) => samePair(q, p[0], p[1])));
  const visualLetters = Array.from(new Set(letterConfusions.filter((c) => c.kind === 'visual').flatMap((c) => c.pair)));

  const skills: SkillId[] = [];
  const reasonsAr: string[] = [];
  if (soundPairs.length > 0) {
    skills.push('discrimination');
    reasonsAr.push(`خلط بين أصوات متقاربة (${soundPairs.map((p) => p.join('/')).join('، ')}): تمييز سمعي مركّز على هذه الأزواج.`);
  }
  if (visualLetters.length > 0) {
    skills.push('visualDiscrimination');
    reasonsAr.push(`خلط بين حروف متشابهة في الشكل (${visualLetters.join(' ')}): تمييز بصري للنقاط وشكل الحرف.`);
  }
  if (soundPairs.length > 0 || visualLetters.length > 0 || longVowelErrors.length > 0) {
    skills.push('letterSound');
    if (longVowelErrors.length > 0) reasonsAr.push('أخطاء في حروف المد (حذف أو زيادة ا و ي): ربط الحرف بصوته والحركات الطويلة.');
  }
  if (wholeWordSubstitutions.length + omittedWords.length >= 2) {
    reasonsAr.push('قراءة كلمات بكلمات أخرى أو حذفها: تدريب على الكلمات نفسها في القارئ الميسّر، كلمة كلمة.');
  }

  return {
    analysedAt: now.toISOString(),
    passageId,
    wordsTotal: words.length,
    wordsMisread: words.filter((w) => w.status === 'phonetic_substitution' || w.status === 'omitted').length,
    omittedWords,
    letterConfusions,
    longVowelErrors,
    wholeWordSubstitutions,
    practiceWords: [...practice].slice(0, 20),
    recommendations: { skills: Array.from(new Set(skills)), soundPairs, letters: [...new Set([...soundPairs.flat(), ...visualLetters])], reasonsAr },
    limitsAr: [
      'النص الذي يتعرّف عليه المحرك بلا تشكيل، فلا يمكن الحكم هنا على أخطاء الحركات القصيرة.',
      'قراءة نص واحد عيّنة صغيرة؛ يُعتمد النمط حين يتكرر في أكثر من قراءة. هذا تحليل تعليمي وليس تشخيصًا.',
      'ما صنّفه التقييم «تنوّعًا لهجيًا» لا يُحسب خطأً.',
    ],
  };
}
