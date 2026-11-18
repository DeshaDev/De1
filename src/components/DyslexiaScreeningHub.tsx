import { toArabicNum } from '../utils/arabicDigits';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { KidPageHeader } from './ui/Playful';
import { BookOpen, Brain, Dumbbell } from 'lucide-react';
import { StudentRecord } from '../data/seedData';
const ReadingAssessmentView = lazy(() => import('./ReadingAssessmentView'));
import CognitiveBatteryView from './profile/CognitiveBatteryView';
import { AppTabId } from './HomeLandingView';

export type ScreeningSubTab = 'battery' | 'training' | 'oral-reading';

interface DyslexiaScreeningHubProps {
  students: StudentRecord[];
  activeStudent: StudentRecord;
  onSelectStudent: (id: string) => void;
  onNavigateTab: (tab: AppTabId) => void;
  onCompleteOralSession: (record: StudentRecord) => void;
  initialSubTab?: ScreeningSubTab;
  onStudentUpdated?: (student: StudentRecord) => void;
  onCreateLearner?: (input: { name: string; ageYears: number; examinerName: string; guardianConsentRecordedAt?: string; guardianAudioConsentGiven?: boolean; guardianAudioConsentRecordedAt?: string }) => string | null;
  supabaseUser?: any;
}

const TABS: Array<{ id: ScreeningSubTab; label: string; hint: string; icon: typeof Brain }> = [
  { id: 'battery', label: 'فحص مهارات القراءة', hint: 'ألعاب ومهام قراءة · من ٤ سنوات فأكثر', icon: Brain },
  { id: 'training', label: 'البرنامج التدريبي', hint: 'مبني على نتائج الفحص', icon: Dumbbell },
  { id: 'oral-reading', label: 'قراءة نص وفهمه', hint: 'قراءة وفهم · من ٦ سنوات', icon: BookOpen },
];

export const DyslexiaScreeningHub: React.FC<DyslexiaScreeningHubProps> = ({
  activeStudent,
  onNavigateTab,
  onCompleteOralSession,
  initialSubTab = 'battery',
  onStudentUpdated,
  onCreateLearner,
  supabaseUser,
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
          <KidPageHeader
            color={subTab === 'battery' ? 'sun' : 'sky'}
            eyebrow={subTab === 'battery' ? 'من ٤ سنوات فأكثر' : 'من ٦ سنوات'}
            title={subTab === 'battery' ? 'فحص مهارات القراءة' : 'قراءة نص وفهمه'}
            subtitle={
              subTab === 'battery'
                ? 'ألعاب قصيرة وممتعة لقياس مهارات القراءة، موزّعة على جلسات يمكنك إيقافها وإكمالها في أي وقت، تليها نتائج واضحة وبرنامج تدريبي مخصّص لطفلك.'
                : 'يقرأ الطفل نصًا قصيرًا بصوت عالٍ ثم يجيب عن أسئلة فهم بسيطة.'
            }
          />
          {subTab !== 'battery' && (
            <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 bz-small" aria-label="أدوات الفحص">
              <button type="button" className="bz-link" onClick={() => setSubTab('battery')}>
                العودة إلى فحص مهارات القراءة
              </button>
            </nav>
          )}
        </header>
      )}

      {!focused && subTab === 'training' && (
        <KidPageHeader
          color="leaf"
          mood="cheer"
          title="البرنامج التدريبي الموجّه"
          subtitle="جلسات قصيرة تركّز على أضعف مهارات الطفل في الفحص، وتتقدّم مستوى بعد مستوى عند الإتقان."
        />
      )}

      {(subTab === 'battery' || subTab === 'training') && (
        <CognitiveBatteryView
          key={subTab}
          activeStudent={activeStudent}
          initialView={subTab === 'training' ? 'training' : 'map'}
          onFocusModeChange={setFocused}
          onRecordUpdated={onStudentUpdated}
          onCreateLearner={onCreateLearner}
          onOpenExtra={(tab) => onNavigateTab(tab)}
          supabaseUser={supabaseUser}
          onNavigateTab={(tab) => onNavigateTab(tab as any)}
        />
      )}

      {!focused && subTab === 'battery' && (
        <nav className="flex flex-wrap items-center gap-2 bz-small pt-2 border-t border-line" aria-label="أدوات الفحص">
          <span className="bz-muted">للمعلم والأخصائي:</span>
          <button type="button" className="bz-btn bz-btn-ghost bz-btn-sm" onClick={() => setSubTab('oral-reading')}>
            قراءة نص وفهمه
          </button>
        </nav>
      )}

      <Suspense fallback={<div className="py-16 text-center bz-muted" role="status">جارٍ التحميل…</div>}>
      {subTab === 'oral-reading' && (
        <ReadingAssessmentView
          activeStudent={activeStudent}
          onCompleteSession={onCompleteOralSession}
          onNavigateTab={(tab) => onNavigateTab(tab as AppTabId)}
        />
      )}

      </Suspense>
    </div>
  );
};

export default DyslexiaScreeningHub;
