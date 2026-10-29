/** Print the review bank as JSON (input for check-diacritics.py and for offline review). */
import fs from 'node:fs';
import { buildReviewUnits } from '../../src/review/itemBank';
const manifest = JSON.parse(fs.readFileSync('public/audio/v1/manifest.json', 'utf8'));
process.stdout.write(JSON.stringify(buildReviewUnits(manifest)));
