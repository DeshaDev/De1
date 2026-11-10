/**
 * Pilot evidence: the three questions an external reviewer asks, answered from the children's own
 * records, pooled over a pilot group.
 * 1. Does the voice scoring agree with an adult listener? (audioAgreement.ts)
 * 2. Did the provisional starting-level rule match the children's answers? (placement.ts)
 * 3. Did reading improve on untrained words, beyond the trained skills? (transferProbe.ts)
 *
 * The summary reports what was measured and how many children it rests on. It does not claim
 * efficacy: without a comparison group (children who did not train, or trained later), a gain can
 * also come from school teaching or growing up. The pilot protocol adds that comparison
 * (docs/PILOT_PROTOCOL_AR.md).
 */
import type { StudentRecord } from '../data/seedData';
import { agreementPairs, audioAgreement, type AudioAgreement } from './audioAgreement';
import { placementAgreement, type PlacementAgreement } from './placement';
import { summarizeProbes } from './progressProbe';
import { summarizeTransfer } from './transferProbe';

export interface PilotSummary {
  children: number;
  screened: number;
  inProgramme: number;
  audio: AudioAgreement | null;
  /** Children who contributed adult marks. */
  audioChildren: number;
  placement: PlacementAgreement | null;
  transfer: {
    /** Children with a start and an end (or middle) measure. */
    n: number;
    meanRealChange: number | null;
    meanNonwordChange: number | null;
    /** Same children: mean change on the trained-skill probe, for comparison. */
    meanTrainedProbeChange: number | null;
  };
}

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export function pilotSummary(students: StudentRecord[]): PilotSummary {
  const real = students.filter((s) => !s.isDemoRecord);
  const pairs = real.flatMap((s) => agreementPairs(s.cognitiveBattery?.results ?? {}));
  const audioChildren = real.filter((s) => agreementPairs(s.cognitiveBattery?.results ?? {}).length > 0).length;
  const placements = real.flatMap((s) => s.trainingProgress?.placements ?? []);

  const realChanges: number[] = [];
  const nonwordChanges: number[] = [];
  const probeChanges: number[] = [];
  for (const s of real) {
    const t = summarizeTransfer(s.trainingProgress?.transfer ?? []);
    if (!t || t.points < 2) continue;
    realChanges.push(t.realChange);
    nonwordChanges.push(t.nonwordChange);
    const probe = summarizeProbes(s.trainingProgress?.probes ?? []);
    if (probe && probe.count >= 2) probeChanges.push(probe.change);
  }

  return {
    children: real.length,
    screened: real.filter((s) => s.cognitiveBattery?.summary).length,
    inProgramme: real.filter((s) => s.trainingProgress).length,
    audio: audioAgreement(pairs),
    audioChildren,
    placement: placementAgreement(placements),
    transfer: {
      n: realChanges.length,
      meanRealChange: mean(realChanges),
      meanNonwordChange: mean(nonwordChanges),
      meanTrainedProbeChange: mean(probeChanges),
    },
  };
}

/** Plain-text report (Arabic), for the pilot team and funders. Every number states its sample size. */
export function pilotReportAr(summary: PilotSummary): string {
  const n = (v: number | null, unit = '') => (v === null ? '—' : `${v}${unit}`);
  const lines = [
    '# ملخص أدلة التجربة الميدانية',
    '',
    `الأطفال: ${summary.children} · أكملوا جزءًا من الفحص: ${summary.screened} · في البرنامج التدريبي: ${summary.inProgramme}`,
    '',
    '## ١. اتفاق التقييم الصوتي مع البالغ',
    summary.audio
      ? `${summary.audio.n} كلمة من ${summary.audioChildren} طفلًا · الاتفاق ${summary.audio.agreementPercent}٪ · كابا ${n(summary.audio.kappa)} · الأخطاء التي التقطها التقييم الآلي ${n(summary.audio.sensitivityPercent, '٪')} · الكلمات الصحيحة التي قبلها ${n(summary.audio.specificityPercent, '٪')}`
      : 'لا توجد بعد كلمات علّمها بالغ (فعّل «تحقق البالغ من التقييم الصوتي» عند بدء الفحص).',
    '',
    '## ٢. مطابقة قاعدة مستوى البداية لإجابات الأطفال',
    summary.placement
      ? `${summary.placement.n} تحققًا · طابقت القاعدة ${summary.placement.agreementPercent}٪ · بدأ الطفل أعلى من اقتراحها ${summary.placement.placedHigher} مرة وأدنى ${summary.placement.placedLower} مرة`
      : 'لا توجد بعد تحققات من مستوى البداية.',
    '',
    '## ٣. القراءة على كلمات لم يتدرّب عليها الأطفال',
    summary.transfer.n > 0
      ? `${summary.transfer.n} طفلًا لهم قياس في البداية وبعدها · متوسط التغيّر: كلمات حقيقية ${n(summary.transfer.meanRealChange)} نقطة، كلمات مصنوعة ${n(summary.transfer.meanNonwordChange)} نقطة · مقياس المهارات المدرَّبة للأطفال أنفسهم ${n(summary.transfer.meanTrainedProbeChange)} نقطة`
      : 'لا يوجد بعد أطفال لهم قياس في البداية وبعدها.',
    '',
    'حدود التفسير: هذه نتائج وصفية من الأطفال المشاركين فقط. لا تثبت فاعلية البرنامج دون مجموعة مقارنة لم تتدرّب (أو تدرّبت لاحقًا)، ولا تُعمَّم على أطفال آخرين قبل تجربة مضبوطة.',
  ];
  return lines.join('\n');
}
