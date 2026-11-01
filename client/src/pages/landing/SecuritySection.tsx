import { securityPoints } from './content';

export function SecuritySection() {
  return <section className="px-5 py-20 sm:px-8 sm:py-24">
    <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-700 dark:text-indigo-300">Security and privacy</p><h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-white">Designed for institutional trust.</h2><p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">Academic information needs clear boundaries. EduSphere applies tenant scope and role-aware access to the workflows that institutions use every day.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">{securityPoints.map(({ icon: Icon, title, description }) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]"><Icon size={19} className="text-indigo-700 dark:text-indigo-300" /><h3 className="mt-3 text-sm font-bold text-slate-950 dark:text-white">{title}</h3><p className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400">{description}</p></article>)}</div>
    </div>
  </section>;
}
