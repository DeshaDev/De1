import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAdaptiveRemediationPlan, isStructurallyValidRemediationSessionPlan } from './remediationEngine.ts';

const normalizeArabic = (value: string) =>
  value.replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[\s.,،؛:!?؟]/g, '');

test('remediation activities use examples that match the phonics target letter', () => {
  const plan = generateAdaptiveRemediationPlan({
    studentName: 'طفل تجريبي',
    gradeLevel: 3,
    effectiveWords: ['المدرسة', 'المرصد'],
    targetsTeacherReviewed: false,
  });

  for (const drill of plan.phonicsDrills) {
    const word = normalizeArabic(drill.spokenWord);
    const target = normalizeArabic(drill.targetLetter);
    assert.ok(
      word.startsWith(target),
      `Expected example ${drill.spokenWord} to begin with target letter ${drill.targetLetter}`,
    );
  }
});

test('remediation syllable parts concatenate to their displayed Arabic target words', () => {
  const plan = generateAdaptiveRemediationPlan({
    studentName: 'طفل تجريبي',
    gradeLevel: 3,
    effectiveWords: [],
    targetsTeacherReviewed: false,
  });

  for (const drill of plan.syllableDrills) {
    assert.equal(
      normalizeArabic(drill.syllables.join('')),
      normalizeArabic(drill.targetWord),
      `Syllable parts do not match target word ${drill.targetWord}`,
    );
  }
});

test('generic practice does not claim eye-tracking observations or individualized treatment', () => {
  const plan = generateAdaptiveRemediationPlan({
    studentName: 'طفل تجريبي',
    gradeLevel: 3,
    effectiveWords: ['الحديقة', 'المكتبة'],
    targetsTeacherReviewed: false,
  });

  assert.match(plan.learningRationale, /أمثلة تعليمية وليست أخطاء مرصودة/);
  assert.doesNotMatch(plan.learningRationale, /تتبع حركة العين|جلسة علاجية|علاج عسر القراءة|القفزات التراجعية/);
  assert.equal(plan.pacerPassage.title, 'قصة قصيرة للقراءة والتظليل');
});

test('teacher-reviewed target status is stated narrowly and does not imply diagnosis', () => {
  const plan = generateAdaptiveRemediationPlan({
    studentName: 'طفل تجريبي',
    gradeLevel: 4,
    effectiveWords: ['كلمة مستهدفة بالتحليل الذكي'],
    targetsTeacherReviewed: true,
  });

  assert.match(plan.learningRationale, /المستهدفة بالتحليل الذكي/);
  assert.match(plan.learningRationale, /لا تثبت النتائج وجود اضطراب/);
  assert.doesNotMatch(plan.learningRationale, /تشخيص مؤكد|خطة علاج معتمدة/);
});

test('curated activities pass structural checks used before model-generated activities are displayed', () => {
  const plan = generateAdaptiveRemediationPlan({
    studentName: 'طفل تجريبي',
    gradeLevel: 3,
    effectiveWords: [],
    targetsTeacherReviewed: false,
  });
  assert.equal(isStructurallyValidRemediationSessionPlan(plan), true);
});

test('structural checks reject mismatched Arabic syllables and phonics examples', () => {
  const plan = generateAdaptiveRemediationPlan({
    studentName: 'طفل تجريبي',
    gradeLevel: 3,
    effectiveWords: [],
    targetsTeacherReviewed: false,
  });
  const badSyllables = structuredClone(plan);
  badSyllables.syllableDrills[0].syllables = ['خَطَأ'];
  assert.equal(isStructurallyValidRemediationSessionPlan(badSyllables), false);

  const badPhonics = structuredClone(plan);
  badPhonics.phonicsDrills[0].spokenWord = 'كِتَاب';
  assert.equal(isStructurallyValidRemediationSessionPlan(badPhonics), false);
});

test('structural checks normalize Arabic diacritics when comparing target letters', () => {
  const plan = generateAdaptiveRemediationPlan({
    studentName: 'طفل تجريبي',
    gradeLevel: 3,
    effectiveWords: [],
    targetsTeacherReviewed: false,
  });
  const withDiacritics = structuredClone(plan);
  withDiacritics.phonicsDrills[0].options[0].letter = 'سَـ';
  assert.equal(isStructurallyValidRemediationSessionPlan(withDiacritics), true);
});

test('activity content changes across grade bands and number-line ranges match the band', () => {
  const lower = generateAdaptiveRemediationPlan({ studentName: 'test', gradeLevel: 1, effectiveWords: [], targetsTeacherReviewed: false });
  const middle = generateAdaptiveRemediationPlan({ studentName: 'test', gradeLevel: 3, effectiveWords: [], targetsTeacherReviewed: false });
  const upper = generateAdaptiveRemediationPlan({ studentName: 'test', gradeLevel: 6, effectiveWords: [], targetsTeacherReviewed: false });
  assert.notEqual(lower.phonicsDrills[0].spokenWord, middle.phonicsDrills[0].spokenWord);
  assert.notEqual(middle.phonicsDrills[0].spokenWord, upper.phonicsDrills[0].spokenWord);
  assert.equal(lower.mathDrills[0].max, 20);
  assert.equal(middle.mathDrills[0].max, 100);
  assert.equal(upper.mathDrills[0].max, 1000);
  assert.notEqual(lower.pacerPassage.words.join(' '), upper.pacerPassage.words.join(' '));
});

test('only a teacher-reviewed word present in the curated bank can influence the selected syllable practice', () => {
  const plan = generateAdaptiveRemediationPlan({ studentName: 'test', gradeLevel: 3, effectiveWords: ['سَمَكَةٌ'], targetsTeacherReviewed: true });
  assert.equal(normalizeArabic(plan.syllableDrills[0].targetWord), normalizeArabic('سَمَكَةٌ'));
  const unmatched = generateAdaptiveRemediationPlan({ studentName: 'test', gradeLevel: 3, effectiveWords: ['كلمة غير مدرجة'], targetsTeacherReviewed: true });
  assert.notEqual(normalizeArabic(unmatched.syllableDrills[0].targetWord), normalizeArabic('كلمة غير مدرجة'));
});

test('every grade band produces a structurally valid curated plan', () => {
  for (let gradeLevel = 1; gradeLevel <= 6; gradeLevel += 1) {
    const plan = generateAdaptiveRemediationPlan({
      studentName: 'طالب تجريبي',
      gradeLevel,
      effectiveWords: [],
      targetsTeacherReviewed: false,
    });
    assert.equal(
      isStructurallyValidRemediationSessionPlan(plan),
      true,
      `The curated plan for grade ${gradeLevel} must pass structural validation`,
    );
  }
});

test('each exact grade receives eight curated tasks per station and a different text from its adjacent grade', () => {
  for (let gradeLevel = 1; gradeLevel <= 6; gradeLevel += 1) {
    const plan = generateAdaptiveRemediationPlan({ studentName: 'test', gradeLevel, effectiveWords: [], targetsTeacherReviewed: false });
    assert.equal(plan.phonicsDrills.length, 8);
    assert.equal(plan.syllableDrills.length, 8);
    assert.equal(plan.mathDrills.length, 8);
    assert.ok(plan.pacerPassage.words.length >= 20);
    assert.ok(isStructurallyValidRemediationSessionPlan(plan));
  }
  for (const [firstGrade, secondGrade] of [[1, 2], [3, 4], [5, 6]]) {
    const first = generateAdaptiveRemediationPlan({ studentName: 'test', gradeLevel: firstGrade, effectiveWords: [], targetsTeacherReviewed: false });
    const second = generateAdaptiveRemediationPlan({ studentName: 'test', gradeLevel: secondGrade, effectiveWords: [], targetsTeacherReviewed: false });
    assert.notDeepEqual(first.phonicsDrills.map((item) => item.spokenWord), second.phonicsDrills.map((item) => item.spokenWord));
    assert.notDeepEqual(first.syllableDrills.map((item) => item.targetWord), second.syllableDrills.map((item) => item.targetWord));
    assert.notDeepEqual(first.mathDrills.map((item) => item.targetNumber), second.mathDrills.map((item) => item.targetNumber));
    assert.notEqual(first.pacerPassage.words.join(' '), second.pacerPassage.words.join(' '));
  }
});

test('teacher-reviewed words can select matching practice from the expanded bank', () => {
  const oddGrade = generateAdaptiveRemediationPlan({ studentName: 'test', gradeLevel: 3, effectiveWords: ['سَمَكَةٌ'], targetsTeacherReviewed: true });
  assert.equal(normalizeArabic(oddGrade.syllableDrills[0].targetWord), normalizeArabic('سَمَكَةٌ'));
  const evenGrade = generateAdaptiveRemediationPlan({ studentName: 'test', gradeLevel: 4, effectiveWords: ['مَدِينَة'], targetsTeacherReviewed: true });
  assert.equal(normalizeArabic(evenGrade.syllableDrills[0].targetWord), normalizeArabic('مَدِينَة'));
});
