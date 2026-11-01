import React, { useEffect, useState } from 'react';
import { Presentation, X, Plus, Lock, Unlock, AlertCircle } from 'lucide-react';
import api from '../api/client';
import { FacultyAssignmentSelectors, type FacultyAssignment } from './FacultyAssignmentSelectors';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: any) => void;
  assignments: FacultyAssignment[];
}

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  assignments,
}) => {
  const [subjectId, setSubjectId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [title, setTitle] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [allowDownload, setAllowDownload] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const selected = assignments.find((assignment) => assignment.subjectId === subjectId && assignment.sectionId === sectionId);
    if (!selected) {
      setSubjectId(assignments[0]?.subjectId || '');
      setSectionId(assignments[0]?.sectionId || '');
    }
  }, [assignments, isOpen, subjectId, sectionId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.post('/canvas/sessions', {
        subjectId,
        sectionId,
        title,
        sessionDate: new Date(sessionDate).toISOString(),
        allowDownload,
      });
      onSuccess(res.data.session);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create classroom session');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Presentation className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white text-sm">New Digital Classroom Session</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <FacultyAssignmentSelectors
            assignments={assignments}
            subjectId={subjectId}
            sectionId={sectionId}
            onSubjectChange={(id) => { setSubjectId(id); setSectionId(assignments.find((assignment) => assignment.subjectId === id)?.sectionId || ''); }}
            onSectionChange={setSectionId}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Lesson / Session Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Consensus & Raft Protocol"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Session Date
            </label>
            <input
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2">
              {allowDownload ? (
                <Unlock className="w-4 h-4 text-emerald-400" />
              ) : (
                <Lock className="w-4 h-4 text-amber-400" />
              )}
              <div>
                <p className="text-xs font-semibold text-slate-200">Allow PDF Export for Students</p>
                <p className="text-[10px] text-slate-500">Students can download completed board as PDF</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAllowDownload(!allowDownload)}
              className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition ${
                allowDownload ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
                  allowDownload ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

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
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Launching...' : 'Start Canvas Workspace'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
