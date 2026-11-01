import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

export function LazySection({ children, minHeight = '8rem', id }: { children: ReactNode; minHeight?: string; id?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '500px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={host} id={id} className={id ? 'scroll-mt-24' : undefined} style={{ minHeight }}><Suspense fallback={<div aria-hidden="true" className="mx-auto max-w-7xl animate-pulse rounded-2xl bg-slate-100/60 dark:bg-white/[.025]" style={{ minHeight }} />}>{visible ? children : null}</Suspense></div>;
}
