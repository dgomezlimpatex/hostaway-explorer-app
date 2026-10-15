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
import { quantity } from '@/features/inventory/inventoryDomain';
import { locationName } from '@/features/inventory/inventoryViews';

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
  const [amount, setAmount] = useState('');
  const available = (level?.current_quantity ?? 0) - (level?.reserved_quantity ?? 0);
  const moved = Number(amount.replace(',', '.'));
  const remaining = amount === '' || !Number.isFinite(moved) ? null : Math.round((available - moved) * 100) / 100;

  const availableWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.id !== level?.warehouse_id),
    [warehouses, level?.warehouse_id]
  );

  useEffect(() => {
    if (!open) return;
    // The destination is chosen explicitly every time: a preselected location is an easy mistake.
    setToWarehouseId('');
    setAmount('');
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!level || !user?.id || !toWarehouseId) return;

    const form = new FormData(event.currentTarget);
    try {
      await transferStock.mutateAsync({
        stock_level: level,
        to_warehouse_id: toWarehouseId,
        quantity: Number(form.get('quantity') || 0),
        reason: String(form.get('reason') || ''),
        user_id: user.id,
      });
      onOpenChange(false);
    } catch {
      // The error toast explains the failure; the form keeps its values to retry.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>Mover a otra ubicación</DialogTitle>
          <DialogDescription>
            {level?.product?.name || 'Producto'} desde {locationName(level?.warehouse?.name)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-sm">
            Disponible en origen: <span className="font-semibold tabular-nums">{quantity(available)}</span> {level?.product?.unit_of_measure}
          </div>

          <div className="space-y-2">
            <Label>Ubicación de destino</Label>
            <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
              <SelectTrigger aria-label="Ubicación de destino">
                <SelectValue placeholder="Elige el destino" />
              </SelectTrigger>
              <SelectContent>
                {availableWarehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {locationName(warehouse.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer_quantity">Cantidad</Label>
            <Input id="transfer_quantity" name="quantity" type="number" inputMode="decimal" min="0.01" step="0.01" required onChange={event => setAmount(event.target.value)} />
            <p role="status" className={remaining !== null && remaining < 0 ? 'text-sm font-medium text-red-700' : 'text-sm text-muted-foreground'}>
              {remaining === null ? 'Escribe la cantidad que vas a mover.' : remaining < 0 ? 'Supera lo disponible en origen. Revisa la cantidad.' : `Quedarán ${quantity(remaining)} disponibles en origen.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer_reason">Motivo</Label>
            <Input id="transfer_reason" name="reason" required placeholder="Reposición del trastero, traslado…" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={transferStock.isPending || !level || !user?.id || !toWarehouseId || availableWarehouses.length === 0}
            >
              {transferStock.isPending ? 'Moviendo…' : 'Mover'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
