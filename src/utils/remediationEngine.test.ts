import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAdaptiveRemediationPlan } from './remediationEngine.ts';

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
    effectiveWords: ['الساقية', 'البستان'],
    targetsTeacherReviewed: false,
  });

  assert.match(plan.clinicalRationale, /أمثلة تعليمية وليست أخطاء مرصودة/);
  assert.doesNotMatch(plan.clinicalRationale, /تتبع حركة العين|جلسة علاجية|علاج عسر القراءة|القفزات التراجعية/);
  assert.equal(plan.pacerPassage.title, 'قصة قصيرة للقراءة والتظليل');
});

test('teacher-reviewed target status is stated narrowly and does not imply diagnosis', () => {
  const plan = generateAdaptiveRemediationPlan({
    studentName: 'طفل تجريبي',
    gradeLevel: 4,
    effectiveWords: ['كلمة راجعها المعلّم'],
    targetsTeacherReviewed: true,
  });

  assert.match(plan.clinicalRationale, /راجعها المعلم/);
  assert.match(plan.clinicalRationale, /لا يثبت وجود اضطراب/);
  assert.doesNotMatch(plan.clinicalRationale, /تشخيص مؤكد|خطة علاج معتمدة/);
});
