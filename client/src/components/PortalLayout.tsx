import React, { type ReactNode, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  ChevronDown,
  GraduationCap,
  LogOut,
  Menu,
  Settings2,
  UserRound,
  X,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';

export interface NavbarItem {
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const servicesRef = useRef<HTMLDivElement | null>(null);
  const accountRef = useRef<HTMLDivElement | null>(null);

  // Four direct services in navbar, remaining services in Services dropdown tab
  const directServices = sidebarItems.slice(0, 4);
  const dropdownServices = sidebarItems.slice(4);
  const isDropdownActive = dropdownServices.some((item) => item.active);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Close menus on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (servicesRef.current && !servicesRef.current.contains(target)) {
        setServicesOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setServicesOpen(false);
        setAccountOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="portal-shell min-h-screen bg-slate-950 font-sans text-slate-100">
      {/* Top Navbar */}
      <header className="portal-navbar sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1700px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Left: Brand & Portal Name */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-950/50">
              <GraduationCap size={22} />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-base font-bold tracking-tight text-white">
                EduSphere
              </span>
              <span className="block truncate text-[10px] font-semibold uppercase tracking-[.15em] text-indigo-400">
                {portalName}
              </span>
            </div>
          </div>

          {/* Center: Four Direct Services + Services Dropdown Tab */}
          <nav aria-label="Portal Navigation" className="hidden lg:flex items-center gap-1.5">
            {/* 4 Direct Services */}
            {directServices.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    item.active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                  }`}
                >
                  <Icon
                    className={`size-4 transition-colors ${
                      item.active ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                        item.active
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Remaining in Services Dropdown Tab */}
            {dropdownServices.length > 0 && (
              <div className="relative" ref={servicesRef}>
                <button
                  type="button"
                  aria-expanded={servicesOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    setServicesOpen((prev) => !prev);
                    setAccountOpen(false);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer border ${
                    isDropdownActive
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                      : servicesOpen
                      ? 'bg-slate-900 text-white border-slate-700'
                      : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span>Services</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${servicesOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                  {isDropdownActive && (
                    <span className="size-1.5 rounded-full bg-indigo-400" />
                  )}
                </button>

                {/* Dropdown Menu Panel */}
                {servicesOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-[calc(100%+8px)] z-50 w-72 rounded-2xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl"
                  >
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      More Services
                    </div>
                    <div className="space-y-1">
                      {dropdownServices.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              setServicesOpen(false);
                              item.onClick?.();
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition cursor-pointer ${
                              item.active
                                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <span
                              className={`grid size-7 place-items-center rounded-lg ${
                                item.active
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              <Icon className="size-3.5" />
                            </span>
                            <span className="flex-1">{item.label}</span>
                            {item.badge && (
                              <span
                                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                                  item.active
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                            {item.active && <span className="size-1.5 rounded-full bg-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Right: Institution info, Notification Bell & User Profile */}
          <div className="flex shrink-0 items-center gap-3">
            {/* Institution Tag */}
            <div className="hidden xl:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs">
              <Building2 size={14} className="text-indigo-400 shrink-0" />
              <span className="max-w-[130px] truncate font-medium text-slate-300">
                {user?.institutionName || 'Institution'}
              </span>
              <span className="rounded-md bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
                {user?.institutionCode || '—'}
              </span>
            </div>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Account Menu */}
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                aria-expanded={accountOpen}
                onClick={() => {
                  setAccountOpen((prev) => !prev);
                  setServicesOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 transition hover:border-slate-700 cursor-pointer"
              >
                <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xs font-bold text-white shadow-sm shadow-indigo-600/30">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </span>
                <div className="hidden sm:block text-left">
                  <span className="block max-w-[100px] truncate text-xs font-semibold text-white">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className="block text-[9px] font-medium uppercase tracking-wider text-slate-400">
                    {user?.role?.replaceAll('_', ' ')}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform ${accountOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {accountOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-2xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl">
                  <div className="border-b border-slate-800/80 px-3 py-2">
                    <p className="text-xs font-bold text-white">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-[10px] text-indigo-400 truncate">{user?.email}</p>
                    <span className="mt-1 inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">
                      {user?.role?.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <div className="py-1">
                    {onProfileClick && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountOpen(false);
                          onProfileClick();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white cursor-pointer"
                      >
                        <UserRound size={15} className="text-slate-400" />
                        <span>My Profile</span>
                      </button>
                    )}
                    {onSettingsClick && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountOpen(false);
                          onSettingsClick();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white cursor-pointer"
                      >
                        <Settings2 size={15} className="text-slate-400" />
                        <span>Settings</span>
                      </button>
                    )}
                  </div>
                  <div className="border-t border-slate-800/80 pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-rose-400 transition hover:bg-rose-950/30 hover:text-rose-300 cursor-pointer"
                    >
                      <LogOut size={15} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Hamburger Toggle */}
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="grid size-9 place-items-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white lg:hidden cursor-pointer"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile Portal Navigation"
            className="border-t border-slate-800 bg-slate-950 px-4 py-4 lg:hidden"
          >
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Primary Services
              </div>
              {directServices.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      item.onClick?.();
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                      item.active
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <Icon className="size-4" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {dropdownServices.length > 0 && (
                <>
                  <div className="mt-3 border-t border-slate-850 px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Additional Services
                  </div>
                  {dropdownServices.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          item.onClick?.();
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                          item.active
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                        }`}
                      >
                        <Icon className="size-4" />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      {/* Main Page Content */}
      <main className="mx-auto w-full max-w-[1700px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
};
