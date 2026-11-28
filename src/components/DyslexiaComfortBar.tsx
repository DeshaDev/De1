import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
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
import { playNaturalArabicAudio, stopNaturalArabicAudio } from '../utils/naturalSpeech';

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
  home: 'مرحبًا بك في هَيَّا نَقْرَأْ، منصة تعلّم اللغة العربية وتأسيس القراءة ودعم صعوبات القراءة. اختر التأسيس والحروف، أو المكتبة المصوّرة، أو الفحص التدريبي المتخصص.',
  dashboard:
    'أنت في لوحة التحليل والمتابعة. راجع نتائج الجلسة ومؤشرات القراءة والفهم، ثم اختر نشاطًا تعليميًا مناسبًا للمتابعة.',
  'cognitive-lab':
    'أنت في مساحة الفرز المعرفي. تتضمن الأنشطة تسمية سريعة وقراءة كلمات غير حقيقية ومهام وعي صوتي؛ نتائجها ملاحظات تعليمية وليست تشخيصًا.',
  'reading-lab':
    'أنت في مساحة القراءة والفهم. اختر نصًا مناسبًا، واقرأ بهدوء، ثم أجب عن أسئلة الفهم. يمكن إجراء القراءة الصامتة أو الجهرية بحسب خيارات الجلسة.',
  'dyslexia-lab':
    'أنت في فحص مؤشرات عسر القراءة. ألعاب قصيرة في الذاكرة والوعي الصوتي والتمييز ومعرفة الحروف والتسمية السريعة، ومن السادسة قراءة كلمات وقصة وإملاء، ثم يظهر تقرير بأداء الطفل في كل مهمة.',
  'parent-portal':
    'أنت في صفحة ولي الأمر. سجّل طفلك، ثم ابدأ فحص مؤشرات عسر القراءة، وبعده البرنامج التدريبي المبني على نتيجته.',
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
    'أنت في شروط استخدام هَيَّا نَقْرَأْ وإرشادات الاستخدام التعليمي.',
  'audio-lab':
    'أنت في مختبر مقارنة التقييم الصوتي بين Azure و Google. سجل صوتك أو ارفع ملفًا لمقارنة سرعة ودقة التقييم بين المحركين.',
  'content-review':
    'أنت في صفحة مراجعة المحتوى قبل الإطلاق، وهي مخصصة للمراجع المتخصص.',
  'literacy-studio':
    'أنت في استوديو تعلّم اللغة العربية وتأسيس القراءة. تدرّب على الحروف الرملية، وصيد البالونات الصوتية، والأبجدية المتحركة، ومختبر الإملاء والقواعد، والقصص المرسومة.',
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
  const reducedMotion = useReducedMotion();
  const rulerTopMV = useMotionValue(Math.max(60, 280 - 42));
  const rulerTopSpring = useSpring(rulerTopMV, { stiffness: 360, damping: 34, mass: 0.55 });

  useEffect(() => {
    stopNaturalArabicAudio();
    setIsSpeaking(false);
  }, [activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    const onDocDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', onDocDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDocDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!readingRulerEnabled) return;
    const clampY = (y: number) => Math.max(84, Math.min((window.innerHeight || 900) - 64, y));
    const applyY = (nextY: number) => {
      const clamped = clampY(nextY);
      const top = Math.max(60, clamped - 42);
      setRulerY(clamped);
      if (reducedMotion) {
        rulerTopMV.jump(top);
        rulerTopSpring.jump(top);
      } else {
        rulerTopMV.set(top);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      applyY(e.clientY);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setRulerY((prev) => {
          const clamped = clampY(prev + 28);
          const top = Math.max(60, clamped - 42);
          if (reducedMotion) {
            rulerTopMV.jump(top);
            rulerTopSpring.jump(top);
          } else {
            rulerTopMV.set(top);
          }
          return clamped;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setRulerY((prev) => {
          const clamped = clampY(prev - 28);
          const top = Math.max(60, clamped - 42);
          if (reducedMotion) {
            rulerTopMV.jump(top);
            rulerTopSpring.jump(top);
          } else {
            rulerTopMV.set(top);
          }
          return clamped;
        });
      }
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [readingRulerEnabled, reducedMotion, rulerTopMV, rulerTopSpring]);

  const handleToggleSpeech = () => {
    if (isSpeaking) {
      stopNaturalArabicAudio();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = TAB_AUDIO_SUMMARIES[activeTab] || TAB_AUDIO_SUMMARIES.home;
    setIsSpeaking(true);

    playNaturalArabicAudio(textToSpeak, {
      voice: 'ar-AE-FatimaNeural', rate: '0%', pitch: '0%',
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    }).catch(() => setIsSpeaking(false));
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

        <AnimatePresence>
          {isOpen && (
            <motion.div
              role="dialog"
              aria-label="خيارات القراءة والعرض"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: 0.97, y: -4 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="bz-comfort-panel"
            >
              <div className="flex items-center justify-between">
              <h2>خيارات القراءة والعرض</h2>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="إغلاق" className="bz-icon-btn" style={{ width: 44, height: 44, minHeight: 44 }}>
                <X className="w-4 h-4" aria-hidden="true" />
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
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Compositor-Only Interactive Reading Focus Ruler Overlay */}
      {readingRulerEnabled && (
        <div
          className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
          aria-hidden="true"
          data-testid="global-reading-ruler"
          data-ruler-y={rulerY}
        >
          <motion.div
            style={{
              y: reducedMotion ? rulerTopMV : rulerTopSpring,
            }}
            className="w-full h-[84px] border-y-2 border-brand bg-sun/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)]"
          >
            <div className="max-w-[1360px] mx-auto px-6 h-full flex items-center justify-end">
              <span className="px-2.5 py-0.5 rounded bg-[#0F172A]/90 text-amber-300 text-xs font-bold">
                مسطرة التركيز (تحرك بالمؤشر أو الأسهم)
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};
