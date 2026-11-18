import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import type { StudentRecord } from '../data/seedData';
import { prepareStudentRecordForGenericSupabaseSync } from './studentRecordSyncSafety';

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
      error: new Error('يرجى إضافة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env أولًا')
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
 * Sign in or sign up with Email and Password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string,
  extraMetadata?: Record<string, unknown>
): Promise<{ user: User | null; session: Session | null }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!isSupabaseConfigured()) {
    throw new Error('خدمة الحسابات غير مهيأة؛ لم يتم إنشاء حساب محلي بديل.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        full_name: fullName || cleanEmail.split('@')[0],
        ...(extraMetadata || {}),
      },
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error('لم يؤكد مزود الحساب إنشاء المستخدم.');

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('hn_parent_account', JSON.stringify({
      email: cleanEmail,
      name: fullName || cleanEmail.split('@')[0],
    }));
  }
  return { user: data.user, session: data.session };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; session: Session | null }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!isSupabaseConfigured()) {
    throw new Error('خدمة الحسابات غير مهيأة؛ لا يمكن تسجيل الدخول دون خادم مصادقة.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });
  if (error) throw error;
  if (!data.user || !data.session) {
    throw new Error('لم يُنشأ اتصال مصادقة صالح. تحقق من بريدك الإلكتروني أو أعد المحاولة.');
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('hn_parent_account', JSON.stringify({
      email: cleanEmail,
      name: data.user.user_metadata?.full_name,
    }));
  }
  return { user: data.user, session: data.session };
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

let lastSupabaseSyncError = '';

export function getLastSupabaseSyncError(): string {
  return lastSupabaseSyncError;
}

/**
 * Sync a student record to Supabase database
 */
export async function syncStudentToSupabase(student: StudentRecord, userId: string): Promise<boolean> {
  lastSupabaseSyncError = '';
  if (!isSupabaseConfigured() || !userId) {
    lastSupabaseSyncError = 'SUPABASE_NOT_CONFIGURED';
    return false;
  }

  try {
    // Verify the browser holds a live authenticated session for this user before writing.
    // When Supabase "Confirm email" is enabled, signUp returns a user with session=null,
    // which causes RLS (auth.uid() = user_id) to reject inserts until email confirmation.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session || sessionData.session.user?.id !== userId) {
      lastSupabaseSyncError = 'SESSION_PENDING_EMAIL_CONFIRMATION';
      console.warn('Cannot sync student without an active authenticated Supabase session (email confirmation may be pending).');
      return false;
    }

    // Generic profile sync is not allowed to write assessment evidence. First read
    // the same user's stored row, then preserve its server-owned assessment fields.
    let existingRow: {
      raw_data?: Partial<StudentRecord> | null;
      guardian_consent?: boolean | null;
      guardian_consent_recorded_at?: string | null;
      guardian_audio_consent?: boolean | null;
      guardian_audio_consent_recorded_at?: string | null;
    } | null = null;
    let hasAudioConsentColumns = true;

    const { data: existing, error: readError } = await supabase
      .from('students')
      .select('raw_data,guardian_consent,guardian_consent_recorded_at,guardian_audio_consent,guardian_audio_consent_recorded_at')
      .eq('id', student.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (readError) {
      // Resilient fallback: support existing production databases before migration 20261115
      if (readError.message?.includes('guardian_audio_consent') || readError.code === '42703') {
        hasAudioConsentColumns = false;
        const { data: legacyExisting, error: legacyReadError } = await supabase
          .from('students')
          .select('raw_data,guardian_consent,guardian_consent_recorded_at')
          .eq('id', student.id)
          .eq('user_id', userId)
          .maybeSingle();
        if (legacyReadError) {
          lastSupabaseSyncError = legacyReadError.message || 'READ_FAILED';
          console.warn('Failed to read existing student before safe sync:', legacyReadError.message);
          return false;
        }
        existingRow = legacyExisting;
      } else {
        lastSupabaseSyncError = readError.message || 'READ_FAILED';
        console.warn('Failed to read existing student before safe sync:', readError.message);
        return false;
      }
    } else {
      existingRow = existing;
    }

    const safeStudent = prepareStudentRecordForGenericSupabaseSync(student, existingRow);

    const upsertPayload: Record<string, unknown> = {
      id: safeStudent.id,
      user_id: userId,
      name: safeStudent.name,
      grade: Number.isFinite(safeStudent.gradeLevel) ? String(safeStudent.gradeLevel) : 'غير محدد',
      age: Number.isFinite(safeStudent.ageYears) ? safeStudent.ageYears : null,
      country: safeStudent.country || null,
      dialect: safeStudent.country || 'msa',
      guardian_consent: safeStudent.guardianConsentGiven === true,
      guardian_consent_source: safeStudent.guardianConsentSource || null,
      guardian_consent_recorded_at: safeStudent.guardianConsentRecordedAt || null,
      notes: safeStudent.parentNotes || null,
      raw_data: safeStudent,
      updated_at: new Date().toISOString(),
    };

    if (hasAudioConsentColumns) {
      upsertPayload.guardian_audio_consent = safeStudent.guardianAudioConsentGiven === true;
      upsertPayload.guardian_audio_consent_recorded_at = safeStudent.guardianAudioConsentRecordedAt || null;
    }

    let { error } = await supabase.from('students').upsert(upsertPayload);

    // Gracefully strip optional schema-migration columns if the live DB hasn't applied them yet
    for (let attempt = 0; attempt < 2 && error && (error.code === '42703' || error.message?.includes('column') || error.message?.includes('schema cache')); attempt++) {
      let stripped = false;
      if (error.message?.includes('country') && 'country' in upsertPayload) {
        delete upsertPayload.country;
        stripped = true;
      }
      if (error.message?.includes('guardian_audio_consent') && 'guardian_audio_consent' in upsertPayload) {
        delete upsertPayload.guardian_audio_consent;
        delete upsertPayload.guardian_audio_consent_recorded_at;
        stripped = true;
      }
      if (!stripped) break;
      const retryResult = await supabase.from('students').upsert(upsertPayload);
      error = retryResult.error;
    }

    if (error) {
      lastSupabaseSyncError = error.message || error.code || 'UPSERT_FAILED';
      console.warn('Failed to sync student to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    lastSupabaseSyncError = err instanceof Error ? err.message : String(err);
    console.warn('Supabase sync exception:', err);
    return false;
  }
}

/**
 * Save family training progress through the server. The server checks child ownership and
 * re-derives new transfer scores from its short-lived Azure receipts before cloud persistence.
 */
export async function syncTrainingProgressToSupabase(student: StudentRecord, userId: string): Promise<boolean> {
  const progress = student.trainingProgress;
  if (!isSupabaseConfigured() || !userId || !progress) return false;
  try {
    const { data, error } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (error || !accessToken || data.session?.user?.id !== userId) return false;
    const response = await fetch(`/api/parent/students/${encodeURIComponent(student.id)}/training-progress`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ progress }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { error?: string } | null;
      console.warn('Failed to sync training progress to Supabase:', failure?.error || response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase training sync exception:', err);
    return false;
  }
}

/**
 * Permanently delete one child's record for the signed-in parent. Row-level security allows a user
 * to delete only their own rows, and the child's assessments, oral-reading sessions and training
 * progress are removed with it (ON DELETE CASCADE in supabase/schema.sql).
 */
export async function deleteStudentFromSupabase(studentId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId || !studentId) return false;
  try {
    const { error } = await supabase.from('students').delete().eq('id', studentId).eq('user_id', userId);
    if (error) {
      console.warn('Failed to delete student from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to delete student from Supabase:', err);
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

    // Every row this app writes carries the full record in raw_data. A row without it (e.g. added
    // by hand in the dashboard) lacks fields the screens need, so it is skipped instead of guessed.
    return data
      .filter((row: any) => row.raw_data && typeof row.raw_data === 'object')
      .map((row: any) => {
        const student = row.raw_data as StudentRecord;
        if (row.guardian_audio_consent !== undefined && row.guardian_audio_consent !== null) {
          student.guardianAudioConsentGiven = row.guardian_audio_consent === true;
          if (row.guardian_audio_consent_recorded_at) {
            student.guardianAudioConsentRecordedAt = row.guardian_audio_consent_recorded_at;
          }
        }
        if (row.country) {
          student.country = row.country;
        } else if (!student.country && row.dialect && row.dialect !== 'faseeh' && row.dialect !== 'msa') {
          student.country = row.dialect;
        }
        if (!student.parentNotes && typeof row.notes === 'string' && row.notes.trim()) {
          student.parentNotes = row.notes.trim();
        }
        return student;
      });
  } catch (err) {
    console.warn('Failed to load students from Supabase:', err);
    return [];
  }
}
