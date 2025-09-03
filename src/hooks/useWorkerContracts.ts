import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workerContractsStorage, CreateWorkerContractData, UpdateWorkerContractData } from '@/services/storage/workerContractsStorage';
import { toast } from '@/hooks/use-toast';

export const useWorkerContracts = () => {
  return useQuery({
    queryKey: ['worker-contracts'],
    queryFn: () => workerContractsStorage.getAll(),
  });
};

export const useCleanerContracts = (cleanerId: string) => {
  return useQuery({
    queryKey: ['worker-contracts', cleanerId],
    queryFn: () => workerContractsStorage.getByCleanerId(cleanerId),
    enabled: !!cleanerId,
  });
};

export const useActiveContracts = () => {
  return useQuery({
    queryKey: ['worker-contracts', 'active'],
    queryFn: () => workerContractsStorage.getActiveContracts(),
  });
};

export const useContractsByStatus = (status: 'draft' | 'active' | 'expired' | 'terminated') => {
  return useQuery({
    queryKey: ['worker-contracts', 'status', status],
    queryFn: () => workerContractsStorage.getByStatus(status),
  });
};

export const useCreateWorkerContract = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contractData: CreateWorkerContractData) => workerContractsStorage.create(contractData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['worker-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['worker-contracts', data.cleaner_id] });
      toast({
        title: "Contrato creado",
        description: "El contrato ha sido creado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Create worker contract error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear el contrato.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateWorkerContract = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateWorkerContractData }) => 
      workerContractsStorage.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['worker-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['worker-contracts', data.cleaner_id] });
      toast({
        title: "Contrato actualizado",
        description: "El contrato ha sido actualizado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Update worker contract error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar el contrato.",
        variant: "destructive",
      });
    },
  });
};

export const useActivateWorkerContract = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, activatedBy }: { id: string; activatedBy: string }) => 
      workerContractsStorage.activate(id, activatedBy),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['worker-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['worker-contracts', data.cleaner_id] });
      queryClient.invalidateQueries({ queryKey: ['worker-contracts', 'active'] });
      toast({
        title: "Contrato activado",
        description: "El contrato ha sido activado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Activate worker contract error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al activar el contrato.",
        variant: "destructive",
      });
    },
  });
};

export const useTerminateWorkerContract = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, terminatedBy, notes }: { id: string; terminatedBy: string; notes?: string }) => 
      workerContractsStorage.terminate(id, terminatedBy, notes),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['worker-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['worker-contracts', data.cleaner_id] });
      queryClient.invalidateQueries({ queryKey: ['worker-contracts', 'active'] });
      toast({
        title: "Contrato terminado",
        description: "El contrato ha sido terminado.",
      });
    },
    onError: (error) => {
      console.error('Terminate worker contract error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al terminar el contrato.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteWorkerContract = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workerContractsStorage.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-contracts'] });
      toast({
        title: "Contrato eliminado",
        description: "El contrato ha sido eliminado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Delete worker contract error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al eliminar el contrato.",
        variant: "destructive",
      });
    },
  });
};