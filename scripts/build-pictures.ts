import fs from 'node:fs';
import path from 'node:path';

function twemojiFilename(emoji: string): string {
  const points = Array.from(emoji).map((c) => c.codePointAt(0)!.toString(16));
  const hasZwj = points.includes('200d');
  return `${(hasZwj ? points : points.filter((p) => p !== 'fe0f')).join('-')}.svg`;
}

const SRC = path.resolve('node_modules/@twemoji/svg');
const OUT = path.resolve('public/pictures');
fs.mkdirSync(OUT, { recursive: true });

const filesToScan = [
  'src/cognitiveProfile/structuredLiteracyStations.ts',
  'src/cognitiveProfile/curriculum.ts',
  'src/cognitiveProfile/training.ts',
  'src/cognitiveProfile/pictures.ts',
  'src/cognitiveProfile/lexicon.ts',
];

const allEmojis = new Set<string>();
for (const f of filesToScan) {
  if (!fs.existsSync(f)) continue;
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [];
  for (const e of matches) allEmojis.add(e);
}

let copied = 0;
let missing: string[] = [];

for (const emoji of allEmojis) {
  const file = twemojiFilename(emoji);
  const srcFile = path.join(SRC, file);
  const destFile = path.join(OUT, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    copied++;
  } else {
    missing.push(`${emoji} (${file})`);
  }
}

// Generate the TypeScript file with the full set of bundled SVGs
const allSvgFiles = fs.readdirSync(OUT).filter((f) => f.endsWith('.svg'));
console.log(`Copied ${copied} SVGs. Total in public/pictures: ${allSvgFiles.length}.`);
if (missing.length) {
  console.log(`Emojis without Twemoji SVGs (will use native emoji fallback): ${missing.length}`);
}
