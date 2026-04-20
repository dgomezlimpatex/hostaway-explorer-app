import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays } from 'date-fns';
import { useMemo } from 'react';
import { Cleaner } from '@/types/calendar';
import { ABSENCE_TYPE_CONFIG, AbsenceType } from '@/types/workerAbsence';

export type UnavailableReason = 'fixed_day_off' | 'absence';

export interface UnavailableCleanerInfo {
  cleaner: Cleaner;
  reason: UnavailableReason;
  absenceType: AbsenceType | 'day_off';
  label: string;
  color: string;
  icon: string;
  notes?: string | null;
  locationName?: string | null;
}

type ViewType = 'day' | 'three-day' | 'week' | string;

const getDateRange = (currentDate: Date, view: ViewType): Date[] => {
  if (view === 'three-day') {
    return [0, 1, 2].map(i => addDays(currentDate, i));
  }
  if (view === 'week') {
    return Array.from({ length: 7 }, (_, i) => addDays(currentDate, i));
  }
  return [currentDate];
};

/**
 * Returns cleaners considered fully unavailable across the entire visible range.
 * - Full-day absences (start_time IS NULL) covering every date in the range
 * - Fixed weekly day off applying to every day-of-week in the range
 * Excludes: external_work (still available for internal tasks) and partial/hourly absences.
 */
export const useUnavailableCleaners = (
  cleaners: Cleaner[],
  currentDate: Date,
  view: ViewType = 'day'
) => {
  const dates = useMemo(() => getDateRange(currentDate, view), [currentDate, view]);
  const dateStrs = useMemo(() => dates.map(d => format(d, 'yyyy-MM-dd')), [dates]);
  const daysOfWeek = useMemo(() => dates.map(d => d.getDay()), [dates]);
  const cleanerIds = useMemo(() => cleaners.map(c => c.id), [cleaners]);

  const rangeStart = dateStrs[0];
  const rangeEnd = dateStrs[dateStrs.length - 1];

  const { data, isLoading } = useQuery({
    queryKey: ['unavailable-cleaners', cleanerIds, rangeStart, rangeEnd],
    queryFn: async () => {
      if (cleanerIds.length === 0) {
        return { absences: [], fixedDays: [] };
      }

      const [absencesRes, fixedRes] = await Promise.all([
        supabase
          .from('worker_absences')
          .select('*')
          .in('cleaner_id', cleanerIds)
          .lte('start_date', rangeEnd)
          .gte('end_date', rangeStart)
          .is('start_time', null),
        supabase
          .from('worker_fixed_days_off')
          .select('*')
          .in('cleaner_id', cleanerIds)
          .eq('is_active', true)
          .in('day_of_week', daysOfWeek),
      ]);

      return {
        absences: absencesRes.data || [],
        fixedDays: fixedRes.data || [],
      };
    },
    enabled: cleanerIds.length > 0,
    staleTime: 30_000,
  });

  const unavailableMap = useMemo(() => {
    const map: Record<string, UnavailableCleanerInfo> = {};
    if (!data) return map;

    cleaners.forEach(cleaner => {
      // Check absences: cleaner is unavailable across the whole range if every date is covered
      const cleanerAbsences = data.absences.filter(a => a.cleaner_id === cleaner.id);
      const dateCoveredByAbsence: Record<string, typeof cleanerAbsences[number]> = {};
      dateStrs.forEach(ds => {
        const match = cleanerAbsences.find(a => a.start_date <= ds && a.end_date >= ds);
        if (match) dateCoveredByAbsence[ds] = match;
      });
      const allCoveredByAbsence = dateStrs.every(ds => !!dateCoveredByAbsence[ds]);

      if (allCoveredByAbsence && dateStrs.length > 0) {
        // Pick the first absence as representative (most relevant) — exclude external_work
        const representative = dateCoveredByAbsence[dateStrs[0]];
        if (representative && representative.absence_type !== 'external_work') {
          const cfg = ABSENCE_TYPE_CONFIG[representative.absence_type as AbsenceType];
          map[cleaner.id] = {
            cleaner,
            reason: 'absence',
            absenceType: representative.absence_type as AbsenceType,
            label: cfg?.label || representative.absence_type,
            color: cfg?.color || '#6B7280',
            icon: cfg?.icon || '⛔',
            notes: representative.notes,
            locationName: representative.location_name,
          };
          return;
        }
      }

      // Check fixed days off: every day in range must match a fixed day off for this cleaner
      const cleanerFixedDays = data.fixedDays
        .filter(f => f.cleaner_id === cleaner.id)
        .map(f => f.day_of_week);
      const allDaysFixedOff =
        daysOfWeek.length > 0 && daysOfWeek.every(dow => cleanerFixedDays.includes(dow));

      if (allDaysFixedOff) {
        const cfg = ABSENCE_TYPE_CONFIG.day_off;
        map[cleaner.id] = {
          cleaner,
          reason: 'fixed_day_off',
          absenceType: 'day_off',
          label: 'Día libre fijo',
          color: cfg.color,
          icon: cfg.icon,
        };
      }
    });

    return map;
  }, [data, cleaners, dateStrs, daysOfWeek]);

  const unavailableList = useMemo(
    () => Object.values(unavailableMap).sort((a, b) => a.cleaner.name.localeCompare(b.cleaner.name)),
    [unavailableMap]
  );

  const unavailableIds = useMemo(() => new Set(Object.keys(unavailableMap)), [unavailableMap]);

  return { unavailableList, unavailableIds, isLoading };
};
