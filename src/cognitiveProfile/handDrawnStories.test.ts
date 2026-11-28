import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  HAND_DRAWN_STORIES,
  collectHandDrawnStoryAudioTexts,
  getHandDrawnStory,
  matchSpokenWords,
  stripArabicPunctuation,
} from './handDrawnStories';

const HARAKAT = /[ً-ْ]/;

describe('Graded Hand-Drawn Reading Stories', () => {
  it('covers levels 1–3 with full diacritics, orthographic checks, and unbroken word syllable maps', () => {
    assert.equal(HAND_DRAWN_STORIES.length, 15);
    assert.ok(getHandDrawnStory('paper-bird'));
    assert.ok(getHandDrawnStory('bithrat-noor'));
    assert.ok(getHandDrawnStory('bousalat-salem'));
    assert.ok(getHandDrawnStory('sharing'));
    assert.ok(getHandDrawnStory('tower'));
    assert.ok(getHandDrawnStory('mercy'));
    assert.ok(getHandDrawnStory('bismillah'));
    assert.ok(getHandDrawnStory('truth'));

    for (const story of HAND_DRAWN_STORIES) {
      assert.ok(story.pages.length >= 6, `${story.id} must have at least 6 pages`);
      assert.ok(story.coverImageUrl, `${story.id} must have a watercolor coverImageUrl`);
      assert.equal(story.warmupWords.length, 3);
      for (const w of story.warmupWords) {
        assert.ok(HARAKAT.test(w.word), `${story.id} warmup missing diacritics: ${w.word}`);
        assert.ok(w.syllables.length >= 2, `${story.id} warmup syllables empty: ${w.word}`);
        assert.ok(HARAKAT.test(w.meaningAr));
      }

      for (const page of story.pages) {
        assert.ok(page.imageUrl || page.sketchId, `${story.id} p${page.pageNumber} missing artwork`);
        assert.ok(HARAKAT.test(page.text), `${story.id} p${page.pageNumber} missing diacritics`);

        // 100% of stripped words on every page must have curated contextual syllables
        const tokens = page.text.split(/\s+/).map(stripArabicPunctuation).filter(Boolean);
        for (const tok of tokens) {
          const syls = story.wordSyllables[tok];
          assert.ok(
            Array.isArray(syls) && syls.length >= 1,
            `${story.id} p${page.pageNumber}: missing syllable map for word "${tok}"`,
          );
          const rebuilt = syls.join('').replace(/ـ/g, '');
          assert.equal(rebuilt, tok, `${story.id}: syllable map for "${tok}" rebuilds to "${rebuilt}"`);
        }

        // Orthographic decode check target must appear verbatim and options must be 3 distinct words
        assert.ok(tokens.includes(page.check.targetWord), `${story.id} p${page.pageNumber}: check target not in text`);
        assert.equal(page.check.options.length, 3);
        assert.equal(new Set(page.check.options).size, 3);
        assert.ok(page.check.options.includes(page.check.targetWord));
      }

      assert.equal(story.sequenceEvents.length, 3);
      for (const q of story.questions) {
        assert.ok(HARAKAT.test(q.q));
        assert.equal(q.options.length, 3);
        assert.equal(new Set(q.options).size, 3);
        assert.ok(q.options.includes(q.answer));
        assert.ok(!q.q.includes(q.answer), `${story.id} q leaks answer`);
      }

      // Guard against position bias where every question puts the right answer at index 0
      const answerIndices = story.questions.map((q) => q.options.indexOf(q.answer));
      assert.ok(
        answerIndices.some((idx) => idx !== 0),
        `${story.id} comprehension questions must distribute answers across option indices`,
      );
    }

    assert.ok(collectHandDrawnStoryAudioTexts().length > 80);
  });

  it('ships all 149 watercolor illustrations referenced by coverImageUrl and page imageUrl under public/', () => {
    const assetUrls: string[] = [];
    for (const story of HAND_DRAWN_STORIES) {
      if (story.coverImageUrl) assetUrls.push(story.coverImageUrl);
      for (const page of story.pages) {
        if (page.imageUrl) assetUrls.push(page.imageUrl);
      }
    }
    assert.equal(assetUrls.length, 149, 'Expected 149 watercolor illustrations across all 15 stories');
    for (const url of assetUrls) {
      const relative = url.replace(/^\//, '');
      const fullPath = path.resolve('public', relative);
      assert.ok(fs.existsSync(fullPath), `Missing image ${fullPath}`);
      assert.ok(fs.statSync(fullPath).size > 10_000, `Image too small: ${fullPath}`);
    }
  });

  it('matches spoken Arabic transcripts generously across taa marbuta & unvowelled child speech', () => {
    const target = ['طَوَى', 'عُمَرُ', 'وَرَقَةً', 'صَفْرَاءَ،'];
    assert.deepEqual(matchSpokenWords(['طوى عمر ورقه صفراء'], target), [true, true, true, true]);
    assert.deepEqual(matchSpokenWords(['عمر صنع'], target), [false, true, false, false]);
  });
});
