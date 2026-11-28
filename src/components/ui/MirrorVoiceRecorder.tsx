import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, RotateCcw, Sparkles, Square, Volume2 } from 'lucide-react';
import { playMagicBrushSound } from '../../utils/soundEffects';

export interface MirrorVoiceRecorderProps {
  /** Target Arabic letter, word, or short sentence for comparison */
  targetText: string;
  /** Optional custom button/card title in Arabic */
  labelAr?: string;
  /** Compact inline layout (great inside story reader card) */
  compact?: boolean;
  /** Speaks the teacher audio for targetText */
  onSpeakTeacher: (text: string) => Promise<void> | void;
  /** Optional callback fired once the child completes a recording + comparison */
  onCompleted?: () => void;
}

type RecorderStatus = 'idle' | 'recording' | 'teacher_turn' | 'child_turn' | 'done' | 'unsupported';

const MAX_RECORD_MS = 3500;

export const MirrorVoiceRecorder: React.FC<MirrorVoiceRecorderProps> = ({
  targetText,
  labelAr = 'سجّل صوتك واسمعه بجانب المعلّمة',
  compact = false,
  onSpeakTeacher,
  onCompleted,
}) => {
  const [status, setStatus] = useState<RecorderStatus>(() => {
    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      return 'unsupported';
    }
    return 'idle';
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(3);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopTimeoutRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const childAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordedUrlRef = useRef<string | null>(null);
  const mountedRef = useRef<boolean>(true);

  const cleanupTimers = useCallback(() => {
    if (stopTimeoutRef.current !== null) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (countdownRef.current !== null) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopAudioPlayback = useCallback(() => {
    if (childAudioRef.current) {
      childAudioRef.current.pause();
      childAudioRef.current.currentTime = 0;
      childAudioRef.current = null;
    }
  }, []);

  const revokeUrl = useCallback(() => {
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
  }, []);

  // Reset when targetText changes so each word/letter has a fresh slate
  useEffect(() => {
    cleanupTimers();
    stopTracks();
    stopAudioPlayback();
    revokeUrl();
    setRecordedUrl(null);
    setErrorMsg(null);
    if (status !== 'unsupported') {
      setStatus('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetText]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupTimers();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore cleanup errors
        }
      }
      stopTracks();
      stopAudioPlayback();
      revokeUrl();
    };
  }, [cleanupTimers, revokeUrl, stopAudioPlayback, stopTracks]);

  const playSideBySide = useCallback(
    async (audioUrlToPlay: string) => {
      if (!mountedRef.current) return;
      stopAudioPlayback();
      setErrorMsg(null);
      setStatus('teacher_turn');

      try {
        await Promise.resolve(onSpeakTeacher(targetText));
      } catch {
        // Proceed to child voice even if teacher TTS had an issue
      }

      if (!mountedRef.current) return;
      await new Promise((r) => window.setTimeout(r, 320));
      if (!mountedRef.current) return;

      setStatus('child_turn');
      await new Promise<void>((resolve) => {
        const audio = new Audio(audioUrlToPlay);
        childAudioRef.current = audio;
        audio.onended = () => {
          childAudioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          childAudioRef.current = null;
          resolve();
        };
        audio.play().catch(() => {
          childAudioRef.current = null;
          resolve();
        });
      });

      if (!mountedRef.current) return;
      playMagicBrushSound(1);
      setStatus('done');
      onCompleted?.();
    },
    [onCompleted, onSpeakTeacher, stopAudioPlayback, targetText]
  );

  const stopRecording = useCallback(() => {
    cleanupTimers();
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === 'recording') {
      try {
        rec.stop();
      } catch {
        // Ignore stop errors
      }
    }
  }, [cleanupTimers]);

  const startRecording = useCallback(async () => {
    if (status === 'unsupported') return;
    cleanupTimers();
    stopAudioPlayback();
    setErrorMsg(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        cleanupTimers();
        stopTracks();
        if (!mountedRef.current) return;
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 200) {
          setErrorMsg('لم نلتقط صوتًا واضحًا، جرّب الاقتراب قليلًا.');
          setStatus('idle');
          return;
        }

        revokeUrl();
        const url = URL.createObjectURL(blob);
        recordedUrlRef.current = url;
        setRecordedUrl(url);
        void playSideBySide(url);
      };

      recorder.start();
      setStatus('recording');
      setSecondsLeft(3);

      countdownRef.current = window.setInterval(() => {
        setSecondsLeft((prev) => (prev > 1 ? prev - 1 : 1));
      }, 1000);

      stopTimeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, MAX_RECORD_MS);
    } catch {
      stopTracks();
      setErrorMsg('نحتاج إذن الميكروفون في المتصفح لتسجيل صوتك.');
      setStatus('idle');
    }
  }, [cleanupTimers, playSideBySide, revokeUrl, status, stopAudioPlayback, stopRecording, stopTracks]);

  if (status === 'unsupported') {
    return null;
  }

  return (
    <div
      dir="rtl"
      className={`rounded-[22px] border border-[#dce8dc] bg-gradient-to-l from-[#f8fbf7] to-[#fffdf7] ${
        compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5'
      } shadow-xs`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`inline-flex shrink-0 items-center justify-center rounded-full ${
              status === 'recording'
                ? 'bg-[#fee2e2] text-[#b91c1c] animate-pulse'
                : status === 'teacher_turn' || status === 'child_turn'
                ? 'bg-[#fef3c7] text-[#92400e]'
                : status === 'done'
                ? 'bg-[#dcfce7] text-[#15803d]'
                : 'bg-[#eef6ee] text-[#245a3d]'
            } ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}
          >
            {status === 'done' ? <Sparkles className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className={`font-black text-[#17281e] ${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>
              {status === 'recording'
                ? `🎙️ اقرأ الآن... (${secondsLeft} ث)`
                : status === 'teacher_turn'
                ? '👩‍🏫 استمع لصوت المعلّمة...'
                : status === 'child_turn'
                ? '🌟 والآن اسمع صوتك الجميل!'
                : status === 'done'
                ? '✨ أحسنت! سمعتَ المعلّمة وصوتك معًا'
                : labelAr}
            </p>
            {errorMsg && <p className="text-xs font-bold text-[#b91c1c] mt-0.5">{errorMsg}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status === 'recording' ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#dc2626] px-4 py-2 text-xs sm:text-sm font-black text-white shadow-sm hover:bg-[#b91c1c] transition-colors cursor-pointer"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              إيقاف وسماع
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={status === 'teacher_turn' || status === 'child_turn'}
                onClick={() => void startRecording()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#1a4d2e] px-4 py-2 text-xs sm:text-sm font-black text-white shadow-sm hover:bg-[#143d24] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {recordedUrl ? <RotateCcw className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {recordedUrl ? 'سجّل مرة أخرى' : 'سجّل صوتك'}
              </button>

              {recordedUrl && (
                <button
                  type="button"
                  disabled={status === 'teacher_turn' || status === 'child_turn'}
                  onClick={() => void playSideBySide(recordedUrl)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b25e] bg-[#fff8e6] px-3.5 py-2 text-xs sm:text-sm font-black text-[#7a5200] hover:bg-[#fef0cc] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  المعلّمة ثم صوتي
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
