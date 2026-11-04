import React, { useState } from 'react';
import {
  Heart,
  Sparkles,
  UserPlus,
  Brain,
  FileBarChart,
  LogOut,
  Calendar,
  BookOpen,
  ShieldCheck,
  Baby,
  Mail,
  Lock,
  LogIn,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import type { StudentRecord } from '../data/seedData';
import { subtestsForAge } from '../cognitiveProfile/battery';
import { PROGRAM_SESSIONS } from '../cognitiveProfile/training';
import { summarizeProbes } from '../cognitiveProfile/progressProbe';
import { loadBatterySession, loadTrainingProgress } from '../cognitiveProfile/storage';
import { toArabicNum } from '../utils/arabicDigits';

const GRADE_ORDINALS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];

interface NextStep {
  stageAr: string;
  actionAr: string;
  progressAr: string | null;
  tab: 'dyslexia-lab' | 'guided-program' | 'dashboard';
}

/** The one thing a parent should do next for this child: screening, then the programme. */
function nextStepFor(child: StudentRecord): NextStep {
  const isInScreeningAgeRange = Number.isInteger(child.ageYears) && child.ageYears >= 4 && child.ageYears <= 8;
  if (!isInScreeningAgeRange) {
    return {
      stageAr: 'خارج نطاق الفحص الحالي',
      actionAr: 'عرض الملف والأنشطة الميسّرة',
      progressAr: 'البطارية الحالية مخصصة للأطفال من ٤ إلى ٨ سنوات؛ لن نغيّر العمر تلقائيًا لتجاوز هذا النطاق.',
      tab: 'dashboard',
    };
  }
  const stored = loadBatterySession(child.id) ?? child.cognitiveBattery ?? null;
  const battery = stored?.results ?? {};
  const tasks = subtestsForAge(stored?.ageMonths ?? child.ageYears * 12);
  const done = tasks.filter((s) => battery[s.id]).length;
  const training = loadTrainingProgress(child.id) ?? child.trainingProgress ?? null;
  if (done === 0) {
    return { stageAr: 'لم يبدأ الفحص', actionAr: 'ابدأ فحص مؤشرات عسر القراءة', progressAr: null, tab: 'dyslexia-lab' };
  }
  if (done < tasks.length && !training) {
    return {
      stageAr: 'الفحص قيد التنفيذ',
      actionAr: 'أكمل الفحص',
      progressAr: `أنهى ${toArabicNum(done)} من ${toArabicNum(tasks.length)} مهام. يمكن إكمالها على أكثر من جلسة.`,
      tab: 'dyslexia-lab',
    };
  }
  if (!training) {
    return { stageAr: 'اكتمل الفحص', actionAr: 'ابدأ البرنامج التدريبي', progressAr: 'النتيجة جاهزة، والبرنامج مبني عليها.', tab: 'guided-program' };
  }
  const sessions = new Set(training.history.map((h) => h.date.slice(0, 10))).size;
  const summary = summarizeProbes(training.probes ?? []);
  const trend = summary && summary.count >= 2 ? ` · مقياس التقدّم: ${toArabicNum(summary.baseline)}٪ في البداية، ${toArabicNum(summary.latest)}٪ في آخر جلسة` : '';
  return {
    stageAr: 'في البرنامج التدريبي',
    actionAr: 'ابدأ جلسة اليوم',
    progressAr: `الجلسات: ${toArabicNum(sessions)} من ${toArabicNum(PROGRAM_SESSIONS)}${trend}`,
    tab: 'guided-program',
  };
}
import { BrandMark } from './ui/BrandMark';

interface ParentPortalViewProps {
  supabaseUser: any;
  authLoading: boolean;
  students: StudentRecord[];
  onSignInWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  onSignOut: () => Promise<void>;
  onRegisterChild: (child: {
    name: string;
    ageYears: number;
    gradeLevel: number;
    dialectCode: 'msa' | 'gulf' | 'egyptian' | 'levantine' | 'maghrebi';
    notes?: string;
    parentEmail?: string;
    parentPassword?: string;
  }) => Promise<string | null> | (string | null);
  onSelectStudent: (studentId: string, targetTab: 'dyslexia-lab' | 'dashboard' | 'guided-program') => void;
  onNavigateHome: () => void;
}

export function ParentPortalView({
  supabaseUser,
  authLoading,
  students,
  onSignInWithEmail,
  onSignOut,
  onRegisterChild,
  onSelectStudent,
  onNavigateHome,
}: ParentPortalViewProps) {
  // Mode: 'register' or 'login'
  const [portalMode, setPortalMode] = useState<'register' | 'login'>('register');

  // Registration Form State
  const [childName, setChildName] = useState('');
  const [ageYears, setAgeYears] = useState<number>(0);
  const [gradeLevel, setGradeLevel] = useState<number>(1);
  const [dialectCode, setDialectCode] = useState<'msa' | 'gulf' | 'egyptian' | 'levantine' | 'maghrebi'>('gulf');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [parentNotes, setParentNotes] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [formError, setFormError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Real registered children only (exclude demo records AND guest placeholder):
  const myChildren = students.filter(
    (s) => !s.isDemoRecord && s.id !== 'stu-guest' && s.id !== 'stu-1' && s.name !== 'طفلك'
  );

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = childName.trim();
    if (cleanName.length < 2) {
      setFormError('أدخل اسمًا مستعارًا أو لقبًا للطفل لا يقل عن حرفين.');
      return;
    }

    if (!supabaseUser) {
      const cleanEmail = parentEmail.trim();
      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        setFormError('يرجى إدخال بريد إلكتروني صحيح لحفظ ملف طفلك والتواصل معكم.');
        return;
      }
      if (parentPassword.length < 6) {
        setFormError('يرجى إدخال كلمة مرور من 6 خانات على الأقل لحماية حسابك.');
        return;
      }
    }

    if (!Number.isInteger(ageYears) || ageYears < 4 || ageYears > 8) {
      setFormError('الفحص الحالي مخصص للأطفال من ٤ إلى ٨ سنوات فقط.');
      return;
    }
    if (!consentChecked) {
      setFormError('يرجى تأكيد موافقة ولي الأمر قبل إنشاء ملف الطفل.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newId = await onRegisterChild({
        name: cleanName,
        ageYears,
        gradeLevel,
        dialectCode,
        notes: parentNotes.trim(),
        parentEmail: parentEmail.trim(),
        parentPassword: parentPassword,
      });

      if (newId) {
        setChildName('');
        setParentNotes('');
        setParentPassword('');
        setConsentChecked(false);
        setShowAddForm(false);
        onSelectStudent(newId, 'dyslexia-lab');
      }
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ أثناء تسجيل البيانات. يرجى المحاولة ثانية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const cleanEmail = loginEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLoginError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (!loginPassword) {
      setLoginError('يرجى إدخال كلمة المرور.');
      return;
    }

    setIsSubmitting(true);
    const res = await onSignInWithEmail(cleanEmail, loginPassword);
    setIsSubmitting(false);

    if (res.success) {
      setLoginEmail('');
      setLoginPassword('');
      setPortalMode('register');
    } else {
      setLoginError(res.error || 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }
  };

  return (
    <div className="min-h-[85vh] bg-gradient-to-b from-slate-50 to-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Top Header Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <BrandMark size={48} />
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-bold mb-1.5">
                  <Heart size={14} className="text-teal-600 fill-teal-600" />
                  <span>بوابة أولياء الأمور والأسرة</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  هَيَّا نَقْرَأْ — رحلة طفلك
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  اكتشف قدرات طفلك في القراءة مبكراً، وتابِع تقدمه في جو من المرح والأمان.
                </p>
              </div>
            </div>

            {/* User Profile / Status */}
            <div>
              {supabaseUser ? (
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 sm:px-4">
                  <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center">
                    {(supabaseUser.user_metadata?.full_name || supabaseUser.email || 'و')[0].toUpperCase()}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900 leading-tight">
                      {supabaseUser.user_metadata?.full_name || 'ولي أمر مسجل'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate max-w-[150px]">{supabaseUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onSignOut}
                    title="تسجيل الخروج"
                    className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {portalMode === 'register' ? (
                    <button
                      type="button"
                      onClick={() => setPortalMode('login')}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <LogIn size={15} className="text-teal-600" />
                      <span>دخول ولي أمر مسجل</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPortalMode('register')}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <UserPlus size={15} className="text-teal-600" />
                      <span>تسجيل طفل جديد</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Informative Security Banner */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900 leading-relaxed">
            <strong>الخصوصية ومعالجة البيانات:</strong> قد تُحفظ بيانات الطفل على الجهاز أو في حساب الأسرة أو سجل المؤسسة بحسب طريقة الاستخدام. تستخدم بعض الميزات الاختيارية مزودي خدمات تقنيين؛ وتوضح سياسة الخصوصية أنواع البيانات ومزودي المعالجة. لا تُستخدم البيانات للإعلانات.
          </div>
        </div>

        {/* Existing Children Section (if any) */}
        {myChildren.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Baby size={20} className="text-teal-600" />
                <span>أطفالي المسجلون ({myChildren.length})</span>
              </h2>
              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(true);
                    setPortalMode('register');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition-colors shadow-xs cursor-pointer"
                >
                  <UserPlus size={15} />
                  <span>إضافة طفل آخر</span>
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {myChildren.map((child) => (
                <div
                  key={child.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-teal-400 transition-all shadow-xs space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">{child.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        العمر: {toArabicNum(child.ageYears)} {child.ageYears >= 3 && child.ageYears <= 10 ? 'سنوات' : 'سنة'} · {child.gradeLevel === 0 ? 'الروضة / تمهيدي' : child.gradeLevel >= 6 ? 'الصف السادس فما فوق' : `الصف ${GRADE_ORDINALS[child.gradeLevel] ?? toArabicNum(child.gradeLevel)} الابتدائي`}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800">
                      {nextStepFor(child).stageAr}
                    </span>
                  </div>

                  {(() => {
                    const step = nextStepFor(child);
                    return (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        {step.progressAr && <p className="text-xs text-slate-600">{step.progressAr}</p>}
                        <button
                          type="button"
                          onClick={() => onSelectStudent(child.id, step.tab)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors cursor-pointer"
                        >
                          {step.tab === 'guided-program' ? <TrendingUp size={16} /> : <Brain size={16} />}
                          <span>{step.actionAr}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectStudent(child.id, 'dashboard')}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <FileBarChart size={15} />
                          <span>عرض التقرير</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 1: PARENT LOGIN FORM (When portalMode === 'login' and not logged in) */}
        {!supabaseUser && portalMode === 'login' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <LogIn size={20} className="text-teal-600" />
                  <span>تسجيل دخول ولي أمر</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  أدخل بريدك الإلكتروني وكلمة المرور لمتابعة ملفات أطفالك وتقاريرهم القرائية السابقة.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPortalMode('register')}
                className="text-xs text-teal-600 font-bold hover:underline cursor-pointer"
              >
                تسجيل طفل جديد ←
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-md mx-auto">
              {loginError && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold">
                  {loginError}
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Mail size={14} className="text-slate-400" />
                  <span>البريد الإلكتروني لولي الأمر *</span>
                </span>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 text-sm"
                  dir="ltr"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock size={14} className="text-slate-400" />
                  <span>كلمة المرور *</span>
                </span>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 text-sm"
                  dir="ltr"
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmitting ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول وعرض أطفالي'}
              </button>
            </form>
          </div>
        )}

        {/* VIEW 2: ADD CHILD & IMMEDIATE REGISTRATION FORM */}
        {(myChildren.length === 0 || showAddForm) && portalMode === 'register' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus size={20} className="text-teal-600" />
                  <span>
                    {myChildren.length > 0
                      ? 'تسجيل بيانات طفل إضافي'
                      : supabaseUser
                      ? 'إضافة طفلك إلى حسابك العائلي'
                      : 'تسجيل طفل للتقييم الفوري والبدء المباشر'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {myChildren.length > 0
                    ? 'أدخل بيانات الطفل الجديد لإضافته إلى قائمة أطفالك ومتابعة تقدمه المستقل.'
                    : supabaseUser
                    ? 'أدخل بيانات طفلك لتهيئة ألعاب الفحص والبرنامج المخصص له وحفظ تقدمه.'
                    : 'أدخل بيانات طفلك للبدء الفوري في ألعاب فحص القراءة والوعي الصوتي، وحفظ نتائجه في حسابك.'}
                </p>
              </div>
              {myChildren.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  إلغاء
                </button>
              )}
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-6">
              {formError && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold">
                  {formError}
                </div>
              )}

              {/* Child pseudonym: avoid unnecessary personal identifiers. */}
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700">اسم الطفل المستعار أو اللقب *</span>
                <input
                  type="text"
                  required
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="مثال: سارة"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 text-sm"
                />
              </label>

              {/* Age selection: current battery is designed for ages 4–8. */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400" />
                  <span>عمر الطفل بالسنوات *</span>
                </span>
                <div className="grid grid-cols-5 gap-2">
                  {[4, 5, 6, 7, 8].map((age) => (
                    <button
                      key={age}
                      type="button"
                      onClick={() => setAgeYears(age)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        ageYears === age
                          ? 'border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {toArabicNum(age)} سنوات
                    </button>
                  ))}
                </div>
              </div>

              {/* Grade options aligned to current screening age range. */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <BookOpen size={14} className="text-slate-400" />
                  <span>المرحلة الدراسية الحالية *</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { val: 0, label: 'تمهيدي / روضة' },
                    { val: 1, label: 'الصف الأول' },
                    { val: 2, label: 'الصف الثاني' },
                    { val: 3, label: 'الصف الثالث' },
                  ].map((g) => (
                    <button
                      key={g.val}
                      type="button"
                      onClick={() => setGradeLevel(g.val)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                        gradeLevel === g.val
                          ? 'border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Home Dialect (Added Maghrebi) */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700">اللهجة الأساسية في المنزل *</span>
                <p className="text-[11px] text-slate-500">
                  تساعد معرفة اللهجة المنزلية على تفسير الفروق الصوتية بحذر، ولا تعني أن كل اختلاف في النطق خطأ.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { code: 'gulf' as const, label: 'سعودية / خليجية' },
                    { code: 'msa' as const, label: 'فصحى معيارية' },
                    { code: 'egyptian' as const, label: 'مصرية' },
                    { code: 'levantine' as const, label: 'شامية' },
                    { code: 'maghrebi' as const, label: 'مغاربية (مغرب / جزائر / تونس)' },
                  ].map((d) => (
                    <button
                      key={d.code}
                      type="button"
                      onClick={() => setDialectCode(d.code)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                        dialectCode === d.code
                          ? 'border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parent Credentials (Only if not logged in) */}
              {!supabaseUser && (
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <Mail size={16} className="text-teal-600" />
                    <span>بيانات حساب ولي الأمر (لحفظ ومتابعة تقارير طفلك)</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block space-y-1">
                      <span className="text-xs font-bold text-slate-700">بريدك الإلكتروني *</span>
                      <input
                        type="email"
                        required
                        value={parentEmail}
                        onChange={(e) => setParentEmail(e.target.value)}
                        placeholder="parent@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-800"
                        dir="ltr"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-bold text-slate-700">كلمة المرور للحساب *</span>
                      <input
                        type="password"
                        required
                        value={parentPassword}
                        onChange={(e) => setParentPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-800"
                        dir="ltr"
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    قد تُحفظ نتائج الطفل في حساب الأسرة للرجوع إليها لاحقًا. راجع سياسة الخصوصية لمعرفة مواقع التخزين ومزودي المعالجة وفترات الاحتفاظ.
                  </p>
                </div>
              )}

              {/* Parent Notes (Optional) with AI Adaptation Hint */}
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>ملاحظات خاصة عن الطفل (اختياري)</span>
                </span>
                <p className="text-[11px] text-slate-500">
                  ملاحظات عامة اختيارية. لا تكتب معلومات طبية أو تفاصيل تعريفية لا تحتاجها المنصة.
                </p>
                <input
                  type="text"
                  value={parentNotes}
                  onChange={(e) => setParentNotes(e.target.value)}
                  placeholder="مثال: يفضّل الاستماع إلى الكلمة قبل قراءتها..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-normal text-slate-800 text-sm"
                />
              </label>

              {/* Guardian Consent Checkbox */}
              <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-1 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                />
                <span className="text-xs text-slate-700 leading-relaxed">
                  أوافق بصفتي ولي أمر الطفل على إنشاء ملف للأنشطة التعليمية واستكشاف مهارات القراءة وفق سياسة الخصوصية. أعلم أن النتائج استكشافية وليست تشخيصًا أو مقارنة معيارية. هذه الموافقة لا تشمل التسجيل الصوتي؛ ستُطلب موافقة منفصلة قبل استخدام الميكروفون.
                </span>
              </label>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                {!supabaseUser && (
                  <button
                    type="button"
                    onClick={() => setPortalMode('login')}
                    className="text-xs text-slate-600 hover:text-teal-700 font-bold transition-colors cursor-pointer order-2 sm:order-1"
                  >
                    لديك حساب بالفعل؟ تسجيل الدخول هنا ←
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3.5 px-8 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 order-1 sm:order-2"
                >
                  <Brain size={18} />
                  <span>{isSubmitting ? 'جارٍ تهيئة الفحص…' : 'حفظ وبدء فحص القراءة الآن ←'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

export default ParentPortalView;
