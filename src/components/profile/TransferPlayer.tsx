/**
 * The transfer measure: one untrained word at a time, read aloud by the child and marked by the adult.
 * A calm reading screen: the word, and the adult's two buttons, nothing else.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { ReadItem } from '../../cognitiveProfile/readingTasks';

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const READING_FONT = { fontFamily: "'Noto Naskh Arabic', 'Amiri', serif" } as const;

export function AdultMarkedWord({
  item,
  hesitationSec,
  position,
  total,
  onDone,
}: {
  item: ReadItem;
  hesitationSec: number;
  position: number;
  total: number;
  onDone: (answer: { correct: boolean; rtMs: number }) => void;
}) {
  const shownAt = useRef(performance.now());
  const [waited, setWaited] = useState(0);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    shownAt.current = performance.now();
    setMarked(false);
    setWaited(0);
    const t = window.setInterval(() => setWaited((performance.now() - shownAt.current) / 1000), 500);
    return () => window.clearInterval(t);
  }, [item.id]);

  const mark = (correct: boolean) => {
    if (marked) return;
    setMarked(true);
    onDone({ correct, rtMs: Math.round(performance.now() - shownAt.current) });
  };

  return (
    <div className="w-full flex flex-col items-center gap-6" dir="rtl" data-calm-task="transfer">
      <p className="bz-small text-muted bz-num">الكلمة {ar(position)} من {ar(total)}</p>
      <div className="flex items-center justify-center min-h-[160px] min-w-[240px] px-10 rounded-[2rem] border-4 border-line bg-card">
        <span className="text-6xl sm:text-7xl font-bold text-ink leading-[1.6] select-none" style={READING_FONT} lang="ar">
          {item.text}
        </span>
      </div>
      <div className="w-full max-w-xl rounded-2xl border-2 border-dashed border-line bg-soft p-3 sm:p-4" role="group" aria-label="للبالغ">
        <p className="text-[12px] font-bold text-muted mb-2">للبالغ</p>
        <p className="bz-small text-ink-2 mb-3">هل قرأ الطفل الكلمة كلها صحيحة؟ لا تقرأها له ولا تلمّح.</p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => mark(true)} disabled={marked} className="bz-btn bz-btn-primary bz-btn-lg">
            <Check className="w-5 h-5" /> صحيح
          </button>
          <button type="button" onClick={() => mark(false)} disabled={marked} className="bz-btn bz-btn-secondary bz-btn-lg">
            <X className="w-5 h-5" /> خطأ أو لم يقرأ
          </button>
        </div>
        <p className="text-[12px] text-muted mt-2 h-4" aria-live="polite">
          {!marked && waited >= hesitationSec ? `مرّت ${ar(hesitationSec)} ثوانٍ دون محاولة: اضغط «خطأ» لننتقل.` : ''}
        </p>
      </div>
    </div>
  );
}

export default AdultMarkedWord;
