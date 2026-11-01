import React, { useState } from 'react';
import { MessageSquare, X, Send, AlertCircle } from 'lucide-react';
import api from '../api/client';
import type { DoubtItem } from '../types/dashboard';

interface ReplyDoubtModalProps {
  doubt: DoubtItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReplyDoubtModal: React.FC<ReplyDoubtModalProps> = ({
  doubt,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !doubt) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) {
      setError('Please provide a reply before submitting.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post(`/dashboard/doubts/${doubt.id}/reply`, { reply });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit reply.');
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
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Answer Student Doubt</h2>
              <p className="text-xs text-slate-400">
                Student: {doubt.student ? `${doubt.student.firstName} ${doubt.student.lastName}` : 'Enrolled Student'}
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

        <div className="mt-4 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
          <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-wider">
            {doubt.subject?.code} Question
          </span>
          <h3 className="text-xs font-bold text-white">{doubt.title}</h3>
          <p className="text-xs text-slate-300 whitespace-pre-wrap">{doubt.content}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Your Instructor Response
            </label>
            <textarea
              required
              rows={4}
              placeholder="Provide a step-by-step resolution or explanation..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
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
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Submitting...' : 'Post Reply & Resolve'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
