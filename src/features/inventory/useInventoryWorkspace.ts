import { useQuery } from '@tanstack/react-query';
import { useSede } from '@/contexts/SedeContext';
import { useStockLevels, useStockProducts, useStockSedeSettings, useStockWarehouses } from '@/hooks/useStock';
import { formatMadridDate } from '@/utils/date';
import { addInventoryDays, centralWarehouse, pendingDemand, buildingInventory } from './inventoryDomain';
import { readInventoryBags } from './inventoryReadiness';

export function useInventoryWorkspace(days = 3) {
  const { activeSede } = useSede();
  const warehousesQuery = useStockWarehouses();
  const levelsQuery = useStockLevels();
  const productsQuery = useStockProducts();
  const settingsQuery = useStockSedeSettings();
  const warehouses = warehousesQuery.data ?? [];
  const levels = levelsQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const central = centralWarehouse(warehouses);
  const from = formatMadridDate(new Date());
  const to = addInventoryDays(from, days - 1);
  const bagsQuery = useQuery({
    queryKey: ['inventory-preparation', activeSede?.id, from, to, productsQuery.dataUpdatedAt, warehousesQuery.dataUpdatedAt],
    queryFn: () => readInventoryBags(activeSede!.id, from, to, products, warehouses),
    enabled: !!activeSede?.id && productsQuery.isSuccess && warehousesQuery.isSuccess,
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 1,
  });
  const bags = bagsQuery.data ?? [];
  const stockError = warehousesQuery.isError || levelsQuery.isError || productsQuery.isError;
  const stockLoading = !activeSede || warehousesQuery.isLoading || levelsQuery.isLoading || productsQuery.isLoading;
  const demandReady = !stockLoading && !stockError && bagsQuery.isSuccess && !bagsQuery.isError;
  return { central, warehouses, levels, products, bags, from, to, stockError, stockLoading, demandReady,
    demandError: bagsQuery.isError, demand: demandReady ? pendingDemand(bags) : new Map<string, number>(),
    buildings: buildingInventory(warehouses, levels, demandReady ? bags : [], central?.id),
    centralLevels: central ? levels.filter(l => l.warehouse_id === central.id) : [],
    settings: settingsQuery.data, settingsError: settingsQuery.isError,
    updatedAt: levelsQuery.dataUpdatedAt,
    refresh: () => Promise.all([warehousesQuery.refetch(), levelsQuery.refetch(), productsQuery.refetch(), settingsQuery.refetch(), bagsQuery.refetch()]),
  };
}
