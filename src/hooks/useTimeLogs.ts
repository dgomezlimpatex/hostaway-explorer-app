import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeLogsStorage, CreateTimeLogData, UpdateTimeLogData } from '@/services/storage/timeLogsStorage';
import { toast } from '@/hooks/use-toast';

export const useTimeLogs = (cleanerId?: string, startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ['time-logs', cleanerId, startDate, endDate],
    queryFn: () => {
      if (cleanerId && startDate && endDate) {
        return timeLogsStorage.getByCleanerAndDateRange(cleanerId, startDate, endDate);
      } else if (startDate && endDate) {
        return timeLogsStorage.getByDateRange(startDate, endDate);
      }
      return [];
    },
    enabled: !!(startDate && endDate),
  });
};

export const useCreateTimeLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (timeLogData: CreateTimeLogData) => timeLogsStorage.create(timeLogData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      toast({
        title: "Registro creado",
        description: "El registro de tiempo ha sido creado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Create time log error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear el registro de tiempo.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateTimeLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateTimeLogData }) => 
      timeLogsStorage.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      toast({
        title: "Registro actualizado",
        description: "El registro de tiempo ha sido actualizado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Update time log error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar el registro de tiempo.",
        variant: "destructive",
      });
    },
  });
};

export const useApproveTimeLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: string; approvedBy: string }) => 
      timeLogsStorage.approve(id, approvedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      toast({
        title: "Registro aprobado",
        description: "El registro de tiempo ha sido aprobado.",
      });
    },
    onError: (error) => {
      console.error('Approve time log error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al aprobar el registro.",
        variant: "destructive",
      });
    },
  });
};

export const useRejectTimeLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: string; approvedBy: string }) => 
      timeLogsStorage.reject(id, approvedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      toast({
        title: "Registro rechazado",
        description: "El registro de tiempo ha sido rechazado.",
      });
    },
    onError: (error) => {
      console.error('Reject time log error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al rechazar el registro.",
        variant: "destructive",
      });
    },
  });
};

export const useWeeklyHours = (cleanerId: string, weekStart: string) => {
  return useQuery({
    queryKey: ['weekly-hours', cleanerId, weekStart],
    queryFn: () => timeLogsStorage.getWeeklyHours(cleanerId, weekStart),
    enabled: !!(cleanerId && weekStart),
  });
};