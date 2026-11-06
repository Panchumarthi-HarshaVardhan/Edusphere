import React, { useEffect, useState } from 'react';
import { Check, CircleUserRound, Laptop, LoaderCircle, Moon, Save, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppearance, type AppearancePreference } from '../context/AppearanceContext';
import api from '../api/client';

const appearanceOptions: Array<{ id: AppearancePreference; title: string; description: string; icon: typeof Sun }> = [
  { id: 'light', title: 'Light', description: 'Bright surfaces and dark text.', icon: Sun },
  { id: 'dark', title: 'Dark', description: 'A focused, low-light workspace.', icon: Moon },
  { id: 'system', title: 'System', description: 'Follow your device preference.', icon: Laptop },
];

export const ProfilePage: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
  }, [user?.firstName, user?.lastName]);

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const response = await api.patch('/auth/profile', { firstName, lastName });
      updateUserProfile({ firstName: response.data.user.firstName, lastName: response.data.user.lastName });
      setSuccess('Your profile has been saved.');
    } catch (saveError: any) {
      setError(saveError.response?.data?.message || 'Could not save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Account</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">My profile</h1>
        <p className="mt-0.5 text-xs text-slate-500">Your EduSphere identity and campus details.</p>
      </div>
      <div className="rounded-xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100"><CircleUserRound size={34} /></div>
          <div><h2 className="text-base font-bold text-slate-900">{displayName || 'EduSphere user'}</h2><p className="mt-0.5 text-xs text-slate-500">{user?.role?.replaceAll('_', ' ')}</p></div>
        </div>
        <form onSubmit={saveProfile} className="mt-6 space-y-5">
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}
          {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{success}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-700">First name<input required maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10" /></label>
            <label className="block text-xs font-medium text-slate-700">Last name<input required maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10" /></label>
          </div>
          <div className="grid gap-x-8 gap-y-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            {[
              ['Email', user?.email || '—'],
              ['Role', user?.role?.replaceAll('_', ' ') || '—'],
              ['Institution', user?.institutionName || '—'],
              ['Institution code', user?.institutionCode || '—'],
              ['Department', user?.department?.name || 'Not assigned'],
            ].map(([label, value]) => <div key={label}><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-0.5 break-words text-xs font-medium text-slate-800">{value}</div></div>)}
          </div>
          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button type="submit" disabled={isSaving || !firstName.trim() || !lastName.trim()} className="saas-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{isSaving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export const AppearanceSettingsPage: React.FC = () => {
  const { appearance, setAppearance } = useAppearance();

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Preferences</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">Appearance</h1>
        <p className="mt-0.5 text-xs text-slate-500">Choose how EduSphere looks on this device.</p>
      </div>
      <fieldset className="grid gap-3 md:grid-cols-3">
        <legend className="sr-only">Appearance preference</legend>
        {appearanceOptions.map(({ id, title, description, icon: Icon }) => {
          const selected = appearance === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setAppearance(id)}
              className={`rounded-xl border p-5 text-left transition cursor-pointer shadow-xs ${selected ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/10' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl ${selected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}><Icon size={19} /></span>{selected && <Check size={18} className="text-indigo-700 font-bold" />}</div>
              <span className="mt-4 block text-sm font-bold text-slate-900">{title}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
            </button>
          );
        })}
      </fieldset>
      <p className="text-xs text-slate-500">Your choice is saved in this browser. System mode updates when your device theme changes.</p>
    </section>
  );
};
