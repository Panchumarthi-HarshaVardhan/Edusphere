import { Sparkles } from 'lucide-react';
import { roadmapItems } from './content';

export function RoadmapSection() {
  return <section className="bg-slate-50 px-5 py-20 sm:px-8 dark:bg-slate-900/45">
    <div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-700 dark:text-indigo-300">What’s next</p><h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white">More learning experiences ahead.</h2></div><p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">These are roadmap ideas, not features available today.</p></div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{roadmapItems.map(([title, status]) => <article key={title} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/50"><span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200"><Sparkles size={17} /></span><span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span></span><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200">{status}</span></article>)}</div>
    </div>
  </section>;
}
