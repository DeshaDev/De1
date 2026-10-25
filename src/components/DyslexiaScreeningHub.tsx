import React, { useState } from 'react';
import { BookOpen, Brain, Sparkles, Award } from 'lucide-react';
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

  return (
    <div className="space-y-6" dir="rtl">
      {/* Unified Hub Header & Creative Tab Switcher */}
      <div className="bg-white border-2 border-indigo-100 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 text-right w-full md:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center text-2xl shadow-md shadow-indigo-500/20 shrink-0">
            🔬
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 font-serif">
                مركز فحص وتشخيص عسر القراءة (Dyslexia Lab)
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                بطارية اختبارات شاملة
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              قياس الطلاقة الشفوية الفونيمية، التسمية السريعة (RAN)، والكلمات غير المعجمية للطالب: <strong className="text-indigo-700">{activeStudent.name}</strong>
            </p>
          </div>
        </div>

        {/* The Two Unified Diagnostic Tracks */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold w-full md:w-auto justify-center">
          <button
            type="button"
            onClick={() => setSubTab('oral-reading')}
            className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              subTab === 'oral-reading'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>١. القراءة الشفوية والطلاقة (WCPM)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('cognitive-screening')}
            className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              subTab === 'cognitive-screening'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>٢. الفرز المعرفي (RAN + الكلمات غير المعجمية + الفونيمات)</span>
          </button>
        </div>
      </div>

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
