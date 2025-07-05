import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workScheduleStorage, CreateWorkScheduleData, UpdateWorkScheduleData } from '@/services/storage/workScheduleStorage';
import { toast } from '@/hooks/use-toast';

export const useWorkSchedule = (cleanerId?: string, startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ['work-schedule', cleanerId, startDate, endDate],
    queryFn: () => {
      if (cleanerId && startDate && endDate) {
        return workScheduleStorage.getByCleanerAndDateRange(cleanerId, startDate, endDate);
      } else if (startDate && endDate) {
        return workScheduleStorage.getByDateRange(startDate, endDate);
      }
      return [];
    },
    enabled: !!(startDate && endDate),
  });
};

export const useCreateWorkSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleData: CreateWorkScheduleData) => workScheduleStorage.create(scheduleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-schedule'] });
      toast({
        title: "Horario creado",
        description: "El horario de trabajo ha sido creado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Create work schedule error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear el horario de trabajo.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateWorkSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateWorkScheduleData }) => 
      workScheduleStorage.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-schedule'] });
      toast({
        title: "Horario actualizado",
        description: "El horario de trabajo ha sido actualizado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Update work schedule error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar el horario de trabajo.",
        variant: "destructive",
      });
    },
  });
};

export const useCreateBulkWorkSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      cleanerId, 
      dates, 
      scheduleTemplate 
    }: { 
      cleanerId: string; 
      dates: string[]; 
      scheduleTemplate: Omit<CreateWorkScheduleData, 'cleanerId' | 'date'> 
    }) => workScheduleStorage.createBulkSchedule(cleanerId, dates, scheduleTemplate),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-schedule'] });
      toast({
        title: "Horarios creados",
        description: `Se han creado ${data.length} horarios de trabajo exitosamente.`,
      });
    },
    onError: (error) => {
      console.error('Create bulk work schedule error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear los horarios de trabajo.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteWorkSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workScheduleStorage.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-schedule'] });
      toast({
        title: "Horario eliminado",
        description: "El horario de trabajo ha sido eliminado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Delete work schedule error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al eliminar el horario de trabajo.",
        variant: "destructive",
      });
    },
  });
};