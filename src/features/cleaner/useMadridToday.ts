import { useEffect, useState } from 'react';
import { formatMadridDate } from '@/utils/date';

export const madridDayDate = (civilDate: string) => new Date(`${civilDate}T12:00:00Z`);
export function useMadridToday() {
  const [today, setToday] = useState(() => formatMadridDate(new Date()));
  useEffect(() => {
    const update = () => setToday(formatMadridDate(new Date()));
    const timer = setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  return madridDayDate(today);
}
