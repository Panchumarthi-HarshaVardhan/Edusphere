import React, { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, ChevronDown, GraduationCap, LogOut, Settings2, UserRound } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

interface NavbarItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
}

interface PortalLayoutProps {
  portalName: string;
  sidebarItems: NavbarItem[];
  children: ReactNode;
  themeColor?: string;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({
  portalName,
  sidebarItems,
  children,
  onProfileClick,
  onSettingsClick,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [servicesOpen, setServicesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeAndRun = (action?: () => void) => {
    setServicesOpen(false);
    action?.();
  };

  return (
    <div className="portal-shell min-h-screen bg-slate-950 font-sans text-slate-100">
      <header className="portal-navbar sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/40"><GraduationCap size={22} /></div>
            <div className="min-w-0"><span className="block truncate text-sm font-bold tracking-wide text-white">EduSphere</span><span className="block truncate text-[10px] font-semibold uppercase tracking-[.14em] text-indigo-300">{portalName}</span></div>
          </div>

          <div className="relative">
            <button
              type="button"
              aria-expanded={servicesOpen}
              aria-haspopup="menu"
              onClick={() => { setServicesOpen((open) => !open); setAccountOpen(false); }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-indigo-400/40 hover:text-white"
            >
              <span className="hidden sm:inline">Services</span><ChevronDown size={15} className={`transition ${servicesOpen ? 'rotate-180' : ''}`} />
            </button>
            {servicesOpen && (
              <div role="menu" className="absolute right-0 top-[calc(100%+12px)] z-50 max-h-[75vh] w-[min(88vw,360px)] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-2 shadow-2xl shadow-black/40">
                <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">{portalName} services</p>
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  return <button key={item.label} role="menuitem" onClick={() => closeAndRun(item.onClick)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${item.active ? 'bg-indigo-500/15 text-indigo-200' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-800"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{item.label}</span>{item.badge && <span className="mt-0.5 block text-[10px] text-slate-500">{item.badge}</span>}</span>{item.active && <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />}</button>;
                })}
              </div>
            )}
          </div>

          <div className="hidden items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 sm:flex">
            <Building2 size={14} className="shrink-0 text-slate-500" />
            <span className="max-w-36 truncate text-xs font-medium text-slate-300">{user?.institutionName || 'Institution'}</span>
            <span className="rounded-md bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">{user?.institutionCode || '—'}</span>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="relative">
              <button type="button" aria-expanded={accountOpen} onClick={() => { setAccountOpen((open) => !open); setServicesOpen(false); }} className="flex max-w-44 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1.5 text-left transition hover:border-slate-700 sm:px-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-200">{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
                <span className="hidden min-w-0 sm:block"><span className="block truncate text-xs font-semibold text-white">{user?.firstName} {user?.lastName}</span><span className="block truncate text-[9px] uppercase tracking-wider text-slate-500">{user?.role?.replaceAll('_', ' ')}</span></span>
                <ChevronDown size={14} className="hidden text-slate-500 sm:block" />
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-56 rounded-2xl border border-slate-700 bg-slate-900 p-2 shadow-2xl shadow-black/40">
                  <div className="border-b border-slate-800 px-3 py-2 sm:hidden"><p className="text-xs font-semibold text-white">{user?.firstName} {user?.lastName}</p><p className="mt-1 text-[10px] text-slate-500">{user?.role?.replaceAll('_', ' ')}</p></div>
                  {onProfileClick && <button onClick={() => { setAccountOpen(false); onProfileClick(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"><UserRound size={15} />My profile</button>}
                  {onSettingsClick && <button onClick={() => { setAccountOpen(false); onSettingsClick(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"><Settings2 size={15} />Settings</button>}
                  <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-rose-300 hover:bg-rose-950/40"><LogOut size={15} />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {(servicesOpen || accountOpen) && <button aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => { setServicesOpen(false); setAccountOpen(false); }} />}
      <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
    </div>
  );
};
