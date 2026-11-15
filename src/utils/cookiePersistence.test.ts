import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setCookie,
  getCookie,
  deleteCookie,
  savePersistentSession,
  loadPersistentSession,
  clearPersistentSession,
  saveStoredStudents,
  loadStoredStudents,
  saveActiveStudentId,
  loadActiveStudentId,
} from './cookiePersistence';
import { resetDeviceEncryptionKeyCacheForTesting } from './secureLocalStorage';
import type { BaseeraSessionInfo } from './apiAuth';
import type { StudentRecord } from '../data/seedData';

// Mock DOM document and window environment for Node.js test environment
function setupMockBrowser() {
  const cookieJar = new Map<string, string>();
  const localStorageJar = new Map<string, string>();
  const sessionStorageJar = new Map<string, string>();

  const doc = {
    get cookie() {
      return Array.from(cookieJar.entries())
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('; ');
    },
    set cookie(val: string) {
      const parts = val.split(';');
      const [key, value] = parts[0].split('=');
      if (parts.some((p) => p.trim().startsWith('max-age=0'))) {
        cookieJar.delete(key.trim());
      } else {
        cookieJar.set(key.trim(), decodeURIComponent(value || ''));
      }
    },
  };

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

  (globalThis as any).document = doc;
  (globalThis as any).window = win;
  (globalThis as any).indexedDB = undefined;

  return { cookieJar, localStorageJar, sessionStorageJar };
}

test('Cookie persistence: set, get, and delete cookies', () => {
  setupMockBrowser();

  setCookie('test_cookie', 'arabic_value_إياد', 7);
  assert.equal(getCookie('test_cookie'), 'arabic_value_إياد');

  deleteCookie('test_cookie');
  assert.equal(getCookie('test_cookie'), null);
});

test('Session persistence: save, load, and clear across cookie/localStorage/sessionStorage', () => {
  const { cookieJar, localStorageJar, sessionStorageJar } = setupMockBrowser();

  const mockSession: BaseeraSessionInfo = {
    token: 'test-token-xyz',
    role: 'parent',
    accountName: 'أبو إياد',
    tenantId: 'parent_123',
    tenantDisplayNameAr: 'حساب الأسرة',
    sessionId: 'session_abc12345678901234567890123',
    scopes: ['students:read', 'students:write'],
    expiresAt: Date.now() + 1000 * 3600 * 24 * 7,
  };

  savePersistentSession(mockSession);

  // Assert stored in all three tiers
  assert.ok(localStorageJar.has('baseera_session_v1'));
  assert.ok(sessionStorageJar.has('baseera_session_v1'));
  assert.ok(cookieJar.has('baseera_session'));

  const loaded = loadPersistentSession();
  assert.ok(loaded);
  assert.equal(loaded?.token, 'test-token-xyz');
  assert.equal(loaded?.role, 'parent');
  assert.equal(loaded?.accountName, 'أبو إياد');

  // Verify fallback: clear sessionStorage, load should fallback to localStorage/cookie
  sessionStorageJar.clear();
  const loadedFromLocal = loadPersistentSession();
  assert.equal(loadedFromLocal?.token, 'test-token-xyz');

  // Clear all
  clearPersistentSession();
  assert.equal(loadPersistentSession(), null);
  assert.equal(cookieJar.has('baseera_session'), false);
});

test('Student and Active Student persistence: fails closed without durable key storage', async () => {
  setupMockBrowser();

  const customChild: Partial<StudentRecord> = {
    id: 'stu-iyad-123',
    name: 'إياد',
    ageYears: 6,
    isDemoRecord: false,
    sessionStatus: 'in_progress',
    guardianConsentGiven: true,
    guardianAudioConsentGiven: true,
  };

  await assert.rejects(() => saveStoredStudents([customChild as StudentRecord]), /IndexedDB is required/);
  assert.equal(localStorageJar.has('hn_stored_students_v1'), false);

  saveActiveStudentId('stu-iyad-123');
  assert.equal(loadActiveStudentId(), 'stu-iyad-123');
});

test('Student persistence: reads legacy plain JSON and preserves it if key upgrade is unavailable', async () => {
  const { localStorageJar } = setupMockBrowser();

  const legacyStudents: Partial<StudentRecord>[] = [
    {
      id: 'stu-legacy-456',
      name: 'مريم',
      ageYears: 7,
      isDemoRecord: false,
      guardianConsentGiven: true,
      guardianAudioConsentGiven: true,
    },
  ];

  // Store legacy plain JSON directly in localStorage as occurred in older versions
  localStorageJar.set('hn_stored_students_v1', JSON.stringify(legacyStudents));

  const loaded = await loadStoredStudents();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, 'مريم');
  assert.equal(loaded[0].guardianAudioConsentGiven, true);

  // No IndexedDB in this Node test: the legacy source must remain intact.
  const rawAfterLoad = localStorageJar.get('hn_stored_students_v1');
  assert.equal(rawAfterLoad, JSON.stringify(legacyStudents));
});

test('Student persistence: does not overwrite existing data if durable key storage is unavailable', async () => {
  const { localStorageJar, sessionStorageJar } = setupMockBrowser();
  resetDeviceEncryptionKeyCacheForTesting();

  const child: Partial<StudentRecord> = {
    id: 'stu-persistent-restart-1',
    name: 'سليمان',
    ageYears: 8,
    isDemoRecord: false,
    sessionStatus: 'completed',
    guardianConsentGiven: true,
    guardianAudioConsentGiven: true,
    wpm: 65,
  };

  // 1. Parent registers and completes session, stored in browser
  await assert.rejects(() => saveStoredStudents([child as StudentRecord]), /IndexedDB is required/);
  assert.equal(localStorageJar.has('hn_stored_students_v1'), false);

  // 2. User closes browser: sessionStorage wiped, memory cache cleared
  sessionStorageJar.clear();
  resetDeviceEncryptionKeyCacheForTesting();

  // 3. User reopens browser on another day:
  const restoredAfterRestart = await loadStoredStudents();
  assert.deepEqual(restoredAfterRestart, []);
});

