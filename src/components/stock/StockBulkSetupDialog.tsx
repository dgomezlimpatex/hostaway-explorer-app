import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
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
import { useAdjustStock, useUpdateStockLevelSettings } from '@/hooks/useStock';
import type { StockLevel } from '@/types/stock';

interface StockBulkSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levels: StockLevel[];
}

type DraftLevel = {
  current_quantity: string;
  minimum_quantity: string;
  target_quantity: string;
  cost_per_unit: string;
};

const toDraft = (level: StockLevel): DraftLevel => ({
  current_quantity: String(level.current_quantity ?? 0),
  minimum_quantity: String(level.minimum_quantity ?? 0),
  target_quantity: String(level.target_quantity ?? 0),
  cost_per_unit: level.cost_per_unit == null ? '' : String(level.cost_per_unit),
});

const toNumber = (value: string) => Number(value || 0);

export function StockBulkSetupDialog({ open, onOpenChange, levels }: StockBulkSetupDialogProps) {
  const { user } = useAuth();
  const adjustStock = useAdjustStock();
  const updateSettings = useUpdateStockLevelSettings();
  const [drafts, setDrafts] = useState<Record<string, DraftLevel>>({});
  const [reason, setReason] = useState('Carga inicial / recuento masivo');

  const editableLevels = useMemo(
    () => [...levels].sort((a, b) =>
      `${a.product?.category?.name || ''}${a.product?.name || ''}${a.warehouse?.name || ''}`
        .localeCompare(`${b.product?.category?.name || ''}${b.product?.name || ''}${b.warehouse?.name || ''}`)
    ),
    [levels]
  );

  useEffect(() => {
    if (!open) return;
    setDrafts(Object.fromEntries(editableLevels.map((level) => [level.id, toDraft(level)])));
    setReason('Carga inicial / recuento masivo');
  }, [editableLevels, open]);

  const updateDraft = (levelId: string, field: keyof DraftLevel, value: string) => {
    setDrafts((current) => ({
      ...current,
      [levelId]: {
        ...current[levelId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id) return;

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast.error('Indica un motivo para los cambios de cantidad.');
      return;
    }

    let changedRows = 0;

    for (const level of editableLevels) {
      const draft = drafts[level.id];
      if (!draft) continue;

      const currentQuantity = toNumber(draft.current_quantity);
      const minimumQuantity = toNumber(draft.minimum_quantity);
      const targetQuantity = toNumber(draft.target_quantity);
      const costPerUnit = draft.cost_per_unit === '' ? null : toNumber(draft.cost_per_unit);

      if (targetQuantity < minimumQuantity) {
        toast.error(`Objetivo inferior al minimo en ${level.product?.name || 'producto'}.`);
        return;
      }

      const quantityChanged = currentQuantity !== level.current_quantity;
      const settingsChanged =
        minimumQuantity !== level.minimum_quantity ||
        targetQuantity !== level.target_quantity ||
        costPerUnit !== (level.cost_per_unit ?? null);

      if (quantityChanged) {
        await adjustStock.mutateAsync({
          stock_level: level,
          movement_type: 'ajuste',
          quantity: currentQuantity,
          reason: trimmedReason,
          cost_per_unit: costPerUnit,
          user_id: user.id,
        });
      }

      if (settingsChanged) {
        await updateSettings.mutateAsync({
          stock_level_id: level.id,
          minimum_quantity: minimumQuantity,
          target_quantity: targetQuantity,
          cost_per_unit: costPerUnit,
          user_id: user.id,
        });
      }

      if (quantityChanged || settingsChanged) changedRows += 1;
    }

    toast.success(changedRows > 0 ? `${changedRows} lineas actualizadas` : 'No habia cambios que guardar');
    onOpenChange(false);
  };

  const isSaving = adjustStock.isPending || updateSettings.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carga operativa de stock</DialogTitle>
          <DialogDescription>
            Actualiza cantidades, minimos, objetivos y costes. Los cambios de cantidad generan movimientos de ajuste.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-reason">Motivo para los ajustes de cantidad</Label>
            <Input
              id="bulk-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 font-medium">Almacen</th>
                  <th className="px-3 py-2 font-medium">Actual</th>
                  <th className="px-3 py-2 font-medium">Minimo</th>
                  <th className="px-3 py-2 font-medium">Objetivo</th>
                  <th className="px-3 py-2 font-medium">Coste unidad</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {editableLevels.map((level) => {
                  const draft = drafts[level.id] || toDraft(level);
                  return (
                    <tr key={level.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{level.product?.name || 'Producto'}</div>
                        <div className="text-xs text-muted-foreground">
                          {level.product?.category?.name || 'Sin tipo'} · {level.product?.unit_of_measure || 'unidades'}
                        </div>
                      </td>
                      <td className="px-3 py-2">{level.warehouse?.name || 'Almacen'}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.current_quantity}
                          onChange={(event) => updateDraft(level.id, 'current_quantity', event.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.minimum_quantity}
                          onChange={(event) => updateDraft(level.id, 'minimum_quantity', event.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.target_quantity}
                          onChange={(event) => updateDraft(level.id, 'target_quantity', event.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={draft.cost_per_unit}
                          onChange={(event) => updateDraft(level.id, 'cost_per_unit', event.target.value)}
                          placeholder="0,00"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !user?.id}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
