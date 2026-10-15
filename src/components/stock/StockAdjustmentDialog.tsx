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
import { useAuth } from '@/hooks/useAuth';
import { useAdjustStock } from '@/hooks/useStock';
import type { StockLevel, StockMovementType } from '@/types/stock';
import { readPendingBagOperation, type PendingBagOperation } from '@/services/stockBagAccounting';
import { quantity } from '@/features/inventory/inventoryDomain';
import { adjustmentResult } from '@/features/inventory/inventoryViews';
import { cn } from '@/lib/utils';

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
  const [amount, setAmount] = useState('');
  const scope = `adjust:${user?.id}:${level?.id}`;

  useEffect(() => {
    if (open) {
      const saved = readPendingBagOperation(scope);
      setPending(saved);
      setMovementType((saved?.args._kind as ManualMovementType) || 'entrada');
      setAmount(saved ? String(saved.args._quantity ?? '') : '');
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

  const current = Number(level?.current_quantity ?? 0);
  const preview = amount === '' ? null : adjustmentResult(current, movementType, Number(amount.replace(',', '.')));
  const types: Array<[ManualMovementType, string, string]> = [['entrada', 'Entrada', 'Suma al saldo'], ['salida', 'Salida', 'Resta del saldo'], ['ajuste', 'Ajustar a cantidad exacta', 'Sustituye el saldo']];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>
            {level?.product?.name || 'Producto'} en {level?.warehouse?.name || 'almacén'}
          </DialogDescription>
        </DialogHeader>

        <form key={`${level?.id}:${String(pending?.args._operation || 'new')}`} onSubmit={handleSubmit} className="space-y-4">
          {pending && <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Este movimiento está pendiente de confirmar. Reintentar conserva sus cantidades y evita duplicarlo.</p>}
          <div className="rounded-md bg-muted p-3 text-sm">
            {level?.quantity_basis==='partial'?'Saldo parcial':'Stock registrado'}: <span className="font-semibold tabular-nums">{quantity(current)}</span> {level?.product?.unit_of_measure}
            {level?.bag_accounting_active && <p className="mt-2 text-xs">Material suelto. Las bolsas preparadas ya están descontadas. Para acreditar una cantidad física, usa «Contar existencias».</p>}
          </div>

          <fieldset className="space-y-2" disabled={!!pending}>
            <legend className="text-sm font-medium">Tipo de movimiento</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {types.map(([value, label, hint]) => (
                <label key={value} className={cn('flex cursor-pointer flex-col rounded-md border p-2.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary', movementType === value ? 'border-primary bg-primary/[.06] text-primary' : 'hover:border-primary/40')}>
                  <input type="radio" name="movement_type" value={value} checked={movementType === value} onChange={() => setMovementType(value)} className="sr-only" />
                  <span className="font-semibold">{label}</span><span className="text-xs text-muted-foreground">{hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="quantity">
              {movementType === 'ajuste' ? 'Nueva cantidad total' : 'Cantidad'}
            </Label>
            <Input id="quantity" name="quantity" type="number" inputMode="decimal" min="0" step="0.01" required readOnly={!!pending} defaultValue={pending ? Number(pending.args._quantity) : undefined} onChange={event => setAmount(event.target.value)} />
            <p role="status" className={cn('text-sm', preview !== null && preview < 0 ? 'font-medium text-red-700' : 'text-muted-foreground')}>
              {preview === null ? 'Escribe la cantidad para ver cómo quedará el saldo.' : `Quedará en ${quantity(preview)}${preview < 0 ? ': la salida supera el saldo registrado. Revisa la cantidad o cuenta las existencias.' : ''}`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo</Label>
            <Input id="reason" name="reason" required placeholder="Compra, rotura, devolución…" readOnly={!!pending} defaultValue={pending ? String(pending.args._reason) : undefined} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_per_unit">Coste por unidad (opcional)</Label>
            <Input id="cost_per_unit" name="cost_per_unit" type="number" inputMode="decimal" min="0" step="0.0001" readOnly={!!pending} defaultValue={pending?.args._cost == null ? undefined : Number(pending.args._cost)} />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={adjustStock.isPending || !level || !user?.id}>
              {adjustStock.isPending ? 'Guardando…' : pending ? 'Reintentar movimiento pendiente' : 'Guardar movimiento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
