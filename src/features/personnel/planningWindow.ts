// Ventana semanal que usa el planificador (cleaner_availability), calculada con la
// misma función que el planificador para que la ficha muestre exactamente lo mismo.
import { buildEffectiveAvailabilityForDate, type WeeklyAvailabilityRow } from '../../utils/cleaning-planning/availability';
import type { Cleaner } from '../../types/calendar';

/** Lunes a domingo de una semana de referencia sin cambios de hora. */
const REFERENCE_WEEK = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11'];
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export interface PlanningWindowDay {
  day: string;
  /** 'weekly' = fila propia en la tabla; 'contract_fallback' = sin fila, el planificador estima. */
  source: 'weekly' | 'contract_fallback';
  available: boolean;
  windows: Array<{ startTime: string; endTime: string }>;
  availableMinutes: number;
}

export const describePlanningWindow = (
  cleaner: Pick<Cleaner, 'id' | 'planningMaxDailyMinutes'>,
  rows: WeeklyAvailabilityRow[],
  fallbackDailyMinutes = 480,
): PlanningWindowDay[] =>
  REFERENCE_WEEK.map((date, index) => {
    const result = buildEffectiveAvailabilityForDate({
      cleaner: cleaner as Cleaner,
      date,
      weeklyAvailability: rows,
      fallbackCapacityMinutes: cleaner.planningMaxDailyMinutes || fallbackDailyMinutes,
    });
    return {
      day: DAY_NAMES[index],
      source: result.source === 'weekly' ? 'weekly' : 'contract_fallback',
      available: result.isAvailable,
      windows: result.availableWindows,
      availableMinutes: result.availableMinutes,
    };
  });

export const planningWindowText = (day: PlanningWindowDay): string => {
  if (!day.available) return 'No disponible';
  const windows = day.windows.map((w) => `${w.startTime.slice(0, 5)}–${w.endTime.slice(0, 5)}`).join(' · ');
  return day.source === 'weekly' ? windows : `Sin horario propio (estimado ${windows})`;
};

export const minutesAsHours = (minutes?: number | null): string => {
  if (minutes == null) return '—';
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0$/, '').replace('.', ',')} h`;
};
