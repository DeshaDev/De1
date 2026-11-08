import {
  savePersistentSession,
  loadPersistentSession,
  clearPersistentSession,
} from './cookiePersistence';

/** `parent` is a family account signed in with Supabase; the school server never issues it. */
export type BaseeraRole = 'platform_admin' | 'school_admin' | 'educator_readonly' | 'parent';

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
  platform: 'إدارة منصة بصيرة المركزية',
  baseera_hq: 'المقر الرئيسي لمنصة بصيرة',
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

let cachedSession: BaseeraSessionInfo | null = null;

/**
 * Explicitly save session to persistent storage (cookies, localStorage, sessionStorage)
 * and update the in-memory cache.
 */
export function storeBaseeraSession(session: BaseeraSessionInfo): void {
  const enriched: BaseeraSessionInfo = {
    ...session,
    tenantDisplayNameAr: getTenantDisplayLabelAr(session),
  };
  cachedSession = enriched;
  savePersistentSession(enriched);
}

export function getStoredBaseeraSession(): BaseeraSessionInfo | null {
  if (cachedSession && cachedSession.expiresAt > Date.now() + 10_000) {
    return cachedSession;
  }
  if (typeof window === 'undefined') return null;
  try {
    const loaded = loadPersistentSession();
    if (loaded && loaded.token && loaded.expiresAt > Date.now() + 10_000) {
      cachedSession = {
        ...loaded,
        tenantDisplayNameAr: getTenantDisplayLabelAr(loaded),
      };
      return cachedSession;
    }
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
    savePersistentSession(enriched);
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
  clearPersistentSession();
}

export async function ensureBaseeraSession(): Promise<BaseeraSessionInfo | null> {
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
  const session = await ensureBaseeraSession();
  const headers = new Headers(init.headers || {});
  let usedParentToken = false;
  if (session?.token) {
    headers.set('Authorization', `Bearer ${session.token}`);
  } else {
    // Family accounts: the current Supabase access token, which the server verifies with Supabase.
    const parentToken = await parentAccessToken();
    if (parentToken) {
      headers.set('Authorization', `Bearer ${parentToken}`);
      usedParentToken = true;
    }
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && !usedParentToken) clearBaseeraSession();
  return response;
}

async function parentAccessToken(): Promise<string | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import('./supabaseClient');
    if (!isSupabaseConfigured()) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
