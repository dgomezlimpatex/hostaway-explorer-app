import { useCallback, useState } from 'react';

const key = 'inventory-preparation-days';
const allowed = [1, 3, 7];
const read = () => { try { const value = Number(sessionStorage.getItem(key)); return allowed.includes(value) ? value : 3; } catch { return 3; } };

/** Keeps the chosen preparation period while moving between inventory pages in this tab. */
export function useInventoryDays(): [number, (days: number) => void] {
  const [days, setDays] = useState(read);
  const change = useCallback((next: number) => {
    if (!allowed.includes(next)) return;
    setDays(next);
    try { sessionStorage.setItem(key, String(next)); } catch { /* private mode: keep the in-memory choice */ }
  }, []);
  return [days, change];
}
