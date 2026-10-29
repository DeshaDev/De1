import { toArabicNum } from '../utils/arabicDigits';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BookOpen, Brain, Dumbbell, Timer } from 'lucide-react';
import { StudentRecord, CognitiveScreeningData } from '../data/seedData';
const ReadingAssessmentView = lazy(() => import('./ReadingAssessmentView'));
const CognitiveScreeningView = lazy(() => import('./CognitiveScreeningView'));
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
      {!focused && subTab !== 'training' && (
        <header className="space-y-4">
          <div className="max-w-3xl">
            <span className="bz-eyebrow">{subTab === 'battery' ? 'من ٤ إلى ٨ سنوات' : 'من الصف الأول إلى السادس'}</span>
            <h1 className="bz-h2 mt-2">
              {subTab === 'battery' ? 'الفحص المعرفي الشامل لمهارات القراءة' : subTab === 'oral-reading' ? 'قراءة نص وفهمه' : 'التسمية السريعة والكلمات غير الحقيقية'}
            </h1>
            <p className="bz-body mt-2">
              {subTab === 'battery'
                ? `تسع ألعاب قصيرة (نحو ${toArabicNum(TOTAL_BATTERY_MINUTES)} دقيقة) ترسم ملفًا معرفيًا للطفل مقارنةً بأقرانه في العمر، ثم تقترح استراتيجيات وبرنامجًا تدريبيًا.`
                : (subTab === 'oral-reading' ? 'يقرأ الطفل نصًّا مناسبًا لصفه بصوت مسموع، ثم يجيب عن أسئلة الفهم. ' : 'يسمّي الطفل صورًا وألوانًا بسرعة، ويقرأ كلمات لا معنى لها. ') + 'أداة تكميلية للأخصائي بعد بدء تعلّم القراءة، تُستخدم إلى جانب الفحص الشامل لا بديلًا عنه.'}
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 bz-small" aria-label="أدوات الفحص">
            {subTab !== 'battery' && (
              <button type="button" className="bz-link" onClick={() => setSubTab('battery')}>
                العودة إلى الفحص الشامل
              </button>
            )}
            {subTab === 'battery' && <span className="bz-muted">أدوات تكميلية للأخصائي:</span>}
            {TABS.filter((t) => t.id === 'oral-reading' || t.id === 'cognitive-screening').map((tab) => {
              const Icon = tab.icon;
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubTab(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`bz-btn bz-btn-sm ${active ? 'bz-btn-secondary' : 'bz-btn-ghost'}`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" /> {tab.label}
                </button>
              );
            })}
          </nav>
        </header>
      )}

      {!focused && subTab === 'training' && (
        <header className="max-w-3xl">
          <h1 className="bz-h2">البرنامج التدريبي الموجّه</h1>
          <p className="bz-body mt-2">جلسات قصيرة تركّز على أضعف مهارات الطفل في الفحص، وتتقدّم مستوى بعد مستوى عند الإتقان.</p>
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

      <Suspense fallback={<div className="py-16 text-center bz-muted" role="status">جارٍ التحميل…</div>}>
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
      </Suspense>
    </div>
  );
};

export default DyslexiaScreeningHub;
