export type ClinicalRole = 'clinician' | 'educator_readonly';

export interface ClinicalSessionInfo {
  token: string;
  role: ClinicalRole;
  clinicianName: string;
  scopes: string[];
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
    if (parsed && parsed.token && parsed.expiresAt > Date.now() + 10_000) {
      cachedSession = parsed;
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export async function loginClinicalSession(
  accessCode: string,
  role: ClinicalRole = 'clinician',
  clinicianName: string = 'أخصائي التقييم المعتمد'
): Promise<ClinicalSessionInfo | null> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode, role, clinicianName }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ClinicalSessionInfo;
    if (data && data.token) {
      cachedSession = data;
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
        } catch {}
      }
      return data;
    }
  } catch {
    // network error
  }
  return null;
}

export function clearClinicalSession(): void {
  cachedSession = null;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
  }
}

export async function ensureClinicalSession(): Promise<ClinicalSessionInfo | null> {
  // Authentication is explicit; never mint a server session from a bundled credential.
  return getStoredClinicalSession();
}

/**
 * Wrapper around fetch() that automatically attaches the Educator/Clinician RBAC Bearer token
 * required by `/api/students` and `/api/ai/*`.
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

  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const session = await ensureClinicalSession();
  const headers = new Headers(init.headers || {});
  if (session?.token) {
    headers.set('Authorization', `Bearer ${session.token}`);
    headers.set('X-Clinical-Session-Token', session.token);
  }
  const response = await fetch(input, {
    ...init,
    headers,
  });
  if (response.status === 401) {
    // Token expired or server restarted: re-authenticate once
    clearClinicalSession();
    const refreshed = await loginClinicalSession();
    if (refreshed?.token) {
      headers.set('Authorization', `Bearer ${refreshed.token}`);
      headers.set('X-Clinical-Session-Token', refreshed.token);
      return fetch(input, {
        ...init,
        headers,
      });
    }
  }
  return response;
}
