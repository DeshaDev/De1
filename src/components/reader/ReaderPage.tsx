/**
 * The reading assistant page. Children start in guided reading (one short sentence at a time);
 * the full-text reader and the spelling/dialect analysis stay available as specialist tools.
 */
import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AdaptiveReaderView } from '../AdaptiveReaderView';
import { FocusReader } from './FocusReader';

interface ReaderPageProps {
  problematicWords?: string[];
  studentName?: string;
  passageId?: string;
}

export const ReaderPage: React.FC<ReaderPageProps> = ({ problematicWords, studentName, passageId }) => {
  const [mode, setMode] = useState<'guided' | 'tools'>('guided');

  if (mode === 'tools') {
    return (
      <div className="space-y-4" dir="rtl">
        <button type="button" className="bz-btn bz-btn-ghost bz-btn-sm" onClick={() => setMode('guided')}>
          <ArrowRight className="w-4 h-4" /> العودة إلى القراءة الموجّهة
        </button>
        <AdaptiveReaderView problematicWords={problematicWords} studentName={studentName} passageId={passageId} />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <header className="space-y-2">
        <h1 className="bz-h2">القارئ الميسّر</h1>
        <p className="bz-lead bz-muted max-w-2xl">جملة قصيرة واحدة على الشاشة في كل مرة: يستمع الطفل، ثم يقرأ معنا، ثم وحده، ثم يجيب عن سؤال سريع.</p>
      </header>
      <FocusReader
        studentName={studentName}
        problematicWords={problematicWords}
        passageId={passageId}
        onOpenTools={() => setMode('tools')}
      />
    </div>
  );
};
