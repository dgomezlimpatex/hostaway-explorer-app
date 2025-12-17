import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  WorkerAbsence, 
  CreateWorkerAbsenceInput, 
  UpdateWorkerAbsenceInput 
} from '@/types/workerAbsence';
import { toast } from 'sonner';

// Map database row to TypeScript type
const mapAbsenceFromDB = (row: any): WorkerAbsence => ({
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

// Fetch absences for a specific cleaner
export const useWorkerAbsences = (cleanerId: string, startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ['worker-absences', cleanerId, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('worker_absences')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .order('start_date', { ascending: false });

      if (startDate) {
        query = query.gte('end_date', startDate);
      }
      if (endDate) {
        query = query.lte('start_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapAbsenceFromDB);
    },
    enabled: !!cleanerId,
  });
};

// Fetch all absences for a date (all workers)
export const useAllWorkerAbsencesForDate = (date: string) => {
  return useQuery({
    queryKey: ['all-worker-absences', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_absences')
        .select('*')
        .lte('start_date', date)
        .gte('end_date', date);

      if (error) throw error;
      return (data || []).map(mapAbsenceFromDB);
    },
    enabled: !!date,
  });
};

// Create absence
export const useCreateWorkerAbsence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWorkerAbsenceInput) => {
      const { data, error } = await supabase
        .from('worker_absences')
        .insert({
          cleaner_id: input.cleanerId,
          start_date: input.startDate,
          end_date: input.endDate,
          start_time: input.startTime || null,
          end_time: input.endTime || null,
          absence_type: input.absenceType,
          location_name: input.locationName || null,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return mapAbsenceFromDB(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-absences', variables.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-absences'] });
      toast.success('Ausencia creada correctamente');
    },
    onError: (error: Error) => {
      console.error('Error creating absence:', error);
      toast.error('Error al crear la ausencia');
    },
  });
};

// Update absence
export const useUpdateWorkerAbsence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateWorkerAbsenceInput) => {
      const updateData: any = {};
      
      if (input.startDate !== undefined) updateData.start_date = input.startDate;
      if (input.endDate !== undefined) updateData.end_date = input.endDate;
      if (input.startTime !== undefined) updateData.start_time = input.startTime;
      if (input.endTime !== undefined) updateData.end_time = input.endTime;
      if (input.absenceType !== undefined) updateData.absence_type = input.absenceType;
      if (input.locationName !== undefined) updateData.location_name = input.locationName;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const { data, error } = await supabase
        .from('worker_absences')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return mapAbsenceFromDB(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['worker-absences', data.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-absences'] });
      toast.success('Ausencia actualizada correctamente');
    },
    onError: (error: Error) => {
      console.error('Error updating absence:', error);
      toast.error('Error al actualizar la ausencia');
    },
  });
};

// Delete absence
export const useDeleteWorkerAbsence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cleanerId }: { id: string; cleanerId: string }) => {
      const { error } = await supabase
        .from('worker_absences')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, cleanerId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-absences', variables.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-absences'] });
      toast.success('Ausencia eliminada correctamente');
    },
    onError: (error: Error) => {
      console.error('Error deleting absence:', error);
      toast.error('Error al eliminar la ausencia');
    },
  });
};
