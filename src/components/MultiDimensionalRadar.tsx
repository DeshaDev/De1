import React from 'react';
import { Info } from 'lucide-react';

export interface LearningMetric {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  detail: string;
  precision?: number;
}

interface Props {
  metrics: LearningMetric[];
  studentName: string;
}

/**
 * Show observed measures in their native units.
 * Different measures are intentionally not converted into a shared score or radar polygon:
 * a reading rate, task accuracy, elapsed time, and number-line error are not interchangeable.
 */
export const MultiDimensionalRadar: React.FC<Props> = ({ metrics, studentName }) => {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm text-right" dir="rtl" aria-labelledby="observed-learning-metrics-title">
      <div className="mb-4 flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="observed-learning-metrics-title" className="text-lg font-black text-slate-900">
            المقاييس المرصودة في المهام
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            نعرض كل نتيجة بوحدتها الفعلية، ولا نحوّل نتائج غير متجانسة إلى نسبة موحّدة أو درجة كلية.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
          {studentName}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {metrics.map((metric) => (
          <article key={metric.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-sm font-black leading-6 text-slate-800">{metric.label}</h4>
              <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm font-black tabular-nums text-slate-900">
                {metric.value === null || !Number.isFinite(metric.value)
                  ? 'غير مقاس'
                  : metric.value.toLocaleString('ar-EG', {
                      maximumFractionDigits: metric.precision ?? 1,
                      minimumFractionDigits: 0,
                    }) + (metric.unit ? ' ' + metric.unit : '')}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{metric.detail}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <p>
          النتيجة تصف أداءً في المهمة المسجلة فقط. كلمة/دقيقة، ونسبة دقة، وزمن بالثواني، ونسبة خطأ ليست مقاييس قابلة للمقارنة مباشرة. لا تُستخدم هذه القيم منفردة لتشخيص عسر القراءة أو عسر الحساب.
        </p>
      </div>
    </section>
  );
};

export default MultiDimensionalRadar;
