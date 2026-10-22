/**
 * Quick Integration Helper
 * نماذج جاهزة لربط المكونات بسرعة
 */

import React from 'react';
import { useAssessment } from '../contexts/AssessmentContext';
import ArabicSpeechAnalysis from '../components/ArabicSpeechAnalysis';
import TactileAnalytics from '../components/TactileAnalytics';
import AdaptiveReports from '../components/AdaptiveReports';

/**
 * 1️⃣ مثال: تدفق كامل للتقييم
 */
export const FullAssessmentFlow: React.FC = () => {
  const [stage, setStage] = React.useState<'start' | 'speech' | 'tactile' | 'report'>('start');
  const { startNewAssessment, currentAssessment } = useAssessment();

  const handleStart = () => {
    startNewAssessment('أحمد محمد', 8);
    setStage('speech');
  };

  const handleSpeechComplete = () => {
    console.log('✅ Speech analysis completed');
    setStage('tactile');
  };

  const handleTactileComplete = () => {
    console.log('✅ Tactile analytics completed');
    setStage('report');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-8">
      {stage === 'start' && (
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">مرحباً بك في نظام التقييم الشامل</h1>
          <p className="text-lg text-gray-600 mb-8">
            سنقوم بإجراء اختبارين: النطق والحساب
          </p>
          <button
            onClick={handleStart}
            className="px-8 py-4 bg-blue-600 text-white rounded-xl text-xl font-bold hover:bg-blue-700 transition-all"
          >
            ابدأ الآن 🚀
          </button>
        </div>
      )}

      {stage === 'speech' && (
        <ArabicSpeechAnalysis onComplete={handleSpeechComplete} />
      )}

      {stage === 'tactile' && (
        <TactileAnalytics onComplete={handleTactileComplete} />
      )}

      {stage === 'report' && (
        <div>
          <button
            onClick={() => setStage('start')}
            className="mb-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            ← العودة للبداية
          </button>
          <AdaptiveReports />
        </div>
      )}
    </div>
  );
};

/**
 * 2️⃣ مثال: عرض حالة التقييم
 */
export const AssessmentStatus: React.FC = () => {
  const { currentAssessment } = useAssessment();

  if (!currentAssessment) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">⚠️ لا توجد جلسة تقييم نشطة</p>
      </div>
    );
  }

  const hasSpeechResults = !!currentAssessment.speechResults;
  const hasTactileResults = !!currentAssessment.tactileResults;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">حالة التقييم</h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold">اسم الطالب:</span>
          <span>{currentAssessment.studentName}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold">العمر:</span>
          <span>{currentAssessment.age} سنوات</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold">اختبار النطق:</span>
          <span className={hasSpeechResults ? 'text-green-600' : 'text-gray-400'}>
            {hasSpeechResults ? '✅ مكتمل' : '⏳ لم يبدأ'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold">اختبار الحساب:</span>
          <span className={hasTactileResults ? 'text-green-600' : 'text-gray-400'}>
            {hasTactileResults ? '✅ مكتمل' : '⏳ لم يبدأ'}
          </span>
        </div>
      </div>

      {hasSpeechResults && currentAssessment.speechResults && (
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-bold mb-2">ملخص النطق:</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• متوسط الثقة: {currentAssessment.speechResults.summary.averageConfidence}%</li>
            <li>• عدد الوقفات: {currentAssessment.speechResults.summary.totalPauses}</li>
            <li>• أخطاء التشكيل: {currentAssessment.speechResults.summary.diacriticErrors}</li>
          </ul>
        </div>
      )}

      {hasTactileResults && currentAssessment.tactileResults && (
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-bold mb-2">ملخص الحساب:</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• متوسط وقت الرد: {currentAssessment.tactileResults.summary.averageReactionTime}s</li>
            <li>• الإجابات الصحيحة: {currentAssessment.tactileResults.summary.correctAnswers}/{currentAssessment.tactileResults.summary.totalTasks}</li>
            <li>• عدد التردد: {currentAssessment.tactileResults.summary.hesitationCount}</li>
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * 3️⃣ مثال: زر بدء جلسة جديدة
 */
export const StartNewAssessmentButton: React.FC<{
  studentName: string;
  age: number;
  onStart?: () => void;
}> = ({ studentName, age, onStart }) => {
  const { startNewAssessment } = useAssessment();

  const handleClick = () => {
    startNewAssessment(studentName, age);
    console.log(`✅ بدأت جلسة جديدة للطالب: ${studentName}`);
    onStart?.();
  };

  return (
    <button
      onClick={handleClick}
      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-bold hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg"
    >
      بدء تقييم جديد 🎯
    </button>
  );
};

/**
 * 4️⃣ مثال: عرض مؤشر التقدم
 */
export const ProgressIndicator: React.FC = () => {
  const { currentAssessment } = useAssessment();

  if (!currentAssessment) return null;

  const hasSpeech = !!currentAssessment.speechResults;
  const hasTactile = !!currentAssessment.tactileResults;
  const progress = hasSpeech && hasTactile ? 100 : hasSpeech ? 50 : 0;

  return (
    <div className="bg-white rounded-lg p-4 shadow-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">تقدم التقييم</span>
        <span className="text-sm text-gray-600">{progress}%</span>
      </div>

      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between mt-3 text-xs">
        <span className={hasSpeech ? 'text-green-600 font-semibold' : 'text-gray-400'}>
          {hasSpeech ? '✅' : '⏳'} النطق
        </span>
        <span className={hasTactile ? 'text-green-600 font-semibold' : 'text-gray-400'}>
          {hasTactile ? '✅' : '⏳'} الحساب
        </span>
      </div>
    </div>
  );
};

/**
 * 5️⃣ مثال: Debug Panel
 */
export const DebugPanel: React.FC = () => {
  const { currentAssessment } = useAssessment();

  return (
    <details className="bg-gray-100 rounded-lg p-4 text-left">
      <summary className="cursor-pointer font-bold text-sm">🔍 Debug Panel</summary>
      <pre className="mt-4 text-xs bg-gray-800 text-green-400 p-4 rounded overflow-auto max-h-96">
        {JSON.stringify(currentAssessment, null, 2)}
      </pre>
    </details>
  );
};

/**
 * 6️⃣ مثال: التصدير لـ JSON
 */
export const ExportDataButton: React.FC = () => {
  const { currentAssessment } = useAssessment();

  const handleExport = () => {
    if (!currentAssessment) {
      alert('لا توجد بيانات للتصدير');
      return;
    }

    const dataStr = JSON.stringify(currentAssessment, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assessment-${currentAssessment.studentName}-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      disabled={!currentAssessment}
      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      تصدير البيانات 💾
    </button>
  );
};

/**
 * 7️⃣ مثال: كل الأدوات معاً
 */
export const QuickDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center mb-8">لوحة التحكم السريعة</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AssessmentStatus />
          <ProgressIndicator />
        </div>

        <div className="flex gap-4">
          <StartNewAssessmentButton studentName="أحمد محمد" age={8} />
          <ExportDataButton />
        </div>

        <DebugPanel />
      </div>
    </div>
  );
};
