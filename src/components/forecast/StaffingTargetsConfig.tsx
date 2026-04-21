import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useStaffingTargets, useUpsertStaffingTarget } from '@/hooks/useStaffingTargets';
import { Settings } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const StaffingTargetsConfig = ({ open, onOpenChange }: Props) => {
  const { data: targets } = useStaffingTargets();
  const upsert = useUpsertStaffingTarget();

  const handleChange = (
    dow: number,
    field: 'min_workers' | 'min_hours' | 'notes',
    value: string
  ) => {
    const existing = targets?.find(t => t.day_of_week === dow);
    upsert.mutate({
      day_of_week: dow,
      min_workers: field === 'min_workers' ? Number(value) || 0 : existing?.min_workers ?? 2,
      min_hours: field === 'min_hours' ? Number(value) || 0 : Number(existing?.min_hours ?? 12),
      notes: field === 'notes' ? value : existing?.notes ?? null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> Plantilla mínima por día
          </DialogTitle>
          <DialogDescription>
            Define cuántas trabajadoras y horas se consideran el mínimo aceptable para cada día de la semana en esta sede.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {[1, 2, 3, 4, 5, 6, 0].map(dow => {
            const t = targets?.find(x => x.day_of_week === dow);
            return (
              <div
                key={dow}
                className="grid grid-cols-12 items-center gap-3 border-b border-border/50 pb-3 last:border-0"
              >
                <div className="col-span-3">
                  <p className="text-sm font-medium">{DAY_NAMES[dow]}</p>
                </div>
                <div className="col-span-3">
                  <Label className="text-xs text-muted-foreground">Personas</Label>
                  <Input
                    type="number"
                    min={0}
                    defaultValue={t?.min_workers ?? 2}
                    onBlur={e => handleChange(dow, 'min_workers', e.target.value)}
                  />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs text-muted-foreground">Horas totales</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    defaultValue={t?.min_hours ?? 12}
                    onBlur={e => handleChange(dow, 'min_hours', e.target.value)}
                  />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs text-muted-foreground">Notas</Label>
                  <Input
                    defaultValue={t?.notes ?? ''}
                    placeholder="Opcional"
                    onBlur={e => handleChange(dow, 'notes', e.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
