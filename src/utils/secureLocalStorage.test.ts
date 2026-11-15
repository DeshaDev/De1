import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { secureEncrypt, secureDecrypt } from './secureLocalStorage';

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

  it('transparently parses legacy unencrypted plain JSON for backward compatibility', () => {
    const legacyPlainJson = JSON.stringify({
      studentId: 'legacy-child-99',
      name: 'عمر',
      score: 85,
    });

    const parsed = secureDecrypt<{ studentId: string; name: string; score: number }>(legacyPlainJson);
    assert.ok(parsed);
    assert.equal(parsed?.studentId, 'legacy-child-99');
    assert.equal(parsed?.name, 'عمر');
    assert.equal(parsed?.score, 85);
  });

  it('returns null on invalid or empty inputs', () => {
    assert.equal(secureDecrypt(null), null);
    assert.equal(secureDecrypt(''), null);
    assert.equal(secureDecrypt('   '), null);
    assert.equal(secureDecrypt('random_garbage_not_json_or_enc'), null);
  });
});
