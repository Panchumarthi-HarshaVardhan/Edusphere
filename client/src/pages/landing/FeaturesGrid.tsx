import { featureContent } from './content';

export function FeaturesGrid() {
  return <section className="px-5 py-20 sm:px-8 sm:py-24">
    <div className="mx-auto max-w-7xl"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-700 dark:text-indigo-300">Built around academic life</p><h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-white">Everyday work, made more connected.</h2><p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">Keep the important parts of teaching and learning close at hand.</p></div>
      <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{featureContent.map(({ id, icon: Icon, title, description }) => <article id={id} key={title} className="feature-card scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-md dark:border-white/10 dark:bg-white/[.025] dark:hover:border-indigo-300/25"><span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200"><Icon size={19} /></span><h3 className="mt-4 text-sm font-bold text-slate-950 dark:text-white">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">{description}</p></article>)}</div>
    </div>
  </section>;
}
