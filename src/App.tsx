import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Eye,
  BarChart3,
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
  ClinicalSessionInfo,
} from './utils/apiAuth';
import { ScanpathViewer } from './components/ScanpathViewer';
import { EyeTrackingLabView } from './components/EyeTrackingLabView';
import { DyscalculiaLabView, MathAssessmentSubmission } from './components/DyscalculiaLabView';
import { AdaptiveReaderView } from './components/AdaptiveReaderView';
import { ClinicalAlgorithmsView } from './components/ClinicalAlgorithmsView';
import { PrivacyPolicyView } from './components/PrivacyPolicyView';
import { HomeLandingView, AppTabId } from './components/HomeLandingView';
import {
  DyslexiaComfortBar,
  DyslexiaSurfaceTheme,
  DyslexiaSpacingMode,
} from './components/DyslexiaComfortBar';

type ActiveTab = AppTabId;

type DashboardSubView = 'roster' | 'scanpath' | 'report';

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

  // Load persistent student records from RBAC-protected server on mount
  useEffect(() => {
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
  }, []);

  const selectedStudent =
    students.find((s) => s.id === selectedStudentId) || students[0];

  const selectedPassage =
    ARABIC_READING_PASSAGES.find((p) => p.id === selectedStudent.passageId) ||
    ARABIC_READING_PASSAGES[0];

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

  // Only screening/session fields are sent to the append-only session endpoint.
  const sessionPayloadFromRecord = (record: StudentRecord) => ({
    sessionRoleLabel: record.sessionRoleLabel,
    passageId: record.passageId,
    dialectRegionAr: record.dialectRegionAr,
    dialectCode: record.dialectCode || 'msa',
    readingDurationSeconds: record.readingDurationSeconds,
    blinkCount: record.blinkCount,
    fixations: record.fixations,
    comprehensionScore: record.comprehensionScore,
    spokenTranscript: record.spokenTranscript || '',
    guardianConsentGiven: record.guardianConsentGiven === true,
    guardianConsentRecordedAt: record.guardianConsentRecordedAt,
    guardianConsentSource: record.guardianConsentSource,
    guardianAudioConsentGiven: record.guardianAudioConsentGiven === true,
    guardianAudioConsentRecordedAt: record.guardianAudioConsentRecordedAt,
    speechRecognitionUsed: record.speechRecognitionUsed === true,
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
      const createPayload = {
        ...completedRecord,
        guardianConsentGiven: completedRecord.guardianConsentGiven === true,
      };
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
    roleLabel: string
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
          guardianConsentGiven: false,
          guardianConsentRecordedAt: undefined,
          guardianConsentSource: undefined,
          guardianAudioConsentGiven: false,
          guardianAudioConsentRecordedAt: undefined,
          speechRecognitionUsed: false,
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
        guardianConsentGiven: false,
        guardianConsentRecordedAt: undefined,
        guardianConsentSource: undefined,
        wpm: 0,
        avgFixationMs: 0,
        regressionRate: 0,
        regressionCount: 0,
        dyslexiaRiskScore: 0,
        readingHeuristicIndicator: 0,
        readingRiskLevel: 'nominal',
        readingRiskLabelAr: 'لم يُستكمل الفحص بعد',
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
    assessment: MathAssessmentSubmission
  ) => {
    if (!clinicalSession || clinicalSession.role !== 'clinician') {
      setAiStatusBanner(clinicalSession
        ? 'رمزك للقراءة فقط؛ لا يمكن حفظ تحديثات سجل الطالب.'
        : 'يلزم تسجيل الدخول قبل حفظ تحديثات سجل الطالب.');
      if (!clinicalSession) setShowClinicalLogin(true);
      return;
    }
    try {
      const response = await authenticatedFetch(
        `/api/students/${encodeURIComponent(studentId)}/math-assessment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assessment),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.student) {
        setAiStatusBanner(data?.error || 'لم تُحفظ نتيجة الحساب المحسوبة على الخادم.');
        return;
      }
      setStudents((prev) => prev.map((student) =>
        student.id === studentId ? data.student as StudentRecord : student
      ));
      setAiStatusBanner('حُفظت نتيجة الحساب بعد أن حسبها الخادم من المحاولات المرسلة.');
    } catch {
      setAiStatusBanner('تعذر الاتصال بالخادم؛ لم تُحفظ نتيجة الحساب.');
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
          setStudents((prev) =>
            prev.map((s) =>
              s.id === selectedStudent.id
                ? { ...s, clinicalReport: data.report }
                : s
            )
          );
          await authenticatedFetch(
            `/api/students/${encodeURIComponent(selectedStudent.id)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clinicalReport: data.report }),
            }
          ).catch(() => {});
          setAiStatusBanner(
            `تم تحديث تقرير المؤشرات القرائية وخطة المساندة التربوية للطالب (${selectedStudent.name}).`
          );
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setAiStatusBanner(data?.error || 'تعذر إصدار التقرير؛ قد تكون بيانات التتبع أو المعايرة غير كافية.');
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
          const sendSave = (url: string, body: unknown) => authenticatedFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          let pendingSave = existingPending
            ? await sendSave(`/api/students/${encodeURIComponent(pendingServerRecord.id)}/sessions`, sessionPayload)
            : await sendSave('/api/students', {
                ...pendingServerRecord,
                guardianConsentGiven: pendingServerRecord.guardianConsentGiven === true,
              });
          if (pendingSave.status === 404 && existingPending) {
            pendingSave = await sendSave('/api/students', {
              ...pendingServerRecord,
              guardianConsentGiven: pendingServerRecord.guardianConsentGiven === true,
            });
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
    <div
      data-dyslexia-theme={surfaceTheme}
      data-dyslexia-spacing={spacingMode}
      className={`min-h-screen w-full overflow-x-hidden flex flex-col transition-colors duration-200 ${
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
      {showClinicalLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="clinical-login-title">
          <form
            onSubmit={(event) => { event.preventDefault(); void handleClinicalLogin(); }}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"
          >
            <h2 id="clinical-login-title" className="text-lg font-bold">تسجيل دخول المستخدم المخوّل</h2>
            <p className="text-sm text-slate-600">أدخل رمز المدرسة والدور الذي سلّمه لك مسؤول النظام. تحدد صلاحية الرمز المدرسة والدور تلقائيًا؛ لا يمكن اختيار دور أعلى من صلاحيتك.</p>
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
      {/* Strict 3-Zone Top Bar Contract — Ordered Sequentially by User Lifecycle */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-4 sm:px-6 py-3 sm:py-4 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('home');
          }}
          className="text-xl font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
        >
          بصيرة
        </a>

        {/* Zone 2: 5 Sequential User Lifecycle Links (Home -> Reading -> Math -> Reader -> Final Report) */}
        <nav
          aria-label="التنقل الرئيسي"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'home'
                ? 'text-[#15803D] font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            الرئيسية
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('eye-lab')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'eye-lab'
                ? 'text-[#15803D] font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            فحص القراءة والعين
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dyscalculia-lab')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'dyscalculia-lab'
                ? 'text-[#15803D] font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            مهام الحساب
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('adaptive-reader')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'adaptive-reader'
                ? 'text-[#15803D] font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            القارئ الميسّر
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('algorithms-lab')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'algorithms-lab'
                ? 'text-[#15803D] font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            المختبر التقني
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-[#15803D] font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            التقرير والمؤشرات
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() =>
              setActiveTab(activeTab === 'home' ? 'eye-lab' : 'home')
            }
            className="px-4 py-2 text-xs font-semibold text-white bg-[#18181B] hover:bg-[#15803D] rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            {activeTab === 'home' ? 'ابدأ فحص القراءة' : 'العودة للرئيسية'}
          </button>
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-700">
        <span>{clinicalSession ? `تم تسجيل الدخول: ${clinicalSession.clinicianName} · ${clinicalSession.role === 'clinician' ? 'صلاحية أخصائي' : 'قراءة فقط'} · المدرسة: ${clinicalSession.tenantId}` : 'وضع محلي: السجلات والتقارير لا تُحفظ في الخادم قبل تسجيل الدخول.'}</span>
        {clinicalSession ? (
          <button type="button" onClick={() => { void (async () => { await logoutClinicalSession(); setClinicalSession(null); setIsPersistedStoreLoaded(false); setAiStatusBanner('تم إبطال الجلسة على الخادم وتسجيل الخروج محليًا.'); })(); }} className="rounded-md border border-slate-300 px-3 py-1 font-semibold">تسجيل الخروج</button>
        ) : (
          <button type="button" onClick={() => setShowClinicalLogin(true)} className="rounded-md bg-emerald-700 px-3 py-1 font-semibold text-white">تسجيل الدخول لحفظ السجلات</button>
        )}
      </div>


      {/* Mobile Navigation Strip (visible only below md, same sequential order) */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-1.5 overflow-x-auto">
        {[
          { id: 'home', label: 'الرئيسية' },
          { id: 'eye-lab', label: 'فحص القراءة والعين' },
          { id: 'dyscalculia-lab', label: 'مهام الحساب' },
          { id: 'adaptive-reader', label: 'القارئ الميسّر' },
          { id: 'algorithms-lab', label: 'المختبر التقني' },
          { id: 'privacy', label: 'الخصوصية' },
          { id: 'dashboard', label: 'التقرير والمؤشرات' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id as ActiveTab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 ${
              activeTab === item.id
                ? 'bg-[#0F172A] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Floating Accessibility & Night Mode Widget */}
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
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
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
                    <span>منصة الفرز التربوي الأولي</span>
                    <span aria-hidden="true">·</span>
                    <span>الصف {selectedStudent.gradeLevel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedStudent.schoolName}</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
                    ملخص المؤشرات القرائية والحسابية — {selectedStudent.name}
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

              {/* Flat Hairline-Divided 4-Column Metric Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-slate-200 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 bg-slate-50/40">
                <div className="p-6 space-y-1.5">
                  <div className="text-xs text-slate-500">
                    سرعة القراءة والفهم
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {selectedStudent.sessionStatus === 'in_progress' ? '—' : selectedStudent.wpm}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        كلمة/د
                      </span>
                    </span>
                    <span className="text-xs font-mono tabular-nums text-[#0284C7] font-semibold">
                      {selectedStudent.sessionStatus === 'in_progress' ? 'المؤشر غير متاح قبل إكمال الجلسة' : `مؤشر الأداء الاستدلالي ${selectedStudent.readingHeuristicIndicator}/100 (الأعلى = أداء أفضل)`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 pt-1">
                    {selectedStudent.sessionStatus === 'in_progress'
                      ? 'الجلسة غير مكتملة — لا توجد نتيجة'
                      : selectedStudent.readingRiskLevel === 'high'
                      ? '■ مؤشر فرز استرشادي مرتفع'
                      : selectedStudent.readingRiskLevel === 'moderate'
                        ? '▲ مؤشر متوسط — يحتاج إلى مراجعة'
                        : 'مؤشر استرشادي — يحتاج إلى سياق'}{' '}
                    · {selectedStudent.sessionStatus === 'in_progress' ? 'الفهم غير مُقيَّم' : `الفهم ${selectedStudent.comprehensionScore}%`}
                  </div>
                </div>

                <div className="p-6 space-y-1.5">
                  <div className="text-xs text-slate-500">
                    متوسط زمن التثبيت البصري
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {selectedStudent.sessionStatus === 'in_progress' ? '—' : selectedStudent.avgFixationMs}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        ms
                      </span>
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        selectedStudent.avgFixationMs >= 400
                          ? 'text-[#DC2626]'
                          : selectedStudent.avgFixationMs >= 320
                            ? 'text-[#D97706]'
                            : 'text-[#059669]'
                      }`}
                    >
                      {selectedStudent.sessionStatus === 'in_progress'
                        ? 'لا توجد قياسات بعد'
                        : selectedStudent.avgFixationMs >= 400
                          ? '■ تثبيت مطوّل'
                          : selectedStudent.avgFixationMs >= 320
                            ? '▲ تثبيت متوسط'
                            : 'ضمن العرض التجريبي'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 pt-1">
                    الرمش:{' '}
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {selectedStudent.sessionStatus === 'in_progress' || selectedStudent.blinksPerMinute == null ? '—' : selectedStudent.blinksPerMinute}
                    </span>{' '}
                    رمشة/دقيقة
                  </div>
                </div>

                <div className="p-6 space-y-1.5">
                  <div className="text-xs text-slate-500">
                    القفزات البصرية التراجعية
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {selectedStudent.sessionStatus === 'in_progress' ? '—' : `${selectedStudent.regressionRate}%`}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        selectedStudent.visualStrainLevel === 'severe'
                          ? 'text-[#DC2626]'
                          : selectedStudent.visualStrainLevel === 'moderate'
                            ? 'text-[#D97706]'
                            : 'text-[#059669]'
                      }`}
                    >
                      {selectedStudent.sessionStatus === 'in_progress'
                        ? 'لا توجد قياسات بعد'
                        : selectedStudent.regressionRate > 22
                          ? '■ تراجع مرتفع'
                          : '● مسح بصري مستقر'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 pt-1 truncate">
                    {selectedStudent.sessionStatus === 'in_progress'
                      ? 'ستظهر الملاحظة بعد إكمال الجلسة'
                      : selectedStudent.visualStrainLabelAr || 'لا توجد ملاحظة مسجلة'}
                  </div>
                </div>

                <div className="p-6 space-y-1.5">
                  <div className="text-xs text-slate-500">
                    مؤشر خط الأعداد والحساب
                  </div>
                  {selectedStudent.mathRiskLevel === 'unassessed' ||
                  selectedStudent.dyscalculiaAssessed === false ||
                  selectedStudent.numberLinePAE === null ? (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-base font-bold text-slate-600">
                          غير مُقيَّم بعد
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('dyscalculia-lab')}
                          className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
                        >
                          بدء الفحص ←
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 pt-1">
                        لم يُستكمل تقييم خط الأعداد بعد
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                          {selectedStudent.numberLinePAE}%
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            selectedStudent.mathRiskLevel === 'high'
                              ? 'text-[#DC2626]'
                              : selectedStudent.mathRiskLevel === 'moderate'
                                ? 'text-[#D97706]'
                                : 'text-[#059669]'
                          }`}
                        >
                          {selectedStudent.mathRiskLevel === 'high'
                            ? '■ مؤشر عسر حساب'
                            : selectedStudent.mathRiskLevel === 'moderate'
                              ? '▲ متابعة حسابية'
                              : '● حس عددي سليم'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 pt-1">
                        الإدراك الكمي: {selectedStudent.subitizingAccuracy}% ·
                        عكس أرقام: {selectedStudent.reversalErrorCount}
                      </div>
                    </>
                  )}
                </div>
              </div>
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
                  <span>١. سجل الطلاب ومؤشرات الفرز ({students.length})</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={dashboardSubView === 'scanpath'}
                  onClick={() => setDashboardSubView('scanpath')}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                    dashboardSubView === 'scanpath'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>٢. خريطة المسار البصري</span>
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
                  <span>٣. تقرير الفرز وخطة المساندة التربوية</span>
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
                        انقر على أي طالب لعرض مؤشراته أو فتح خريطة مسار العين
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
                        يحتاج تدخلاً
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
                        ضمن المتوسط
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
                            <th className="py-3 px-3 text-left">السرعة</th>
                            <th className="py-3 px-3 text-left">التثبيت</th>
                            <th className="py-3 px-3">مؤشر القراءة</th>
                            <th className="py-3 px-4">مؤشر الحساب</th>
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
                                  {stu.sessionStatus === 'in_progress' ? '—' : stu.wpm} <span className="text-[10px] text-slate-400">ك/د</span>
                                </td>
                                <td className="py-3.5 px-3 text-left font-mono tabular-nums text-slate-900">
                                  {stu.sessionStatus === 'in_progress' ? '—' : `${stu.avgFixationMs}ms`}
                                </td>
                                <td className="py-3.5 px-3">
                                  <span
                                    className={
                                      stu.readingRiskLevel === 'high'
                                        ? 'text-[#DC2626] font-semibold'
                                        : stu.readingRiskLevel === 'moderate'
                                          ? 'text-[#D97706] font-semibold'
                                          : 'text-[#059669] font-medium'
                                    }
                                  >
                                    {stu.sessionStatus === 'in_progress'
                                      ? 'لم يُستكمل الفحص'
                                      : stu.readingRiskLevel === 'high'
                                      ? `■ مرتفع (مؤشر ${stu.readingHeuristicIndicator}/100)`
                                      : stu.readingRiskLevel === 'moderate'
                                        ? `▲ متوسط (مؤشر ${stu.readingHeuristicIndicator}/100)`
                                        : `● منخفض (مؤشر ${stu.readingHeuristicIndicator}/100)`}
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
                                        ? `■ صعوبات (${stu.numberLinePAE}%)`
                                        : stu.mathRiskLevel === 'moderate'
                                          ? `▲ متابعة (${stu.numberLinePAE}%)`
                                          : `● سليم (${stu.numberLinePAE}%)`}
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
                        onClick={() => setDashboardSubView('scanpath')}
                        className="font-semibold text-[#0284C7] hover:underline cursor-pointer"
                      >
                        فتح خريطة المسار البصري ←
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

                {/* 5 Cols: Heuristic Screening Index Matrix Chart */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div>
                    <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-200">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          مصفوفة مؤشرات الفرز الاسترشادية (غير معيارية)
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          موقع الطالب بين الطلاقة القرائية (أفقياً) والحس العددي (عمودياً)
                        </p>
                      </div>
                      <BarChart3 className="w-4 h-4 text-[#0284C7]" />
                    </div>

                    <svg
                      viewBox="0 0 380 230"
                      className="w-full h-auto bg-[#F8FAFC] border border-slate-200 rounded-xl"
                      role="img"
                      aria-label="مخطط توزيع الطلاب حسب مؤشرات الفرز القرائي والحسابي"
                    >
                      <rect
                        x="40"
                        y="15"
                        width="110"
                        height="180"
                        fill="#FEE2E2"
                        fillOpacity="0.4"
                      />
                      <rect
                        x="150"
                        y="15"
                        width="75"
                        height="180"
                        fill="#FEF3C7"
                        fillOpacity="0.35"
                      />
                      <rect
                        x="225"
                        y="15"
                        width="135"
                        height="180"
                        fill="#DCFCE7"
                        fillOpacity="0.35"
                      />

                      <line
                        x1="40"
                        y1="105"
                        x2="360"
                        y2="105"
                        stroke="#CBD5E1"
                        strokeDasharray="3 3"
                      />
                      <line
                        x1="150"
                        y1="15"
                        x2="150"
                        y2="195"
                        stroke="#CBD5E1"
                        strokeDasharray="3 3"
                      />

                      <text
                        x="95"
                        y="30"
                        fontSize="9"
                        fill="#991B1B"
                        textAnchor="middle"
                      >
                        دون حد التغطية (&lt;25%)
                      </text>
                      <text
                        x="187"
                        y="30"
                        fontSize="9"
                        fill="#92400E"
                        textAnchor="middle"
                      >
                        متابعة (25-45%)
                      </text>
                      <text
                        x="292"
                        y="30"
                        fontSize="9"
                        fill="#065F46"
                        textAnchor="middle"
                      >
                        مؤشر أعلى من العتبة الداخلية (&gt;45%)
                      </text>

                      <text
                        x="200"
                        y="218"
                        fontSize="10"
                        fill="#475569"
                        textAnchor="middle"
                      >
                        مؤشر الأداء الاستدلالي للقراءة → (الأعلى = أفضل)
                      </text>

                      {students.map((stu) => {
                        // Do not plot unassessed arithmetic tasks at an invented neutral score.
                        if (
                          stu.mathHeuristicIndicator === null ||
                          stu.mathRiskLevel === 'unassessed' ||
                          stu.dyscalculiaAssessed === false
                        ) {
                          return null;
                        }
                        const cx = 40 + (stu.readingHeuristicIndicator / 100) * 320;
                        const effectiveMathIndicator = stu.mathHeuristicIndicator;
                        const cy = 190 - (effectiveMathIndicator / 100) * 135;
                        const isSel = stu.id === selectedStudent.id;
                        const firstName = stu.name.split(' ')[0];

                        return (
                          <g
                            key={stu.id}
                            onClick={() => setSelectedStudentId(stu.id)}
                            className="cursor-pointer"
                          >
                            {isSel && (
                              <circle
                                cx={cx}
                                cy={cy}
                                r={13}
                                fill="#0284C7"
                                fillOpacity="0.2"
                                stroke="#0284C7"
                                strokeWidth="1.5"
                              />
                            )}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isSel ? 7 : 5.5}
                              fill={
                                stu.readingRiskLevel === 'high' ||
                                stu.mathRiskLevel === 'high'
                                  ? '#DC2626'
                                  : stu.readingRiskLevel === 'moderate' ||
                                      stu.mathRiskLevel === 'moderate'
                                    ? '#D97706'
                                    : '#059669'
                              }
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                            />
                            <text
                              x={cx}
                              y={cy - 10}
                              fontSize="10"
                              fontWeight={isSel ? '700' : '500'}
                              fill="#0F172A"
                              textAnchor="middle"
                            >
                              {firstName}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
                    <span>انقر على أي نقطة لتحديد الطالب</span>
                    <span className="font-mono tabular-nums text-slate-900 font-semibold">
                      أداء قرائي استدلالي {selectedStudent.readingHeuristicIndicator}/100 ·{' '}
                      {selectedStudent.mathHeuristicIndicator !== null &&
                      selectedStudent.mathRiskLevel !== 'unassessed'
                        ? `أداء حسابي استدلالي ${selectedStudent.mathHeuristicIndicator}/100`
                        : 'الحساب غير مُقيَّم'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VIEW 2: INTERACTIVE SCANPATH & HEATMAP VISUALIZER */}
            {dashboardSubView === 'scanpath' && (
              <div className="space-y-4">
                <ScanpathViewer
                  words={selectedPassage.words}
                  fixations={selectedStudent.fixations}
                  passageTitle={`${selectedPassage.title} — مسار نظر الطالب (${selectedStudent.name})`}
                  passageCategory={selectedPassage.category}
                />
              </div>
            )}

            {/* SUB-VIEW 3: AI SCREENING REPORT & INDIVIDUALIZED SUPPORT PLAN */}
            {dashboardSubView === 'report' && (
              <section id="student-report-content" className="print-report-root bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="p-6 sm:p-8 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">
                      تقرير الفرز الأولي الاسترشادي (مؤشرات تربوية غير تشخيصية)
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
                      <p className='mt-1 text-xs leading-relaxed text-slate-600'>هذه جلسات سابقة لنفس الملف. قارن النتائج الوصفية مع مراعاة اختلاف النص والجهاز وظروف الجلسة؛ ليست مقارنة معيارية أو تشخيصًا.</p>
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
                            <span>الطلاقة: <strong>{snapshot.wpm} كلمة/دقيقة</strong></span>
                            <span>الفهم: <strong>{snapshot.comprehensionScore}%</strong></span>
                            <span>مؤشر القراءة: <strong>{snapshot.readingHeuristicIndicator}/100</strong></span>
                            <span>الحساب: <strong>{snapshot.mathRiskLevel === 'unassessed' ? 'لم يُقيّم' : snapshot.mathRiskLevel + ' · ' + (snapshot.numberLinePAE ?? '—') + '% خطأ'}</strong></span>
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
                        ٠٢. تحليل حركة العين والتثبيتات البصرية
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {selectedStudent.clinicalReport.ocularMotorAnalysis}
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
                      {selectedStudent.clinicalReport.interventionExercises.map(
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
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-900">
                        التيسيرات الصفية والمدرسية الموصى بها
                      </h3>
                      <ul className="space-y-2.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-xl p-5">
                        {selectedStudent.clinicalReport.classroomAccommodations.map(
                          (acc, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-[#0284C7] font-bold">·</span>
                              <span>{acc}</span>
                            </li>
                          )
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
        {activeTab === 'adaptive-reader' && (
          <AdaptiveReaderView
            problematicWords={selectedStudent.problematicWords || []}
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

      {/* Quiet Clinical Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-5 mt-12">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            بصيرة — المنصة العربية للفرز الأولي لمؤشرات عسر القراءة والحساب بتتبع حركة العين
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="hover:text-slate-900 cursor-pointer"
            >
              الرئيسية
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('eye-lab')}
              className="hover:text-slate-900 cursor-pointer"
            >
              فحص القراءة والعين
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('dyscalculia-lab')}
              className="hover:text-slate-900 cursor-pointer"
            >
              فحص الحساب
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('adaptive-reader')}
              className="hover:text-slate-900 cursor-pointer"
            >
              القارئ الميسّر
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className="hover:text-slate-900 cursor-pointer"
            >
              سياسة الخصوصية
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="hover:text-slate-900 cursor-pointer"
            >
              التقرير النهائي والنتائج
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
