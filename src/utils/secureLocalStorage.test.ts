import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  secureEncrypt,
  secureDecrypt,
  encryptStandardAesGcm,
  decryptStandardAesGcm,
  getSecureRandomBytes,
  resetDeviceEncryptionKeyCacheForTesting,
} from './secureLocalStorage';

// Mock browser storage for browser restart lifecycle testing
function setupMockStorage() {
  const localStorageJar = new Map<string, string>();
  const sessionStorageJar = new Map<string, string>();

  const win = {
    localStorage: {
      getItem: (k: string) => localStorageJar.get(k) || null,
      setItem: (k: string, v: string) => localStorageJar.set(k, v),
      removeItem: (k: string) => localStorageJar.delete(k),
    },
    sessionStorage: {
      getItem: (k: string) => sessionStorageJar.get(k) || null,
      setItem: (k: string, v: string) => sessionStorageJar.set(k, v),
      removeItem: (k: string) => sessionStorageJar.delete(k),
    },
  };

  (globalThis as any).window = win;
  return { localStorageJar, sessionStorageJar };
}

describe('Secure Application-Level Storage Encryption Tests', () => {
  it('encrypts sensitive student session and decrypts back to identical structure', () => {
    const session = {
      studentId: 'child-test-123',
      childName: 'سارة',
      ageMonths: 84,
      guardianConsentGiven: true,
      guardianConsentRecordedAt: '2026-11-14T20:00:00.000Z',
      results: {
        wordReading: { score: 10, accuracy: 100 },
        nonwordReading: { score: 8, accuracy: 80 },
      },
    };

    const encrypted = secureEncrypt(session);
    assert.ok(encrypted.startsWith('baseera:enc:v1:'));
    // Plaintext should NOT appear in encrypted string
    assert.equal(encrypted.includes('سارة'), false);
    assert.equal(encrypted.includes('child-test-123'), false);

    const decrypted = secureDecrypt<typeof session>(encrypted);
    assert.deepEqual(decrypted, session);
  });

  it('guarantees key persistence across browser tab closure and system restart', () => {
    const { localStorageJar, sessionStorageJar } = setupMockStorage();
    resetDeviceEncryptionKeyCacheForTesting();

    const sensitiveRecord = {
      childId: 'persistent-child-77',
      name: 'زينب',
      ageYears: 6,
      screeningScore: 94,
    };

    // 1. Initial save in active browser session
    const encrypted = secureEncrypt(sensitiveRecord);
    localStorageJar.set('hn_stored_students_v1', encrypted);

    // Assert seed is persisted in localStorage
    assert.ok(localStorageJar.has('baseera_device_storage_seed_v2'));

    // 2. Simulate complete browser closure:
    // - Clear all in-memory encryption key caches
    // - Clear ephemeral sessionStorage completely (simulating closed tab/window)
    resetDeviceEncryptionKeyCacheForTesting();
    sessionStorageJar.clear();
    assert.equal(sessionStorageJar.size, 0);

    // 3. Brand-new browser session opens: read from localStorage
    const rawFromStorage = localStorageJar.get('hn_stored_students_v1') ?? null;
    const restored = secureDecrypt<typeof sensitiveRecord>(rawFromStorage);

    assert.ok(restored);
    assert.equal(restored?.childId, 'persistent-child-77');
    assert.equal(restored?.name, 'زينب');
    assert.equal(restored?.screeningScore, 94);
  });

  it('encrypts and decrypts with standard Web Crypto AES-GCM', async () => {
    const sensitiveData = {
      studentId: 'standard-aes-child-1',
      assessmentResult: 'complete',
      accuracy: 98,
    };

    const encrypted = await encryptStandardAesGcm(sensitiveData);
    assert.ok(typeof encrypted === 'string');

    const decrypted = await decryptStandardAesGcm<typeof sensitiveData>(encrypted);
    assert.deepEqual(decrypted, sensitiveData);
  });

  it('strictly utilizes cryptographically secure random bytes without Math.random', () => {
    const bytes1 = getSecureRandomBytes(32);
    const bytes2 = getSecureRandomBytes(32);

    assert.equal(bytes1.length, 32);
    assert.equal(bytes2.length, 32);
    // Two random 256-bit draws must not be identical
    assert.notDeepEqual(bytes1, bytes2);
  });

  it('rejects tampered ciphertext gracefully without crashing', () => {
    const original = { secret: 'sensitive_child_score_42' };
    const enc = secureEncrypt(original);
    // Tamper with the ciphertext segment
    const parts = enc.split(':');
    parts[4] = 'tampered' + parts[4].slice(8);
    const tampered = parts.join(':');

    const result = secureDecrypt(tampered);
    assert.equal(result, null);
  });

  it('seamlessly parses legacy unencrypted plain JSON to allow in-flight migration without data loss', () => {
    const unencryptedPlainJson = JSON.stringify({
      studentId: 'legacy-child-99',
      name: 'عمر',
      score: 85,
    });

    const parsed = secureDecrypt<{ studentId: string; name: string; score: number }>(unencryptedPlainJson);
    assert.deepEqual(parsed, {
      studentId: 'legacy-child-99',
      name: 'عمر',
      score: 85,
    });
  });

  it('returns null on invalid or empty inputs', () => {
    assert.equal(secureDecrypt(null), null);
    assert.equal(secureDecrypt(''), null);
    assert.equal(secureDecrypt('   '), null);
    assert.equal(secureDecrypt('random_garbage_not_json_or_enc'), null);
  });
});
