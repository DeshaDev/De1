import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import type { StudentRecord } from '../data/seedData';

// Vite client-side environment variables
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('YOUR_SUPABASE') &&
    !supabaseAnonKey.includes('YOUR_ANON_KEY')
  );
};

// Fallback dummy client if credentials are not configured yet, preventing app crashes
const dummyClient = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signInWithOAuth: async () => ({
      data: null,
      error: new Error('يرجى إضافة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env أولاً')
    }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } }
    }),
  },
  from: () => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: null, error: null }),
    upsert: () => ({ data: null, error: null }),
    delete: () => ({ data: null, error: null }),
  }),
} as unknown as SupabaseClient;

export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : dummyClient;

/**
 * Sign in with Google OAuth via Supabase
 */
export async function signInWithGoogle(): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'لم يتم إعداد Supabase بعد. يرجى إضافة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env وتفعيل Google Provider في لوحة Supabase.'
    );
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw error;
  }
}

/**
 * Sign out of Supabase session
 */
export async function signOutSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out from Supabase:', error);
    throw error;
  }
}

/**
 * Listen to auth state changes
 */
export function onSupabaseAuthChange(
  callback: (user: User | null, session: Session | null) => void
) {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null, session);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

/**
 * Sync a student record to Supabase database
 */
export async function syncStudentToSupabase(student: StudentRecord, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;

  try {
    const { error } = await supabase.from('students').upsert({
      id: student.id,
      user_id: userId,
      name: student.name,
      grade: student.grade || 'غير محدد',
      age: student.age || null,
      dialect: student.dialect || student.dialectCode || 'faseeh',
      guardian_consent: student.guardianConsentGiven === true,
      guardian_consent_source: student.guardianConsentSource || null,
      guardian_consent_recorded_at: student.guardianConsentRecordedAt || null,
      notes: student.clinicalNotes || null,
      raw_data: student,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('Failed to sync student to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase sync exception:', err);
    return false;
  }
}

/**
 * Load all students for the authenticated Supabase user
 */
export async function fetchStudentsFromSupabase(userId: string): Promise<StudentRecord[]> {
  if (!isSupabaseConfigured() || !userId) return [];

  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error || !data) {
      console.warn('Failed to fetch students from Supabase:', error?.message);
      return [];
    }

    return data.map((row: any) => {
      if (row.raw_data && typeof row.raw_data === 'object') {
        return row.raw_data as StudentRecord;
      }
      return {
        id: row.id,
        name: row.name,
        grade: row.grade,
        age: row.age,
        dialect: row.dialect,
        guardianConsentGiven: row.guardian_consent,
        guardianConsentSource: row.guardian_consent_source,
        guardianConsentRecordedAt: row.guardian_consent_recorded_at,
        clinicalNotes: row.notes,
        sessionStatus: 'completed',
        lastScreenedDate: row.updated_at,
      } as StudentRecord;
    });
  } catch (err) {
    console.warn('Failed to load students from Supabase:', err);
    return [];
  }
}
