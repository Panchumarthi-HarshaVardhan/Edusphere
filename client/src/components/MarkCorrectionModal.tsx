import React, { useState } from 'react';
import { HelpCircle, X, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../api/client';

interface MarkCorrectionModalProps {
  markId: string;
  assessmentName: string;
  currentScore: number | null;
  maxMarks: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MarkCorrectionModal: React.FC<MarkCorrectionModalProps> = ({
  markId,
  assessmentName,
  currentScore,
  maxMarks,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [claimedScore, setClaimedScore] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const scoreNum = parseFloat(claimedScore);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxMarks) {
      setError(`Claimed score must be between 0 and maximum marks (${maxMarks})`);
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a detailed justification for this re-evaluation request.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/marks/corrections', {
        studentMarkId: markId,
        claimedScore: scoreNum,
        reason,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit mark correction request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white text-sm">Marks Correction / Re-evaluation</h3>
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
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
            <p className="text-white font-semibold truncate">{assessmentName}</p>
            <p className="text-slate-400">
              Current recorded score:{' '}
              <span className="font-mono text-indigo-400 font-bold">
                {currentScore ?? 'AB'} / {maxMarks}
              </span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Claimed Score (Max: {maxMarks})
            </label>
            <input
              type="number"
              required
              step="0.5"
              min="0"
              max={maxMarks}
              value={claimedScore}
              onChange={(e) => setClaimedScore(e.target.value)}
              placeholder="e.g. 42.5"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Reason / Discrepancy Description
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Question 4 was evaluated out of 10 instead of 15 / Totaling error on page 3"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500 resize-none"
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
              <span>{isSubmitting ? 'Submitting...' : 'Submit Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
