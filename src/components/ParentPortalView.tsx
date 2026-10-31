import React, { useState } from 'react';
import {
  Heart,
  Sparkles,
  UserPlus,
  CheckCircle2,
  Brain,
  FileBarChart,
  LogOut,
  Calendar,
  BookOpen,
  ArrowLeft,
  ShieldCheck,
  Baby,
} from 'lucide-react';
import type { StudentRecord } from '../data/seedData';
import { BrandMark } from './ui/BrandMark';

interface ParentPortalViewProps {
  supabaseUser: any;
  authLoading: boolean;
  students: StudentRecord[];
  onSignInWithGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onRegisterChild: (child: {
    name: string;
    ageYears: number;
    gradeLevel: number;
    dialectCode: 'msa' | 'gulf' | 'egyptian' | 'levantine';
    notes?: string;
  }) => string | null;
  onSelectStudent: (studentId: string, targetTab: 'dyslexia-lab' | 'dashboard' | 'guided-program') => void;
  onNavigateHome: () => void;
}

export function ParentPortalView({
  supabaseUser,
  authLoading,
  students,
  onSignInWithGoogle,
  onSignOut,
  onRegisterChild,
  onSelectStudent,
  onNavigateHome,
}: ParentPortalViewProps) {
  const [childName, setChildName] = useState('');
  const [ageYears, setAgeYears] = useState<number>(6);
  const [gradeLevel, setGradeLevel] = useState<number>(1);
  const [dialectCode, setDialectCode] = useState<'msa' | 'gulf' | 'egyptian' | 'levantine'>('gulf');
  const [parentNotes, setParentNotes] = useState('');
  const [consentChecked, setConsentChecked] = useState(true);
  const [formError, setFormError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Filter children created under this parent or non-demo records
  const myChildren = students.filter((s) => !s.isDemoRecord);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = childName.trim();
    if (cleanName.length < 2) {
      setFormError('يرجى إدخال اسم الطفل الثلاثي أو الثنائي بشكل صحيح.');
      return;
    }
    if (!consentChecked) {
      setFormError('يرجى تأكيد موافقة ولي الأمر لمتابعة إنشاء الملف.');
      return;
    }

    const newId = onRegisterChild({
      name: cleanName,
      ageYears,
      gradeLevel,
      dialectCode,
      notes: parentNotes.trim(),
    });

    if (newId) {
      setChildName('');
      setParentNotes('');
      setShowAddForm(false);
      onSelectStudent(newId, 'dyslexia-lab');
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

            {/* User Profile / Login Button */}
            <div>
              {supabaseUser ? (
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 sm:px-4">
                  {supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture ? (
                    <img
                      src={supabaseUser.user_metadata.avatar_url || supabaseUser.user_metadata.picture}
                      alt="حسابك"
                      className="w-10 h-10 rounded-full border border-teal-500 object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center">
                      {(supabaseUser.user_metadata?.full_name || supabaseUser.email || 'و')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900 leading-tight">
                      {supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || 'ولي أمر معتمد'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate max-w-[140px]">{supabaseUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onSignOut}
                    title="تسجيل الخروج"
                    className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onSignInWithGoogle}
                  disabled={authLoading}
                  className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm shadow-xs transition-all cursor-pointer"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{authLoading ? 'جارٍ الاتصال بـ Google…' : 'دخول ولي الأمر بجوجل'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Informative Security Banner */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900 leading-relaxed">
            <strong>خصوصية تامة وأمان عائلي:</strong> جميع بيانات الأطفال والتقارير تُحفظ مشفرة في قاعدة بياناتك الخاصة، ولا تُشارك مع أي طرف ثالث. التقييم يتم عبر ألعاب تفاعلية ممتعة دون استخدام الكاميرا أو أي تتبع بصري مزعج.
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
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition-colors shadow-xs"
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
                        العمر: {child.ageYears} سنوات · {child.gradeLevel === 0 ? 'الروضة / تمهيدي' : `الصف ${child.gradeLevel} الابتدائي`}
                      </p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      child.sessionStatus === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {child.sessionStatus === 'completed' ? 'اكتمل الفحص' : 'قيد التدريب'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onSelectStudent(child.id, 'dyslexia-lab')}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-colors"
                    >
                      <Brain size={15} />
                      <span>بدء الفحص</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectStudent(child.id, 'dashboard')}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                    >
                      <FileBarChart size={15} />
                      <span>عرض التقرير</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Child Form (Shown if no children or user clicked add) */}
        {(myChildren.length === 0 || showAddForm) && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus size={20} className="text-teal-600" />
                  <span>تسجيل بيانات طفل جديد</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  أدخل معلومات طفلك الأساسية لتهيئة اختبارات الوعي الصوتي والقراءة وفق فئته العمرية.
                </p>
              </div>
              {myChildren.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  إلغاء
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {formError && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold">
                  {formError}
                </div>
              )}

              {/* Child Name */}
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700">اسم الطفل الثلاثي أو الثنائي *</span>
                <input
                  type="text"
                  required
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="مثال: عمر محمد السعيد"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 text-sm"
                />
              </label>

              {/* Age Selection */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400" />
                  <span>عمر الطفل بالسنوات *</span>
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[4, 5, 6, 7, 8, 9].map((age) => (
                    <button
                      key={age}
                      type="button"
                      onClick={() => setAgeYears(age)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        ageYears === age
                          ? 'border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {age === 9 ? '9+ سنوات' : `${age} سنوات`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grade Selection */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <BookOpen size={14} className="text-slate-400" />
                  <span>المرحلة الدراسية الحالية *</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { val: 0, label: 'الروضة / تمهيدي' },
                    { val: 1, label: 'الصف الأول الابتدائي' },
                    { val: 2, label: 'الصف الثاني الابتدائي' },
                    { val: 3, label: 'الصف الثالث الابتدائي' },
                  ].map((g) => (
                    <button
                      key={g.val}
                      type="button"
                      onClick={() => setGradeLevel(g.val)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
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

              {/* Home Dialect */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700">اللهجة الأساسية في المنزل *</span>
                <p className="text-[11px] text-slate-500">
                  تساعدنا على استبعاد المشتتات الصوتية التي تندمج في بعض اللهجات (مثل الذال والزاي، والقاف والكاف).
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { code: 'gulf' as const, label: 'سعودية / خليجية' },
                    { code: 'msa' as const, label: 'فصحى معيارية' },
                    { code: 'egyptian' as const, label: 'مصرية' },
                    { code: 'levantine' as const, label: 'شامية' },
                  ].map((d) => (
                    <button
                      key={d.code}
                      type="button"
                      onClick={() => setDialectCode(d.code)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
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

              {/* Parent Notes (Optional) */}
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700">ملاحظات خاصة عن الطفل (اختياري)</span>
                <input
                  type="text"
                  value={parentNotes}
                  onChange={(e) => setParentNotes(e.target.value)}
                  placeholder="مثال: يخلط بين الحروف المتشابهة، يتردد عند قراءة الحركات..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-normal text-slate-800 text-sm"
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
                <span className="text-xs text-slate-700 leading-relaxed font-medium">
                  <strong>موافقة وإقرار ولي الأمر:</strong> أوافق بصفتي ولي أمر الطفل على تسجيل بياناته وإجراء الفحص المعرفي وألعاب القراءة والاحتفاظ بتقريره في حسابي.
                </span>
              </label>

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles size={18} />
                  <span>حفظ وبدء رحلة الفحص الآن</span>
                  <ArrowLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="py-3.5 px-6 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm transition-colors"
                >
                  العودة للرئيسية
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
