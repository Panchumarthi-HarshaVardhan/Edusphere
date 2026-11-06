import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Menu,
  Sparkles,
  X,
  ChevronDown,
  BookOpen,
  PencilLine,
  ClipboardCheck,
  Users,
  MessageCircle,
  Calendar,
  Award,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

// The 4 primary services displayed directly in the navbar
const primaryServices = [
  { label: 'Study Materials', href: '#materials', icon: BookOpen },
  { label: 'Digital Canvas', href: '#canvas', icon: PencilLine },
  { label: 'Attendance & Marks', href: '#attendance', icon: ClipboardCheck },
  { label: 'Campus Community', href: '#community', icon: Users },
];

// The remaining services housed in the "Services" dropdown tab
const remainingServices = [
  {
    label: 'Academic Doubts',
    href: '#doubts',
    description: 'Anonymous subject Q&A with peer & faculty resolution',
    icon: MessageCircle,
  },
  {
    label: 'Timetable & Schedule',
    href: '#how-it-works',
    description: 'Smart period allocation, timetable imports & calendar',
    icon: Calendar,
  },
  {
    label: 'Assessments & Grading',
    href: '#portals',
    description: 'Continuous assessment grids, GPA reports & grade publishing',
    icon: Award,
  },
  {
    label: 'Admin Governance & Audit',
    href: '#portals',
    description: 'Multi-department hierarchy, RBAC & tamper-evident audit logs',
    icon: ShieldCheck,
  },
];

const secondaryLinks = [
  ['Portals', '#portals'],
  ['FAQ', '#faq'],
];

export function SiteHeader({ onOpenDemo }: { onOpenDemo?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
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
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link
          to="/"
          aria-label="EduSphere home"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white shadow-md shadow-indigo-600/20">
            <GraduationCap size={22} aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-slate-950 dark:text-white">
            EduSphere
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex xl:gap-2">
          {/* Four Direct Services */}
          {primaryServices.map(({ label, href, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 xl:px-3 xl:text-sm dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <Icon size={14} className="text-slate-400 group-hover:text-indigo-600 dark:text-slate-500" />
              <span>{label}</span>
            </a>
          ))}

          {/* Remaining in Services Dropdown Tab */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 xl:px-3 xl:text-sm ${
                dropdownOpen
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
              }`}
            >
              <span>Services</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {/* Dropdown Menu Panel */}
            {dropdownOpen && (
              <div
                role="menu"
                aria-orientation="vertical"
                className="absolute left-0 top-full mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xl shadow-slate-900/10 transition-all dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40"
              >
                <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  More Services
                </div>
                <div className="space-y-1">
                  {remainingServices.map(({ label, href, description, icon: Icon }) => (
                    <a
                      key={href}
                      href={href}
                      onClick={() => setDropdownOpen(false)}
                      className="group flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-500/10 dark:text-indigo-400">
                        <Icon size={16} />
                      </span>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                          {label}
                        </div>
                        <p className="mt-0.5 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                          {description}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>

                <div className="mt-2 border-t border-slate-100 pt-2 dark:border-white/10">
                  <a
                    href="#features"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                  >
                    <span>View all features & workflows</span>
                    <ArrowRight size={13} />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Secondary Links: Portals & FAQ */}
          {secondaryLinks.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 xl:px-3 xl:text-sm dark:text-slate-300 dark:hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Right CTA Actions */}
        <div className="hidden items-center gap-3 sm:flex">
          <Link
            to="/login"
            className="rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 xl:text-sm dark:text-slate-200 dark:hover:bg-white/10"
          >
            Log in
          </Link>
          <button
            type="button"
            onClick={onOpenDemo}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 xl:text-sm"
          >
            <span>Explore demo</span>
            <Sparkles size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
          className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 lg:hidden dark:border-white/15 dark:text-white"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {menuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="border-t border-slate-200 bg-white px-5 py-4 lg:hidden dark:border-white/10 dark:bg-slate-950"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Core Services
            </div>
            {primaryServices.map(({ label, href, icon: Icon }) => (
              <a
                onClick={() => setMenuOpen(false)}
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
              >
                <Icon size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span>{label}</span>
              </a>
            ))}

            <div className="mt-2 border-t border-slate-100 px-2 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/10 dark:text-slate-500">
              Additional Services
            </div>
            {remainingServices.map(({ label, href, icon: Icon }) => (
              <a
                onClick={() => setMenuOpen(false)}
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
              >
                <Icon size={16} className="text-slate-400 dark:text-slate-500" />
                <span>{label}</span>
              </a>
            ))}

            <div className="mt-2 border-t border-slate-100 pt-2 dark:border-white/10">
              {secondaryLinks.map(([label, href]) => (
                <a
                  onClick={() => setMenuOpen(false)}
                  key={href}
                  href={href}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  {label}
                </a>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
              <Link
                onClick={() => setMenuOpen(false)}
                to="/login"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
              >
                Log in
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenDemo?.();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2.5 text-center text-sm font-semibold text-white shadow-sm"
              >
                <span>Explore demo</span>
                <Sparkles size={14} />
              </button>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
