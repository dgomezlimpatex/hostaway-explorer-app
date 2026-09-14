import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSelectedStockWarehouse } from '@/hooks/useStock';

export function StockWarehouseSelect() {
  const { warehouses, selectedWarehouseId, setSelectedWarehouseId } = useSelectedStockWarehouse();

  return (
    <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
      <SelectTrigger aria-label="Almacén consultado" className="w-full sm:w-64">
        <SelectValue placeholder="Almacén" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos los almacenes</SelectItem>
        {warehouses.map((warehouse) => (
          <SelectItem key={warehouse.id} value={warehouse.id}>
            {warehouse.name}{warehouse.is_default ? ' (principal)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
