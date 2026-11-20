import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Mic, MicOff, SkipForward } from 'lucide-react';
import type { StudentRecord } from '../../data/seedData';
import {
  getTransferAudioTask,
  scoreVerifiedTransferAudio,
  type TransferForm,
  type TransferPoint,
  type TransferRecord,
  type TransferTaskKind,
} from '../../cognitiveProfile/transferProbe';
import { authenticatedFetch } from '../../utils/apiAuth';
import { normalizeHomeDialect, pronunciationLocaleForDialect } from '../../cognitiveProfile/storage';
import { startWavRecording, type WavRecordingController } from './audioRecording';

interface Props {
  student: StudentRecord | undefined;
  point: TransferPoint;
  form: TransferForm;
  session: number;
  onComplete: (record: TransferRecord) => void;
  onSkip: () => void;
}

const TASK_KINDS: TransferTaskKind[] = ['real', 'nonword', 'passage'];
const ARABIC_DIGITS = (value: number | string) =>
  String(value).replace(/[0-9]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);

function audioErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'AUDIO_CONSENT_REQUIRED' || code === 'GUARDIAN_CONSENT_NOT_STORED' || code === 'GUARDIAN_AUDIO_CONSENT_NOT_STORED') {
    return 'موافقة ولي الأمر على معالجة الصوت غير مكتملة في ملف الطفل. يمكنك متابعة التدريب دون هذا القياس.';
  }
  if (code === 'AZURE_SPEECH_NOT_CONFIGURED') {
    return 'خدمة تقييم القراءة الصوتي غير مفعّلة على الخادم حاليًا. لم نحسب أي درجة.';
  }
  if (code === 'UNSUPPORTED_PRONUNCIATION_LOCALE') {
    return 'التقييم الصوتي الآلي لا يدعم اللهجة المحددة في الملف حتى الآن. لم نحسب أي درجة.';
  }
  if (code === 'AZURE_NO_RECOGNIZED_SPEECH' || code === 'AZURE_NO_WORD_LEVEL_RESULTS' || code === 'AZURE_SPEECH_ASSESSMENT_FAILED') {
    return 'لم نسمع القراءة بوضوح. اضغط «أعد القراءة» واقرأ النص مرة أخرى بصوت واضح.';
  }
  if (code === 'AUDIO_RECORDING_UNAVAILABLE' || code === 'AUDIO_CONTEXT_UNAVAILABLE') {
    return 'تعذّر تشغيل الميكروفون أو تسجيل الصوت في هذا المتصفح.';
  }
  return 'لم نتمكّن من سماع القراءة بوضوح. اضغط «أعد القراءة» واقرأ النص مرة أخرى بصوت واضح وقريبًا من الميكروفون.';
}

export function TransferMeasureView({ student, point, form, session, onComplete, onSkip }: Props) {
  const tasks = useMemo(
    () => TASK_KINDS.map((kind) => getTransferAudioTask(`transfer-${form}-${kind}`)).filter((task) => task !== null),
    [form]
  );
  const [index, setIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<WavRecordingController | null>(null);
  const [scores, setScores] = useState<Partial<Record<TransferTaskKind, { correct: number; total: number; ms: number; receipt: string }>>>({});

  useEffect(() => () => controller.current?.cancel(), []);

  const task = tasks[index];
  const guardianConsentAt = student?.guardianConsentRecordedAt;
  const audioConsentAt = student?.guardianAudioConsentRecordedAt;
  const validGuardianConsent = student?.guardianConsentGiven === true &&
    typeof guardianConsentAt === 'string' && Number.isFinite(Date.parse(guardianConsentAt));
  const validAudioConsent = student?.guardianAudioConsentGiven === true &&
    typeof audioConsentAt === 'string' && Number.isFinite(Date.parse(audioConsentAt));
  const dialect = normalizeHomeDialect(student?.dialectCode || student?.dialect, student?.country);
  const language = pronunciationLocaleForDialect(dialect) ?? null;
  const canAssess = Boolean(
    student && !student.isDemoRecord && validGuardianConsent && validAudioConsent && language
  );

  const startRecording = async () => {
    setError('');
    try {
      const next = await startWavRecording({ minimumDurationSeconds: 1 });
      controller.current = next;
      setRecording(true);
    } catch (cause) {
      setError(audioErrorMessage(cause));
    }
  };

  const stopAndAssess = async () => {
    if (!controller.current || !task || !student || !language) return;
    setBusy(true);
    setRecording(false);
    setError('');
    try {
      const activeController = controller.current;
      controller.current = null;
      const recordingData = await activeController.stop();
      const response = await authenticatedFetch('/api/ai/pronunciation-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          passageId: task.id,
          referenceText: task.words.join(' '),
          referenceWords: task.words,
          audioWavBase64: recordingData.audioWavBase64,
          durationSeconds: recordingData.durationSeconds,
          language,
          guardianConsentGiven: true,
          guardianConsentRecordedAt: guardianConsentAt,
          guardianAudioConsentGiven: true,
          guardianAudioConsentRecordedAt: audioConsentAt,
        }),
      });
      const result = await response.json().catch(() => ({})) as {
        code?: string;
        error?: string;
        sourceModel?: string;
        assessmentComplete?: boolean;
        assessmentReceipt?: string | null;
        durationSeconds?: number;
        words?: Array<{ errorType: string; accuracyScore: number | null }>;
      };
      if (!response.ok) throw new Error(result.code || `TRANSFER_AUDIO_HTTP_${response.status}`);
      if (
        (result.sourceModel !== 'azure_pronunciation_assessment' && result.sourceModel !== 'ifm_jais_asr') ||
        result.assessmentComplete !== true ||
        typeof result.assessmentReceipt !== 'string' ||
        !/^[a-f0-9]{64}$/.test(result.assessmentReceipt) ||
        !Array.isArray(result.words) ||
        result.words.length !== task.words.length
      ) {
        throw new Error('TRANSFER_AUDIO_UNRESOLVED');
      }
      const score = scoreVerifiedTransferAudio(result.words, result.durationSeconds ?? recordingData.durationSeconds);
      if (!score) throw new Error('TRANSFER_AUDIO_UNRESOLVED');

      const nextScores = {
        ...scores,
        [task.kind]: { ...score, receipt: result.assessmentReceipt },
      };
      setScores(nextScores);
      if (index + 1 < tasks.length) {
        setIndex((value) => value + 1);
      } else {
        const real = nextScores.real;
        const nonword = nextScores.nonword;
        const passageScore = nextScores.passage;
        if (!real || !nonword || !passageScore) {
          throw new Error('TRANSFER_AUDIO_UNRESOLVED');
        }
        onComplete({
          point,
          form,
          session,
          date: new Date().toISOString(),
          real: { correct: real.correct, total: real.total, ms: real.ms },
          nonword: { correct: nonword.correct, total: nonword.total, ms: nonword.ms },
          passage: { correct: passageScore.correct, total: passageScore.total, ms: passageScore.ms },
          sourceModel: 'azure_pronunciation_assessment',
          assessmentReceipts: [real.receipt, nonword.receipt, passageScore.receipt],
        });
      }
    } catch (cause) {
      setError(audioErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (!student || student.isDemoRecord) {
    return (
      <section className="bz-card mx-auto max-w-2xl p-6 space-y-4 text-center" dir="rtl">
        <h2 className="font-child text-2xl font-black text-slate-900">تحدّي القراءة الجديدة</h2>
        <p className="text-sm leading-6 text-slate-600">يُتاح هذا القياس لملف طفل حقيقي فقط، ولا يُسجَّل على الملفات التجريبية.</p>
        <button type="button" className="bz-btn bz-btn-primary" onClick={onSkip}>تابع التدريب</button>
      </section>
    );
  }

  if (!canAssess) {
    return (
      <section className="bz-card mx-auto max-w-2xl p-6 space-y-4" dir="rtl">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-amber-600" aria-hidden="true" />
          <h2 className="font-child text-xl font-black text-slate-900">تحدّي قراءة جديدة</h2>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          يحتاج القياس إلى موافقة ولي الأمر المسجّلة على حفظ ملف الطفل ومعالجة صوته.
        </p>
        <p className="text-xs leading-5 text-slate-500">
          لا نستخدم تصحيحًا يدويًا بديلًا، ولا نحسب درجة عندما لا تتوفر شروط التقييم.
        </p>
        <button type="button" className="bz-btn bz-btn-primary" onClick={onSkip}>تابع التدريب دون قياس</button>
      </section>
    );
  }

  if (!task || tasks.length !== 3) return null;

  return (
    <section className="bz-card mx-auto max-w-3xl overflow-hidden" dir="rtl" aria-labelledby="transfer-measure-title">
      <header className="border-b border-line bg-soft p-5">
        <p className="bz-small text-brand font-bold">محطة قصيرة · {point === 'pre' ? 'بداية البرنامج' : point === 'mid' ? 'منتصف البرنامج' : 'نهاية البرنامج'}</p>
        <h2 id="transfer-measure-title" className="mt-1 font-child text-2xl font-black text-slate-900">تحدّي قراءة جديدة</h2>
        <p className="mt-1 text-sm text-slate-600">اقرأ الكلمات الجديدة، ثم اقرأ النص القصير بهدوء.</p>
        <p className="mt-2 rounded-lg bg-card border border-line px-3 py-2 text-sm text-ink">
          هذا قياس قصير لتقدّم طفلك، بلا تصحيح، ويتكرّر في بداية البرنامج ومنتصفه ونهايته. بعده مباشرة يبدأ درس اليوم: شرح، ثم تمارين يُصحَّح فيها كل خطأ فورًا ويعيد الطفل المحاولة.
        </p>
        <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
          <span>المحطة {ARABIC_DIGITS(index + 1)} من {ARABIC_DIGITS(tasks.length)}</span>
          <span>اقرأ على مهل</span>
        </div>
        <div className="bz-progress mt-2"><span style={{ width: `${((index + 1) / tasks.length) * 100}%` }} /></div>
      </header>

      <div className="space-y-5 p-5 sm:p-8">
        <div className="text-center">
          <h3 className="font-child text-xl font-black text-slate-900">{task.titleAr}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">{task.instructionAr}</p>
        </div>

        <div className={task.kind === 'passage'
          ? 'rounded-2xl border-2 border-sky-100 bg-sky-50/60 p-5 text-right'
          : 'rounded-2xl border-2 border-teal-100 bg-teal-50/60 p-5 text-center'}>
          <p className={task.kind === 'passage'
            ? 'font-child text-2xl font-bold leading-[2.25] text-slate-900'
            : 'font-child text-2xl sm:text-3xl font-black leading-[2.1] text-slate-900'}
            lang="ar"
          >
            {task.displayText}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-base font-bold leading-7 text-amber-950 flex gap-2" role="alert">
            <AlertCircle className="h-5 w-5 shrink-0 mt-1" aria-hidden="true" /> {error}
          </div>
        )}

        {recording ? (
          <div className="flex flex-col items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800" role="status">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" />
              التسجيل يعمل… اقرأ كل الكلمات ثم اضغط إنهاء
            </span>
            <button type="button" onClick={() => void stopAndAssess()} disabled={busy} className="bz-btn bz-btn-primary bz-btn-lg w-full sm:w-auto">
              {busy ? 'جارٍ تقييم القراءة…' : <><MicOff className="h-5 w-5" /> أنهيت القراءة</>}
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button type="button" onClick={() => void startRecording()} disabled={busy} className="bz-btn bz-btn-primary bz-btn-lg w-full sm:w-auto">
              <Mic className="h-5 w-5" /> {busy ? 'جارٍ التقييم…' : error ? 'أعد القراءة' : 'ابدأ القراءة'}
            </button>
            <button type="button" onClick={onSkip} disabled={busy} className="bz-btn bz-btn-ghost">
              <SkipForward className="h-4 w-4" /> تابع التدريب دون قياس
            </button>
          </div>
        )}

        <p className="text-center text-xs leading-5 text-slate-500">
          لا تقلق من الخطأ. إذا تعذّر تأكيد التسجيل فلن نحتسبه خطأً عليك.
        </p>
      </div>
    </section>
  );
}

export default TransferMeasureView;
