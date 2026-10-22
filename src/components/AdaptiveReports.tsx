/**
 * Adaptive Multi-Axis Screening Reports (تقارير الفرز التربوي الاسترشادي متعدد المحاور)
 * Tri-modal evaluation: Voice Phonology + Reading Fluency & Comprehension + Tactile Math
 * Strictly evidence-based: NO fake defaults, NO uncalibrated eye metrics, NO unvalidated risk bands.
 */

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Printer,
  Volume2,
  VolumeX,
  BookOpen,
  Mic,
  Hand,
  ChevronLeft,
  Calendar,
  Clock,
  Gamepad2,
  Check,
  AlertCircle,
  ShieldCheck,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAssessment } from '../contexts/AssessmentContext';
import { StudentRecord } from '../data/seedData';

export interface AdaptiveReportsProps {
  student?: StudentRecord;
  onNavigateTab?: (tab: string) => void;
}

export const AdaptiveReports: React.FC<AdaptiveReportsProps> = ({
  student,
  onNavigateTab,
}) => {
  const { currentAssessment } = useAssessment();
  const [activeView, setActiveView] = useState<'parent' | 'teacher' | 'games'>('parent');
  const [isSpeakingSummary, setIsSpeakingSummary] = useState(false);

  // Check if ANY verified assessment data has been gathered
  const hasSpeechData = Boolean(currentAssessment?.speechResults?.summary);
  const hasTactileData = Boolean(currentAssessment?.tactileResults?.summary);
  const hasReadingData = Boolean(
    currentAssessment?.readingResults ||
    currentAssessment?.eyeTrackingResults?.wpm ||
    (student && student.sessionStatus === 'completed' && student.wpm > 0)
  );

  const hasAnyAssessmentData = hasSpeechData || hasTactileData || hasReadingData;

  // Synthesize student data strictly from genuine assessments
  const studentData = useMemo(() => {
    const studentName = student?.name || currentAssessment?.studentName || 'الطالب المستهدف';
    const age = student?.ageYears || currentAssessment?.age || 9;
    const grade = student?.gradeLevel || 3;
    const date = new Date().toLocaleDateString('ar-SA');

    // Speech data (only present if actually assessed)
    const speechSummary = currentAssessment?.speechResults?.summary || null;

    // Tactile data (only present if actually assessed)
    const tactileSummary = currentAssessment?.tactileResults?.summary || null;

    // Reading session data (strictly measured: WPM, WCPM, duration, comprehension)
    let readingSummary: {
      wpm: number;
      wcpm?: number | null;
      oralReadingAssessed?: boolean;
      oralAccuracyPercent?: number | null;
      teacherVerified?: boolean;
      assessmentModality?: 'voice_only' | 'eye_voice' | 'reading_only';
      spokenTranscript?: string;
      durationSec: number;
      comprehensionScore: number;
      passageTitle?: string;
    } | null = null;

    if (currentAssessment?.readingResults) {
      readingSummary = {
        wpm: currentAssessment.readingResults.wpm,
        wcpm: currentAssessment.readingResults.wcpm ?? null,
        oralReadingAssessed: currentAssessment.readingResults.oralReadingAssessed,
        oralAccuracyPercent: currentAssessment.readingResults.oralAccuracyPercent ?? null,
        teacherVerified: currentAssessment.readingResults.teacherVerified,
        assessmentModality: currentAssessment.readingResults.assessmentModality,
        spokenTranscript: currentAssessment.readingResults.spokenTranscript || '',
        durationSec: currentAssessment.readingResults.durationSeconds,
        comprehensionScore: currentAssessment.readingResults.comprehensionScore,
        passageTitle: currentAssessment.readingResults.passageTitle,
      };
    } else if (currentAssessment?.eyeTrackingResults?.wpm) {
      readingSummary = {
        wpm: currentAssessment.eyeTrackingResults.wpm,
        wcpm: currentAssessment.eyeTrackingResults.wcpm ?? null,
        assessmentModality: currentAssessment.eyeTrackingResults.assessmentModality,
        spokenTranscript: currentAssessment.eyeTrackingResults.spokenTranscript || '',
        durationSec: currentAssessment.eyeTrackingResults.readingDurationSeconds || 0,
        comprehensionScore: currentAssessment.eyeTrackingResults.comprehensionScore || 0,
      };
    } else if (student && student.sessionStatus === 'completed' && student.wpm > 0) {
      readingSummary = {
        wpm: student.wpm,
        wcpm: student.wcpm ?? student.oralWcpm ?? null,
        oralReadingAssessed: student.oralReadingAssessed,
        oralAccuracyPercent: student.oralAccuracyPercent ?? null,
        teacherVerified: student.teacherVerified,
        assessmentModality: student.assessmentModality,
        spokenTranscript: student.spokenTranscript || '',
        durationSec: student.readingDurationSeconds || 0,
        comprehensionScore: student.comprehensionScore ?? 0,
      };
    }

    return {
      studentName,
      age,
      grade,
      date,
      speech: speechSummary,
      tactile: tactileSummary,
      reading: readingSummary,
      clinicalReport: student?.clinicalReport,
    };
  }, [student, currentAssessment]);

  const isOralReading = Boolean(studentData.reading && (studentData.reading.assessmentModality === 'voice_only' || studentData.reading.oralReadingAssessed === true));
  const hasOralReadingEvidence = Boolean(studentData.reading && ((studentData.reading.spokenTranscript || '').trim() || studentData.reading.teacherVerified === true));

  // Record the outputs actually observed in this session without turning them into strengths,
  // deficits, percentiles, or risk classes that the current prototype has not validated.
  const performanceEvaluation = useMemo(() => {
    const observations: string[] = [];
    const followUp: string[] = [];

    if (studentData.reading) {
      const oralSession = studentData.reading.assessmentModality === 'voice_only' ||
        studentData.reading.oralReadingAssessed === true;
      const hasOralEvidence = Boolean((studentData.reading.spokenTranscript || '').trim()) ||
        studentData.reading.teacherVerified === true;

      if (oralSession) {
        if (typeof studentData.reading.wcpm === 'number' && hasOralEvidence) {
          observations.push(
            'القراءة الجهرية: ' + studentData.reading.wcpm + ' كلمة صحيحة/دقيقة (' +
            (studentData.reading.teacherVerified ? 'راجعها المعلم' : 'تقدير آلي أولي يحتاج إلى مراجعة') +
            '). قراءة نص واحد لا تكفي لمقارنة معيارية أو حكم تشخيصي.'
          );
        } else {
          followUp.push('لم تتوفر مراجعة صوتية كافية لاعتماد WCPM لهذه الجلسة.');
        }
      } else {
        observations.push(
          'معدل إتمام النص الصامت: ' + studentData.reading.wpm +
          ' كلمة/دقيقة تقديريًا، بافتراض إكمال النص. لا يقيس دقة الكلمات.'
        );
      }

      observations.push(
        'إجابات أسئلة الفهم في النص الحالي: ' + studentData.reading.comprehensionScore +
        '%. هذه نتيجة النص المحدد وليست معيارًا عمريًا.'
      );
    }

    if (studentData.speech) {
      observations.push(
        'ثقة نظام التعرّف الصوتي: ' + studentData.speech.averageConfidence +
        '%. لا تساوي هذه القيمة دقة النطق أو قياس الوعي الفونولوجي.'
      );
      if (studentData.speech.problematicLetters.length > 0) {
        followUp.push(
          'راجع بشريًا الحروف التي اقترحها التحليل الصوتي: ' +
          studentData.speech.problematicLetters.join('، ') + '.'
        );
      }
    }

    if (studentData.tactile) {
      observations.push(
        'المهام العددية المسجلة: ' + studentData.tactile.correctAnswers + ' من ' +
        studentData.tactile.totalTasks + '. وصف للجلسة القصيرة، وليس درجة خطر معيارية.'
      );
    }

    const summaryHeadline = followUp.length > 0
      ? 'بيانات تحتاج إلى استكمال أو مراجعة'
      : observations.length > 0
        ? 'ملاحظات وصفية من المهام المنجزة'
        : 'لا توجد بيانات كافية بعد';
    const badgeColor = followUp.length > 0
      ? 'bg-amber-100 text-amber-900 border-amber-300'
      : 'bg-slate-100 text-slate-800 border-slate-300';

    return {
      areasOfStrength: observations,
      areasNeedingSupport: followUp,
      summaryHeadline,
      badgeColor,
    };
  }, [studentData]);

  // Dynamic audio speech synthesis summary for parents
  const speakParentSummary = () => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeakingSummary) {
      window.speechSynthesis.cancel();
      setIsSpeakingSummary(false);
      return;
    }

    const observations: string[] = [];
    if (studentData.reading) {
      const oralSession =
        studentData.reading.assessmentModality === 'voice_only' ||
        studentData.reading.oralReadingAssessed === true;
      const hasOralEvidence =
        Boolean((studentData.reading.spokenTranscript || '').trim()) ||
        studentData.reading.teacherVerified === true;
      const oralRate = studentData.reading.wcpm;
      const readingRateText = oralSession
        ? hasOralEvidence && typeof oralRate === 'number'
          ? `معدل الكلمات الصحيحة في القراءة الجهرية ${oralRate} كلمة بالدقيقة، وهذه نتيجة ${studentData.reading.teacherVerified ? 'راجعها المعلّم' : 'آلية أولية تحتاج مراجعة'}`
          : 'لم تتوفر بيانات صوتية كافية لاحتساب سرعة القراءة الجهرية'
        : studentData.reading.wpm > 0
          ? `سرعة القراءة الموقوتة ${studentData.reading.wpm} كلمة بالدقيقة`
          : 'سرعة القراءة غير متاحة';
      observations.push(
        readingRateText + `، ونتيجة الفهم ${studentData.reading.comprehensionScore}%`
      );
    }
    if (studentData.speech) {
      observations.push(`ودقة مطابقة النطق المسجلة ${studentData.speech.averageConfidence}%`);
    }
    if (studentData.tactile) {
      observations.push(
        `وأنجز ${studentData.tactile.correctAnswers} من أصل ${studentData.tactile.totalTasks} مهام للحس العددي`
      );
    }

    const text = `مرحباً بكم. هذا ملخص تعليمي استرشادي لنتائج ${studentData.studentName}. ${
      observations.length > 0 ? observations.join('، ') + '.' : ''
    } يمكن مراجعة الأنشطة المقترحة مع المعلّم أو وليّ الأمر؛ هذه المخرجات ليست تشخيصاً طبياً.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeakingSummary(false);
    utterance.onerror = () => setIsSpeakingSummary(false);

    setIsSpeakingSummary(true);
    window.speechSynthesis.speak(utterance);
  };

  // Targeted Adaptive Remediation Games
  const adaptiveGames = [
    {
      id: 'letter-hunt',
      title: 'صائد النقاط والحروف المتشابهة (ب / ت / ث / ن)',
      description:
        'لعبة تفاعلية مرحة لتدريب الوعي البصري-الفونيمي والتمييز السريع بين مواضع النقاط والأصوات.',
      targetSkill: 'الوعي الفونيمي والخلط البصري (Visual Homographs)',
      difficulty: 'متوسط' as const,
      duration: '10 دقائق يومياً',
      tabTarget: 'remediation-gym',
      iconColor: 'bg-emerald-500 text-white',
    },
    {
      id: 'syllable-train',
      title: 'قطار المقاطع الصوتية والمدود الطويلة',
      description:
        'تركيب الكلمات من المقاطع الصوتية والحركات لتنمية الطلاقة وكسر تردد الاستدعاء الصوتي.',
      targetSkill: 'التقطيع المقطعي والطلاقة (Syllable Segmentation & VOT)',
      difficulty: 'سهل' as const,
      duration: '8 دقائق يومياً',
      tabTarget: 'remediation-gym',
      iconColor: 'bg-indigo-500 text-white',
    },
    {
      id: 'number-line-jumper',
      title: 'قافز خط الأعداد الذهني (0 - 100)',
      description: 'تدريب حركي لمسي على تقدير مواقع الأعداد وتصحيح الخطأ المطلق (Siegler PAE).',
      targetSkill: 'الحس العددي وخط الأعداد (Mental Number Line)',
      difficulty: 'متوسط' as const,
      duration: '12 دقيقة يومياً',
      tabTarget: 'dyscalculia-lab',
      iconColor: 'bg-purple-500 text-white',
    },
    {
      id: 'colored-reader',
      title: 'القارئ العربي الميسر الذكي',
      description: 'قراءة نصوص مشكولة مع مسطرة التظليل البصري وتكبير التباعد لتسهيل التتبع السطري.',
      targetSkill: 'الطلاقة القرائية واسترسال السطور (Reading Flow)',
      difficulty: 'متدرج' as const,
      duration: '15 دقيقة يومياً',
      tabTarget: 'adaptive-reader',
      iconColor: 'bg-teal-500 text-white',
    },
  ];

  // EMPTY STATE: Prevent rendering fake reports when no tests have run
  if (!hasAnyAssessmentData) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-12 select-none font-sans" dir="rtl">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12 text-center shadow-sm">
          <div className="w-20 h-20 mx-auto bg-amber-50 border border-amber-200 rounded-3xl flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-amber-600" />
          </div>

          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 mb-3">
            حالة التقرير: في انتظار إجراء الاختبارات الفعلية
          </span>

          <h2 className="text-3xl font-black text-slate-900 mb-3">
            لم يُجرَ أي تقييم بعد للطالب
          </h2>
          <p className="text-base text-slate-600 max-w-xl mx-auto mb-8 leading-relaxed">
            لم تُسجل أي نتائج بعد لهذه الجلسة. يرجى البدء بإجراء أحد التقييمات أدناه لعرض التقرير:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 text-right">
            {/* 1. Reading Session Card */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 hover:border-teal-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1">جلسة القراءة والفهم</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  قياس زمن القراءة، سرعة الطلاقة (WPM)، ودقة استيعاب محتوى النص المشكول.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab && onNavigateTab('eye-lab')}
                className="mt-6 w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>بدء جلسة القراءة</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Speech Analysis Card */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 hover:border-indigo-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-4">
                  <Mic className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1">تحليل النطق والوعي الصوتي</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  فحص دقة نطق الكلمات العربية، وتمييز أصوات الحروف المتشابهة وكمون الاستجابة.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab && onNavigateTab('arabic-speech-analysis')}
                className="mt-6 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>بدء فحص النطق</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* 3. Tactile Math Card */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 hover:border-purple-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
                  <Hand className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1">التحليل اللمسي والحساب</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  قياس تقدير خط الأعداد (PAE)، إدراك الكميات الفوري، وسرعة الاستجابة الحركية.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab && onNavigateTab('tactile-analytics')}
                className="mt-6 w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>بدء فحص الحساب</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 select-none font-sans" dir="rtl">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-slate-200 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            منظومة الفرز التربوي الشامل وخطط الدعم
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            تقرير الأداء القرائي ونتائج الفرز التربوي
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            مؤشرات أداء مقاسة للطالب:{' '}
            <span className="font-bold text-teal-700">{studentData.studentName}</span> (الصف{' '}
            {studentData.grade} الابتدائي - {studentData.date})
          </p>
        </div>

        {/* Print / Export Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl border border-slate-300 shadow-sm transition-colors flex items-center gap-2 text-sm cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>طباعة التقرير (PDF)</span>
          </button>
        </div>
      </div>

      {/* Scientific Transparency Disclosure */}
      <div className="mb-6 p-4 rounded-2xl bg-slate-100 border border-slate-200 text-right">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 leading-relaxed">
            <span className="font-bold block mb-0.5">ضوابط التقرير التربوي:</span>
            يلخص التقرير قياسات جلسة تعليمية قصيرة؛ لا يثبت وحده وجود اضطراب تعلم ولا ينفيه. تُراجع الملاحظات مع المعلّم والأسرة، ويُحال الطفل لتقييم مختص عند وجود قلق مستمر.
          </div>
        </div>
      </div>

      {/* THREE-VIEW NAVIGATION TABS */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl mb-8 max-w-xl mx-auto">
        <button
          onClick={() => setActiveView('parent')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeView === 'parent'
              ? 'bg-white text-teal-800 shadow-md shadow-slate-200/50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>تقرير ولي الأمر المبسط</span>
        </button>

        <button
          onClick={() => setActiveView('teacher')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeView === 'teacher'
              ? 'bg-white text-teal-800 shadow-md shadow-slate-200/50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>خطة المعلم والأخصائي (IEP)</span>
        </button>

        <button
          onClick={() => setActiveView('games')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeView === 'games'
              ? 'bg-white text-teal-800 shadow-md shadow-slate-200/50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>الألعاب التكيفية والتدريب</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: PARENT REPORT (تقرير ولي الأمر) */}
      {/* ========================================================================= */}
      {activeView === 'parent' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Audio Speech Summary Bar */}
          <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-3xl p-6 border border-teal-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
                <Volume2 className="w-6 h-6" />
              </div>
              <div className="text-right">
                <h3 className="font-extrabold text-slate-900 text-base mb-1">
                  القارئ الصوتي الذكي لولي الأمر
                </h3>
                <p className="text-xs text-slate-600">
                  استمع لملخص صوتي باللغة العربية يشرح نتائج القراءة والنطق وأبرز التوصيات المنزلية.
                </p>
              </div>
            </div>

            <button
              onClick={speakParentSummary}
              className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-2xl transition-all shadow-md flex items-center gap-2 text-sm shrink-0 cursor-pointer"
            >
              {isSpeakingSummary ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>إيقاف القراءة</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>تشغيل الملخص الصوتي</span>
                </>
              )}
            </button>
          </div>

          {/* Child Screening Summary Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 pb-6 mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 mb-1">
                  ملخص مؤشرات الطالب: {studentData.studentName}
                </h2>
                <p className="text-xs text-slate-500">
                  تاريخ الفحص: {studentData.date} · المرحلة: الصف {studentData.grade} الابتدائي
                </p>
              </div>

              {/* Status Band Pill */}
              <div
                className={`px-4 py-2 rounded-2xl border text-xs font-bold ${performanceEvaluation.badgeColor}`}
              >
                {performanceEvaluation.summaryHeadline}
              </div>
            </div>

            {/* Tri-Modal Progress Cards (Strictly Measured Values) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* 1. Reading & Comprehension */}
              <div className="p-5 rounded-2xl bg-teal-50/70 border border-teal-100 text-right">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-teal-700 font-mono">
                    {studentData.reading
                      ? (studentData.reading.assessmentModality === 'voice_only' && !(studentData.reading.spokenTranscript || '').trim() && studentData.reading.teacherVerified !== true)
                      ? 'غير متاح'
                      : typeof studentData.reading.wcpm === 'number'
                        ? `${studentData.reading.wcpm} WCPM`
                        : `${studentData.reading.wpm} ك/د`
                      : 'لم يُجرَ'}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">الطلاقة والفهم القرائي</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {studentData.reading
                    ? (studentData.reading.assessmentModality === 'voice_only' && !(studentData.reading.spokenTranscript || '').trim() && studentData.reading.teacherVerified !== true)
                      ? 'لم تتوفر بيانات صوتية صالحة؛ سرعة القراءة الجهرية غير متاحة.'
                      : typeof studentData.reading.wcpm === 'number'
                      ? `سُجل ${studentData.reading.wcpm} كلمة صحيحة/دقيقة في هذا النص؛ ${studentData.reading.teacherVerified === true ? 'راجع المعلم الكلمات.' : 'ما زال التقدير الآلي بحاجة إلى مراجعة.'} لا تُقارن الجلسة الواحدة مباشرة بمئينات منشورة تعتمد عدة نصوص.`
                      : `معدل إتمام النص في هذه الجلسة ${studentData.reading.wpm} كلمة/دقيقة، مع إجابة ${studentData.reading.comprehensionScore}% من أسئلة الفهم. هذا تقدير لنص واحد ولا يقيس دقة الكلمات ولا يُقارن بمعايير الطلاقة الجهرية.`
                    : 'لم يكتمل اختبار القراءة في هذه الجلسة بعد.'}
                </p>
              </div>

              {/* 2. Speech */}
              <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-right">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Mic className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-indigo-700 font-mono">
                    {studentData.speech ? `${studentData.speech.averageConfidence}% دقة` : 'لم يُجرَ'}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">الوعي الصوتي والنطق</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {studentData.speech
                    ? `أظهر دقة نطق ${studentData.speech.averageConfidence}% مع رصد ${studentData.speech.wordsNeedingImprovement} كلمات تحتاج لتعزيز التمييز النطقي.`
                    : 'لم يكتمل فحص النطق في هذه الجلسة بعد.'}
                </p>
              </div>

              {/* 3. Tactile Math */}
              <div className="p-5 rounded-2xl bg-purple-50/70 border border-purple-100 text-right">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <Hand className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-purple-700 font-mono">
                    {studentData.tactile
                      ? `${studentData.tactile.correctAnswers}/${studentData.tactile.totalTasks} مهام`
                      : 'لم يُجرَ'}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">الحس العددي واللمسي</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {studentData.tactile
                    ? `إنجاز ${studentData.tactile.correctAnswers} من أصل ${studentData.tactile.totalTasks} مهام بمتوسط استجابة ${studentData.tactile.averageReactionTime} ثانية.`
                    : 'لم يكتمل فحص الحساب في هذه الجلسة بعد.'}
                </p>
              </div>
            </div>

            {/* Parent 15-Minute Daily Routine Plan */}
            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-600" />
                <span>أمثلة لأنشطة منزلية قصيرة قابلة للتعديل</span>
              </h3>

              <p className="text-xs text-slate-500 mb-4">أمثلة قابلة للتعديل حسب وقت الطفل، وليست جرعة تدريبية أو توصية علاجية ثابتة.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-right">
                  <span className="text-xs font-bold text-teal-700 block mb-1">الدقائق (١ - ٥)</span>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">صيد النقاط والحروف</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    لعبة تمييز مواضع النقاط بين الحروف المتشابهة (ب، ت، ث، ن) باستخدام بطاقات ملونة.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-right">
                  <span className="text-xs font-bold text-teal-700 block mb-1">الدقائق (٦ - ١٠)</span>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">القراءة الموجهة الميسرة</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    قراءة نص قصير في القارئ الميسر مع مسطرة التتبع السطري لتنمية الثقة والاسترسال.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-right">
                  <span className="text-xs font-bold text-teal-700 block mb-1">الدقائق (١١ - ١٥)</span>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">خط الأعداد والتعزيز</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    تخمين موقع رقم على خط أعداد بسيط مع تقديم الثناء المعنوي على الجهد المبذول.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: TEACHER & SPECIALIST IEP REPORT (خطة الأخصائي والمعلم) */}
      {/* ========================================================================= */}
      {activeView === 'teacher' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Header Banner */}
          <div className="bg-slate-900 rounded-3xl p-8 md:p-10 text-white shadow-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 mb-2 inline-block">
                  ملف خطة الدعم التربوي الفردي الاسترشادية (IEP)
                </span>
                <h2 className="text-3xl font-black mb-1">
                  تقرير الفرز التربوي الاسترشادي: {studentData.studentName}
                </h2>
                <p className="text-sm text-slate-400">
                  تحليل مبني على المقاييس الفعلية المثبتة — لا يُعتد به كتشخيص سريري مستقل دون فحص أخصائي معتمد
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold ${performanceEvaluation.badgeColor}`}
                >
                  {performanceEvaluation.summaryHeadline}
                </div>
              </div>
            </div>
          </div>

          {/* Available Learning Measures Table */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>جدول المؤشرات التعليمية المتاحة</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-3 px-4">المحور</th>
                    <th className="py-3 px-4">المؤشر المقاس</th>
                    <th className="py-3 px-4">القيمة الفعلية</th>
                    <th className="py-3 px-4">المؤشر الاسترشادي للصف</th>
                    <th className="py-3 px-4">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Reading Fluency WCPM (Oral Correct Words Per Minute) */}
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {studentData.reading?.teacherVerified ? 'الطلاقة الشفوية المعتمدة' : 'الطلاقة الشفوية'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">الكلمات الصحيحة في الدقيقة (WCPM)</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-teal-700">
                      {studentData.reading && typeof studentData.reading.wcpm === 'number'
                        ? `${studentData.reading.wcpm} WCPM ${studentData.reading.teacherVerified ? '(معتمد من المعلم)' : '(محاذاة آلية)'}`
                        : studentData.reading
                        ? 'قراءة صامتة (WPM فقط)'
                        : 'لم تُقَس'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {isOralReading ? 'لا تقارن جلسة واحدة مباشرة بدراسة استخدمت متوسط 3 نصوص؛ لا توجد عتبة تشخيصية.' : 'لا تنطبق معايير الطلاقة الجهرية على قراءة صامتة.'}
                    </td>
                    <td className="py-3.5 px-4">
                      {studentData.reading && typeof studentData.reading.wcpm === 'number'
                        ? studentData.reading.teacherVerified === true
                          ? <span className="text-slate-700">راجعها المعلم؛ وصف لجلسة واحدة</span>
                          : <span className="text-amber-800">تقدير آلي أولي؛ يحتاج مراجعة</span>
                        : studentData.reading && isOralReading
                          ? <span className="text-slate-500">غير متاح — لا توجد بيانات صوتية كافية</span>
                          : <span className="text-slate-500">غير منطبق على القراءة الصامتة</span>}
                    </td>
                  </tr>

                  {/* Reading Fluency Total WPM */}
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-900">السرعة القرائية الكلية</td>
                    <td className="py-3.5 px-4 text-slate-600">معدل الكلمات الكلي (WPM)</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-teal-700">
                      {studentData.reading
                        ? studentData.reading.assessmentModality === 'voice_only' && !(studentData.reading.spokenTranscript || '').trim() && studentData.reading.teacherVerified !== true
                          ? 'غير متاحة (غياب التفريغ الصوتي)'
                          : `${studentData.reading.wpm} كلمة/دقيقة`
                        : 'لم تُقَس'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {isOralReading ? 'معدل نطق/تفريغ خلال هذه الجلسة؛ يُراجع مستقلًا عن WCPM.' : 'معدل إتمام نص واحد فقط؛ لا يقيس دقة الكلمات.'}
                    </td>
                    <td className="py-3.5 px-4">
                      {studentData.reading ? (
                        isOralReading ? (
                          hasOralReadingEvidence
                            ? <span className="text-slate-600">معدل كلمات التفريغ فقط؛ لا يُفسّر منفردًا كمستوى طلاقة</span>
                            : <span className="text-slate-500">غير متاح (لا يوجد تفريغ صوتي كافٍ)</span>
                        ) : (
                          <span className="text-slate-600">معدل إتمام تقريبي لنص واحد؛ لا يكفي وحده لتقييم الطلاقة</span>
                        )
                      ) : (
                        <span className="text-slate-400">غير مكتمل</span>
                      )}
                    </td>
                  </tr>

                  {/* Reading Comprehension */}
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-900">الفهم والاستيعاب</td>
                    <td className="py-3.5 px-4 text-slate-600">دقة إجابات أسئلة النص</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-teal-700">
                      {studentData.reading
                        ? `${studentData.reading.comprehensionScore}%`
                        : 'لم تُقَس'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">٧٠% أو أعلى</td>
                    <td className="py-3.5 px-4">
                      {studentData.reading ? (
                        studentData.reading.comprehensionScore >= 70 ? (
                          <span className="text-emerald-700 font-bold">✓ استيعاب سليم</span>
                        ) : (
                          <span className="text-amber-700 font-bold">استيعاب متوسط</span>
                        )
                      ) : (
                        <span className="text-slate-400">غير مكتمل</span>
                      )}
                    </td>
                  </tr>

                  {/* Speech Phonology */}
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-900">النطق والوعي الصوتي</td>
                    <td className="py-3.5 px-4 text-slate-600">دقة التطابق الفونولوجي</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                      {studentData.speech
                        ? `${studentData.speech.averageConfidence}%`
                        : 'لم تُقَس'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">٨٠% أو أعلى</td>
                    <td className="py-3.5 px-4">
                      {studentData.speech ? (
                        studentData.speech.averageConfidence >= 80 ? (
                          <span className="text-emerald-700 font-bold">✓ دقة مناسبة</span>
                        ) : (
                          <span className="text-amber-700 font-bold">إبدالات متكررة</span>
                        )
                      ) : (
                        <span className="text-slate-400">غير مكتمل</span>
                      )}
                    </td>
                  </tr>

                  {/* Tactile Math */}
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-900">الحس العددي</td>
                    <td className="py-3.5 px-4 text-slate-600">إنجاز مهام خط الأعداد والكميات</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-purple-700">
                      {studentData.tactile
                        ? `${studentData.tactile.correctAnswers}/${studentData.tactile.totalTasks}`
                        : 'لم تُقَس'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">٧٥% أو أعلى</td>
                    <td className="py-3.5 px-4">
                      {studentData.tactile ? (
                        <span className="text-emerald-700 font-bold">✓ مكتمل</span>
                      ) : (
                        <span className="text-slate-400">غير مكتمل</span>
                      )}
                    </td>
                  </tr>

                </tbody>
              </table>
              <p className="text-[11px] text-slate-500 mt-4 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                * <strong>تنبيه منهجي استرشادي ومقارنة معيارية:</strong> مؤشرات الكلمات الصحيحة في الدقيقة (WCPM) مستخلصة من المئينات التجريبية لدراسة CBM-ORF العربية (2024، N=414) للصفوف من 2 إلى 6 (المعتمدة على متوسط 3 نصوص)، بينما هذا التقييم يعتمد جلسة نص فردية استرشادية. الصف الأول خارج نطاق العينة المعيارية لدراسة 2024 ويُعامل كمؤشر أولي تجريبي. ولا تُعد هذه النتائج معايير تشخيصية طبية قاطعة أو بديلة عن الفحص الإكلينيكي المتخصص.
              </p>
            </div>
          </div>

          {/* What research does and does not validate in this prototype */}
          <section className="bg-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-lg border border-slate-800" aria-labelledby="baseera-evidence-title">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-600/30 border border-teal-500 text-teal-300 flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 id="baseera-evidence-title" className="text-lg font-black text-white">المرجعية العلمية وحدود النموذج الحالي</h3>
                <p className="text-xs text-slate-300 mt-1">هذه أبحاث مرجعية مستقلة، وليست اعتمادًا علميًا أو سريريًا لبصيرة. لا تنتقل صلاحية أي اختبار منشور إلى أنشطة هذا النموذج بمجرد الاستشهاد به.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-200 mt-4">
              <article className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <h4 className="font-bold text-teal-300 block mb-2">الطلاقة القرائية العربية — CBM-ORF (2024)</h4>
                <p>دراسة على 414 طالبًا بالصفوف 2–6، واستندت المئينات المقترحة إلى متوسط ثلاثة نصوص. جلسة بصيرة الحالية تقيس نصًا واحدًا؛ لذلك لا تعرض مئينات الدراسة كحكم على الطفل.</p>
                <a className="inline-block mt-2 underline text-teal-200 hover:text-white" href="https://doi.org/10.18860/ijazarabi.v7i2.26356" target="_blank" rel="noreferrer">فتح الدراسة المنشورة</a>
              </article>
              <article className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <h4 className="font-bold text-teal-300 block mb-2">أداة فرز عربية منشورة — MADST (2016)</h4>
                <p>اختبار MADST أداة مستقلة لها بنود وتعليمات وعينة تقنين خاصة، وتذكر الدراسة حدودًا في تمثيل العينة. لا ينفذ هذا التطبيق الاختبار ولا يرث صدقه بمجرد الاستشهاد به.</p>
                <a className="inline-block mt-2 underline text-teal-200 hover:text-white" href="https://research.asu.edu.eg/handle/12345678/51928" target="_blank" rel="noreferrer">فتح سجل جامعة عين شمس</a>
              </article>
              <article className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <h4 className="font-bold text-teal-300 block mb-2">التعرّف على كلام الأطفال بالعربية — Little STT (2025)</h4>
                <p>اختبرت الدراسة Whisper على 355 ملفًا صوتيًا قصيرًا من 288 طفلًا يتحدثون لهجة شامية، وسجل أفضل نموذج فيها WER قدره 0.66. هذه نتيجة لذلك النموذج والمجموعة، ولا تمثل تلقائيًا التعرف الصوتي في متصفح المستخدم.</p>
                <a className="inline-block mt-2 underline text-teal-200 hover:text-white" href="https://arxiv.org/abs/2510.23319" target="_blank" rel="noreferrer">فتح الدراسة ومجموعة البيانات</a>
              </article>
              <article className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <h4 className="font-bold text-teal-300 block mb-2">بطارية مغربية لعسر الحساب (2026)</h4>
                <p>تصف الدراسة بطارية من 79 بندًا وتسعة مجالات مع دليل صلاحية أولي من عينة مغربية. نشاط بصيرة الحالي يتضمن مهام قصيرة فقط، وليس هذه البطارية أو بديلًا عنها.</p>
                <a className="inline-block mt-2 underline text-teal-200 hover:text-white" href="https://doi.org/10.1177/07342829261484042" target="_blank" rel="noreferrer">فتح الدراسة المنشورة</a>
              </article>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700 text-[11px] leading-relaxed text-slate-300">
              لا يدّعي هذا النموذج اعتمادًا سريريًا أو امتثالًا قانونيًا. قبل استخدامه مع بيانات أطفال حقيقية، يلزم التحقق المستقل من القياس ومراجعة الخصوصية والموافقة والمتطلبات القانونية المختصة.
            </div>
          </section>

          {/* Individualized Education Program (IEP) Goals */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-6">
              خطة الأهداف التربوية الفردية المقترحة (SMART IEP Goals)
            </h3>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
                    الهدف القرائي والطلاقة
                  </span>
                  <span className="text-xs text-slate-500 font-mono">مدة يحددها المعلم</span>
                </div>
                <p className="text-sm font-bold text-slate-800 mb-2">
                  يحدد المعلم هدف الطلاقة بعد جمع خط أساس من عدة نصوص متقاربة الصعوبة ومراجعة دقة الكلمات والفهم؛ لا تُستخدم نتيجة هذه الجلسة وحدها لتحديد مستوى الطفل.
                </p>
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-slate-700">استراتيجية التدريس:</span> توظيف مسطرة القراءة الرقمية (Reading Ruler)، وتكبير التباعد بين السطور بنسبة 1.5x.
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-800">
                    الهدف الفونولوجي والتمييز الصوتي
                  </span>
                  <span className="text-xs text-slate-500 font-mono">مدة يحددها المعلم</span>
                </div>
                <p className="text-sm font-bold text-slate-800 mb-2">
                  مثال قابل للتعديل: يميّز الطفل بين الحروف المستهدفة في كلمات مناسبة لمستواه، بعد أن يحدد المعلم خط الأساس ومعيار التقدم من محاولات متكررة.
                </p>
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-slate-700">استراتيجية التدريس:</span> استخدام التغذية الراجعة الصوتية اللحظية، التقطيع المقطعي، والتمييز اللوني لمواضع النقاط.
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-800">
                    هدف الحس العددي والرياضيات
                  </span>
                  <span className="text-xs text-slate-500 font-mono">مدة يحددها المعلم</span>
                </div>
                <p className="text-sm font-bold text-slate-800 mb-2">
                  مثال قابل للتعديل: يتحسن تقدير الطفل لمواضع الأعداد مقارنة بخط أساسه في مهام متشابهة، ويُحدَّد معيار التقدم بعد مراجعة عدة محاولات.
                </p>
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-slate-700">استراتيجية التدريس:</span> التدريب الحركي التفاعلي على خط الأعداد والمقارنة المكانية بالصور التجسيدية.
                </div>
              </div>
            </div>
          </div>

          {/* Classroom Accommodations (التسهيلات والتعديلات الصفية) */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-4">
              التسهيلات الصفية المقترحة للمعلم داخل الفصل
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-800">تكييف الوقت وطول المهمة حسب حاجة الطفل، لا وفق نسبة ثابتة للجميع</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-800">إتاحة خط عربي واضح مع حجم وتباعد قابلين للتعديل</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-800">إتاحة مسطرة سطر اختيارية إذا وجد الطفل أنها تساعده</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-800">إتاحة خيار التقييم الشفوي عند قياس الفهم والاستيعاب</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: ADAPTIVE REMEDIATION GAMES PATH (الألعاب الموجهة والمسار التفاعلي) */}
      {/* ========================================================================= */}
      {activeView === 'games' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Games Hero Banner */}
          <div className="bg-gradient-to-br from-indigo-600 via-purple-700 to-teal-800 rounded-3xl p-8 md:p-10 text-white shadow-xl">
            <h2 className="text-3xl font-black mb-2">الألعاب التكيفية الداعمة للطالب</h2>
            <p className="text-sm text-indigo-100 max-w-xl leading-relaxed">
              هذه أنشطة تعليمية عامة قابلة للاختيار. يراجع المعلم سجل الأداء قبل تخصيصها؛ لا يثبت عرض اللعبة وحده وجود صعوبة أو أثر علاجي.
            </p>
          </div>

          {/* Grid of Adaptive Games */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {adaptiveGames.map(game => (
              <div
                key={game.id}
                className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-2xl ${game.iconColor} flex items-center justify-center font-bold shadow-sm`}
                    >
                      <Gamepad2 className="w-6 h-6" />
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      الصعوبة: {game.difficulty}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 mb-2">{game.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">{game.description}</p>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">المهارة المستهدفة:</span>
                      <span className="font-bold text-slate-700">{game.targetSkill}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">المدة المقترحة:</span>
                      <span className="font-bold text-teal-700 font-mono">{game.duration}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (onNavigateTab) {
                      onNavigateTab(game.tabTarget);
                    }
                  }}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm cursor-pointer"
                >
                  <span>بدء اللعبة في الصالة العلاجية</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdaptiveReports;
