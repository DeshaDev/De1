import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

console.log('--- Starting Audio Pruning & Audit Page Update ---');

// 1. Bundle audioCatalog
console.log('1. Bundling audioCatalog.ts...');
execSync('node ./node_modules/esbuild/bin/esbuild src/cognitiveProfile/audioCatalog.ts --bundle --platform=node --format=esm --outfile=scripts/temp-catalog.js');

const { buildAudioCatalog, audioKey, normalizeSpokenText } = await import('./temp-catalog.js');

const publicManifestPath = path.resolve('public/audio/v1/manifest.json');
const distManifestPath = path.resolve('dist/audio/v1/manifest.json');
const manifest = JSON.parse(fs.readFileSync(publicManifestPath, 'utf8'));

// 2. Build active texts and keys set
console.log('2. Building active catalog...');
const activeCatalog = buildAudioCatalog();
const activeTexts = new Set();
const activeKeys = new Set();

for (const entry of activeCatalog) {
  const norm = normalizeSpokenText(entry.text);
  activeTexts.add(norm);
  activeTexts.add(entry.text.trim());
  activeKeys.add(entry.key);
  activeKeys.add(audioKey(norm));
  activeKeys.add(audioKey(entry.text));
}

// 3. Add protected words (single word reading, nonsense words, benchmark practice)
const protectedWords = [
  'مَاءُ', 'مَاءْ', 'مَاء',
  'بَابُ', 'بَابْ', 'بَاب',
  'فِيلُ', 'فِيلْ', 'فِيل',
  'بَيْتُ', 'بَيْتْ', 'بَيْت',
  'يَدُ', 'يَدْ', 'يَد',
  'قَلَمُ', 'قَلَمْ', 'قَلَم', 'قَلَمٌ',
  'جَمَلُ', 'جَمَلْ', 'جَمَل', 'جَمَلٌ',
  'وَلَدُ', 'وَلَدْ', 'وَلَد', 'وَلَدٌ',
  'كِتَابُ', 'كِتَابْ', 'كِتَاب', 'كِتَابٌ',
  'سَمَكَةُ', 'سَمَكَة', 'سَمَكَهْ',
  'شَجَرَةُ', 'شَجَرَة', 'شَجَرَهْ',
  'تُفَّاحَةُ', 'تُفَّاحَة', 'تُفَّاحَهْ',
  'دَجَاجَةُ', 'دَجَاجَة', 'دَجَاجَهْ',
  'الشَّمْسُ', 'الشَّمْس', 'الشمس',
  'سَيَّارَةُ', 'سَيَّارَة', 'سَيَّارَهْ',
  'عُصْفُورُ', 'عُصْفُورْ', 'عُصْفُور',
  'مُسْتَشْفَى', 'مستشفى',
  // Nonwords
  'فُوبُ', 'فُوْبُ', 'فُوبُو', 'فُوب', 'فوب', 'فوبو',
  'بَتَمُ', 'دُمَكُ', 'سِيقُ', 'رَفِيدُ', 'نَاحِبُ', 'صَاتِفُ', 'طَبِيقُ', 'مَفْكُوزُ', 'زُنْفُولُ', 'تَسْمِيرُ', 'مُتَسَاهِلُ',
  // Passage words
  'سَامِي', 'السُّوقِ', 'السوق', 'إِلَيْهِ', 'إِلَيْهْ', 'إليه', 'أَبِيهِ', 'أَبِيهْ', 'أبيه'
];

for (const w of protectedWords) {
  const norm = normalizeSpokenText(w);
  activeTexts.add(norm);
  activeTexts.add(w.trim());
  activeKeys.add(audioKey(norm));
  activeKeys.add(audioKey(w));
}

// 4. Add Arabic Phoneme Bank entries
const phonemeBankPath = path.resolve('src/utils/arabicPhonemeBank.ts');
if (fs.existsSync(phonemeBankPath)) {
  const code = fs.readFileSync(phonemeBankPath, 'utf8');
  const matches = code.matchAll(/'([\u0621-\u064A\u064B-\u0652\u0670\u0671]+)'\s*:/g);
  for (const m of matches) {
    const p = m[1];
    activeTexts.add(p);
    activeTexts.add(normalizeSpokenText(p));
    activeKeys.add(audioKey(p));
    activeKeys.add(audioKey(normalizeSpokenText(p)));
  }
}

// 5. Partition clips into keep and delete
const toKeep = {};
const toDelete = {};

for (const [key, clip] of Object.entries(manifest.clips)) {
  const text = (clip.text || '').trim();
  const norm = normalizeSpokenText(text);

  // Criteria for obsolete clips:
  const isRemovedVisual = text.includes('القلعة') || text.includes('القَلْعَةِ') || text.includes('حَيَوَانٌ صَغِيرٌ') || text.includes('البيوت');
  const isOldRepeatedSound = text.includes('...') && text.startsWith('أَيُّ حَرْفٍ صَوْتُهُ:');
  const isOldRhymePrompt = text.includes('آخِرُ صَوْتٍ فِيهَا مِثْلُ آخِرِ صَوْتٍ فِي:');
  const isOldExample = text.includes('مِثَالٌ: قَلَمٌ. أَقْرَأُ قَ، ثُمَّ لَ، ثُمَّ مٌ');

  if (isRemovedVisual || isOldRepeatedSound || isOldRhymePrompt || isOldExample) {
    toDelete[key] = clip;
    continue;
  }

  const isKeyActive = activeKeys.has(key) || activeKeys.has(audioKey(norm)) || activeKeys.has(audioKey(text));
  const isTextActive = activeTexts.has(norm) || activeTexts.has(text);

  if (isKeyActive || isTextActive) {
    toKeep[key] = clip;
  } else {
    toDelete[key] = clip;
  }
}

console.log(`Initial clips in manifest: ${Object.keys(manifest.clips).length}`);
console.log(`Clips to KEEP: ${Object.keys(toKeep).length}`);
console.log(`Clips to DELETE: ${Object.keys(toDelete).length}`);

// 6. Safe file reference counting
const filesReferencedByKeep = new Set();
for (const clip of Object.values(toKeep)) {
  if (clip.file) filesReferencedByKeep.add(clip.file);
}

const filesToDelete = new Set();
for (const clip of Object.values(toDelete)) {
  if (clip.file && !filesReferencedByKeep.has(clip.file)) {
    filesToDelete.add(clip.file);
  }
}

console.log(`Unique MP3 files to DELETE from disk: ${filesToDelete.size}`);
console.log(`Unique MP3 files to KEEP on disk: ${filesReferencedByKeep.size}`);

// 7. Delete orphaned MP3 files from public/audio/v1 and dist/audio/v1
const publicAudioDir = path.resolve('public/audio/v1');
const distAudioDir = path.resolve('dist/audio/v1');

let deletedPublicCount = 0;
let deletedDistCount = 0;

for (const file of filesToDelete) {
  const pPath = path.join(publicAudioDir, file);
  if (fs.existsSync(pPath)) {
    fs.unlinkSync(pPath);
    deletedPublicCount++;
  }
  if (fs.existsSync(distAudioDir)) {
    const dPath = path.join(distAudioDir, file);
    if (fs.existsSync(dPath)) {
      fs.unlinkSync(dPath);
      deletedDistCount++;
    }
  }
}

console.log(`Deleted ${deletedPublicCount} files from public/audio/v1`);
console.log(`Deleted ${deletedDistCount} files from dist/audio/v1`);

// 8. Update manifest.json (both public and dist)
manifest.clips = toKeep;
fs.writeFileSync(publicManifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Updated ${publicManifestPath}`);

if (fs.existsSync(distManifestPath)) {
  fs.writeFileSync(distManifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Updated ${distManifestPath}`);
}

// 9. Clean up temp file
if (fs.existsSync('scripts/temp-catalog.js')) {
  fs.unlinkSync('scripts/temp-catalog.js');
}

console.log('Audio pruning completed successfully!');
