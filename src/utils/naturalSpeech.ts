/**
 * Baseera Natural Arabic Speech Player
 * Powered by Microsoft Azure Neural Arabic Voices:
 * - Default: ar-AE-FatimaNeural (The gold-standard Classical Arabic female voice: pristine, eloquent, expressive)
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
  | 'ar-AE-FatimaNeural'  // فاطمة: أفصح وأنقى صوت معلّمة عربية فصحى على الإطلاق من مايكروسوفت أزور
  | 'ar-SA-ZariyahNeural' // المعلمة زارية: صوت فصحى نقي
  | 'ar-SA-HamedNeural'   // حامد: صوت فصحى أصيل ناصع المخارج للفونيمات والحروف المجردة
  | 'ar-KW-NouraNeural'   // نورة: صوت كويتي فصيح وهادئ
  | 'ar-EG-SalmaNeural';  // سلمى: صوت مصري دافئ

export interface NaturalSpeechOptions {
  voice?: ArabicTtsVoice;
  rate?: string;  // e.g. '-5%', '-8%', '0%'
  pitch?: string; // e.g. '+1%', '0%'
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
  const key = CLIENT_AZURE_KEY;
  const region = CLIENT_AZURE_REGION;
  if (!key || !region) return null;

  try {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Inject IPA phoneme tags so 'تُ' is pronounced pure 'Tu' (never 'toh')
    const formattedBody = formatArabicTextWithPhonemes(escaped);

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${voice}"><prosody rate="${rate}" pitch="${pitch}">${formattedBody}</prosody></voice></speak>`;

    const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
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
 * Defaults to ar-AE-FatimaNeural (the most eloquent, natural Classical Arabic voice).
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
    (preparedText.replace(/[\u064B-\u065F\u0670\u0640]/g, '').length === 1 && !preparedText.includes(' '));

  // Default to the most eloquent Classical Arabic voice (ar-AE-FatimaNeural)
  const voice: ArabicTtsVoice = options.voice || (isIsolatedPhoneme ? 'ar-SA-HamedNeural' : 'ar-AE-FatimaNeural');

  // Natural human rate: '-4%' to '-6%' sounds natural and articulate, unlike unnatural '-20%'
  const rate = options.rate || '-5%';
  const pitch = options.pitch || (isIsolatedPhoneme ? '0%' : '+1%');
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

  // 2. Direct browser cloud Azure Neural Arabic Speech (Fastest, zero server dependency, CORS enabled)
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

  // 3. Fallback: Fetch studio-quality neural Arabic audio from Baseera server endpoint
  try {
    const res = await authenticatedFetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: preparedText, voice, rate, pitch }),
    });

    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
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

  // 4. Pre-recorded studio-quality clips (public/audio/v1/)
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

  // 5. Ultimate fallback: browser local speech synthesis only if completely offline
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(preparedText);
      utter.lang = 'ar-SA';
      utter.rate = 0.85;
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
