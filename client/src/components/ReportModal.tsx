import React, { useState } from 'react';
import { AlertCircle, X, ShieldAlert } from 'lucide-react';
import api from '../api/client';
import { type ContentReportTarget } from '../types/community';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ContentReportTarget;
  targetId: string;
  postId?: string;
  onReportSubmitted?: () => void;
}

const REPORT_REASONS = [
  'Spam or advertising',
  'Harassment or hate speech',
  'Inappropriate or offensive content',
  'Academic dishonesty / plagiarism',
  'Misinformation',
  'Other violation',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  postId,
  onReportSubmitted,
}) => {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.post('/community/reports', {
        targetType,
        targetId,
        postId,
        reason,
        details: details.trim() || undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        if (onReportSubmitted) onReportSubmitted();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-rose-400">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="font-semibold text-lg text-slate-100">Report Content</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
              ✓
            </div>
            <p className="text-emerald-300 font-medium">Thank you for reporting.</p>
            <p className="text-xs text-slate-400 mt-1">
              Our campus administration will review this promptly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Reason for report <span className="text-rose-400">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Additional details (optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Describe why this content violates community guidelines..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
