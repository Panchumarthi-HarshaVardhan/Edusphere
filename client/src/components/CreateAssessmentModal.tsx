import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  X,
  Plus,
  AlertCircle,
} from 'lucide-react';
import api from '../api/client';
import type { AssessmentType } from '../types/marks';
import { FacultyAssignmentSelectors, type FacultyAssignment } from './FacultyAssignmentSelectors';

interface CreateAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assignments: FacultyAssignment[];
}

export const CreateAssessmentModal: React.FC<CreateAssessmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  assignments,
}) => {
  const [subjectId, setSubjectId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AssessmentType>('INTERNAL_1');
  const [maxMarks, setMaxMarks] = useState('50');
  const [weightage, setWeightage] = useState('1.0');
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
      await api.post('/marks/assessments', {
        subjectId,
        sectionId,
        name,
        type,
        maxMarks: parseFloat(maxMarks),
        weightage: parseFloat(weightage),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create assessment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white text-sm">Configure Assessment</h3>
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
              Assessment Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Midterm Internal Test 1"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AssessmentType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="INTERNAL_1">Internal 1</option>
                <option value="INTERNAL_2">Internal 2</option>
                <option value="ASSIGNMENT">Assignment</option>
                <option value="LAB">Lab</option>
                <option value="PRACTICAL">Practical</option>
                <option value="VIVA">Viva</option>
                <option value="EXTERNAL">External</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Max Marks
              </label>
              <input
                type="number"
                required
                min="1"
                max="500"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Weightage
              </label>
              <input
                type="number"
                required
                step="0.1"
                min="0.1"
                value={weightage}
                onChange={(e) => setWeightage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
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
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating...' : 'Create Assessment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
