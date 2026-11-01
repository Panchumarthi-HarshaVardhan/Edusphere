import React, { useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  AlertTriangle,
  History,
  X,
} from 'lucide-react';
import type { AttendanceSession, AttendanceStatus } from '../types/attendance';
import api from '../api/client';

interface AttendanceMarkingModalProps {
  session: AttendanceSession;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AttendanceMarkingModal: React.FC<AttendanceMarkingModalProps> = ({
  session,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [marks, setMarks] = useState<
    Array<{ studentId: string; status: AttendanceStatus; remarks: string; name: string }>
  >(
    (session.records || []).map((r) => ({
      studentId: r.studentId,
      status: r.status,
      remarks: r.remarks || '',
      name: r.student ? `${r.student.firstName} ${r.student.lastName}` : 'Enrolled Student',
    }))
  );

  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEditingPast = session.isCompleted;

  // Convenience helper: Mark all present
  const handleMarkAllPresent = () => {
    setMarks((prev) => prev.map((m) => ({ ...m, status: 'PRESENT' })));
  };

  const handleToggleStatus = (studentId: string, newStatus: AttendanceStatus) => {
    setMarks((prev) =>
      prev.map((m) => (m.studentId === studentId ? { ...m, status: newStatus } : m))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isEditingPast && !reason.trim()) {
      setError('An edit reason is required for audit compliance when changing past attendance.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.put(`/attendance/sessions/${session.id}`, {
        marks: marks.map((m) => ({
          studentId: m.studentId,
          status: m.status,
          remarks: m.remarks,
        })),
        reason: isEditingPast ? reason : undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit attendance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const presentCount = marks.filter((m) => m.status === 'PRESENT').length;
  const absentCount = marks.filter((m) => m.status === 'ABSENT').length;
  const lateCount = marks.filter((m) => m.status === 'LATE').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <CalendarCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-semibold text-white text-sm">
                Record Attendance: {session.subject?.code} ({session.section?.name})
              </h3>
              <p className="text-[11px] text-slate-400">
                Date: {new Date(session.sessionDate).toLocaleDateString()} • Period {session.periodNumber}
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

        {isEditingPast && (
          <div className="mt-4 p-3.5 bg-amber-950/40 border border-amber-800/80 rounded-xl flex items-start space-x-2.5 text-amber-200 text-xs">
            <History className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Audit Log Notice:</span> Modifying completed attendance writes an immutable record to <code className="text-amber-300 font-mono">audit_logs</code> capturing past vs new status.
            </div>
          </div>
        )}

        {/* Quick Marking Actions & Counter Bar */}
        <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-4 text-xs font-mono">
            <span className="text-emerald-400">Present: {presentCount}</span>
            <span className="text-red-400">Absent: {absentCount}</span>
            <span className="text-amber-400">Late: {lateCount}</span>
          </div>

          <button
            type="button"
            onClick={handleMarkAllPresent}
            className="px-3 py-1 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            Mark All Present
          </button>
        </div>

        {/* Roster Attendance Table */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {marks.map((m) => (
              <div
                key={m.studentId}
                className="flex items-center justify-between p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl"
              >
                <span className="text-xs font-medium text-slate-200 truncate">{m.name}</span>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(m.studentId, 'PRESENT')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      m.status === 'PRESENT'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-500 hover:text-emerald-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Present</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(m.studentId, 'ABSENT')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      m.status === 'ABSENT'
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-900 text-slate-500 hover:text-red-400'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Absent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(m.studentId, 'LATE')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      m.status === 'LATE'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-900 text-slate-500 hover:text-amber-400'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Late</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Audit Reason Input (Mandatory on past edits) */}
          {isEditingPast && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Audit Reason for Edit <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Student provided medical leave certificate approved by HOD"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Commit Attendance'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
