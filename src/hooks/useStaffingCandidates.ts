import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSede } from '@/contexts/SedeContext';
import { addDays, subDays, startOfWeek, endOfWeek, format } from 'date-fns';
import { formatMadridDate } from '@/utils/date';

export interface CandidateWorker {
  cleanerId: string;
  name: string;
  contractHoursPerWeek: number | null;
  hoursThisWeek: number;
  hoursAvailableThisWeek: number;
  sundaysWorkedLast90d: number;
  isPreferredForDay: boolean;
  hasAbsence: boolean;
  isFixedDayOff: boolean;
  rankScore: number;
  reason: string;
}

/**
 * Devuelve candidatas ordenadas para reforzar un día concreto.
 */
export const useStaffingCandidates = (date: string | null) => {
  const { activeSede } = useSede();
  const sedeId = activeSede?.id ?? null;

  return useQuery({
    queryKey: ['staffing-candidates', sedeId, date],
    enabled: !!sedeId && !!date,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<CandidateWorker[]> => {
      if (!date) return [];
      const target = new Date(date + 'T12:00:00');
      const dow = target.getDay();
      const weekStart = formatMadridDate(startOfWeek(target, { weekStartsOn: 1 }));
      const weekEnd = formatMadridDate(endOfWeek(target, { weekStartsOn: 1 }));
      const ninetyDaysAgo = formatMadridDate(subDays(target, 90));

      // Cleaners activos de la sede
      let cleanersQ = supabase
        .from('cleaners')
        .select('id, name, contract_hours_per_week')
        .eq('is_active', true);
      if (sedeId) cleanersQ = cleanersQ.eq('sede_id', sedeId);
      const { data: cleaners, error } = await cleanersQ;
      if (error) throw error;
      if (!cleaners?.length) return [];
      const cleanerIds = cleaners.map(c => c.id);

      // Tareas semana actual (carga ya asignada)
      const { data: weekTasks } = await supabase
        .from('tasks')
        .select('cleaner_id, date, start_time, end_time')
        .in('cleaner_id', cleanerIds)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .neq('status', 'cancelled');

      // Tareas en domingos últimos 90 días (familiaridad)
      const { data: histTasks } = await supabase
        .from('tasks')
        .select('cleaner_id, date')
        .in('cleaner_id', cleanerIds)
        .gte('date', ninetyDaysAgo)
        .lte('date', formatMadridDate(target));

      // Ausencias en la fecha objetivo
      const { data: absences } = await supabase
        .from('worker_absences')
        .select('cleaner_id')
        .in('cleaner_id', cleanerIds)
        .lte('start_date', date)
        .gte('end_date', date);
      const absentSet = new Set((absences ?? []).map(a => a.cleaner_id));

      // Días libres fijos
      const { data: fixedOff } = await supabase
        .from('worker_fixed_days_off')
        .select('cleaner_id, day_of_week')
        .in('cleaner_id', cleanerIds);
      const fixedOffSet = new Set(
        (fixedOff ?? []).filter((f: any) => f.day_of_week === dow).map((f: any) => f.cleaner_id)
      );

      // Disponibilidad para ese DOW
      const { data: availability } = await supabase
        .from('cleaner_availability')
        .select('cleaner_id, is_available, start_time, end_time')
        .in('cleaner_id', cleanerIds)
        .eq('day_of_week', dow);

      const hoursBetween = (s?: string | null, e?: string | null) => {
        if (!s || !e) return 0;
        const [sh, sm] = s.split(':').map(Number);
        const [eh, em] = e.split(':').map(Number);
        return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
      };

      const candidates: CandidateWorker[] = cleaners.map(c => {
        const myWeekTasks = (weekTasks ?? []).filter((t: any) => t.cleaner_id === c.id);
        const hoursThisWeek = myWeekTasks.reduce((s: number, t: any) => s + hoursBetween(t.start_time, t.end_time), 0);
        const sundaysWorked = new Set(
          (histTasks ?? [])
            .filter((t: any) => t.cleaner_id === c.id && new Date(t.date + 'T12:00:00').getDay() === dow)
            .map((t: any) => t.date)
        ).size;
        const contractHours = c.contract_hours_per_week ?? null;
        const hoursAvailableThisWeek = contractHours != null ? Math.max(0, contractHours - hoursThisWeek) : 0;
        const av = (availability ?? []).find((a: any) => a.cleaner_id === c.id);
        const isAvailableThisDow = !!av?.is_available;
        const hasAbsence = absentSet.has(c.id);
        const isFixedDayOff = fixedOffSet.has(c.id);

        // Score: + horas disponibles, + experiencia DOW, − ausencia, − día libre, − no disponible
        let score = 0;
        score += hoursAvailableThisWeek * 2;
        score += sundaysWorked * 5;
        if (isAvailableThisDow) score += 10;
        if (hasAbsence) score -= 100;
        if (isFixedDayOff) score -= 30;

        const reasons: string[] = [];
        if (hoursAvailableThisWeek > 0) reasons.push(`${hoursAvailableThisWeek.toFixed(1)}h libres en contrato`);
        if (sundaysWorked > 0) reasons.push(`${sundaysWorked}× experiencia este día`);
        if (hasAbsence) reasons.push('ausencia confirmada');
        if (isFixedDayOff) reasons.push('día libre fijo');
        if (!isAvailableThisDow && !hasAbsence) reasons.push('no disponible este día');

        return {
          cleanerId: c.id,
          name: c.name,
          contractHoursPerWeek: contractHours,
          hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
          hoursAvailableThisWeek: Math.round(hoursAvailableThisWeek * 10) / 10,
          sundaysWorkedLast90d: sundaysWorked,
          isPreferredForDay: false,
          hasAbsence,
          isFixedDayOff,
          rankScore: score,
          reason: reasons.join(' · ') || 'sin datos relevantes',
        };
      });

      candidates.sort((a, b) => b.rankScore - a.rankScore);
      return candidates;
    },
  });
};
