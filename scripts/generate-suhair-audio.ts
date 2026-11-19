/**
 * Record every text the app speaks in one natural voice: Suhair Al-Abtah (ElevenLabs).
 *
 * Reads the full audio catalog (src/cognitiveProfile/audioCatalog.ts) and records each text that
 * has no clip yet, or whose clip came from a synthetic voice (Azure neural), into public/audio/v1.
 * The app never falls back to a synthetic voice: a text without a clip is silent, so this script
 * must be re-run whenever new spoken text is added.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... npx tsx scripts/generate-suhair-audio.ts           # missing + synthetic only
 *   ELEVENLABS_API_KEY=... npx tsx scripts/generate-suhair-audio.ts --dry-run # list what would be recorded
 *   ELEVENLABS_API_KEY=... npx tsx scripts/generate-suhair-audio.ts --repausal # re-record unmarked final consonants
 * Progress is saved after every clip, so an interrupted run resumes where it stopped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildAudioCatalog, normalizeSpokenText, type CatalogEntry } from '../src/cognitiveProfile/audioCatalog';
import { prepareArabicTtsText } from '../src/utils/naturalSpeech';

const API_KEY = process.env.ELEVENLABS_API_KEY?.trim() || '';
const VOICE_ID = 'ML7jGRDg4E9hIl5qEm1Z'; // Suhair Al-Abtah
const MODEL_ID = 'eleven_v4';
const OUT_DIR = path.resolve('public/audio/v1');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');
const DRY_RUN = process.argv.includes('--dry-run');
/** Re-record single words that end in an unmarked consonant (see spokenForm). */
const REPAUSAL = process.argv.includes('--repausal');
const CONCURRENCY = 3;

interface Clip { file: string; text: string; voice: string; model: string; context: string; bytes: number }
const manifest: { clips: Record<string, Clip> } & Record<string, unknown> = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const isSynthetic = (c: Clip) => c.model === 'azure_neural' || /Neural/.test(c.voice);
const lettersOf = (t: string) => t.replace(/[ً-ٰٟ\s.؟?!،,…:«»]/g, '');
const contextOf = (e: CatalogEntry) => (lettersOf(e.text).length <= 2 ? 'phoneme' : e.text.includes(' ') ? 'instruction' : 'single_word');

/**
 * A single word shown without a final vowel (مَاء، شَمْس) must be spoken in pause form. Without an
 * explicit sukun the voice adds a case ending the child does not see (مَاءُ). The sukun is added
 * after the shared text preparation, which otherwise strips it after a long vowel.
 */
const UNMARKED_CONSONANT_END = /[\u0621-\u064A]$/;
function endsInUnmarkedConsonant(text: string): boolean {
  const t = text.replace(/[.؟?!،,…:]+$/, '').trim();
  return !t.includes(' ') && UNMARKED_CONSONANT_END.test(t) && !/[اىويةه]$/.test(t);
}
function spokenForm(text: string): string {
  const prepared = prepareArabicTtsText(text);
  return endsInUnmarkedConsonant(text) ? `${prepared.replace(/[.؟?!،,…:]+$/, '')}\u0652.` : prepared;
}

function needsRecording(e: CatalogEntry): boolean {
  if (REPAUSAL) return endsInUnmarkedConsonant(e.text);
  const c = manifest.clips[e.key];
  return !c || isSynthetic(c) || !fs.existsSync(path.join(OUT_DIR, c.file));
}

function saveManifest() {
  const tmp = `${MANIFEST_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2), 'utf8');
  fs.renameSync(tmp, MANIFEST_PATH);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function synthesize(text: string, context: string): Promise<Buffer> {
  const prepared = spokenForm(text);
  const stability = context === 'phoneme' ? 0.8 : 0.72;
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': API_KEY },
      body: JSON.stringify({
        text: prepared,
        model_id: MODEL_ID,
        voice_settings: { stability, similarity_boost: 0.88, style: 0.15, use_speaker_boost: true },
      }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      await sleep(1500 * attempt);
      continue;
    }
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function main() {
  const todo = buildAudioCatalog().filter(needsRecording);
  console.log(`To record: ${todo.length} clips`);
  if (DRY_RUN) {
    for (const e of todo) console.log(`${contextOf(e)}\t${e.text}\t${e.sources[0]}`);
    return;
  }
  if (!API_KEY) {
    console.error('ELEVENLABS_API_KEY must be set.');
    process.exit(1);
  }
  let done = 0;
  const failed: string[] = [];
  const queue = [...todo];
  const worker = async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const context = contextOf(e);
      try {
        const audio = await synthesize(e.text, context);
        const file = `${e.key}.mp3`;
        fs.writeFileSync(path.join(OUT_DIR, file), audio);
        manifest.clips[e.key] = { file, text: normalizeSpokenText(e.text), voice: VOICE_ID, model: MODEL_ID, context, bytes: audio.byteLength };
        saveManifest();
        done += 1;
        if (done % 25 === 0) console.log(`${done}/${todo.length}`);
      } catch (error) {
        failed.push(`${e.text}: ${(error as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  manifest.generatedAt = new Date().toISOString();
  saveManifest();
  console.log(`Recorded ${done}, failed ${failed.length}`);
  for (const f of failed) console.log(`FAILED ${f}`);
}

void main();
