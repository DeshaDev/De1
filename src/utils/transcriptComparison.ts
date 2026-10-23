export interface TranscriptComparison {
  status: 'exact_match' | 'transcript_difference' | 'unavailable';
  labelArabic: string;
  notes: string;
}

export interface ArabicTranscriptComparisonResult {
  normalizedExpected: string;
  normalizedRecognized: string;
  exactMatch: boolean;
  comparison: TranscriptComparison;
}

/** Normalize Arabic text for conservative comparison with a single displayed word. */
export function normalizeArabicTranscript(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[ـ]/g, '')
    .replace(/[\s.,،؛:!?؟'"“”(){}\[\]\-]/g, '')
    .trim();
}

/**
 * Compare text returned by browser speech recognition with the target.
 * This is a string comparison only—not a measure of pronunciation or phonological skill.
 */
export function compareArabicTranscript(
  expected: string,
  recognized: string
): ArabicTranscriptComparisonResult {
  const normalizedExpected = normalizeArabicTranscript(expected);
  const normalizedRecognized = normalizeArabicTranscript(recognized);

  if (!normalizedRecognized) {
    return {
      normalizedExpected,
      normalizedRecognized,
      exactMatch: false,
      comparison: {
        status: 'unavailable',
        labelArabic: 'لم يتوفر تفريغ نصي واضح',
        notes: 'لم يُرجع المتصفح نصًا نهائيًا واضحًا. أعد المحاولة أو استمع إلى التسجيل وراجعه يدويًا.',
      },
    };
  }

  if (normalizedRecognized === normalizedExpected) {
    return {
      normalizedExpected,
      normalizedRecognized,
      exactMatch: true,
      comparison: {
        status: 'exact_match',
        labelArabic: 'التفريغ يطابق الكلمة المستهدفة نصيًا',
        notes: 'هذه مطابقة نصية بعد تطبيع التشكيل وعلامات الترقيم؛ لا تثبت وحدها صحة النطق ولا تقيس الوعي الفونولوجي.',
      },
    };
  }

  return {
    normalizedExpected,
    normalizedRecognized,
    exactMatch: false,
    comparison: {
      status: 'transcript_difference',
      labelArabic: 'اختلاف بين التفريغ والكلمة المستهدفة',
      notes: 'قد يرجع الاختلاف إلى التعرف الصوتي أو اللهجة أو التسجيل أو طريقة النطق. استمع إلى التسجيل وراجع التفريغ يدويًا قبل تفسيره.',
    },
  };
}
