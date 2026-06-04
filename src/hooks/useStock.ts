import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSede } from '@/contexts/SedeContext';
import { stockStorage } from '@/services/storage/stockStorage';
import type {
  CreateStockCategoryData,
  CreateStockProductData,
  CreateStockWarehouseData,
  StockAdjustmentData,
  StockCategory,
  StockItemKind,
  StockProduct,
  SaveStockPropertyConsumptionRuleData,
  StockTransferData,
  StockWarehouse,
  UpdateStockCategoryData,
  UpdateStockProductData,
} from '@/types/stock';

const selectedWarehouseKey = (sedeId?: string) => `stock:selectedWarehouse:${sedeId || 'none'}`;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
};

export const useStockWarehouses = () => {
  const { activeSede } = useSede();

  return useQuery({
    queryKey: ['stock-warehouses', activeSede?.id],
    queryFn: () => stockStorage.getWarehouses(activeSede!.id),
    enabled: !!activeSede?.id,
  });
};

export const useSelectedStockWarehouse = () => {
  const { activeSede } = useSede();
  const { data: warehouses = [] } = useStockWarehouses();
  const [selectedWarehouseId, setSelectedWarehouseIdState] = useState<string>('all');

  useEffect(() => {
    if (!activeSede?.id) return;
    const stored = localStorage.getItem(selectedWarehouseKey(activeSede.id));
    setSelectedWarehouseIdState(stored || 'all');
  }, [activeSede?.id]);

  const setSelectedWarehouseId = (warehouseId: string) => {
    setSelectedWarehouseIdState(warehouseId);
    if (activeSede?.id) {
      localStorage.setItem(selectedWarehouseKey(activeSede.id), warehouseId);
    }
  };

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) || null,
    [warehouses, selectedWarehouseId]
  );

  return {
    warehouses,
    selectedWarehouse,
    selectedWarehouseId,
    queryWarehouseId: selectedWarehouseId === 'all' ? undefined : selectedWarehouseId,
    setSelectedWarehouseId,
  };
};

export const useStockCategories = (kind?: StockItemKind) => {
  return useQuery({
    queryKey: ['stock-categories', kind],
    queryFn: () => stockStorage.getCategories(kind),
  });
};

export const useStockProducts = (kind?: StockItemKind) => {
  const { activeSede } = useSede();

  return useQuery({
    queryKey: ['stock-products', activeSede?.id, kind],
    queryFn: () => stockStorage.getProducts(activeSede!.id, kind),
    enabled: !!activeSede?.id,
  });
};

export const useStockLevels = (warehouseId?: string, kind?: StockItemKind) => {
  const { activeSede } = useSede();

  return useQuery({
    queryKey: ['stock-levels', activeSede?.id, warehouseId || 'all', kind || 'all'],
    queryFn: () => stockStorage.getStockLevels({
      sedeId: activeSede!.id,
      warehouseId,
      kind,
    }),
    enabled: !!activeSede?.id,
  });
};

export const useStockMovements = (limit = 100) => {
  const { activeSede } = useSede();

  return useQuery({
    queryKey: ['stock-movements', activeSede?.id, limit],
    queryFn: () => stockStorage.getMovements(activeSede!.id, limit),
    enabled: !!activeSede?.id,
  });
};

export const usePropertyStockConsumptionRules = (propertyId?: string) => {
  return useQuery({
    queryKey: ['stock-property-consumption-rules', propertyId],
    queryFn: () => stockStorage.getPropertyConsumptionRules(propertyId!),
    enabled: !!propertyId,
  });
};

export const useStockDashboardStats = () => {
  const { queryWarehouseId, warehouses } = useSelectedStockWarehouse();
  const { data: levels = [], isLoading } = useStockLevels(queryWarehouseId);

  return {
    stats: stockStorage.getDashboardStats(levels, warehouses),
    levels,
    warehouses,
    isLoading,
  };
};

export const useCreateStockWarehouse = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: (data: Omit<CreateStockWarehouseData, 'sede_id'>) => {
      if (!activeSede?.id) throw new Error('No hay sede activa.');
      return stockStorage.createWarehouse({ ...data, sede_id: activeSede.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-warehouses', activeSede?.id] });
      toast.success('Almacen creado correctamente');
    },
    onError: (error) => {
      console.error('Error creating warehouse:', error);
      toast.error(getErrorMessage(error, 'No se pudo crear el almacen'));
    },
  });
};

export const useUpdateStockWarehouse = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<StockWarehouse> }) =>
      stockStorage.updateWarehouse(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-warehouses', activeSede?.id] });
      toast.success('Almacen actualizado');
    },
    onError: (error) => {
      console.error('Error updating warehouse:', error);
      toast.error(getErrorMessage(error, 'No se pudo actualizar el almacen'));
    },
  });
};

export const useDeleteStockWarehouse = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => stockStorage.deleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-warehouses', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements', activeSede?.id] });
      toast.success('Almacen eliminado');
    },
    onError: (error) => {
      console.error('Error deleting warehouse:', error);
      toast.error(getErrorMessage(error, 'No se pudo eliminar el almacen'));
    },
  });
};

export const useCreateStockProduct = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: (data: Omit<CreateStockProductData, 'sede_id'>) => {
      if (!activeSede?.id) throw new Error('No hay sede activa.');
      return stockStorage.createProduct({ ...data, sede_id: activeSede.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels', activeSede?.id] });
      toast.success('Producto creado correctamente');
    },
    onError: (error) => {
      console.error('Error creating product:', error);
      toast.error(getErrorMessage(error, 'No se pudo crear el producto'));
    },
  });
};

export const useUpdateStockProduct = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateStockProductData }) =>
      stockStorage.updateProduct(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels', activeSede?.id] });
      toast.success('Producto actualizado');
    },
    onError: (error) => {
      console.error('Error updating product:', error);
      toast.error(getErrorMessage(error, 'No se pudo actualizar el producto'));
    },
  });
};

export const useDeleteStockProduct = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => stockStorage.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels', activeSede?.id] });
      toast.success('Producto eliminado');
    },
    onError: (error) => {
      console.error('Error deleting product:', error);
      toast.error(getErrorMessage(error, 'No se pudo eliminar el producto'));
    },
  });
};

export const useSavePropertyStockConsumptionRules = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, rules }: { propertyId: string; rules: SaveStockPropertyConsumptionRuleData[] }) =>
      stockStorage.savePropertyConsumptionRules(propertyId, rules),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock-property-consumption-rules', variables.propertyId] });
      toast.success('Consumos de la propiedad actualizados');
    },
    onError: (error) => {
      console.error('Error saving property stock consumption rules:', error);
      toast.error(getErrorMessage(error, 'No se pudieron guardar los consumos de la propiedad'));
    },
  });
};

export const useCreateStockCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStockCategoryData) => stockStorage.createCategory(data),
    onSuccess: (category: StockCategory) => {
      queryClient.invalidateQueries({ queryKey: ['stock-categories'] });
      queryClient.invalidateQueries({ queryKey: ['stock-categories', category.kind] });
      toast.success('Tipo creado correctamente');
    },
    onError: (error) => {
      console.error('Error creating category:', error);
      toast.error(getErrorMessage(error, 'No se pudo crear el tipo'));
    },
  });
};

export const useUpdateStockCategory = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateStockCategoryData }) =>
      stockStorage.updateCategory(id, updates),
    onSuccess: (category: StockCategory) => {
      queryClient.invalidateQueries({ queryKey: ['stock-categories'] });
      queryClient.invalidateQueries({ queryKey: ['stock-categories', category.kind] });
      queryClient.invalidateQueries({ queryKey: ['stock-products', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels', activeSede?.id] });
      toast.success('Tipo actualizado');
    },
    onError: (error) => {
      console.error('Error updating category:', error);
      toast.error(getErrorMessage(error, 'No se pudo actualizar el tipo'));
    },
  });
};

export const useDeleteStockCategory = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: ({ id }: { id: string; kind: StockItemKind }) => stockStorage.deleteCategory(id),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock-categories'] });
      queryClient.invalidateQueries({ queryKey: ['stock-categories', variables.kind] });
      queryClient.invalidateQueries({ queryKey: ['stock-products', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels', activeSede?.id] });
      toast.success('Tipo eliminado');
    },
    onError: (error) => {
      console.error('Error deleting category:', error);
      toast.error(getErrorMessage(error, 'No se pudo eliminar el tipo'));
    },
  });
};

export const useAdjustStock = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: (data: StockAdjustmentData) => stockStorage.adjustStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-levels', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements', activeSede?.id] });
      toast.success('Stock actualizado');
    },
    onError: (error) => {
      console.error('Error adjusting stock:', error);
      toast.error(getErrorMessage(error, 'No se pudo actualizar el stock'));
    },
  });
};

export const useTransferStock = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: (data: StockTransferData) => stockStorage.transferStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-levels', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements', activeSede?.id] });
      toast.success('Transferencia realizada');
    },
    onError: (error) => {
      console.error('Error transferring stock:', error);
      toast.error(getErrorMessage(error, 'No se pudo transferir el stock'));
    },
  });
};
