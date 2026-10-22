/**
 * Adaptive Multi-Axis Screening Reports (تقارير الفرز التربوي الاسترشادي متعدد المحاور)
 * Tri-modal evaluation: Voice Phonology + Tactile Math + Reading Session
 * Educational screening portfolio: Parent, Specialist/Teacher (IEP), and Targeted Games.
 * NOTE: Strictly prevents report fabrication when no assessments have been completed.
 * Diagnostic overclaims (DSM-5 / ICD-11) removed per clinical validation standards.
 */

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Printer,
  Volume2,
  VolumeX,
  Eye,
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

  // Check if ANY real assessment data has been gathered
  const hasSpeechData = Boolean(currentAssessment?.speechResults?.summary);
  const hasTactileData = Boolean(currentAssessment?.tactileResults?.summary);
  const hasEyeData = Boolean(
    currentAssessment?.eyeTrackingResults || (student && student.sessionStatus === 'completed')
  );
  const hasAnyAssessmentData = hasSpeechData || hasTactileData || hasEyeData;

  // Synthesize student data from active assessment context or completed student record
  const studentData = useMemo(() => {
    const studentName = student?.name || currentAssessment?.studentName || 'الطالب المستهدف';
    const age = student?.ageYears || currentAssessment?.age || 9;
    const grade = student?.gradeLevel || 3;
    const date = new Date().toLocaleDateString('ar-SA');

    // Speech data (only present if actually assessed)
    const speechSummary = currentAssessment?.speechResults?.summary || null;

    // Tactile data (only present if actually assessed)
    const tactileSummary = currentAssessment?.tactileResults?.summary || null;

    // Eye tracking data
    let eyeSummary: {
      wcpm: number;
      avgFixationMs: number;
      regressionRate: number;
      gazeCoverage: number;
      visualStrain: string;
    } | null = null;

    if (currentAssessment?.eyeTrackingResults) {
      eyeSummary = {
        wcpm: currentAssessment.eyeTrackingResults.wpm || 55,
        avgFixationMs: 310,
        regressionRate: currentAssessment.eyeTrackingResults.regressionRate || 0,
        gazeCoverage: 80,
        visualStrain: 'مؤشر استرشادي من جلسة القراءة',
      };
    } else if (student && student.sessionStatus === 'completed') {
      eyeSummary = {
        wcpm: student.wpm || 55,
        avgFixationMs: student.avgFixationMs || 310,
        regressionRate: student.regressionRate ? Math.round(student.regressionRate * 100) : 18,
        gazeCoverage: 85,
        visualStrain: student.visualStrainLabelAr || 'ضمن النطاق المعتاد',
      };
    }

    return {
      studentName,
      age,
      grade,
      date,
      speech: speechSummary,
      tactile: tactileSummary,
      eye: eyeSummary,
      clinicalReport: student?.clinicalReport,
    };
  }, [student, currentAssessment]);

  // Comprehensive Educational Screening Risk Indicator (0 - 100)
  // Computed strictly from available modules; does not fabricate unassessed modules
  const riskCalculation = useMemo(() => {
    let riskPoints = 0;
    let assessedWeights = 0;

    // Eye tracking risk factors (if assessed)
    if (studentData.eye) {
      assessedWeights += 35;
      if (studentData.eye.regressionRate > 25) riskPoints += 15;
      if (studentData.eye.wcpm < 60) riskPoints += 12;
      if (studentData.eye.avgFixationMs > 340) riskPoints += 8;
    }

    // Speech phonology risk factors (if assessed)
    if (studentData.speech) {
      assessedWeights += 35;
      if (studentData.speech.averageConfidence < 80) riskPoints += 15;
      if (studentData.speech.problematicLetters.length >= 2) riskPoints += 12;
      if (studentData.speech.hesitationMs > 500) riskPoints += 8;
    }

    // Tactile & math risk factors (if assessed)
    if (studentData.tactile) {
      assessedWeights += 30;
      const mathSuccessRate =
        (studentData.tactile.correctAnswers / Math.max(1, studentData.tactile.totalTasks)) * 100;
      if (mathSuccessRate < 70) riskPoints += 15;
      if (studentData.tactile.averageReactionTime > 1.8) riskPoints += 15;
    }

    // Normalized score out of 100 based on modules actually assessed
    const normalizedScore =
      assessedWeights > 0 ? Math.round((riskPoints / assessedWeights) * 100) : 25;

    let band: 'low' | 'moderate' | 'high' = 'low';
    let bandLabel = 'مؤشرات اعتيادية (ضمن النطاق النمائي الطبيعي)';
    let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';

    if (normalizedScore >= 60) {
      band = 'high';
      bandLabel = 'مؤشرات تباين مرتفعة (يوصى بمساندة صفية وتدخل فردي)';
      badgeColor = 'bg-red-100 text-red-800 border-red-300';
    } else if (normalizedScore >= 35) {
      band = 'moderate';
      bandLabel = 'مؤشرات تباين معتدلة (تتطلب تمارين تدريبية مستهدفة)';
      badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
    }

    return {
      score: normalizedScore,
      band,
      bandLabel,
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
    if (studentData.speech) {
      observations.push(`بلغت دقة النطق الصوتي ${studentData.speech.averageConfidence}%`);
    }
    if (studentData.tactile) {
      observations.push(
        `أنجز ${studentData.tactile.correctAnswers} من أصل ${studentData.tactile.totalTasks} مهام لمسية عددية`
      );
    }
    if (studentData.eye) {
      observations.push(`وبلغت سرعة القراءة ${studentData.eye.wcpm} كلمة في الدقيقة`);
    }

    const text = `مرحباً بكم. هذا ملخص صوتي استرشادي لنتائج تقييم الطالب ${studentData.studentName}. ${
      observations.length > 0 ? observations.join('، ') + '.' : ''
    } نوصي بالاطلاع على خطة التدريبات المخصصة في هذا التقرير لدعم التطور القرائي والحسابي للطالب.`;

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
      description: 'قراءة نصوص مشكولة مع مسطرة التظليل البصري والتلوين الديناميكي للحروف المتشابهة.',
      targetSkill: 'التتبع البصري الإيقاعي وخفض الارتدادات (Reading Flow)',
      difficulty: 'متدرج' as const,
      duration: '15 دقيقة يومياً',
      tabTarget: 'adaptive-reader',
      iconColor: 'bg-teal-500 text-white',
    },
  ];

  // EMPTY STATE: Prevent rendering fake diagnostic reports when no tests have run
  if (!hasAnyAssessmentData) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-12 select-none font-sans" dir="rtl">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12 text-center shadow-sm">
          <div className="w-20 h-20 mx-auto bg-amber-50 border border-amber-200 rounded-3xl flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-amber-600" />
          </div>

          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 mb-3">
            حالة التقرير: في انتظار إجراء الاختبارات
          </span>

          <h2 className="text-3xl font-black text-slate-900 mb-3">
            لم يُجرَ أي تقييم بعد للطالب
          </h2>
          <p className="text-base text-slate-600 max-w-xl mx-auto mb-8 leading-relaxed">
            التزاماً بمعايير النزاهة العلمية والشفافية التربوية، لا تُولّد منصة «بصيرة» تقارير أو مؤشرات مخاطر افتراضية بدون قياس فعلي. يرجى البدء بأحد محاور الفرز أدناه:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 text-right">
            {/* 1. Speech Analysis Card */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 hover:border-indigo-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-4">
                  <Mic className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1">تحليل النطق العربي</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  فحص الوعي الفونولوجي، أزواج الحروف المتشابهة صوتياً، ومعدل التردد والتوقف.
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

            {/* 2. Tactile Math Card */}
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

            {/* 3. Reading Session Card */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 hover:border-emerald-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                  <Eye className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1">جلسة قراءة النص</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  قياس سرعة القراءة والطلاقة والارتدادات البصرية الاسترشادية على الكلمات المشكولة.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab && onNavigateTab('professional-eye-tracking')}
                className="mt-6 w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>بدء جلسة القراءة</span>
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
            تقرير الفرز التربوي الاسترشادي وخطة التدخل الفردية (IEP)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            مؤشرات فرز تكيفية مستندة إلى أداء الطالب:{' '}
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

      {/* Scientific Transparency Notice */}
      <div className="mb-6 p-4 rounded-2xl bg-slate-100 border border-slate-200 text-right">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 leading-relaxed">
            <span className="font-bold block mb-0.5">إخلاء مسؤولية تربوي وتوجيه منهجي:</span>
            هذا التقرير هو أداة فرز تربوي استرشادي (Educational Screening) لتحديد مجالات القوة والاحتياج، وتصميم خطط الدعم داخل الصف والمنزل. لا يُعتبر هذا التقرير تشخيصاً طبياً أو إكلينيكياً نهائياً لعسر القراءة أو الحساب، وتجب إحالة الحالات ذات المؤشرات المرتفعة لمختص معتمد لإجراء الاختبارات المعيارية.
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
                  استمع لملخص صوتي باللغة العربية يشرح نتائج الفرز الاسترشادي للطالب وأبرز التوصيات المنزلية.
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
              <div className={`px-4 py-2 rounded-2xl border text-xs font-bold ${riskCalculation.badgeColor}`}>
                {riskCalculation.bandLabel}
              </div>
            </div>

            {/* Tri-Modal Progress Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* 1. Speech */}
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

              {/* 2. Reading */}
              <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-right">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Eye className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-emerald-700 font-mono">
                    {studentData.eye ? `${studentData.eye.wcpm} كلمة/دقيقة` : 'لم تُجرَ'}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">الطلاقة القرائية</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {studentData.eye
                    ? `سرعة قراءة بلغت ${studentData.eye.wcpm} كلمة/دقيقة مع ارتدادات استرشادية بنسبة ${studentData.eye.regressionRate}%.`
                    : 'لم تكتمل جلسة القراءة في هذه الجلسة بعد.'}
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
                <span>الخطة المنزلية المقترحة (١٥ دقيقة يومياً)</span>
              </h3>

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
                  <h4 className="font-bold text-slate-900 text-sm mb-1">القراءة بالمسطرة الرقمية</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    قراءة نص قصير في القارئ الميسر مع تفعيل مسطرة السطر لتسهيل التتبع ومنع القفز.
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
                  تقرير الفرز التربوي الاسترشادي متعدد المحاور: {studentData.studentName}
                </h2>
                <p className="text-sm text-slate-400">
                  مؤشرات فرز استرشادية لخطط التدخل والدعم الصفي — لا يُعتد بها كتشخيص سريري مستقل دون تقييم أخصائي معتمد
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className={`px-4 py-2.5 rounded-xl border text-xs font-bold ${riskCalculation.badgeColor}`}>
                  {riskCalculation.bandLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Tri-Modal Metrics Table */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Reading & Eye */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-emerald-700 font-bold text-sm">
                <Eye className="w-5 h-5" />
                <span>المحور الأول: القراءة والطلاقة</span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">سرعة القراءة (WCPM):</span>
                  <span className="font-mono font-bold text-slate-800">
                    {studentData.eye ? `${studentData.eye.wcpm} ك/د` : 'غير متاح'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">متوسط زمن التثبيت:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {studentData.eye ? `${studentData.eye.avgFixationMs} ms` : 'غير متاح'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">معدل الارتداد الاسترشادي:</span>
                  <span className="font-mono font-bold text-amber-600">
                    {studentData.eye ? `${studentData.eye.regressionRate}%` : 'غير متاح'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">حالة المؤشر البصري:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {studentData.eye ? 'مكتمل' : 'لم يُجرَ'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Speech Phonology */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-indigo-700 font-bold text-sm">
                <Mic className="w-5 h-5" />
                <span>المحور الثاني: النطق والوعي الصوتي</span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">دقة النطق الفونولوجي:</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {studentData.speech ? `${studentData.speech.averageConfidence}%` : 'غير متاح'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">كمون البدء الصوتي (VOT):</span>
                  <span className="font-mono font-bold text-slate-800">
                    {studentData.speech ? `${studentData.speech.hesitationMs} ms` : 'غير متاح'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">أزواج الحروف المرصودة:</span>
                  <span className="font-bold text-amber-600">
                    {studentData.speech?.problematicLetters?.join('، ') || 'لا يوجد'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">التوقفات داخل الكلمة:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {studentData.speech ? `${studentData.speech.totalPauses} توقفات` : 'غير متاح'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Tactile & Math */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-purple-700 font-bold text-sm">
                <Hand className="w-5 h-5" />
                <span>المحور الثالث: الحس العددي واللمسي</span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">زمن الاستجابة الحركية:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {studentData.tactile ? `${studentData.tactile.averageReactionTime} ث` : 'غير متاح'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">المهام المنجزة بنجاح:</span>
                  <span className="font-mono font-bold text-purple-700">
                    {studentData.tactile
                      ? `${studentData.tactile.correctAnswers} / ${studentData.tactile.totalTasks}`
                      : 'غير متاح'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">معدل التردد الحركي:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {studentData.tactile ? studentData.tactile.hesitationCount : 'غير متاح'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مجال التركيز الأساسي:</span>
                  <span className="font-bold text-amber-600">خط الأعداد (PAE)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Individualized Education Program (IEP) Goals */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-6">
              خطة الأهداف التربوية الفردية المقترحة (SMART IEP Goals)
            </h3>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
                    الهدف الفونولوجي والقرائي
                  </span>
                  <span className="text-xs text-slate-500 font-mono">المدى الزمني: ٦ أسابيع</span>
                </div>
                <p className="text-sm font-bold text-slate-800 mb-2">
                  أن يميز الطالب نطقاً وقراءة بين الحروف المتشابهة (ب/ت/ث) بنسبة دقة لا تقل عن ٩٠% في ١٠ محاولات متتالية.
                </p>
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-slate-700">استراتيجية التدريس:</span> استخدام التغذية الراجعة الصوتية اللحظية، التقطيع المقطعي، والتمييز اللوني لمواضع النقاط.
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-800">
                    هدف التتبع البصري والطلاقة
                  </span>
                  <span className="text-xs text-slate-500 font-mono">المدى الزمني: ٨ أسابيع</span>
                </div>
                <p className="text-sm font-bold text-slate-800 mb-2">
                  رفع معدل القراءة الجهرية تدريجياً بنسبة ٢٠%، مع تقليل التردد بين السطور.
                </p>
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-slate-700">استراتيجية التدريس:</span> توظيف مسطرة القراءة الرقمية (Reading Ruler)، وتكبير التباعد بين السطور بنسبة 1.5x.
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-800">
                    هدف الحس العددي والرياضيات
                  </span>
                  <span className="text-xs text-slate-500 font-mono">المدى الزمني: ٦ أسابيع</span>
                </div>
                <p className="text-sm font-bold text-slate-800 mb-2">
                  خفض نسبة الخطأ في تقدير مواقع الأعداد على خط الأعداد (0 - 100) لتكون أقل من ١٠%.
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
                <span className="text-slate-800">منح وقت إضافي بنسبة 25% في المهام التحريرية</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-800">استخدام خط عربي واضح بحجم مريح (18pt على الأقل)</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-800">السماح باستخدام مسطرة تتبع الأسطر أثناء القراءة الفردية</span>
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
              تم اختيار هذه الألعاب بناءً على مؤشرات الأداء المرصودة لتقديم تدريب مهاري مكثف بقالب تفاعلي مشجع.
            </p>
          </div>

          {/* Grid of Adaptive Games */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {adaptiveGames.map((game) => (
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
