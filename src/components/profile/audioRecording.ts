export interface RecordedWavAudio {
  audioWavBase64: string;
  durationSeconds: number;
}

export interface WavRecordingController {
  stop(): Promise<RecordedWavAudio>;
  cancel(): void;
}

type AudioContextConstructor = typeof AudioContext & {
  new (): AudioContext;
};

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const root = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext || root.webkitAudioContext || null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function encodePcmWav(blob: Blob, minimumDurationSeconds = 1): Promise<RecordedWavAudio> {
  const AudioContextClass = getAudioContextConstructor();
  if (!AudioContextClass) throw new Error('AUDIO_CONTEXT_UNAVAILABLE');

  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const targetRate = 16_000;
    const durationSeconds = decoded.duration;
    if (!Number.isFinite(durationSeconds) || durationSeconds < minimumDurationSeconds || durationSeconds > 88) {
      throw new Error('AUDIO_DURATION_OUT_OF_RANGE');
    }

    const frameCount = Math.floor(decoded.length * targetRate / decoded.sampleRate);
    const mono = new Float32Array(frameCount);
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, channel) => decoded.getChannelData(channel));

    for (let outputIndex = 0; outputIndex < frameCount; outputIndex++) {
      const sourcePosition = outputIndex * decoded.sampleRate / targetRate;
      const sourceIndex = Math.floor(sourcePosition);
      const fraction = sourcePosition - sourceIndex;
      let sample = 0;
      for (const channel of channels) {
        const first = channel[Math.min(sourceIndex, channel.length - 1)] || 0;
        const second = channel[Math.min(sourceIndex + 1, channel.length - 1)] || first;
        sample += first + (second - first) * fraction;
      }
      mono[outputIndex] = Math.max(-1, Math.min(1, sample / channels.length));
    }

    const wavBuffer = new ArrayBuffer(44 + mono.length * 2);
    const view = new DataView(wavBuffer);
    const writeText = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    writeText(0, 'RIFF');
    view.setUint32(4, 36 + mono.length * 2, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, 'data');
    view.setUint32(40, mono.length * 2, true);

    for (let i = 0; i < mono.length; i++) {
      const sample = mono[i];
      view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    return {
      audioWavBase64: bytesToBase64(new Uint8Array(wavBuffer)),
      durationSeconds: Math.round(durationSeconds * 10) / 10,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}

/** Capture the actual microphone stream; browser speech-to-text is never used as assessment evidence. */
export async function startWavRecording(options: { minimumDurationSeconds?: number } = {}): Promise<WavRecordingController> {
  const minimumDurationSeconds = options.minimumDurationSeconds ?? 1;
  if (!Number.isFinite(minimumDurationSeconds) || minimumDurationSeconds < 0.25 || minimumDurationSeconds > 1) {
    throw new Error('INVALID_MINIMUM_RECORDING_DURATION');
  }
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === 'undefined'
  ) {
    throw new Error('AUDIO_RECORDING_UNAVAILABLE');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
  const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
  let recorder: MediaRecorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }

  const chunks: BlobPart[] = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  const stopped = new Promise<void>((resolve) => {
    recorder.addEventListener('stop', () => resolve(), { once: true });
  });
  recorder.start(500);

  let settled = false;
  const release = () => stream.getTracks().forEach((track) => track.stop());

  return {
    stop: async () => {
      if (settled) throw new Error('RECORDING_ALREADY_FINISHED');
      settled = true;
      if (recorder.state !== 'inactive') recorder.stop();
      await stopped;
      release();
      if (chunks.length === 0) throw new Error('EMPTY_AUDIO_RECORDING');
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      return encodePcmWav(blob, minimumDurationSeconds);
    },
    cancel: () => {
      if (settled) return;
      settled = true;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // The stream is still released even if the browser has already stopped recording.
      }
      release();
      chunks.length = 0;
    },
  };
}
