import { ArrowDown, ArrowRight, BookOpen, CalendarDays, GraduationCap, ShieldCheck } from 'lucide-react';

function DashboardPreview() {
  return <div aria-label="Illustrative preview of an academic dashboard" role="img" className="hero-dashboard relative mx-auto w-full max-w-[590px]">
    <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-indigo-500/15 blur-3xl" />
    <div className="rounded-[1.6rem] border border-white/70 bg-white p-3 shadow-2xl shadow-indigo-950/15 sm:p-5 dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/10">
        <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white"><GraduationCap size={18} /></span><div><p className="text-xs font-bold text-slate-900 dark:text-white">Campus overview</p><p className="mt-0.5 text-[10px] text-slate-500">Your academic workspace</p></div></div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">Connected</span>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-4">
        <div className="rounded-2xl bg-indigo-50 p-3.5 dark:bg-indigo-400/10"><span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">Today’s classes</span><div className="mt-3 flex items-center gap-2"><CalendarDays size={17} className="text-indigo-600 dark:text-indigo-300" /><span className="text-sm font-bold text-slate-900 dark:text-white">Your schedule</span></div><div className="mt-2 h-1.5 w-2/3 rounded-full bg-indigo-200 dark:bg-indigo-300/30"><div className="h-full w-2/3 rounded-full bg-indigo-600" /></div></div>
        <div className="rounded-2xl bg-cyan-50 p-3.5 dark:bg-cyan-400/10"><span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-800 dark:text-cyan-200">Learning hub</span><div className="mt-3 flex items-center gap-2"><BookOpen size={17} className="text-cyan-700 dark:text-cyan-300" /><span className="text-sm font-bold text-slate-900 dark:text-white">Course materials</span></div><p className="mt-2 text-[10px] text-slate-600 dark:text-slate-300">Lessons, notes, and more</p></div>
      </div>
      <div className="mt-3 rounded-2xl border border-slate-100 p-3.5 dark:border-white/10">
        <div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-900 dark:text-white">Weekly overview</p><span className="text-[10px] text-slate-500">Preview</span></div>
        <div className="mt-4 flex h-24 items-end gap-2" aria-hidden="true">{[44, 62, 50, 82, 58, 74, 91, 66, 84, 56, 76, 94].map((height, index) => <div key={index} className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-600 to-violet-400" style={{ height: `${height}%`, opacity: .6 + height / 250 }} />)}</div>
        <div className="mt-2 flex justify-between text-[9px] text-slate-400"><span>Week 1</span><span>Week 6</span><span>Week 12</span></div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/5"><ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-300" /><p className="text-[10px] font-medium text-slate-600 dark:text-slate-300">Institution-scoped academic workspace</p></div>
    </div>
    <div className="absolute -bottom-5 -left-2 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg sm:flex dark:border-white/10 dark:bg-slate-900"><span className="size-2 rounded-full bg-emerald-500" /><span className="text-xs font-semibold text-slate-700 dark:text-slate-100">One connected campus</span></div>
  </div>;
}

export function Hero() {
  return <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
    <div className="landing-glow pointer-events-none absolute inset-0 -z-10" />
    <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[.92fr_1.08fr] lg:gap-10">
      <div className="max-w-2xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 dark:border-indigo-300/20 dark:bg-indigo-300/10 dark:text-indigo-200"><span className="size-1.5 rounded-full bg-indigo-600 dark:bg-indigo-300" /> For schools, colleges, and universities</div>
        <h1 className="font-display text-5xl font-bold leading-[1.04] tracking-[-.045em] text-slate-950 sm:text-6xl lg:text-[3.8rem] 2xl:text-[4.35rem] dark:text-white">One platform.<br /><span className="text-indigo-700 dark:text-indigo-300">Every academic need.</span></h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8 dark:text-slate-300">Bring teaching, learning resources, attendance, marks, and campus communication into one connected academic workspace.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#request-demo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">Request a demo <ArrowRight size={17} /></a>
          <a href="#portals" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">Explore the portals <ArrowDown size={16} /></a>
        </div>
        <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">Accounts are created by your institution. No public sign-up.</p>
      </div>
      <DashboardPreview />
    </div>
  </section>;
}
