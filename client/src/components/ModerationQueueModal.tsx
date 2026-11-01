import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  CheckCircle,
  Trash2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import api from '../api/client';
import { type ContentReport, type ContentReportStatus } from '../types/community';

interface ModerationQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModerationQueueModal: React.FC<ModerationQueueModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [filterStatus, setFilterStatus] = useState<ContentReportStatus>('PENDING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState<{ [reportId: string]: string }>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/community/moderation/queue?status=${filterStatus}`);
      setReports(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load moderation reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReports();
    }
  }, [isOpen, filterStatus]);

  if (!isOpen) return null;

  const handleResolve = async (
    reportId: string,
    status: ContentReportStatus,
    removeContent: boolean = false
  ) => {
    setProcessingId(reportId);
    try {
      await api.patch(`/community/moderation/reports/${reportId}`, {
        status,
        removeContent,
        actionNotes: actionNotes[reportId] || undefined,
      });
      await fetchReports();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to resolve moderation report.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-3xl w-full p-6 text-slate-100 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Content Moderation Queue</h2>
              <p className="text-xs text-slate-400">
                Review flagged posts, comments, and doubts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center justify-between mt-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl">
            {(['PENDING', 'ACTION_TAKEN', 'DISMISSED'] as ContentReportStatus[]).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === st
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            {reports.length} report{reports.length === 1 ? '' : 's'}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Loading moderation reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No reports in this category. Community feed is clean!
            </div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        {report.targetType}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        Reason: {report.reason}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Reported by{' '}
                      <span className="text-slate-300">
                        {report.reporter.firstName} {report.reporter.lastName}
                      </span>{' '}
                      ({report.reporter.email}) on {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-700 text-slate-300">
                    {report.status}
                  </span>
                </div>

                {report.details && (
                  <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    &quot;{report.details}&quot;
                  </p>
                )}

                {report.post && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs">
                    <span className="text-[10px] font-semibold text-indigo-400 block mb-1">
                      Target Post Content:
                    </span>
                    {report.post.title && (
                      <h4 className="font-semibold text-slate-200 mb-1">
                        {report.post.title}
                      </h4>
                    )}
                    <p className="text-slate-400 line-clamp-3">{report.post.content}</p>
                  </div>
                )}

                {/* Moderation Actions (for PENDING reports) */}
                {report.status === 'PENDING' && (
                  <div className="pt-2 border-t border-slate-700/60 space-y-2.5">
                    <input
                      type="text"
                      placeholder="Add resolution or penalty notes..."
                      value={actionNotes[report.id] || ''}
                      onChange={(e) =>
                        setActionNotes({ ...actionNotes, [report.id]: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />

                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        disabled={processingId === report.id}
                        onClick={() => handleResolve(report.id, 'DISMISSED', false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        Dismiss Report
                      </button>
                      <button
                        type="button"
                        disabled={processingId === report.id}
                        onClick={() => handleResolve(report.id, 'ACTION_TAKEN', true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Content & Mark Action Taken
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
