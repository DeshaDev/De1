import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import type { StudentRecord } from '../data/seedData';
import { prepareStudentRecordForGenericSupabaseSync } from './studentRecordSyncSafety';
import { PROGRAM_SESSIONS } from '../cognitiveProfile/training';
import { summarizeProbes } from '../cognitiveProfile/progressProbe';

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
 * Sign in or sign up with Email and Password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string
): Promise<{ user: User | null; session: Session | null }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!isSupabaseConfigured()) {
    throw new Error('خدمة الحسابات غير مهيأة؛ لم يتم إنشاء حساب محلي بديل.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: { full_name: fullName || cleanEmail.split('@')[0] },
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

/**
 * Sync a student record to Supabase database
 */
export async function syncStudentToSupabase(student: StudentRecord, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;

  try {
    // Generic profile sync is not allowed to write assessment evidence. First read
    // the same user's stored row, then preserve its server-owned assessment fields.
    const { data: existing, error: readError } = await supabase
      .from('students')
      .select('raw_data,guardian_consent,guardian_consent_recorded_at')
      .eq('id', student.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (readError) {
      console.warn('Failed to read existing student before safe sync:', readError.message);
      return false;
    }

    const safeStudent = prepareStudentRecordForGenericSupabaseSync(
      student,
      existing as {
        raw_data?: Partial<StudentRecord> | null;
        guardian_consent?: boolean | null;
        guardian_consent_recorded_at?: string | null;
      } | null
    );

    const { error } = await supabase.from('students').upsert({
      id: safeStudent.id,
      user_id: userId,
      name: safeStudent.name,
      grade: Number.isFinite(safeStudent.gradeLevel) ? String(safeStudent.gradeLevel) : 'غير محدد',
      age: Number.isFinite(safeStudent.ageYears) ? safeStudent.ageYears : null,
      dialect: safeStudent.dialect || safeStudent.dialectCode || 'faseeh',
      guardian_consent: safeStudent.guardianConsentGiven === true,
      guardian_consent_source: safeStudent.guardianConsentSource || null,
      guardian_consent_recorded_at: safeStudent.guardianConsentRecordedAt || null,
      notes: safeStudent.parentNotes || null,
      raw_data: safeStudent,
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
 * Mirror the guided programme, including every daily progress probe, to the training_progress
 * table (one row per child), so progress can be queried and reported from the database.
 * The child's row in `students` must exist first (it is written when the child is registered).
 */
export async function syncTrainingProgressToSupabase(student: StudentRecord, userId: string): Promise<boolean> {
  const progress = student.trainingProgress;
  if (!isSupabaseConfigured() || !userId || !progress) return false;
  const sessions = new Set(progress.history.map((h) => h.date.slice(0, 10))).size;
  const probes = progress.probes ?? [];
  try {
    const { error } = await supabase.from('training_progress').upsert({
      id: `${student.id}:guided-program`,
      student_id: student.id,
      user_id: userId,
      station: 'guided-program',
      progress_percent: Math.min(100, Math.round((sessions / PROGRAM_SESSIONS) * 100)),
      completed_milestones: progress.mastered,
      details: {
        plan: progress.plan,
        levels: progress.levels,
        supportFlags: progress.supportFlags,
        sessionsCompleted: sessions,
        history: progress.history.slice(-400),
        probes: probes.slice(-200),
        probeSummary: summarizeProbes(probes),
      },
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.warn('Failed to sync training progress to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase training sync exception:', err);
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
      .map((row: any) => row.raw_data as StudentRecord);
  } catch (err) {
    console.warn('Failed to load students from Supabase:', err);
    return [];
  }
}
