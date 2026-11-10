/**
 * Pilot evidence report from exported child records.
 *
 * Usage:
 *   npx tsx scripts/pilot-report.ts records.json            # prints the Arabic summary
 *   npx tsx scripts/pilot-report.ts records.json --json     # prints the numbers as JSON
 *
 * records.json: an array of child records (StudentRecord), as exported from the school or family
 * database. Demo records are ignored. Names are not printed.
 */
import fs from 'node:fs';
import { pilotReportAr, pilotSummary } from '../src/cognitiveProfile/pilotEvidence';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npx tsx scripts/pilot-report.ts records.json [--json]');
  process.exit(1);
}
const records = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(records)) {
  console.error('records.json must be an array of child records.');
  process.exit(1);
}
const summary = pilotSummary(records);
console.log(process.argv.includes('--json') ? JSON.stringify(summary, null, 2) : pilotReportAr(summary));
