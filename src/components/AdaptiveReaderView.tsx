import { authenticatedFetch } from '../utils/apiAuth';
import React, { useState, useRef, useMemo } from 'react';
import {
  Volume2,
  Sparkles,
  Eye,
  Type as TypeIcon,
  Sliders,
  CheckCircle2,
  RotateCcw,
  Wand2,
  Check,
  Code2,
  BookOpen,
} from 'lucide-react';
import {
  segmentArabicWordIntoSyllables,
  getConfusableLetterGroup,
} from '../utils/learningMetrics';
import {
  analyzeTextWithDyslexico,
  computeDyslexicoWeightedLevenshtein,
  encodeSoundex,
  encodeDoubleMetaphoneLite,
  encodeArabicPhoneticSkeleton,
  ARABIC_DIALECT_PROFILES,
  ArabicDialectCode,
} from '../utils/dyslexiaEngines';
import { ARABIC_READING_PASSAGES } from '../data/seedData';

interface WordBreakdownItem {
  word: string;
  syllables: string;
  root: string;
  meaning: string;
}

interface TextAdaptationProposal {
  simplifiedText: string;
  keyIdea: string;
  wordBreakdowns: WordBreakdownItem[];
}

const DEFAULT_ADAPTIVE_TEXT = ARABIC_READING_PASSAGES[0].words.join(' ');

interface AdaptiveReaderViewProps {
  problematicWords?: string[];
  studentName?: string;
  passageId?: string;
}

const normalizeArabicWord = (value: string) =>
  value.replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[.,،؛:!?؟]/g, '').trim();

const DYSLEXICO_PRESETS: {
  id: string;
  label: string;
  dialect: ArabicDialectCode;
  sample: string;
}[] = [
  {
    id: 'ar-three-categories',
    label: 'مثال لغوي تجريبي — إملاء ولهجة؛ الأخطاء مقصودة',
    dialect: 'gulf',
    sample:
      'قرأ التالب كتاب في المدرسه وشاف المنضار صوب الجبل وكتب الملاحضات',
  },
  {
    id: 'ar-dyslexic',
    label: 'مثال إملائي تجريبي — تبديلات مقصودة',
    dialect: 'msa',
    sample: 'قرأ التالب كتاب في المدرسه وكتب بقلم ازرق عن المنضار والضوء',
  },
  {
    id: 'ar-egyptian-levantine',
    label: 'مثال باللهجة المصرية — اختلاف اللهجة ليس خطأً مرضيًا',
    dialect: 'egyptian',
    sample: 'ده الولد راح المدرسة وشاف المنظار وقال لأصحابه',
  },
];

export const AdaptiveReaderView: React.FC<AdaptiveReaderViewProps> = ({
  problematicWords = [],
  studentName,
  passageId,
}) => {
  // Progressive Disclosure Studio Mode ('reader' | 'dyslexico')
  const [studioMode, setStudioMode] = useState<'reader' | 'dyslexico'>(
    'reader'
  );

  const initialPassage = ARABIC_READING_PASSAGES.find((passage) => passage.id === passageId) || ARABIC_READING_PASSAGES[0];
  const personalizedDefaultText = initialPassage.words.join(' ');
  const normalizedProblemWords = new Set(problematicWords.map(normalizeArabicWord).filter(Boolean));
  const [selectedPassageId, setSelectedPassageId] = useState<string>(initialPassage.id);
  const [text, setText] = useState<string>(personalizedDefaultText);
  const [syllableMode, setSyllableMode] = useState<boolean>(false);
  const [letterColorMode, setLetterColorMode] = useState<boolean>(false);
  const [readingRuler, setReadingRuler] = useState<boolean>(true);
  const [openDyslexicMode, setOpenDyslexicMode] = useState<boolean>(true);
  const [activeLineIdx, setActiveLineIdx] = useState<number>(0);

  // Typography & Anti-Crowding CSS Engineering controls
  const [fontSizePx, setFontSizePx] = useState<number>(26);
  const [wordSpacingPx, setWordSpacingPx] = useState<number>(10);
  const [letterSpacingPx, setLetterSpacingPx] = useState<number>(1.5);
  const [lineHeightRatio, setLineHeightRatio] = useState<number>(2.0);
  const [pacingIntervalMs, setPacingIntervalMs] = useState<number>(520);
  const [pacingSyncModeLabel, setPacingSyncModeLabel] = useState<string>(
    'إبراز كلمة للمساعدة على التركيز (قابل للتعديل)'
  );
  const [surfaceTheme, setSurfaceTheme] = useState<
    'white' | 'cream' | 'sky' | 'night'
  >('cream');

  // Dyslexico Smart Phonetic & Weighted Levenshtein Engine State
  const [selectedDialect, setSelectedDialect] =
    useState<ArabicDialectCode>('gulf');
  const [dyslexicoInput, setDyslexicoInput] = useState<string>(
    DYSLEXICO_PRESETS[0].sample
  );
  const [pairSource, setPairSource] = useState<string>('المنضار');
  const [pairTarget, setPairTarget] = useState<string>('المنظار');

  // AI Adaptation & TTS state
  const [isAdapting, setIsAdapting] = useState<boolean>(false);
  const [pendingAdaptation, setPendingAdaptation] = useState<TextAdaptationProposal | null>(null);
  const [adaptationStatus, setAdaptationStatus] = useState<string>('');
  const [keyIdea, setKeyIdea] = useState<string>(
    'قصة يومية مبسّطة للصف الثاني الابتدائي تدور حول عناية سلمى بالقطة البيضاء في حديقة البيت.'
  );
  const [wordBreakdowns, setWordBreakdowns] = useState<WordBreakdownItem[]>([
    {
      word: 'الْحَدِيقَةِ',
      syllables: 'الْـ · حَـ · دِيـ · قَـ · ـةِ',
      root: 'ح - د - ق',
      meaning: 'المكان المزروع بالأشجار والزهور حول البيت.',
    },
    {
      word: 'شَاهَدَتْ',
      syllables: 'شَا · هَـ · دَتْ',
      root: 'ش - ه - د',
      meaning:
        'رأت بعينيها بوضوح (ويقابلها في اللهجات العربية الصحيحة: شافت).',
    },
    {
      word: 'التُّفَّاحِ',
      syllables: 'التُّفْـ · فَاحِ',
      root: 'ت - ف - ح',
      meaning: 'فاكهة معروفة تبدأ هنا بلام شمسية مدغمة في التاء المشددة.',
    },
  ]);

  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<
    number | null
  >(null);
  const speechTimerRef = useRef<number | null>(null);

  const dyslexicoAnalysis = useMemo(
    () => analyzeTextWithDyslexico(dyslexicoInput, selectedDialect),
    [dyslexicoInput, selectedDialect]
  );

  const nonExactTokens = useMemo(
    () =>
      dyslexicoAnalysis.filter(
        (item) => item.variationCategory !== 'exact_lexicon_match'
      ),
    [dyslexicoAnalysis]
  );

  const reviewCandidatesCount = useMemo(
    () =>
      dyslexicoAnalysis.filter((item) => item.requiresTeacherReview)
        .length,
    [dyslexicoAnalysis]
  );

  const orthographicConventionsCount = useMemo(
    () =>
      dyslexicoAnalysis.filter(
        (item) => item.variationCategory === 'orthographic_convention'
      ).length,
    [dyslexicoAnalysis]
  );

  const validDialectTokensCount = useMemo(
    () =>
      dyslexicoAnalysis.filter(
        (item) =>
          item.variationCategory === 'valid_dialect_lexical' ||
          item.variationCategory === 'dialect_phonological_shift'
      ).length,
    [dyslexicoAnalysis]
  );

  const pairMetrics = useMemo(() => {
    const s = pairSource.trim() || 'المنضار';
    const t = pairTarget.trim() || 'المنظار';
    const isAr = /[\u0600-\u06FF]/.test(s) || /[\u0600-\u06FF]/.test(t);
    const { weightedDistance, standardDistance, detectedPatterns } =
      computeDyslexicoWeightedLevenshtein(s, t);
    const codeS = isAr
      ? encodeArabicPhoneticSkeleton(s)
      : `${encodeDoubleMetaphoneLite(s)} (${encodeSoundex(s)})`;
    const codeT = isAr
      ? encodeArabicPhoneticSkeleton(t)
      : `${encodeDoubleMetaphoneLite(t)} (${encodeSoundex(t)})`;
    return {
      weightedDistance,
      standardDistance,
      detectedPatterns,
      codeS,
      codeT,
      isPhoneticMatch: codeS === codeT,
    };
  }, [pairSource, pairTarget]);

  const handleApplyCorrection = (originalWord: string, replacement: string) => {
    setDyslexicoInput((prev) =>
      prev
        .split(/\s+/)
        .map((w) => (w === originalWord ? replacement : w))
        .join(' ')
    );
  };

  const handleApplyAllCorrections = () => {
    const corrected = dyslexicoAnalysis
      .map((item) => (item.isCorrect ? item.originalWord : item.bestCorrection))
      .join(' ');
    setDyslexicoInput(corrected);
  };

  const allWords = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const WORDS_PER_LINE = 7;
  const lines: { words: { word: string; globalIdx: number }[] }[] = [];
  for (let i = 0; i < allWords.length; i += WORDS_PER_LINE) {
    lines.push({
      words: allWords.slice(i, i + WORDS_PER_LINE).map((w, idx) => ({
        word: w,
        globalIdx: i + idx,
      })),
    });
  }

  const handleRunAIAdaptation = async () => {
    if (!text.trim()) return;
    setIsAdapting(true);
    setAdaptationStatus('');
    try {
      const res = await authenticatedFetch('/api/ai/adapt-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        setAdaptationStatus('تعذّر إعداد اقتراح الآن. احتفظنا بالنص الحالي كما هو.');
        return;
      }
      const data = await res.json();
      if (data?.proposalAvailable !== true) {
        setAdaptationStatus(typeof data?.message === 'string' ? data.message : 'لم يتوفر اقتراح صالح؛ احتفظنا بالنص الحالي.');
        return;
      }
      const adaptation = data?.adaptation;
      if (
        !adaptation ||
        typeof adaptation.simplifiedText !== 'string' ||
        !adaptation.simplifiedText.trim()
      ) {
        setAdaptationStatus('لم يصل اقتراح نص صالح؛ لم يتغير نص القراءة.');
        return;
      }

      const wordBreakdowns = Array.isArray(adaptation.wordBreakdowns)
        ? adaptation.wordBreakdowns
            .filter((item: unknown): item is WordBreakdownItem =>
              Boolean(
                item &&
                typeof item === 'object' &&
                typeof (item as WordBreakdownItem).word === 'string' &&
                typeof (item as WordBreakdownItem).syllables === 'string' &&
                typeof (item as WordBreakdownItem).root === 'string' &&
                typeof (item as WordBreakdownItem).meaning === 'string'
              )
            )
            .slice(0, 4)
            .map((item: WordBreakdownItem) => ({
              word: item.word.slice(0, 80),
              syllables: item.syllables.slice(0, 180),
              root: item.root.slice(0, 80),
              meaning: item.meaning.slice(0, 240),
            }))
        : [];

      setPendingAdaptation({
        simplifiedText: adaptation.simplifiedText.slice(0, 20000),
        keyIdea: typeof adaptation.keyIdea === 'string'
          ? adaptation.keyIdea.slice(0, 500)
          : 'لم يتوفر اقتراح للفكرة الرئيسية؛ صغها بعد مراجعة النص.',
        wordBreakdowns,
      });
      setAdaptationStatus('أُعدّ اقتراح للمراجعة فقط؛ لم نستبدل نص القراءة.');
    } catch {
      setAdaptationStatus('تعذّر الاتصال بخدمة التبسيط. احتفظنا بالنص الحالي كما هو.');
    } finally {
      setIsAdapting(false);
    }
  };

  const handleApplyAdaptationProposal = () => {
    if (!pendingAdaptation) return;
    setText(pendingAdaptation.simplifiedText);
    setKeyIdea(pendingAdaptation.keyIdea);
    setWordBreakdowns(pendingAdaptation.wordBreakdowns);
    setPendingAdaptation(null);
    setActiveLineIdx(0);
    setHighlightedWordIndex(null);
    setAdaptationStatus('تم تطبيق الاقتراح الذي راجعته. راجع المعنى والمقاطع قبل التدريب مع الطفل.');
  };

  const handleSpeakPassage = async () => {
    if (isSpeaking) {
      if (speechTimerRef.current) {
        window.clearInterval(speechTimerRef.current);
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      setHighlightedWordIndex(null);
      return;
    }

    setIsSpeaking(true);
    setHighlightedWordIndex(0);

    let currentIdx = 0;
    let boundaryEventFired = false;
    setPacingSyncModeLabel(
      'توقيت إبراز تقريبي — لا يقيس حركة العين'
    );

    speechTimerRef.current = window.setInterval(() => {
      if (boundaryEventFired) return;
      currentIdx += 1;
      if (currentIdx >= allWords.length) {
        if (speechTimerRef.current) {
          window.clearInterval(speechTimerRef.current);
        }
        setIsSpeaking(false);
        setHighlightedWordIndex(null);
      } else {
        setHighlightedWordIndex(currentIdx);
        setActiveLineIdx(Math.floor(currentIdx / WORDS_PER_LINE));
      }
    }, pacingIntervalMs);

    try {
      const res = await authenticatedFetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.audioBase64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
          audio.ontimeupdate = () => {
            if (
              audio.duration &&
              Number.isFinite(audio.duration) &&
              audio.duration > 0
            ) {
              boundaryEventFired = true;
              setPacingSyncModeLabel('مرتبط نسبياً بمدة الملف الصوتي الفعلي');
              const ratio = Math.min(0.999, audio.currentTime / audio.duration);
              const idx = Math.floor(ratio * allWords.length);
              setHighlightedWordIndex(idx);
              setActiveLineIdx(Math.floor(idx / WORDS_PER_LINE));
            }
          };
          audio.onended = () => {
            if (speechTimerRef.current) {
              window.clearInterval(speechTimerRef.current);
            }
            setIsSpeaking(false);
            setHighlightedWordIndex(null);
          };
          audio.play().catch(() => {});
          return;
        }
      }
    } catch {
      // Fallback to Web Speech API
    }

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const activeDialectObj = ARABIC_DIALECT_PROFILES.find(
          (d) => d.code === selectedDialect
        );
        utterance.lang = activeDialectObj?.speechRecognitionLang || 'ar-SA';
        utterance.rate = 0.85;
        utterance.onboundary = (ev) => {
          if (ev.name === 'word') {
            boundaryEventFired = true;
            setPacingSyncModeLabel(
              'متزامن مع نطق الكلمات في المتصفح'
            );
            const prefix = text.slice(0, ev.charIndex);
            const wordIdx = Math.min(
              allWords.length - 1,
              prefix.trim() ? prefix.trim().split(/\s+/).length : 0
            );
            setHighlightedWordIndex(wordIdx);
            setActiveLineIdx(Math.floor(wordIdx / WORDS_PER_LINE));
          }
        };
        utterance.onend = () => {
          if (speechTimerRef.current) {
            window.clearInterval(speechTimerRef.current);
          }
          setIsSpeaking(false);
          setHighlightedWordIndex(null);
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore if headless browser blocks speechSynthesis
      }
    }
  };

  const renderWordWithAssist = (word: string) => {
    const isProblematic = normalizedProblemWords.has(normalizeArabicWord(word));
    const bottomHeavyClass = [
      openDyslexicMode ? 'reading-assist-emphasis border-b-2 border-slate-900/15 pb-0.5' : '',
      isProblematic ? 'bg-amber-100 text-amber-950 ring-1 ring-amber-300 rounded-md px-1 font-bold' : '',
    ].filter(Boolean).join(' ');

    if (syllableMode) {
      const syllables = segmentArabicWordIntoSyllables(word);
      const isNight = surfaceTheme === 'night';
      return (
        <span className={bottomHeavyClass}>
          {syllables.map((syl, sIdx) => (
            <React.Fragment key={sIdx}>
              <span
                className={
                  sIdx % 2 === 0
                    ? isNight
                      ? 'text-sky-300'
                      : 'text-[#0284C7]'
                    : isNight
                      ? 'text-amber-300'
                      : 'text-slate-900'
                }
              >
                {syl}
              </span>
              {sIdx < syllables.length - 1 && (
                <span className="text-slate-400 mx-0.5 font-normal">·</span>
              )}
            </React.Fragment>
          ))}
        </span>
      );
    }

    if (letterColorMode) {
      const units: string[] = [];
      for (const ch of word) {
        if (/[\u064B-\u0652\u0670]/.test(ch) && units.length > 0) {
          units[units.length - 1] += ch;
        } else {
          units.push(ch);
        }
      }
      return (
        <span className={bottomHeavyClass}>
          {units.map((u, uIdx) => {
            const group = getConfusableLetterGroup(u);
            let colorClass = '';
            if (group === 'baa_group') colorClass = 'text-[#0284C7] font-bold';
            else if (group === 'jeem_group')
              colorClass = 'text-[#059669] font-bold';
            else if (group === 'dal_group')
              colorClass = 'text-[#D97706] font-bold';
            else if (group === 'seen_group')
              colorClass = 'text-[#DC2626] font-bold';
            else if (group === 'ain_group')
              colorClass = 'text-indigo-600 font-bold';
            return (
              <span key={uIdx} className={colorClass}>
                {u}
              </span>
            );
          })}
        </span>
      );
    }

    return <span className={bottomHeavyClass}>{word}</span>;
  };

  const surfaceStyles: Record<'white' | 'cream' | 'sky' | 'night', string> = {
    white: 'bg-white text-slate-900 border-slate-200',
    cream: 'bg-[#FEFCE8] text-slate-900 border-amber-200',
    sky: 'bg-[#F0F9FF] text-slate-900 border-sky-200',
    night: 'bg-[#0F172A] text-slate-100 border-slate-800',
  };

  return (
    <div className="space-y-8">
      {/* Executive Header & 2-Mode Studio Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500 mb-1">
              أدوات الأخصائي
            </div>
            <h2 className="text-2xl font-bold text-slate-900 font-display">
              النص كاملًا وتحليل الفروق الإملائية واللهجية
            </h2>
          </div>

          {/* 2-Mode Segmented Studio Switcher */}
          <div
            role="tablist"
            aria-label="أوضاع القارئ العربي الميسّر"
            className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl"
          >
            <button
              type="button"
              role="tab"
              aria-selected={studioMode === 'reader'}
              onClick={() => setStudioMode('reader')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                studioMode === 'reader'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>عرض النص كاملًا</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={studioMode === 'dyslexico'}
              onClick={() => setStudioMode('dyslexico')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                studioMode === 'dyslexico'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>الفروق الإملائية واللهجية</span>
            </button>
          </div>
        </div>

        {problematicWords.length > 0 && (
        <section aria-live="polite" className="mx-6 sm:mx-8 mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
          <h3 className="text-sm font-bold text-amber-950">أنشطة قراءة مقترحة{studentName ? ` للمتعلّم «${studentName}»` : ''}</h3>
          <p className="text-xs leading-relaxed text-amber-900">هذه الكلمات تم تحديدها بالتحليل الصوتي الآلي في جلسة سابقة للتدريب والمراجعة. جرّب قراءتها وفهمها؛ لا تعني القائمة وحدها وجود صعوبة.</p>
          <div className="flex flex-wrap gap-2">{problematicWords.map((word, index) => <span key={`${word}-${index}`} className="rounded-md border border-amber-300 bg-white px-2 py-1 text-sm font-semibold text-amber-950">{word}</span>)}</div>
        </section>
      )}

      {/* Contextual Toolbar for Reader Mode */}
        {studioMode === 'reader' && (
          <div className="px-6 sm:px-8 py-4 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="adaptive-passage-select"
                className="text-xs font-medium text-slate-600"
              >
                النص القرائي:
              </label>
              <select
                id="adaptive-passage-select"
                aria-label="اختيار نص القراءة المتدرج في القارئ الميسر"
                value={selectedPassageId}
                onChange={(e) => {
                  const pId = e.target.value;
                  setSelectedPassageId(pId);
                  const found = ARABIC_READING_PASSAGES.find(
                    (p) => p.id === pId
                  );
                  if (found) {
                    setText(found.words.join(' '));
                    setWordBreakdowns([]);
                    setKeyIdea('راجع النص المختار، ثم صغ فكرته الرئيسية أو اطلب اقتراحًا آليًا لمراجعته.');
                    setPendingAdaptation(null);
                    setAdaptationStatus('');
                    setActiveLineIdx(0);
                  }
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#0284C7]"
              >
                {ARABIC_READING_PASSAGES.map((p) => (
                  <option key={p.id} value={p.id}>
                    الصف {p.gradeLevel}: {p.title} (
                    {p.diacriticLabelAr || p.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleSpeakPassage}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  isSpeaking
                    ? 'bg-[#DC2626] text-white'
                    : 'bg-[#0F172A] hover:bg-slate-800 text-white'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span>
                  {isSpeaking
                    ? 'إيقاف القراءة الصوتية'
                    : 'قراءة صوتية مساندة'}
                </span>
              </button>

              <button
                type="button"
                disabled={isAdapting}
                onClick={handleRunAIAdaptation}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isAdapting
                    ? 'جارٍ التحليل الصرفي…'
                     : 'اقتراح تبسيط للمراجعة'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {studioMode === 'reader' && adaptationStatus && (
        <p role="status" className="mx-6 sm:mx-8 mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-700">{adaptationStatus}</p>
      )}

      {studioMode === 'reader' && pendingAdaptation && (
        <section className="mx-6 sm:mx-8 mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5 space-y-3" aria-labelledby="adaptation-review-heading">
          <h3 id="adaptation-review-heading" className="font-bold text-amber-950">اقتراح آلي — راجعه قبل استخدامه</h3>
          <p className="text-xs leading-relaxed text-amber-900">قد يغيّر الاقتراح معنى النص أو يخطئ في الجذر والمقاطع. لا يُرسل اسم الطفل عمدًا، لكن النص الذي أدخلته يُرسل إلى خدمة التوليد عند الطلب؛ تجنّب تضمين أسماء أو بيانات شخصية.</p>
          <label htmlFor="adaptation-review-text" className="block text-xs font-semibold text-amber-950">النص المقترح (يمكنك تعديله قبل اعتماده)</label>
          <textarea id="adaptation-review-text" dir="auto" rows={4} value={pendingAdaptation.simplifiedText} onChange={(e) => setPendingAdaptation((prev) => prev ? { ...prev, simplifiedText: e.target.value } : prev)} className="w-full rounded-xl border border-amber-300 bg-white p-3 text-sm leading-relaxed text-slate-900" />
          <p className="text-xs text-amber-950"><strong>الفكرة المقترحة:</strong> {pendingAdaptation.keyIdea || 'لم تُقترح فكرة رئيسية.'}</p>
          {pendingAdaptation.wordBreakdowns.length > 0 && (
            <details className="rounded-xl border border-amber-200 bg-white p-3">
              <summary className="cursor-pointer text-xs font-semibold text-amber-950">عرض ملاحظات الكلمات المقترحة ({pendingAdaptation.wordBreakdowns.length})</summary>
              <ul className="mt-2 space-y-2 text-xs text-slate-700">
                {pendingAdaptation.wordBreakdowns.map((item, idx) => <li key={`${item.word}-${idx}`}><strong>{item.word}</strong> — تقسيم: {item.syllables} — جذر محتمل: {item.root} — معنى مقترح: {item.meaning}</li>)}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleApplyAdaptationProposal} className="rounded-xl bg-[#15803D] px-4 py-2 text-xs font-bold text-white hover:bg-[#166534]">استخدام الاقتراح بعد المراجعة</button>
            <button type="button" onClick={() => setPendingAdaptation(null)} className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-950">تجاهل الاقتراح</button>
          </div>
        </section>
      )}

      {/* MODE 1: SMART ADAPTIVE READER & VISUAL COMFORT */}
      {studioMode === 'reader' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 8 Cols: Interactive Dyslexia Reading Canvas + Morphological Breakdown */}
          <div className="lg:col-span-8 space-y-6">
            <div
              className={`border rounded-2xl p-8 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${surfaceStyles[surfaceTheme]}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-6 border-b border-slate-200/60 text-xs opacity-75">
                <span>
                  انقر على أي سطر لتثبيت المسطرة البصرية عليه ·{' '}
                  {openDyslexicMode
                    ? 'التمييز البصري للكلمات مفعّل'
                    : 'الخط القياسي مفعّل'}
                </span>
                <span className="font-mono tabular-nums">
                  السطر النشط: {activeLineIdx + 1} / {Math.max(1, lines.length)}
                </span>
              </div>

              <div className="space-y-5">
                {lines.map((line, lIdx) => {
                  const isFocusedLine = !readingRuler || activeLineIdx === lIdx;
                  return (
                    <div
                      key={lIdx}
                      onClick={() => setActiveLineIdx(lIdx)}
                      onMouseEnter={() => setActiveLineIdx(lIdx)}
                      style={{
                        fontSize: `${fontSizePx}px`,
                        wordSpacing: `${wordSpacingPx}px`,
                        letterSpacing: `${letterSpacingPx}px`,
                        lineHeight: lineHeightRatio,
                      }}
                      className={`p-3.5 rounded-xl transition-opacity cursor-pointer flex flex-wrap gap-x-3 gap-y-2 ${
                        openDyslexicMode ? 'reading-assist-emphasis' : 'font-display'
                      } ${
                        isFocusedLine
                          ? readingRuler
                            ? surfaceTheme === 'night'
                              ? 'bg-slate-800/90 ring-2 ring-sky-400 opacity-100'
                              : 'bg-white/90 ring-2 ring-[#0284C7] shadow-xs opacity-100'
                            : 'opacity-100'
                          : 'opacity-30'
                      }`}
                    >
                      {line.words.map(({ word, globalIdx }) => {
                        const isSpoken = highlightedWordIndex === globalIdx;
                        return (
                          <span
                            key={globalIdx}
                            className={`px-1.5 py-0.5 rounded transition-colors ${
                              isSpoken
                                ? 'bg-[#0284C7] text-white font-bold'
                                : ''
                            }`}
                          >
                            {renderWordWithAssist(word)}
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Morphological & Syllabic Breakdown Cards */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="px-6 py-3 bg-sky-50 border-b border-sky-100 text-xs leading-relaxed text-sky-900">
                التقسيم والجذر والمعنى مقترحات آلية/تعليمية وليست تحليلًا صرفيًا أو صوتيًا معتمدًا. راجعها قبل التدريب؛ وهي لا تقيس قدرة الطفل ولا تشخّص صعوبة التعلم.
              </div>
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    ملاحظات لغوية مقترحة للكلمات
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الفكرة المحورية: {keyIdea}
                  </p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-[#059669]" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-200">
                {wordBreakdowns.map((item, idx) => (
                  <div key={idx} className="p-6 space-y-2">
                    <div className="text-lg font-bold text-slate-900 font-display">
                      {item.word}
                    </div>
                    <div className="text-xs text-[#0284C7] font-semibold">
                      تقسيم مقترح: {item.syllables}
                    </div>
                    <div className="text-xs text-slate-600">
                      الجذر المحتمل: <strong>{item.root}</strong>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
                      معنى مقترح: {item.meaning}
                    </p>
                  </div>
                ))}
              </div>

              {/* Custom Arabic Text Input Box */}
              <div className="p-6 bg-slate-50/50 border-t border-slate-200 space-y-2">
                <label
                  htmlFor="custom-arabic-text"
                  className="block text-xs font-semibold text-slate-700"
                >
                  يمكنك تعديل نص القراءة؛ ستظهر الكلمات التي تعثّر فيها الطالب في آخر جلسة مميزة بلون مختلف.
                </label>
                <div className="flex gap-2">
                  <textarea
                    id="custom-arabic-text"
                    rows={2}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setWordBreakdowns([]);
                      setKeyIdea('راجع النص الحالي وصغ فكرته الرئيسية بعد قراءته.');
                      setPendingAdaptation(null);
                      setAdaptationStatus('');
                    }}
                    className="w-full p-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0284C7]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setText(personalizedDefaultText);
                      setWordBreakdowns([]);
                      setKeyIdea('راجع النص الحالي وصغ فكرته الرئيسية بعد قراءته.');
                      setPendingAdaptation(null);
                      setAdaptationStatus('');
                    }}
                    aria-label="استعادة النص الافتراضي"
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>الافتراضي</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Cols: Assistive Controls Deck */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-5 lg:sticky lg:top-28 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="pb-3 border-b border-slate-200">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <Sliders className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>شكل النص</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                إعدادات الخط والتباعد البصري
              </h3>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setOpenDyslexicMode(!openDyslexicMode)}
                className={`w-full p-3.5 rounded-xl border text-right transition-colors flex items-center justify-between cursor-pointer ${
                  openDyslexicMode
                    ? 'bg-sky-50/70 border-[#0284C7] text-slate-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold">
                    تمييز بصري للكلمات
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    حد سفلي للكلمات للمساعدة على تتبع حدودها؛ لا يُحمّل خطًا خارجيًا.
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold text-[#0284C7]">
                  {openDyslexicMode ? 'مفعّل' : 'مغلق'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSyllableMode(!syllableMode);
                  if (!syllableMode) setLetterColorMode(false);
                }}
                className={`w-full p-3.5 rounded-xl border text-right transition-colors flex items-center justify-between cursor-pointer ${
                  syllableMode
                    ? 'bg-sky-50/70 border-[#0284C7] text-slate-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold">
                    التقطيع المقطعي الملون
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    تقسيم بصري تقريبي للكلمات المشكلة البسيطة؛ قد تظهر الكلمة كاملة إذا لم يكن التقطيع موثوقًا
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold text-[#0284C7]">
                  {syllableMode ? 'مفعّل' : 'مغلق'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLetterColorMode(!letterColorMode);
                  if (!letterColorMode) setSyllableMode(false);
                }}
                className={`w-full p-3.5 rounded-xl border text-right transition-colors flex items-center justify-between cursor-pointer ${
                  letterColorMode
                    ? 'bg-sky-50/70 border-[#0284C7] text-slate-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold">
                    تمييز الحروف المتشابهة رسماً (ب/ت/ث · ج/ح/خ)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    تلوين المجموعات الحرفية المتجانسة
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold text-[#0284C7]">
                  {letterColorMode ? 'مفعّل' : 'مغلق'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReadingRuler(!readingRuler)}
                className={`w-full p-3.5 rounded-xl border text-right transition-colors flex items-center justify-between cursor-pointer ${
                  readingRuler
                    ? 'bg-sky-50/70 border-[#0284C7] text-slate-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold">
                    المسطرة البصرية لعزل السطر
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    تعتيم الأسطر المجاورة لمنع القفز العمودي
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold text-[#0284C7]">
                  {readingRuler ? 'مفعّل' : 'مغلق'}
                </span>
              </button>
            </div>

            {/* Labeled Sliders */}
            <div className="space-y-4 pt-3 border-t border-slate-200">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label
                    htmlFor="font-size-slider"
                    className="font-medium text-slate-700 flex items-center gap-1"
                  >
                    <TypeIcon className="w-3.5 h-3.5 text-slate-500" />
                    <span>حجم الخط</span>
                  </label>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {fontSizePx} px
                  </span>
                </div>
                <input
                  id="font-size-slider"
                  type="range"
                  min={20}
                  max={38}
                  value={fontSizePx}
                  onChange={(e) => setFontSizePx(Number(e.target.value))}
                  className="w-full playful-slider cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label
                    htmlFor="word-spacing-slider"
                    className="font-medium text-slate-700 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>تباعد الكلمات</span>
                  </label>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {wordSpacingPx} px
                  </span>
                </div>
                <input
                  id="word-spacing-slider"
                  type="range"
                  min={4}
                  max={24}
                  value={wordSpacingPx}
                  onChange={(e) => setWordSpacingPx(Number(e.target.value))}
                  className="w-full playful-slider cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label
                    htmlFor="letter-spacing-slider"
                    className="font-medium text-slate-700"
                  >
                    تباعد الحروف
                  </label>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {letterSpacingPx} px
                  </span>
                </div>
                <input
                  id="letter-spacing-slider"
                  type="range"
                  min={0}
                  max={6}
                  step={0.5}
                  value={letterSpacingPx}
                  onChange={(e) => setLetterSpacingPx(Number(e.target.value))}
                  className="w-full playful-slider cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label
                    htmlFor="line-height-slider"
                    className="font-medium text-slate-700"
                  >
                    تباعد الأسطر
                  </label>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {lineHeightRatio.toFixed(1)}x
                  </span>
                </div>
                <input
                  id="line-height-slider"
                  type="range"
                  min={1.5}
                  max={2.8}
                  step={0.1}
                  value={lineHeightRatio}
                  onChange={(e) => setLineHeightRatio(Number(e.target.value))}
                  className="w-full playful-slider cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label
                    htmlFor="pacing-speed-slider"
                    className="font-medium text-slate-700"
                  >
                    سرعة المؤشر الصوتي الإيقاعي
                  </label>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {pacingIntervalMs} ms/كلمة
                  </span>
                </div>
                <input
                  id="pacing-speed-slider"
                  type="range"
                  min={320}
                  max={850}
                  step={20}
                  value={pacingIntervalMs}
                  onChange={(e) => setPacingIntervalMs(Number(e.target.value))}
                  className="w-full playful-slider cursor-pointer"
                />
                <div className="text-[10px] text-slate-500 mt-1">
                  {pacingSyncModeLabel}
                </div>
              </div>
            </div>

            {/* Irlen Visual Comfort Themes */}
            <div className="pt-3 border-t border-slate-200">
              <div className="text-xs font-medium text-slate-700 mb-2">
                لون خلفية القراءة (اختر ما يريح عين الطفل؛ تغيير اللون لا يعالج عسر القراءة):
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cream', label: 'كريمي دافئ' },
                  { id: 'sky', label: 'سماوي هادئ' },
                  { id: 'white', label: 'أبيض نقي' },
                  { id: 'night', label: 'داكن مريح' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setSurfaceTheme(
                        t.id as 'white' | 'cream' | 'sky' | 'night'
                      )
                    }
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      surfaceTheme === t.id
                        ? 'border-[#0284C7] bg-sky-50 text-[#0284C7] font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: DYSLEXICO 3-WAY LINGUISTIC & DIALECT STUDIO */}
      {studioMode === 'dyslexico' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div className="max-w-2xl space-y-1.5">
              <div className="text-xs text-slate-500">
                مراجعة أولية للفروق الكتابية واللهجية في النص المدخل فقط
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                مراجعة كتابية استكشافية تراعي اختلافات اللهجات العربية
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                يقترح المحرك ثلاث فئات لغوية من النص المكتوب؛ قد يخطئ في السياق أو اللهجة:
                <strong className="text-rose-700 mx-1">
                  (١) فروق كتابية محتملة ({reviewCandidatesCount})
                </strong>
                ،
                <strong className="text-amber-800 mx-1">
                  (٢) اختلافات إملائية محتملة ({orthographicConventionsCount})
                </strong>
                ،
                <strong className="text-[#059669] mx-1">
                  (٣) صيغ لهجية محتملة ({validDialectTokensCount})
                </strong>
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="اللهجة المحتملة في المثال اللغوي"
                value={selectedDialect}
                onChange={(e) =>
                  setSelectedDialect(e.target.value as ArabicDialectCode)
                }
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800"
              >
                {ARABIC_DIALECT_PROFILES.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.labelAr}
                  </option>
                ))}
              </select>
              {DYSLEXICO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedDialect(preset.dialect);
                    setDyslexicoInput(preset.sample);
                  }}
                  className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
              {nonExactTokens.length > 0 && (
                <button
                  type="button"
                  onClick={handleApplyAllCorrections}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#059669] hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>
                    موائمة النص إلى الفصحى ({nonExactTokens.length})
                  </span>
                </button>
              )}
            </div>
          </div>

          <p role="note" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-950">هذا محلل لغوي استكشافي للنص المكتوب فقط؛ لا يشخّص عسر القراءة ولا يصنّف الطفل. كل اقتراح يحتاج إلى مراجعة بشرية في سياق الجملة واللهجة.</p>
<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left 7 cols: Live Dyslexic Text Input & Interactive Token Correction */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <label
                  htmlFor="dyslexico-live-input"
                  className="block text-xs font-semibold text-slate-700 mb-2"
                >
                  أدخل مثالًا مكتوبًا لمراجعة الفروق الإملائية واللهجية؛ هذه الأداة لا تستخدم الصوت ولا تقيس نطق الطفل:
                </label>
                <textarea
                  id="dyslexico-live-input"
                  rows={3}
                  value={dyslexicoInput}
                  onChange={(e) => setDyslexicoInput(e.target.value)}
                  dir="auto"
                  className={`w-full p-4 text-base bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0284C7] ${
                    openDyslexicMode ? 'font-opendyslexic' : ''
                  }`}
                />
              </div>

              {/* Interactive Token Strip with 3-Way Color Coding */}
              <div className="p-5 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span>نتائج المراجعة اللغوية الأولية (انقر لتجربة المقابل المقترح):</span>
                  <span className="font-mono tabular-nums">
                    إبدالات: {reviewCandidatesCount} · إملاء:{' '}
                    {orthographicConventionsCount} · لهجة:{' '}
                    {validDialectTokensCount}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1" dir="auto">
                  {dyslexicoAnalysis.map((token, idx) => {
                    if (token.variationCategory === 'exact_lexicon_match') {
                      return (
                        <span
                          key={idx}
                          className="px-2.5 py-1 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg"
                        >
                          {token.originalWord}
                        </span>
                      );
                    }
                    if (
                      token.variationCategory === 'valid_dialect_lexical' ||
                      token.variationCategory === 'dialect_phonological_shift'
                    ) {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            handleApplyCorrection(
                              token.originalWord,
                              token.bestCorrection
                            )
                          }
                          className="px-2.5 py-1 text-sm bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          title={`${token.variationCategoryLabelAr} — المرادف المدرسي الفصيح: ${token.bestCorrection}`}
                        >
                          <span className="text-emerald-900 font-semibold">
                            {token.originalWord}
                          </span>
                          <span className="text-[11px] text-emerald-700 bg-white/80 px-1.5 py-0.5 rounded">
                            لهجة ({token.bestCorrection})
                          </span>
                        </button>
                      );
                    }
                    if (token.variationCategory === 'orthographic_convention') {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            handleApplyCorrection(
                              token.originalWord,
                              token.bestCorrection
                            )
                          }
                          className="px-2.5 py-1 text-sm bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          title={token.contextualCautionAr}
                        >
                          <span className="text-amber-900 font-medium">
                            {token.originalWord}
                          </span>
                          <span className="text-amber-600">↔</span>
                          <span className="font-bold text-amber-900">
                            {token.bestCorrection}
                          </span>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          handleApplyCorrection(
                            token.originalWord,
                            token.bestCorrection
                          )
                        }
                        className="px-2.5 py-1 text-sm bg-rose-50 hover:bg-emerald-50 border border-rose-300 hover:border-emerald-400 rounded-lg transition-colors flex items-center gap-1.5 group cursor-pointer"
                        title={token.contextualCautionAr}
                      >
                        <span className="underline decoration-rose-500 text-rose-800 font-medium">
                          {token.originalWord}
                        </span>
                        <span className="text-slate-400">←</span>
                        <span className="font-bold text-[#059669] flex items-center gap-0.5">
                          {token.bestCorrection}
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right 5 cols: Pairwise Weighted Levenshtein & Phonetic Hash Calculator */}
            <div className="lg:col-span-5 bg-[#F8FAFC] border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-[#0284C7]" />
                    <span>مقارنة المسافة الموزونة والكود الصوتي</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label
                      htmlFor="pair-source-input"
                      className="block text-[11px] text-slate-600 mb-1"
                    >
                      الكلمة المكتوبة:
                    </label>
                    <input
                      id="pair-source-input"
                      type="text"
                      value={pairSource}
                      onChange={(e) => setPairSource(e.target.value)}
                      dir="auto"
                      className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pair-target-input"
                      className="block text-[11px] text-slate-600 mb-1"
                    >
                      الكلمة المعجمية الصحيحة:
                    </label>
                    <input
                      id="pair-target-input"
                      type="text"
                      value={pairTarget}
                      onChange={(e) => setPairTarget(e.target.value)}
                      dir="auto"
                      className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {[
                    {
                      s: 'المنضار',
                      t: 'المنظار',
                      label: 'المنضار ↔ المنظار',
                    },
                    { s: 'التالب', t: 'الطالب', label: 'التالب ↔ الطالب' },
                    { s: 'المدرسه', t: 'المدرسة', label: 'المدرسه ↔ المدرسة' },
                  ].map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setPairSource(ex.s);
                        setPairTarget(ex.t);
                      }}
                      className="px-2.5 py-1 text-[11px] font-mono bg-white hover:bg-sky-50 border border-slate-200 rounded-md text-slate-700 cursor-pointer"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <div className="text-[11px] text-slate-500">
                      مسافة ليفنشتاين التقليدية
                    </div>
                    <div className="text-lg font-bold font-mono tabular-nums text-slate-800 mt-0.5">
                      {pairMetrics.standardDistance.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl">
                    <div className="text-[11px] text-[#0284C7] font-semibold">
                      مسافة الاختلاف الموزونة
                    </div>
                    <div className="text-lg font-bold font-mono tabular-nums text-[#0284C7] mt-0.5">
                      {pairMetrics.weightedDistance.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">الكود الصوتي للمدخل:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {pairMetrics.codeS}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">الكود الصوتي للهدف:</span>
                  <span className="font-mono font-semibold text-[#059669]">
                    {pairMetrics.codeT}{' '}
                    {pairMetrics.isPhoneticMatch ? '· تطابق صوتي' : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed 3-Way Classification Table */}
          {nonExactTokens.length > 0 && (
            <div className="overflow-x-auto pt-4 border-t border-slate-200">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3">الكلمة المدخلة</th>
                    <th className="py-2.5 px-3">التصنيف اللغوي الدقيق</th>
                    <th className="py-2.5 px-3">المقابل الفصيح</th>
                    <th className="py-2.5 px-3">هل يحتاج إلى مراجعة بشرية؟</th>
                    <th className="py-2.5 px-3">التفسير اللغوي والتربوي</th>
                    <th className="py-2.5 px-3">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nonExactTokens.map((item, idx) => {
                    const isDialect =
                      item.variationCategory === 'valid_dialect_lexical' ||
                      item.variationCategory === 'dialect_phonological_shift';
                    const isOrtho =
                      item.variationCategory === 'orthographic_convention';
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {item.originalWord}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-semibold ${
                              isDialect
                                ? 'text-[#059669]'
                                : isOrtho
                                  ? 'text-[#D97706]'
                                  : 'text-[#DC2626]'
                            }`}
                          >
                            {item.variationCategoryLabelAr}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-[#059669]">
                          {item.bestCorrection}
                        </td>
                        <td className="py-3 px-3 font-semibold">
                          {item.requiresTeacherReview ? (
                            <span className="text-amber-800">
                              لا يكفي للاستدلال؛ راجع السياق والأداء الفعلي
                            </span>
                          ) : (
                            <span className="text-[#059669]">
                              اختلاف لغوي محتمل؛ راجع السياق
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {item.contextualCautionAr}
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleApplyCorrection(
                                item.originalWord,
                                item.bestCorrection
                              )
                            }
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                          >
                            استبدال بالفصحى
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
