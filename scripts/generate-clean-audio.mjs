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

async function synthesizeText(promptText, instruction, voice = 'sage') {
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
          content: 'أنتِ معلمة لغة عربية متخصصة للأطفال. تنطقين الفصحى بنطق بشري طبيعي ودافئ وواضح تماماً كمعلمة في استوديو تسجيل للأطفال، بمخارج حروف نقية ودقيقة، مع الوقف بالسكون وهاء الساكت عند التاء المربوطة. لا تنطقي أي كلمة باللغة الإنجليزية أبداً، ولا تضيفي أي كلام إضافي.'
        },
        {
          role: 'user',
          content: instruction || `انطقي فقط النص التالي بنطق عربي أصيل: "${promptText}".`
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
  const trimmedPcm = trimPcmSilence(pcm, 300, 24000);
  return pcmToMp3(trimmedPcm, 24000, 1);
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
    instruction: 'انطقي الكلمة العربية التالية بالوقف على الهاء بالسكون بصوت معلمة نقي: "أَبِيهْ".'
  },
  {
    file: 'ilayhi.mp3',
    primaryKey: 'ilayhi',
    text: 'إِلَيْهْ',
    aliases: ['إِلَيْهِ', 'إِلَيْهْ', 'إليه'],
    context: 'single_word',
    instruction: 'انطقي الكلمة العربية التالية بالوقف على الهاء بالسكون بصوت معلمة نقي: "إِلَيْهْ".'
  },
  {
    file: '3a64d02b160ad10a.mp3',
    primaryKey: '3a64d02b160ad10a',
    text: 'إِلَيْهْ',
    aliases: ['3a64d02b160ad10a'],
    context: 'single_word',
    instruction: 'انطقي الكلمة العربية التالية بالوقف على الهاء بالسكون بصوت معلمة نقي: "إِلَيْهْ".'
  },
  {
    file: 'bb82616784e3e672.mp3',
    primaryKey: 'bb82616784e3e672',
    text: 'هَذَا سَالِي.',
    aliases: ['هَذَا سَالِي.'],
    context: 'pal',
    instruction: 'انطقي الجملة التالية بصوت معلمة لطيف وواضح للأطفال: "هَذَا سَالِي.".'
  },
  {
    file: '756041c85f3a5b10.mp3',
    primaryKey: '756041c85f3a5b10',
    text: 'هَذَا كُودَا.',
    aliases: ['هَذَا كُودَا.', 'وَهَذَا كُودَا.', 'وَهَذَا كُودَاء'],
    context: 'pal',
    instruction: 'انطقي الجملة التالية بصوت معلمة لطيف وواضح للأطفال: "هَذَا كُودَا.".'
  },
  {
    file: '35c23f42b09847e2.mp3',
    primaryKey: '35c23f42b09847e2',
    text: 'أَيْنَ كُودَا؟',
    aliases: ['أَيْنَ كُودَا؟'],
    context: 'pal',
    instruction: 'انطقي السؤال بنبرة تشويق للأطفال: "أَيْنَ كُودَا؟".'
  },
  {
    file: '94216fdb62db3e34.mp3',
    primaryKey: '94216fdb62db3e34',
    text: 'أَيْنَ سَالِي؟',
    aliases: ['أَيْنَ سَالِي؟'],
    context: 'pal',
    instruction: 'انطقي السؤال بنبرة تشويق للأطفال: "أَيْنَ سَالِي؟".'
  },
  {
    file: '2d250b1d9d406130.mp3',
    primaryKey: '2d250b1d9d406130',
    text: 'نَعَمْ، هَذَا كُودَا!',
    aliases: ['نَعَمْ، هَذَا كُودَا!'],
    context: 'pal',
    instruction: 'انطقي العبارة بفرح وتشجيع: "نَعَمْ، هَذَا كُودَا!".'
  },
  {
    file: '0f105889dfe779de.mp3',
    primaryKey: '0f105889dfe779de',
    text: 'نَعَمْ، هَذَا سَالِي!',
    aliases: ['نَعَمْ، هَذَا سَالِي!'],
    context: 'pal',
    instruction: 'انطقي العبارة بفرح وتشجيع: "نَعَمْ، هَذَا سَالِي!".'
  },
  {
    file: '58b8eecb84758036.mp3',
    primaryKey: '58b8eecb84758036',
    text: 'فُوبُو',
    aliases: ['فُوب', 'فُوبُ', 'فُوْبُ', 'فوبو', 'فُوبُو'],
    context: 'single_word',
    instruction: 'انطقي الكلمة المصنوعة التالية بضم الفاء مع واو المد ثم باء مضمومة مع واو مد: "فُوبُو" (fooboo). انطقي الكلمة وحدها بنطق عربي خالص واضح.'
  },
  {
    file: 'e316ebbe60a2dadc.mp3',
    primaryKey: 'e316ebbe60a2dadc',
    text: 'بَاكْ',
    aliases: ['بَاكْ', 'بَاك'],
    context: 'single_word',
    instruction: 'انطقي الكلمة التالية بنطق عربي فصيح: فتح الباء مع ألف المد وتسكين الكاف: "بَاكْ" (baak). احذري نطقها ككلمة إنجليزية، بل نطق عربي خالص.'
  },
  {
    file: '1ff1fc7e4c0bceb9.mp3',
    primaryKey: '1ff1fc7e4c0bceb9',
    text: 'دِيكْ',
    aliases: ['دِيكْ', 'دِيك', 'دِيكٌ'],
    context: 'single_word',
    instruction: 'انطقي الكلمة العربية التالية بالوقف بالسكون على الكاف: "دِيكْ" (deek). انطقي الكلمة فقط.'
  },
  {
    file: '73aad2de91c83cee.mp3',
    primaryKey: '73aad2de91c83cee',
    text: 'جَمَلْ',
    aliases: ['جَمَلْ', 'جَمَل', 'جَمَلُ', 'جَمَلٌ'],
    context: 'single_word',
    instruction: 'انطقي الكلمة العربية التالية بالوقف بالسكون على اللام دون مد الضمة: "جَمَلْ" (jamal). انطقي الكلمة فقط.'
  },
  {
    file: '374488e547311f8d.mp3',
    primaryKey: '374488e547311f8d',
    text: 'دَجَاجَهْ',
    aliases: ['دَجَاجَة', 'دَجَاجَةُ', 'دَجَاجَهْ'],
    context: 'single_word',
    instruction: 'انطقي الكلمة العربية التالية بالوقف على التاء المربوطة هاءً ساكنة: "دَجَاجَهْ" (dajajah). لا تقولي دجاجتو، بل قفي بالهاء: دَجَاجَهْ.'
  },
  {
    file: 'bdfae00789dcc5b6.mp3',
    primaryKey: 'bdfae00789dcc5b6',
    text: 'ذُرَهْ',
    aliases: ['ذُرَة', 'ذُرَةُ', 'ذُرَهْ'],
    context: 'single_word',
    instruction: 'انطقي الكلمة العربية التالية بالوقف على التاء المربوطة هاءً ساكنة: "ذُرَهْ" (thurah). لا تقولي ذرتو، بل قفي بالهاء: ذُرَهْ.'
  },
  {
    file: '95e0c8fb053cd4a3.mp3',
    primaryKey: '95e0c8fb053cd4a3',
    text: 'سَيَّارَهْ',
    aliases: ['سَيَّارَة', 'سَيَّارَةُ', 'سَيَّارَهْ'],
    context: 'single_word',
    instruction: 'انطقي الكلمة العربية التالية بالوقف على التاء المربوطة هاءً ساكنة: "سَيَّارَهْ" (sayyarah). لا تقولي سيارتو، بل قفي بالهاء: سَيَّارَهْ.'
  },
  {
    file: '178d12ebd07d6686.mp3',
    primaryKey: '178d12ebd07d6686',
    text: 'عُصْفُورْ',
    aliases: ['عُصْفُور', 'عُصْفُورُ', 'عُصْفُورْ'],
    context: 'single_word',
    instruction: 'انطقي الكلمة العربية التالية بالوقف بالسكون على الراء دون مد الضمة: "عُصْفُورْ" (usfoor). انطقي الكلمة فقط.'
  },
  {
    file: 'e1282bea9dc9b820.mp3',
    primaryKey: 'e1282bea9dc9b820',
    text: 'فِيلْ',
    aliases: ['فِيل', 'فِيلُ', 'فِيلْ'],
    context: 'single_word',
    instruction: 'انطقي الكلمة العربية التالية بالوقف بالسكون على اللام: "فِيلْ" (feel). انطقي الكلمة فقط.'
  },
  // Curriculum phrases
  {
    file: `${audioKey('اِسْمَعِ الْكَلِمَةَ بِهُدُوءٍ، وَانْتَبِهْ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. اكْتُبِ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ تَزِيدَ حَرْفًا.')}.mp3`,
    primaryKey: audioKey('اِسْمَعِ الْكَلِمَةَ بِهُدُوءٍ، وَانْتَبِهْ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. اكْتُبِ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ تَزِيدَ حَرْفًا.'),
    text: 'اِسْمَعِ الْكَلِمَةَ بِهُدُوءٍ، وَانْتَبِهْ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. اكْتُبِ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ تَزِيدَ حَرْفًا.',
    aliases: [
      'اِسْمَعِ الْكَلِمَةَ بِهُدُوءٍ، وَانْتَبِهْ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. اكْتُبِ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ تَزِيدَ حَرْفًا.',
      'أَسْمَعُ الْكَلِمَةَ بِهُدُوءٍ، وَأَنْتَبِهُ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. أَكْتُبُ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ أَزِيدَ حَرْفًا.'
    ],
    context: 'instruction',
    instruction: 'انطقي هذه التوجيهات التعليمية بصوت معلمة حنون وواضح وهادئ: "اِسْمَعِ الْكَلِمَةَ بِهُدُوءٍ، وَانْتَبِهْ إِلَى الْأَصْوَاتِ الصَّغِيرَةِ. اكْتُبِ الْحُرُوفَ بِتَرْتِيبِهَا دُونَ أَنْ تَزِيدَ حَرْفًا.".'
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
    instruction: 'انطقي هذا الشرح التعليمي مع وقفة لطيفة بعد كلمة مثال: "مِثَالٌ... كَلِمَةُ هُدَى. تَنْتَهِي الْكَلِمَةُ بِأَلِفٍ مَقْصُورَةٍ: ى، وَلَيْسَتْ بِيَاءٍ: ي. انْظُرْ إِلَى الْكَلِمَةِ كَامِلَةً، لَا إِلَى صَوْتِ النِّهَايَةِ وَحْدَهُ.".'
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
    instruction: 'انطقي الجملة التالية واجعلي أصوات الحروف بالفتحة متميزة ومفصولة بنقاء وهدوء: "نَسْمَعُ صَوْتَ كُلِّ حَرْفٍ مَعَ الْفَتْحَةِ: بَ... تَ... ثَ".'
  }
];

async function run() {
  console.log(`Starting synthesis of ${TARGET_CLIPS.length} target clips...`);

  for (let i = 0; i < TARGET_CLIPS.length; i++) {
    const item = TARGET_CLIPS[i];
    console.log(`[${i + 1}/${TARGET_CLIPS.length}] Synthesizing "${item.text}" -> ${item.file}...`);
    try {
      const mp3 = await synthesizeText(item.text, item.instruction, 'sage');
      const outPublic = path.join(PUBLIC_AUDIO_DIR, item.file);
      fs.writeFileSync(outPublic, mp3);
      if (fs.existsSync(DIST_AUDIO_DIR)) {
        fs.writeFileSync(path.join(DIST_AUDIO_DIR, item.file), mp3);
      }

      // Record in manifest under primary key and all aliases
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

      console.log(`  ✓ Saved ${item.file} (${mp3.length} bytes)`);
    } catch (err) {
      console.error(`  ✗ Error on ${item.file}:`, err);
    }
  }

  // Save manifest
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  if (fs.existsSync(path.join(DIST_AUDIO_DIR, 'manifest.json'))) {
    fs.writeFileSync(path.join(DIST_AUDIO_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  }
  console.log('Saved manifest.json successfully!');
}

run().catch(console.error);
