const MAX_CHUNK_WORDS = 9;

/** Split a passage into short sentences: at sentence ends, then at commas when a sentence is long. */
export function chunkPassage(words: string[]): string[][] {
  const sentences: string[][] = [];
  let current: string[] = [];
  for (const w of words) {
    current.push(w);
    if (/[.!?؟]$/.test(w)) {
      sentences.push(current);
      current = [];
    }
  }
  if (current.length) sentences.push(current);

  const chunks: string[][] = [];
  for (const s of sentences) {
    if (s.length <= MAX_CHUNK_WORDS) {
      chunks.push(s);
      continue;
    }
    let part: string[] = [];
    for (const w of s) {
      part.push(w);
      if (/[،,؛]$/.test(w) && part.length >= 3) {
        chunks.push(part);
        part = [];
      }
    }
    if (part.length) chunks.push(part);
  }
  // Any chunk still too long is cut at the most natural point near its middle.
  return chunks.flatMap(function split(c: string[]): string[][] {
    if (c.length <= MAX_CHUNK_WORDS + 1) return [c];
    // Only split at a clear boundary (comma, or before a joining و/ف); otherwise keep the sentence whole.
    let best = Math.ceil(c.length / 2);
    let bestScore = -Infinity;
    for (let cut = 3; cut <= c.length - 3; cut++) {
      const before = bare(c[cut - 1]);
      const after = bare(c[cut]);
      let boundary = 0;
      let score = -Math.abs(cut - c.length / 2) * 0.5; // prefer the middle
      if (/[،,؛:]$/.test(c[cut - 1])) boundary += 4; // after a comma
      if (/^[وف]/.test(after) && after.length > 3 && !/^(وال|فال)/.test(after) && !/[ًٌٍ]ا?[.,،؛:!?؟]?$/.test(c[cut])) boundary += 3; // before "and / so" + verb
      if (PARTICLES.has(before)) boundary -= 10; // never leave a preposition hanging
      if (boundary <= 0) continue;
      score += boundary;
      if (/^[بل]ال/.test(after)) score -= 3; // keep "بالحيوان" with the word it completes
      if (/^(ال|لل)/.test(after) && !/^[وف]/.test(after) && !/[،,؛]$/.test(c[cut - 1])) score -= 1;
      if (score > bestScore) {
        bestScore = score;
        best = cut;
      }
    }
    if (bestScore === -Infinity) return [c];
    return [...split(c.slice(0, best)), ...split(c.slice(best))];
  });
}

const PARTICLES = new Set(['في', 'من', 'الى', 'إلى', 'على', 'عن', 'مع', 'ان', 'أن', 'حول', 'نحو', 'بين', 'ثم', 'قبل', 'بعد', 'عند', 'لكي', 'كي', 'حتى', 'تحت', 'فوق', 'امام', 'أمام', 'كل', 'يا', 'لا', 'لم', 'لن', 'قد', 'ما', 'التي', 'الذي', 'الذين', 'كيف', 'بدل', 'عبر', 'لكل', 'و']);
const bare = (w: string) => w.replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[.,،؛:!?؟«»"]/g, '');
