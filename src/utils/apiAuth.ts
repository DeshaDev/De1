export type BaseeraRole = 'school_admin' | 'educator_readonly';

export interface BaseeraSessionInfo {
  token: string;
  role: BaseeraRole;
  accountName: string;
  tenantId: string;
  tenantDisplayNameAr?: string;
  sessionId: string;
  scopes: string[];
  issuedAt?: number;
  expiresAt: number;
}

const TENANT_DISPLAY_FALLBACKS: Record<string, string> = {
  default: 'مدرسة الرواد الابتدائية',
  school_a: 'مدرسة الرواد الأولى (أ)',
  school_b: 'مدرسة النخبة الثانية (ب)',
  school_alpha: 'مدرسة ألف النموذجية',
  school_beta: 'مدرسة باء النموذجية',
};

export function getTenantDisplayLabelAr(session: BaseeraSessionInfo): string {
  if (session.tenantDisplayNameAr && session.tenantDisplayNameAr.trim()) {
    return session.tenantDisplayNameAr.trim();
  }
  const cleanId = (session.tenantId || '').trim();
  if (TENANT_DISPLAY_FALLBACKS[cleanId]) {
    return TENANT_DISPLAY_FALLBACKS[cleanId];
  }
  const matchSuffix = cleanId.match(/^school[_-]([a-zA-Z0-9]+)$/i);
  if (matchSuffix) {
    return `مدرسة القطاع (${matchSuffix[1].toUpperCase()})`;
  }
  return cleanId ? `مدرسة (${cleanId})` : 'المدرسة المعتمدة';
}

const SESSION_STORAGE_KEY = 'baseera_clinical_session_v1';
let cachedSession: BaseeraSessionInfo | null = null;

export function getStoredBaseeraSession(): BaseeraSessionInfo | null {
  if (cachedSession && cachedSession.expiresAt > Date.now() + 10_000) {
    return cachedSession;
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BaseeraSessionInfo;
    if (
      parsed?.token &&
      parsed.expiresAt > Date.now() + 10_000 &&
      typeof parsed.tenantId === 'string' &&
      /^[a-zA-Z0-9_-]{1,80}$/.test(parsed.tenantId) &&
      typeof parsed.sessionId === 'string' &&
      /^[a-f0-9]{32}$/.test(parsed.sessionId)
    ) {
      cachedSession = {
        ...parsed,
        tenantDisplayNameAr: getTenantDisplayLabelAr(parsed),
      };
      return cachedSession;
    }
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore session storage errors and keep the client signed out.
  }
  return null;
}

export async function loginBaseeraSession(
  accessCode: string,
  role: BaseeraRole = 'school_admin',
  accountName = 'مسؤول المدرسة'
): Promise<BaseeraSessionInfo | null> {
  if (!accessCode || typeof accessCode !== 'string') return null;
  try {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode, role, accountName }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as BaseeraSessionInfo;
    if (!data?.token || !data.expiresAt) return null;

    const enriched: BaseeraSessionInfo = {
      ...data,
      tenantDisplayNameAr: getTenantDisplayLabelAr(data),
    };
    cachedSession = enriched;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify(enriched)
        );
      } catch {
        // The in-memory session remains usable for this tab.
      }
    }
    return enriched;
  } catch {
    return null;
  }
}

/** Revoke the current token on the server, then clear it locally even if offline. */
export async function logoutBaseeraSession(): Promise<void> {
  const session = getStoredBaseeraSession();
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
    clearBaseeraSession();
  }
}

export function clearBaseeraSession(): void {
  cachedSession = null;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }
}

export async function ensureClinicalSession(): Promise<BaseeraSessionInfo | null> {
  return getStoredBaseeraSession();
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
  if (response.status === 401) clearBaseeraSession();
  return response;
}
