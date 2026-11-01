import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react';
import api from '../../api/client';

type FormValues = { name: string; institution: string; role: string; email: string; message: string; website: string };
const initialValues: FormValues = { name: '', institution: '', role: '', email: '', message: '', website: '' };

export function DemoRequestSection() {
  const [values, setValues] = useState(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const update = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setResult(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      await api.post('/public/demo-requests', values);
      setValues(initialValues);
      setResult({ type: 'success', message: 'Thanks — your request is in. We’ll be in touch.' });
    } catch (error: any) {
      const validation = error.response?.data?.errors?.[0]?.message;
      setResult({ type: 'error', message: validation || error.response?.data?.message || 'We could not send your request. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return <section className="px-5 pb-20 sm:px-8 sm:pb-24">
    <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl shadow-indigo-950/15 lg:grid-cols-[.85fr_1.15fr]">
      <div className="relative overflow-hidden p-7 text-white sm:p-10 lg:p-12"><div className="absolute -right-20 -top-20 size-64 rounded-full bg-indigo-600/25 blur-3xl" /><div className="relative"><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-300">Let’s talk</p><h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">See how EduSphere could fit your campus.</h2><p className="mt-4 max-w-md text-sm leading-6 text-slate-300">Tell us a little about your institution. Our team can walk you through the platform and answer your questions.</p><div className="mt-8 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><span className="grid size-9 place-items-center rounded-lg bg-indigo-500/20 text-indigo-200"><CheckCircle2 size={18} /></span><p className="text-xs leading-5 text-slate-300">No public account creation. Your institution remains in control of its users.</p></div></div></div>
      <div className="bg-white p-6 sm:p-9 dark:bg-slate-900">
        <form onSubmit={submit} className="space-y-4" aria-label="Request an EduSphere demo">
          <div className="sr-only" aria-hidden="true"><label htmlFor="demo-website">Website</label><input id="demo-website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => update('website', event.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Your name<input required minLength={2} maxLength={120} autoComplete="name" value={values.name} onChange={(event) => update('name', event.target.value)} className="demo-input mt-1.5" placeholder="Alex Morgan" /></label>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Institution<input required minLength={2} maxLength={160} autoComplete="organization" value={values.institution} onChange={(event) => update('institution', event.target.value)} className="demo-input mt-1.5" placeholder="Your institution" /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Your role<select required value={values.role} onChange={(event) => update('role', event.target.value)} className="demo-input mt-1.5"><option value="" disabled>Select a role</option><option>School leader</option><option>Administrator</option><option>Faculty</option><option>IT / technology</option><option>Other</option></select></label>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Work email<input required type="email" maxLength={254} autoComplete="email" value={values.email} onChange={(event) => update('email', event.target.value)} className="demo-input mt-1.5" placeholder="you@institution.edu" /></label>
          </div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">What would you like to explore?<textarea required minLength={10} maxLength={3000} rows={4} value={values.message} onChange={(event) => update('message', event.target.value)} className="demo-input mt-1.5 resize-y" placeholder="Tell us about your institution and what you need." /></label>
          {result && <p role={result.type === 'error' ? 'alert' : 'status'} className={`text-sm ${result.type === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{result.message}</p>}
          <button disabled={submitting} type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">{submitting ? <><LoaderCircle className="animate-spin" size={16} /> Sending…</> : <>Request a demo <ArrowRight size={16} /></>}</button>
          <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">We’ll use these details only to respond to your demo request.</p>
        </form>
      </div>
    </div>
  </section>;
}
