import React, { useState, useEffect } from 'react';
import { X, Bell, Mail, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';
import api from '../api/client';
import type { NotificationPreferenceItem } from '../types/notification';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPreferences();
    }
  }, [isOpen]);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications/preferences');
      setPreferences(res.data.preferences || []);
    } catch (err) {
      console.error('Failed to fetch preferences:');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (
    index: number,
    channel: 'inAppEnabled' | 'emailEnabled'
  ) => {
    const item = preferences[index];
    if (item.isUnmutable) return; // Cannot mute attendance shortages or admin alerts

    const updated = [...preferences];
    updated[index] = {
      ...item,
      [channel]: !item[channel],
    };
    setPreferences(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage(null);
    try {
      await api.put('/notifications/preferences', { preferences });
      setSuccessMessage('Notification delivery rules saved successfully.');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Notification Preferences</h2>
              <p className="text-xs text-slate-400">
                Choose which channels you want to receive notifications through.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security / Non-negotiable Notice */}
        <div className="mt-4 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start space-x-2.5 text-xs text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <strong className="font-semibold">Institutional Safety Rule:</strong> Attendance shortage warnings and administrative emergency notices cannot be muted.
          </div>
        </div>

        <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading delivery preferences...</div>
          ) : (
            preferences.map((p, idx) => (
              <div
                key={p.category}
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-white uppercase tracking-wider font-mono">
                      {p.category}
                    </span>
                    {p.isUnmutable && (
                      <span className="text-[10px] bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded flex items-center space-x-1 font-mono">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Mandatory</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {p.category === 'ATTENDANCE'
                      ? 'Attendance shortages and session records'
                      : p.category === 'ADMIN'
                      ? 'Institutional emergency notices and account security'
                      : p.category === 'EXAM'
                      ? 'Published assessment marks and grade updates'
                      : p.category === 'ACADEMIC'
                      ? 'Study materials, syllabus, and lecture notes'
                      : p.category === 'COMMUNITY'
                      ? 'Doubts and class discussion replies'
                      : p.category === 'ANNOUNCEMENT'
                      ? 'Department circulars and institution broadcasts'
                      : 'Assignments and lab practical submissions'}
                  </p>
                </div>

                <div className="flex items-center space-x-4 shrink-0">
                  {/* In-App Toggle */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 mb-1 flex items-center space-x-1">
                      <Bell className="w-3 h-3" />
                      <span>In-App</span>
                    </span>
                    <button
                      type="button"
                      disabled={p.isUnmutable}
                      onClick={() => handleToggle(idx, 'inAppEnabled')}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition cursor-pointer ${
                        p.inAppEnabled ? 'bg-indigo-600' : 'bg-slate-800'
                      } ${p.isUnmutable ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                          p.inAppEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Email Toggle */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 mb-1 flex items-center space-x-1">
                      <Mail className="w-3 h-3" />
                      <span>Email</span>
                    </span>
                    <button
                      type="button"
                      disabled={p.isUnmutable}
                      onClick={() => handleToggle(idx, 'emailEnabled')}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition cursor-pointer ${
                        p.emailEnabled ? 'bg-indigo-600' : 'bg-slate-800'
                      } ${p.isUnmutable ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                          p.emailEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {successMessage && (
          <p className="mt-4 text-xs text-emerald-400 font-medium flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMessage}</span>
          </p>
        )}

        <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
};
