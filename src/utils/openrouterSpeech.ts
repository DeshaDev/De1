import { Mp3Encoder } from '@breezystack/lamejs';

function pcmToMp3(pcmBuffer: Buffer, sampleRate = 24000, channels = 1): Buffer {
  const mp3encoder = new Mp3Encoder(channels, sampleRate, 128);
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
  const mp3Data: Buffer[] = [];
  const sampleBlockSize = 1152;

  for (let i = 0; i < samples.length; i += sampleBlockSize) {
    const chunk = samples.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(Buffer.from(mp3buf));
    }
  }
  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(Buffer.from(endBuf));
  }
  return Buffer.concat(mp3Data);
}

function trimPcmSilence(pcmBuffer: Buffer, threshold = 300, sampleRate = 24000): Buffer {
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
  let start = 0;
  while (start < samples.length && Math.abs(samples[start]) < threshold) {
    start++;
  }
  let end = samples.length - 1;
  while (end > start && Math.abs(samples[end]) < threshold) {
    end--;
  }

  const prePad = Math.floor(sampleRate * 0.04);
  const postPad = Math.floor(sampleRate * 0.08);

  const realStart = Math.max(0, start - prePad);
  const realEnd = Math.min(samples.length, end + 1 + postPad);

  const trimmedSamples = samples.subarray(realStart, realEnd);
  return Buffer.from(trimmedSamples.buffer, trimmedSamples.byteOffset, trimmedSamples.byteLength);
}

export async function synthesizeNaturalArabicOpenRouter(text: string, voice = 'sage'): Promise<Buffer | null> {
  const key = process.env.OPENROUTER_API_KEY?.trim() || process.env.VITE_OPENROUTER_API_KEY?.trim();
  if (!key) return null;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-audio-mini',
        modalities: ['text', 'audio'],
        audio: {
          voice,
          format: 'pcm16',
        },
        stream: true,
        messages: [
          {
            role: 'system',
            content: 'أنتِ معلمة لغة عربية متخصصة للأطفال. تنطقين الفصحى بنطق بشري طبيعي ودافئ وواضح تماماً كمعلمة في استوديو تسجيل للأطفال، بمخارج حروف نقية ودقيقة، مع الوقف بالسكون وهاء الساكت عند التاء المربوطة. لا تنطقي أي كلمة باللغة الإنجليزية أبداً، ولا تضيفي أي كلام إضافي.',
          },
          {
            role: 'user',
            content: `انطقي فقط النص التالي بنطق عربي أصيل: "${text}".`,
          },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      console.warn('[OpenRouter Audio TTS] Response not ok:', res.status);
      return null;
    }

    const chunks: Buffer[] = [];
    const reader = res.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const audioData = json.choices?.[0]?.delta?.audio?.data;
            if (audioData) {
              chunks.push(Buffer.from(audioData, 'base64'));
            }
          } catch {}
        }
      }
    }

    const pcm = Buffer.concat(chunks);
    if (pcm.length === 0) return null;

    const trimmed = trimPcmSilence(pcm, 300, 24000);
    return pcmToMp3(trimmed, 24000, 1);
  } catch (err) {
    console.warn('[OpenRouter Audio TTS] Synthesis error:', err);
    return null;
  }
}
