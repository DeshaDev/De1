import assert from 'node:assert/strict';
import test from 'node:test';
import { ARABIC_READING_PASSAGES } from './seedData';

const normalize = (value: string) => value.replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[^\p{L}\p{N}]/gu, '');

test('reading library covers at least two unique passages for every grade from 1 to 6', () => {
  for (let grade = 1; grade <= 6; grade += 1) {
    const passages = ARABIC_READING_PASSAGES.filter((passage) => passage.gradeLevel === grade);
    assert.ok(passages.length >= 2, `Grade ${grade} needs at least two passages; found ${passages.length}`);
    assert.equal(new Set(passages.map((passage) => passage.id)).size, passages.length);
  }
});

test('reading passage word counts match the tokenized passages and every question has three choices', () => {
  for (const passage of ARABIC_READING_PASSAGES) {
    assert.equal(passage.wordCount, passage.words.length, `${passage.id} wordCount mismatch`);
    assert.ok(passage.words.length >= 35, `${passage.id} is too short for a full reading passage`);
    assert.equal(passage.comprehensionQuestions.length, 4, `${passage.id} must have four questions`);
    for (const question of passage.comprehensionQuestions) {
      assert.equal(question.options.length, 3);
      assert.ok(question.correctIndex >= 0 && question.correctIndex < 3);
      assert.equal(new Set(question.options.map(normalize)).size, 3, `Duplicate options in ${passage.id}`);
    }
  }
});

test('correct answers are not systematically the uniquely longest choice', () => {
  const questions = ARABIC_READING_PASSAGES.flatMap((passage) => passage.comprehensionQuestions);
  const uniquelyLongestCorrect = questions.filter((question) => {
    const lengths = question.options.map((option) => normalize(option).length);
    const correctLength = lengths[question.correctIndex];
    return correctLength === Math.max(...lengths) && lengths.filter((length) => length === correctLength).length === 1;
  }).length;
  const ratio = uniquelyLongestCorrect / questions.length;
  assert.ok(ratio <= 0.5, `Too many correct answers are uniquely longest: ${uniquelyLongestCorrect}/${questions.length}`);
});
