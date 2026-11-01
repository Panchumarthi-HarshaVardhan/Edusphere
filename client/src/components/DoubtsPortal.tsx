import React, { useState, useEffect, useCallback } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  ThumbsUp,
  Pin,
  ShieldCheck,
  EyeOff,
  Code2,
  Search,
  Plus,
  Send,
  Copy,
  Check,
  Eye,
  X,
  Tag,
} from 'lucide-react';
import api from '../api/client';
import { type Doubt, type DoubtReply } from '../types/community';
import { CreateDoubtModal } from './CreateDoubtModal';

interface DoubtsPortalProps {
  userRole?: string;
}

export const DoubtsPortal: React.FC<DoubtsPortalProps> = ({
  userRole = 'STUDENT',
}) => {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string }[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  // Expanded Doubt Thread
  const [expandedDoubtId, setExpandedDoubtId] = useState<string | null>(null);
  const [activeDoubtDetail, setActiveDoubtDetail] = useState<Doubt | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Reply state
  const [replyContent, setReplyContent] = useState('');
  const [replyHasCode, setReplyHasCode] = useState(false);
  const [replyCodeLanguage, setReplyCodeLanguage] = useState('python');
  const [replyCodeSnippet, setReplyCodeSnippet] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  // Modals
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Admin Reveal Author Identity Modal
  const [revealedAuthor, setRevealedAuthor] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    department?: { name: string; code: string };
  } | null>(null);
  const [revealingDoubtId, setRevealingDoubtId] = useState<string | null>(null);

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
  const isFaculty = userRole === 'FACULTY' || userRole === 'HOD' || userRole === 'CLASS_INCHARGE' || isAdmin;

  // Load available subjects
  useEffect(() => {
    setSubjectsLoading(true);
    api
      .get('/materials/subjects')
      .then((res) => {
        setSubjects(res.data.subjects || []);
      })
      .catch((err) => setSubjectsError(err.response?.data?.message || 'Could not load subject filters.'))
      .finally(() => setSubjectsLoading(false));
  }, []);

  // Fetch doubts list
  const fetchDoubts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/community/doubts?status=${statusFilter}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      if (selectedSubjectId) url += `&subjectId=${encodeURIComponent(selectedSubjectId)}`;

      const res = await api.get(url);
      setDoubts(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load doubts.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, selectedSubjectId]);

  useEffect(() => {
    fetchDoubts();
  }, [fetchDoubts]);

  // Load full doubt details & replies
  const handleSelectDoubt = async (doubtId: string) => {
    if (expandedDoubtId === doubtId) {
      setExpandedDoubtId(null);
      setActiveDoubtDetail(null);
      return;
    }

    setExpandedDoubtId(doubtId);
    setDetailLoading(true);
    try {
      const res = await api.get(`/community/doubts/${doubtId}`);
      setActiveDoubtDetail(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load doubt thread.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleDoubtVote = async (doubtId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/community/doubts/${doubtId}/vote`);
      setDoubts((prev) =>
        prev.map((d) =>
          d.id === doubtId
            ? {
                ...d,
                isUpvotedByMe: res.data.upvoted,
                upvotesCount: res.data.upvoted ? d.upvotesCount + 1 : Math.max(0, d.upvotesCount - 1),
              }
            : d
        )
      );

      if (activeDoubtDetail?.id === doubtId) {
        setActiveDoubtDetail((prev) =>
          prev
            ? {
                ...prev,
                isUpvotedByMe: res.data.upvoted,
                upvotesCount: res.data.upvoted
                  ? prev.upvotesCount + 1
                  : Math.max(0, prev.upvotesCount - 1),
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to vote on doubt');
    }
  };

  const handleToggleReplyVote = async (replyId: string) => {
    try {
      const res = await api.post(`/community/replies/${replyId}/vote`);
      if (activeDoubtDetail) {
        setActiveDoubtDetail({
          ...activeDoubtDetail,
          replies: (activeDoubtDetail.replies || []).map((r) =>
            r.id === replyId
              ? {
                  ...r,
                  isUpvotedByMe: res.data.upvoted,
                  upvotesCount: res.data.upvoted ? r.upvotesCount + 1 : Math.max(0, r.upvotesCount - 1),
                }
              : r
          ),
        });
      }
    } catch (err) {
      console.error('Failed to vote on reply');
    }
  };

  const handleTogglePin = async (doubtId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.patch(`/community/doubts/${doubtId}/pin`);
      setDoubts((prev) =>
        prev.map((d) => (d.id === doubtId ? { ...d, isPinned: res.data.doubt.isPinned } : d))
      );
      if (activeDoubtDetail?.id === doubtId) {
        setActiveDoubtDetail((prev) => (prev ? { ...prev, isPinned: res.data.doubt.isPinned } : null));
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle pin.');
    }
  };

  const handleAcceptReply = async (doubtId: string, replyId: string) => {
    try {
      await api.patch(`/community/doubts/${doubtId}/replies/${replyId}/accept`);
      if (activeDoubtDetail) {
        setActiveDoubtDetail({
          ...activeDoubtDetail,
          isResolved: true,
          acceptedReplyId: replyId,
          replies: (activeDoubtDetail.replies || []).map((r) => ({
            ...r,
            isAccepted: r.id === replyId,
          })),
        });
      }
      setDoubts((prev) =>
        prev.map((d) => (d.id === doubtId ? { ...d, isResolved: true, acceptedReplyId: replyId } : d))
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to accept reply.');
    }
  };

  const handleVerifyReply = async (doubtId: string, replyId: string) => {
    try {
      const res = await api.patch(`/community/doubts/${doubtId}/replies/${replyId}/verify`);
      if (activeDoubtDetail) {
        setActiveDoubtDetail({
          ...activeDoubtDetail,
          replies: (activeDoubtDetail.replies || []).map((r) =>
            r.id === replyId
              ? {
                  ...r,
                  isFacultyVerified: res.data.result.isFacultyVerified,
                  verifiedBy: res.data.result.verifiedBy,
                }
              : r
          ),
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to verify reply.');
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoubtDetail || !replyContent.trim()) return;

    setReplySubmitting(true);
    try {
      const res = await api.post(`/community/doubts/${activeDoubtDetail.id}/replies`, {
        content: replyContent.trim(),
        codeSnippet: replyHasCode && replyCodeSnippet.trim() ? replyCodeSnippet.trim() : undefined,
        codeLanguage: replyHasCode ? replyCodeLanguage : undefined,
      });

      const newReply: DoubtReply = {
        ...res.data.reply,
        isAccepted: false,
        upvotesCount: 0,
        isUpvotedByMe: false,
      };

      setActiveDoubtDetail({
        ...activeDoubtDetail,
        repliesCount: activeDoubtDetail.repliesCount + 1,
        replies: [...(activeDoubtDetail.replies || []), newReply],
      });

      setDoubts((prev) =>
        prev.map((d) =>
          d.id === activeDoubtDetail.id ? { ...d, repliesCount: d.repliesCount + 1 } : d
        )
      );

      setReplyContent('');
      setReplyCodeSnippet('');
      setReplyHasCode(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to post reply.');
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleRevealAuthor = async (doubtId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealingDoubtId(doubtId);
    try {
      const res = await api.get(`/community/doubts/${doubtId}/reveal-author`);
      setRevealedAuthor(res.data.author);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Only administrators can inspect anonymous identities.');
    } finally {
      setRevealingDoubtId(null);
    }
  };

  const handleCopyCode = (codeText: string, id: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="doubts-portal-banner bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 border border-sky-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                PEER & FACULTY Q&A
              </span>
              <span className="text-xs text-slate-400">Collaborative Problem Solving</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Academic Doubts Portal</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Ask subject-specific questions, share code solutions, get verified answers from professors,
              and build your academic understanding.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAskModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4" />
            Ask a Doubt
          </button>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-4 border-t border-slate-800/80">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search questions or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Subject Filter */}
          <div>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={subjectsLoading}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{subjectsLoading ? 'Loading subjects…' : subjects.length ? 'All Subjects' : 'No subjects'}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Tab */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80">
            {(['all', 'unresolved', 'resolved'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`flex-1 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
        {subjectsError && <p role="status" className="mt-2 text-xs text-amber-300">{subjectsError}</p>}
      </div>

      {/* Doubts List & Thread View */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading academic questions...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-950/40 border border-rose-800/80 rounded-2xl text-center text-rose-300 text-xs">
          {error}
        </div>
      ) : doubts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <div className="w-12 h-12 bg-slate-800 text-slate-500 rounded-full flex items-center justify-center mx-auto">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-300">No doubts posted yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Have a question on homework, lecture concepts, or exam prep? Ask your instructors and peers!
          </p>
          <button
            type="button"
            onClick={() => setIsAskModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors inline-block"
          >
            Ask a Doubt Now
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {doubts.map((doubt) => {
            const isExpanded = expandedDoubtId === doubt.id;

            return (
              <div
                key={doubt.id}
                className={`bg-slate-900 border transition-all rounded-2xl overflow-hidden shadow-lg ${
                  doubt.isPinned
                    ? 'border-indigo-500/50 bg-gradient-to-b from-indigo-950/20 to-slate-900'
                    : 'border-slate-800 hover:border-slate-700/80'
                }`}
              >
                {/* Doubt Card Summary */}
                <div
                  onClick={() => handleSelectDoubt(doubt.id)}
                  className="p-5 cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="flex-1 space-y-2.5">
                    {/* Badges & Meta */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                        {doubt.subject.code}
                      </span>

                      {doubt.isPinned && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/30">
                          <Pin className="w-3 h-3" /> Pinned
                        </span>
                      )}

                      {doubt.isResolved ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Resolved
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                          Unresolved
                        </span>
                      )}

                      {/* Anonymous indicator */}
                      {doubt.isAnonymous ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                          <EyeOff className="w-3 h-3 text-amber-400" /> Anonymous Student
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          by {doubt.student.firstName} {doubt.student.lastName}
                        </span>
                      )}

                      {/* Admin Reveal Button */}
                      {doubt.isAnonymous && isAdmin && (
                        <button
                          type="button"
                          disabled={revealingDoubtId === doubt.id}
                          onClick={(e) => handleRevealAuthor(doubt.id, e)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-colors"
                        >
                          <Eye className="w-3 h-3" /> Reveal Author
                        </button>
                      )}

                      <span className="text-[11px] text-slate-500 ml-auto">
                        {new Date(doubt.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white hover:text-indigo-300 transition-colors">
                      {doubt.title}
                    </h3>

                    <p className="text-xs text-slate-300 line-clamp-2">{doubt.content}</p>

                    {/* Tags */}
                    {doubt.tags && doubt.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {doubt.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 text-slate-400"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions & Counts */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleToggleDoubtVote(doubt.id, e)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                          doubt.isUpvotedByMe
                            ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <ThumbsUp
                          className={`w-3.5 h-3.5 ${doubt.isUpvotedByMe ? 'fill-indigo-400' : ''}`}
                        />
                        <span>{doubt.upvotesCount}</span>
                      </button>

                      <span className="px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        {doubt.repliesCount} answers
                      </span>
                    </div>

                    {isFaculty && (
                      <button
                        type="button"
                        onClick={(e) => handleTogglePin(doubt.id, e)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          doubt.isPinned
                            ? 'bg-indigo-600/30 text-indigo-400 border-indigo-500/50'
                            : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
                        }`}
                        title={doubt.isPinned ? 'Unpin question' : 'Pin question'}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Thread & Replies */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/60 p-5 space-y-6">
                    {detailLoading ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        Loading answers & thread...
                      </div>
                    ) : activeDoubtDetail ? (
                      <>
                        {/* Question Detailed Content */}
                        <div className="space-y-3 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                          <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                            {activeDoubtDetail.content}
                          </p>

                          {/* Code Snippet if present */}
                          {activeDoubtDetail.codeSnippet && (
                            <div className="relative mt-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                                <span>{activeDoubtDetail.codeLanguage || 'code'}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyCode(
                                      activeDoubtDetail.codeSnippet!,
                                      `doubt-${activeDoubtDetail.id}`
                                    )
                                  }
                                  className="flex items-center gap-1 hover:text-white transition-colors"
                                >
                                  {copiedCodeId === `doubt-${activeDoubtDetail.id}` ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span className="text-emerald-400">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto">
                                <code>{activeDoubtDetail.codeSnippet}</code>
                              </pre>
                            </div>
                          )}
                        </div>

                        {/* List of Replies */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {activeDoubtDetail.replies?.length || 0} Answers & Solutions
                          </h4>

                          {(!activeDoubtDetail.replies || activeDoubtDetail.replies.length === 0) ? (
                            <p className="text-xs text-slate-500 italic py-4">
                              No answers yet. Share your insights to help solve this doubt!
                            </p>
                          ) : (
                            activeDoubtDetail.replies.map((reply) => (
                              <div
                                key={reply.id}
                                className={`rounded-xl p-4 border transition-all ${
                                  reply.isAccepted
                                    ? 'bg-emerald-950/20 border-emerald-500/50'
                                    : reply.isFacultyVerified
                                    ? 'bg-sky-950/20 border-sky-500/50'
                                    : 'bg-slate-900/80 border-slate-800'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-white">
                                      {reply.author.firstName} {reply.author.lastName}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                      {reply.author.role}
                                    </span>

                                    {reply.isAccepted && (
                                      <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        Accepted Solution
                                      </span>
                                    )}

                                    {reply.isFacultyVerified && (
                                      <span className="flex items-center gap-1 text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded-full">
                                        <ShieldCheck className="w-3 h-3 text-sky-400" />
                                        Faculty Verified
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleReplyVote(reply.id)}
                                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                        reply.isUpvotedByMe
                                          ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                                      }`}
                                    >
                                      <ThumbsUp
                                        className={`w-3 h-3 ${
                                          reply.isUpvotedByMe ? 'fill-indigo-400' : ''
                                        }`}
                                      />
                                      <span>{reply.upvotesCount}</span>
                                    </button>
                                  </div>
                                </div>

                                <p className="text-xs text-slate-300 mt-2.5 whitespace-pre-line leading-relaxed">
                                  {reply.content}
                                </p>

                                {reply.codeSnippet && (
                                  <div className="relative mt-2.5 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                                    <div className="flex items-center justify-between px-3 py-1 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
                                      <span>{reply.codeLanguage || 'code'}</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCopyCode(reply.codeSnippet!, `reply-${reply.id}`)
                                        }
                                        className="flex items-center gap-1 hover:text-white"
                                      >
                                        {copiedCodeId === `reply-${reply.id}` ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                    <pre className="p-3 text-xs font-mono text-emerald-400 overflow-x-auto">
                                      <code>{reply.codeSnippet}</code>
                                    </pre>
                                  </div>
                                )}

                                {/* Question Author & Faculty Actions on Replies */}
                                <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-800">
                                  {/* Author can mark accepted answer */}
                                  {activeDoubtDetail.isAuthor && !reply.isAccepted && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAcceptReply(activeDoubtDetail.id, reply.id)
                                      }
                                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Mark as Accepted Solution
                                    </button>
                                  )}

                                  {/* Faculty can verify answer */}
                                  {isFaculty && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleVerifyReply(activeDoubtDetail.id, reply.id)
                                      }
                                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                        reply.isFacultyVerified
                                          ? 'bg-sky-500/30 text-sky-300 border-sky-500/50'
                                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                                      }`}
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                      {reply.isFacultyVerified ? 'Verified by Faculty' : 'Verify Answer'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Post an Answer Form */}
                        <form
                          onSubmit={handlePostReply}
                          className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
                        >
                          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Send className="w-3.5 h-3.5 text-indigo-400" />
                            Post Your Answer / Explanation
                          </h4>

                          <textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            rows={3}
                            placeholder="Explain the concept clearly, referencing documentation or proof..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />

                          {/* Code Snippet Toggle */}
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setReplyHasCode(!replyHasCode)}
                              className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                            >
                              <Code2 className="w-3.5 h-3.5" />
                              {replyHasCode ? 'Remove Code' : 'Attach Code Snippet'}
                            </button>

                            {replyHasCode && (
                              <select
                                value={replyCodeLanguage}
                                onChange={(e) => setReplyCodeLanguage(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded-md px-2 py-0.5 text-xs text-slate-300"
                              >
                                <option value="python">Python</option>
                                <option value="cpp">C++</option>
                                <option value="java">Java</option>
                                <option value="javascript">JavaScript</option>
                                <option value="typescript">TypeScript</option>
                                <option value="go">Go</option>
                                <option value="rust">Rust</option>
                                <option value="sql">SQL</option>
                              </select>
                            )}
                          </div>

                          {replyHasCode && (
                            <textarea
                              value={replyCodeSnippet}
                              onChange={(e) => setReplyCodeSnippet(e.target.value)}
                              rows={4}
                              placeholder={`// Paste your ${replyCodeLanguage} code solution...`}
                              className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-emerald-400 placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                            />
                          )}

                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={replySubmitting || !replyContent.trim()}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors disabled:opacity-50"
                            >
                              {replySubmitting ? 'Posting Answer...' : 'Submit Answer'}
                            </button>
                          </div>
                        </form>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Ask Doubt Modal */}
      <CreateDoubtModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
        onDoubtCreated={fetchDoubts}
      />

      {/* Admin Revealed Anonymous Author Modal (Strict Rule: Logged in Audit Log) */}
      {revealedAuthor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-100">
                  Moderator Identity Inspection
                </h3>
              </div>
              <button
                onClick={() => setRevealedAuthor(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl text-xs text-amber-300 space-y-1">
                <span className="font-bold block">Notice to Administrator:</span>
                <p>
                  This identity reveal action has been permanently logged in the institutional audit
                  log (<code className="bg-black/30 px-1 rounded">REVEAL_ANONYMOUS_AUTHOR</code>) for
                  compliance and security governance.
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Real Author Name:</span>
                  <span className="font-bold text-slate-100">
                    {revealedAuthor.firstName} {revealedAuthor.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Institutional Email:</span>
                  <span className="font-mono text-indigo-300">{revealedAuthor.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Role:</span>
                  <span className="font-semibold text-slate-200">{revealedAuthor.role}</span>
                </div>
                {revealedAuthor.department && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Department:</span>
                    <span className="text-slate-200">{revealedAuthor.department.name}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setRevealedAuthor(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
