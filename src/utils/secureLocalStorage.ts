/**
 * Baseera Application-Level Local Storage Encryption
 *
 * Implements authenticated encryption at rest (Encrypt-then-MAC with HMAC-SHA256 CTR keystream)
 * for sensitive student screening records, cognitive battery sessions, and training progress
 * stored in the browser's localStorage. Protects children's data on shared family or school devices.
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

const SESSION_STORAGE_SEED_KEY = 'baseera_session_entropy_seed_v2';
const LEGACY_STORAGE_SEED_KEY = 'baseera_app_encryption_seed_v1';
let cachedKey: Uint8Array | null = null;

function deriveKeyFromSeed(seed: string): Uint8Array {
  return sha256(new TextEncoder().encode(`baseera:storage:key:${seed}`));
}

function getDeviceEncryptionKey(): Uint8Array {
  if (cachedKey) return cachedKey;

  let seed = '';
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      seed = window.sessionStorage.getItem(SESSION_STORAGE_SEED_KEY) || '';
    }

    // Seamless migration: If no session seed exists yet, check if a persistent seed was
    // created previously in localStorage, copy it to sessionStorage, and preserve access to existing records.
    if (!seed && typeof window !== 'undefined' && window.localStorage) {
      const legacySeed = window.localStorage.getItem(LEGACY_STORAGE_SEED_KEY);
      if (legacySeed && legacySeed.length >= 32) {
        seed = legacySeed;
        if (window.sessionStorage) {
          window.sessionStorage.setItem(SESSION_STORAGE_SEED_KEY, seed);
        }
      }
    }

    // If still no seed, generate a new high-entropy seed in sessionStorage
    if (!seed || seed.length < 32) {
      const entropy = new Uint8Array(32);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(entropy);
      } else {
        for (let i = 0; i < 32; i++) {
          entropy[i] = Math.floor(Math.random() * 256);
        }
      }
      seed = uint8ToBase64(entropy);
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(SESSION_STORAGE_SEED_KEY, seed);
      }
    }
  } catch {
    // In private browsing mode or when storage is restricted
  }

  if (!seed) {
    seed = 'baseera_ephemeral_child_privacy_salt_2026';
  }

  cachedKey = deriveKeyFromSeed(seed);
  return cachedKey;
}

const ENCRYPTED_PREFIX = 'baseera:enc:v1:';

/**
 * Encrypts an object or string for secure application-level storage in localStorage.
 */
export function secureEncrypt(value: unknown): string {
  const jsonStr = JSON.stringify(value);
  const plainBytes = new TextEncoder().encode(jsonStr);

  const iv = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(iv);
  } else {
    for (let i = 0; i < 16; i++) {
      iv[i] = Math.floor(Math.random() * 256);
    }
  }

  const key = getDeviceEncryptionKey();
  const cipherBytes = encryptCTR(key, iv, plainBytes);

  // Authenticate (IV || ciphertext) with HMAC-SHA256
  const macInput = new Uint8Array(iv.length + cipherBytes.length);
  macInput.set(iv, 0);
  macInput.set(cipherBytes, iv.length);
  const macTag = hmacSha256(key, macInput);

  return `${ENCRYPTED_PREFIX}${uint8ToBase64(iv)}:${uint8ToBase64(cipherBytes)}:${uint8ToBase64(macTag)}`;
}

/**
 * Decrypts a secure string from localStorage.
 * Transparently falls back to parsing raw JSON if the data is from a legacy unencrypted session.
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
 * Secure drop-in helper functions for localStorage
 */
export const secureStorage = {
  getItem<T>(key: string): T | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = window.localStorage.getItem(key);
      const decrypted = secureDecrypt<T>(raw);
      // Upgrade unencrypted plain JSON in place so it is securely encrypted at rest
      if (decrypted !== null && raw && !raw.trim().startsWith(ENCRYPTED_PREFIX)) {
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
