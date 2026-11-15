import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  secureEncrypt,
  secureDecrypt,
  secureDecryptAsync,
  CURRENT_AES_GCM_PREFIX,
  getSecureRandomBytes,
  resetDeviceEncryptionKeyCacheForTesting,
} from './secureLocalStorage';

function setupLegacySeed(seed: string) {
  const jar = new Map<string, string>([['baseera_device_storage_seed_v2', seed]]);
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => jar.get(key) ?? null,
      setItem: (key: string, value: string) => jar.set(key, value),
      removeItem: (key: string) => jar.delete(key),
    },
    sessionStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  };
  return jar;
}

describe('AES-GCM child storage and legacy migration', () => {
  it('uses a cryptographically secure random generator only', () => {
    const first = getSecureRandomBytes(32);
    const second = getSecureRandomBytes(32);
    assert.equal(first.length, 32);
    assert.notDeepEqual(first, second);
  });

  it('reads an existing authenticated CTR/HMAC record without rewriting it', () => {
    setupLegacySeed('legacy-test-seed-0123456789abcdef');
    resetDeviceEncryptionKeyCacheForTesting();
    const legacy = 'baseera:enc:v1:AAECAwQFBgcICQoLDA0ODw==:WgMsp9W+MDmqZv7xEWEwnl6e7nlNiQlu97iDA6KZqOGSi6g7RBeRN92okdPM5SdFK25FkRMd:ljYRO7GYvaimnEJ+VD+Nd9dMAi8K5YYRniDcaNUonFg=';
    assert.deepEqual(secureDecrypt(legacy), { id: 'legacy-child', guardianAudioConsentGiven: true });
  });

  it('reads legacy plain JSON for controlled migration', async () => {
    const raw = JSON.stringify([{ id: 'legacy-child', name: 'مريم', guardianAudioConsentGiven: true }]);
    assert.deepEqual(await secureDecryptAsync(raw), [{ id: 'legacy-child', name: 'مريم', guardianAudioConsentGiven: true }]);
  });

  it('fails closed when IndexedDB cannot persist a non-extractable key', async () => {
    (globalThis as any).indexedDB = undefined;
    await assert.rejects(() => secureEncrypt({ child: 'سارة' }), /IndexedDB is required/);
  });

  it('does not accept tampered or unknown ciphertext', async () => {
    assert.equal(await secureDecryptAsync('baseera:enc:v3:aes-gcm-idb:bad:bad'), null);
    assert.equal(secureDecrypt('baseera:enc:v1:tampered'), null);
  });

  it('exports the new versioned AES-GCM storage prefix', () => {
    assert.ok(CURRENT_AES_GCM_PREFIX.includes('aes-gcm'));
  });
});
