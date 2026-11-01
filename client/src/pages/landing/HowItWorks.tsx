import { workflowSteps } from './content';

export function HowItWorks() {
  return <section className="border-y border-slate-200 bg-white px-5 py-20 sm:px-8 sm:py-24 dark:border-white/10 dark:bg-slate-900/30">
    <div className="mx-auto max-w-7xl"><div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-700 dark:text-indigo-300">A straightforward start</p><h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-white">From setup to everyday learning.</h2></div>
      <ol className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{workflowSteps.map(([number, title, description]) => <li key={number} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[.025]"><span className="font-display text-sm font-bold text-indigo-700 dark:text-indigo-300">{number}</span><h3 className="mt-4 text-sm font-bold text-slate-950 dark:text-white">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">{description}</p></li>)}</ol>
    </div>
  </section>;
}
