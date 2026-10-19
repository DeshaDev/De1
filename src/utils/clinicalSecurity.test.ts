import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeSessionScope,
  getScopesForRole,
  issueClinicalSessionToken,
  validateExplicitGuardianConsent,
  verifyClinicalSessionToken,
} from './clinicalSecurity';

const secret = 'test-session-signing-secret-long-enough-for-tests';

test('session tokens require the correct HMAC signing secret', () => {
  const issued = issueClinicalSessionToken('clinician', 'Test Clinician', secret);
  assert.ok(verifyClinicalSessionToken(issued.token, secret));
  assert.equal(
    verifyClinicalSessionToken(issued.token, 'different-secret-long-enough-for-test'),
    null
  );
});

test('session verification rejects expired tokens', () => {
  const issued = issueClinicalSessionToken('clinician', 'Test Clinician', secret, 1000);
  assert.equal(verifyClinicalSessionToken(issued.token, secret, issued.expiresAt), null);
});

test('educator permissions remain read-only', () => {
  const clinicianScopes = getScopesForRole('clinician');
  const educatorScopes = getScopesForRole('educator_readonly');
  assert.ok(clinicianScopes.includes('students:write'));
  assert.ok(clinicianScopes.includes('students:delete'));
  assert.ok(clinicianScopes.includes('ai:analyze'));
  assert.deepEqual(educatorScopes, ['students:read']);
});

test('scope authorization denies absent sessions and insufficient roles', () => {
  assert.equal(authorizeSessionScope(null, 'students:read').statusCode, 401);
  const issued = issueClinicalSessionToken('educator_readonly', 'Educator', secret);
  const verified = verifyClinicalSessionToken(issued.token, secret);
  assert.equal(authorizeSessionScope(verified, 'students:read').allowed, true);
  assert.equal(authorizeSessionScope(verified, 'students:write').statusCode, 403);
});

test('guardian consent requires an explicit boolean true', () => {
  assert.equal(validateExplicitGuardianConsent(true).valid, true);
  for (const invalid of [undefined, null, false, 'true', 1]) {
    assert.equal(validateExplicitGuardianConsent(invalid).valid, false);
  }
});
