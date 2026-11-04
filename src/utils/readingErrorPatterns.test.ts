import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyseReadingErrors, classifyConfusion, letterEdits, lettersOf } from './readingErrorPatterns';

describe('reading error patterns', () => {
  it('normalises letters and ignores short vowels', () => {
    assert.deepEqual(lettersOf('كِتَابٌ'), ['ك', 'ت', 'ا', 'ب']);
    assert.deepEqual(lettersOf('مَدْرَسَةٌ'), ['م', 'د', 'ر', 'س', 'ه']);
  });

  it('aligns letters with minimal edits', () => {
    assert.deepEqual(letterEdits(lettersOf('سيف'), lettersOf('صيف')), [{ op: 'sub', a: 'س', b: 'ص' }]);
    assert.deepEqual(letterEdits(lettersOf('كتاب'), lettersOf('كتب')), [{ op: 'del', a: 'ا' }]);
  });

  it('classifies sound and visual confusions', () => {
    assert.equal(classifyConfusion('س', 'ص'), 'sound');
    assert.equal(classifyConfusion('ت', 'ط'), 'sound');
    assert.equal(classifyConfusion('ب', 'ت'), 'visual');
    assert.equal(classifyConfusion('ج', 'خ'), 'visual');
    assert.equal(classifyConfusion('م', 'ل'), null);
  });

  it('turns misread words into patterns and targeted exercises', () => {
    const p = analyseReadingErrors(
      [
        { word: 'سَيْفٌ', status: 'phonetic_substitution', spokenWord: 'صيف' },
        { word: 'صَابُونٌ', status: 'phonetic_substitution', spokenWord: 'سابون' },
        { word: 'بِنْتٌ', status: 'phonetic_substitution', spokenWord: 'تنت' },
        { word: 'كِتَابٌ', status: 'phonetic_substitution', spokenWord: 'كتب' },
        { word: 'شَجَرَةٌ', status: 'phonetic_substitution', spokenWord: 'حديقة' },
        { word: 'بَيْتٌ', status: 'omitted' },
        { word: 'قَمَرٌ', status: 'dialect_variant', spokenWord: 'امر' },
        { word: 'وَلَدٌ', status: 'correct' },
      ],
      'p-1'
    );
    const sc = p.letterConfusions.find((c) => c.pair.join('') === ['س', 'ص'].sort().join(''));
    assert.equal(sc?.kind, 'sound');
    assert.equal(sc?.count, 2);
    assert.ok(p.letterConfusions.some((c) => c.kind === 'visual'));
    assert.equal(p.longVowelErrors.length, 1);
    assert.equal(p.wholeWordSubstitutions.length, 1, 'شجرة ← حديقة is a different word, not a letter slip');
    assert.deepEqual(p.omittedWords, ['بَيْتٌ']);
    assert.equal(p.wordsMisread, 6, 'the dialect variant is not counted');
    assert.ok(p.recommendations.skills.includes('discrimination'));
    assert.ok(p.recommendations.skills.includes('visualDiscrimination'));
    assert.ok(p.recommendations.skills.includes('letterSound'));
    assert.ok(p.recommendations.soundPairs.some((pair) => pair.includes('س') && pair.includes('ص')));
    assert.ok(p.practiceWords.includes('بَيْتٌ'));
    assert.ok(p.limitsAr.some((l) => /الحركات القصيرة/.test(l)));
  });

  it('reports nothing for a clean reading', () => {
    const p = analyseReadingErrors([{ word: 'بَيْتٌ', status: 'correct' }], 'p-1');
    assert.equal(p.letterConfusions.length, 0);
    assert.deepEqual(p.recommendations.skills, []);
  });
});

describe('reading errors turned into exercises', () => {
  it('adds recommended skills (up to three) and makes about half of the items practise the child’s own confusions', async () => {
    const { applyReadingTargets, createProgress, generateItems } = await import('../cognitiveProfile/training');
    const progress = createProgress({ createdAt: new Date().toISOString(), preventive: false, focus: ['rhyme', 'blending'], rationaleAr: [] });
    const { progress: next, added } = applyReadingTargets(progress, {
      skills: ['discrimination', 'visualDiscrimination', 'letterSound'],
      soundPairs: [['س', 'ص']],
      letters: ['س', 'ص'],
      passageId: 'p-1',
      analysedAt: new Date().toISOString(),
    });
    assert.deepEqual(added, ['discrimination']);
    assert.equal(next.plan.focus.length, 3);
    assert.ok(next.bkt?.['discrimination:1']);

    const hasPair = (t: { kind: string; item?: { audio: Array<{ text: string }> } }) =>
      t.kind === 'choice' && t.item!.audio.slice(0, 2).some((a) => a.text.startsWith('س')) && t.item!.audio.slice(0, 2).some((a) => a.text.startsWith('ص'));
    let targeted = 0;
    let baseline = 0;
    for (let seed = 1; seed <= 60; seed++) {
      targeted += generateItems('discrimination', 2, seed, 8, next.targets).filter(hasPair).length;
      baseline += generateItems('discrimination', 2, seed, 8).filter(hasPair).length;
    }
    assert.ok(targeted > baseline * 2, `targeted ${targeted} vs baseline ${baseline}`);
  });
});
