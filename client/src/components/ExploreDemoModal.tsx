import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Presentation,
  Shield,
  ArrowRight,
  LoaderCircle,
  X,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ExploreDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DemoRole = 'STUDENT' | 'FACULTY' | 'ADMIN';

interface DemoConfig {
  role: DemoRole;
  title: string;
  persona: string;
  badge: string;
  path: string;
  email: string;
  description: string;
  highlights: string[];
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  borderHover: string;
}

const DEMO_ACCOUNTS: DemoConfig[] = [
  {
    role: 'STUDENT',
    title: 'Student Portal',
    persona: 'Lucas Vance • B.Tech Computer Science',
    badge: 'Student View',
    path: '/student',
    email: 'student@stanford-tech.edu',
    description: 'Experience the student workflow with live courses, digital canvas notes, attendance, and campus discussions.',
    highlights: [
      'Digital Classroom Canvas viewer & PDF notes',
      'Attendance tracker & what-if percentage calculator',
      'Published internal & external marks breakdown',
      'Peer doubts portal & campus community feed',
    ],
    icon: GraduationCap,
    accentColor: 'bg-indigo-600 text-white shadow-indigo-600/20',
    borderHover: 'hover:border-indigo-400 dark:hover:border-indigo-500',
  },
  {
    role: 'FACULTY',
    title: 'Faculty Portal',
    persona: 'Dr. Elena Rostova • Assistant Professor',
    badge: 'Faculty View',
    path: '/faculty',
    email: 'faculty@stanford-tech.edu',
    description: 'Manage teaching sessions with interactive whiteboard, attendance roll-calls, grading grids, and class doubts.',
    highlights: [
      'Interactive Konva.js digital canvas whiteboard',
      'One-click attendance marking & audit trail logging',
      'Spreadsheet-style marks entry & grade publishing',
      'Verified announcements & doubt resolution',
    ],
    icon: Presentation,
    accentColor: 'bg-emerald-600 text-white shadow-emerald-600/20',
    borderHover: 'hover:border-emerald-400 dark:hover:border-emerald-500',
  },
];

export const ExploreDemoModal: React.FC<ExploreDemoModalProps> = ({ isOpen, onClose }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loadingRole, setLoadingRole] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLaunch = async (config: DemoConfig | { role: DemoRole; email: string; path: string }) => {
    setLoadingRole(config.role);
    setError(null);
    try {
      await login('STANFORD_TECH', config.email, 'Password123!');
      onClose();
      navigate(config.path);
    } catch (err: any) {
      console.error('Demo login failed:', err);
      setError(
        err.response?.data?.message ||
          'Failed to sign in to demo environment. Please check backend connection.'
      );
      setLoadingRole(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explore-demo-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={loadingRole ? undefined : onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-white/10 dark:bg-slate-900">
        {/* Top Header */}
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8 dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Sparkles size={13} className="text-indigo-600 dark:text-indigo-400" />
                <span>Instant Demo Access</span>
              </div>
              <h2
                id="explore-demo-title"
                className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl"
              >
                Which portal would you like to explore?
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Choose a portal to jump straight into EduSphere with pre-populated academic data.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loadingRole !== null}
              aria-label="Close demo modal"
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Error Alert if any */}
        {error && (
          <div className="mx-6 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 sm:mx-8">
            {error}
          </div>
        )}

        {/* Body Cards: Student vs Faculty */}
        <div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
          {DEMO_ACCOUNTS.map((account) => {
            const Icon = account.icon;
            const isLoading = loadingRole === account.role;
            const isDisabled = loadingRole !== null;

            return (
              <div
                key={account.role}
                className={`group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-lg dark:border-white/10 dark:bg-slate-800/60 ${account.borderHover}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`grid size-12 place-items-center rounded-2xl shadow-md ${account.accentColor}`}
                    >
                      <Icon size={24} />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                      {account.badge}
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">
                    {account.title}
                  </h3>
                  <p className="mt-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    {account.persona}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {account.description}
                  </p>

                  <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
                    {account.highlights.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2
                          size={14}
                          className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-2">
                  <button
                    type="button"
                    onClick={() => handleLaunch(account)}
                    disabled={isDisabled}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow transition hover:bg-indigo-600 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-indigo-400"
                  >
                    {isLoading ? (
                      <>
                        <LoaderCircle className="animate-spin" size={16} />
                        <span>Launching {account.title}…</span>
                      </>
                    ) : (
                      <>
                        <span>Explore {account.title}</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: Admin option & Institutional note */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 text-xs text-slate-500 sm:flex-row sm:px-8 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-400">
          <button
            type="button"
            onClick={() =>
              handleLaunch({
                role: 'ADMIN',
                email: 'admin@stanford-tech.edu',
                path: '/admin',
              })
            }
            disabled={loadingRole !== null}
            className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-indigo-600 disabled:opacity-50 dark:text-slate-300 dark:hover:text-white"
          >
            <Shield size={14} className="text-slate-400" />
            <span>Looking for institutional controls? Explore Admin Portal →</span>
          </button>
          <span>Pre-loaded demo data • Stanford Tech</span>
        </div>
      </div>
    </div>
  );
};
