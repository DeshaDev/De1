import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Target,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { StudentRecord } from '../../data/seedData';
import { IEPDocument, generateStudentIEP } from '../../utils/iepGenerator';

interface IEPStationProps {
  activeStudent: StudentRecord;
  speakText: (text: string) => void;
}

export const IEPStation: React.FC<IEPStationProps> = ({
  activeStudent,
  speakText,
}) => {
  const [iep, setIep] = useState<IEPDocument | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleGenerateIEP = async () => {
    setIsLoading(true);
    try {
      const generated = await generateStudentIEP({
        studentName: activeStudent.name,
        gradeLevel: activeStudent.gradeLevel,
        wcpm: 42,
        accuracy: 86,
        ranDurationSec: 36,
        pseudoAccuracy: 75,
        phonemicScore: 4,
        observedTargets: ['س / ص', 'المقطع الساكن', 'التاء والطاء'],
      });
      setIep(generated);
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void handleGenerateIEP();
  }, [activeStudent.id]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/90 text-right space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-black text-slate-900">
                  الخطة التربوية الفردية الذكية (IEP Generator)
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  معايير التربية الخاصة والتدخل المبكر
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                توليد خطة تدخل علاجي رسمية مبنية على مؤشرات التقييم الصوتي الشفوي وقراءة الكلمات غير المعجمية.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / تصدير الخطة (PDF)</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleGenerateIEP}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>إعادة توليد</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Document Content */}
      {iep ? (
        <div className="space-y-6 printable-area">
          {/* Student Baseline Summary Card */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>الطالب: <strong className="text-slate-900 text-sm">{iep.studentName}</strong> (الصف {iep.gradeLevel})</span>
              <span>تاريخ التقرير: {iep.date}</span>
            </div>
            <p className="text-xs text-slate-800 leading-relaxed font-medium bg-white p-3 rounded-xl border border-slate-200">
              {iep.baselineSummary}
            </p>
          </div>

          {/* Section 1: Measurable Annual Goals (SMART) */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600" />
              <span>١. الأهداف السنوية المقاسة (Measurable Annual Goals):</span>
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              {iep.annualGoals.map((goal, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200/80 text-xs font-bold text-indigo-950 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{goal}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Short-term Objectives */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>٢. الأهداف المرحلية متدرجة الإتقان (Short-term Benchmarks):</span>
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {iep.shortTermObjectives.map((obj, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs text-emerald-950 font-medium leading-relaxed">
                  {obj}
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Recommended Accommodations */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>٣. التيسيرات والتكييفات الصفية والاختبارية (Accommodations):</span>
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {iep.accommodations.map((acc, idx) => (
                <li key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                  <span>{acc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 4: Weekly Intervention Schedule (5-Minute Sprint Integration) */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>٤. الجدول الأسبوعي لجلسات التدخل المصغرة:</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {iep.weeklySchedule.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-right space-y-1">
                  <div className="text-[11px] font-black text-amber-900">{item.day}</div>
                  <div className="text-[10.5px] text-amber-950 leading-relaxed font-medium">{item.activity}</div>
                  <div className="text-[10px] text-amber-700 font-mono font-bold mt-1">⏱️ {item.durationMinutes} دقائق</div>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical & Ethical Guardrail Disclaimer */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-300 text-slate-600 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>الضابط العلمي والأخلاقي للاستخدام الإكلينيكي:</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {iep.clinicalDisclaimer}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs">جارٍ إعداد وتحليل بيانات الخطة التربوية الفردية...</p>
        </div>
      )}
    </div>
  );
};
