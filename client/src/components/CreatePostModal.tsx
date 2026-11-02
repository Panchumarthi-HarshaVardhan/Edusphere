import React, { useEffect, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  BarChart2,
  ShieldCheck,
  AlertCircle,
  Hash,
  Paperclip,
  Image as ImageIcon,
} from 'lucide-react';
import api from '../api/client';
import { type PostScope, type PostSection } from '../types/community';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  onPostCreated?: () => void;
}

const FEED_SECTIONS: { value: PostSection; label: string }[] = [
  { value: 'UNIVERSITY_FEED', label: 'University Feed' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'YEAR_AND_SECTION', label: 'Year & Section' },
  { value: 'CLUBS', label: 'Clubs & Societies' },
  { value: 'EVENTS', label: 'Events & Conclaves' },
  { value: 'ACHIEVEMENTS', label: 'Achievements & Honors' },
  { value: 'LOST_AND_FOUND', label: 'Lost & Found' },
  { value: 'PLACEMENTS', label: 'Placements & Internships' },
];

const SCOPES: { value: PostScope; label: string; description: string }[] = [
  { value: 'INSTITUTION', label: 'Institution-wide', description: 'Visible to everyone in this university' },
  { value: 'DEPARTMENT', label: 'My Department', description: 'Visible to your department faculty and students' },
  { value: 'YEAR', label: 'My Academic Year', description: 'Visible to all students in your batch' },
  { value: 'SECTION', label: 'My Section', description: 'Visible only to students in your classroom section' },
];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  userRole,
  onPostCreated,
}) => {
  const [section, setSection] = useState<PostSection>('UNIVERSITY_FEED');
  const [scope, setScope] = useState<PostScope>('INSTITUTION');
  const [targetIds, setTargetIds] = useState({ departmentId: '', academicYearId: '', sectionId: '' });
  const [targets, setTargets] = useState<{ departments: Array<{ id: string; name: string }>; academicYears: Array<{ id: string; name: string }>; sections: Array<{ id: string; name: string }> }>({ departments: [], academicYears: [], sections: [] });
  const [targetsError, setTargetsError] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [isVerifiedAnnouncement, setIsVerifiedAnnouncement] = useState(false);

  // Poll state
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    api.get('/community/announcement-targets').then((response) => setTargets(response.data)).catch(() => setTargetsError('Could not load announcement audiences.'));
  }, [isOpen]);

  if (!isOpen) return null;

  const canPostVerified =
    userRole === 'ADMIN' ||
    userRole === 'SUPER_ADMIN' ||
    userRole === 'FACULTY';

  const handleAddPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const handleRemovePollOption = (idx: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== idx));
    }
  };

  const handleOptionChange = (idx: number, val: string) => {
    const updated = [...pollOptions];
    updated[idx] = val;
    setPollOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Post content is required.');
      return;
    }

    if (scope === 'DEPARTMENT' && !targetIds.departmentId) {
      setError('Please choose a target department for this scope.');
      return;
    }
    if (scope === 'YEAR' && !targetIds.academicYearId) {
      setError('Please choose a target academic year for this scope.');
      return;
    }
    if (scope === 'SECTION' && !targetIds.sectionId) {
      setError('Please choose a target section for this scope.');
      return;
    }

    if (showPoll) {
      if (!pollQuestion.trim()) {
        setError('Poll question is required.');
        return;
      }
      const validOptions = pollOptions.filter((o) => o.trim().length > 0);
      if (validOptions.length < 2) {
        setError('A poll must have at least 2 non-empty options.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    const hashtags = hashtagsInput
      .split(',')
      .map((h) => h.trim())
      .filter((h) => h.length > 0)
      .map((h) => (h.startsWith('#') ? h : `#${h}`));

    const payload: any = {
      section,
      scope,
      ...(scope === 'DEPARTMENT' && targetIds.departmentId ? { departmentId: targetIds.departmentId } : {}),
      ...(scope === 'YEAR' && targetIds.academicYearId ? { academicYearId: targetIds.academicYearId } : {}),
      ...(scope === 'SECTION' && targetIds.sectionId ? { sectionId: targetIds.sectionId } : {}),
      title: title.trim() || undefined,
      content: content.trim(),
      hashtags: hashtags.length > 0 ? hashtags : undefined,
      isVerifiedAnnouncement: canPostVerified ? isVerifiedAnnouncement : false,
    };

    if (showPoll) {
      payload.poll = {
        question: pollQuestion.trim(),
        options: pollOptions.filter((o) => o.trim().length > 0),
      };
    }

    try {
      const formData = new FormData();
      formData.append('postData', JSON.stringify(payload));
      attachments.forEach((file) => formData.append('files', file));
      await api.post('/community/posts', formData);
      if (onPostCreated) onPostCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to publish post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="my-8 max-h-[calc(100vh-4rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Create Community Post</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Share updates, announcements, or initiate a discussion
            </p>
          </div>

          <button
            type="button"
            aria-label="Close create post dialog"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Feed Section
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value as PostSection)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {FEED_SECTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Visibility Scope
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as PostScope)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {SCOPES.map((sc) => (
                  <option key={sc.value} value={sc.value}>
                    {sc.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {scope !== 'INSTITUTION' && (
            <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">Audience target</label>
              {scope === 'DEPARTMENT' ? (
                <select required value={targetIds.departmentId} onChange={(e) => setTargetIds({ ...targetIds, departmentId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"><option value="">Choose department</option>{targets.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              ) : scope === 'YEAR' ? (
                <select required value={targetIds.academicYearId} onChange={(e) => setTargetIds({ ...targetIds, academicYearId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"><option value="">Choose academic year</option>{targets.academicYears.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              ) : (
                <select required value={targetIds.sectionId} onChange={(e) => setTargetIds({ ...targetIds, sectionId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"><option value="">Choose section</option>{targets.sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              )}
              <p className="mt-1.5 text-[11px] text-slate-500">{targetsError || SCOPES.find((item) => item.value === scope)?.description}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Headline / Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Hackathon Team Registration Open"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Post Content <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="What would you like to announce or discuss with your peers?"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-indigo-400" />
              Hashtags (comma separated)
            </label>
            <input
              type="text"
              value={hashtagsInput}
              onChange={(e) => setHashtagsInput(e.target.value)}
              placeholder="e.g. #hackathon, #academics, #clubs"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Paperclip className="h-4 w-4 text-indigo-400" /> Add images or files</p>
                <p className="mt-1 text-[11px] text-slate-500">Up to 8 files, 20 MB each. Images, PDF, Office documents, or text.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-indigo-500/50 hover:text-indigo-300">
                <ImageIcon className="h-4 w-4" /> Choose files
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                  className="sr-only"
                  onChange={(event) => {
                    const selected = Array.from(event.target.files || []);
                    if (selected.length + attachments.length > 8) {
                      setError('You can attach up to 8 files to one post.');
                    } else if (selected.some((file) => file.size > 20 * 1024 * 1024)) {
                      setError('Each attachment must be 20 MB or smaller.');
                    } else {
                      setError(null);
                      setAttachments((current) => [...current, ...selected]);
                    }
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
            {!!attachments.length && <ul className="mt-3 divide-y divide-slate-800 rounded-lg border border-slate-800">
              {attachments.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="min-w-0 truncate text-slate-300">{file.name}<span className="ml-2 text-slate-500">{(file.size / (1024 * 1024)).toFixed(1)} MB</span></span>
                <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))} className="shrink-0 rounded px-2 py-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400">Remove</button>
              </li>)}
            </ul>}
          </div>

          {/* Verified Announcement Toggle for Faculty / Admin */}
          {canPostVerified && (
            <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-amber-300">
                    Official Verified Announcement
                  </h4>
                  <p className="text-[11px] text-amber-400/80">
                    Displays verified badge and sends notifications to the selected scope.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isVerifiedAnnouncement}
                onChange={(e) => setIsVerifiedAnnouncement(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          )}

          {/* Poll Builder Section */}
          <div className="border border-slate-800 rounded-xl p-3 bg-slate-800/40">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPoll(!showPoll)}
                className="flex items-center gap-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <BarChart2 className="w-4 h-4" />
                {showPoll ? 'Remove Poll' : 'Add Interactive Poll'}
              </button>
              {showPoll && (
                <span className="text-[11px] text-slate-400">1 vote per student</span>
              )}
            </div>

            {showPoll && (
              <div className="mt-3 space-y-2.5 pt-3 border-t border-slate-700/60">
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Poll Question (e.g. Which elective track should we adopt?)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />

                <div className="space-y-2">
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePollOption(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {pollOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddPollOption}
                    className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Option
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
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
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
