import React, { useState } from 'react';
import { RefreshCw, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../api/client';

interface ReplaceVersionModalProps {
  materialId: string;
  materialTitle: string;
  currentVersion: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReplaceVersionModal: React.FC<ReplaceVersionModalProps> = ({
  materialId,
  materialTitle,
  currentVersion,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose a replacement file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('changeNote', changeNote);

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post(`/materials/${materialId}/replace`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to replace version');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-semibold text-white text-sm">Replace Material File</h3>
              <p className="text-[11px] text-slate-400">Creates version {currentVersion + 1} preserving history</p>
            </div>
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
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Target Material
            </label>
            <p className="text-xs font-medium text-indigo-300 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 truncate">
              {materialTitle}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              New File (PDF, PPT, DOCX, Image)
            </label>
            <input
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-indigo-600/20 file:text-indigo-400 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Revision Notes / Changelog
            </label>
            <input
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="e.g. Corrected slide 12 algorithm step"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500"
            />
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
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Uploading version...' : 'Save New Version'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
