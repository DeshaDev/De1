/**
 * Linguistic consistency of the picture lexicon and of every item built from it.
 * These checks encode the review rules in docs/CONTENT_REVIEW_AR.md so that a later edit
 * cannot silently break them.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LEXICON, LEXICON_IDS, PICTURE_SYNONYMS, dialectMerged, lex } from './lexicon';
import { BATTERY } from './battery';
import { SKILLS, generateSession, type Level, type SkillId } from './training';

const HARAKAT = /[ً-ِ]/; // tanween + fatha/damma/kasra
const SUKUN = 'ْ';
const SHADDA = 'ّ';
const DIACRITICS = /[ً-ْٰ]/g;
const LONG_VOWEL_AFTER: Record<string, string> = { 'ا': 'َ', 'ى': 'َ', 'و': 'ُ', 'ي': 'ِ' };

const letters = (s: string) => s.replace(DIACRITICS, '');
/** Expand shadda into a doubled consonant, then drop diacritics. */
const expanded = (s: string) => letters(s.replace(new RegExp(`(.)[\\u064B-\\u0650]?${SHADDA}`, 'g'), '$1$1'));
const hamzaToGlottal = (c: string) => ('أإآءؤئ'.includes(c) ? 'ء' : c);

/** Split a vocalised string into base letters with their marks. */
function graphemes(s: string): Array<{ base: string; marks: string }> {
  const out: Array<{ base: string; marks: string }> = [];
  for (const ch of s.normalize('NFC')) {
    if (/[ً-ْٰ]/.test(ch) && out.length) out[out.length - 1].marks += ch;
    else out.push({ base: ch, marks: '' });
  }
  return out;
}

/** True when the syllable ends in a consonant that has no vowel mark (needs a sukun). */
function endsInBareConsonant(syllable: string): boolean {
  const g = graphemes(syllable);
  const last = g[g.length - 1];
  if (!last || 'ةه'.includes(last.base) || last.base === 'ة') return false;
  if (last.marks.includes(SUKUN) || last.marks.includes(SHADDA) || HARAKAT.test(last.marks)) return false;
  const prev = g[g.length - 2];
  if (last.base in LONG_VOWEL_AFTER && prev && prev.marks.includes(LONG_VOWEL_AFTER[last.base])) return false; // long vowel
  if (last.base === 'ا' || last.base === 'ى') return false;
  return true;
}

describe('picture lexicon', () => {
  it('first sound annotation matches the written word', () => {
    for (const e of Object.values(LEXICON)) assert.equal(hamzaToGlottal(letters(e.word)[0]), e.onset, e.id);
  });

  it('last sound annotation matches the written word (null for taa marbuta endings)', () => {
    for (const e of Object.values(LEXICON)) {
      const w = letters(e.word);
      const last = w[w.length - 1];
      if (last === 'ة') assert.equal(e.coda, null, e.id);
      else assert.equal(e.coda, last, e.id);
    }
  });

  it('syllables join back into exactly the word', () => {
    for (const e of Object.values(LEXICON)) assert.equal(expanded(e.syllables.join('')), expanded(e.word), e.id);
  });

  it('every closed syllable marks its final consonant with a sukun (unambiguous for listeners and speech engines)', () => {
    const bare = Object.values(LEXICON).flatMap((e) => e.syllables.filter(endsInBareConsonant).map((s) => `${e.id}:${s}`));
    assert.deepEqual(bare, []);
  });

  it('words that share a rhyme key end in the same letters, and different keys do not collide', () => {
    const groups = new Map<string, string[]>();
    for (const e of Object.values(LEXICON)) groups.set(e.rhyme, [...(groups.get(e.rhyme) ?? []), e.id]);
    for (const [key, ids] of groups) {
      const endings = new Set(ids.map((id) => letters(lex(id).syllables[lex(id).syllables.length - 1]).slice(1)));
      assert.equal(endings.size, 1, `${key}: ${ids.join(', ')}`);
    }
  });

  it('every entry has a distinct picture', () => {
    const seen = new Map<string, string>();
    for (const e of Object.values(LEXICON)) {
      assert.ok(!seen.has(e.emoji), `${e.id} reuses the picture of ${seen.get(e.emoji)}`);
      seen.set(e.emoji, e.id);
    }
  });
});


describe('items built from the lexicon', () => {
  const byEmoji = new Map(Object.values(LEXICON).map((e) => [e.emoji, e.id]));
  const pictureIds = (visuals: Array<{ type: string; value: unknown } | undefined>) =>
    visuals.flatMap((v) => (v && v.type === 'emoji' && byEmoji.has(String(v.value)) ? [byEmoji.get(String(v.value))!] : []));
  const allItems = () => {
    const items: Array<{ where: string; ids: string[] }> = [];
    for (const s of BATTERY) {
      if (s.kind === 'choice') for (const it of [...s.practice, ...s.items]) items.push({ where: `${s.id}.${it.id}`, ids: pictureIds([it.stimulus, ...it.options.map((o) => o.visual)]) });
    }
    for (const skill of Object.keys(SKILLS) as SkillId[])
      for (const level of [1, 2, 3] as Level[])
        for (let seed = 1; seed <= 60; seed++)
          for (const t of generateSession(skill, level, seed))
            if (t.kind === 'choice')
              items.push({ where: `training.${skill}.${level}.${seed}`, ids: pictureIds([t.item.stimulus, ...t.item.options.map((o) => o.visual)]) });
    return items;
  };

  it('never shows two pictures a child could call by the same name', () => {
    const clashes = allItems().filter((item) => PICTURE_SYNONYMS.some(([a, b]) => item.ids.includes(a) && item.ids.includes(b)));
    assert.deepEqual(clashes.map((c) => c.where), []);
  });

  it('uses only lexicon entries', () => {
    for (const item of allItems()) for (const id of item.ids) assert.ok(LEXICON_IDS.includes(id), `${item.where}: ${id}`);
  });
});

describe('dialect safety of scored sound items', () => {
  it('no first/last-sound item offers a distractor whose sound a common dialect merges with the answer', () => {
    const byEmoji = new Map(Object.values(LEXICON).map((e) => [e.emoji, e]));
    const problems: string[] = [];
    for (const s of BATTERY) {
      if (s.kind !== 'choice') continue;
      for (const item of [...s.practice, ...s.items]) {
        if (item.tag !== 'onset' && item.tag !== 'coda') continue;
        const field = item.tag === 'onset' ? 'onset' : 'coda';
        const answer = item.options.find((o) => o.id === item.correctId)!;
        const answerSound = byEmoji.get(String(answer.visual.value))![field];
        for (const o of item.options) {
          if (o.id === item.correctId) continue;
          const sound = byEmoji.get(String(o.visual.value))?.[field];
          if (sound && answerSound && dialectMerged(sound, answerSound)) problems.push(`${item.id}: ${o.id}`);
        }
      }
    }
    assert.deepEqual(problems, []);
  });
});

describe('audio coverage for any training session', () => {
  it('every phrase of randomly seeded sessions has a pre-recorded clip (sessions are seeded by time)', async () => {
    const { buildAudioCatalog, audioKey, normalizeSpokenText } = await import('./audioCatalog');
    const keys = new Set(buildAudioCatalog().map((e) => e.key));
    const missing = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const seed = Math.floor(Math.random() * 2 ** 40);
      for (const skill of Object.keys(SKILLS) as SkillId[])
        for (const level of [1, 2, 3] as Level[])
          for (const t of generateSession(skill, level, seed)) {
            const texts = t.kind === 'choice' ? t.item.audio.map((a) => a.text) : [...t.trial.sequence, ...t.trial.choices].map((id) => lex(id).word);
            for (const raw of texts) if (!keys.has(audioKey(normalizeSpokenText(raw)))) missing.add(raw);
          }
    }
    assert.deepEqual([...missing], []);
  });
});

describe('content review bank', () => {
  it('contains every scored and practice battery item, every lexicon word and every passage', async () => {
    const { buildReviewUnits } = await import('../review/itemBank');
    const ids = new Set(buildReviewUnits().map((u) => u.id));
    for (const s of BATTERY) {
      if (s.kind === 'choice') for (const it of [...s.practice, ...s.items]) assert.ok(ids.has(`battery.${s.id}.${it.id}`), it.id);
      if (s.kind === 'span') for (const t of [...s.practice, ...s.trials]) assert.ok(ids.has(`battery.${s.id}.${t.id}`), t.id);
    }
    for (const id of LEXICON_IDS) assert.ok(ids.has(`lexicon.${id}`), id);
  });
});

describe('fixed pictures', () => {
  it('every lexicon word and game picture has a bundled drawing (same on every device)', async () => {
    const fs = await import('node:fs');
    const { pictureFile, UI_PICTURES } = await import('./pictures');
    const missing = [...Object.values(LEXICON).map((e) => e.emoji), ...UI_PICTURES].filter(
      (emoji) => !fs.existsSync(`public/pictures/${pictureFile(emoji)}`)
    );
    assert.deepEqual(missing, []);
  });
});

describe('training plan follows the evidence on memory training', () => {
  it('never chooses memory as a training goal, and keeps phonological and letter skills', async () => {
    const { buildTrainingPlan, NOT_TRAINED_AS_FOCUS } = await import('./training');
    const plan = (weaknesses: string[]) => buildTrainingPlan({ weaknesses } as never);
    const onlyMemory = plan(['auditorySequential', 'visualSequential']);
    assert.deepEqual([...onlyMemory.focus].sort(), ['blending', 'letterSound']);
    assert.ok(onlyMemory.rationaleAr.some((t) => t.includes('الذاكرة')));
    const mixed = plan(['visualAssociative', 'rhyme', 'letterSound']);
    assert.ok(mixed.focus.every((s) => !NOT_TRAINED_AS_FOCUS.has(s)));
    assert.deepEqual([...mixed.focus].sort(), ['letterSound', 'rhyme']);
  });
});

describe('word familiarity in scored items (Gulf Arabic norms, Khwaileh et al., 2018)', () => {
  /**
   * «قلب» (ad-11, ad-14) is kept on purpose: its late age-of-acquisition rating conflicts with 100%
   * name agreement and high familiarity, and no other lexicon pair tests ك/ق. It is checked in the
   * child pilot instead (docs/CONTENT_REVIEW_AR.md §6).
   */
  const KEPT_DESPITE_LATE_RATING = new Set(['heart']);

  it('no scored item uses a word rated as acquired at 7–8 years or later', async () => {
    const { GULF_NORMS, LATE_AGE_OF_ACQUISITION } = await import('./gulfNorms');
    const byEmoji = new Map(LEXICON_IDS.map((id) => [LEXICON[id].emoji, id]));
    const late: string[] = [];
    const check = (where: string, id: string | undefined) => {
      const n = id ? GULF_NORMS[id] : undefined;
      if (id && n && n.ageOfAcquisition >= LATE_AGE_OF_ACQUISITION && !KEPT_DESPITE_LATE_RATING.has(id)) late.push(`${where}: ${id}`);
    };
    for (const s of BATTERY) {
      if (s.kind === 'choice') {
        for (const item of s.items) {
          if (item.stimulus?.type === 'emoji') check(item.id, byEmoji.get(item.stimulus.value));
          for (const o of item.options) if (LEXICON[o.id]) check(item.id, o.id);
        }
      } else if (s.kind === 'span') {
        for (const t of s.trials) [...t.sequence, ...t.choices].forEach((id) => check(t.id, id));
      } else if (s.kind === 'association') {
        for (const b of s.blocks) b.residents.forEach((id) => check(b.id, id));
      }
    }
    assert.deepEqual(late, []);
  });

  it('norms are recorded only for lexicon words, with values inside the published scales', async () => {
    const { GULF_NORMS } = await import('./gulfNorms');
    for (const [id, n] of Object.entries(GULF_NORMS)) {
      assert.ok(LEXICON[id], id);
      assert.ok(n.nameAgreement > 0 && n.nameAgreement <= 1, id);
      assert.ok(n.ageOfAcquisition >= 1 && n.ageOfAcquisition <= 7, id);
      assert.ok(n.familiarity >= 1 && n.familiarity <= 5, id);
    }
  });
});
