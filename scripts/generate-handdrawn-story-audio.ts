/**
 * Generate Suhair Al-Abtah (ElevenLabs eleven_v4) studio MP3 clips for the
 * Hand-Drawn Reading Stories (src/cognitiveProfile/handDrawnStories.ts) into public/audio/v1/.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { audioKey, normalizeSpokenText } from '../src/cognitiveProfile/audioCatalog';
import { collectHandDrawnStoryAudioTexts } from '../src/cognitiveProfile/handDrawnStories';
import { prepareArabicTtsText } from '../src/utils/naturalSpeech';

dotenv.config({ path: path.resolve('C:/Users/User/De1/.env') });

const API_KEY = process.env.ELEVENLABS_API_KEY?.trim() || '';
const VOICE_ID = 'ML7jGRDg4E9hIl5qEm1Z';
const MODEL_ID = 'eleven_v4';
const OUT_DIR = path.resolve('C:/Users/User/De1/public/audio/v1');
const DIST_DIR = path.resolve('C:/Users/User/De1/dist/audio/v1');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');

if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY missing in C:/Users/User/De1/.env');
  process.exit(1);
}

interface ClipInfo {
  file: string;
  text: string;
  voice: string;
  model: string;
  context: string;
  bytes: number;
}

const manifest: { clips: Record<string, ClipInfo> } & Record<string, unknown> = JSON.parse(
  fs.readFileSync(MANIFEST_PATH, 'utf8'),
);

const UNMARKED_CONSONANT_END = /[\u0621-\u064A]$/;
function endsInUnmarkedConsonant(text: string): boolean {
  const t = text.replace(/[.؟?!،,…:]+$/, '').trim();
  return !t.includes(' ') && UNMARKED_CONSONANT_END.test(t) && !/[اىويةه]$/.test(t);
}

function spokenForm(text: string): string {
  const prepared = prepareArabicTtsText(text);
  return endsInUnmarkedConsonant(text) ? `${prepared.replace(/[.؟?!،,…:]+$/, '')}\u0652.` : prepared;
}

function saveManifest() {
  const tmp = `${MANIFEST_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2), 'utf8');
  try {
    fs.renameSync(tmp, MANIFEST_PATH);
  } catch {
    fs.copyFileSync(tmp, MANIFEST_PATH);
    fs.rmSync(tmp, { force: true });
  }
  if (fs.existsSync(DIST_DIR)) {
    try {
      fs.copyFileSync(MANIFEST_PATH, path.join(DIST_DIR, 'manifest.json'));
    } catch {
      /* ignore */
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function synthesize(text: string, context: string): Promise<Buffer> {
  const prepared = spokenForm(text);
  const stability = context === 'single_word' ? 0.78 : 0.72;
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': API_KEY },
        body: JSON.stringify({
          text: prepared,
          model_id: MODEL_ID,
          voice_settings: {
            stability,
            similarity_boost: 0.88,
            style: 0.15,
            use_speaker_boost: true,
          },
        }),
      },
    );
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const waitMs = 1500 * attempt;
      console.warn(`Retry ${attempt} (${res.status}) in ${waitMs}ms...`);
      await sleep(waitMs);
      continue;
    }
    throw new Error(`ElevenLabs ${res.status}: ${body}`);
  }
}

async function main() {
  const texts = collectHandDrawnStoryAudioTexts();
  const missing = texts.filter((raw) => {
    const key = audioKey(normalizeSpokenText(raw));
    const entry = manifest.clips[key];
    return !entry || !entry.file || !fs.existsSync(path.join(OUT_DIR, entry.file));
  });

  console.log(`Total hand-drawn story clips: ${texts.length}, missing: ${missing.length}`);

  for (let i = 0; i < missing.length; i += 1) {
    const raw = missing[i];
    const norm = normalizeSpokenText(raw);
    const key = audioKey(norm);
    const file = `${key}.mp3`;
    const context = norm.includes(' ') ? 'instruction' : 'single_word';

    const buf = await synthesize(norm, context);
    fs.writeFileSync(path.join(OUT_DIR, file), buf);
    if (fs.existsSync(DIST_DIR)) {
      fs.writeFileSync(path.join(DIST_DIR, file), buf);
    }
    manifest.clips[key] = {
      file,
      text: norm,
      voice: VOICE_ID,
      model: MODEL_ID,
      context,
      bytes: buf.length,
    };

    if ((i + 1) % 10 === 0 || i + 1 === missing.length) {
      saveManifest();
      console.log(`Generated ${i + 1}/${missing.length}: ${norm}`);
    }
    await sleep(180);
  }

  console.log('ALL_STORY_AUDIO_READY');
}

main().catch((err) => {
  saveManifest();
  console.error(err);
  process.exit(1);
});
