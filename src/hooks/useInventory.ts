import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { inventoryStorage } from '@/services/storage/inventoryStorage';
import { useSede } from '@/contexts/SedeContext';
import type {
  InventoryCategory,
  InventoryProduct,
  InventoryStockWithProduct,
  InventoryMovementWithDetails,
  InventoryAlert,
  CreateInventoryCategoryData,
  CreateInventoryProductData,
  CreateInventoryStockData,
  UpdateInventoryStockData,
  CreateInventoryMovementData,
  StockAdjustmentForm
} from '@/types/inventory';

const inventoryService = inventoryStorage;

// Categories
export const useInventoryCategories = () => {
  return useQuery({
    queryKey: ['inventory-categories'],
    queryFn: () => inventoryService.getCategories(),
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateInventoryCategoryData) => inventoryService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-categories'] });
      toast.success('Categoría creada exitosamente');
    },
    onError: (error) => {
      console.error('Error creating category:', error);
      toast.error('Error al crear la categoría');
    },
  });
};

// Products
export const useInventoryProducts = () => {
  const { activeSede } = useSede();
  
  return useQuery({
    queryKey: ['inventory-products', activeSede?.id],
    queryFn: () => inventoryService.getProducts(),
    enabled: !!activeSede?.id,
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();
  
  return useMutation({
    mutationFn: (data: CreateInventoryProductData) => inventoryService.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-products', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock', activeSede?.id] });
      toast.success('Producto creado exitosamente');
    },
    onError: (error) => {
      console.error('Error creating product:', error);
      toast.error('Error al crear el producto');
    },
  });
};

// Stock
export const useInventoryStock = () => {
  const { activeSede } = useSede();
  
  return useQuery({
    queryKey: ['inventory-stock', activeSede?.id],
    queryFn: () => inventoryService.getStockWithProducts(),
    enabled: !!activeSede?.id,
  });
};

export const useCreateStock = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();
  
  return useMutation({
    mutationFn: (data: CreateInventoryStockData & { updated_by: string }) => 
      inventoryService.createStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-stock', activeSede?.id] });
      toast.success('Stock creado exitosamente');
    },
    onError: (error) => {
      console.error('Error creating stock:', error);
      toast.error('Error al crear el stock');
    },
  });
};

export const useUpdateStock = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();
  
  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: UpdateInventoryStockData & { updated_by: string } }) => 
      inventoryService.updateStock(productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-stock', activeSede?.id] });
      toast.success('Stock actualizado exitosamente');
    },
    onError: (error) => {
      console.error('Error updating stock:', error);
      toast.error('Error al actualizar el stock');
    },
  });
};

// Movements
export const useInventoryMovements = (limit?: number) => {
  const { activeSede } = useSede();
  
  return useQuery({
    queryKey: ['inventory-movements', limit, activeSede?.id],
    queryFn: () => inventoryService.getMovements(limit),
    enabled: !!activeSede?.id,
  });
};

export const useCreateMovement = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();
  
  return useMutation({
    mutationFn: (data: CreateInventoryMovementData & { previous_quantity: number; new_quantity: number; created_by: string }) => 
      inventoryService.createMovement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements', undefined, activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock', activeSede?.id] });
      toast.success('Movimiento registrado exitosamente');
    },
    onError: (error) => {
      console.error('Error creating movement:', error);
      toast.error('Error al registrar el movimiento');
    },
  });
};

// Alerts
export const useInventoryAlerts = () => {
  const { activeSede } = useSede();
  
  return useQuery({
    queryKey: ['inventory-alerts', activeSede?.id],
    queryFn: () => inventoryService.getActiveAlerts(),
    enabled: !!activeSede?.id,
  });
};

// Stock adjustment helper
export const useStockAdjustment = () => {
  const updateStock = useUpdateStock();
  const createMovement = useCreateMovement();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ adjustment, userId, currentStock }: {
      adjustment: StockAdjustmentForm;
      userId: string;
      currentStock: InventoryStockWithProduct;
    }) => {
      const previousQuantity = currentStock.current_quantity;
      let newQuantity: number;

      switch (adjustment.adjustment_type) {
        case 'entrada':
          newQuantity = previousQuantity + adjustment.quantity;
          break;
        case 'salida':
          newQuantity = Math.max(0, previousQuantity - adjustment.quantity);
          break;
        case 'ajuste':
          newQuantity = adjustment.quantity;
          break;
        default:
          throw new Error('Tipo de ajuste no válido');
      }

      // Update stock
      await updateStock.mutateAsync({
        productId: adjustment.product_id,
        data: {
          current_quantity: newQuantity,
          updated_by: userId,
          ...(adjustment.cost_per_unit && { cost_per_unit: adjustment.cost_per_unit })
        }
      });

      // Create movement record
      await createMovement.mutateAsync({
        product_id: adjustment.product_id,
        movement_type: adjustment.adjustment_type,
        quantity: adjustment.quantity,
        reason: adjustment.reason,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        created_by: userId
      });
    },
    onSuccess: () => {
      const { activeSede } = useSede();
      queryClient.invalidateQueries({ queryKey: ['inventory-stock', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements', undefined, activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts', activeSede?.id] });
      toast.success('Ajuste de stock realizado exitosamente');
    },
    onError: (error) => {
      console.error('Error adjusting stock:', error);
      toast.error('Error al realizar el ajuste de stock');
    },
  });
};

// Dashboard stats
export const useInventoryDashboardStats = () => {
  const { activeSede } = useSede();
  
  return useQuery({
    queryKey: ['inventory-dashboard-stats', activeSede?.id],
    queryFn: () => inventoryService.getDashboardStats(),
    enabled: !!activeSede?.id,
  });
};