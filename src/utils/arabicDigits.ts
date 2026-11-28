/** Show Western digits as Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) in child- and parent-facing text. */
export const toArabicNum = (v: number | string): string => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

export interface ArabicNounForms {
  singular: string;
  dual: string;
  plural: string;
  accusative?: string;
}

/**
 * Formats an Arabic count with grammatically accurate Tamyeez (التمييز):
 * - 1: singular (e.g. جلسة واحدة) or count + noun
 * - 2: dual (e.g. جلستان)
 * - 3–10: plural (e.g. ٣ جلسات)
 * - 11–99: singular accusative (e.g. ١٩ مهارةً)
 * - 0 / 100+: singular genitive (e.g. ١٠٠ جلسة)
 */
export function formatArabicCount(count: number, forms: ArabicNounForms): string {
  const n = Math.max(0, Math.floor(Math.abs(count)));
  const mod100 = n % 100;
  if (n === 1) return `${toArabicNum(1)} ${forms.singular}`;
  if (n === 2) return forms.dual;
  if (mod100 >= 3 && mod100 <= 10) return `${toArabicNum(n)} ${forms.plural}`;
  if (mod100 >= 11 && mod100 <= 99) return `${toArabicNum(n)} ${forms.accusative ?? forms.singular}`;
  return `${toArabicNum(n)} ${forms.singular}`;
}
