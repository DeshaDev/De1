import { toArabicNum } from './utils/arabicDigits';
import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import {
  Search,
  Sparkles,
  Trophy,
  Flame,
  Eye,
  BarChart3,
  Home,
  BookOpen,
  Brain,
  Calculator,
  Gamepad2,
  GraduationCap,
  Type,
  CheckCircle2,
  ArrowLeft,
  Trash2,
  ShieldCheck,
  FileText,
  Users,
  Building2,
  Mail,
  Phone,
  Clock,
  RefreshCw,
  Target,
  Heart,
  Baby,
  UserPlus,
} from 'lucide-react';
import {
  INITIAL_STUDENTS,
  ARABIC_READING_PASSAGES,
  StudentRecord,
  StudentAssessmentSnapshot,
} from './data/seedData';
import {
  authenticatedFetch,
  clearBaseeraSession,
  logoutBaseeraSession,
  getStoredBaseeraSession,
  storeBaseeraSession,
  loginBaseeraSession,
  getTenantDisplayLabelAr,
  BaseeraSessionInfo,
} from './utils/apiAuth';
import { preloadAudioManifest } from './components/profile/audio';
import {
  saveStoredStudents,
  loadStoredStudents,
  saveActiveStudentId,
  loadActiveStudentId,
  clearStoredClientState,
  hasAcceptedCookieNotice,
  acceptCookieNotice,
} from './utils/cookiePersistence';
import { saveBatterySession, clearLiteracyPracticeProgress, clearAllChildData, normalizeHomeDialect, pronunciationLocaleForDialect, type BatterySession } from './cognitiveProfile/storage';
import {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signOutSupabase,
  onSupabaseAuthChange,
  isSupabaseConfigured,
  fetchStudentsFromSupabase,
  syncStudentToSupabase,
  getLastSupabaseSyncError,
  syncTrainingProgressToSupabase,
  deleteStudentFromSupabase,
} from './utils/supabaseClient';
import { AssessmentProvider } from './contexts/AssessmentContext';
const ReaderPage = lazy(() => import('./components/reader/ReaderPage').then((m) => ({ default: m.ReaderPage })));
const RemediationGymView = lazy(() => import('./components/RemediationGymView'));
const DyslexiaScreeningHub = lazy(() => import('./components/DyslexiaScreeningHub'));
import { BrandLockup, BrandMark } from './components/ui/BrandMark';
import { BatteryRiskBadge, BatterySummaryPanel } from './components/profile/BatterySummaryPanel';
import { ChildDashboard } from './components/profile/ChildDashboard';
import { mergeStudentRecords } from './utils/mergeStudentRecords';
import { TrainingProgressPanel } from './components/profile/TrainingProgressPanel';
import IndividualPlanPanel from './components/profile/IndividualPlanPanel';
import { trackUsage } from './utils/usageTracking';
const UsageMetricsPanel = lazy(() => import('./components/UsageMetricsPanel'));
const PrivacyPolicyView = lazy(() => import('./components/PrivacyPolicyView'));
const TermsOfUseView = lazy(() => import('./components/TermsOfUseView'));
const ContentReviewView = lazy(() => import('./components/review/ContentReviewView'));
const AudioComparisonLabView = lazy(() => import('./components/AudioComparisonLabView'));
import { ParentPortalView } from './components/ParentPortalView';
import { HomeLandingView, AppTabId } from './components/HomeLandingView';
import {
  DyslexiaComfortBar,
  DyslexiaSurfaceTheme,
  DyslexiaSpacingMode,
} from './components/DyslexiaComfortBar';

type ActiveTab = AppTabId;

type DashboardSubView = 'roster' | 'report' | 'demo_requests' | 'metrics';

/** A transcript or legacy human mark is not proof of an automated audio assessment. */
const hasVerifiedOralAudio = (student: StudentRecord): boolean =>
  student.aiAssessmentVerified === true &&
  student.evidenceProvenance === 'server-verified-audio';

function parseRouteFromLocation(): { tab: ActiveTab; showLogin?: boolean; subView?: DashboardSubView } {
  if (typeof window === 'undefined') return { tab: 'home' };
  const rawPath = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
  const params = new URLSearchParams(window.location.search);

  if (rawPath === '/signin' || rawPath === '/login') {
    return { tab: 'home', showLogin: true };
  }
  if (
    rawPath === '/parent' ||
    rawPath === '/parent-portal' ||
    rawPath === '/register-child' ||
    rawPath === '/child' ||
    rawPath === '/family'
  ) {
    return { tab: 'parent-portal' };
  }
  if (rawPath === '/screening' || rawPath === '/dyslexia-lab') {
    return { tab: 'dyslexia-lab' };
  }
  if (rawPath === '/training' || rawPath === '/guided-program') {
    return { tab: 'guided-program' };
  }
  if (rawPath === '/gym' || rawPath === '/remediation-gym') {
    return { tab: 'remediation-gym' };
  }
  if (rawPath === '/reader' || rawPath === '/adaptive-reader') {
    return { tab: 'adaptive-reader' };
  }
  if (rawPath === '/dashboard' || rawPath === '/report') {
    return { tab: 'dashboard', subView: 'report' };
  }
  if (rawPath === '/privacy') {
    return { tab: 'privacy' };
  }
  if (rawPath === '/terms') {
    return { tab: 'terms' };
  }
  if (rawPath === '/review' || params.get('review') === '1') {
    return { tab: 'content-review' };
  }
  // The multi-provider comparison lab is a developer diagnostic, not a child/family feature.
  // Keep its UI out of production builds even when someone guesses the route.
  if (import.meta.env.DEV && (rawPath === '/audio-lab' || rawPath === '/compare-audio' || params.get('audio_lab') === '1' || params.get('tab') === 'audio-lab')) {
    return { tab: 'audio-lab' };
  }

  // Fallback to query params
  if (params.get('tab') === 'dashboard' || params.get('autostart') === '1') {
    return { tab: 'dashboard' };
  }
  if (params.get('tab') === 'parent') {
    return { tab: 'parent-portal' };
  }
  return { tab: 'home' };
}

function tabToUrlPath(tab: ActiveTab): string {
  switch (tab) {
    case 'home':
      return '/';
    case 'parent-portal':
      return '/parent';
    case 'dyslexia-lab':
      return '/screening';
    case 'guided-program':
      return '/training';
    case 'remediation-gym':
      return '/gym';
    case 'adaptive-reader':
      return '/reader';
    case 'dashboard':
      return '/dashboard';
    case 'privacy':
      return '/privacy';
    case 'terms':
      return '/terms';
    case 'content-review':
      return '/review';
    case 'audio-lab':
      return '/audio-lab';
    default:
      return '/';
  }
}

export default function App() {
  // Family battery updates are serialized per child. Each snapshot may contain
  // one-use receipts for earlier tasks that are still being saved.
  const parentBatterySyncQueue = useRef(new Map<string, Promise<void>>());
  const initialRoute = parseRouteFromLocation();
  const [activeTab, setActiveTabState] = useState<ActiveTab>(initialRoute.tab);
  const [showBaseeraLogin, setShowBaseeraLogin] = useState<boolean>(initialRoute.showLogin || false);



  useEffect(() => {
    const handlePopState = () => {
      const route = parseRouteFromLocation();
      setActiveTabState(route.tab);
      if (route.showLogin) setShowBaseeraLogin(true);
      if (route.subView) setDashboardSubView(route.subView);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // One anonymous visit per browser session (see utils/usageTracking).
  useEffect(() => {
    try {
      if (sessionStorage.getItem('baseera.visitCounted')) return;
      sessionStorage.setItem('baseera.visitCounted', '1');
    } catch {
      // ignore storage errors
    }
    trackUsage('visit');
  }, []);

  // Always reset scroll to top on tab change so user never lands midway down a page
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);
  const [dashboardSubView, setDashboardSubView] =
    useState<DashboardSubView>(() => initialRoute.subView || 'report');
  const [students, setStudents] = useState<StudentRecord[]>(INITIAL_STUDENTS);
  const [isLocalStudentsLoaded, setIsLocalStudentsLoaded] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return loadActiveStudentId() || INITIAL_STUDENTS[0].id;
  });

  // IndexedDB-backed AES-GCM requires async hydration. Do not write defaults over
  // a user's existing encrypted/legacy records before that read has completed.
  useEffect(() => {
    let cancelled = false;
    void loadStoredStudents()
      .then((stored) => {
        if (cancelled) return;
        setIsLocalStudentsLoaded(true);
        if (stored.length > 0) {
          const storedIds = new Set(stored.map((student) => student.id));
          const merged = [...stored, ...INITIAL_STUDENTS.filter((student) => !storedIds.has(student.id))];
          // The cloud copy may already have arrived: keep the newer result of each child.
          setStudents((prev) => mergeStudentRecords(prev, merged));
          const savedId = loadActiveStudentId();
          setSelectedStudentId(savedId && merged.some((student) => student.id === savedId) ? savedId : merged[0].id);
        }
      })
      .catch((error) => {
        // Keep local persistence disabled when ciphertext exists but cannot be
        // decrypted; writing the initial roster could otherwise destroy it.
        console.error('Unable to restore encrypted child records; existing data was left untouched.', error);
      });
    return () => { cancelled = true; };
  }, []);

  const selectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    saveActiveStudentId(studentId);
  };

  // Sync students to cookie / persistent storage whenever records change
  useEffect(() => {
    if (isLocalStudentsLoaded && students && students.length > 0) {
      void saveStoredStudents(students).catch((error) => {
        console.error('Unable to persist encrypted child records; previous stored data was preserved.', error);
      });
    }
  }, [students, isLocalStudentsLoaded]);
  const [schoolRosterEmpty, setSchoolRosterEmpty] = useState(false);
  const [isPersistedStoreLoaded, setIsPersistedStoreLoaded] =
    useState<boolean>(false);
  const [baseeraSession, setBaseeraSession] =
    useState<BaseeraSessionInfo | null>(() => getStoredBaseeraSession());
  const [pendingServerRecord, setPendingServerRecord] =
    useState<StudentRecord | null>(null);
  const [baseeraAccessCode, setBaseeraAccessCode] = useState<string>('');
  const [baseeraLoginError, setBaseeraLoginError] = useState<string>('');
  const [isBaseeraLoggingIn, setIsBaseeraLoggingIn] = useState<boolean>(false);
  const [demoRequests, setDemoRequests] = useState<any[]>([]);
  const [isLoadingDemoRequests, setIsLoadingDemoRequests] = useState<boolean>(false);
  const [demoRequestsError, setDemoRequestsError] = useState<string>('');

  const fetchDemoRequests = async () => {
    if (!baseeraSession || baseeraSession.role !== 'platform_admin') return;
    setIsLoadingDemoRequests(true);
    setDemoRequestsError('');
    try {
      const res = await authenticatedFetch('/api/admin/school-demo-requests');
      if (res.ok) {
        const data = await res.json();
        setDemoRequests(Array.isArray(data.requests) ? data.requests : []);
      } else {
        const err = await res.json().catch(() => null);
        setDemoRequestsError(err?.error || 'تعذر تحميل طلبات المدارس.');
      }
    } catch {
      setDemoRequestsError('خطأ في الاتصال بالخادم.');
    } finally {
      setIsLoadingDemoRequests(false);
    }
  };

  const handleUpdateLeadStatus = async (id: string, newStatus: string) => {
    try {
      const res = await authenticatedFetch(`/api/admin/school-demo-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setDemoRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
        );
      }
    } catch {
      // Non-blocking
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!window.confirm('هل تريد حذف طلب التواصل؟ لا يشمل الحذف النسخ الاحتياطية لدى مزوّد الاستضافة.')) return;
    try {
      const res = await authenticatedFetch(`/api/admin/school-demo-requests/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDemoRequests((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      // Non-blocking
    }
  };

  // Roster filtering & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [hideDemoRecords, setHideDemoRecords] = useState<boolean>(false);

  // Status state for updating the deterministic descriptive learning report
  const [isUpdatingReport, setIsGeneratingAI] = useState<boolean>(false);
  const [aiStatusBanner, setAiStatusBanner] = useState<string>('');

  // Supabase User & Auth State
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [supabaseAuthLoading, setSupabaseAuthLoading] = useState<boolean>(() => isSupabaseConfigured());
  const [supabaseError, setSupabaseError] = useState<string>('');
  const [cookieNoticeAccepted, setCookieNoticeAccepted] = useState<boolean>(() => hasAcceptedCookieNotice());

  useEffect(() => {
    preloadAudioManifest();
  }, []);

  const PUBLIC_TABS: ReadonlySet<ActiveTab> = new Set([
    'home',
    'parent-portal',
    'privacy',
    'terms',
    'dashboard',
  ]);
  const isAuthenticated = Boolean(supabaseUser || baseeraSession);

  const setActiveTab = (tab: ActiveTab) => {
    // Strictly require login: redirect unauthenticated visits to the parent portal cleanly.
    if (!PUBLIC_TABS.has(tab) && !supabaseUser && !baseeraSession) {
      setActiveTabState('parent-portal');
      const portalPath = tabToUrlPath('parent-portal');
      if (typeof window !== 'undefined' && window.location.pathname !== portalPath) {
        window.history.pushState(null, '', portalPath);
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
      return;
    }
    setAiStatusBanner('');
    setActiveTabState(tab);
    const newPath = tabToUrlPath(tab);
    if (typeof window !== 'undefined' && window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  // Enforce no-guest-mode on direct URL navigation (e.g. /screening, /training, /reading)
  // Wait for initial Supabase session hydration before redirecting so reloads keep logged-in parents on their page.
  useEffect(() => {
    if (supabaseAuthLoading) return;
    if (!PUBLIC_TABS.has(activeTab) && !isAuthenticated) {
      setActiveTabState('parent-portal');
      if (typeof window !== 'undefined') {
        const portalPath = tabToUrlPath('parent-portal');
        if (window.location.pathname !== portalPath) {
          window.history.replaceState(null, '', portalPath);
        }
      }
    }
  }, [activeTab, isAuthenticated, supabaseAuthLoading]);

  const flushPendingChildForUser = async (user: any): Promise<StudentRecord | null> => {
    if (!user?.id) return null;
    let pendingLearner: StudentRecord | null = null;
    try {
      const rawLocal = typeof localStorage !== 'undefined' ? localStorage.getItem('hn_pending_child_registration') : null;
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal) as { userId?: string; student?: StudentRecord };
        if (parsed?.userId === user.id && parsed.student) {
          pendingLearner = parsed.student;
        }
      }
    } catch {
      // ignore corrupted local cache
    }

    if (!pendingLearner && user.user_metadata?.pending_child && typeof user.user_metadata.pending_child === 'object') {
      const meta = user.user_metadata.pending_child as Record<string, any>;
      const recordedAt = typeof meta.guardianConsentRecordedAt === 'string' ? meta.guardianConsentRecordedAt : new Date().toISOString();
      const childName = typeof meta.name === 'string' && meta.name.trim().length >= 2 ? meta.name.trim() : '';
      if (childName) {
        pendingLearner = {
          id: typeof meta.id === 'string' && meta.id ? meta.id : `stu-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)}`,
          name: childName,
          parentAccount: user.id,
          isDemoRecord: false,
          sessionStatus: 'in_progress',
          sessionRoleLabel: 'ولي الأمر / فحص منزلي',
          assessmentHistory: [],
          cognitiveBattery: null,
          trainingProgress: null,
          gradeLevel: Number.isInteger(meta.gradeLevel) ? meta.gradeLevel : 1,
          ageYears: Number.isInteger(meta.ageYears) ? meta.ageYears : 6,
          country: typeof meta.country === 'string' ? meta.country : 'غير محددة',
          dialectCode: 'msa',
          dialect: 'msa',
          schoolName: `حساب ولي الأمر (${user.user_metadata?.full_name || user.email || 'الأسرة'})`,
          lastScreenedDate: '—',
          passageId: ARABIC_READING_PASSAGES[0].id,
          guardianConsentGiven: true,
          guardianConsentRecordedAt: recordedAt,
          guardianConsentSource: `إقرار ذاتي من مستخدم بوابة الأسرة (${recordedAt.split('T')[0]})`,
          guardianAudioConsentGiven: meta.audioConsentGiven === true,
          ...(meta.audioConsentGiven === true ? { guardianAudioConsentRecordedAt: recordedAt } : {}),
          parentNotes: typeof meta.notes === 'string' && meta.notes.trim() ? meta.notes.trim() : undefined,
          speechRecognitionUsed: false,
          wpm: 0,
          dyslexiaRiskScore: null,
          readingHeuristicIndicator: null,
          readingRiskLevel: 'unassessed',
          readingRiskLabelAr: 'جاهز لبدء الفحص المنزلي.',
          problematicWords: [],
          comprehensionScore: 0,
          dyscalculiaAssessed: false,
          subitizingAccuracy: null,
          avgSubitizingMs: null,
          numberLinePAE: null,
          transcodingAccuracy: null,
          reversalErrorCount: null,
          dyscalculiaRiskScore: null,
          mathHeuristicIndicator: null,
          mathRiskLevel: 'unassessed',
          mathRiskLabelAr: 'لم تبدأ مهام التقييم بعد.',
          learningReport: {
            learningSummary: `ملف جديد للطفل «${childName}»؛ تظهر المؤشرات فور إكمال أول تمرين أو فحص.`,
            ocularMotorAnalysis: 'غير منطبق؛ منصة هَيَّا نَقْرَأْ لا تعتمد على الكاميرا أو تتبّع العين.',
            orthographicAndPhonologicalPatterns: 'ستظهر الكلمات المستهدفة بعد إتمام أنشطة القراءة.',
            dyscalculiaSpatialAnalysis: 'غير منطبق.',
            interventionExercises: [],
            classroomAccommodations: [],
          },
        };
      }
    }

    if (!pendingLearner) return null;
    pendingLearner.parentAccount = user.id;
    const saved = await syncStudentToSupabase(pendingLearner, user.id);
    if (saved) {
      try {
        localStorage.removeItem('hn_pending_child_registration');
      } catch {}
      return pendingLearner;
    }
    return null;
  };

  useEffect(() => {
    let active = true;
    const hydrateParentSession = (user: any, session: any) => {
      if (!active) return;
      if (user && session?.access_token) {
        setSupabaseUser(user);
        const parentSession: BaseeraSessionInfo = {
          token: session.access_token,
          role: 'parent',
          accountName: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'ولي أمر',
          tenantId: `parent_${user.id.slice(0, 8)}`,
          tenantDisplayNameAr: 'حساب ولي الأمر',
          sessionId: user.id.replace(/-/g, '').slice(0, 32),
          scopes: ['students:read', 'students:write'],
          expiresAt: session.expires_at ? session.expires_at * 1000 : Date.now() + 86400000,
        };
        setBaseeraSession(parentSession);
        storeBaseeraSession(parentSession);
        setShowBaseeraLogin(false);
        void (async () => {
          const existingCloud = await fetchStudentsFromSupabase(user.id);
          let merged = existingCloud;
          if (existingCloud.length === 0) {
            const flushed = await flushPendingChildForUser(user);
            if (flushed) {
              merged = [flushed];
              setAiStatusBanner(`تم تفعيل حسابك وحفظ ملف الطفل «${flushed.name}» في قاعدة البيانات بنجاح ☁️`);
            }
          } else {
            try { localStorage.removeItem('hn_pending_child_registration'); } catch {}
          }
          if (merged.length > 0 && active) {
            // Merge, never replace: the cloud copy may lack a result this device still holds.
            setStudents((prev) => mergeStudentRecords(prev.filter((p) => !p.isDemoRecord), merged));
            const savedActiveId = loadActiveStudentId();
            const preferred = savedActiveId && merged.some((s) => s.id === savedActiveId)
              ? savedActiveId
              : merged[0].id;
            selectStudent(preferred);
          }
        })();
      } else {
        setSupabaseUser(null);
        const currentStored = getStoredBaseeraSession();
        if (currentStored?.role === 'parent') {
          clearBaseeraSession();
          setBaseeraSession(null);
        }
      }
      setSupabaseAuthLoading(false);
    };

    if (isSupabaseConfigured()) {
      void supabase.auth.getSession()
        .then(({ data }) => {
          hydrateParentSession(data.session?.user ?? null, data.session ?? null);
        })
        .catch(() => {
          if (active) setSupabaseAuthLoading(false);
        });
    } else {
      setSupabaseAuthLoading(false);
    }

    const unsubscribe = onSupabaseAuthChange((user, session) => {
      hydrateParentSession(user, session);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleEmailSignIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setSupabaseError('');
    setSupabaseAuthLoading(true);
    try {
      const { user, session } = await signInWithEmail(email, pass);
      if (!user || !session?.access_token) {
        throw new Error('تعذّر تسجيل الدخول. تحقّق من بيانات الدخول وإعدادات الحساب.');
      }

      setSupabaseUser(user);
      const parentSession: BaseeraSessionInfo = {
        token: session.access_token,
        role: 'parent',
        accountName: user.user_metadata?.full_name || user.email || 'ولي أمر',
        tenantId: `parent_${user.id.slice(0, 8)}`,
        tenantDisplayNameAr: 'حساب ولي الأمر',
        sessionId: user.id.replace(/-/g, '').slice(0, 32),
        scopes: ['students:read', 'students:write'],
        expiresAt: (session.expires_at ?? Math.floor(Date.now() / 1000 + 3600)) * 1000,
      };
      setBaseeraSession(parentSession);
      storeBaseeraSession(parentSession);
      setAiStatusBanner('مرحبًا بك! سجّلت الدخول بنجاح.');
      const existingCloud = await fetchStudentsFromSupabase(user.id);
      let cloudStudents = existingCloud;
      if (existingCloud.length === 0) {
        const flushed = await flushPendingChildForUser(user);
        if (flushed) {
          cloudStudents = [flushed];
          setAiStatusBanner(`مرحبًا بك! تم حفظ ملف الطفل «${flushed.name}» في حسابك السحابي بنجاح ☁️`);
        }
      }
      if (cloudStudents.length > 0) {
        setStudents((prev) => mergeStudentRecords(prev.filter((p) => !p.isDemoRecord), cloudStudents));
        selectStudent(cloudStudents[0].id);
      }
      setSupabaseAuthLoading(false);
      return { success: true };
    } catch (err: any) {
      setSupabaseAuthLoading(false);
      const rawMsg = String(err?.message || '');
      const msg = rawMsg.toLowerCase().includes('email not confirmed')
        ? 'يرجى تأكيد بريدك الإلكتروني أولًا عبر رابط التفعيل المُرسل إلى بريدك، ثم أعد تسجيل الدخول.'
        : rawMsg.toLowerCase().includes('invalid login credentials')
        ? 'البريد الإلكتروني أو كلمة المرور غير صحيحين.'
        : rawMsg || 'تعذّر تسجيل الدخول. تأكّد من البريد الإلكتروني وكلمة المرور.';
      setSupabaseError(msg);
      return { success: false, error: msg };
    }
  };

  // Site-wide Dyslexia Accessibility & Comfort Studio state
  const [surfaceTheme, setSurfaceTheme] =
    useState<DyslexiaSurfaceTheme>('cream');
  const [spacingMode, setSpacingMode] =
    useState<DyslexiaSpacingMode>('standard');
  const [readingRulerEnabled, setReadingRulerEnabled] =
    useState<boolean>(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute(
        'data-dyslexia-theme',
        surfaceTheme
      );
      document.documentElement.setAttribute(
        'data-dyslexia-spacing',
        spacingMode
      );
    }
  }, [surfaceTheme, spacingMode]);

  // Load persistent student records from RBAC-protected server when an authenticated session is stored
  useEffect(() => {
    // A parent account reads its children from Supabase; the school roster API answers 401.
    if (!baseeraSession?.token || baseeraSession.role === 'parent') return;
    let cancelled = false;
    authenticatedFetch('/api/students')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.students)) {
          setSchoolRosterEmpty(data.students.length === 0);
          const normalized: StudentRecord[] = data.students.length > 0
            ? data.students.map((s: StudentRecord) => ({ ...s }))
            : INITIAL_STUDENTS;
          setStudents(normalized);
          setSelectedStudentId((prev) =>
            normalized.some((s: StudentRecord) => s.id === prev)
              ? prev
              : normalized[0].id
          );
          setIsPersistedStoreLoaded(true);
        }
      })
      .catch(() => {
        // Fallback to local state if offline
      });
    return () => {
      cancelled = true;
    };
  }, [baseeraSession?.token, baseeraSession?.role]);

  const rawSelectedStudent =
    students.find((s) => s.id === selectedStudentId) || students[0] || INITIAL_STUDENTS[0];

  const selectedStudent: StudentRecord = {
    ...rawSelectedStudent,
    learningReport: rawSelectedStudent?.learningReport && typeof rawSelectedStudent.learningReport === 'object'
      ? {
          learningSummary: rawSelectedStudent.learningReport.learningSummary || 'لم يُجرَ أي تقييم بعد. يظهر هنا ملخص أداء الطفل بعد أول نشاط قراءة أو فحص.',
          ocularMotorAnalysis: rawSelectedStudent.learningReport.ocularMotorAnalysis || 'غير منطبق؛ منصة هَيَّا نَقْرَأْ لا تعتمد على الكاميرا أو تتبّع حركة العين.',
          orthographicAndPhonologicalPatterns: rawSelectedStudent.learningReport.orthographicAndPhonologicalPatterns || 'تظهر الأنماط والكلمات المستهدفة بعد إتمام أنشطة القراءة.',
          dyscalculiaSpatialAnalysis: rawSelectedStudent.learningReport.dyscalculiaSpatialAnalysis || 'غير منطبق.',
          interventionExercises: Array.isArray(rawSelectedStudent.learningReport.interventionExercises)
            ? rawSelectedStudent.learningReport.interventionExercises
            : [],
          classroomAccommodations: Array.isArray(rawSelectedStudent.learningReport.classroomAccommodations)
            ? rawSelectedStudent.learningReport.classroomAccommodations
            : [],
        }
      : {
          learningSummary: 'لم يُجرَ أي تقييم بعد. يظهر هنا ملخص أداء الطفل بعد أول نشاط قراءة أو فحص.',
          ocularMotorAnalysis: 'غير منطبق؛ منصة هَيَّا نَقْرَأْ لا تعتمد على الكاميرا أو تتبّع حركة العين.',
          orthographicAndPhonologicalPatterns: 'تظهر الأنماط والكلمات المستهدفة بعد إتمام أنشطة القراءة.',
          dyscalculiaSpatialAnalysis: 'غير منطبق.',
          interventionExercises: [],
          classroomAccommodations: [],
        },
  };

  const selectedReadingRate = (() => {
    if (!selectedStudent || selectedStudent.sessionStatus !== 'completed') return null;
    if (selectedStudent.assessmentModality === 'voice_only') {
      const oralRate = selectedStudent.wcpm ?? selectedStudent.oralWcpm;
      return hasVerifiedOralAudio(selectedStudent) &&
        typeof oralRate === 'number' &&
        Number.isFinite(oralRate)
        ? oralRate
        : null;
    }
    return typeof selectedStudent.wpm === 'number' && selectedStudent.wpm > 0
      ? selectedStudent.wpm
      : null;
  })();

  const filteredStudents = students.filter((s) => {
    if (hideDemoRecords && s.isDemoRecord) return false;

    const matchesSearch =
      !searchQuery.trim() ||
      s.name.includes(searchQuery.trim()) ||
      s.schoolName.includes(searchQuery.trim());
    if (!matchesSearch) return false;

    // Filter by workflow completion, not by unvalidated diagnostic/risk labels.
    if (sessionFilter === 'completed') return s.sessionStatus === 'completed';
    if (sessionFilter === 'in_progress') return s.sessionStatus !== 'completed';
    return true;
  });

  const snapshotCompletedSession = (record: StudentRecord) => {
    const verifiedAudio = hasVerifiedOralAudio(record);
    return {
      sessionId: `session-${record.id}-${Date.now()}`,
      completedAt: record.sessionCompletedAt || (Number.isFinite(Date.parse(record.lastScreenedDate)) ? new Date(record.lastScreenedDate).toISOString() : 'unknown'),
      passageId: record.passageId,
      assessmentModality: record.assessmentModality === 'voice_only' || record.oralReadingAssessed === true ? 'voice_only' : 'reading_only',
      wcpm: verifiedAudio ? (record.wcpm ?? record.oralWcpm ?? null) : null,
      aiAssessmentVerified: verifiedAudio,
      evidenceProvenance: verifiedAudio ? 'server-verified-audio' as const : 'client-reported' as const,
      teacherVerified: false,
      wpm: record.wpm,
      comprehensionScore: record.comprehensionScore,
      problematicWords: verifiedAudio ? [...(record.problematicWords || [])] : [],
      dyslexiaRiskScore: record.dyslexiaRiskScore,
      readingHeuristicIndicator: record.readingHeuristicIndicator,
      readingRiskLevel: record.readingRiskLevel,
      subitizingAccuracy: record.subitizingAccuracy,
      numberLinePAE: record.numberLinePAE,
      transcodingAccuracy: record.transcodingAccuracy,
      dyscalculiaRiskScore: record.dyscalculiaRiskScore,
      mathRiskLevel: record.mathRiskLevel,
    } as StudentAssessmentSnapshot;
  };

  // Only raw evidence & consent fields are sent to the server; scores and reports are derived server-side.
  const sessionPayloadFromRecord = (record: StudentRecord) => {
    const verifiedAudio = hasVerifiedOralAudio(record);
    return {
      sessionRoleLabel: record.sessionRoleLabel,
      passageId: record.passageId,
      dialectCode: record.dialectCode || record.dialect || 'msa',
      dialectRegionAr: record.dialectRegionAr,
      assessmentModality: record.assessmentModality === 'voice_only' || record.oralReadingAssessed === true ? 'voice_only' : 'reading_only',
      ...(typeof record.readingDurationSeconds === 'number' && Number.isFinite(record.readingDurationSeconds)
        ? { readingDurationSeconds: record.readingDurationSeconds }
        : {}),
      oralReadingAssessed: verifiedAudio,
      spokenTranscript: verifiedAudio ? record.spokenTranscript : '',
      wcpm: verifiedAudio ? (record.wcpm ?? record.oralWcpm ?? null) : null,
      oralWcpm: verifiedAudio ? (record.oralWcpm ?? record.wcpm ?? null) : null,
      oralAccuracyPercent: verifiedAudio ? (record.oralAccuracyPercent ?? null) : null,
      teacherVerified: false,
      ...(verifiedAudio && typeof record.aiAssessmentReceipt === 'string'
        ? { aiAssessmentReceipt: record.aiAssessmentReceipt }
        : {}),
      verifiedWordsAlignment: verifiedAudio ? record.verifiedWordsAlignment : undefined,
      phoneticSubstitutionCount: verifiedAudio ? record.phoneticSubstitutionCount : undefined,
      dialectVariantCount: verifiedAudio ? record.dialectVariantCount : undefined,
      omissionCount: verifiedAudio ? record.omissionCount : undefined,
      ...(record.comprehensionAnswers
        ? { comprehensionAnswers: record.comprehensionAnswers }
        : {}),
      dyscalculiaAssessed: record.dyscalculiaAssessed,
      ...(record.mathTrials ? { mathTrials: record.mathTrials } : {}),
      guardianConsentGiven: record.guardianConsentGiven === true,
      guardianConsentRecordedAt: record.guardianConsentRecordedAt,
      guardianConsentSource: record.guardianConsentSource,
      guardianAudioConsentGiven: record.guardianAudioConsentGiven === true,
      guardianAudioConsentRecordedAt: record.guardianAudioConsentRecordedAt,
      speechRecognitionUsed: verifiedAudio && record.speechRecognitionUsed === true,
      audioRecordingStarted: record.audioRecordingStarted === true,
    };
  };

  const studentCreatePayloadFromRecord = (record: StudentRecord) => ({
    id: record.id,
    name: record.name,
    gradeLevel: record.gradeLevel,
    ageYears: record.ageYears,
    schoolName: record.schoolName,
    sessionStatus: record.sessionStatus || 'completed',
    ...sessionPayloadFromRecord(record),
  });

  const handleCompleteNewSession = async (newRecord: StudentRecord) => {
    const previous = students.find((student) => student.id === newRecord.id);
    const history = [...(previous?.assessmentHistory || [])];
    if (previous?.sessionStatus === 'completed') {
      history.push(snapshotCompletedSession(previous));
    }
    const consentRecordedAt =
      newRecord.guardianConsentGiven === true
        ? newRecord.guardianConsentRecordedAt
        : undefined;
    const completedAt = new Date().toISOString();
    const completedRecord: StudentRecord = {
      ...newRecord,
      sessionStatus: 'completed',
      sessionCompletedAt: completedAt,
      assessmentHistory: history,
      lastScreenedDate: new Date().toLocaleString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      guardianConsentRecordedAt: consentRecordedAt,
      guardianConsentSource:
        newRecord.guardianConsentGiven === true
          ? newRecord.guardianConsentSource
          : undefined,
      policyVersion: newRecord.policyVersion || '2026.1',
    };
    setStudents((prev) => [
      completedRecord,
      ...prev.filter((student) => student.id !== completedRecord.id),
    ]);
    setSelectedStudentId(completedRecord.id);
    setActiveTab('dashboard');
    setDashboardSubView('report');

    const hasVoiceEvidence =
      completedRecord.assessmentModality === 'voice_only' ||
      completedRecord.audioRecordingStarted === true ||
      completedRecord.speechRecognitionUsed === true ||
      Boolean(completedRecord.aiAssessmentReceipt);

    // Family oral-reading sessions must pass through the server receipt validator.
    // Never write Azure-derived fields directly from the browser into Supabase raw_data.
    if (supabaseUser && !baseeraSession && hasVoiceEvidence) {
      setAiStatusBanner('جارٍ التحقق من التقييم الصوتي قبل حفظ جلسة القراءة في حساب الأسرة…');
      void authenticatedFetch(
        `/api/parent/students/${encodeURIComponent(completedRecord.id)}/reading-session`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionPayloadFromRecord(completedRecord)),
        }
      ).then(async (response) => {
        const payload = await response.json().catch(() => null) as
          | { student?: StudentRecord; error?: string }
          | null;
        if (!response.ok || !payload?.student) {
          throw new Error(payload?.error || `family reading save failed: ${response.status}`);
        }
        setStudents((prev) => prev.map((student) =>
          student.id === completedRecord.id ? { ...student, ...payload.student! } : student
        ));
        setAiStatusBanner('حُفظت جلسة القراءة في حساب الأسرة بعد التحقق من الموافقة ومن التقييم الصوتي.');
      }).catch(() => {
        setAiStatusBanner('تعذّر التحقق من جلسة القراءة الصوتية أو حفظها بأمان؛ بقيت النتيجة على هذا الجهاز ولم تُحفظ في الحساب.');
      });
      return;
    }

    if (supabaseUser && !baseeraSession) {
      void syncStudentToSupabase(completedRecord, supabaseUser.id).catch(() => {
        setAiStatusBanner('تعذر حفظ جلسة القراءة الصامتة في حساب الأسرة؛ بقيت على هذا الجهاز.');
      });
      return;
    }

    if (!baseeraSession) {
      setPendingServerRecord(completedRecord);
      setAiStatusBanner('اكتملت الجلسة على هذا الجهاز فقط؛ لم تُحفظ في الخادم. سجّل الدخول لحفظها بأمان في سجل المدرسة.');
      setShowBaseeraLogin(true);
      return;
    }
    if (baseeraSession.role !== 'school_admin') {
      setAiStatusBanner('هذا الحساب للقراءة فقط؛ اكتملت النتيجة محليًا ولم تُحفظ في سجل المدرسة. استخدم رمز أخصائي مخوّل للحفظ.');
      return;
    }
    setAiStatusBanner(
      `انتهت جلسة الفحص للطالب (${completedRecord.name}) على هذا الجهاز؛ جارٍ حفظها في الخادم.`
    );
    try {
      const sendSave = (url: string, body: unknown) => authenticatedFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const createPayload = studentCreatePayloadFromRecord(completedRecord);
      let response = previous && !previous.isDemoRecord
        ? await sendSave(`/api/students/${encodeURIComponent(completedRecord.id)}/sessions`, sessionPayloadFromRecord(completedRecord))
        : await sendSave('/api/students', createPayload);
      // A local, not-yet-persisted record has no server session route; only then attempt create.
      if (response.status === 404 && previous && !previous.isDemoRecord) {
        response = await sendSave('/api/students', createPayload);
      }
      if (response.ok) {
        const saved = await response.json().catch(() => ({}));
        if (saved?.student) {
          setStudents((prev) => prev.map((student) =>
            student.id === saved.student.id && !student.isDemoRecord ? saved.student : student
          ));
        }
        setIsPersistedStoreLoaded(true);
        setAiStatusBanner(`تم حفظ جلسة الفحص للطالب (${completedRecord.name}) في سجل المدرسة المحمي.`);
      } else {
        const data = await response.json().catch(() => ({}));
        setPendingServerRecord(completedRecord);
        setAiStatusBanner(data?.error || 'لم يُحفظ السجل في الخادم. بقيت نسخة محلية لإعادة المحاولة بعد تسجيل الدخول.');
        if (response.status === 401) {
          clearBaseeraSession();
          setBaseeraSession(null);
          setShowBaseeraLogin(true);
        }
      }
    } catch {
      setPendingServerRecord(completedRecord);
      setAiStatusBanner('تعذر الاتصال بالخادم؛ السجل موجود على هذا الجهاز فقط ولم يُحفظ في الخادم.');
    }
  };

  /** Battery setup on a demo record creates a real learner so results never mix with demo data. */
  const handleCreateBatteryLearner = (input: { name: string; ageYears: number; examinerName: string; dialectCode?: string; guardianConsentRecordedAt?: string; guardianAudioConsentGiven?: boolean; guardianAudioConsentRecordedAt?: string }): string | null => {
    if (!supabaseUser && !baseeraSession) return null;
    if (baseeraSession?.role === 'educator_readonly') return null;
    const cleanName = input.name.trim().replace(/\s+/g, ' ');
    if (cleanName.length < 2) return null;
    const recordedAt = input.guardianConsentRecordedAt || new Date().toISOString();
    const selectedDialect = normalizeHomeDialect(input.dialectCode, 'غير محددة');
    const learner: StudentRecord = {
      id: `stu-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)}`,
      name: cleanName,
      isDemoRecord: false,
      parentAccount: supabaseUser ? supabaseUser.id : undefined,
      sessionStatus: 'in_progress',
      sessionRoleLabel: 'فحص معرفي',
      assessmentHistory: [],
      cognitiveBattery: null,
      trainingProgress: null,
      gradeLevel: Math.max(0, input.ageYears - 6),
      ageYears: input.ageYears,
      country: 'غير محددة',
      dialect: selectedDialect,
      dialectCode: selectedDialect,
      schoolName: supabaseUser
        ? `حساب ولي الأمر (${supabaseUser.user_metadata?.full_name || supabaseUser.email || 'الأسرة'})`
        : 'على هذا الجهاز (محلي)',
      lastScreenedDate: '—',
      passageId: ARABIC_READING_PASSAGES[0].id,
      guardianConsentGiven: true,
      guardianConsentRecordedAt: recordedAt,
      guardianConsentSource: `إقرار ذاتي من مستخدم شاشة الفحص (${input.examinerName.trim() || 'غير محدد'})؛ لم تتحقق المنصة من هوية ولي الأمر أو صحة التفويض`,
      guardianAudioConsentGiven: input.guardianAudioConsentGiven === true && typeof input.guardianAudioConsentRecordedAt === 'string' && Number.isFinite(Date.parse(input.guardianAudioConsentRecordedAt)),
      ...(input.guardianAudioConsentGiven === true && input.guardianAudioConsentRecordedAt ? { guardianAudioConsentRecordedAt: input.guardianAudioConsentRecordedAt } : {}),
      speechRecognitionUsed: false,
      wpm: 0,
      dyslexiaRiskScore: null,
      readingHeuristicIndicator: null,
      readingRiskLevel: 'unassessed',
      readingRiskLabelAr: 'لم تبدأ جلسة القراءة بعد.',
      problematicWords: [],
      comprehensionScore: 0,
      dyscalculiaAssessed: false,
      subitizingAccuracy: null,
      avgSubitizingMs: null,
      numberLinePAE: null,
      transcodingAccuracy: null,
      reversalErrorCount: null,
      dyscalculiaRiskScore: null,
      mathHeuristicIndicator: null,
      mathRiskLevel: 'unassessed',
      mathRiskLabelAr: 'لم تبدأ مهام التقييم بعد.',
      learningReport: {
        learningSummary: 'سجل جديد؛ تظهر الملاحظات بعد إكمال أول نشاط.',
        ocularMotorAnalysis: 'غير منطبق؛ لا تستخدم منصة هَيَّا نَقْرَأْ الكاميرا أو تتبّع العين.',
        orthographicAndPhonologicalPatterns: 'تظهر بعد إكمال الفحص أو القراءة.',
        dyscalculiaSpatialAnalysis: 'غير منطبق.',
        interventionExercises: [],
        classroomAccommodations: [],
      },
    };
    setStudents((prev) => [learner, ...prev]);
    setSelectedStudentId(learner.id);
    if (supabaseUser) {
      void syncStudentToSupabase(learner, supabaseUser.id);
    } else if (baseeraSession?.role === 'school_admin') {
      // The server will not send child audio to Azure until this learner exists
      // in the same tenant with a recorded guardian-consent timestamp.
      void authenticatedFetch('/api/students/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: learner.id,
          name: learner.name,
          gradeLevel: learner.gradeLevel,
          ageYears: learner.ageYears,
          schoolName: learner.schoolName,
          guardianConsentGiven: true,
          guardianConsentRecordedAt: learner.guardianConsentRecordedAt,
          guardianConsentSource: learner.guardianConsentSource,
          guardianAudioConsentGiven: learner.guardianAudioConsentGiven === true,
          ...(learner.guardianAudioConsentGiven === true && learner.guardianAudioConsentRecordedAt ? { guardianAudioConsentRecordedAt: learner.guardianAudioConsentRecordedAt } : {}),
        }),
      }).then(async (response) => {
        if (!response.ok) {
          setAiStatusBanner('تعذر إنشاء ملف الطفل في سجل المدرسة؛ لن يُرسل صوته للتقييم قبل حفظ السجل والموافقة.');
        }
      }).catch(() => {
        setAiStatusBanner('تعذر الاتصال بسجل المدرسة؛ سيبقى التقييم الصوتي غير متاح حتى حفظ ملف الطفل.');
      });
    }
    return learner.id;
  };

  /** Parent portal child registration handler (no guest mode — requires authenticated parent account) */
  const handleRegisterChildByParent = async (child: {
    name: string;
    ageYears: number;
    gradeLevel: number;
    country?: string;
    dialectCode?: 'msa' | 'gulf' | 'egyptian' | 'levantine' | 'maghrebi' | string;
    audioConsentGiven?: boolean;
    notes?: string;
    parentEmail?: string;
    parentPassword?: string;
  }): Promise<string | null> => {
    if (!Number.isInteger(child.ageYears) || child.ageYears < 4 || child.ageYears > 13) {
      throw new Error('اختر عمر الطفل من ٤ سنوات حتى +٨ سنوات.');
    }
    if (!Number.isInteger(child.gradeLevel) || child.gradeLevel < 0 || child.gradeLevel > 7) {
      throw new Error('اختر المرحلة الدراسية من الروضة حتى الصف الأول المتوسط.');
    }
    const selectedCountry = (child.country || '').trim();
    if (!selectedCountry) {
      throw new Error('يرجى اختيار دولة الطفل.');
    }
    if (child.audioConsentGiven !== true) {
      throw new Error('يجب الموافقة على تسجيل صوت الطفل لتحليل قراءته وتخصيص خطة التدريب.');
    }

    let currentUser = supabaseUser;
    let activeSession: any = null;

    // Enforce authenticated account: guest mode is disabled.
    if (!currentUser) {
      const cleanEmail = (child.parentEmail || '').trim().toLowerCase();
      const pass = child.parentPassword || '';
      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.') || pass.length < 6) {
        throw new Error('يجب إدخال بريد إلكتروني صحيح وكلمة مرور (٦ خانات على الأقل) لحساب ولي الأمر.');
      }
    }

    const recordedAt = new Date().toISOString();
    const newLearnerId = `stu-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;
    const selectedDialect = 'msa' as const;

    const pendingChildMeta = {
      id: newLearnerId,
      name: child.name.trim(),
      ageYears: child.ageYears,
      gradeLevel: child.gradeLevel,
      country: selectedCountry,
      notes: (child.notes || '').trim(),
      audioConsentGiven: child.audioConsentGiven === true,
      guardianConsentRecordedAt: recordedAt,
    };

    // Cloud sign-up / sign-in when parent is not yet signed in
    if (!currentUser && child.parentEmail && child.parentPassword) {
      try {
        const res = await signUpWithEmail(
          child.parentEmail,
          child.parentPassword,
          undefined,
          { pending_child: pendingChildMeta }
        );
        if (res.user) {
          currentUser = res.user;
          activeSession = res.session;
          if (res.session?.access_token) {
            setSupabaseUser(res.user);
            const parentSession: BaseeraSessionInfo = {
              token: res.session.access_token,
              role: 'parent',
              accountName: res.user.user_metadata?.full_name || res.user.email || 'ولي أمر',
              tenantId: `parent_${res.user.id.slice(0, 8)}`,
              tenantDisplayNameAr: 'حساب ولي الأمر',
              sessionId: res.user.id.replace(/-/g, '').slice(0, 32),
              scopes: ['students:read', 'students:write'],
              expiresAt: (res.session.expires_at ?? Math.floor(Date.now() / 1000 + 3600)) * 1000,
            };
            setBaseeraSession(parentSession);
            storeBaseeraSession(parentSession);
          }
        }
      } catch (signUpErr: any) {
        try {
          const res = await signInWithEmail(child.parentEmail, child.parentPassword);
          if (res.user && res.session?.access_token) {
            currentUser = res.user;
            activeSession = res.session;
            setSupabaseUser(res.user);
            const parentSession: BaseeraSessionInfo = {
              token: res.session.access_token,
              role: 'parent',
              accountName: res.user.user_metadata?.full_name || res.user.email || 'ولي أمر',
              tenantId: `parent_${res.user.id.slice(0, 8)}`,
              tenantDisplayNameAr: 'حساب ولي الأمر',
              sessionId: res.user.id.replace(/-/g, '').slice(0, 32),
              scopes: ['students:read', 'students:write'],
              expiresAt: (res.session.expires_at ?? Math.floor(Date.now() / 1000 + 3600)) * 1000,
            };
            setBaseeraSession(parentSession);
            storeBaseeraSession(parentSession);
          }
        } catch (authErr: any) {
          const rawMsg = String(authErr?.message || signUpErr?.message || '');
          if (rawMsg.toLowerCase().includes('email not confirmed')) {
            throw new Error('هذا البريد مسجل بالفعل لكنه بانتظار التفعيل. افتح رابط التفعيل في بريدك الإلكتروني ثم سجّل الدخول.');
          }
          if (rawMsg.toLowerCase().includes('invalid login credentials') || rawMsg.toLowerCase().includes('already registered')) {
            throw new Error('هذا البريد الإلكتروني مسجل بالفعل؛ أدخل كلمة المرور الصحيحة أو سجّل الدخول من تبويب «دخول ولي أمر مسجل».');
          }
          throw new Error(`تعذّر إنشاء حساب الأسرة أو تسجيل الدخول إليه: ${rawMsg || 'تعذر الاتصال بخدمة المصادقة السحابية'}`);
        }
      }
    }

    if (!currentUser) {
      throw new Error('تعذّر التحقق من حساب ولي الأمر. يرجى تسجيل الدخول والمحاولة مرة أخرى.');
    }

    const newLearner: StudentRecord = {
      id: newLearnerId,
      name: child.name.trim(),
      parentAccount: currentUser.id,
      isDemoRecord: false,
      sessionStatus: 'in_progress',
      sessionRoleLabel: 'ولي الأمر / فحص منزلي',
      assessmentHistory: [],
      cognitiveBattery: null,
      trainingProgress: null,
      gradeLevel: child.gradeLevel,
      ageYears: child.ageYears,
      country: selectedCountry,
      dialectCode: selectedDialect,
      dialect: selectedDialect,
      schoolName: `حساب ولي الأمر (${currentUser.user_metadata?.full_name || currentUser.email || 'الأسرة'})`,
      lastScreenedDate: '—',
      passageId: ARABIC_READING_PASSAGES[0].id,
      guardianConsentGiven: true,
      guardianConsentRecordedAt: recordedAt,
      guardianConsentSource: `إقرار ذاتي من مستخدم بوابة الأسرة (${recordedAt.split('T')[0]})${child.audioConsentGiven === true ? ' مع موافقة صوتية منفصلة' : ''}`,
      guardianAudioConsentGiven: child.audioConsentGiven === true,
      ...(child.audioConsentGiven === true ? { guardianAudioConsentRecordedAt: recordedAt } : {}),
      parentNotes: (child.notes || '').trim() || undefined,
      speechRecognitionUsed: false,
      wpm: 0,
      dyslexiaRiskScore: null,
      readingHeuristicIndicator: null,
      readingRiskLevel: 'unassessed',
      readingRiskLabelAr: 'جاهز لبدء الفحص المنزلي.',
      problematicWords: [],
      comprehensionScore: 0,
      dyscalculiaAssessed: false,
      subitizingAccuracy: null,
      avgSubitizingMs: null,
      numberLinePAE: null,
      transcodingAccuracy: null,
      reversalErrorCount: null,
      dyscalculiaRiskScore: null,
      mathHeuristicIndicator: null,
      mathRiskLevel: 'unassessed',
      mathRiskLabelAr: 'لم تبدأ مهام التقييم بعد.',
      learningReport: {
        learningSummary: `ملف جديد للطفل «${child.name.trim()}»؛ تظهر المؤشرات فور إكمال أول تمرين أو فحص.`,
        ocularMotorAnalysis: 'غير منطبق؛ منصة هَيَّا نَقْرَأْ لا تعتمد على الكاميرا أو تتبّع العين.',
        orthographicAndPhonologicalPatterns: 'ستظهر الكلمات المستهدفة بعد إتمام أنشطة القراءة.',
        dyscalculiaSpatialAnalysis: 'غير منطبق.',
        interventionExercises: [],
        classroomAccommodations: [],
      },
    };

    // If Supabase Auth requires email confirmation (mailer_autoconfirm = false), signUp returns
    // user without an active JWT session yet. Save the child record in pending storage + user_metadata
    // so it auto-writes to public.students the moment the parent confirms their email and logs in.
    if (!supabaseUser && !activeSession) {
      try {
        localStorage.setItem(
          'hn_pending_child_registration',
          JSON.stringify({ userId: currentUser.id, student: newLearner })
        );
      } catch {}
      return 'PENDING_EMAIL_CONFIRMATION';
    }

    // Pre-create battery session respecting explicit audio consent for Standard Arabic
    const speechLocale = pronunciationLocaleForDialect(selectedDialect);
    const explicitAudioConsent = child.audioConsentGiven === true;
    const initialBatterySession: BatterySession = {
      studentId: newLearner.id,
      childName: newLearner.name,
      ageMonths: Math.min(96, newLearner.ageYears * 12),
      examinerName: newLearner.sessionRoleLabel || 'ولي الأمر',
      startedAt: recordedAt,
      dialect: selectedDialect,
      guardianConsentGiven: true,
      guardianConsentRecordedAt: recordedAt,
      guardianAudioConsentGiven: explicitAudioConsent,
      ...(explicitAudioConsent ? { guardianAudioConsentRecordedAt: recordedAt } : {}),
      ...(speechLocale ? { speechLocale } : {}),
      results: {},
    };
    void saveBatterySession(initialBatterySession).catch((error) => console.error('Unable to persist encrypted battery session:', error));

    const saved = await syncStudentToSupabase(newLearner, currentUser.id);
    if (!saved) {
      const reason = getLastSupabaseSyncError();
      if (reason === 'SESSION_PENDING_EMAIL_CONFIRMATION') {
        try {
          localStorage.setItem(
            'hn_pending_child_registration',
            JSON.stringify({ userId: currentUser.id, student: newLearner })
          );
        } catch {}
        return 'PENDING_EMAIL_CONFIRMATION';
      }
      throw new Error(`تعذّر حفظ ملف الطفل في قاعدة البيانات (${reason || 'خطأ غير متوقع'}). أعد المحاولة.`);
    }
    setAiStatusBanner(`حُفظ ملف الطفل «${newLearner.name}» في حسابك السحابي بنجاح ☁️`);

    setStudents((prev) => {
      const next = [newLearner, ...prev.filter((s) => s.id !== newLearner.id)];
      void saveStoredStudents(next).catch((error) => console.error('Encrypted child save failed:', error));
      return next;
    });
    selectStudent(newLearner.id);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    return newLearner.id;
  };

  /** Link a locally created child (from guest screening) to a newly created or existing Supabase account */
  const handleLinkLocalChild = async (
    childId: string,
    email: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, error: 'يرجى إدخال بريد إلكتروني صحيح.' };
    }
    if (pass.length < 6) {
      return { success: false, error: 'يجب ألّا تقل كلمة المرور عن ٦ خانات.' };
    }

    setSupabaseAuthLoading(true);
    let currentUser: any = null;
    let authSession: any = null;

    try {
      const res = await signUpWithEmail(cleanEmail, pass);
      currentUser = res.user;
      authSession = res.session;
    } catch (signUpErr: any) {
      try {
        const res = await signInWithEmail(cleanEmail, pass);
        currentUser = res.user;
        authSession = res.session;
      } catch (signInErr: any) {
        setSupabaseAuthLoading(false);
        return {
          success: false,
          error: signUpErr?.message || signInErr?.message || 'تعذر إنشاء الحساب أو تسجيل الدخول.',
        };
      }
    }

    if (!currentUser) {
      setSupabaseAuthLoading(false);
      return { success: false, error: 'تعذّر التحقق من الحساب. راجع البريد الإلكتروني وكلمة المرور.' };
    }

    setSupabaseUser(currentUser);
    const parentSession: BaseeraSessionInfo = {
      token: authSession?.access_token || `session-${currentUser.id}`,
      role: 'parent',
      accountName: currentUser.user_metadata?.full_name || currentUser.email || 'ولي أمر',
      tenantId: `parent_${currentUser.id.slice(0, 8)}`,
      tenantDisplayNameAr: 'حساب ولي الأمر',
      sessionId: currentUser.id.replace(/-/g, '').slice(0, 32),
      scopes: ['students:read', 'students:write'],
      expiresAt: (authSession?.expires_at ?? Math.floor(Date.now() / 1000 + 3600)) * 1000,
    };
    setBaseeraSession(parentSession);
    storeBaseeraSession(parentSession);

    // Find student, attach parentAccount and sync to Supabase
    const targetStudent = students.find((s) => s.id === childId);
    if (targetStudent) {
      const updatedStudent: StudentRecord = {
        ...targetStudent,
        parentAccount: currentUser.id,
        schoolName: `حساب ولي الأمر (${currentUser.user_metadata?.full_name || currentUser.email || 'الأسرة'})`,
      };
      setStudents((prev) => prev.map((s) => (s.id === childId ? updatedStudent : s)));
      selectStudent(childId);
      const saved = await syncStudentToSupabase(updatedStudent, currentUser.id);
      if (saved && updatedStudent.trainingProgress) {
        await syncTrainingProgressToSupabase(updatedStudent, currentUser.id);
      }
    }

    // Load any existing cloud students
    const cloudStudents = await fetchStudentsFromSupabase(currentUser.id);
    if (cloudStudents.length > 0) {
      const mapped = cloudStudents.map((cs) => ({
        ...cs,
        parentAccount: cs.parentAccount || currentUser.id,
      }));
      setStudents((prev) => mergeStudentRecords(prev, mapped));
    }

    setSupabaseAuthLoading(false);
    setAiStatusBanner(`رُبط ملف طفلك بحسابك وحُفظت بياناته بنجاح ☁️`);
    return { success: true };
  };

  const handleSelectExistingDemoJourney = (
    studentId: string,
    targetTab: ActiveTab
  ) => {
    const stu = students.find((s) => s.id === studentId) || students[0];
    setSelectedStudentId(stu.id);
    setActiveTab(targetTab);
    setAiStatusBanner('');
  };

  const handleUpdateStudentMath = async (
    studentId: string,
    updated: Partial<StudentRecord>
  ) => {
    if (!baseeraSession || baseeraSession.role !== 'school_admin') {
      setStudents((prev) =>
        prev.map((student) =>
          student.id === studentId ? { ...student, ...updated } : student
        )
      );
      setAiStatusBanner(baseeraSession
        ? 'رمزك للقراءة فقط؛ حُفظت النتيجة محليًا فقط ولم تُحفظ في الخادم.'
        : 'حُفظت نتيجة الحساب محليًا؛ سجّل الدخول لحفظ تحديثات سجل الطالب في الخادم.');
      if (!baseeraSession) setShowBaseeraLogin(true);
      return;
    }
    try {
      const response = updated.mathTrials
        ? await authenticatedFetch(
            `/api/students/${encodeURIComponent(studentId)}/math`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mathTrials: updated.mathTrials }),
            }
          )
        : await authenticatedFetch(
            `/api/students/${encodeURIComponent(studentId)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...(updated.name ? { name: updated.name } : {}),
                ...(updated.schoolName ? { schoolName: updated.schoolName } : {}),
                ...(typeof updated.gradeLevel === 'number'
                  ? { gradeLevel: updated.gradeLevel }
                  : {}),
                ...(typeof updated.ageYears === 'number'
                  ? { ageYears: updated.ageYears }
                  : {}),
              }),
            }
          );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setAiStatusBanner(data?.error || 'لم يُحفظ تحديث السجل في الخادم.');
        return;
      }
      const savedData = await response.json().catch(() => ({}));
      setStudents((prev) =>
        prev.map((student) =>
          student.id === studentId
            ? savedData?.student
              ? { ...student, ...savedData.student }
              : { ...student, ...updated }
            : student
        )
      );
      setAiStatusBanner('حُفظ تحديث السجل في سجل المدرسة المحمي.');
    } catch {
      setAiStatusBanner('تعذر الاتصال بالخادم؛ لم يتم حفظ تحديث السجل.');
    }
  };

  /**
   * A parent deletes their child's file: from their cloud account (with the child's screenings,
   * readings and training, by cascade) and from this device. Nothing is kept for later.
   */
  const handleDeleteChildByParent = async (studentId: string): Promise<{ success: boolean; error?: string }> => {
    const target = students.find((student) => student.id === studentId);
    if (!target || target.isDemoRecord) return { success: false, error: 'لا يمكن حذف هذا الملف.' };
    if (supabaseUser?.id && target.parentAccount) {
      const ok = await deleteStudentFromSupabase(studentId, supabaseUser.id);
      if (!ok) return { success: false, error: 'تعذّر حذف ملف الطفل من حسابك. تحقّق من اتصال الإنترنت وأعد المحاولة.' };
    }
    try {
      await clearAllChildData(studentId);
    } catch (error) {
      console.error('Unable to clear the deleted child data on this device:', error);
    }
    const remaining = students.filter((student) => student.id !== studentId);
    setStudents(remaining.length > 0 ? remaining : INITIAL_STUDENTS);
    if (selectedStudentId === studentId) selectStudent((remaining[0] ?? INITIAL_STUDENTS[0]).id);
    setAiStatusBanner(`حُذف ملف «${target.name}» وكل نتائجه نهائيًا.`);
    return { success: true };
  };

  const handleDeleteStudentRecord = async (studentId: string) => {
    if (!baseeraSession || baseeraSession.role !== 'school_admin') {
      setAiStatusBanner(baseeraSession
        ? 'رمزك للقراءة فقط؛ لا يمكن حذف سجلات الطلاب.'
        : 'يلزم تسجيل الدخول قبل حذف سجل من الخادم.');
      if (!baseeraSession) setShowBaseeraLogin(true);
      return;
    }
    if (students.length <= 1) return;
    const target = students.find((student) => student.id === studentId);
    try {
      const response = await authenticatedFetch(
        `/api/students/${encodeURIComponent(studentId)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setAiStatusBanner(data?.error || 'لم يتم حذف السجل من الخادم.');
        return;
      }
      void clearLiteracyPracticeProgress(studentId).catch((error) => console.error('Unable to clear deleted child literacy practice history:', error));
      const remaining = students.filter((student) => student.id !== studentId);
      setStudents(remaining);
      if (selectedStudentId === studentId && remaining.length > 0) {
        setSelectedStudentId(remaining[0].id);
      }
      setAiStatusBanner(
        `تم حذف سجل الطالب (${target?.name || studentId}) من سجل المدرسة المحمي.`
      );
    } catch {
      setAiStatusBanner('تعذر الاتصال بالخادم؛ لم يتم حذف السجل.');
    }
  };

  const handleRefreshLearningReport = async () => {
    if (!baseeraSession || baseeraSession.role !== 'school_admin') {
      setAiStatusBanner(baseeraSession
        ? 'رمزك للقراءة فقط ولا يتيح إنشاء تقارير على الخادم.'
        : 'يلزم تسجيل دخول أخصائي لإنشاء التقارير من الخادم.');
      if (!baseeraSession) setShowBaseeraLogin(true);
      return;
    }
    if (
      selectedStudent.guardianConsentGiven !== true ||
      !selectedStudent.guardianConsentRecordedAt ||
      !selectedStudent.guardianConsentSource
    ) {
      setAiStatusBanner('لا يمكن إنشاء التقرير قبل وجود موافقة صريحة مسجلة بوقت ومصدر. أعد أخذ الموافقة داخل جلسة جديدة.');
      return;
    }
    setIsGeneratingAI(true);
    setAiStatusBanner('');
    try {
      const res = await authenticatedFetch('/api/ai/analyze-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: selectedStudent.name,
          assessmentModality: selectedStudent.assessmentModality === 'voice_only' || selectedStudent.oralReadingAssessed === true ? 'voice_only' : 'reading_only',
          guardianConsentGiven: selectedStudent.guardianConsentGiven === true,
          guardianConsentRecordedAt: selectedStudent.guardianConsentRecordedAt,
          guardianConsentSource: selectedStudent.guardianConsentSource,
          guardianAudioConsentGiven: selectedStudent.guardianAudioConsentGiven === true,
          guardianAudioConsentRecordedAt: selectedStudent.guardianAudioConsentRecordedAt,
          speechRecognitionUsed: hasVerifiedOralAudio(selectedStudent) && selectedStudent.speechRecognitionUsed === true,
          gradeLevel: selectedStudent.gradeLevel,
          wpm: selectedStudent.wpm,
          comprehensionScore: selectedStudent.comprehensionScore,
          problematicWords: hasVerifiedOralAudio(selectedStudent) ? selectedStudent.problematicWords : [],
          numberLinePAE: selectedStudent.numberLinePAE,
          subitizingAccuracy: selectedStudent.subitizingAccuracy,
          reversalErrorCount: selectedStudent.reversalErrorCount,
          dyscalculiaAssessed: selectedStudent.dyscalculiaAssessed === true,
          oralReadingAssessed: hasVerifiedOralAudio(selectedStudent),
          oralAccuracyPercent: hasVerifiedOralAudio(selectedStudent) ? selectedStudent.oralAccuracyPercent : null,
          oralWcpm: hasVerifiedOralAudio(selectedStudent) ? selectedStudent.oralWcpm : null,
          phoneticSubstitutionCount: hasVerifiedOralAudio(selectedStudent) ? selectedStudent.phoneticSubstitutionCount : 0,
          dialectVariantCount: hasVerifiedOralAudio(selectedStudent) ? selectedStudent.dialectVariantCount : 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.report) {
          if (!selectedStudent.isDemoRecord) {
            const persistRes = await authenticatedFetch(
              `/api/students/${encodeURIComponent(selectedStudent.id)}/learning-report`,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ learningReport: data.report }),
              }
            );
            if (!persistRes.ok) {
              const errData = await persistRes.json().catch(() => ({}));
              setAiStatusBanner(
                errData?.error ||
                  'أُنشئ الملخص الوصفي، لكن تعذر حفظه في سجل الطالب على الخادم.'
              );
              return;
            }
            const persisted = await persistRes.json().catch(() => ({}));
            setStudents((prev) =>
              prev.map((s) =>
                s.id === selectedStudent.id
                  ? persisted?.student
                    ? { ...s, ...persisted.student }
                    : { ...s, learningReport: data.report }
                  : s
              )
            );
          } else {
            setStudents((prev) =>
              prev.map((s) =>
                s.id === selectedStudent.id
                  ? { ...s, learningReport: data.report }
                  : s
              )
            );
          }
          setAiStatusBanner(
            `تم تحديث وحفظ الملخص الوصفي وخطة المساندة للطالب (${selectedStudent.name}).`
          );
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setAiStatusBanner(data?.error || 'تعذر إصدار التقرير؛ تحقق من اكتمال بيانات الجلسة والموافقة المطلوبة.');
      }
    } catch {
      setAiStatusBanner('تعذر الاتصال بالخادم؛ لم يتم تأكيد إصدار التقرير.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleBaseeraLogin = async () => {
    setBaseeraLoginError('');
    setIsBaseeraLoggingIn(true);
    try {
      const session = await loginBaseeraSession(
        baseeraAccessCode.trim(),
        'school_admin',
        'مسؤول المدرسة'
      );
      if (!session) {
        setBaseeraLoginError('تعذّر تسجيل الدخول. تحقّق من الرمز وحاول مرة أخرى.');
        return;
      }
      setBaseeraSession(session);
      setBaseeraAccessCode('');
      setShowBaseeraLogin(false);
      const response = await authenticatedFetch('/api/students');
      if (response.ok) {
        const data = await response.json();
        let loadedStudents: StudentRecord[] = Array.isArray(data?.students)
          ? data.students.map((student: StudentRecord) => ({ ...student }))
          : [];

        if (pendingServerRecord) {
          const existingPending = loadedStudents.find((student) =>
            student.id === pendingServerRecord.id && !student.isDemoRecord
          );
          const sessionPayload = sessionPayloadFromRecord(pendingServerRecord);
          const createPayload = studentCreatePayloadFromRecord(pendingServerRecord);
          const sendSave = (url: string, body: unknown) => authenticatedFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          let pendingSave = existingPending
            ? await sendSave(`/api/students/${encodeURIComponent(pendingServerRecord.id)}/sessions`, sessionPayload)
            : await sendSave('/api/students', createPayload);
          if (pendingSave.status === 404 && existingPending) {
            pendingSave = await sendSave('/api/students', createPayload);
          }
          if (pendingSave.ok) {
            const saved = await pendingSave.json().catch(() => ({}));
            const savedRecord: StudentRecord = saved?.student || {
              ...pendingServerRecord,
              tenantId: session.tenantId,
            };
            loadedStudents = [
              savedRecord,
              ...loadedStudents.filter((student) => student.id !== savedRecord.id),
            ];
            setPendingServerRecord(null);
            setSelectedStudentId(savedRecord.id);
            setAiStatusBanner(`تم تسجيل الدخول وحفظ جلسة ${savedRecord.name} في سجل المدرسة المحمي.`);
          } else {
            const saveError = await pendingSave.json().catch(() => ({}));
            setAiStatusBanner(saveError?.error || 'تم تسجيل الدخول، لكن تعذر حفظ الجلسة المعلّقة.');
          }
        }

        setSchoolRosterEmpty(loadedStudents.length === 0);
        const visibleStudents = loadedStudents.length > 0 ? loadedStudents : INITIAL_STUDENTS;
        setStudents(visibleStudents);
        if (visibleStudents.length > 0 && !pendingServerRecord) setSelectedStudentId(visibleStudents[0].id);
        setIsPersistedStoreLoaded(true);
      } else {
        const data = await response.json().catch(() => ({}));
        setAiStatusBanner(data?.error || 'تم تسجيل الدخول لكن تعذر تحميل السجلات.');
      }
    } catch {
      setBaseeraLoginError('تعذر الاتصال بخدمة تسجيل الدخول.');
    } finally {
      setIsBaseeraLoggingIn(false);
    }
  };

  return (
    <AssessmentProvider>
      <div
        data-dyslexia-theme={surfaceTheme}
        data-dyslexia-spacing={spacingMode}
        className="baseera-app min-h-screen w-full flex flex-col"
      >
      <a className="baseera-skip-link" href="#main-content">تجاوز إلى المحتوى</a>
      {showBaseeraLogin && (
        <div className="bz-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="baseera-login-title">
          <form
            onSubmit={(event) => { event.preventDefault(); void handleBaseeraLogin(); }}
            className="bz-modal space-y-5"
            style={{ width: 'min(100%, 440px)' }}
          >
            <div className="flex items-center gap-3">
              <BrandMark size={40} />
              <div>
                <h2 id="baseera-login-title" className="bz-h3">دخول المعلم والأخصائي</h2>
                <p className="bz-small bz-muted">لوحة متابعة الطلاب والتقارير</p>
              </div>
            </div>

            {/* School Access Code */}
            <label className="bz-field pt-2">
              <span className="bz-label">رمز الوصول المدرسي</span>
              <input
                autoComplete="current-password"
                type="password"
                value={baseeraAccessCode}
                onChange={(event) => setBaseeraAccessCode(event.target.value)}
                placeholder="أدخل رمز الوصول الخاص بمدرستك…"
                className="bz-input"
              />
              <span className="bz-hint">يسلّمه لك مسؤول النظام في مدرستك، وتُحدَّد صلاحياتك تلقائيًا.</span>
            </label>
            {baseeraLoginError && <p role="alert" className="text-sm text-risk">{baseeraLoginError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isBaseeraLoggingIn} className="bz-btn bz-btn-primary flex-1">
                {isBaseeraLoggingIn ? 'جارٍ التحقق…' : 'تسجيل الدخول'}
              </button>
              <button type="button" onClick={() => { setShowBaseeraLogin(false); setBaseeraLoginError(''); setSupabaseError(''); }} className="bz-btn bz-btn-ghost">إلغاء</button>
            </div>
            <div className="text-center pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowBaseeraLogin(false);
                  setActiveTab('parent-portal');
                }}
                className="text-xs text-teal-700 hover:text-teal-900 font-bold underline cursor-pointer"
              >
                هل أنت ولي أمر؟ اضغط هنا لتسجيل بيانات طفلك ومتابعة تقريره مباشرة
              </button>
            </div>
          </form>
        </div>
      )}
      <header className="baseera-topbar">
        <div className="baseera-topbar-inner">
          <a
            href="#top"
            onClick={(event) => {
              event.preventDefault();
              setActiveTab('home');
            }}
            className="baseera-brand"
            aria-label="هَيَّا نَقْرَأْ — الصفحة الرئيسية"
          >
            <BrandLockup />
          </a>

          <nav className="baseera-desktop-nav" aria-label="التنقل الرئيسي">
            {([
              // One journey: register the child (header button), screen, then train.
              // Practice games and the reader are optional extras inside the programme and the footer.
              { id: 'home', label: 'الرئيسية', icon: Home },
              { id: 'dyslexia-lab', label: 'فحص مهارات القراءة', icon: Brain },
              { id: 'guided-program', label: 'البرنامج التدريبي', icon: Target },
            ] as const).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={'baseera-nav-link' + (activeTab === item.id ? ' is-active' : '')}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                >
                  <Icon aria-hidden="true" size={17} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="baseera-header-actions">
            <DyslexiaComfortBar
              activeTab={activeTab}
              surfaceTheme={surfaceTheme}
              onChangeSurfaceTheme={setSurfaceTheme}
              spacingMode={spacingMode}
              onChangeSpacingMode={setSpacingMode}
              readingRulerEnabled={readingRulerEnabled}
              onToggleReadingRuler={() => setReadingRulerEnabled((prev) => !prev)}
            />
            <button
              type="button"
              className="bz-btn bz-btn-ghost shrink-0 whitespace-nowrap"
              aria-label={baseeraSession ? 'لوحة المعلم' : 'دخول المعلم'}
              onClick={() => baseeraSession ? setActiveTab('dashboard') : setShowBaseeraLogin(true)}
            >
              <GraduationCap aria-hidden="true" size={18} />
              <span className="bz-hide-sm whitespace-nowrap">{baseeraSession ? 'لوحة المعلم' : 'دخول المعلم'}</span>
            </button>
            <button
              type="button"
              className="bz-btn bz-btn-primary shrink-0 whitespace-nowrap font-bold baseera-topbar-cta"
              onClick={() => setActiveTab('parent-portal')}
            >
              <span className="whitespace-nowrap">{supabaseUser ? 'أطفالي 👶' : 'تسجيل طفل / حساب الأسرة 👨‍👩‍👧'}</span>
            </button>
          </div>
        </div>
      </header>

      {!['sprint', 'storygen', 'remediation-gym', 'dyslexia-lab', 'home'].includes(activeTab) && baseeraSession && (
        <div className="baseera-session-strip" role="status">
          <span className="baseera-session-copy">
            <ShieldCheck aria-hidden="true" size={16} />
            {supabaseUser
              ? `جلسة سحابية نشطة: ${baseeraSession.accountName}`
              : `جلسة المدرسة متصلة: ${baseeraSession.accountName} · ${getTenantDisplayLabelAr(baseeraSession)}`}
          </span>
          <button
            type="button"
            className="baseera-session-action"
            onClick={() => {
              void (async () => {
                if (supabaseUser) {
                  try {
                    await signOutSupabase();
                  } catch (e) {
                    console.error(e);
                  }
                  setSupabaseUser(null);
                }
                await logoutBaseeraSession();
                setBaseeraSession(null);
                setIsPersistedStoreLoaded(false);
                setAiStatusBanner('تم تسجيل الخروج بنجاح وإغلاق الجلسة.');
              })();
            }}
          >
            تسجيل الخروج
          </button>
        </div>
      )}

      <nav className="baseera-mobile-nav" aria-label="التنقل السريع">
        {([
          { id: 'home', label: 'الرئيسية', icon: Home },
          { id: 'parent-portal', label: 'طفلي', icon: Heart },
          { id: 'dyslexia-lab', label: 'الفحص', icon: Brain },
          { id: 'guided-program', label: 'البرنامج', icon: Target },
        ] as const).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={'baseera-mobile-nav-item' + (activeTab === item.id ? ' is-active' : '')}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <Icon aria-hidden="true" size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <main id="main-content" className={'baseera-main flex-1 flex flex-col min-h-[calc(100vh-64px)]' + (activeTab === 'home' ? ' is-home' : '')}>
        <Suspense fallback={<div className="py-24 text-center bz-muted" role="status">جارٍ التحميل…</div>}>
        <div key={activeTab} className="space-y-8 animate-fade-slide-up">
          {aiStatusBanner && (
            <div role="status" className="w-[min(100%-32px,1200px)] mx-auto px-4 py-3 bg-brand-tint border border-line rounded-xl flex items-center justify-between gap-4 text-sm text-ink">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                <span>{aiStatusBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiStatusBanner('')}
                className="text-emerald-700 hover:underline font-medium shrink-0 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          )}

          {/* VIEW 0: FLAGSHIP ENTERPRISE HOME & PROJECT SHOWCASE */}
          {activeTab === 'home' && (
            <HomeLandingView
              students={students}
              activeStudent={selectedStudent}
              onSelectExistingDemoJourney={handleSelectExistingDemoJourney}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onSelectStudentReport={(studentId) => {
                selectStudent(studentId);
                setActiveTab('dashboard');
                setDashboardSubView('report');
              }}
            />
          )}

          {/* VIEW: PARENT PORTAL & CHILD REGISTRATION */}
          {activeTab === 'parent-portal' && (
            <ParentPortalView
              supabaseUser={supabaseUser}
              authLoading={supabaseAuthLoading}
              students={students}
              onSignInWithEmail={handleEmailSignIn}
              onSignOut={async () => {
                if (supabaseUser) {
                  try {
                    await signOutSupabase();
                  } catch (e) {
                    console.error(e);
                  }
                  setSupabaseUser(null);
                }
                await logoutBaseeraSession();
                clearStoredClientState();
                setBaseeraSession(null);
                setStudents(INITIAL_STUDENTS);
                setSelectedStudentId(INITIAL_STUDENTS[0].id);
                setAiStatusBanner('تم تسجيل الخروج وحذف بيانات الجلسة من هذا المتصفح بنجاح.');
              }}
              onRegisterChild={handleRegisterChildByParent}
              onLinkLocalChild={handleLinkLocalChild}
              onDeleteChild={handleDeleteChildByParent}
              onSelectStudent={(studentId, targetTab) => {
                selectStudent(studentId);
                setActiveTab(targetTab);
              }}
              onNavigateHome={() => setActiveTab('home')}
            />
          )}

        {/* VIEW 1: EDUCATIONAL INDICATORS DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {!isAuthenticated && (
              <div className="rounded-xl border border-teal-200 bg-teal-50/90 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 text-xs text-teal-950 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📱</span>
                  <div>
                    <strong className="block text-sm font-bold text-teal-900 mb-0.5">أنت تستعرض التقرير المحفوظ محلياً على هذا الجهاز</strong>
                    <span>سجّل الدخول أو أنشئ حساب ولي أمر لحفظ تقارير أطفالك سحابياً ومتابعتها من أي جهاز بأمان.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBaseeraLogin(true)}
                  className="px-4 py-2 font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  تسجيل الدخول / إنشاء حساب
                </button>
              </div>
            )}
            {baseeraSession?.role === 'platform_admin' && (
              <nav className="flex flex-wrap gap-2" aria-label="أدوات المدير">
                {(['report', 'metrics', 'demo_requests'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={dashboardSubView === view}
                    onClick={() => {
                      setDashboardSubView(view);
                      if (view === 'demo_requests') void fetchDemoRequests();
                    }}
                    className={`bz-btn bz-btn-sm ${dashboardSubView === view ? 'bz-btn-primary' : 'bz-btn-ghost'}`}
                  >
                    {view === 'report' ? 'ملف الطفل' : view === 'metrics' ? 'مؤشرات الاستخدام' : `طلبات المدارس (${toArabicNum(demoRequests.length)})`}
                  </button>
                ))}
              </nav>
            )}
            {(dashboardSubView === 'report' || dashboardSubView === 'roster' || baseeraSession?.role !== 'platform_admin') && (
              <ChildDashboard
                student={selectedStudent}
                students={students}
                onSelectStudent={setSelectedStudentId}
                onOpenScreening={() => setActiveTab('dyslexia-lab')}
                onOpenTraining={() => setActiveTab('guided-program')}
                showTeacherTools={baseeraSession?.role === 'school_admin' || baseeraSession?.role === 'platform_admin' || baseeraSession?.role === 'educator_readonly'}
                onRecordUpdated={(updated) => {
                  setStudents((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
                  if (supabaseUser) void syncStudentToSupabase(updated, supabaseUser.id);
                }}
              />
            )}
            {dashboardSubView === 'metrics' && baseeraSession?.role === 'platform_admin' && <UsageMetricsPanel />}

            {dashboardSubView === 'demo_requests' && baseeraSession?.role === 'platform_admin' && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 mb-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-teal-600" />
                      <span>طلبات الشراكة والتجربة للمدارس والمراكز التعليمية</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      سجل آمن ومشفّر لطلبات المدارس الواردة عبر نموذج الطلب. لا يضمن النموذج موعدًا ثابتًا للتواصل.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchDemoRequests()}
                    disabled={isLoadingDemoRequests}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDemoRequests ? 'animate-spin' : ''}`} />
                    <span>تحديث القائمة</span>
                  </button>
                </div>

                {isLoadingDemoRequests ? (
                  <div className="py-12 text-center text-xs text-slate-500">جارٍ تحميل الطلبات…</div>
                ) : demoRequestsError ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
                    {demoRequestsError}
                  </div>
                ) : demoRequests.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    لا توجد طلبات تجربة جديدة حاليًا.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {demoRequests.map((req) => (
                      <div
                        key={req.id || req.submittedAt}
                        className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4"
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-black text-slate-900">{req.schoolName}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
                              بانتظار المتابعة
                            </span>
                            {req.expectedStudents && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                                {req.expectedStudents} طالب
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-4 pt-1">
                            <span className="flex items-center gap-1">
                              <span className="font-bold text-slate-800">المسؤول:</span>
                              <span>{req.contactName} {req.roleTitle ? `(${req.roleTitle})` : ''}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Mail size={13} className="text-slate-400" />
                              <a href={`mailto:${req.workEmail}`} className="text-teal-700 underline font-medium">
                                {req.workEmail}
                              </a>
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone size={13} className="text-slate-400" />
                              <a href={`tel:${req.phone}`} dir="ltr" className="text-slate-700 font-mono">
                                {req.phone}
                              </a>
                            </span>
                          </div>
                          {req.notes && (
                            <div className="mt-2 text-xs bg-white p-3 rounded-xl border border-slate-200 text-slate-700">
                              <span className="font-bold text-slate-800 block mb-0.5">ملاحظات واحتياجات المدرسة:</span>
                              <p className="leading-relaxed">{req.notes}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 pt-2">
                            <span className="text-[11px] font-bold text-slate-500">الإجراء التشغيلي:</span>
                            {req.status !== 'contacted' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateLeadStatus(req.id, 'contacted')}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition-colors cursor-pointer"
                              >
                                تمييز الطلب: تم التواصل
                              </button>
                            )}
                            {req.status !== 'archived' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateLeadStatus(req.id, 'archived')}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
                              >
                                أرشفة
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteLead(req.id)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                            >
                              حذف الطلب نهائيًا
                            </button>
                          </div>
                        </div>
                        <div className="text-right md:text-left text-[11px] text-slate-400 font-mono shrink-0 flex items-center gap-1">
                          <Clock size={12} />
                          <span>{new Date(req.submittedAt).toLocaleString('ar-QA')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Unified reading screening and training hub — strictly requires authenticated session (no guest mode). */}
        {isAuthenticated && (activeTab === 'dyslexia-lab' || activeTab === 'reading-lab' || activeTab === 'cognitive-lab' || activeTab === 'guided-program') && (
          <DyslexiaScreeningHub
            students={students}
            activeStudent={selectedStudent}
            onSelectStudent={selectStudent}
            onNavigateTab={(tab) => setActiveTab(tab)}
            supabaseUser={supabaseUser || (baseeraSession ? { email: baseeraSession.accountName, id: baseeraSession.sessionId } : null)}
            initialSubTab={
              activeTab === 'reading-lab'
                  ? 'oral-reading'
                  : activeTab === 'guided-program'
                    ? 'training'
                    : 'battery'
            }
            onCompleteOralSession={handleCompleteNewSession}
              onCreateLearner={handleCreateBatteryLearner}
              onStudentUpdated={(updated) => {
                // Always update local students state immediately so data is never lost
                setStudents((prev) => prev.map((student) => (student.id === updated.id ? { ...student, ...updated } : student)));

                const existing = students.find((student) => student.id === updated.id);
                const isParentCloudSession = Boolean(supabaseUser && (!baseeraSession || baseeraSession.role === 'parent'));
                const batteryChanged = Boolean(
                  isParentCloudSession &&
                  updated.cognitiveBattery &&
                  JSON.stringify(updated.cognitiveBattery) !== JSON.stringify(existing?.cognitiveBattery)
                );

                // Family cognitive-battery records pass through the receipt-validating server.
                // Serialize writes per child so two rapid subtest completions cannot race while
                // the server consumes their one-use Azure receipts.
                if (batteryChanged && updated.cognitiveBattery && supabaseUser) {
                  const previousSave = parentBatterySyncQueue.current.get(updated.id) ?? Promise.resolve();
                  const nextSave = previousSave.catch(() => undefined).then(async () => {
                    try {
                      const response = await authenticatedFetch(
                        `/api/parent/students/${encodeURIComponent(updated.id)}/cognitive-battery`,
                        {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            ageMonths: updated.cognitiveBattery!.ageMonths,
                            examinerName: updated.cognitiveBattery!.examinerName,
                            startedAt: updated.cognitiveBattery!.startedAt,
                            dialect: updated.cognitiveBattery!.dialect,
                            guardianAudioConsentGiven: updated.guardianAudioConsentGiven === true,
                            guardianAudioConsentRecordedAt: updated.guardianAudioConsentRecordedAt,
                            results: updated.cognitiveBattery!.results,
                          }),
                        }
                      );
                      const payload = await response.json().catch(() => null) as
                        | { student?: StudentRecord; error?: string }
                        | null;
                      if (response.ok && payload?.student) {
                        // Keep a verified voice result this device holds if the server copy came back
                        // without one for the same task (it could not verify the receipt).
                        const serverBattery = payload.student.cognitiveBattery;
                        const localResults = updated.cognitiveBattery?.results ?? {};
                        const keptBattery = serverBattery
                          ? {
                              ...serverBattery,
                              results: Object.fromEntries(
                                Object.entries({ ...localResults, ...serverBattery.results }).map(([id, result]) => {
                                  const local = (localResults as Record<string, typeof result>)[id];
                                  return [id, !result?.audioAssessment && local?.audioAssessment ? local : result];
                                })
                              ) as typeof serverBattery.results,
                            }
                          : updated.cognitiveBattery;
                        setStudents((prev) => prev.map((student) =>
                          student.id === updated.id ? { ...student, ...payload.student!, cognitiveBattery: keptBattery } : student
                        ));
                        if (updated.trainingProgress) {
                          void syncTrainingProgressToSupabase(payload.student, supabaseUser.id);
                        }
                        return;
                      }
                    } catch {
                      // Fall through to direct Supabase sync below
                    }
                    // Graceful fallback to direct Supabase persistence
                    void syncStudentToSupabase(updated, supabaseUser.id).then((saved) => {
                      if (saved && updated.trainingProgress) {
                        void syncTrainingProgressToSupabase(updated, supabaseUser.id);
                      }
                    });
                  });
                  parentBatterySyncQueue.current.set(updated.id, nextSave);
                  void nextSave.finally(() => {
                    if (parentBatterySyncQueue.current.get(updated.id) === nextSave) {
                      parentBatterySyncQueue.current.delete(updated.id);
                    }
                  });
                  return;
                }

                if (isParentCloudSession && supabaseUser) {
                  void syncStudentToSupabase(updated, supabaseUser.id).then((saved) => {
                    if (saved && updated.trainingProgress) void syncTrainingProgressToSupabase(updated, supabaseUser.id);
                  });
                }
              }}
            />
        )}

        {/* NEW: ADAPTIVE REPORTS */}



        {/* VIEW 4: REMEDIATION GYM & STATIONS */}
        {isAuthenticated && activeTab === 'remediation-gym' && (
          <RemediationGymView
            students={students}
            activeStudent={selectedStudent}
            onSelectStudent={selectStudent}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenReport={() => setActiveTab('dashboard')}
            canGeneratePlan={baseeraSession?.role === 'school_admin'}
            initialStation="phonics"
          />
        )}

        {/* ⚡ DIRECT ACCESS: 5-MINUTE DAILY SPRINT (timed fluency drill) */}
        {isAuthenticated && activeTab === 'sprint' && (
          <RemediationGymView
            students={students}
            activeStudent={selectedStudent}
            onSelectStudent={selectStudent}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenReport={() => setActiveTab('dashboard')}
            canGeneratePlan={baseeraSession?.role === 'school_admin'}
            initialStation="sprint"
          />
        )}

        {/* 📖 DIRECT ACCESS: AI DECODABLE STORIES (generated decodable stories) */}
        {isAuthenticated && activeTab === 'storygen' && (
          <RemediationGymView
            students={students}
            activeStudent={selectedStudent}
            onSelectStudent={selectStudent}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenReport={() => setActiveTab('dashboard')}
            canGeneratePlan={baseeraSession?.role === 'school_admin'}
            initialStation="storygen"
          />
        )}

        {isAuthenticated && activeTab === 'adaptive-reader' && (
          <ReaderPage
            problematicWords={selectedStudent.sessionStatus === 'completed' && hasVerifiedOralAudio(selectedStudent) ? (selectedStudent.problematicWords || []) : []}
            studentName={selectedStudent.name}
            passageId={selectedStudent.passageId}
          />
        )}

        {activeTab === 'privacy' && <PrivacyPolicyView />}
        {activeTab === 'terms' && <TermsOfUseView />}
        {isAuthenticated && activeTab === 'content-review' && <ContentReviewView />}
        {isAuthenticated && activeTab === 'audio-lab' && <AudioComparisonLabView />}
        </div>
        </Suspense>
      </main>

      {!cookieNoticeAccepted && (
        <aside
          role="region"
          aria-label="إشعار ملفات تعريف الارتباط"
          className="no-print fixed bottom-[78px] xl:bottom-4 inset-x-3 sm:inset-x-4 z-50 mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white/95 backdrop-blur px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-xs text-slate-700"
          dir="rtl"
        >
          <p className="leading-relaxed">
            <strong className="font-bold text-slate-900">ملفات تعريف الارتباط الأساسية (Cookies):</strong>{' '}
            نستخدم ملفات تعريف الارتباط الأساسية فقط لإبقاء جلسة تسجيل الدخول نشطة وتذكّر الطفل المختار بأمان، دون أي ملفات تتبّع إعلانية أو تجارية.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              سياسة الخصوصية
            </button>
            <button
              type="button"
              onClick={() => {
                acceptCookieNotice();
                setCookieNoticeAccepted(true);
              }}
              className="px-4 py-1.5 rounded-lg bg-brand text-white hover:opacity-95 font-bold cursor-pointer"
            >
              موافق
            </button>
          </div>
        </aside>
      )}

      {['home', 'privacy', 'terms', 'content-review'].includes(activeTab) && (
        <footer className="baseera-footer">
          <div className="baseera-footer-inner">
            <div className="baseera-footer-brand">
              <span className="baseera-brand"><BrandLockup tagline={false} /></span>
              <p>فحص معرفي مبكر لمهارات ما قبل القراءة، وبرنامج تدريبي عربي يتكيّف مع تقدّم الطفل — للأسر والمدارس والأخصائيين.</p>
            </div>
            <div className="baseera-footer-col">
              <h2>المنصة</h2>
              <ul>
                <li><button type="button" onClick={() => setActiveTab('dyslexia-lab')}>فحص مهارات القراءة</button></li>
                <li><button type="button" onClick={() => setActiveTab('guided-program')}>البرنامج التدريبي</button></li>
                <li><button type="button" onClick={() => setActiveTab('remediation-gym')}>ألعاب إضافية (صالة التدريب)</button></li>
                <li><button type="button" onClick={() => setActiveTab('adaptive-reader')}>القارئ الميسّر (لمن يقرأ)</button></li>
              </ul>
            </div>
            <div className="baseera-footer-col">
              <h2>للمدارس والأخصائيين</h2>
              <ul>
                <li><button type="button" onClick={() => setActiveTab('dashboard')}>لوحة المتابعة والتقارير</button></li>
                <li><button type="button" onClick={() => setActiveTab('reading-lab')}>فحص القراءة الجهرية</button></li>
                <li><a href="/audio-audit.html" target="_blank" rel="noreferrer" className="text-teal-700 font-bold hover:underline inline-flex items-center gap-1">🎙️ مختبر مراجعة واستماع الصوت</a></li>
              </ul>
            </div>
            <div className="baseera-footer-col">
              <h2>الثقة والخصوصية والتواصل</h2>
              <ul>
                <li><button type="button" onClick={() => setActiveTab('privacy')}>سياسة الخصوصية</button></li>
                <li><button type="button" onClick={() => setActiveTab('terms')}>شروط الاستخدام</button></li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('home');
                      setTimeout(() => document.getElementById('contact-us')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
                    }}
                  >
                    تواصل معنا
                  </button>
                </li>
                <li>
                  <a href="mailto:contact@hayanaqra.com" className="text-teal-700 hover:underline font-medium" dir="ltr">
                    contact@hayanaqra.com
                  </a>
                </li>
              </ul>
            </div>
            <p className="baseera-footer-note">
              <span>© ٢٠٢٦ هَيَّا نَقْرَأْ</span>
              <span>أداة فرز وتدريب تعليمية، وليست تشخيصًا طبيًا. ولا يكون التشخيص إلا لدى مختص مؤهل.</span>
            </p>
          </div>
        </footer>
      )}
    </div>
    </AssessmentProvider>
  );
}
