import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Activity,
  Mic,
  MicOff,
  RotateCcw,
  CheckCircle2,
  GitBranch,
  Cpu,
  Download,
  Volume2,
  Sliders,
} from 'lucide-react';
import {
  CLINICAL_IRT_ITEM_BANK,
  IRTResponseRecord,
  computeIRT2PLProbability,
  computeIRTFisherInformation,
  estimateIRTAbilityEAP,
  selectNextAdaptiveIRTItem,
  evaluateOralReadingAlignment,
  runOculomotorHeuristicInference,
  RawGazeSample,
  ARABIC_DIALECT_PROFILES,
  ArabicDialectCode,
} from '../utils/dyslexiaEngines';
import { ARABIC_READING_PASSAGES } from '../data/seedData';

const SAMPLE_GAZE_PRESETS: Record<
  'dyslexic' | 'nominal',
  { label: string; samples: RawGazeSample[] }
> = {
  dyslexic: {
    label:
      'بيانات اصطناعية: تثبيتات أطول وتراجعات متكررة (للاختبار البرمجي فقط)',
    samples: [
      { x: 780, y: 180, timestampMs: 0, wordIndex: 0 },
      { x: 784, y: 182, timestampMs: 140, wordIndex: 0 },
      { x: 779, y: 179, timestampMs: 290, wordIndex: 0 },
      { x: 782, y: 181, timestampMs: 430, wordIndex: 0 },
      { x: 640, y: 183, timestampMs: 465, wordIndex: 1 },
      { x: 644, y: 180, timestampMs: 620, wordIndex: 1 },
      { x: 639, y: 184, timestampMs: 790, wordIndex: 1 },
      { x: 642, y: 182, timestampMs: 940, wordIndex: 1 },
      { x: 775, y: 181, timestampMs: 975, wordIndex: 0 },
      { x: 778, y: 183, timestampMs: 1150, wordIndex: 0 },
      { x: 776, y: 179, timestampMs: 1340, wordIndex: 0 },
      { x: 520, y: 184, timestampMs: 1380, wordIndex: 2 },
      { x: 523, y: 182, timestampMs: 1580, wordIndex: 2 },
      { x: 519, y: 185, timestampMs: 1790, wordIndex: 2 },
      { x: 521, y: 183, timestampMs: 1990, wordIndex: 2 },
      { x: 638, y: 182, timestampMs: 2025, wordIndex: 1 },
      { x: 641, y: 180, timestampMs: 2210, wordIndex: 1 },
      { x: 637, y: 183, timestampMs: 2420, wordIndex: 1 },
      { x: 390, y: 185, timestampMs: 2460, wordIndex: 3 },
      { x: 394, y: 182, timestampMs: 2680, wordIndex: 3 },
      { x: 389, y: 184, timestampMs: 2920, wordIndex: 3 },
    ],
  },
  nominal: {
    label: 'بيانات اصطناعية بمسار مختلف (للمقارنة التقنية فقط)',
    samples: [
      { x: 780, y: 180, timestampMs: 0, wordIndex: 0 },
      { x: 782, y: 181, timestampMs: 110, wordIndex: 0 },
      { x: 779, y: 180, timestampMs: 215, wordIndex: 0 },
      { x: 620, y: 181, timestampMs: 245, wordIndex: 1 },
      { x: 622, y: 180, timestampMs: 350, wordIndex: 1 },
      { x: 619, y: 182, timestampMs: 455, wordIndex: 1 },
      { x: 460, y: 182, timestampMs: 485, wordIndex: 2 },
      { x: 463, y: 180, timestampMs: 590, wordIndex: 2 },
      { x: 461, y: 181, timestampMs: 695, wordIndex: 2 },
      { x: 300, y: 181, timestampMs: 725, wordIndex: 3 },
      { x: 302, y: 180, timestampMs: 830, wordIndex: 3 },
      { x: 299, y: 182, timestampMs: 940, wordIndex: 3 },
    ],
  },
};

export const ClinicalAlgorithmsView: React.FC = () => {
  // Progressive Disclosure Lab Switcher ('irt' | 'oral' | 'pygaze')
  const [activeLab, setActiveLab] = useState<'irt' | 'oral' | 'pygaze'>('irt');

  // 1. 2PL IRT ADAPTIVE ASSESSMENT ENGINE STATE
  const [irtHistory, setIrtHistory] = useState<IRTResponseRecord[]>([]);
  const itemStartTimeRef = useRef<number>(performance.now());

  const currentIRTEstimate = useMemo(
    () =>
      estimateIRTAbilityEAP(
        irtHistory.map((h) => ({
          discriminationA: h.item.discriminationA,
          difficultyB: h.item.difficultyB,
          correct: h.correct,
          reactionTimeMs: h.reactionTimeMs,
        }))
      ),
    [irtHistory]
  );

  const nextAdaptiveSelection = useMemo(
    () =>
      selectNextAdaptiveIRTItem(
        CLINICAL_IRT_ITEM_BANK,
        irtHistory.map((h) => h.item.id),
        currentIRTEstimate.theta
      ),
    [irtHistory, currentIRTEstimate.theta]
  );

  const activeIRTItem = nextAdaptiveSelection.nextItem;

  const handleAnswerIRTItem = (optionIndex: number) => {
    if (!activeIRTItem) return;
    const elapsedMs = Math.max(
      280,
      Math.min(12000, Math.round(performance.now() - itemStartTimeRef.current))
    );
    const isCorrect = optionIndex === activeIRTItem.correctIndex;
    const thetaBefore = currentIRTEstimate.theta;

    const updatedResponses = [
      ...irtHistory.map((h) => ({
        discriminationA: h.item.discriminationA,
        difficultyB: h.item.difficultyB,
        correct: h.correct,
      })),
      {
        discriminationA: activeIRTItem.discriminationA,
        difficultyB: activeIRTItem.difficultyB,
        correct: isCorrect,
      },
    ];
    const postEstimate = estimateIRTAbilityEAP(updatedResponses);
    const itemInfo = computeIRTFisherInformation(
      postEstimate.theta,
      activeIRTItem.discriminationA,
      activeIRTItem.difficultyB
    );

    const record: IRTResponseRecord = {
      item: activeIRTItem,
      selectedIndex: optionIndex,
      correct: isCorrect,
      reactionTimeMs: elapsedMs,
      thetaBefore,
      thetaAfter: postEstimate.theta,
      standardErrorAfter: postEstimate.standardError,
      itemInformation: Math.round(itemInfo * 100) / 100,
    };

    setIrtHistory((prev) => [...prev, record]);
    itemStartTimeRef.current = performance.now();
  };

  const handleResetIRT = () => {
    setIrtHistory([]);
    itemStartTimeRef.current = performance.now();
  };

  // 2. WEBRTC AUDIO & SPEECH RECOGNITION ORAL FLUENCY ENGINE STATE
  const targetOralPassageWords = useMemo(
    () => ARABIC_READING_PASSAGES[0].words.slice(0, 14),
    []
  );
  const [oralDialect, setOralDialect] = useState<ArabicDialectCode>('gulf');
  const [spokenTranscript, setSpokenTranscript] = useState<string>(
    'زار تلاب المدرسه المرصد الفلكي في مساء صاف لمشاهده الكواكب المضيئه وحط المهندس المنضار'
  );
  const [readingDurationSec, setReadingDurationSec] = useState<number>(14);
  const [hesitationPauses, setHesitationPauses] = useState<number>(2);
  const [isRecordingMic, setIsRecordingMic] = useState<boolean>(false);
  const [micLevelDb, setMicLevelDb] = useState<number>(0);
  const [micStatusText, setMicStatusText] = useState<string>(
    'جاهز لالتقاط الصوت عبر الميكروفون أو تحرير النص المنطوق أدناه.'
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const recordStartTsRef = useRef<number>(0);

  const selectedOralDialectProfile = useMemo(
    () =>
      ARABIC_DIALECT_PROFILES.find((d) => d.code === oralDialect) ||
      ARABIC_DIALECT_PROFILES[1],
    [oralDialect]
  );

  const oralFluencyMetrics = useMemo(
    () =>
      evaluateOralReadingAlignment(
        targetOralPassageWords,
        spokenTranscript,
        readingDurationSec,
        hesitationPauses,
        oralDialect
      ),
    [
      targetOralPassageWords,
      spokenTranscript,
      readingDurationSec,
      hesitationPauses,
      oralDialect,
    ]
  );

  const stopMicrophoneSession = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsRecordingMic(false);
    setMicLevelDb(0);
  };

  useEffect(() => {
    return () => {
      stopMicrophoneSession();
    };
  }, []);

  const handleToggleMicrophone = async () => {
    if (isRecordingMic) {
      const elapsedSec = Math.max(
        3,
        Math.round((performance.now() - recordStartTsRef.current) / 1000)
      );
      setReadingDurationSec(elapsedSec);
      stopMicrophoneSession();
      setMicStatusText(
        `اكتمل التسجيل الصوتي (${elapsedSec} ثانية) وتمت مطابقة الكلمات المنطوقة فونولوجياً.`
      );
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      setIsRecordingMic(false);
      setMicStatusText(
        'متصفحك الحالي لا يدعم واجهة التعرف الصوتي المباشر (SpeechRecognition). يمكنك تحرير النص المنطوق يدوياً في الحقل أدناه.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      recordStartTsRef.current = performance.now();
      setIsRecordingMic(true);
      setHesitationPauses(0);
      setMicStatusText(
        'الميكروفون نشط الآن — اقرأ النص العربي بصوت واضح لقياس الطلاقة والتوقفات الصوتية...'
      );

      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silentFrames = 0;
      let speakingDetected = false;

      const monitorAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const level = Math.min(100, Math.round((avg / 128) * 100));
        setMicLevelDb(level);

        if (level > 14) {
          speakingDetected = true;
          if (silentFrames > 28) {
            setHesitationPauses((p) => p + 1);
          }
          silentFrames = 0;
        } else if (speakingDetected) {
          silentFrames++;
        }

        animFrameRef.current = requestAnimationFrame(monitorAudio);
      };
      animFrameRef.current = requestAnimationFrame(monitorAudio);

      const recognition = new SpeechRec();
      recognition.lang = selectedOralDialectProfile.speechRecognitionLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        let fullText = '';
        for (let i = 0; i < event.results.length; i++) {
          fullText += event.results[i][0].transcript + ' ';
        }
        if (fullText.trim()) {
          setSpokenTranscript(fullText.trim());
        }
      };
      recognition.onerror = () => {
        stopMicrophoneSession();
        setMicStatusText(
          'تعذر تشغيل خدمة التعرف الصوتي؛ يمكنك تعديل النص المنطوق يدوياً في الحقل أدناه.'
        );
      };
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      stopMicrophoneSession();
      setMicStatusText(
        'تعذر الوصول للميكروفون في هذه البيئة؛ يمكنك تعديل النص المنطوق مباشرة في الحقل أدناه.'
      );
    }
  };

  // 3. PYGAZE / GAZEPARSER & HEURISTIC ENSEMBLE STATE
  const [gazePresetMode, setGazePresetMode] = useState<'dyslexic' | 'nominal'>('dyslexic');
  const [minFixationThresholdMs, setMinFixationThresholdMs] =
    useState<number>(120);
  const [maxDispersionThresholdPx, setMaxDispersionThresholdPx] =
    useState<number>(45);

  const activeGazeSamples: RawGazeSample[] = useMemo(
    () => SAMPLE_GAZE_PRESETS[gazePresetMode].samples,
    [gazePresetMode]
  );

  const oculomotorHeuristicResult = useMemo(
    () =>
      runOculomotorHeuristicInference(
        activeGazeSamples,
        ARABIC_READING_PASSAGES[0].words.length,
        {
          minFixationDurationMs: minFixationThresholdMs,
          maxDispersionPx: maxDispersionThresholdPx,
          readingDirection: 'rtl',
        }
      ),
    [activeGazeSamples, minFixationThresholdMs, maxDispersionThresholdPx]
  );

  const handleDownloadHeuristicJSON = () => {
    const payload = {
      platform: 'Baseera technical simulation — synthetic examples only',
      dataProvenance: 'synthetic-demo-data',
      diagnosticClassification: null,
      noteAr: 'هذه بيانات اصطناعية لا تخص طفلًا ولا تصلح للفرز أو التشخيص أو اتخاذ قرار تعليمي.',
      timestamp: new Date().toISOString(),
      oculomotorParameters: {
        minFixationDurationMs: minFixationThresholdMs,
        maxDispersionPx: maxDispersionThresholdPx,
        readingDirection: 'rtl',
      },
      extractedFeatures: oculomotorHeuristicResult.features,
      technicalRuleOutputs: {
        temporalHeuristicScore: oculomotorHeuristicResult.temporalHeuristicScore,
        ruleVotes: oculomotorHeuristicResult.ruleVotes,
      },
      irtSimulation: {
        responses: irtHistory.length,
        theta: irtHistory.length > 0 ? currentIRTEstimate.theta : null,
        standardError: irtHistory.length > 0 ? currentIRTEstimate.standardError : null,
        totalFisherInformation: irtHistory.length > 0 ? currentIRTEstimate.totalFisherInformation : null,
        populationRank: null,
        riskClassification: null,
      },
      oralAlignmentDemo: {
        referenceWordCount: targetOralPassageWords.length,
        wcpmIsNormed: false,
        diagnosticClassification: null,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'baseera-technical-simulation.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Executive Header & 3-Lab Segmented Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500 mb-1">
              بيئة تجريبية للمطوّرين · بيانات اصطناعية · لا تنتج نتيجة طفل
            </div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">
              مختبر تقني تجريبي
            </h1>
          </div>

          <button
            type="button"
            onClick={handleDownloadHeuristicJSON}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>تصدير مصفوفة القياس (JSON)</span>
          </button>
        </div>

        <div className="mx-6 mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
          <strong>مهم:</strong> هذه شاشة محاكاة للبرمجة وليست جزءًا من فحص الطفل. معاملات IRT وعتبات حركة العين غير مُعايرة على عينة عربية ممثّلة؛ لا تستخدم درجاتها أو تصنيفاتها لاتخاذ قرار أو لملف طالب. الأمثلة المصطنعة لا تمثل أداءً حقيقيًا.
        </div>

        {/* 3-Lab Segmented Navigation Strip */}
        <div
          role="tablist"
          aria-label="أقسام مختبر الخوارزميات"
          className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 bg-slate-50/50"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeLab === 'irt'}
            onClick={() => setActiveLab('irt')}
            className={`p-4 text-right transition-colors flex items-center justify-between cursor-pointer ${
              activeLab === 'irt'
                ? 'bg-white text-slate-900 font-bold border-b-2 border-b-[#0284C7]'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <div>
              <div className="text-xs text-[#0284C7] font-semibold">
                محاكاة بنود
              </div>
              <div className="text-sm mt-0.5">
                تجربة تقنية لـ IRT 2PL — غير معايرة
              </div>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {irtHistory.length > 0 ? `θ = ${currentIRTEstimate.theta.toFixed(2)}` : 'θ غير متاح بعد'}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeLab === 'oral'}
            onClick={() => setActiveLab('oral')}
            className={`p-4 text-right transition-colors flex items-center justify-between cursor-pointer ${
              activeLab === 'oral'
                ? 'bg-white text-slate-900 font-bold border-b-2 border-b-[#0284C7]'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <div>
              <div className="text-xs text-[#0284C7] font-semibold">
                مثال نصي
              </div>
              <div className="text-sm mt-0.5">
                تجربة محاذاة الكلام إلى النص — ليست WCPM معيارية
              </div>
            </div>
            <span className="text-xs text-slate-500">عرض تجريبي</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeLab === 'pygaze'}
            onClick={() => setActiveLab('pygaze')}
            className={`p-4 text-right transition-colors flex items-center justify-between cursor-pointer ${
              activeLab === 'pygaze'
                ? 'bg-white text-slate-900 font-bold border-b-2 border-b-[#0284C7]'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <div>
              <div className="text-xs text-[#0284C7] font-semibold">
                معالجة إحداثيات
              </div>
              <div className="text-sm mt-0.5">
                تجربة تقنية لبيانات عين اصطناعية
              </div>
            </div>
            <span className="text-xs text-slate-500">غير سريري</span>
          </button>
        </div>
      </div>

      {/* LAB 1: 2PL IRT ADAPTIVE ENGINE */}
      {activeLab === 'irt' && (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="p-6 sm:p-8 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">
                2-Parameter Logistic Item Response Theory (IRT 2PL)
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                محاكاة نظرية استجابة الفقرة (IRT) بمعاملات توضيحية غير معايرة
              </h3>
            </div>

            <button
              type="button"
              onClick={handleResetIRT}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط جلسة IRT</span>
            </button>
          </div>

          {/* Flat Hairline-Divided 4-Column Live IRT Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-b border-slate-200 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 bg-slate-50/40">
            <div className="p-5">
              <div className="text-xs text-slate-500">
                القدرة الكامنة المقدّرة (θ)
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span
                  dir="ltr"
                  className="text-2xl font-bold font-mono tabular-nums text-slate-900"
                >
                  {irtHistory.length === 0
                    ? '—'
                    : currentIRTEstimate.theta >= 0
                      ? `+${currentIRTEstimate.theta.toFixed(2)}`
                      : currentIRTEstimate.theta.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-[#0284C7] font-semibold">
                  {irtHistory.length > 0 ? `رتبة نظرية داخل النموذج: ${currentIRTEstimate.modelBasedRank} (ليست مئينًا سكانيًا)` : 'لا توجد بيانات؛ أجب عن بند تجريبي لعرض حسابات النموذج'}
                </span>
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs text-slate-500">
                الخطأ المعياري للقياس SE(θ)
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span
                  dir="ltr"
                  className="text-2xl font-bold font-mono tabular-nums text-slate-900"
                >
                  ±{currentIRTEstimate.standardError.toFixed(2)}
                </span>
                <span
                  dir="ltr"
                  className="text-xs font-mono text-[#059669] font-semibold"
                >
                  I(θ) = {currentIRTEstimate.totalFisherInformation.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs text-slate-500">
                الفقرات المختارة تكيفياً
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {irtHistory.length} / {CLINICAL_IRT_ITEM_BANK.length}
                </span>
                <span className="text-xs font-mono text-slate-600">
                  صحيحة: {irtHistory.filter((h) => h.correct).length}
                </span>
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs text-slate-500">حدود غير مُعايرة — لا تصنيف</div>
              <div className="mt-1 text-xs font-bold text-slate-900 leading-snug">
                {currentIRTEstimate.interpretationLabelAr}
              </div>
            </div>
          </div>

          {/* Split Grid: Left Active Adaptive Question (7 cols) + Right ICC Curve SVG (5 cols) */}
          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 bg-[#F8FAFC] border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              {activeIRTItem ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-200 pb-3">
                    <span className="font-semibold text-[#0284C7]">
                      المجال: {activeIRTItem.domainLabelAr}
                    </span>
                    <div className="flex items-center gap-3 font-mono text-[11px] text-slate-600">
                      <span>a = {activeIRTItem.discriminationA}</span>
                      <span>·</span>
                      <span>b = {activeIRTItem.difficultyB}</span>
                      <span>·</span>
                      <span className="text-[#059669] font-semibold">
                        Max I(θ) = {nextAdaptiveSelection.maxFisherInformation}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-bold text-slate-900">
                      {activeIRTItem.promptAr}
                    </div>
                    <div className="p-4 bg-white border border-slate-200 rounded-xl text-center text-xl font-bold font-display text-slate-900">
                      {activeIRTItem.stimulusText}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {activeIRTItem.options.map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAnswerIRTItem(idx)}
                        className="p-3.5 text-right text-sm font-semibold bg-white hover:bg-sky-50 border border-slate-200 hover:border-[#0284C7] rounded-xl transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span>{opt}</span>
                        <span className="text-xs font-mono text-slate-400">
                          #{idx + 1}
                        </span>
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                    الأساس التربوي: {activeIRTItem.clinicalRationaleAr}
                  </p>
                </div>
              ) : (
                <div className="py-10 text-center space-y-3">
                  <CheckCircle2 className="w-8 h-8 text-[#059669] mx-auto" />
                  <div className="text-base font-bold text-slate-900">
                    انتهى العرض التوضيحي لفقرات النموذج.
                  </div>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    القيمة التوضيحية داخل النموذج θ ={' '}
                    {currentIRTEstimate.theta.toFixed(2)}، ومقدار الخطأ المحسوب داخله SE = ±
                    {currentIRTEstimate.standardError.toFixed(2)}. لا تمثل هذه الأرقام درجة معيارية؛ فمعاملات الفقرات غير معايرة على عينة طلاب ممثلة.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetIRT}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] rounded-lg cursor-pointer"
                  >
                    إعادة تشغيل العرض التوضيحي
                  </button>
                </div>
              )}
            </div>

            {/* 5 Cols: Real-time SVG Item Characteristic Curve */}
            <div className="lg:col-span-5 bg-[#F8FAFC] border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      منحنى خصائص الفقرة (2PL ICC) ودالة معلومات فيشر
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      P(X=1 | θ) = 1 / (1 + exp(-a(θ - b)))
                    </p>
                  </div>
                  <Activity className="w-4 h-4 text-[#0284C7]" />
                </div>

                <svg
                  viewBox="0 0 340 190"
                  className="w-full h-auto bg-white border border-slate-200 rounded-xl"
                  role="img"
                  aria-label="منحنى نظرية استجابة الفقرة 2PL IRT"
                >
                  <line
                    x1="35"
                    y1="20"
                    x2="35"
                    y2="155"
                    stroke="#CBD5E1"
                    strokeWidth="1"
                  />
                  <line
                    x1="35"
                    y1="155"
                    x2="320"
                    y2="155"
                    stroke="#CBD5E1"
                    strokeWidth="1"
                  />
                  <line
                    x1="35"
                    y1="87.5"
                    x2="320"
                    y2="87.5"
                    stroke="#E2E8F0"
                    strokeDasharray="3 3"
                  />

                  {(() => {
                    const item =
                      activeIRTItem ||
                      irtHistory[irtHistory.length - 1]?.item ||
                      CLINICAL_IRT_ITEM_BANK[0];
                    const pointsProb: string[] = [];
                    const pointsInfo: string[] = [];

                    for (let t = -3.0; t <= 3.0; t += 0.15) {
                      const x = 35 + ((t + 3.0) / 6.0) * 285;
                      const p = computeIRT2PLProbability(
                        t,
                        item.discriminationA,
                        item.difficultyB
                      );
                      const yP = 155 - p * 130;
                      pointsProb.push(`${x.toFixed(1)},${yP.toFixed(1)}`);

                      const info = computeIRTFisherInformation(
                        t,
                        item.discriminationA,
                        item.difficultyB
                      );
                      const yI = 155 - Math.min(1, info / 1.5) * 125;
                      pointsInfo.push(`${x.toFixed(1)},${yI.toFixed(1)}`);
                    }

                    const thetaX =
                      35 + ((currentIRTEstimate.theta + 3.0) / 6.0) * 285;
                    const thetaP = computeIRT2PLProbability(
                      currentIRTEstimate.theta,
                      item.discriminationA,
                      item.difficultyB
                    );
                    const thetaY = 155 - thetaP * 130;

                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="#059669"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                          points={pointsInfo.join(' ')}
                        />
                        <polyline
                          fill="none"
                          stroke="#0284C7"
                          strokeWidth="2.5"
                          points={pointsProb.join(' ')}
                        />
                        <line
                          x1={thetaX}
                          y1="20"
                          x2={thetaX}
                          y2="155"
                          stroke="#DC2626"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                        />
                        <circle
                          cx={thetaX}
                          cy={thetaY}
                          r="5.5"
                          fill="#DC2626"
                          stroke="#FFFFFF"
                          strokeWidth="1.5"
                        />
                        <text
                          x={Math.min(290, Math.max(55, thetaX))}
                          y="32"
                          fontSize="9"
                          fontWeight="700"
                          fill="#DC2626"
                          textAnchor="middle"
                        >
                          {irtHistory.length > 0 ? `θ = ${currentIRTEstimate.theta.toFixed(2)}` : 'θ غير متاح بعد'}
                        </text>
                      </>
                    );
                  })()}

                  <text x="38" y="172" fontSize="9" fill="#64748B">
                    -3.0
                  </text>
                  <text
                    x="177"
                    y="172"
                    fontSize="9"
                    fill="#64748B"
                    textAnchor="middle"
                  >
                    θ = 0.0
                  </text>
                  <text
                    x="315"
                    y="172"
                    fontSize="9"
                    fill="#64748B"
                    textAnchor="end"
                  >
                    +3.0
                  </text>
                </svg>
              </div>

              <div className="pt-3 text-[11px] text-slate-600 flex items-center justify-between">
                <span>● الأزرق: احتمالية الإجابة P(θ)</span>
                <span>--- الأخضر: معلومات فيشر I(θ)</span>
              </div>
            </div>
          </div>

          {irtHistory.length > 0 && (
            <div className="overflow-x-auto px-6 sm:px-8 pb-8">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] text-slate-500 bg-slate-50">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">المجال والفقرة</th>
                    <th className="py-2 px-3 text-left">المعاملات (a, b)</th>
                    <th className="py-2 px-3">النتيجة وزمن الكمون</th>
                    <th className="py-2 px-3 text-left">تحديث القدرة (θ)</th>
                    <th className="py-2 px-3 text-left">SE(θ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {irtHistory.map((rec, i) => (
                    <tr key={i}>
                      <td className="py-2.5 px-3 font-mono">{i + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {rec.item.domainLabelAr} ({rec.item.stimulusText})
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono text-slate-600">
                        a={rec.item.discriminationA}, b={rec.item.difficultyB}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span
                          className={
                            rec.correct
                              ? 'text-[#059669] font-semibold'
                              : 'text-[#DC2626] font-semibold'
                          }
                        >
                          {rec.correct ? '● صحيحة' : '▲ خاطئة'} (
                          {rec.reactionTimeMs}ms)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono font-bold text-[#0284C7]">
                        {rec.thetaBefore.toFixed(2)} →{' '}
                        {rec.thetaAfter.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono text-slate-700">
                        ±{rec.standardErrorAfter.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* LAB 2: ORAL READING FLUENCY & ARABIC DIALECT ALIGNMENT */}
      {activeLab === 'oral' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">
                WebRTC Audio + Dialect-Aware Arabic Phonological Alignment
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                تحليل تجريبي للقراءة الجهرية ومحاذاة النص المنطوق
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="لهجة الطالب في التقييم الصوتي"
                value={oralDialect}
                onChange={(e) =>
                  setOralDialect(e.target.value as ArabicDialectCode)
                }
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
              >
                {ARABIC_DIALECT_PROFILES.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.labelAr}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleToggleMicrophone}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  isRecordingMic
                    ? 'bg-[#DC2626] text-white'
                    : 'bg-[#0284C7] hover:bg-[#0369A1] text-white'
                }`}
              >
                {isRecordingMic ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>إيقاف التسجيل الصوتي</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>
                      بدء التقاط الصوت (
                      {selectedOralDialectProfile.speechRecognitionLang})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Volume2 className="w-4 h-4 text-[#0284C7] shrink-0" />
              <span>{micStatusText}</span>
            </div>
            {isRecordingMic && (
              <div className="flex items-center gap-2 font-mono">
                <span>شدة الإشارة:</span>
                <div className="w-28 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${micLevelDb}%` }}
                    className="h-full bg-[#059669] transition-all"
                  />
                </div>
                <span>{micLevelDb} dB</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-4">
              <div className="p-5 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                  <span>
                    النص المرجعي ومحاذاة الكلمات ({selectedOralDialectProfile.labelAr}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        dialect: 'gulf' as ArabicDialectCode,
                        label: 'عينة طالب خليجي',
                        text: 'زار تلاب المدرسه المرصد الفلكي في مساء صاف لمشاهده الكواكب المضيئه وحط المهندس المنضار',
                      },
                      {
                        dialect: 'egyptian' as ArabicDialectCode,
                        label: 'عينة طالب مصري',
                        text: 'زار طلاب المدرسه المرصد الفلكي في مساء صافي عشان مشاهده الكواكب المضيئه وحط المهندس المنظار',
                      },
                      {
                        dialect: 'levantine' as ArabicDialectCode,
                        label: 'عينة طالب شامي',
                        text: 'زار طلاب المدرسه المرصد الفلكي في مساء صافي لمشاهده الكواكب المضيئه وحط المهندس المنظار',
                      },
                    ].map((p) => (
                      <button
                        key={p.dialect}
                        type="button"
                        onClick={() => {
                          setOralDialect(p.dialect);
                          setSpokenTranscript(p.text);
                        }}
                        className="px-2.5 py-1 text-[11px] bg-white hover:bg-sky-50 border border-slate-200 rounded-md text-slate-700 font-medium cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {oralFluencyMetrics.alignment.map((item, idx) => (
                    <div
                      key={idx}
                      className={`px-3 py-1.5 rounded-lg border text-xs ${
                        item.status === 'correct'
                          ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                          : item.status === 'dialect_variant'
                            ? 'bg-sky-50 border-sky-300 text-sky-950'
                            : item.status === 'phonetic_substitution'
                              ? 'bg-amber-50 border-amber-300 text-amber-950'
                              : 'bg-rose-50 border-rose-300 text-rose-950'
                      }`}
                    >
                      <div className="font-bold">{item.targetWord}</div>
                      <div className="text-[10px] opacity-85">
                        {item.status === 'correct'
                          ? '● مطابق'
                          : item.status === 'dialect_variant'
                            ? `◆ لهجة مقبولة: ${item.spokenWord}`
                            : item.status === 'phonetic_substitution'
                              ? `▲ إبدال: ${item.spokenWord}`
                              : '■ حُذفت'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="oral-transcript-input"
                  className="block text-xs font-semibold text-slate-700 mb-2"
                >
                  النص المنطوق المسجل (يمكنك تعديله يدوياً لاختبار خوارزمية المحاذاة الصوتية):
                </label>
                <textarea
                  id="oral-transcript-input"
                  rows={2}
                  value={spokenTranscript}
                  onChange={(e) => setSpokenTranscript(e.target.value)}
                  className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0284C7]"
                />
              </div>
            </div>

            <div className="lg:col-span-4 bg-[#F8FAFC] border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-3">
                مؤشرات الطلاقة الصوتية واللهجية
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                  <div className="text-[11px] text-slate-500">
                    الكلمات الصحيحة/د
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {oralFluencyMetrics.wcpm}{' '}
                    <span className="text-[11px] font-normal">WCPM</span>
                  </div>
                </div>
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                  <div className="text-[11px] text-slate-500">
                    نسبة المطابقة المحسوبة
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums text-[#059669] mt-0.5">
                    {oralFluencyMetrics.accuracyPercent}%
                  </div>
                </div>
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                  <div className="text-[11px] text-slate-500">
                    بدائل لهجية مقبولة
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-[#0284C7] mt-0.5">
                    {oralFluencyMetrics.dialectVariantCount}
                  </div>
                </div>
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                  <div className="text-[11px] text-slate-500">
                    إبدالات فونولوجية
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-[#D97706] mt-0.5">
                    {oralFluencyMetrics.phoneticSubstitutionCount}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 pt-3 border-t border-slate-200 flex items-center justify-between">
                <span>معدل الخطأ اللفظي (WER):</span>
                <span className="font-mono font-bold text-slate-900">
                  {oralFluencyMetrics.werPercent}%
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* LAB 3: PYGAZE OCULOMOTOR & HEURISTIC CLASSIFIER */}
      {activeLab === 'pygaze' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">
                كشف التثبيتات والقفزات بطريقة عتبية مستوحاة من I-DT/I-VT
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                تحليل تقني لعينة إحداثيات اصطناعية
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              {[
                { id: 'dyslexic', label: 'نمط اصطناعي (أ)' },
                { id: 'nominal', label: 'نمط اصطناعي (ب)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setGazePresetMode(
                      tab.id as 'dyslexic' | 'nominal'
                    )
                  }
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    gazePresetMode === tab.id
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950 leading-relaxed">
            <strong className="font-bold">إفصاح منهجي: </strong>
            {oculomotorHeuristicResult.clinicalValidationDisclaimerAr}
          </div>

          {/* I-DT-style heuristic controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 bg-[#F8FAFC] border border-slate-200 rounded-xl">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label
                  htmlFor="pygaze-min-dur"
                  className="font-medium text-slate-700 flex items-center gap-1"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>عتبة زمن التثبيت الأدنى</span>
                </label>
                <span className="font-mono font-bold text-slate-900">
                  {minFixationThresholdMs} ms
                </span>
              </div>
              <input
                id="pygaze-min-dur"
                type="range"
                min={80}
                max={240}
                step={10}
                value={minFixationThresholdMs}
                onChange={(e) =>
                  setMinFixationThresholdMs(Number(e.target.value))
                }
                className="w-full accent-[#0284C7] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label
                  htmlFor="pygaze-max-disp"
                  className="font-medium text-slate-700"
                >
                  عتبة التشتت المكاني (I-DT Dispersion)
                </label>
                <span className="font-mono font-bold text-slate-900">
                  {maxDispersionThresholdPx} px
                </span>
              </div>
              <input
                id="pygaze-max-disp"
                type="range"
                min={20}
                max={80}
                step={5}
                value={maxDispersionThresholdPx}
                onChange={(e) =>
                  setMaxDispersionThresholdPx(Number(e.target.value))
                }
                className="w-full accent-[#0284C7] cursor-pointer"
              />
            </div>

            <div className="flex flex-col justify-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <div className="text-[11px] text-slate-500">حالة هذه المحاكاة</div>
              <p className="mt-1 text-sm font-bold text-slate-800">بيانات اصطناعية فقط</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">لا تُعرض درجة خطر؛ الأوزان والعتبات داخلية وغير مُعايرة.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-[#0284C7]" />
                <span>قواعد الفرز الاستدلالية الخمس والأوزان المبرمجة</span>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-[#F8FAFC] overflow-hidden">
                {oculomotorHeuristicResult.ruleVotes.map((rule) => (
                  <div key={rule.ruleId} className="p-4 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">
                        {rule.ruleNameAr}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-[#0284C7]">
                        {Math.round(rule.normalizedRuleScore * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {rule.decisionPathAr}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-[#0284C7]" />
                <span>مصفوفة الميزات المستخلصة</span>
              </div>

              <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5 space-y-3.5">
                {oculomotorHeuristicResult.weightedIndicators.map((feat, idx) => (
                  <div
                    key={idx}
                    className="pb-3 border-b border-slate-200/70 last:border-b-0 last:pb-0 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span>{feat.featureNameAr}</span>
                      <span className="font-mono text-[#0284C7]">
                        وزن {feat.weightPercent}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1 font-mono">
                      <span>القيمة: {feat.observedValue}</span>
                      <span>مرجع استرشادي غير معياري: {feat.heuristicReferenceRange}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
