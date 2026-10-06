import { useEffect, useState } from 'react';

export function useCleanerShell(enabled: boolean) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled || !import.meta.env.PROD) return;
    if (!('serviceWorker' in navigator)) { setError(true); return; }
    let cancelled = false;
    let registration: ServiceWorkerRegistration | undefined;
    const update = () => {
      if (cancelled) return;
      if (registration?.active) { setReady(true); setError(false); }
      else if (registration && !registration.installing && !registration.waiting) setError(true);
    };
    const timer = setTimeout(() => {
      void navigator.serviceWorker.register('/cleaner-sw.js', { scope: '/', updateViaCache: 'none' }).then(reg => {
        registration = reg;
        if (reg.active) update();
        reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', update));
        reg.installing?.addEventListener('statechange', update);
        navigator.serviceWorker.addEventListener('controllerchange', update);
      }).catch(() => { if (!cancelled) setError(true); });
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', update); };
  }, [enabled]);
  return { ready, error };
}
