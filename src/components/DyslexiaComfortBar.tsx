import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Square,
  Eye,
  Type,
  Palette,
  RotateCcw,
  Moon,
  Sun,
  Sliders,
  X,
  ALargeSmall,
} from 'lucide-react';
import { AppTabId } from './HomeLandingView';

export type DyslexiaSurfaceTheme = 'cream' | 'sage' | 'sky' | 'night' | 'lab';
export type DyslexiaSpacingMode = 'standard' | 'expanded' | 'xl';

interface DyslexiaComfortBarProps {
  activeTab: AppTabId;
  surfaceTheme: DyslexiaSurfaceTheme;
  onChangeSurfaceTheme: (theme: DyslexiaSurfaceTheme) => void;
  spacingMode: DyslexiaSpacingMode;
  onChangeSpacingMode: (mode: DyslexiaSpacingMode) => void;
  readingRulerEnabled: boolean;
  onToggleReadingRuler: () => void;
}

const TAB_AUDIO_SUMMARIES: Record<AppTabId, string> = {
  home: 'مرحبًا بك في بصيرة. اختر نشاطًا للقراءة والطلاقة اللغوية، وخذ وقتك في التعلّم. يمكنك الاستماع إلى الكلمات وتغيير حجم النص والمسافات متى احتجت.',
  dashboard:
    'أنت في لوحة التحليل والمتابعة. راجع نتائج الجلسة ومؤشرات القراءة والفهم، ثم اختر نشاطًا تعليميًا مناسبًا للمتابعة.',
  'cognitive-lab':
    'أنت في مساحة الفرز المعرفي. تتضمن الأنشطة تسمية سريعة وقراءة كلمات غير حقيقية ومهام وعي صوتي؛ نتائجها ملاحظات تعليمية وليست تشخيصًا.',
  'reading-lab':
    'أنت في مساحة القراءة والفهم. اختر نصًا مناسبًا، واقرأ بهدوء، ثم أجب عن أسئلة الفهم. يمكن إجراء القراءة الصامتة أو الجهرية بحسب خيارات الجلسة.',
  'dyslexia-lab':
    'أنت في الفحص المعرفي الشامل. تسع ألعاب قصيرة ترسم ملف الطفل في الذاكرة والوعي الصوتي والتمييز ومعرفة الحروف، ثم يظهر تقرير بنقاط القوة والضعف.',
  'guided-program':
    'أنت في البرنامج التدريبي الموجّه. تمارين يومية قصيرة تركّز على المهارات الأضعف في فحص الطفل، وتتقدم مستوى بعد مستوى عند الإتقان.',
  'remediation-gym':
    'أنت في مساحة التدريب. جرّب تمييز الحروف وتركيب المقاطع وقراءة النصوص. هذه أنشطة تعليمية عامة وليست تشخيصًا أو علاجًا معتمدًا.',
  'adaptive-reader':
    'أنت في القارئ الميسّر. يمكنك تغيير حجم الخط والتباعد، وتقسيم الكلمات إلى مقاطع، والاستماع إلى نطقها. هذه أدوات مساعدة وليست اختبارًا تشخيصيًا.',
  sprint:
    'أنت في تحدي الدقائق الخمس لتنمية طلاقة القراءة.',
  storygen:
    'أنت في القصص القصيرة المشكولة؛ تُولَّد آليًا ويُستحسن أن يراجعها البالغ قبل القراءة.',
  privacy:
    'أنت في سياسة الخصوصية. راجع البيانات التي قد تُعالج وخيارات الصوت وحقوق ولي الأمر قبل استخدام المنصة.',
  terms:
    'أنت في شروط استخدام بصيرة وإرشادات الاستخدام التعليمي.',
  'content-review':
    'أنت في صفحة مراجعة المحتوى قبل الإطلاق، وهي مخصصة للمراجع المتخصص.'
};

export const DyslexiaComfortBar: React.FC<DyslexiaComfortBarProps> = ({
  activeTab,
  surfaceTheme,
  onChangeSurfaceTheme,
  spacingMode,
  onChangeSpacingMode,
  readingRulerEnabled,
  onToggleReadingRuler,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rulerY, setRulerY] = useState<number>(280);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  // Track mouse/touch Y position for the compositor-accelerated Reading Focus Ruler
  useEffect(() => {
    if (!readingRulerEnabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      setRulerY(e.clientY);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        setRulerY(e.touches[0].clientY);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [readingRulerEnabled]);

  // Stop speech when tab changes
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [activeTab]);

  const handleToggleSpeech = () => {
    if (isSpeaking) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = TAB_AUDIO_SUMMARIES[activeTab] || TAB_AUDIO_SUMMARIES.home;
    setIsSpeaking(true);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.92;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setTimeout(() => setIsSpeaking(false), 4500);
      }
    } else {
      setTimeout(() => setIsSpeaking(false), 4500);
    }
  };

  const isCustomized =
    surfaceTheme !== 'cream' ||
    spacingMode !== 'standard' ||
    readingRulerEnabled;

  const isNight = surfaceTheme === 'night';

  return (
    <>
      <div className="bz-comfort" ref={rootRef} dir="rtl">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label="خيارات القراءة والعرض"
          title="خيارات القراءة والعرض"
          className="bz-icon-btn"
        >
          <ALargeSmall className="w-5 h-5" aria-hidden="true" />
          {isCustomized && (
            <span aria-hidden="true" style={{ position: 'absolute', top: 6, insetInlineEnd: 6, width: 8, height: 8, borderRadius: 99, background: 'var(--sun)' }} />
          )}
        </button>

        {isOpen && (
          <div role="dialog" aria-label="خيارات القراءة والعرض" className="bz-comfort-panel animate-fade-slide-up">
            <div className="flex items-center justify-between">
              <h2>خيارات القراءة والعرض</h2>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="إغلاق" className="bz-icon-btn" style={{ width: 34, height: 34, minHeight: 34 }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bz-comfort-group">
              <span>لون الخلفية</span>
              <div className="bz-option-grid">
                {(
                  [
                    { id: 'cream', label: 'ورق دافئ', swatch: '#F7F5F0' },
                    { id: 'sage', label: 'أخضر هادئ', swatch: '#E6EFE8' },
                    { id: 'sky', label: 'أزرق فاتح', swatch: '#E7EEF7' },
                    { id: 'night', label: 'وضع ليلي', swatch: '#152131' },
                  ] as const
                ).map((t) => (
                  <button key={t.id} type="button" onClick={() => onChangeSurfaceTheme(t.id)} aria-pressed={surfaceTheme === t.id} className="bz-option">
                    <span className="bz-swatch" style={{ background: t.swatch }} aria-hidden="true" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bz-comfort-group">
              <span>حجم النص والمسافات</span>
              <div className="bz-option-grid cols-3">
                {(
                  [
                    { id: 'standard', label: 'عادي' },
                    { id: 'expanded', label: 'متباعد' },
                    { id: 'xl', label: 'كبير' },
                  ] as const
                ).map((m) => (
                  <button key={m.id} type="button" onClick={() => onChangeSpacingMode(m.id)} aria-pressed={spacingMode === m.id} className="bz-option">
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bz-comfort-group">
              <button type="button" onClick={onToggleReadingRuler} aria-pressed={readingRulerEnabled} className="bz-option" style={{ justifyContent: 'space-between' }}>
                <span className="inline-flex items-center gap-2"><Eye className="w-4 h-4" /> مسطرة تركيز القراءة</span>
                <span className="bz-small">{readingRulerEnabled ? 'مفعّلة' : 'متوقفة'}</span>
              </button>
              <button type="button" onClick={handleToggleSpeech} aria-pressed={isSpeaking} className="bz-option">
                {isSpeaking ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
                {isSpeaking ? 'إيقاف الاستماع' : 'استمع لشرح هذه الصفحة'}
              </button>
              <button type="button" onClick={() => onChangeSurfaceTheme(isNight ? 'cream' : 'night')} aria-pressed={isNight} className="bz-option">
                {isNight ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isNight ? 'العودة إلى الوضع النهاري' : 'الوضع الليلي'}
              </button>
            </div>

            {isCustomized && (
              <button
                type="button"
                onClick={() => {
                  onChangeSurfaceTheme('cream');
                  onChangeSpacingMode('standard');
                  if (readingRulerEnabled) onToggleReadingRuler();
                }}
                className="bz-link justify-center bz-small"
              >
                <RotateCcw className="w-3.5 h-3.5" /> إعادة الإعدادات الافتراضية
              </button>
            )}
          </div>
        )}
      </div>

      {/* Compositor-Only Interactive Reading Focus Ruler Overlay */}
      {readingRulerEnabled && (
        <div
          className="fixed inset-0 pointer-events-none z-50 overflow-hidden animate-fade-slide-up"
          aria-hidden="true"
          data-testid="global-reading-ruler"
        >
          <div
            style={{
              transform: `translate3d(0, ${Math.max(60, rulerY - 42)}px, 0)`,
            }}
            className="w-full h-[84px] border-y-2 border-brand bg-sun/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)] transition-transform duration-75 ease-out"
          >
            <div className="max-w-[1360px] mx-auto px-6 h-full flex items-center justify-end">
              <span className="px-2 py-0.5 rounded bg-[#0F172A]/85 text-amber-300 text-[10px] font-mono">
                مسطرة التركيز
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
