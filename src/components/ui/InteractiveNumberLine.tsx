import React, { useRef, useState, useCallback, useEffect } from 'react';
import { IconBaseeraFalcon } from './ChildPlayfulIcons';
import { Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

interface InteractiveNumberLineProps {
  min: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
  targetNumber?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export const toEasternArabicDigits = (num: number | string): string => {
  return String(num).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
};

export const InteractiveNumberLine: React.FC<InteractiveNumberLineProps> = ({
  min,
  max,
  value,
  onChange,
  targetNumber,
  disabled = false,
  className = '',
  label,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Clamp value between min and max
  const clamp = useCallback(
    (val: number) => Math.max(min, Math.min(max, Math.round(val))),
    [min, max]
  );

  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const updateValueFromClientX = useCallback(
    (clientX: number) => {
      if (disabled || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = clickX / rect.width;
      const newValue = clamp(min + ratio * (max - min));
      onChange(newValue);
    },
    [disabled, min, max, clamp, onChange]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    updateValueFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || disabled) return;
    updateValueFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (disabled) return;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  // Nudge helpers
  const handleNudge = (delta: number) => {
    if (disabled) return;
    onChange(clamp(value + delta));
  };

  // Generate 5 milestone labels (0%, 25%, 50%, 75%, 100%)
  const stepQuart = (max - min) / 4;
  const milestones = [
    min,
    Math.round(min + stepQuart),
    Math.round(min + stepQuart * 2),
    Math.round(min + stepQuart * 3),
    max,
  ];

  return (
    <div className={`space-y-4 select-none ${className}`} dir="ltr">
      {/* Target & Current Callout Banner */}
      <div className="flex items-center justify-between font-child px-2" dir="rtl">
        <div className="flex items-center gap-2">
          {targetNumber !== undefined && (
            <div className="bg-amber-100 text-amber-950 border-2 border-amber-300 px-3.5 py-1.5 rounded-2xl font-black text-sm shadow-xs flex items-center gap-1.5">
              <span className="text-amber-800">الهدف:</span>
              <span className="text-xl text-amber-900 font-mono font-black">
                {toEasternArabicDigits(targetNumber)}
              </span>
            </div>
          )}
          {label && <span className="text-xs font-bold text-slate-500">{label}</span>}
        </div>

        <div className="bg-emerald-500 text-white border-2 border-emerald-600 px-4 py-1.5 rounded-2xl font-black text-sm shadow-sm flex items-center gap-1.5">
          <span>موقع قفزتك:</span>
          <span className="text-xl font-mono font-black">
            {toEasternArabicDigits(value)}
          </span>
        </div>
      </div>

      {/* Main Interactive Trail Track Container */}
      <div className="relative pt-12 pb-7 px-4">
        {/* Floating Mascot speech bubble anchored to the current value */}
        <div
          className="absolute top-0 transition-all duration-75 ease-out pointer-events-none -translate-x-1/2"
          style={{ left: `${percentage}%` }}
        >
          <div className="bg-white border-2 border-emerald-500 text-emerald-950 font-black px-3 py-1 rounded-2xl shadow-md text-xs whitespace-nowrap flex items-center gap-1">
            <span>قفزة:</span>
            <span className="font-mono text-sm text-emerald-700">
              {toEasternArabicDigits(value)}
            </span>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r-2 border-b-2 border-emerald-500 rotate-45" />
          </div>
        </div>

        {/* The Track Line Bar */}
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`relative h-6 rounded-full cursor-pointer transition-all shadow-inner border-2 border-slate-300/80 ${
            disabled ? 'opacity-60 cursor-not-allowed bg-slate-200' : 'bg-gradient-to-r from-amber-200 via-sky-200 to-emerald-200 hover:brightness-105'
          }`}
        >
          {/* Active trail fill */}
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-500 opacity-70"
            style={{ width: `${percentage}%` }}
          />

          {/* Ticks on the trail (10 pips) */}
          <div className="absolute inset-0 flex justify-between items-center px-2 pointer-events-none">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div
                key={idx}
                className="w-1 h-3 rounded-full bg-slate-400/40"
              />
            ))}
          </div>

          {/* Falcon Mascot Puck / Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-75 ease-out"
            style={{ left: `${percentage}%` }}
          >
            <div
              className={`w-14 h-14 rounded-full bg-white border-3 border-emerald-500 shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95 transition-transform ${
                isDragging ? 'ring-4 ring-emerald-300 scale-110' : ''
              }`}
            >
              <IconBaseeraFalcon size={38} />
            </div>
          </div>
        </div>

        {/* Milestone Labels Under Track */}
        <div className="flex justify-between items-center text-xs font-mono font-black text-slate-600 pt-5 px-1">
          {milestones.map((m, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <span className="w-1.5 h-2 bg-slate-300 rounded-full mb-1" />
              <span className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                {toEasternArabicDigits(m)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tactile Micro-Jump Stepper Controls (Nudge Buttons) */}
      {!disabled && (
        <div className="flex items-center justify-center gap-2 pt-1" dir="rtl">
          <button
            type="button"
            onClick={() => handleNudge(-10)}
            className="duo-btn-white px-3.5 py-1.5 text-xs font-black flex items-center gap-1 cursor-pointer"
            title="اقفز للخلف ١٠ خطوات"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            <span>-١٠</span>
          </button>
          <button
            type="button"
            onClick={() => handleNudge(-1)}
            className="duo-btn-white px-3 py-1.5 text-xs font-black flex items-center gap-0.5 cursor-pointer"
            title="خطوة واحدة للخلف"
          >
            <Minus className="w-3 h-3" />
            <span>-١</span>
          </button>

          <span className="text-[11px] font-child font-bold text-slate-400 px-2">
            حرّك باللمس أو بالأزرار
          </span>

          <button
            type="button"
            onClick={() => handleNudge(1)}
            className="duo-btn-white px-3 py-1.5 text-xs font-black flex items-center gap-0.5 cursor-pointer"
            title="خطوة واحدة للأمام"
          >
            <Plus className="w-3 h-3" />
            <span>+١</span>
          </button>
          <button
            type="button"
            onClick={() => handleNudge(10)}
            className="duo-btn-white px-3.5 py-1.5 text-xs font-black flex items-center gap-1 cursor-pointer"
            title="اقفز للأمام ١٠ خطوات"
          >
            <span>+١٠</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
