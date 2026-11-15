/**
 * Browser storage encryption for child records.
 *
 * New writes use AES-256-GCM with a non-extractable CryptoKey persisted in IndexedDB.
 * The key is never serialized into localStorage or stored beside ciphertext.
 *
 * Legacy CTR/HMAC and the previous AES-GCM format remain read-only migration paths.
 * Client-side encryption does not protect against JavaScript already executing in this
 * origin (for example, a successful XSS); prevent that with CSP, dependency hygiene,
 * and server-side access controls as well.
 */

const LEGACY_CTR_PREFIX = 'baseera:enc:v1:';
const LEGACY_AES_GCM_PREFIX = 'baseera:enc:v2:aes-gcm:';
export const CURRENT_AES_GCM_PREFIX = 'baseera:enc:v3:aes-gcm-idb:';

const KEY_DATABASE = 'haya-naqra-secure-storage';
const KEY_DATABASE_VERSION = 1;
const KEY_STORE = 'crypto-keys';
const KEY_ID = 'child-records-aes-256-gcm-v3';
const AES_GCM_AAD = new TextEncoder().encode('haya-naqra:child-records:aes-256-gcm:v3');

const DEVICE_STORAGE_SEED_KEY = 'baseera_device_storage_seed_v2';
const LEGACY_STORAGE_SEED_KEY = 'baseera_app_encryption_seed_v1';
const SESSION_STORAGE_SEED_KEY = 'baseera_session_entropy_seed_v2';

let cachedLegacyKey: Uint8Array | null = null;
let keyDatabasePromise: Promise<IDBDatabase> | null = null;

export function resetDeviceEncryptionKeyCacheForTesting(): void {
  cachedLegacyKey = null;
  keyDatabasePromise = null;
}

/** Cryptographically secure random bytes only; never falls back to Math.random or constants. */
export function getSecureRandomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('Random byte length must be a positive integer.');
  }
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) {
    throw new Error('Cryptographically secure random number generation is unavailable.');
  }
  const bytes = new Uint8Array(length);
  webCrypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa === 'function') return btoa(binary);
  throw new Error('Base64 encoding is unavailable.');
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob !== 'function') throw new Error('Base64 decoding is unavailable.');
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sha256(bytes: Uint8Array): Uint8Array {
  const rotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const words: number[] = [];
  const hash: number[] = [];
  const constants: number[] = [];
  const composite: Record<number, boolean> = {};
  let primeCounter = 0;
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!composite[candidate]) {
      for (let i = 0; i < 313; i += candidate) composite[i] = true;
      hash[primeCounter] = (Math.sqrt(candidate) * 0x100000000) | 0;
      constants[primeCounter++] = (Math.cbrt(candidate) * 0x100000000) | 0;
    }
  }
  const bitLength = bytes.length * 8;
  for (let i = 0; i < bytes.length; i++) words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << (24 - (i % 4) * 8));
  words[bitLength >> 5] = (words[bitLength >> 5] || 0) | (0x80 << (24 - (bitLength % 32)));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;
  for (let offset = 0; offset < words.length; offset += 16) {
    const w = words.slice(offset, offset + 16);
    const previous = hash.slice();
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const t1 = hash[7] + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) + constants[i] +
        (w[i] = i < 16 ? w[i] : (w[i - 16] +
          (rotate(w15, 7) ^ rotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] +
          (rotate(w2, 17) ^ rotate(w2, 19) ^ (w2 >>> 10))) | 0);
      const t2 = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash[7] = hash[6]; hash[6] = hash[5]; hash[5] = hash[4];
      hash[4] = (hash[3] + t1) | 0; hash[3] = hash[2];
      hash[2] = hash[1]; hash[1] = hash[0]; hash[0] = (t1 + t2) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + previous[i]) | 0;
  }
  const output = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    output[i * 4] = hash[i] >>> 24;
    output[i * 4 + 1] = hash[i] >>> 16;
    output[i * 4 + 2] = hash[i] >>> 8;
    output[i * 4 + 3] = hash[i];
  }
  return output;
}

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  let normalized = key;
  if (normalized.length > 64) normalized = sha256(normalized);
  const padded = new Uint8Array(64);
  padded.set(normalized);
  const innerPad = new Uint8Array(64);
  const outerPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    innerPad[i] = padded[i] ^ 0x36;
    outerPad[i] = padded[i] ^ 0x5c;
  }
  const inner = new Uint8Array(64 + message.length);
  inner.set(innerPad);
  inner.set(message, 64);
  const innerHash = sha256(inner);
  const outer = new Uint8Array(96);
  outer.set(outerPad);
  outer.set(innerHash, 64);
  return sha256(outer);
}

function legacyCtrCrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
  const output = new Uint8Array(data.length);
  let counter = 0;
  for (let offset = 0; offset < data.length; offset += 32) {
    const counterBytes = new Uint8Array([
      (counter >>> 24) & 0xff, (counter >>> 16) & 0xff,
      (counter >>> 8) & 0xff, counter & 0xff,
    ]);
    counter++;
    const blockInput = new Uint8Array(iv.length + counterBytes.length);
    blockInput.set(iv);
    blockInput.set(counterBytes, iv.length);
    const stream = hmacSha256(key, blockInput);
    const blockLength = Math.min(32, data.length - offset);
    for (let i = 0; i < blockLength; i++) output[offset + i] = data[offset + i] ^ stream[i];
  }
  return output;
}

function deriveLegacyKey(seed: string): Uint8Array {
  return sha256(new TextEncoder().encode(`baseera:storage:key:${seed}`));
}

/**
 * Read-only compatibility key for previously stored v1/v2 ciphertext.
 * It never creates a new key and never uses a hard-coded fallback.
 */
export function getDeviceEncryptionKey(): Uint8Array {
  if (cachedLegacyKey) return cachedLegacyKey;
  let seed = '';
  try {
    if (typeof window !== 'undefined') {
      seed = window.localStorage?.getItem(DEVICE_STORAGE_SEED_KEY) || '';
      if (!seed) seed = window.localStorage?.getItem(LEGACY_STORAGE_SEED_KEY) || '';
      if (!seed) seed = window.sessionStorage?.getItem(SESSION_STORAGE_SEED_KEY) || '';
    }
  } catch {
    // The legacy key may be unavailable in restricted storage contexts.
  }
  if (seed.length < 32) {
    throw new Error('Legacy encryption key is unavailable; refusing to guess or recreate it.');
  }
  cachedLegacyKey = deriveLegacyKey(seed);
  return cachedLegacyKey;
}

function openKeyDatabase(): Promise<IDBDatabase> {
  if (keyDatabasePromise) return keyDatabasePromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is required for persistent encrypted child storage.'));
  }
  keyDatabasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(KEY_DATABASE, KEY_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open the encryption key database.'));
    request.onblocked = () => reject(new Error('The encryption key database is blocked by another tab.'));
  }).catch((error) => {
    keyDatabasePromise = null;
    throw error;
  });
  return keyDatabasePromise!;
}

function readPersistedCryptoKey(): Promise<CryptoKey | null> {
  return openKeyDatabase().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(KEY_STORE, 'readonly');
    const request = transaction.objectStore(KEY_STORE).get(KEY_ID);
    request.onsuccess = () => resolve((request.result as CryptoKey | undefined) || null);
    request.onerror = () => reject(request.error || new Error('Unable to read the encryption key.'));
    transaction.onerror = () => reject(transaction.error || new Error('Encryption key read failed.'));
  }));
}

function storeCryptoKeyIfAbsent(key: CryptoKey): Promise<void> {
  return openKeyDatabase().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(KEY_STORE, 'readwrite');
    transaction.objectStore(KEY_STORE).add(key, KEY_ID);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Unable to persist the encryption key.'));
    transaction.onabort = () => reject(transaction.error || new Error('Encryption key persistence was aborted.'));
  }));
}

async function getOrCreatePersistentCryptoKey(): Promise<CryptoKey> {
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) throw new Error('Web Crypto AES-GCM is unavailable.');
  const existing = await readPersistedCryptoKey();
  if (existing) {
    if (existing.type !== 'secret' || existing.extractable || existing.algorithm.name !== 'AES-GCM' ||
        !existing.usages.includes('encrypt') || !existing.usages.includes('decrypt')) {
      throw new Error('The persisted encryption key is invalid; refusing to overwrite encrypted records.');
    }
    return existing;
  }

  const generated = await webCrypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  try {
    await storeCryptoKeyIfAbsent(generated);
    return generated;
  } catch {
    // Another tab may have created the key at the same time. Re-read the winner.
    const racedKey = await readPersistedCryptoKey();
    if (racedKey && racedKey.type === 'secret' && !racedKey.extractable &&
        racedKey.algorithm.name === 'AES-GCM' &&
        racedKey.usages.includes('encrypt') && racedKey.usages.includes('decrypt')) {
      return racedKey;
    }
    throw new Error('Unable to persist a non-extractable encryption key.');
  }
}

export function isCurrentSecureCiphertext(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(CURRENT_AES_GCM_PREFIX);
}

/** New default writer: AES-256-GCM using a non-extractable IndexedDB CryptoKey. */
export async function secureEncrypt(value: unknown): Promise<string> {
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) throw new Error('Web Crypto AES-GCM is unavailable.');
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error('The value cannot be serialized for encrypted storage.');
  const key = await getOrCreatePersistentCryptoKey();
  const iv = getSecureRandomBytes(12);
  const ciphertext = await webCrypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource, additionalData: AES_GCM_AAD as unknown as BufferSource, tagLength: 128 },
    key,
    new TextEncoder().encode(json) as unknown as BufferSource
  );
  return `${CURRENT_AES_GCM_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ciphertext))}`;
}

/** Alias retained for callers/tests that explicitly name the AES-GCM format. */
export async function encryptStandardAesGcm(value: unknown): Promise<string> {
  return secureEncrypt(value);
}

/** Decrypt current IndexedDB-key AES-GCM and previous v2 AES-GCM migration payloads. */
export async function decryptStandardAesGcm<T>(raw: string | null): Promise<T | null> {
  if (!raw || typeof raw !== 'string') return null;
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) return null;

  try {
    if (raw.startsWith(CURRENT_AES_GCM_PREFIX)) {
      const parts = raw.slice(CURRENT_AES_GCM_PREFIX.length).split(':');
      if (parts.length !== 2) return null;
      const key = await readPersistedCryptoKey();
      if (!key || key.extractable || key.algorithm.name !== 'AES-GCM') return null;
      const plaintext = await webCrypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(parts[0]) as unknown as BufferSource, additionalData: AES_GCM_AAD as unknown as BufferSource, tagLength: 128 },
        key,
        base64ToBytes(parts[1]) as unknown as BufferSource
      );
      return JSON.parse(new TextDecoder().decode(plaintext)) as T;
    }

    // Compatibility for the older helper format, which used the legacy localStorage seed.
    if (raw.startsWith(LEGACY_AES_GCM_PREFIX)) {
      const parts = raw.slice(LEGACY_AES_GCM_PREFIX.length).split(':');
      if (parts.length !== 2) return null;
      const keyBytes = getDeviceEncryptionKey();
      const key = await webCrypto.subtle.importKey('raw', keyBytes as unknown as BufferSource, { name: 'AES-GCM' }, false, ['decrypt']);
      const plaintext = await webCrypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(parts[0]) as unknown as BufferSource },
        key,
        base64ToBytes(parts[1]) as unknown as BufferSource
      );
      return JSON.parse(new TextDecoder().decode(plaintext)) as T;
    }
  } catch {
    return null;
  }
  return null;
}

/** Synchronous read-only decoder for old CTR/HMAC and unencrypted JSON records. */
export function secureDecrypt<T>(raw: string | null): T | null {
  if (!raw || typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith('{') || value.startsWith('[') || value.startsWith('"')) {
    try { return JSON.parse(value) as T; } catch { return null; }
  }
  if (!value.startsWith(LEGACY_CTR_PREFIX)) return null;

  try {
    const parts = value.slice(LEGACY_CTR_PREFIX.length).split(':');
    if (parts.length !== 3) return null;
    const iv = base64ToBytes(parts[0]);
    const ciphertext = base64ToBytes(parts[1]);
    const expectedTag = base64ToBytes(parts[2]);
    if (iv.length !== 16 || expectedTag.length !== 32) return null;
    const key = getDeviceEncryptionKey();
    const macInput = new Uint8Array(iv.length + ciphertext.length);
    macInput.set(iv);
    macInput.set(ciphertext, iv.length);
    const actualTag = hmacSha256(key, macInput);
    let difference = 0;
    for (let i = 0; i < actualTag.length; i++) difference |= actualTag[i] ^ expectedTag[i];
    if (difference !== 0) return null;
    const plaintext = legacyCtrCrypt(key, iv, ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}

/** Async decoder used by every production child-record read path. */
export async function secureDecryptAsync<T>(raw: string | null): Promise<T | null> {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith(CURRENT_AES_GCM_PREFIX) || raw.startsWith(LEGACY_AES_GCM_PREFIX)) {
    return decryptStandardAesGcm<T>(raw);
  }
  return secureDecrypt<T>(raw);
}

/** Async secure localStorage facade. All writes use AES-256-GCM. */
export const secureStorage = {
  async getItem<T>(key: string): Promise<T | null> {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    const value = await secureDecryptAsync<T>(raw);
    if (value !== null && raw && !isCurrentSecureCiphertext(raw)) {
      // Migrate legacy ciphertext/plain JSON only after the old value decoded successfully.
      const upgraded = await secureEncrypt(value);
      window.localStorage.setItem(key, upgraded);
    }
    return value;
  },
  async setItem(key: string, value: unknown): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('Browser localStorage is unavailable.');
    }
    const encrypted = await secureEncrypt(value);
    window.localStorage.setItem(key, encrypted);
  },
  removeItem(key: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(key);
  },
};
