import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const azureKey = env.match(/AZURE_SPEECH_KEY=(.*)/)?.[1]?.trim();
const azureRegion = env.match(/AZURE_SPEECH_REGION=(.*)/)?.[1]?.trim();

async function transcribe(filePath, referenceText) {
  const audioData = fs.readFileSync(filePath);
  const endpoint = `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ar-SA&format=detailed`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': azureKey,
      'Content-Type': 'audio/mpeg',
    },
    body: audioData,
  });

  const data = await res.json();
  console.log(`[${referenceText}] Recognition Status:`, data.RecognitionStatus, 'DisplayText:', data.DisplayText);
}

async function main() {
  await transcribe('scripts/test-%D9%81%D9%8F%D9%88%D8%A8.mp3', 'فُوب');
  await transcribe('scripts/test-%D8%A3%D9%8E%D8%A8%D9%90%D9%8A%D9%87%D9%92.mp3', 'أَبِيهْ');
  await transcribe('scripts/test-%D8%A8%D9%8E%D8%A7%D9%83%D9%92.mp3', 'بَاكْ');
  await transcribe('scripts/test-%D8%AC%D9%8E%D9%85%D9%8E%D9%84%D9%92.mp3', 'جَمَلْ');
}

main().catch(console.error);
