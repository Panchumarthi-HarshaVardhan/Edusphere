import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

const currentYear = new Date().getFullYear();

export function SiteFooter() {
  return <footer className="border-t border-slate-200 bg-white px-5 py-8 sm:px-8 dark:border-white/10 dark:bg-slate-950">
    <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
      <Link to="/" className="flex w-fit items-center gap-2.5 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"><span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white"><GraduationCap size={19} /></span><span className="font-display text-sm font-bold text-slate-950 dark:text-white">EduSphere</span></Link>
      <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-slate-600 dark:text-slate-300"><a href="#features" className="hover:text-indigo-700 dark:hover:text-white">Features</a><a href="#portals" className="hover:text-indigo-700 dark:hover:text-white">Portals</a><a href="#request-demo" className="hover:text-indigo-700 dark:hover:text-white">Request a demo</a><Link to="/privacy" className="hover:text-indigo-700 dark:hover:text-white">Privacy</Link><Link to="/terms" className="hover:text-indigo-700 dark:hover:text-white">Terms</Link></nav>
      <a className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-indigo-700 dark:text-slate-400 dark:hover:text-white" href="mailto:contact@example.com">Contact: replace with your email</a>
    </div>
    <div className="mx-auto mt-6 max-w-7xl border-t border-slate-100 pt-5 text-[10px] text-slate-500 dark:border-white/10 dark:text-slate-500">© {currentYear} EduSphere. Academic work, connected.</div>
  </footer>;
}
