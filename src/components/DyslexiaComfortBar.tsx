import React, { useState, useEffect } from 'react';
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
  home: 'مرحبًا بك في بصيرة. اختر نشاطًا للقراءة أو الحساب، وخذ وقتك في التعلّم. يمكنك الاستماع إلى الكلمات وتغيير حجم النص والمسافات متى احتجت.',
  dashboard:
    'أنت في لوحة التحليل والمتابعة الذكية. يمكنك مراجعة مؤشرات الجلسة ونتائج الفهم والتحليل الصوتي وخطة التطوير المقترحة بالذكاء الاصطناعي.',
  'cognitive-lab':
    'أنت في مساحة الفرز المعرفي. تتضمن الأنشطة تسمية سريعة وقراءة كلمات غير حقيقية ومهام وعي صوتي؛ نتائجها ملاحظات تعليمية وليست تشخيصًا.',
  'reading-lab':
    'أنت في مساحة القراءة والفهم. اختر نصًا مناسبًا، واقرأ بهدوء، ثم أجب عن أسئلة الفهم. يمكن إجراء القراءة الصامتة أو الجهرية بحسب خيارات الجلسة.',
  'dyslexia-lab':
    'أنت في مساحة القراءة الذكية والتشخيص المعرفي الشامل.',
  'dyscalculia-lab':
    'أنت في مغامرة الأعداد. جرّب مهام إدراك الكميات وخط الأعداد والتحويل بين الأرقام لمتابعة تقدمك الذاتي بدقة.',
  'remediation-gym':
    'أنت في مساحة التدريب. جرّب تمييز الحروف وتركيب المقاطع ومهام خط الأعداد. هذه أنشطة تعليمية عامة وليست تشخيصًا أو علاجًا معتمدًا.',
  'adaptive-reader':
    'أنت في القارئ الميسّر. يمكنك تغيير حجم الخط والتباعد، وتقسيم الكلمات إلى مقاطع، والاستماع إلى نطقها. هذه أدوات مساعدة وليست اختبارًا تشخيصيًا.',
  'adaptive-reports':
    'أنت الآن في التقارير الذكية التكيفية وخطة المساندة التربوية الفردية.',
  sprint:
    'أنت في تدريب سبرنت الـ ٥ دقائق المكثف لتنمية الطلاقة وسرعة القراءة.',
  storygen:
    'أنت في مصنع القصص التفاعلية المشكولة بالذكاء الاصطناعي.',
  iep:
    'أنت في خطة المساندة التربوية الفردية الذكية.',
  trophies:
    'أنت في خزانة الكؤوس والأوسمة وبطولات القراءة والحساب.',
  privacy:
    'أنت في سياسة الخصوصية. راجع البيانات التي قد تُعالج وخيارات الصوت وحقوق ولي الأمر قبل استخدام المنصة.',
  terms:
    'أنت في شروط استخدام بصيرة وإرشادات الاستخدام التعليمي.'
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
      {/* Compact Floating Accessibility & Night Mode Widget (Bottom-Left) */}
      <div
        className="baseera-comfort-dock fixed bottom-5 left-5 z-40 flex flex-col items-end gap-2.5"
        dir="rtl"
      >
        {/* Popover Panel (Only rendered when user clicks the floating button) */}
        {isOpen && (
          <div
            role="dialog"
            aria-label="إعدادات القراءة والراحة البصرية"
            className="w-[320px] sm:w-[350px] bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-4 text-xs animate-fade-slide-up"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Sliders className="w-4 h-4 text-[#0284C7]" />
                <span>خيارات القراءة والمظهر</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="إغلاق قائمة خيارات القراءة"
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Surface Theme Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Palette className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>لون الخلفية والوضع الليلي:</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'cream', label: 'ورق دافئ', swatch: 'bg-[#FAF6EE] border-amber-300' },
                    { id: 'sage', label: 'نعناع هادئ', swatch: 'bg-[#EFF7F3] border-emerald-300' },
                    { id: 'sky', label: 'سماء صافية', swatch: 'bg-[#EFF6FF] border-sky-300' },
                    { id: 'night', label: 'ليلي مريح', swatch: 'bg-[#0F172A] border-slate-500' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChangeSurfaceTheme(t.id)}
                    aria-pressed={surfaceTheme === t.id}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-2 cursor-pointer ${
                      surfaceTheme === t.id
                        ? 'bg-[#0284C7] text-white border-[#0284C7]'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full border shrink-0 ${t.swatch}`}
                      aria-hidden="true"
                    />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Font & Spacing Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Type className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>حجم الخط وتباعد الكلمات:</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'standard', label: 'مريح افتراضي' },
                    { id: 'expanded', label: 'موسّع لعسر القراءة' },
                    { id: 'xl', label: 'كبير جداً' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeSpacingMode(m.id)}
                    aria-pressed={spacingMode === m.id}
                    className={`px-2 py-2 text-[11px] font-semibold rounded-xl border transition-colors text-center cursor-pointer ${
                      spacingMode === m.id
                        ? 'bg-[#0284C7] text-white border-[#0284C7]'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Reading Focus Ruler & Audio Assist */}
            <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
              <button
                type="button"
                onClick={onToggleReadingRuler}
                aria-pressed={readingRulerEnabled}
                className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-between cursor-pointer ${
                  readingRulerEnabled
                    ? 'bg-amber-500 text-slate-950 border-amber-600'
                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" />
                  <span>
                    {readingRulerEnabled
                      ? 'مسطرة التركيز البصري: مفعّلة'
                      : 'تفعيل مسطرة التركيز البصري'}
                  </span>
                </span>
                <span className="text-[10px] font-mono">
                  {readingRulerEnabled ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleSpeech}
                aria-pressed={isSpeaking}
                className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                  isSpeaking
                    ? 'bg-[#0284C7] text-white border-[#0284C7]'
                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                }`}
              >
                {isSpeaking ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>إيقاف القراءة الصوتية</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>استمع لشرح الشاشة صوتياً</span>
                  </>
                )}
              </button>

              {isCustomized && (
                <button
                  type="button"
                  onClick={() => {
                    onChangeSurfaceTheme('cream');
                    onChangeSpacingMode('standard');
                    if (readingRulerEnabled) onToggleReadingRuler();
                  }}
                  className="w-full py-1.5 text-[11px] text-slate-500 hover:text-slate-900 underline cursor-pointer inline-flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>إعادة الضبط للوضع الافتراضي</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sleek Non-Obtrusive Floating Widget (40px compact pill that expands without covering child games) */}
        <div className="flex items-center gap-1 p-1 bg-white/90 backdrop-blur-md border-2 border-slate-200 rounded-full shadow-md hover:shadow-lg transition-all">
          {/* Quick Toggle / Open Menu */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            title={isOpen ? 'إغلاق خيارات العرض والقراءة' : 'فتح خيارات العرض والقراءة والوضع الليلي'}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isOpen || isCustomized
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-800 text-white hover:bg-emerald-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {['reading-lab', 'dyslexia-lab', 'adaptive-reader'].includes(activeTab) ? 'خيارات القراءة' : 'راحة العرض'}
            </span>
          </button>

          {/* Quick 1-Click Night / Paper Toggle */}
          <button
            type="button"
            onClick={() => onChangeSurfaceTheme(isNight ? 'cream' : 'night')}
            aria-pressed={isNight}
            title={isNight ? 'التبديل للوضع النهاري الدافئ' : 'التبديل للوضع الليلي المريح'}
            className="p-1.5 rounded-full text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {isNight ? (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-700" />
            )}
          </button>

          {/* Quick Audio Read-Aloud Button */}
          <button
            type="button"
            onClick={handleToggleSpeech}
            aria-pressed={isSpeaking}
            title="استمع لشرح الشاشة صوتياً"
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isSpeaking
                ? 'bg-emerald-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isSpeaking ? (
              <Square className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
            )}
          </button>
        </div>
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
            className="w-full h-[84px] border-y-2 border-[#0284C7] bg-amber-200/15 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)] transition-transform duration-75 ease-out"
          >
            <div className="max-w-[1360px] mx-auto px-6 h-full flex items-center justify-end">
              <span className="px-2 py-0.5 rounded bg-[#0F172A]/85 text-amber-300 text-[10px] font-mono">
                مسطرة التركيز البصري النشطة
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
