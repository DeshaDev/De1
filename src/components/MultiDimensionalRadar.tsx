import React from 'react';
import { Info } from 'lucide-react';

export interface CognitiveRadarScores {
  orfFluency: number; // 0 - 100
  ranSpeed: number; // 0 - 100
  pseudoDecoding: number; // 0 - 100
  phonemicAwareness: number; // 0 - 100
  numeracy: number; // 0 - 100
}

interface Props {
  scores: CognitiveRadarScores;
  studentName: string;
}

const AXES = [
  { key: 'orfFluency', labelAr: 'الطلاقة الشفوية (ORF)', angle: -90, descriptionAr: 'نسبة الكلمات الصحيحة بالدقيقة مقارنة بالهدف الصفي' },
  { key: 'ranSpeed', labelAr: 'سرعة التسمية (RAN)', angle: -18, descriptionAr: 'معدل سرعة تسمية 20 عنصراً قياساً لمعيار 20 ثانية' },
  { key: 'pseudoDecoding', labelAr: 'فك الترميز (12 كلمة)', angle: 54, descriptionAr: 'نسبة الدقة في قراءة الكلمات غير المعجمية الموزونة' },
  { key: 'phonemicAwareness', labelAr: 'الوعي الصوتي (Phonemic)', angle: 126, descriptionAr: 'نسبة إتقان مهام العزل والحذف والدمج الفصحى' },
  { key: 'numeracy', labelAr: 'الحس العددي (Math)', angle: 198, descriptionAr: 'دقة تقدير مواضع الأرقام على خط الأعداد' },
] as const;

export const MultiDimensionalRadar: React.FC<Props> = ({ scores, studentName }) => {
  const size = 320;
  const center = size / 2;
  const radius = 115;

  // Convert polar coordinates to Cartesian
  const getCoordinates = (value: number, angleDeg: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    const r = (value / 100) * radius;
    const x = center + r * Math.cos(angleRad);
    const y = center + r * Math.sin(angleRad);
    return { x, y };
  };

  // Concentric polygon rings (25%, 50%, 75%, 100%)
  const rings = [25, 50, 75, 100];

  const ringPoints = (level: number) => {
    return AXES.map((axis) => {
      const { x, y } = getCoordinates(level, axis.angle);
      return `${x},${y}`;
    }).join(' ');
  };

  // Student's actual data polygon points
  const polygonPoints = AXES.map((axis) => {
    const val = Math.min(100, Math.max(10, scores[axis.key]));
    const { x, y } = getCoordinates(val, axis.angle);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm text-right">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
        <div>
          <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
            <span>ملف مهارات القراءة والتعلم الشامل</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            عرض بصري نسبي لتوزيع أداء الطالب في مهام الجلسة لمساعدة المعلم على استكشاف التباين بين المهارات
          </p>
        </div>
        <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full font-mono">
          {studentName}
        </span>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-6">
        {/* SVG Radar */}
        <div className="relative w-full max-w-[340px] aspect-square flex items-center justify-center select-none">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="radarFillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0d9488" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {/* Concentric Grid Rings */}
            {rings.map((level) => (
              <polygon
                key={level}
                points={ringPoints(level)}
                fill={level === 100 ? '#f8fafc' : 'none'}
                stroke="#cbd5e1"
                strokeWidth={level === 100 ? '1.5' : '1'}
                strokeDasharray={level < 100 ? '3 3' : 'none'}
              />
            ))}

            {/* Radial Axes Lines */}
            {AXES.map((axis, idx) => {
              const { x, y } = getCoordinates(100, axis.angle);
              return (
                <line
                  key={idx}
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="#cbd5e1"
                  strokeWidth="1.2"
                />
              );
            })}

            {/* Data Polygon */}
            <polygon
              points={polygonPoints}
              fill="url(#radarFillGrad)"
              stroke="#0d9488"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />

            {/* Data Point Dots & Labels */}
            {AXES.map((axis, idx) => {
              const val = Math.min(100, Math.max(10, scores[axis.key]));
              const pt = getCoordinates(val, axis.angle);
              const labelPt = getCoordinates(126, axis.angle);

              return (
                <g key={idx}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="5"
                    fill="#0f766e"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all"
                  />
                  <text
                    x={labelPt.x}
                    y={labelPt.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[10px] font-bold fill-slate-700 select-none"
                    style={{ fontSize: '10px', fontFamily: 'system-ui, sans-serif' }}
                  >
                    {axis.labelAr}
                  </text>
                  <text
                    x={pt.x}
                    y={pt.y - 9}
                    textAnchor="middle"
                    className="text-[9px] font-black fill-teal-900 font-mono"
                  >
                    {Math.round(val)}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend & Pillar Scores Table */}
        <div className="w-full md:w-72 space-y-2.5 text-xs text-right">
          <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200">
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold text-teal-950">1. الطلاقة الشفوية (ORF):</span>
              <span className="font-mono font-black text-teal-800 text-sm">{Math.round(scores.orfFluency)}%</span>
            </div>
            <p className="text-[10px] text-teal-800/80">نسبة دقة الكلمات المقروءة ومعدلها في نص الجلسة</p>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold text-amber-950">2. سرعة التسمية (RAN):</span>
              <span className="font-mono font-black text-amber-800 text-sm">{Math.round(scores.ranSpeed)}%</span>
            </div>
            <p className="text-[10px] text-amber-800/80">سرعة تسمية 20 عنصراً قياساً للمعيار المستهدف (20 ث)</p>
          </div>

          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold text-sky-950">3. فك الكلمات غير المعجمية:</span>
              <span className="font-mono font-black text-sky-800 text-sm">{Math.round(scores.pseudoDecoding)}%</span>
            </div>
            <p className="text-[10px] text-sky-800/80">نسبة دقة فك الكلمات المصطنعة الموزونة (12 كلمة)</p>
          </div>

          <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200">
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold text-indigo-950">4. الوعي الصوتي والفونولوجي:</span>
              <span className="font-mono font-black text-indigo-800 text-sm">{Math.round(scores.phonemicAwareness)}%</span>
            </div>
            <p className="text-[10px] text-indigo-800/80">نسبة إتقان 6 مهام صوتية (عزل، حذف، دمج، وسجع)</p>
          </div>

          <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold text-purple-950">5. الحس العددي:</span>
              <span className="font-mono font-black text-purple-800 text-sm">{Math.round(scores.numeracy)}%</span>
            </div>
            <p className="text-[10px] text-purple-800/80">دقة التقدير في خط الأعداد ومهام الحساب المرصودة</p>
          </div>
        </div>
      </div>

      {/* Methodological Transparency Footnote */}
      <div className="mt-5 pt-3 border-t border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-500 leading-relaxed">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <span>
          <strong>ملاحظة تربوية:</strong> توضح الدرجات المعروضة (0–100%) نسب إنجاز المهام المسجلة في الجلسة لمساعدة المعلم على استكشاف مجالات القوة وجوانب الدعم المستقبلي.
        </span>
      </div>
    </div>
  );
};

export default MultiDimensionalRadar;
