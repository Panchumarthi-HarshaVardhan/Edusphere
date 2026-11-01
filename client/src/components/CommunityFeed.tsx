import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Heart,
  ShieldAlert,
  ShieldCheck,
  Pin,
  Send,
  Trash2,
  Search,
  Plus,
  Sparkles,
  Award,
  Calendar,
  Compass,
  Users,
  Briefcase,
  HelpCircle,
  Tag,
} from 'lucide-react';
import api from '../api/client';
import {
  type CommunityPost,
  type PostSection,
  type PostComment,
} from '../types/community';
import { CreatePostModal } from './CreatePostModal';
import { ReportModal } from './ReportModal';
import { ModerationQueueModal } from './ModerationQueueModal';

const isProtectedAttachment = (url: string) => url.includes('/api/community/posts/') && url.includes('/attachments/');

const AuthenticatedCommunityImage: React.FC<{ src: string }> = ({ src }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(isProtectedAttachment(src) ? null : src);
  useEffect(() => {
    if (!isProtectedAttachment(src)) {
      setResolvedSrc(src);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    api.get(src, { responseType: 'blob' }).then((response) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(response.data);
      setResolvedSrc(objectUrl);
    }).catch(() => {
      if (!cancelled) setResolvedSrc(null);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return resolvedSrc
    ? <img src={resolvedSrc} alt="Community post attachment" loading="lazy" className="max-h-96 w-full rounded-xl border border-slate-800 object-cover" />
    : <div className="grid min-h-40 place-items-center rounded-xl border border-slate-800 bg-slate-800/40 text-xs text-slate-500">Loading attachment…</div>;
};

async function downloadCommunityAttachment(url: string, filename: string) {
  const response = await api.get(url, { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

interface CommunityFeedProps {
  userRole?: string;
  currentUserId?: string;
}

const SECTION_TABS: { value: PostSection; label: string; icon: React.ReactNode }[] = [
  { value: 'UNIVERSITY_FEED', label: 'University Feed', icon: <Compass className="w-4 h-4" /> },
  { value: 'DEPARTMENT', label: 'Department', icon: <Users className="w-4 h-4" /> },
  { value: 'YEAR_AND_SECTION', label: 'Year & Section', icon: <Calendar className="w-4 h-4" /> },
  { value: 'CLUBS', label: 'Clubs', icon: <Sparkles className="w-4 h-4" /> },
  { value: 'EVENTS', label: 'Events', icon: <Calendar className="w-4 h-4" /> },
  { value: 'ACHIEVEMENTS', label: 'Achievements', icon: <Award className="w-4 h-4" /> },
  { value: 'LOST_AND_FOUND', label: 'Lost & Found', icon: <HelpCircle className="w-4 h-4" /> },
  { value: 'PLACEMENTS', label: 'Placements', icon: <Briefcase className="w-4 h-4" /> },
];

export const CommunityFeed: React.FC<CommunityFeedProps> = ({
  userRole = 'STUDENT',
  currentUserId = '',
}) => {
  const [activeSection, setActiveSection] = useState<PostSection>('UNIVERSITY_FEED');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isModerationOpen, setIsModerationOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; type: 'POST' | 'COMMENT' } | null>(
    null
  );

  // Expanded comments state
  const [expandedComments, setExpandedComments] = useState<{ [postId: string]: boolean }>({});
  const [commentsByPost, setCommentsByPost] = useState<{ [postId: string]: PostComment[] }>({});
  const [newCommentText, setNewCommentText] = useState<{ [postId: string]: string }>({});
  const [commentSubmitting, setCommentSubmitting] = useState<{ [postId: string]: boolean }>({});

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
  const popularTags = Array.from(
    posts.flatMap((post) => post.hashtags || []).reduce((counts, tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
      return counts;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/community/feed?section=${activeSection}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      if (selectedHashtag) url += `&hashtag=${encodeURIComponent(selectedHashtag)}`;

      const res = await api.get(url);
      setPosts(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load community feed.');
    } finally {
      setLoading(false);
    }
  }, [activeSection, searchQuery, selectedHashtag]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleToggleLike = async (postId: string) => {
    try {
      const res = await api.post(`/community/posts/${postId}/like`);
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            return {
              ...p,
              isLikedByMe: res.data.liked,
              likesCount: res.data.liked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
            };
          }
          return p;
        })
      );
    } catch (err) {
      console.error('Failed to toggle like');
    }
  };

  const handleVotePoll = async (pollId: string, optionIndex: number) => {
    try {
      const res = await api.post(`/community/polls/${pollId}/vote`, { optionIndex });
      setPosts((prev) =>
        prev.map((p) => {
          if (p.poll?.id === pollId) {
            return {
              ...p,
              poll: {
                ...p.poll,
                options: res.data.options,
                totalVotes: res.data.totalVotes,
                userVotedOption: res.data.userVotedOption,
              },
            };
          }
          return p;
        })
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit vote.');
    }
  };

  const toggleComments = async (postId: string) => {
    const isCurrentlyOpen = !!expandedComments[postId];
    setExpandedComments((prev) => ({ ...prev, [postId]: !isCurrentlyOpen }));

    if (!isCurrentlyOpen && !commentsByPost[postId]) {
      try {
        const res = await api.get(`/community/posts/${postId}/comments`);
        setCommentsByPost((prev) => ({ ...prev, [postId]: res.data }));
      } catch (err) {
        console.error('Failed to fetch comments');
      }
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = newCommentText[postId]?.trim();
    if (!text) return;

    setCommentSubmitting((prev) => ({ ...prev, [postId]: true }));
    try {
      const res = await api.post(`/community/posts/${postId}/comments`, { content: text });
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), res.data.comment],
      }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p))
      );
      setNewCommentText((prev) => ({ ...prev, [postId]: '' }));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to post comment.');
    } finally {
      setCommentSubmitting((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      await api.delete(`/community/comments/${commentId}`);
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
      }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p))
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete comment.');
    }
  };

  return (
    <div className="community-feed mx-auto max-w-7xl space-y-5">
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20"><Compass className="h-6 w-6" /></div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-400">Campus network</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Community</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Updates, questions, events, and announcements from your campus community.</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsModerationOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/15"
              >
                <ShieldAlert className="w-4 h-4" />
                <span className="hidden sm:inline">Moderation</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-indigo-950/20 transition hover:bg-indigo-500"
            >
              <Plus className="w-4 h-4" />
              New post
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-2.5">
        <div role="tablist" aria-label="Community sections" className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {SECTION_TABS.map((tab) => {
            const isActive = activeSection === tab.value;
            return (
              <button
                key={tab.value}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveSection(tab.value);
                  setSelectedHashtag(null);
                }}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filter / Search Bar */}
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search campus discussions"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {selectedHashtag && (
          <div className="flex items-center gap-2 self-start rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-300 sm:self-auto">
            <span>Tag: {selectedHashtag}</span>
            <button
              onClick={() => setSelectedHashtag(null)}
              className="text-indigo-400 hover:text-indigo-200 font-bold ml-1"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
      {/* Feed Stream */}
      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-16 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading campus posts...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-800/80 bg-rose-950/40 p-6 text-center">
          <p className="text-sm text-rose-300">{error}</p>
          <button type="button" onClick={fetchFeed} className="mt-3 rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10">Try again</button>
        </div>
      ) : posts.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 px-6 py-14 text-center text-slate-400">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-400">
            <Compass className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">A fresh start for this community</h3>
          <p className="mx-auto max-w-sm text-sm leading-6 text-slate-500">
            Be the first to share an announcement, idea, or question with your university circle.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" /> Share the first post
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const isCommentsOpen = !!expandedComments[post.id];
            const postComments = commentsByPost[post.id] || [];

            return (
              <div
                key={post.id}
                className={`group rounded-2xl border bg-slate-900 p-5 shadow-sm transition hover:shadow-md sm:p-6 ${
                  post.isPinned
                    ? 'border-indigo-500/40 ring-1 ring-indigo-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Post Top Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-sm font-bold text-indigo-400">
                      {post.author.firstName.charAt(0)}
                      {post.author.lastName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">
                          {post.author.firstName} {post.author.lastName}
                        </span>
                        <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-400">
                          {post.author.role.toLowerCase().replaceAll('_', ' ')}
                        </span>

                        {/* Verified Announcement Badge */}
                        {post.isVerifiedAnnouncement && (
                          <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            Verified Announcement
                          </span>
                        )}

                        {post.isPinned && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400">
                            <Pin className="w-3.5 h-3.5" /> Pinned
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] capitalize text-slate-400">
                          {post.scope.toLowerCase()}
                        </span>
                        {post.department && (
                          <>
                            <span>•</span>
                            <span className="text-indigo-400">{post.department.code}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setReportTarget({ id: post.id, type: 'POST' })}
                    title="Report content"
                    aria-label="Report content"
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </button>
                </div>

                {/* Post Body */}
                <div className="mt-3.5 space-y-2">
                  {post.title && (
                    <h3 className="text-lg font-semibold leading-snug text-slate-100">{post.title}</h3>
                  )}
                  <p className="whitespace-pre-line text-sm leading-7 text-slate-300">
                    {post.content}
                  </p>
                </div>

                {(post.images?.length > 0 || post.documents?.length > 0 || post.links?.length > 0) && (
                  <div className="mt-4 space-y-3">
                    {post.images?.length > 0 && (
                      <div className={`grid gap-2 ${post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {post.images.slice(0, 4).map((image, index) => (
                          <AuthenticatedCommunityImage key={`${image}-${index}`} src={image} />
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {post.documents?.filter((document) => document.kind !== 'image').map((document) => (
                        isProtectedAttachment(document.url)
                          ? <button key={document.url} type="button" onClick={() => downloadCommunityAttachment(document.url, document.name).catch(() => alert('Could not download this attachment.'))} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-indigo-400 transition hover:border-indigo-500/50 hover:bg-indigo-500/10">{document.name}</button>
                          : <a key={document.url} href={document.url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-indigo-400 transition hover:border-indigo-500/50 hover:bg-indigo-500/10">{document.name}</a>
                      ))}
                      {post.links?.map((link) => (
                        <a key={link} href={link} target="_blank" rel="noreferrer" className="max-w-full truncate rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-indigo-400 transition hover:border-indigo-500/50 hover:bg-indigo-500/10">{link}</a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hashtags */}
                {post.hashtags && post.hashtags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-3">
                    {post.hashtags.map((tag, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedHashtag(tag)}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-800 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* Attached Interactive Poll */}
                {post.poll && (
                  <div className="mt-4 bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        {post.poll.question}
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        {post.poll.totalVotes} vote{post.poll.totalVotes === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {post.poll.options.map((opt, optIdx) => {
                        const total = post.poll?.totalVotes || 0;
                        const pct = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
                        const hasVoted = post.poll?.userVotedOption !== null;
                        const isMyPick = post.poll?.userVotedOption === optIdx;

                        return (
                          <div key={opt.id} className="relative">
                            {hasVoted ? (
                              <div className="relative overflow-hidden bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs">
                                <div
                                  className={`absolute left-0 top-0 bottom-0 opacity-20 ${
                                    isMyPick ? 'bg-indigo-500' : 'bg-slate-600'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="relative flex items-center justify-between z-10">
                                  <span
                                    className={`font-medium ${
                                      isMyPick ? 'text-indigo-300 font-bold' : 'text-slate-300'
                                    }`}
                                  >
                                    {opt.text} {isMyPick && '✓ (Your vote)'}
                                  </span>
                                  <span className="font-semibold text-slate-400">
                                    {pct}% ({opt.voteCount})
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleVotePoll(post.poll!.id, optIdx)}
                                className="w-full text-left bg-slate-900/90 hover:bg-indigo-600/20 hover:border-indigo-500/60 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 transition-colors"
                              >
                                {opt.text}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Bar */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center gap-1.5 transition-colors ${
                        post.isLikedByMe
                          ? 'text-rose-500 font-semibold'
                          : 'hover:text-rose-400 text-slate-400'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${post.isLikedByMe ? 'fill-rose-500' : ''}`}
                      />
                      <span>{post.likesCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1.5 hover:text-indigo-400 text-slate-400 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{post.commentsCount} comments</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-500">
                    {post.section.replace('_', ' ')}
                  </span>
                </div>

                {/* Inline Expandable Comments Drawer */}
                {isCommentsOpen && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {postComments.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-2">
                          No comments yet. Start the conversation!
                        </p>
                      ) : (
                        postComments.map((c) => (
                          <div
                            key={c.id}
                            className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 flex items-start justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-200">
                                  {c.author.firstName} {c.author.lastName}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(c.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 mt-1">{c.content}</p>
                            </div>

                            {(c.author.id === currentUserId || isAdmin) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(post.id, c.id)}
                                className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* New Comment Input Box */}
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        placeholder="Write a constructive comment..."
                        value={newCommentText[post.id] || ''}
                        onChange={(e) =>
                          setNewCommentText({ ...newCommentText, [post.id]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        disabled={commentSubmitting[post.id] || !newCommentText[post.id]?.trim()}
                        onClick={() => handleAddComment(post.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

        </div>

        <aside className="hidden space-y-4 lg:block">
          <section className="sticky top-24 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Compass className="h-4 w-4 text-indigo-400" /> Community guide</div>
            <p className="mt-2 text-xs leading-5 text-slate-400">Find useful campus updates and keep conversations welcoming.</p>
            <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
              <div><p className="text-xs font-semibold text-slate-200">Choose a space</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500">Use the tabs to browse events, clubs, placements, and more.</p></div>
              <div><p className="text-xs font-semibold text-slate-200">Check the audience</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500">Posts can be shared campus-wide or with a specific group.</p></div>
              <div><p className="text-xs font-semibold text-slate-200">Keep it constructive</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500">Share clear, respectful updates that help your peers.</p></div>
            </div>
          </section>

          {popularTags.length > 0 && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Tag className="h-4 w-4 text-indigo-400" /> Popular topics</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {popularTags.map(([tag, count]) => (
                  <button key={tag} type="button" onClick={() => setSelectedHashtag(tag)} className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-indigo-400 transition hover:border-indigo-500/40 hover:bg-indigo-500/10">{tag}<span className="ml-1.5 text-slate-500">{count}</span></button>
                ))}
              </div>
            </section>
          )}
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs text-slate-400"><span className="font-semibold text-indigo-300">{posts.length}</span> posts in this view</div>
        </aside>
      </div>

      {/* Modals */}
      <CreatePostModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        userRole={userRole}
        onPostCreated={fetchFeed}
      />

      <ModerationQueueModal
        isOpen={isModerationOpen}
        onClose={() => {
          setIsModerationOpen(false);
          fetchFeed();
        }}
      />

      {reportTarget && (
        <ReportModal
          isOpen={true}
          onClose={() => setReportTarget(null)}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          postId={reportTarget.type === 'POST' ? reportTarget.id : undefined}
          onReportSubmitted={fetchFeed}
        />
      )}
    </div>
  );
};
