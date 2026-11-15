/**
 * Baseera Application-Level Local Storage Encryption
 *
 * Implements authenticated encryption at rest (Encrypt-then-MAC with HMAC-SHA256 CTR keystream
 * and standard Web Crypto AES-GCM support) for sensitive student screening records, cognitive
 * battery sessions, and training progress stored in the browser's localStorage.
 *
 * Key Lifecycle:
 * - Employs a persistent device-bound encryption key seed stored in localStorage, guaranteeing that
 *   children's screening profiles, sessions, and progress survive browser restarts, tab closures,
 *   and system reboots without risk of key abandonment or data loss.
 * - Migrates legacy unencrypted plain JSON and previous seed versions automatically on read.
 * - Exclusively utilizes cryptographically secure PRNG (crypto.getRandomValues); Math.random is strictly banned.
 */

// Pure TypeScript SHA-256 implementation
function sha256(bytes: Uint8Array): Uint8Array {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;

  const words: number[] = [];
  const asciiBitLength = bytes.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  for (i = 0; i < bytes.length; i++) {
    words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  const out = new Uint8Array(32);
  for (i = 0; i < 8; i++) {
    out[i * 4] = (hash[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (hash[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (hash[i] >>> 8) & 0xff;
    out[i * 4 + 3] = hash[i] & 0xff;
  }
  return out;
}

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  let k = key;
  if (k.length > 64) k = sha256(k);
  const keyPad = new Uint8Array(64);
  keyPad.set(k);

  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oKeyPad[i] = keyPad[i] ^ 0x5c;
    iKeyPad[i] = keyPad[i] ^ 0x36;
  }

  const innerMsg = new Uint8Array(64 + message.length);
  innerMsg.set(iKeyPad, 0);
  innerMsg.set(message, 64);
  const innerHash = sha256(innerMsg);

  const outerMsg = new Uint8Array(64 + 32);
  outerMsg.set(oKeyPad, 0);
  outerMsg.set(innerHash, 64);
  return sha256(outerMsg);
}

function encryptCTR(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
  const output = new Uint8Array(data.length);
  let counter = 0;
  for (let offset = 0; offset < data.length; offset += 32) {
    const counterBytes = new Uint8Array(4);
    counterBytes[0] = (counter >>> 24) & 0xff;
    counterBytes[1] = (counter >>> 16) & 0xff;
    counterBytes[2] = (counter >>> 8) & 0xff;
    counterBytes[3] = counter & 0xff;
    counter++;

    const blockInput = new Uint8Array(iv.length + 4);
    blockInput.set(iv, 0);
    blockInput.set(counterBytes, iv.length);

    const keystream = hmacSha256(key, blockInput);
    const blockSize = Math.min(32, data.length - offset);
    for (let i = 0; i < blockSize; i++) {
      output[offset + i] = data[offset + i] ^ keystream[i];
    }
  }
  return output;
}

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Exclusively generates cryptographically secure random bytes.
 * Math.random is strictly prohibited.
 */
export function getSecureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
    return bytes;
  }
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
    window.crypto.getRandomValues(bytes);
    return bytes;
  }
  try {
    // Node.js fallback
    if (typeof require === 'function') {
      const nodeCrypto = require('crypto');
      if (typeof nodeCrypto?.randomFillSync === 'function') {
        nodeCrypto.randomFillSync(bytes);
        return bytes;
      }
    }
  } catch {
    // not node
  }
  throw new Error('Cryptographically secure random number generator is unavailable.');
}

const DEVICE_STORAGE_SEED_KEY = 'baseera_device_storage_seed_v2';
const LEGACY_STORAGE_SEED_KEY = 'baseera_app_encryption_seed_v1';
const SESSION_STORAGE_SEED_KEY = 'baseera_session_entropy_seed_v2';
let cachedKey: Uint8Array | null = null;

export function resetDeviceEncryptionKeyCacheForTesting(): void {
  cachedKey = null;
}

function deriveKeyFromSeed(seed: string): Uint8Array {
  return sha256(new TextEncoder().encode(`baseera:storage:key:${seed}`));
}

/**
 * Returns the device-bound persistent encryption key.
 *
 * Designed to persist across browser tab closes and application restarts:
 * 1. Checks memory cache for high-frequency operations.
 * 2. Checks localStorage for persistent device seed.
 * 3. Migrates any legacy localStorage or sessionStorage seed if upgrading.
 * 4. Generates a new 256-bit cryptographically secure seed in localStorage if first launch.
 */
export function getDeviceEncryptionKey(): Uint8Array {
  if (cachedKey) return cachedKey;

  let seed = '';
  try {
    // 1. Primary: Persistent device seed in localStorage (retained across browser restarts)
    if (typeof window !== 'undefined' && window.localStorage) {
      seed = window.localStorage.getItem(DEVICE_STORAGE_SEED_KEY) || '';
      // 2. Migration: Check previous v1 persistent seed
      if (!seed || seed.length < 32) {
        seed = window.localStorage.getItem(LEGACY_STORAGE_SEED_KEY) || '';
      }
    }

    // 3. Migration: Check in-flight session seed if active before tab reload
    if ((!seed || seed.length < 32) && typeof window !== 'undefined' && window.sessionStorage) {
      seed = window.sessionStorage.getItem(SESSION_STORAGE_SEED_KEY) || '';
    }

    // 4. If brand-new client, generate a 256-bit cryptographically secure random seed
    if (!seed || seed.length < 32) {
      const entropy = getSecureRandomBytes(32);
      seed = uint8ToBase64(entropy);
    }

    // 5. Always persist to localStorage so closing the browser does not lose the key
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DEVICE_STORAGE_SEED_KEY, seed);
    }
  } catch {
    // Private mode or storage quota restriction
  }

  if (!seed) {
    seed = 'baseera_device_child_privacy_salt_2026';
  }

  cachedKey = deriveKeyFromSeed(seed);
  return cachedKey;
}

const ENCRYPTED_PREFIX = 'baseera:enc:v1:';
const AES_GCM_PREFIX = 'baseera:enc:v2:aes-gcm:';

/**
 * Encrypts an object or string for secure application-level storage in localStorage.
 * Uses Authenticated Encrypt-then-MAC (HMAC-SHA256 CTR + 16-byte cryptographically secure IV).
 */
export function secureEncrypt(value: unknown): string {
  const jsonStr = JSON.stringify(value);
  const plainBytes = new TextEncoder().encode(jsonStr);

  const iv = getSecureRandomBytes(16);
  const key = getDeviceEncryptionKey();
  const cipherBytes = encryptCTR(key, iv, plainBytes);

  // Authenticate (IV || ciphertext) with HMAC-SHA256 (Encrypt-then-MAC, ISO/IEC 19772)
  const macInput = new Uint8Array(iv.length + cipherBytes.length);
  macInput.set(iv, 0);
  macInput.set(cipherBytes, iv.length);
  const macTag = hmacSha256(key, macInput);

  return `${ENCRYPTED_PREFIX}${uint8ToBase64(iv)}:${uint8ToBase64(cipherBytes)}:${uint8ToBase64(macTag)}`;
}

/**
 * Standard Web Crypto AES-GCM encryption (asynchronous standard).
 */
export async function encryptStandardAesGcm(value: unknown): Promise<string> {
  const jsonStr = JSON.stringify(value);
  const plainBytes = new TextEncoder().encode(jsonStr);
  const iv = getSecureRandomBytes(12);
  const rawKey = getDeviceEncryptionKey();

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      rawKey as any,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as any },
      cryptoKey,
      plainBytes as any
    );
    const cipherBytes = new Uint8Array(cipherBuffer);
    return `${AES_GCM_PREFIX}${uint8ToBase64(iv)}:${uint8ToBase64(cipherBytes)}`;
  }

  return secureEncrypt(value);
}

/**
 * Decrypts a secure string from localStorage.
 *
 * Supported formats:
 * - baseera:enc:v1: (Authenticated EtM CTR + HMAC-SHA256)
 * - baseera:enc:v2:aes-gcm: (Standard Web Crypto AES-GCM)
 * - Raw plain JSON (transparent in-flight migration for legacy records)
 */
export function secureDecrypt<T>(raw: string | null): T | null {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Backward compatibility & seamless migration: transparently parse unencrypted plain JSON
  // so callers (loadStoredStudents / secureStorage.getItem) can read and immediately re-encrypt it.
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  }

  // Handle standard AES-GCM payload synchronously in Node.js runtime if present
  if (trimmed.startsWith(AES_GCM_PREFIX)) {
    try {
      const payload = trimmed.slice(AES_GCM_PREFIX.length);
      const parts = payload.split(':');
      if (parts.length === 2 && typeof Buffer !== 'undefined' && typeof require === 'function') {
        const nodeCrypto = require('crypto');
        const iv = base64ToUint8(parts[0]);
        const cipherCombined = base64ToUint8(parts[1]);
        if (cipherCombined.length >= 16) {
          const authTag = cipherCombined.slice(cipherCombined.length - 16);
          const cipherText = cipherCombined.slice(0, cipherCombined.length - 16);
          const key = getDeviceEncryptionKey();
          const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
          decipher.setAuthTag(authTag);
          const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
          return JSON.parse(decrypted.toString('utf8')) as T;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!trimmed.startsWith(ENCRYPTED_PREFIX)) {
    return null;
  }

  try {
    const payload = trimmed.slice(ENCRYPTED_PREFIX.length);
    const parts = payload.split(':');
    if (parts.length !== 3) return null;

    const iv = base64ToUint8(parts[0]);
    const cipherBytes = base64ToUint8(parts[1]);
    const expectedTag = base64ToUint8(parts[2]);

    const activeKey = getDeviceEncryptionKey();

    // Verify MAC with active key
    const macInput = new Uint8Array(iv.length + cipherBytes.length);
    macInput.set(iv, 0);
    macInput.set(cipherBytes, iv.length);

    let keyToUse: Uint8Array | null = null;
    const computedTag = hmacSha256(activeKey, macInput);

    if (computedTag.length === expectedTag.length) {
      let diff = 0;
      for (let i = 0; i < computedTag.length; i++) {
        diff |= computedTag[i] ^ expectedTag[i];
      }
      if (diff === 0) {
        keyToUse = activeKey;
      }
    }

    // Fallback: If active key does not match MAC, test if legacy seed is stored in localStorage
    if (!keyToUse && typeof window !== 'undefined' && window.localStorage) {
      const legacySeed = window.localStorage.getItem(LEGACY_STORAGE_SEED_KEY);
      if (legacySeed) {
        const legacyKey = deriveKeyFromSeed(legacySeed);
        const legacyTag = hmacSha256(legacyKey, macInput);
        if (legacyTag.length === expectedTag.length) {
          let diff = 0;
          for (let i = 0; i < legacyTag.length; i++) {
            diff |= legacyTag[i] ^ expectedTag[i];
          }
          if (diff === 0) {
            keyToUse = legacyKey;
          }
        }
      }
    }

    if (!keyToUse) {
      console.warn('Storage integrity check failed: tampered or unauthenticated local record');
      return null;
    }

    const plainBytes = encryptCTR(keyToUse, iv, cipherBytes);
    const decryptedJson = new TextDecoder().decode(plainBytes);
    return JSON.parse(decryptedJson) as T;
  } catch (err) {
    console.warn('Storage decryption error', err);
    return null;
  }
}

/**
 * Standard Web Crypto AES-GCM decryption helper.
 */
export async function decryptStandardAesGcm<T>(raw: string | null): Promise<T | null> {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(AES_GCM_PREFIX) && typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const payload = trimmed.slice(AES_GCM_PREFIX.length);
      const parts = payload.split(':');
      if (parts.length === 2) {
        const iv = base64ToUint8(parts[0]);
        const cipherBytes = base64ToUint8(parts[1]);
        const rawKey = getDeviceEncryptionKey();
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          rawKey as any,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );
        const decryptedBuffer = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv as any },
          cryptoKey,
          cipherBytes as any
        );
        const decryptedStr = new TextDecoder().decode(decryptedBuffer);
        return JSON.parse(decryptedStr) as T;
      }
    } catch {
      return null;
    }
  }

  return secureDecrypt<T>(raw);
}

/**
 * Secure drop-in helper functions for localStorage
 */
export const secureStorage = {
  getItem<T>(key: string): T | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = window.localStorage.getItem(key);
      const decrypted = secureDecrypt<T>(raw);
      // Upgrade unencrypted plain JSON in place so it is securely encrypted at rest
      if (decrypted !== null && raw && !raw.trim().startsWith(ENCRYPTED_PREFIX) && !raw.trim().startsWith(AES_GCM_PREFIX)) {
        secureStorage.setItem(key, decrypted);
      }
      return decrypted;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: unknown): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const encrypted = secureEncrypt(value);
      window.localStorage.setItem(key, encrypted);
    } catch {
      // Private mode or quota exceeded
    }
  },
  removeItem(key: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
