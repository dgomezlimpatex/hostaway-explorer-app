import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useStockWarehouses, useTransferStock } from '@/hooks/useStock';
import type { StockLevel } from '@/types/stock';

interface StockTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: StockLevel | null;
}

export function StockTransferDialog({ open, onOpenChange, level }: StockTransferDialogProps) {
  const { user } = useAuth();
  const { data: warehouses = [] } = useStockWarehouses();
  const transferStock = useTransferStock();
  const [toWarehouseId, setToWarehouseId] = useState('');

  const availableWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.id !== level?.warehouse_id),
    [warehouses, level?.warehouse_id]
  );

  useEffect(() => {
    if (!open) return;
    setToWarehouseId(availableWarehouses[0]?.id || '');
  }, [availableWarehouses, open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!level || !user?.id || !toWarehouseId) return;

    const form = new FormData(event.currentTarget);
    await transferStock.mutateAsync({
      stock_level: level,
      to_warehouse_id: toWarehouseId,
      quantity: Number(form.get('quantity') || 0),
      reason: String(form.get('reason') || ''),
      user_id: user.id,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir stock</DialogTitle>
          <DialogDescription>
            {level?.product?.name || 'Producto'} desde {level?.warehouse?.name || 'almacen'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-sm">
            Stock disponible: <span className="font-mono font-semibold">{level?.current_quantity ?? 0}</span>
          </div>

          <div className="space-y-2">
            <Label>Almacen destino</Label>
            <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar almacen" />
              </SelectTrigger>
              <SelectContent>
                {availableWarehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer_quantity">Cantidad</Label>
            <Input id="transfer_quantity" name="quantity" type="number" min="0.01" step="0.01" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer_reason">Motivo</Label>
            <Input id="transfer_reason" name="reason" required placeholder="Reposicion, traslado entre almacenes..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={transferStock.isPending || !level || !user?.id || !toWarehouseId || availableWarehouses.length === 0}
            >
              Transferir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
