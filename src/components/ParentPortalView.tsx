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
  Cloud,
  AlertTriangle,
  Globe,
  Trash2,
} from 'lucide-react';
import type { StudentRecord } from '../data/seedData';
import { subtestsForAge } from '../cognitiveProfile/battery';
import { PROGRAM_SESSIONS } from '../cognitiveProfile/training';
import { summarizeProbes } from '../cognitiveProfile/progressProbe';
import { loadBatterySession, loadTrainingProgress } from '../cognitiveProfile/storage';
import { toArabicNum } from '../utils/arabicDigits';
import { BrandMark } from './ui/BrandMark';
import { JoyCorners } from './ui/Playful';
import { MascotLive } from './ui/MascotLive';

const GRADE_ORDINALS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];

export const ARAB_COUNTRIES = [
  { code: 'QA', name: 'قطر', flag: '🇶🇦' },
  { code: 'SA', name: 'المملكة العربية السعودية', flag: '🇸🇦' },
  { code: 'AE', name: 'الإمارات العربية المتحدة', flag: '🇦🇪' },
  { code: 'KW', name: 'الكويت', flag: '🇰🇼' },
  { code: 'OM', name: 'سلطنة عُمان', flag: '🇴🇲' },
  { code: 'BH', name: 'البحرين', flag: '🇧🇭' },
  { code: 'EG', name: 'مصر', flag: '🇪🇬' },
  { code: 'JO', name: 'الأردن', flag: '🇯🇴' },
  { code: 'PS', name: 'فلسطين', flag: '🇵🇸' },
  { code: 'LB', name: 'لبنان', flag: '🇱🇧' },
  { code: 'SY', name: 'سوريا', flag: '🇸🇾' },
  { code: 'IQ', name: 'العراق', flag: '🇮🇶' },
  { code: 'MA', name: 'المغرب', flag: '🇲🇦' },
  { code: 'DZ', name: 'الجزائر', flag: '🇩🇿' },
  { code: 'TN', name: 'تونس', flag: '🇹🇳' },
  { code: 'LY', name: 'ليبيا', flag: '🇱🇾' },
  { code: 'SD', name: 'السودان', flag: '🇸🇩' },
  { code: 'YE', name: 'اليمن', flag: '🇾🇪' },
  { code: 'MR', name: 'موريتانيا', flag: '🇲🇷' },
  { code: 'SO', name: 'الصومال', flag: '🇸🇴' },
  { code: 'DJ', name: 'جيبوتي', flag: '🇩🇯' },
  { code: 'KM', name: 'جزر القمر', flag: '🇰🇲' },
  { code: 'OTHER', name: 'دولة أخرى', flag: '🌍' },
];

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
      progressAr: 'الفحص الحالي مخصص للأطفال من ٤ إلى ٨ سنوات، ولن نغيّر العمر تلقائيًا لتجاوز هذا النطاق.',
      tab: 'dashboard',
    };
  }
  const stored = child.cognitiveBattery ?? null;
  const battery = stored?.results ?? {};
  const tasks = subtestsForAge(stored?.ageMonths ?? child.ageYears * 12);
  const done = tasks.filter((s) => battery[s.id]).length;
  const training = child.trainingProgress ?? null;
  if (done === 0) {
    return { stageAr: 'لم يبدأ الفحص', actionAr: 'ابدأ فحص مهارات القراءة', progressAr: null, tab: 'dyslexia-lab' };
  }
  if (done < tasks.length && !training) {
    return {
      stageAr: 'الفحص قيد التنفيذ',
      actionAr: 'أكمل الفحص',
      progressAr: `المهام المنجزة: ${toArabicNum(done)} من ${toArabicNum(tasks.length)}. يمكن إكمال الفحص على أكثر من جلسة.`,
      tab: 'dyslexia-lab',
    };
  }
  if (!training) {
    return { stageAr: 'اكتمل الفحص', actionAr: 'ابدأ البرنامج التدريبي', progressAr: 'النتيجة جاهزة، والبرنامج مبني عليها.', tab: 'guided-program' };
  }
  const historyList = Array.isArray(training.history) ? training.history : [];
  const sessions = new Set(historyList.filter((h) => h && h.date).map((h) => h.date.slice(0, 10))).size;
  const summary = summarizeProbes(training.probes ?? []);
  const trend = summary && summary.count >= 2 ? ` · مقياس التقدّم: ${toArabicNum(summary.baseline)}٪ في البداية، ${toArabicNum(summary.latest)}٪ في آخر جلسة` : '';
  return {
    stageAr: 'في البرنامج التدريبي',
    actionAr: 'ابدأ جلسة اليوم',
    progressAr: `الجلسات: ${toArabicNum(sessions)} من ${toArabicNum(PROGRAM_SESSIONS)}${trend}`,
    tab: 'guided-program',
  };
}

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
    country?: string;
    dialectCode?: 'msa' | 'gulf' | 'egyptian' | 'levantine' | 'maghrebi' | string;
    audioConsentGiven?: boolean;
    notes?: string;
    parentEmail?: string;
    parentPassword?: string;
  }) => Promise<string | null> | (string | null);
  onLinkLocalChild: (childId: string, email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  /** Permanently delete a child's file and results (cloud account and this device). */
  onDeleteChild?: (childId: string) => Promise<{ success: boolean; error?: string }>;
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
  onLinkLocalChild,
  onDeleteChild,
  onSelectStudent,
  onNavigateHome,
}: ParentPortalViewProps) {
  // Mode when unauthenticated: 'register' | 'login'
  const [portalMode, setPortalMode] = useState<'register' | 'login'>('register');

  // Toggle for adding another child when authenticated
  const [showAddForm, setShowAddForm] = useState(false);

  // Registration Form State
  const [childName, setChildName] = useState('');
  const [ageYears, setAgeYears] = useState<number>(6);
  const [gradeLevel, setGradeLevel] = useState<number>(1);
  const [country, setCountry] = useState<string>('');
  const [readingDialect, setReadingDialect] = useState<'egyptian' | 'saudi' | 'other'>('other');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [parentNotes, setParentNotes] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [audioConsentChecked, setAudioConsentChecked] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deleting a child's file: which child awaits confirmation, and any error.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const deleteChild = async (childId: string) => {
    if (!onDeleteChild) return;
    setIsDeleting(true);
    setDeleteError('');
    const result = await onDeleteChild(childId);
    setIsDeleting(false);
    if (result.success) setConfirmDeleteId(null);
    else setDeleteError(result.error || 'تعذّر حذف الملف. أعد المحاولة.');
  };

  const deleteControls = (child: StudentRecord) =>
    onDeleteChild ? (
      confirmDeleteId === child.id ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2" role="alertdialog" aria-label={`تأكيد حذف ملف ${child.name}`}>
          <p className="text-xs font-bold text-rose-900">
            سيُحذف ملف «{child.name}» وكل نتائجه (الفحص والقراءة والتدريب) نهائيًا من حسابك ومن هذا الجهاز. لا يمكن التراجع عن الحذف.
          </p>
          {deleteError && <p className="text-xs text-rose-800" role="alert">{deleteError}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={isDeleting} onClick={() => void deleteChild(child.id)} className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-60">
              {isDeleting ? 'جارٍ الحذف…' : 'نعم، احذف نهائيًا'}
            </button>
            <button type="button" disabled={isDeleting} onClick={() => { setConfirmDeleteId(null); setDeleteError(''); }} className="flex-1 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold">
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setConfirmDeleteId(child.id); setDeleteError(''); }}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
        >
          <Trash2 size={14} aria-hidden="true" />
          <span>حذف ملف الطفل وبياناته</span>
        </button>
      )
    ) : null;

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Link Local Child Form State
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkError, setLinkError] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // Cloud-synced children belonging to this authenticated user
  const cloudChildren = supabaseUser
    ? students.filter(
        (s) =>
          !s.isDemoRecord &&
          s.id !== 'stu-guest' &&
          s.id !== 'stu-1' &&
          s.name !== 'طفلك' &&
          (s.parentAccount === supabaseUser.id ||
            s.parentAccount === supabaseUser.email ||
            s.schoolName?.includes(supabaseUser.email))
      )
    : [];

  // Local unsaved guest children on this browser (created without an account, e.g. /screening)
  const localGuestChildren = !supabaseUser
    ? students.filter(
        (s) =>
          !s.isDemoRecord &&
          s.id !== 'stu-guest' &&
          s.id !== 'stu-1' &&
          s.name !== 'طفلك' &&
          !s.parentAccount
      )
    : [];

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = childName.trim();
    if (cleanName.length < 2) {
      setFormError('أدخل اسمًا مستعارًا أو لقبًا للطفل لا يقل عن حرفين.');
      return;
    }

    if (!Number.isInteger(ageYears) || ageYears < 4 || ageYears > 8) {
      setFormError('الفحص الحالي مخصص للأطفال من ٤ إلى ٨ سنوات فقط.');
      return;
    }
    if (!consentChecked) {
      setFormError('يرجى تأكيد موافقة ولي الأمر قبل إنشاء ملف الطفل.');
      return;
    }

    const cleanEmail = parentEmail.trim();
    const hasEmail = cleanEmail.length > 0;
    const hasPassword = parentPassword.length > 0;
    if (hasEmail !== hasPassword) {
      setFormError('لإنشاء حساب الأسرة، أدخل البريد وكلمة المرور معًا، أو اتركهما فارغين لاستخدام وضع الزائر.');
      return;
    }
    if (hasEmail && (!cleanEmail.includes('@') || !cleanEmail.includes('.') || parentPassword.length < 6)) {
      setFormError('أدخل بريدًا إلكترونيًا صحيحًا وكلمة مرور من ٦ خانات على الأقل، أو اترك الحقلين فارغين.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newId = await onRegisterChild({
        name: cleanName,
        ageYears,
        gradeLevel,
        country,
        dialectCode: readingDialect,
        audioConsentGiven: audioConsentChecked,
        notes: parentNotes.trim(),
        parentEmail: parentEmail.trim(),
        parentPassword: parentPassword,
      });

      if (newId) {
        setChildName('');
        setParentNotes('');
        setParentPassword('');
        setConsentChecked(false);
        setAudioConsentChecked(false);
        setShowAddForm(false);
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'instant' });
        }
        onSelectStudent(newId, 'dyslexia-lab');
      }
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ أثناء تسجيل البيانات. حاول مرة أخرى.');
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
    } else {
      setLoginError(res.error || 'البريد الإلكتروني أو كلمة المرور غير صحيحين.');
    }
  };

  const handleLinkLocalSubmit = async (e: React.FormEvent, targetChildId: string) => {
    e.preventDefault();
    setLinkError('');

    const cleanEmail = linkEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setLinkError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (linkPassword.length < 6) {
      setLinkError('يجب ألّا تقل كلمة المرور عن ٦ خانات.');
      return;
    }

    setIsLinking(true);
    const res = await onLinkLocalChild(targetChildId, cleanEmail, linkPassword);
    setIsLinking(false);

    if (res.success) {
      setLinkEmail('');
      setLinkPassword('');
    } else {
      setLinkError(res.error || 'تعذّر حفظ الملف في حسابك. تأكّد من البيانات وأعد المحاولة.');
    }
  };

  return (
    <div className="min-h-[85vh] py-10 px-4 sm:px-6 lg:px-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Top Header Card */}
        <div className="joy-header joy-header-sun rounded-[28px] p-6 sm:p-8 relative overflow-hidden">
          <JoyCorners variant="a" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <span className="joy-decor hidden sm:block shrink-0" aria-hidden="true"><MascotLive mood="wave" size={112} className="w-28" /></span>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-bold mb-1.5">
                  <Heart size={14} className="text-teal-600 fill-teal-600" />
                  <span>بوابة أولياء الأمور والأسرة</span>
                </div>
                <h1 className="joy-title">
                  هَيَّا نَقْرَأْ — رحلة طفلك
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  تعرّف إلى مهارات طفلك في القراءة، وتابع تقدّمه من ملف الأسرة.
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
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        {supabaseUser.user_metadata?.full_name || 'ولي أمر مسجل'}
                      </p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        ☁️ سحابي
                      </span>
                    </div>
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
                  <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium">
                    وضع الزائر (غير مسجل)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security / Privacy Banner */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900 leading-relaxed">
            <strong>حفظ البيانات:</strong> يُحفظ الملف في حساب الأسرة بعد نجاح التسجيل، أو على هذا الجهاز في وضع الزائر. تسجيل الصوت اختياري وبموافقة منفصلة.
          </div>
        </div>

        {/* UN-SYNCED LOCAL CHILDREN ALERT BANNER (When visitor has local screening records on this browser) */}
        {!supabaseUser && localGuestChildren.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-2xl shrink-0 mt-0.5 sm:mt-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-amber-950 flex flex-wrap items-center gap-2">
                    <span>ملف الطفل «{localGuestChildren[0].name}» محفوظ على هذا الجهاز فقط!</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                      غير محفوظ في السحابة ⚠️
                    </span>
                  </h2>
                  <p className="text-xs text-amber-900/80 mt-1">
                    العمر: {toArabicNum(localGuestChildren[0].ageYears)} سنوات · أُنشئ هذا الملف أثناء الفحص السريع على هذا المتصفح، وإذا مُسحت بيانات المتصفح فقد تضيع نتائجه.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectStudent(localGuestChildren[0].id, 'dyslexia-lab')}
                className="bz-btn bz-btn-secondary bz-btn-sm whitespace-nowrap text-xs font-bold self-start sm:self-center"
              >
                متابعة الفحص كزائر ←
              </button>
            </div>
            <div className="max-w-sm">{deleteControls(localGuestChildren[0])}</div>

            <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-4 sm:p-5 border border-amber-200/80 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Cloud size={16} className="text-teal-600" />
                <span>احفظ ملف «{localGuestChildren[0].name}» في حسابك الآن بضغطة واحدة:</span>
              </div>
              <p className="text-xs text-slate-600">
                أدخل بريدك الإلكتروني وكلمة المرور لإنشاء حساب للأسرة (أو للدخول إلى حسابك)، فتُحفظ نتائج الطفل تلقائيًا:
              </p>

              {linkError && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold">
                  {linkError}
                </div>
              )}

              <form onSubmit={(e) => handleLinkLocalSubmit(e, localGuestChildren[0].id)} className="grid sm:grid-cols-3 gap-3 pt-1">
                <input
                  type="email"
                  required
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="بريدك الإلكتروني (parent@example.com)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 font-medium bg-white"
                  dir="ltr"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                  placeholder="كلمة المرور (٦ خانات على الأقل)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 font-medium bg-white"
                  dir="ltr"
                />
                <button
                  type="submit"
                  disabled={isLinking}
                  className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Cloud size={16} />
                  <span>{isLinking ? 'جارٍ الحفظ في السحابة…' : `☁️ حفظ «${localGuestChildren[0].name}» في السحابة`}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            STATE 1: AUTHENTICATED PARENT (User is logged in via Supabase)
            ========================================================================= */}
        {supabaseUser && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Baby size={20} className="text-teal-600" />
                <span>أطفالي المسجّلون في الحساب ({toArabicNum(cloudChildren.length)})</span>
              </h2>
              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition-colors shadow-xs cursor-pointer"
                >
                  <UserPlus size={15} />
                  <span>+ إضافة طفل آخر إلى حسابي</span>
                </button>
              )}
            </div>

            {/* Cloud Children Cards */}
            {cloudChildren.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-4">
                {cloudChildren.map((child) => (
                  <div
                    key={child.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-teal-400 transition-all shadow-xs space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-900 text-base">{child.name}</h3>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ☁️ محفوظ في السحابة
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          العمر: {toArabicNum(child.ageYears)} {child.ageYears >= 3 && child.ageYears <= 10 ? 'سنوات' : 'سنة'} · {child.gradeLevel === 0 ? 'الروضة / تمهيدي' : child.gradeLevel >= 6 ? 'الصف السادس فما فوق' : `الصف ${GRADE_ORDINALS[child.gradeLevel] ?? toArabicNum(child.gradeLevel)} الابتدائي`}{(child.country || (child.dialect && child.dialect !== 'faseeh' && child.dialect !== 'msa')) ? ` · الدولة: ${child.country || child.dialect}` : ''}
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
                            <span>عرض التقرير وخطة الدعم</span>
                          </button>
                          {deleteControls(child)}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}

            {/* Authenticated Add Child Form (when clicking "+ إضافة طفل آخر" or when user has no children yet) */}
            {(showAddForm || cloudChildren.length === 0) && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <UserPlus size={20} className="text-teal-600" />
                      <span>{cloudChildren.length > 0 ? 'إضافة طفل آخر إلى حسابك' : 'تسجيل أول طفل في حسابك السحابي'}</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      أدخل بيانات الطفل لحفظ ملفه في حسابك السحابي ({supabaseUser.email}) وبدء ألعاب الفحص والتدريب فورًا.
                    </p>
                  </div>
                  {cloudChildren.length > 0 && (
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

                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">اسم الطفل المستعار أو اللقب *</span>
                    <input
                      type="text"
                      required
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="مثال: سارة أو إياد"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 text-sm"
                    />
                  </label>

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


                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Globe size={14} className="text-teal-600" />
                      <span>دولة الطفل *</span>
                    </span>
                    <select
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 text-sm bg-white cursor-pointer"
                    >
                      <option value="">اختر الدولة</option>
                      {ARAB_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">لهجة الطفل المعتادة *</span>
                    <select
                      required
                      value={readingDialect}
                      onChange={(e) => setReadingDialect(e.target.value as typeof readingDialect)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 text-sm bg-white cursor-pointer"
                    >
                      <option value="other">لهجة عربية أخرى أو غير محددة</option>
                      <option value="egyptian">المصرية</option>
                      <option value="saudi">السعودية</option>
                    </select>
                    <span className="text-xs text-slate-500 leading-5">النصوص بالفصحى. التقييم الصوتي متاح حاليًا للمصرية والسعودية فقط؛ بقية اللهجات تتابع الأنشطة دون درجة صوتية.</span>
                  </label>

                  <details className="rounded-xl border border-slate-200 p-3">
                    <summary className="cursor-pointer text-xs font-bold text-slate-700">ملاحظة إضافية عن الطفل (اختياري)</summary>
                    <label className="block mt-3">
                      <input
                        type="text"
                        value={parentNotes}
                        onChange={(e) => setParentNotes(e.target.value)}
                        placeholder="معلومة تساعدنا على فهم احتياجه"
                        aria-label="ملاحظة إضافية عن الطفل"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 text-sm"
                      />
                    </label>
                  </details>

                  <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-1 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      أوافق بصفتي ولي أمر الطفل على إنشاء ملفه وحفظ نتائجه التعليمية في حسابي وفق سياسة الخصوصية.
                    </span>
                  </label>
                  <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={audioConsentChecked}
                      onChange={(e) => setAudioConsentChecked(e.target.checked)}
                      className="mt-1 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      أوافق اختياريًا على تسجيل صوت الطفل عند قراءة الكلمات والنصوص أو تسمية الصور والحروف، وإرساله إلى خدمة معالجة الصوت المعتمدة لتحليله آليًا. عدم الموافقة لا يمنع الأنشطة الصامتة.
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    راجع <a href="/privacy" target="_blank" rel="noreferrer" className="font-bold text-teal-700 underline underline-offset-2">سياسة الخصوصية</a> لمعرفة كيفية معالجة بيانات الطفل وصوته.
                  </p>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3.5 px-8 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Cloud size={18} />
                      <span>{isSubmitting ? 'جارٍ الحفظ في السحابة…' : '☁️ حفظ الطفل في السحابة وبدء الفحص ←'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            STATE 2: UNAUTHENTICATED VISITOR (Tabs for Register vs Login)
            ========================================================================= */}
        {!supabaseUser && (
          <div className="space-y-6">
            {/* Segmented Mode Selector */}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setPortalMode('register')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  portalMode === 'register'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus size={16} />
                <span>📝 تسجيل طفل</span>
              </button>
              <button
                type="button"
                onClick={() => setPortalMode('login')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  portalMode === 'login'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn size={16} />
                <span>🔑 دخول ولي أمر مسجل</span>
              </button>
            </div>

            {/* TAB 1: REGISTRATION FORM */}
            {portalMode === 'register' && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus size={20} className="text-teal-600" />
                    <span>تسجيل طفل</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    أدخل بيانات طفلك. يمكنك حفظ ملفه على هذا الجهاز أو إنشاء حساب للأسرة لمتابعة نتائجه من أي جهاز.
                  </p>
                </div>

                <form onSubmit={handleRegisterSubmit} className="space-y-6">
                  {formError && (
                    <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold">
                      {formError}
                    </div>
                  )}

                  {/* Child pseudonym */}
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">اسم الطفل المستعار أو اللقب *</span>
                    <input
                      type="text"
                      required
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="مثال: إياد أو سارة"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 text-sm"
                    />
                  </label>

                  {/* Age selection */}
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

                  {/* Grade options */}
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


                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Globe size={14} className="text-teal-600" />
                      <span>دولة الطفل *</span>
                    </span>
                    <select
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 text-sm bg-white cursor-pointer"
                    >
                      <option value="">اختر الدولة</option>
                      {ARAB_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">لهجة الطفل المعتادة *</span>
                    <select
                      required
                      value={readingDialect}
                      onChange={(e) => setReadingDialect(e.target.value as typeof readingDialect)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 text-sm bg-white cursor-pointer"
                    >
                      <option value="other">لهجة عربية أخرى أو غير محددة</option>
                      <option value="egyptian">المصرية</option>
                      <option value="saudi">السعودية</option>
                    </select>
                    <span className="text-xs text-slate-500 leading-5">النصوص بالفصحى. التقييم الصوتي متاح حاليًا للمصرية والسعودية فقط؛ بقية اللهجات تتابع الأنشطة دون درجة صوتية.</span>
                  </label>

                  {/* Parent Credentials */}
                  <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Mail size={16} className="text-teal-600" />
                      <span>حساب ولي الأمر (اختياري)</span>
                    </div>
                    <p className="text-xs leading-5 text-slate-600">أدخل البريد وكلمة المرور معًا لحفظ الملف في حسابك السحابي، أو اتركهما فارغين لاستخدام وضع الزائر.</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <label className="block space-y-1">
                        <span className="text-xs font-bold text-slate-700">البريد الإلكتروني</span>
                        <input
                          type="email"
                          value={parentEmail}
                          onChange={(e) => setParentEmail(e.target.value)}
                          placeholder="parent@example.com"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-800"
                          dir="ltr"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-bold text-slate-700">كلمة المرور</span>
                        <input
                          type="password"
                          value={parentPassword}
                          onChange={(e) => setParentPassword(e.target.value)}
                          placeholder="••••••••"
                          minLength={6}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-800"
                          dir="ltr"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Optional notes */}
                  <details className="rounded-xl border border-slate-200 p-3">
                    <summary className="cursor-pointer text-xs font-bold text-slate-700">ملاحظة إضافية عن الطفل (اختياري)</summary>
                    <label className="block mt-3">
                      <input
                        type="text"
                        value={parentNotes}
                        onChange={(e) => setParentNotes(e.target.value)}
                        placeholder="معلومة تساعدنا على فهم احتياجه"
                        aria-label="ملاحظة إضافية عن الطفل"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 text-sm"
                      />
                    </label>
                  </details>

                  {/* Consent Checkboxes */}
                  <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-1 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      أوافق على إنشاء ملف الطفل وحفظ نتائجه وفق سياسة الخصوصية. يُحفظ الملف على هذا الجهاز ما لم أسجّل حسابًا سحابيًا.
                    </span>
                  </label>
                  <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={audioConsentChecked}
                      onChange={(e) => setAudioConsentChecked(e.target.checked)}
                      className="mt-1 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      أوافق اختياريًا على تسجيل صوت الطفل عند قراءة الكلمات والنصوص أو تسمية الصور والحروف، وإرساله إلى خدمة معالجة الصوت المعتمدة لتحليله آليًا. عدم الموافقة لا يمنع الأنشطة الصامتة.
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    راجع <a href="/privacy" target="_blank" rel="noreferrer" className="font-bold text-teal-700 underline underline-offset-2">سياسة الخصوصية</a> لمعرفة كيفية معالجة بيانات الطفل وصوته.
                  </p>

                  {/* Submit Button */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setPortalMode('login')}
                      className="text-xs text-slate-600 hover:text-teal-700 font-bold transition-colors cursor-pointer order-2 sm:order-1"
                    >
                      لديك حساب بالفعل؟ تسجيل الدخول هنا ←
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3.5 px-8 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 order-1 sm:order-2"
                    >
                      <Brain size={18} />
                      <span>{isSubmitting ? 'جارٍ حفظ الملف…' : parentEmail.trim() && parentPassword ? 'حفظ ملف الطفل في حساب الأسرة وبدء الفحص ←' : parentEmail.trim() || parentPassword ? 'أكمل البريد وكلمة المرور معًا' : 'حفظ ملف الطفل على هذا الجهاز وبدء الفحص ←'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 2: LOGIN FORM */}
            {portalMode === 'login' && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <LogIn size={20} className="text-teal-600" />
                      <span>تسجيل دخول ولي أمر</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      أدخل بريدك الإلكتروني وكلمة المرور لمتابعة ملفات أطفالك المحفوظة وتقاريرهم القرائية السابقة.
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
          </div>
        )}

      </div>
    </div>
  );
}

export default ParentPortalView;
