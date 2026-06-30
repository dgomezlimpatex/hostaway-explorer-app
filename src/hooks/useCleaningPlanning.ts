import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays } from 'date-fns';
import { taskStorageService } from '@/services/taskStorage';
import { useCleaners } from '@/hooks/useCleaners';
import { useSede } from '@/contexts/SedeContext';
import { supabase } from '@/integrations/supabase/client';
import { buildCleaningPlanningModel } from '@/utils/cleaningPlanning';
import { buildCapacityMapFromAvailability, buildEffectiveAvailabilityRange, WeeklyAvailabilityRow } from '@/utils/cleaning-planning/availability';
import { CleaningPlanningModel, PlanningRangePreset } from '@/types/cleaningPlanning';
import { WorkerAbsence, WorkerFixedDayOff, WorkerMaintenanceCleaning } from '@/types/workerAbsence';
import { formatMadridDate } from '@/utils/date';

interface UseCleaningPlanningOptions {
  date: Date;
  preset: PlanningRangePreset;
}

const getPlanningRange = (date: Date, preset: PlanningRangePreset) => {
  if (preset === '7d') {
    return {
      startDate: formatMadridDate(date),
      endDate: formatMadridDate(addDays(date, 6)),
    };
  }

  if (preset === '30d') {
    return {
      startDate: formatMadridDate(date),
      endDate: formatMadridDate(addDays(date, 29)),
    };
  }

  const dateStr = formatMadridDate(date);
  return { startDate: dateStr, endDate: dateStr };
};

type WorkerAbsenceRow = {
  id: string;
  cleaner_id: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  absence_type: WorkerAbsence['absenceType'];
  location_name: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type WorkerFixedDayOffRow = {
  id: string;
  cleaner_id: string;
  day_of_week: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type WorkerMaintenanceCleaningRow = {
  id: string;
  cleaner_id: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  location_name: string;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const mapAbsenceFromDB = (row: WorkerAbsenceRow): WorkerAbsence => ({
  id: row.id,
  cleanerId: row.cleaner_id,
  startDate: row.start_date,
  endDate: row.end_date,
  startTime: row.start_time,
  endTime: row.end_time,
  absenceType: row.absence_type,
  locationName: row.location_name,
  notes: row.notes,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapFixedDayOffFromDB = (row: WorkerFixedDayOffRow): WorkerFixedDayOff => ({
  id: row.id,
  cleanerId: row.cleaner_id,
  dayOfWeek: row.day_of_week,
  isActive: row.is_active,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapMaintenanceFromDB = (row: WorkerMaintenanceCleaningRow): WorkerMaintenanceCleaning => ({
  id: row.id,
  cleanerId: row.cleaner_id,
  daysOfWeek: row.days_of_week,
  startTime: row.start_time,
  endTime: row.end_time,
  locationName: row.location_name,
  notes: row.notes,
  isActive: row.is_active,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const useCleaningPlanning = ({ date, preset }: UseCleaningPlanningOptions) => {
  const { activeSede, isInitialized, loading: sedeLoading } = useSede();
  const { cleaners, isLoading: cleanersLoading } = useCleaners();

  const range = useMemo(() => getPlanningRange(date, preset), [date, preset]);

  const tasksQuery = useQuery({
    queryKey: ['cleaning-planning-tasks', range.startDate, range.endDate, activeSede?.id || 'pending-sede'],
    queryFn: () => taskStorageService.getTasks({
      sedeId: activeSede?.id,
      dateFrom: range.startDate,
      dateTo: range.endDate,
    }),
    enabled: isInitialized && !sedeLoading && Boolean(activeSede?.id),
    staleTime: 15_000,
  });

  const weeklyAvailabilityQuery = useQuery({
    queryKey: ['cleaning-planning-weekly-availability'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaner_availability')
        .select('cleaner_id, day_of_week, is_available, start_time, end_time');
      if (error) throw error;
      return (data || []) as WeeklyAvailabilityRow[];
    },
    enabled: isInitialized && !sedeLoading,
    staleTime: 60_000,
  });

  const absencesQuery = useQuery({
    queryKey: ['cleaning-planning-worker-absences', range.startDate, range.endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_absences')
        .select('*')
        .lte('start_date', range.endDate)
        .gte('end_date', range.startDate);
      if (error) throw error;
      return (data || []).map((row) => mapAbsenceFromDB(row as WorkerAbsenceRow));
    },
    enabled: isInitialized && !sedeLoading,
    staleTime: 60_000,
  });

  const fixedDaysOffQuery = useQuery({
    queryKey: ['cleaning-planning-worker-fixed-days-off'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_fixed_days_off')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((row) => mapFixedDayOffFromDB(row as WorkerFixedDayOffRow));
    },
    enabled: isInitialized && !sedeLoading,
    staleTime: 60_000,
  });

  const maintenanceQuery = useQuery({
    queryKey: ['cleaning-planning-worker-maintenance-cleanings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_maintenance_cleanings')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((row) => mapMaintenanceFromDB(row as WorkerMaintenanceCleaningRow));
    },
    enabled: isInitialized && !sedeLoading,
    staleTime: 60_000,
  });

  const effectiveAvailability = useMemo(() => buildEffectiveAvailabilityRange({
    cleaners,
    startDate: range.startDate,
    endDate: range.endDate,
    weeklyAvailability: weeklyAvailabilityQuery.data || [],
    absences: absencesQuery.data || [],
    fixedDaysOff: fixedDaysOffQuery.data || [],
    maintenanceCleanings: maintenanceQuery.data || [],
    assignedTasks: tasksQuery.data || [],
  }), [
    absencesQuery.data,
    cleaners,
    fixedDaysOffQuery.data,
    maintenanceQuery.data,
    range.endDate,
    range.startDate,
    tasksQuery.data,
    weeklyAvailabilityQuery.data,
  ]);

  const capacityByCleaner = useMemo(
    () => buildCapacityMapFromAvailability(effectiveAvailability),
    [effectiveAvailability],
  );

  const planning = useMemo<CleaningPlanningModel>(() => buildCleaningPlanningModel(
    tasksQuery.data || [],
    cleaners,
    capacityByCleaner,
    range.startDate,
    range.endDate,
  ), [capacityByCleaner, cleaners, range.endDate, range.startDate, tasksQuery.data]);

  return {
    planning,
    range,
    effectiveAvailability,
    isLoading: tasksQuery.isLoading || cleanersLoading || weeklyAvailabilityQuery.isLoading || absencesQuery.isLoading || fixedDaysOffQuery.isLoading || maintenanceQuery.isLoading || sedeLoading,
    isError: tasksQuery.isError,
    error: tasksQuery.error,
    refetch: tasksQuery.refetch,
  };
};
