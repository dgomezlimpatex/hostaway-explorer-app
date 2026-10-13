import { useQuery } from '@tanstack/react-query';
import { useSede } from '@/contexts/SedeContext';
import { useStockLevels, useStockProducts, useStockSedeSettings, useStockWarehouses } from '@/hooks/useStock';
import { formatMadridDate } from '@/utils/date';
import { addInventoryDays, centralWarehouse, pendingDemand, buildingInventory } from './inventoryDomain';
import { readInventoryBags } from './inventoryReadiness';
import { readCycleStock } from '@/services/laundryCycleService';
import { useAuth } from '@/hooks/useAuth';

export function useInventoryWorkspace(days = 3) {
  const { activeSede } = useSede();
  const { user } = useAuth();
  const warehousesQuery = useStockWarehouses();
  const levelsQuery = useStockLevels();
  const productsQuery = useStockProducts();
  const settingsQuery = useStockSedeSettings();
  const warehouses = warehousesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const central = centralWarehouse(warehouses);
  const from = formatMadridDate(new Date());
  const to = addInventoryDays(from, days - 1);
  const cycleQuery = useQuery({
    queryKey: ['laundry-cycle-stock', activeSede?.id, user?.id, from, to],
    queryFn: () => readCycleStock(activeSede!.id, from, to), enabled: !!activeSede?.id,
    staleTime: 30000, refetchInterval: 60000, retry: 1,
  });
  const cycle = cycleQuery.data;
  const cycleLevels = new Map((cycle?.levels ?? []).map(level => [`${level.warehouseId}:${level.productId}`, level]));
  const levels = (levelsQuery.data ?? []).map(level => {
    const live = cycleLevels.get(`${level.warehouse_id}:${level.product_id}`);
    return live ? { ...level, current_quantity: live.quantity, reserved_quantity: live.reserved } : level;
  });
  const bagsQuery = useQuery({
    queryKey: ['inventory-preparation', activeSede?.id, from, to, productsQuery.dataUpdatedAt, warehousesQuery.dataUpdatedAt],
    queryFn: () => readInventoryBags(activeSede!.id, from, to, products, warehouses),
    enabled: !!activeSede?.id && productsQuery.isSuccess && warehousesQuery.isSuccess,
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 1,
  });
  const cycleTasks = new Map((cycle?.tasks ?? []).map(task => [task.taskId, task]));
  const bags = (bagsQuery.data ?? []).map(bag => {
    const live = cycleTasks.get(bag.taskId);
    if (!live) return bag;
    const nonTextiles = bag.lines.filter(line => products.find(p => p.id === line.productId)?.category?.kind !== 'laundry');
    return { ...bag, state: live.state, lines: [...nonTextiles, ...live.lines.map(line => ({...line, name: products.find(p => p.id === line.productId)?.name ?? 'Ropa'}))] };
  });
  const stockError = warehousesQuery.isError || levelsQuery.isError || productsQuery.isError || cycleQuery.isError;
  const stockLoading = !activeSede || warehousesQuery.isLoading || levelsQuery.isLoading || productsQuery.isLoading || cycleQuery.isLoading;
  const demandReady = !stockLoading && !stockError && bagsQuery.isSuccess && !bagsQuery.isError;
  return { central, warehouses, levels, products, bags, from, to, stockError, stockLoading, demandReady,
    demandError: bagsQuery.isError, demand: demandReady ? pendingDemand(bags) : new Map<string, number>(),
    buildings: buildingInventory(warehouses, levels, demandReady ? bags : [], central?.id),
    centralLevels: central ? levels.filter(l => l.warehouse_id === central.id) : [],
    settings: settingsQuery.data, settingsError: settingsQuery.isError,
    cycleActive: cycle?.active ?? false,
    updatedAt: levelsQuery.dataUpdatedAt,
    refresh: () => Promise.all([warehousesQuery.refetch(), levelsQuery.refetch(), productsQuery.refetch(), settingsQuery.refetch(), bagsQuery.refetch(), cycleQuery.refetch()]),
  };
}
