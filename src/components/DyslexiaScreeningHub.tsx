import React, { useEffect, useState } from 'react';
import { BookOpen, Brain, Dumbbell, Timer } from 'lucide-react';
import { StudentRecord, CognitiveScreeningData } from '../data/seedData';
import ReadingAssessmentView from './ReadingAssessmentView';
import CognitiveScreeningView from './CognitiveScreeningView';
import CognitiveBatteryView from './profile/CognitiveBatteryView';
import { AppTabId } from './HomeLandingView';
import { TOTAL_BATTERY_MINUTES } from '../cognitiveProfile/battery';

export type ScreeningSubTab = 'battery' | 'training' | 'oral-reading' | 'cognitive-screening';

interface DyslexiaScreeningHubProps {
  students: StudentRecord[];
  activeStudent: StudentRecord;
  onSelectStudent: (id: string) => void;
  onNavigateTab: (tab: AppTabId) => void;
  onCompleteOralSession: (record: StudentRecord) => void;
  onCompleteCognitiveScreening: (cogData: CognitiveScreeningData) => void;
  initialSubTab?: ScreeningSubTab;
}

const TABS: Array<{ id: ScreeningSubTab; label: string; hint: string; icon: typeof Brain }> = [
  { id: 'battery', label: 'الفحص المعرفي الشامل', hint: '٩ ألعاب · ٤–٨ سنوات', icon: Brain },
  { id: 'training', label: 'البرنامج التدريبي', hint: 'مبني على نتائج الفحص', icon: Dumbbell },
  { id: 'oral-reading', label: 'قراءة نص وفهمه', hint: 'تكميلي · من الصف الأول', icon: BookOpen },
  { id: 'cognitive-screening', label: 'التسمية السريعة والكلمات غير الحقيقية', hint: 'تكميلي · من الصف الأول', icon: Timer },
];

export const DyslexiaScreeningHub: React.FC<DyslexiaScreeningHubProps> = ({
  activeStudent,
  onNavigateTab,
  onCompleteOralSession,
  onCompleteCognitiveScreening,
  initialSubTab = 'battery',
}) => {
  const [subTab, setSubTab] = useState<ScreeningSubTab>(initialSubTab);
  const [focused, setFocused] = useState(false);
  useEffect(() => setSubTab(initialSubTab), [initialSubTab]);

  return (
    <div className="space-y-6" dir="rtl">
      {!focused && (
      <header className="bg-white border border-slate-200 rounded-[2rem] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black text-emerald-700">بصيرة · الفحص المبكر لصعوبات القراءة</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">الفحص المعرفي الشامل لمهارات القراءة</h1>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl leading-relaxed">
              تسع ألعاب قصيرة (نحو {TOTAL_BATTERY_MINUTES} دقيقة) ترسم ملفًا معرفيًا للطفل: الذاكرة البصرية والسمعية، والتعلّم الترابطي، والوعي الصوتي، والتمييز السمعي والبصري، ومعرفة الحروف. يقارن التقرير أداء الطفل بالمتوقع لعمره، ويحدد نقاط القوة والضعف، ويقترح استراتيجيات تعليمية وبرنامجًا تدريبيًا مخصصًا.
            </p>
          </div>
        </div>
        <nav className="grid grid-cols-2 lg:grid-cols-4 gap-2" aria-label="أقسام الفحص">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`text-right rounded-2xl px-4 py-3 border-2 transition-all cursor-pointer ${
                  active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <span className={`flex items-center gap-2 text-sm font-black ${active ? 'text-emerald-800' : 'text-slate-800'}`}>
                  <Icon className="w-4 h-4 shrink-0" /> {tab.label}
                </span>
                <span className="block text-[11px] font-bold text-slate-500 mt-0.5">{tab.hint}</span>
              </button>
            );
          })}
        </nav>
      </header>
      )}

      {(subTab === 'battery' || subTab === 'training') && (
        <CognitiveBatteryView
          key={subTab}
          activeStudent={activeStudent}
          initialView={subTab === 'training' ? 'training' : 'map'}
          onFocusModeChange={setFocused}
        />
      )}

      {subTab === 'oral-reading' && (
        <ReadingAssessmentView
          activeStudent={activeStudent}
          onCompleteSession={onCompleteOralSession}
          onNavigateTab={(tab) => onNavigateTab(tab as AppTabId)}
        />
      )}

      {subTab === 'cognitive-screening' && (
        <CognitiveScreeningView
          student={activeStudent}
          onNavigateTab={(tab) => onNavigateTab(tab as AppTabId)}
          onCompleteScreening={onCompleteCognitiveScreening}
        />
      )}
    </div>
  );
};

export default DyslexiaScreeningHub;
