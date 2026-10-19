export type ClinicalRole = 'clinician' | 'educator_readonly';

export interface ClinicalSessionInfo {
  token: string;
  role: ClinicalRole;
  clinicianName: string;
  scopes: string[];
  issuedAt?: number;
  expiresAt: number;
}

const SESSION_STORAGE_KEY = 'baseera_clinical_session_v1';
let cachedSession: ClinicalSessionInfo | null = null;

/** Returns a valid session created by an explicit user login; never creates credentials automatically. */
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
    // Invalid or unavailable storage is treated as unauthenticated.
  }
  return null;
}

/** Requires an access code entered explicitly by the user. No default credential is embedded. */
export async function loginClinicalSession(
  accessCode: string,
  clinicianName = 'مستخدم بصيرة'
): Promise<ClinicalSessionInfo | null> {
  if (!accessCode.trim()) return null;
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode: accessCode.trim(), clinicianName }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ClinicalSessionInfo;
    if (data?.token && data.expiresAt > Date.now()) {
      cachedSession = data;
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
        } catch {
          // The in-memory session remains usable for this tab.
        }
      }
      return data;
    }
  } catch {
    // Network failure.
  }
  return null;
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

/** Never signs in automatically. Protected operations require a user-created session. */
export async function ensureClinicalSession(): Promise<ClinicalSessionInfo | null> {
  return getStoredClinicalSession();
}

export async function authenticatedFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const session = await ensureClinicalSession();
  const headers = new Headers(init.headers || {});
  if (session?.token) {
    headers.set('Authorization', `Bearer ${session.token}`);
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) clearClinicalSession();
  return response;
}
