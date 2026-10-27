import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRICULUM_ROUTING_RULES,
  getCurriculumLesson,
  getCurriculumOptionOrder,
  getCurriculumRoundQuestions,
  getNextCurriculumSkill,
  isFormativeMastery,
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
    assert.ok(data.questions.length >= 5, `${lesson.id} needs a larger practice bank`);
    assert.ok(data.questions.every((item) => item.correctIndex >= 0 && item.correctIndex < item.options.length));
    assert.ok(data.questions.every((item) => item.options.length === 3 && new Set(item.options).size === 3));
    assert.ok(data.questions.every((item) => item.options.length === 3 && new Set(item.options).size === item.options.length));
    assert.ok(data.questions.every((item) => item.prompt.trim() && item.scaffold.trim() && item.feedbackCorrect.trim()));
  }
});

test('each reading skill has a wider bank and serves different three-question rounds on retry', () => {
  const lessons = READING_CURRICULUM_SEQUENCE.map((item) => getCurriculumLesson('reading', item.id)!);
  for (const lesson of lessons) {
    const first = getCurriculumRoundQuestions(lesson, 0);
    const second = getCurriculumRoundQuestions(lesson, 1);
    assert.equal(first.length, CURRICULUM_ROUTING_RULES.formativeItemsPerRound);
    assert.equal(second.length, CURRICULUM_ROUTING_RULES.formativeItemsPerRound);
    assert.equal(new Set(first.map((item) => item.id)).size, first.length);
    assert.ok(first.some((item) => !second.some((next) => next.id === item.id)), lesson.id + ' should rotate at least one question');
  }
});

test('answer choices rotate positions between retries so correct answers are not fixed by screen position', () => {
  for (const lesson of READING_CURRICULUM_SEQUENCE) {
    const data = getCurriculumLesson('reading', lesson.id)!;
    for (const question of data.questions) {
      const positions = [0, 1, 2].map((round) =>
        getCurriculumOptionOrder(question, round).indexOf(question.correctIndex)
      );
      assert.equal(new Set(positions).size, 3, question.id + ' should rotate its correct answer position');
    }
  }
});

test('all seven reading lesson banks contain five distinct, fully specified questions', () => {
  const lessons = READING_CURRICULUM_SEQUENCE.map((item) => getCurriculumLesson('reading', item.id)!);
  const allIds = lessons.flatMap((lesson) => lesson.questions.map((item) => item.id));
  assert.equal(lessons.length, 7);
  assert.equal(allIds.length, 35);
  assert.equal(new Set(allIds).size, allIds.length, 'Question IDs must be globally unique');
  for (const lesson of lessons) {
    assert.equal(lesson.questions.length, 5, lesson.id);
    for (const item of lesson.questions) {
      assert.ok(item.prompt.trim(), item.id + ' prompt');
      assert.ok(item.feedbackCorrect.trim(), item.id + ' corrective feedback');
      assert.ok(item.scaffold.trim(), item.id + ' scaffold');
      assert.equal(item.options.length, 3, item.id + ' option count');
      assert.equal(new Set(item.options).size, 3, item.id + ' duplicate options');
      assert.ok(item.correctIndex >= 0 && item.correctIndex < item.options.length, item.id + ' answer index');
    }
  }
});

test('core Arabic reading items preserve their intended phonological, grapheme and vowel answer', () => {
  const lessons = READING_CURRICULUM_SEQUENCE.map((item) => getCurriculumLesson('reading', item.id)!);
  const questions = lessons.flatMap((lesson) => lesson.questions);
  const expected: Record<string, string> = {
    'pa-1': '/م/', 'pa-2': '/س/', 'pa-3': '/ن/', 'pa-4': '/ش/', 'pa-5': '/ق/',
    'ls-1': 'ب', 'ls-2': 'ت', 'ls-3': 'ث', 'ls-4': 'م', 'ls-5': 'د',
    'sv-1': 'كَتَبَ', 'sv-2': 'بِئْرٌ', 'sv-3': 'عِلْمٌ',
    'sv-4': 'تُفَّاحٌ', 'sv-5': 'فتحة',
    'sb-1': 'رَسَمَ', 'sb-2': 'سَمَكٌ', 'sb-3': 'لَعِبَ',
    'sb-4': 'قَلَمٌ', 'sb-5': 'شَجَرَةٌ',
    'lm-1': 'بَابٌ', 'lm-2': 'مَكْتُوبٌ', 'lm-3': 'نُورٌ',
    'lm-4': 'تِينٌ', 'lm-5': 'مَدْرَسَةٌ',
    'ct-1': 'إلى المكتبة', 'ct-2': 'عن البحر',
    'ct-3': 'حكت لأسرتها ما تعلمته', 'ct-4': 'صفحتين',
    'ct-5': 'شاركت ما تعلمته',
    'rc-1': 'قرب النافذة', 'rc-2': 'بدت ووضحت للعيان',
    'rc-3': 'لأنّ سامراً سقاها ووضعها قرب النافذة', 'rc-4': 'كل صباح',
    'rc-5': 'ظهور ورقتين خضراوين',
  };
  for (const [id, answer] of Object.entries(expected)) {
    const item = questions.find((candidate) => candidate.id === id);
    assert.ok(item, 'Missing question ' + id);
    assert.equal(item.options[item.correctIndex], answer, id + ' expected correct answer');
  }
  assert.equal(Object.keys(expected).length, 35);
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
  assert.equal(decode.isBaseline, true, 'Unreviewed pseudo-word content must not trigger targeted adaptive routing');
  assert.match(decode.evidenceAr, /لا توجد بيانات سابقة كافية/);

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

test('phonological-awareness prompts do not reveal the target word in writing', () => {
  const lesson = getCurriculumLesson('reading', 'phonological-awareness');
  assert.ok(lesson);
  assert.ok(lesson.questions.every((item) => item.hideStimulus === true));
  assert.doesNotMatch(lesson.model + ' ' + lesson.guidedPractice, /موز|سمك|نور/);
});

test('reading sequence advances sequentially through literacy stages', () => {
  assert.equal(getNextCurriculumSkill('reading', 'phonological-awareness', 1), 'letter-sound-mapping');
  assert.equal(getNextCurriculumSkill('reading', 'letter-sound-mapping', 1), 'short-vowel-decoding');
  assert.equal(getNextCurriculumSkill('reading', 'short-vowel-decoding', 2), 'syllable-blending');
  assert.equal(getNextCurriculumSkill('reading', 'syllable-blending', 2), 'long-vowels-and-morphemes');
  assert.equal(getNextCurriculumSkill('reading', 'long-vowels-and-morphemes', 3), 'connected-text');
  assert.equal(getNextCurriculumSkill('reading', 'connected-text', 3), 'reading-comprehension');
  assert.equal(getNextCurriculumSkill('reading', 'reading-comprehension', 4), 'reading-comprehension');
});

test('mastery means only a clean formative round, not diagnosis or longitudinal skill mastery', () => {
  assert.equal(isFormativeMastery(3, 3), true);
  assert.equal(isFormativeMastery(2, 3), false);
  assert.equal(isFormativeMastery(4, 3), false);
  assert.equal(CURRICULUM_ROUTING_RULES.formativeItemsPerRound, 3);
});

test('curriculum lesson wording contains no claims to cure or diagnose dyslexia', () => {
  const lessons = READING_CURRICULUM_SEQUENCE.map((item) => getCurriculumLesson('reading', item.id)!);
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
