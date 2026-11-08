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
import {
  saveStoredStudents,
  loadStoredStudents,
  saveActiveStudentId,
  loadActiveStudentId,
} from './utils/cookiePersistence';
import { saveBatterySession, type BatterySession, type HomeDialect } from './cognitiveProfile/storage';
import {
  signInWithEmail,
  signUpWithEmail,
  signOutSupabase,
  onSupabaseAuthChange,
  isSupabaseConfigured,
  fetchStudentsFromSupabase,
  syncStudentToSupabase,
  syncTrainingProgressToSupabase,
} from './utils/supabaseClient';
import { AssessmentProvider } from './contexts/AssessmentContext';
const ReaderPage = lazy(() => import('./components/reader/ReaderPage').then((m) => ({ default: m.ReaderPage })));
const RemediationGymView = lazy(() => import('./components/RemediationGymView'));
const DyslexiaScreeningHub = lazy(() => import('./components/DyslexiaScreeningHub'));
import { BrandLockup, BrandMark } from './components/ui/BrandMark';
import { BatteryRiskBadge, BatterySummaryPanel } from './components/profile/BatterySummaryPanel';
import { TrainingProgressPanel } from './components/profile/TrainingProgressPanel';
import IndividualPlanPanel from './components/profile/IndividualPlanPanel';
import { trackUsage } from './utils/usageTracking';
const UsageMetricsPanel = lazy(() => import('./components/UsageMetricsPanel'));
const PrivacyPolicyView = lazy(() => import('./components/PrivacyPolicyView'));
const TermsOfUseView = lazy(() => import('./components/TermsOfUseView'));
const ContentReviewView = lazy(() => import('./components/review/ContentReviewView'));
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

function parseRouteFromLocation(): { tab: ActiveTab; showLogin?: boolean } {
  if (typeof window === 'undefined') return { tab: 'home' };
  const rawPath = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
  const params = new URLSearchParams(window.location.search);

  if (rawPath === '/signin' || rawPath === '/login') {
    return { tab: 'home', showLogin: true };
  }
  if (
    rawPath === '/parent' ||
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
    return { tab: 'dashboard' };
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
    useState<DashboardSubView>('roster');
  const [students, setStudents] = useState<StudentRecord[]>(() => {
    const stored = loadStoredStudents();
    if (stored.length > 0) {
      const storedIds = new Set(stored.map((s) => s.id));
      return [...stored, ...INITIAL_STUDENTS.filter((s) => !storedIds.has(s.id))];
    }
    return INITIAL_STUDENTS;
  });
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    const savedId = loadActiveStudentId();
    const stored = loadStoredStudents();
    if (savedId && (stored.some((s) => s.id === savedId) || INITIAL_STUDENTS.some((s) => s.id === savedId))) {
      return savedId;
    }
    if (stored.length > 0) {
      return stored[0].id;
    }
    return INITIAL_STUDENTS[0].id;
  });

  const selectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    saveActiveStudentId(studentId);
  };

  // Sync students to cookie / persistent storage whenever records change
  useEffect(() => {
    if (students && students.length > 0) {
      saveStoredStudents(students);
    }
  }, [students]);
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
    if (!window.confirm('هل تؤكد حذف طلب التواصل من مخزن التطبيق النشط؟ هذا لا يؤكد محو أي نسخة احتياطية لدى مزود الاستضافة.')) return;
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
  const [supabaseAuthLoading, setSupabaseAuthLoading] = useState<boolean>(false);
  const [supabaseError, setSupabaseError] = useState<string>('');

  // Active tab setter with strict authentication guard for screening and training
  const setActiveTab = (tab: ActiveTab, bypassAuthCheck = false) => {
    const isProtected = ['dyslexia-lab', 'guided-program', 'reading-lab', 'cognitive-lab'].includes(tab);
    if (isProtected && !supabaseUser && !baseeraSession && !bypassAuthCheck) {
      setActiveTabState('parent-portal');
      const newPath = tabToUrlPath('parent-portal');
      if (typeof window !== 'undefined' && window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
      setAiStatusBanner('تسجيل حساب الأسرة وبيانات الطفل مطلوب أولاً لحفظ نتائج الفحص والتدريب في السحابة ☁️');
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

  // Route guard: if browser loads directly into a screening or training URL while unauthenticated
  useEffect(() => {
    const isProtected = ['dyslexia-lab', 'guided-program', 'reading-lab', 'cognitive-lab'].includes(activeTab);
    if (isProtected && !supabaseUser && !baseeraSession) {
      setActiveTabState('parent-portal');
      const newPath = tabToUrlPath('parent-portal');
      if (typeof window !== 'undefined' && window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
      setAiStatusBanner('تسجيل حساب الأسرة وبيانات الطفل مطلوب أولاً لحفظ نتائج الفحص والتدريب في السحابة ☁️');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
  }, [activeTab, supabaseUser, baseeraSession]);

  useEffect(() => {
    const unsubscribe = onSupabaseAuthChange((user, session) => {
      setSupabaseUser(user);
      if (user) {
        const googleSession: BaseeraSessionInfo = {
          token: session?.access_token || `google-${user.id}`,
          role: 'school_admin',
          accountName: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'معلم Google',
          tenantId: `google_${user.id.slice(0, 8)}`,
          tenantDisplayNameAr: 'حساب Google التعليمي',
          sessionId: user.id.replace(/-/g, '').slice(0, 32),
          scopes: ['students:read', 'students:write', 'assessments:all'],
          expiresAt: session?.expires_at ? session.expires_at * 1000 : Date.now() + 86400000,
        };
        setBaseeraSession(googleSession);
        storeBaseeraSession(googleSession);
        setShowBaseeraLogin(false);
        setAiStatusBanner(`مرحباً بك، ${googleSession.accountName}! تم تسجيل الدخول بنجاح عبر Google.`);
        void fetchStudentsFromSupabase(user.id).then((cloudStudents) => {
          if (cloudStudents.length > 0) {
            setStudents(cloudStudents);
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleEmailSignIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setSupabaseError('');
    setSupabaseAuthLoading(true);
    try {
      const { user, session } = await signInWithEmail(email, pass);
      if (!user || !session?.access_token) {
        throw new Error('لم يتم إنشاء جلسة مصادقة صالحة. تحقق من بيانات الدخول وإعدادات الحساب.');
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
      setAiStatusBanner('مرحباً بك! تم تسجيل الدخول بنجاح.');
      const cloudStudents = await fetchStudentsFromSupabase(user.id);
      if (cloudStudents.length > 0) {
        setStudents((prev) => {
          const ids = new Set(cloudStudents.map((s) => s.id));
          return [...cloudStudents, ...prev.filter((p) => !ids.has(p.id))];
        });
      }
      setSupabaseAuthLoading(false);
      return { success: true };
    } catch (err: any) {
      setSupabaseAuthLoading(false);
      const msg = err?.message || 'تعذر تسجيل الدخول. يرجى التأكد من البريد وكلمة المرور.';
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
    if (!baseeraSession?.token) return;
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
  }, [baseeraSession?.token]);

  const selectedStudent =
    students.find((s) => s.id === selectedStudentId) || students[0];

  const selectedReadingRate = (() => {
    if (selectedStudent.sessionStatus !== 'completed') return null;
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
      setAiStatusBanner('يجري التحقق من إيصال التقييم الصوتي وملكية ملف الطفل قبل حفظ جلسة القراءة في حساب الأسرة…');
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
        setAiStatusBanner('تم حفظ جلسة القراءة في حساب الأسرة بعد التحقق الخادمي من الموافقة وإيصال الصوت.');
      }).catch(() => {
        setAiStatusBanner('تعذر التحقق أو حفظ جلسة القراءة الصوتية بأمان؛ بقيت النتيجة محلية ولم تُعتمد سحابيًا.');
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
      `تم إنهاء جلسة الفحص للطالب (${completedRecord.name}) محليًا؛ جارٍ محاولة حفظها في الخادم.`
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
  const handleCreateBatteryLearner = (input: { name: string; ageYears: number; examinerName: string; guardianConsentRecordedAt?: string }): string | null => {
    if (baseeraSession?.role === 'educator_readonly') return null;
    const cleanName = input.name.trim().replace(/\s+/g, ' ');
    if (cleanName.length < 2) return null;
    const recordedAt = input.guardianConsentRecordedAt || new Date().toISOString();
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
      schoolName: supabaseUser
        ? `حساب ولي الأمر (${supabaseUser.user_metadata?.full_name || supabaseUser.email || 'الأسرة'})`
        : 'على هذا الجهاز (محلي)',
      lastScreenedDate: '—',
      passageId: ARABIC_READING_PASSAGES[0].id,
      guardianConsentGiven: true,
      guardianConsentRecordedAt: recordedAt,
      guardianConsentSource: `إقرار ذاتي من مستخدم شاشة الفحص (${input.examinerName.trim() || 'غير محدد'})؛ لم تتحقق المنصة من هوية ولي الأمر أو صحة التفويض`,
      guardianAudioConsentGiven: false,
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

  /** Parent portal child registration handler */
  const handleRegisterChildByParent = async (child: {
    name: string;
    ageYears: number;
    gradeLevel: number;
    dialectCode: 'msa' | 'gulf' | 'egyptian' | 'levantine' | 'maghrebi';
    notes?: string;
    parentEmail?: string;
    parentPassword?: string;
  }): Promise<string | null> => {
    if (!Number.isInteger(child.ageYears) || child.ageYears < 4 || child.ageYears > 8) {
      throw new Error('الفحص الحالي مخصص للأطفال من ٤ إلى ٨ سنوات فقط.');
    }
    if (!Number.isInteger(child.gradeLevel) || child.gradeLevel < 0 || child.gradeLevel > 3) {
      throw new Error('اختر المرحلة من الروضة حتى الصف الثالث.');
    }
    let currentUser = supabaseUser;

    if (!currentUser) {
      if (!child.parentEmail || !child.parentPassword) {
        throw new Error('سجّل دخول ولي الأمر أو أنشئ حسابًا موثّقًا قبل حفظ ملف الطفل.');
      }
      let authSession: any = null;
      try {
        const res = await signUpWithEmail(child.parentEmail, child.parentPassword);
        if (res.user) {
          currentUser = res.user;
          authSession = res.session;
          setSupabaseUser(res.user);
        }
      } catch (signUpErr: any) {
        // If user already registered in Supabase, sign in instead of failing
        try {
          const res = await signInWithEmail(child.parentEmail, child.parentPassword);
          if (res.user) {
            currentUser = res.user;
            authSession = res.session;
            setSupabaseUser(res.user);
          } else {
            throw signUpErr;
          }
        } catch {
          throw signUpErr;
        }
      }
      if (!currentUser) {
        throw new Error('أُرسل طلب إنشاء الحساب، لكن لم تُنشأ جلسة دخول بعد. تحقق من بريدك الإلكتروني ثم سجّل الدخول.');
      }

      const parentSession: BaseeraSessionInfo = {
        token: authSession?.access_token || `parent-${currentUser.id}`,
        role: 'parent',
        accountName: currentUser.user_metadata?.full_name || currentUser.email || 'حساب الأسرة',
        tenantId: `parent_${currentUser.id.slice(0, 8)}`,
        tenantDisplayNameAr: 'حساب الأسرة',
        sessionId: currentUser.id.replace(/-/g, '').slice(0, 32),
        scopes: ['students:read', 'students:write'],
        expiresAt: Date.now() + 86400000 * 30,
      };
      setBaseeraSession(parentSession);
      storeBaseeraSession(parentSession);
    }

    const recordedAt = new Date().toISOString();
    const newLearner: StudentRecord = {
      id: `stu-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)}`,
      name: child.name,
      parentAccount: currentUser?.id,
      isDemoRecord: false,
      sessionStatus: 'in_progress',
      sessionRoleLabel: 'ولي الأمر / فحص منزلي',
      assessmentHistory: [],
      cognitiveBattery: null,
      trainingProgress: null,
      gradeLevel: child.gradeLevel,
      ageYears: child.ageYears,
      dialectCode: child.dialectCode,
      schoolName: currentUser
        ? `حساب ولي الأمر (${currentUser.user_metadata?.full_name || currentUser.email || 'الأسرة'})`
        : 'حساب الأسرة',
      lastScreenedDate: '—',
      passageId: ARABIC_READING_PASSAGES[0].id,
      guardianConsentGiven: true,
      guardianConsentRecordedAt: recordedAt,
      guardianConsentSource: `إقرار ذاتي من مستخدم بوابة الأسرة (${recordedAt.split('T')[0]})؛ موافقة كاملة على أنشطة الفحص والتقييم الصوتي`,
      guardianAudioConsentGiven: true,
      guardianAudioConsentRecordedAt: recordedAt,
      parentNotes: child.notes || undefined,
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
        learningSummary: `ملف جديد للطفل «${child.name}»؛ تظهر المؤشرات فور إكمال أول تمرين أو فحص.`,
        ocularMotorAnalysis: 'غير منطبق؛ منصة هَيَّا نَقْرَأْ لا تعتمد على الكاميرا أو تتبّع العين.',
        orthographicAndPhonologicalPatterns: 'ستظهر الكلمات المستهدفة بعد إتمام أنشطة القراءة.',
        dyscalculiaSpatialAnalysis: 'غير منطبق.',
        interventionExercises: [],
        classroomAccommodations: [],
      },
    };

    // Pre-create battery session with full parent consent and selected dialect
    const speechDialect = (child.dialectCode as HomeDialect | undefined) || 'egyptian';
    const initialBatterySession: BatterySession = {
      studentId: newLearner.id,
      childName: newLearner.name,
      ageMonths: newLearner.ageYears * 12,
      examinerName: newLearner.sessionRoleLabel || 'ولي الأمر',
      startedAt: recordedAt,
      dialect: speechDialect,
      guardianConsentGiven: true,
      guardianConsentRecordedAt: recordedAt,
      guardianAudioConsentGiven: true,
      guardianAudioConsentRecordedAt: recordedAt,
      speechLocale: speechDialect === 'gulf' ? 'ar-SA' : 'ar-EG',
      results: {},
    };
    saveBatterySession(initialBatterySession);

    setStudents((prev) => {
      const next = [newLearner, ...prev.filter((s) => s.id !== newLearner.id)];
      saveStoredStudents(next);
      return next;
    });
    selectStudent(newLearner.id);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    if (currentUser) {
      const saved = await syncStudentToSupabase(newLearner, currentUser.id);
      if (saved) {
        setAiStatusBanner(`تم حفظ ملف الطفل «${child.name}» في قاعدة البيانات السحابية بنجاح ☁️`);
      }
    } else {
      setAiStatusBanner(`تم تسجيل بيانات الطفل «${child.name}» بنجاح! جاهز لبدء رحلة التعلم.`);
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
      return { success: false, error: 'كلمة المرور يجب أن لا تقل عن 6 خانات.' };
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
      return { success: false, error: 'تعذر توثيق الحساب. يرجى مراجعة البريد وكلمة المرور.' };
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
      setStudents((prev) => {
        const ids = new Set(mapped.map((s) => s.id));
        return [...mapped, ...prev.filter((p) => !ids.has(p.id))];
      });
    }

    setSupabaseAuthLoading(false);
    setAiStatusBanner(`تم ربط ملف طفلك بحسابك السحابي بنجاح ☁️ وحفظ بياناته في قاعدة البيانات.`);
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
                placeholder="أدخل رمز الوصول الخاص بمدرستك..."
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
              { id: 'dyslexia-lab', label: 'فحص مؤشرات عسر القراءة', icon: Brain },
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
              className="bz-btn bz-btn-primary shrink-0 whitespace-nowrap font-bold"
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
              ? `جلسة سحابية نشطة (Google): ${baseeraSession.accountName}`
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
              supabaseUser={supabaseUser || (baseeraSession ? { email: baseeraSession.accountName, id: baseeraSession.sessionId } : null)}
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
                setBaseeraSession(null);
                setAiStatusBanner('تم تسجيل الخروج بنجاح.');
              }}
              onRegisterChild={handleRegisterChildByParent}
              onLinkLocalChild={handleLinkLocalChild}
              onSelectStudent={(studentId, targetTab) => {
                selectStudent(studentId);
                setActiveTab(targetTab, true);
              }}
              onNavigateHome={() => setActiveTab('home')}
            />
          )}

        {/* VIEW 1: EDUCATIONAL INDICATORS DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Unified Executive Header & 4-Metric Hairline Ribbon (Single-Elevation, Zero Card-in-Card) */}
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>لوحة المتابعة</span>
                    <span aria-hidden="true">·</span>
                    <span>الصف {toArabicNum(selectedStudent.gradeLevel)}</span>
                    {selectedStudent.schoolName && selectedStudent.schoolName !== 'مدرستي' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{selectedStudent.schoolName}</span>
                      </>
                    )}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
                    ملخص التعلّم — {selectedStudent.name}
                  </h1>
                </div>

                {/* Active Student Quick Switcher & Primary Action */}
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="dashboard-student-select"
                    className="text-xs font-medium text-slate-500 whitespace-nowrap"
                  >
                    الطالب المحدد:
                  </label>
                  <select
                    id="dashboard-student-select"
                    value={selectedStudent.id}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#0284C7]"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — الصف {toArabicNum(s.gradeLevel)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="baseera-summary-grid">
                <article className="baseera-summary-card baseera-summary-blue">
                  <span className="baseera-summary-label">{selectedStudent.assessmentModality === 'voice_only' ? 'الطلاقة الشفوية' : selectedStudent.assessmentModality === 'reading_only' ? 'معدل إتمام النص المقاس' : 'مؤشر القراءة'}</span>
                  <strong>{selectedReadingRate === null ? 'لم يُقَس بعد' : toArabicNum(selectedReadingRate) + ' كلمة/دقيقة'}</strong>
                  <p>
                    {selectedStudent.sessionStatus !== 'completed'
                      ? 'ستظهر النتيجة بعد إكمال النشاط.'
                      : selectedReadingRate === null
                        ? 'لم تتوفر بيانات كافية لاحتساب السرعة.'
                        : selectedStudent.assessmentModality === 'voice_only'
                          ? hasVerifiedOralAudio(selectedStudent)
                            ? 'تقييم صوتي آلي موثق المصدر؛ المؤشرات وصفية وليست تشخيصًا.'
                            : 'لا توجد نتيجة صوتية موثقة لهذه الجلسة؛ لم يُحتسب معدل قراءة جهرية.'
                          : 'معدل مقاس لزمن إتمام النص؛ لا يقيس دقة الكلمات الفردية ولا يُقارن بمعيار الطلاقة الجهرية.'}
                  </p>
                </article>
                <article className="baseera-summary-card baseera-summary-mint">
                  <span className="baseera-summary-label">فهم النص</span>
                  <strong>{selectedStudent.sessionStatus === 'completed' ? toArabicNum(selectedStudent.comprehensionScore) + '٪' : 'لم يُقَس بعد'}</strong>
                  <p>ملخص إجابات أسئلة الفهم القرائي.</p>
                </article>
                <article className="baseera-summary-card baseera-summary-yellow">
                  <span className="baseera-summary-label">الطلاقة القرائية</span>
                  <strong>{hasVerifiedOralAudio(selectedStudent) && selectedStudent.oralWcpm != null ? toArabicNum(selectedStudent.oralWcpm) + ' كلمة/دقيقة' : 'لم تُقَس بعد'}</strong>
                  <p>عدد الكلمات الصحيحة في الدقيقة عند القراءة الجهرية.</p>
                  <button type="button" className="baseera-inline-action" onClick={() => setActiveTab('reading-lab')}>قياس القراءة الجهرية <ArrowLeft aria-hidden="true" size={15} /></button>
                </article>
                <article className="baseera-summary-card baseera-summary-lilac">
                  <span className="baseera-summary-label">خطوتك القادمة</span>
                  <strong>{selectedStudent.sessionStatus === 'completed' ? 'واصل التدرّب' : 'ابدأ بنشاط قصير'}</strong>
                  <p>اختر نشاطًا مناسبًا لمتابعة التدريب الذاتي في المنصة.</p>
                  <button type="button" className="baseera-inline-action" onClick={() => setActiveTab(selectedStudent.sessionStatus === 'completed' ? 'remediation-gym' : 'reading-lab')}>{selectedStudent.sessionStatus === 'completed' ? 'اذهب للتدريب' : 'ابدأ القراءة'} <ArrowLeft aria-hidden="true" size={15} /></button>
                </article>
              </div>
            </section>

            {/* Segmented sub-navigation for the dashboard's progressive-disclosure views */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div
                role="tablist"
                aria-label="أقسام لوحة القياس"
                className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={dashboardSubView === 'roster'}
                  onClick={() => setDashboardSubView('roster')}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                    dashboardSubView === 'roster'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>الطلاب ({toArabicNum(students.length)})</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={dashboardSubView === 'report'}
                  onClick={() => setDashboardSubView('report')}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                    dashboardSubView === 'report'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>تقرير الطالب</span>
                </button>
                {baseeraSession?.role === 'platform_admin' && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={dashboardSubView === 'demo_requests'}
                    onClick={() => {
                      setDashboardSubView('demo_requests');
                      void fetchDemoRequests();
                    }}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                      dashboardSubView === 'demo_requests'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>طلبات المدارس ({toArabicNum(demoRequests.length)})</span>
                  </button>
                )}
                {baseeraSession?.role === 'platform_admin' && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={dashboardSubView === 'metrics'}
                    onClick={() => setDashboardSubView('metrics')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                      dashboardSubView === 'metrics' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>مؤشرات الاستخدام</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
                  <span>
                    {isPersistedStoreLoaded
                      ? 'محفوظة في سجل المدرسة'
                      : 'محفوظة على هذا الجهاز فقط'}
                  </span>
                </span>
                {students.length > 1 && baseeraSession?.role === 'school_admin' && (
                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteStudentRecord(selectedStudent.id)
                    }
                    className="inline-flex items-center gap-1 text-rose-700 hover:underline font-medium shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>حذف السجل الحالي</span>
                  </button>
                )}
              </div>
            </div>

            {/* SUB-VIEW 1: STUDENT ROSTER & HEURISTIC INDICES */}
            {dashboardSubView === 'roster' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* 7 Cols: Clean Enterprise Data Table */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        سجل الطلاب ونتائج الجلسات
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        اختر طالبًا لعرض ملخصه وتقريره.
                      </p>
                      {baseeraSession && schoolRosterEmpty && (
                        <p className="mt-3 rounded-xl bg-sun-soft p-3 text-xs leading-relaxed text-ink-2">
                          لا يوجد طلاب في سجل المدرسة بعد. الصفوف أدناه أمثلة توضيحية وسجل هذا الجهاز، ولا تُحفظ في سجل المدرسة. أضف طالبًا من الصفحة الرئيسية أو أجرِ له فحص مؤشرات عسر القراءة ليظهر هنا.
                        </p>
                      )}
                    </div>

                    {/* Interactive Filter Tabs */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setSessionFilter('all')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          sessionFilter === 'all'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        الكل ({toArabicNum(students.length)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSessionFilter('completed')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          sessionFilter === 'completed'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        جلسات مكتملة
                      </button>
                      <button
                        type="button"
                        onClick={() => setSessionFilter('in_progress')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          sessionFilter === 'in_progress'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        قيد الاستكمال
                      </button>
                    </div>
                  </div>

                  {/* Search & Demo Toggle Toolbar */}
                  <div className="px-6 py-3.5 bg-slate-50/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ابحث باسم الطالب أو المدرسة..."
                        aria-label="ابحث باسم الطالب أو المدرسة"
                        className="w-full pr-9 pl-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setHideDemoRecords((prev) => !prev)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                    >
                      {hideDemoRecords
                        ? 'إظهار النماذج التوضيحية (4)'
                        : 'عرض الجلسات الفعلية فقط'}
                    </button>
                  </div>

                  {/* Table Body */}
                  {filteredStudents.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <p className="text-xs text-slate-500">
                        لا توجد سجلات طلاب مطابقة لمعايير الفلترة الحالية.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSessionFilter('all');
                          setHideDemoRecords(false);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
                      >
                        إعادة ضبط الفلاتر
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/40">
                            <th className="py-3 px-4">الطالب والصف</th>
                            <th className="py-3 px-3">الطلاقة</th>
                            <th className="py-3 px-3">الفهم</th>
                            <th className="py-3 px-3 hidden md:table-cell">دقة القراءة</th>
                            <th className="py-3 px-3 hidden md:table-cell">طريقة القياس</th>
                            <th className="py-3 px-4">فحص المؤشرات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredStudents.map((stu) => {
                            const isSelected = stu.id === selectedStudent.id;
                            return (
                              <tr
                                key={stu.id}
                                onClick={() => setSelectedStudentId(stu.id)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-sky-50/70'
                                    : 'hover:bg-slate-50/80'
                                }`}
                              >
                                <td className="py-3.5 px-4">
                                  <div className="text-slate-900 font-semibold">
                                    {stu.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    الصف {toArabicNum(stu.gradeLevel)}
                                    {stu.isDemoRecord ? ' · مثال توضيحي' : stu.id === 'stu-guest' ? ' · على هذا الجهاز' : ''}
                                  </div>
                                </td>
                                <td className="py-3.5 px-3 bz-num text-slate-900 font-medium">
                                  {stu.sessionStatus !== 'completed'
                                    ? '—'
                                    : toArabicNum(stu.assessmentModality === 'voice_only'
                                      ? hasVerifiedOralAudio(stu)
                                        ? (stu.wcpm ?? stu.oralWcpm ?? 'غير متاح')
                                        : 'غير متاح'
                                      : (stu.wpm > 0 ? stu.wpm : 'غير متاح'))}
                                  <span className="text-[10px] text-slate-500"> {stu.sessionStatus === 'completed' ? 'ك/د' : ''}</span>
                                </td>
                                <td className="py-3.5 px-3 bz-num text-slate-900">
                                  {stu.sessionStatus === 'completed' ? toArabicNum(stu.comprehensionScore) + '٪' : '—'}
                                </td>
                                <td className="py-3.5 px-3 hidden md:table-cell bz-num text-slate-700">
                                  {stu.sessionStatus === 'completed' && hasVerifiedOralAudio(stu) && typeof stu.oralAccuracyPercent === 'number' ? toArabicNum(stu.oralAccuracyPercent) + '٪' : '—'}
                                </td>
                                <td className="py-3.5 px-3 hidden md:table-cell">
                                  <span className="baseera-evidence-status">
                                    {stu.sessionStatus !== 'completed'
                                      ? 'لم يُقَس بعد'
                                      : hasVerifiedOralAudio(stu)
                                        ? 'تقييم صوتي آلي موثق'
                                        : stu.assessmentModality === 'voice_only'
                                          ? 'لا توجد درجة صوتية موثقة'
                                          : 'قراءة موقوتة'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <BatteryRiskBadge student={stu} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Footer Action Bar */}
                  <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-slate-600">
                      الطالب النشط:{' '}
                      <strong className="text-slate-900">
                        {selectedStudent.name}
                      </strong>
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('reading-lab')}
                        className="font-semibold text-[#2563EB] hover:underline cursor-pointer"
                      >
                        بدء نشاط قراءة جديد ←
                      </button>
                      <span aria-hidden="true" className="text-slate-300">
                        |
                      </span>
                      <button
                        type="button"
                        onClick={() => setDashboardSubView('report')}
                        className="font-semibold text-slate-700 hover:text-slate-900 hover:underline cursor-pointer"
                      >
                        عرض التقرير وخطة المساندة ←
                      </button>
                    </div>
                  </div>
                </div>

                <aside className="baseera-next-steps-card lg:col-span-5">
                  <span className="baseera-section-kicker">خطوة صغيرة تالية</span>
                  <h2>أنشطة مساندة مقترحة</h2>
                  <p className="baseera-next-steps-intro">اختر نشاطًا تدريبيًا بناءً على ما تمّ في الجلسة، لا على درجة خطورة.</p>
                  <div className="baseera-support-item">
                    <span className="baseera-support-icon"><BookOpen aria-hidden="true" size={21} /></span>
                    <div>
                      <strong>قراءة مريحة</strong>
                      <p>اقرأ نصًا قصيرًا مرة أخرى، ثم استمع إلى الكلمات التي تحتاج إلى توضيح.</p>
                    </div>
                  </div>
                  <div className="baseera-support-item">
                    <span className="baseera-support-icon mint"><Type aria-hidden="true" size={21} /></span>
                    <div>
                      <strong>تمييز المقاطع والكلمات</strong>
                      <p>استخدم القارئ الميسّر لتقسيم الكلمات وتغيير المسافات وحجم النص.</p>
                    </div>
                  </div>
                  <div className="baseera-support-item">
                    <span className="baseera-support-icon yellow"><Sparkles aria-hidden="true" size={21} /></span>
                    <div>
                      <strong>تحدي الدقائق الخمس</strong>
                      <p>تحدي الدقائق الخمس لتثبيت مخارج الحروف وقراءة الكلمات بالتشكيل التام.</p>
                    </div>
                  </div>
                  <div className="baseera-support-actions">
                    <button type="button" className="baseera-primary-action" onClick={() => setActiveTab('remediation-gym')}>ابدأ التدريب <ArrowLeft aria-hidden="true" size={17} /></button>
                    <button type="button" className="baseera-secondary-action" onClick={() => setActiveTab('adaptive-reader')}>القارئ الميسّر</button>
                  </div>
                </aside>
              </div>
            )}
            {/* SUB-VIEW 3: LEARNING PERFORMANCE SUMMARY & SUPPORT PLAN */}
            {dashboardSubView === 'report' && !selectedStudent.isDemoRecord && (
              <BatterySummaryPanel student={selectedStudent} onOpen={() => setActiveTab('dyslexia-lab')} />
            )}
            {dashboardSubView === 'report' && !selectedStudent.isDemoRecord && (
              <TrainingProgressPanel student={selectedStudent} />
            )}
            {dashboardSubView === 'report' && !selectedStudent.isDemoRecord && (
              <IndividualPlanPanel
                student={selectedStudent}
                progress={selectedStudent.trainingProgress ?? null}
                onRecordUpdated={(updated) => {
                  setStudents((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
                  if (supabaseUser) void syncStudentToSupabase(updated, supabaseUser.id);
                }}
              />
            )}
            {dashboardSubView === 'report' && (
              <section id="student-report-content" className="print-report-root bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="p-6 sm:p-8 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1 flex flex-wrap items-center gap-2">
                      <span>تقرير القراءة</span>
                      {selectedStudent.sessionStatus === 'completed' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          المصدر: {selectedStudent.evidenceProvenanceLabelAr || (selectedStudent.isDemoRecord ? 'بيانات توضيحية' : 'جلسة مسجّلة')}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {selectedStudent.name}: النتائج وما نتدرّب عليه
                    </h2>
                  </div>

                  <div className="no-print flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    طباعة التقرير / حفظ PDF
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const shareText = [
                        'ملخص أداء تعليمي — نسخة مجهولة الهوية',
                        'اسم الطالب: محذوف للخصوصية',
                        `الصف: ${selectedStudent.gradeLevel}`,
                        `التاريخ: ${selectedStudent.lastScreenedDate || 'لم تُسجل جلسة مكتملة'}`,
                        `سرعة القراءة: ${selectedStudent.sessionStatus === 'in_progress' ? 'غير متاحة — الجلسة غير مكتملة' : `${selectedStudent.wpm} كلمة/دقيقة`}`,
                        `الكلمات المستهدفة للتدريب: ${(selectedStudent.problematicWords || []).join('، ') || 'لم تُحدد بعد'}`,
                        'تقرير تقييم الأداء القرائي واللغوي.',
                      ].join('\n');
                      try {
                        if (navigator.share) {
                          await navigator.share({ title: 'تقرير هَيَّا نَقْرَأْ للتقييم القرائي', text: shareText });
                        } else if (navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(shareText);
                          setAiStatusBanner('نُسخ ملخص التقرير إلى الحافظة للمشاركة.');
                        } else {
                          setAiStatusBanner('المشاركة المباشرة غير مدعومة في هذا المتصفح. استخدم طباعة التقرير لحفظه PDF.');
                        }
                      } catch (error) {
                        if (!(error instanceof DOMException && error.name === 'AbortError')) {
                          setAiStatusBanner('تعذرت المشاركة من المتصفح. يمكنك طباعة التقرير وحفظه PDF.');
                        }
                      }
                    }}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    مشاركة الملخص
                  </button>
                  <button
                    type="button"
                    disabled={isUpdatingReport || baseeraSession?.role !== 'school_admin' || selectedStudent.sessionStatus !== 'completed'}
                    title={baseeraSession?.role === 'educator_readonly' ? 'صلاحية القراءة فقط لا تتيح إنشاء تقرير على الخادم' : undefined}
                    onClick={handleRefreshLearningReport}
                    className="bz-btn bz-btn-primary bz-btn-sm whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {isUpdatingReport
                        ? 'جارٍ تحديث التقرير...'
                        : 'تحديث التقرير'}
                    </span>
                  </button>
                  </div>
                </div>

                {selectedStudent.assessmentHistory && selectedStudent.assessmentHistory.length > 0 && (
                  <section aria-label='سجل جلسات الفحص السابقة' className='border-b border-slate-200 bg-slate-50/70 p-6 sm:p-8 space-y-4'>
                    <div>
                      <h3 className='text-sm font-bold text-slate-900'>سجل المتابعة</h3>
                      <p className='mt-1 text-xs leading-relaxed text-slate-600'>سجل المتابعة الزمنية لجلسات الطالب لمقارنة تطور مؤشرات إتمام النص، وفهم المقروء، والوعي الفونولوجي عبر الزمن.</p>
                    </div>
                    <ol className='space-y-3'>
                      {[...selectedStudent.assessmentHistory].reverse().map((snapshot, index) => (
                        <li key={snapshot.sessionId} className='rounded-xl border border-slate-200 bg-white p-4'>
                          <div className='flex flex-wrap items-center justify-between gap-2'>
                            <span className='text-xs font-bold text-slate-900'>الجلسة السابقة {selectedStudent.assessmentHistory!.length - index}</span>
                            <time dateTime={snapshot.completedAt} className='text-xs text-slate-500'>
                              {Number.isFinite(Date.parse(snapshot.completedAt)) ? new Date(snapshot.completedAt).toLocaleString('ar-EG') : 'تاريخ غير متاح'}
                            </time>
                          </div>
                          <div className='mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-700'>
                            <span>{snapshot.assessmentModality === 'voice_only' ? 'WCPM الشفوية' : snapshot.assessmentModality === 'reading_only' ? 'معدل إتمام النص المقاس' : 'معدل القراءة المسجل'}: <strong>{snapshot.assessmentModality === 'voice_only'
                              ? snapshot.aiAssessmentVerified === true && snapshot.evidenceProvenance === 'server-verified-audio'
                                ? (snapshot.wcpm ?? 'غير متاح')
                                : 'غير متاح'
                              : snapshot.wpm} كلمة/دقيقة</strong></span>
                            <span>الفهم: <strong>{snapshot.comprehensionScore}%</strong></span>
                            <span>الوعي الصوتي: <strong>{snapshot.cognitiveResults?.phonemicAwarenessScorePercent ? `${snapshot.cognitiveResults.phonemicAwarenessScorePercent}%` : 'مكتمل'}</strong></span>
                          </div>
                          {snapshot.aiAssessmentVerified === true && snapshot.evidenceProvenance === 'server-verified-audio' && (snapshot.problematicWords || []).length > 0 && (
                            <p className='mt-2 text-xs leading-relaxed text-slate-600'>
                              كلمات استهدفتها الجلسة: {(snapshot.problematicWords || []).join('، ')}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
                {/* Hairline-Divided 2x2 Analytical Matrix (Zero Card-in-Card Nesting) */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-200 border-b border-slate-200">
                  <div className="p-6 sm:p-8 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        ملخص الأداء
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {selectedStudent.learningReport.learningSummary}
                      </p>
                    </div>
                    <div className="pt-6 border-t border-slate-200 space-y-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        الطلاقة والقراءة الجهرية
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {selectedStudent.sessionStatus !== 'completed'
                          ? 'ستظهر الملاحظات بعد إكمال نشاط القراءة.'
                          : selectedStudent.assessmentModality === 'voice_only'
                            ? hasVerifiedOralAudio(selectedStudent)
                              ? 'اكتمل التحليل الصوتي الآلي الموثق. سرعة الكلمات الصحيحة المقاسة: ' + (selectedStudent.wcpm ?? selectedStudent.oralWcpm ?? 'غير متاحة') + ' كلمة/دقيقة. هذه مؤشرات وصفية ولا تشخّص عسر القراءة.'
                              : 'لم تُحتسب درجة قراءة جهرية؛ لا يُستخدم تفريغ المتصفح أو التصحيح اليدوي لإثبات صحة الكلمات.'
                            : 'سرعة القراءة الموقوتة المسجّلة: ' + (selectedStudent.wpm > 0 ? selectedStudent.wpm : 'غير متاحة') + ' كلمة/دقيقة، ونتيجة الفهم: ' + selectedStudent.comprehensionScore + '%. هذه مؤشرات تعليمية مسجلة.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        الأخطاء المتكررة في الأصوات والكلمات
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {
                          selectedStudent.learningReport
                            .orthographicAndPhonologicalPatterns
                        }
                      </p>
                    </div>
                    <div className="pt-6 border-t border-slate-200 space-y-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        ما الذي نتدرّب عليه؟
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {selectedStudent.sessionStatus === 'completed'
                          ? 'تمرين يومي قصير لربط الحروف بحركاتها القصيرة، ثم قراءة نصوص مشكولة في القارئ الميسّر، مع تحدي الدقائق الخمس لبناء الطلاقة.'
                          : 'تظهر التوصيات بعد أول نشاط قراءة أو بعد فحص مؤشرات عسر القراءة.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actionable Daily Exercises & Classroom Accommodations */}
                <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-slate-50/40">
                  <div className="lg:col-span-7 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      أنشطة يومية مقترحة
                    </h3>
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
                      {selectedStudent.learningReport.interventionExercises.length > 0 ? (
                        selectedStudent.learningReport.interventionExercises.map(
                          (ex, idx) => (
                            <div
                              key={idx}
                              className="p-4 flex items-start justify-between gap-4"
                            >
                              <div className="space-y-1">
                                <div className="text-xs font-bold text-slate-900">
                                  {toArabicNum(idx + 1)}. {ex.title}
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                  {ex.description}
                                </p>
                              </div>
                              <span className="text-xs bz-num font-semibold text-[#0284C7] shrink-0">
                                {toArabicNum(ex.durationMinutes)} {ex.durationMinutes > 10 ? 'دقيقة' : 'دقائق'}
                              </span>
                            </div>
                          )
                        )
                      ) : (
                        <div className="p-4 text-xs text-slate-600 leading-relaxed">
                          تظهر الأنشطة المقترحة بعد أول نشاط قراءة.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-900">
                        تيسيرات مقترحة في الصف
                      </h3>
                      <ul className="space-y-2.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-xl p-5">
                        {selectedStudent.learningReport.classroomAccommodations.length > 0 ? (
                          selectedStudent.learningReport.classroomAccommodations.map(
                            (acc, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-[#0284C7] font-bold">·</span>
                                <span>{acc}</span>
                              </li>
                            )
                          )
                        ) : (
                          <li className="text-slate-600 leading-relaxed">
                            تظهر التيسيرات المقترحة بعد أول نشاط قراءة.
                          </li>
                        )}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('adaptive-reader')}
                      className="bz-btn bz-btn-primary bz-btn-block"
                    >
                      <span>افتح القارئ الميسّر</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* SUB-VIEW 3: SCHOOL & INSTITUTION DEMO REQUESTS (RBAC: LEADS:MANAGE / PLATFORM_ADMIN ONLY) */}
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
                      سجل آمن ومشفر بطلبات المدارس الواردة عبر النموذج الرسمي. راجع الطلبات من لوحة المنصة؛ لا يضمن النموذج موعداً ثابتاً للتواصل.
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
                  <div className="py-12 text-center text-xs text-slate-500">جارٍ جلب وتفريغ الطلبات المشفرة...</div>
                ) : demoRequestsError ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
                    {demoRequestsError}
                  </div>
                ) : demoRequests.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    لا توجد طلبات تجربة جديدة مسجلة حالياً في المخزن المشفر.
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
                                تحديد كـ: تم التواصل
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
                              حذف وتطهير الطلب نهائياً
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

        {/* UNIFIED DYSLEXIA SCREENING & DIAGNOSTIC HUB (All Reading Tests in One Creative Hub) */}
        {(activeTab === 'dyslexia-lab' || activeTab === 'reading-lab' || activeTab === 'cognitive-lab' || activeTab === 'guided-program') && (
          !supabaseUser && !baseeraSession ? (
            <ParentPortalView
              supabaseUser={null}
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
                setBaseeraSession(null);
                setAiStatusBanner('تم تسجيل الخروج بنجاح.');
              }}
              onRegisterChild={handleRegisterChildByParent}
              onLinkLocalChild={handleLinkLocalChild}
              onSelectStudent={(studentId, targetTab) => {
                selectStudent(studentId);
                setActiveTab(targetTab, true);
              }}
              onNavigateHome={() => setActiveTab('home')}
            />
          ) : (
            <DyslexiaScreeningHub
              students={students}
              activeStudent={selectedStudent}
              onSelectStudent={selectStudent}
              onNavigateTab={(tab) => setActiveTab(tab)}
              supabaseUser={supabaseUser || (baseeraSession ? { email: baseeraSession.accountName, id: baseeraSession.sessionId } : null)}
              initialSubTab={
                activeTab === 'cognitive-lab'
                  ? 'cognitive-screening'
                  : activeTab === 'reading-lab'
                    ? 'oral-reading'
                    : activeTab === 'guided-program'
                      ? 'training'
                      : 'battery'
              }
              onCompleteOralSession={handleCompleteNewSession}
              onCreateLearner={handleCreateBatteryLearner}
              onStudentUpdated={(updated) => {
                const existing = students.find((student) => student.id === updated.id);
                const batteryChanged = Boolean(
                  supabaseUser &&
                  !baseeraSession &&
                  updated.cognitiveBattery &&
                  JSON.stringify(updated.cognitiveBattery) !== JSON.stringify(existing?.cognitiveBattery)
                );

                // Family cognitive-battery records pass through the receipt-validating server.
                // Serialize writes per child so two rapid subtest completions cannot race while
                // the server consumes their one-use Azure receipts.
                if (batteryChanged && updated.cognitiveBattery) {
                  const previousSave = parentBatterySyncQueue.current.get(updated.id) ?? Promise.resolve();
                  const nextSave = previousSave.catch(() => undefined).then(async () => {
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
                    if (!response.ok || !payload?.student) {
                      throw new Error(payload?.error || `family battery save failed: ${response.status}`);
                    }
                    setStudents((prev) => prev.map((student) =>
                      student.id === updated.id ? { ...student, ...payload.student! } : student
                    ));
                    if (updated.trainingProgress) {
                      void syncTrainingProgressToSupabase(payload.student, supabaseUser!.id);
                    }
                  }).catch(() => {
                    setAiStatusBanner('تعذر حفظ نتائج الفحص الصوتي بأمان في حساب الأسرة؛ بقيت النتائج على هذا الجهاز ولم تُعتمد سحابيًا.');
                  });
                  parentBatterySyncQueue.current.set(updated.id, nextSave);
                  void nextSave.finally(() => {
                    if (parentBatterySyncQueue.current.get(updated.id) === nextSave) {
                      parentBatterySyncQueue.current.delete(updated.id);
                    }
                  });
                  return;
                }

                setStudents((prev) => prev.map((student) => (student.id === updated.id ? { ...student, ...updated } : student)));
                if (supabaseUser && !baseeraSession) {
                  void syncStudentToSupabase(updated, supabaseUser.id).then((saved) => {
                    if (saved && updated.trainingProgress) void syncTrainingProgressToSupabase(updated, supabaseUser.id);
                  });
                }
              }}
              onCompleteCognitiveScreening={(cogData) => {
                setStudents(prev => prev.map(student =>
                  student.id === selectedStudent.id
                    ? { ...student, cognitiveResults: cogData }
                    : student
                ));
                setActiveTab('dashboard');
              }}
            />
          )
        )}

        {/* NEW: ADAPTIVE REPORTS */}



        {/* VIEW 4: REMEDIATION GYM & STATIONS */}
        {activeTab === 'remediation-gym' && (
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
        {activeTab === 'sprint' && (
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
        {activeTab === 'storygen' && (
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

        {activeTab === 'adaptive-reader' && (
          <ReaderPage
            problematicWords={selectedStudent.sessionStatus === 'completed' && hasVerifiedOralAudio(selectedStudent) ? (selectedStudent.problematicWords || []) : []}
            studentName={selectedStudent.name}
            passageId={selectedStudent.passageId}
          />
        )}

        {activeTab === 'privacy' && <PrivacyPolicyView />}
        {activeTab === 'terms' && <TermsOfUseView />}
        {activeTab === 'content-review' && <ContentReviewView />}
        </div>
        </Suspense>
      </main>

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
                <li><button type="button" onClick={() => setActiveTab('dyslexia-lab')}>فحص مؤشرات عسر القراءة</button></li>
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
                <li><button type="button" onClick={() => setActiveTab('cognitive-lab')}>التسمية السريعة</button></li>
              </ul>
            </div>
            <div className="baseera-footer-col">
              <h2>الثقة والخصوصية</h2>
              <ul>
                <li><button type="button" onClick={() => setActiveTab('privacy')}>سياسة الخصوصية</button></li>
                <li><button type="button" onClick={() => setActiveTab('terms')}>شروط الاستخدام</button></li>
              </ul>
            </div>
            <p className="baseera-footer-note">
              <span>© ٢٠٢٦ هَيَّا نَقْرَأْ</span>
              <span>أداة فرز وتدريب تعليمية، وليست تشخيصًا طبيًا. التشخيص يتم لدى مختص مؤهل.</span>
            </p>
          </div>
        </footer>
      )}
    </div>
    </AssessmentProvider>
  );
}
