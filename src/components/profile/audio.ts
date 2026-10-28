import type { AudioSegment } from '../../cognitiveProfile/battery';
import { playNaturalArabicAudio, stopNaturalArabicAudio } from '../../utils/naturalSpeech';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Speak one utterance and resolve when it ends. Falls back to an estimated duration when the
 * speech engine never reports the end (some browsers, or no Arabic voice installed).
 */
export async function speak(text: string): Promise<void> {
  const estimateMs = Math.max(1200, Array.from(text).length * 110 + 500);
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    playNaturalArabicAudio(text, { onEnd: done, onError: done })
      .then(() => setTimeout(done, estimateMs))
      .catch(done);
  });
}

export interface PlaybackHandle {
  cancelled: boolean;
}

/** Speak segments in order, calling onHighlight with each segment's highlight target. */
export async function speakSegments(
  segments: AudioSegment[],
  handle: PlaybackHandle,
  onHighlight?: (target: string | null) => void
): Promise<void> {
  for (const segment of segments) {
    if (handle.cancelled) return;
    onHighlight?.(segment.highlight ?? null);
    await speak(segment.text);
    if (handle.cancelled) return;
    if (segment.pauseAfterMs) await wait(segment.pauseAfterMs);
  }
  onHighlight?.(null);
}

export function stopSpeech(): void {
  stopNaturalArabicAudio();
}

export { wait };
