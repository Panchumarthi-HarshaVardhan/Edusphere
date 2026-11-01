import React, { useState } from 'react';
import { Calculator } from 'lucide-react';

interface WhatIfCalculatorProps {
  subjectName: string;
  currentAttendanceCredits: number;
  currentConducted: number;
  defaultThreshold: number;
}

export const WhatIfCalculator: React.FC<WhatIfCalculatorProps> = ({
  subjectName,
  currentAttendanceCredits,
  currentConducted,
  defaultThreshold,
}) => {
  const [targetPercentage, setTargetPercentage] = useState(defaultThreshold);

  // Present is 1 credit, late is 0.5, absent is 0. Future classes add one credit.
  const computeNeededClasses = (target: number) => {
    if (target >= 100) return 'Requires 100% attendance (infinite if any missed)';
    const numerator = target * currentConducted - 100 * currentAttendanceCredits;
    const denominator = 100 - target;
    if (numerator <= 0) return 0;
    return Math.ceil(numerator / denominator);
  };

  const computeCanBunk = (target: number) => {
    if (target <= 0) return 999;
    const numerator = 100 * currentAttendanceCredits - target * currentConducted;
    if (numerator <= 0) return 0;
    return Math.floor(numerator / target);
  };

  const needed = computeNeededClasses(targetPercentage);
  const canSkip = computeCanBunk(targetPercentage);
  const currentPercentage =
    currentConducted > 0 ? Math.round((currentAttendanceCredits / currentConducted) * 1000) / 10 : 100;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Calculator className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            What-If Attendance Simulator
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400 truncate max-w-xs">{subjectName}</span>
      </div>

      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400">Current Standing:</span>
        <span className="font-mono text-white font-bold">
          {currentAttendanceCredits} / {currentConducted} attendance credits ({currentPercentage}%)
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-400">Target Percentage:</span>
          <span className="font-mono text-indigo-400 font-bold">{targetPercentage}%</span>
        </div>
        <input
          type="range"
          min="50"
          max="95"
          step="1"
          value={targetPercentage}
          onChange={(e) => setTargetPercentage(Number(e.target.value))}
          className="w-full accent-indigo-500 cursor-pointer"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            Must Attend Next
          </p>
          <p className="text-lg font-bold text-indigo-400 font-mono mt-1">
            {typeof needed === 'number' ? `${needed} class(es)` : needed}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Consecutively without missing</p>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            Safe To Miss
          </p>
          <p className="text-lg font-bold text-emerald-400 font-mono mt-1">
            {canSkip} class(es)
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">While staying ≥ {targetPercentage}%</p>
        </div>
      </div>
    </div>
  );
};
