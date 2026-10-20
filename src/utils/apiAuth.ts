export type ClinicalRole = 'clinician' | 'educator_readonly';

export interface ClinicalSessionInfo {
  token: string;
  role: ClinicalRole;
  clinicianName: string;
  tenantId: string;
  sessionId: string;
  scopes: string[];
  issuedAt?: number;
  expiresAt: number;
}

const SESSION_STORAGE_KEY = 'baseera_clinical_session_v1';
let cachedSession: ClinicalSessionInfo | null = null;

export function getStoredClinicalSession(): ClinicalSessionInfo | null {
  if (cachedSession && cachedSession.expiresAt > Date.now() + 10_000) {
    return cachedSession;
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClinicalSessionInfo;
    if (parsed?.token && parsed.expiresAt > Date.now() + 10_000) {
      cachedSession = parsed;
      return parsed;
    }
  } catch {
    // Ignore session storage errors and keep the client signed out.
  }
  return null;
}

export async function loginClinicalSession(
  accessCode: string,
  role: ClinicalRole = 'clinician',
  clinicianName = 'أخصائي التقييم'
): Promise<ClinicalSessionInfo | null> {
  if (!accessCode || typeof accessCode !== 'string') return null;
  try {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode, role, clinicianName }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as ClinicalSessionInfo;
    if (!data?.token || !data.expiresAt) return null;

    cachedSession = data;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
      } catch {
        // The in-memory session remains usable for this tab.
      }
    }
    return data;
  } catch {
    return null;
  }
}

/** Revoke the current token on the server, then clear it locally even if offline. */
export async function logoutClinicalSession(): Promise<void> {
  const session = getStoredClinicalSession();
  try {
    if (session?.token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
    }
  } catch {
    // The local session is always cleared; the server token will expire within one hour.
  } finally {
    clearClinicalSession();
  }
}

export function clearClinicalSession(): void {
  cachedSession = null;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }
}

export async function ensureClinicalSession(): Promise<ClinicalSessionInfo | null> {
  // Authentication is explicit. Never mint a session from a bundled credential.
  return getStoredClinicalSession();
}

/**
 * Send an authenticated request when an explicit session exists.
 * No automatic sign-in or credential refresh is performed.
 */
export async function authenticatedFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const session = await ensureClinicalSession();
  const headers = new Headers(init.headers || {});
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) clearClinicalSession();
  return response;
}
