import React, { type ReactNode, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  UserRound,
  X,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';

export interface NavbarItem {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
  group?: string;
}

interface PortalLayoutProps {
  portalName: string;
  sidebarItems: NavbarItem[];
  children: ReactNode;
  themeColor?: string;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  activeTitle?: string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({
  portalName,
  sidebarItems,
  children,
  onProfileClick,
  onSettingsClick,
  activeTitle,
  searchPlaceholder = 'Search courses, materials, updates...',
  onSearch,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Collapsible sidebar state (persisted)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('edusphere_sidebar_collapsed') === 'true';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const accountRef = useRef<HTMLDivElement | null>(null);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('edusphere_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Close menus on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountDropdownOpen(false);
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

  // Resolve current active item for breadcrumbs
  const currentActiveItem = sidebarItems.find((item) => item.active);
  const displayTitle = activeTitle || currentActiveItem?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex antialiased">
      {/* ========================================================= */}
      {/* 1. DESKTOP SIDEBAR (Collapsible)                          */}
      {/* ========================================================= */}
      <aside
        className={`hidden lg:flex flex-col border-r border-slate-200/90 bg-white sticky top-0 h-screen z-40 transition-all duration-200 ease-in-out shrink-0 select-none ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {/* Sidebar Header: Brand & Collapse Button */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-700 text-white shadow-xs">
              <GraduationCap size={22} />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 transition-opacity duration-200">
                <span className="block truncate text-sm font-bold tracking-tight text-slate-900 leading-tight">
                  EduSphere
                </span>
                <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
                  {portalName}
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Collapse sidebar"
              className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <PanelLeftClose size={18} />
            </button>
          )}
        </div>

        {/* Collapsed Toggle Button below header */}
        {isCollapsed && (
          <div className="pt-2 px-3 pb-1 flex justify-center">
            <button
              type="button"
              onClick={toggleSidebar}
              title="Expand sidebar"
              className="grid size-9 place-items-center rounded-lg text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
            >
              <PanelLeftOpen size={18} />
            </button>
          </div>
        )}

        {/* Navigation Items List */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.active;

            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                title={isCollapsed ? item.label : undefined}
                className={`group relative flex items-center gap-3 w-full rounded-lg px-3 py-2 text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                } ${isCollapsed ? 'justify-center px-0 h-10' : ''}`}
              >
                {/* Active Indicator Bar on left */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-indigo-700" />
                )}

                <Icon
                  size={18}
                  className={`shrink-0 transition-colors ${
                    isActive ? 'text-indigo-700' : 'text-slate-400 group-hover:text-slate-700'
                  }`}
                />

                {!isCollapsed && (
                  <>
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          isActive
                            ? 'bg-indigo-100 border-indigo-200 text-indigo-800 font-semibold'
                            : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: User Card */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div
            className={`flex items-center gap-3 rounded-lg p-2 transition ${
              isCollapsed ? 'justify-center p-1' : ''
            }`}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold ring-2 ring-indigo-200/50">
              {user?.firstName?.[0] || 'U'}
              {user?.lastName?.[0] || ''}
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900 leading-tight">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="truncate text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                  {user?.role?.replaceAll('_', ' ')}
                </p>
              </div>
            )}

            {!isCollapsed && (
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN LAYOUT WRAPPER                                    */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Mobile Toggle & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile drawer toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="hidden sm:inline font-medium hover:text-slate-700">
                {portalName.replace(' Portal', '')}
              </span>
              <ChevronRight size={14} className="hidden sm:inline text-slate-300" />
              <span className="text-sm font-semibold text-slate-900 truncate">
                {displayTitle}
              </span>
            </div>
          </div>

          {/* Center Search Input (Responsive) */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  onSearch?.(e.target.value);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-12 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 outline-none transition"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                ⌘K
              </span>
            </div>
          </div>

          {/* Right Action Icons: Institution, Bell, Profile Dropdown */}
          <div className="flex items-center gap-3">
            {/* Institution Badge */}
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs">
              <Building2 size={13} className="text-indigo-600 shrink-0" />
              <span className="max-w-[120px] lg:max-w-[160px] truncate font-medium text-slate-700">
                {user?.institutionName || 'Stanford Institute'}
              </span>
              <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-700">
                {user?.institutionCode || 'STANFORD_TECH'}
              </span>
            </div>

            {/* Notification Bell */}
            <div className="border-l border-slate-200 pl-2">
              <NotificationBell />
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountDropdownOpen((prev) => !prev)}
                aria-expanded={accountDropdownOpen}
                className="flex items-center gap-2 rounded-lg border border-slate-200 p-1.5 sm:px-2.5 sm:py-1.5 hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="grid size-7 place-items-center rounded-full bg-indigo-700 text-white text-xs font-bold shadow-xs">
                  {user?.firstName?.[0] || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <span className="block text-xs font-semibold text-slate-900 leading-tight">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className="block text-[9px] font-medium uppercase text-slate-500 tracking-wider">
                    {user?.role?.replaceAll('_', ' ')}
                  </span>
                </div>
                <ChevronDown
                  size={13}
                  className={`text-slate-400 transition-transform ${
                    accountDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {accountDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/5 z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    <span className="mt-1 inline-block rounded bg-indigo-50 text-indigo-700 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase">
                      {user?.role?.replaceAll('_', ' ')}
                    </span>
                  </div>

                  <div className="py-1">
                    {onProfileClick && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountDropdownOpen(false);
                          onProfileClick();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <UserRound size={14} className="text-slate-400" />
                        <span>My Profile</span>
                      </button>
                    )}
                    {onSettingsClick && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountDropdownOpen(false);
                          onSettingsClick();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Settings2 size={14} className="text-slate-400" />
                        <span>Settings</span>
                      </button>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    >
                      <LogOut size={14} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* ========================================================= */}
      {/* 3. MOBILE NAVIGATION DRAWER                               */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col z-50">
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-indigo-700 text-white">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-900">EduSphere</span>
                  <span className="block text-[10px] font-semibold uppercase text-indigo-700 tracking-wider">
                    {portalName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.active;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      item.onClick?.();
                    }}
                    className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-100 text-slate-900'
                    }`}
                  >
                    <Icon
                      size={18}
                      className={isActive ? 'text-indigo-700' : 'text-slate-400'}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase">{user?.role?.replaceAll('_', ' ')}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="grid size-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
