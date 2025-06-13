
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cleaner } from '@/types/calendar';
import { cleanerStorage, CreateCleanerData } from '@/services/cleanerStorage';
import { toast } from '@/hooks/use-toast';

export const useCleaners = () => {
  const { data: cleaners = [], isLoading } = useQuery({
    queryKey: ['cleaners'],
    queryFn: () => cleanerStorage.getAll(),
  });

  return {
    cleaners,
    isLoading
  };
};

export const useCleaner = (id: string) => {
  return useQuery({
    queryKey: ['cleaner', id],
    queryFn: () => cleanerStorage.getById(id),
    enabled: !!id,
  });
};

export const useCreateCleaner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cleanerData: CreateCleanerData) => {
      return await cleanerStorage.create(cleanerData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaners'] });
      toast({
        title: "Trabajador creado",
        description: "El trabajador ha sido creado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Create cleaner error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear el trabajador.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateCleaner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateCleanerData> }) => {
      const result = await cleanerStorage.update(id, updates);
      if (!result) throw new Error('Trabajador no encontrado');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaners'] });
      queryClient.invalidateQueries({ queryKey: ['cleaner'] });
      toast({
        title: "Trabajador actualizado",
        description: "Los datos del trabajador han sido actualizados.",
      });
    },
    onError: (error) => {
      console.error('Update cleaner error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar el trabajador.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateCleanersOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cleaners: { id: string; sortOrder: number }[]) => {
      return await cleanerStorage.updateOrder(cleaners);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaners'] });
      toast({
        title: "Orden actualizado",
        description: "El orden de los trabajadores ha sido actualizado.",
      });
    },
    onError: (error) => {
      console.error('Update cleaners order error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar el orden.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteCleaner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const success = await cleanerStorage.delete(id);
      if (!success) throw new Error('Trabajador no encontrado');
      return success;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaners'] });
      toast({
        title: "Trabajador eliminado",
        description: "El trabajador ha sido eliminado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Delete cleaner error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al eliminar el trabajador.",
        variant: "destructive",
      });
    },
  });
};
