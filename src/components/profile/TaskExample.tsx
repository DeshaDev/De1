import React, { useEffect, useRef } from 'react';
import { Check, Volume2, X } from 'lucide-react';
import { lex } from '../../cognitiveProfile/lexicon';
import type { TaskExample } from '../../cognitiveProfile/examples';
import { Pic } from './TaskPlayers';
import { PlaybackHandle, speakSegments, stopSpeech } from './audio';

/** A worked example, read aloud, before the first question of a new kind. */
export function TaskExampleCard({ example, onReady }: { example: TaskExample; onReady: () => void }) {
  const handle = useRef<PlaybackHandle>({ cancelled: false });

  const play = () => {
    handle.current.cancelled = true;
    stopSpeech();
    const h: PlaybackHandle = { cancelled: false };
    handle.current = h;
    void speakSegments(example.audio.map((text) => ({ text, pauseAfterMs: 350 })), h);
  };

  useEffect(() => {
    play();
    return () => {
      handle.current.cancelled = true;
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [example]);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-5 text-center" dir="rtl">
      <span className="bz-badge bz-badge-sun">{example.titleAr}</span>
      <div className="flex flex-wrap justify-center gap-3">
        {example.rows.map((row, i) => (
          <div
            key={i}
            className={`min-w-[120px] rounded-2xl border-2 px-4 py-3 flex flex-col items-center gap-1.5 bg-card ${
              row.ok === true ? 'border-emerald-400' : row.ok === false ? 'border-rose-300' : 'border-sun'
            }`}
          >
            {row.picture ? (
              <span className="text-5xl"><Pic emoji={lex(row.picture).emoji} label={row.word} /></span>
            ) : (
              <span className="font-child text-3xl font-black text-ink" lang="ar">{row.glyph}</span>
            )}
            {row.picture && <span className="font-child text-lg font-bold text-ink" lang="ar">{row.word}</span>}
            {row.partAr && (
              <span className="rounded-xl bg-sun-soft px-3 py-1 font-child text-2xl font-black text-brand" lang="ar">{row.partAr}</span>
            )}
            {row.ok === true && <Check className="w-5 h-5 text-emerald-600" aria-label="يطابق" />}
            {row.ok === false && <X className="w-5 h-5 text-rose-500" aria-label="لا يطابق" />}
          </div>
        ))}
      </div>
      <p className="font-child text-lg sm:text-xl text-ink leading-relaxed bg-soft p-4 rounded-2xl border border-line">{example.explainAr}</p>
      <p className="font-child text-base sm:text-lg font-bold text-brand">{example.nowAr}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="bz-btn bz-btn-ghost" onClick={play}>
          <Volume2 className="w-5 h-5" /> استمع مرة أخرى
        </button>
        <button
          type="button"
          className="font-child bz-btn bz-btn-sun bz-btn-lg"
          onClick={() => {
            handle.current.cancelled = true;
            stopSpeech();
            onReady();
          }}
        >
          فهمت، لنبدأ
        </button>
      </div>
    </div>
  );
}
