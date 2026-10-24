/**
 * Browser-side audio conversion for Azure Speech SDK.
 *
 * MediaRecorder commonly produces WebM/Opus. Azure's file-based assessment
 * needs WAV/PCM; this utility decodes the recording, mixes it to mono,
 * resamples to 16 kHz and writes a standards-compliant 16-bit PCM WAV.
 */
export async function convertRecordedAudioToWavBase64(
  recording: Blob,
  targetSampleRate = 16000
): Promise<string> {
  if (!recording || recording.size === 0) {
    throw new Error('لم يصل تسجيل صوتي صالح للتحليل.');
  }
  if (typeof window === 'undefined') {
    throw new Error('تحويل الصوت متاح داخل المتصفح فقط.');
  }

  const AudioContextConstructor =
    window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error('المتصفح لا يدعم معالجة الصوت اللازمة للتقييم.');
  }

  const audioContext = new AudioContextConstructor();
  try {
    const encoded = await recording.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(encoded.slice(0));
    if (!decoded.length || !decoded.sampleRate || decoded.numberOfChannels < 1) {
      throw new Error('التسجيل الصوتي فارغ أو غير قابل للقراءة.');
    }

    const mono = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const samples = decoded.getChannelData(channel);
      for (let i = 0; i < samples.length; i += 1) mono[i] += samples[i] / decoded.numberOfChannels;
    }

    const outputLength = Math.max(1, Math.round(mono.length * targetSampleRate / decoded.sampleRate));
    const pcm = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i += 1) {
      const sourcePosition = i * decoded.sampleRate / targetSampleRate;
      const leftIndex = Math.min(mono.length - 1, Math.floor(sourcePosition));
      const rightIndex = Math.min(mono.length - 1, leftIndex + 1);
      const fraction = sourcePosition - leftIndex;
      const sample = mono[leftIndex] * (1 - fraction) + mono[rightIndex] * fraction;
      const clipped = Math.max(-1, Math.min(1, sample));
      pcm[i] = clipped < 0 ? Math.round(clipped * 0x8000) : Math.round(clipped * 0x7fff);
    }

    const wav = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(wav);
    const writeAscii = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    };
    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * 2, true);
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeAscii(36, 'data');
    view.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i += 1) view.setInt16(44 + i * 2, pcm[i], true);

    const bytes = new Uint8Array(wav);
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
      binary += String.fromCharCode(...chunk);
    }
    return window.btoa(binary);
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}
