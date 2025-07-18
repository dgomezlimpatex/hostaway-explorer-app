import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryStorage } from '@/services/storage/inventoryStorage';
import { CreateInventoryMovementData } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export function useMovements() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const inventoryService = inventoryStorage;

  const {
    data: movements,
    isLoading,
    error
  } = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: () => inventoryService.getMovements(50),
  });

  const createMovementMutation = useMutation({
    mutationFn: async (data: CreateInventoryMovementData & { previous_quantity: number; new_quantity: number }) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      return inventoryService.createMovement({
        ...data,
        created_by: user.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      toast({
        title: "Movimiento registrado",
        description: "El movimiento de inventario ha sido registrado correctamente."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo registrar el movimiento de inventario.",
        variant: "destructive"
      });
    }
  });

  const getMovementsByProduct = (productId: string) => {
    return useQuery({
      queryKey: ['inventory-movements', productId],
      queryFn: () => inventoryService.getMovementsByProduct(productId, 20),
      enabled: !!productId,
    });
  };

  return {
    movements,
    isLoading,
    error,
    createMovement: createMovementMutation.mutate,
    isCreatingMovement: createMovementMutation.isPending,
    getMovementsByProduct
  };
}