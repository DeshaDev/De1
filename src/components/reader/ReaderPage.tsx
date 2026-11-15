/**
 * The reading assistant page. Children start in guided reading (one short sentence at a time);
 * the full-text reader and the spelling/dialect analysis stay available as specialist tools.
 */
import React, { useCallback, useState } from 'react';
import { KidPageHeader } from '../ui/Playful';
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
  const [reading, setReading] = useState(false);
  const onReadingChange = useCallback((r: boolean) => setReading(r), []);

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
      {!reading && (
        <KidPageHeader color="sky" title="القارئ الميسّر" subtitle="جملة قصيرة واحدة على الشاشة في كل مرة.">
          <button type="button" className="bz-btn bz-btn-ghost bz-btn-sm mt-2" onClick={() => setMode('tools')}>
            أدوات الأخصائي
          </button>
        </KidPageHeader>
      )}
      <FocusReader studentName={studentName} problematicWords={problematicWords} passageId={passageId} onReadingChange={onReadingChange} />
    </div>
  );
};
