import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeSessionScope,
  getScopesForRole,
  issueClinicalSessionToken,
  validateExplicitGuardianConsent,
  verifyClinicalSessionToken,
} from './clinicalSecurity';

const secret = 'test-secret-that-is-long-enough-for-signing-sessions';

test('session tokens are accepted only with the configured signing secret', () => {
  const issued = issueClinicalSessionToken('clinician', 'Test Clinician', secret);
  assert.ok(verifyClinicalSessionToken(issued.token, secret));
  assert.equal(verifyClinicalSessionToken(issued.token, 'a-different-secret-value'), null);
});

test('session verification rejects expired tokens', () => {
  const issued = issueClinicalSessionToken('clinician', 'Test Clinician', secret, 1000);
  assert.equal(
    verifyClinicalSessionToken(issued.token, secret, issued.expiresAt),
    null
  );
});

test('role scopes separate clinician analysis from read-only educator access', () => {
  const clinicianScopes = getScopesForRole('clinician');
  const educatorScopes = getScopesForRole('educator_readonly');
  assert.ok(clinicianScopes.includes('students:write'));
  assert.ok(clinicianScopes.includes('ai:analyze'));
  assert.ok(educatorScopes.includes('students:read'));
  assert.ok(educatorScopes.includes('ai:use'));
  assert.ok(!educatorScopes.includes('students:write'));
  assert.ok(!educatorScopes.includes('students:delete'));
  assert.ok(!educatorScopes.includes('ai:analyze'));
});

test('scope authorization denies missing sessions and insufficient roles', () => {
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
