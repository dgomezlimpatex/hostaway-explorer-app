import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { validDaySchedules } from '@/utils/weeklyScheduleDays';
import { 
  WorkerMaintenanceCleaning, 
  CreateWorkerMaintenanceCleaningInput,
  UpdateWorkerMaintenanceCleaningInput 
} from '@/types/workerAbsence';
import { toast } from 'sonner';

// Map database row to TypeScript type
const mapMaintenanceCleaningFromDB = (row: any): WorkerMaintenanceCleaning => ({
  scheduleType: row.schedule_type || 'maintenance',
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

// Fetch maintenance cleanings for a specific cleaner
export const useWorkerMaintenanceCleanings = (cleanerId: string) => {
  return useQuery({
    queryKey: ['worker-maintenance-cleanings', cleanerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_maintenance_cleanings')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapMaintenanceCleaningFromDB);
    },
    enabled: !!cleanerId,
  });
};

// Fetch all active maintenance cleanings (for calendar)
export const useAllWorkerMaintenanceCleanings = () => {
  return useQuery({
    queryKey: ['all-worker-maintenance-cleanings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_maintenance_cleanings')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return (data || []).map(mapMaintenanceCleaningFromDB);
    },
  });
};

// Create maintenance cleaning
export const useCreateWorkerMaintenanceCleaning = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWorkerMaintenanceCleaningInput) => {
      const { data, error } = await supabase
        .from('worker_maintenance_cleanings')
        .insert({
          cleaner_id: input.cleanerId,
          days_of_week: input.daysOfWeek,
          start_time: input.startTime,
          end_time: input.endTime,
          location_name: input.locationName,
          notes: input.notes || null,
          ...{ schedule_type: input.scheduleType || 'maintenance' },
        } as TablesInsert<'worker_maintenance_cleanings'>)
        .select()
        .single();

      if (error) throw error;
      return mapMaintenanceCleaningFromDB(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-maintenance-cleanings', variables.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-maintenance-cleanings'] });
      for (const key of ['workload', 'workers-absence-status', 'cleaning-planning-worker-maintenance-cleanings', 'planning-weekly-workload', 'operational-planning']) queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(variables.scheduleType === 'unavailability' ? 'Disponibilidad guardada' : 'Limpieza de mantenimiento creada');
    },
    onError: (error: Error) => {
      console.error('Error creating maintenance cleaning:', error);
      toast.error('Error al crear la limpieza de mantenimiento');
    },
  });
};

// Update maintenance cleaning
export const useSaveIndividualAvailability = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      cleanerId: string;
      locationName: string;
      notes: string | null;
      schedules: { daysOfWeek: number[]; startTime: string; endTime: string }[];
    }) => {
      if (!validDaySchedules(input.schedules)) throw new Error('Revisa las horas de cada día');
      const entries = input.schedules.map(row => ({
        days_of_week: row.daysOfWeek, start_time: row.startTime, end_time: row.endTime,
        location_name: input.locationName, notes: input.notes,
      }));
      if (input.id) {
        // Additive RPC migration; keep the generated schema file untouched.
        const { error } = await supabase.rpc('replace_worker_schedule_days' as never,
          { p_id: input.id, p_entries: entries } as never);
        if (error) throw error;
      } else {
        // A single insert is atomic: all selected days are saved, or none.
        const rows: TablesInsert<'worker_maintenance_cleanings'>[] = entries.map(entry => ({
          ...entry, cleaner_id: input.cleanerId, schedule_type: 'unavailability',
        }));
        const { error } = await supabase.from('worker_maintenance_cleanings').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['worker-maintenance-cleanings', input.cleanerId] });
      for (const key of ['all-worker-maintenance-cleanings', 'workload', 'workers-absence-status', 'cleaning-planning-worker-maintenance-cleanings', 'planning-weekly-workload', 'operational-planning', 'worker-absence-audit-log']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success('Horarios por día guardados');
    },
    onError: (error: Error) => toast.error(error.message.includes('PLANNING_MAINTENANCE_CONFLICT')
      ? 'Hay tareas asignadas que coinciden con estos horarios. Revisa los solapamientos.'
      : 'No se han guardado los horarios. Revisa las franjas e inténtalo de nuevo.'),
  });
};

// Update maintenance cleaning
export const useUpdateWorkerMaintenanceCleaning = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateWorkerMaintenanceCleaningInput) => {
      const updateData: any = {};
      
      if (input.daysOfWeek !== undefined) updateData.days_of_week = input.daysOfWeek;
      if (input.startTime !== undefined) updateData.start_time = input.startTime;
      if (input.endTime !== undefined) updateData.end_time = input.endTime;
      if (input.locationName !== undefined) updateData.location_name = input.locationName;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      if (input.scheduleType !== undefined) updateData.schedule_type = input.scheduleType;

      const { data, error } = await supabase
        .from('worker_maintenance_cleanings')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return mapMaintenanceCleaningFromDB(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['worker-maintenance-cleanings', data.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-maintenance-cleanings'] });
      for (const key of ['workload', 'workers-absence-status', 'cleaning-planning-worker-maintenance-cleanings', 'planning-weekly-workload', 'operational-planning']) queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(data.scheduleType === 'unavailability' ? 'Disponibilidad actualizada' : 'Limpieza de mantenimiento actualizada');
    },
    onError: (error: Error) => {
      console.error('Error updating maintenance cleaning:', error);
      toast.error('Error al actualizar la limpieza de mantenimiento');
    },
  });
};

// Delete maintenance cleaning
export const useDeleteWorkerMaintenanceCleaning = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cleanerId }: { id: string; cleanerId: string }) => {
      const { error } = await supabase
        .from('worker_maintenance_cleanings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, cleanerId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-maintenance-cleanings', variables.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-maintenance-cleanings'] });
      for (const key of ['workload', 'workers-absence-status', 'cleaning-planning-worker-maintenance-cleanings', 'planning-weekly-workload', 'operational-planning']) queryClient.invalidateQueries({ queryKey: [key] });
      toast.success('Franja eliminada');
    },
    onError: (error: Error) => {
      console.error('Error deleting maintenance cleaning:', error);
      toast.error('Error al eliminar la limpieza de mantenimiento');
    },
  });
};
