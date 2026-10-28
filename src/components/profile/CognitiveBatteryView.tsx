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
} from 'lucide-react';
import type { StudentRecord } from '../../data/seedData';
import {
  BATTERY,
  ChoiceSubtest,
  DOMAINS,
  SUBTESTS_BY_ID,
  Subtest,
  SubtestId,
  TOTAL_BATTERY_MINUTES,
  scoredItemCount,
} from '../../cognitiveProfile/battery';
import {
  ItemResponse,
  SubtestResult,
  buildProfile,
  maxSpanFrom,
  shouldDiscontinue,
  shouldStopSpan,
} from '../../cognitiveProfile/scoring';
import {
  BatterySession,
  clearBatterySession,
  loadBatterySession,
  saveBatterySession,
} from '../../cognitiveProfile/storage';
import { AssociationPlayer, ChoicePlayer, PalPlayer, SpanPlayer } from './TaskPlayers';
import { speak, stopSpeech } from './audio';
import ProfileReportView from './ProfileReportView';
import TrainingProgramView from './TrainingProgramView';

const toArabicDigits = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

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
    subtest.kind === 'choice' || subtest.kind === 'span' || subtest.kind === 'association' ? subtest.practice.length : 0;
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
    speak('أَحْسَنْتَ! انْتَهَتِ اللُّعْبَةُ.');
  };

  const startTest = () => {
    setIndex(0);
    setStage('transition');
    speak('رَائِع! الآنَ نَبْدَأُ اللُّعْبَةَ. لَنْ أُخْبِرَكَ إِنْ كَانَتْ إِجَابَتُكَ صَحِيحَةً؛ فَقَطْ حَاوِلْ أَفْضَلَ مَا تَسْتَطِيعُ.');
  };

  const nextPractice = () => {
    if (index + 1 < practiceCount) setIndex(index + 1);
    else startTest();
  };

  const recordAndAdvance = (newResponses: ItemResponse[]) => {
    responses.current = [...responses.current, ...newResponses];
    if (subtest.kind === 'choice') {
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
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden" dir="rtl">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">{subtest.icon}</span>
          <div>
            <p className="font-child font-black text-slate-900 leading-tight">{subtest.gameNameAr}</p>
            <p className="text-[11px] font-bold text-slate-500">{subtest.skillNameAr}</p>
          </div>
        </div>
        {stage !== 'done' && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('إيقاف هذه اللعبة؟ لن تُحفظ إجاباتها، ويمكن إعادتها لاحقًا.')) onExit();
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
          >
            <PauseCircle className="w-4 h-4" /> إيقاف
          </button>
        )}
      </div>

      {(stage === 'test' || stage === 'practice') && (
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
            <span>{stage === 'practice' ? 'تدريب' : 'اللعبة'}</span>
            {stage === 'test' && <span>{toArabicDigits(answered)} / {toArabicDigits(total)}</span>}
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${stage === 'practice' ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ width: stage === 'practice' ? '100%' : `${(answered / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="p-5 sm:p-8 min-h-[420px] flex flex-col items-center justify-center">
        {stage === 'intro' && (
          <div className="flex flex-col items-center text-center gap-5 max-w-xl">
            <span className="text-8xl animate-bounce-gentle" aria-hidden="true">{subtest.icon}</span>
            <h2 className="font-child text-3xl font-black text-slate-900">{subtest.gameNameAr}</h2>
            <button
              type="button"
              onClick={() => speak(subtest.introAudio)}
              className="flex items-center gap-2 text-sm font-bold text-sky-700 bg-sky-50 px-4 py-2 rounded-full cursor-pointer"
            >
              <Volume2 className="w-4 h-4" /> استمع للتعليمات
            </button>
            <button
              type="button"
              onClick={() => {
                stopSpeech();
                if (subtest.kind === 'pal') setStage('test');
                else {
                  setIndex(0);
                  setStage('practice');
                }
              }}
              className="font-child flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-600 text-white text-xl font-black shadow-lg cursor-pointer"
            >
              <Play className="w-6 h-6" /> {subtest.kind === 'pal' ? 'ابدأ' : 'لنتدرّب أولًا'}
            </button>
            <div className="w-full text-right">
              <button
                type="button"
                onClick={() => setShowNote(!showNote)}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 cursor-pointer"
                aria-expanded={showNote}
              >
                <ClipboardList className="w-3.5 h-3.5" /> ملاحظة للفاحص
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNote ? 'rotate-180' : ''}`} />
              </button>
              {showNote && (
                <p className="mt-2 text-xs leading-relaxed text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
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

        {stage === 'transition' && (
          <div className="flex flex-col items-center gap-5 text-center">
            <span className="text-7xl" aria-hidden="true">🌟</span>
            <p className="font-child text-2xl font-black text-slate-900">رائع! الآن نبدأ اللعبة</p>
            <p className="text-sm text-slate-500 max-w-sm">لن تظهر الإجابة الصحيحة الآن؛ حاول أفضل ما تستطيع.</p>
            <button
              type="button"
              onClick={() => {
                stopSpeech();
                setStage('test');
              }}
              className="font-child flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-600 text-white text-xl font-black shadow-lg cursor-pointer"
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
            <span className="text-8xl" aria-hidden="true">🏆</span>
            <p className="font-child text-2xl font-black text-slate-900">أحسنت! أنهيت «{subtest.gameNameAr}»</p>
            <button
              type="button"
              onClick={onExit}
              className="font-child flex items-center gap-2 px-8 py-4 rounded-2xl bg-sky-600 text-white text-lg font-black shadow-lg cursor-pointer"
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
function SetupView({ student, onStart }: { student: StudentRecord; onStart: (s: BatterySession) => void }) {
  const defaultYears = student.ageYears >= 4 && student.ageYears <= 8 ? student.ageYears : 6;
  const [name, setName] = useState(student.name);
  const [years, setYears] = useState(defaultYears);
  const [months, setMonths] = useState(0);
  const [examiner, setExaminer] = useState('');
  const [checks, setChecks] = useState({ quiet: false, headphones: false, ready: false });
  const allChecked = checks.quiet && checks.headphones && checks.ready;

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6" dir="rtl">
      <section className="bg-white rounded-[2rem] border border-slate-200 p-6 space-y-4">
        <h2 className="text-xl font-black text-slate-900">بيانات الطفل والفاحص</h2>
        <label className="block text-sm font-bold text-slate-700">
          اسم الطفل
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" />
        </label>
        <div>
          <span className="block text-sm font-bold text-slate-700">العمر بدقة (مهم للمقارنة العمرية)</span>
          <div className="mt-1 grid grid-cols-2 gap-3">
            <label className="text-xs font-bold text-slate-500">
              السنوات
              <select value={years} onChange={(e) => setYears(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base">
                {[4, 5, 6, 7, 8].map((y) => <option key={y} value={y}>{toArabicDigits(y)}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-500">
              الأشهر
              <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base">
                {Array.from({ length: 12 }, (_, m) => <option key={m} value={m}>{toArabicDigits(m)}</option>)}
              </select>
            </label>
          </div>
        </div>
        <label className="block text-sm font-bold text-slate-700">
          اسم الفاحص (المعلم أو الأخصائي)
          <input value={examiner} onChange={(e) => setExaminer(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" />
        </label>
      </section>

      <section className="bg-white rounded-[2rem] border border-slate-200 p-6 space-y-4">
        <h2 className="text-xl font-black text-slate-900">قبل البدء</h2>
        <ul className="text-sm text-slate-700 space-y-2 leading-relaxed list-disc pr-5">
          <li>يُطبَّق الفحص بحضور شخص بالغ يجلس بجانب الطفل، ولا يساعده في الإجابة.</li>
          <li>مدته الكلية نحو {toArabicDigits(TOTAL_BATTERY_MINUTES)} دقيقة؛ يُفضَّل تقسيمه على جلستين (الألعاب ١–٥ ثم ٦–٩). يُحفظ التقدّم تلقائيًا على هذا الجهاز.</li>
          <li>كل لعبة تبدأ بتدريب قصير مع تصحيح، ثم بنود الفحص دون تصحيح.</li>
          <li>إذا بدا الطفل متعبًا أو مشتتًا فأوقف اللعبة وأكملها في وقت آخر.</li>
        </ul>
        <button
          type="button"
          onClick={() => speak('مَرْحَبًا! هَلْ تَسْمَعُنِي جَيِّدًا؟')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50 text-sky-800 text-sm font-bold cursor-pointer"
        >
          <Headphones className="w-4 h-4" /> اختبار الصوت
        </button>
        <div className="space-y-2">
          {([
            ['quiet', 'المكان هادئ'],
            ['headphones', 'الصوت واضح (يُفضَّل سماعات)'],
            ['ready', 'الطفل مرتاح ومستعد'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={checks[key]} onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })} className="w-5 h-5 accent-emerald-600" />
              {label}
            </label>
          ))}
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
              results: {},
            })
          }
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 text-white text-lg font-black shadow disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Play className="w-5 h-5" /> بدء الفحص
        </button>
      </section>
    </div>
  );
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
}

export function CognitiveBatteryView({ activeStudent, initialView = 'map', onFocusModeChange }: Props) {
  const [trainingRunning, setTrainingRunning] = useState(false);
  const [session, setSession] = useState<BatterySession | null>(() => loadBatterySession(activeStudent.id));
  const [view, setView] = useState<View>(() =>
    initialView === 'training' ? { name: 'training' } : session ? { name: 'map' } : { name: 'setup' }
  );

  useEffect(() => {
    const loaded = loadBatterySession(activeStudent.id);
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

  const completed = session ? BATTERY.filter((s) => session.results[s.id]) : [];
  const nextSubtest = BATTERY.find((s) => !session?.results[s.id]);
  const remainingMinutes = BATTERY.filter((s) => !session?.results[s.id]).reduce((sum, s) => sum + s.minutes, 0);

  const saveResult = (result: SubtestResult) => {
    if (!session) return;
    const updated = { ...session, results: { ...session.results, [result.subtestId]: result } };
    setSession(updated);
    saveBatterySession(updated);
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
      />
    );
  }

  if (view.name === 'setup' || !session) {
    return (
      <SetupView
        student={activeStudent}
        onStart={(s) => {
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
      <ProfileReportView
        profile={profile}
        session={session}
        onBack={() => setView({ name: 'map' })}
        onStartTraining={() => setView({ name: 'training' })}
      />
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <section className="bg-white rounded-[2rem] border border-slate-200 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black text-emerald-700">فحص {session.childName}</p>
          <h2 className="text-2xl font-black text-slate-900 mt-0.5">
            {completed.length === BATTERY.length ? 'اكتملت الألعاب التسع 🎉' : `أُنجزت ${toArabicDigits(completed.length)} من ٩ ألعاب`}
          </h2>
          <div className="mt-3 h-3 w-full md:w-80 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(completed.length / BATTERY.length) * 100}%` }} />
          </div>
          {remainingMinutes > 0 && <p className="text-xs text-slate-500 mt-2">الوقت المتبقي التقريبي: {toArabicDigits(remainingMinutes)} دقيقة</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {nextSubtest && (
            <button
              type="button"
              onClick={() => setView({ name: 'run', id: nextSubtest.id })}
              className="font-child flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black shadow cursor-pointer"
            >
              <Play className="w-5 h-5" /> {completed.length === 0 ? 'ابدأ اللعبة الأولى' : 'اللعبة التالية'}
            </button>
          )}
          <button
            type="button"
            disabled={!profile}
            onClick={() => setView({ name: 'report' })}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl border-2 border-slate-800 text-slate-900 font-black disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileBarChart className="w-5 h-5" /> الملف المعرفي والتقرير
          </button>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {BATTERY.map((s) => {
          const done = Boolean(session.results[s.id]);
          const domain = DOMAINS[s.domain];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setView({ name: 'run', id: s.id })}
              className={`text-right rounded-3xl border-2 p-5 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                done ? 'border-emerald-300 bg-emerald-50/40' : nextSubtest?.id === s.id ? 'border-sky-400 shadow-md' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-5xl" aria-hidden="true">{s.icon}</span>
                <span className="text-xs font-black text-slate-400">{toArabicDigits(s.order)}</span>
              </div>
              <p className="font-child text-xl font-black text-slate-900 mt-3">{s.gameNameAr}</p>
              <p className="text-xs font-bold text-slate-600 mt-1">{s.skillNameAr}</p>
              <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
                <span className="px-2 py-0.5 rounded-full" style={{ color: domain.color, backgroundColor: `${domain.color}18` }}>{domain.nameAr}</span>
                {done ? (
                  <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-4 h-4" /> مكتملة · إعادة</span>
                ) : (
                  <span className="text-slate-500">≈ {toArabicDigits(s.minutes)} د</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <button
          type="button"
          onClick={() => setView({ name: 'training' })}
          className="font-bold text-emerald-700 hover:underline cursor-pointer"
        >
          الانتقال إلى البرنامج التدريبي الموجّه
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('بدء فحص جديد سيحذف نتائج هذا الفحص من هذا الجهاز. متابعة؟')) {
              clearBatterySession(activeStudent.id);
              setSession(null);
              setView({ name: 'setup' });
            }
          }}
          className="flex items-center gap-1 font-bold hover:text-rose-600 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> فحص جديد
        </button>
      </div>
    </div>
  );
}

export default CognitiveBatteryView;
