import { useStaffingForecast, ForecastDay } from './useStaffingForecast';

/**
 * Devuelve el estado de previsión para un día concreto, listo para
 * usar en badges de calendario, dashboard, etc.
 */
export const useDayForecastBadge = (date: string | null) => {
  const { data, isLoading } = useStaffingForecast(60);
  if (!date || !data) return { day: null as ForecastDay | null, isLoading };
  const day = data.days.find(d => d.date === date) ?? null;
  return { day, isLoading };
};
