/**
 * Cookie and persistent local storage management for user sessions,
 * child profiles, and active screening states across browser reloads.
 * Student data stored locally is encrypted at rest using application-level AES/HMAC encryption.
 */
import type { BaseeraSessionInfo } from './apiAuth';
import type { StudentRecord } from '../data/seedData';
import { secureEncrypt, secureDecryptAsync, isCurrentSecureCiphertext } from './secureLocalStorage';

const SESSION_COOKIE_NAME = 'baseera_session';
const SESSION_STORAGE_KEY = 'baseera_session_v1';
const STUDENTS_STORAGE_KEY = 'hn_stored_students_v1';
const ACTIVE_STUDENT_STORAGE_KEY = 'hn_active_student_id';
const ACTIVE_STUDENT_COOKIE_NAME = 'hn_active_student_id';
let studentSaveQueue: Promise<void> = Promise.resolve();

/**
 * Set a browser cookie with standard security attributes.
 * Defaults to 30 days expiration and SameSite=Lax.
 */
export function setCookie(name: string, value: string, days = 30): void {
  if (typeof document === 'undefined') return;
  try {
    const maxAge = days * 24 * 60 * 60;
    const encoded = encodeURIComponent(value);
    document.cookie = `${name}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {
    // Ignore storage/cookie errors in restricted contexts
  }
}

/**
 * Get a cookie value by name.
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const cookies = document.cookie.split(';');
    for (const raw of cookies) {
      const trimmed = raw.trim();
      if (trimmed.startsWith(`${name}=`)) {
        return decodeURIComponent(trimmed.slice(name.length + 1));
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

/**
 * Delete a cookie by expiring it immediately.
 */
export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // Ignore errors
  }
}

/**
 * Persist Baseera session across cookies, localStorage, and sessionStorage.
 */
export function savePersistentSession(session: BaseeraSessionInfo): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(session);
    // 1. Session Storage
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
    // 2. Local Storage (persists after tab close)
    window.localStorage.setItem(SESSION_STORAGE_KEY, serialized);
    // 3. Browser Cookie (persists across subdomains/reloads)
    setCookie(SESSION_COOKIE_NAME, serialized, 30);
  } catch {
    // In restricted sandbox, memory session remains active
  }
}

/**
 * Load Baseera session checking sessionStorage, localStorage, and cookies.
 */
export function loadPersistentSession(): BaseeraSessionInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Check sessionStorage
    let raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    // 2. Check localStorage
    if (!raw) {
      raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    }
    // 3. Check Cookie
    if (!raw) {
      raw = getCookie(SESSION_COOKIE_NAME);
    }
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.token === 'string' && (typeof parsed.tenantId === 'string' || typeof parsed.schoolId === 'string')) {
      return parsed as BaseeraSessionInfo;
    }
  } catch {
    // Ignore corrupted data
  }
  return null;
}

/**
 * Clear Baseera session from all persistent storages.
 */
export function clearPersistentSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    deleteCookie(SESSION_COOKIE_NAME);
  } catch {
    // Ignore errors
  }
}

/**
 * Save user's registered child records to localStorage (encrypted at rest) and summary cookie.
 */
export function saveStoredStudents(students: StudentRecord[]): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  // Serialize writes so a slower encryption operation for an older React state
  // cannot finish after and overwrite a newer child roster.
  const snapshot = students.slice();
  const operation = studentSaveQueue.catch(() => undefined).then(async () => {
    // Never silently discard the previous record if encryption/key persistence fails.
    const customOrUpdated = snapshot.filter((s) => !s.isDemoRecord || s.cognitiveBattery !== null || s.sessionStatus === 'completed');
    const encrypted = await secureEncrypt(customOrUpdated);
    window.localStorage.setItem(STUDENTS_STORAGE_KEY, encrypted);
    // Do not put children's names/ages in cookies; cookies are sent with HTTP requests.
    deleteCookie('hn_children_summary');
  });
  studentSaveQueue = operation;
  return operation;
}

/**
 * Load child records asynchronously. Legacy plaintext/v1/v2 records are upgraded
 * only after successful decoding; unreadable ciphertext is retained for recovery.
 */
export async function loadStoredStudents(): Promise<StudentRecord[]> {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STUDENTS_STORAGE_KEY);
  if (!raw) return [];
  const decrypted = await secureDecryptAsync<StudentRecord[]>(raw);
  if (!Array.isArray(decrypted)) return [];
  if (!isCurrentSecureCiphertext(raw)) {
    try {
      const upgraded = await secureEncrypt(decrypted);
      window.localStorage.setItem(STUDENTS_STORAGE_KEY, upgraded);
    } catch (error) {
      // Return the successfully decoded legacy records, but never delete/replace
      // them if the browser cannot persist its non-extractable AES-GCM key.
      console.error('Legacy child records could not be upgraded yet; original data was preserved.', error);
    }
  }
  return decrypted;
}

/**
 * Save active student ID in localStorage and cookie.
 */
export function saveActiveStudentId(studentId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_STUDENT_STORAGE_KEY, studentId);
    setCookie(ACTIVE_STUDENT_COOKIE_NAME, studentId, 30);
  } catch {
    // Ignore errors
  }
}

/**
 * Load active student ID from localStorage or cookie.
 */
export function loadActiveStudentId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_STUDENT_STORAGE_KEY) || getCookie(ACTIVE_STUDENT_COOKIE_NAME);
  } catch {
    return null;
  }
}
