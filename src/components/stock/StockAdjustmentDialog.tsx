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

  useEffect(() => {
    if (open) setMovementType('entrada');
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!level || !user?.id) return;

    const form = new FormData(event.currentTarget);
    await adjustStock.mutateAsync({
      stock_level: level,
      movement_type: movementType,
      quantity: Number(form.get('quantity') || 0),
      reason: String(form.get('reason') || ''),
      cost_per_unit: form.get('cost_per_unit') ? Number(form.get('cost_per_unit')) : undefined,
      user_id: user.id,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <DialogDescription>
            {level?.product?.name || 'Producto'} en {level?.warehouse?.name || 'almacen'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-sm">
            Stock actual: <span className="font-mono font-semibold">{level?.current_quantity ?? 0}</span>
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={movementType} onValueChange={(value) => setMovementType(value as ManualMovementType)}>
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
            <Input id="quantity" name="quantity" type="number" min="0" step="0.01" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_per_unit">Coste unidad opcional</Label>
            <Input id="cost_per_unit" name="cost_per_unit" type="number" min="0" step="0.0001" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo</Label>
            <Input id="reason" name="reason" required placeholder="Compra, recuento, rotura..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={adjustStock.isPending || !level || !user?.id}>
              Guardar ajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
