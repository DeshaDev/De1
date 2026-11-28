/**
 * Reading-First Hand-Drawn Story Reader («القصص التفاعلية المرسومة بخط اليد»)
 *
 * Design & Pedagogy Principles:
 * 1. Zero clutter: Full-screen reading focus (hides De1 topbar/footer via baseera-reading-focus).
 * 2. Authentic unbroken Arabic typography: Main reading words NEVER break across multiple <span>
 *    tags; cursive letter shaping and harakat remain 100% intact. Separated contextual syllables
 *    (e.g. طَا · ئِـ · ـرًا) appear ONLY in the helper strip below when tapped for decoding help.
 * 3. Single-viewport 1366x768 comfort: Compact bar + large calm reading box + clean hand-drawn frame
 *    with primary navigation always visible above the fold.
 * 4. Guided 3-step loop per page (Listen & Track → Read Word-by-Word → Orthographic Word Check),
 *    with an Independent Reading mode toggle.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Mic,
  Puzzle,
  RotateCcw,
  Settings2,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import {
  HAND_DRAWN_STORIES,
  getHandDrawnStory,
  matchSpokenWords,
  stripArabicPunctuation,
  type HandDrawnStory,
} from '../../cognitiveProfile/handDrawnStories';
import { toArabicNum } from '../../utils/arabicDigits';
import { playDrumClapSound, playMagicBrushSound } from '../../utils/soundEffects';
import { speak, stopSpeech } from '../profile/audio';
import { MascotMoment } from '../ui/Mascot';
import { MirrorVoiceRecorder } from '../ui/MirrorVoiceRecorder';
import { MASCOT_LINES } from '../ui/mascotLines';
import { HandDrawnSketchScene } from './HandDrawnSketches';
import type { StudentRecord } from '../../data/seedData';
import {
  orderAdaptiveStories,
  recommendedStorySupportMode,
  type StudioAdaptiveState,
} from '../../cognitiveProfile/studioAdaptive';

type SupportMode = 'guided' | 'independent';
type PageStep = 'listen' | 'pointer' | 'decode';
type SessionPhase = 'warmup' | 'page' | 'sequence' | 'quiz' | 'done';

type FontSizeKey = 'm' | 'l' | 'xl';
type SurfaceKey = 'cream' | 'white' | 'night';

const FONT_PX: Record<FontSizeKey, number> = { m: 30, l: 36, xl: 44 };
const SURFACES: Record<SurfaceKey, { bg: string; ink: string; border: string; label: string }> = {
  cream: { bg: '#FBF6E9', ink: '#1F2A37', border: '#E5DEC9', label: 'كريمي هادئ' },
  white: { bg: '#FFFFFF', ink: '#111827', border: '#E2E8F0', label: 'أبيض' },
  night: { bg: '#18222E', ink: '#F1EDE4', border: '#334155', label: 'داكن' },
};

interface ReaderPrefs {
  size: FontSizeKey;
  surface: SurfaceKey;
}

const PREFS_KEY = 'baseera.handDrawnReader.prefs';
function loadPrefs(): ReaderPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) return { size: 'l', surface: 'cream', ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { size: 'l', surface: 'cream' };
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as
    | (new () => SpeechRecognitionInstance)
    | null;
}

export interface InteractiveStoryReaderProps {
  student?: StudentRecord | null;
  adaptiveState?: StudioAdaptiveState;
  recommendedStoryId?: string;
  childName?: string;
  initialStoryId?: string;
  onReadingChange?: (reading: boolean) => void;
  onActivityCompleted?: (storyId: string, practiceWords?: string[]) => void;
}

export const InteractiveStoryReader: React.FC<InteractiveStoryReaderProps> = ({
  student,
  adaptiveState,
  recommendedStoryId,
  childName = 'البطل',
  initialStoryId,
  onReadingChange,
  onActivityCompleted,
}) => {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(() =>
    initialStoryId && getHandDrawnStory(initialStoryId) ? initialStoryId : null,
  );
  const [support, setSupport] = useState<SupportMode>(() =>
    recommendedStorySupportMode(student, adaptiveState),
  );
  const [levelFilter, setLevelFilter] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    if (initialStoryId && getHandDrawnStory(initialStoryId)) {
      setSelectedStoryId(initialStoryId);
    }
  }, [initialStoryId]);

  const activeStory = selectedStoryId ? getHandDrawnStory(selectedStoryId) ?? null : null;

  useEffect(() => {
    onReadingChange?.(activeStory !== null);
    if (activeStory && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    return () => onReadingChange?.(false);
  }, [activeStory, onReadingChange]);

  if (activeStory) {
    return (
      <FocusedStorySession
        key={`${activeStory.id}-${support}`}
        story={activeStory}
        support={support}
        onToggleSupport={() => setSupport((s) => (s === 'guided' ? 'independent' : 'guided'))}
        onExit={() => {
          stopSpeech();
          setSelectedStoryId(null);
        }}
        onCompleted={(id, struggledWords) => onActivityCompleted?.(id, struggledWords)}
      />
    );
  }

  const visibleStories =
    levelFilter === 0 ? HAND_DRAWN_STORIES : HAND_DRAWN_STORIES.filter((s) => s.level === levelFilter);

  const orderedStories = orderAdaptiveStories(
    visibleStories,
    student,
    recommendedStoryId ? ({ recommendedStoryId } as any) : undefined,
    adaptiveState,
  );

  return (
    <div className="space-y-5" dir="rtl" data-reading-hub="hand-drawn">
      {/* Pedagogical Reading Method Banner */}
      <section className="rounded-3xl border border-[#E5DEC9] bg-[#FAF6EE] p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-black text-amber-900">
              <BookOpen className="h-3.5 w-3.5 text-amber-700" />
              قصص مرسومة بخط اليد · لتعليم القراءة خطوةً بخطوة
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              اختر قصةً ليقرأها {childName} بتركيز ووضوح
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              ١. تهيئة الكلمات بالمقاطع ← ٢. استماع وتتبع كلمةً بكلمة ← ٣. قراءة موجّهة مع تهجئة فورية ← ٤. تمييز بصري وفهم قرائي.
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[11px] font-bold text-slate-500">أسلوب الجلسة:</span>
            <div className="bz-segment" role="radiogroup" aria-label="أسلوب القراءة">
              <button
                type="button"
                role="radio"
                aria-checked={support === 'guided'}
                onClick={() => setSupport('guided')}
              >
                قراءة موجّهة (٣ خطوات)
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={support === 'independent'}
                onClick={() => setSupport('independent')}
              >
                قراءة حرّة مستقلة
              </button>
            </div>
          </div>
        </div>

        {/* Level Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[#E5DEC9] pt-3">
          {([
            [0, 'جميع المستويات'],
            [1, 'المستوى ١ · مرحلة الروضة والبراعم (KG1)'],
            [2, 'المستوى ٢ · بداية القراءة والصفوف المبكرة'],
            [3, 'المستوى ٣ · قراءة مستقلة وطلاقة'],
          ] as const).map(([lv, label]) => (
            <button
              key={lv}
              type="button"
              onClick={() => setLevelFilter(lv)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                levelFilter === lv
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Graded Hand-Drawn Story Shelf */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {orderedStories.map((story) => (
          <article
            key={story.id}
            data-story-card={story.id}
            className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs transition hover:shadow-md"
          >
            <div>
              <div className="aspect-video w-full overflow-hidden border-b border-slate-100 bg-[#FAF6EE]">
                {story.coverImageUrl ? (
                  <img
                    src={story.coverImageUrl}
                    alt={story.title}
                    className="h-full w-full object-cover"
                  />
                ) : story.coverSketchId ? (
                  <HandDrawnSketchScene scene={story.coverSketchId} className="h-full w-full" />
                ) : null}
              </div>

              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-teal-800">
                    {story.levelLabel}
                  </span>
                  <span>{toArabicNum(story.pages.length)} صفحات</span>
                </div>

                <h3 className="text-xl font-black text-slate-900">{story.title}</h3>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">{story.subtitle}</p>
                <p className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[11px] font-semibold text-amber-950">
                  التركيز القرائي: {story.phonicsFocusAr}
                </p>
              </div>
            </div>

            <div className="p-4 pt-0">
              <button
                type="button"
                data-open-story={story.id}
                onClick={() => {
                  stopSpeech();
                  setSelectedStoryId(story.id);
                }}
                className="bz-btn bz-btn-primary w-full justify-center text-sm"
              >
                <BookOpen className="h-4 w-4" />
                <span>ابدأ القراءة الآن</span>
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Focused Single-Viewport Story Reader Session                       */
/* ------------------------------------------------------------------ */

const STEP_LABELS: Record<PageStep, string> = {
  listen: '١. استمع وتتبّع',
  pointer: '٢. اقرأ كلمةً بكلمة',
  decode: '٣. ميّز الكلمة',
};
const GUIDED_STEPS: PageStep[] = ['listen', 'pointer', 'decode'];

function FocusedStorySession({
  story,
  support,
  onToggleSupport,
  onExit,
  onCompleted,
}: {
  story: HandDrawnStory;
  support: SupportMode;
  onToggleSupport: () => void;
  onExit: () => void;
  onCompleted: (id: string, practiceWords: string[]) => void;
}) {
  const [phase, setPhase] = useState<SessionPhase>('warmup');
  const [pageIdx, setPageIdx] = useState(0);
  const [step, setStep] = useState<PageStep>(support === 'guided' ? 'listen' : 'pointer');
  const [cursor, setCursor] = useState(0);
  const [litIdx, setLitIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const [prefs, setPrefs] = useState<ReaderPrefs>(loadPrefs);
  const [showPrefs, setShowPrefs] = useState(false);

  const [helpWord, setHelpWord] = useState<string | null>(null);
  const [practiceWords, setPracticeWords] = useState<string[]>([]);

  // Step 3 (Decode check)
  const [decodeChoice, setDecodeChoice] = useState<string | null>(null);
  const [decodeScore, setDecodeScore] = useState({ right: 0, total: 0 });

  // Oral mic state during 'pointer'
  const [micListening, setMicListening] = useState(false);
  const [micFeedback, setMicFeedback] = useState<string | null>(null);
  const [spokenMatched, setSpokenMatched] = useState<boolean[]>([]);
  const micRef = useRef<SpeechRecognitionInstance | null>(null);
  const hasSpeechRec = Boolean(getSpeechRecognitionCtor());

  // Syllable Clapping Drum ("طبلة المقاطع الإيقاعية")
  const [clappingWord, setClappingWord] = useState<string | null>(null);
  const [clapSylIdx, setClapSylIdx] = useState<number | null>(null);
  const drumTimerRef = useRef<number | null>(null);

  // Sequence & Quiz
  const [seqPickedIds, setSeqPickedIds] = useState<string[]>([]);
  const [seqWrongId, setSeqWrongId] = useState<string | null>(null);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});

  const playTicket = useRef(0);
  const completedLogged = useRef(false);

  const stopAll = useCallback(() => {
    playTicket.current += 1;
    stopSpeech();
    setPlaying(false);
    setLitIdx(null);
    if (drumTimerRef.current !== null) {
      window.clearTimeout(drumTimerRef.current);
      drumTimerRef.current = null;
    }
    setClappingWord(null);
    setClapSylIdx(null);
    if (micRef.current) {
      try {
        micRef.current.stop();
      } catch {
        /* ignore */
      }
      micRef.current = null;
      setMicListening(false);
    }
  }, []);

  // Activate De1 immersion focus mode: hides topbar & footer completely
  useEffect(() => {
    document.body.classList.add('baseera-reading-focus');
    return () => {
      document.body.classList.remove('baseera-reading-focus');
      stopAll();
    };
  }, [stopAll]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  const page = story.pages[pageIdx];
  const words = useMemo(() => page.text.split(/\s+/).filter(Boolean), [page.text]);

  const decodeOptions = useMemo(
    () => [...page.check.options].sort((a, b) => a.localeCompare(b, 'ar')),
    [page.check.options],
  );

  const shuffledEvents = useMemo(
    () => [...story.sequenceEvents].sort((a, b) => a.text.length - b.text.length),
    [story.sequenceEvents],
  );

  const recordPracticeWord = (raw: string) => {
    const clean = stripArabicPunctuation(raw);
    if (!clean) return;
    setPracticeWords((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
  };

  const sayText = async (text: string) => {
    stopAll();
    const myTicket = ++playTicket.current;
    setPlaying(true);
    await speak(text);
    if (myTicket === playTicket.current) {
      setPlaying(false);
    }
  };

  /** Beats through each syllable with a warm hand-drum sound, then speaks the full word. */
  const handleClapSyllables = (word: string, syllables: string[]) => {
    if (!syllables.length) {
      void sayText(word);
      return;
    }
    stopAll();
    const myTicket = playTicket.current;

    const beatStep = (idx: number) => {
      if (myTicket !== playTicket.current) return;
      if (idx >= syllables.length) {
        setClappingWord(null);
        setClapSylIdx(null);
        drumTimerRef.current = null;
        void sayText(word);
        return;
      }
      setClappingWord(word);
      setClapSylIdx(idx);
      playDrumClapSound(idx);
      drumTimerRef.current = window.setTimeout(() => beatStep(idx + 1), 500);
    };

    beatStep(0);
  };

  /** Plays page audio if present AND animates smooth word-by-word gold focus cursor. */
  const listenAndTrackPage = async () => {
    stopAll();
    const myTicket = ++playTicket.current;
    setPlaying(true);
    setLitIdx(0);

    const lengths = words.map((w) => Math.max(2, stripArabicPunctuation(w).length));
    const totalChars = lengths.reduce((a, b) => a + b, 0);
    const totalMs = Math.max(1800, totalChars * 115);
    let elapsed = 80;
    const timers: number[] = [];

    lengths.forEach((len, idx) => {
      timers.push(
        window.setTimeout(() => {
          if (myTicket === playTicket.current) setLitIdx(idx);
        }, elapsed),
      );
      elapsed += (len / totalChars) * totalMs;
    });

    await Promise.all([
      speak(page.text),
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, elapsed + 220));
      }),
    ]);

    timers.forEach((t) => window.clearTimeout(t));
    if (myTicket === playTicket.current) {
      setPlaying(false);
      setLitIdx(null);
    }
  };

  const resetForPage = (nextPageIdx: number) => {
    stopAll();
    setPageIdx(nextPageIdx);
    setStep(support === 'guided' ? 'listen' : 'pointer');
    setCursor(0);
    setHelpWord(null);
    setDecodeChoice(null);
    setMicFeedback(null);
    setSpokenMatched([]);
  };

  const advanceFromPage = () => {
    if (pageIdx + 1 < story.pages.length) {
      resetForPage(pageIdx + 1);
    } else {
      stopAll();
      setSeqPickedIds([]);
      setSeqWrongId(null);
      setPhase('sequence');
    }
  };

  const advancePointerWord = useCallback(() => {
    stopSpeech();
    setHelpWord(null);
    const totalWords = Math.max(1, words.length);
    playMagicBrushSound(Math.min(1, (cursor + 2) / totalWords));
    if (cursor < words.length - 1) {
      setCursor((c) => c + 1);
    } else if (support === 'guided') {
      setStep('decode');
    } else {
      advanceFromPage();
    }
  }, [cursor, words.length, support, pageIdx, story.pages.length]);

  // Keyboard navigation during word-by-word reading (Space or ArrowLeft in RTL)
  useEffect(() => {
    if (phase !== 'page' || step !== 'pointer') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowLeft') {
        e.preventDefault();
        advancePointerWord();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, step, advancePointerWord]);

  const toggleMicReading = () => {
    if (micListening && micRef.current) {
      micRef.current.stop();
      setMicListening(false);
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    stopAll();
    const rec = new Ctor();
    rec.lang = 'ar-SA';
    rec.interimResults = false;
    rec.maxAlternatives = 4;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const results: string[] = [];
      const row = ev.results?.[0];
      if (row) {
        for (let i = 0; i < row.length; i++) results.push(String(row[i].transcript || ''));
      }
      const matched = matchSpokenWords(results, words);
      setSpokenMatched(matched);
      const hitCount = matched.filter(Boolean).length;
      if (hitCount > 0) {
        setMicFeedback(`رائع! قرأتَ ${toArabicNum(hitCount)} من ${toArabicNum(words.length)} كلمات بصوتك.`);
        const firstUnread = matched.findIndex((m) => !m);
        if (firstUnread === -1) {
          setCursor(words.length - 1);
        } else {
          setCursor(firstUnread);
        }
      } else {
        setMicFeedback('حاول التحدّث بوضوح أكثر أو اضغط على الكلمة المضيئة للمتابعة.');
      }
    };
    rec.onerror = () => {
      setMicFeedback('تعذّر سماع الصوت؛ اضغط على الكلمة المضيئة بعد قراءتها.');
      setMicListening(false);
    };
    rec.onend = () => {
      setMicListening(false);
      micRef.current = null;
    };
    micRef.current = rec;
    setMicFeedback('تحدّث الآن واقرأ الجملة بصوتك…');
    setMicListening(true);
    try {
      rec.start();
    } catch {
      setMicListening(false);
    }
  };

  // Overall linear progress bar
  const totalStepsCount =
    1 + story.pages.length * (support === 'guided' ? 3 : 1) + 1 + story.questions.length;
  const doneStepsCount =
    phase === 'warmup'
      ? 0
      : phase === 'page'
        ? 1 + pageIdx * (support === 'guided' ? 3 : 1) + (support === 'guided' ? GUIDED_STEPS.indexOf(step) : 0)
        : phase === 'sequence'
          ? 1 + story.pages.length * (support === 'guided' ? 3 : 1)
          : phase === 'quiz'
            ? 2 + story.pages.length * (support === 'guided' ? 3 : 1) + quizIdx
            : totalStepsCount;

  const surface = SURFACES[prefs.surface];

  const topHeader = (
    <header className="flex flex-wrap items-center justify-between gap-2" data-story-topbar>
      <button
        type="button"
        className="bz-btn bz-btn-ghost bz-btn-sm shrink-0"
        onClick={onExit}
        data-story-exit
      >
        <X className="h-4 w-4" />
        <span>إنهاء القصة</span>
      </button>

      <div className="flex items-center gap-2 text-center">
        <span className="font-bold text-slate-900 truncate text-sm sm:text-base">{story.title}</span>
        {phase === 'page' && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
            صفحة {toArabicNum(pageIdx + 1)} من {toArabicNum(story.pages.length)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="bz-btn bz-btn-ghost bz-btn-sm"
          onClick={onToggleSupport}
          title="التبديل بين القراءة الموجّهة والمستقلة"
        >
          <span>{support === 'guided' ? 'وضع: موجّهة' : 'وضع: مستقلة'}</span>
        </button>
        <button
          type="button"
          className="bz-btn bz-btn-ghost bz-btn-sm shrink-0"
          aria-expanded={showPrefs}
          onClick={() => setShowPrefs((v) => !v)}
        >
          <Settings2 className="h-4 w-4" />
          <span className="bz-hide-sm">شكل النص</span>
        </button>
      </div>
    </header>
  );

  const progressBar = (
    <div
      className="bz-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={totalStepsCount}
      aria-valuenow={doneStepsCount}
      aria-label="التقدم في القصة"
    >
      <span style={{ width: `${Math.min(100, (doneStepsCount / totalStepsCount) * 100)}%` }} />
    </div>
  );

  const prefsPanel = showPrefs && (
    <div className="bz-card p-3 sm:p-4 grid sm:grid-cols-2 gap-3" role="group" aria-label="إعدادات القراءة">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700">حجم الخط:</span>
        <div className="flex gap-1.5">
          {(['m', 'l', 'xl'] as FontSizeKey[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={prefs.size === s}
              onClick={() => setPrefs((p) => ({ ...p, size: s }))}
              className={`rounded-lg border px-3 py-1 text-xs font-bold ${
                prefs.size === s ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white'
              }`}
            >
              {s === 'm' ? 'متوسط' : s === 'l' ? 'كبير' : 'كبير جدًا'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700">لون الورق:</span>
        <div className="flex gap-1.5">
          {(Object.keys(SURFACES) as SurfaceKey[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={prefs.surface === k}
              onClick={() => setPrefs((p) => ({ ...p, surface: k }))}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                prefs.surface === k ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="h-3 w-3 rounded-full border border-slate-300" style={{ background: SURFACES[k].bg }} />
              {SURFACES[k].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* ---------------- PHASE 1: KEY WORDS WARMUP ---------------- */
  if (phase === 'warmup') {
    return (
      <div
        className="mx-auto flex max-w-5xl flex-col gap-4"
        style={{ minHeight: 'calc(100dvh - 32px)' }}
        dir="rtl"
        data-story-phase="warmup"
      >
        {topHeader}
        {progressBar}
        {prefsPanel}

        <div className="flex flex-1 flex-col justify-center gap-5">
          <div className="text-center space-y-1">
            <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">
              مفاتيح القراءة · تعرّف على مقاطع ٣ كلمات قبل البدء
            </span>
            <h2 className="text-2xl font-black text-slate-900">اقرأ الكلمات التالية بتمهّل</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {story.warmupWords.map((item) => (
              <div
                key={item.word}
                className="flex flex-col items-center justify-between rounded-3xl border border-[#E5DEC9] bg-[#FBF6E9] p-5 text-center shadow-xs"
              >
                <p
                  className="font-bold text-slate-900"
                  style={{ fontFamily: 'var(--font-reading)', fontSize: 38, lineHeight: 1.8 }}
                  lang="ar"
                >
                  {item.word}
                </p>

                <div className="my-2 flex flex-wrap justify-center gap-1.5" dir="rtl">
                  {item.syllables.map((syl, idx) => {
                    const isClapLit = clappingWord === item.word && clapSylIdx === idx;
                    return (
                      <span
                        key={idx}
                        className={`rounded-xl border px-2.5 py-1 text-lg font-bold transition-all duration-200 ${
                          isClapLit
                            ? 'scale-115 border-amber-500 bg-amber-300 text-slate-950 shadow-xs'
                            : 'border-[#D8CEB8] bg-white text-teal-900'
                        }`}
                        style={{ fontFamily: 'var(--font-reading)' }}
                      >
                        {syl}
                      </span>
                    );
                  })}
                </div>

                <p className="text-xs font-medium text-slate-600 leading-relaxed">{item.meaningAr}</p>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void sayText(item.word)}
                    className="bz-btn bz-btn-secondary bz-btn-sm"
                  >
                    <Volume2 className="h-4 w-4 text-teal-700" />
                    <span>استمع للكلمة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClapSyllables(item.word, item.syllables)}
                    className="bz-btn bz-btn-sm border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                  >
                    <span>🥁</span>
                    <span>دقّ المقاطع</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-1">
            <button
              type="button"
              data-story-action="start-story"
              onClick={() => {
                stopAll();
                setPhase('page');
                resetForPage(0);
              }}
              className="bz-btn bz-btn-primary bz-btn-lg"
            >
              <span>ابدأ قراءة الصفحة الأولى</span>
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- PHASE 3: STORY SEQUENCING ---------------- */
  if (phase === 'sequence') {
    const seqDone = seqPickedIds.length === story.sequenceEvents.length;
    return (
      <div
        className="mx-auto flex max-w-3xl flex-col gap-4"
        style={{ minHeight: 'calc(100dvh - 32px)' }}
        dir="rtl"
        data-story-phase="sequence"
      >
        {topHeader}
        {progressBar}

        <div className="flex flex-1 flex-col justify-center gap-4">
          <div className="text-center space-y-1">
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-800">
              ترتيب أحداث القصة · من البداية إلى النهاية
            </span>
            <h2 className="text-2xl font-black text-slate-900">اضغط الأحداث بالترتيب الصحيح</h2>
          </div>

          <div className="space-y-2.5">
            {shuffledEvents.map((evt) => {
              const orderPos = seqPickedIds.indexOf(evt.id);
              const picked = orderPos !== -1;
              const isWrong = seqWrongId === evt.id;
              return (
                <button
                  key={evt.id}
                  type="button"
                  data-seq-order={evt.order}
                  onClick={() => {
                    if (picked) return;
                    if (evt.order === seqPickedIds.length + 1) {
                      setSeqWrongId(null);
                      setSeqPickedIds((prev) => [...prev, evt.id]);
                      void sayText(evt.text);
                    } else {
                      setSeqWrongId(evt.id);
                    }
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-right transition ${
                    picked
                      ? 'border-teal-600 bg-teal-50 text-teal-950'
                      : isWrong
                        ? 'border-rose-400 bg-rose-50'
                        : 'border-slate-200 bg-white hover:border-teal-400'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                      picked ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {picked ? toArabicNum(orderPos + 1) : '؟'}
                  </span>
                  <span className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-reading)' }}>
                    {evt.text}
                  </span>
                </button>
              );
            })}
          </div>

          {seqDone && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                data-story-action="to-quiz"
                onClick={() => {
                  stopAll();
                  setQuizIdx(0);
                  setPhase('quiz');
                }}
                className="bz-btn bz-btn-primary bz-btn-lg"
              >
                <span>إلى أسئلة الفهم</span>
                <ArrowLeft className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------------- PHASE 4: COMPREHENSION QUIZ ---------------- */
  if (phase === 'quiz') {
    const q = story.questions[quizIdx];
    const picked = quizAnswers[q.id];
    const answered = picked !== undefined;
    const isRight = picked === q.answer;

    return (
      <div
        className="mx-auto flex max-w-3xl flex-col gap-4"
        style={{ minHeight: 'calc(100dvh - 32px)' }}
        dir="rtl"
        data-story-phase="quiz"
      >
        {topHeader}
        {progressBar}

        <div className="flex flex-1 flex-col justify-center">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-teal-800 bg-teal-50 px-3 py-1 rounded-full">
                سؤال الفهم {toArabicNum(quizIdx + 1)} من {toArabicNum(story.questions.length)}
              </span>
              <button
                type="button"
                onClick={() => void sayText(q.q)}
                className="bz-icon-btn"
                aria-label="استمع إلى السؤال"
              >
                <Volume2 className="h-5 w-5" />
              </button>
            </div>

            <h2
              className="text-2xl sm:text-3xl font-bold text-slate-900"
              style={{ fontFamily: 'var(--font-reading)', lineHeight: 1.9 }}
            >
              {q.q}
            </h2>

            <div className="grid gap-3">
              {q.options.map((opt) => {
                const rightOpt = opt === q.answer;
                const style = !answered
                  ? 'border-slate-200 bg-[#FAF6EE] hover:border-teal-500'
                  : rightOpt
                    ? 'border-teal-600 bg-teal-50 text-teal-950'
                    : picked === opt
                      ? 'border-rose-400 bg-rose-50'
                      : 'border-slate-200 bg-white opacity-55';
                return (
                  <button
                    key={opt}
                    type="button"
                    data-quiz-option={rightOpt ? 'right' : 'wrong'}
                    disabled={answered}
                    onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                    className={`rounded-2xl border-2 p-4 text-right text-xl font-bold transition ${style}`}
                    style={{ fontFamily: 'var(--font-reading)' }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3.5 border border-slate-200">
                <p className={`text-sm font-bold ${isRight ? 'text-teal-800' : 'text-amber-900'}`}>
                  {isRight ? 'إجابة صحيحة! ' : 'التوضيح: '}
                  <span className="font-normal text-slate-700">{q.explanationAr}</span>
                </p>
                <button
                  type="button"
                  data-story-action="quiz-next"
                  onClick={() => {
                    if (quizIdx + 1 < story.questions.length) {
                      setQuizIdx((i) => i + 1);
                    } else {
                      if (!completedLogged.current) {
                        completedLogged.current = true;
                        onCompleted(story.id, practiceWords);
                      }
                      setPhase('done');
                    }
                  }}
                  className="bz-btn bz-btn-primary"
                >
                  <span>{quizIdx + 1 < story.questions.length ? 'السؤال التالي' : 'ملخص القراءة'}</span>
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  /* ---------------- PHASE 5: COMPLETION SUMMARY ---------------- */
  if (phase === 'done') {
    const qCorrect = story.questions.filter((q) => quizAnswers[q.id] === q.answer).length;
    return (
      <div
        className="mx-auto flex max-w-3xl flex-col gap-4"
        style={{ minHeight: 'calc(100dvh - 32px)' }}
        dir="rtl"
        data-story-phase="done"
      >
        {topHeader}
        {progressBar}

        <div className="flex flex-1 flex-col justify-center">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center space-y-5 shadow-xs">
            <MascotMoment mood="proud" size={115} message={MASCOT_LINES.readerDone} className="mx-auto" />
            <h2 className="text-2xl font-black text-slate-900">أحسنت! أنهيت قراءة «{story.title}»</h2>

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[#FAF6EE] p-3.5 border border-[#E5DEC9]">
                <dt className="text-xs font-bold text-slate-500">الصفحات المقروءة</dt>
                <dd className="text-2xl font-black text-slate-900">{toArabicNum(story.pages.length)}</dd>
              </div>
              {decodeScore.total > 0 && (
                <div className="rounded-2xl bg-[#FAF6EE] p-3.5 border border-[#E5DEC9]">
                  <dt className="text-xs font-bold text-slate-500">تمييز الكلمات</dt>
                  <dd className="text-2xl font-black text-teal-800">
                    {toArabicNum(decodeScore.right)}/{toArabicNum(decodeScore.total)}
                  </dd>
                </div>
              )}
              <div className="rounded-2xl bg-[#FAF6EE] p-3.5 border border-[#E5DEC9]">
                <dt className="text-xs font-bold text-slate-500">الفهم القرائي</dt>
                <dd className="text-2xl font-black text-teal-800">
                  {toArabicNum(qCorrect)}/{toArabicNum(story.questions.length)}
                </dd>
              </div>
            </dl>

            {practiceWords.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-black text-slate-800">كلمات استمعنا إليها لنتقنها:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {practiceWords.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => void sayText(w)}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-lg font-bold hover:border-teal-400"
                    >
                      <Volume2 className="h-4 w-4 text-teal-700" />
                      <span style={{ fontFamily: 'var(--font-reading)' }}>{w}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-600">قرأتَ القصة كاملةً بثقة ودون توقف.</p>
            )}

            <div className="flex flex-wrap justify-center gap-3 pt-1">
              <button type="button" onClick={onExit} className="bz-btn bz-btn-primary">
                <span>اختر قصةً أخرى</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPracticeWords([]);
                  setDecodeScore({ right: 0, total: 0 });
                  setQuizAnswers({});
                  setPhase('warmup');
                }}
                className="bz-btn bz-btn-secondary"
              >
                <RotateCcw className="h-4 w-4" />
                <span>أعد القراءة</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  /* ---------------- PHASE 2: CORE READING PAGE ---------------- */
  const currentWordClean = words[cursor] ? stripArabicPunctuation(words[cursor]) : '';
  const activeHelperKey = helpWord ? stripArabicPunctuation(helpWord) : '';
  const activeHelperSyllables = activeHelperKey ? story.wordSyllables[activeHelperKey] : undefined;
  const decodeAnswered = decodeChoice !== null;

  const colorProgress = (() => {
    if (support === 'independent') {
      return playing ? 1 : 0.9;
    }
    if (step === 'decode') {
      return decodeChoice === page.check.targetWord ? 1 : 0.88;
    }
    if (step === 'pointer') {
      return Math.max(0.25, Math.min(1, (cursor + 1) / Math.max(1, words.length)));
    }
    if (litIdx !== null) {
      return Math.max(0.25, Math.min(1, (litIdx + 1) / Math.max(1, words.length)));
    }
    return playing ? 0.5 : 0.2;
  })();
  const isLivingIllustration = colorProgress >= 0.99;

  return (
    <div
      className="mx-auto flex max-w-6xl flex-col gap-3"
      style={{ minHeight: 'calc(100dvh - 28px)' }}
      dir="rtl"
      data-story-phase="page"
      data-page-step={step}
    >
      {topHeader}
      {progressBar}
      {prefsPanel}

      {/* Main 2-Column Spread — Reading Card FIRST on the right, Calm Illustration on the left */}
      <div className="flex flex-1 flex-col justify-center gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* READING WORKSPACE (7 columns) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            {/* Step Pills + Instruction */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {support === 'guided' ? (
                <ol className="flex flex-wrap gap-1.5" aria-label="خطوات قراءة الصفحة">
                  {GUIDED_STEPS.map((s) => {
                    const active = s === step;
                    const done = GUIDED_STEPS.indexOf(s) < GUIDED_STEPS.indexOf(step);
                    return (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => {
                            stopAll();
                            setHelpWord(null);
                            setStep(s);
                          }}
                          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                            active
                              ? 'bg-teal-700 text-white shadow-2xs'
                              : done
                                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {STEP_LABELS[s]}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
                  القراءة المستقلة · اضغط على أي كلمة لسماعها أو تهجئة مقاطعها
                </span>
              )}
            </div>

            {/* UNBROKEN READING CARD */}
            <section
              className="rounded-3xl border-2 px-5 py-6 sm:px-7 sm:py-7 shadow-2xs transition-colors"
              style={{ background: surface.bg, borderColor: surface.border }}
              data-reading-card
            >
              {/* Short clear instruction */}
              <p className="mb-3 text-center text-xs sm:text-sm font-bold" style={{ color: surface.ink, opacity: 0.72 }}>
                {step === 'listen'
                  ? 'استمع إلى المعلّمة وتابع الكلمة المظلّلة بعينيك.'
                  : step === 'pointer'
                    ? 'اقرأ الكلمة المظلّلة بصوتك ثم اضغطها لتنتقل إلى التالية.'
                    : 'اختر الكلمة الصحيحة التي تكمل الجملة بدقة:'}
              </p>

              {/* SENTENCE — Pure Unbroken Words (zero inner spans inside a word) */}
              <p
                className="flex flex-wrap justify-center items-baseline text-center font-semibold"
                style={{
                  fontFamily: 'var(--font-reading)',
                  fontSize: FONT_PX[prefs.size],
                  lineHeight: 2.15,
                  wordSpacing: '0.24em',
                  gap: '0.18em 0.34em',
                  color: surface.ink,
                }}
                lang="ar"
                data-reading-sentence
              >
                {words.map((w, idx) => {
                  const cleanW = stripArabicPunctuation(w);

                  // In Step 3 (decode), hide target word cleanly until answered correctly
                  if (step === 'decode' && cleanW === page.check.targetWord && decodeChoice !== page.check.targetWord) {
                    return (
                      <span
                        key={idx}
                        data-decode-blank
                        className="inline-block min-w-[4.2ch] rounded-xl border-2 border-dashed border-amber-500 bg-amber-50/70 px-3 text-amber-800"
                      >
                        ........
                      </span>
                    );
                  }

                  const isPointerStep = step === 'pointer' && support === 'guided';
                  const isCurrent =
                    step === 'listen'
                      ? litIdx === idx
                      : isPointerStep
                        ? idx === cursor
                        : false;
                  const isDimmed = isPointerStep && idx > cursor;
                  const isReadDone =
                    isPointerStep && (idx < cursor || Boolean(spokenMatched[idx]));
                  const isFilledTarget =
                    step === 'decode' && decodeChoice === page.check.targetWord && cleanW === page.check.targetWord;

                  return (
                    <button
                      key={idx}
                      type="button"
                      data-word-idx={idx}
                      onClick={() => {
                        if (isPointerStep && idx === cursor) {
                          advancePointerWord();
                          return;
                        }
                        setHelpWord(w);
                        recordPracticeWord(w);
                        void sayText(cleanW || w);
                      }}
                      className="rounded-xl px-2 transition-colors duration-75"
                      style={{
                        background: isFilledTarget
                          ? 'rgba(13, 148, 136, 0.2)'
                          : isCurrent
                            ? 'rgba(242, 169, 59, 0.38)'
                            : isReadDone
                              ? 'rgba(13, 148, 136, 0.10)'
                              : 'transparent',
                        borderBottom: isCurrent ? '3px solid #D97706' : '3px solid transparent',
                        opacity: isDimmed ? 0.3 : 1,
                        color: surface.ink,
                      }}
                    >
                      {w}
                    </button>
                  );
                })}
              </p>

              {/* CLEAN SYLLABLE HELPER BAR (Appears ONLY when child asks for syllable decoding) */}
              {activeHelperKey && activeHelperSyllables && (
                <div
                  className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white/95 px-4 py-2.5 text-slate-900"
                  data-syllable-helper
                >
                  <span className="text-xs font-black text-amber-900">مقاطع «{activeHelperKey}»:</span>
                  {activeHelperSyllables.map((syl, k) => {
                    const isClapLit = clappingWord === activeHelperKey && clapSylIdx === k;
                    return (
                      <span
                        key={k}
                        className={`rounded-xl border px-2.5 py-0.5 text-xl font-bold transition-all duration-200 ${
                          isClapLit
                            ? 'scale-115 border-amber-500 bg-amber-300 text-slate-950 shadow-xs'
                            : 'border-amber-300 bg-amber-50 text-slate-900'
                        }`}
                        style={{ fontFamily: 'var(--font-reading)' }}
                      >
                        {syl}
                      </span>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => void sayText(activeHelperKey)}
                    className="rounded-full bg-teal-50 p-1.5 text-teal-800 hover:bg-teal-100"
                    aria-label={`استمع لكلمة ${activeHelperKey}`}
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClapSyllables(activeHelperKey, activeHelperSyllables)}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-950 hover:bg-amber-200"
                    aria-label={`دق مقاطع ${activeHelperKey}`}
                  >
                    <span>🥁</span>
                    <span>دقّ المقاطع</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHelpWord(null)}
                    className="rounded-full p-1 text-slate-400 hover:text-slate-700"
                    aria-label="إغلاق المقاطع"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* STEP 3: ORTHOGRAPHIC WORD DECODING OPTIONS (Directly below sentence) */}
              {step === 'decode' && (
                <div className="mt-5 space-y-3" data-decode-panel>
                  <div className="grid grid-cols-3 gap-2.5">
                    {decodeOptions.map((opt) => {
                      const right = opt === page.check.targetWord;
                      const pickedThis = decodeChoice === opt;
                      const cls = !decodeAnswered
                        ? 'border-slate-200 bg-white hover:border-teal-500 text-slate-900'
                        : right
                          ? 'border-teal-600 bg-teal-50 text-teal-950'
                          : pickedThis
                            ? 'border-rose-400 bg-rose-50 text-rose-900'
                            : 'border-slate-200 bg-white opacity-50';
                      return (
                        <button
                          key={opt}
                          type="button"
                          data-decode-option={right ? 'right' : 'wrong'}
                          disabled={decodeAnswered}
                          onClick={() => {
                            setDecodeChoice(opt);
                            setDecodeScore((s) => ({
                              right: s.right + (right ? 1 : 0),
                              total: s.total + 1,
                            }));
                            if (!right) recordPracticeWord(page.check.targetWord);
                            void sayText(page.check.targetWord);
                          }}
                          className={`rounded-2xl border-2 py-2.5 px-2 text-center text-2xl sm:text-3xl font-bold transition ${cls}`}
                          style={{ fontFamily: 'var(--font-reading)' }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {decodeAnswered && (
                    <p
                      className={`text-center text-sm font-bold ${
                        decodeChoice === page.check.targetWord ? 'text-teal-800' : 'text-amber-900'
                      }`}
                    >
                      {decodeChoice === page.check.targetWord
                        ? `أحسنت! الكلمة الصحيحة هي «${page.check.targetWord}».`
                        : `الكلمة الصحيحة هي «${page.check.targetWord}». لاحظ الحروف والحركات جيدًا.`}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* PRIMARY ACTION BAR (Directly visible above fold on 1366x768) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1" data-story-action>
              {/* Back page button */}
              <button
                type="button"
                className="bz-btn bz-btn-ghost bz-btn-sm"
                disabled={pageIdx === 0}
                onClick={() => resetForPage(Math.max(0, pageIdx - 1))}
              >
                <ArrowRight className="h-4 w-4" />
                <span>الصفحة السابقة</span>
              </button>

              {/* Context action controls */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {support === 'guided' && step === 'listen' && (
                  <>
                    <button
                      type="button"
                      className="bz-btn bz-btn-secondary"
                      onClick={() => (playing ? stopAll() : void listenAndTrackPage())}
                    >
                      {playing ? <Square className="h-4 w-4 text-rose-600" /> : <Volume2 className="h-4 w-4 text-teal-700" />}
                      <span>{playing ? 'إيقاف' : 'استمع وتتبّع'}</span>
                    </button>
                    <button
                      type="button"
                      data-story-step-next
                      onClick={() => {
                        stopAll();
                        setStep('pointer');
                        setCursor(0);
                      }}
                      className="bz-btn bz-btn-primary"
                    >
                      <span>ابدأ القراءة كلمةً بكلمة</span>
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  </>
                )}

                {support === 'guided' && step === 'pointer' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const target = currentWordClean || words[cursor];
                        setHelpWord(target);
                        recordPracticeWord(target);
                        void sayText(target);
                      }}
                      className="bz-btn bz-btn-secondary bz-btn-sm"
                    >
                      <Puzzle className="h-4 w-4 text-amber-700" />
                      <span>تهجّأ الكلمة</span>
                    </button>

                    {hasSpeechRec && (
                      <button
                        type="button"
                        onClick={toggleMicReading}
                        className={`bz-btn bz-btn-sm ${
                          micListening ? 'bz-btn-sun' : 'bz-btn-secondary'
                        }`}
                      >
                        <Mic className="h-4 w-4" />
                        <span>{micListening ? 'أوقف الميكروفون' : 'اقرأ بصوتك'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      data-story-step-next
                      onClick={advancePointerWord}
                      className="bz-btn bz-btn-primary"
                    >
                      <span>
                        {cursor < words.length - 1 ? 'قرأتها — التالية' : 'أنهيت الجملة ← ميّز الكلمة'}
                      </span>
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  </>
                )}

                {support === 'guided' && step === 'decode' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void sayText(page.check.targetWord)}
                      className="bz-btn bz-btn-secondary bz-btn-sm"
                    >
                      <Volume2 className="h-4 w-4 text-teal-700" />
                      <span>استمع للكلمة المطلوبة</span>
                    </button>
                    {decodeAnswered && (
                      <button
                        type="button"
                        data-story-step-next
                        onClick={advanceFromPage}
                        className="bz-btn bz-btn-primary"
                      >
                        <span>
                          {pageIdx + 1 < story.pages.length ? 'الصفحة التالية' : 'إلى ترتيب الأحداث'}
                        </span>
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}

                {support === 'independent' && (
                  <>
                    <button
                      type="button"
                      onClick={() => (playing ? stopAll() : void listenAndTrackPage())}
                      className="bz-btn bz-btn-secondary"
                    >
                      <Volume2 className="h-4 w-4 text-teal-700" />
                      <span>{playing ? 'إيقاف' : 'استمع للصفحة'}</span>
                    </button>
                    <button
                      type="button"
                      data-story-step-next
                      onClick={advanceFromPage}
                      className="bz-btn bz-btn-primary"
                    >
                      <span>
                        {pageIdx + 1 < story.pages.length ? 'الصفحة التالية' : 'إلى ترتيب الأحداث'}
                      </span>
                      <Check className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {micFeedback && (
              <p className="text-center text-xs font-bold text-teal-800">{micFeedback}</p>
            )}

            <MirrorVoiceRecorder
              targetText={page.text}
              labelAr="🎙️ سجّل قراءتك للجملة واسمعها بجانب المعلّمة"
              compact
              onSpeakTeacher={(txt) => sayText(txt)}
            />
          </div>

          {/* CALM HAND-DRAWN ILLUSTRATION FRAME WITH MAGIC VOICE COLORING & LIVING STORYBOOK (5 columns) */}
          <div className="lg:col-span-5 flex flex-col items-center gap-2.5">
            <div
              className={`relative w-full max-w-md overflow-hidden rounded-2xl border-2 bg-white p-2 shadow-xs transition-all duration-700 ${
                isLivingIllustration
                  ? 'border-amber-400 shadow-lg ring-4 ring-amber-200/60'
                  : 'border-[#E5DEC9]'
              }`}
            >
              {isLivingIllustration && (
                <span className="absolute top-3.5 left-3.5 z-10 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-3 py-1 text-[11px] font-black text-white shadow-sm animate-bounce">
                  ✨ لوحة حيّة مكتملة!
                </span>
              )}
              <div
                className="overflow-hidden rounded-xl"
                style={{
                  filter: `grayscale(${Math.round((1 - colorProgress) * 82)}%) sepia(${Math.round(
                    (1 - colorProgress) * 24,
                  )}%) saturate(${(0.35 + colorProgress * 0.78).toFixed(2)})`,
                  transform: isLivingIllustration ? 'scale(1.03)' : 'scale(1)',
                  transition: 'filter 600ms ease, transform 1100ms ease',
                }}
              >
                {page.imageUrl ? (
                  <img
                    src={page.imageUrl}
                    alt={`لوحة الصفحة ${toArabicNum(page.pageNumber)} من ${story.title}`}
                    className="aspect-video w-full max-h-[260px] rounded-xl object-cover"
                  />
                ) : page.sketchId ? (
                  <HandDrawnSketchScene
                    scene={page.sketchId}
                    className="aspect-video w-full max-h-[260px] rounded-xl"
                  />
                ) : null}
              </div>
            </div>

            {/* Progressive Watercolor Blooming Meter */}
            <div className="w-full max-w-md rounded-2xl border border-[#E5DEC9] bg-white/90 px-3.5 py-2 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-black text-slate-700 mb-1">
                <span>🎨 تلوين اللوحة بالقراءة</span>
                <span className={isLivingIllustration ? 'text-amber-700' : 'text-teal-800'}>
                  {toArabicNum(Math.round(colorProgress * 100))}٪
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-amber-400 via-teal-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.round(colorProgress * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
