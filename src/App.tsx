import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Eye,
  BarChart3,
  Home,
  BookOpen,
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
} from 'lucide-react';
import {
  INITIAL_STUDENTS,
  ARABIC_READING_PASSAGES,
  StudentRecord,
} from './data/seedData';
import {
  authenticatedFetch,
  clearClinicalSession,
  logoutClinicalSession,
  getStoredClinicalSession,
  loginClinicalSession,
  getTenantDisplayLabelAr,
  ClinicalSessionInfo,
} from './utils/apiAuth';
import { AssessmentProvider } from './contexts/AssessmentContext';
import EyeTrackingLabView from './components/EyeTrackingLabView';
import ProfessionalEyeTracking from './components/ProfessionalEyeTracking';
import RealEyeCalibration from './components/RealEyeCalibration';
import ArabicSpeechAnalysis from './components/ArabicSpeechAnalysis';
import TactileAnalytics from './components/TactileAnalytics';
import AdaptiveReports from './components/AdaptiveReports';
import { DyscalculiaLabView } from './components/DyscalculiaLabView';
import { AdaptiveReaderView } from './components/AdaptiveReaderView';
import RemediationGymView from './components/RemediationGymView';
import { ClinicalAlgorithmsView } from './components/ClinicalAlgorithmsView';
import { PrivacyPolicyView } from './components/PrivacyPolicyView';
import { HomeLandingView, AppTabId } from './components/HomeLandingView';
import {
  DyslexiaComfortBar,
  DyslexiaSurfaceTheme,
  DyslexiaSpacingMode,
} from './components/DyslexiaComfortBar';

type ActiveTab = AppTabId;

type DashboardSubView = 'roster' | 'report';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' || params.get('tab') === 'dashboard') {
        return 'dashboard';
      }
    }
    return 'home';
  });
  const [dashboardSubView, setDashboardSubView] =
    useState<DashboardSubView>('roster');
  const [students, setStudents] = useState<StudentRecord[]>(INITIAL_STUDENTS);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    INITIAL_STUDENTS[0].id
  );
  const [isPersistedStoreLoaded, setIsPersistedStoreLoaded] =
    useState<boolean>(false);
  const [clinicalSession, setClinicalSession] =
    useState<ClinicalSessionInfo | null>(() => getStoredClinicalSession());
  const [pendingServerRecord, setPendingServerRecord] =
    useState<StudentRecord | null>(null);
  const [showClinicalLogin, setShowClinicalLogin] = useState<boolean>(false);
  const [clinicalAccessCode, setClinicalAccessCode] = useState<string>('');
  const [clinicalLoginError, setClinicalLoginError] = useState<string>('');
  const [isClinicalLoggingIn, setIsClinicalLoggingIn] = useState<boolean>(false);

  // Roster filtering & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'nominal'>(
    'all'
  );
  const [hideDemoRecords, setHideDemoRecords] = useState<boolean>(false);

  // Live Gemini AI re-analysis state
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiStatusBanner, setAiStatusBanner] = useState<string>('');

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
    if (!clinicalSession?.token) return;
    let cancelled = false;
    authenticatedFetch('/api/students')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.students)) {
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
  }, [clinicalSession?.token]);

  const selectedStudent =
    students.find((s) => s.id === selectedStudentId) || students[0];

  const selectedReadingRate = (() => {
    if (selectedStudent.sessionStatus !== 'completed') return null;
    if (selectedStudent.assessmentModality === 'voice_only') {
      const hasOralEvidence =
        Boolean((selectedStudent.spokenTranscript || '').trim()) ||
        selectedStudent.teacherVerified === true;
      const oralRate = selectedStudent.wcpm ?? selectedStudent.oralWcpm;
      return hasOralEvidence && typeof oralRate === 'number' && Number.isFinite(oralRate)
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

    // Incomplete sessions are not yet classifiable as high-risk or within-average.
    if (s.sessionStatus === 'in_progress') {
      return riskFilter === 'all';
    }
    if (riskFilter === 'high') {
      return s.readingRiskLevel === 'high' || s.mathRiskLevel === 'high';
    }
    if (riskFilter === 'nominal') {
      return (
        s.readingRiskLevel === 'nominal' &&
        (s.mathRiskLevel === 'nominal' || s.mathRiskLevel === 'unassessed')
      );
    }
    return true;
  });

  const snapshotCompletedSession = (record: StudentRecord) => ({
    sessionId: `session-${record.id}-${Date.now()}`,
    completedAt: record.sessionCompletedAt || (Number.isFinite(Date.parse(record.lastScreenedDate)) ? new Date(record.lastScreenedDate).toISOString() : 'unknown'),
    passageId: record.passageId,
    assessmentModality: record.assessmentModality,
    wcpm: record.wcpm ?? record.oralWcpm ?? null,
    teacherVerified: record.teacherVerified === true,
    wpm: record.wpm,
    avgFixationMs: record.avgFixationMs,
    regressionRate: record.regressionRate,
    comprehensionScore: record.comprehensionScore,
    problematicWords: [...(record.problematicWords || [])],
    dyslexiaRiskScore: record.dyslexiaRiskScore,
    readingHeuristicIndicator: record.readingHeuristicIndicator,
    readingRiskLevel: record.readingRiskLevel,
    subitizingAccuracy: record.subitizingAccuracy,
    numberLinePAE: record.numberLinePAE,
    transcodingAccuracy: record.transcodingAccuracy,
    dyscalculiaRiskScore: record.dyscalculiaRiskScore,
    mathRiskLevel: record.mathRiskLevel,
  });

  // Only raw evidence & consent fields are sent to the server; scores and reports are derived server-side.
  const sessionPayloadFromRecord = (record: StudentRecord) => ({
    sessionRoleLabel: record.sessionRoleLabel,
    passageId: record.passageId,
    dialectCode: record.dialectCode || record.dialect || 'egyptian',
    dialectRegionAr: record.dialectRegionAr,
    assessmentModality: record.assessmentModality || 'reading_only',
    readingDurationSeconds:
      record.readingDurationSeconds ??
      Math.max(
        4,
        Math.ceil(
          (record.fixations || []).reduce(
            (sum, f) => sum + (f.observed ? f.durationMs : 0),
            0
          ) / 1000
        ) + 2
      ),
    blinkCount: record.blinkCount ?? 0,
    ...(record.calibrationAccuracyPercent !== undefined
      ? { calibrationAccuracyPercent: record.calibrationAccuracyPercent }
      : {}),
    ...(record.calibrationValidationMethod
      ? { calibrationValidationMethod: record.calibrationValidationMethod }
      : {}),
    oralReadingAssessed: record.oralReadingAssessed,
    spokenTranscript: record.spokenTranscript,
    wcpm: record.wcpm ?? record.oralWcpm ?? null,
    oralWcpm: record.oralWcpm ?? record.wcpm ?? null,
    oralAccuracyPercent: record.oralAccuracyPercent ?? null,
    teacherVerified: record.teacherVerified === true,
    teacherVerifierRole: record.teacherVerifierRole,
    teacherVerificationTimestamp: record.teacherVerificationTimestamp,
    teacherWordOverridesCount: record.teacherWordOverridesCount,
    verifiedWordsAlignment: record.verifiedWordsAlignment,
    phoneticSubstitutionCount: record.phoneticSubstitutionCount,
    dialectVariantCount: record.dialectVariantCount,
    omissionCount: record.omissionCount,
    fixations: record.fixations || [],
    ...(record.comprehensionAnswers
      ? { comprehensionAnswers: record.comprehensionAnswers }
      : {}),
    dyscalculiaAssessed: record.dyscalculiaAssessed,
    ...(record.mathTrials ? { mathTrials: record.mathTrials } : {}),
    guardianConsentGiven: record.guardianConsentGiven === true,
    guardianConsentRecordedAt: record.guardianConsentRecordedAt || (record.guardianConsentGiven ? new Date().toISOString() : undefined),
    guardianConsentSource: record.guardianConsentSource || (record.guardianConsentGiven ? 'إقرار ولي الأمر والمدرسة' : undefined),
    guardianAudioConsentGiven: record.guardianAudioConsentGiven === true,
    guardianAudioConsentRecordedAt:
      record.guardianAudioConsentRecordedAt ||
      (record.guardianAudioConsentGiven
        ? (record.sessionCompletedAt || new Date().toISOString())
        : undefined),
    speechRecognitionUsed: record.speechRecognitionUsed === true,
    audioRecordingStarted: record.audioRecordingStarted === true,
  });

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
        ? newRecord.guardianConsentRecordedAt || new Date().toISOString()
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
          ? newRecord.guardianConsentSource || 'إقرار صريح داخل واجهة الفحص'
          : undefined,
    };
    setStudents((prev) => [
      completedRecord,
      ...prev.filter((student) => student.id !== completedRecord.id),
    ]);
    setSelectedStudentId(completedRecord.id);
    setActiveTab('dashboard');
    setDashboardSubView('report');
    if (!clinicalSession) {
      setPendingServerRecord(completedRecord);
      setAiStatusBanner('اكتملت الجلسة على هذا الجهاز فقط؛ لم تُحفظ في الخادم. سجّل الدخول لحفظها في التخزين المشفر.');
      setShowClinicalLogin(true);
      return;
    }
    if (clinicalSession.role !== 'clinician') {
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
        setAiStatusBanner(`تم حفظ جلسة الفحص للطالب (${completedRecord.name}) في التخزين المشفر.`);
      } else {
        const data = await response.json().catch(() => ({}));
        setPendingServerRecord(completedRecord);
        setAiStatusBanner(data?.error || 'لم يُحفظ السجل في الخادم. بقيت نسخة محلية لإعادة المحاولة بعد تسجيل الدخول.');
        if (response.status === 401) {
          clearClinicalSession();
          setClinicalSession(null);
          setShowClinicalLogin(true);
        }
      }
    } catch {
      setPendingServerRecord(completedRecord);
      setAiStatusBanner('تعذر الاتصال بالخادم؛ السجل موجود على هذا الجهاز فقط ولم يُحفظ في الخادم.');
    }
  };

  const handleStartMockUserJourney = (
    name: string,
    grade: number,
    roleLabel: string,
    guardianConsent?: {
      guardianName: string;
      guardianRelationship: string;
      guardianConsentGiven: boolean;
      guardianAudioConsentGiven: boolean;
      guardianConsentRecordedAt: string;
      guardianConsentSource: string;
    }
  ) => {
    if (clinicalSession?.role === 'educator_readonly') {
      setAiStatusBanner('رمزك يمنح صلاحية القراءة فقط. لا يمكنك إنشاء ملفات طلاب أو حفظ نتائج جديدة.');
      return;
    }
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) {
      setAiStatusBanner('أدخل اسمًا مستعارًا أو تجريبيًا للمتابعة. لا تستخدم بيانات طفل حقيقية في هذه النسخة.');
      return;
    }

    const consentGiven = guardianConsent?.guardianConsentGiven === true;
    const consentRecordedAt = consentGiven
      ? (guardianConsent?.guardianConsentRecordedAt || new Date().toISOString())
      : undefined;
    const consentSource = consentGiven
      ? (guardianConsent?.guardianConsentSource || `إقرار ولي الأمر (${guardianConsent?.guardianName || 'ولي الأمر'} - ${guardianConsent?.guardianRelationship || 'الوصي'})`)
      : undefined;
    const audioConsentGiven = guardianConsent?.guardianAudioConsentGiven === true;

    const existing = students.find(
      (student) =>
        !student.isDemoRecord &&
        student.name.trim().replace(/\\s+/g, ' ') === cleanName.replace(/\\s+/g, ' ')
    );
    if (existing) {
      if (existing.sessionStatus === 'completed') {
        const resumedRecord: StudentRecord = {
          ...existing,
          sessionStatus: 'in_progress',
          sessionCompletedAt: undefined,
          sessionRoleLabel: roleLabel,
          assessmentHistory: [...(existing.assessmentHistory || []), snapshotCompletedSession(existing)],
          guardianConsentGiven: consentGiven,
          guardianConsentRecordedAt: consentRecordedAt,
          guardianConsentSource: consentSource,
          guardianName: guardianConsent?.guardianName,
          guardianRelationship: guardianConsent?.guardianRelationship,
          guardianAudioConsentGiven: audioConsentGiven,
          guardianAudioConsentRecordedAt: audioConsentGiven ? consentRecordedAt : undefined,
          speechRecognitionUsed: audioConsentGiven,
          lastScreenedDate: '',
        };
        setStudents((prev) => prev.map((student) => student.id === existing.id ? resumedRecord : student));
      }
      setSelectedStudentId(existing.id);
    } else {
      const newStudent: StudentRecord = {
        id: `stu-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)}`,
        name: cleanName,
        sessionStatus: 'in_progress',
        sessionRoleLabel: roleLabel,
        assessmentHistory: [],
        gradeLevel: grade,
        ageYears: grade + 6,
        schoolName: 'لم تُحدّد المدرسة',
        lastScreenedDate: '',
        passageId: ARABIC_READING_PASSAGES.find((passage) => passage.gradeLevel === grade)?.id || ARABIC_READING_PASSAGES[0].id,
        guardianConsentGiven: consentGiven,
        guardianConsentRecordedAt: consentRecordedAt,
        guardianConsentSource: consentSource,
        guardianName: guardianConsent?.guardianName,
        guardianRelationship: guardianConsent?.guardianRelationship,
        guardianAudioConsentGiven: audioConsentGiven,
        guardianAudioConsentRecordedAt: audioConsentGiven ? consentRecordedAt : undefined,
        speechRecognitionUsed: audioConsentGiven,
        wpm: 0,
        avgFixationMs: 0,
        regressionRate: 0,
        regressionCount: 0,
        dyslexiaRiskScore: null,
        readingHeuristicIndicator: null,
        readingRiskLevel: 'unassessed',
        readingRiskLabelAr: 'لم تُسجّل بعد قياسات القراءة.',
        problematicWords: [],
        fixations: [],
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
        mathRiskLabelAr: 'لم يُجرَ اختبار الحساب بعد',
        clinicalReport: {
          clinicalSummary: 'لم تكتمل جلسة القراءة بعد، لذلك لا توجد مؤشرات يمكن تفسيرها.',
          ocularMotorAnalysis: 'لا توجد بيانات نظر مكتملة لهذه الجلسة.',
          orthographicAndPhonologicalPatterns: 'ستظهر الكلمات المستهدفة بعد إتمام القراءة وتوفر نص منطوق فعلي.',
          dyscalculiaSpatialAnalysis: 'لم يُستكمل فحص الحساب بعد.',
          interventionExercises: [],
          classroomAccommodations: [],
        },
      };
      setStudents((prev) => [newStudent, ...prev]);
      setSelectedStudentId(newStudent.id);
    }
    setActiveTab('eye-lab');
    setAiStatusBanner(
      `بدأت جلسة جديدة لـ «${cleanName}» (الصف ${grade}). لا تُعرض نتيجة فرز قبل إكمال الجلسة.`
    );
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
    if (!clinicalSession || clinicalSession.role !== 'clinician') {
      setStudents((prev) =>
        prev.map((student) =>
          student.id === studentId ? { ...student, ...updated } : student
        )
      );
      setAiStatusBanner(clinicalSession
        ? 'رمزك للقراءة فقط؛ حُفظت النتيجة محليًا فقط ولم تُحفظ في الخادم.'
        : 'حُفظت نتيجة الحساب محليًا؛ سجّل الدخول لحفظ تحديثات سجل الطالب في الخادم.');
      if (!clinicalSession) setShowClinicalLogin(true);
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
      setAiStatusBanner('تم اشتقاق وحفظ تحديث السجل في التخزين المشفر على الخادم.');
    } catch {
      setAiStatusBanner('تعذر الاتصال بالخادم؛ لم يتم حفظ تحديث السجل.');
    }
  };

  const handleDeleteStudentRecord = async (studentId: string) => {
    if (!clinicalSession || clinicalSession.role !== 'clinician') {
      setAiStatusBanner(clinicalSession
        ? 'رمزك للقراءة فقط؛ لا يمكن حذف سجلات الطلاب.'
        : 'يلزم تسجيل الدخول قبل حذف سجل من الخادم.');
      if (!clinicalSession) setShowClinicalLogin(true);
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
        `تم حذف سجل الطالب (${target?.name || studentId}) من التخزين المشفر.`
      );
    } catch {
      setAiStatusBanner('تعذر الاتصال بالخادم؛ لم يتم حذف السجل.');
    }
  };

  const handleRegenerateAIClinicalReport = async () => {
    if (!clinicalSession || clinicalSession.role !== 'clinician') {
      setAiStatusBanner(clinicalSession
        ? 'رمزك للقراءة فقط ولا يتيح إنشاء تقارير على الخادم.'
        : 'يلزم تسجيل دخول أخصائي لإنشاء التقارير من الخادم.');
      if (!clinicalSession) setShowClinicalLogin(true);
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
          assessmentModality: selectedStudent.assessmentModality || 'reading_only',
          guardianConsentGiven: selectedStudent.guardianConsentGiven === true,
          guardianConsentRecordedAt: selectedStudent.guardianConsentRecordedAt,
          guardianConsentSource: selectedStudent.guardianConsentSource,
          guardianAudioConsentGiven: selectedStudent.guardianAudioConsentGiven === true,
          guardianAudioConsentRecordedAt: selectedStudent.guardianAudioConsentRecordedAt,
          speechRecognitionUsed: selectedStudent.speechRecognitionUsed === true,
          gradeLevel: selectedStudent.gradeLevel,
          wpm: selectedStudent.wpm,
          avgFixationMs: selectedStudent.avgFixationMs,
          regressionRate: selectedStudent.regressionRate,
          gazeCoveragePercent: selectedStudent.gazeCoveragePercent,
          observedWordCount: selectedStudent.observedWordCount,
          totalPassageWordCount: selectedStudent.totalPassageWordCount,
          calibrationAccuracyPercent: selectedStudent.calibrationAccuracyPercent,
          problematicWords: selectedStudent.problematicWords,
          numberLinePAE: selectedStudent.numberLinePAE,
          subitizingAccuracy: selectedStudent.subitizingAccuracy,
          reversalErrorCount: selectedStudent.reversalErrorCount,
          dyscalculiaAssessed:
            selectedStudent.dyscalculiaAssessed !== false &&
            selectedStudent.mathRiskLevel !== 'unassessed',
          oralReadingAssessed: selectedStudent.oralReadingAssessed,
          oralAccuracyPercent: selectedStudent.oralAccuracyPercent,
          oralWcpm: selectedStudent.oralWcpm,
          phoneticSubstitutionCount: selectedStudent.phoneticSubstitutionCount,
          dialectVariantCount: selectedStudent.dialectVariantCount,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.report) {
          if (!selectedStudent.isDemoRecord) {
            const persistRes = await authenticatedFetch(
              `/api/students/${encodeURIComponent(selectedStudent.id)}/clinical-report`,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clinicalReport: data.report }),
              }
            );
            if (!persistRes.ok) {
              const errData = await persistRes.json().catch(() => ({}));
              setAiStatusBanner(
                errData?.error ||
                  'صدر التقرير من خدمة التحليل، لكن فشل حفظه في سجل الطالب على الخادم.'
              );
              return;
            }
            const persisted = await persistRes.json().catch(() => ({}));
            setStudents((prev) =>
              prev.map((s) =>
                s.id === selectedStudent.id
                  ? persisted?.student
                    ? { ...s, ...persisted.student }
                    : { ...s, clinicalReport: data.report }
                  : s
              )
            );
          } else {
            setStudents((prev) =>
              prev.map((s) =>
                s.id === selectedStudent.id
                  ? { ...s, clinicalReport: data.report }
                  : s
              )
            );
          }
          setAiStatusBanner(
            `تم تحديث وحفظ تقرير المؤشرات القرائية وخطة المساندة التربوية للطالب (${selectedStudent.name}).`
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

  const handleClinicalLogin = async () => {
    setClinicalLoginError('');
    setIsClinicalLoggingIn(true);
    try {
      const session = await loginClinicalSession(
        clinicalAccessCode.trim(),
        'clinician',
        'أخصائي التقييم'
      );
      if (!session) {
        setClinicalLoginError('فشل تسجيل الدخول. تحقق من الرمز ومن إعدادات المصادقة والتخزين المشفر على الخادم.');
        return;
      }
      setClinicalSession(session);
      setClinicalAccessCode('');
      setShowClinicalLogin(false);
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
            setAiStatusBanner(`تم تسجيل الدخول وحفظ جلسة ${savedRecord.name} في التخزين المشفر.`);
          } else {
            const saveError = await pendingSave.json().catch(() => ({}));
            setAiStatusBanner(saveError?.error || 'تم تسجيل الدخول، لكن تعذر حفظ الجلسة المعلّقة.');
          }
        }

        const visibleStudents = loadedStudents.length > 0 ? loadedStudents : INITIAL_STUDENTS;
        setStudents(visibleStudents);
        if (visibleStudents.length > 0 && !pendingServerRecord) setSelectedStudentId(visibleStudents[0].id);
        setIsPersistedStoreLoaded(true);
      } else {
        const data = await response.json().catch(() => ({}));
        setAiStatusBanner(data?.error || 'تم تسجيل الدخول لكن تعذر تحميل السجلات.');
      }
    } catch {
      setClinicalLoginError('تعذر الاتصال بخدمة تسجيل الدخول.');
    } finally {
      setIsClinicalLoggingIn(false);
    }
  };

  return (
    <AssessmentProvider>
      <div
        data-dyslexia-theme={surfaceTheme}
        data-dyslexia-spacing={spacingMode}
        className={`baseera-app min-h-screen w-full overflow-x-hidden flex flex-col transition-colors duration-200 ${
          surfaceTheme === 'night'
          ? 'bg-[#0B1120] text-slate-100'
          : surfaceTheme === 'sage'
            ? 'bg-[#EFF7F3] text-[#0F291E]'
            : surfaceTheme === 'sky'
              ? 'bg-[#EFF6FF] text-[#0F172A]'
              : surfaceTheme === 'lab'
                ? 'bg-[#F8FAFC] text-[#0F172A]'
                : 'bg-[#FAF6EE] text-[#1E293B]'
      }`}
    >
      <a className="baseera-skip-link" href="#main-content">تجاوز إلى المحتوى</a>
      {showClinicalLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="clinical-login-title">
          <form
            onSubmit={(event) => { event.preventDefault(); void handleClinicalLogin(); }}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"
          >
            <h2 id="clinical-login-title" className="text-lg font-bold">دخول المعلّم أو الأخصائي</h2>
            <p className="text-sm text-slate-600">أدخل رمز المدرسة الذي سلّمه لك مسؤول النظام. تُحدَّد صلاحيات الحساب تلقائيًا.</p>
            <label className="block space-y-1 text-sm font-medium">
              <span>رمز الوصول</span>
              <input autoComplete="current-password" type="password" value={clinicalAccessCode} onChange={(event) => setClinicalAccessCode(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" required />
            </label>
            {clinicalLoginError && <p role="alert" className="text-sm text-red-700">{clinicalLoginError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isClinicalLoggingIn} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {isClinicalLoggingIn ? 'جارٍ التحقق…' : 'تسجيل الدخول'}
              </button>
              <button type="button" onClick={() => { setShowClinicalLogin(false); setClinicalLoginError(''); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">إلغاء</button>
            </div>
          </form>
        </div>
      )}
      <header className="baseera-topbar sticky top-0 z-30">
        <div className="baseera-topbar-inner">
          <a
            href="#top"
            onClick={(event) => {
              event.preventDefault();
              setActiveTab('home');
            }}
            className="baseera-brand"
            aria-label="بصيرة — الصفحة الرئيسية"
          >
            <span className="baseera-brand-mark"><BookOpen aria-hidden="true" size={25} /></span>
            <span className="baseera-brand-copy">
              <strong>بصيرة</strong>
              <small>نتعلّم خطوة بخطوة</small>
            </span>
          </a>

          <nav className="baseera-desktop-nav" aria-label="التنقل الرئيسي">
            {([
              { id: 'home', label: 'الرئيسية', icon: Home },
              { id: 'eye-lab', label: 'القراءة', icon: BookOpen },
              { id: 'dyscalculia-lab', label: 'الحساب', icon: Calculator },
              { id: 'adaptive-reader', label: 'القارئ الميسّر', icon: Type },
              { id: 'remediation-gym', label: 'التدريب', icon: Gamepad2 },
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
                  <Icon aria-hidden="true" size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="baseera-header-actions">
            <button
              type="button"
              className="baseera-teacher-action"
              onClick={() => clinicalSession ? setActiveTab('dashboard') : setShowClinicalLogin(true)}
            >
              <GraduationCap aria-hidden="true" size={19} />
              <span>{clinicalSession ? 'لوحة المعلّم' : 'دخول المعلّم'}</span>
            </button>
            <button
              type="button"
              className="baseera-primary-action baseera-header-cta"
              onClick={() => setActiveTab(activeTab === 'home' ? 'eye-lab' : 'home')}
            >
              <span>{activeTab === 'home' ? 'ابدأ نشاطًا' : 'الرئيسية'}</span>
              <ArrowLeft aria-hidden="true" size={17} />
            </button>
          </div>
        </div>
      </header>

      <div className="baseera-session-strip" role="status">
        <span className="baseera-session-copy">
          <ShieldCheck aria-hidden="true" size={17} />
          {clinicalSession
            ? 'جلسة المدرسة متصلة: ' + clinicalSession.clinicianName + ' · ' + getTenantDisplayLabelAr(clinicalSession)
            : 'وضع التجربة — لا توجد جلسة مدرسة متصلة.'}
        </span>
        {clinicalSession ? (
          <button
            type="button"
            className="baseera-session-action"
            onClick={() => {
              void (async () => {
                await logoutClinicalSession();
                setClinicalSession(null);
                setIsPersistedStoreLoaded(false);
                setAiStatusBanner('تم تسجيل الخروج وإبطال الجلسة.');
              })();
            }}
          >
            تسجيل الخروج
          </button>
        ) : (
          <button type="button" className="baseera-session-action" onClick={() => setShowClinicalLogin(true)}>
            دخول المعلّم
          </button>
        )}
      </div>

      <nav className="baseera-mobile-nav md:hidden" aria-label="التنقل السريع">
        {([
          { id: 'home', label: 'الرئيسية', icon: Home },
          { id: 'eye-lab', label: 'القراءة', icon: BookOpen },
          { id: 'dyscalculia-lab', label: 'الحساب', icon: Calculator },
          { id: 'adaptive-reader', label: 'القارئ', icon: Type },
          { id: 'remediation-gym', label: 'التدريب', icon: Gamepad2 },
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

      {/* Floating Accessibility & Night Mode Widget */}      {/* Floating Accessibility & Night Mode Widget */}
      <DyslexiaComfortBar
        activeTab={activeTab}
        surfaceTheme={surfaceTheme}
        onChangeSurfaceTheme={setSurfaceTheme}
        spacingMode={spacingMode}
        onChangeSpacingMode={setSpacingMode}
        readingRulerEnabled={readingRulerEnabled}
        onToggleReadingRuler={() => setReadingRulerEnabled((prev) => !prev)}
      />

      {/* Main Content Container (Single Unified Navigation — Zero Duplicate Top Stepper Bar) */}
      <main id="main-content" className="baseera-main flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-8 py-6 space-y-6 pb-28 md:pb-10">
        <div key={activeTab} className="space-y-8 animate-fade-slide-up">
          {/* VIEW 0: FLAGSHIP ENTERPRISE HOME & PROJECT SHOWCASE */}
          {activeTab === 'home' && (
            <HomeLandingView
              students={students}
              activeStudent={selectedStudent}
              onStartMockUserJourney={handleStartMockUserJourney}
              onSelectExistingDemoJourney={handleSelectExistingDemoJourney}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onSelectStudentReport={(studentId) => {
                setSelectedStudentId(studentId);
                setActiveTab('dashboard');
                setDashboardSubView('report');
              }}
            />
          )}
          {aiStatusBanner && (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-4 text-xs text-emerald-950">
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

        {/* VIEW 1: EDUCATIONAL INDICATORS DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Unified Executive Header & 4-Metric Hairline Ribbon (Single-Elevation, Zero Card-in-Card) */}
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>مساحة المعلّم ووليّ الأمر</span>
                    <span aria-hidden="true">·</span>
                    <span>الصف {selectedStudent.gradeLevel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedStudent.schoolName}</span>
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
                        {s.name} — الصف {s.gradeLevel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="baseera-summary-grid">
                <article className="baseera-summary-card baseera-summary-blue">
                  <span className="baseera-summary-label">{selectedStudent.assessmentModality === 'voice_only' ? 'الطلاقة الشفوية (WCPM)' : selectedStudent.assessmentModality === 'reading_only' ? 'معدل إتمام النص (تقديري)' : 'مؤشر القراءة'}</span>
                  <strong>{selectedReadingRate === null ? 'غير متاح' : selectedReadingRate + ' كلمة/دقيقة'}</strong>
                  <p>
                    {selectedStudent.sessionStatus !== 'completed'
                      ? 'ستظهر النتيجة بعد إكمال النشاط.'
                      : selectedReadingRate === null
                        ? 'لم تتوفر بيانات كافية لاحتساب السرعة.'
                        : selectedStudent.assessmentModality === 'voice_only'
                          ? selectedStudent.teacherVerified === true ? 'مراجعة بشرية للكلمات؛ ليست نتيجة تشخيصية.' : 'تفريغ صوتي آلي أولي يحتاج إلى مراجعة.'
                          : 'تقدير لزمن إتمام نص واحد؛ لا يقيس دقة الكلمات ولا يُقارن بمعيار الطلاقة الجهرية.'}
                  </p>
                </article>
                <article className="baseera-summary-card baseera-summary-mint">
                  <span className="baseera-summary-label">فهم النص</span>
                  <strong>{selectedStudent.sessionStatus === 'completed' ? selectedStudent.comprehensionScore + '%' : 'لم يُقَس بعد'}</strong>
                  <p>ملخص إجابات أسئلة الفهم القرائي.</p>
                </article>
                <article className="baseera-summary-card baseera-summary-yellow">
                  <span className="baseera-summary-label">الأعداد والحساب</span>
                  <strong>{selectedStudent.dyscalculiaAssessed === true && selectedStudent.numberLinePAE !== null ? selectedStudent.numberLinePAE + '% خطأ' : 'لم يُقَس بعد'}</strong>
                  <p>خطأ تقدير وصفي على خط الأعداد؛ لا يمثل درجة خطر أو تشخيصًا.</p>
                  <button type="button" className="baseera-inline-action" onClick={() => setActiveTab('dyscalculia-lab')}>جرّب مهام الحساب <ArrowLeft aria-hidden="true" size={15} /></button>
                </article>
                <article className="baseera-summary-card baseera-summary-lilac">
                  <span className="baseera-summary-label">خطوتك القادمة</span>
                  <strong>{selectedStudent.sessionStatus === 'completed' ? 'واصل التدرّب' : 'ابدأ بنشاط قصير'}</strong>
                  <p>اختر نشاطًا مناسبًا مع ولي أمرك أو معلّمك.</p>
                  <button type="button" className="baseera-inline-action" onClick={() => setActiveTab(selectedStudent.sessionStatus === 'completed' ? 'remediation-gym' : 'eye-lab')}>{selectedStudent.sessionStatus === 'completed' ? 'اذهب للتدريب' : 'ابدأ القراءة'} <ArrowLeft aria-hidden="true" size={15} /></button>
                </article>
              </div>
            </section>

            {/* Segmented Sub-Navigation Bar
            </section>

            {/* Segmented Sub-Navigation Bar for Progressive Disclosure */}
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
                  <span>١. سجل التعلّم ({students.length})</span>
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
                  <span>٢. تقرير التقدّم وخطة المساندة</span>
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
                  <span>
                    مؤشرات فرز استرشادية غير تشخيصية ·{' '}
                    {isPersistedStoreLoaded
                      ? 'قاعدة البيانات متصلة'
                      : 'وضع الجلسة'}
                  </span>
                </span>
                {students.length > 1 && clinicalSession?.role === 'clinician' && (
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
                        سجل الطلاب ومؤشرات الفرز الاسترشادية
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        اختر سجلًا لعرض ملخص الجلسة وخطوة الدعم المقترحة.
                      </p>
                    </div>

                    {/* Interactive Filter Tabs */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setRiskFilter('all')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          riskFilter === 'all'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        الكل ({students.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setRiskFilter('high')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          riskFilter === 'high'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        تحتاج مراجعة
                      </button>
                      <button
                        type="button"
                        onClick={() => setRiskFilter('nominal')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          riskFilter === 'nominal'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        مؤشر أولي منخفض
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
                          setRiskFilter('all');
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
                            <th className="py-3 px-3 text-left">الطلاقة</th>
                            <th className="py-3 px-3 text-left">الفهم</th>
                            <th className="py-3 px-3">حالة القراءة</th>
                            <th className="py-3 px-4">الحساب</th>
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
                                    الصف {stu.gradeLevel}
                                    {stu.isDemoRecord ? ' · نموذج توضيحي' : ''}
                                  </div>
                                </td>
                                <td className="py-3.5 px-3 text-left font-mono tabular-nums text-slate-900 font-medium">
                                  {stu.sessionStatus !== 'completed'
                                    ? '—'
                                    : stu.assessmentModality === 'voice_only'
                                      ? ((stu.spokenTranscript || '').trim() || stu.teacherVerified === true)
                                        ? (stu.wcpm ?? stu.oralWcpm ?? 'غير متاح')
                                        : 'غير متاح'
                                      : (stu.wpm > 0 ? stu.wpm : 'غير متاح')}
                                  <span className="text-[10px] text-slate-500"> {stu.sessionStatus === 'completed' ? 'ك/د' : ''}</span>
                                </td>
                                <td className="py-3.5 px-3 text-left font-mono tabular-nums text-slate-900">
                                  {stu.sessionStatus === 'completed' ? stu.comprehensionScore + '%' : '—'}
                                </td>
                                <td className="py-3.5 px-3">
                                  <span className="baseera-evidence-status">
                                    {stu.sessionStatus !== 'completed'
                                      ? 'لم تكتمل الجلسة'
                                      : stu.teacherVerified === true
                                        ? 'راجعها المعلّم'
                                        : stu.oralReadingAssessed === true
                                          ? 'محاذاة صوتية أولية'
                                          : 'قراءة موقوتة استرشادية'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  {stu.mathRiskLevel === 'unassessed' ||
                                  stu.dyscalculiaAssessed === false ||
                                  stu.numberLinePAE === null ? (
                                    <span className="text-slate-400">
                                      ○ غير مُقيَّم
                                    </span>
                                  ) : (
                                    <span
                                      className={
                                        stu.mathRiskLevel === 'high'
                                          ? 'text-[#DC2626] font-semibold'
                                          : stu.mathRiskLevel === 'moderate'
                                            ? 'text-[#D97706] font-semibold'
                                            : 'text-[#059669] font-medium'
                                      }
                                    >
                                      {stu.mathRiskLevel === 'high'
                                        ? `تحتاج مراجعة (${stu.numberLinePAE}%)`
                                        : stu.mathRiskLevel === 'moderate'
                                          ? `تحتاج تدريب (${stu.numberLinePAE}%)`
                                          : `المهمة أُنجزت (${stu.numberLinePAE}%)`}
                                    </span>
                                  )}
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
                        onClick={() => setActiveTab('eye-lab')}
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

                <aside className="baseera-next-steps-card">
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
                    <span className="baseera-support-icon yellow"><Calculator aria-hidden="true" size={21} /></span>
                    <div>
                      <strong>تمارين الأعداد</strong>
                      <p>أنجز مهمة قصيرة للحس العددي، ثم راجعها مع المعلّم أو ولي الأمر.</p>
                    </div>
                  </div>
                  <div className="baseera-support-actions">
                    <button type="button" className="baseera-primary-action" onClick={() => setActiveTab('remediation-gym')}>ابدأ التدريب <ArrowLeft aria-hidden="true" size={17} /></button>
                    <button type="button" className="baseera-secondary-action" onClick={() => setActiveTab('adaptive-reader')}>القارئ الميسّر</button>
                  </div>
                </aside>
              </div>
            )}
            {/* SUB-VIEW 3: AI SCREENING REPORT & INDIVIDUALIZED SUPPORT PLAN */}
            {dashboardSubView === 'report' && (
              <section id="student-report-content" className="print-report-root bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="p-6 sm:p-8 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1 flex flex-wrap items-center gap-2">
                      <span>تقرير الفرز القرائي والحسابي الاسترشادي</span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        مصدر الأدلة: {selectedStudent.evidenceProvenanceLabelAr || (selectedStudent.isDemoRecord ? 'بيانات نموذجية توضيحية' : 'بيانات الجلسة المسجلة')}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">
                      تقرير المؤشرات القرائية وخطة المساندة المقترحة —{' '}
                      {selectedStudent.name}
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
                        'تقرير فرز تربوي استرشادي — ملخص مجهول الهوية',
                        'اسم الطالب: محذوف للخصوصية',
                        `الصف: ${selectedStudent.gradeLevel}`,
                        `التاريخ: ${selectedStudent.lastScreenedDate || 'لم تُسجل جلسة مكتملة'}`,
                        `سرعة القراءة: ${selectedStudent.sessionStatus === 'in_progress' ? 'غير متاحة — الجلسة غير مكتملة' : `${selectedStudent.wpm} كلمة/دقيقة`}`,
                        `الكلمات المستهدفة للتدريب: ${(selectedStudent.problematicWords || []).join('، ') || 'لم تُحدد بعد'}`,
                        'هذا التقرير استرشادي وغير تشخيصي.',
                      ].join('\n');
                      try {
                        if (navigator.share) {
                          await navigator.share({ title: 'تقرير بصيرة الاسترشادي', text: shareText });
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
                    disabled={isGeneratingAI || clinicalSession?.role !== 'clinician'}
                    title={clinicalSession?.role === 'educator_readonly' ? 'صلاحية القراءة فقط لا تتيح إنشاء تقرير على الخادم' : undefined}
                    onClick={handleRegenerateAIClinicalReport}
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {isGeneratingAI
                        ? 'جاري تحديث التقرير...'
                        : 'تحديث التقرير بالذكاء الاصطناعي'}
                    </span>
                  </button>
                  </div>
                </div>

                {selectedStudent.assessmentHistory && selectedStudent.assessmentHistory.length > 0 && (
                  <section aria-label='سجل جلسات الفحص السابقة' className='border-b border-slate-200 bg-slate-50/70 p-6 sm:p-8 space-y-4'>
                    <div>
                      <h3 className='text-sm font-bold text-slate-900'>سجل المتابعة</h3>
                      <p className='mt-1 text-xs leading-relaxed text-slate-600'>سجل المتابعة الزمنية لجلسات الطالب لمقارنة تطور مؤشرات إتمام النص، وفهم المقروء، والمهام الحسابية عبر الزمن.</p>
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
                            <span>{snapshot.assessmentModality === 'voice_only' ? 'WCPM الشفوية' : snapshot.assessmentModality === 'reading_only' ? 'معدل إتمام النص (تقديري)' : 'معدل القراءة المسجل'}: <strong>{snapshot.assessmentModality === 'voice_only' ? (snapshot.wcpm ?? 'غير متاح') : snapshot.wpm} كلمة/دقيقة</strong></span>
                            <span>الفهم: <strong>{snapshot.comprehensionScore}%</strong></span>
                            <span>خطأ خط الأعداد: <strong>{snapshot.numberLinePAE === null ? 'لم يُقَس' : snapshot.numberLinePAE + '%'}</strong></span>
                          </div>
                          {(snapshot.problematicWords || []).length > 0 && (
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
                        ٠١. ملخص المؤشرات القرائية والفرز الأولي
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {selectedStudent.clinicalReport.clinicalSummary}
                      </p>
                    </div>
                    <div className="pt-6 border-t border-slate-200 space-y-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        ٠٢. ملاحظات الطلاقة والقراءة
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {selectedStudent.sessionStatus !== 'completed'
                          ? 'ستظهر الملاحظات بعد إكمال نشاط القراءة.'
                          : selectedStudent.assessmentModality === 'voice_only'
                            ? ((selectedStudent.spokenTranscript || '').trim() || selectedStudent.teacherVerified === true)
                              ? selectedStudent.teacherVerified === true
                                ? 'راجع المعلّم محاذاة الكلمات في القراءة الجهرية. سرعة الكلمات الصحيحة المعتمدة: ' + (selectedStudent.wcpm ?? selectedStudent.oralWcpm ?? 'غير متاحة') + ' كلمة/دقيقة.'
                                : 'تتوفر محاذاة صوتية آلية أولية فقط. تُراجع الكلمات قبل تفسيرها؛ ولا تمثل هذه النتيجة تشخيصًا.'
                              : 'لا تتوفر بيانات صوتية كافية لاحتساب سرعة القراءة الجهرية.'
                            : 'سرعة القراءة الموقوتة المسجّلة: ' + (selectedStudent.wpm > 0 ? selectedStudent.wpm : 'غير متاحة') + ' كلمة/دقيقة، ونتيجة الفهم: ' + selectedStudent.comprehensionScore + '%. هذه مؤشرات تعليمية استرشادية.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        ٠٣. الملاحظات الصرفية والفونولوجية في العربية
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {
                          selectedStudent.clinicalReport
                            .orthographicAndPhonologicalPatterns
                        }
                      </p>
                    </div>
                    <div className="pt-6 border-t border-slate-200 space-y-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        ٠٤. مؤشرات الحس المكاني للأعداد وخط الأعداد
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {
                          selectedStudent.clinicalReport
                            .dyscalculiaSpatialAnalysis
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actionable Daily Exercises & Classroom Accommodations */}
                <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-slate-50/40">
                  <div className="lg:col-span-7 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      أنشطة المساندة القرائية اليومية المقترحة
                    </h3>
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
                      {selectedStudent.clinicalReport.interventionExercises.length > 0 ? (
                        selectedStudent.clinicalReport.interventionExercises.map(
                          (ex, idx) => (
                            <div
                              key={idx}
                              className="p-4 flex items-start justify-between gap-4"
                            >
                              <div className="space-y-1">
                                <div className="text-xs font-bold text-slate-900">
                                  {idx + 1}. {ex.title}
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                  {ex.description}
                                </p>
                              </div>
                              <span className="text-xs font-mono tabular-nums font-semibold text-[#0284C7] shrink-0">
                                {ex.durationMinutes} دقائق
                              </span>
                            </div>
                          )
                        )
                      ) : (
                        <div className="p-4 text-xs text-slate-600 leading-relaxed">
                          ستظهر أنشطة المساندة اليومية المخصصة تلقائيًا فور إتمام جلسة القراءة وحساب مؤشرات الفرز.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-900">
                        التيسيرات الصفية والمدرسية الموصى بها
                      </h3>
                      <ul className="space-y-2.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-xl p-5">
                        {selectedStudent.clinicalReport.classroomAccommodations.length > 0 ? (
                          selectedStudent.clinicalReport.classroomAccommodations.map(
                            (acc, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-[#0284C7] font-bold">·</span>
                                <span>{acc}</span>
                              </li>
                            )
                          )
                        ) : (
                          <li className="text-slate-600 leading-relaxed">
                            ستظهر التيسيرات الصفية المقترحة فور إتمام جلسة الفحص القرائي والحسابي.
                          </li>
                        )}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('adaptive-reader')}
                      className="w-full py-3 px-4 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>فتح القارئ العربي الميسّر لتدريب الطالب</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* VIEW 2: LIVE EYE-TRACKING READING LAB */}
        {activeTab === 'eye-lab' && (
          <EyeTrackingLabView
            onCompleteSession={handleCompleteNewSession}
            activeStudent={selectedStudent}
            onProceedToMathLab={() => setActiveTab('dyscalculia-lab')}
          />
        )}

        {/* NEW: PROFESSIONAL EYE TRACKING CALIBRATION */}
        {activeTab === 'professional-eye-tracking' && (
          <EyeTrackingLabView
            onCompleteSession={handleCompleteNewSession}
            activeStudent={selectedStudent}
            onProceedToMathLab={() => setActiveTab('dyscalculia-lab')}
          />
        )}

        {/* NEW: REAL EYE CALIBRATION WITH PUPIL TRACKING */}
        {activeTab === 'real-eye-calibration' && (
          <EyeTrackingLabView
            onCompleteSession={handleCompleteNewSession}
            activeStudent={selectedStudent}
            onProceedToMathLab={() => setActiveTab('dyscalculia-lab')}
          />
        )}

        {/* NEW: ARABIC SPEECH ANALYSIS */}
        {activeTab === 'arabic-speech-analysis' && (
          <ArabicSpeechAnalysis
            studentName={selectedStudent.name}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {/* NEW: TACTILE ANALYTICS */}
        {activeTab === 'tactile-analytics' && (
          <TactileAnalytics
            studentName={selectedStudent.name}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {/* NEW: ADAPTIVE REPORTS */}
        {activeTab === 'adaptive-reports' && (
          <AdaptiveReports
            student={selectedStudent}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {/* VIEW 3: DYSCALCULIA & NUMERICAL COGNITION LAB */}
        {activeTab === 'dyscalculia-lab' && (
          <DyscalculiaLabView
            students={students}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            onUpdateStudentMath={handleUpdateStudentMath}
            onOpenFinalReport={() => {
              setActiveTab('dashboard');
              setDashboardSubView('report');
            }}
          />
        )}

        {/* VIEW 4: SMART ADAPTIVE DYSLEXIA READER & DYSLEXICO STUDIO */}
        {activeTab === 'remediation-gym' && (
          <RemediationGymView
            students={students}
            activeStudent={selectedStudent}
            onSelectStudent={setSelectedStudentId}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenReport={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'adaptive-reader' && (
          <AdaptiveReaderView
            problematicWords={selectedStudent.sessionStatus === 'completed' && selectedStudent.teacherVerified === true && selectedStudent.evidenceProvenance !== 'demo-synthetic' ? (selectedStudent.problematicWords || []) : []}
            studentName={selectedStudent.name}
            passageId={selectedStudent.passageId}
          />
        )}

        {/* VIEW 5: CLINICAL ALGORITHMS & ADAPTIVE IRT / PYGAZE ML LAB */}
        {activeTab === 'algorithms-lab' && (
          <ClinicalAlgorithmsView selectedStudent={selectedStudent} />
        )}
        {activeTab === 'privacy' && <PrivacyPolicyView />}
        </div>
      </main>

      <footer className="baseera-footer">
        <div className="baseera-footer-inner">
          <div className="baseera-footer-brand">
            <span className="baseera-brand-mark"><BookOpen aria-hidden="true" size={22} /></span>
            <div>
              <strong>بصيرة</strong>
              <p>مساحة تعليمية عربية لاستكشاف مهارات القراءة والحساب، خطوة بخطوة.</p>
            </div>
          </div>
          <nav className="baseera-footer-links" aria-label="روابط إضافية">
            <button type="button" onClick={() => setActiveTab('home')}>الرئيسية</button>
            <button type="button" onClick={() => setActiveTab('privacy')}>الخصوصية</button>
            <button type="button" onClick={() => setActiveTab('dashboard')}>للمعلّم ووليّ الأمر</button>
          </nav>
          <p className="baseera-footer-note">النتائج تعليمية استرشادية وليست تشخيصًا طبيًا.</p>
        </div>
      </footer>
    </div>
    </AssessmentProvider>
  );
}
