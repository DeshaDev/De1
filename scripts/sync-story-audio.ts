import fs from 'node:fs';
import path from 'node:path';
import { audioKey, normalizeSpokenText } from '../src/cognitiveProfile/audioCatalog';
import { collectHandDrawnStoryAudioTexts } from '../src/cognitiveProfile/handDrawnStories';

const kg1Dir = path.resolve(
  'c:/Users/User/Downloads/remix-faham-ayat-—-quranic-arabic-learning-platform/public/audio',
);
const kg1Manifest = JSON.parse(fs.readFileSync(path.join(kg1Dir, 'manifest.json'), 'utf8'));
const de1Dir = path.resolve('C:/Users/User/De1/public/audio/v1');
const de1ManifestPath = path.join(de1Dir, 'manifest.json');
const de1Manifest = JSON.parse(fs.readFileSync(de1ManifestPath, 'utf8'));

const byNorm = new Map<string, { file: string; model?: string; srcFile: string }>();
const stripCase = (t: string) => t.replace(/[\u064B-\u0650]+$/, '');

for (const entry of Object.values(kg1Manifest.clips || {}) as Array<{
  file?: string;
  text?: string;
  voice?: string;
  model?: string;
}>) {
  if (!entry || entry.voice !== 'ML7jGRDg4E9hIl5qEm1Z' || !entry.file) continue;
  const srcFile = path.join(kg1Dir, entry.file);
  if (!fs.existsSync(srcFile)) continue;
  const norm = normalizeSpokenText(entry.text || '');
  if (!norm) continue;
  if (!byNorm.has(norm)) byNorm.set(norm, { file: entry.file, model: entry.model, srcFile });
  const bare = stripCase(norm);
  if (bare && !byNorm.has(bare)) byNorm.set(bare, { file: entry.file, model: entry.model, srcFile });
}

const needed = collectHandDrawnStoryAudioTexts();
let copied = 0;
let already = 0;

for (const text of needed) {
  const norm = normalizeSpokenText(text);
  const key = audioKey(norm);
  if (de1Manifest.clips[key]?.file && fs.existsSync(path.join(de1Dir, de1Manifest.clips[key].file))) {
    already++;
    continue;
  }
  const match = byNorm.get(norm) || byNorm.get(stripCase(norm));
  if (match) {
    const outFile = `${key}.mp3`;
    fs.copyFileSync(match.srcFile, path.join(de1Dir, outFile));
    de1Manifest.clips[key] = {
      file: outFile,
      text: norm,
      voice: 'ML7jGRDg4E9hIl5qEm1Z',
      model: match.model || 'eleven_v4',
      context: norm.includes(' ') ? 'instruction' : 'single_word',
      bytes: fs.statSync(path.join(de1Dir, outFile)).size,
    };
    copied++;
  }
}

fs.writeFileSync(de1ManifestPath, JSON.stringify(de1Manifest, null, 2), 'utf8');
console.log({ needed: needed.length, already, copied, missingAfterSync: needed.length - already - copied });
