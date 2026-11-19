import React, { useState, useRef, useEffect } from 'react';
import { convertRecordedAudioToWavBase64 } from '../utils/browserAudioWav';

interface AlignedWord {
  word: string;
  spokenWord?: string | null;
  errorType?: string;
  accuracyScore?: number | null;
  notesAr?: string;
}

interface EngineResult {
  configured: boolean;
  latencyMs: number | null;
  error: string | null;
  result: {
    sourceModel?: string;
    transcript?: string;
    wordAccuracyPercent?: number | null;
    accuracyScore?: number | null;
    fluencyScore?: number | null;
    completenessScore?: number | null;
    pronScore?: number | null;
    words?: AlignedWord[];
    insertions?: string[];
    phoneticObservationsAr?: string;
    nonwordAnalysisAr?: string;
    summaryAr?: string;
    rawResponse?: any;
  } | null;
}

interface ComparisonPayload {
  referenceText: string;
  referenceWords: string[];
  durationSeconds: number;
  language: 'ar-EG' | 'ar-SA';
  azure: EngineResult;
  google: EngineResult;
  comparison: {
    winnerFastest: 'azure' | 'google' | 'tie' | null;
    transcriptMatch: boolean | null;
    accuracyDelta: number | null;
  };
}

const PRESET_STIMULI = [
  {
    category: 'كلمات مفردة (فحص كسر الكاف ومد التاء ومخارج الحروف)',
    items: [
      { label: 'كِتَابْ', text: 'كِتَابْ', desc: 'لفحص كسر الكاف ومد التاء وعدم نطقها (كَتَاب)' },
      { label: 'وَلَدْ', text: 'وَلَدْ', desc: 'لفحص سكون الدال وعدم إضافة علامات ترقيم (وَلَدْ.)' },
      { label: 'سَمَكَة', text: 'سَمَكَة', desc: 'فحص مخرج حرف السين' },
      { label: 'صَفَّارَة', text: 'صَفَّارَة', desc: 'فحص إطباق الصاد والتمييز بين س و ص' },
      { label: 'ذُرَة', text: 'ذُرَة', desc: 'فحص مخرج حرف الذال اللثوي' },
    ],
  },
  {
    category: 'كلمات مصنوعة (اختبار فك الترميز النقي ودقة التعرّف)',
    items: [
      { label: 'مَلَسَ', text: 'مَلَسَ', desc: 'كلمة مصنوعة: هل يقرؤها أم يصححها إلى (جلس) أو (ملساء)؟' },
      { label: 'فَرَتَ', text: 'فَرَتَ', desc: 'كلمة مصنوعة: هل يحفظ حروفها أم يصححها إلى (فترة/فرش)؟' },
      { label: 'سَمِيد', text: 'سَمِيد', desc: 'فحص قراءة الكلمة بدقة' },
      { label: 'دَرَسَ', text: 'دَرَسَ', desc: 'كلمة حقيقية للمقارنة مع المصنوع' },
    ],
  },
  {
    category: 'قراءة متصلة (نص قصة سامي)',
    items: [
      {
        label: 'جملة قصة سامي',
        text: 'ذَهَبَ سَامِي مَعَ أَبِيهِ إِلَى السُّوقِ. رَأَى سَامِي تُفَّاحًا أَحْمَرَ وَمَوْزًا أَصْفَرَ.',
        desc: 'نص كامل لاختبار الطلاقة والمحاذاة القسرية للكلمات المتصلة',
      },
    ],
  },
];

export default function AudioComparisonLabView() {
  const [referenceText, setReferenceText] = useState<string>('كِتَابْ');
  const language: 'ar-SA' = 'ar-SA';
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioWavBase64, setAudioWavBase64] = useState<string | null>(null);
  const [browserWebSpeechTranscript, setBrowserWebSpeechTranscript] = useState<string>('');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isLoadingSample, setIsLoadingSample] = useState<boolean>(false);
  const [guidanceTip, setGuidanceTip] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<ComparisonPayload | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [customGeminiKey, setCustomGeminiKey] = useState<string>(() => {
    return localStorage.getItem('baseera_custom_gemini_key') || '';
  });
  const [showKeySettings, setShowKeySettings] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const browserSpeechRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (browserSpeechRef.current) {
        try { browserSpeechRef.current.stop(); } catch {}
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setEvalResult(null);
    setEvalError(null);
    setGuidanceTip(null);
    setBrowserWebSpeechTranscript('');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Browser Web Speech API in parallel (if supported)
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        try {
          const rec = new SpeechRecognitionClass();
          rec.lang = 'ar-SA';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (e: any) => {
            let tr = '';
            for (let i = 0; i < e.results.length; i++) {
              tr += e.results[i][0]?.transcript || '';
            }
            setBrowserWebSpeechTranscript(tr);
          };
          rec.start();
          browserSpeechRef.current = rec;
        } catch {}
      }

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (browserSpeechRef.current) {
          try { browserSpeechRef.current.stop(); } catch {}
        }

        const rawBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(rawBlob);
        const url = URL.createObjectURL(rawBlob);
        setAudioUrl(url);

        try {
          const wavBase64 = await convertRecordedAudioToWavBase64(rawBlob, 16000);
          setAudioWavBase64(wavBase64);
          setGuidanceTip('تم التقاط التسجيل بنجاح! زر المقارنة بالأسفل جاهز للضغط الآن ⚡');
        } catch (wavErr: any) {
          setEvalError('تعذر تحويل الصوت إلى صيغة WAV: ' + (wavErr?.message || String(wavErr)));
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (micErr: any) {
      const msg = micErr?.name === 'NotAllowedError' || micErr?.name === 'PermissionDeniedError'
        ? 'تم رفض إذن الميكروفون من المتصفح. يرجى الضغط على أيقونة القفل أو الكاميرا بجانب شريط العنوان في Chrome والسماح بالميكروفون، أو استخدام زر "استخدم عينة نطق جاهزة" أدناه دون الحاجة للميكروفون.'
        : ('تعذر فتح الميكروفون: ' + (micErr?.message || String(micErr)));
      setEvalError(msg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEvalResult(null);
    setEvalError(null);
    setGuidanceTip(null);
    setBrowserWebSpeechTranscript('');
    setAudioBlob(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    try {
      const wavBase64 = await convertRecordedAudioToWavBase64(file, 16000);
      setAudioWavBase64(wavBase64);
      setGuidanceTip('تم تحميل الملف وتحويله لصيغة 16kHz WAV بنجاح! زر المقارنة جاهز للضغط الآن ⚡');
    } catch (err: any) {
      setEvalError('تعذر تحويل الملف إلى صيغة WAV 16kHz: ' + (err?.message || String(err)));
    }
  };

  /**
   * Generates or fetches a synthetic pedagogical audio sample for the current reference text,
   * converting it to 16kHz WAV and enabling instant comparison without mic prerequisites.
   */
  const loadSyntheticSample = async () => {
    if (!referenceText.trim()) return;
    setIsLoadingSample(true);
    setEvalError(null);
    setGuidanceTip(null);
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: referenceText.trim(),
          voice: 'ML7jGRDg4E9hIl5qEm1Z',
          rate: '0%',
        }),
      });

      if (!res.ok) {
        throw new Error(`تعذر توليد العينة الصوتية: HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.audioBase64) {
        throw new Error('لم تصل بيانات صوتية صالحة من خدمة النطق.');
      }

      // Convert base64 audio to Blob
      const byteChars = atob(data.audioBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType || 'audio/mp3' });

      setAudioBlob(blob);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      // Convert to 16kHz mono WAV for Azure and Google
      const wavBase64 = await convertRecordedAudioToWavBase64(blob, 16000);
      setAudioWavBase64(wavBase64);
      setRecordingSeconds(2);
      setGuidanceTip('تم تحميل العينة الصوتية الجاهزة بنجاح! اضغط زر «قارن بين Azure و Google الآن» بالأسفل 👇');
    } catch (err: any) {
      setEvalError('فشل جلب العينة التجريبية: ' + (err?.message || String(err)));
    } finally {
      setIsLoadingSample(false);
    }
  };

  const executeComparison = async () => {
    if (!audioWavBase64) {
      setGuidanceTip('🎙️ زر المقارنة يحتاج إلى تسجيل صوتي! يرجى الضغط على زر "ابدأ تسجيل الصوت الآن" الأحمر أعلاه، أو اضغط زر "استخدم عينة نطق جاهزة".');
      return;
    }
    if (!referenceText.trim()) {
      setEvalError('يرجى إدخال النص المطلوب قراءته.');
      return;
    }

    setIsEvaluating(true);
    setEvalError(null);
    setGuidanceTip(null);

    try {
      const res = await fetch('/api/ai/compare-audio-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceText: referenceText.trim(),
          audioWavBase64,
          durationSeconds: Math.max(1, recordingSeconds || 3),
          language,
          geminiApiKey: customGeminiKey.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data: ComparisonPayload = await res.json();
      setEvalResult(data);
    } catch (err: any) {
      setEvalError('فشل التقييم: ' + (err?.message || String(err)));
    } finally {
      setIsEvaluating(false);
    }
  };

  const renderWordBadge = (w: AlignedWord, idx: number) => {
    const isOk = w.errorType === 'None' || !w.errorType;
    const isSub = w.errorType === 'Substitution';
    const isOm = w.errorType === 'Omission';
    const isMis = w.errorType === 'Mispronunciation';

    let badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    let typeAr = 'نطق سليم';
    if (isSub) {
      badgeClass = 'bg-rose-50 text-rose-800 border-rose-300';
      typeAr = 'استبدال كلمة';
    } else if (isOm) {
      badgeClass = 'bg-slate-100 text-slate-700 border-slate-300';
      typeAr = 'كلمة محذوفة';
    } else if (isMis) {
      badgeClass = 'bg-amber-50 text-amber-900 border-amber-300';
      typeAr = 'خطأ نطق/تشكيل';
    }

    return (
      <div key={idx} className={`p-3 rounded-xl border flex flex-col gap-1 text-sm ${badgeClass}`}>
        <div className="flex items-center justify-between">
          <span className="font-black text-base font-child">{w.word}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 font-semibold">{typeAr}</span>
        </div>
        {w.spokenWord && w.spokenWord !== w.word && (
          <div className="text-xs">
            <span className="text-slate-500 font-bold">المسموع: </span>
            <span className="font-bold underline">{w.spokenWord}</span>
          </div>
        )}
        {typeof w.accuracyScore === 'number' && (
          <div className="text-xs font-bold">
            درجة الدقة: {w.accuracyScore}٪
          </div>
        )}
        {w.notesAr && (
          <div className="text-xs opacity-90 mt-1 italic border-t pt-1 border-current/20">
            {w.notesAr}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-sans" dir="rtl">
      {/* Title & Context */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <span className="inline-block px-3 py-1 bg-amber-400 text-slate-900 text-xs font-black rounded-full mb-2">
              مختبر تجريبي محلي (Localhost Lab)
            </span>
            <h1 className="text-2xl sm:text-3xl font-black">
              مختبر مقارنة التقييم الصوتي: Azure ضد Google
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowKeySettings(!showKeySettings)}
              className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${
                customGeminiKey
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/20'
              }`}
            >
              <span>🔑</span>
              <span>{customGeminiKey ? 'مفتاح Google مخصص (فعّال)' : 'إعداد مفتاح Google'}</span>
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-teal-300">
              <span>اللغة: الفصحى المعيارية (ar-SA)</span>
            </div>
          </div>
        </div>

        {/* Custom Gemini Key Settings Banner */}
        {showKeySettings && (
          <div className="mb-4 p-4 bg-slate-800/90 border border-amber-400/40 rounded-2xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-amber-300 flex items-center gap-1.5">
                <span>🔑</span> إعداد مفتاح الذكاء الاصطناعي (OpenRouter أو Google AI Studio):
              </span>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 underline font-bold hover:text-amber-300"
              >
                مفاتيح OpenRouter ↗
              </a>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              يدعم المختبر مفاتيح <strong>OpenRouter</strong> (تبدأ بـ <code className="text-amber-300">sk-or-v1-...</code> لتشغيل نماذج Gemini 2.5 Flash) أو مفاتيح <strong>Google AI Studio</strong> المباشرة:
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={customGeminiKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomGeminiKey(val);
                  localStorage.setItem('baseera_custom_gemini_key', val);
                }}
                placeholder="الصق مفتاح OpenRouter (sk-or-v1-...) أو Google Gemini..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              {customGeminiKey && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomGeminiKey('');
                    localStorage.removeItem('baseera_custom_gemini_key');
                  }}
                  className="px-3 py-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl font-bold text-xs"
                >
                  مسح
                </button>
              )}
            </div>
          </div>
        )}

        <p className="text-slate-300 text-sm leading-relaxed max-w-3xl">
          يتيح لك هذا المختبر اختبار كلا المحركين بنفس ملف الصوت مباشرة على Localhost: استمع لميكروفونك أو ارفع تسجيلًا أو استخدم عينة جاهزة، وقارن سرعة الاستجابة، ودقة رصد التشكيل ومخارج الحروف، وسلوك الكلمات المصنوعة (Nonwords) بين تقييم النطق المتخصص في Azure والذكاء الاصطناعي متعدد الوسائط في Google Gemini.
        </p>

        {/* 3-Step Interactive Process Guide */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white/10 p-3 rounded-2xl flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-emerald-400 text-slate-900 font-black text-sm flex items-center justify-center shrink-0">١</span>
            <div>
              <div className="text-xs font-black text-white">اختر أو اكتب الكلمة</div>
              <div className="text-[11px] text-slate-300 truncate font-child">{referenceText}</div>
            </div>
          </div>
          <div className={`p-3 rounded-2xl flex items-center gap-3 transition-all ${
            audioWavBase64
              ? 'bg-emerald-500/20 border border-emerald-400/50'
              : isRecording
                ? 'bg-rose-500/30 border border-rose-400 animate-pulse'
                : 'bg-white/10'
          }`}>
            <span className={`w-8 h-8 rounded-full font-black text-sm flex items-center justify-center shrink-0 ${
              audioWavBase64 ? 'bg-emerald-400 text-slate-900' : 'bg-amber-400 text-slate-900'
            }`}>٢</span>
            <div>
              <div className="text-xs font-black text-white">سجّل صوتك أو حمّل عيّنة</div>
              <div className="text-[11px] text-slate-300">
                {audioWavBase64 ? '✓ التسجيل جاهز للمقارنة' : isRecording ? 'جاري التسجيل الآن 🔴' : 'بانتظار التسجيل أو العينة'}
              </div>
            </div>
          </div>
          <div className={`p-3 rounded-2xl flex items-center gap-3 transition-all ${
            evalResult
              ? 'bg-emerald-500/20 border border-emerald-400/50'
              : audioWavBase64
                ? 'bg-amber-400/20 border border-amber-300 animate-pulse'
                : 'bg-white/5 opacity-70'
          }`}>
            <span className={`w-8 h-8 rounded-full font-black text-sm flex items-center justify-center shrink-0 ${
              evalResult ? 'bg-emerald-400 text-slate-900' : 'bg-slate-700 text-white'
            }`}>٣</span>
            <div>
              <div className="text-xs font-black text-white">قارن النتائج جنبًا إلى جنب</div>
              <div className="text-[11px] text-slate-300">
                {evalResult ? 'اكتملت المقارنة ✓' : isEvaluating ? 'جاري التحليل بالتوازي...' : audioWavBase64 ? 'جاهز للضغط الآن ⚡' : 'بعد تجهيز الصوت'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Stimuli */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-6">
        <h2 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
          <span>🎯</span> نصوص تجريبية جاهزة (أشهر حالات اللبس والتشخيص):
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRESET_STIMULI.map((group, gIdx) => (
            <div key={gIdx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
              <span className="text-xs font-bold text-indigo-900">{group.category}</span>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item, iIdx) => (
                  <button
                    key={iIdx}
                    type="button"
                    onClick={() => {
                      setReferenceText(item.text);
                      setAudioWavBase64(null);
                      setAudioUrl(null);
                      setEvalResult(null);
                      setGuidanceTip(null);
                    }}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                      referenceText === item.text
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-400'
                    }`}
                    title={item.desc}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reference Text Input */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-6">
        <label className="block text-sm font-black text-slate-800 mb-2">
          النص المطلوب قراءته (النص المرجعي):
        </label>
        <textarea
          value={referenceText}
          onChange={(e) => {
            setReferenceText(e.target.value);
            setAudioWavBase64(null);
            setAudioUrl(null);
            setEvalResult(null);
            setGuidanceTip(null);
          }}
          rows={2}
          className="w-full text-lg font-bold p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-child leading-relaxed text-slate-800"
          placeholder="اكتب هنا الكلمة أو الجملة المطلوب نطقها مع التشكيل..."
        />
        <div className="text-xs text-slate-400 font-semibold mt-1">
          عدد الكلمات المرجعية: {referenceText.trim().split(/\s+/).filter(Boolean).length} كلمة
        </div>
      </div>

      {/* Recording & Audio Controls */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-2 px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl shadow-md transition-all active:scale-95"
              >
                <span className="w-3.5 h-3.5 rounded-full bg-white animate-pulse" />
                ابدأ تسجيل الصوت الآن (الميكروفون)
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-black text-white font-black rounded-2xl shadow-md transition-all active:scale-95 animate-pulse"
              >
                <span className="w-3.5 h-3.5 rounded bg-rose-500" />
                ⏹️ اضغط هنا لإيقاف التسجيل ({recordingSeconds} ثانية)
              </button>
            )}

            <button
              type="button"
              onClick={loadSyntheticSample}
              disabled={isLoadingSample || isRecording}
              className="flex items-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm rounded-2xl border border-amber-600/30 transition-all active:scale-95 shadow-sm"
              title="يولّد نطقًا صحيحًا للكلمة لتجربة المقارنة فورًا دون الحاجة لاستخدام الميكروفون"
            >
              <span>⚡</span>
              <span>{isLoadingSample ? 'جاري التوليد...' : 'استخدم عيّنة نطق جاهزة للكلمة'}</span>
            </button>

            <label className="cursor-pointer px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-2xl border border-slate-200 transition-all">
              <span>📁 رفع ملف صوتي جاهز</span>
              <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {audioUrl && (
            <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-600">التسجيل الجاهز:</span>
              <audio src={audioUrl} controls className="h-9 w-48 sm:w-60" />
            </div>
          )}
        </div>

        {/* Recording active banner */}
        {isRecording && (
          <div className="mt-4 p-4 bg-rose-50 border-2 border-rose-300 text-rose-900 rounded-2xl flex flex-wrap items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-rose-600 animate-ping" />
              <div>
                <div className="font-black text-base">جاري تسجيل صوتك الآن ({recordingSeconds} ثانية)...</div>
                <div className="text-xs text-rose-700 font-bold">تكلّم بوضوح وانطق: «{referenceText}»، ثم اضغط زر الإيقاف لاعتماد الصوت.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-xl shadow active:scale-95 shrink-0"
            >
              ⏹️ اضغط هنا لإيقاف التسجيل
            </button>
          </div>
        )}

        {/* Audio Ready Banner */}
        {audioWavBase64 && !isRecording && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-2xl text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span>تم التقاط التسجيل بنجاح! زر المقارنة أدناه مفعل وجاهز للضغط الآن 👇</span>
            </div>
            <button
              type="button"
              onClick={executeComparison}
              disabled={isEvaluating}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow active:scale-95"
            >
              قارن بين Azure و Google الآن ⚡
            </button>
          </div>
        )}

        {/* Guidance tip / helper alert */}
        {guidanceTip && !isRecording && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl text-sm font-bold flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <span>{guidanceTip}</span>
            </div>
            {!audioWavBase64 && (
              <button
                type="button"
                onClick={loadSyntheticSample}
                disabled={isLoadingSample}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow transition-all active:scale-95"
              >
                {isLoadingSample ? 'جاري التحميل...' : '⚡ حمّل عينة نطق الآن بضغطة زر'}
              </button>
            )}
          </div>
        )}

        {/* Live Chrome Web Speech Transcript */}
        {browserWebSpeechTranscript && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
            <span className="font-bold">ما سمعه تعرّف Chrome المتصفح مباشرة (Web Speech API): </span>
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-100">
              {browserWebSpeechTranscript}
            </span>
          </div>
        )}

        {/* Execute Button */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={executeComparison}
              disabled={isEvaluating}
              className={`px-8 py-4 rounded-2xl font-black text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${
                isEvaluating
                  ? 'bg-slate-300 text-slate-500 cursor-wait'
                  : audioWavBase64
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 ring-4 ring-indigo-200'
                    : 'bg-indigo-900 hover:bg-indigo-950 text-white active:scale-95 cursor-pointer'
              }`}
            >
              {isEvaluating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري استدعاء Azure و Google بالتوازي...
                </>
              ) : (
                <>
                  <span>قارن بين Azure و Google الآن</span>
                  <span className="text-xl">⚡</span>
                </>
              )}
            </button>

            {!audioWavBase64 && (
              <span className="text-xs text-slate-500 font-bold">
                (اضغط الزر الأحمر لتسجيل صوتك أولًا، أو زر «استخدم عيّنة جاهزة»)
              </span>
            )}
          </div>

          {evalResult && (
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              {showRawJson ? 'إخفاء استجابة JSON الخام' : 'عرض استجابة JSON الخام لكلا المحركين'}
            </button>
          )}
        </div>

        {evalError && (
          <div className="mt-4 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl font-bold leading-relaxed">
            ⚠️ {evalError}
          </div>
        )}
      </div>

      {/* Results Comparison Grid */}
      {evalResult && (
        <div className="space-y-6">
          {/* Winner & Metric Summary Bar */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md flex flex-wrap items-center justify-around gap-4 text-center">
            <div>
              <div className="text-xs text-slate-400 font-bold mb-1">المحرك الأسرع استجابة</div>
              <div className="text-lg font-black text-amber-400">
                {evalResult.comparison.winnerFastest === 'azure' && '⚡ Microsoft Azure'}
                {evalResult.comparison.winnerFastest === 'google' && '⚡ Google Gemini'}
                {evalResult.comparison.winnerFastest === 'tie' && 'تعادل في السرعة'}
                {!evalResult.comparison.winnerFastest && 'غير محدد'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold mb-1">سرعة Azure</div>
              <div className="text-lg font-bold">
                {evalResult.azure.latencyMs !== null ? `${evalResult.azure.latencyMs} مللي ثانية` : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold mb-1">سرعة Google Gemini</div>
              <div className="text-lg font-bold">
                {evalResult.google.latencyMs !== null ? `${evalResult.google.latencyMs} مللي ثانية` : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold mb-1">فارق تقدير الدقة</div>
              <div className="text-lg font-bold text-emerald-400">
                {evalResult.comparison.accuracyDelta !== null ? `${evalResult.comparison.accuracyDelta} نقاط` : '—'}
              </div>
            </div>
          </div>

          {/* Side-by-Side Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Azure Card */}
            <div className="bg-white rounded-2xl p-6 border-2 border-indigo-200 shadow-sm flex flex-col">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔷</span>
                  <div>
                    <h3 className="font-black text-lg text-slate-900">Microsoft Azure Speech</h3>
                    <span className="text-xs text-slate-500 font-bold">Pronunciation Assessment Engine</span>
                  </div>
                </div>
                {evalResult.azure.latencyMs && (
                  <span className="text-xs font-mono font-black bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200">
                    {evalResult.azure.latencyMs} ms
                  </span>
                )}
              </div>

              {evalResult.azure.error ? (
                <div className="p-4 bg-rose-50 text-rose-800 rounded-xl text-sm font-bold">
                  {evalResult.azure.error}
                </div>
              ) : evalResult.azure.result ? (
                <div className="space-y-4 flex-1">
                  {/* Scores Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
                      <div className="text-xs text-slate-500 font-bold">دقة الكلمات</div>
                      <div className="text-xl font-black text-indigo-900">
                        {evalResult.azure.result.wordAccuracyPercent ?? evalResult.azure.result.accuracyScore ?? '—'}٪
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-xs text-slate-500 font-bold">الطلاقة</div>
                      <div className="text-xl font-black text-slate-800">
                        {evalResult.azure.result.fluencyScore ?? '—'}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-xs text-slate-500 font-bold">اكتمال النص</div>
                      <div className="text-xl font-black text-slate-800">
                        {evalResult.azure.result.completenessScore ?? '—'}
                      </div>
                    </div>
                  </div>

                  {/* Transcript */}
                  <div>
                    <span className="text-xs font-bold text-slate-500 block mb-1">ما سمعه Azure (التفريغ):</span>
                    <div className="p-3 bg-slate-50 rounded-xl font-child text-base font-bold text-slate-800 border border-slate-200">
                      «{evalResult.azure.result.transcript || 'لم يُسمع صوت'}»
                    </div>
                  </div>

                  {/* Words breakdown */}
                  <div>
                    <span className="text-xs font-bold text-slate-500 block mb-2">المحاذاة القسرية للكلمات المرجعية:</span>
                    <div className="space-y-2">
                      {evalResult.azure.result.words?.map((w, idx) => renderWordBadge(w, idx))}
                    </div>
                  </div>

                  {/* Scientific / Architectural Note on Azure limitation */}
                  <div className="p-3.5 bg-amber-50/80 border border-amber-300/80 rounded-2xl text-xs text-amber-950 space-y-1 mt-3">
                    <div className="font-black text-amber-900 flex items-center gap-1.5 text-xs">
                      <span>⚠️</span>
                      <span>تنبيه علمي حول التنوين والحركات في Azure Speech:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-900/90 font-medium">
                      محرك Azure يطابق الكلمة على مستوى <strong>الجذر المعجمي (Word Lemma)</strong> ويحذف الحركات والتنوين تلقائيًا، ولا يحتوي نموذجه العربي على تحليل للفونيمات.
                      لذلك إذا كان النص المرجعي <strong>«كِتَابْ» (بالسكون)</strong> وقرأت أنت <strong>«كِتَابٌ» (بالتنوين)</strong>، يعتبره Azure مطابقًا بنسبة 100% لأن التنوين والوقف بالسكون يُعدّان عنده تنويعًا إعرابيًا للكلمة نفسها، ولا يستطيع رصد خطأ الطفل الفونولوجي هنا.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Google Gemini Card */}
            <div className="bg-white rounded-2xl p-6 border-2 border-amber-200 shadow-sm flex flex-col">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔶</span>
                  <div>
                    <h3 className="font-black text-lg text-slate-900">Google Gemini</h3>
                    <span className="text-xs text-slate-500 font-bold">{evalResult.google.result?.sourceModel || 'Multimodal Audio'}</span>
                  </div>
                </div>
                {evalResult.google.latencyMs && (
                  <span className="text-xs font-mono font-black bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
                    {evalResult.google.latencyMs} ms
                  </span>
                )}
              </div>

              {evalResult.google.error ? (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-950 text-xs space-y-3">
                  <div className="flex items-center gap-2 font-black text-amber-900 text-sm">
                    <span className="text-lg">⚠️</span>
                    <span>
                      {evalResult.google.error.includes('402') || evalResult.google.error.includes('prepayment')
                        ? 'رصيد مفتاح Google Gemini منتهٍ في AI Studio (Prepayment Depleted)'
                        : 'تنبيه في فحص Google Gemini'}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    {evalResult.google.error.includes('402') || evalResult.google.error.includes('prepayment')
                      ? 'مفتاح السيرفر مرتبط بحساب تم استنفاد رصيده المدفوع مسبقًا في Google AI Studio، ولذلك لم يقم Google بتقييم الصوت بعد. يمكنك استخدام مفتاح مجاني (Free Tier) بضغطة زر:'
                      : evalResult.google.error}
                  </p>
                  <div className="bg-white/80 p-3 rounded-xl border border-amber-200 space-y-2">
                    <div className="font-bold text-slate-800 text-[11px]">خطوات التفعيل الفوري (مجانًا بدون بطاقة دفع):</div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px]">
                      <li>
                        افتح <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold">Google AI Studio (اضغط هنا)</a>
                      </li>
                      <li>أنشئ مفتاح API جديدًا في مشروع مجاني عادي (Free Tier يمنح 15 استجابة/دقيقة).</li>
                      <li>الصق المفتاح في الحقل أدناه ثم اضغط «إعادة المقارنة»:</li>
                    </ol>
                    <div className="flex gap-2 pt-1">
                      <input
                        type="password"
                        value={customGeminiKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomGeminiKey(val);
                          localStorage.setItem('baseera_custom_gemini_key', val);
                        }}
                        placeholder="الصق مفتاح Google المجاني هنا (AIzaSy...)"
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={executeComparison}
                        disabled={!customGeminiKey || isEvaluating}
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow active:scale-95 disabled:opacity-50"
                      >
                        إعادة المقارنة ⚡
                      </button>
                    </div>
                  </div>
                </div>
              ) : evalResult.google.result ? (
                <div className="space-y-4 flex-1">
                  {/* Score */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                      <div className="text-xs text-slate-500 font-bold">الدقة التقديرية</div>
                      <div className="text-xl font-black text-amber-900">
                        {evalResult.google.result.wordAccuracyPercent ?? '—'}٪
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-xs text-slate-500 font-bold">كلمات زائدة (Insertions)</div>
                      <div className="text-xl font-black text-slate-800">
                        {evalResult.google.result.insertions?.length || 0}
                      </div>
                    </div>
                  </div>

                  {/* Transcript */}
                  <div>
                    <span className="text-xs font-bold text-slate-500 block mb-1">ما سمعه Google Gemini (التفريغ):</span>
                    <div className="p-3 bg-slate-50 rounded-xl font-child text-base font-bold text-slate-800 border border-slate-200">
                      «{evalResult.google.result.transcript || 'لم يُسمع صوت'}»
                    </div>
                  </div>

                  {/* Phonetic & Nonword Observations */}
                  {evalResult.google.result.phoneticObservationsAr && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950">
                      <span className="font-bold block mb-1">🔍 ملاحظات مخارج الحروف والتشكيل:</span>
                      {evalResult.google.result.phoneticObservationsAr}
                    </div>
                  )}

                  {evalResult.google.result.nonwordAnalysisAr && (
                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950">
                      <span className="font-bold block mb-1">🧪 فحص الكلمات المصنوعة:</span>
                      {evalResult.google.result.nonwordAnalysisAr}
                    </div>
                  )}

                  {/* Words breakdown */}
                  <div>
                    <span className="text-xs font-bold text-slate-500 block mb-2">تقييم الكلمات المرجعية:</span>
                    <div className="space-y-2">
                      {evalResult.google.result.words?.map((w, idx) => renderWordBadge(w, idx))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Raw JSON inspection */}
          {showRawJson && (
            <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-x-auto text-xs font-mono">
              <pre>{JSON.stringify(evalResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
