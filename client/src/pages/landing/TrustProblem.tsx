import { ArrowRight, Check, Layers3, MessageCircle, Table2 } from 'lucide-react';
import { comparisonItems, trustItems } from './content';

export function TrustStrip() {
  return <section aria-label="Institution types" className="border-y border-slate-200 bg-white px-5 py-7 sm:px-8 dark:border-white/10 dark:bg-slate-900/45">
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 sm:flex-row">
      <p className="text-center text-xs font-semibold uppercase tracking-[.16em] text-slate-500 sm:text-left dark:text-slate-400">Built for every learning community</p>
      <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm font-semibold text-slate-700 sm:justify-end dark:text-slate-200">{trustItems.map((item) => <li key={item} className="flex items-center gap-2"><Check size={15} className="text-indigo-600 dark:text-indigo-300" />{item}</li>)}</ul>
    </div>
  </section>;
}

export function TrustProblem() {
  return <>
    <TrustStrip />
    <section className="px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-700 dark:text-indigo-300">The daily reality</p><h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-white">Academic work shouldn’t live in a dozen places.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-slate-600 dark:text-slate-300">When conversations, records, and learning resources are scattered, it takes more effort to keep everyone on the same page.</p></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          <div className="grid gap-3">
            {comparisonItems.map((item, index) => { const Icon = [MessageCircle, Table2, Layers3][index]; return <article key={item.title} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.035]"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"><Icon size={17} /></span><div><h3 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{item.detail}</p></div></article>; })}
          </div>
          <div className="hidden place-items-center text-indigo-500 sm:grid"><ArrowRight size={22} /></div>
          <article className="flex flex-col justify-center rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-300/20 dark:bg-indigo-300/[.08]"><span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white"><Layers3 size={20} /></span><h3 className="mt-4 text-base font-bold text-slate-950 dark:text-white">One academic workspace</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Connect the people, learning workflows, and campus updates that help an institution run.</p></article>
        </div>
      </div>
    </section>
  </>;
}
