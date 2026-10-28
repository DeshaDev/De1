/**
 * The complete list of texts the battery and the training programme speak, so that each
 * can be pre-recorded once (scripts/generate-audio.ts) and every child hears the same clip.
 * A unit test regenerates fresh training sessions and checks they never speak a text that
 * is missing from this catalogue.
 */
import { BATTERY, type AudioSegment } from './battery';
import { lex } from './lexicon';
import { PHRASES, palThis, palWhere, palYes } from './phrases';
import { SKILLS, generateSession, type Level, type SkillId } from './training';

/** Same normalisation everywhere: NFC, trimmed, single spaces. */
export function normalizeSpokenText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Stable 64-bit FNV-1a hash of the normalised text, as 16 hex characters. */
export function audioKey(text: string): string {
  const input = new TextEncoder().encode(normalizeSpokenText(text));
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of input) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

export interface CatalogEntry {
  key: string;
  text: string;
  /** Where the text is used, for the QA report. */
  sources: string[];
}

export const TRAINING_CATALOG_SEEDS = 400;

function addSegments(map: Map<string, CatalogEntry>, segments: AudioSegment[], source: string) {
  for (const s of segments) add(map, s.text, source);
}

function add(map: Map<string, CatalogEntry>, raw: string, source: string) {
  const text = normalizeSpokenText(raw);
  if (!text) return;
  const key = audioKey(text);
  const entry = map.get(key);
  if (entry) {
    if (!entry.sources.includes(source)) entry.sources.push(source);
  } else {
    map.set(key, { key, text, sources: [source] });
  }
}

export function buildAudioCatalog(): CatalogEntry[] {
  const map = new Map<string, CatalogEntry>();

  for (const p of PHRASES.praise) add(map, p, 'phrases');
  for (const [name, value] of Object.entries(PHRASES)) if (typeof value === 'string') add(map, value, `phrases.${name}`);

  for (const s of BATTERY) {
    add(map, s.introAudio, `${s.id}.intro`);
    if (s.kind === 'choice') {
      for (const item of [...s.practice, ...s.items]) addSegments(map, item.audio, `${s.id}.${item.id}`);
    } else if (s.kind === 'span') {
      for (const t of [...s.practice, ...s.trials]) for (const id of [...t.sequence, ...t.choices]) add(map, lex(id).word, `${s.id}.${t.id}`);
    } else if (s.kind === 'pal') {
      for (const c of s.creatures) {
        add(map, palWhere(c.name), `${s.id}.where`);
        add(map, palThis(c.name), `${s.id}.this`);
        add(map, palYes(c.name), `${s.id}.yes`);
      }
    }
  }

  for (const skill of Object.keys(SKILLS) as SkillId[]) {
    for (const level of [1, 2, 3] as Level[]) {
      for (let seed = 1; seed <= TRAINING_CATALOG_SEEDS; seed++) {
        for (const task of generateSession(skill, level, seed)) {
          if (task.kind === 'choice') addSegments(map, task.item.audio, `training.${skill}`);
          else for (const id of [...task.trial.sequence, ...task.trial.choices]) add(map, lex(id).word, `training.${skill}`);
        }
      }
    }
  }

  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}
