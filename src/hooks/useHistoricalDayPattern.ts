import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSede } from '@/contexts/SedeContext';
import { subWeeks, addDays } from 'date-fns';
import { formatMadridDate } from '@/utils/date';

export interface HistoricalPattern {
  sampleSize: number;
  avgCheckouts: number;
  maxCheckouts: number;
  minCheckouts: number;
  thisDayCheckouts: number;
  isExceptional: boolean;
  pctVsAverage: number;
}

/**
 * Para el mismo día de la semana, mira los últimos 8 ocurrencias y compara.
 */
export const useHistoricalDayPattern = (date: string | null, currentCheckouts: number) => {
  const { activeSede } = useSede();
  const sedeId = activeSede?.id ?? null;

  return useQuery({
    queryKey: ['historical-day-pattern', sedeId, date, currentCheckouts],
    enabled: !!date,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<HistoricalPattern> => {
      if (!date) {
        return {
          sampleSize: 0,
          avgCheckouts: 0,
          maxCheckouts: 0,
          minCheckouts: 0,
          thisDayCheckouts: currentCheckouts,
          isExceptional: false,
          pctVsAverage: 0,
        };
      }
      const target = new Date(date + 'T12:00:00');
      const dow = target.getDay();
      // 8 ocurrencias previas del mismo día
      const targetDates: string[] = [];
      for (let w = 1; w <= 8; w++) {
        targetDates.push(formatMadridDate(subWeeks(target, w)));
      }
      const minDate = targetDates[targetDates.length - 1];
      const maxDate = targetDates[0];

      const { data, error } = await supabase
        .from('avantio_reservations')
        .select('departure_date, properties!inner(sede_id)')
        .gte('departure_date', minDate)
        .lte('departure_date', maxDate);
      if (error) throw error;

      const byDate = new Map<string, number>();
      targetDates.forEach(d => byDate.set(d, 0));
      (data ?? []).forEach((r: any) => {
        if (sedeId && r.properties?.sede_id !== sedeId) return;
        if (byDate.has(r.departure_date)) {
          byDate.set(r.departure_date, (byDate.get(r.departure_date) ?? 0) + 1);
        }
      });

      const counts = Array.from(byDate.values()).filter(v => v > 0);
      const sampleSize = counts.length;
      const avg = sampleSize ? counts.reduce((a, b) => a + b, 0) / sampleSize : 0;
      const max = counts.length ? Math.max(...counts) : 0;
      const min = counts.length ? Math.min(...counts) : 0;
      const pctVsAverage = avg > 0 ? Math.round(((currentCheckouts - avg) / avg) * 100) : 0;
      const isExceptional = pctVsAverage > 20;

      return {
        sampleSize,
        avgCheckouts: Math.round(avg * 10) / 10,
        maxCheckouts: max,
        minCheckouts: min,
        thisDayCheckouts: currentCheckouts,
        isExceptional,
        pctVsAverage,
      };
    },
  });
};
