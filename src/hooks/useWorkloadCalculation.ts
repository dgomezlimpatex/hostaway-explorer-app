import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCleaners } from './useCleaners';
import { useWorkerContracts } from './useWorkerContracts';
import { WorkloadSummary, HourAdjustment } from '@/types/workload';
import { WorkerMaintenanceCleaning } from '@/types/workerAbsence';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';

// Helper to parse time string to minutes
const parseTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

// Calculate maintenance hours for a specific date range
const calculateMaintenanceHoursForPeriod = (
  maintenanceCleanings: WorkerMaintenanceCleaning[],
  startDate: Date,
  endDate: Date
): number => {
  let totalMinutes = 0;
  
  const daysInPeriod = eachDayOfInterval({ start: startDate, end: endDate });
  
  for (const cleaning of maintenanceCleanings) {
    if (!cleaning.isActive) continue;
    
    for (const day of daysInPeriod) {
      const dayOfWeek = getDay(day); // 0 = Sunday
      
      if (cleaning.daysOfWeek.includes(dayOfWeek)) {
        const startMinutes = parseTimeToMinutes(cleaning.startTime);
        const endMinutes = parseTimeToMinutes(cleaning.endTime);
        totalMinutes += (endMinutes - startMinutes);
      }
    }
  }
  
  return totalMinutes / 60;
};

// Calculate recurring task hours for a specific date range (only not-yet-generated instances)
const calculateRecurringHoursForPeriod = (
  recurringTasks: any[],
  executedSet: Set<string>,
  startDate: Date,
  endDate: Date
): { hours: number; count: number } => {
  let totalMinutes = 0;
  let count = 0;
  
  const daysInPeriod = eachDayOfInterval({ start: startDate, end: endDate });
  
  for (const rt of recurringTasks) {
    if (!rt.is_active) continue;
    
    const rtStartDate = new Date(rt.start_date);
    const rtEndDate = rt.end_date ? new Date(rt.end_date) : endDate;
    
    const durationMinutes = rt.duracion || (() => {
      if (rt.start_time && rt.end_time) {
        return Math.max(0, parseTimeToMinutes(rt.end_time) - parseTimeToMinutes(rt.start_time));
      }
      return 0;
    })();
    
    for (const day of daysInPeriod) {
      if (day < rtStartDate || day > rtEndDate) continue;
      
      const dateStr = format(day, 'yyyy-MM-dd');
      
      // Skip if already executed (those are in tasks table already)
      if (executedSet.has(`${rt.id}_${dateStr}`)) continue;
      
      const dayOfWeek = getDay(day);
      let shouldCount = false;
      
      switch (rt.frequency) {
        case 'daily':
          shouldCount = true;
          break;
        case 'weekly':
          if (rt.days_of_week && rt.days_of_week.length > 0) {
            shouldCount = rt.days_of_week.includes(dayOfWeek);
          }
          break;
        case 'monthly':
          if (rt.day_of_month) {
            shouldCount = day.getDate() === rt.day_of_month;
          }
          break;
      }
      
      if (shouldCount) {
        totalMinutes += durationMinutes;
        count++;
      }
    }
  }
  
  return { hours: totalMinutes / 60, count };
};

// Determine workload status based on percentage
const determineStatus = (percentage: number): WorkloadSummary['status'] => {
  if (percentage >= 90 && percentage <= 100) return 'on-track';
  if (percentage > 100 && percentage <= 110) return 'overtime';
  if (percentage < 80) return 'critical-deficit';
  if (percentage < 90) return 'deficit';
  return 'overtime'; // > 110%
};

interface UseWorkloadCalculationOptions {
  startDate: string;
  endDate: string;
  cleanerId?: string; // Optional: filter by specific cleaner
}

export const useWorkloadCalculation = (options: UseWorkloadCalculationOptions) => {
  const { startDate, endDate, cleanerId } = options;
  const { cleaners } = useCleaners();
  const { data: contracts = [], isLoading: contractsLoading } = useWorkerContracts();

  return useQuery({
    queryKey: ['workload', startDate, endDate, cleanerId, contracts.length],
    queryFn: async (): Promise<WorkloadSummary[]> => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Filter cleaners if specific ID provided
      const targetCleaners = cleanerId 
        ? cleaners.filter(c => c.id === cleanerId)
        : cleaners.filter(c => c.isActive);
      
      if (targetCleaners.length === 0) return [];
      
      const cleanerIds = targetCleaners.map(c => c.id);
      
      // Fetch all data in parallel
      const [tasksResult, maintenanceResult, adjustmentsResult, recurringResult] = await Promise.all([
        // Tasks: all assigned, not cancelled
        supabase
          .from('tasks')
          .select('cleaner_id, start_time, end_time, duracion, status')
          .in('cleaner_id', cleanerIds)
          .gte('date', startDate)
          .lte('date', endDate)
          .neq('status', 'cancelled'),
        
        // Maintenance cleanings
        supabase
          .from('worker_maintenance_cleanings')
          .select('*')
          .in('cleaner_id', cleanerIds)
          .eq('is_active', true),
        
        // Hour adjustments
        supabase
          .from('worker_hour_adjustments')
          .select('*')
          .in('cleaner_id', cleanerIds)
          .gte('date', startDate)
          .lte('date', endDate),
        
        // Active recurring tasks assigned to these cleaners
        supabase
          .from('recurring_tasks')
          .select('*')
          .in('cleaner_id', cleanerIds)
          .eq('is_active', true),
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (maintenanceResult.error) throw maintenanceResult.error;
      if (adjustmentsResult.error) throw adjustmentsResult.error;
      if (recurringResult.error) throw recurringResult.error;

      const tasks = tasksResult.data || [];
      const recurringTasks = recurringResult.data || [];
      
      // Fetch executed recurring task instances for this period
      const recurringTaskIds = recurringTasks.map(rt => rt.id);
      let executedSet = new Set<string>();
      
      if (recurringTaskIds.length > 0) {
        const { data: executions } = await supabase
          .from('recurring_task_executions')
          .select('recurring_task_id, execution_date')
          .in('recurring_task_id', recurringTaskIds)
          .gte('execution_date', startDate)
          .lte('execution_date', endDate)
          .eq('success', true);
        
        if (executions) {
          executions.forEach(e => executedSet.add(`${e.recurring_task_id}_${e.execution_date}`));
        }
      }

      const maintenanceCleanings: WorkerMaintenanceCleaning[] = (maintenanceResult.data || []).map(row => ({
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
      }));
      const adjustments: HourAdjustment[] = (adjustmentsResult.data || []).map(row => ({
        id: row.id,
        cleanerId: row.cleaner_id,
        date: row.date,
        hours: Number(row.hours),
        category: row.category as HourAdjustment['category'],
        reason: row.reason,
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      // Calculate number of weeks in period for contract hours
      const daysInPeriod = eachDayOfInterval({ start, end }).length;
      const weeksInPeriod = daysInPeriod / 7;

      // Calculate workload for each cleaner
      const summaries: WorkloadSummary[] = targetCleaners.map(cleaner => {
        // Get contract for this cleaner
        const contract = contracts.find(c => c.cleanerId === cleaner.id && c.isActive);
        const contractHoursPerWeek = contract?.contractHoursPerWeek || cleaner.contractHoursPerWeek || 0;
        const contractHoursForPeriod = contractHoursPerWeek * weeksInPeriod;

        // Calculate tourist hours from tasks
        const cleanerTasks = tasks.filter(t => t.cleaner_id === cleaner.id);
        let touristMinutes = 0;
        
        for (const task of cleanerTasks) {
          if (task.duracion) {
            touristMinutes += task.duracion;
          } else if (task.start_time && task.end_time) {
            const startMins = parseTimeToMinutes(task.start_time);
            const endMins = parseTimeToMinutes(task.end_time);
            touristMinutes += Math.max(0, endMins - startMins);
          }
        }
        const touristHours = touristMinutes / 60;

        // Calculate maintenance hours
        const cleanerMaintenance = maintenanceCleanings.filter(m => m.cleanerId === cleaner.id);
        const maintenanceHours = calculateMaintenanceHoursForPeriod(cleanerMaintenance, start, end);

        // Calculate recurring task hours (not yet generated)
        const cleanerRecurring = recurringTasks.filter(rt => rt.cleaner_id === cleaner.id);
        const { hours: recurringHours, count: recurringTaskCount } = calculateRecurringHoursForPeriod(
          cleanerRecurring, executedSet, start, end
        );

        // Calculate adjustment hours
        const cleanerAdjustments = adjustments.filter(a => a.cleanerId === cleaner.id);
        const adjustmentHours = cleanerAdjustments.reduce((sum, adj) => sum + adj.hours, 0);

        // Calculate totals
        const totalWorked = touristHours + maintenanceHours + recurringHours + adjustmentHours;
        const remainingHours = Math.max(0, contractHoursForPeriod - totalWorked);
        const overtimeHours = Math.max(0, totalWorked - contractHoursForPeriod);
        const percentageComplete = contractHoursForPeriod > 0 
          ? (totalWorked / contractHoursForPeriod) * 100 
          : 0;

        return {
          cleanerId: cleaner.id,
          cleanerName: cleaner.name,
          contractHoursPerWeek,
          touristHours,
          touristTaskCount: cleanerTasks.length,
          maintenanceHours,
          recurringHours,
          recurringTaskCount,
          adjustmentHours,
          adjustments: cleanerAdjustments,
          totalWorked,
          remainingHours,
          overtimeHours,
          status: determineStatus(percentageComplete),
          percentageComplete,
        };
      });

      return summaries;
    },
    enabled: !!startDate && !!endDate && cleaners.length > 0 && !contractsLoading,
    staleTime: 30000, // 30 seconds
  });
};

// Hook for current week workload
export const useCurrentWeekWorkload = (cleanerId?: string) => {
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  
  return useWorkloadCalculation({ startDate: weekStart, endDate: weekEnd, cleanerId });
};

// Hook for current month workload
export const useCurrentMonthWorkload = (cleanerId?: string) => {
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
  
  return useWorkloadCalculation({ startDate: monthStart, endDate: monthEnd, cleanerId });
};
