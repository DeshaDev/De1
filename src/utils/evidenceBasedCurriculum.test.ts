import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRICULUM_ROUTING_RULES,
  getCurriculumLesson,
  getNextCurriculumSkill,
  isFormativeMastery,
  MATH_CURRICULUM_SEQUENCE,
  recommendCurriculumSkill,
  READING_CURRICULUM_SEQUENCE,
} from './evidenceBasedCurriculum.ts';

test('reading pathway teaches phonological awareness, letter-sound mapping, decoding, connected text and comprehension', () => {
  const ids = READING_CURRICULUM_SEQUENCE.map((lesson) => lesson.id);
  assert.ok(ids.indexOf('phonological-awareness') < ids.indexOf('short-vowel-decoding'));
  assert.ok(ids.indexOf('short-vowel-decoding') < ids.indexOf('syllable-blending'));
  assert.ok(ids.indexOf('syllable-blending') < ids.indexOf('connected-text'));
  assert.ok(ids.indexOf('connected-text') < ids.indexOf('reading-comprehension'));
  for (const lesson of READING_CURRICULUM_SEQUENCE) {
    const data = getCurriculumLesson('reading', lesson.id);
    assert.ok(data);
    assert.equal(data.questions.length, 3);
    assert.ok(data.questions.every((item) => item.correctIndex >= 0 && item.correctIndex < item.options.length));
    assert.ok(data.questions.every((item) => item.options.length === 3 && new Set(item.options).size === item.options.length));
    assert.ok(data.questions.every((item) => item.prompt.trim() && item.scaffold.trim() && item.feedbackCorrect.trim()));
  }
});

test('math pathway moves from quantity to symbols, magnitude, place value, operations and word problems', () => {
  const ids = MATH_CURRICULUM_SEQUENCE.map((lesson) => lesson.id);
  assert.ok(ids.indexOf('quantity-cardinality') < ids.indexOf('number-symbol-mapping'));
  assert.ok(ids.indexOf('number-symbol-mapping') < ids.indexOf('magnitude-number-line'));
  assert.ok(ids.indexOf('magnitude-number-line') < ids.indexOf('place-value'));
  assert.ok(ids.indexOf('place-value') < ids.indexOf('addition-subtraction'));
  assert.ok(ids.indexOf('addition-subtraction') < ids.indexOf('math-word-problems'));
  for (const lesson of MATH_CURRICULUM_SEQUENCE) {
    const data = getCurriculumLesson('math', lesson.id);
    assert.ok(data);
    assert.equal(data.questions.length, 3);
    assert.ok(data.questions.every((item) => item.correctIndex >= 0 && item.correctIndex < item.options.length));
  }
});

test('reading recommendations use recorded instructional evidence and clearly avoid diagnosis', () => {
  const phonology = recommendCurriculumSkill({
    gradeLevel: 3,
    cognitiveResults: { phonemicAwarenessScorePercent: 50, pseudoWordScorePercent: 100 },
  }, 'reading');
  assert.equal(phonology.skillId, 'phonological-awareness');
  assert.match(phonology.evidenceAr, /ليست معيارًا عمريًا أو تشخيصًا/);

  const decode = recommendCurriculumSkill({
    gradeLevel: 4,
    cognitiveResults: { phonemicAwarenessScorePercent: 90, pseudoWordScorePercent: 65 },
  }, 'reading');
  assert.equal(decode.skillId, 'short-vowel-decoding');

  const audioOnlyFromServer = recommendCurriculumSkill({
    gradeLevel: 4,
    sessionStatus: 'completed',
    evidenceProvenance: 'server-verified-audio',
    aiAssessmentVerified: true,
    oralAccuracyPercent: 60,
  }, 'reading');
  assert.equal(audioOnlyFromServer.skillId, 'syllable-blending');
  assert.match(audioOnlyFromServer.evidenceAr, /قد يتأثر التقدير بالتعرف الصوتي/);
});

test('client-provided and demo data cannot trigger automated-audio routing', () => {
  const client = recommendCurriculumSkill({
    gradeLevel: 3,
    evidenceProvenance: 'client-reported',
    aiAssessmentVerified: true,
    oralAccuracyPercent: 1,
  }, 'reading');
  assert.equal(client.isBaseline, true);

  const demo = recommendCurriculumSkill({
    gradeLevel: 3,
    isDemoRecord: true,
    evidenceProvenance: 'server-verified-audio',
    aiAssessmentVerified: true,
    oralAccuracyPercent: 1,
    cognitiveResults: { phonemicAwarenessScorePercent: 1, pseudoWordScorePercent: 1 },
  }, 'reading');
  assert.equal(demo.isBaseline, true);
});

test('math recommendations use actual task metrics only when the math lab was completed', () => {
  const numberLink = recommendCurriculumSkill({
    gradeLevel: 2, dyscalculiaAssessed: true, subitizingAccuracy: 95,
    transcodingAccuracy: 50, numberLinePAE: 5,
  }, 'math');
  assert.equal(numberLink.skillId, 'number-symbol-mapping');

  const noAssessment = recommendCurriculumSkill({
    gradeLevel: 2, dyscalculiaAssessed: false, subitizingAccuracy: 0,
    transcodingAccuracy: 0, numberLinePAE: 100,
  }, 'math');
  assert.equal(noAssessment.skillId, 'quantity-cardinality');
  assert.equal(noAssessment.isBaseline, true);
});

test('phonological-awareness prompts do not reveal the target word in writing', () => {
  const lesson = getCurriculumLesson('reading', 'phonological-awareness');
  assert.ok(lesson);
  assert.ok(lesson.questions.every((item) => item.hideStimulus === true));
  assert.doesNotMatch(lesson.model + ' ' + lesson.guidedPractice, /موز|سمك|نور/);
});

test('Arabic number notation does not instruct children to reverse numeral reading order', () => {
  const lesson = getCurriculumLesson('math', 'number-symbol-mapping');
  assert.ok(lesson);
  const text = [lesson.model, lesson.guidedPractice, ...lesson.questions.map((item) => item.scaffold)].join(' ');
  assert.doesNotMatch(text, /اقرأ العدد من اليمين إلى اليسار/);
  assert.match(text, /واحد وعشرون/);
});

test('math course advances into multiplication and fractions only at suitable grade bands', () => {
  assert.equal(getNextCurriculumSkill('math', 'addition-subtraction', 2), 'math-word-problems');
  assert.equal(getNextCurriculumSkill('math', 'addition-subtraction', 3), 'multiplication-division');
  assert.equal(getNextCurriculumSkill('math', 'multiplication-division', 3), 'math-word-problems');
  assert.equal(getNextCurriculumSkill('math', 'math-word-problems', 4), 'fractions');
});

test('mastery means only a clean formative round, not diagnosis or longitudinal skill mastery', () => {
  assert.equal(isFormativeMastery(3, 3), true);
  assert.equal(isFormativeMastery(2, 3), false);
  assert.equal(isFormativeMastery(4, 3), false);
  assert.equal(CURRICULUM_ROUTING_RULES.formativeItemsPerRound, 3);
});

test('curriculum lesson wording contains no claims to cure or diagnose dyslexia/dyscalculia', () => {
  const lessons = [
    ...READING_CURRICULUM_SEQUENCE.map((item) => getCurriculumLesson('reading', item.id)!),
    ...MATH_CURRICULUM_SEQUENCE.map((item) => getCurriculumLesson('math', item.id)!),
  ];
  for (const lesson of lessons) {
    const content = [lesson.title, lesson.objective, lesson.model, lesson.guidedPractice, lesson.successGuidance, lesson.retryGuidance].join(' ');
    assert.doesNotMatch(content, /يعالج عسر|يشخّص عسر|تشخيص مؤكد|يشفي عسر/i);
    for (const item of lesson.questions) {
      assert.ok(item.prompt.trim());
      assert.ok(item.scaffold.trim());
      assert.ok(item.feedbackCorrect.trim());
    }
  }
});
