import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PAIR_CUES, curriculumPhrases, explainMistake, lessonFor, probeDueAt, scaffold } from './curriculum';
import { CONFUSABLE_PHONEME_PAIRS, LEXICON, PICTURE_IDS } from './lexicon';
import { FOCUS_SKILLS, PROGRAM_SESSIONS, generateSession, type Level } from './training';

const HAS_ARABIC = /[ء-ي]/;
const HAS_MARKS = /[ً-ْ]/;

describe('teaching curriculum: lessons ("I do")', () => {
  it('every trainable skill and level has a short lesson that ends by handing over to the child', () => {
    for (const skill of FOCUS_SKILLS) {
      for (const level of [1, 2, 3] as Level[]) {
        const lesson = lessonFor(skill, level);
        assert.ok(lesson, `${skill}:${level}`);
        assert.ok(lesson.steps.length >= 3 && lesson.steps.length <= 6, `${skill}:${level} has ${lesson.steps.length} steps`);
        assert.match(lesson.steps.at(-1)!.textAr, /دورك/);
      }
    }
  });

  it('lesson pictures are picturable words and every spoken phrase is vowelled', () => {
    for (const skill of FOCUS_SKILLS) {
      for (const level of [1, 2, 3] as Level[]) {
        for (const step of lessonFor(skill, level)!.steps) {
          if (step.visual?.kind === 'pictures') for (const id of step.visual.ids) assert.ok(PICTURE_IDS.includes(id), `${skill}:${level} ${id}`);
          for (const seg of step.audio) {
            if (HAS_ARABIC.test(seg.text) && Array.from(seg.text.replace(/[^ء-ي]/g, '')).length > 1) {
              assert.ok(HAS_MARKS.test(seg.text), `unvowelled: ${seg.text}`);
            }
          }
        }
      }
    }
  });

  it('every confusable sound pair has an articulation cue, and the child’s own pair is the one taught', () => {
    for (const [a, b] of CONFUSABLE_PHONEME_PAIRS) assert.ok(PAIR_CUES[[a, b].sort().join('|')], `${a}/${b}`);
    const lesson = lessonFor('discrimination', 2, { soundPairs: [['ت', 'ط']], letters: [] })!;
    assert.match(lesson.titleAr, /ت/);
    assert.match(lesson.titleAr, /ط/);
    const letters = lessonFor('letterSound', 2, { soundPairs: [], letters: ['ع'] })!;
    assert.ok(letters.steps.some((s) => s.visual?.kind === 'glyphs' && s.visual.letters.includes('ع')));
  });
});

describe('teaching curriculum: guided practice ("we do")', () => {
  it('a guided item keeps the right answer, has one fewer option, and starts with a spoken hint', () => {
    for (const skill of FOCUS_SKILLS) {
      for (const level of [1, 2, 3] as Level[]) {
        for (const task of generateSession(skill, level, 11)) {
          if (task.kind !== 'choice') continue;
          const g = scaffold(task.item);
          assert.ok(g.options.some((o) => o.id === task.item.correctId), `${skill}:${level} lost the answer`);
          if (task.item.options.length >= 3 && task.item.tag !== 'syllableCount') assert.equal(g.options.length, task.item.options.length - 1);
          assert.notEqual(g.audio[0].text, task.item.audio[0].text, 'hint first');
          const removed = task.item.options.filter((o) => !g.options.includes(o)).map((o) => o.id);
          assert.ok(!g.audio.some((s) => s.highlight && removed.includes(s.highlight)), 'removed option is not named');
        }
      }
    }
  });
});

describe('teaching curriculum: explanatory feedback ("you do")', () => {
  it('every practice item type gets an explanation that points to the right answer', () => {
    for (const skill of FOCUS_SKILLS) {
      for (const level of [1, 2, 3] as Level[]) {
        for (let seed = 1; seed <= 6; seed++) {
          for (const task of generateSession(skill, level, seed)) {
            if (task.kind !== 'choice') continue;
            const e = explainMistake(task.item);
            assert.ok(e, `${skill}:${level} tag ${task.item.tag}`);
            assert.ok(e.audio.length > 0 && e.textAr.length > 0);
            const correct = task.item.correctId;
            if (LEXICON[correct] && task.item.tag !== 'syllableCount') assert.ok(e.pictureIds.includes(correct), `${task.item.tag} shows the answer`);
          }
        }
      }
    }
  });

  it('everything the curriculum can say has a place in the recorded-audio catalogue', async () => {
    const { buildAudioCatalog, audioKey, normalizeSpokenText } = await import('./audioCatalog');
    const keys = new Set(buildAudioCatalog().map((e) => e.key));
    const missing = new Set<string>();
    for (const p of curriculumPhrases()) if (!keys.has(audioKey(normalizeSpokenText(p)))) missing.add(p);
    for (const skill of FOCUS_SKILLS) {
      for (const level of [1, 2, 3] as Level[]) {
        for (let seed = 1; seed <= 6; seed++) {
          for (const task of generateSession(skill, level, seed)) {
            if (task.kind !== 'choice') continue;
            for (const s of explainMistake(task.item)?.audio ?? []) if (!keys.has(audioKey(normalizeSpokenText(s.text)))) missing.add(s.text);
            for (const s of scaffold(task.item).audio) if (!keys.has(audioKey(normalizeSpokenText(s.text)))) missing.add(s.text);
          }
        }
      }
    }
    assert.deepEqual([...missing], []);
  });
});

describe('progress measure schedule', () => {
  it('first session, then weekly (every 5 sessions), and the last session', () => {
    const due = Array.from({ length: PROGRAM_SESSIONS }, (_, i) => i + 1).filter((n) => probeDueAt(n, PROGRAM_SESSIONS));
    assert.deepEqual(due, [1, 6, 11, 16, 20]);
  });
});
