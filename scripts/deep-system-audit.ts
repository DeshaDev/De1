import fs from 'node:fs';
import path from 'node:path';
import { LEXICON } from '../src/cognitiveProfile/lexicon';
import { WORD_PRACTICE, WORD_ITEMS, NONWORD_PRACTICE, NONWORD_ITEMS } from '../src/cognitiveProfile/readingTasks';
import { getStructuredLiteracyStations } from '../src/cognitiveProfile/structuredLiteracyStations';
import { ARABIC_READING_PASSAGES } from '../src/data/seedData';
import { twemojiFilename, BUNDLED_PICTURES } from '../src/cognitiveProfile/pictures';
import { TRANSFER_FORMS } from '../src/cognitiveProfile/transferProbe';

interface AuditIssue {
  category: 'diacritic' | 'orthography' | 'grammar' | 'audio' | 'word' | 'image' | 'pedagogy';
  location: string;
  item: string;
  issue: string;
  suggestion?: string;
}

const issues: AuditIssue[] = [];

// -------------------------------------------------------------
// 1. Orthography & Diacritics Regex Checks
// -------------------------------------------------------------
// Two short vowels on same char, consecutive double harakat
const DOUBLE_HARAKAT = /([ًٌٍَُِْ]){2,}/u;
// Tanween on alif instead of pre-alif letter (e.g. اً rather than ًا)
const TANWEEN_ON_ALIF = /[ا]ً/u;
// Invalid combination like Sukun + Haraka
const SUKUN_HARAKA = /ْ[ًٌٍَُِ]/u;
// Dammah directly followed by wrong diacritic
const DAMMAH_SUKUN_CLASH = /ُْ/u;
// Grammar blunder patterns: e.g. "١ أجزاء", "٢ مقاطع", "٣ مقطع", "٤ جزء"
const NUMBER_AGREEMENT_BLUNDER = /[٠١] أجزاء|[٠١] مقاطع|[٠١] صفقات|[٢] أجزاء|[٢] مقاطع|[٢] صفقات|[٣-٩] مقطع(?!\b)|[٣-٩] جزء(?!\b)/u;

function auditArabicString(str: string, location: string, tag: string) {
  if (!str) return;

  // Check double harakat (excluding shaddah + vowel)
  const strippedOfShaddah = str.replace(/ّ[ًٌٍَُِ]/gu, '').replace(/[ًٌٍَُِ]ّ/gu, '');
  if (DOUBLE_HARAKAT.test(strippedOfShaddah)) {
    issues.push({
      category: 'diacritic',
      location,
      item: str,
      issue: `توالي حركتين على حرف واحد: "${str.match(DOUBLE_HARAKAT)?.[0]}"`,
    });
  }

  // Check sukun + haraka clash
  if (SUKUN_HARAKA.test(str)) {
    issues.push({
      category: 'diacritic',
      location,
      item: str,
      issue: `سكون متبوع بحركة على نفس الحرف`,
    });
  }

  // Check number agreement blunder
  if (NUMBER_AGREEMENT_BLUNDER.test(str)) {
    issues.push({
      category: 'grammar',
      location,
      item: str,
      issue: `خطأ في مطابقة العدد والمعدود: "${str.match(NUMBER_AGREEMENT_BLUNDER)?.[0]}"`,
    });
  }
}

// -------------------------------------------------------------
// 2. Lexicon Audit
// -------------------------------------------------------------
console.log('Auditing LEXICON entries...');
const picturesDir = path.resolve('public/pictures');

for (const [id, entry] of Object.entries(LEXICON)) {
  auditArabicString(entry.word, `LEXICON.${id}.word`, 'lexicon');
  for (let sIdx = 0; sIdx < entry.syllables.length; sIdx++) {
    const s = entry.syllables[sIdx];
    auditArabicString(s, `LEXICON.${id}.syllables[${sIdx}]`, 'lexicon');
  }

  // Verify Syllable concatenation equals word (accounting for shaddah decomposition into two consonants and pausal forms)
  const normWord = entry.word.replace(/[ً-ْٰ]/g, '');
  const normSyllables = entry.syllables.map(s => s.replace(/[ً-ْٰ]/g, '')).join('');
  const collapsesShaddah = normSyllables.replace(/(.)\1/g, '$1');
  if (normWord !== normSyllables && normWord !== normSyllables.replace(/ة$/, 'ه') && normWord !== collapsesShaddah) {
    issues.push({
      category: 'orthography',
      location: `LEXICON.${id}`,
      item: `${entry.word} vs ${entry.syllables.join('+')}`,
      issue: `عدم تطابق حروف الكلمة مع مجموع مقاطعها الصرفية`,
    });
  }

  // Check picture file existence
  const fn = twemojiFilename(entry.emoji);
  if (!fs.existsSync(path.join(picturesDir, fn))) {
    issues.push({
      category: 'image',
      location: `LEXICON.${id}`,
      item: `${entry.emoji} (${fn})`,
      issue: `ملف الصورة غير موجود في public/pictures`,
    });
  }
}

// -------------------------------------------------------------
// 3. Structured Literacy Stations Audit
// -------------------------------------------------------------
console.log('Auditing Structured Literacy Stations...');
for (const age of [4, 6, 8]) {
  const stations = getStructuredLiteracyStations(age);
  for (const st of stations) {
    auditArabicString(st.titleAr, `Station.${st.id}.titleAr`, 'station');
    auditArabicString(st.teachAr, `Station.${st.id}.teachAr`, 'station');
    auditArabicString(st.teachAudioAr, `Station.${st.id}.teachAudioAr`, 'station');
    auditArabicString(st.modelAr, `Station.${st.id}.modelAr`, 'station');
    auditArabicString(st.modelAudioAr, `Station.${st.id}.modelAudioAr`, 'station');

    for (const q of st.questions) {
      auditArabicString(q.promptAr, `Station.${st.id}.question.${q.id}.promptAr`, 'station');
      auditArabicString(q.explanationAr, `Station.${st.id}.question.${q.id}.explanationAr`, 'station');
      for (const a of q.audio) auditArabicString(a, `Station.${st.id}.question.${q.id}.audio`, 'station');
      for (const opt of q.options) {
        if (opt.labelAr) auditArabicString(opt.labelAr, `Station.${st.id}.question.${q.id}.opt.${opt.id}`, 'station');
        if (opt.emoji) {
          const fn = twemojiFilename(opt.emoji);
          if (!fs.existsSync(path.join(picturesDir, fn))) {
            issues.push({
              category: 'image',
              location: `Station.${st.id}.question.${q.id}.opt.${opt.id}`,
              item: `${opt.emoji} (${fn})`,
              issue: `صورة الخيار غير موجودة في public/pictures`,
            });
          }
        }
      }
    }
  }
}

// -------------------------------------------------------------
// 4. Reading Tasks & Nonwords Audit
// -------------------------------------------------------------
console.log('Auditing Reading Tasks & Nonwords...');
for (const item of [...WORD_PRACTICE, ...WORD_ITEMS, ...NONWORD_PRACTICE, ...NONWORD_ITEMS]) {
  auditArabicString(item.text, `READING_TASKS.${item.id}`, 'readingTask');
}

// Check Transfer probe forms
console.log('Auditing Transfer Probe forms...');
for (const [formKey, form] of Object.entries(TRANSFER_FORMS)) {
  for (const item of [...form.real, ...form.nonword]) {
    auditArabicString(item.text, `TRANSFER_FORMS.${formKey}.${item.id}`, 'transferProbe');
  }
  auditArabicString(form.passage.text, `TRANSFER_FORMS.${formKey}.passage`, 'transferProbe');
}

// -------------------------------------------------------------
// 5. Seed Data Reading Passages Audit
// -------------------------------------------------------------
console.log('Auditing Reading Passages...');
for (const p of ARABIC_READING_PASSAGES) {
  auditArabicString(p.title, `PASSAGE.${p.id}.title`, 'passage');
  for (const w of p.words) {
    auditArabicString(w, `PASSAGE.${p.id}.word`, 'passage');
  }
  for (const q of p.comprehensionQuestions) {
    auditArabicString(q.question, `PASSAGE.${p.id}.question.${q.id}`, 'passage');
    for (const o of q.options) {
      auditArabicString(o, `PASSAGE.${p.id}.option`, 'passage');
    }
  }
}

// -------------------------------------------------------------
// 6. Manifest & Audio Files Integrity Audit
// -------------------------------------------------------------
console.log('Auditing Audio Manifest and audio files...');
const manifestPath = path.resolve('public/audio/v1/manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const clips = manifest.clips || {};
  let missingFiles = 0;
  let emptyFiles = 0;
  for (const [hash, clip] of Object.entries<any>(clips)) {
    const filePath = path.join(path.dirname(manifestPath), clip.file);
    if (!fs.existsSync(filePath)) {
      missingFiles++;
      issues.push({
        category: 'audio',
        location: `manifest.clips.${hash}`,
        item: clip.file,
        issue: `ملف الصوت غير موجود على القرص: ${clip.file}`,
      });
    } else {
      const sz = fs.statSync(filePath).size;
      if (sz === 0) {
        emptyFiles++;
        issues.push({
          category: 'audio',
          location: `manifest.clips.${hash}`,
          item: clip.file,
          issue: `ملف الصوت فارغ (0 بايت): ${clip.file}`,
        });
      }
    }
  }
  console.log(`Audited ${Object.keys(clips).length} audio clips. Missing: ${missingFiles}, Empty: ${emptyFiles}`);
}

console.log('\n--- AUDIT SUMMARY ---');
console.log(`Total issues identified: ${issues.length}`);
for (const iss of issues) {
  console.log(`[${iss.category.toUpperCase()}] at ${iss.location}: ${iss.issue} (Item: ${iss.item})`);
}
