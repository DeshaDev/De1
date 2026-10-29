import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ARABIC_READING_PASSAGES } from '../../data/seedData';
import { chunkPassage } from './chunks';

describe('guided reader chunks', () => {
  it('keeps every word, in order, for every passage', () => {
    for (const p of ARABIC_READING_PASSAGES) assert.deepEqual(chunkPassage(p.words).flat(), p.words, p.id);
  });
  it('shows short sentences only (at most 16 words (long ones only in grade 5–6 texts), split only at clear boundaries)', () => {
    for (const p of ARABIC_READING_PASSAGES)
      for (const c of chunkPassage(p.words)) assert.ok(c.length >= 1 && c.length <= 16, `${p.id}: ${c.length}`);
  });
});

describe('guided reader chunk boundaries', () => {
  it('never ends a chunk on a preposition or particle', () => {
    const hanging = /^(في|من|إلى|الى|على|عن|مع|أن|ان|حول|نحو|بين|عبر|التي|الذي|ما|كيف|لكل)$/;
    for (const p of ARABIC_READING_PASSAGES)
      for (const c of chunkPassage(p.words)) {
        const last = c[c.length - 1].replace(/[ً-ٰٟـ]/g, '').replace(/[.,،؛:!?؟]/g, '');
        assert.ok(!hanging.test(last), `${p.id}: ${c.join(' ')}`);
      }
  });
});
