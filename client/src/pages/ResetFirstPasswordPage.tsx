import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const ResetFirstPasswordPage: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, updateUserPasswordResetStatus } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Password must include at least one uppercase letter and one number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-first-password', { newPassword });
      updateUserPasswordResetStatus(false);

      // Redirect to proper portal
      if (user?.role === 'STUDENT') {
        navigate('/student');
      } else if (['HOD', 'CLASS_INCHARGE', 'FACULTY'].includes(user?.role || '')) {
        navigate('/faculty');
      } else {
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400 mb-4">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white">First-Time Login Security Setup</h1>
          <p className="text-slate-400 text-sm mt-1">
            As a standard security protocol, you must set a permanent password before accessing EduSphere.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-800/60 flex items-start space-x-3 text-red-200 text-sm">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 chars, 1 uppercase, 1 digit"
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-type password"
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-xl transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Updating...' : 'Set Password & Enter Portal'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
