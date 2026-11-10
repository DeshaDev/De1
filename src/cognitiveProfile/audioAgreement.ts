/**
 * How well does the automatic voice scoring agree with an adult listening to the same child?
 *
 * In an accuracy study the adult marks each voice-scored word (right / wrong) before seeing the
 * engine's verdict (ReadListAudioPlayer, verifyByAdult). This module turns those pairs into the usual
 * agreement statistics, with the adult as the reference:
 * - percent agreement;
 * - Cohen's kappa, which discounts the agreement expected by chance (Cohen, 1960). As a rough guide
 *   (Landis & Koch, 1977): above 0.80 almost perfect, 0.61–0.80 substantial, 0.41–0.60 moderate;
 * - sensitivity: of the words the adult heard as wrong, the share the engine also marked wrong
 *   (a missed error means a child's difficulty goes unnoticed);
 * - specificity: of the words the adult heard as right, the share the engine also marked right
 *   (a false error discourages the child and distorts the profile).
 * One child gives a small sample; the pilot pools all children (scripts/pilot-report.ts).
 */
import type { SubtestId } from './battery';
import type { SubtestResult } from './scoring';

const VOICE_SCORED: SubtestId[] = ['wordReading', 'nonwordReading'];

export interface AgreementPair {
  /** Engine verdict. */
  engine: boolean;
  /** Adult verdict, the reference. */
  human: boolean;
}

export interface AudioAgreement {
  n: number;
  agreementPercent: number;
  /** Null when kappa is undefined (all words in one category for both raters). */
  kappa: number | null;
  /** Share of adult-heard errors the engine also caught (0–100), null when the adult heard none. */
  sensitivityPercent: number | null;
  /** Share of adult-heard correct words the engine also accepted (0–100), null when there were none. */
  specificityPercent: number | null;
  /** Counts: engine wrong & adult wrong, engine wrong & adult right, engine right & adult wrong, both right. */
  table: { bothWrong: number; engineOnlyWrong: number; engineMissed: number; bothRight: number };
}

export function agreementPairs(results: Partial<Record<SubtestId, SubtestResult>>): AgreementPair[] {
  const pairs: AgreementPair[] = [];
  for (const id of VOICE_SCORED) {
    for (const r of results[id]?.responses ?? []) {
      if (typeof r.humanCorrect === 'boolean') pairs.push({ engine: r.correct, human: r.humanCorrect });
    }
  }
  return pairs;
}

export function audioAgreement(pairs: AgreementPair[]): AudioAgreement | null {
  const n = pairs.length;
  if (n === 0) return null;
  const bothWrong = pairs.filter((p) => !p.engine && !p.human).length;
  const engineOnlyWrong = pairs.filter((p) => !p.engine && p.human).length;
  const engineMissed = pairs.filter((p) => p.engine && !p.human).length;
  const bothRight = pairs.filter((p) => p.engine && p.human).length;
  const observed = (bothWrong + bothRight) / n;
  const engineRight = (engineMissed + bothRight) / n;
  const humanRight = (engineOnlyWrong + bothRight) / n;
  const expected = engineRight * humanRight + (1 - engineRight) * (1 - humanRight);
  const kappa = expected >= 1 ? null : Number(((observed - expected) / (1 - expected)).toFixed(2));
  const humanWrong = bothWrong + engineMissed;
  const humanRightCount = bothRight + engineOnlyWrong;
  return {
    n,
    agreementPercent: Math.round(observed * 100),
    kappa,
    sensitivityPercent: humanWrong > 0 ? Math.round((bothWrong / humanWrong) * 100) : null,
    specificityPercent: humanRightCount > 0 ? Math.round((bothRight / humanRightCount) * 100) : null,
    table: { bothWrong, engineOnlyWrong, engineMissed, bothRight },
  };
}

export function kappaLabelAr(kappa: number | null): string {
  if (kappa === null) return 'غير قابل للحساب (كل الكلمات في فئة واحدة)';
  if (kappa > 0.8) return 'اتفاق شبه تام';
  if (kappa > 0.6) return 'اتفاق كبير';
  if (kappa > 0.4) return 'اتفاق متوسط';
  if (kappa > 0.2) return 'اتفاق ضعيف';
  return 'اتفاق ضعيف جدًا';
}
