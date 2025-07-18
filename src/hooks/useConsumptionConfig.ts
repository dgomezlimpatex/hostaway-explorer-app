import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryStorage } from '@/services/storage/inventoryStorage';
import { CreatePropertyConsumptionConfigData, PropertyConsumptionConfig } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';

export function useConsumptionConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const inventoryService = inventoryStorage;

  const {
    data: consumptionConfigs,
    isLoading,
    error
  } = useQuery({
    queryKey: ['consumption-config'],
    queryFn: () => inventoryService.getConsumptionConfig(),
  });

  const createConfigMutation = useMutation({
    mutationFn: (data: CreatePropertyConsumptionConfigData) => 
      inventoryService.createConsumptionConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumption-config'] });
      toast({
        title: "Configuración creada",
        description: "La configuración de consumo ha sido creada correctamente."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo crear la configuración de consumo.",
        variant: "destructive"
      });
    }
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PropertyConsumptionConfig> }) =>
      inventoryService.updateConsumptionConfig(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumption-config'] });
      toast({
        title: "Configuración actualizada",
        description: "La configuración de consumo ha sido actualizada correctamente."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración de consumo.",
        variant: "destructive"
      });
    }
  });

  return {
    consumptionConfigs,
    isLoading,
    error,
    createConfig: createConfigMutation.mutate,
    updateConfig: updateConfigMutation.mutate,
    isCreating: createConfigMutation.isPending,
    isUpdating: updateConfigMutation.isPending
  };
}