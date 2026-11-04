/**
 * Generate the pre-recorded audio for the cognitive battery and the training programme
 * with Azure neural Arabic voices, then check every clip automatically:
 * Azure speech recognition + pronunciation assessment listens to the generated clip and
 * scores it against the intended text. Clips that score low are listed for a human to
 * listen to, in docs/AUDIO_QA_REPORT_AR.md.
 *
 * Usage (needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in the environment):
 *   npx tsx scripts/generate-audio.ts            # generate missing clips, then QA all
 *   npx tsx scripts/generate-audio.ts --force    # regenerate everything
 *   npx tsx scripts/generate-audio.ts --qa-only  # re-run the QA on existing clips
 * Options: AUDIO_VOICE (default ar-SA-ZariyahNeural), AUDIO_RATE (default -12%),
 *   AUDIO_MIN_GAP_MS (starting gap between Azure requests, default 250; it adapts to 429s).
 * Progress is saved after every clip, so an interrupted run resumes where it stopped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildAudioCatalog, type CatalogEntry } from '../src/cognitiveProfile/audioCatalog';
import { formatArabicTextWithPhonemes, getArabicPhonemeIpa } from '../src/utils/arabicPhonemeBank';

const KEY = process.env.AZURE_SPEECH_KEY?.trim();
const REGION = process.env.AZURE_SPEECH_REGION?.trim();
const VOICE = process.env.AUDIO_VOICE?.trim() || 'ar-SA-ZariyahNeural';
const RATE = process.env.AUDIO_RATE?.trim() || '-12%';
const SHORT_RATE = '-15%'; // isolated syllables and sounds are spoken more slowly
const OUT_DIR = path.resolve('public/audio/v1');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const REPORT = path.resolve('docs/AUDIO_QA_REPORT_AR.md');
const FORCE = process.argv.includes('--force');
const QA_ONLY = process.argv.includes('--qa-only');

interface ClipInfo {
  file: string;
  text: string;
  voice: string;
  rate: string;
  bytes: number;
  qa?: QaResult;
}
interface Manifest {
  version: 1;
  voice: string;
  generatedAt: string;
  clips: Record<string, ClipInfo>;
}
interface QaResult {
  status: 'pass' | 'listen' | 'fail';
  recognized: string;
  accuracy: number | null;
  similarity: number;
}

if (!KEY || !REGION) {
  console.error('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set.');
  process.exit(1);
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const isShort = (text: string) => text.replace(/[ً-ْٰ\s.؟?!،,…]/g, '').length <= 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class RateLimited extends Error {
  constructor(label: string, readonly retryAfterMs: number | null) {
    super(`${label} rate limited`);
  }
}

/** Seconds (or an HTTP date) from a Retry-After header, in milliseconds. */
function retryAfterMs(res: Response): number | null {
  const v = res.headers.get('retry-after');
  if (!v) return null;
  const secs = Number(v);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(v);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
}

/**
 * Adaptive pacing so a free (F0) or standard (S0) Azure key both finish without tripping
 * the rate limit: the gap between requests doubles after every 429 and shrinks slowly
 * after a run of successes. AUDIO_MIN_GAP_MS sets the starting gap.
 */
const pace = {
  gap: Number(process.env.AUDIO_MIN_GAP_MS ?? 250),
  min: 150,
  max: 6000,
  last: 0,
  ok: 0,
};
async function paced<T>(fn: () => Promise<T>): Promise<T> {
  const wait = pace.last + pace.gap - Date.now();
  if (wait > 0) await sleep(wait);
  pace.last = Date.now();
  return fn();
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const result = await paced(fn);
      if (++pace.ok >= 40) {
        pace.ok = 0;
        pace.gap = Math.max(pace.min, Math.round(pace.gap * 0.85));
      }
      return result;
    } catch (err) {
      if (attempt >= 10) throw err;
      pace.ok = 0;
      let wait = Math.min(60_000, 1000 * 2 ** attempt);
      if (err instanceof RateLimited) {
        pace.gap = Math.min(pace.max, pace.gap * 2);
        if (err.retryAfterMs !== null) wait = Math.max(err.retryAfterMs, 1000);
      }
      wait += Math.round(Math.random() * 500);
      console.warn(`  retry ${label} in ${wait}ms, gap now ${pace.gap}ms (${(err as Error).message})`);
      await sleep(wait);
    }
  }
}

async function synthesize(text: string, format: string): Promise<Buffer> {
  const rate = isShort(text) ? SHORT_RATE : RATE;
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA">` +
    `<voice name="${VOICE}"><prosody rate="${rate}" pitch="+2%">${escapeXml(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': KEY!,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': format,
      'User-Agent': 'baseera-audio-generator',
    },
    body: ssml,
  });
  if (res.status === 429) throw new RateLimited('TTS', retryAfterMs(res));
  if (res.status >= 500) throw new Error(`TTS HTTP ${res.status}`);
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Letters only: drop diacritics/punctuation and unify common spelling variants. */
function normalizeForCompare(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^ء-ي]/g, '');
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length, 1);
}

async function qaClip(text: string): Promise<QaResult> {
  // Recognition needs PCM WAV; synthesise a 16 kHz copy just for listening.
  const wav = await withRetry(() => synthesize(text, 'riff-16khz-16bit-mono-pcm'), 'qa-tts');
  const params = Buffer.from(
    JSON.stringify({ ReferenceText: text, GradingSystem: 'HundredMark', Granularity: 'Word', Dimension: 'Comprehensive' })
  ).toString('base64');
  const res = await withRetry(async () => {
    const r = await fetch(
      `https://${REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ar-SA&format=detailed`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': KEY!,
          'Pronunciation-Assessment': params,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          Accept: 'application/json',
        },
        body: new Uint8Array(wav),
      }
    );
    if (r.status === 429) throw new RateLimited('STT', retryAfterMs(r));
    if (r.status >= 500) throw new Error(`STT HTTP ${r.status}`);
    return r;
  }, 'qa-stt');
  const payload: any = res.ok ? await res.json() : null;
  const best = payload?.NBest?.[0];
  const recognized = String(payload?.DisplayText ?? best?.Display ?? '').trim();
  const accuracy = typeof best?.PronunciationAssessment?.AccuracyScore === 'number'
    ? best.PronunciationAssessment.AccuracyScore
    : typeof best?.AccuracyScore === 'number' ? best.AccuracyScore : null;
  const sim = similarity(normalizeForCompare(text), normalizeForCompare(recognized));
  let status: QaResult['status'];
  if (isShort(text)) status = sim >= 0.99 && (accuracy ?? 0) >= 85 ? 'pass' : 'listen';
  else status = sim >= 0.85 && (accuracy ?? 100) >= 80 ? 'pass' : sim >= 0.6 ? 'listen' : 'fail';
  return { status, recognized, accuracy, similarity: Math.round(sim * 100) / 100 };
}

function writeReport(manifest: Manifest, catalog: CatalogEntry[]) {
  const rows = catalog.map((e) => ({ e, clip: manifest.clips[e.key] }));
  const count = (s: QaResult['status']) => rows.filter((r) => r.clip?.qa?.status === s).length;
  const flagged = rows.filter((r) => r.clip?.qa && r.clip.qa.status !== 'pass');
  const lines = [
    '# تقرير جودة الصوت المُولَّد',
    '',
    `الصوت: \`${manifest.voice}\` · المقاطع: ${catalog.length} · تاريخ التوليد: ${manifest.generatedAt.slice(0, 10)}`,
    '',
    'يُولَّد كل مقطع بصوت Azure العصبي العربي، ثم يستمع إليه التعرّف الآلي على الكلام من Azure مع تقييم النطق مقابل النص المقصود.',
    '',
    `| الحالة | العدد |`,
    `|---|---|`,
    `| مطابق تلقائيًا | ${count('pass')} |`,
    `| يحتاج استماعًا بشريًا | ${count('listen')} |`,
    `| غير مطابق — أعد التوليد أو عدّل النص | ${count('fail')} |`,
    '',
    'المقاطع القصيرة جدًا (مقطع صوتي أو صوت منفرد) لا يتعرّف عليها التعرّف الآلي بثبات، لذلك تُعرض للاستماع ما لم تتطابق تمامًا.',
    '',
    '## المقاطع التي تحتاج مراجعة',
    '',
    '| النص | ما سمعه التعرّف الآلي | التشابه | دقة النطق | الحالة | الملف | الاستخدام |',
    '|---|---|---|---|---|---|---|',
    ...flagged.map(({ e, clip }) =>
      `| ${e.text} | ${clip!.qa!.recognized || '—'} | ${clip!.qa!.similarity} | ${clip!.qa!.accuracy ?? '—'} | ${clip!.qa!.status === 'fail' ? 'غير مطابق' : 'استماع'} | \`${clip!.file}\` | ${e.sources.slice(0, 2).join('، ')} |`
    ),
    '',
  ];
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, lines.join('\n'));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const catalog = buildAudioCatalog();
  const manifest: Manifest = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
    : { version: 1, voice: VOICE, generatedAt: new Date().toISOString(), clips: {} };
  if (manifest.voice !== VOICE && !FORCE) {
    console.error(`Manifest voice is ${manifest.voice}; pass --force to regenerate with ${VOICE}.`);
    process.exit(1);
  }
  manifest.voice = VOICE;

  // Remove clips that are no longer used.
  const wanted = new Set(catalog.map((e) => e.key));
  for (const key of Object.keys(manifest.clips)) {
    if (!wanted.has(key)) {
      fs.rmSync(path.join(OUT_DIR, manifest.clips[key].file), { force: true });
      delete manifest.clips[key];
    }
  }

  let generated = 0;
  const save = () => fs.writeFileSync(MANIFEST, JSON.stringify(manifest));
  const stop = (signal: string) => {
    console.warn(`${signal}: saving progress (${generated} new clips) before exit.`);
    save();
    writeReport(manifest, catalog);
    process.exit(1);
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
  try {
    for (const [i, entry] of catalog.entries()) {
      const file = `${entry.key}.mp3`;
      const exists = manifest.clips[entry.key] && fs.existsSync(path.join(OUT_DIR, file));
      let changed = false;
      if (!QA_ONLY && (FORCE || !exists)) {
        const mp3 = await withRetry(() => synthesize(entry.text, 'audio-24khz-48kbitrate-mono-mp3'), entry.key);
        fs.writeFileSync(path.join(OUT_DIR, file), mp3);
        manifest.clips[entry.key] = { file, text: entry.text, voice: VOICE, rate: isShort(entry.text) ? SHORT_RATE : RATE, bytes: mp3.length };
        generated++;
        changed = true;
      }
      if (manifest.clips[entry.key] && (FORCE || QA_ONLY || !manifest.clips[entry.key].qa)) {
        manifest.clips[entry.key].qa = await qaClip(entry.text);
        changed = true;
      }
      if (changed) save();
      if ((i + 1) % 25 === 0) console.log(`${i + 1}/${catalog.length} (gap ${pace.gap}ms)`);
    }
  } catch (err) {
    // Keep what was made; the next run in "missing" mode continues from here.
    save();
    writeReport(manifest, catalog);
    throw err;
  }
  manifest.generatedAt = new Date().toISOString();
  save();
  writeReport(manifest, catalog);
  const qa = Object.values(manifest.clips).map((c) => c.qa?.status);
  console.log(
    `done: ${generated} generated, ${catalog.length} total; QA pass ${qa.filter((s) => s === 'pass').length}, ` +
      `listen ${qa.filter((s) => s === 'listen').length}, fail ${qa.filter((s) => s === 'fail').length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
