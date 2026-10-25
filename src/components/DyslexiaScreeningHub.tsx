import React, { useState } from 'react';
import { BookOpen, Brain, Sparkles, Award, ShieldCheck, Flame, Star, Trophy } from 'lucide-react';
import { StudentRecord, StudentAssessmentSnapshot } from '../data/seedData';
import ReadingAssessmentView from './ReadingAssessmentView';
import CognitiveScreeningView, { CognitiveScreeningData } from './CognitiveScreeningView';
import { AppTabId } from './HomeLandingView';

interface DyslexiaScreeningHubProps {
  students: StudentRecord[];
  activeStudent: StudentRecord;
  onSelectStudent: (id: string) => void;
  onNavigateTab: (tab: AppTabId) => void;
  onCompleteOralSession: (session: StudentAssessmentSnapshot) => void;
  onCompleteCognitiveScreening: (cogData: CognitiveScreeningData) => void;
  initialSubTab?: 'oral-reading' | 'cognitive-screening';
}

export const DyslexiaScreeningHub: React.FC<DyslexiaScreeningHubProps> = ({
  students,
  activeStudent,
  onSelectStudent,
  onNavigateTab,
  onCompleteOralSession,
  onCompleteCognitiveScreening,
  initialSubTab = 'oral-reading',
}) => {
  const [subTab, setSubTab] = useState<'oral-reading' | 'cognitive-screening'>(initialSubTab);
  const [showClinicalDetails, setShowClinicalDetails] = useState<boolean>(false);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Playful Hero Quest Header */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border-2 border-emerald-200/80 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 text-right w-full md:w-auto">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-sky-500 text-white flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/20 shrink-0 animate-bounce-gentle">
            🏆
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-child text-lg sm:text-2xl font-black text-slate-900">
                تحديات بطل القراءة الذكي 🌟
              </h1>
              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                مستوى الأبطال
              </span>
            </div>
            <p className="font-child text-xs sm:text-sm text-slate-600 font-bold mt-0.5">
              مرحباً بالبطل <strong className="text-emerald-700 font-black">{activeStudent.name}</strong>! انطلق في تحدي القراءة وسَمِّ الأشكال لتكسب وسام الطلاقة الذهبي.
            </p>
          </div>
        </div>

        {/* The Two Child-Friendly Action Tracks */}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur p-1.5 rounded-2xl text-xs font-black w-full md:w-auto justify-center border border-emerald-200 shadow-xs">
          <button
            type="button"
            onClick={() => setSubTab('oral-reading')}
            className={`child-tactile-btn px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              subTab === 'oral-reading'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="font-child font-black">📖 ١. تحدي قراءة القصة والطلاقة</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('cognitive-screening')}
            className={`child-tactile-btn px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              subTab === 'cognitive-screening'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span className="font-child font-black">⚡ ٢. سباق سرعة الأشكال والكلمات العجيبة</span>
          </button>
        </div>
      </div>

      {/* Discreet Specialist Info Toggle (For Teachers/Clinicians Only) */}
      <div className="flex items-center justify-end px-2">
        <button
          type="button"
          onClick={() => setShowClinicalDetails(prev => !prev)}
          className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{showClinicalDetails ? 'إخفاء المعايير الإكلينيكية' : 'عرض المعايير والمؤشرات الإكلينيكية للأخصائي'}</span>
        </button>
      </div>

      {showClinicalDetails && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 animate-fade-slide-up">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <span>🔬 بطارية التشخيص المعرفي الشامل (Dyslexia Screening Battery):</span>
          </div>
          <p className="leading-relaxed text-slate-600">
            تدمج هذه المحطة قياس الطلاقة الشفوية المباشرة (WCPM) بدقة المقاطع ومعدل الاستبدال والحذف، واختبار التسمية الآلية السريعة (RAN) لزمن الرجع والمعالجة الفونولوجية السريعة، بالإضافة إلى الكلمات غير المعجمية (Pseudowords) لفك التشفير الإملائي المستقل.
          </p>
        </div>
      )}

      {/* Track 1: Oral Reading & Fluency Assessment */}
      {subTab === 'oral-reading' && (
        <div className="animate-fade-slide-up">
          <ReadingAssessmentView
            students={students}
            activeStudent={activeStudent}
            onCompleteSession={onCompleteOralSession}
            onOpenFullReport={() => onNavigateTab('dashboard')}
            onSwitchToStudent={onSelectStudent}
          />
        </div>
      )}

      {/* Track 2: Cognitive Screening (RAN, Pseudowords, Phonemic Awareness, Summary) */}
      {subTab === 'cognitive-screening' && (
        <div className="animate-fade-slide-up">
          <CognitiveScreeningView
            student={activeStudent}
            onNavigateTab={(tab) => onNavigateTab(tab as any)}
            onCompleteScreening={onCompleteCognitiveScreening}
          />
        </div>
      )}
    </div>
  );
};

export default DyslexiaScreeningHub;
