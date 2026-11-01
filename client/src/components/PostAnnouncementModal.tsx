import React, { useEffect, useState } from 'react';
import { Megaphone, X, Send, AlertCircle, Pin } from 'lucide-react';
import api from '../api/client';

interface PostAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PostAnnouncementModal: React.FC<PostAnnouncementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<'INSTITUTION' | 'DEPARTMENT' | 'YEAR' | 'SECTION'>('INSTITUTION');
  const [targetId, setTargetId] = useState('');
  const [targets, setTargets] = useState<{ departments: Array<{ id: string; name: string }>; academicYears: Array<{ id: string; name: string }>; sections: Array<{ id: string; name: string }> }>({ departments: [], academicYears: [], sections: [] });
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    api.get('/community/announcement-targets').then((response) => setTargets(response.data)).catch(() => setError('Could not load announcement audiences.'));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('Please provide title and content.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post('/community/posts', {
        scope,
        ...(scope === 'DEPARTMENT' ? { departmentId: targetId } : {}),
        ...(scope === 'YEAR' ? { academicYearId: targetId } : {}),
        ...(scope === 'SECTION' ? { sectionId: targetId } : {}),
        section: 'UNIVERSITY_FEED',
        title,
        content,
        isVerifiedAnnouncement: true,
        isPinned,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to post announcement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Broadcast Announcement</h2>
              <p className="text-xs text-slate-400">
                Post an institutional circular or class notice. All matching users will be notified.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-950/50 border border-red-800/80 rounded-xl flex items-center space-x-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Announcement Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Schedule Revision for Distributed Systems Lab Exam"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Target Audience
            </label>
            <select
              value={scope}
              onChange={(e) => { setScope(e.target.value as typeof scope); setTargetId(''); }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="INSTITUTION">Institution-wide</option>
              <option value="DEPARTMENT">Department</option>
              <option value="YEAR">Academic year</option>
              <option value="SECTION">Section</option>
            </select>
          </div>

          {scope !== 'INSTITUTION' && <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target</label>
            <select required value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
              <option value="">Choose a target</option>
              {(scope === 'DEPARTMENT' ? targets.departments : scope === 'YEAR' ? targets.academicYears : targets.sections).map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
            </select>
          </div>}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Detailed Notice / Content
            </label>
            <textarea
              required
              rows={4}
              placeholder="Enter full circular details, room updates, guidelines..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isPinned"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="isPinned" className="text-xs text-slate-300 flex items-center space-x-1 cursor-pointer">
              <Pin className="w-3.5 h-3.5 text-amber-400" />
              <span>Pin this announcement to top of dashboard</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Posting...' : 'Broadcast Announcement'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
