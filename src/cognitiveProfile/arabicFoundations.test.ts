import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NON_CONNECTING_AFTER_LETTERS,
  getPositionalLetterForms,
  getWordConnectedForms,
} from './arabicFoundations';

describe('arabicFoundations positional & connected letter forms', () => {
  it('generates all four connected forms for regular connecting letters', () => {
    const ba = getPositionalLetterForms('ب');
    assert.equal(ba.connectsLeft, true);
    assert.equal(ba.isolated, 'ب');
    assert.equal(ba.initial, 'بـ');
    assert.equal(ba.medial, 'ـبـ');
    assert.equal(ba.final, 'ـب');

    const kaf = getPositionalLetterForms('ك');
    assert.equal(kaf.initial, 'كـ');
    assert.equal(kaf.medial, 'ـكـ');
    assert.equal(kaf.final, 'ـك');
  });

  it('respects non-connecting ("رافصة") letters such as د, ر, و, ا', () => {
    for (const letter of ['ا', 'د', 'ذ', 'ر', 'ز', 'و']) {
      assert.equal(NON_CONNECTING_AFTER_LETTERS.has(letter), true);
      const forms = getPositionalLetterForms(letter);
      assert.equal(forms.connectsLeft, false);
      assert.equal(forms.isolated, letter);
      assert.equal(forms.initial, letter);
      assert.equal(forms.medial, `ـ${letter}`);
      assert.equal(forms.final, `ـ${letter}`);
    }
  });

  it('computes exact connected forms across mixed words like كِتَاب, قَلَم, دُبّ, أَسَد', () => {
    const kitab = getWordConnectedForms(['ك', 'ت', 'ا', 'ب']);
    assert.deepEqual(
      kitab.map((s) => s.form),
      ['كـ', 'ـتـ', 'ـا', 'ب']
    );
    assert.equal(kitab[2].connectsToPrev, true);
    assert.equal(kitab[2].connectsToNext, false);
    assert.equal(kitab[3].connectsToPrev, false);

    const qalam = getWordConnectedForms(['ق', 'ل', 'م']);
    assert.deepEqual(
      qalam.map((s) => s.form),
      ['قـ', 'ـلـ', 'ـم']
    );

    const ward = getWordConnectedForms(['و', 'ر', 'د']);
    assert.deepEqual(
      ward.map((s) => s.form),
      ['و', 'ر', 'د']
    );

    const asad = getWordConnectedForms(['أ', 'س', 'د']);
    assert.deepEqual(
      asad.map((s) => s.form),
      ['أ', 'سـ', 'ـد']
    );
  });
});
