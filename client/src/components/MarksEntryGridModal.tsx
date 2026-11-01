import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Save,
  Send,
  BarChart2,
  AlertTriangle,
  History,
  X,
} from 'lucide-react';
import api from '../api/client';
import type { Assessment, ClassStats } from '../types/marks';

interface MarksEntryGridModalProps {
  assessment: Assessment;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MarksEntryGridModal: React.FC<MarksEntryGridModalProps> = ({
  assessment,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [marks, setMarks] = useState<
    Array<{
      studentId: string;
      score: number | null;
      isAbsent: boolean;
      remarks: string;
      name: string;
      email: string;
    }>
  >(
    (assessment.marks || []).map((m) => ({
      studentId: m.studentId,
      score: m.score,
      isAbsent: m.isAbsent,
      remarks: m.remarks || '',
      name: m.student ? `${m.student.firstName} ${m.student.lastName}` : 'Student',
      email: m.student?.email || '',
    }))
  );

  const [reason, setReason] = useState('');
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPublished = assessment.state === 'PUBLISHED';

  const handleScoreChange = (studentId: string, val: string) => {
    setMarks((prev) =>
      prev.map((m) => {
        if (m.studentId === studentId) {
          const num = val === '' ? null : parseFloat(val);
          return {
            ...m,
            score: num !== null && !isNaN(num) ? Math.min(assessment.maxMarks, Math.max(0, num)) : null,
            isAbsent: false,
          };
        }
        return m;
      })
    );
  };

  const handleAbsentToggle = (studentId: string) => {
    setMarks((prev) =>
      prev.map((m) => {
        if (m.studentId === studentId) {
          return {
            ...m,
            isAbsent: !m.isAbsent,
            score: !m.isAbsent ? null : m.score,
          };
        }
        return m;
      })
    );
  };

  const handleFetchStats = async () => {
    try {
      const res = await api.get(`/marks/assessments/${assessment.id}/stats`);
      setStats(res.data.stats);
    } catch (err) {
      console.error('Failed to load stats:');
    }
  };

  const handleSaveMarks = async () => {
    setError(null);
    if (isPublished && !reason.trim()) {
      setError('Non-negotiable Rule 4: Edits to published marks require an authorized reason.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.put(`/marks/assessments/${assessment.id}/marks`, {
        entries: marks.map((m) => ({
          studentId: m.studentId,
          score: m.score,
          isAbsent: m.isAbsent,
          remarks: m.remarks,
        })),
        reason: isPublished ? reason : undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update marks.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePublish = async () => {
    const nextState = isPublished ? 'DRAFT' : 'PUBLISHED';
    try {
      await api.patch(`/marks/assessments/${assessment.id}/publish`, {
        state: nextState,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update publication state.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-6 shadow-2xl relative my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-semibold text-white text-sm">
                Marks Gradebook: {assessment.name} ({assessment.subject?.code})
              </h3>
              <p className="text-[11px] text-slate-400">
                Max Marks: <strong className="font-mono text-white">{assessment.maxMarks}</strong> • State:{' '}
                <span
                  className={`font-semibold font-mono ${
                    isPublished ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {assessment.state}
                </span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isPublished && (
          <div className="mt-4 p-3.5 bg-amber-950/40 border border-amber-800/80 rounded-xl flex items-start space-x-2.5 text-amber-200 text-xs">
            <History className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Rule 4 Active:</span> These marks are currently published. Modifying student scores requires an audit reason which writes to <code className="text-amber-300 font-mono">audit_logs</code>.
            </div>
          </div>
        )}

        {/* Toolbar & Class Stats Button */}
        <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleFetchStats}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition cursor-pointer"
          >
            <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Compute Class Stats</span>
          </button>

          <button
            type="button"
            onClick={handleTogglePublish}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              isPublished
                ? 'bg-amber-950/60 text-amber-400 border border-amber-800'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isPublished ? 'Revert to Draft' : 'Publish Marks to Students'}</span>
          </button>
        </div>

        {/* Real-time stats display if toggled */}
        {stats && (
          <div className="mt-3 grid grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center text-xs">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Average</p>
              <p className="text-sm font-bold text-white font-mono mt-0.5">{stats.average} / {assessment.maxMarks}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Highest</p>
              <p className="text-sm font-bold text-emerald-400 font-mono mt-0.5">{stats.highest}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Lowest</p>
              <p className="text-sm font-bold text-red-400 font-mono mt-0.5">{stats.lowest}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Pass %</p>
              <p className="text-sm font-bold text-indigo-400 font-mono mt-0.5">{stats.passPercentage}%</p>
            </div>
          </div>
        )}

        {/* Marks Entry Grid */}
        <div className="mt-4 max-h-72 overflow-y-auto border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Score (Max: {assessment.maxMarks})</th>
                <th className="py-2.5 px-3">Absent?</th>
                <th className="py-2.5 px-3">Auto Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {marks.map((m) => {
                const pct = m.score !== null ? (m.score / assessment.maxMarks) * 100 : null;
                const autoGrade = m.isAbsent ? 'AB' : pct !== null ? (pct >= 90 ? 'O' : pct >= 80 ? 'A+' : pct >= 70 ? 'A' : pct >= 40 ? 'B' : 'F') : '-';

                return (
                  <tr key={m.studentId} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 text-slate-200 font-medium">{m.name}</td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        disabled={m.isAbsent}
                        min="0"
                        max={assessment.maxMarks}
                        step="0.5"
                        value={m.score ?? ''}
                        onChange={(e) => handleScoreChange(m.studentId, e.target.value)}
                        placeholder="0.0"
                        className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-white font-mono focus:ring-1 focus:ring-indigo-500 disabled:opacity-40"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => handleAbsentToggle(m.studentId)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                          m.isAbsent
                            ? 'bg-red-950 text-red-400 border border-red-800 font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {m.isAbsent ? 'Absent' : 'Present'}
                      </button>
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-400">{autoGrade}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Audit Reason Input for Published Edits (Rule 4) */}
        {isPublished && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Authorized Edit Reason <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Re-evaluation approved by academic board; updated question 3 score"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveMarks}
            disabled={isSubmitting}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Saving Marks...' : 'Save Gradebook'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
