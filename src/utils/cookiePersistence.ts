/**
 * Cookie and persistent local storage management for user sessions,
 * child profiles, and active screening states across browser reloads.
 */
import type { BaseeraSessionInfo } from './apiAuth';
import type { StudentRecord } from '../data/seedData';

const SESSION_COOKIE_NAME = 'baseera_session';
const SESSION_STORAGE_KEY = 'baseera_session_v1';
const STUDENTS_STORAGE_KEY = 'hn_stored_students_v1';
const ACTIVE_STUDENT_STORAGE_KEY = 'hn_active_student_id';
const ACTIVE_STUDENT_COOKIE_NAME = 'hn_active_student_id';

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

    const parsed = JSON.parse(raw) as BaseeraSessionInfo;
    if (parsed?.token && parsed.expiresAt > Date.now() + 10_000) {
      return parsed;
    }
  } catch {
    // Ignore corrupt data
  }
  return null;
}

/**
 * Remove session from all storage mechanisms.
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
 * Save user's registered child records to localStorage and summary cookie.
 */
export function saveStoredStudents(students: StudentRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Filter only non-demo or customized records to prevent storing giant demo arrays
    const customOrUpdated = students.filter((s) => !s.isDemoRecord || s.cognitiveBattery !== null || s.sessionStatus === 'completed');
    window.localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(customOrUpdated));

    // Store a light summary cookie for quick presence check
    const summary = customOrUpdated.slice(0, 5).map((c) => ({ id: c.id, name: c.name, age: c.ageYears }));
    setCookie('hn_children_summary', JSON.stringify(summary), 30);
  } catch {
    // Ignore quota or private-browsing errors
  }
}

/**
 * Load saved custom child records from localStorage.
 */
export function loadStoredStudents(): StudentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STUDENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as StudentRecord[];
    }
  } catch {
    // Ignore errors
  }
  return [];
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
