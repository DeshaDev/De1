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
  onStudentUpdated?: (student: StudentRecord) => void;
  onCreateLearner?: (input: { name: string; ageYears: number; examinerName: string }) => string | null;
}

const TABS: Array<{ id: ScreeningSubTab; label: string; hint: string; icon: typeof Brain }> = [
  { id: 'battery', label: 'الفحص الشامل', hint: '٩ ألعاب · ٤–٨ سنوات', icon: Brain },
  { id: 'training', label: 'البرنامج التدريبي', hint: 'مبني على نتائج الفحص', icon: Dumbbell },
  { id: 'oral-reading', label: 'قراءة نص وفهمه', hint: 'أداة تكميلية · من الصف الأول', icon: BookOpen },
  { id: 'cognitive-screening', label: 'التسمية السريعة', hint: 'التسمية السريعة والكلمات غير الحقيقية · أداة تكميلية', icon: Timer },
];

export const DyslexiaScreeningHub: React.FC<DyslexiaScreeningHubProps> = ({
  activeStudent,
  onNavigateTab,
  onCompleteOralSession,
  onCompleteCognitiveScreening,
  initialSubTab = 'battery',
  onStudentUpdated,
  onCreateLearner,
}) => {
  const [subTab, setSubTab] = useState<ScreeningSubTab>(initialSubTab);
  const [focused, setFocused] = useState(false);
  useEffect(() => setSubTab(initialSubTab), [initialSubTab]);
  // While a child plays, hide the whole site chrome so the game fills the screen.
  useEffect(() => {
    if (!focused) return;
    document.body.classList.add('baseera-reading-focus');
    return () => document.body.classList.remove('baseera-reading-focus');
  }, [focused]);

  return (
    <div className="space-y-6" dir="rtl">
      {!focused && (
        <header className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="max-w-3xl">
              <span className="bz-eyebrow">{subTab === 'training' ? 'بعد الفحص' : 'فحص مبكر · من ٤ إلى ٨ سنوات'}</span>
              <h1 className="bz-h2 mt-2">
                {subTab === 'training' ? 'البرنامج التدريبي الموجّه' : 'الفحص المعرفي الشامل لمهارات القراءة'}
              </h1>
              <p className="bz-body mt-2">
                {subTab === 'training'
                  ? 'جلسات قصيرة تركّز على أضعف مهارات الطفل في الفحص، وتتقدّم مستوى بعد مستوى عند الإتقان.'
                  : `تسع ألعاب قصيرة (نحو ${TOTAL_BATTERY_MINUTES} دقيقة) ترسم ملفًا معرفيًا للطفل مقارنةً بأقرانه في العمر، ثم تقترح استراتيجيات وبرنامجًا تدريبيًا.`}
              </p>
            </div>
          </div>
          <nav className="bz-segment" aria-label="أقسام الفحص">
            {TABS.map((tab, i) => {
              const Icon = tab.icon;
              const active = subTab === tab.id;
              return (
                <React.Fragment key={tab.id}>
                  {i === 2 && <span aria-hidden="true" className="w-px self-stretch my-2 bg-line-strong mx-1" />}
                  <button type="button" onClick={() => setSubTab(tab.id)} aria-current={active ? 'page' : undefined} title={tab.hint}>
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" /> {tab.label}
                  </button>
                </React.Fragment>
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
          onRecordUpdated={onStudentUpdated}
          onCreateLearner={onCreateLearner}
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
