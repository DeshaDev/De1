import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Headphones, Play, RotateCcw, Volume2 } from 'lucide-react';
import {
  getFluencyPassage,
  getStructuredLiteracyStations,
  type LiteracyQuestion,
  type LiteracyStation,
  type LiteracyStationId,
} from '../../cognitiveProfile/structuredLiteracyStations';
import {
  arabicSpellingMatches,
  emptyLiteracyPracticeProgress,
  recordFluencySessionCompleted,
  recordLiteracyAnswer,
  recordLiteracyStationCompleted,
  type LiteracyPracticeProgress,
} from '../../cognitiveProfile/literacyPracticeProgress';
import { loadLiteracyPracticeProgress, saveLiteracyPracticeProgress } from '../../cognitiveProfile/storage';
import { speakSegments, stopSpeech, type PlaybackHandle } from './audio';

interface Props {
  studentId: string;
  ageYears: number;
  childName: string;
  onClose: () => void;
}

const ageLabel = (age: number) => String(age).replace(/[0-9]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);

export function StructuredLiteracyStations({ studentId, ageYears, childName, onClose }: Props) {
  const safeAgeYears = Number.isFinite(ageYears) ? Math.max(4, Math.min(8, Math.floor(ageYears))) : 4;
  const stations = useMemo(() => getStructuredLiteracyStations(safeAgeYears), [safeAgeYears]);
  const [stationId, setStationId] = useState<LiteracyStationId | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textResponse, setTextResponse] = useState('');
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [completed, setCompleted] = useState(false);
  const [modelHeard, setModelHeard] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showLesson, setShowLesson] = useState(false);
  const [practiceProgress, setPracticeProgress] = useState<LiteracyPracticeProgress>(emptyLiteracyPracticeProgress());
  const [loadedStudentId, setLoadedStudentId] = useState<string | null>(null);
  const practiceReady = loadedStudentId === studentId;
  const playback = useRef<PlaybackHandle | null>(null);

  const station = stations.find((item) => item.id === stationId) ?? null;
  const question = station?.questions[questionIndex] ?? null;
  const fluencyPassage = getFluencyPassage(safeAgeYears);

  useEffect(() => {
    let cancelled = false;
    setLoadedStudentId(null);
    setPracticeProgress(emptyLiteracyPracticeProgress());
    void loadLiteracyPracticeProgress(studentId)
      .then((saved) => { if (!cancelled) setPracticeProgress(saved); })
      .catch((error) => console.error('Unable to restore encrypted literacy practice progress:', error))
      .finally(() => { if (!cancelled) setLoadedStudentId(studentId); });
    return () => { cancelled = true; };
  }, [studentId]);

  const persistPractice = (next: LiteracyPracticeProgress) => {
    if (loadedStudentId !== studentId) return;
    setPracticeProgress(next);
    void saveLiteracyPracticeProgress(studentId, next)
      .catch((error) => console.error('Unable to save encrypted literacy practice progress:', error));
  };

  useEffect(() => () => {
    if (playback.current) playback.current.cancelled = true;
    stopSpeech();
  }, []);

  const playAudio = async (segments: string[], after?: () => void) => {
    if (playback.current) playback.current.cancelled = true;
    stopSpeech();
    const handle: PlaybackHandle = { cancelled: false };
    playback.current = handle;
    setPlaying(true);
    try {
      await speakSegments(segments.map((text) => ({ text, pauseAfterMs: 320 })), handle);
    } finally {
      if (!handle.cancelled) {
        setPlaying(false);
        after?.();
      }
    }
  };

  const openStation = (next: LiteracyStation) => {
    setStationId(next.id);
    setShowLesson(true);
    setQuestionIndex(0);
    setSelectedId(null);
    setTextResponse('');
    setAnswerCorrect(null);
    setCompleted(false);
    setModelHeard(false);
    setReadCount(0);
  };

  const closeStation = () => {
    if (playback.current) playback.current.cancelled = true;
    stopSpeech();
    setPlaying(false);
    setStationId(null);
    setShowLesson(false);
    setQuestionIndex(0);
    setSelectedId(null);
    setTextResponse('');
    setAnswerCorrect(null);
    setCompleted(false);
    setModelHeard(false);
    setReadCount(0);
  };

  const nextQuestion = () => {
    if (!station) return;
    if (questionIndex + 1 >= station.questions.length) {
      if (station.id !== 'fluency') persistPractice(recordLiteracyStationCompleted(practiceProgress, station.id));
      setCompleted(true);
      return;
    }
    setQuestionIndex((current) => current + 1);
    setSelectedId(null);
    setTextResponse('');
    setAnswerCorrect(null);
  };

  const chooseOption = (optionId: string) => {
    if (selectedId || !question) return;
    setSelectedId(optionId);
    setAnswerCorrect(optionId === question.correctId);
    if (station && station.id !== 'fluency') {
      persistPractice(recordLiteracyAnswer(practiceProgress, station.id, optionId === question.correctId));
    }
    if (optionId !== question.correctId) {
      const explanation = question.explanationAudio;
      void playAudio(explanation);
    } else {
      void playAudio(['أَحْسَنْتَ! إِجَابَةٌ صَحِيحَةٌ.']);
    }
  };

  const correctOption = question?.options.find((option) => option.id === question.correctId);
  const submitTextResponse = () => {
    if (!question || question.responseMode !== 'text' || selectedId) return;
    const isCorrect = arabicSpellingMatches(textResponse, question.correctId);
    setSelectedId(isCorrect ? question.correctId : '__text_response__');
    setAnswerCorrect(isCorrect);
    if (station && station.id !== 'fluency') {
      persistPractice(recordLiteracyAnswer(practiceProgress, station.id, isCorrect));
    }
    void playAudio(isCorrect ? ['أَحْسَنْتَ! كَتَبْتَ الْكَلِمَةَ بِشَكْلٍ صَحِيحٍ.'] : question.explanationAudio);
  };

  if (!stationId || !station) {
    return (
      <section className="space-y-5" dir="rtl">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="bz-btn bz-btn-ghost">
            <ArrowRight className="w-4 h-4" /> العودة إلى البرنامج
          </button>
          <span className="bz-badge bz-badge-brand">قراءة ولغة</span>
        </div>

        <section className="bz-card bz-card-pad space-y-3">
          <p className="bz-small text-brand font-semibold">محطات قراءة ولغة</p>
          <h2 className="bz-h2">نتدرّب على مهارات قرائية متنوعة</h2>
          <p className="bz-body">
            اختر محطة قصيرة. تختلف الأنشطة بحسب العمر؛ فالطفل الأصغر يستمع ويفهم، ولا نطالبه بقراءة كلمات قبل بدء تعلّم القراءة.
          </p>
          <p className="text-xs text-slate-500">العمر المحدد في ملف الطفل: {ageLabel(ageYears)} سنوات · {childName}</p>
        </section>

        <div className="grid sm:grid-cols-2 gap-4">
          {stations.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openStation(item)}
              disabled={!practiceReady}
              className="bz-card p-5 text-right hover:border-brand transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:opacity-60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">{item.titleAr}</h3>
                  <p className="text-sm text-brand font-semibold mt-1">{item.subtitleAr}</p>
                </div>
                <span className="text-3xl" aria-hidden="true">
                  {item.id === 'decoding' ? '🔤' : item.id === 'spelling' ? '✍️' : item.id === 'morphology' ? '🧩' : item.id === 'fluency' ? '📖' : '💡'}
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-7 mt-3">{item.purposeAr}</p>
              <p className="text-xs text-slate-500 mt-3">{item.ageNoteAr}</p>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-brand mt-4">
                ابدأ المحطة <ArrowRight className="w-4 h-4 rotate-180" />
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">هذه محطات تدريبية وليست تشخيصًا، ولا تسجّل صوت الطفل.</p>
      </section>
    );
  }

  if (showLesson) {
    return (
      <section className="bz-card bz-card-pad space-y-5" dir="rtl">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={closeStation} className="bz-btn bz-btn-ghost">
            <ArrowRight className="w-4 h-4" /> المحطات
          </button>
          <span className="bz-badge bz-badge-brand">نتعلّم أولًا</span>
        </div>
        <div className="text-center space-y-2">
          <span className="text-4xl" aria-hidden="true">🌱</span>
          <h2 className="bz-h2">{station.titleAr}</h2>
          <p className="bz-body">{station.teachAr}</p>
        </div>
        <div className="rounded-2xl bg-soft border border-line p-5 space-y-2">
          <p className="font-black text-slate-900">مثال نتعلّمه معًا</p>
          <p className="text-base leading-8 text-slate-800">{station.modelAr}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className="bz-btn bz-btn-secondary" onClick={() => void playAudio([station.teachAudioAr, station.modelAudioAr])} disabled={playing}>
            <Volume2 className="w-4 h-4" /> استمع إلى الشرح والمثال
          </button>
          <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={() => setShowLesson(false)}>
            هَيَّا نُمَارِسْ <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </section>
    );
  }

  if (stationId === 'fluency') {
    const finishRead = () => {
      const nextCount = Math.min(3, readCount + 1);
      setReadCount(nextCount);
      if (nextCount === 3) persistPractice(recordFluencySessionCompleted(practiceProgress));
    };
    return (
      <section className="bz-card bz-card-pad space-y-5" dir="rtl">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={closeStation} className="bz-btn bz-btn-ghost">
            <ArrowRight className="w-4 h-4" /> المحطات
          </button>
          <span className="bz-badge bz-badge-brand">تدريب بلا توقيت</span>
        </div>
        <div className="text-center space-y-2">
          <span className="text-4xl" aria-hidden="true">📖</span>
          <h2 className="bz-h2">{fluencyPassage.titleAr}</h2>
          <p className="bz-body">استمع إلى القراءة النموذجية، ثم اقرأ النص ثلاث مرات. ركّز على الكلمات واجمعها في عبارات، وانتبه إلى علامات الوقف.</p>
        </div>
        <div className="rounded-2xl border border-line bg-soft p-5 space-y-4 text-right">
          {fluencyPassage.linesAr.map((line, index) => (
            <p key={index} className="font-child text-xl sm:text-2xl font-bold leading-loose text-slate-900">
              {line}
            </p>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="bz-btn bz-btn-secondary"
            onClick={() => void playAudio(fluencyPassage.modelAudio, () => setModelHeard(true))}
            disabled={playing}
          >
            <Headphones className="w-4 h-4" /> استمع إلى القراءة النموذجية
          </button>
          <button
            type="button"
            className="bz-btn bz-btn-ghost"
            onClick={() => {
              setReadCount(0);
              setModelHeard(false);
            }}
          >
            <RotateCcw className="w-4 h-4" /> ابدأ من جديد
          </button>
        </div>
        <div className="rounded-2xl bg-brand-tint border border-line p-4 space-y-3">
          <p className="font-bold text-slate-900">قراءاتك: {ageLabel(readCount)} من ٣</p>
          <div className="bz-progress"><span style={{ width: `${(readCount / 3) * 100}%` }} /></div>
          <p className="text-sm text-slate-600">
            {!modelHeard ? 'ابدأ بالاستماع إلى النموذج. يمكنك الاستماع أكثر من مرة.' : readCount === 0 ? 'القراءة الأولى: اقرأ مع تتبّع الكلمات بإصبعك.' : readCount === 1 ? 'القراءة الثانية: اجمع الكلمات في عبارات قصيرة.' : readCount === 2 ? 'القراءة الثالثة: اقرأ وحدك، وانتبه إلى الوقف وعلامات الترقيم.' : fluencyPassage.reflectionAr}
          </p>
          {modelHeard && readCount < 3 && (
            <button type="button" className="bz-btn bz-btn-primary bz-btn-lg" onClick={finishRead}>
              أنهيت القراءة رقم {ageLabel(readCount + 1)}
            </button>
          )}
          {readCount === 3 && (
            <div className="flex items-start gap-2 text-sm font-semibold text-emerald-800" aria-live="polite">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              رائع! قرأت النص ثلاث مرات. هل تستطيع أن تحكي فكرته؟
            </div>
          )}
        </div>
        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-xs font-bold text-slate-600">معلومة لولي الأمر</summary>
          <p className="mt-2 text-xs text-slate-500 leading-6">هذا النشاط للممارسة فقط؛ لا يستخدم مؤقتًا أو تسجيلًا للصوت، ولا يصدر حكمًا آليًا على القراءة.</p>
        </details>
      </section>
    );
  }

  if (completed) {
    return (
      <section className="bz-card bz-card-pad text-center space-y-5" dir="rtl">
        <span className="text-5xl" aria-hidden="true">🌟</span>
        <h2 className="bz-h2">أكملت محطة {station.titleAr}</h2>
        <p className="bz-body">أحسنت المحاولة! هذه ممارسة تعليمية قصيرة وليست اختبارًا أو درجة إتقان.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className="bz-btn bz-btn-primary" onClick={closeStation}>العودة إلى المحطات</button>
          <button type="button" className="bz-btn bz-btn-secondary" onClick={() => openStation(station)}>إعادة المحطة</button>
        </div>
      </section>
    );
  }

  return (
    <section className="bz-card bz-card-pad space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={closeStation} className="bz-btn bz-btn-ghost">
          <ArrowRight className="w-4 h-4" /> المحطات
        </button>
        <span className="text-xs font-bold text-slate-500">{ageLabel(questionIndex + 1)} من {ageLabel(station.questions.length)}</span>
      </div>
      <div className="space-y-2">
        <p className="bz-small text-brand font-semibold">{station.titleAr}</p>
        <div className="bz-progress"><span style={{ width: `${((questionIndex + 1) / station.questions.length) * 100}%` }} /></div>
        <p
          className={`font-child text-xl sm:text-2xl font-black leading-loose text-slate-900 whitespace-pre-line ${station.id === 'comprehension' && safeAgeYears < 6 ? 'sr-only' : ''}`}
        >
          {question?.promptAr}
        </p>
        <button
          type="button"
          className="bz-btn bz-btn-ghost bz-btn-sm"
          onClick={() => question && void playAudio(question.audio)}
          disabled={playing}
        >
          <Volume2 className="w-4 h-4" /> استمع إلى التعليمات
        </button>
      </div>

      {question?.responseMode === 'text' ? (
        <div className="rounded-2xl border border-line bg-soft p-4 space-y-3">
          <label htmlFor="literacy-dictation-answer" className="block text-sm font-bold text-slate-800">اكتب الكلمة التي سمعتها</label>
          <input
            id="literacy-dictation-answer"
            type="text"
            dir="rtl"
            lang="ar"
            autoComplete="off"
            spellCheck={false}
            maxLength={24}
            value={textResponse}
            onChange={(event) => setTextResponse(event.target.value)}
            disabled={Boolean(selectedId)}
            placeholder="اكتب الكلمة هنا"
            className="w-full rounded-xl border-2 border-line bg-white px-4 py-3 text-2xl font-bold text-slate-900 text-right focus:border-brand focus:outline-none"
          />
          {!selectedId && (
            <button type="button" className="bz-btn bz-btn-primary" onClick={submitTextResponse} disabled={!textResponse.trim() || playing}>
              تحقّق من كتابتي
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {question?.options.map((option) => {
          const chosen = selectedId === option.id;
          const isCorrect = option.id === question.correctId;
          const revealCorrect = Boolean(selectedId) && isCorrect;
          return (
            <button
              key={option.id}
              type="button"
              aria-label={option.labelAr}
              disabled={Boolean(selectedId)}
              onClick={() => chooseOption(option.id)}
              className={`min-h-[116px] rounded-2xl border-2 p-3 flex flex-col items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${
                revealCorrect ? 'border-emerald-500 bg-emerald-50' : chosen ? 'border-rose-400 bg-rose-50' : 'border-line bg-white hover:border-brand'
              }`}
            >
              {option.emoji && <span className="text-5xl" aria-hidden="true">{option.emoji}</span>}
              <span className={`font-child text-lg font-black text-slate-900 ${(station.id === 'decoding' || (station.id === 'comprehension' && safeAgeYears < 6)) && option.emoji ? 'sr-only' : ''}`}>{option.labelAr}</span>
            </button>
          );
        })}
      </div>
      )}

      {selectedId && question && (
        <div className="rounded-2xl border border-line bg-soft p-4 space-y-3" aria-live="polite">
          <p className="font-bold text-slate-900 flex items-center gap-2">
            {(answerCorrect ?? selectedId === question.correctId) ? <CheckCircle2 className="w-5 h-5 text-emerald-700" /> : <span aria-hidden="true">💡</span>}
            {(answerCorrect ?? selectedId === question.correctId) ? 'أحسنت، هذه هي الإجابة الصحيحة.' : `الإجابة الصحيحة: ${question.responseMode === 'text' ? question.correctId : (correctOption?.labelAr ?? '')}`}
          </p>
          <p className="text-sm text-slate-700 leading-7">{question.explanationAr}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="bz-btn bz-btn-ghost bz-btn-sm" onClick={() => void playAudio(question.explanationAudio)} disabled={playing}>
              <Volume2 className="w-4 h-4" /> استمع إلى التوضيح
            </button>
            <button type="button" className="bz-btn bz-btn-primary" onClick={nextQuestion}>
              {questionIndex + 1 === station.questions.length ? 'إنهاء المحطة' : 'السؤال التالي'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
