/**
 * Blind Acoustic Audit for all pre-recorded Arabic audio clips in public/audio/v1/manifest.json.
 *
 * Scientific principle:
 * - Sends ONLY the raw MP3 audio to Gemini Multimodal (via OpenRouter) WITHOUT showing
 *   the expected text (strictly blind transcription) to eliminate confirmation bias.
 * - Compares the blindly heard vowelled Arabic text against the manifest's expected text
 *   deterministically, flagging CRITICAL (wrong letters/words/robotic/glitched/silent)
 *   and WARNING (vowel/diacritic mismatch) clips for targeted human listening.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

interface ManifestClip {
  text: string;
  file: string;
  bytes?: number;
}

interface Manifest {
  clips: Record<string, ManifestClip>;
}

interface BlindAuditResult {
  file: string;
  heard: string;
  quality: 'good' | 'robotic' | 'glitched' | 'unclear' | 'silent';
  issueAr: string;
  error?: string;
}

interface FlaggedEntry {
  severity: 'CRITICAL' | 'WARNING';
  file: string;
  expected: string;
  aliases: string[];
  heard: string;
  quality: string;
  reason: string;
  consonantDistance: number;
}

const MANIFEST_PATH = path.resolve('public/audio/v1/manifest.json');
const AUDIO_DIR = path.resolve('public/audio/v1');
const CACHE_PATH = process.env.AUDIT_CACHE_PATH
  ? path.resolve(process.env.AUDIT_CACHE_PATH)
  : path.resolve('C:/Users/User/.gemini/antigravity/brain/458a8d53-b61c-4f5c-9a89-f1eed2f8a408/scratch/blind_audio_audit_cache.json');
const REPORT_PATH = process.env.AUDIT_REPORT_PATH
  ? path.resolve(process.env.AUDIT_REPORT_PATH)
  : path.resolve('C:/Users/User/.gemini/antigravity/brain/458a8d53-b61c-4f5c-9a89-f1eed2f8a408/blind_audio_audit_report.md');

const CONCURRENCY = Number(process.env.AUDIT_CONCURRENCY || 15);
const MODEL = process.env.AUDIT_MODEL || 'google/gemini-2.5-flash';

const OPENROUTER_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
if (!OPENROUTER_KEY) {
  console.error('OPENROUTER_API_KEY is required in .env to run the blind audio audit.');
  process.exit(1);
}

const BLIND_PROMPT = `أنت مدقّق صوتي خبير في اللغة العربية الفصحى والأصوات الفونولوجية التعليمية للأطفال.
استمع إلى هذا المقطع الصوتي فقط، وأرجع كائن JSON دقيقًا بالحقول التالية:
{
  "heard": "التفريغ الحرفي الدقيق لما نُطق في التسجيل بالضبط مع كامل التشكيل المسموع (فتحة، ضمة، كسرة، سكون، شدة، تنوين). حتى لو كان المقطع حرفًا واحدًا بحركة مثل «قَ» أو مقطعًا قصيرًا مثل «تُفْ» أو «لَحْ»، أو كلمة غير حقيقية مصنوعة مثل «بَتَمُ» أو «فُوبُ»؛ اكتب الصوت المسموع حرفيًا كما هو دون تخمين كلمة حقيقية أخرى.",
  "quality": "good | robotic | glitched | unclear | silent",
  "issueAr": "ملاحظة عربية مختصرة فقط إذا كان هناك نطق آلي غريب، أو قطع في البداية أو النهاية، أو تشويش، أو تكرار، أو خطأ واضح؛ وإلا اتركه فارغًا \"\""
}
أرجع JSON صالحًا فقط دون أي نص خارجه.`;

function stripHarakatAndPunct(text: string): string {
  return (text || '')
    .normalize('NFC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[.,!?،؟؛:"«»()[\]{}…\-–—ـ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPunctOnly(text: string): string {
  return (text || '')
    .normalize('NFC')
    .replace(/[.,!?،؟؛:"«»()[\]{}…\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

function normalizedDistance(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return levenshtein(a, b) / maxLen;
}

/** Extract consonant+vowel sequence ignoring final pausal sukun/dammah on isolated words. */
function internalVowelsSignature(word: string): string {
  const clean = stripPunctOnly(word).replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه');
  // Remove trailing short vowel or sukun at word end (Arabic waqf equivalence)
  return clean.replace(/[\u064B-\u0652]+$/u, '');
}

async function auditOneClip(file: string): Promise<BlindAuditResult> {
  const fullPath = path.join(AUDIO_DIR, file);
  const mp3Base64 = fs.readFileSync(fullPath).toString('base64');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Haya Naqra Blind Audio Audit',
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          max_tokens: 200,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: BLIND_PROMPT },
                { type: 'input_audio', input_audio: { data: mp3Base64, format: 'mp3' } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.status === 429 || res.status === 402 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          file,
          heard: '',
          quality: 'unclear',
          issueAr: `HTTP ${res.status}`,
          error: errText.slice(0, 160),
        };
      }

      const data: any = await res.json();
      const content = String(data?.choices?.[0]?.message?.content || '').trim();
      const cleanJson = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleanJson);
      const quality = ['good', 'robotic', 'glitched', 'unclear', 'silent'].includes(parsed.quality)
        ? parsed.quality
        : 'good';

      return {
        file,
        heard: String(parsed.heard || '').trim(),
        quality,
        issueAr: String(parsed.issueAr || '').trim(),
      };
    } catch (err) {
      if (attempt === 3) {
        return {
          file,
          heard: '',
          quality: 'unclear',
          issueAr: 'فشل التحليل بعد 3 محاولات',
          error: err instanceof Error ? err.message : String(err),
        };
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  return { file, heard: '', quality: 'unclear', issueAr: 'تعذر الفحص' };
}

function classifyResult(expectedTexts: string[], result: BlindAuditResult): FlaggedEntry | null {
  const primaryExpected = expectedTexts[0];
  const aliases = expectedTexts.slice(1);

  if (result.error) {
    return {
      severity: 'CRITICAL',
      file: result.file,
      expected: primaryExpected,
      aliases,
      heard: result.heard || '—',
      quality: result.quality,
      reason: `خطأ تقني أثناء الفحص: ${result.issueAr}`,
      consonantDistance: 1,
    };
  }

  if (result.quality === 'silent' || !result.heard.trim()) {
    return {
      severity: 'CRITICAL',
      file: result.file,
      expected: primaryExpected,
      aliases,
      heard: result.heard || '(صمت)',
      quality: result.quality,
      reason: 'المقطع صامت أو لم يُلتقط فيه كلام مسموع',
      consonantDistance: 1,
    };
  }

  if (result.quality === 'robotic' || result.quality === 'glitched' || result.quality === 'unclear') {
    return {
      severity: 'CRITICAL',
      file: result.file,
      expected: primaryExpected,
      aliases,
      heard: result.heard,
      quality: result.quality,
      reason: `جودة صوتية مشبوهة (${result.quality})${result.issueAr ? `: ${result.issueAr}` : ''}`,
      consonantDistance: 0.5,
    };
  }

  // Compare heard against ALL expected aliases pointing to this file; pick closest match
  const heardCons = stripHarakatAndPunct(result.heard);
  let bestDist = Infinity;
  let bestExpected = primaryExpected;

  for (const exp of expectedTexts) {
    const expCons = stripHarakatAndPunct(exp);
    const dist = normalizedDistance(expCons, heardCons);
    if (dist < bestDist) {
      bestDist = dist;
      bestExpected = exp;
    }
  }

  const bestExpCons = stripHarakatAndPunct(bestExpected);
  const isVeryShort = bestExpCons.replace(/\s+/g, '').length <= 3;

  // Special tolerance for single-letter/syllable prompts: e.g. "بَ" might be transcribed as "با" or "بَ"
  const heardNoLongA = heardCons.replace(/ا$/u, '');
  const expNoLongA = bestExpCons.replace(/ا$/u, '');

  // Check CRITICAL consonant divergence
  if (isVeryShort) {
    const shortMatch =
      bestExpCons === heardCons ||
      (bestExpCons.length === 1 && heardCons.startsWith(bestExpCons) && heardCons.length <= 2) ||
      (expNoLongA === heardNoLongA && Math.abs(bestExpCons.length - heardCons.length) <= 1);
    if (!shortMatch) {
      return {
        severity: 'CRITICAL',
        file: result.file,
        expected: bestExpected,
        aliases: expectedTexts.filter((t) => t !== bestExpected),
        heard: result.heard,
        quality: result.quality,
        reason: `اختلاف في الحروف لمقطع/كلمة قصيرة (المفترض «${bestExpected}» والمسموع «${result.heard}»)${result.issueAr ? ` — ${result.issueAr}` : ''}`,
        consonantDistance: bestDist,
      };
    }
  } else {
    if (bestDist > 0.22) {
      return {
        severity: 'CRITICAL',
        file: result.file,
        expected: bestExpected,
        aliases: expectedTexts.filter((t) => t !== bestExpected),
        heard: result.heard,
        quality: result.quality,
        reason: `تباعد واضح في الحروف/الكلمات (نسبة الاختلاف ${Math.round(bestDist * 100)}٪)${result.issueAr ? ` — ${result.issueAr}` : ''}`,
        consonantDistance: bestDist,
      };
    }
  }

  // Check WARNING: moderate consonant drift OR internal vowel mismatch on single words/syllables OR model noted an issue
  if (!isVeryShort && bestDist > 0.08) {
    return {
      severity: 'WARNING',
      file: result.file,
      expected: bestExpected,
      aliases: expectedTexts.filter((t) => t !== bestExpected),
      heard: result.heard,
      quality: result.quality,
      reason: `فرق طفيف في الحروف أو كلمة واحدة (نسبة الاختلاف ${Math.round(bestDist * 100)}٪)${result.issueAr ? ` — ${result.issueAr}` : ''}`,
      consonantDistance: bestDist,
    };
  }

  // For isolated single-word or syllable clips (no spaces), check internal short vowels
  if (!bestExpCons.includes(' ') && bestExpCons.length >= 2) {
    const expSig = internalVowelsSignature(bestExpected);
    const heardSig = internalVowelsSignature(result.heard);
    // Extract only vowels on matching consonants if lengths align
    const expVowels = (expSig.match(/[\u064E\u064F\u0650]/g) || []).join('');
    const heardVowels = (heardSig.match(/[\u064E\u064F\u0650]/g) || []).join('');
    if (expVowels.length > 0 && heardVowels.length > 0 && expVowels !== heardVowels) {
      return {
        severity: 'WARNING',
        file: result.file,
        expected: bestExpected,
        aliases: expectedTexts.filter((t) => t !== bestExpected),
        heard: result.heard,
        quality: result.quality,
        reason: `احتمال اختلاف في الحركات الداخلية (المفترض «${bestExpected}» والمسموع «${result.heard}»)`,
        consonantDistance: bestDist,
      };
    }
  }

  if (result.issueAr && result.issueAr.length > 2) {
    return {
      severity: 'WARNING',
      file: result.file,
      expected: bestExpected,
      aliases: expectedTexts.filter((t) => t !== bestExpected),
      heard: result.heard,
      quality: result.quality,
      reason: `ملاحظة جودة صوتية: ${result.issueAr}`,
      consonantDistance: bestDist,
    };
  }

  return null;
}

async function main() {
  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const byFile = new Map<string, string[]>();
  for (const clip of Object.values(manifest.clips)) {
    if (!byFile.has(clip.file)) byFile.set(clip.file, []);
    byFile.get(clip.file)!.push(clip.text);
  }

  const allFiles = [...byFile.keys()].sort();
  console.log(`Loaded ${Object.keys(manifest.clips).length} manifest entries (${allFiles.length} unique MP3 files).`);

  // Load cache if exists
  let cache: Record<string, BlindAuditResult> = {};
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  if (fs.existsSync(CACHE_PATH)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
      console.log(`Loaded ${Object.keys(cache).length} cached results from ${CACHE_PATH}.`);
    } catch {
      cache = {};
    }
  }

  const pending = allFiles.filter((f) => !cache[f] || cache[f].error);
  console.log(`Pending files to audit blindly: ${pending.length} (concurrency: ${CONCURRENCY}, model: ${MODEL})`);

  let completed = allFiles.length - pending.length;
  let nextIdx = 0;
  const startedAt = Date.now();

  const saveCache = () => {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  };

  async function worker() {
    while (true) {
      const idx = nextIdx++;
      if (idx >= pending.length) break;
      const file = pending[idx];
      const res = await auditOneClip(file);
      cache[file] = res;
      completed++;
      if (completed % 25 === 0 || completed === allFiles.length) {
        saveCache();
        const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`Progress: ${completed}/${allFiles.length} (${Math.round((completed / allFiles.length) * 100)}%) — ${elapsedSec}s`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, pending.length)) }, () => worker()));
  saveCache();

  // Classify all files
  const flagged: FlaggedEntry[] = [];
  for (const file of allFiles) {
    const res = cache[file];
    if (!res) continue;
    const item = classifyResult(byFile.get(file)!, res);
    if (item) flagged.push(item);
  }

  const critical = flagged.filter((f) => f.severity === 'CRITICAL').sort((a, b) => b.consonantDistance - a.consonantDistance);
  const warnings = flagged.filter((f) => f.severity === 'WARNING').sort((a, b) => b.consonantDistance - a.consonantDistance);
  const cleanCount = allFiles.length - flagged.length;

  const lines: string[] = [
    '# تقرير المراجعة الصوتية العمياء للمقاطع المسجّلة (878 مدخلًا / 862 ملفًا)',
    '',
    `> **منهجية الفحص:** تم إرسال كل ملف صوتي على حدة إلى النموذج السمعي (\`${MODEL}\`) **بشكل أعمى تمامًا** دون تمرير النص المفترض له، لمنع الانحياز التأكيدي. ثم قُورن ما سُمع حرفيًا بالنص الموجود في \`public/audio/v1/manifest.json\`.`,
    '',
    '## الملخص الإحصائي',
    '',
    `- **إجمالي مدخلات البيان (Manifest):** ${Object.keys(manifest.clips).length}`,
    `- **إجمالي الملفات الصوتية الفريدة المفحوصة:** ${allFiles.length}`,
    `- **سليمة ومطابقة تمامًا:** ${cleanCount} ملفًا (${Math.round((cleanCount / allFiles.length) * 100)}٪)`,
    `- **مشبوهة بشدة (تتطلب استماعًا وإعادة توليد فورية — CRITICAL):** ${critical.length} ملفًا`,
    `- **ملاحظات تشكيل أو فروق طفيفة (للمراجعة السريعة — WARNING):** ${warnings.length} ملفًا`,
    '',
    '---',
    '',
    `## أولًا: المقاطع المشبوهة بشدة — استمع إليها أولًا (${critical.length})`,
    '',
  ];

  if (critical.length === 0) {
    lines.push('لا توجد مقاطع مشبوهة بشدة.');
  } else {
    lines.push('| # | الملف | النص المفترض | ما سُمع فعليًا (تفريغ أعمى) | السبب |');
    lines.push('|---|---|---|---|---|');
    critical.forEach((c, i) => {
      const safeExp = c.expected.replace(/\|/g, '&#124;');
      const safeHeard = c.heard.replace(/\|/g, '&#124;');
      const safeReason = c.reason.replace(/\|/g, '&#124;');
      lines.push(`| ${i + 1} | \`${c.file}\` | ${safeExp} | ${safeHeard} | ${safeReason} |`);
    });
  }

  lines.push('', '---', '', `## ثانيًا: ملاحظات التشكيل والفروق الطفيفة (${warnings.length})`, '');
  if (warnings.length === 0) {
    lines.push('لا توجد ملاحظات تشكيل أو فروق طفيفة.');
  } else {
    lines.push('| # | الملف | النص المفترض | ما سُمع فعليًا (تفريغ أعمى) | السبب |');
    lines.push('|---|---|---|---|---|');
    warnings.forEach((w, i) => {
      const safeExp = w.expected.replace(/\|/g, '&#124;');
      const safeHeard = w.heard.replace(/\|/g, '&#124;');
      const safeReason = w.reason.replace(/\|/g, '&#124;');
      lines.push(`| ${i + 1} | \`${w.file}\` | ${safeExp} | ${safeHeard} | ${safeReason} |`);
    });
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');

  console.log('\n=== BLIND AUDIO AUDIT COMPLETE ===');
  console.log(`Total files: ${allFiles.length} | Clean: ${cleanCount} | CRITICAL: ${critical.length} | WARNING: ${warnings.length}`);
  console.log(`Report written to: ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error in blind audio audit:', err);
  process.exit(1);
});
