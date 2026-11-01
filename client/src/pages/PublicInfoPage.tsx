import { Link } from 'react-router-dom';

export function PublicInfoPage({ page }: { page: 'privacy' | 'terms' }) {
  const isPrivacy = page === 'privacy';
  return <main className="min-h-screen bg-white px-5 py-16 text-slate-900 dark:bg-slate-950 dark:text-white">
    <article className="mx-auto max-w-3xl"><Link to="/" className="text-sm font-semibold text-indigo-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-indigo-600 dark:text-indigo-300">← EduSphere home</Link><h1 className="mt-8 font-display text-4xl font-bold">{isPrivacy ? 'Privacy' : 'Terms of service'}</h1><p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Placeholder page: the institution must provide and approve its privacy policy and terms before production use.</p><p className="mt-5 text-sm leading-7 text-slate-600 dark:text-slate-300">{isPrivacy ? 'This page will describe how EduSphere and the institution collect, use, retain, and protect personal and academic information.' : 'This page will describe the terms that govern access to EduSphere and its academic services.'}</p></article>
  </main>;
}
