import { toArabicNum } from '../utils/arabicDigits';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { KidPageHeader } from './ui/Playful';
import { BookOpen, Brain, Dumbbell } from 'lucide-react';
import { StudentRecord } from '../data/seedData';
const ReadingAssessmentView = lazy(() => import('./ReadingAssessmentView'));
import CognitiveBatteryView from './profile/CognitiveBatteryView';
import { AppTabId } from './HomeLandingView';
import { TOTAL_BATTERY_MINUTES } from '../cognitiveProfile/battery';

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
  { id: 'battery', label: 'فحص مؤشرات عسر القراءة', hint: 'ألعاب ومهام قراءة · ٤–٨ سنوات', icon: Brain },
  { id: 'training', label: 'البرنامج التدريبي', hint: 'مبني على نتائج الفحص', icon: Dumbbell },
  { id: 'oral-reading', label: 'قراءة نص وفهمه', hint: 'أداة تكميلية · من الصف الأول', icon: BookOpen },
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
            eyebrow={subTab === 'battery' ? 'من ٤ إلى ٨ سنوات' : 'من الصف الأول إلى السادس'}
            title={subTab === 'battery' ? 'فحص مؤشرات عسر القراءة' : subTab === 'oral-reading' ? 'قراءة نص وفهمه' : 'التسمية السريعة والكلمات غير الحقيقية'}
            subtitle={
              subTab === 'battery'
                ? `ألعاب قصيرة للمهارات السابقة للقراءة والتسمية السريعة، ومن سن السادسة مهام قراءة وإملاء مباشرة (نحو ${toArabicNum(TOTAL_BATTERY_MINUTES)} دقيقة موزّعة على عدة جلسات). يعرض التقرير أداء الطفل في كل مهمة، ثم يقترح أنشطة وبرنامجًا تدريبيًا.`
                : 'يقرأ الطفل نصًا مناسبًا لعمره ثم يجيب عن أسئلة الفهم. يمكن تحليل القراءة الصوتية آليًا بموافقة منفصلة؛ وإذا تعذّر التقييم يكمل الطفل دون درجة صوتية.'
            }
          />
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 bz-small" aria-label="أدوات الفحص">
            {subTab !== 'battery' && (
              <button type="button" className="bz-link" onClick={() => setSubTab('battery')}>
                العودة إلى فحص مؤشرات عسر القراءة
              </button>
            )}
            {subTab === 'battery' && <span className="bz-muted">أداة إضافية:</span>}
            {TABS.filter((t) => t.id === 'oral-reading').map((tab) => {
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
