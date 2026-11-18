export function trimPcmSilence(pcmBuffer, threshold = 350, sampleRate = 24000) {
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
  let start = 0;
  while (start < samples.length && Math.abs(samples[start]) < threshold) {
    start++;
  }
  let end = samples.length - 1;
  while (end > start && Math.abs(samples[end]) < threshold) {
    end--;
  }

  // Add 40ms pre-pad and 80ms post-pad
  const prePad = Math.floor(sampleRate * 0.04);
  const postPad = Math.floor(sampleRate * 0.08);

  const realStart = Math.max(0, start - prePad);
  const realEnd = Math.min(samples.length, end + 1 + postPad);

  const trimmedSamples = samples.subarray(realStart, realEnd);
  return Buffer.from(trimmedSamples.buffer, trimmedSamples.byteOffset, trimmedSamples.byteLength);
}
