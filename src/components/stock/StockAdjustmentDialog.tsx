import { FormEvent, useEffect, useState } from 'react';
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
import { useAdjustStock } from '@/hooks/useStock';
import type { StockLevel, StockMovementType } from '@/types/stock';
import { readPendingBagOperation, type PendingBagOperation } from '@/services/stockBagAccounting';

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: StockLevel | null;
}

type ManualMovementType = Extract<StockMovementType, 'entrada' | 'salida' | 'ajuste'>;

export function StockAdjustmentDialog({ open, onOpenChange, level }: StockAdjustmentDialogProps) {
  const { user } = useAuth();
  const adjustStock = useAdjustStock();
  const [movementType, setMovementType] = useState<ManualMovementType>('entrada');
  const [pending, setPending] = useState<PendingBagOperation | null>(null);
  const scope = `adjust:${user?.id}:${level?.id}`;

  useEffect(() => {
    if (open) {
      const saved = readPendingBagOperation(scope);
      setPending(saved);
      setMovementType((saved?.args._kind as ManualMovementType) || 'entrada');
    }
  }, [open, scope]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!level || !user?.id) return;

    const form = new FormData(event.currentTarget);
    try { await adjustStock.mutateAsync({
      stock_level: level,
      movement_type: movementType,
      quantity: Number(form.get('quantity') || 0),
      reason: String(form.get('reason') || ''),
      cost_per_unit: form.get('cost_per_unit') ? Number(form.get('cost_per_unit')) : undefined,
      user_id: user.id,
      verified_count: pending?.args._verified === true,
    });

    onOpenChange(false);
    } catch { setPending(readPendingBagOperation(scope)); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <DialogDescription>
            {level?.product?.name || 'Producto'} en {level?.warehouse?.name || 'almacén'}
          </DialogDescription>
        </DialogHeader>

        <form key={`${level?.id}:${String(pending?.args._operation || 'new')}`} onSubmit={handleSubmit} className="space-y-4">
          {pending && <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Este movimiento está pendiente de confirmar. Reintentar conserva sus cantidades y evita duplicarlo.</p>}
          <div className="rounded-md bg-muted p-3 text-sm">
            {level?.quantity_basis==='partial'?'Saldo parcial':'Stock registrado'}: <span className="font-mono font-semibold">{level?.current_quantity ?? 0}</span>
            {level?.bag_accounting_active && <p className="mt-2 text-xs">Material suelto. Las bolsas preparadas ya están descontadas. Para acreditar una cantidad física, usa «Contar existencias».</p>}
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select disabled={!!pending} value={movementType} onValueChange={(value) => setMovementType(value as ManualMovementType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="salida">Salida</SelectItem>
                <SelectItem value="ajuste">Ajuste a cantidad exacta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">
              {movementType === 'ajuste' ? 'Nueva cantidad total' : 'Cantidad'}
            </Label>
            <Input id="quantity" name="quantity" type="number" min="0" step="0.01" required readOnly={!!pending} defaultValue={pending ? Number(pending.args._quantity) : undefined} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_per_unit">Coste unidad opcional</Label>
            <Input id="cost_per_unit" name="cost_per_unit" type="number" min="0" step="0.0001" readOnly={!!pending} defaultValue={pending?.args._cost == null ? undefined : Number(pending.args._cost)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo</Label>
            <Input id="reason" name="reason" required placeholder="Compra, recuento, rotura..." readOnly={!!pending} defaultValue={pending ? String(pending.args._reason) : undefined} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={adjustStock.isPending || !level || !user?.id}>
              {pending ? 'Reintentar movimiento pendiente' : 'Guardar ajuste'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
