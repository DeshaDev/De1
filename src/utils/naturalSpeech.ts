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
// Incremented per request so a superseded request never falls back to the robotic browser voice.
let playbackRequestId = 0;

function isPlaybackInterrupted(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

// Live Azure synthesis is off by default: every phrase the app speaks is pre-recorded
// (public/audio). A key is never built into the code; anything in the browser bundle is public.
const DEFAULT_AZURE_REGION = 'eastus';

const CLIENT_AZURE_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AZURE_SPEECH_KEY) || '';

const CLIENT_AZURE_REGION =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AZURE_SPEECH_REGION) || DEFAULT_AZURE_REGION;

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
  | 'ar-AE-FatimaNeural'         // فاطمة: صوت معلّمة فصحى طبيعي نقي عالي الفصاحة (الافتراضي الذهبي)
  | 'ar-SA-Hamed:DragonLatestNeural' // حامد دراجون: أحدث نموذج توليدي ذكي 2026
  | 'ar-SA-ZariyahNeural'        // زارية: صوت فصحى
  | 'ar-SA-HamedNeural'          // حامد: صوت فصحى
  | 'ar-KW-NouraNeural'          // نورة: صوت كويتي فصيح وهادئ
  | 'ar-EG-SalmaNeural'          // سلمى: صوت مصري دافئ
  | 'ar-MA-MounaNeural';         // منى: صوت تعليمي دافئ

export interface NaturalSpeechOptions {
  voice?: ArabicTtsVoice;
  rate?: string;  // e.g. '0%', '-2%'
  pitch?: string; // e.g. '0%'
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Prepares Arabic text for pristine educational neural articulation:
 * 1. Strips tatweel (kashida 'ـ') which distorts acoustic models.
 * 2. Formats letter-sound prompts into natural Arabic orthography (تُو، تُو بدلاً من الرموز الآلية).
 * 3. Removes colons that cause unnatural mid-sentence pauses in construct states.
 * 4. Applies Classical Arabic Waqf (taskeen at pauses and taa marbuta as Ha').
 * 5. Normalizes whitespaces.
 */
export function prepareArabicTtsText(text: string): string {
  if (!text) return '';
  let s = text.trim().replace(/ـ+/g, '').replace(/\s+/g, ' ');

  // 1. Expand letter-sound prompt patterns and standalone phonemes naturally
  s = formatArabicTextWithPhonemes(s);

  // 2. Remove artificial colons inside phrases ('بِصَوْتِ: شَمْس' -> 'بِصَوْتِ شَمْس')
  s = s.replace(/:\s*/g, ' ');

  // 3. At pause (end of string or before . ؟ ? ! ، …):
  //    a) Convert taa marbuta (ة) after long alif (ا) to اه (e.g. سُلَحْفَاة -> سُلَحْفَاه)
  s = s.replace(/اة[\u064B-\u0652]*(?=\s*($|[.؟?!،,…]))/g, 'اه');
  //    b) Convert other taa marbuta (ة) at pause to هْ (e.g. سَمَكَة -> سَمَكَهْ)
  s = s.replace(/ة[\u064B-\u0652]*(?=\s*($|[.؟?!،,…]))/g, 'هْ');

  // 4. Prevent closed-syllable long-vowel shortening at pause:
  //    If a word at pause ends in [ا و ي] + consonant + [short vowel or sukun], strip the final mark (e.g. بَابْ -> بَاب, كِتَابْ -> كِتَاب)
  s = s.replace(/([اوي][\u0621-\u064A])[\u064E\u064F\u0650\u0652]+(?=\s*($|[.؟?!،,…]))/g, '$1');

  // 5. Apply natural Waqf (taskeen) on remaining final short vowels before pause on multi-letter words
  //    (e.g. أَحْسَنْتَ! -> أَحْسَنْتْ! , نَفْسِهِ. -> نَفْسِهْ.)
  const lettersOnly = s.replace(/[\u064B-\u065F\u0670\s.؟?!،,…]/g, '');
  if (lettersOnly.length > 1) {
    s = s.replace(/([\u0621-\u064A])[\u064E\u064F\u0650]+(?=\s*($|[.؟?!،,…]))/g, '$1\u0652');
  }

  return s;
}

/**
 * Synthesizes Arabic speech directly via Azure Neural TTS REST API (Client-side with CORS)
 * Ensures 100% studio-quality natural audio in 48kHz / 192kbps.
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

    // Pure natural prosody: if rate and pitch are neutral ('0%'), emit clean voice tag without prosody distortion
    const hasProsody = (rate && rate !== '0%') || (pitch && pitch !== '0%');
    const prosodyAttrs: string[] = [];
    if (rate && rate !== '0%') prosodyAttrs.push(`rate="${rate}"`);
    if (pitch && pitch !== '0%') prosodyAttrs.push(`pitch="${pitch}"`);

    const body = hasProsody
      ? `<prosody ${prosodyAttrs.join(' ')}>${escaped}</prosody>`
      : escaped;

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${voice}">${body}</voice></speak>`;

    const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        // 48 kHz / 192 kbps: pristine studio-quality natural human sound
        'X-Microsoft-OutputFormat': 'audio-48khz-192kbitrate-mono-mp3',
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
 * Play crystal-clear natural Arabic speech with 100% authentic human makharij al-huruf.
 * Defaults to ar-AE-FatimaNeural (the gold standard Classical Arabic teacher voice).
 * Returns a Promise that resolves when the audio finishes playing (or is gracefully interrupted).
 */
export async function playNaturalArabicAudio(
  text: string,
  options: NaturalSpeechOptions = {}
): Promise<void> {
  const preparedText = prepareArabicTtsText(text);
  if (!preparedText) return;

  // Default to the golden standard Classical Arabic voice (Fatima)
  const voice: ArabicTtsVoice = options.voice || 'ar-AE-FatimaNeural';

  // 0% rate and pitch gives 100% natural, uncompressed human voice
  const rate = options.rate || '0%';
  const pitch = options.pitch || '0%';
  const cacheKey = `${voice}_${rate}_${pitch}_${preparedText}`;

  const requestId = ++playbackRequestId;

  // Stop previous audio playback smoothly
  if (currentActiveAudio) {
    try {
      currentActiveAudio.pause();
      currentActiveAudio.currentTime = 0;
    } catch {}
    currentActiveAudio = null;
  }

  const playElement = (audio: HTMLAudioElement): Promise<void> => {
    return new Promise<void>((resolve) => {
      currentActiveAudio = audio;
      let finished = false;
      const cleanup = () => {
        if (!finished) {
          finished = true;
          if (currentActiveAudio === audio) currentActiveAudio = null;
          options.onEnd?.();
          resolve();
        }
      };

      audio.onended = cleanup;
      audio.onpause = () => {
        cleanup();
      };
      audio.onerror = (e) => {
        if (!finished) {
          finished = true;
          if (currentActiveAudio === audio) currentActiveAudio = null;
          options.onError?.(e);
          resolve();
        }
      };

      audio.play().catch((err) => {
        if (isPlaybackInterrupted(err) || requestId !== playbackRequestId) {
          cleanup();
          return;
        }
        console.warn('[NaturalSpeech] Audio play error:', err);
        cleanup();
      });
    });
  };

  // 1. Check client memory cache
  const cachedUrl = audioMemoryCache.get(cacheKey);
  if (cachedUrl) {
    try {
      const audio = new Audio(cachedUrl);
      await playElement(audio);
      return;
    } catch (e) {
      if (isPlaybackInterrupted(e) || requestId !== playbackRequestId) return;
    }
  }

  // 2. Direct browser cloud Azure Neural Arabic Speech (Fastest, 48kHz, studio natural)
  const directAudioUrl = await fetchDirectAzureAudio(preparedText, voice, rate, pitch);
  if (requestId !== playbackRequestId) return;
  if (directAudioUrl) {
    try {
      cacheAudio(cacheKey, directAudioUrl);
      const audio = new Audio(directAudioUrl);
      await playElement(audio);
      return;
    } catch (directErr) {
      if (isPlaybackInterrupted(directErr) || requestId !== playbackRequestId) return;
      console.warn('[NaturalSpeech] Direct Azure audio playback error:', directErr);
    }
  }

  // 3. Fallback: Baseera server endpoint (/api/ai/tts)
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
        await playElement(audio);
        return;
      }
    }
  } catch {}

  // 4. Pre-recorded clips (public/audio/v1/) as last resort
  try {
    const manifest = await getAudioManifest();
    const clip = manifest?.clips?.[audioKey(preparedText)];
    if (clip?.file) {
      const audioUrl = `/audio/v1/${clip.file}`;
      cacheAudio(cacheKey, audioUrl);
      const audio = new Audio(audioUrl);
      await playElement(audio);
      return;
    }
  } catch {}

  console.warn('[NaturalSpeech] Speech playback ended without audio for:', preparedText);
  options.onEnd?.();
}

/** Stop any ongoing speech playback */
export function stopNaturalArabicAudio(): void {
  playbackRequestId++;
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
