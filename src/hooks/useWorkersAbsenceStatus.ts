import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ABSENCE_TYPE_COLORS } from '@/types/workerAbsence';

export interface WorkerAbsenceStatus {
  cleanerId: string;
  isAbsent: boolean;
  absenceType?: string;
  absenceColor?: string;
  isFixedDayOff?: boolean;
  maintenanceCleanings?: {
    locationName: string;
    startTime: string;
    endTime: string;
  }[];
  hourlyAbsences?: {
    type: string;
    startTime: string;
    endTime: string;
    locationName?: string;
  }[];
}

export const useWorkersAbsenceStatus = (cleanerIds: string[], date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayOfWeek = date.getDay();

  return useQuery({
    queryKey: ['workers-absence-status', cleanerIds, dateStr],
    queryFn: async (): Promise<Record<string, WorkerAbsenceStatus>> => {
      if (cleanerIds.length === 0) return {};

      // Fetch all data in parallel
      const [absencesResult, fixedDaysResult, maintenanceResult] = await Promise.all([
        // Full-day and hourly absences for this date
        supabase
          .from('worker_absences')
          .select('*')
          .in('cleaner_id', cleanerIds)
          .lte('start_date', dateStr)
          .gte('end_date', dateStr),
        
        // Fixed days off for this day of week
        supabase
          .from('worker_fixed_days_off')
          .select('*')
          .in('cleaner_id', cleanerIds)
          .eq('day_of_week', dayOfWeek)
          .eq('is_active', true),
        
        // Maintenance cleanings for this day of week
        supabase
          .from('worker_maintenance_cleanings')
          .select('*')
          .in('cleaner_id', cleanerIds)
          .eq('is_active', true)
          .contains('days_of_week', [dayOfWeek])
      ]);

      const statusMap: Record<string, WorkerAbsenceStatus> = {};

      // Initialize all cleaners
      cleanerIds.forEach(id => {
        statusMap[id] = {
          cleanerId: id,
          isAbsent: false,
          maintenanceCleanings: [],
          hourlyAbsences: []
        };
      });

      // Process fixed days off
      fixedDaysResult.data?.forEach(dayOff => {
        if (statusMap[dayOff.cleaner_id]) {
          statusMap[dayOff.cleaner_id].isAbsent = true;
          statusMap[dayOff.cleaner_id].isFixedDayOff = true;
          statusMap[dayOff.cleaner_id].absenceType = 'day_off';
          statusMap[dayOff.cleaner_id].absenceColor = ABSENCE_TYPE_COLORS.day_off;
        }
      });

      // Process absences
      absencesResult.data?.forEach(absence => {
        if (statusMap[absence.cleaner_id]) {
          const isFullDay = !absence.start_time || !absence.end_time;
          
          if (isFullDay) {
            statusMap[absence.cleaner_id].isAbsent = true;
            statusMap[absence.cleaner_id].absenceType = absence.absence_type;
            statusMap[absence.cleaner_id].absenceColor = 
              ABSENCE_TYPE_COLORS[absence.absence_type as keyof typeof ABSENCE_TYPE_COLORS] || '#6B7280';
          } else {
            statusMap[absence.cleaner_id].hourlyAbsences?.push({
              type: absence.absence_type,
              startTime: absence.start_time!,
              endTime: absence.end_time!,
              locationName: absence.location_name || undefined
            });
          }
        }
      });

      // Process maintenance cleanings
      maintenanceResult.data?.forEach(maintenance => {
        if (statusMap[maintenance.cleaner_id]) {
          statusMap[maintenance.cleaner_id].maintenanceCleanings?.push({
            locationName: maintenance.location_name,
            startTime: maintenance.start_time,
            endTime: maintenance.end_time
          });
        }
      });

      return statusMap;
    },
    enabled: cleanerIds.length > 0,
    staleTime: 30000, // 30 seconds
  });
};
