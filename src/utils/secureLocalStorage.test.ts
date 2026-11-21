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

  it('automatically reconnects when a cached IDBDatabase connection is closing', async () => {
    installFakeIndexedDB();
    resetDeviceEncryptionKeyCacheForTesting();
    const firstCipher = await secureEncrypt({ child: 'أحمد' });
    assert.ok(firstCipher.startsWith(CURRENT_AES_GCM_PREFIX));

    // Simulate a subsequent read after memory key cache clears while old IDB connection is closing
    const origOpen = (globalThis as any).indexedDB.open;
    let firstDbInstance: any = null;
    let openCalls = 0;
    (globalThis as any).indexedDB.open = () => {
      openCalls++;
      const req = origOpen();
      const origQueue = queueMicrotask;
      void origQueue;
      return req;
    };

    // Poison the first opened DB's transaction once to simulate InvalidStateError: The database connection is closing
    installFakeIndexedDB();
    resetDeviceEncryptionKeyCacheForTesting();
    const baseOpen = (globalThis as any).indexedDB.open;
    let poisoned = false;
    (globalThis as any).indexedDB.open = () => {
      const request: any = {};
      queueMicrotask(() => {
        const innerReq = baseOpen();
        queueMicrotask(() => {
          const realDb = innerReq.result;
          if (!poisoned) {
            poisoned = true;
            firstDbInstance = {
              ...realDb,
              objectStoreNames: realDb.objectStoreNames,
              createObjectStore: realDb.createObjectStore.bind(realDb),
              transaction: () => {
                throw new Error("InvalidStateError: Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.");
              },
            };
            request.result = firstDbInstance;
          } else {
            request.result = realDb;
          }
          request.onupgradeneeded?.();
          request.onsuccess?.();
        });
      });
      return request;
    };

    const encryptedAfterReconnect = await secureEncrypt({ child: 'ليلى' });
    assert.ok(encryptedAfterReconnect.startsWith(CURRENT_AES_GCM_PREFIX));
    const decrypted = await secureDecryptAsync<{ child: string }>(encryptedAfterReconnect);
    assert.deepEqual(decrypted, { child: 'ليلى' });
    void openCalls;
  });
});
