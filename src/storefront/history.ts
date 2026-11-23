import { useCallback, useEffect, useState, useTransition } from 'react';

const snapshot = (): string => (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');

export const useStoreHistory = () => {
  const [url, setUrl] = useState(snapshot);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const update = () => {
      startTransition(() => {
        setUrl(snapshot());
      });
    };
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  const navigate = useCallback((target: string) => {
    const next = new URL(target, window.location.origin);
    if (next.origin !== window.location.origin) return;
    const path = next.pathname + next.search;
    if (path !== snapshot()) window.history.pushState({}, '', path);
    startTransition(() => {
      setUrl(path);
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return { url, path: url.split('?')[0] || '/', navigate, isPending };
};
