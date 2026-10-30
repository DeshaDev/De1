/**
 * Rebuilds src/cognitiveProfile/gulfNorms.ts from the authors' item data.
 *
 * 1. Download the Gulf Arabic database from https://qufaculty.qu.edu.qa/tariq-khwaileh/download-center/
 *    and extract "Gulf Picturable Nouns.xlsx".
 * 2. npm i --no-save xlsx@0.18.5   (not a project dependency)
 * 3. node scripts/review/gen-gulf-norms.cjs "Gulf Picturable Nouns.xlsx" src/cognitiveProfile/gulfNorms.ts
 */
const fs = require('fs');
const XLSX = require('xlsx');
const num = (v) => (typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')));
// Columns: 0 English, 1 MSA, 2 Gulf target, 3 modal name, 12 name agreement, 17 AoA mean, 21 familiarity mean.
const sheet = XLSX.read(fs.readFileSync(process.argv[2])).Sheets.Sheet1;
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }).slice(3).filter((r) => r[0] !== '')
  .map((r) => ({ en: String(r[0]).trim(), target: r[2], modal: r[3], na: num(r[12]), aoa: num(r[17]), fam: num(r[21]) }));
const by=Object.fromEntries(rows.map(r=>[r.en.trim(),r]));
const map={cat:'Cat',duck:'Duck',dog:'Dog',heart:'Heart',bee:'Bee',palm:'PalmTree',sword:'Sword',sun:'Sun',moon:'Moon',door:'Door',book:'Book',house:'House',pen:'Pen',flag:'Flag',mouth:'Lips',camel:'Camel',fish:'Fish',elephant:'Elephant',banana:'Banana',apple:'Apple',ball:'Ball',corn:'Corn',car:'Car',lion:'Lion',rabbit:'Rabbit',grapes:'Grapes',fox:'Fox',horse:'Horse',dress:'Dress',bell:'Bell',drum:'Drum',carrot:'Carrot',tree:'Tree',cow:'Cow',bear:'Bear',rooster:'Rooster',window:'Window',orange:'Orange',turtle:'Turtle',frog:'Frog',key:'Key',star:'Star',mouse:'Mouse',eye:'Eye',fire:'Fire',umbrella:'Umbrella',egg:'Egg',chicken:'Chicken',boat:'Sailboat',plane:'Airplane',tiger:'Tiger',watch:'Watch',chair:'Chair'};
const r2=(x)=>Math.round(x*100)/100;
let out=`/**
 * Gulf Arabic picture-naming norms for the words in our lexicon.
 *
 * Source: Khwaileh, T., Mustafawi, E., Herbert, R., & Howard, D. (2018). Gulf Arabic nouns and verbs:
 * A standardized set of 319 object pictures and 141 action pictures, with predictors of naming latencies.
 * Behavior Research Methods, 50, 2408–2425. https://doi.org/10.3758/s13428-018-1019-6
 * Item data: "Gulf Picturable Nouns" sheet from the authors' database (qufaculty.qu.edu.qa/tariq-khwaileh/download-center).
 *
 * 170 Qatari adults (18–51 years). The ratings are adults' estimates, not measurements on children.
 * - nameAgreement: share of participants who gave the modal name to the study's own line drawing (0–1).
 *   It describes that drawing, not our pictures.
 * - ageOfAcquisition: 1–7 scale in two-year bands (1 = 0–2 years, 2 = 3–4, 3 = 5–6, 4 = 7–8, 5 = 9–10, 6 = 11–12, 7 = 13+).
 * - familiarity: 1–5 (5 = met very often), rated on the dialect word.
 * - gulfForm: the Gulf dialect form listed by the authors; modalName: the name most participants gave
 *   (short-vowel marks removed, because the source marks them inconsistently).
 * \`concept\` is the study's item when it differs from our word (for example our 👄 is the study's "Lips").
 *
 * Words with no entry (summer, rain, honey, hand, rope, milk, bread, snow, ear) are not in the database.
 * Regenerate only from the source file; do not edit the numbers by hand.
 */
export interface GulfNorm {
  concept: string;
  gulfForm: string;
  modalName: string;
  nameAgreement: number;
  ageOfAcquisition: number;
  familiarity: number;
}

/** Mean rating of 4 = understood at 7–8 years: later than the youngest children the battery screens. */
export const LATE_AGE_OF_ACQUISITION = 4;
/** Below 60% the drawing has a common competing name. */
export const LOW_NAME_AGREEMENT = 0.6;

export const GULF_NORMS_SOURCE = 'Khwaileh, Mustafawi, Herbert & Howard (2018), Behavior Research Methods 50:2408–2425';

export const GULF_NORMS: Record<string, GulfNorm> = {
`;
for (const [id,en] of Object.entries(map)) { const r=by[en]; if(!r) throw new Error(en);
  const clean=(s)=>String(s).replace(/[\u064B-\u0652]/g,'').trim();
  out+=`  ${id}: { concept: '${en}', gulfForm: '${clean(r.target)}', modalName: '${clean(r.modal)}', nameAgreement: ${r2(r.na)}, ageOfAcquisition: ${r2(r.aoa)}, familiarity: ${r2(r.fam)} },\n`; }
out+='};\n';
fs.writeFileSync(process.argv[3],out);
