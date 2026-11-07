/**
 * Baseera Natural Arabic Speech Player
 * Powered by Microsoft Azure Neural Arabic Voices:
 * - Default: ar-EG-SalmaNeural (Warm, maternal, pedagogical teacher voice for stories & sentences)
 * - Phonemes / Isolated Letters: ar-SA-HamedNeural with Classical Fusha IPA (Tu, Ti, Ta, Bu...)
 *
 * Provides 100% authentic human-grade makharij al-huruf with client-side caching
 * and direct browser cloud fallback for static hosting (cPanel / Namecheap).
 */

import { authenticatedFetch } from './apiAuth';
import { formatArabicTextWithPhonemes, getArabicPhonemeIpa } from './arabicPhonemeBank';
import { audioKey } from '../cognitiveProfile/audioCatalog';

let manifestCache: { clips: Record<string, { file: string }> } | null = null;
async function getAudioManifest(): Promise<{ clips: Record<string, { file: string }> } | null> {
  if (manifestCache) return manifestCache;
  try {
    const res = await fetch('/audio/v1/manifest.json', { cache: 'force-cache' });
    if (res.ok) {
      manifestCache = await res.json();
      return manifestCache;
    }
  } catch {}
  return null;
}

const audioMemoryCache = new Map<string, string>();
const MAX_AUDIO_CACHE_ENTRIES = 50;
const MAX_CACHED_AUDIO_URL_CHARS = 500_000;
let currentActiveAudio: HTMLAudioElement | null = null;

// Azure Speech credentials (direct browser fallback for static hosting like cPanel)
const CLIENT_AZURE_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AZURE_SPEECH_KEY) || '';

const CLIENT_AZURE_REGION =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AZURE_SPEECH_REGION) || 'eastus';

function cacheAudio(key: string, dataUrl: string): void {
  if (dataUrl.length > MAX_CACHED_AUDIO_URL_CHARS) return;
  audioMemoryCache.delete(key);
  while (audioMemoryCache.size >= MAX_AUDIO_CACHE_ENTRIES) {
    const oldestKey = audioMemoryCache.keys().next().value;
    if (oldestKey === undefined) break;
    audioMemoryCache.delete(oldestKey);
  }
  audioMemoryCache.set(key, dataUrl);
}

export type ArabicTtsVoice =
  | 'ar-EG-SalmaNeural'   // المعلمة سلمى: صوت تربوي أمومي دافئ للقصص والجمل
  | 'ar-SA-HamedNeural'   // حامد: صوت فصحى أصيل ناصع المخارج للفونيمات والحروف المجردة
  | 'ar-AE-FatimaNeural'  // فاطمة: صوت خليجي فصيح وهادئ
  | 'ar-SA-ZariyahNeural' // زارية: صوت سعودي فصيح
  | 'ar-KW-NouraNeural';  // نورة: صوت كويتي فصيح

export interface NaturalSpeechOptions {
  voice?: ArabicTtsVoice;
  rate?: string;  // e.g. '-12%', '-10%', '-5%'
  pitch?: string; // e.g. '+2%', '0%'
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Prepares Arabic text for pristine educational neural articulation:
 * 1. Strips tatweel (kashida 'ـ') which distorts acoustic models.
 * 2. Normalizes whitespaces.
 * 3. Preserves natural Arabic waqf without injecting artificial tanween.
 */
export function prepareArabicTtsText(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  // Strip tatweel/kashida
  cleaned = cleaned.replace(/ـ+/g, '');

  // Normalize excessive whitespaces
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned;
}

/**
 * Synthesizes Arabic speech directly via Azure Neural TTS REST API (Client-side with CORS)
 * Ensures 100% studio-quality natural audio even on static hosts (Namecheap / cPanel)
 * using Classical Fusha IPA phoneme tags for isolated sounds and letters.
 */
async function fetchDirectAzureAudio(
  text: string,
  voice: ArabicTtsVoice,
  rate: string,
  pitch: string
): Promise<string | null> {
  if (!CLIENT_AZURE_KEY || !CLIENT_AZURE_REGION) return null;

  try {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Inject IPA phoneme tags so 'تُ' is pronounced pure 'Tu' (never 'toh')
    const formattedBody = formatArabicTextWithPhonemes(escaped);

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${voice}"><prosody rate="${rate}" pitch="${pitch}">${formattedBody}</prosody></voice></speak>`;

    const endpoint = `https://${CLIENT_AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': CLIENT_AZURE_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        'User-Agent': 'HayanAqra-Pedagogical-Audio',
      },
      body: ssml,
    });

    if (res.ok) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn('[NaturalSpeech] Direct Azure TTS fetch error:', err);
  }

  return null;
}

/**
 * Play crystal-clear natural Arabic speech with 100% accurate makharij al-huruf.
 * For isolated letters and letter-sound tasks (تُ، بَ، سِ...) uses pure Fusha voice with IPA phonemes (Tu, Ba, Si...).
 * For stories and sentences, defaults to warm pedagogical voice (ar-EG-SalmaNeural).
 */
export async function playNaturalArabicAudio(
  text: string,
  options: NaturalSpeechOptions = {}
): Promise<void> {
  const preparedText = prepareArabicTtsText(text);
  if (!preparedText) return;

  // Determine if this is an isolated letter or phoneme
  const isIsolatedPhoneme =
    Boolean(getArabicPhonemeIpa(preparedText)) ||
    (preparedText.length <= 4 && !preparedText.includes(' '));

  // For isolated letters and phonemes, prioritize authentic Classical Fusha voice
  const voice: ArabicTtsVoice = isIsolatedPhoneme
    ? 'ar-SA-HamedNeural'
    : options.voice || 'ar-EG-SalmaNeural';

  const rate = options.rate || '-12%';
  const pitch = options.pitch || (isIsolatedPhoneme ? '0%' : '+2%');
  const cacheKey = `${voice}_${rate}_${pitch}_${preparedText}`;

  // Stop previous audio playback smoothly
  if (currentActiveAudio) {
    try {
      currentActiveAudio.pause();
      currentActiveAudio.currentTime = 0;
    } catch {}
    currentActiveAudio = null;
  }

  // 1. Check client memory cache
  const cachedUrl = audioMemoryCache.get(cacheKey);
  if (cachedUrl) {
    try {
      const audio = new Audio(cachedUrl);
      currentActiveAudio = audio;
      if (options.onEnd) audio.onended = () => options.onEnd?.();
      await audio.play();
      return;
    } catch (e) {
      console.warn('[NaturalSpeech] Cached audio play failed, refreshing:', e);
    }
  }

  // 1.5. Check pre-recorded studio-quality Azure Neural clips (public/audio/v1/)
  try {
    const manifest = await getAudioManifest();
    const clip = manifest?.clips?.[audioKey(preparedText)];
    if (clip?.file) {
      const audioUrl = `/audio/v1/${clip.file}`;
      cacheAudio(cacheKey, audioUrl);
      const audio = new Audio(audioUrl);
      currentActiveAudio = audio;
      if (options.onEnd) audio.onended = () => options.onEnd?.();
      let playSucceeded = false;
      await audio.play().then(() => { playSucceeded = true; }).catch(() => {});
      if (playSucceeded) return;
    }
  } catch {}

  // 2. Fetch studio-quality neural Arabic audio from Baseera server (if backend is running)
  try {
    const res = await authenticatedFetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: preparedText, voice, rate, pitch }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.audioBase64) {
        const mimeType = data.mimeType || 'audio/mp3';
        const dataUrl = `data:${mimeType};base64,${data.audioBase64}`;
        cacheAudio(cacheKey, dataUrl);

        const audio = new Audio(dataUrl);
        currentActiveAudio = audio;
        if (options.onEnd) audio.onended = () => options.onEnd?.();
        await audio.play();
        return;
      }
    }
  } catch {
    // Expected on static hosting where /api/ai/tts is not routed
  }

  // 3. Direct browser cloud fallback to Azure Neural Arabic Speech (for static hosting / cPanel)
  const directAudioUrl = await fetchDirectAzureAudio(preparedText, voice, rate, pitch);
  if (directAudioUrl) {
    try {
      cacheAudio(cacheKey, directAudioUrl);
      const audio = new Audio(directAudioUrl);
      currentActiveAudio = audio;
      if (options.onEnd) audio.onended = () => options.onEnd?.();
      await audio.play();
      return;
    } catch (directErr) {
      console.warn('[NaturalSpeech] Direct Azure audio playback error:', directErr);
    }
  }

  // 4. Ultimate fallback: browser local speech synthesis if offline
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(preparedText);
      utter.lang = voice.startsWith('ar-EG') ? 'ar-EG' : 'ar-SA';
      utter.rate = 0.8;
      if (options.onEnd) utter.onend = () => options.onEnd?.();
      window.speechSynthesis.speak(utter);
    } catch (fallbackErr) {
      options.onError?.(fallbackErr);
    }
  }
}

/** Stop any ongoing speech playback */
export function stopNaturalArabicAudio(): void {
  if (currentActiveAudio) {
    try {
      currentActiveAudio.pause();
      currentActiveAudio.currentTime = 0;
    } catch {}
    currentActiveAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}
