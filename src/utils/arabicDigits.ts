/** Show Western digits as Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) in child- and parent-facing text. */
export const toArabicNum = (v: number | string): string => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
