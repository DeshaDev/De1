import { PHRASES } from '../../cognitiveProfile/phrases';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  Headphones,
  PauseCircle,
  Play,
  RotateCcw,
  Volume2,
  ChevronDown,
  ArrowLeft as ArrowLeftIcon,
  Cloud,
  AlertTriangle,
} from 'lucide-react';
import type { StudentRecord } from '../../data/seedData';
import {
  ChoiceSubtest,
  DOMAINS,
  SUBTESTS_BY_ID,
  Subtest,
  SubtestId,
  minutesForAge,
  scoredItemCount,
  sittingsForAge,
  subtestsForAge,
} from '../../cognitiveProfile/battery';
import { READING_MIN_AGE_MONTHS } from '../../cognitiveProfile/readingTasks';
import {
  ItemResponse,
  SubtestResult,
  ageCautionAr,
  buildProfile,
  maxSpanFrom,
  shouldDiscontinue,
  shouldStopSpan,
} from '../../cognitiveProfile/scoring';
import {
  DIALECT_LABELS_AR,
  type HomeDialect,
  BatterySession,
  clearBatterySession,
  loadBatterySession,
  loadScreeningHistory,
  saveScreeningHistory,
  type ScreeningSnapshot,
  saveBatterySession,
} from '../../cognitiveProfile/storage';
import { AssociationPlayer, ChoicePlayer, PalPlayer, SpanPlayer } from './TaskPlayers';
import { SpellingPlayer } from './ReadingPlayers';
import { trackUsage } from '../../utils/usageTracking';
import { SyncState, batterySessionFromRecord, canSyncToSchool, syncBatteryToSchool, trainingFromRecord } from '../../cognitiveProfile/sync';
import { summarizeBattery } from '../../cognitiveProfile/records';
import { speak, stopSpeech } from './audio';
import ProfileReportView from './ProfileReportView';
import TrainingProgramView from './TrainingProgramView';

const toArabicDigits = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/**
 * The games in short sittings of about 10-15 minutes (three before six, four from six with the
 * reading sitting first), so a young child is never asked for half an hour of attention at once.
 * Progress is saved after every game, so each sitting can be on a different day.
 */
const sittingMinutes = (games: Subtest[]) => games.reduce((n, s) => n + s.minutes, 0);

// ---------------------------------------------------------------------------
// Subtest runner
// ---------------------------------------------------------------------------
type Stage = 'intro' | 'practice' | 'transition' | 'test' | 'done';

function SubtestRunner({
  subtest,
  onFinish,
  onExit,
}: {
  subtest: Subtest;
  onFinish: (result: SubtestResult) => void;
  onExit: () => void;
}) {
  const [stage, setStage] = useState<Stage>('intro');
  const [index, setIndex] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const responses = useRef<ItemResponse[]>([]);

  useEffect(() => {
    speak(subtest.introAudio);
    return () => stopSpeech();
  }, [subtest.id]);

  const practiceCount =
    subtest.kind === 'choice' ||
    subtest.kind === 'span' ||
    subtest.kind === 'association' ||
    subtest.kind === 'spelling'
      ? subtest.practice.length
      : 0;
  /** Rapid naming, the passage and paired learning run their own short lead-in instead of practice items. */
  const noPractice = subtest.kind === 'pal' || subtest.kind === 'ran' || subtest.kind === 'passage' || subtest.kind === 'readList';
  const total = scoredItemCount(subtest);

  const finish = (discontinued: boolean, extra: Partial<SubtestResult> = {}) => {
    stopSpeech();
    onFinish({
      subtestId: subtest.id,
      responses: responses.current,
      discontinued,
      completedAt: new Date().toISOString(),
      ...extra,
    });
    setStage('done');
    speak(PHRASES.gameOver);
  };

  const startTest = () => {
    setIndex(0);
    setStage('transition');
    speak(PHRASES.testStarts);
  };

  const nextPractice = () => {
    if (index + 1 < practiceCount) setIndex(index + 1);
    else startTest();
  };

  const recordAndAdvance = (newResponses: ItemResponse[]) => {
    responses.current = [...responses.current, ...newResponses];
    if (subtest.kind === 'choice' || subtest.kind === 'readList' || subtest.kind === 'spelling') {
      if (shouldDiscontinue(responses.current, subtest.discontinueAfter)) return finish(true);
      if (index + 1 >= subtest.items.length) return finish(false);
    } else if (subtest.kind === 'span') {
      const lengths = subtest.trials.map((t) => t.sequence.length);
      const maxSpan = maxSpanFrom(lengths, responses.current);
      if (shouldStopSpan(lengths, responses.current)) return finish(true, { maxSpan });
      if (index + 1 >= subtest.trials.length) return finish(false, { maxSpan });
    } else if (subtest.kind === 'association') {
      const blockCorrect = newResponses.filter((r) => r.correct).length;
      if (index >= 1 && blockCorrect === 0) return finish(true);
      if (index + 1 >= subtest.blocks.length) return finish(false);
    }
    setIndex(index + 1);
  };

  const answered = stage === 'test' ? responses.current.length : 0;

  return (
    <div className="bz-card overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }} dir="rtl">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-line bg-soft">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-card text-2xl shrink-0" aria-hidden="true">{subtest.icon}</span>
          <div className="min-w-0">
            <p className="font-child font-bold text-ink leading-tight text-lg truncate">{subtest.gameNameAr}</p>
            <p className="text-[12px] text-muted truncate">{subtest.skillNameAr}</p>
          </div>
        </div>
        {stage !== 'done' && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('إيقاف هذه اللعبة؟ لن تُحفظ إجاباتها، ويمكن إعادتها لاحقًا.')) onExit();
            }}
            className="bz-btn bz-btn-ghost bz-btn-sm"
          >
            <PauseCircle className="w-4 h-4" /> إيقاف
          </button>
        )}
      </div>

      {(stage === 'practice' || (stage === 'test' && !noPractice)) && (
        <div className="px-4 sm:px-6 pt-4">
          <div className="flex items-center justify-between text-[12px] font-semibold text-muted mb-1.5">
            <span>{stage === 'practice' ? 'تدريب مع تصحيح' : 'اللعبة'}</span>
            {stage === 'test' && !noPractice && <span className="bz-num">{toArabicDigits(answered)} / {toArabicDigits(total)}</span>}
          </div>
          <div className="bz-progress">
            <span
              style={{ width: stage === 'practice' ? '100%' : `${(answered / total) * 100}%`, background: stage === 'practice' ? 'var(--sun)' : 'var(--brand)' }}
            />
          </div>
        </div>
      )}

      <div className="p-5 sm:p-10 min-h-[460px] flex flex-col items-center justify-center">
        {stage === 'intro' && (
          <div className="flex flex-col items-center text-center gap-5 max-w-xl">
            <span className="grid place-items-center w-36 h-36 rounded-[40px] bg-sun-soft text-8xl animate-bounce-gentle" aria-hidden="true">{subtest.icon}</span>
            <h2 className="font-child text-4xl font-bold text-ink" style={{ fontFamily: 'var(--font-child)' }}>{subtest.gameNameAr}</h2>
            <button
              type="button"
              onClick={() => speak(subtest.introAudio)}
              className="bz-btn bz-btn-secondary"
            >
              <Volume2 className="w-4 h-4" /> استمع للتعليمات
            </button>
            <button
              type="button"
              onClick={() => {
                stopSpeech();
                if (noPractice) setStage('test');
                else {
                  setIndex(0);
                  setStage('practice');
                }
              }}
              className="font-child bz-btn bz-btn-sun bz-btn-lg text-xl px-10"
            >
              <Play className="w-6 h-6" /> {noPractice ? 'ابدأ' : 'لنتدرّب أولًا'}
            </button>
            <div className="w-full text-right">
              <button
                type="button"
                onClick={() => setShowNote(!showNote)}
                className="bz-btn bz-btn-ghost bz-btn-sm"
                aria-expanded={showNote}
              >
                <ClipboardList className="w-3.5 h-3.5" /> ملاحظة للفاحص
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNote ? 'rotate-180' : ''}`} />
              </button>
              {showNote && (
                <p className="mt-2 bz-small text-ink-2 bz-card-quiet p-4">
                  {subtest.examinerNoteAr}
                </p>
              )}
            </div>
          </div>
        )}

        {stage === 'practice' && subtest.kind === 'choice' && (
          <ChoicePlayer key={`p-${index}`} item={subtest.practice[index]} showFeedback onDone={nextPractice} />
        )}
        {stage === 'practice' && subtest.kind === 'span' && (
          <SpanPlayer key={`p-${index}`} trial={subtest.practice[index]} modality={subtest.modality} showFeedback onDone={nextPractice} />
        )}
        {stage === 'practice' && subtest.kind === 'association' && (
          <AssociationPlayer key={`p-${index}`} block={subtest.practice[index]} showFeedback onDone={nextPractice} />
        )}
        {stage === 'practice' && subtest.kind === 'spelling' && (
          <SpellingPlayer key={`p-${index}`} item={subtest.practice[index]} practice onDone={nextPractice} />
        )}

        {stage === 'transition' && (
          <div className="flex flex-col items-center gap-5 text-center">
            <span className="grid place-items-center w-28 h-28 rounded-full bg-sun-soft text-7xl" aria-hidden="true">🌟</span>
            <p className="font-child text-3xl font-bold text-ink">رائع! الآن نبدأ اللعبة</p>
            <p className="bz-body max-w-sm">لن تظهر الإجابة الصحيحة الآن؛ حاول أفضل ما تستطيع.</p>
            <button
              type="button"
              onClick={() => {
                stopSpeech();
                setStage('test');
              }}
              className="font-child bz-btn bz-btn-sun bz-btn-lg text-xl px-10"
            >
              <Play className="w-6 h-6" /> هيا بنا
            </button>
          </div>
        )}

        {stage === 'test' && subtest.kind === 'choice' && (
          <ChoicePlayer
            key={`t-${index}`}
            item={(subtest as ChoiceSubtest).items[index]}
            showFeedback={false}
            allowReplay={subtest.id !== 'auditoryDiscrimination'}
            onDone={(r) => recordAndAdvance([r])}
          />
        )}
        {stage === 'test' && subtest.kind === 'span' && (
          <SpanPlayer key={`t-${index}`} trial={subtest.trials[index]} modality={subtest.modality} showFeedback={false} onDone={(r) => recordAndAdvance([r])} />
        )}
        {stage === 'test' && subtest.kind === 'association' && (
          <AssociationPlayer key={`t-${index}`} block={subtest.blocks[index]} showFeedback={false} onDone={(rs) => recordAndAdvance(rs)} />
        )}
        {stage === 'test' && (subtest.kind === 'readList' || subtest.kind === 'ran' || subtest.kind === 'passage') && (
          <section className="w-full max-w-xl rounded-2xl border border-line bg-soft p-6 text-center space-y-4" role="status" dir="rtl">
            <span className="text-4xl" aria-hidden="true">🎧</span>
            <h3 className="font-child text-xl font-bold text-ink">التقييم الصوتي الآلي غير متاح لهذه المهمة بعد</h3>
            <p className="bz-small text-ink-2 leading-7">
              لن نطلب من شخص آخر تصحيح قراءة الطفل أو عدّ أخطائه. لا تُحتسب هذه المهمة درجةً إلى أن يكتمل ربط التسجيل بالتقييم الآلي والتحقق من النتيجة على الخادم.
            </p>
            <button
              type="button"
              className="bz-btn bz-btn-primary bz-btn-lg"
              onClick={() => finish(false)}
            >
              حفظ المهمة دون درجة
            </button>
          </section>
        )}
        {stage === 'test' && subtest.kind === 'spelling' && (
          <SpellingPlayer key={`t-${index}`} item={subtest.items[index]} practice={false} onDone={(r) => recordAndAdvance([r])} />
        )}
        {stage === 'test' && subtest.kind === 'pal' && (
          <PalPlayer
            creatures={subtest.creatures}
            blocks={subtest.blocks}
            onDone={(rs, blockScores) => {
              responses.current = rs;
              finish(false, { blockScores });
            }}
          />
        )}

        {stage === 'done' && (
          <div className="flex flex-col items-center gap-5 text-center">
            <span className="grid place-items-center w-32 h-32 rounded-full bg-sun-soft text-8xl" aria-hidden="true">🏆</span>
            <p className="font-child text-3xl font-bold text-ink">أحسنت! أنهيت «{subtest.gameNameAr}»</p>
            <button
              type="button"
              onClick={onExit}
              className="bz-btn bz-btn-primary bz-btn-lg"
            >
              العودة إلى خريطة الألعاب
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup form
// ---------------------------------------------------------------------------
/** Demo and guest records have no recorded consent; a real screening gets its own learner record. */
function needsOwnRecord(student: StudentRecord): boolean {
  return student.isDemoRecord === true || student.guardianConsentGiven !== true;
}

function SetupView({
  student,
  supabaseUser,
  onStart,
  onNavigateTab,
}: {
  student: StudentRecord;
  supabaseUser?: any;
  onStart: (s: BatterySession) => void;
  onNavigateTab?: (tab: string) => void;
}) {
  const ageIsSupported = Number.isInteger(student.ageYears) && student.ageYears >= 4 && student.ageYears <= 8;
  const defaultYears = ageIsSupported ? student.ageYears : 6;
  const [name, setName] = useState(needsOwnRecord(student) ? '' : student.name);
  const [years, setYears] = useState(defaultYears);
  const [months, setMonths] = useState(0);
  const [examiner, setExaminer] = useState('');
  const [dialect, setDialect] = useState<HomeDialect | ''>('');
  const [checks, setChecks] = useState({ consent: false, quiet: false, headphones: false, ready: false });
  const allChecked = checks.consent && checks.quiet && checks.headphones && checks.ready;

  if (!ageIsSupported) {
    return (
      <section className="bz-card bz-card-pad max-w-2xl mx-auto space-y-3" dir="rtl" role="alert">
        <h2 className="bz-h3">هذا الفحص غير متاح لهذا العمر</h2>
        <p className="bz-body">البطارية الحالية مصممة للأطفال من ٤ إلى ٨ سنوات. العمر المسجل لهذا الملف هو {toArabicDigits(student.ageYears)} سنوات؛ لن نستبدل العمر تلقائيًا بعمر افتراضي، ولا ينبغي اختيار عمر أصغر لتجاوز هذا القيد.</p>
        <p className="bz-small bz-muted">يمكن استخدام القارئ الميسّر والأنشطة التعليمية العامة، أو تصحيح العمر المسجل إذا كان غير دقيق.</p>
      </section>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6 items-start" dir="rtl">
      <section className="bz-card bz-card-pad space-y-8">
        <div className="space-y-5">
          {supabaseUser ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 font-bold flex items-center gap-2">
              <Cloud className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>متصل بحساب الأسرة ({supabaseUser.email}) — سيتم حفظ نتائج الفحص تلقائياً في قاعدة البيانات السحابية ☁️</span>
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-3.5 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">وضع الفحص السريع على هذا المتصفح (محلي)</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    لن يُحفظ ملف الطفل في قاعدة البيانات السحابية إلا بحساب ولي أمر.
                  </p>
                </div>
              </div>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('parent-portal')}
                  className="bz-btn bz-btn-secondary bz-btn-sm whitespace-nowrap self-start sm:self-center font-bold text-xs"
                >
                  تسجيل حساب الأسرة لحفظ النتائج ☁️
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-8 h-8 rounded-full bg-brand text-on-brand font-bold bz-num">١</span>
            <h2 className="bz-h3">بيانات الطفل</h2>
          </div>
          <label className="bz-field">
            <span className="bz-label">اسم الطفل أو لقبه</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="bz-input" />
          </label>
          <div className="bz-field">
            <span className="bz-label">العمر بدقة</span>
            <div className="grid grid-cols-2 gap-3">
              <label className="bz-field">
                <span className="bz-hint">السنوات</span>
                <select value={years} onChange={(e) => setYears(Number(e.target.value))} className="bz-input">
                  {[4, 5, 6, 7, 8].map((y) => <option key={y} value={y}>{toArabicDigits(y)} سنوات</option>)}
                </select>
              </label>
              <label className="bz-field">
                <span className="bz-hint">الأشهر</span>
                <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="bz-input">
                  {Array.from({ length: 12 }, (_, m) => <option key={m} value={m}>{toArabicDigits(m)} {m === 1 ? 'شهر' : 'أشهر'}</option>)}
                </select>
              </label>
            </div>
            <span className="bz-hint">يساعد العمر الدقيق على وصف ظروف أداء الطفل بحذر. النتائج الحالية وصفية داخل الأنشطة وليست مقارنة معيارية بالأقران.</span>
            {ageCautionAr(years * 12 + months) && (
              <p className="rounded-xl bg-warn-soft p-3 bz-small text-ink-2">{ageCautionAr(years * 12 + months)}</p>
            )}
          </div>
          <label className="bz-field">
            <span className="bz-label">لهجة الطفل في البيت</span>
            <select value={dialect} onChange={(e) => setDialect(e.target.value as HomeDialect | '')} className="bz-input">
              <option value="">اختر اللهجة</option>
              {(Object.keys(DIALECT_LABELS_AR) as HomeDialect[]).map((d) => (
                <option key={d} value={d}>{DIALECT_LABELS_AR[d]}</option>
              ))}
            </select>
            <span className="bz-hint">بعض اللهجات تدمج أصواتًا مثل ث/س وذ/ز؛ نستخدم اللهجة لتفسير هذه البنود بإنصاف.</span>
          </label>
          <label className="bz-field">
            <span className="bz-label">اسم الفاحص <span className="bz-muted font-normal">(المعلم أو الأخصائي أو ولي الأمر)</span></span>
            <input value={examiner} onChange={(e) => setExaminer(e.target.value)} className="bz-input" />
          </label>
        </div>

        <hr className="bz-divider" />

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-8 h-8 rounded-full bg-brand text-on-brand font-bold bz-num">٢</span>
              <h2 className="bz-h3">قبل البدء</h2>
            </div>
            <button type="button" onClick={() => speak(PHRASES.soundCheck)} className="bz-btn bz-btn-secondary bz-btn-sm">
              <Headphones className="w-4 h-4" /> اختبار الصوت
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {([
              ['quiet', 'المكان هادئ'],
              ['headphones', 'الصوت واضح (يُفضَّل سماعات)'],
              ['ready', 'الطفل مرتاح ومستعد'],
            ] as const).map(([key, label]) => (
              <label key={key} className="bz-check">
                <input type="checkbox" checked={checks[key]} onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })} />
                <span className="font-semibold text-ink-2">{label}</span>
              </label>
            ))}
            <label className="bz-check sm:col-span-2">
              <input type="checkbox" checked={checks.consent} onChange={(e) => setChecks({ ...checks, consent: e.target.checked })} />
              <span className="text-ink-2">
                <span className="font-semibold text-ink">موافقة ولي الأمر</span>
                <span className="block bz-small bz-muted">أقر بصفتي ولي أمر الطفل بأنني وافقت على إجراء هذه الأنشطة وحفظ نتائجها في ملف الطفل داخل المنصة وفق سياسة الخصوصية. هذا إقرار ذاتي تسجله المنصة، ولا تتحقق المنصة من هويتي أو من صحة الصفة المعلنة.</span>
              </span>
            </label>
          </div>
        </div>

        <button
          type="button"
          disabled={!allChecked || !name.trim()}
          onClick={() =>
            onStart({
              studentId: student.id,
              childName: name.trim(),
              ageMonths: years * 12 + months,
              examinerName: examiner.trim(),
              startedAt: new Date().toISOString(),
              ...(dialect ? { dialect } : {}),
              results: {},
            })
          }
          className="bz-btn bz-btn-primary bz-btn-lg bz-btn-block"
        >
          <Play className="w-5 h-5" /> بدء الفحص
        </button>
        {!supabaseUser && (
          <p className="text-xs text-slate-500 text-center mt-2">
            ملاحظة: هذا فحص سريع على هذا الجهاز؛ يمكنك لاحقاً ربطه وحفظه في السحابة من بوابة الأسرة.
          </p>
        )}
      </section>

      <aside className="space-y-4">
        <div className="bz-card-quiet p-6">
          <h2 className="bz-h3">كيف يسير الفحص؟</h2>
          <ul className="mt-4 space-y-3 bz-small text-ink-2">
            {[
              `قبل السادسة: ${toArabicDigits(subtestsForAge(READING_MIN_AGE_MONTHS - 1).length)} ألعاب قصيرة في ثلاث جلسات (نحو ${toArabicDigits(minutesForAge(READING_MIN_AGE_MONTHS - 1))} دقيقة).`,
              `من السادسة: ${toArabicDigits(subtestsForAge(READING_MIN_AGE_MONTHS).length)} مهمة في أربع جلسات (نحو ${toArabicDigits(minutesForAge(READING_MIN_AGE_MONTHS))} دقيقة)، أولها جلسة القراءة: كلمات حقيقية، وكلمات مصنوعة، وقصة قصيرة، والتسمية السريعة. والإملاء في الجلسة الأخيرة.`,
              'كل لعبة تبدأ بتدريب قصير مع تصحيح، ثم بنود الفحص دون تصحيح.',
              'يجلس ولي الأمر بالقرب من الطفل لمساندته فقط، ولا يصحّح القراءة أو يعدّ الأخطاء. مهام القراءة والتسمية لا تنتج درجة حتى يتوفر التقييم الصوتي الآلي الموثّق.',
              'إذا تعب الطفل أو تشتّت، أوقف اللعبة وأكملها لاحقًا. يُحفظ التقدّم تلقائيًا.',
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <CheckCircle2 className="w-[18px] h-[18px] text-brand shrink-0 mt-1" aria-hidden="true" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bz-card p-6">
          <h2 className="font-semibold text-ink">ما الذي نقيسه</h2>
          <ul className="mt-3 grid grid-cols-1 gap-2">
            {Object.values(DOMAINS).map((d) => (
              <li key={d.nameAr} className="flex items-center gap-2.5 bz-small text-ink-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} aria-hidden="true" />
                {d.nameAr}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function ReportViewTracker({ children }: { children: React.ReactNode }) {
  useEffect(() => trackUsage('report_viewed'), []);
  return <>{children}</>;
}

function SyncBadge({ state, onRetry }: { state: SyncState; onRetry: () => void }) {
  if (state === 'saved') return <span className="bz-badge bz-badge-brand"><CheckCircle2 className="w-3.5 h-3.5" /> محفوظ في سجل المدرسة</span>;
  if (state === 'saving') return <span className="bz-badge bz-badge-neutral">جارٍ الحفظ في سجل المدرسة…</span>;
  if (state === 'error')
    return (
      <span className="inline-flex items-center gap-2">
        <span className="bz-badge bz-badge-warn">تعذّر الحفظ في سجل المدرسة · النتائج محفوظة على هذا الجهاز</span>
        <button type="button" className="bz-link bz-small" onClick={onRetry}>إعادة المحاولة</button>
      </span>
    );
  return <span className="bz-badge bz-badge-neutral" title="سجّل دخول المدرسة لحفظ النتائج في سجل الطالب">محفوظ على هذا الجهاز فقط</span>;
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
type View = { name: 'setup' } | { name: 'map' } | { name: 'run'; id: SubtestId } | { name: 'report' } | { name: 'training' };

interface Props {
  activeStudent: StudentRecord;
  initialView?: 'map' | 'training';
  /** Called with true while a child is playing, so the host can hide surrounding chrome. */
  onFocusModeChange?: (focused: boolean) => void;
  /** Called with the server copy after results are saved to the school record. */
  onRecordUpdated?: (student: StudentRecord) => void;
  /** Open an optional extra activity (practice games or the reader). */
  onOpenExtra?: (tab: 'remediation-gym' | 'adaptive-reader' | 'reading-lab') => void;
  /** Create a real learner record (used when the active record is a demo); returns its id. */
  onCreateLearner?: (input: { name: string; ageYears: number; examinerName: string }) => string | null;
  supabaseUser?: any;
  onNavigateTab?: (tab: string) => void;
}

export function CognitiveBatteryView({ activeStudent, initialView = 'map', onFocusModeChange, onRecordUpdated, onCreateLearner, onOpenExtra, supabaseUser, onNavigateTab }: Props) {
  const [trainingRunning, setTrainingRunning] = useState(false);
  const syncEnabled = canSyncToSchool(activeStudent);
  const [syncState, setSyncState] = useState<SyncState>(syncEnabled && activeStudent.cognitiveBattery ? 'saved' : 'local');
  const loadInitial = () => loadBatterySession(activeStudent.id) ?? batterySessionFromRecord(activeStudent);
  const [session, setSession] = useState<BatterySession | null>(loadInitial);

  const pushToSchool = (s: BatterySession) => {
    if (!syncEnabled) {
      // Family accounts and devices without a school: keep the result in the child's record too,
      // so the app can save it to the family's database. The summary is computed on this device.
      if (!activeStudent.isDemoRecord && s.studentId === activeStudent.id) {
        onRecordUpdated?.({
          ...activeStudent,
          cognitiveBattery: {
            ageMonths: s.ageMonths,
            examinerName: s.examinerName,
            startedAt: s.startedAt,
            dialect: s.dialect,
            updatedAt: new Date().toISOString(),
            results: s.results,
            summary: summarizeBattery(s.results, s.ageMonths),
          },
        });
      }
      return;
    }
    setSyncState('saving');
    syncBatteryToSchool(s, activeStudent)
      .then((student) => {
        setSyncState('saved');
        if (student) onRecordUpdated?.(student);
      })
      .catch(() => setSyncState('error'));
  };
  const [view, setView] = useState<View>(() =>
    initialView === 'training' ? { name: 'training' } : session ? { name: 'map' } : { name: 'setup' }
  );

  useEffect(() => {
    const loaded = loadInitial();
    setSession(loaded);
    setView(initialView === 'training' ? { name: 'training' } : loaded ? { name: 'map' } : { name: 'setup' });
  }, [activeStudent.id, initialView]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [view.name, trainingRunning]);

  const focused = view.name === 'run' || (view.name === 'training' && trainingRunning);
  useEffect(() => {
    onFocusModeChange?.(focused);
  }, [focused, onFocusModeChange]);
  useEffect(() => () => onFocusModeChange?.(false), [onFocusModeChange]);

  const profile = useMemo(
    () => (session && Object.keys(session.results).length > 0 ? buildProfile(session.results, session.ageMonths) : null),
    [session]
  );

  const ageTasks = session ? subtestsForAge(session.ageMonths) : [];
  const sittings = session ? sittingsForAge(session.ageMonths) : [];
  const completed = ageTasks.filter((s) => session?.results[s.id]);
  const localHistory = loadScreeningHistory(activeStudent.id);
  const previousScreenings = localHistory.length > 0 ? localHistory : activeStudent.screeningHistory ?? [];
  const nextSubtest = ageTasks.find((s) => !session?.results[s.id]);
  const remainingMinutes = ageTasks.filter((s) => !session?.results[s.id]).reduce((sum, s) => sum + s.minutes, 0);
  const nextSitting = nextSubtest ? sittings.findIndex((games) => games.some((g) => g.id === nextSubtest.id)) : -1;
  /** The child just completed a whole sitting: a natural place to stop for today. */
  const sittingJustFinished =
    nextSitting > 0 && sittings[nextSitting].every((g) => !session?.results[g.id]) && sittings[nextSitting - 1].every((g) => session?.results[g.id]);

  const saveResult = (result: SubtestResult) => {
    if (!session) return;
    const updated = { ...session, results: { ...session.results, [result.subtestId]: result } };
    trackUsage('subtest_completed', { subtestId: result.subtestId, discontinued: result.discontinued });
    const tasks = subtestsForAge(session.ageMonths);
    const wasComplete = tasks.every((s) => session.results[s.id]);
    if (!wasComplete && tasks.every((s) => updated.results[s.id])) trackUsage('battery_completed');
    setSession(updated);
    saveBatterySession(updated);
    pushToSchool(updated);
  };

  if (view.name === 'training') {
    return (
      <TrainingProgramView
        studentId={activeStudent.id}
        childName={session?.childName ?? activeStudent.name}
        profile={profile}
        onBack={() => setView(!session ? { name: 'setup' } : profile ? { name: 'report' } : { name: 'map' })}
        onGoToBattery={() => setView(session ? { name: 'map' } : { name: 'setup' })}
        onRunningChange={setTrainingRunning}
        serverProgress={trainingFromRecord(activeStudent)}
        syncEnabled={syncEnabled}
        onRecordUpdated={onRecordUpdated}
        student={activeStudent}
        showBack={initialView !== 'training'}
        onOpenExtra={onOpenExtra}
      />
    );
  }

  if (view.name === 'setup' || !session) {
    return (
      <SetupView
        student={activeStudent}
        supabaseUser={supabaseUser}
        onNavigateTab={onNavigateTab}
        onStart={(s) => {
          trackUsage('battery_started');
          // Never record a real child's results under a demo record.
          if (needsOwnRecord(activeStudent) && onCreateLearner) {
            const newId = onCreateLearner({ name: s.childName, ageYears: Math.floor(s.ageMonths / 12), examinerName: s.examinerName });
            if (newId) {
              saveBatterySession({ ...s, studentId: newId });
              return; // the host selects the new learner and this view reloads their session
            }
          }
          setSession(s);
          saveBatterySession(s);
          setView({ name: 'map' });
        }}
      />
    );
  }

  if (view.name === 'run') {
    return (
      <SubtestRunner
        key={view.id}
        subtest={SUBTESTS_BY_ID[view.id]}
        onFinish={saveResult}
        onExit={() => setView({ name: 'map' })}
      />
    );
  }

  if (view.name === 'report' && profile) {
    return (
      <ReportViewTracker>
      <ProfileReportView
        profile={profile}
        session={session}
        previous={previousScreenings[previousScreenings.length - 1] ?? null}
        onBack={() => setView({ name: 'map' })}
        onStartTraining={() => setView({ name: 'training' })}
      />
      </ReportViewTracker>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <section className="bz-card bz-card-pad flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <SyncBadge state={syncEnabled ? syncState : 'local'} onRetry={() => pushToSchool(session)} />
          <p className="bz-small text-brand font-semibold mt-2">فحص {session.childName} · {toArabicDigits(Math.floor(session.ageMonths / 12))} سنوات و{toArabicDigits(session.ageMonths % 12)} أشهر</p>
          <h2 className="bz-h2 mt-1" style={{ fontSize: 'clamp(22px, 2.4vw, 30px)' }}>
            {completed.length === ageTasks.length ? 'اكتملت كل المهام' : `أُنجزت ${toArabicDigits(completed.length)} من ${toArabicDigits(ageTasks.length)} مهام`}
          </h2>
          <div className="mt-4 flex items-center gap-3 max-w-md">
            <div className="bz-progress flex-1"><span style={{ width: `${(completed.length / Math.max(1, ageTasks.length)) * 100}%` }} /></div>
            {remainingMinutes > 0 && <span className="bz-small bz-muted shrink-0">بقي نحو {toArabicDigits(remainingMinutes)} دقيقة</span>}
          </div>
          {nextSitting >= 0 && (
            <p className="bz-small text-ink-2 mt-3">
              {sittingJustFinished
                ? `أحسنت! انتهت الجلسة ${toArabicDigits(nextSitting)} من ${toArabicDigits(sittings.length)}. يمكن إكمال الجلسة التالية الآن أو في يوم آخر؛ التقدّم محفوظ.`
                : `جلسة اليوم: الجلسة ${toArabicDigits(nextSitting + 1)} من ${toArabicDigits(sittings.length)} (${toArabicDigits(sittings[nextSitting].length)} مهام، نحو ${toArabicDigits(sittingMinutes(sittings[nextSitting]))} دقيقة). يمكن التوقف بعدها وإكمال الباقي في يوم آخر.`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {nextSubtest && (
            <button type="button" onClick={() => setView({ name: 'run', id: nextSubtest.id })} className="bz-btn bz-btn-primary bz-btn-lg">
              <Play className="w-5 h-5" /> {completed.length === 0 ? 'ابدأ اللعبة الأولى' : 'اللعبة التالية'}
            </button>
          )}
          <button type="button" disabled={!profile} onClick={() => setView({ name: 'report' })} className="bz-btn bz-btn-secondary bz-btn-lg">
            <FileBarChart className="w-5 h-5" /> النتيجة والتقرير
          </button>
        </div>
      </section>

      {sittings.map((games, sitting) => (
        <section key={sitting} aria-labelledby={`sitting-${sitting}`} className="space-y-3">
          <h3 id={`sitting-${sitting}`} className="font-semibold text-ink flex flex-wrap items-baseline gap-2">
            الجلسة {toArabicDigits(sitting + 1)}
            {games.some((g) => g.domain === 'reading') && sitting === 0 && <span className="bz-small text-brand font-semibold">القراءة</span>}
            <span className="bz-small bz-muted font-normal">نحو {toArabicDigits(sittingMinutes(games))} دقيقة</span>
            {games.every((g) => session.results[g.id]) && <span className="bz-badge bz-badge-brand"><CheckCircle2 className="w-3.5 h-3.5" /> اكتملت</span>}
          </h3>
      <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((s) => {
          const done = Boolean(session.results[s.id]);
          const isNext = nextSubtest?.id === s.id;
          const domain = DOMAINS[s.domain];
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setView({ name: 'run', id: s.id })}
                className="bz-card bz-card-interactive w-full h-full p-5 flex flex-col gap-4"
                style={isNext ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 3px var(--brand-soft)' } : undefined}
              >
                <div className="flex items-start justify-between gap-3 w-full">
                  <span className="grid place-items-center w-16 h-16 rounded-2xl text-4xl" style={{ background: `color-mix(in srgb, ${domain.color} 12%, var(--card))` }} aria-hidden="true">{s.icon}</span>
                  {done ? (
                    <span className="bz-badge bz-badge-brand"><CheckCircle2 className="w-3.5 h-3.5" /> مكتملة</span>
                  ) : isNext ? (
                    <span className="bz-badge bz-badge-sun">التالية</span>
                  ) : (
                    <span className="bz-small bz-muted bz-num">{toArabicDigits(ageTasks.indexOf(s) + 1)} / {toArabicDigits(ageTasks.length)}</span>
                  )}
                </div>
                <div className="w-full">
                  <p className="font-child text-[22px] font-bold text-ink leading-snug">{s.gameNameAr}</p>
                  <p className="bz-small text-ink-2 mt-1">{s.skillNameAr}</p>
                </div>
                <div className="mt-auto w-full flex items-center justify-between text-[12px] font-semibold pt-3 border-t border-line">
                  <span style={{ color: domain.color }}>{domain.nameAr}</span>
                  <span className="bz-muted">{done ? 'إعادة اللعبة' : `≈ ${toArabicDigits(s.minutes)} دقائق`}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
        </section>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setView({ name: 'training' })} className="bz-link">
          الانتقال إلى البرنامج التدريبي الموجّه <ArrowLeftIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('سيُحفظ ملخص هذا الفحص للمقارنة، ثم يبدأ فحص جديد. متابعة؟')) {
              if (profile && profile.risk !== 'insufficient') {
                const snapshot: ScreeningSnapshot = {
                  completedAt: new Date().toISOString(),
                  ageMonths: profile.ageMonths,
                  risk: profile.risk,
                  completedSubtests: profile.subtests.length,
                  domains: profile.domains.map((d) => ({ domain: d.domain, centile: d.centile })),
                };
                const history = [...previousScreenings, snapshot].slice(-10);
                saveScreeningHistory(activeStudent.id, history);
                if (!activeStudent.isDemoRecord) onRecordUpdated?.({ ...activeStudent, screeningHistory: history });
              }
              clearBatterySession(activeStudent.id);
              setSession(null);
              setView({ name: 'setup' });
            }
          }}
          className="bz-btn bz-btn-ghost bz-btn-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" /> فحص جديد
        </button>
      </div>
    </div>
  );
}

export default CognitiveBatteryView;
