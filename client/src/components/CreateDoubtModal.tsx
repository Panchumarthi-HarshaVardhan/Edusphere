import React, { useState, useEffect } from 'react';
import { X, Code2, EyeOff, AlertCircle, HelpCircle } from 'lucide-react';
import api from '../api/client';

interface SubjectItem {
  id: string;
  name: string;
  code: string;
}

interface CreateDoubtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDoubtCreated?: () => void;
}

const PROGRAMMING_LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
];

export const CreateDoubtModal: React.FC<CreateDoubtModalProps> = ({
  isOpen,
  onClose,
  onDoubtCreated,
}) => {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [hasCode, setHasCode] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('python');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSubjectsLoading(true);
      setError(null);
      // Fetch available subjects
      api
        .get('/materials/subjects')
        .then((res) => {
          const available = res.data.subjects || [];
          setSubjects(available);
          setSelectedSubjectId(available[0]?.id || '');
        })
        .catch((err) => {
          setSubjects([]);
          setSelectedSubjectId('');
          setError(err.response?.data?.message || 'Could not load your enrolled subjects.');
        })
        .finally(() => setSubjectsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !title.trim() || !content.trim()) {
      setError('Subject, question title, and question explanation are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    try {
      await api.post('/community/doubts', {
        subjectId: selectedSubjectId,
        title: title.trim(),
        content: content.trim(),
        codeSnippet: hasCode && codeSnippet.trim() ? codeSnippet.trim() : undefined,
        codeLanguage: hasCode ? codeLanguage : undefined,
        tags,
        isAnonymous,
      });

      if (onDoubtCreated) onDoubtCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit question.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-xl w-full p-6 text-slate-100 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Ask an Academic Doubt</h2>
              <p className="text-xs text-slate-400">
                Get answers from instructors and fellow scholars
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

        {error && (
          <div className="mt-4 p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Select Subject <span className="text-rose-400">*</span>
            </label>
            <select
              required
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={subjectsLoading || subjects.length === 0}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {!subjects.length && <option value="">{subjectsLoading ? 'Loading subjects…' : 'No enrolled subjects available'}</option>}
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} - {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Question Title / Core Problem <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How does Raft resolve concurrent candidate elections?"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Detailed Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Describe what you tried, what you expected, and where you're getting stuck..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Optional Code Snippet Attachment */}
          <div className="border border-slate-800 rounded-xl p-3 bg-slate-800/40">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setHasCode(!hasCode)}
                className="flex items-center gap-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Code2 className="w-4 h-4" />
                {hasCode ? 'Remove Code Snippet' : 'Attach Code Snippet'}
              </button>
              {hasCode && (
                <select
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-300"
                >
                  {PROGRAMMING_LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {hasCode && (
              <div className="mt-3">
                <textarea
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  rows={6}
                  placeholder={`// Paste your ${codeLanguage} code here...`}
                  className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-emerald-400 placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. raft, concurrency, election"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Anonymous Posting Option */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3 flex items-start gap-3">
            <input
              type="checkbox"
              id="isAnonymousCheckbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-indigo-500 rounded cursor-pointer"
            />
            <label htmlFor="isAnonymousCheckbox" className="text-xs text-slate-300 cursor-pointer">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-amber-400" /> Post Anonymously
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Your name and profile will be masked as &quot;Anonymous Student&quot; to all students and faculty.
                Campus administrators may view identity solely for moderation, which is recorded in the institution audit log.
              </p>
            </label>
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
              disabled={submitting || subjectsLoading || !subjects.length}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting Question...' : 'Submit Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
