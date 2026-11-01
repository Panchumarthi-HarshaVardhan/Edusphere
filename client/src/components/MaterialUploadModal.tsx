import React, { useEffect, useState } from 'react';
import {
  Upload,
  X,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import api from '../api/client';
import type { MaterialType } from '../types/material';
import { FacultyAssignmentSelectors, type FacultyAssignment } from './FacultyAssignmentSelectors';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assignments: FacultyAssignment[];
}

export const MaterialUploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  assignments,
}) => {
  const [subjectId, setSubjectId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState<Array<{ id: string; unitNumber: number; title: string }>>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<MaterialType>('PDF');
  const [externalUrl, setExternalUrl] = useState('');
  const [visibleFrom, setVisibleFrom] = useState(new Date().toISOString().slice(0, 16));
  const [allowDownload, setAllowDownload] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const selected = assignments.find((assignment) => assignment.subjectId === subjectId && assignment.sectionId === sectionId);
    if (!selected) {
      setSubjectId(assignments[0]?.subjectId || '');
      setSectionId(assignments[0]?.sectionId || '');
    }
  }, [assignments, isOpen, subjectId, sectionId]);

  // Fetch units when subject changes
  React.useEffect(() => {
    if (subjectId) {
      api
        .get(`/materials/subjects/${subjectId}/units`)
        .then((res) => {
          setUnits(res.data.units || []);
        })
        .catch(() => setUnits([]));
    }
  }, [subjectId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (type !== 'VIDEO_LINK' && !file) {
      setError('Please select a file to upload.');
      return;
    }
    if (!assignments.some((assignment) => assignment.subjectId === subjectId && assignment.sectionId === sectionId)) {
      setError('Choose one of your assigned subject and section pairs.');
      return;
    }

    const formData = new FormData();
    formData.append('subjectId', subjectId);
    formData.append('targetSectionIds', JSON.stringify([sectionId]));
    if (unitId) formData.append('unitId', unitId);
    formData.append('title', title);
    if (description) formData.append('description', description);
    formData.append('type', type);
    if (externalUrl) formData.append('externalUrl', externalUrl);
    formData.append('visibleFrom', new Date(visibleFrom).toISOString());
    formData.append('allowDownload', String(allowDownload));
    if (file) formData.append('file', file);

    setIsSubmitting(true);
    try {
      await api.post('/materials', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload study material.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <Upload className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white">Upload New Study Material</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl flex items-start space-x-2 text-red-200 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4">
            <FacultyAssignmentSelectors
              assignments={assignments}
              subjectId={subjectId}
              sectionId={sectionId}
              onSubjectChange={(id) => { setSubjectId(id); setSectionId(assignments.find((assignment) => assignment.subjectId === id)?.sectionId || ''); }}
              onSectionChange={setSectionId}
            />
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Unit / Module
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">General (No specific unit)</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unitNumber}: {u.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Consensus Algorithms Lecture 4"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Description / Instructions
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add overview, reading instructions, or notes for students..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Material Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as MaterialType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="PDF">PDF Document</option>
                <option value="PPT">PowerPoint Presentation (PPT/PPTX)</option>
                <option value="DOCX">Word Document (DOC/DOCX)</option>
                <option value="IMAGE">Diagram / Image</option>
                <option value="QUESTION_PAPER">Previous Year Question Paper</option>
                <option value="LAB_MANUAL">Lab Manual</option>
                <option value="SYLLABUS">Course Syllabus</option>
                <option value="VIDEO_LINK">Video Link (YouTube/Drive)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Publish Date & Time
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  required
                  value={visibleFrom}
                  onChange={(e) => setVisibleFrom(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {type === 'VIDEO_LINK' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Video URL
              </label>
              <input
                type="url"
                required
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://youtu.be/..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Upload File (Max 50MB)
              </label>
              <input
                type="file"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600/20 file:text-indigo-400 hover:file:bg-indigo-600/30 cursor-pointer"
              />
            </div>
          )}

          {/* Download Permission Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2.5">
              {allowDownload ? (
                <Unlock className="w-4 h-4 text-emerald-400" />
              ) : (
                <Lock className="w-4 h-4 text-amber-400" />
              )}
              <div>
                <p className="text-xs font-semibold text-slate-200">Allow Student Downloads</p>
                <p className="text-[11px] text-slate-500">
                  {allowDownload
                    ? 'Students can download the original file'
                    : 'Enforces read-only in-browser view; server denies downloads'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAllowDownload(!allowDownload)}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition ${
                allowDownload ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                  allowDownload ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Uploading to S3...' : 'Publish Material'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
