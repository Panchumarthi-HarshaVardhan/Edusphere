import { Plus } from 'lucide-react';
import { faqItems } from './content';

export function FAQSection() {
  return <section className="px-5 py-20 sm:px-8 sm:py-24">
    <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.75fr_1.25fr]"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-700 dark:text-indigo-300">Frequently asked questions</p><h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-white">Good questions.<br />Clear answers.</h2><p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">Need to talk through your institution’s setup? Send a demo request and we’ll follow up.</p></div>
      <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-white/10">{faqItems.map(([question, answer]) => <details key={question} className="group py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-white"><span>{question}</span><Plus size={18} className="shrink-0 text-indigo-700 transition group-open:rotate-45 dark:text-indigo-300" aria-hidden="true" /></summary><p className="max-w-2xl pt-3 pr-8 text-sm leading-6 text-slate-600 dark:text-slate-300">{answer}</p></details>)}</div>
    </div>
  </section>;
}
