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

function installFakeIndexedDB() {
  const stores = new Map<string, Map<string, unknown>>();
  const db = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore: (name: string) => { stores.set(name, new Map()); return {}; },
    transaction: (name: string) => {
      const transaction: any = {};
      transaction.objectStore = () => ({
        get: (key: string) => {
          const request: any = {};
          queueMicrotask(() => {
            request.result = stores.get(name)?.get(key);
            request.onsuccess?.();
            transaction.oncomplete?.();
          });
          return request;
        },
        add: (value: unknown, key: string) => {
          const request: any = {};
          queueMicrotask(() => {
            const store = stores.get(name)!;
            if (store.has(key)) {
              request.error = new Error('Key already exists');
              transaction.onerror?.();
              transaction.onabort?.();
              return;
            }
            store.set(key, value);
            request.onsuccess?.();
            transaction.oncomplete?.();
          });
          return request;
        },
      });
      return transaction;
    },
  };
  (globalThis as any).indexedDB = {
    open: () => {
      const request: any = {};
      queueMicrotask(() => {
        request.result = db;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
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

  it('writes and restores AES-256-GCM ciphertext with a non-extractable IndexedDB key', async () => {
    const jar = new Map<string, string>();
    (globalThis as any).window = {
      localStorage: {
        getItem: (key: string) => jar.get(key) ?? null,
        setItem: (key: string, value: string) => jar.set(key, value),
        removeItem: (key: string) => jar.delete(key),
      },
    };
    installFakeIndexedDB();
    resetDeviceEncryptionKeyCacheForTesting();
    const value = { studentId: 'aes-child-42', name: 'سارة', guardianAudioConsentGiven: true };
    const encrypted = await secureEncrypt(value);
    assert.ok(encrypted.startsWith(CURRENT_AES_GCM_PREFIX));
    assert.equal(encrypted.includes('سارة'), false);
    jar.set('child', encrypted);
    resetDeviceEncryptionKeyCacheForTesting();
    assert.deepEqual(await secureDecryptAsync<typeof value>(jar.get('child')!), value);
    const tampered = encrypted.slice(0, -2) + 'AA';
    assert.equal(await secureDecryptAsync(tampered), null);
  });

  it('fails closed when IndexedDB cannot persist a non-extractable key', async () => {
    resetDeviceEncryptionKeyCacheForTesting();
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
