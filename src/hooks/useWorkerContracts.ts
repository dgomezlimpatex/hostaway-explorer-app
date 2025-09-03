import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workerContractsStorage, CreateWorkerContractData, UpdateWorkerContractData } from '@/services/storage/workerContractsStorage';
import { toast } from '@/hooks/use-toast';

export const useWorkerContracts = () => {
  return useQuery({
    queryKey: ['worker-contracts'],
    queryFn: () => workerContractsStorage.getAll(),
  });
};

export const useWorkerContract = (cleanerId: string) => {
  return useQuery({
    queryKey: ['worker-contract', cleanerId],
    queryFn: () => workerContractsStorage.getByCleanerId(cleanerId),
    enabled: !!cleanerId,
  });
};

export const useActiveContracts = () => {
  return useQuery({
    queryKey: ['active-contracts'],
    queryFn: () => workerContractsStorage.getActiveContracts(),
  });
};

export const useCreateWorkerContract = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contractData: CreateWorkerContractData) => workerContractsStorage.create(contractData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['active-contracts'] });
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
      queryClient.invalidateQueries({ queryKey: ['worker-contract', data.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['active-contracts'] });
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

export const useDeactivateContract = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workerContractsStorage.deactivateContract(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['active-contracts'] });
      toast({
        title: "Contrato desactivado",
        description: "El contrato ha sido desactivado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Deactivate contract error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al desactivar el contrato.",
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
      queryClient.invalidateQueries({ queryKey: ['active-contracts'] });
      toast({
        title: "Contrato eliminado",
        description: "El contrato ha sido eliminado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Delete contract error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al eliminar el contrato.",
        variant: "destructive",
      });
    },
  });
};