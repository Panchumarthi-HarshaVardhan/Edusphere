import { ArrowUpRight, Check } from 'lucide-react';
import { portalContent } from './content';

function PortalPreview({ id }: { id: string }) {
  const colors = id === 'students' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-300/10 dark:text-indigo-200' : id === 'faculty' ? 'bg-cyan-50 text-cyan-800 dark:bg-cyan-300/10 dark:text-cyan-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200';
  return <div aria-hidden="true" className="mt-5 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-slate-950/60">
    <div className="flex items-center justify-between"><span className="flex items-center gap-2"><i className={`size-2 rounded-full ${id === 'students' ? 'bg-indigo-500' : id === 'faculty' ? 'bg-cyan-500' : 'bg-emerald-500'}`} /><span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">{id === 'students' ? 'My learning' : id === 'faculty' ? 'Teaching workspace' : 'Institution setup'}</span></span><ArrowUpRight size={13} className="text-slate-400" /></div>
    <div className="mt-3 grid grid-cols-3 gap-2"><div className={`rounded-lg p-2 ${colors}`}><div className="h-1 w-8 rounded bg-current opacity-40" /><div className="mt-2 h-1.5 w-full rounded bg-current opacity-20" /></div><div className="rounded-lg bg-slate-100 p-2 dark:bg-white/5"><div className="h-1 w-7 rounded bg-slate-400/40" /><div className="mt-2 h-1.5 w-full rounded bg-slate-400/20" /></div><div className="rounded-lg bg-slate-100 p-2 dark:bg-white/5"><div className="h-1 w-6 rounded bg-slate-400/40" /><div className="mt-2 h-1.5 w-full rounded bg-slate-400/20" /></div></div>
    <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/5"><div className={`h-full w-2/3 rounded-full ${id === 'students' ? 'bg-indigo-500' : id === 'faculty' ? 'bg-cyan-500' : 'bg-emerald-500'}`} /></div>
  </div>;
}

export function PortalsSection() {
  return <section className="bg-slate-50 px-5 py-20 sm:px-8 sm:py-24 dark:bg-slate-900/45">
    <div className="mx-auto max-w-7xl"><div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-700 dark:text-indigo-300">A portal for every role</p><h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-white">The right tools for the whole campus.</h2><p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">Purposeful experiences keep students, faculty, and administrators focused on their part of the learning journey.</p></div>
      <div className="mt-10 grid gap-4 lg:grid-cols-3">{portalContent.map(({ id, title, eyebrow, icon: Icon, description, bullets, accent }) => <article key={id} className="portal-card group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/5 sm:p-6 dark:border-white/10 dark:bg-slate-950/50 dark:hover:shadow-black/20"><div className="flex items-center justify-between"><span className={`grid size-11 place-items-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg`}><Icon size={21} /></span><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{eyebrow}</span></div><h3 className="mt-5 font-display text-xl font-bold text-slate-950 dark:text-white">{title}</h3><p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p><ul className="mt-5 space-y-3">{bullets.map((item) => <li className="flex items-start gap-2 text-xs leading-5 text-slate-700 dark:text-slate-300" key={item}><Check size={14} className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-300" />{item}</li>)}</ul><PortalPreview id={id} /></article>)}</div>
    </div>
  </section>;
}
