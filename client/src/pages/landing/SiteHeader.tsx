import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap, Menu, X } from 'lucide-react';

const links = [
  ['Features', '#features'], ['Portals', '#portals'], ['How it works', '#how-it-works'], ['FAQ', '#faq'],
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" aria-label="EduSphere home" className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white shadow-md shadow-indigo-600/20"><GraduationCap size={22} aria-hidden="true" /></span>
          <span className="font-display text-lg font-bold tracking-tight text-slate-950 dark:text-white">EduSphere</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          {links.map(([label, href]) => <a key={href} className="text-sm font-medium text-slate-600 transition hover:text-indigo-700 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 dark:text-slate-300 dark:hover:text-white" href={href}>{label}</a>)}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-slate-200 dark:hover:bg-white/10">Log in</Link>
          <a href="#request-demo" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Request a demo <ArrowRight size={15} aria-hidden="true" /></a>
        </div>
        <button type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)} className="grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 md:hidden dark:border-white/15 dark:text-white">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {menuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-slate-200 bg-white px-5 py-4 md:hidden dark:border-white/10 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-1">
          {links.map(([label, href]) => <a onClick={() => setMenuOpen(false)} key={href} href={href} className="rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 dark:text-slate-200 dark:hover:bg-white/5">{label}</a>)}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
            <Link onClick={() => setMenuOpen(false)} to="/login" className="rounded-lg px-3 py-3 text-center text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10">Log in</Link>
            <a onClick={() => setMenuOpen(false)} href="#request-demo" className="rounded-lg bg-brand-600 px-3 py-3 text-center text-sm font-semibold text-white">Request a demo</a>
          </div>
        </div>
      </nav>}
    </header>
  );
}
