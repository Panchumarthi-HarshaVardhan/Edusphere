import React, { useEffect, useState } from 'react';
import { HelpCircle, X, Send, AlertCircle } from 'lucide-react';
import api from '../api/client';

interface AskDoubtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AskDoubtModal: React.FC<AskDoubtModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingSubjects(true);
    setError(null);
    api.get('/materials/subjects')
      .then((response) => {
        const available = response.data.subjects || [];
        setSubjects(available);
        setSubjectId(available[0]?.id || '');
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load your enrolled subjects.'))
      .finally(() => setLoadingSubjects(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId || !title.trim() || !content.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post('/dashboard/doubts', {
        subjectId,
        title,
        content,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit doubt.');
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
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Ask an Academic Doubt</h2>
              <p className="text-xs text-slate-400">
                Post your question directly to the assigned faculty instructor.
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
              Select Subject
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={loadingSubjects || subjects.length === 0}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {!subjects.length && <option value="">{loadingSubjects ? 'Loading subjects…' : 'No enrolled subjects available'}</option>}
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} - {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Doubt Title / Topic
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Clarification on Raft Leader Election Term Monotonicity"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Detailed Question / Code snippet
            </label>
            <textarea
              required
              rows={4}
              placeholder="Describe what you tried, the lecture or slide reference, and where you are stuck..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
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
              disabled={loading || loadingSubjects || !subjects.length}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Submitting...' : 'Post Doubt'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
