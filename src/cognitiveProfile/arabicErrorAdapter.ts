/**
 * Adaptive Arabic Error-to-Practice Engine (`هَيَّا نَقْرَأْ`).
 *
 * Inspects a learner's profile (`ageYears`, `gradeLevel`, `problematicWords`,
 * `verifiedWordsAlignment`, `cognitiveBattery`, and `readingRiskLevel`) to understand
 * specific Arabic reading & spelling errors rather than handing out generic word lists,
 * and builds an actionable daily training prescription while preserving specialized
 * dyslexia screening and intervention pathways.
 */
import type { StudentRecord } from '../data/seedData';
import type { SubtestId } from './battery';
import { toArabicNum } from '../utils/arabicDigits';

export type StudioTabId = 'foundations' | 'spelling' | 'fluency' | 'library';

export type ErrorPatternId =
  | 'early_foundations'
  | 'confusable_letters'
  | 'long_vowels'
  | 'taa_marbuta_endings'
  | 'phonemic_decoding'
  | 'connected_fluency'
  | 'dyslexia_support';

export interface DetectedErrorPattern {
  id: ErrorPatternId;
  labelAr: string;
  reasonAr: string;
  targetTab: StudioTabId | 'dyslexia-lab' | 'guided-program';
  targetSubMode?: string;
  ctaAr: string;
}

export interface AdaptivePrescription {
  headlineAr: string;
  detectedPatterns: DetectedErrorPattern[];
  recommendedLetterFocus: string;
  recommendedSpellingLessonId: string;
  recommendedStoryId: 'bithrat-noor' | 'paper-bird' | 'bousalat-salem';
}

const DIACRITICS_RE = /[\u064B-\u065F\u0670\u0640]/g;
const stripDiacritics = (text: string) => text.replace(DIACRITICS_RE, '').trim();

function formatArabicCountedWord(n: number): string {
  if (n === 1) return 'كلمة واحدة متعثرة';
  if (n === 2) return 'كلمتين متعثرتين';
  if (n >= 3 && n <= 10) return `${toArabicNum(n)} كلمات متعثرة`;
  return `${toArabicNum(n)} كلمةً متعثرة`;
}

const CONFUSABLE_PAIR_TRIGGERS: Array<{ pair: [string, string]; focusLetter: string; labelAr: string }> = [
  { pair: ['س', 'ص'], focusLetter: 'س', labelAr: 'التمييز بين السين والصاد (س / ص)' },
  { pair: ['ت', 'ط'], focusLetter: 'ت', labelAr: 'التمييز بين التاء والطاء (ت / ط)' },
  { pair: ['د', 'ض'], focusLetter: 'د', labelAr: 'التمييز بين الدال والضاد (د / ض)' },
  { pair: ['ذ', 'ز'], focusLetter: 'ذ', labelAr: 'التمييز بين الذال والزاي (ذ / ز)' },
  { pair: ['ق', 'ك'], focusLetter: 'ق', labelAr: 'التمييز بين القاف والكاف (ق / ك)' },
];

function isWeakSubtest(student: StudentRecord, id: SubtestId): boolean {
  const weaknesses = student.cognitiveBattery?.summary?.weaknesses ?? [];
  if (weaknesses.includes(id)) return true;
  const scored = student.cognitiveBattery?.summary?.subtests?.find((s) => s.subtestId === id);
  if (scored && (scored.total ?? 0) > 0 && scored.scoreAvailable !== false && scored.percent < 70) {
    return true;
  }
  const raw = student.cognitiveBattery?.results?.[id];
  if (raw && raw.responses.length > 0) {
    const correct = raw.responses.filter((r) => r.correct).length;
    if ((correct / raw.responses.length) * 100 < 70) return true;
  }
  return false;
}

export function buildAdaptiveArabicPrescription(
  student?: StudentRecord | null,
): AdaptivePrescription {
  const ageYears = student?.ageYears ?? 7;
  const gradeLevel = student?.gradeLevel ?? 1;
  const problematic = (student?.problematicWords ?? []).filter(Boolean);
  const alignment = student?.verifiedWordsAlignment ?? [];
  const sampleWords = [
    ...problematic,
    ...alignment
      .filter((w) => w.status === 'phonetic_substitution' || w.status === 'omitted')
      .map((w) => w.word),
  ];

  const patterns: DetectedErrorPattern[] = [];
  let recommendedLetterFocus = 'س';
  let recommendedSpellingLessonId = 'long_vowels';

  // 1. Early-years foundational path (ages 3–5 or Kindergarten)
  if (ageYears <= 5 || gradeLevel === 0) {
    recommendedLetterFocus = 'ب';
    patterns.push({
      id: 'early_foundations',
      labelAr: 'تأسيس الحروف والوعي الصوتي للمرحلة المبكرة',
      reasonAr: 'مناسب لعمر الطفولة المبكرة: نبدأ بسماع الصوت الأول ولعبة سلة الأصوات وتتبع الحروف.',
      targetTab: 'foundations',
      targetSubMode: 'basket',
      ctaAr: 'افتح سلة الأصوات والحروف',
    });
  }

  // 2. Inspect confusable pairs from oral reading / alignment substitutions
  const spokenSubstitutions = alignment
    .filter((w) => w.status === 'phonetic_substitution' && w.spokenWord)
    .map((w) => ({
      target: stripDiacritics(w.word),
      spoken: stripDiacritics(w.spokenWord || ''),
    }));

  let matchedConfusable: { focusLetter: string; labelAr: string } | null = null;
  // Pass 1: Prioritize documented spoken phonetic substitutions (e.g. سقر vs صقر)
  for (const trig of CONFUSABLE_PAIR_TRIGGERS) {
    const [a, b] = trig.pair;
    const hitInSub = spokenSubstitutions.some(
      ({ target, spoken }) =>
        (target.includes(a) && spoken.includes(b)) || (target.includes(b) && spoken.includes(a)),
    );
    if (hitInSub) {
      matchedConfusable = trig;
      break;
    }
  }
  // Pass 2: Fall back to matching characters within flagged words if no direct substitution matched
  if (!matchedConfusable) {
    for (const trig of CONFUSABLE_PAIR_TRIGGERS) {
      const [a, b] = trig.pair;
      const hitInWord = sampleWords.some((w) => {
        const clean = stripDiacritics(w);
        return clean.includes(a) || clean.includes(b);
      });
      if (hitInWord) {
        matchedConfusable = trig;
        break;
      }
    }
  }

  const weakDiscrimination =
    student != null &&
    (isWeakSubtest(student, 'auditoryDiscrimination') ||
      isWeakSubtest(student, 'visualDiscrimination') ||
      isWeakSubtest(student, 'letterSound'));

  if (matchedConfusable || weakDiscrimination) {
    recommendedLetterFocus = matchedConfusable?.focusLetter ?? 'ت';
    patterns.push({
      id: 'confusable_letters',
      labelAr: matchedConfusable ? matchedConfusable.labelAr : 'تمييز الحروف المتشابهة في الرسم والصوت',
      reasonAr: matchedConfusable
        ? `ظهرت كلمات تحتوي على أصوات متقاربة في قراءة الطفل، ولذلك صممنا جولة بالونات تركز على ${matchedConfusable.labelAr}.`
        : 'أظهرت مهام التمييز حاجة لتعزيز الربط السمعي والبصري للحروف المتقاربة.',
      targetTab: 'foundations',
      targetSubMode: 'balloon',
      ctaAr: 'تدرّب في صيد البالونات',
    });
  }

  // 3. Check spelling contrasts: taa marbuta vs haa/taa OR long vowels
  const hasTaaMarbutaTrigger = sampleWords.some((w) => {
    const clean = stripDiacritics(w);
    return clean.endsWith('ة') || clean.endsWith('ت') || clean.endsWith('ه');
  });
  const hasLongVowelTrigger = sampleWords.some((w) => {
    const clean = stripDiacritics(w);
    return clean.includes('ا') || clean.includes('و') || clean.includes('ي');
  });
  const weakSpelling = student != null && isWeakSubtest(student, 'spelling');

  if (hasTaaMarbutaTrigger) {
    recommendedSpellingLessonId = 'ta_marbuta_open';
    patterns.push({
      id: 'taa_marbuta_endings',
      labelAr: 'التفريق بين التاء المربوطة والمفتوحة والهاء',
      reasonAr: 'رصدنا كلمات تنتهي بالتاء أو الهاء في الكلمات التي تعثّر فيها الطفل؛ يتدرّب أولًا بقاعدة الوقف بالسكون.',
      targetTab: 'spelling',
      targetSubMode: 'ta_marbuta_open',
      ctaAr: 'تدرّب في مختبر الإملاء',
    });
  } else if (hasLongVowelTrigger || weakSpelling) {
    recommendedSpellingLessonId = 'long_vowels';
    patterns.push({
      id: 'long_vowels',
      labelAr: 'ضبط حروف المدّ الثلاثة (ا / و / ي) وبناء الكلمة',
      reasonAr: 'تقوية التمييز بين الحركة القصيرة وحرف المدّ الطويل لمنع حذف أو زيادة حروف المدّ.',
      targetTab: 'spelling',
      targetSubMode: 'long_vowels',
      ctaAr: 'افتح مختبر الإملاء',
    });
  }

  // 4. Phonemic / nonword / decoding weakness -> Movable Alphabet
  const weakPhonemic =
    student != null &&
    (isWeakSubtest(student, 'phonological') ||
      isWeakSubtest(student, 'rhyme') ||
      isWeakSubtest(student, 'nonwordReading') ||
      isWeakSubtest(student, 'wordReading') ||
      (student.cognitiveResults?.phonemicAwarenessScorePercent ?? 100) < 70);

  if (weakPhonemic) {
    patterns.push({
      id: 'phonemic_decoding',
      labelAr: 'تحليل الكلمات وتركيبها بالأبجدية المتحركة',
      reasonAr: 'لربط الصوت بالحرف وبناء الكلمة خطوةً بخطوة دون إرباك بصري.',
      targetTab: 'foundations',
      targetSubMode: 'movable',
      ctaAr: 'ركّب الكلمات بالأبجدية',
    });
  }

  // 5. Connected fluency / comprehension / specialized dyslexia track
  const needsDyslexiaSupport =
    student?.readingRiskLevel === 'high' ||
    student?.readingRiskLevel === 'moderate' ||
    student?.cognitiveBattery?.summary?.risk === 'high' ||
    student?.cognitiveBattery?.summary?.risk === 'moderate';

  const weakFluency =
    student != null &&
    (isWeakSubtest(student, 'oralReading') ||
      (typeof student.oralAccuracyPercent === 'number' && student.oralAccuracyPercent < 80));

  if (weakFluency) {
    patterns.push({
      id: 'connected_fluency',
      labelAr: 'الطلاقة الهادئة وقراءة العبارات المجمّعة',
      reasonAr: 'نقرأ عبارات قصيرة متصلة بتنغيم واضح ومعدل مريح يناسب الصف دون ضغط التوقيت.',
      targetTab: 'fluency',
      ctaAr: 'انتقل لمضمار الطلاقة',
    });
  }

  if (needsDyslexiaSupport) {
    patterns.push({
      id: 'dyslexia_support',
      labelAr: 'مسار الدعم المتخصص لصعوبات القراءة',
      reasonAr: 'تظهر مؤشرات تستحق متابعة أدق عبر البرنامج التدريبي المكيّف وأدوات فحص عسر القراءة.',
      targetTab: 'guided-program',
      ctaAr: 'افتح البرنامج المتخصص',
    });
  }

  // Fallback baseline progression when child hasn't logged errors yet
  if (patterns.length === 0) {
    patterns.push(
      {
        id: 'phonemic_decoding',
        labelAr: 'بناء الكلمات وتركيب المقاطع الصوتية',
        reasonAr: 'انطلاقة ممتعة بالأبجدية المتحركة الملوّنة لتثبيت الحركات والمدود.',
        targetTab: 'foundations',
        targetSubMode: 'movable',
        ctaAr: 'جرّب الأبجدية المتحركة',
      },
      {
        id: 'long_vowels',
        labelAr: 'مختبر الإملاء التفاعلي (٤ خطوات)',
        reasonAr: 'فهم القاعدة والمثال المحلول قبل التدريب الموجّه وتركيب الكلمة.',
        targetTab: 'spelling',
        targetSubMode: 'long_vowels',
        ctaAr: 'ابدأ درس الإملاء',
      },
    );
  }

  // Select developmentally tailored illustrated story
  let recommendedStoryId: AdaptivePrescription['recommendedStoryId'] = 'paper-bird';
  if (gradeLevel <= 1 || ageYears <= 6 || needsDyslexiaSupport) {
    recommendedStoryId = ageYears <= 6 || gradeLevel <= 1 ? 'bithrat-noor' : 'paper-bird';
  } else if (gradeLevel >= 3 || ageYears >= 8) {
    recommendedStoryId = weakFluency ? 'paper-bird' : 'bousalat-salem';
  }

  const childFirstName = student?.name?.trim() ? student.name.trim().split(/\s+/)[0] : 'البطل';
  const headlineAr =
    sampleWords.length > 0
      ? `تم تحليل ${formatArabicCountedWord(sampleWords.length)} وأداء ${childFirstName} لتخصيص تدريب اليوم:`
      : needsDyslexiaSupport
      ? `مسار متوازن لـ ${childFirstName} يجمع بين تأسيس العربية والدعم المخصص لصعوبات القراءة:`
      : `خطة ${childFirstName} الذكية اليوم لاكتساب القراءة والكتابة العربية بثقة:`;

  return {
    headlineAr,
    detectedPatterns: patterns,
    recommendedLetterFocus,
    recommendedSpellingLessonId,
    recommendedStoryId,
  };
}
