/**
 * Copy the fixed picture set used by the battery, the training programme and the review page
 * into public/pictures, so every child sees exactly the same drawing on every device
 * (system emoji differ between Apple, Google, Samsung and Windows, and recent ones do not
 * render on older devices). Drawings: Twemoji, CC-BY 4.0 (https://github.com/jdecked/twemoji).
 *
 * Usage: npx tsx scripts/build-pictures.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { LEXICON } from '../src/cognitiveProfile/lexicon';
import { pictureFile, UI_PICTURES } from '../src/cognitiveProfile/pictures';

const SRC = path.resolve('node_modules/@twemoji/svg');
const OUT = path.resolve('public/pictures');
fs.mkdirSync(OUT, { recursive: true });
const wanted = new Set([...Object.values(LEXICON).map((e) => e.emoji), ...UI_PICTURES]);
const missing: string[] = [];
for (const emoji of wanted) {
  const file = pictureFile(emoji);
  const from = path.join(SRC, file);
  if (!fs.existsSync(from)) {
    missing.push(`${emoji} (${file})`);
    continue;
  }
  fs.copyFileSync(from, path.join(OUT, file));
}
fs.writeFileSync(
  path.join(OUT, 'LICENSE.txt'),
  'Pictures: Twemoji by X Corp and contributors (https://github.com/jdecked/twemoji), licensed CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/).\n'
);
if (missing.length) {
  console.error('Missing pictures:', missing.join(', '));
  process.exit(1);
}
console.log(`copied ${wanted.size} pictures to public/pictures`);
