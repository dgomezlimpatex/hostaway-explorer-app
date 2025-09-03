import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vacationRequestsStorage, CreateVacationRequestData, UpdateVacationRequestData } from '@/services/storage/vacationRequestsStorage';
import { toast } from '@/hooks/use-toast';

export const useVacationRequests = () => {
  return useQuery({
    queryKey: ['vacation-requests'],
    queryFn: () => vacationRequestsStorage.getAll(),
  });
};

export const useCleanerVacationRequests = (cleanerId: string) => {
  return useQuery({
    queryKey: ['vacation-requests', cleanerId],
    queryFn: () => vacationRequestsStorage.getByCleanerId(cleanerId),
    enabled: !!cleanerId,
  });
};

export const usePendingVacationRequests = () => {
  return useQuery({
    queryKey: ['vacation-requests', 'pending'],
    queryFn: () => vacationRequestsStorage.getPendingRequests(),
  });
};

export const useUpcomingVacations = () => {
  return useQuery({
    queryKey: ['vacation-requests', 'upcoming'],
    queryFn: () => vacationRequestsStorage.getUpcomingVacations(),
  });
};

export const useVacationRequestsByStatus = (status: 'pending' | 'approved' | 'rejected') => {
  return useQuery({
    queryKey: ['vacation-requests', 'status', status],
    queryFn: () => vacationRequestsStorage.getByStatus(status),
  });
};

export const useVacationRequestsByDateRange = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['vacation-requests', 'date-range', startDate, endDate],
    queryFn: () => vacationRequestsStorage.getByDateRange(startDate, endDate),
    enabled: !!(startDate && endDate),
  });
};

export const useCreateVacationRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestData: CreateVacationRequestData) => vacationRequestsStorage.create(requestData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-requests', data.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['vacation-requests', 'pending'] });
      toast({
        title: "Solicitud creada",
        description: "La solicitud de vacaciones ha sido creada exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Create vacation request error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear la solicitud de vacaciones.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateVacationRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateVacationRequestData }) => 
      vacationRequestsStorage.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-requests', data.cleanerId] });
      toast({
        title: "Solicitud actualizada",
        description: "La solicitud de vacaciones ha sido actualizada exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Update vacation request error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar la solicitud.",
        variant: "destructive",
      });
    },
  });
};

export const useApproveVacationRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reviewedBy, reviewNotes }: { id: string; reviewedBy: string; reviewNotes?: string }) => 
      vacationRequestsStorage.approve(id, reviewedBy, reviewNotes),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-requests', data.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['vacation-requests', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-requests', 'upcoming'] });
      toast({
        title: "Solicitud aprobada",
        description: "La solicitud de vacaciones ha sido aprobada.",
      });
    },
    onError: (error) => {
      console.error('Approve vacation request error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al aprobar la solicitud.",
        variant: "destructive",
      });
    },
  });
};

export const useRejectVacationRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reviewedBy, reviewNotes }: { id: string; reviewedBy: string; reviewNotes?: string }) => 
      vacationRequestsStorage.reject(id, reviewedBy, reviewNotes),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-requests', data.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['vacation-requests', 'pending'] });
      toast({
        title: "Solicitud rechazada",
        description: "La solicitud de vacaciones ha sido rechazada.",
      });
    },
    onError: (error) => {
      console.error('Reject vacation request error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al rechazar la solicitud.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteVacationRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => vacationRequestsStorage.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      toast({
        title: "Solicitud eliminada",
        description: "La solicitud de vacaciones ha sido eliminada exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Delete vacation request error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al eliminar la solicitud.",
        variant: "destructive",
      });
    },
  });
};