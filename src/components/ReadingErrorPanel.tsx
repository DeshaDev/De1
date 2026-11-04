import React, { useMemo, useState } from 'react';
import { analyseReadingErrors, type ReadWord } from '../utils/readingErrorPatterns';
import { loadTrainingProgress, saveTrainingProgress } from '../cognitiveProfile/storage';
import { SKILLS, applyReadingTargets } from '../cognitiveProfile/training';

const PENDING_KEY = (studentId: string) => `baseera.readingTargets.v1.${studentId}`;
const arNum = (n: number) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const times = (n: number) => (n === 1 ? 'مرة واحدة' : n === 2 ? 'مرتين' : `${arNum(n)} ${n <= 10 ? 'مرات' : 'مرة'}`);

/** Targets saved before the child has a programme; the programme applies them when it starts. */
export function takePendingReadingTargets(studentId: string): Parameters<typeof applyReadingTargets>[1] | null {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY(studentId));
    if (!raw) return null;
    window.localStorage.removeItem(PENDING_KEY(studentId));
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Error patterns from the speech-recognition check of one oral reading, and the exercises they lead to. */
export function ReadingErrorPanel({ words, passageId, studentId }: { words: ReadWord[]; passageId: string; studentId: string }) {
  const profile = useMemo(() => analyseReadingErrors(words, passageId), [words, passageId]);
  const [applied, setApplied] = useState<string | null>(null);
  const hasPatterns = profile.letterConfusions.length + profile.longVowelErrors.length + profile.wholeWordSubstitutions.length + profile.omittedWords.length > 0;

  const apply = () => {
    const rec = { ...profile.recommendations, passageId, analysedAt: profile.analysedAt };
    const progress = loadTrainingProgress(studentId);
    if (!progress) {
      try {
        window.localStorage.setItem(PENDING_KEY(studentId), JSON.stringify(rec));
      } catch {
        // Storage unavailable: nothing is saved, and the message says so.
        setApplied('تعذّر الحفظ على هذا الجهاز.');
        return;
      }
      setApplied('حُفظت التمارين، وستُضاف تلقائيًا عند بدء البرنامج التدريبي.');
      return;
    }
    const { progress: next, added } = applyReadingTargets(progress, rec);
    saveTrainingProgress(studentId, next);
    setApplied(
      added.length > 0
        ? `أُضيفت إلى البرنامج: ${added.map((s) => SKILLS[s].nameAr).join('، ')}، وصارت التمارين تركّز على أخطائه.`
        : 'صارت تمارين البرنامج تركّز على هذه الأخطاء.'
    );
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 text-right" aria-labelledby="reading-patterns-title">
      <h3 id="reading-patterns-title" className="font-black text-slate-900">تحليل أنماط الأخطاء (بالتعرّف على الكلام)</h3>
      {!hasPatterns ? (
        <p className="text-sm text-slate-700">لم تظهر أنماط أخطاء في هذه القراءة.</p>
      ) : (
        <ul className="space-y-2 text-sm text-slate-800">
          {profile.letterConfusions.map((c) => (
            <li key={c.pair.join('')}>
              <strong>{c.kind === 'sound' ? 'أصوات متقاربة' : 'حروف متشابهة الشكل'}: {c.pair.join(' / ')}</strong> ({times(c.count)}) — مثل: {c.examples.map((e) => `«${e.target}» قُرئت «${e.spoken}»`).join('، ')}
            </li>
          ))}
          {profile.longVowelErrors.length > 0 && (
            <li>
              <strong>حروف المد:</strong> {profile.longVowelErrors.slice(0, 3).map((e) => `«${e.target}» قُرئت «${e.spoken}»`).join('، ')}
            </li>
          )}
          {profile.wholeWordSubstitutions.length > 0 && (
            <li>
              <strong>كلمة بكلمة أخرى:</strong> {profile.wholeWordSubstitutions.slice(0, 3).map((e) => `«${e.target}» ← «${e.spoken}»`).join('، ')}
            </li>
          )}
          {profile.omittedWords.length > 0 && (
            <li>
              <strong>كلمات لم تُقرأ:</strong> {profile.omittedWords.slice(0, 6).join('، ')}
            </li>
          )}
        </ul>
      )}
      {profile.recommendations.reasonsAr.length > 0 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-950 space-y-1">
          <p className="font-bold">التمارين المقترحة</p>
          <ul className="list-disc pr-5 space-y-1">
            {profile.recommendations.reasonsAr.map((r) => <li key={r}>{r}</li>)}
          </ul>
          {profile.recommendations.skills.length > 0 && !applied && (
            <button type="button" onClick={apply} className="mt-2 bz-btn bz-btn-primary bz-btn-sm">
              أضِف هذه التمارين إلى برنامج الطفل
            </button>
          )}
          {applied && <p role="status" className="font-semibold">{applied}</p>}
        </div>
      )}
      <ul className="text-xs text-slate-500 space-y-0.5">
        {profile.limitsAr.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </section>
  );
}

export default ReadingErrorPanel;
