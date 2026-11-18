import fs from 'node:fs';

const filePath = 'server.ts';
let code = fs.readFileSync(filePath, 'utf8');

const importTarget = "import { prepareArabicTtsText } from './src/utils/naturalSpeech';";
const importRepl = "import { prepareArabicTtsText } from './src/utils/naturalSpeech';\r\nimport { synthesizeNaturalArabicOpenRouter } from './src/utils/openrouterSpeech';";

if (!code.includes(importTarget)) {
  console.error('Import target not found!');
  process.exit(1);
}

code = code.replace(importTarget, importRepl);

const tierTarget = "    // Tier 1: Microsoft Azure Arabic Neural Speech";
const tierRepl = `    // Tier 0.5: OpenRouter OpenAI Audio (Studio-quality human Arabic teacher speech)
    try {
      const openrouterBuffer = await synthesizeNaturalArabicOpenRouter(cleanText, 'sage');
      if (openrouterBuffer && openrouterBuffer.length > 0) {
        const audioBase64 = openrouterBuffer.toString('base64');
        const payload = { audioBase64, mimeType: 'audio/mp3', source: 'openrouter_audio' };
        cacheTtsAudio(cacheKey, payload);
        res.json(payload);
        return;
      }
    } catch (openrouterErr) {
      console.warn('[OpenRouter TTS] Error:', openrouterErr);
    }

    // Tier 1: Microsoft Azure Arabic Neural Speech`;

if (!code.includes(tierTarget)) {
  console.error('Tier target not found!');
  process.exit(1);
}

code = code.replace(tierTarget, tierRepl);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated server.ts with OpenRouter Audio TTS fallback!');
