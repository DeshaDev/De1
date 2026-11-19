import fs from 'node:fs';
import path from 'node:path';
import { Mp3Encoder } from '@breezystack/lamejs';
import { trimPcmSilence } from './pcmUtils.mjs';

const env = fs.readFileSync('.env', 'utf8');
const key = env.match(/OPENROUTER_API_KEY=(.*)/)?.[1]?.trim();

if (!key) {
  console.error('OPENROUTER_API_KEY is required!');
  process.exit(1);
}

function normalizeSpokenText(text) {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ');
}

function audioKey(text) {
  const input = new TextEncoder().encode(normalizeSpokenText(text));
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of input) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

function pcmToMp3(pcmBuffer, sampleRate = 24000, channels = 1) {
  const mp3encoder = new Mp3Encoder(channels, sampleRate, 128);
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
  const mp3Data = [];
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

async function synthesizeText(targetText, voice = 'sage', maxAttempts = 3) {
  const targetWords = targetText.trim().split(/\s+/).length;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-audio-mini',
        modalities: ['text', 'audio'],
        audio: {
          voice,
          format: 'pcm16'
        },
        stream: true,
        messages: [
          {
            role: 'system',
            content: 'You are an educational Classical Arabic audio pronunciation engine for children. Pronounce ONLY the exact Arabic text provided by the user with crystal-clear human articulation and natural pausal waqf. STRICT RULE: Speak ONLY the target text itself. NEVER explain, never say intro words, never chat.'
          },
          {
            role: 'user',
            content: targetText
          }
        ]
      })
    });

    if (!res.ok) {
      throw new Error(`API error ${res.status}: ${await res.text()}`);
    }

    const chunks = [];
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let transcript = '';

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
            const t = json.choices?.[0]?.delta?.audio?.transcript;
            if (t) transcript += t;
            const audioData = json.choices?.[0]?.delta?.audio?.data;
            if (audioData) {
              chunks.push(Buffer.from(audioData, 'base64'));
            }
          } catch {}
        }
      }
    }

    const pcm = Buffer.concat(chunks);
    const durationSec = pcm.length / 48000;
    const spokenWordsCount = transcript.trim().split(/\s+/).filter(Boolean).length;

    // Check if the model added conversational chatter
    if (targetWords <= 2 && (spokenWordsCount > targetWords + 2 || durationSec > 3.0)) {
      console.warn(`    Attempt ${attempt}: Model chatter detected (transcript: "${transcript.trim()}", duration: ${durationSec.toFixed(1)}s). Retrying...`);
      continue;
    }

    const trimmedPcm = trimPcmSilence(pcm, 300, 24000);
    const finalDuration = (trimmedPcm.length / 48000).toFixed(2);
    console.log(`    Success! Spoken: "${transcript.trim()}", Duration: ${finalDuration}s`);
    return pcmToMp3(trimmedPcm, 24000, 1);
  }

  throw new Error(`Failed to synthesize "${targetText}" without chatter after ${maxAttempts} attempts.`);
}

const PUBLIC_AUDIO_DIR = path.resolve('public/audio/v1');
const DIST_AUDIO_DIR = path.resolve('dist/audio/v1');
const MANIFEST_PATH = path.join(PUBLIC_AUDIO_DIR, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const TARGET_CLIPS = [
  {
    file: 'abihi.mp3',
    primaryKey: 'abihi',
    text: 'أَبِيهْ',
    aliases: ['أَبِيهِ', 'أَبِيهْ', 'أبيه'],
    context: 'single_word',
    voiceText: 'أَبِيهْ'
  },
  {
    file: 'ilayhi.mp3',
    primaryKey: 'ilayhi',
    text: 'إِلَيْهْ',
    aliases: ['إِلَيْهِ', 'إِلَيْهْ', 'إليه'],
    context: 'single_word',
    voiceText: 'إِلَيْهْ'
  },
  {
    file: '3a64d02b160ad10a.mp3',
    primaryKey: '3a64d02b160ad10a',
    text: 'إِلَيْهْ',
    aliases: ['3a64d02b160ad10a'],
    context: 'single_word',
    voiceText: 'إِلَيْهْ'
  },
  {
    file: 'bb82616784e3e672.mp3',
    primaryKey: 'bb82616784e3e672',
    text: 'هَذَا سَالِي.',
    aliases: ['هَذَا سَالِي.'],
    context: 'pal',
    voiceText: 'هَذَا سَالِي.'
  },
  {
    file: '756041c85f3a5b10.mp3',
    primaryKey: '756041c85f3a5b10',
    text: 'هَذَا كُودَا.',
    aliases: ['هَذَا كُودَا.', 'وَهَذَا كُودَا.', 'وَهَذَا كُودَاء'],
    context: 'pal',
    voiceText: 'هَذَا كُودَا.'
  },
  {
    file: '35c23f42b09847e2.mp3',
    primaryKey: '35c23f42b09847e2',
    text: 'أَيْنَ كُودَا؟',
    aliases: ['أَيْنَ كُودَا؟'],
    context: 'pal',
    voiceText: 'أَيْنَ كُودَا؟'
  },
  {
    file: '94216fdb62db3e34.mp3',
    primaryKey: '94216fdb62db3e34',
    text: 'أَيْنَ سَالِي؟',
    aliases: ['أَيْنَ سَالِي؟'],
    context: 'pal',
    voiceText: 'أَيْنَ سَالِي؟'
  },
  {
    file: '2d250b1d9d406130.mp3',
    primaryKey: '2d250b1d9d406130',
    text: 'نَعَمْ، هَذَا كُودَا!',
    aliases: ['نَعَمْ، هَذَا كُودَا!'],
    context: 'pal',
    voiceText: 'نَعَمْ، هَذَا كُودَا!'
  },
  {
    file: '0f105889dfe779de.mp3',
    primaryKey: '0f105889dfe779de',
    text: 'نَعَمْ، هَذَا سَالِي!',
    aliases: ['نَعَمْ، هَذَا سَالِي!'],
    context: 'pal',
    voiceText: 'نَعَمْ، هَذَا سَالِي!'
  },
  {
    file: '58b8eecb84758036.mp3',
    primaryKey: '58b8eecb84758036',
    text: 'فُوبُو',
    aliases: ['فُوب', 'فُوبُ', 'فُوْبُ', 'فوبو', 'فُوبُو'],
    context: 'single_word',
    voiceText: 'فُوبُو'
  },
  {
    file: 'e316ebbe60a2dadc.mp3',
    primaryKey: 'e316ebbe60a2dadc',
    text: 'بَاكْ',
    aliases: ['بَاكْ', 'بَاك'],
    context: 'single_word',
    voiceText: 'بَاكْ'
  },
  {
    file: '1ff1fc7e4c0bceb9.mp3',
    primaryKey: '1ff1fc7e4c0bceb9',
    text: 'دِيكْ',
    aliases: ['دِيكْ', 'دِيك', 'دِيكٌ'],
    context: 'single_word',
    voiceText: 'دِيكْ'
  },
  {
    file: '73aad2de91c83cee.mp3',
    primaryKey: '73aad2de91c83cee',
    text: 'جَمَلْ',
    aliases: ['جَمَلْ', 'جَمَل', 'جَمَلُ', 'جَمَلٌ'],
    context: 'single_word',
    voiceText: 'جَمَلْ'
  },
  {
    file: '374488e547311f8d.mp3',
    primaryKey: '374488e547311f8d',
    text: 'دَجَاجَهْ',
    aliases: ['دَجَاجَة', 'دَجَاجَةُ', 'دَجَاجَهْ'],
    context: 'single_word',
    voiceText: 'دَجَاجَهْ'
  },
  {
    file: 'bdfae00789dcc5b6.mp3',
    primaryKey: 'bdfae00789dcc5b6',
    text: 'ذُرَهْ',
    aliases: ['ذُرَة', 'ذُرَةُ', 'ذُرَهْ'],
    context: 'single_word',
    voiceText: 'ذُرَهْ'
  },
  {
    file: '95e0c8fb053cd4a3.mp3',
    primaryKey: '95e0c8fb053cd4a3',
    text: 'سَيَّارَهْ',
    aliases: ['سَيَّارَة', 'سَيَّارَةُ', 'سَيَّارَهْ'],
    context: 'single_word',
    voiceText: 'سَيَّارَهْ'
  },
  {
    file: '178d12ebd07d6686.mp3',
    primaryKey: '178d12ebd07d6686',
    text: 'عُصْفُورْ',
    aliases: ['عُصْفُور', 'عُصْفُورُ', 'عُصْفُورْ'],
    context: 'single_word',
    voiceText: 'عُصْفُورْ'
  },
  {
    file: 'e1282bea9dc9b820.mp3',
    primaryKey: 'e1282bea9dc9b820',
    text: 'فِيلْ',
    aliases: ['فِيل', 'فِيلُ', 'فِيلْ'],
    context: 'single_word',
    voiceText: 'فِيلْ'
  },
  // Curriculum instructional phrases
  {
    file: `${audioKey('اِسْمَعِ الْكَلِمَةَ بِهُدُوءٍ، وَانْتَبِهْ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. اكْتُبِ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ تَزِيدَ حَرْفًا.')}.mp3`,
    primaryKey: audioKey('اِسْمَعِ الْكَلِمَةَ بِهُدُوءٍ، وَانْتَبِهْ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. اكْتُبِ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ تَزِيدَ حَرْفًا.'),
    text: 'اِسْمَعِ الْكَلِمَةَ بِهُدُوءٍ، وَانْتَبِهْ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. اكْتُبِ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ تَزِيدَ حَرْفًا.',
    aliases: [
      'اِسْمَعِ الْكَلِمَةَ بِهُدُوءٍ، وَانْتَبِهْ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. اكْتُبِ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ تَزِيدَ حَرْفًا.',
      'أَسْمَعُ الْكَلِمَةَ بِهُدُوءٍ، وَأَنْتَبِهُ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. أَكْتُبُ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ أَزِيدَ حَرْفًا.'
    ],
    context: 'instruction',
    voiceText: 'اِسْمَعِ الْكَلِمَةَ بِهُدُوءٍ، وَانْتَبِهْ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. اكْتُبِ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ تَزِيدَ حَرْفًا.'
  },
  {
    file: `${audioKey('مِثَالٌ... كَلِمَةُ: هُدَى. تَنْتَهِي الْكَلِمَةُ بِأَلِفٍ مَقْصُورَةٍ: ى، وَلَيْسَتْ بِيَاءٍ: ي. انْظُرْ إِلَى الْكَلِمَةِ كَامِلَةً، لَا إِلَى صَوْتِ النِّهَايَةِ وَحْدَهُ.')}.mp3`,
    primaryKey: audioKey('مِثَالٌ... كَلِمَةُ: هُدَى. تَنْتَهِي الْكَلِمَةُ بِأَلِفٍ مَقْصُورَةٍ: ى، وَلَيْسَتْ بِيَاءٍ: ي. انْظُرْ إِلَى الْكَلِمَةِ كَامِلَةً، لَا إِلَى صَوْتِ النِّهَايَةِ وَحْدَهُ.'),
    text: 'مِثَالٌ... كَلِمَةُ: هُدَى. تَنْتَهِي الْكَلِمَةُ بِأَلِفٍ مَقْصُورَةٍ: ى، وَلَيْسَتْ بِيَاءٍ: ي. انْظُرْ إِلَى الْكَلِمَةِ كَامِلَةً، لَا إِلَى صَوْتِ النِّهَايَةِ وَحْدَهُ.',
    aliases: [
      'مِثَالٌ... كَلِمَةُ: هُدَى. تَنْتَهِي الْكَلِمَةُ بِأَلِفٍ مَقْصُورَةٍ: ى، وَلَيْسَتْ بِيَاءٍ: ي. انْظُرْ إِلَى الْكَلِمَةِ كَامِلَةً، لَا إِلَى صَوْتِ النِّهَايَةِ وَحْدَهُ.',
      'مِثَالٌ: هُدَى. تَنْتَهِي الْكَلِمَةُ بِأَلِفٍ مَقْصُورَةٍ: ى، وَلَيْسَتْ بِيَاءٍ: ي. أَنْظُرُ إِلَى الْكَلِمَةِ كَامِلَةً، لَا إِلَى صَوْتِ النِّهَايَةِ وَحْدَهُ.'
    ],
    context: 'instruction',
    voiceText: 'مِثَالٌ... كَلِمَةُ: هُدَى. تَنْتَهِي الْكَلِمَةُ بِأَلِفٍ مَقْصُورَةٍ: ى، وَلَيْسَتْ بِيَاءٍ: ي. انْظُرْ إِلَى الْكَلِمَةِ كَامِلَةً، لَا إِلَى صَوْتِ النِّهَايَةِ وَحْدَهُ.'
  },
  {
    file: `${audioKey('نَسْمَعُ صَوْتَ كُلِّ حَرْفٍ مَعَ الْفَتْحَةِ: بَ، تَ، ثَ.')}.mp3`,
    primaryKey: audioKey('نَسْمَعُ صَوْتَ كُلِّ حَرْفٍ مَعَ الْفَتْحَةِ: بَ، تَ، ثَ.'),
    text: 'نَسْمَعُ صَوْتَ كُلِّ حَرْفٍ مَعَ الْفَتْحَةِ: بَ، تَ، ثَ.',
    aliases: [
      'نَسْمَعُ صَوْتَ كُلِّ حَرْفٍ مَعَ الْفَتْحَةِ: بَ، تَ، ثَ.',
      'نَسْمَعُ صَوْتَ كُلِّ حَرْفٍ مَعَ الْفَتْحَةِ: بَـ... تَـ... ثَـ.'
    ],
    context: 'instruction',
    voiceText: 'نَسْمَعُ صَوْتَ كُلِّ حَرْفٍ مَعَ الْفَتْحَةِ: بَـ... تَـ... ثَـ.'
  }
];

async function run() {
  console.log(`Starting clean re-synthesis of ${TARGET_CLIPS.length} target clips (strict NO CHATTER mode)...`);

  for (let i = 0; i < TARGET_CLIPS.length; i++) {
    const item = TARGET_CLIPS[i];
    console.log(`[${i + 1}/${TARGET_CLIPS.length}] Synthesizing "${item.voiceText}" -> ${item.file}...`);
    try {
      const mp3 = await synthesizeText(item.voiceText, 'sage');
      const outPublic = path.join(PUBLIC_AUDIO_DIR, item.file);
      fs.writeFileSync(outPublic, mp3);
      if (fs.existsSync(DIST_AUDIO_DIR)) {
        fs.writeFileSync(path.join(DIST_AUDIO_DIR, item.file), mp3);
      }

      const clipInfo = {
        file: item.file,
        text: item.text,
        voice: 'OpenAI-Audio-Sage',
        model: 'openai/gpt-audio-mini',
        context: item.context,
        bytes: mp3.length,
      };

      manifest.clips[item.primaryKey] = clipInfo;
      for (const alias of item.aliases) {
        manifest.clips[alias] = clipInfo;
        manifest.clips[audioKey(alias)] = clipInfo;
      }

      console.log(`  ✓ Saved ${item.file} (${mp3.length} bytes, ~${(mp3.length / 16000).toFixed(1)}s)`);
    } catch (err) {
      console.error(`  ✗ Error on ${item.file}:`, err);
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  if (fs.existsSync(path.join(DIST_AUDIO_DIR, 'manifest.json'))) {
    fs.writeFileSync(path.join(DIST_AUDIO_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  }
  console.log('Saved manifest.json successfully!');
}

run().catch(console.error);
