import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Lock, Mail, Building, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [institutionCode, setInstitutionCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const user = await login(institutionCode, email, password);

      if (user.mustResetPassword) {
        navigate('/reset-first-password');
        return;
      }

      // Role-based portal redirection
      if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        navigate('/admin');
      } else if (['HOD', 'CLASS_INCHARGE', 'FACULTY'].includes(user.role)) {
        navigate('/faculty');
      } else if (user.role === 'STUDENT') {
        navigate('/student');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-12">
      <div className="pointer-events-none absolute -left-32 top-10 size-[26rem] rounded-full bg-indigo-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-28 size-[30rem] rounded-full bg-cyan-100/70 blur-3xl" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">
        {/* Back to landing page */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
        >
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-900/5">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">EduSphere</h1>
          <p className="mt-1 text-sm text-slate-500">Multi-Institution Academic Portal</p>
          <p className="mt-5 text-center text-xs leading-5 text-slate-500">Sign in with the account provided by your institution.</p>
        </div>

        {error && (
          <div role="alert" className="mb-6 flex items-start space-x-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Institution Code
            </label>
            <div className="relative">
              <Building aria-hidden="true" className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={institutionCode}
                onChange={(e) => setInstitutionCode(e.target.value.toUpperCase())}
                placeholder="Institution code"
                autoComplete="organization"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pl-11 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Email Address
            </label>
            <div className="relative">
              <Mail aria-hidden="true" className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@institution.edu"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pl-11 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock aria-hidden="true" className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pl-11 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Authenticating...' : 'Sign in to Portal'}</span>
            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

      </div>
    </div>
  );
};
