import React, { useEffect } from 'react';
import { ArrowRight, Printer, Dumbbell, AlertTriangle, Info, Check, X } from 'lucide-react';
import { BATTERY, SUBTESTS_BY_ID, SubtestId, subtestsForAge } from '../../cognitiveProfile/battery';
import { ageCautionAr, CognitiveAudioAssessmentEvidence, CognitiveProfile, ScoredSubtest, formatAge } from '../../cognitiveProfile/scoring';
import { FLAG_TEXT_AR, SUBTEST_GUIDANCE, WORD_NONWORD_NOTE_AR, readingMeasureLineAr } from '../../cognitiveProfile/guidance';
import { SPELL_ERROR_TEXT_AR } from '../../cognitiveProfile/readingTasks';
import { DIALECT_SENSITIVE_ITEMS, type BatterySession, type ScreeningSnapshot } from '../../cognitiveProfile/storage';
import { BrandMark } from '../ui/BrandMark';

const toArabicDigits = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/** Within-task bands, used only to order what to praise and what to practise; not norms. */
type Band = 'good' | 'building' | 'practice';
const bandOf = (percent: number): Band => (percent >= 85 ? 'good' : percent >= 60 ? 'building' : 'practice');
const BAND_TEXT: Record<Band, { label: string; className: string; bar: string }> = {
  good: { label: 'أداء جيد', className: 'bg-emerald-50 text-emerald-800 border-emerald-200', bar: 'bg-emerald-500' },
  building: { label: 'يحتاج تثبيتًا', className: 'bg-amber-50 text-amber-900 border-amber-200', bar: 'bg-amber-500' },
  practice: { label: 'يحتاج تدريبًا', className: 'bg-rose-50 text-rose-800 border-rose-200', bar: 'bg-rose-500' },
};

const WORD_STATUS: Record<CognitiveAudioAssessmentEvidence['words'][number]['errorType'], { text: string; ok: boolean | null }> = {
  None: { text: 'صحيحة', ok: true },
  DialectVariant: { text: 'صحيحة (نطق لهجي مقبول)', ok: true },
  Mispronunciation: { text: 'نطق غير دقيق', ok: false },
  Substitution: { text: 'قُرئت كلمة أخرى', ok: false },
  Omission: { text: 'لم تُقرأ', ok: false },
  Insertion: { text: 'كلمة زائدة', ok: false },
  Unconfirmed: { text: 'غير مؤكدة', ok: null },
};

/** Tasks read aloud whose word-by-word result is shown to the adult. */
const WORD_DETAIL_TASKS: SubtestId[] = ['wordReading', 'nonwordReading', 'oralReading'];

interface Props {
  profile: CognitiveProfile;
  session: BatterySession;
  onBack: () => void;
  onStartTraining: () => void;
  previous?: ScreeningSnapshot | null;
}

function resultLine(scored: ScoredSubtest): string {
  return (
    readingMeasureLineAr(scored.subtestId, scored) ??
    `${toArabicDigits(scored.correct)} من ${toArabicDigits(scored.total)} إجابة صحيحة`
  );
}

export function ProfileReportView({ profile, session, onBack, onStartTraining, previous = null }: Props) {
  const ageTasks = subtestsForAge(session.ageMonths);
  const scoredById = new Map(profile.subtests.map((s) => [s.subtestId, s]));
  // One ordered list: every task of this child's battery, plus any older result outside it.
  const taskOrder: SubtestId[] = [
    ...ageTasks.map((t) => t.id),
    ...BATTERY.filter((t) => scoredById.has(t.id) && !ageTasks.some((a) => a.id === t.id)).map((t) => t.id),
  ];
  const withScore = profile.subtests.filter((s) => s.scoreAvailable !== false);
  const noVoiceScore = profile.subtests.filter((s) => s.scoreAvailable === false);
  const notDone = taskOrder.filter((id) => !scoredById.has(id));
  const good = withScore.filter((s) => bandOf(s.percent) === 'good');
  const needsWork = withScore.filter((s) => bandOf(s.percent) !== 'good').sort((a, b) => a.percent - b.percent);

  const dialectNotes = session.dialect
    ? (session.results.auditoryDiscrimination?.responses ?? [])
        .filter((r) => !r.correct && DIALECT_SENSITIVE_ITEMS[r.itemId]?.dialects.includes(session.dialect!))
        .map((r) => DIALECT_SENSITIVE_ITEMS[r.itemId].pairAr)
    : [];
  const wordDetails = WORD_DETAIL_TASKS.map((id) => ({
    id,
    evidence: scoredById.get(id)?.scoreAvailable !== false ? session.results[id]?.audioAssessment : undefined,
  })).filter((d): d is { id: SubtestId; evidence: CognitiveAudioAssessmentEvidence } => Boolean(d.evidence?.words?.length));
  const word = scoredById.get('wordReading');
  const nonword = scoredById.get('nonwordReading');
  const spelling = scoredById.get('spelling');
  const testedDate = new Date(session.startedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const caution = ageCautionAr(session.ageMonths);

  // Folded sections must be open on paper.
  useEffect(() => {
    const openAll = () => document.querySelectorAll<HTMLDetailsElement>('.print-report-root details').forEach((d) => { d.open = true; });
    window.addEventListener('beforeprint', openAll);
    return () => window.removeEventListener('beforeprint', openAll);
  }, []);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <button type="button" onClick={onBack} className="bz-btn bz-btn-ghost">
          <ArrowRight className="w-4 h-4" /> العودة إلى الألعاب
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="bz-btn bz-btn-secondary">
            <Printer className="w-4 h-4" /> طباعة / PDF
          </button>
          <button type="button" onClick={onStartTraining} className="bz-btn bz-btn-primary">
            <Dumbbell className="w-4 h-4" /> الانتقال إلى البرنامج التدريبي
          </button>
        </div>
      </div>

      <article className="print-report-root bz-card overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        <header className="px-5 sm:px-10 pt-8 pb-6 border-b border-line flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <BrandMark size={44} />
            <div>
              <p className="bz-small text-brand font-semibold">هَيَّا نَقْرَأْ · تقرير فحص مهارات القراءة</p>
              <h1 className="bz-h2 mt-1" style={{ fontSize: 'clamp(24px, 2.6vw, 32px)' }}>{session.childName}</h1>
              <p className="bz-small text-ink-2 mt-1">العمر عند الفحص: <strong className="text-ink">{toArabicDigits(formatAge(profile.ageMonths))}</strong></p>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 bz-small">
            <dt className="bz-muted">تاريخ الفحص</dt>
            <dd className="text-ink font-semibold">{testedDate}</dd>
            {session.examinerName && (
              <>
                <dt className="bz-muted">الفاحص</dt>
                <dd className="text-ink font-semibold">{session.examinerName}</dd>
              </>
            )}
            <dt className="bz-muted">المهام المكتملة</dt>
            <dd className="text-ink font-semibold bz-num">{toArabicDigits(taskOrder.length - notDone.length)} من {toArabicDigits(taskOrder.length)}</dd>
          </dl>
        </header>

        <div className="px-5 sm:px-10 py-8 space-y-10">
          {profile.ageOutOfRange && (
            <p className="flex gap-2 bz-small rounded-xl p-3 bg-warn-soft text-warn font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-1" />
              العمر خارج النطاق الذي صُمّم له هذا الفحص؛ لا تعتمد على هذا التقرير ولا على أي تفسير لنتائجه.
            </p>
          )}

          {/* 1. Summary */}
          <section aria-labelledby="summary-title" className="space-y-4">
            <h2 id="summary-title" className="bz-h3" style={{ fontSize: 22 }}>الخلاصة</h2>
            {withScore.length === 0 ? (
              <p className="bz-small text-ink-2">لا توجد بعد مهام مكتملة بدرجة صالحة لعرض خلاصة.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                  <h3 className="font-bold text-emerald-900">ما أتقنه الطفل</h3>
                  {good.length > 0 ? (
                    <ul className="mt-2 space-y-1.5 bz-small text-ink">
                      {good.map((s) => (
                        <li key={s.subtestId} className="flex gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{SUBTESTS_BY_ID[s.subtestId].skillNameAr}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 bz-small text-ink-2">لم تصل أي مهمة بعد إلى مستوى الإتقان (٨٥٪ فأكثر).</p>
                  )}
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                  <h3 className="font-bold text-amber-950">ما يحتاج إلى تدريب (الأضعف أولًا)</h3>
                  {needsWork.length > 0 ? (
                    <ul className="mt-2 space-y-1.5 bz-small text-ink">
                      {needsWork.map((s) => (
                        <li key={s.subtestId} className="flex gap-2">
                          <span className="text-amber-700 shrink-0">●</span>
                          <span>{SUBTESTS_BY_ID[s.subtestId].skillNameAr} <span className="bz-muted bz-num">({toArabicDigits(s.percent)}٪)</span></span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 bz-small text-ink-2">لا توجد مهارة ضعيفة في المهام المكتملة.</p>
                  )}
                </div>
              </div>
            )}
            {word?.scoreAvailable && nonword?.scoreAvailable && word.percent - nonword.percent >= 25 && (
              <p className="rounded-xl bg-soft p-4 bz-small text-ink-2">
                <strong className="text-ink">
                  كلمات حقيقية {toArabicDigits(word.percent)}٪ · كلمات مصنوعة {toArabicDigits(nonword.percent)}٪.
                </strong>{' '}
                {WORD_NONWORD_NOTE_AR}
              </p>
            )}
            {(noVoiceScore.length > 0 || notDone.length > 0) && (
              <div className="rounded-xl border border-line p-4 bz-small text-ink-2 space-y-1">
                {notDone.length > 0 && (
                  <p><strong className="text-ink">لم تُنجز بعد:</strong> {notDone.map((id) => SUBTESTS_BY_ID[id].gameNameAr).join('، ')}. أكملها لتكتمل الصورة.</p>
                )}
                {noVoiceScore.length > 0 && (
                  <p><strong className="text-ink">بلا تقييم صوتي:</strong> {noVoiceScore.map((s) => SUBTESTS_BY_ID[s.subtestId].gameNameAr).join('، ')} — لم يصل تقييم آلي صالح للتسجيل، فلم تُحتسب. يمكن إعادة اللعبة.</p>
                )}
              </div>
            )}
            <div className="no-print">
              <button type="button" onClick={onStartTraining} className="bz-btn bz-btn-primary">
                <Dumbbell className="w-4 h-4" /> ابدأ التدريب على هذه المهارات
              </button>
            </div>
          </section>

          {/* 2. Every task once */}
          <section aria-labelledby="tasks-title" className="space-y-3">
            <h2 id="tasks-title" className="bz-h3" style={{ fontSize: 22 }}>نتيجة كل مهمة</h2>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {taskOrder.map((id) => {
                const task = SUBTESTS_BY_ID[id];
                const scored = scoredById.get(id);
                const band = scored && scored.scoreAvailable !== false ? bandOf(scored.percent) : null;
                return (
                  <li key={id} className="p-4 grid sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] gap-x-6 gap-y-2 items-center">
                    <div className="bz-small leading-snug">
                      <span className="font-semibold text-ink">{task.skillNameAr}</span>
                      <span className="block text-[12px] bz-muted">{task.icon} {task.gameNameAr}</span>
                    </div>
                    <div className="space-y-1.5">
                      {!scored ? (
                        <p className="bz-small bz-muted">لم تُنجز بعد.</p>
                      ) : scored.scoreAvailable === false ? (
                        <p className="bz-small text-ink-2">لم يتوفر تقييم صوتي صالح؛ لم تُحتسب.</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="bz-small text-ink-2 bz-num">{resultLine(scored)}</span>
                            <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${BAND_TEXT[band!].className}`}>
                              {BAND_TEXT[band!].label} · <span className="bz-num">{toArabicDigits(scored.percent)}٪</span>
                            </span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden bg-soft" role="img" aria-label={`${task.skillNameAr}: ${scored.percent}٪`}>
                            <span className={`block h-full rounded-full ${BAND_TEXT[band!].bar}`} style={{ width: scored.percent + '%' }} />
                          </div>
                        </>
                      )}
                      {scored && scored.flags.length > 0 && (
                        <p className="text-[12px] text-warn">{scored.flags.map((flag) => FLAG_TEXT_AR[flag]).filter(Boolean).join(' ')}</p>
                      )}
                      {id === 'auditoryDiscrimination' && dialectNotes.length > 0 && (
                        <p className="text-[12px] text-ink-2">أخطاء قد تعود إلى لهجة البيت: {dialectNotes.join('، ')}.</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 3. Word-by-word reading results (shown only here, never to the child) */}
          {(wordDetails.length > 0 || (spelling?.measures?.spellingErrors?.length ?? 0) > 0) && (
            <section aria-labelledby="words-title" className="space-y-4">
              <div>
                <h2 id="words-title" className="bz-h3" style={{ fontSize: 22 }}>تفاصيل القراءة كلمةً كلمة</h2>
                <p className="bz-small bz-muted mt-1">ما سمعه التقييم الآلي في كل كلمة. لم تُعرض هذه النتائج على الطفل أثناء الفحص.</p>
              </div>
              {wordDetails.map(({ id, evidence }) => {
                const wrong = evidence.words.filter((w) => WORD_STATUS[w.errorType]?.ok === false).length;
                return (
                  <details key={id} className="rounded-2xl border border-line overflow-hidden" open={wrong > 0}>
                    <summary className="px-5 py-3 cursor-pointer bg-soft font-semibold text-ink bz-small">
                      {SUBTESTS_BY_ID[id].gameNameAr} — <span className="bz-num">{toArabicDigits(evidence.words.length - wrong)}</span> صحيحة، <span className="bz-num">{toArabicDigits(wrong)}</span> بها خطأ
                    </summary>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse min-w-[420px]">
                        <thead>
                          <tr className="text-ink-2 bg-card">
                            <th className="px-3 py-2 text-right font-semibold">الكلمة</th>
                            <th className="px-3 py-2 text-right font-semibold">النتيجة</th>
                            <th className="px-3 py-2 text-right font-semibold">ما سُمع</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evidence.words.map((w, i) => {
                            const status = WORD_STATUS[w.errorType] ?? { text: w.errorType, ok: null };
                            return (
                              <tr key={`${w.word}-${i}`} className="border-t border-line">
                                <td className="px-3 py-2 font-bold text-ink text-base" lang="ar">{w.word}</td>
                                <td className={`px-3 py-2 ${status.ok === false ? 'text-rose-700' : status.ok ? 'text-emerald-700' : 'text-ink-2'}`}>
                                  <span className="inline-flex items-center gap-1">
                                    {status.ok === false ? <X className="w-4 h-4" /> : status.ok ? <Check className="w-4 h-4" /> : null}
                                    {status.text}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-ink-2" lang="ar">{status.ok === false && w.spokenWord && w.spokenWord !== w.word ? w.spokenWord : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
              {spelling?.measures?.spellingErrors && spelling.measures.spellingErrors.length > 0 && (
                <div className="rounded-2xl border border-line p-4 bz-small text-ink-2">
                  <p className="font-semibold text-ink">أخطاء الإملاء حسب النوع</p>
                  <ul className="mt-2 space-y-1">
                    {spelling.measures.spellingErrors.map((e) => (
                      <li key={e.kind}>{SPELL_ERROR_TEXT_AR[e.kind]}: <span className="bz-num">{toArabicDigits(e.count)}</span> {e.count === 1 ? 'كلمة' : 'كلمات'}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* 4. Practice ideas, only where practice is needed */}
          {needsWork.length > 0 && (
            <section aria-labelledby="practice-title" className="space-y-3">
              <h2 id="practice-title" className="bz-h3" style={{ fontSize: 22 }}>كيف تساعد طفلك</h2>
              {needsWork.map((s) => {
                const guidance = SUBTEST_GUIDANCE[s.subtestId];
                if (!guidance) return null;
                return (
                  <details key={s.subtestId} className="rounded-2xl border border-line overflow-hidden">
                    <summary className="px-5 py-3 cursor-pointer font-semibold text-ink">{SUBTESTS_BY_ID[s.subtestId].skillNameAr}</summary>
                    <div className="px-5 pb-5 pt-2 border-t border-line space-y-3 bz-small">
                      <p className="text-ink-2"><strong className="text-ink">لماذا تهم: </strong>{guidance.whyItMattersAr}</p>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="rounded-xl p-4 bg-sun-soft">
                          <p className="font-semibold text-ink">في البيت</p>
                          <ul className="list-disc pr-5 mt-2 space-y-1.5 text-ink-2">
                            {guidance.homeActivitiesAr.map((a) => <li key={a}>{a}</li>)}
                          </ul>
                        </div>
                        <div className="rounded-xl p-4 bg-soft">
                          <p className="font-semibold text-ink">في الصف</p>
                          <ul className="list-disc pr-5 mt-2 space-y-1.5 text-ink-2">
                            {guidance.strategiesAr.map((a) => <li key={a}>{a}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })}
            </section>
          )}

          {previous && (
            <p className="bz-small text-ink-2 rounded-xl border border-line p-4">
              يوجد فحص سابق بتاريخ {new Date(previous.completedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })} ({toArabicDigits(previous.completedSubtests)} مهام مكتملة).
            </p>
          )}

          <section className="rounded-2xl bg-soft p-5 bz-small text-ink-2 space-y-2">
            <p className="flex items-center gap-1.5 font-semibold text-ink"><Info className="w-4 h-4" /> حدود التفسير</p>
            {caution && <p className="font-semibold text-ink">{caution}</p>}
            <p>
              النسب هي الإجابات الصحيحة داخل كل مهمة، وليست مقارنة بأطفال آخرين أو تشخيصًا لعسر القراءة. قد يتأثر الأداء بالتعب والانتباه وجودة الصوت. إذا استمرت مخاوفك بشأن قراءة طفلك، فاطلب تقييمًا لدى أخصائي مؤهل.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}

export default ProfileReportView;
