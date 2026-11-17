import fs from 'node:fs';
import path from 'node:path';
import { audioKey, normalizeSpokenText } from '../src/cognitiveProfile/audioCatalog';
import { lessonFor } from '../src/cognitiveProfile/curriculum';
import type { SkillId, Level } from '../src/cognitiveProfile/training';
import { prepareArabicTtsText } from '../src/utils/naturalSpeech';

const envContent = fs.readFileSync('.env', 'utf8');
const apiKeyMatch = envContent.match(/ELEVENLABS_API_KEY=(.*)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : '';

const voiceId = 'ML7jGRDg4E9hIl5qEm1Z'; // Suhair Al Abtah
const modelId = 'eleven_v4';

const OUT_DIR = path.resolve('public/audio/v1');
const DIST_DIR = path.resolve('dist/audio/v1');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');

interface ClipInfo {
  file: string;
  text: string;
  voice: string;
  model: string;
  context: string;
  bytes: number;
}

interface Manifest {
  version: number;
  voice: string;
  generatedAt: string;
  clips: Record<string, ClipInfo>;
}

const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

function saveManifest() {
  const tmp = `${MANIFEST_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2), 'utf8');
  try {
    fs.renameSync(tmp, MANIFEST_PATH);
  } catch {
    fs.copyFileSync(tmp, MANIFEST_PATH);
    try { fs.unlinkSync(tmp); } catch {}
  }
  if (fs.existsSync(DIST_DIR)) {
    try {
      fs.copyFileSync(MANIFEST_PATH, path.join(DIST_DIR, 'manifest.json'));
    } catch {}
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function synthesizeText(textToSynthesize: string, context = 'instruction'): Promise<Buffer> {
  const prepared = prepareArabicTtsText(textToSynthesize);
  const isPraise = /أَحْسَنْتَ|مُمْتَاز|رَائِع|بَطَل|ذَكِيّ|عَبْقَرِيّ|فَوْز|نَجَحْتَ/i.test(prepared);
  const isShort = prepared.replace(/[ً-ْٰ\s.؟?!،,…]/g, '').length <= 3;
  const stability = isShort ? 0.80 : isPraise ? 0.50 : 0.72;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: prepared,
      model_id: modelId,
      voice_settings: {
        stability,
        similarity_boost: 0.88,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs error: ${res.status} ${res.statusText}: ${await res.text()}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

let generatedCount = 0;

async function generateAndStore(rawText: string, spokenTextOverride?: string, context = 'instruction', force = false) {
  const normRaw = normalizeSpokenText(rawText);
  const key = audioKey(normRaw);
  const filename = `${key}.mp3`;
  const outPath = path.join(OUT_DIR, filename);

  if (!force && fs.existsSync(outPath) && manifest.clips[key]) {
    return; // Already exists
  }

  console.log(`Synthesizing [${key}]: "${rawText}"${spokenTextOverride ? ` (as "${spokenTextOverride}")` : ''}`);
  const textToSay = spokenTextOverride || rawText;
  const buffer = await synthesizeText(textToSay, context);

  fs.writeFileSync(outPath, buffer);
  if (fs.existsSync(DIST_DIR)) {
    try {
      fs.writeFileSync(path.join(DIST_DIR, filename), buffer);
    } catch {}
  }

  manifest.clips[key] = {
    file: filename,
    text: normRaw,
    voice: voiceId,
    model: modelId,
    context,
    bytes: buffer.byteLength,
  };

  // If a spokenTextOverride was provided, also record the key for the spokenText itself
  if (spokenTextOverride && spokenTextOverride !== rawText) {
    const normSpoken = normalizeSpokenText(spokenTextOverride);
    const overrideKey = audioKey(normSpoken);
    const overrideFilename = `${overrideKey}.mp3`;
    const overridePath = path.join(OUT_DIR, overrideFilename);
    fs.writeFileSync(overridePath, buffer);
    if (fs.existsSync(DIST_DIR)) {
      try {
        fs.writeFileSync(path.join(DIST_DIR, overrideFilename), buffer);
      } catch {}
    }
    manifest.clips[overrideKey] = {
      file: overrideFilename,
      text: normSpoken,
      voice: voiceId,
      model: modelId,
      context,
      bytes: buffer.byteLength,
    };
  }

  generatedCount++;
  if (generatedCount % 5 === 0) {
    saveManifest();
  }

  await sleep(150);
}

async function main() {
  console.log('--- Phase 1: High Priority Pausal Words & Syllables ---');
  const pausalItems: Array<{ raw: string; spoken: string; context: string }> = [
    { raw: 'سُلَحْفَاة', spoken: 'سُلَحْفَاهْ', context: 'single_word' },
    { raw: 'سُلَحْفَاهْ', spoken: 'سُلَحْفَاهْ', context: 'single_word' },
    { raw: 'فَاة', spoken: 'فَاهْ', context: 'phoneme' },
    { raw: 'فَاهْ', spoken: 'فَاهْ', context: 'phoneme' },
    { raw: 'كَة', spoken: 'كَهْ', context: 'phoneme' },
    { raw: 'كَهْ', spoken: 'كَهْ', context: 'phoneme' },
    { raw: 'حَة', spoken: 'حَهْ', context: 'phoneme' },
    { raw: 'حَهْ', spoken: 'حَهْ', context: 'phoneme' },
    { raw: 'سَمَكَة', spoken: 'سَمَكَهْ', context: 'single_word' },
    { raw: 'سَمَكَهْ', spoken: 'سَمَكَهْ', context: 'single_word' },
    { raw: 'تُفَّاحَة', spoken: 'تُفَّاحَهْ', context: 'single_word' },
    { raw: 'تُفَّاحَة', spoken: 'تُفَّاحَهْ', context: 'single_word' },
    { raw: 'تُفَّاحَهْ', spoken: 'تُفَّاحَهْ', context: 'single_word' },
    { raw: 'لَة', spoken: 'لَهْ', context: 'phoneme' },
    { raw: 'طَة', spoken: 'طَهْ', context: 'phoneme' },
    { raw: 'رَة', spoken: 'رَهْ', context: 'phoneme' },
    { raw: 'جَة', spoken: 'جَهْ', context: 'phoneme' },
    { raw: 'مَة', spoken: 'مَهْ', context: 'phoneme' },
    { raw: 'عَة', spoken: 'عَهْ', context: 'phoneme' },
    { raw: 'ضَة', spoken: 'ضَهْ', context: 'phoneme' },
  ];

  for (const item of pausalItems) {
    try {
      await generateAndStore(item.raw, item.spoken, item.context, true);
    } catch (err) {
      console.error(`Error on pausal ${item.raw}:`, err);
    }
  }
  saveManifest();

  console.log('--- Phase 2: Letter Sound Prompts ---');
  const ALL_LETTERS = 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' ');
  for (const l of ALL_LETTERS) {
    for (const v of ['َ', 'ِ', 'ُ']) {
      const sound = l + v;
      const prompt = `أَيُّ حَرْفٍ صَوْتُهُ: ${sound}؟`;
      try {
        await generateAndStore(prompt, prompt, 'instruction', false);
      } catch (err) {
        console.error(`Error on prompt ${prompt}:`, err);
      }
    }
  }
  saveManifest();

  console.log('--- Phase 3: Curriculum Lesson Audio Steps ---');
  const skills: SkillId[] = [
    'rhyme', 'soundPosition', 'blending', 'discrimination',
    'letterSound', 'visualDiscrimination', 'decoding', 'spelling',
    'comprehension', 'morphology'
  ];

  const lessonPhrases = new Set<string>();
  for (const s of skills) {
    for (const l of [1, 2, 3] as Level[]) {
      const lesson = lessonFor(s, l);
      if (lesson) {
        lesson.steps.forEach(st => st.audio.forEach(a => lessonPhrases.add(a.text)));
      }
    }
  }

  console.log(`Found ${lessonPhrases.size} lesson phrases.`);
  for (const phrase of lessonPhrases) {
    try {
      await generateAndStore(phrase, phrase, 'instruction', false);
    } catch (err) {
      console.error(`Error on lesson phrase "${phrase}":`, err);
    }
  }

  saveManifest();
  console.log(`--- All Audio Generation Complete! Total new clips: ${generatedCount} ---`);
}

main().catch(console.error);
